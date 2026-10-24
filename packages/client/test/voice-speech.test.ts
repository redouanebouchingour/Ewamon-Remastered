// @vitest-environment jsdom
/**
 * LLM feature 10, NPC voices: what is said (the tidying, the sentence chunks of a streaming reply), who says it (a
 * stable local voice per speaker, the pitch by size), the speaker's queue and its interruptions, and the binding to
 * the game: nothing is spoken with the settings off, a reply is spoken sentence by sentence while it streams, a closed
 * dialogue, a battle or a hidden tab stops it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { cleanStream, nextSentences, sentencesOf, speakable, LONG_RUN } from '../src/voice/speakable';
import { hashKey, pickVoice, usableVoices } from '../src/voice/voices';
import { createSpeaker } from '../src/voice/speaker';
import { creaturePersona, hushVoices, npcPersona, startVoices } from '../src/voice/bindVoices';
import { useNpcTalkStore } from '../src/state/npcTalk';
import { useBuddyTalkStore, useBuddyBubbleStore } from '../src/state/buddy';
import { useCommentaryStore } from '../src/state/commentary';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { RIVAL_ACTOR_ID } from '../src/scene/rivalExit';
import { VOICES, fakeEngine } from './voiceFakes';
import type { FakeEngine } from './voiceFakes';

const D = String.fromCharCode(0x2014);
const now = (fn: () => void): void => fn();

describe('speakable', () => {
  it('drops bracketed notes, actions, emoji, markdown and links, and the dashes', () => {
    expect(speakable('[smiles] Hello (laughs) there *waves* friend \u{1F600}!')).toBe('Hello there friend!');
    expect(speakable(`Well ${D} I never.`)).not.toContain(D);
    expect(speakable('**Bold** and _soft_ see https://example.com now')).toBe('Bold and soft see now');
    expect(speakable('…')).toBe('');
    expect(speakable('  ')).toBe('');
    expect(speakable('<think>hmm</think>Yes.')).toBe('hmm Yes.');
  });

  it('a streaming reply drops an aside not closed yet, and keeps its spoken start when it closes', () => {
    const a = cleanStream('Hello there. [he smi');
    const b = cleanStream('Hello there. [he smiles] Come in.');
    expect(a.trim()).toBe('Hello there.');
    expect(b.startsWith('Hello there. ')).toBe(true);
    expect(b).toContain('Come in.');
  });
});

describe('sentence chunks', () => {
  it('a sentence is complete once a space follows its end; the rest waits', () => {
    expect(nextSentences('Hello there. How are', 0)).toEqual({ sentences: ['Hello there.'], offset: 12 });
    expect(nextSentences('Hello there.', 0).sentences).toEqual([]);
    expect(nextSentences('Hello there.', 0, true).sentences).toEqual(['Hello there.']);
  });

  it('streams: each call speaks only what completed since the offset', () => {
    let off = 0;
    const said: string[] = [];
    for (const t of ['Wel', 'Welcome! Th', 'Welcome! The shop is open. Bu', 'Welcome! The shop is open. Buy something?']) {
      const n = nextSentences(t, off);
      off = n.offset;
      said.push(...n.sentences);
    }
    said.push(...nextSentences('Welcome! The shop is open. Buy something?', off, true).sentences);
    expect(said).toEqual(['Welcome!', 'The shop is open.', 'Buy something?']);
  });

  it('abbreviations, initials and decimals do not end a sentence; quotes and ellipses do', () => {
    expect(sentencesOf('Ask Prof. Wynn about it. He knows.')).toEqual(['Ask Prof. Wynn about it.', 'He knows.']);
    expect(sentencesOf('It costs 3.5 coins. Cheap!')).toEqual(['It costs 3.5 coins.', 'Cheap!']);
    expect(sentencesOf('J. Smith was here. Gone now.')).toEqual(['J. Smith was here.', 'Gone now.']);
    expect(sentencesOf('"Run!" she said. Well… maybe not.')).toEqual(['"Run!"', 'she said.', 'Well…', 'maybe not.']);
    expect(sentencesOf('Line one\nLine two')).toEqual(['Line one', 'Line two']);
  });

  it('a long run without an end is cut at a comma', () => {
    const run = `${'word '.repeat(30).trim()}, ${'more '.repeat(20).trim()}`;
    expect(run.length).toBeGreaterThan(LONG_RUN);
    const n = nextSentences(run, 0);
    expect(n.sentences).toHaveLength(1);
    expect(n.sentences[0]!.endsWith(',')).toBe(true);
  });

  it('a whole line that is only a note says nothing', () => {
    expect(sentencesOf('[nods]')).toEqual([]);
    expect(sentencesOf('…')).toEqual([]);
  });
});

describe('voice picking', () => {
  it('only local voices, English first; the network voice is never used', () => {
    expect(usableVoices(VOICES).map((v) => v.voiceURI)).toEqual(['Microsoft David', 'Microsoft Hazel', 'Microsoft Zira']);
    for (let i = 0; i < 50; i++) expect(pickVoice({ key: `npc:${i}`, kind: 'npc' }, VOICES).voiceURI).not.toBe('Google US English');
  });

  it('a speaker keeps its voice, whatever order the browser lists them in', () => {
    const p = { key: 'npc:mirevale.bram', kind: 'npc' } as const;
    const a = pickVoice(p, VOICES);
    expect(pickVoice(p, [...VOICES].reverse())).toEqual(a);
    expect(pickVoice(p, VOICES)).toEqual(a);
    expect(hashKey('npc:mirevale.bram')).toBe(hashKey('npc:mirevale.bram'));
    // different speakers spread over the voices
    const used = new Set(Array.from({ length: 30 }, (_, i) => pickVoice({ key: `npc:${i}`, kind: 'npc' }, VOICES).voiceURI));
    expect(used.size).toBe(3);
  });

  it('without an English local voice any local one; without any, none', () => {
    const dutch = VOICES.filter((v) => v.lang === 'nl-NL' || !v.localService);
    expect(pickVoice({ key: 'x', kind: 'npc' }, dutch).voiceURI).toBe('Microsoft Frank');
    expect(pickVoice({ key: 'x', kind: 'npc' }, [])).toMatchObject({ voiceURI: null, lang: 'en-US' });
  });

  it('pitch and rate stay in range; a small creature is higher than a big one', () => {
    for (let i = 0; i < 40; i++) {
      const v = pickVoice({ key: `npc:${i}`, kind: 'npc' }, VOICES);
      expect(v.pitch).toBeGreaterThanOrEqual(0.85);
      expect(v.pitch).toBeLessThanOrEqual(1.2);
      expect(v.rate).toBeGreaterThanOrEqual(0.92);
      expect(v.rate).toBeLessThanOrEqual(1.1);
    }
    const small = pickVoice({ key: 'creature:a', kind: 'creature', size: 0.5 }, VOICES);
    const big = pickVoice({ key: 'creature:a', kind: 'creature', size: 2.2 }, VOICES);
    expect(small.pitch).toBeGreaterThan(big.pitch + 0.6);
    expect(creaturePersona('c1', 'bramblecub').size).toBeGreaterThan(0);
  });
});

describe('the speaker', () => {
  let engine: FakeEngine;
  let allowed: { world: boolean; battle: boolean };
  let volume: number;
  const make = () => createSpeaker({ engine, allowed: (c) => allowed[c], volume: () => volume, schedule: now });
  beforeEach(() => {
    engine = fakeEngine();
    allowed = { world: true, battle: true };
    volume = 0.5;
  });

  it('speaks one sentence at a time, in order, with the speaker voice and the volume', () => {
    const sp = make();
    sp.say('world', npcPersona('a'), 'One. Two! Three?');
    expect(engine.spoken.map((u) => u.text)).toEqual(['One.']);
    engine.finish();
    engine.finish();
    expect(engine.spoken.map((u) => u.text)).toEqual(['One.', 'Two!', 'Three?']);
    expect(new Set(engine.spoken.map((u) => u.voiceURI)).size).toBe(1);
    expect(engine.spoken[0]!.volume).toBe(0.5);
    engine.finish();
    expect(sp.speaking()).toBeNull();
  });

  it('a stream speaks each sentence as soon as it completes, before the reply is in', () => {
    const sp = make();
    const s = sp.stream('world', npcPersona('a'));
    s.update('Hello');
    expect(engine.spoken).toHaveLength(0);
    s.update('Hello traveller. Wel');
    expect(engine.spoken.map((u) => u.text)).toEqual(['Hello traveller.']);
    s.update('Hello traveller. Welcome to town. The');
    engine.finish();
    expect(engine.spoken.map((u) => u.text)).toEqual(['Hello traveller.', 'Welcome to town.']);
    s.end('Hello traveller. Welcome to town. The inn is north');
    engine.finish();
    expect(engine.spoken.map((u) => u.text)).toEqual(['Hello traveller.', 'Welcome to town.', 'The inn is north']);
  });

  it('a new line interrupts: the old stream goes quiet and its later sentences are dropped', () => {
    const sp = make();
    const first = sp.stream('world', npcPersona('a'));
    first.update('First reply here. And more coming. ');
    const second = sp.stream('world', npcPersona('a'));
    expect(engine.cancels).toBe(1);
    first.update('First reply here. And more coming. Still going. ');
    first.end('First reply here. And more coming. Still going. Done.');
    second.end('Second.');
    engine.drain();
    expect(engine.spoken.map((u) => u.text)).toEqual(['First reply here.', 'Second.']);
  });

  it('hush(channel) stops that channel only', () => {
    const sp = make();
    sp.say('battle', npcPersona('t'), 'Battle line.', { queue: true });
    sp.hush('world');
    expect(engine.cancels).toBe(0);
    sp.hush('battle');
    expect(engine.cancels).toBe(1);
    expect(sp.speaking()).toBeNull();
  });

  it('queued battle lines wait for the line speaking; a newer one replaces one still waiting', () => {
    const sp = make();
    sp.say('battle', npcPersona('caster'), 'Critical hit! What a blow.', { queue: true });
    sp.say('battle', npcPersona('t'), 'Older taunt.', { queue: true });
    sp.say('battle', npcPersona('t'), 'Newer taunt.', { queue: true });
    engine.drain();
    expect(engine.spoken.map((u) => u.text)).toEqual(['Critical hit!', 'What a blow.', 'Newer taunt.']);
  });

  it('nothing is spoken while the channel is not allowed or the volume is 0', () => {
    const sp = make();
    allowed.world = false;
    sp.say('world', npcPersona('a'), 'Hello.');
    sp.stream('world', npcPersona('a')).end('Hello there.');
    volume = 0;
    allowed.world = true;
    sp.say('world', npcPersona('a'), 'Hello.');
    expect(engine.spoken).toHaveLength(0);
  });

  it('with only network voices (headless Chrome lists only Google voices) nothing is spoken', () => {
    engine.setVoices(VOICES.filter((v) => !v.localService));
    const sp = make();
    sp.say('world', npcPersona('a'), 'Hello there.');
    sp.stream('world', npcPersona('b')).end('Still nothing.');
    expect(engine.spoken).toHaveLength(0);
  });

  it('a setting turned off mid-line stops at the next sentence', () => {
    const sp = make();
    sp.say('world', npcPersona('a'), 'One. Two. Three.');
    allowed.world = false;
    engine.drain();
    expect(engine.spoken.map((u) => u.text)).toEqual(['One.']);
  });

  it('after a cancel the next line waits for the gap (Chrome drops a speak right after cancel)', () => {
    const later: (() => void)[] = [];
    const sp = createSpeaker({ engine, allowed: () => true, volume: () => 1, schedule: (fn) => later.push(fn) });
    sp.say('world', npcPersona('a'), 'One.');
    sp.say('world', npcPersona('b'), 'Two.');
    expect(engine.spoken.map((u) => u.text)).toEqual(['One.']);
    later.forEach((fn) => fn());
    expect(engine.spoken.map((u) => u.text)).toEqual(['One.', 'Two.']);
  });
});

describe('voices in the game', () => {
  let engine: FakeEngine;
  let stop: () => void;
  const voicesOn = (o: Partial<typeof DEFAULT_SETTINGS.audio> = {}): void =>
    useSettingsStore.getState().set('audio', { npcVoices: true, battleVoices: true, ...o });
  const texts = (): string[] => engine.spoken.map((u) => u.text);
  const reply = (partials: readonly string[], final: string): void => {
    act(() => useNpcTalkStore.setState({ targetId: 'mirevale.bram', phase: 'thinking', turns: [{ role: 'user', content: 'Hi' }], partial: '' }));
    for (const p of partials) act(() => useNpcTalkStore.setState({ phase: 'replying', partial: p }));
    act(() => useNpcTalkStore.setState({ phase: 'idle', partial: '', turns: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: final }] }));
  };

  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
    useUiStore.getState().reset();
    useNpcTalkStore.setState({ targetId: null, phase: 'idle', turns: [], partial: '', error: null, hidden: false, memory: null, quest: null });
    useBuddyTalkStore.setState({ creatureId: null, profile: null, turns: [], phase: 'idle' });
    useCommentaryStore.setState({ caster: null, trainer: null, finalCaster: null, finalTrainer: null });
    engine = fakeEngine();
    stop = startVoices(engine, now);
  });
  afterEach(() => stop());

  it('says nothing at all with the default settings (every voice is opt-in)', () => {
    expect(DEFAULT_SETTINGS.audio).toMatchObject({ npcVoices: false, battleVoices: false, speechInput: false });
    reply(['Hello there. Wel'], 'Hello there. Welcome.');
    act(() => useCommentaryStore.setState({ caster: { id: 1, battleId: 'b', kind: 'crit', side: 'player', head: 'Critical hit!', text: 'Wow.', fromModel: false } }));
    act(() => useUiStore.getState().setDialogue({ speaker: 'Rival Kai', lines: ['You again?'], index: 0, targetId: RIVAL_ACTOR_ID, noTalk: true }));
    expect(engine.spoken).toHaveLength(0);
  });

  it("an NPC's reply is spoken sentence by sentence while it streams, in the NPC's voice", () => {
    voicesOn();
    act(() => useNpcTalkStore.setState({ targetId: 'mirevale.bram', phase: 'thinking', turns: [{ role: 'user', content: 'Hi' }], partial: '' }));
    act(() => useNpcTalkStore.setState({ phase: 'replying', partial: 'Hello there. Wel' }));
    expect(texts()).toEqual(['Hello there.']);
    act(() => useNpcTalkStore.setState({ phase: 'idle', partial: '', turns: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello there. Welcome to Mirevale.' }] }));
    engine.drain();
    expect(texts()).toEqual(['Hello there.', 'Welcome to Mirevale.']);
    expect(engine.spoken[0]!.voiceURI).toBe(pickVoice(npcPersona('mirevale.bram'), VOICES).voiceURI);
    // the tool pass writing its events onto the reply says nothing again
    act(() => useNpcTalkStore.setState({ turns: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello there. Welcome to Mirevale.', events: ['x'] }] }));
    engine.drain();
    expect(texts()).toHaveLength(2);
  });

  it('the dialogue closing, going back to the lines, or a battle stops the NPC', () => {
    voicesOn();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Bram', lines: ['Hi'], index: 0, targetId: 'mirevale.bram' }));
    reply(['One sentence here. Two'], 'One sentence here. Two sentences here.');
    expect(engine.current()).not.toBeNull();
    act(() => useUiStore.getState().setDialogue(null));
    expect(engine.cancels).toBe(1);
    expect(engine.current()).toBeNull();

    reply(['Again here. More'], 'Again here. More.');
    act(() => useNpcTalkStore.setState({ hidden: true }));
    expect(engine.cancels).toBe(2);

    act(() => useNpcTalkStore.setState({ hidden: false }));
    reply(['Third time. And'], 'Third time. And more.');
    act(() => useUiStore.setState({ battle: {} as never }));
    expect(engine.cancels).toBe(3);
    expect(engine.current()).toBeNull();
  });

  it("the buddy's lines, the lead's bubble and the rival's words are spoken; the player's line interrupts the buddy", () => {
    voicesOn();
    act(() =>
      useBuddyTalkStore.setState({ creatureId: 'c1', profile: { speciesId: 'bramblecub' } as never, turns: [{ role: 'buddy', text: 'Bram bram! Hello, trainer.' }], phase: 'idle' }),
    );
    expect(texts()).toEqual(['Bram bram!']);
    expect(engine.spoken[0]!.pitch).toBe(pickVoice(creaturePersona('c1', 'bramblecub'), VOICES).pitch);
    act(() => useBuddyTalkStore.setState((st) => ({ turns: [...st.turns, { role: 'trainer', text: 'Hi!' }] })));
    expect(engine.cancels).toBe(1);
    engine.drain();
    expect(texts()).toEqual(['Bram bram!']);

    act(() => useBuddyBubbleStore.setState({ line: { seq: 7, text: 'Ooh, the sea!', speciesId: 'bramblecub', ms: 3000 } }));
    expect(texts().at(-1)).toBe('Ooh, the sea!');

    act(() => useUiStore.getState().setDialogue({ speaker: 'Rival Kai', lines: ['You again? Let us fight.'], index: 0, targetId: RIVAL_ACTOR_ID, noTalk: true, obligatory: true }));
    engine.drain();
    expect(texts().slice(-2)).toEqual(['You again?', 'Let us fight.']);
    // a scripted sign is not read
    act(() => useUiStore.getState().setDialogue({ speaker: 'Sign', lines: ['Mirevale'], index: 0, targetId: 'sign', noTalk: true }));
    engine.drain();
    expect(texts()).not.toContain('Mirevale');
  });

  it('battle lines need "Voice the battle"; the battle closing stops them', () => {
    voicesOn({ battleVoices: false });
    act(() => useCommentaryStore.setState({ caster: { id: 1, battleId: 'b', kind: 'crit', side: 'player', head: 'Critical hit!', text: 'Wow.', fromModel: false } }));
    expect(engine.spoken).toHaveLength(0);
    voicesOn({ battleVoices: true });
    act(() => useUiStore.setState({ battle: {} as never }));
    act(() => useCommentaryStore.setState({ caster: { id: 2, battleId: 'b', kind: 'ko', side: 'player', head: 'Down it goes!', text: 'A knockout.', fromModel: false } }));
    act(() => useCommentaryStore.setState({ trainer: { id: 3, battleId: 'b', kind: 'ko', speaker: 'Ace Mira', text: 'Not bad.', fromModel: false } }));
    engine.drain();
    expect(texts()).toEqual(['Down it goes!', 'A knockout.', 'Not bad.']);
    act(() => useCommentaryStore.setState({ caster: { id: 4, battleId: 'b', kind: 'win', side: 'player', head: 'It is over!', text: 'What a match.', fromModel: false } }));
    act(() => useUiStore.setState({ battle: null }));
    expect(engine.current()).toBeNull();
  });

  it('master at 0, the voices off mid-line, a hidden tab or push-to-talk stop the speech', () => {
    voicesOn();
    reply(['One here. Two'], 'One here. Two here.');
    act(() => useSettingsStore.getState().set('audio', { npcVoices: false }));
    expect(engine.current()).toBeNull();

    voicesOn({ master: 0 });
    reply(['Silent. Yes'], 'Silent. Yes.');
    expect(texts()).toEqual(['One here.']);

    voicesOn({ master: 0.8 });
    reply(['Loud one. Two'], 'Loud one. Two.');
    expect(engine.current()?.volume).toBeCloseTo(0.8 * 0.8 * 0.8 * 0.8);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(engine.current()).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    reply(['Push. To'], 'Push. To talk.');
    expect(engine.current()).not.toBeNull();
    hushVoices();
    expect(engine.current()).toBeNull();
  });
});
