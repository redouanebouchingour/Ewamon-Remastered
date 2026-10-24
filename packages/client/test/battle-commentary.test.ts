/**
 * LLM feature 3, the battle commentator and the trainer's banter: the event-to-moment classifier, the highlight pick,
 * the throttle, the seeded template picker, the bank prompts and their parsers / validators (fetch mocked), and the
 * commentator itself (what it says, when, and what it drops), with the model off or mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAGUE, createContentIndex } from '@ewa/content';
import { createBattle, digestBattleState, projectBattler } from '@ewa/core';
import type { BattleEvent, BattleFormat, BattleState, Ref } from '@ewa/core';
import { villagerTrainerId } from '@ewa/protocol';
import type { NpcMemoryView } from '@ewa/protocol';
import { COMEBACK_FRAC, MAJOR_MOMENTS, highlightOf, momentsOf } from '../src/battle/moments';
import type { MomentLookups } from '../src/battle/moments';
import { TRAINER_GAP_MS, authored, createCommentator, personaOf, trainerMomentOf } from '../src/battle/commentator';
import { foeIdentity } from '../src/battle/foe';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { STEP_MS } from '../src/battle/constants';
import {
  CASTER_GAP_MS, COLOUR, HEADLINES, TRAINER_LINES, casterBankMessages, cleanLine, createPicker, createThrottle, fetchCasterBank, fetchTrainerBank, fill, memoryInstruction,
  parseCasterBank, parseTrainerBank, trainerBankMessages, villagerStartLines,
} from '../src/talk/commentary';
import { NO_DASHES } from '../src/talk/llm';
import { useCommentaryStore } from '../src/state/commentary';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const D = '\u2014';
const BID = '00000000-0000-4000-8000-0000000000c3';

/** a battle: the player's team against a wild or NPC team (species ids), side 0 = the player */
function battle(format: BattleFormat, own: readonly string[], foe: readonly string[], trainerId: string | null = null): BattleState {
  const mine = own.map((sp, i) => projectBattler(makeCreature(content, content.species(sp), 30, `mine-${i}`, 'p0'), content));
  const theirs = foe.map((sp, i) => projectBattler(makeCreature(content, content.species(sp), 30, `foe-${i}`, null), content));
  return createBattle(
    {
      id: BID, format, zoneId: 'mirevale', terrain: 'grove', seed: 3,
      sides: [
        { kind: 'player', party: mine, active: 0, trainerId: 'p0', canFlee: format === 'wild', canCatch: format === 'wild' },
        { kind: format === 'wild' ? 'wild' : 'npc', party: theirs, active: 0, trainerId, canFlee: false, canCatch: false },
      ],
    },
    content,
  ).state;
}

const R = (side: 0 | 1, slot = 0): Ref => ({ side, slot });
const look = (st: BattleState, bands: Record<string, 'majin' | 'tenjin'> = {}): MomentLookups => ({
  seat: 0,
  nameOf: (r) => content.species(st.sides[r.side].party[r.slot]!.creature.speciesId).name,
  bandOf: (r) => bands[`${r.side}:${r.slot}`] ?? null,
});
const hit = (target: Ref, source: Ref, hpAfter: number, maxHp: number, o: { crit?: boolean; eff?: number } = {}): BattleEvent =>
  ({ t: 'damage', target, source, amount: 10, hpAfter, maxHp, cause: 'move', move: 'tackle', crit: o.crit ?? false, effectiveness: o.eff ?? 1, stab: false }) as BattleEvent;

