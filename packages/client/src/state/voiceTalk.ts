/**
 * NPC voice talk: the conversation the DialogueBox shows over an NPC's lines. Hold V (or the mic button) to speak
 * English; release to send (or press C and type: `sendText`; or hit the NPC with H / K: `hitNpc`). The take goes to
 * whisper.cpp, the text to the local model, and the reply streams in.
 * One conversation per open dialogue (E on a person starts a new one): every take, typed line and hit while it stays open
 * is added to it. `leaveTalk` (Back / Enter / E) shows the scripted lines again and keeps the conversation, so the next
 * line resumes it; `endTalk` (dialogue closed or target changed) drops it. Both abort what is in flight and release
 * the microphone.
 *
 * After each reply the tool pass picks what the NPC does (`voice/npcChat`): a slap or a kick plays in the world
 * (`state/npcFx`); money and Ewamon go through `POST /npc/act`, which checks the NPC stands in the player's zone and
 * keeps its wallet; the delta lands in the session like any other.
 */
import { create } from 'zustand';
import { NPC_MONEY_MAX } from '@ewa/protocol';
import type { NPC_ACTIONS } from '@ewa/protocol';
import { apiFetch, isApiFailure } from '../net/api';
import { speciesName } from '../data/content';
import { GIVE_EWAMON, GIVE_MONEY, KICK, SLAP, TAKE_EWAMON, TAKE_MONEY, TOOL_MODEL, judgeExchange, playerHitTurn, streamNpcReply } from '../voice/npcChat';
import type { StrikeKind } from '../scene/npcStrike';
import type { ChatTurn, NpcPersona, ToolCall } from '../voice/npcChat';
import { strike } from './npcFx';
import { toast } from './notifications';
import { toInventoryDelta, useSessionStore } from './session';
import { releaseMic, startTake, stopTake, transcribe } from '../voice/recorder';

export type TalkPhase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'replying';

export interface VoiceTalkState {
  /** the dialogue target the conversation belongs to (null = none) */
  readonly targetId: string | null;
  readonly phase: TalkPhase;
  readonly turns: readonly ChatTurn[];
  /** the reply streaming in (shown until it lands in `turns`) */
  readonly partial: string;
  readonly error: string | null;
  /** the player went back to the scripted lines (`leaveTalk`); the conversation is kept and the next line resumes it */
  readonly hidden: boolean;
}

const IDLE: VoiceTalkState = { targetId: null, phase: 'idle', turns: [], partial: '', error: null, hidden: false };

export const useVoiceTalkStore = create<VoiceTalkState>()(() => IDLE);

const set = (p: Partial<VoiceTalkState>): void => useVoiceTalkStore.setState(p);

let persona: NpcPersona | null = null;
let inflight: AbortController | null = null;
/** the mic opening (the first press may wait on the permission prompt) */
let starting: Promise<boolean> | null = null;

/** Joins (or starts, when the target changed) the conversation with `targetId`; false while a reply is on its way. */
function join(targetId: string, p: NpcPersona): boolean {
  const st = useVoiceTalkStore.getState();
  if (st.targetId !== targetId) {
    endTalk();
    persona = p;
    set({ targetId });
    return true;
  }
  if (st.phase !== 'idle') return false;
  if (st.hidden) set({ hidden: false });
  return true;
}

/** Starts a take for `targetId`. No-op while a reply is on its way. */
export function beginTake(targetId: string, p: NpcPersona): void {
  if (!join(targetId, p)) return;
  set({ phase: 'listening', error: null });
  starting = startTake().then(
    () => true,
    (e: unknown) => {
      if (useVoiceTalkStore.getState().targetId === targetId) set({ phase: 'idle', error: micError(e) });
      return false;
    },
  );
}

/** Ends the take and runs it: transcribe → reply. */
export function finishTake(): void {
  const st = useVoiceTalkStore.getState();
  if (st.phase !== 'listening' || persona === null) return;
  const p = persona;
  const ac = new AbortController();
  inflight = ac;
  set({ phase: 'transcribing' });
  void (async () => {
    try {
      if (!(await (starting ?? Promise.resolve(false)))) return;
      const samples = await stopTake();
      if (ac.signal.aborted) return;
      if (samples === null) return set({ phase: 'idle', error: 'I heard nothing. Hold V while you talk.' });
      const heard = await transcribe(samples, ac.signal);
      if (ac.signal.aborted) return;
      if (heard === '') return set({ phase: 'idle', error: 'I did not catch that. Try again.' });
      await answer(p, { role: 'user', content: heard }, ac);
    } catch (e) {
      if (ac.signal.aborted) return;
      set({ phase: 'idle', partial: '', error: `Speech recognition failed (is scripts/voice-stt.mjs running?): ${message(e)}` });
    } finally {
      if (inflight === ac) inflight = null;
    }
  })();
}

