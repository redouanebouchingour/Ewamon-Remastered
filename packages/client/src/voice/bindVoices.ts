/**
 * Voice talk (LLM feature 10): the speaker tied to the game. `startVoices` (PlayShell, once) follows the stores that
 * show the talk and speaks it when Settings › Audio says so; nothing else in the game knows about speech.
 *
 * - NPC talk (`state/npcTalk`): a reply's sentences are spoken as they stream in (a stream per reply, opened when the
 *   phase turns `thinking`, ended by the reply landing in `turns`). The voice is seeded by the NPC's id.
 * - The buddy (`state/buddy`): each line the creature says in the talk box, and the lead's speech bubble; the pitch
 *   follows its species' size. A line the player sends interrupts it.
 * - The rival (`state/ui` dialogue on `RIVAL_ACTOR_ID`): its walk-up taunt and its parting line.
 * - The battle (`state/commentary`, Settings "Voice the battle"): the commentator's caption and the trainer's lines,
 *   queued behind each other (a newer one replaces one still waiting).
 *
 * Interruptions: a new reply or line, the dialogue closing or changing, going back to the scripted lines, the buddy
 * talk closing, a battle taking the screen (world speech stops), the battle closing (its speech stops), the player
 * pressing push-to-talk (`hushVoices`), a setting turned off, master volume 0, the tab hidden with "Mute when the tab
 * is hidden". Volume: master × voices, both as the mixer's perceptual curve (gain²), like the other buses. Speech
 * synthesis does not run through the game's WebAudio graph, so the compressor and the dialogue duck do not apply.
 */
import { perceptual } from '../audio/mixer';
import { species } from '../data/content';
import { RIVAL_ACTOR_ID } from '../scene/rivalExit';
import { leadCreature, useBuddyBubbleStore, useBuddyTalkStore } from '../state/buddy';
import { useCommentaryStore } from '../state/commentary';
import { useNpcTalkStore } from '../state/npcTalk';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';
import { createSpeaker } from './speaker';
import type { Speaker, SpeechStream, VoiceChannel } from './speaker';
import { browserSpeech } from './speech';
import type { SpeechEngine } from './speech';
import type { VoicePersona } from './voices';

let active: Speaker | null = null;

/** Stops the world's speech (the player starts to speak). */
export function hushVoices(): void {
  active?.hush('world');
}

export const CASTER: VoicePersona = { key: 'caster', kind: 'caster' };
export const npcPersona = (npcId: string): VoicePersona => ({ key: `npc:${npcId}`, kind: 'npc' });
/** the rival and the trainers in battle: seeded by the name the line shows */
export const personPersona = (name: string): VoicePersona => ({ key: `person:${name}`, kind: 'npc' });

/** A party creature: seeded by its id, the pitch by its species' size. */
export function creaturePersona(creatureId: string, speciesId: string | null): VoicePersona {
  const size = speciesId === null ? undefined : species(speciesId)?.sizeScale;
  return { key: `creature:${creatureId}`, kind: 'creature', ...(size !== undefined ? { size } : {}) };
}

const hidden = (): boolean => typeof document !== 'undefined' && document.hidden;

/** May this channel speak now (the settings, master volume, a hidden tab). */
export function voiceAllowed(c: VoiceChannel): boolean {
  const a = useSettingsStore.getState().audio;
  if (a.master <= 0 || a.voices <= 0 || (a.muteWhenHidden && hidden())) return false;
  return c === 'world' ? a.npcVoices : a.battleVoices;
}

export function voiceVolume(): number {
  const a = useSettingsStore.getState().audio;
  return perceptual(a.master) * perceptual(a.voices);
}

/**
 * Ties the speaker to the stores; returns the stop. Null engine (no `speechSynthesis`): nothing happens.
 * `schedule` is for tests.
 */
