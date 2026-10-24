/**
 * LLM feature 5, Prof. Wynn: the phrasing (prompts, `tidy`, the checks on a model answer, the model mocked or down),
 * the Ask store (facts at once, words after; facts alone when the model is off, down or wrong; a newer question wins),
 * the loss breakdown read off a battle's events (`lossReport`), the battle logger the result card reads and the
 * "Why did I lose?" review.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { createBattle, projectBattler } from '@ewa/core';
import type { BattleEvent, BattleState, CreatureInstance, Ref } from '@ewa/core';
import { fallbackLines, lossReport } from '../src/battle/lossFacts';
import type { BattleLog } from '../src/battle/lossFacts';
import { NO_DASHES } from '../src/talk/llm';
import { answerMessages, checkedAnswer, lossMessages, mineOf, phrase, tidy } from '../src/talk/professor';
import type { ProfMon, ProfSave } from '../src/talk/professorFacts';
import {
  MAX_ENTRIES, askProfessor, canReview, clearProfessor, createBattleLogger, currentSave, openLossReview, teeCommentary, useLossReviewStore, useProfessorStore,
} from '../src/state/professor';
import type { Commentator } from '../src/battle/commentator';
import { useSessionStore } from '../src/state/session';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const D = '\u2014';
const BID = '00000000-0000-4000-8000-0000000000d5';
const name = (id: string): string => content.species(id).name;
const mon = (speciesId: string, level: number, moves: string[] = []): ProfMon => ({ speciesId, name: name(speciesId), level, moves, honor: null });

type Chat = NonNullable<Parameters<typeof phrase>[4]>['chat'];
const reply = (content: string): Chat => vi.fn(async () => ({ content, toolCalls: [] })) as unknown as Chat;

afterEach(() => {
  vi.unstubAllGlobals();
  clearProfessor();
  useLossReviewStore.setState({ log: null, review: null });
});

// ---- phrasing -----------------------------------------------------------------------------------------------------

describe('the professor’s words', () => {
  it('the prompts: a neutral system prompt, the facts and the question in the user turn, no em-dashes asked', () => {
    const m = answerMessages('  Where   is Mossling? ', ['Mossling lives on Mire Route at level 2 to 5 (common).']);
    expect(m[0]!.role).toBe('system');
    expect(m[0]!.content).not.toMatch(/Wynn/);
    expect(m[1]!.content).toContain('- Mossling lives on Mire Route');
    expect(m[1]!.content).toContain('The player asks: "Where is Mossling?"');
    for (const x of [...m, ...lossMessages(['a fact'])]) {
      expect(x.content).toContain(NO_DASHES);
      expect(x.content).not.toContain(D);
    }
  });

  it('tidy: dashes out, repeated sentences dropped, four at most', () => {
    expect(tidy(`You can catch it on Mire Route ${D} it is common. You can catch it on Mire Route.`)).toBe('You can catch it on Mire Route, it is common.');
    expect(tidy('One. Two. Three. Four. Five.')).toBe('One. Two. Three. Four.');
    expect(tidy('   ')).toBe('');
  });

  it('checkedAnswer keeps a grounded answer and drops an invented name, a number, a wrong side or a wrong type claim', () => {
    const facts = ['Ghost and Dark moves are super effective on Ghost.', 'Their Bramblecub has Leaf Blade.'];
    expect(checkedAnswer('Use Dark moves on Ghost types.', facts, 'q', [])).toBe('Use Dark moves on Ghost types.');
    expect(checkedAnswer('Use Dark moves, like Pyrecap does.', facts, 'q', [])).toBeNull();
    expect(checkedAnswer('Use Dark moves at level 40.', facts, 'q', [])).toBeNull();
    expect(checkedAnswer('Your Bramblecub has Leaf Blade.', facts, 'q', ['Glimfin'])).toBeNull();
    expect(checkedAnswer('Psychic and Ghost are strong against Ghost types.', facts, 'q', [])).toBeNull();
    expect(checkedAnswer('Ok.', facts, 'q', [])).toBeNull();
  });

  it('phrase: the model’s checked words, null when it throws or strays', async () => {
    const facts = ['Mossling lives on Mire Route at level 2 to 5 (common).'];
    const msgs = answerMessages('where is mossling', facts);
    expect(await phrase(msgs, facts, 'where is mossling', [], { chat: reply(`You will find Mossling on Mire Route ${D} at level 2 to 5.`) })).toBe('You will find Mossling on Mire Route, at level 2 to 5.');
    expect(await phrase(msgs, facts, 'where is mossling', [], { chat: reply('Mossling lives on Tide Route.') })).toBeNull();
    const down = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as Chat;
    expect(await phrase(msgs, facts, 'where is mossling', [], { chat: down })).toBeNull();
  });

  it('mineOf: the player’s names and species names', () => {
    const save = { party: [{ ...mon('dustcub', 10), name: 'Sparky' }], box: [mon('glimfin', 5)] } as unknown as ProfSave;
    expect(mineOf(save, name)).toEqual(['Sparky', 'Dustcub', 'Glimfin', 'Glimfin']);
  });
});

// ---- the Ask store ------------------------------------------------------------------------------------------------

function creature(speciesId: string, level: number, id: string): CreatureInstance {
  return makeCreature(content, content.species(speciesId), level, id, 'p0');
}

function signIn(party: CreatureInstance[], box: CreatureInstance[] = []): void {
  useSessionStore.setState({
    zoneId: 'mirevale',
    progression: { badges: [], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], flags: ['met_wynn'], quests: {}, questsClaimed: [], missions: [] },
    inventory: { items: {}, money: 0, party, box },
  });
}

describe('askProfessor (state/professor.ts)', () => {
  beforeEach(() => signIn([creature('glimfin', 10, 'a')], [creature('cindercap', 8, 'b')]));

  it('the session snapshot is the professor’s save', () => {
    const s = currentSave();
    expect(s.party.map((m) => m.speciesId)).toEqual(['glimfin']);
    expect(s.box.map((m) => m.level)).toEqual([8]);
    expect(s.zoneId).toBe('mirevale');
  });

  it('facts at once, the words when the model answers', async () => {
    let release: (v: { content: string; toolCalls: [] }) => void = () => undefined;
    const chat = vi.fn(() => new Promise((r) => (release = r))) as unknown as Chat;
    const p = askProfessor("What beats Mira's team?", { chat, model: true });
    const e = useProfessorStore.getState().entries[0]!;
    expect(e.pending).toBe(true);
    expect(e.text).toBeNull();
    expect(e.sheet.topic).toBe('matchup');
    expect(e.sheet.facts.join(' ')).toContain('Mira Thornwell');
    release({ content: 'Bring Cindercap: Fire moves are super effective on Grass.', toolCalls: [] });
    await p;
    const done = useProfessorStore.getState().entries[0]!;
    expect(done.pending).toBe(false);
    expect(done.text).toBe('Bring Cindercap: Fire moves are super effective on Grass.');
  });

  it('the facts alone when the model is off, down or wrong', async () => {
    await askProfessor('what should I do next', { model: false });
    expect(useProfessorStore.getState().entries[0]).toMatchObject({ pending: false, text: null });
    await askProfessor('what should I do next', { model: true, chat: reply('Go and beat Zeon at level 99.') });
    expect(useProfessorStore.getState().entries[1]).toMatchObject({ pending: false, text: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await askProfessor('what should I do next', { model: true });
    expect(useProfessorStore.getState().entries[2]).toMatchObject({ pending: false, text: null });
  });

  it('a newer question cancels the one still thinking; the panel keeps the last few; blank is ignored', async () => {
    const slow = vi.fn((o: { signal?: AbortSignal }) => new Promise((_r, rej) => o.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as Chat;
    const first = askProfessor('what should I do next', { model: true, chat: slow });
    await askProfessor('is my team any good', { model: false });
    await first;
    const [a, b] = useProfessorStore.getState().entries;
    expect(a).toMatchObject({ pending: false, text: null });
    expect(b!.sheet.topic).toBe('team');
    await askProfessor('   ', { model: false });
    for (let i = 0; i < MAX_ENTRIES + 2; i++) await askProfessor(`tell me about mossling ${i}`, { model: false });
    expect(useProfessorStore.getState().entries).toHaveLength(MAX_ENTRIES);
  });
});

// ---- the loss breakdown -------------------------------------------------------------------------------------------

function battle(own: readonly [string, number][], foe: readonly [string, number][], kind: 'npc' | 'wild' = 'npc'): BattleState {
  const mine = own.map(([sp, lv], i) => projectBattler(creature(sp, lv, `mine-${i}`), content));
  const theirs = foe.map(([sp, lv], i) => projectBattler(makeCreature(content, content.species(sp), lv, `foe-${i}`, null), content));
  return createBattle(
    {
      id: BID, format: kind === 'wild' ? 'wild' : 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 5,
      sides: [
        { kind: 'player', party: mine, active: 0, trainerId: 'p0', canFlee: kind === 'wild', canCatch: kind === 'wild' },
        { kind, party: theirs, active: 0, trainerId: kind === 'wild' ? null : 'trainer.x', canFlee: false, canCatch: false },
      ],
    },
    content,
  ).state;
}
const R = (side: 0 | 1, slot = 0): Ref => ({ side, slot });
const dmg = (source: Ref, target: Ref, move: string, amount: number, eff: number): BattleEvent =>
  ({ t: 'damage', target, source, amount, hpAfter: 1, maxHp: 50, cause: 'move', move, crit: false, effectiveness: eff, stab: true }) as BattleEvent;

const save: ProfSave = {
  party: [mon('glimfin', 10), mon('dustcub', 9)],
  box: [mon('cindercap', 8)],
  badges: [], flags: [], dexCaught: [], dexSeen: [], zoneId: 'mirevale', items: {},
};

function lostLog(): BattleLog {
  const start = battle([['glimfin', 10], ['dustcub', 9]], [['smellduck', 12], ['briarbear', 14]]);
  const events: BattleEvent[] = [
    dmg(R(0), R(1), 'Water Gun', 8, 0.5),
    dmg(R(1), R(0), 'Vine Lash', 20, 2),
    { t: 'faint', who: R(1) } as BattleEvent,
    { t: 'switchIn', who: R(1, 1) } as BattleEvent,
    dmg(R(0), R(1, 1), 'Water Gun', 6, 0.5),
    dmg(R(1, 1), R(0), 'Leaf Blade', 30, 2),
    { t: 'faint', who: R(0) } as BattleEvent,
    { t: 'switchIn', who: R(0, 1) } as BattleEvent,
    dmg(R(1, 1), R(0, 1), 'Leaf Blade', 40, 2),
    { t: 'faint', who: R(0, 1) } as BattleEvent,
    { t: 'battleEnd', outcome: { winner: 1 }, turns: 4 } as BattleEvent,
  ];
  return { battleId: BID, seat: 0, start, events };
}

describe('lossReport (battle/lossFacts.ts)', () => {
  it('the move that hurt most, the matchups, the level gap, the knockouts and what to bring from the box', () => {
    const r = lossReport(lostLog(), save)!;
    expect(r.facts).toEqual([
      "The opponent's Briarbear hurt you most, with Leaf Blade: 70 HP in all, super effective on your Glimfin and Dustcub.",
      'You took 3 super-effective hits and landed 0.',
      "Your Glimfin's Water Gun was not very effective on the opponent's Smellduck.",
      'Their strongest was level 14; yours was level 10. Train about 4 more levels.',
      'You knocked out 1 of the 2 they sent out, and lost 2.',
      'Next time bring Fire and Ice moves: Cindercap (level 8) in your box has the type.',
    ]);
    expect(r.bring).toEqual(['Fire', 'Ice']);
    expect(r.bringSpecies).toEqual(['cindercap']);
    expect(r.foes).toEqual(['smellduck', 'briarbear']);
    expect(fallbackLines(r)).toEqual([r.facts[0], r.facts[1], r.facts[5]]);
    for (const f of r.facts) expect(f).not.toContain(D);
  });

  it('a bench the player never saw stays hidden; a wild foe is "the wild"; no hit, no report', () => {
    const log = lostLog();
    const short: BattleLog = { ...log, events: log.events.slice(0, 3) };
    const r = lossReport(short, save)!;
    expect(r.foes).toEqual(['smellduck']);
    expect(r.facts.join(' ')).not.toContain('Briarbear');
    const wild = battle([['glimfin', 5]], [['briarbear', 9]], 'wild');
    const w = lossReport({ battleId: BID, seat: 0, start: wild, events: [dmg(R(1), R(0), 'Vine Lash', 25, 2), { t: 'faint', who: R(0) } as BattleEvent] }, save)!;
    expect(w.facts[0]).toBe("The wild Briarbear hurt you most, with Vine Lash: 25 HP in all, super effective on your Glimfin.");
    expect(w.facts.join(' ')).not.toMatch(/knocked out/);
    expect(lossReport({ battleId: BID, seat: 0, start: wild, events: [] }, save)).toBeNull();
  });

  it('with no creature of the types to bring, a wild one nearby', () => {
    const r = lossReport(lostLog(), { ...save, box: [] })!;
    expect(r.facts[r.facts.length - 1]).toMatch(/^Next time bring Fire and Ice moves\. \w+ \(/);
    expect(r.bringSpecies.length).toBeGreaterThan(0);
  });
});

describe('the battle logger and "Why did I lose?"', () => {
  beforeEach(() => signIn([creature('glimfin', 10, 'a'), creature('dustcub', 9, 'b')], [creature('cindercap', 8, 'c')]));

  const begin = (start: BattleState, o: Partial<Parameters<Commentator['begin']>[0]> = {}) => ({
    battleId: BID, seat: 0 as const, format: start.format, state: start, foe: null, replay: false, spectator: false, fresh: true, ...o,
  });

  it('logs the start and every timeline’s events until the battle ends; a tee feeds both', () => {
    const log = lostLog();
    const seen: string[] = [];
    const spy: Commentator = { begin: () => seen.push('begin'), timeline: () => seen.push('timeline'), played: () => seen.push('played'), end: () => seen.push('end') };
    const c = teeCommentary(spy, createBattleLogger());
    c.begin(begin(log.start));
    expect(canReview(useLossReviewStore.getState().log)).toBe(false);
    c.timeline(log.events.slice(0, 5), log.start);
    c.played();
    c.timeline(log.events.slice(5), log.start);
    expect(useLossReviewStore.getState().log?.events).toHaveLength(log.events.length);
    expect(canReview(useLossReviewStore.getState().log)).toBe(true);
    c.end();
    expect(useLossReviewStore.getState().log).toBeNull();
    expect(seen).toEqual(['begin', 'timeline', 'played', 'timeline', 'end']);
    // a spectated match or a raid is not logged
    const l = createBattleLogger();
    l.begin(begin(log.start, { spectator: true }));
    expect(useLossReviewStore.getState().log).toBeNull();
  });

  it('the review: the facts at once, the coaching when the model has it, once per battle', async () => {
    const log = lostLog();
    const l = createBattleLogger();
    l.begin(begin(log.start));
    l.timeline(log.events, log.start);
    let release: (v: { content: string; toolCalls: [] }) => void = () => undefined;
    const chat = vi.fn(() => new Promise((r) => (release = r))) as unknown as Chat;
    const p = openLossReview({ chat, model: true });
    const r = useLossReviewStore.getState().review!;
    expect(r.pending).toBe(true);
    expect(r.lines[0]).toContain("The opponent's Briarbear hurt you most, with Leaf Blade");
    release({ content: "Their Briarbear's Leaf Blade hit your Glimfin hard. Next time bring Cindercap and its Fire moves.", toolCalls: [] });
    await p;
    expect(useLossReviewStore.getState().review).toMatchObject({ pending: false, text: "Their Briarbear's Leaf Blade hit your Glimfin hard. Next time bring Cindercap and its Fire moves." });
    await openLossReview({ chat, model: true });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('the review without the model: the facts alone', async () => {
    const log = lostLog();
    const l = createBattleLogger();
    l.begin(begin(log.start));
    l.timeline(log.events, log.start);
    await openLossReview({ model: true, chat: reply('Their Rexaloft crushed you.') });
    expect(useLossReviewStore.getState().review).toMatchObject({ pending: false, text: null });
    expect(useLossReviewStore.getState().review?.lines).toHaveLength(3);
  });
});