/**
 * The player hits the NPC (H / K): the strike plays (the burst at contact), then the NPC answers it like a line —
 * angry words, and the tool pass may hit back. No-op while a reply is on its way.
 */
export function hitNpc(targetId: string, p: NpcPersona, kind: StrikeKind): void {
  if (!join(targetId, p)) return;
  const ac = new AbortController();
  inflight = ac;
  set({ error: null, phase: 'thinking' });
  void (async () => {
    await strike(kind, targetId, 'player');
    if (ac.signal.aborted) return;
    await answer(p, playerHitTurn(kind, p.name), ac);
  })().finally(() => {
    if (inflight === ac) inflight = null;
  });
}

/** Typed chat (C): the same conversation without the microphone. No-op while a reply is on its way. */
export function sendText(targetId: string, p: NpcPersona, text: string): void {
  const said = text.trim();
  if (said === '' || !join(targetId, p)) return;
  const ac = new AbortController();
  inflight = ac;
  set({ error: null });
  void answer(p, { role: 'user', content: said }, ac).finally(() => {
    if (inflight === ac) inflight = null;
  });
}

/**
 * Adds what the player said, streams the NPC's answer (talk pass), then lets the tool pass judge the exchange and
 * plays what it called. The phase stays `replying` until the tools are done, so the next take sees what happened.
 */
async function answer(p: NpcPersona, said: ChatTurn, ac: AbortController): Promise<void> {
  const turns = [...useVoiceTalkStore.getState().turns, said];
  set({ turns, phase: 'thinking', partial: '' });
  let reply: string;
  try {
    reply = await streamNpcReply(p, turns, (text) => set({ phase: 'replying', partial: text }), ac.signal);
  } catch (e) {
    if (ac.signal.aborted) return;
    return set({ phase: 'idle', partial: '', error: `The language model did not answer (is LM Studio running on port 1234?): ${message(e)}` });
  }
  if (ac.signal.aborted) return;
  const spoken: ChatTurn[] = [...turns, { role: 'assistant', content: reply === '' ? '…' : reply }];
  set({ turns: spoken, partial: '', phase: 'replying' });
  try {
    const calls = await judgeExchange(p, spoken, NPC_MONEY_MAX, ac.signal);
    if (ac.signal.aborted) return;
    const events = await runTools(targetOf(), p.name, calls);
    if (ac.signal.aborted) return;
    const last = spoken.at(-1)!;
    set({ turns: events.length > 0 ? [...spoken.slice(0, -1), { ...last, events }] : spoken, phase: 'idle' });
  } catch (e) {
    if (ac.signal.aborted) return;
    set({ phase: 'idle', error: `The tool pass did not answer (is ${TOOL_MODEL} loaded in LM Studio?): ${message(e)}` });
  }
}

function targetOf(): string {
  return useVoiceTalkStore.getState().targetId ?? '';
}

/** Server actions per tool (slap / kick are client-only). */
const SERVER_ACTION: Readonly<Record<string, (typeof NPC_ACTIONS)[number]>> = {
  [GIVE_MONEY]: 'giveMoney',
  [TAKE_MONEY]: 'takeMoney',
  [GIVE_EWAMON]: 'giveCreature',
  [TAKE_EWAMON]: 'takeCreature',
};

/**
 * Plays the tool calls: the hits first (each waits for contact), then the save-touching ones through `POST /npc/act`
 * (a toast each; a refusal is toasted and told to the talk pass as what happened). Returns the events, in English.
 */
