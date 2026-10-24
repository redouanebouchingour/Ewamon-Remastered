// @vitest-environment jsdom
/**
 * The adventure journal's words (talk/journal.ts) and store (state/journal.ts): the prompt (neutral system prompt, the
 * day's facts and the job in the user turn, no em-dashes), the tidying ("Day N:" first), the checks against the facts
 * (names, numbers, a result turned around, too few facts told, feature 5's checks), the template, one model call with
 * the model injected, and the store: today's page and the missed days written on open (the model's words or the
 * template), a page behind the day, Rewrite today, the journal off.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { JournalDay, JournalEntryView, JournalFact, JournalView } from '@ewa/protocol';
import type { ChatOnceOptions, ChatOnceResult } from '../src/talk/llm';
import { JOURNAL_SYSTEM, checkEntry, entryMessages, factsTold, resultFlips, templateEntry, tidyEntry, writeEntry } from '../src/talk/journal';
import { closeJournal, isStale, openJournal, rewriteToday, useJournalStore } from '../src/state/journal';
import type { JournalApi } from '../src/state/journal';
import { ApiFailure } from '../src/net/api';

const DASH = String.fromCharCode(0x2014);
const fact = (kind: JournalFact['kind'], text: string, over: Partial<JournalFact> = {}): JournalFact => ({ kind, text, speciesId: null, zoneId: null, type: null, count: 1, ...over });
const FACTS: JournalFact[] = [
  fact('badge', 'I won the Bloom Badge from Mira Thornwell!', { type: 'Grass' }),
  fact('caught', 'I caught 2 Mossling on Mire Route.', { speciesId: 'mossling', zoneId: 'mire_route', count: 2 }),
  fact('rival', 'My rival Corin beat me on Mire Route.'),
  fact('villager', 'I beat Hessa Dunmore in a battle.'),
];
const answer = (content: string) => async (_o: ChatOnceOptions): Promise<ChatOnceResult> => ({ content, toolCalls: [] });

describe('the prompt', () => {
  it('keeps the system prompt neutral and the facts, the day and the voice in the user turn', () => {
    const m = entryMessages(12, FACTS);
    expect(m.map((x) => x.role)).toEqual(['system', 'user']);
    expect(m[0]!.content).toBe(JOURNAL_SYSTEM);
    expect(m[1]!.content).toContain('- I caught 2 Mossling on Mire Route.');
    expect(m[1]!.content).toContain('starting with "Day 12:"');
    expect(m[1]!.content).toContain('as "I"');
    for (const x of m) {
      expect(x.content).toContain('Never use em-dashes.');
      expect(x.content.includes(DASH)).toBe(false);
    }
  });
});

describe('the checks', () => {
  it('keeps an entry that holds to the facts, with "Day N:" set right', () => {
    const raw = `Day 3: What a day ${DASH} I won the Bloom Badge from Mira Thornwell! I caught 2 Mossling on Mire Route. My rival Corin beat me, though. Tired but proud.`;
    expect(checkEntry(raw, 12, FACTS)).toBe('Day 12: What a day, I won the Bloom Badge from Mira Thornwell! I caught 2 Mossling on Mire Route. My rival Corin beat me, though. Tired but proud.');
    expect(tidyEntry('"I caught two Mossling. Then I rested."', 4)).toBe('Day 4: I caught two Mossling. Then I rested.');
    expect(tidyEntry('Dear diary, I caught a Mossling. It was fun.', 2)).toBe('Day 2: I caught a Mossling. It was fun.');
  });

  it('drops a wrong number, an invented name, a result turned around, or too little told', () => {
    expect(checkEntry('Day 12: I caught 3 Mossling on Mire Route. I won the Bloom Badge.', 12, FACTS)).toBeNull();
    expect(checkEntry('Day 12: I won the Bloom Badge. Old Tom cheered me on Mire Route.', 12, FACTS)).toBeNull();
    expect(checkEntry('Day 12: I won the Bloom Badge. I beat my rival Corin on Mire Route.', 12, FACTS)).toBeNull();
    expect(checkEntry('Day 12: I won the Bloom Badge. Then Hessa Dunmore beat me.', 12, FACTS)).toBeNull();
    expect(checkEntry('Day 12: It was a lovely day. I walked a lot and slept well.', 12, FACTS)).toBeNull();
    expect(checkEntry('Day 12: Badge.', 12, FACTS)).toBeNull();
    expect(resultFlips('I beat my rival Corin.', FACTS)).toEqual(['Corin']);
    expect(resultFlips('Corin beat me again.', FACTS)).toEqual([]);
    expect(factsTold('I won the Bloom Badge and caught 2 Mossling.', FACTS)).toBe(2);
  });

  it('runs feature 5 checks: a type claim the chart contradicts goes', () => {
    expect(checkEntry('Day 12: I won the Bloom Badge. Grass moves are super effective on Fire, so I caught 2 Mossling on Mire Route.', 12, FACTS)).toBeNull();
  });
});

describe('the template', () => {
  it('"Day N:" and the first facts as they are; a quiet day; no em-dash', () => {
    expect(templateEntry(12, FACTS)).toBe(`Day 12: ${FACTS.map((f) => f.text).join(' ')}`);
    expect(templateEntry(3, [])).toBe('Day 3: A quiet day.');
    const many = Array.from({ length: 7 }, (_, i) => fact('wild', `I won battle ${i + 1}.`));
    expect(templateEntry(5, many).endsWith('And more besides.')).toBe(true);
    expect(templateEntry(5, [fact('deed', `I hit Pim ${DASH} sorry.`)]).includes(DASH)).toBe(false);
  });
});

describe('one model call', () => {
  it('returns the checked entry, or null when the model strays, is down, or the day is empty', async () => {
    expect(await writeEntry(12, FACTS, { chat: answer('Day 12: I won the Bloom Badge from Mira Thornwell! I caught 2 Mossling on Mire Route.') })).not.toBeNull();
    expect(await writeEntry(12, FACTS, { chat: answer('Day 12: I caught 9 Mossling. I won a badge.') })).toBeNull();
    expect(await writeEntry(12, FACTS, { chat: () => Promise.reject(new Error('down')) })).toBeNull();
    expect(await writeEntry(12, [], { chat: answer('Day 12: Nothing.') })).toBeNull();
  });
});

describe('the store', () => {
  const day = (d: string, n: number, facts: JournalFact[], entry: JournalEntryView | null = null): JournalDay => ({ day: d, dayNumber: n, facts, entry });
  const page = (d: string, n: number, text: string, facts: JournalFact[] = FACTS): JournalEntryView => ({ day: d, dayNumber: n, text, facts, writtenAt: '2026-10-24T12:00:00.000Z' });
  const fakeApi = (view: JournalView, days: Record<string, JournalDay>, writes: [string, string][]): JournalApi => ({
    load: async () => view,
    day: async (d) => days[d]!,
    write: async (d, text) => {
      writes.push([d, text]);
      return page(d, days[d]?.dayNumber ?? view.today.dayNumber, text, days[d]?.facts ?? view.today.facts);
    },
  });
  beforeEach(() => {
    closeJournal();
    useJournalStore.setState({ status: 'idle', view: null, writing: [] });
  });

  it("writes today's page and the missed days on open: the model's words when they hold, else the template", async () => {
    const yFacts = [fact('wild', 'I won a battle against wild Ewamon.')];
    const view: JournalView = { today: day('2026-10-24', 12, FACTS), unwritten: ['2026-10-23'], entries: [] };
    const writes: [string, string][] = [];
    const api = fakeApi(view, { '2026-10-23': day('2026-10-23', 11, yFacts), '2026-10-24': view.today }, writes);
    const chat = async (o: ChatOnceOptions): Promise<ChatOnceResult> => ({
      content: o.messages[1]!.content.includes('day 12') ? 'Day 12: I won the Bloom Badge from Mira Thornwell! I caught 2 Mossling on Mire Route.' : 'Day 11: I won 40 battles.',
      toolCalls: [],
    });
    await openJournal({ api, chat, model: true });
    expect(writes).toEqual([
      ['2026-10-24', 'Day 12: I won the Bloom Badge from Mira Thornwell! I caught 2 Mossling on Mire Route.'],
      ['2026-10-23', 'Day 11: I won a battle against wild Ewamon.'],
    ]);
    const st = useJournalStore.getState();
    expect(st.status).toBe('ready');
    expect(st.view!.today.entry?.text).toContain('Day 12:');
    expect(st.view!.entries.map((e) => e.day)).toEqual(['2026-10-24', '2026-10-23']);
    expect(st.view!.unwritten).toEqual([]);
    expect(st.writing).toEqual([]);
  });

  it('writes nothing for a written or an empty today; Rewrite today writes it again from fresh facts', async () => {
    const written = page('2026-10-24', 12, 'Day 12: I won the Bloom Badge.', FACTS.slice(0, 1));
    const view: JournalView = { today: day('2026-10-24', 12, FACTS.slice(0, 1), written), unwritten: [], entries: [written] };
    const writes: [string, string][] = [];
    const fresh = day('2026-10-24', 12, FACTS, written);
    const api = fakeApi(view, { '2026-10-24': fresh }, writes);
    await openJournal({ api, model: false });
    expect(writes).toEqual([]);
    expect(isStale(written, FACTS.slice(0, 1))).toBe(false);
    expect(isStale(written, FACTS)).toBe(true);
    await rewriteToday({ api, model: false });
    expect(writes).toEqual([['2026-10-24', templateEntry(12, FACTS)]]);
    expect(useJournalStore.getState().view!.today.facts).toEqual(FACTS);
    expect(useJournalStore.getState().view!.entries).toHaveLength(1);

    const empty: JournalView = { today: day('2026-10-24', 12, []), unwritten: [], entries: [] };
    const none: [string, string][] = [];
    await openJournal({ api: fakeApi(empty, {}, none), model: false });
    expect(none).toEqual([]);
  });

  it('is off with NPC_TOOLS=off, and an error when the read fails', async () => {
    const off: JournalApi = { load: () => Promise.reject(new ApiFailure({ status: 409, code: 'npcToolsOff', detail: null })), day: async () => ({}) as never, write: async () => ({}) as never };
    await openJournal({ api: off });
    expect(useJournalStore.getState().status).toBe('off');
    await openJournal({ api: { ...off, load: () => Promise.reject(new Error('net')) } });
    expect(useJournalStore.getState().status).toBe('error');
  });
});
