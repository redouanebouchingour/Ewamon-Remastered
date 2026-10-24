/**
 * LLM feature 7, a recurring rival on the client: the facts in the rival's voice ("my" / "your", the last battle, the
 * record), how it feels by its arc, the prompts (neutral system prompt, no em-dashes), the line checker (names and
 * numbers the facts hold, whose creature is whose, the past the record allows, a parting line the right way round),
 * the templates per arc stage, the model call with the model mocked, the taunt / parting timing (state/rival.ts), the
 * rival as a foe (its look and its persona for feature 3's trainer bank) and its actor's exit walk.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivalView } from '@ewa/protocol';
import { NO_DASHES } from '../src/talk/llm';
import {
  PARTINGS, RIVAL_START, RIVAL_SYSTEM, TAUNTS, arcInstruction, checkRivalLine, fetchRivalLine, partingAngle, pastClaimsWrong, recordAfter, rivalFacts, rivalMessages,
  rivalPersona, tauntAngle, templateParting, templateTaunt, tidyRivalLine, whoseMixups,
} from '../src/talk/rival';
import type { RivalScene } from '../src/talk/rival';
import { partingLine, prewriteTaunt, resetRivalTalk, rivalViewFor, tauntLine, useRivalStore, writeParting } from '../src/state/rival';
import { foeIdentity, RIVAL_FALLBACK_LOOK } from '../src/battle/foe';
import { personaOf } from '../src/battle/commentator';
import { parseTrainerBank } from '../src/talk/commentary';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { RIVAL_ACTOR_ID, RivalExit, partingStand } from '../src/scene/rivalExit';

const D = String.fromCharCode(0x2014);

const view = (o: Partial<RivalView> = {}): RivalView => ({
  name: 'Corin',
  look: 'cowboy_male',
  temperament: 'brash',
  signature: 'cindercap',
  arc: 'cocky',
  record: { playerWins: 0, rivalWins: 0, draws: 0, meetings: 0 },
  last: null,
  team: [{ speciesId: 'cindercap', level: 14 }, { speciesId: 'glimp', level: 12 }],
  ...o,
});
const scene = (o: Partial<RivalScene> = {}, v: Partial<RivalView> = {}): RivalScene => ({
  rival: view(v),
  player: 'Mira',
  party: [
    { speciesId: 'bramblecub', nickname: null, level: 13, hp: 30 },
    { speciesId: 'mossling', nickname: 'Moss', level: 9, hp: 20 },
  ],
  badges: 1,
  zoneId: 'mire_route',
  ...o,
});
const won = (o: Partial<RivalView> = {}): Partial<RivalView> => ({
  record: { playerWins: 2, rivalWins: 1, draws: 0, meetings: 3 },
  last: { result: 'won', zoneId: 'ash_route', at: '2026-10-24T10:00:00.000Z', words: null },
  ...o,
});
const lost = (o: Partial<RivalView> = {}): Partial<RivalView> => ({
  record: { playerWins: 0, rivalWins: 2, draws: 0, meetings: 2 },
  last: { result: 'lost', zoneId: 'ash_route', at: '2026-10-24T10:00:00.000Z', words: null },
  ...o,
});

type Chat = NonNullable<Parameters<typeof fetchRivalLine>[2]>['chat'];
const reply = (text: string): Chat => vi.fn(async () => ({ content: text, toolCalls: [] })) as unknown as Chat;

afterEach(() => {
  vi.useRealTimers();
  resetRivalTalk();
  useSettingsStore.setState({ accessibility: DEFAULT_SETTINGS.accessibility });
});

describe('the facts (talk/rival.ts)', () => {
  it("say whose creature is whose, the last battle from the right side and the record", () => {
    const f = rivalFacts(scene({}, won()), null);
    expect(f).toContain('My name is Corin. I am your rival, loud and brash.');
    expect(f).toContain('Your name is Mira. You have 1 badge.');
    expect(f).toContain('Your team: your Bramblecub (Grass, level 13), your Moss (a Mossling, Water and Grass, level 9).');
    expect(f.find((x) => x.startsWith('My team:'))).toBe('My team: my Cindercap (Fire, level 14), my Glimp (Fairy, level 12).');
    expect(f).toContain('Our last battle was on Ash Route. You won it and I lost it.');
    expect(f).toContain('In all our battles, you won 2 and I won 1.');
    expect(rivalFacts(scene({}, lost()), null)).toContain('Our last battle was on Ash Route. I won it and you lost it.');
    expect(rivalFacts(scene(), null)).toContain('We have never battled before. This is our first battle.');
  });

  it('after a battle: the result and the record with it, and no teams', () => {
    const f = rivalFacts(scene({}, won()), 'lost');
    expect(f).toContain('We just battled. I won and you lost.');
    expect(f).toContain('In all our battles, you won 2 and I won 2.');
    expect(f.some((x) => x.includes('team'))).toBe(false);
    expect(recordAfter(view().record, 'draw')).toEqual({ playerWins: 0, rivalWins: 0, draws: 1, meetings: 1 });
  });

  it('feels its arc and never hands the model a "You lost" to copy', () => {
    expect(arcInstruction('cocky', null, null)).toMatch(/never battled/);
    expect(arcInstruction('cocky', null, won().last!)).toMatch(/luck/);
    expect(arcInstruction('frustrated', null, won().last!)).toMatch(/revenge/);
    expect(arcInstruction('respectful', null, won().last!)).toMatch(/respect/);
    for (const arc of ['cocky', 'frustrated', 'respectful'] as const) {
      for (const o of ['won', 'lost', 'draw'] as const) expect(arcInstruction(arc, o)).not.toMatch(/\bYou (lost|won)\b/);
    }
    expect(tauntAngle(scene())).toMatch(/introduce yourself/);
    expect(tauntAngle(scene({}, won()))).toMatch(/You got me last time/);
    expect(tauntAngle(scene({ badges: 6 }, won()))).toMatch(/grown strong/);
    expect(tauntAngle(scene({}, lost()))).toMatch(/you won our last battle/);
    expect(partingAngle('cocky', 'won')).toMatch(/luck/i);
    expect(partingAngle('frustrated', 'lost')).toMatch(/finally/i);
  });

  it('a neutral system prompt; the persona, facts and job in the user turn; no em-dashes', () => {
    const m = rivalMessages(scene({}, won()), null);
    expect(m[0]).toEqual({ role: 'system', content: RIVAL_SYSTEM });
    expect(m[0]!.content).toContain(NO_DASHES);
    expect(m[1]!.content).toContain('You are Corin, their rival.');
    expect(m[1]!.content).toContain('- Our last battle was on Ash Route. You won it and I lost it.');
    expect(m[1]!.content).toContain('Say "my" for your own Ewamon and "your" for theirs.');
    expect(m[1]!.content).toContain(NO_DASHES);
    expect(rivalMessages(scene(), 'won')[1]!.content).toContain('parting line');
    for (const x of [...m, ...rivalMessages(scene(), 'lost')]) expect(x.content.includes(D)).toBe(false);
  });
});

describe('the checks', () => {
  it('tidies: no em-dash, no label, no "my my", at most two sentences', () => {
    expect(tidyRivalLine(`Corin: "You again ${D} good. My my Cindercap is ready. Third. Fourth."`, 'Corin')).toBe('You again, good. My Cindercap is ready.');
    expect(tidyRivalLine('no sentence end', 'Corin')).toBe('');
  });

  it('whose creature is whose, nicknames and lists included', () => {
    expect(whoseMixups('My Cindercap will burn your Bramblecub.', ['Bramblecub', 'Moss'], ['Cindercap'])).toEqual([]);
    expect(whoseMixups('My Bramblecub is strong.', ['Bramblecub'], ['Cindercap'])).toEqual(['My Bramblecub']);
    expect(whoseMixups('You lost to my Sparky and Glimp.', ['Pyrecap', 'Sparky', 'Glimp'], ['Voltide'])).toEqual(['my Sparky', 'my Glimp']);
    expect(whoseMixups('Your Cindercap and Glimp are not scary.', ['Bramblecub'], ['Cindercap', 'Glimp'])).toEqual(['Your Cindercap', 'Your Glimp']);
  });

  it('the past the record allows', () => {
    const w = view(won());
    const l = view(lost());
    expect(pastClaimsWrong('Remember how you lost on Ash Route.', w)).not.toEqual([]);
    expect(pastClaimsWrong('You always lose.', w)).not.toEqual([]);
    expect(pastClaimsWrong('You got me last time, but not today.', w)).toEqual([]);
    expect(pastClaimsWrong('You lost the last battle.', l)).toEqual([]);
    expect(pastClaimsWrong('You beat me last time.', l)).not.toEqual([]);
    expect(pastClaimsWrong("You won't beat me today.", l)).toEqual([]);
    expect(pastClaimsWrong('You lost last time.', view())).not.toEqual([]);
    expect(pastClaimsWrong('Let us see what you have got.', view())).toEqual([]);
  });

  it('keeps a grounded line and drops the wrong ones', () => {
    const s = scene({}, won());
    expect(checkRivalLine('You got me last time, but not today. My Cindercap is ready.', s, null)).toBe('You got me last time, but not today. My Cindercap is ready.');
    expect(checkRivalLine('My Bramblecub will crush you.', s, null)).toBeNull();
    expect(checkRivalLine('My Voltide will crush you.', s, null)).toBeNull();
    expect(checkRivalLine('Remember how you lost on Ash Route.', s, null)).toBeNull();
    expect(checkRivalLine('I beat you 7 times.', s, null)).toBeNull();
    expect(checkRivalLine('Fire is strong against Water. Watch out.', s, null)).toBeNull();
    expect(checkRivalLine('As an AI I cannot taunt.', s, null)).toBeNull();
    // the parting line: the right way round
    expect(checkRivalLine('Lucky. Next time I win.', s, 'won')).toBe('Lucky. Next time I win.');
    expect(checkRivalLine('You lost again. My Cindercap won.', s, 'won')).toBeNull();
    expect(checkRivalLine('You win again. I will be back.', s, 'lost')).toBeNull();
    expect(checkRivalLine('Told you I would win.', s, 'lost')).toBe('Told you I would win.');
  });
});

describe('the templates', () => {
  it('per arc stage, filled with true facts and no em-dash', () => {
    expect(templateTaunt(scene())).toBe(TAUNTS.first[0]!.replace('{player}', 'Mira'));
    expect(templateTaunt(scene({}, won()))).toContain('Mira');
    expect(TAUNTS.frustrated.map((t) => t.replace(/\{\w+\}/g, 'x'))).toContain(templateTaunt(scene({}, won())).replace(/Mira|Bramblecub|Cindercap|2 times|Mire Route/g, 'x'));
    expect(templateParting(scene(), 'won')).toBe(PARTINGS.cocky.won[0]!.replace('{sig}', 'Cindercap'));
    expect(templateParting(scene({}, won()), 'won')).toMatch(/Again|keep doing/);
    expect(templateParting(scene({ badges: 7 }, won()), 'lost')).toMatch(/good fight|close/i);
    const all = [...Object.values(TAUNTS).flat(), ...Object.values(PARTINGS).flatMap((p) => Object.values(p).flat()), ...Object.values(RIVAL_START).flat()];
    for (const t of all) expect(t.includes(D)).toBe(false);
  });
});

describe('the model call', () => {
  it('returns the checked line, and null when the model is wrong or down', async () => {
    expect(await fetchRivalLine(scene({}, won()), null, { chat: reply('You got me last time, but not today.') })).toBe('You got me last time, but not today.');
    expect(await fetchRivalLine(scene({}, won()), null, { chat: reply('You always lose to me.') })).toBeNull();
    const down = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as Chat;
    expect(await fetchRivalLine(scene(), null, { chat: down })).toBeNull();
  });

  it('the taunt: pre-written at `near` and used when back in time, else the template', async () => {
    const s = scene({}, won());
    const fast = vi.fn(async () => 'You got me last time, but not today.');
    prewriteTaunt(s, fast);
    prewriteTaunt(s, fast);
    expect(fast).toHaveBeenCalledTimes(1);
    expect(await tauntLine(s, 50, fast)).toEqual({ text: 'You got me last time, but not today.', fromModel: true });
    resetRivalTalk();
    const slow = vi.fn(() => new Promise<string | null>((r) => setTimeout(() => r('Too late.'), 200)));
    expect(await tauntLine(s, 10, slow)).toEqual({ text: templateTaunt(s), fromModel: false });
    // the model switched off (Trainer banter): templates only, no call
    resetRivalTalk();
    useSettingsStore.setState({ accessibility: { ...DEFAULT_SETTINGS.accessibility, trainerBanter: false } });
    const none = vi.fn(async () => 'x');
    expect((await tauntLine(s, 10, none)).fromModel).toBe(false);
    expect(none).not.toHaveBeenCalled();
    expect(writeParting(s, 'won', none)).toBeNull();
  });

  it('the parting line: the model when back in time, else the template', async () => {
    const s = scene({}, won());
    expect(await partingLine(s, 'won', Promise.resolve('You win again. I will be back.'), 50)).toEqual({ text: 'You win again. I will be back.', fromModel: true });
    expect(await partingLine(s, 'won', Promise.resolve(null), 50)).toEqual({ text: templateParting(s, 'won'), fromModel: false });
    expect(await partingLine(s, 'won', null, 50)).toEqual({ text: templateParting(s, 'won'), fromModel: false });
  });
});

describe('the rival in battle', () => {
  it('is a foe with its own look (a stand-in look before the view is in hand) and a persona for the trainer bank', () => {
    expect(foeIdentity('rival:Corin')).toMatchObject({ name: 'Corin', title: 'Rival', look: RIVAL_FALLBACK_LOOK });
    useRivalStore.getState().setView(view(won()));
    expect(rivalViewFor('rival:Corin')?.name).toBe('Corin');
    expect(rivalViewFor('rival:Vesna')).toBeNull();
    const foe = foeIdentity('rival:Corin');
    expect(foe).toMatchObject({ name: 'Corin', title: 'Rival', look: 'cowboy_male' });
    const p = personaOf(foe, null);
    expect(p.who).toBe("Corin, the traveller's rival, loud and brash");
    expect(p.memory).toContain('The traveller has beaten you 2 times, you have beaten them 1 time.');
    expect(rivalPersona(view(), 1).memory).toContain('never battled');
  });

  it("the trainer bank drops a win line that names the traveller's victory (the live check's rival)", () => {
    expect(parseTrainerBank(JSON.stringify({ win: ['Your victory is temporary, traveler.', 'See how a true show is won.'] }))).toEqual({ win: ['See how a true show is won.'] });
  });
});

describe('the actor (scene/rivalExit.ts)', () => {
  it('stands before the player facing them, walks off and is gone', () => {
    const calls: string[] = [];
    const actors = {
      spawn: (id: string) => void calls.push(`spawn ${id}`),
      despawn: (id: string) => void calls.push(`despawn ${id}`),
      setTransform: (id: string, _x: number, _z: number, _a: number, moving: boolean) => void calls.push(`move ${id} ${moving}`),
      setEmote: () => undefined,
    };
    const at = partingStand(0, 0, 0);
    expect(at.z).toBeGreaterThan(2);
    expect(Math.abs(at.angle - Math.PI)).toBeLessThan(1e-9);
    const e = new RivalExit(actors);
    e.stand('cowboy_male', 'Corin', at.x, at.z, at.angle);
    expect(e.active).toBe(true);
    e.leave(0, 0);
    e.update(500);
    expect(calls).toContain(`move ${RIVAL_ACTOR_ID} true`);
    e.update(2000);
    expect(e.active).toBe(false);
    expect(calls.at(-1)).toBe(`despawn ${RIVAL_ACTOR_ID}`);
  });
});