beforeEach(() => {
  useSettingsStore.setState({ accessibility: DEFAULT_SETTINGS.accessibility });
  useCommentaryStore.setState({ caster: null, trainer: null, finalCaster: null, finalTrainer: null });
  useUiStore.getState().reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---- the classifier ---------------------------------------------------------------------------------------------

describe('momentsOf: the core events of a timeline → its moments', () => {
  const st = battle('trainer', ['bramblecub', 'mossling'], ['mossling', 'bramblecub'], 'trainer.x');
  const own = st.sides[0].party[0]!;
  const foe = st.sides[1].party[0]!;

  it('a crit and a super-effective hit are the attacker’s moments; a plain hit, a self-inflicted or an ally hit none', () => {
    const ms = momentsOf([hit(R(1), R(0), 20, foe.maxHp, { crit: true, eff: 2 }), hit(R(0), R(1), 30, own.maxHp)], st, look(st));
    expect(ms.map((m) => [m.kind, m.side, m.name, m.other])).toEqual([
      ['crit', 'own', 'Bramblecub', 'Mossling'],
      ['super', 'own', 'Bramblecub', 'Mossling'],
    ]);
    const recoil = { ...hit(R(0), R(0), 30, own.maxHp, { crit: true }), cause: 'recoil' } as BattleEvent;
    expect(momentsOf([recoil, hit(R(0, 1), R(0), 5, own.maxHp, { crit: true })], st, look(st))).toEqual([]);
  });

  it('a faint is a knockout on the fainted side; landed at low HP by the attacker it is also a comeback', () => {
    const low = Math.floor(own.maxHp * COMEBACK_FRAC);
    const events: BattleEvent[] = [hit(R(0), R(1), low, own.maxHp), hit(R(1), R(0), 0, foe.maxHp), { t: 'faint', who: R(1) }];
    const ms = momentsOf(events, st, look(st));
    expect(ms.map((m) => [m.kind, m.side, m.name, m.other])).toEqual([
      ['knockout', 'foe', 'Mossling', 'Bramblecub'],
      ['comeback', 'own', 'Bramblecub', 'Mossling'],
    ]);
    expect(highlightOf(ms)?.kind).toBe('comeback');
    // healthy attacker: no comeback
    const fine = momentsOf([hit(R(1), R(0), 0, foe.maxHp), { t: 'faint', who: R(1) }], st, look(st));
    expect(fine.map((m) => m.kind)).toEqual(['knockout']);
  });

  it('a status, a band transform, a last creature, a catch and a break-out, the win and the loss', () => {
    const lookups = look(st, { '1:0': 'tenjin' });
    const ms = momentsOf(
      [
        { t: 'statusApplied', target: R(0), status: 'paralyze', source: R(1), turns: null },
        { t: 'formChange', who: R(1), form: 'tenjin', atk: 1, def: 1, spd: 1 },
        { t: 'formChange', who: R(0), form: 'wild', atk: 1, def: 1, spd: 1 },
        hit(R(1), R(0), 0, foe.maxHp),
        { t: 'faint', who: R(1) },
        { t: 'switchIn', who: R(1, 1) },
        { t: 'battleEnd', outcome: { winner: 0 }, turns: 4 },
      ],
      st,
      lookups,
    );
    expect(ms.map((m) => m.kind)).toEqual(['status', 'transform', 'knockout', 'lastOne', 'win']);
    expect(ms[0]).toMatchObject({ side: 'own', status: 'paralyze' });
    expect(ms[1]).toMatchObject({ side: 'foe', band: 'tenjin' });
    expect(ms[3]).toMatchObject({ side: 'foe', name: 'Bramblecub' });
    expect(highlightOf(ms)?.kind).toBe('win');
    const loss = momentsOf([{ t: 'battleEnd', outcome: { winner: 1 }, turns: 4 }], st, lookups);
    expect(loss.map((m) => m.kind)).toEqual(['loss']);
    const w = battle('wild', ['bramblecub'], ['mossling']);
    const caught = momentsOf([{ t: 'catchResult', caught: true, target: R(1), shakes: 4 }], w, look(w));
    const broke = momentsOf([{ t: 'catchResult', caught: false, target: R(1), shakes: 1 }], w, look(w));
    expect([caught[0]?.kind, broke[0]?.kind, caught[0]?.name]).toEqual(['catch', 'escape', 'Mossling']);
  });

  it('a switch-in with others still standing, or into a team of one, is no last stand', () => {
    expect(momentsOf([{ t: 'switchIn', who: R(1, 1) }], st, look(st))).toEqual([]);
    const solo = battle('wild', ['bramblecub'], ['mossling']);
    expect(momentsOf([{ t: 'switchIn', who: R(1) }], solo, look(solo))).toEqual([]);
  });

  it('the majors are the end, a catch, a transform, a comeback, a last stand and the opening', () => {
    expect([...MAJOR_MOMENTS].sort()).toEqual(['catch', 'comeback', 'lastOne', 'loss', 'opening', 'transform', 'win']);
  });
});

// ---- the throttle and the picker ---------------------------------------------------------------------------------

describe('the throttle keeps it to highlights', () => {
  it('majors always speak; a minor needs the gap since the last line and never repeats the last minor', () => {
    const t = createThrottle(1000);
    expect(t.take('opening', true, 0)).toBe(true);
    expect(t.take('crit', false, 500)).toBe(false);   // too soon after the opening
    expect(t.take('crit', false, 1000)).toBe(true);
    expect(t.take('super', false, 1500)).toBe(false); // too soon
    expect(t.take('crit', false, 2500)).toBe(false);  // the same minor again
    expect(t.take('super', false, 2500)).toBe(true);
    expect(t.take('lastOne', true, 2600)).toBe(true); // a major never waits
    expect(t.take('crit', false, 3000)).toBe(false);  // the major reset the clock
    expect(CASTER_GAP_MS).toBeGreaterThanOrEqual(5000);
  });
});

describe('the template picker', () => {
  it('is seeded (same battle, same lines), varied across battles, and never repeats a line back to back', () => {
    const a = createPicker('battle-a');
    const b = createPicker('battle-a');
    const seqA = Array.from({ length: 40 }, () => a.pick('crit', 3));
    const seqB = Array.from({ length: 40 }, () => b.pick('crit', 3));
    expect(seqA).toEqual(seqB);
    for (let i = 1; i < seqA.length; i++) expect(seqA[i]).not.toBe(seqA[i - 1]);
    expect(new Set(seqA).size).toBe(3);
    const c = createPicker('battle-b');
    expect(Array.from({ length: 40 }, () => c.pick('crit', 3))).not.toEqual(seqA);
    expect(createPicker('x').pick('one', 1)).toBe(0);
  });

  it('fills the facts in, and no template carries an em-dash', () => {
    expect(fill(HEADLINES.status[0]!, { name: 'Bramblecub', status: 'sleep' })).toBe('Bramblecub is fast asleep!');
    expect(fill(HEADLINES.transform[0]!, { name: 'Glimmereen', band: 'tenjin' })).toBe('Glimmereen goes Tenjin!');
    expect(fill(HEADLINES.win[1]!, { player: 'Ash' })).toBe('Victory for Ash!');
    const all = [...Object.values(HEADLINES), ...Object.values(COLOUR), ...Object.values(TRAINER_LINES)].flat();
    for (const l of all) expect(l).not.toContain(D);
    for (const k of Object.keys(HEADLINES)) expect((HEADLINES as Record<string, readonly string[]>)[k]!.length).toBeGreaterThanOrEqual(3);
  });
});

// ---- the banks -----------------------------------------------------------------------------------------------------

const reply = (content: string): Response => Response.json({ choices: [{ message: { content } }] });
const sent = (m: ReturnType<typeof vi.fn>, i = 0): Record<string, unknown> => JSON.parse(String((m.mock.calls[i]![1] as RequestInit).body)) as Record<string, unknown>;

describe('the bank prompts', () => {
  it('say no em-dashes, keep the commentator name free and spell out the trainer’s side of each moment', () => {
    const c = casterBankMessages({ kind: 'a trainer battle', ownTypes: ['Grass'], foeTypes: ['Fire', 'Rock'] });
    const t = trainerBankMessages({ who: 'Rook, a route trainer', memory: 'You do not trust the traveller.' });
    for (const m of [...c, ...t]) expect(m.content).not.toContain(D);
    expect(c[1]!.content).toContain(NO_DASHES);
    expect(c[1]!.content).toContain('a Grass type against a Fire and Rock type');
    expect(c[1]!.content).toContain('Do not name anyone');
    expect(t[0]!.content).toContain('Answer with JSON only.');
    expect(t[1]!.content).toContain('You are Rook, a route trainer');
    expect(t[1]!.content).toContain('You do not trust the traveller.');
    expect(t[1]!.content).toContain('faint: the traveller just knocked out one of your Ewamon');
  });

  it('a villager’s memory goes in feeling first, the memory last; a stranger with nothing to say adds nothing', () => {
    const wary = { feeling: 'wary', summary: 'The traveller slapped me.', deeds: [] } as unknown as NpcMemoryView;
    expect(memoryInstruction(wary)).toBe('You do not trust the traveller and you want to beat them. What you remember of them: The traveller slapped me.');
    expect(memoryInstruction({ feeling: 'neutral', summary: '', deeds: [] } as unknown as NpcMemoryView)).toBe('');
    expect(memoryInstruction(null)).toBe('');
  });
});

describe('the bank parsers', () => {
  it('cleans each line: em-dashes out, quotes off, a full stop on; drops junk, names, sides and long lines', () => {
    expect(cleanLine(`"What a hit ${D} wow"`, true)).toBe('What a hit, wow.');
    expect(cleanLine('the opponent is down', true)).toBeNull();
    expect(cleanLine('Bramblecub strikes!', true, ['Bramblecub'])).toBeNull();
    expect(cleanLine('{name} strikes', true)).toBeNull();
    expect(cleanLine('word '.repeat(20), true)).toBeNull();
    expect(cleanLine(42, true)).toBeNull();
    expect(cleanLine('Water beats fire!', true, [], false)).toBeNull();
    expect(cleanLine('Water meets fire!', true, [], true)).toBe('Water meets fire!');
    expect(cleanLine('You will regret this, traveller', false)).toBe('You will regret this, traveller.');
  });

  it('a commentator bank: zod-checked, per key, a bad key dropped alone; nothing usable is null', () => {
    const bank = parseCasterBank(
      'Sure! ```json\n' +
        JSON.stringify({ opening: ['Grass meets Fire!', 'Here we go'], crit: ['The opponent reels', 'Right on the button!'], win: 'not an array', loss: [3, 'Tough day.'] }) +
        '\n```',
    );
    // `win` is no array and `loss` holds a number: each key is dropped on its own, the rest stays
    expect(bank).toEqual({ opening: ['Grass meets Fire!', 'Here we go.'], crit: ['Right on the button!'] });
    expect(parseCasterBank('no json here')).toBeNull();
    expect(parseCasterBank(JSON.stringify({ crit: ['the foe falls'] }))).toBeNull();
  });

  it('a trainer bank drops a line with the outcome backwards', () => {
    const bank = parseTrainerBank(JSON.stringify({ start: ['You will lose.'], loss: ['Admit your defeat!', 'This loss stings.'], win: ['You won, fine.', 'Too easy.'] }));
    expect(bank).toEqual({ start: ['You will lose.'], loss: ['This loss stings.'], win: ['Too easy.'] });
  });

  it('fetches a bank as one JSON-schema call at a low temperature; an error or junk is null', async () => {
    const f = vi.fn(async () => reply(JSON.stringify({ start: ['Ready to lose?', 'Go!'], faint: ['Get up!', 'Lucky.'], last_one: ['All on you now.', 'Go!'], win: ['Too easy.', 'Ha.'], loss: ['This stings.', 'Next time.'] })));
    vi.stubGlobal('fetch', f);
    const bank = await fetchTrainerBank({ who: 'Rook, a route trainer', memory: '' });
    expect(bank?.start).toEqual(['Ready to lose?', 'Go!']);
    const body = sent(f);
    expect(body).toMatchObject({ temperature: 0.5, stream: false });
    expect((body['response_format'] as { type: string }).type).toBe('json_schema');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })));
    expect(await fetchTrainerBank({ who: 'Rook', memory: '' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => reply('the moments are nice')));
    expect(await fetchCasterBank({ kind: 'a wild encounter', ownTypes: [], foeTypes: [] }, [])).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(await fetchCasterBank({ kind: 'a wild encounter', ownTypes: [], foeTypes: [] }, [])).toBeNull();
  });
});

