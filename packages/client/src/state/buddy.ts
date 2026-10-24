/**
 * Talk to your own Ewamon (LLM feature 6): the conversation with a party creature, the session's memories of what each
 * creature did, and the lead's ambient speech bubble.
 *
 * - `useBuddyTalkStore`: the open conversation (one creature at a time). `openBuddyTalk` (the `buddyTalk` key near the
 *   follower, the party card's Talk, the field power chip) fetches the creature's history once a session
 *   (`GET /creature/:id/history`, waited for at most `HISTORY_WAIT_MS`), builds its facts (talk/buddyFacts.ts) and has
 *   it greet the player; `sayToBuddy` answers a typed line. The model's words or a template (talk/buddy.ts).
 * - The memories: `createBuddyLogger`, a Commentator World3D tees beside the commentator and the battle logger, reads
 *   each battle's events into a few memories per creature (won, lost, fainted, the knockout it landed with which move,
 *   a level, a move learned, ready to evolve, a catch it helped with, a run). In memory for the session only: the
 *   durable story (how it was met, evolutions, badges) is the server's creature history, read on open.
 * - The bubble: `stepBuddyAmbient` gets World3D's 2 Hz snapshot, asks talk/buddyAmbient.ts whether the lead has
 *   something to say and shows it over the follower (`useBuddyBubbleStore`; World3D writes the anchor while it shows).
 *   Off with Settings › Accessibility "Follower chatter".
 *
 * Nothing here writes to the save or calls a server route that changes anything: the creature's words are flavour.
 */
import { create } from 'zustand';
import { fieldLead } from '@ewa/content';
import type { BattleEvent, BattleState, CreatureInstance, Ref } from '@ewa/core';
import type { CreatureHistory } from '@ewa/protocol';
import type { Commentator } from '../battle/commentator';
import { apiFetch } from '../net/api';
import { buddyProfile, speciesNameOf, templateReply, voiceOf } from '../talk/buddyFacts';
import type { BuddyMemory, BuddyPlace, BuddyProfile } from '../talk/buddyFacts';
import { ambientWording, buddyReply } from '../talk/buddy';
import type { BuddyCallOptions, BuddyTurn } from '../talk/buddy';
import { createAmbient } from '../talk/buddyAmbient';
import type { AmbientSnapshot } from '../talk/buddyAmbient';
import { useSessionStore } from './session';
import { useSettingsStore } from './settings';
import { useUiStore } from './ui';

const MODEL_ON = (import.meta.env as Record<string, string | undefined> | undefined)?.['VITE_NPC_TALK'] !== '0';

/** how long the history may take before the creature speaks without it */
export const HISTORY_WAIT_MS = 1500;
/** memories kept per creature */
export const MAX_MEMORIES = 8;
/** the conversation's turns kept on screen */
export const MAX_TURNS = 12;
/** a typed line longer than this is cut */
export const MAX_SAID = 200;

// ---- memories ------------------------------------------------------------------------------------------------------

const memories = new Map<string, BuddyMemory[]>();

export function rememberBuddy(creatureId: string, m: BuddyMemory): void {
  const list = memories.get(creatureId) ?? [];
  list.push(m);
  if (list.length > MAX_MEMORIES) list.splice(0, list.length - MAX_MEMORIES);
  memories.set(creatureId, list);
}

/** A creature's memories this session, oldest first. */
export function memoriesOf(creatureId: string): readonly BuddyMemory[] {
  return memories.get(creatureId) ?? [];
}

export function clearBuddyMemories(): void {
  memories.clear();
}

// ---- where the player is (World3D, 2 Hz) -----------------------------------------------------------------------------

let place: BuddyPlace | null = null;

export function setBuddyPlace(p: BuddyPlace | null): void {
  place = p;
}

export function buddyPlace(): BuddyPlace | null {
  return place ?? { zoneId: useSessionStore.getState().zoneId, timeOfDay: null, weather: null };
}

// ---- the battle logger -------------------------------------------------------------------------------------------

interface LogCtx {
  readonly seat: 0 | 1;
  readonly start: BattleState;
  readonly foe: string;
  readonly wild: boolean;
  /** own creatures that took the field */
  readonly fought: Set<number>;
  /** the best hit each own slot landed: its move and whether it was super effective */
  readonly best: Map<number, { readonly move: string; readonly se: boolean }>;
  /** foe slot → the own slot and move that hit it last */
  readonly lastHit: Map<number, { readonly slot: number; readonly move: string | null }>;
  caught: boolean;
  done: boolean;
}

