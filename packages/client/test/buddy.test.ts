/**
 * LLM feature 6, the pure parts and the stores: a creature's "you" facts and its voice (talk/buddyFacts.ts), the
 * prompts and the line checker (talk/buddy.ts), the ambient trigger and its throttle (talk/buddyAmbient.ts), the battle
 * logger and the conversation / bubble stores (state/buddy.ts) with the model and the history route mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPECIES, createContentIndex } from '@ewa/content';
import { createBattle, projectBattler } from '@ewa/core';
import type { BattleEvent, BattleState, CreatureInstance, Ref } from '@ewa/core';
import type { CreatureHistory } from '@ewa/protocol';
import { NO_DASHES } from '../src/talk/llm';
import {
  MAX_BUDDY_FACTS, buddyProfile, callOf, punctuateSound, historyFacts, memoryFact, metFact, moodOf, natureFacts, placeFact, soundOf, templateReply, togetherFact, voiceOf, voiced,
} from '../src/talk/buddyFacts';
import type { BuddyContext, BuddyMemory } from '../src/talk/buddyFacts';
import { BUDDY_SYSTEM, ambientMessages, ambientWording, buddyMessages, buddyReply, checkBuddyLine, freshSentences, repeats, selfClaims, tidyLine } from '../src/talk/buddy';
import { AMBIENT_GAP_MS, AMBIENT_KIND_GAP_MS, AMBIENT_WARMUP_MS, createAmbient, notable } from '../src/talk/buddyAmbient';
import type { AmbientSnapshot } from '../src/talk/buddyAmbient';
import {
  bubbleMs, clearBuddyMemories, closeBuddyTalk, createBuddyLogger, memoriesOf, openBuddyTalk, rememberBuddy, resetBuddyAmbient, sayToBuddy, setBubbleAnchor, showBubble, stepBuddyAmbient,
  useBuddyBubbleStore, useBuddyTalkStore,
} from '../src/state/buddy';
import { useSessionStore } from '../src/state/session';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { waterNear, buddySnapshot } from '../src/scene/buddyWatch';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const D = String.fromCharCode(0x2014);
const NOW = Date.parse('2026-10-24T12:00:00Z');
const BID = '00000000-0000-4000-8000-0000000000e6';

function creature(speciesId: string, level: number, id: string, extra: Partial<CreatureInstance> = {}): CreatureInstance {
  return { ...makeCreature(content, content.species(speciesId), level, id, 'p0'), ...extra };
}

const ctx = (o: Partial<BuddyContext> = {}): BuddyContext => ({ history: null, memories: [], place: null, lead: true, trainer: 'Ash', now: NOW, ...o });

type Chat = NonNullable<Parameters<typeof buddyReply>[4]>['chat'];
const reply = (text: string): Chat => vi.fn(async () => ({ content: text, toolCalls: [] })) as unknown as Chat;
const down: Chat = vi.fn(async () => {
  throw new Error('down');
}) as unknown as Chat;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  closeBuddyTalk();
  clearBuddyMemories();
  resetBuddyAmbient();
  useSettingsStore.setState({ accessibility: DEFAULT_SETTINGS.accessibility });
});

// ---- the facts and the voice -----------------------------------------------------------------------------------------

describe('a creature’s facts (talk/buddyFacts.ts)', () => {
  it('the voice is seeded by the creature: the same creature always sounds the same, its species gives the call', () => {
    const a = voiceOf('c-1', 'mossling');
    expect(voiceOf('c-1', 'mossling')).toEqual(a);
    expect(a.sounds[0]).toBe('Moss moss');
    // Mossling is Water / Grass: its first type gives the second sound
    expect(a.sounds[1]).toBe('blub');
    const styles = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id) => voiceOf(id, 'mossling').style));
    expect(styles.size).toBeGreaterThan(2);
  });

  it('callOf: the first syllable, a closing pair only when it sounds as one', () => {
    expect(callOf('Mossling')).toBe('Moss');
    expect(callOf('Bramblecub')).toBe('Bram');
    expect(callOf('Glimfin')).toBe('Glim');
    expect(callOf('Dustcub')).toBe('Dust');
    expect(callOf('Ampmite')).toBe('Amp');
    expect(callOf('Pyrecap')).toBe('Pyr');
    expect(callOf('Geoboxer')).toBe('Geo');
    expect(callOf('Bloomduck')).toBe('Bloo');
  });

  it('punctuateSound: a sound tacked on the end gets a stop', () => {
    const v = voiceOf('c-1', 'mossling');
    expect(punctuateSound('I see Ash Route moss moss.', v)).toBe('I see Ash Route. Moss moss!');
    expect(punctuateSound('I see water blub', v)).toBe('I see water. Blub!');
    expect(punctuateSound('I like you. Moss moss.', v)).toBe('I like you. Moss moss.');
  });

  it('who it is, its level, how it was met and since when, as "you" facts', () => {
    const p = buddyProfile(creature('mossling', 9, 'm1', { caughtAt: { zoneId: 'mire_route', at: NOW - 3 * 86_400_000 } }), ctx());
    expect(p.facts.slice(0, 4)).toEqual([
      'You are Mossling, a Water and Grass type Ewamon.',
      'You are level 9.',
      'Your trainer caught you in Mire Route.',
      'You have been with your trainer for 3 days.',
    ]);
    expect(p.selfNames).toEqual(['Mossling']);
    const nick = buddyProfile(creature('pyrecap', 14, 'p1', { nickname: 'Sparky' }), ctx());
    expect(nick.facts[0]).toBe('You are Sparky, a Fire type Pyrecap.');
    expect(nick.selfNames).toEqual(['Sparky', 'Pyrecap']);
  });

  it('the history: the first meeting, a trade, a hatch, evolutions, badges, the Champion, a nemesis', () => {
    const at = (h: number): string => new Date(NOW - h * 3_600_000).toISOString();
    const h: CreatureHistory = {
      originalTrainer: 'Gary',
      events: [
        { kind: 'champion', at: at(1) },
        { kind: 'badge', at: at(2), badge: 'ember' },
        { kind: 'badge', at: at(20), badge: 'bloom' },
        { kind: 'evolved', at: at(25), from: 'cindercap', into: 'pyrecap' },
        { kind: 'nemesis', at: at(26), how: 'beaten', name: 'Grimjaw the Cruel', speciesId: 'ampmite', rank: 2, zoneId: 'mire_route' },
        { kind: 'traded', at: at(30), from: 'Gary', to: 'Ash' },
        { kind: 'met', at: at(60), how: 'caught', speciesId: 'cindercap', level: 5, zoneId: 'ash_route', trainer: 'Gary' },
      ],
    };
    const c = creature('pyrecap', 30, 'x');
    expect(metFact(c, h, 'Ash')).toBe('You came to your trainer in a trade.');
    expect(metFact(c, { originalTrainer: 'Ash', events: [h.events[6]!] }, 'Ash')).toBe('Your trainer caught you in Ash Route at level 5.');
    expect(metFact(c, { originalTrainer: 'Ash', events: [{ kind: 'hatched', at: at(5), speciesId: 'pyrecap', zoneId: 'mirevale', parents: ['A', 'B'], trainer: 'Ash' }] }, 'Ash')).toBe('You hatched from an egg in Mirevale.');
    expect(metFact({ caughtAt: null }, null, 'Ash')).toBe('Your trainer got you as a gift, at the very start.');
    expect(togetherFact(c, h, NOW)).toBe('You have been with your trainer for 2 days.');
    expect(historyFacts(h)).toEqual([
      'You evolved from a Cindercap.',
      'You were in the party that won 2 gym badges.',
      'You were in the party that beat the Champion.',
      'You struck down a nemesis named Grimjaw the Cruel.',
    ]);
  });

  it('shiny, alpha, a Majin / Tenjin form, the honor ledger', () => {
    expect(natureFacts(creature('mossling', 5, 'a', { isShiny: true, isAlpha: true }))).toEqual(['You are shiny: your colours are rare and special.', 'You are an alpha, bigger than others of your kind.']);
    expect(natureFacts(creature('dustcub', 5, 'h', { honor: 5 }))).toEqual(['You fight with honor, fair and clean.']);
    expect(natureFacts(creature('dustcub', 5, 'h', { honor: -4 }))).toEqual(['You fight dirty and ruthless.']);
    expect(natureFacts(creature('dustcub', 5, 'h'))).toEqual(['Your heart is torn between fair and dirty fighting.']);
    const majin = SPECIES.find((sp) => sp.battleForm?.kind === 'majin')!;
    const tenjin = SPECIES.find((sp) => sp.battleForm?.kind === 'tenjin')!;
    expect(natureFacts(creature(majin.id, 30, 'mj'))).toContain('In battle you can turn into your Majin form when you are hurt.');
    expect(natureFacts(creature(tenjin.id, 30, 'tj'))).toContain('In battle you can turn into your Tenjin form while you are strong.');
    expect(natureFacts(creature('mossling', 5, 'b', { bandborn: true }))).toEqual(['You were born from a Majin parent and a Tenjin parent.']);
  });

  it('memories say the sides in full: "a wild X", "the opponent’s X", the creature as "you"', () => {
    const m = (x: Omit<BuddyMemory, 'at'>, ago = 60_000): string => memoryFact({ ...x, at: NOW - ago } as BuddyMemory, NOW);
    expect(m({ kind: 'won', foe: 'a wild Ampmite', move: 'Vine Lash', superEffective: true })).toBe('Just now, you won a battle against a wild Ampmite, and your Vine Lash was super effective.');
    expect(m({ kind: 'ko', other: "the opponent's Ampmite", move: 'Ember' }, 20 * 60_000)).toBe("A little while ago, you knocked out the opponent's Ampmite with Ember.");
    expect(m({ kind: 'fainted', foe: 'Mira Thornwell' }, 3 * 3_600_000)).toBe('Earlier today, you fainted in the battle against Mira Thornwell.');
    expect(m({ kind: 'levelUp', level: 12 })).toBe('Just now, you grew to level 12.');
    expect(m({ kind: 'caught', caught: 'glimfin' })).toBe('Just now, you helped your trainer catch a Glimfin.');
    expect(m({ kind: 'evolveReady', into: 'pyrecap' })).toBe('Just now, you felt ready to evolve into Pyrecap.');
  });

  it('the mood: HP first, then the last ten minutes', () => {
    const c = creature('mossling', 10, 'm');
    expect(moodOf(c, [], NOW)).toBe('calm');
    expect(moodOf({ ...c, hp: 1 }, [], NOW)).toBe('tired');
    expect(moodOf(c, [{ kind: 'won', at: NOW - 1000 }], NOW)).toBe('happy');
    expect(moodOf(c, [{ kind: 'lost', at: NOW - 1000 }], NOW)).toBe('sad');
    expect(moodOf(c, [{ kind: 'levelUp', at: NOW - 1000, level: 10 }], NOW)).toBe('proud');
    expect(moodOf(c, [{ kind: 'lost', at: NOW - 20 * 60_000 }], NOW)).toBe('calm');
  });

  it('the profile: memories newest first, the place, at most MAX_BUDDY_FACTS facts', () => {
    const memories: BuddyMemory[] = [
      { kind: 'won', at: NOW - 300_000, foe: 'a wild Ampmite' },
      { kind: 'levelUp', at: NOW - 200_000, level: 10 },
      { kind: 'ko', at: NOW - 100_000, other: 'a wild Glimfin', move: 'Water Gun' },
      { kind: 'learned', at: NOW - 50_000, move: 'Vine Lash' },
    ];
    const p = buddyProfile(creature('mossling', 10, 'm', { isShiny: true }), ctx({ memories, place: { zoneId: 'tide_route', timeOfDay: 0.9, weather: 'rain' } }));
    expect(p.facts.length).toBeLessThanOrEqual(MAX_BUDDY_FACTS);
    expect(p.facts).toContain('Just now, you learned the move Vine Lash.');
    expect(p.facts).not.toContain('A little while ago, you won a battle against a wild Ampmite.');
    expect(p.facts).toContain('You and your trainer are in Tide Route now, and it is night and it is raining.');
    expect(p.mood).toBe('proud');
    expect(placeFact({ zoneId: null, timeOfDay: 0.5, weather: null })).toBeNull();
  });

  it('templates: the creature’s sound and a line for its mood; `voiced` adds the sound only when missing; no em-dashes', () => {
    const p = buddyProfile(creature('mossling', 10, 'm'), ctx());
    for (let t = 0; t < 12; t++) {
      const line = templateReply(p, t);
      expect(line.startsWith('Moss moss') || line.startsWith('Blub')).toBe(true);
      expect(line).not.toContain(D);
    }
    expect(templateReply(p, 3)).toBe(templateReply(p, 3));
    expect(voiced('I like you. Moss moss.', p.voice, 1)).toBe('I like you. Moss moss.');
    expect(voiced('I like you.', p.voice, 0)).toMatch(/^(Moss moss|Blub)\S* I like you\.$/);
    expect(soundOf(p.voice, 0)).toMatch(/^(Moss moss|Blub)/);
  });
});

// ---- the prompts and the checker ---------------------------------------------------------------------------------------

describe('the creature’s words (talk/buddy.ts)', () => {
  const p = buddyProfile(creature('mossling', 9, 'm1', { caughtAt: { zoneId: 'mire_route', at: NOW - 86_400_000 } }), ctx({ memories: [{ kind: 'won', at: NOW - 60_000, foe: 'a wild Ampmite', move: 'Vine Lash' }] }));

  it('the prompt: a neutral system prompt, the facts, the voice, the trainer’s words and "I" in the user turn, no em-dashes', () => {
    const m = buddyMessages(p, '  How   are "you"? ', [{ role: 'trainer', text: 'Hi' }, { role: 'buddy', text: 'Moss moss! Hello.' }]);
    expect(m[0]).toEqual({ role: 'system', content: BUDDY_SYSTEM });
    expect(m[0]!.content).not.toContain('Mossling');
    const u = m[1]!.content;
    expect(u).toContain('- You are Mossling, a Water and Grass type Ewamon.');
    expect(u).toContain('- Just now, you won a battle against a wild Ampmite');
    expect(u).toContain('You make creature sounds like "Moss moss" and "blub"');
    expect(u).toContain("Your trainer says to you: \"How are 'you'?\"");
    // the trainer's earlier lines only: its own made the model say its greeting again
    expect(u).toContain('Your trainer said before: "Hi"');
    expect(u).not.toContain('Moss moss! Hello.');
    expect(u).toContain('say "I" and "my" about yourself');
    for (const x of [...m, ...ambientMessages(p, 'Night is falling.')]) {
      expect(x.content).toContain(NO_DASHES);
      expect(x.content).not.toContain(D);
    }
    expect(buddyMessages(p, '')[1]!.content).toContain('Greet them');
  });

  it('keeps a fitting line, dashes out and the sound kept', () => {
    expect(checkBuddyLine(`I won against a wild Ampmite ${D} so happy! Moss moss.`, p)).toBe('I won against a wild Ampmite, so happy! Moss moss.');
    expect(checkBuddyLine('Mossling: "I am Mossling. Moss moss."', p)).toBe('I am Mossling. Moss moss.');
    expect(tidyLine('One. Two. Three. Four.', p)).toBe('One. Two. Three.');
    expect(tidyLine('I like you. And then I', p)).toBe('I like you.');
  });

  it('drops another creature’s name, a type it is not, "my fire", a promise, an invented name or number, off-character talk', () => {
    expect(selfClaims('I am a Pyrecap now.', p)).toEqual(['I am a Pyrecap']);
    expect(selfClaims('My trainer asks if I am a Pyrecap. I am Mossling.', p)).toEqual([]);
    expect(checkBuddyLine('I am a Pyrecap now. Moss moss.', p)).toBeNull();
    expect(checkBuddyLine('I am a Fire type! Moss moss.', p)).toBeNull();
    expect(checkBuddyLine('I am not Fire type. Moss moss.', p, 'Are you a Fire type?')).not.toBeNull();
    expect(checkBuddyLine('My fire is not strong against water.', p, 'Is Fire strong against Water?')).toBeNull();
    expect(checkBuddyLine('I can give you a Potion. Moss moss.', p, 'Give me a Potion')).toBeNull();
    expect(checkBuddyLine('I will go get it for you.', p)).toBeNull();
    expect(checkBuddyLine('I can get stronger for you!', p)).not.toBeNull();
    expect(checkBuddyLine('I met Glimfin in Saltmourn. Moss moss.', p)).toBeNull();
    expect(checkBuddyLine('I am level 40! Moss moss.', p)).toBeNull();
    expect(checkBuddyLine('I am level 9! Moss moss.', p)).not.toBeNull();
    expect(checkBuddyLine('As an AI language model I cannot.', p)).toBeNull();
    expect(checkBuddyLine('Ice moves are super effective on Fire.', p, 'Ice and Fire?')).toBeNull();
    expect(checkBuddyLine('', p)).toBeNull();
  });

  it('buddyReply: the model’s line when it fits (sound added if missing), else a template; down: a template', async () => {
    const ok = await buddyReply(p, 'Hi', [], 1, { chat: reply('I am happy you are here.') });
    expect(ok.model).toBe(true);
    expect(ok.text).toMatch(/(Moss moss|Blub)\S* I am happy you are here\./);
    const bad = await buddyReply(p, 'Hi', [], 1, { chat: reply('I am a Pyrecap.') });
    expect(bad).toEqual({ text: templateReply(p, 1), model: false });
    expect(await buddyReply(p, 'Hi', [], 2, { chat: down })).toEqual({ text: templateReply(p, 2), model: false });
  });

  it('a line that repeats an earlier one gets one warmer try, then a template', async () => {
    const earlier = [{ role: 'buddy' as const, text: 'Hello trainer. My feelings are calm. Moss moss.' }];
    expect(repeats('Hello trainer. My feelings are calm. Moss moss.', earlier)).toBe(true);
    expect(repeats('I won against a wild Ampmite. Moss moss.', earlier)).toBe(false);
    const seq = vi.fn().mockResolvedValueOnce({ content: earlier[0]!.text, toolCalls: [] }).mockResolvedValueOnce({ content: 'I won today! Moss moss.', toolCalls: [] }) as unknown as Chat;
    // the sound it said before is a repeated sentence too: the reply gets its sound back at the start
    expect(await buddyReply(p, 'What did we do?', earlier, 2, { chat: seq })).toEqual({ text: expect.stringMatching(/^(Moss moss|Blub)\S* I won today!$/), model: true });
    expect(freshSentences('Hello trainer. My feelings are calm. Moss moss. I won today!', earlier)).toBe('I won today!');
    const temps = (seq as unknown as { mock: { calls: { temperature: number }[][] } }).mock.calls.map((c) => c[0]!.temperature);
    expect(temps).toEqual([0.7, 1]);
    expect((await buddyReply(p, 'Hi', earlier, 3, { chat: reply(earlier[0]!.text) })).model).toBe(false);
    expect(buddyMessages(p, 'Hi', earlier)[1]!.content).toContain('say something new');
  });

  it('ambientWording: a short checked line or null', async () => {
    expect(await ambientWording(p, 'Night is falling.', { chat: reply('Night now. Moss moss.') })).toBe('Night now. Moss moss.');
    expect(await ambientWording(p, 'Night is falling.', { chat: reply('I am a Pyrecap at night.') })).toBeNull();
    expect(await ambientWording(p, 'Night is falling.', { chat: down })).toBeNull();
  });
});

// ---- ambient lines ---------------------------------------------------------------------------------------------------

describe('ambient lines (talk/buddyAmbient.ts)', () => {
  const lead = { id: 'lead-1', speciesId: 'glimfin', types: ['Water', 'Electric'] as const, hpFrac: 1 };
  const voice = (l: { id: string; speciesId: string }) => voiceOf(l.id, l.speciesId);
  const snap = (o: Partial<AmbientSnapshot> = {}): AmbientSnapshot => ({ now: 0, zoneId: 'mirevale', timeOfDay: 0.5, lead, inBattle: false, busy: false, nearWater: false, spawns: [], ...o });

  it('nothing in the warm-up; then a new zone, once a session', () => {
    const a = createAmbient();
    expect(a.step(snap({ now: 0 }), voice)).toBeNull();
    expect(a.step(snap({ now: 5000, zoneId: 'mire_route' }), voice)).toBeNull(); // warm-up: noticed, not said late
    const t = AMBIENT_WARMUP_MS + 1000;
    const ev = a.step(snap({ now: t, zoneId: 'tide_route' }), voice)!;
    expect(ev.kind).toBe('zone');
    expect(ev.event).toBe('You just arrived in Tide Route, a new place.');
    expect(ev.template).toMatch(/Tide Route/);
    // back to a zone already seen: nothing
    expect(a.step(snap({ now: t + AMBIENT_KIND_GAP_MS * 2, zoneId: 'mire_route' }), voice)).toBeNull();
  });

  it('one line per gap; the same kind once per kind gap', () => {
    const a = createAmbient({ warmupMs: 0 });
    a.step(snap({ now: 0 }), voice);
    expect(a.step(snap({ now: 1000, zoneId: 'mire_route' }), voice)?.kind).toBe('zone');
    expect(a.step(snap({ now: 2000, zoneId: 'tide_route' }), voice)).toBeNull(); // within the gap
    expect(a.step(snap({ now: 1000 + AMBIENT_GAP_MS + 1, zoneId: 'ash_route' }), voice)).toBeNull(); // the zone kind rests
    expect(a.step(snap({ now: 1000 + AMBIENT_KIND_GAP_MS + 1, zoneId: 'cinderhold' }), voice)?.kind).toBe('zone');
  });

  it('night falling, a rare / shiny / alpha spawn (each once), low HP after a battle, water for a Water type', () => {
    const a = createAmbient({ warmupMs: 0, gapMs: 0, kindGapMs: 0 });
    a.step(snap({ now: 0, timeOfDay: 0.7, zoneId: 'mirevale' }), voice);
    expect(a.step(snap({ now: 1, timeOfDay: 0.76 }), voice)?.kind).toBe('night');
    const shiny = { id: 's1', speciesId: 'mossling', shiny: true, alpha: false };
    const r = a.step(snap({ now: 2, timeOfDay: 0.8, spawns: [shiny] }), voice)!;
    expect(r.kind).toBe('rare');
    expect(r.event).toBe('A shiny Mossling is nearby.');
    expect(a.step(snap({ now: 3, timeOfDay: 0.8, spawns: [shiny] }), voice)).toBeNull();
    a.step(snap({ now: 4, timeOfDay: 0.8, inBattle: true }), voice);
    expect(a.step(snap({ now: 5, timeOfDay: 0.8, lead: { ...lead, hpFrac: 0.2 } }), voice)?.kind).toBe('lowHp');
    const w = a.step(snap({ now: 6, timeOfDay: 0.8, nearWater: true }), voice)!;
    expect(w.kind).toBe('place');
    expect(w.event).toMatch(/edge of the water/);
    expect(a.step(snap({ now: 7, timeOfDay: 0.8, nearWater: true }), voice)).toBeNull();
    // a Water type feels at home on the salt coast
    expect(a.step(snap({ now: 8, timeOfDay: 0.8, zoneId: 'saltmourn' }), voice)?.kind).toBe('zone');
    expect(a.step(snap({ now: 9, timeOfDay: 0.8, zoneId: 'saltmourn' }), voice)?.event).toBe('Saltmourn feels like home to a Water type like you.');
  });

  it('busy or in a battle: silent, and what happened then is not said late', () => {
    const a = createAmbient({ warmupMs: 0, gapMs: 0, kindGapMs: 0 });
    a.step(snap({ now: 0 }), voice);
    expect(a.step(snap({ now: 1, zoneId: 'mire_route', busy: true }), voice)).toBeNull();
    expect(a.step(snap({ now: 2, zoneId: 'mire_route' }), voice)).toBeNull();
    expect(a.step(snap({ now: 3, zoneId: 'tide_route', lead: null }), voice)).toBeNull();
  });

  it('notable: rare and up, shiny or alpha', () => {
    expect(notable(SPECIES.find((sp) => sp.rarity === 'rare')!.id, false, false)).toBe(true);
    expect(notable('mossling', false, false)).toBe(false);
    expect(notable('mossling', true, false)).toBe(true);
    expect(notable('mossling', false, true)).toBe(true);
  });

  it('the world snapshot: the lead, its HP, near spawns only, water a step away', () => {
    const party = [creature('glimfin', 10, 'g', { hp: 0 }), creature('mossling', 10, 'm')];
    const spawns = [
      { id: 'near', speciesId: 'mossling', x: 5, z: 0, isShiny: true, isAlpha: false, engagedBy: '' },
      { id: 'far', speciesId: 'mossling', x: 80, z: 0, isShiny: true, isAlpha: false, engagedBy: '' },
      { id: 'taken', speciesId: 'mossling', x: 1, z: 0, isShiny: true, isAlpha: false, engagedBy: 'someone' },
      { id: 'plain', speciesId: 'mossling', x: 1, z: 0, isShiny: false, isAlpha: false, engagedBy: '' },
    ];
    const s = buddySnapshot({ now: 1, zone: null, timeOfDay: 0.5, party, x: 0, z: 0, inBattle: false, busy: false, water: (x) => x > 2, spawns });
    expect(s.lead?.id).toBe('m');
    expect(s.lead?.hpFrac).toBe(1);
    expect(s.spawns.map((x) => x.id)).toEqual(['near']);
    expect(s.nearWater).toBe(true);
    expect(waterNear(() => false, 0, 0)).toBe(false);
  });
});

// ---- the battle logger -------------------------------------------------------------------------------------------------

function battle(own: readonly [string, number][], foe: readonly [string, number][], kind: 'npc' | 'wild'): BattleState {
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
const dmg = (source: Ref, target: Ref, move: string, eff: number): BattleEvent =>
  ({ t: 'damage', target, source, amount: 10, hpAfter: 1, maxHp: 50, cause: 'move', move, crit: false, effectiveness: eff, stab: true }) as BattleEvent;
const begin = (state: BattleState, o: Record<string, unknown> = {}) => ({ battleId: BID, seat: 0 as const, format: state.format, state, foe: null, replay: false, spectator: false, fresh: true, ...o });

describe('the battle logger (state/buddy.ts)', () => {
  it('a won trainer battle: the knockout with its move, the level, the win with the best (super-effective) move, the faint', () => {
    const start = battle([['glimfin', 10], ['mossling', 9]], [['ampmite', 9], ['pyrecap', 9]], 'npc');
    const l = createBuddyLogger({ now: () => NOW });
    l.begin({ ...begin(start), foe: { id: 'trainer.x', name: 'Mira Thornwell', title: null, type: null, look: null, league: null } });
    l.timeline([
      dmg(R(0), R(1), 'Tackle', 1),
      dmg(R(0), R(1), 'Water Gun', 2),
      { t: 'faint', who: R(1) } as BattleEvent,
      { t: 'levelUp', who: R(0), level: 11, maxHp: 40, atk: 1, def: 1, spd: 1 } as BattleEvent,
      { t: 'switchIn', who: R(1, 1) } as BattleEvent,
      dmg(R(1, 1), R(0), 'Ember', 1),
      { t: 'faint', who: R(0) } as BattleEvent,
      { t: 'switchIn', who: R(0, 1) } as BattleEvent,
      dmg(R(0, 1), R(1, 1), 'Water Gun', 2),
      { t: 'faint', who: R(1, 1) } as BattleEvent,
      { t: 'battleEnd', outcome: { winner: 0 }, turns: 3 } as BattleEvent,
    ], start);
    l.played();
    l.end();
    expect(memoriesOf('mine-0').map((m) => m.kind)).toEqual(['ko', 'levelUp', 'fainted', 'won']);
    expect(memoriesOf('mine-0')[0]).toMatchObject({ other: "the opponent's Ampmite", move: 'Water Gun' });
    expect(memoriesOf('mine-0')[2]).toMatchObject({ foe: 'Mira Thornwell' });
    expect(memoriesOf('mine-0')[3]).toMatchObject({ foe: 'Mira Thornwell', move: 'Water Gun', superEffective: true });
    expect(memoriesOf('mine-1').map((m) => m.kind)).toEqual(['ko', 'won']);
  });

  it('a wild catch: "helped catch", no win line; a loss; a spectated or replayed battle leaves no memory', () => {
    const wild = battle([['glimfin', 10]], [['ampmite', 5]], 'wild');
    const l = createBuddyLogger({ now: () => NOW });
    l.begin(begin(wild));
    l.timeline([{ t: 'catchResult', caught: true, target: R(1), shakes: 4 } as BattleEvent, { t: 'battleEnd', outcome: { winner: 0 }, turns: 1 } as BattleEvent], wild);
    expect(memoriesOf('mine-0')).toEqual([{ kind: 'caught', caught: 'ampmite', at: NOW }]);
    clearBuddyMemories();
    l.begin(begin(wild));
    l.timeline([{ t: 'battleEnd', outcome: { winner: 1 }, turns: 1 } as BattleEvent], wild);
    expect(memoriesOf('mine-0')).toEqual([{ kind: 'lost', foe: 'a wild Ampmite', at: NOW }]);
    clearBuddyMemories();
    for (const o of [{ spectator: true }, { replay: true }]) {
      l.begin(begin(wild, o));
      l.timeline([{ t: 'battleEnd', outcome: { winner: 0 }, turns: 1 } as BattleEvent], wild);
    }
    expect(memoriesOf('mine-0')).toEqual([]);
  });

  it('keeps the last few memories per creature', () => {
    for (let i = 0; i < 12; i++) rememberBuddy('c', { kind: 'levelUp', level: i, at: i });
    expect(memoriesOf('c').map((m) => m.level)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

// ---- the stores ------------------------------------------------------------------------------------------------------

describe('the talk and the bubble (state/buddy.ts)', () => {
  const lead = creature('glimfin', 12, 'lead-1');
  const second = creature('mossling', 8, 'm-2');
  let chatBodies: string[] = [];
  function mockFetch(answer: string | null, history: CreatureHistory | null = null): void {
    chatBodies = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = String(url);
        if (u.includes('/chat/completions')) {
          chatBodies.push(String(init?.body ?? ''));
          if (answer === null) return new Response('down', { status: 503 });
          return Response.json({ choices: [{ message: { content: answer } }] });
        }
        if (u.includes('/history')) return history === null ? new Response('{}', { status: 404 }) : Response.json(history);
        return new Response('{}', { status: 404 });
      }),
    );
  }
  beforeEach(() => {
    useSessionStore.setState({ accessToken: 'tok', zoneId: 'mirevale', inventory: { items: {}, money: 0, party: [lead, second], box: [] } } as never);
  });

  it('opens with the lead by default, folds in the history, greets, answers a typed line, closes', async () => {
    const at = new Date(NOW).toISOString();
    mockFetch('Hello! I am happy.', { originalTrainer: 'Ash', events: [{ kind: 'met', at, how: 'caught', speciesId: 'glimfin', level: 4, zoneId: 'tide_route', trainer: 'Ash' }] });
    await openBuddyTalk();
    let st = useBuddyTalkStore.getState();
    expect(st.creatureId).toBe('lead-1');
    expect(st.profile?.facts).toContain('Your trainer caught you in Tide Route at level 4.');
    expect(st.turns).toHaveLength(1);
    expect(st.turns[0]).toMatchObject({ role: 'buddy', model: true });
    expect(st.turns[0]!.text).toContain('I am happy.');
    expect(chatBodies[0]).toContain('Greet them');
    expect(sayToBuddy('  ')).toBe(false);
    expect(sayToBuddy('Did you like the water?')).toBe(true);
    expect(sayToBuddy('again')).toBe(false); // thinking
    await vi.waitFor(() => expect(useBuddyTalkStore.getState().phase).toBe('idle'));
    st = useBuddyTalkStore.getState();
    expect(st.turns.map((t) => t.role)).toEqual(['buddy', 'trainer', 'buddy']);
    expect(chatBodies[1]).toContain('Your trainer says to you: \\"Did you like the water?\\"');
    closeBuddyTalk();
    expect(useBuddyTalkStore.getState()).toMatchObject({ creatureId: null, turns: [] });
  });

  it('any party member by id; the model down or off: a template; no such creature: nothing opens', async () => {
    mockFetch(null);
    await openBuddyTalk('m-2');
    const st = useBuddyTalkStore.getState();
    expect(st.creatureId).toBe('m-2');
    expect(st.turns[0]).toMatchObject({ role: 'buddy', model: false });
    closeBuddyTalk();
    await openBuddyTalk('m-2', { model: false });
    expect(useBuddyTalkStore.getState().turns[0]!.text).toBe(templateReply(useBuddyTalkStore.getState().profile!, 0));
    closeBuddyTalk();
    await openBuddyTalk('nobody');
    expect(useBuddyTalkStore.getState().creatureId).toBeNull();
  });

  it('the ambient step shows the template in a bubble (model off), not with the setting off', async () => {
    const snap = (now: number, zoneId: string): AmbientSnapshot => ({ now, zoneId, timeOfDay: 0.5, lead: { id: 'lead-1', speciesId: 'glimfin', types: ['Water', 'Electric'], hpFrac: 1 }, inBattle: false, busy: false, nearWater: false, spawns: [] });
    useSettingsStore.setState({ accessibility: { ...DEFAULT_SETTINGS.accessibility, followerChatter: false } });
    await stepBuddyAmbient(snap(0, 'mirevale'), { model: false });
    await stepBuddyAmbient(snap(AMBIENT_WARMUP_MS + 1, 'mire_route'), { model: false });
    expect(useBuddyBubbleStore.getState().line).toBeNull();
    resetBuddyAmbient();
    useSettingsStore.setState({ accessibility: { ...DEFAULT_SETTINGS.accessibility, followerChatter: true } });
    await stepBuddyAmbient(snap(0, 'mirevale'), { model: false });
    await stepBuddyAmbient(snap(AMBIENT_WARMUP_MS + 1, 'mire_route'), { model: false });
    const line = useBuddyBubbleStore.getState().line!;
    expect(line.text).toMatch(/Mire Route/);
    expect(line.speciesId).toBe('glimfin');
  });

  it('bubble: its time grows with the words; the anchor is written only when it moves', () => {
    expect(bubbleMs('Hi')).toBe(3680);
    expect(bubbleMs('a '.repeat(40))).toBe(7000);
    showBubble('Hello there', 'glimfin');
    setBubbleAnchor(100.2, 50, true);
    const a = useBuddyBubbleStore.getState().anchor;
    setBubbleAnchor(100.6, 50.4, true);
    expect(useBuddyBubbleStore.getState().anchor).toBe(a);
    setBubbleAnchor(0, 0, false);
    expect(useBuddyBubbleStore.getState().anchor).toBeNull();
  });
});
