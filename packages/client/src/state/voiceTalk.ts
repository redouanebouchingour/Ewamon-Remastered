/**
 * NPC talk: the conversation the DialogueBox shows over an NPC's lines. Press C and type (`sendText`), or hit the NPC
 * with H / K (`hitNpc`); the line goes to the local model and the reply streams in.
 * One conversation per open dialogue (E on a person starts a new one): every typed line and hit while it stays open
 * is added to it. `leaveTalk` (Back / Enter / E) shows the scripted lines again and keeps the conversation, so the next
 * line resumes it; `endTalk` (dialogue closed or target changed) drops it. Both abort the reply in flight; only
 * `endTalk` stops the tool passes still running (what the NPC said, it still does).
 *
 * After each reply the tool pass picks what the NPC does (`voice/npcChat`) in the background: the player can talk
 * again as soon as the words are in. Tool passes run one at a time, in order, and what one did lands on its own reply.
 * A slap or a kick plays in the world (`state/npcFx`); money and Ewamon go through `POST /npc/act`, which checks the NPC stands in the player's zone and
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

export type TalkPhase = 'idle' | 'thinking' | 'replying';

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

let inflight: AbortController | null = null;
/** the tool passes of this conversation, run one after another in the background; `endTalk` aborts them */
let tools = new AbortController();
let toolQueue: Promise<void> = Promise.resolve();

/** Joins (or starts, when the target changed) the conversation with `targetId`; false while a reply is on its way. */
function join(targetId: string): boolean {
  const st = useVoiceTalkStore.getState();
  if (st.targetId !== targetId) {
    endTalk();
    set({ targetId });
    return true;
  }
  if (st.phase !== 'idle') return false;
  if (st.hidden) set({ hidden: false });
  return true;
}

/**
 * The player hits the NPC (H / K): the strike plays (the burst at contact), then the NPC answers it like a line —
 * angry words, and the tool pass may hit back. No-op while a reply is on its way.
 */
export function hitNpc(targetId: string, p: NpcPersona, kind: StrikeKind): void {
  if (!join(targetId)) return;
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

/** Typed chat (C). No-op while a reply is on its way. */
export function sendText(targetId: string, p: NpcPersona, text: string): void {
  const said = text.trim();
  if (said === '' || !join(targetId)) return;
  const ac = new AbortController();
  inflight = ac;
  set({ error: null });
  void answer(p, { role: 'user', content: said }, ac).finally(() => {
    if (inflight === ac) inflight = null;
  });
}

/**
 * Adds what the player said and streams the NPC's answer (talk pass); the phase is `idle` again once the words are in,
 * so the next line can go while the tool pass judges this exchange in the background (`judgeInBackground`).
 */
async function answer(p: NpcPersona, said: ChatTurn, ac: AbortController): Promise<void> {
  const turns = [...useVoiceTalkStore.getState().turns, said];
  set({ turns, phase: 'thinking', partial: '' });
  let reply: string;
  try {
    reply = await streamNpcReply(p, turns, (text) => set({ phase: 'replying', partial: text }), ac.signal);
  } catch (e) {
    if (ac.signal.aborted) return;
    return set({ phase: 'idle', partial: '', error: `The language model did not answer (is Llama.cpp running on port 1234?): ${message(e)}` });
  }
  if (ac.signal.aborted) return;
  const spoken: ChatTurn = { role: 'assistant', content: reply === '' ? '…' : reply };
  set({ turns: [...turns, spoken], partial: '', phase: 'idle' });
  judgeInBackground(p, [...turns, spoken], spoken);
}

/**
 * The tool pass for one exchange, queued behind the earlier ones (hits play and money moves in the order the NPC said
 * them). What it did is written onto `spoken` (found by identity: newer turns may follow it by then), so later talk
 * passes hear it as the scene so far.
 */
function judgeInBackground(p: NpcPersona, exchange: readonly ChatTurn[], spoken: ChatTurn): void {
  const signal = tools.signal;
  const npcId = targetOf();
  toolQueue = toolQueue.then(async () => {
    if (signal.aborted) return;
    try {
      const calls = await judgeExchange(p, exchange, NPC_MONEY_MAX, signal);
      if (signal.aborted) return;
      const events = await runTools(npcId, p.name, calls);
      if (signal.aborted || events.length === 0) return;
      const now = useVoiceTalkStore.getState().turns;
      const i = now.indexOf(spoken);
      if (i >= 0) set({ turns: [...now.slice(0, i), { ...spoken, events }, ...now.slice(i + 1)] });
    } catch (e) {
      if (signal.aborted) return;
      set({ error: `The tool pass did not answer (is ${TOOL_MODEL} loaded in Llama.cpp?): ${message(e)}` });
    }
  });
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
 * (a toast each; a refusal is toasted and told to the talk pass as what happened). Returns the events, in English,
 * addressed to the NPC ("You slapped the traveller.") so the talk pass keeps speaking as itself.
 */
export async function runTools(npcId: string, name: string, calls: readonly ToolCall[]): Promise<string[]> {
  const events: string[] = [];
  const ordered = [...calls].sort((a, b) => Number(b.name === SLAP || b.name === KICK) - Number(a.name === SLAP || a.name === KICK));
  for (const c of ordered) {
    if (c.name === SLAP || c.name === KICK) {
      await strike(c.name === SLAP ? 'slap' : 'kick', npcId);
      events.push(c.name === SLAP ? 'You slapped the traveller.' : 'You kicked the traveller.');
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
        return `You gave the traveller ${res.amount} coins.`;
      case 'takeMoney':
        toast('danger', `${name} took ${res.amount} money from you.`);
        return `You took ${res.amount} coins from the traveller.`;
      case 'giveCreature': {
        const got = res.creaturesAdded[0];
        const label = got === undefined ? 'an Ewamon' : `${nameOf(got)} (Lv ${got.level})`;
        toast('success', `${name} gave you ${label}.`);
        return `You gave the traveller an Ewamon: ${got === undefined ? 'a creature' : nameOf(got)}.`;
      }
      case 'takeCreature': {
        const lost = before.find((c) => c.id === res.creaturesRemoved[0]);
        toast('danger', `${name} took ${lost === undefined ? 'one of your Ewamon' : nameOf(lost)}!`);
        return `You took an Ewamon from the traveller: ${lost === undefined ? 'a creature' : nameOf(lost)}.`;
      }
    }
  } catch (e) {
    const code = isApiFailure(e) ? e.error.code : '';
    toast('info', REFUSED[code]?.(name) ?? `${name} could not do that.`);
    return REFUSED_TALK[code] ?? 'You tried something, but it did not work.';
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

/** The refusals as the talk pass hears them (addressed to the NPC, like every event). */
const REFUSED_TALK: Readonly<Record<string, string>> = {
  npcPurseEmpty: 'You wanted to give money, but had none left.',
  playerBroke: 'You wanted to take money, but the traveller had none.',
  npcNoCreature: 'You had no Ewamon left to give.',
  npcCannotTake: 'You tried to take an Ewamon, but could not.',
};

/**
 * Back to the scripted lines, keeping the conversation: what is in flight is aborted (a line still waiting for its
 * answer is dropped, so the history stays turn-taking).
 */
export function leaveTalk(): void {
  inflight?.abort();
  inflight = null;
  const turns = useVoiceTalkStore.getState().turns;
  set({ phase: 'idle', partial: '', error: null, hidden: true, turns: turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns });
}

export function endTalk(): void {
  inflight?.abort();
  inflight = null;
  tools.abort();
  tools = new AbortController();
  toolQueue = Promise.resolve();
  useVoiceTalkStore.setState(IDLE);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