// ---- the commentator -----------------------------------------------------------------------------------------------

function begin(c: ReturnType<typeof createCommentator>, st: BattleState, trainerId: string | null, o: { replay?: boolean; fresh?: boolean } = {}): void {
  c.begin({
    battleId: BID, seat: 0, format: st.format, state: st, foe: trainerId === null ? null : foeIdentity(trainerId, st.sides[1].party[0]!.creature.speciesId),
    replay: o.replay ?? false, spectator: false, fresh: o.fresh ?? true,
  });
}

describe('the commentator', () => {
  const st = battle('trainer', ['bramblecub'], ['mossling', 'mossling'], 'route.rook');
  const foe = st.sides[1].party[0]!;

  it('calls the opening when the start has played, and the trainer opens its mouth; with the model off, from templates', () => {
    const c = createCommentator({ content, banks: false, now: () => 0 });
    begin(c, st, 'route.rook');
    c.timeline([{ t: 'switchIn', who: R(0) }, { t: 'switchIn', who: R(1) }], st);
    expect(useCommentaryStore.getState().caster).toBeNull(); // not before the timeline has played
    c.played();
    const { caster, trainer } = useCommentaryStore.getState();
    expect(caster).toMatchObject({ kind: 'opening', battleId: BID, fromModel: false });
    expect(HEADLINES.opening.map((h) => fill(h, { name: 'Bramblecub', other: 'Mossling' }))).toContain(caster!.head);
    expect(COLOUR.opening).toContain(caster!.text);
    expect(trainer).toMatchObject({ kind: 'start', fromModel: false });
    expect(TRAINER_LINES.start).toContain(trainer!.text);
  });

  it('a knockout speaks for both; a minor right after is held back; a timeline cut short says nothing', () => {
    let t = 0;
    const c = createCommentator({ content, banks: false, now: () => t });
    begin(c, st, 'route.rook');
    c.timeline([], st);
    c.played();
    t = 10_000;
    c.timeline([hit(R(1), R(0), 0, foe.maxHp), { t: 'faint', who: R(1) }], st);
    c.played();
    expect(useCommentaryStore.getState().caster?.kind).toBe('knockout');
    expect(useCommentaryStore.getState().trainer?.kind).toBe('faint');
    expect(useCommentaryStore.getState().trainer?.text).not.toContain('{name}');
    t = 11_000;
    const before = useCommentaryStore.getState().caster;
    c.timeline([hit(R(1, 1), R(0), 10, foe.maxHp, { crit: true })], st);
    c.played();
    expect(useCommentaryStore.getState().caster).toBe(before); // too soon for a minor
    // a timeline replaced before it played (a resync): its moments are gone
    t = 30_000;
    c.timeline([{ t: 'battleEnd', outcome: { winner: 0 }, turns: 3 }], st);
    c.timeline([], st);
    c.played();
    expect(useCommentaryStore.getState().caster).toBe(before);
  });

  it('the end: the commentator calls it and the trainer has the last word, kept for the result card', () => {
    const c = createCommentator({ content, banks: false, now: () => 0 });
    begin(c, st, 'route.rook', { fresh: false });
    c.timeline([{ t: 'battleEnd', outcome: { winner: 0 }, turns: 3 }], st);
    c.played();
    const s = useCommentaryStore.getState();
    expect(s.caster?.kind).toBe('win');
    expect(s.finalCaster).toBe(s.caster);
    expect(s.finalTrainer?.kind).toBe('loss'); // the trainer lost
    c.end();
    expect(useCommentaryStore.getState().finalCaster).toBeNull();
  });

  it('switched off, nothing is said; a raid or a spectated match gets nothing either', () => {
    useSettingsStore.getState().set('accessibility', { battleCommentary: false, trainerBanter: false });
    const c = createCommentator({ content, banks: false, now: () => 0 });
    begin(c, st, 'route.rook');
    c.timeline([], st);
    c.played();
    expect(useCommentaryStore.getState()).toMatchObject({ caster: null, trainer: null });
    useSettingsStore.getState().set('accessibility', { battleCommentary: true, trainerBanter: true });
    c.begin({ battleId: BID, seat: 0, format: st.format, state: st, foe: null, replay: false, spectator: true, fresh: true });
    c.timeline([], st);
    c.played();
    expect(useCommentaryStore.getState().caster).toBeNull();
  });

  it('a league trainer keeps its authored lines: no start, last stand or concession banter, a faint gets one', () => {
    const mira = LEAGUE.find((l) => l.id === 'verdant_gym')!;
    const lf = foeIdentity(mira.id);
    expect(['start', 'last_one', 'loss'].map((k) => authored(lf, k as 'start'))).toEqual([true, mira.mid !== undefined, true]);
    expect(authored(lf, 'faint')).toBe(false);
    expect(authored(lf, 'win')).toBe(false);
    expect(authored(foeIdentity('route.rook'), 'start')).toBe(false);
    const lst = battle('league', ['bramblecub'], ['mossling', 'mossling'], mira.id);
    const c = createCommentator({ content, banks: false, now: () => 0 });
    begin(c, lst, mira.id);
    c.timeline([], lst);
    c.played();
    expect(useCommentaryStore.getState().trainer).toBeNull();
    expect(useCommentaryStore.getState().caster?.kind).toBe('opening');
  });

  it('a faint line stands aside for a league banner on screen and for the trainer’s own last line', () => {
    let t = 0;
    const c = createCommentator({ content, banks: false, now: () => t });
    begin(c, st, 'route.rook', { fresh: false });
    useUiStore.getState().pushBattleBanner({ id: 1, speaker: 'Mira', text: 'Half way!' });
    c.timeline([{ t: 'faint', who: R(1) }], st);
    c.played();
    expect(useCommentaryStore.getState().trainer).toBeNull();
    useUiStore.getState().clearBattleBanners();
    c.timeline([{ t: 'faint', who: R(1) }], st);
    c.played();
    expect(useCommentaryStore.getState().trainer?.kind).toBe('faint');
    const first = useCommentaryStore.getState().trainer;
    t = TRAINER_GAP_MS - 1;
    c.timeline([{ t: 'faint', who: R(1, 1) }], st);
    c.played();
    expect(useCommentaryStore.getState().trainer).toBe(first);
  });

  it('the trainer moment of a timeline: the end first, then the last creature, then a faint, then the start', () => {
    const k = (kind: string, side: 'own' | 'foe' = 'foe', name = 'X') => ({ kind, side, name, other: null }) as Parameters<typeof trainerMomentOf>[0][number];
    expect(trainerMomentOf([k('knockout'), k('win', 'own')])?.kind).toBe('loss');
    expect(trainerMomentOf([k('knockout'), k('lastOne', 'foe', 'Y')])).toEqual({ kind: 'last_one', name: 'Y' });
    expect(trainerMomentOf([k('knockout', 'own')])).toBeNull();
    expect(trainerMomentOf([k('opening', 'own')])?.kind).toBe('start');
  });

  it('a villager remembers: its persona carries the memory and its start line names the deed', async () => {
    const npc = 'mirevale.archivist';
    const vid = villagerTrainerId(npc);
    const vf = foeIdentity(vid);
    const mem = { npcId: npc, known: true, summary: 'The traveller slapped me.', standing: -4, feeling: 'wary', deeds: [{ deed: 'hit', at: '2026-10-24T10:00:00.000Z' }], town: { zoneId: 'mirevale', name: 'Mirevale', score: -3, standing: 'wary', known: 2 }, gossip: [] } as NpcMemoryView;
    expect(personaOf(vf, mem).memory).toContain('The traveller slapped me.');
    expect(villagerStartLines(mem)).toEqual(['You hit me last time. Try that now.']);
    expect(villagerStartLines(null).length).toBeGreaterThan(1);
    const vst = battle('trainer', ['bramblecub'], ['mossling'], vid);
    const trainerBank = vi.fn(async () => null);
    const c = createCommentator({ content, now: () => 0, memory: async () => mem, fetchTrainerBank: trainerBank, fetchCasterBank: async () => null });
    begin(c, vst, vid);
    await vi.waitFor(() => expect(trainerBank).toHaveBeenCalled());
    expect((trainerBank.mock.calls[0] as unknown as [{ memory: string }])[0].memory).toContain('slapped');
    c.timeline([], vst);
    c.played();
    expect(useCommentaryStore.getState().trainer?.text).toBe('You hit me last time. Try that now.');
  });

  it('uses the banks once they are back, and drops a bank that answers after the battle', async () => {
    const tb = { start: ['Banked start line.'], faint: ['Banked faint line.'] };
    const cb = { opening: ['Grass meets Fire!'] };
    const c = createCommentator({ content, now: () => 0, fetchTrainerBank: async () => tb, fetchCasterBank: async () => cb });
    begin(c, st, 'route.rook');
    await vi.waitFor(() => new Promise<void>((r) => setTimeout(r, 0)));
    c.timeline([], st);
    c.played();
    expect(useCommentaryStore.getState().caster).toMatchObject({ text: 'Grass meets Fire!', fromModel: true });
    expect(useCommentaryStore.getState().trainer).toMatchObject({ text: 'Banked start line.', fromModel: true });

    // a slow bank: the battle ends first, the late answer is never used
    let release: (b: typeof tb) => void = () => undefined;
    const slow = createCommentator({ content, now: () => 0, fetchTrainerBank: () => new Promise((r) => (release = r)), fetchCasterBank: async () => null });
    begin(slow, st, 'route.rook');
    slow.end();
    release(tb);
    await new Promise<void>((r) => setTimeout(r, 0));
    begin(slow, st, 'route.rook', { replay: true });
    slow.timeline([], st);
    slow.played();
    expect(useCommentaryStore.getState().trainer?.fromModel).toBe(false);
  });
});