const creatureAt = (st: BattleState, r: Ref): CreatureInstance | undefined => st.sides[r.side]?.party[r.slot]?.creature;

/** "a wild Ampmite" / "the opponent's Ampmite": the side said in full (feature 5's finding). */
function foeCreature(ctx: LogCtx, slot: number): string {
  const c = ctx.start.sides[ctx.seat === 0 ? 1 : 0].party[slot]?.creature;
  const name = c === undefined ? 'creature' : (c.nickname ?? speciesNameOf(c.speciesId));
  return ctx.wild ? `a wild ${name}` : `the opponent's ${name}`;
}

/**
 * The battle's events as memories of the player's own creatures (a Commentator: World3D hands it the battle's start,
 * each timeline's events and the end, beside the commentator; the battle itself never sees it).
 */
export function createBuddyLogger(o: { readonly now?: () => number } = {}): Commentator {
  const now = o.now ?? Date.now;
  let ctx: LogCtx | null = null;
  const own = (r: Ref): boolean => ctx !== null && r.side === ctx.seat;
  const idOf = (slot: number): string | null => (ctx === null ? null : (ctx.start.sides[ctx.seat].party[slot]?.creature.id ?? null));
  const remember = (slot: number, m: Omit<BuddyMemory, 'at'>): void => {
    const id = idOf(slot);
    if (id !== null) rememberBuddy(id, { ...m, at: now() });
  };
  return {
    begin(b) {
      if (b.spectator || b.replay || b.format === 'raid') {
        ctx = null;
        return;
      }
      const foeSide = b.state.sides[b.seat === 0 ? 1 : 0];
      const wild = foeSide.kind === 'wild';
      const lead = foeSide.party[foeSide.active]?.creature;
      const foe = wild ? `a wild ${lead === undefined ? 'creature' : speciesNameOf(lead.speciesId)}` : (b.foe?.name ?? 'another trainer');
      const mine = b.state.sides[b.seat];
      ctx = { seat: b.seat, start: b.state, foe, wild, fought: new Set(mine.actives ?? [mine.active]), best: new Map(), lastHit: new Map(), caught: false, done: false };
    },
    timeline(events: readonly BattleEvent[]) {
      const c = ctx;
      if (c === null || c.done) return;
      for (const e of events) {
        switch (e.t) {
          case 'switchIn':
            if (own(e.who)) c.fought.add(e.who.slot);
            break;
          case 'damage': {
            if (e.cause !== 'move' || e.source === null || !own(e.source) || own(e.target)) break;
            c.lastHit.set(e.target.slot, { slot: e.source.slot, move: e.move });
            const prev = c.best.get(e.source.slot);
            const se = e.effectiveness >= 2;
            if (e.move !== null && (prev === undefined || (se && !prev.se))) c.best.set(e.source.slot, { move: e.move, se });
            break;
          }
          case 'faint':
            if (own(e.who)) remember(e.who.slot, { kind: 'fainted', foe: c.foe });
            else {
              const hit = c.lastHit.get(e.who.slot);
              if (hit !== undefined) remember(hit.slot, { kind: 'ko', other: foeCreature(c, e.who.slot), ...(hit.move !== null ? { move: hit.move } : {}) });
            }
            break;
          case 'levelUp':
            if (own(e.who)) remember(e.who.slot, { kind: 'levelUp', level: e.level });
            break;
          case 'learnMove':
            if (own(e.who)) remember(e.who.slot, { kind: 'learned', move: e.move });
            break;
          case 'evolveReady':
            if (own(e.who)) remember(e.who.slot, { kind: 'evolveReady', into: e.into });
            break;
          case 'catchResult':
            if (e.caught) {
              c.caught = true;
              const caught = creatureAt(c.start, e.target);
              const mine = c.start.sides[c.seat];
              const active = mine.actives ?? [mine.active];
              for (const slot of active) if (caught !== undefined) remember(slot, { kind: 'caught', caught: caught.speciesId });
            }
            break;
          case 'fled':
            if (e.side === c.seat) for (const slot of c.fought) remember(slot, { kind: 'fled', foe: c.foe });
            break;
          case 'battleEnd': {
            c.done = true;
            const w = e.outcome.winner;
            if (typeof w !== 'number' || c.caught) break;
            for (const slot of c.fought) {
              const best = c.best.get(slot);
              if (w === c.seat) remember(slot, { kind: 'won', foe: c.foe, ...(best !== undefined ? { move: best.move, superEffective: best.se } : {}) });
              else remember(slot, { kind: 'lost', foe: c.foe });
            }
            break;
          }
          default:
            break;
        }
      }
    },
    played() {},
    end() {
      ctx = null;
    },
  };
}