export function startVoices(engine: SpeechEngine | null = browserSpeech(), schedule?: (fn: () => void, ms: number) => void): () => void {
  if (engine === null) return () => undefined;
  const speaker = createSpeaker({ engine, allowed: voiceAllowed, volume: voiceVolume, ...(schedule !== undefined ? { schedule } : {}) });
  active = speaker;
  const offs: (() => void)[] = [];

  // ---- NPC talk: a stream per reply ----
  let reply: SpeechStream | null = null;
  offs.push(
    useNpcTalkStore.subscribe((next, prev) => {
      if (next.targetId !== prev.targetId || (next.hidden && !prev.hidden)) {
        reply = null;
        speaker.hush('world');
        if (next.targetId === null) return;
      }
      if (next.phase === 'thinking' && prev.phase === 'idle' && next.targetId !== null) reply = speaker.stream('world', npcPersona(next.targetId));
      if (reply !== null && next.partial !== '' && next.partial !== prev.partial) reply.update(next.partial);
      const last = next.turns.at(-1);
      if (reply !== null && last !== undefined && last !== prev.turns.at(-1) && last.role === 'assistant') {
        reply.end(last.content);
        reply = null;
      } else if (next.phase === 'idle' && prev.phase !== 'idle') reply = null;
    }),
  );

  // ---- the buddy ----
  offs.push(
    useBuddyTalkStore.subscribe((next, prev) => {
      if (next.creatureId !== prev.creatureId) speaker.hush('world');
      const last = next.turns.at(-1);
      if (next.creatureId === null || last === undefined || last === prev.turns.at(-1)) return;
      if (last.role === 'trainer') return speaker.hush('world');
      speaker.say('world', creaturePersona(next.creatureId, next.profile?.speciesId ?? null), last.text);
    }),
  );
  offs.push(
    useBuddyBubbleStore.subscribe((next, prev) => {
      const line = next.line;
      if (line === null || line.seq === prev.line?.seq) return;
      const lead = leadCreature()?.speciesId === line.speciesId ? leadCreature() : (useSessionStore.getState().inventory?.party ?? []).find((c) => c.speciesId === line.speciesId);
      speaker.say('world', creaturePersona(lead?.id ?? line.speciesId, line.speciesId), line.text);
    }),
  );

  // ---- the rival's words, the dialogue closing, a battle ----
  offs.push(
    useUiStore.subscribe((next, prev) => {
      const d = next.dialogue;
      const was = prev.dialogue;
      if (was !== null && (d === null || d.targetId !== was.targetId)) speaker.hush('world');
      if (d !== null && d.targetId === RIVAL_ACTOR_ID && (was === null || was.targetId !== d.targetId || was.lines !== d.lines)) {
        speaker.say('world', personPersona(d.speaker), d.lines.join(' '));
      }
      if (next.battle !== null && prev.battle === null) speaker.hush('world');
      if (next.battle === null && prev.battle !== null) speaker.hush('battle');
    }),
  );

  // ---- the battle's words ----
  offs.push(
    useCommentaryStore.subscribe((next, prev) => {
      if (next.caster !== null && next.caster.id !== prev.caster?.id) speaker.say('battle', CASTER, `${next.caster.head} ${next.caster.text}`, { queue: true });
      if (next.trainer !== null && next.trainer.id !== prev.trainer?.id) speaker.say('battle', personPersona(next.trainer.speaker), next.trainer.text, { queue: true });
    }),
  );

  // ---- the settings, a hidden tab ----
  offs.push(
    useSettingsStore.subscribe(
      (st) => st.audio,
      (a) => {
        if (!voiceAllowed('world')) speaker.hush('world');
        if (!voiceAllowed('battle')) speaker.hush('battle');
        if (a.master <= 0) speaker.hush();
      },
    ),
  );
  if (typeof document !== 'undefined') {
    const onVis = (): void => {
      if (hidden() && useSettingsStore.getState().audio.muteWhenHidden) speaker.hush();
    };
    document.addEventListener('visibilitychange', onVis);
    offs.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  return () => {
    for (const off of offs) off();
    speaker.hush();
    if (active === speaker) active = null;
  };
}