// ---- wired into the BattleController -------------------------------------------------------------------------------

describe('BattleController with the commentator', () => {
  const noView: BattleView = {
    enterBattle: () => undefined, exitBattle: () => undefined, setBattler: () => undefined, setPose: () => undefined, hurt: () => undefined, vfx: () => undefined,
    prewarm: () => undefined, syncFrom: () => undefined, setWeather: () => undefined, cue: () => undefined, shake: () => undefined, setTimeScale: () => undefined,
    hitstopEnabled: () => false, slowmoEnabled: () => false, playSfx: () => undefined, setBattleHud: () => undefined, setThreat: () => undefined,
  };
  const make = (commentary?: ReturnType<typeof createCommentator>) =>
    createBattleController({
      content, send: () => undefined, reduced: () => false, instantText: () => true, selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => 'p0',
      raidId: () => null, view: noView, defer: (fn) => fn(), ...(commentary ? { commentary } : {}),
    });

  it('the opening and the trainer’s first line come when the start has played; the battle itself is the same without them', () => {
    const r = createBattle(
      {
        id: BID, format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 7,
        sides: [
          { kind: 'player', party: [projectBattler(makeCreature(content, content.species('bramblecub'), 30, 'm-0', 'p0'), content)], active: 0, trainerId: 'p0', canFlee: false, canCatch: false },
          { kind: 'npc', party: [projectBattler(makeCreature(content, content.species('coalette'), 5, 's-0', null), content)], active: 0, trainerId: 'sable_mire', canFlee: false, canCatch: false },
        ],
      },
      content,
    );
    const msg = { type: 'battleStart' as const, battleId: BID, format: 'trainer' as const, seat: 0 as const, state: r.state, events: r.events, stateDigest: digestBattleState(r.state) };
    const run = (c: ReturnType<typeof make>): { ms: number; battle: unknown } => {
      c.onBattleStart(msg);
      let ms = 0;
      for (let i = 0; i < 4000 && c.player.isPlaying; i++) {
        c.player.step(STEP_MS);
        ms += STEP_MS;
      }
      const { log: _log, ...battle } = useUiStore.getState().battle!;
      return { ms, battle };
    };
    const plain = run(make());
    expect(useCommentaryStore.getState().caster).toBeNull();
    useUiStore.getState().reset();
    const c = make(createCommentator({ content, banks: false, now: () => 0 }));
    const spoken = run(c);
    expect(spoken).toEqual(plain);
    expect(useCommentaryStore.getState().caster).toMatchObject({ kind: 'opening', head: expect.stringContaining('Coalette') });
    expect(useCommentaryStore.getState().trainer).toMatchObject({ kind: 'start', speaker: 'Sable' });
    c.reset();
    expect(useCommentaryStore.getState()).toMatchObject({ caster: null, trainer: null });
  });
});