// ---- the conversation --------------------------------------------------------------------------------------------

export interface BuddyLine extends BuddyTurn {
  /** the model's words (true) or a template */
  readonly model?: boolean;
}

interface BuddyTalkState {
  /** the creature talked to; null: closed */
  readonly creatureId: string | null;
  readonly profile: BuddyProfile | null;
  readonly turns: readonly BuddyLine[];
  readonly phase: 'idle' | 'thinking';
}

export const useBuddyTalkStore = create<BuddyTalkState>()(() => ({ creatureId: null, profile: null, turns: [], phase: 'idle' }));

const histories = new Map<string, CreatureHistory | null>();
let talkAbort: AbortController | null = null;

async function historyOf(id: string, signal: AbortSignal): Promise<CreatureHistory | null> {
  if (histories.has(id)) return histories.get(id) ?? null;
  if (useSessionStore.getState().accessToken === null) return null;
  const load = apiFetch('creatureHistory', { params: { id }, signal })
    .then((h) => {
      histories.set(id, h);
      return h;
    })
    .catch(() => null);
  return Promise.race([load, new Promise<null>((r) => setTimeout(() => r(null), HISTORY_WAIT_MS))]);
}

function partyNow(): readonly CreatureInstance[] {
  return useSessionStore.getState().inventory?.party ?? [];
}

/** The creature walking behind the player (the first one standing). */
export function leadCreature(): CreatureInstance | null {
  return fieldLead(partyNow());
}

/** A party creature's facts now (the history if it is back, this session's memories, the place). */
export function profileOf(c: CreatureInstance, history: CreatureHistory | null = histories.get(c.id) ?? null, now = Date.now()): BuddyProfile {
  const lead = leadCreature()?.id === c.id;
  return buddyProfile(c, { history, memories: memoriesOf(c.id), place: buddyPlace(), lead, trainer: useSessionStore.getState().profile?.username ?? null, now });
}

export interface TalkOptions extends BuddyCallOptions {
  /** false: templates only (tests, `VITE_NPC_TALK=0`) */
  readonly model?: boolean;
}

function push(line: BuddyLine): void {
  useBuddyTalkStore.setState((st) => ({ turns: [...st.turns, line].slice(-MAX_TURNS) }));
}

async function reply(said: string, o: TalkOptions): Promise<void> {
  const st = useBuddyTalkStore.getState();
  const p = st.profile;
  if (p === null || st.creatureId === null) return;
  talkAbort?.abort();
  const ctl = new AbortController();
  talkAbort = ctl;
  const earlier = st.turns.slice(0, said === '' ? st.turns.length : -1);
  const turn = st.turns.length;
  useBuddyTalkStore.setState({ phase: 'thinking' });
  const useModel = o.model ?? MODEL_ON;
  const r = useModel ? await buddyReply(p, said, earlier, turn, { ...o, signal: ctl.signal }) : { text: templateReply(p, turn), model: false };
  if (ctl.signal.aborted || useBuddyTalkStore.getState().creatureId !== p.id) return;
  talkAbort = null;
  push({ role: 'buddy', text: r.text, model: r.model });
  useBuddyTalkStore.setState({ phase: 'idle' });
}

/**
 * Opens the talk with a party creature (default: the lead walking behind the player) and lets it greet the player.
 * Nothing opens without a party creature by that id.
 */
export async function openBuddyTalk(creatureId?: string, o: TalkOptions = {}): Promise<void> {
  const c = creatureId === undefined ? leadCreature() : (partyNow().find((x) => x.id === creatureId) ?? null);
  if (c === null) return;
  talkAbort?.abort();
  const ctl = new AbortController();
  talkAbort = ctl;
  clearBubble();
  // the facts at once (templates can speak), the history folded in when it is back
  useBuddyTalkStore.setState({ creatureId: c.id, profile: profileOf(c), turns: [], phase: 'thinking' });
  const history = await historyOf(c.id, ctl.signal);
  if (ctl.signal.aborted || useBuddyTalkStore.getState().creatureId !== c.id) return;
  useBuddyTalkStore.setState({ profile: profileOf(c, history) });
  await reply('', o);
}