export async function runTools(npcId: string, name: string, calls: readonly ToolCall[]): Promise<string[]> {
  const events: string[] = [];
  const ordered = [...calls].sort((a, b) => Number(b.name === SLAP || b.name === KICK) - Number(a.name === SLAP || a.name === KICK));
  for (const c of ordered) {
    if (c.name === SLAP || c.name === KICK) {
      await strike(c.name === SLAP ? 'slap' : 'kick', npcId);
      events.push(c.name === SLAP ? `${name} slapped the traveller.` : `${name} kicked the traveller.`);
      continue;
    }
    const action = SERVER_ACTION[c.name];
    if (action === undefined) continue;
    events.push(await act(npcId, name, action, c.amount));
  }
  return events;
}

/** One save-touching tool through the server; the session takes the delta. Returns what happened, in English. */
async function act(npcId: string, name: string, action: (typeof NPC_ACTIONS)[number], amount: number | undefined): Promise<string> {
  const session = useSessionStore.getState();
  const before = [...(session.inventory?.party ?? []), ...(session.inventory?.box ?? [])];
  try {
    const res = await apiFetch('npcAct', { body: { npcId, action, ...(amount !== undefined ? { amount } : {}) } });
    useSessionStore.getState().applyInventoryDelta(toInventoryDelta({ money: res.money, creaturesAdded: res.creaturesAdded, creaturesRemoved: res.creaturesRemoved }));
    const nameOf = (c: { readonly nickname: string | null; readonly speciesId: string }): string => c.nickname ?? speciesName(c.speciesId);
    switch (action) {
      case 'giveMoney':
        toast('success', `${name} gave you ${res.amount} money.`);
        return `${name} gave the traveller ${res.amount} coins.`;
      case 'takeMoney':
        toast('danger', `${name} took ${res.amount} money from you.`);
        return `${name} took ${res.amount} coins from the traveller.`;
      case 'giveCreature': {
        const got = res.creaturesAdded[0];
        const label = got === undefined ? 'an Ewamon' : `${nameOf(got)} (Lv ${got.level})`;
        toast('success', `${name} gave you ${label}.`);
        return `${name} gave the traveller an Ewamon: ${got === undefined ? 'a creature' : nameOf(got)}.`;
      }
      case 'takeCreature': {
        const lost = before.find((c) => c.id === res.creaturesRemoved[0]);
        toast('danger', `${name} took ${lost === undefined ? 'one of your Ewamon' : nameOf(lost)}!`);
        return `${name} took an Ewamon from the traveller: ${lost === undefined ? 'a creature' : nameOf(lost)}.`;
      }
    }
  } catch (e) {
    const code = isApiFailure(e) ? e.error.code : '';
    toast('info', REFUSED[code]?.(name) ?? `${name} could not do that.`);
    return REFUSED_TALK[code]?.(name) ?? `${name} tried something, but it did not work.`;
  }
}

const REFUSED: Readonly<Record<string, (n: string) => string>> = {
  npcPurseEmpty: (n) => `${n}'s purse is empty.`,
  playerBroke: () => 'You have no money to take.',
  npcNoCreature: (n) => `${n} has no Ewamon to give.`,
  npcCannotTake: (n) => `${n} cannot take any of your Ewamon (your last one, or all locked).`,
  npcNotHere: (n) => `${n} cannot do that from here.`,
  npcToolsOff: () => 'NPC actions are off on this server.',
};

/** The refusals as the talk pass hears them. */
const REFUSED_TALK: Readonly<Record<string, (n: string) => string>> = {
  npcPurseEmpty: (n) => `${n} wanted to give money, but had none left.`,
  playerBroke: (n) => `${n} wanted to take money, but the traveller had none.`,
  npcNoCreature: (n) => `${n} had no Ewamon left to give.`,
  npcCannotTake: (n) => `${n} tried to take an Ewamon, but could not.`,
};

/**
 * Back to the scripted lines, keeping the conversation: what is in flight is aborted (a line still waiting for its
 * answer is dropped, so the history stays turn-taking) and the microphone released.
 */
export function leaveTalk(): void {
  inflight?.abort();
  inflight = null;
  starting = null;
  releaseMic();
  const turns = useVoiceTalkStore.getState().turns;
  set({ phase: 'idle', partial: '', error: null, hidden: true, turns: turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns });
}

export function endTalk(): void {
  inflight?.abort();
  inflight = null;
  starting = null;
  persona = null;
  releaseMic();
  useVoiceTalkStore.setState(IDLE);
}

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') return 'No access to the microphone. Allow it in the browser.';
  if (name === 'NotFoundError') return 'No microphone found.';
  return 'The microphone does not start.';
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