/** The player's typed line, then the creature's answer. False when nothing was sent (closed, thinking, empty). */
export function sayToBuddy(text: string, o: TalkOptions = {}): boolean {
  const st = useBuddyTalkStore.getState();
  const said = text.replace(/\s+/g, ' ').trim().slice(0, MAX_SAID);
  if (st.creatureId === null || st.phase !== 'idle' || said === '') return false;
  // the facts move with the world (a level, a battle, the place): rebuilt per line
  const c = partyNow().find((x) => x.id === st.creatureId);
  if (c !== undefined) useBuddyTalkStore.setState({ profile: profileOf(c) });
  push({ role: 'trainer', text: said });
  void reply(said, o);
  return true;
}

export function closeBuddyTalk(): void {
  talkAbort?.abort();
  talkAbort = null;
  useBuddyTalkStore.setState({ creatureId: null, profile: null, turns: [], phase: 'idle' });
}

// ---- the ambient bubble --------------------------------------------------------------------------------------------

export interface BubbleLine {
  readonly seq: number;
  readonly text: string;
  readonly speciesId: string;
  /** how long it shows (ms) */
  readonly ms: number;
}

interface BubbleState {
  readonly line: BubbleLine | null;
  /** the follower's head on screen (px, the page's coordinates); null: not on screen (the bubble sits by the player) */
  readonly anchor: { readonly x: number; readonly y: number } | null;
}

export const useBuddyBubbleStore = create<BubbleState>()(() => ({ line: null, anchor: null }));

let bubbleSeq = 0;

/** How long a line shows: 3.5 s plus a little per word, at most 7 s. */
export function bubbleMs(text: string): number {
  return Math.min(7000, 3500 + text.split(/\s+/).length * 180);
}

export function showBubble(text: string, speciesId: string): void {
  useBuddyBubbleStore.setState({ line: { seq: ++bubbleSeq, text, speciesId, ms: bubbleMs(text) } });
}

export function clearBubble(): void {
  if (useBuddyBubbleStore.getState().line !== null) useBuddyBubbleStore.setState({ line: null, anchor: null });
}

/** World3D, per frame while a line shows: where the follower's head is (written only when it moved a pixel). */
export function setBubbleAnchor(x: number, y: number, visible: boolean): void {
  const cur = useBuddyBubbleStore.getState().anchor;
  if (!visible) {
    if (cur !== null) useBuddyBubbleStore.setState({ anchor: null });
    return;
  }
  if (cur !== null && Math.abs(cur.x - x) < 1 && Math.abs(cur.y - y) < 1) return;
  useBuddyBubbleStore.setState({ anchor: { x: Math.round(x), y: Math.round(y) } });
}

const ambient = createAmbient();
let ambientAbort: AbortController | null = null;

/** The UI the lead must not talk over: a dialogue, a modal, the talk box, an evolution, a panel. */
export function uiBusy(): boolean {
  const ui = useUiStore.getState();
  const panel = typeof location !== 'undefined' && location.pathname !== '/play' && location.pathname !== '/play/';
  return ui.dialogue !== null || ui.modal !== 'none' || ui.evolution !== null || ui.chatOpen || useBuddyTalkStore.getState().creatureId !== null || panel;
}

/**
 * World3D's 2 Hz snapshot: the lead may remark on what changed (talk/buddyAmbient.ts); the template, or the model's
 * words when they come back within `AMBIENT_TIMEOUT_MS`, shows over the follower. `o` is for tests.
 */
export function stepBuddyAmbient(s: AmbientSnapshot, o: TalkOptions = {}): Promise<void> {
  const ev = ambient.step(s, (lead) => voiceOf(lead.id, lead.speciesId));
  if (ev === null || !useSettingsStore.getState().accessibility.followerChatter) return Promise.resolve();
  const leadC = partyNow().find((c) => c.id === s.lead?.id);
  if (leadC === undefined) return Promise.resolve();
  if (!(o.model ?? MODEL_ON)) {
    showBubble(ev.template, leadC.speciesId);
    return Promise.resolve();
  }
  ambientAbort?.abort();
  const ctl = new AbortController();
  ambientAbort = ctl;
  return ambientWording(profileOf(leadC), ev.event, { ...o, signal: ctl.signal }).then((words) => {
    if (ctl.signal.aborted || uiBusy()) return;
    showBubble(words ?? ev.template, leadC.speciesId);
  });
}

/** The world was left: the ambient watcher starts over, the bubble goes. */
export function resetBuddyAmbient(): void {
  ambientAbort?.abort();
  ambientAbort = null;
  ambient.reset();
  clearBubble();
  place = null;
}
