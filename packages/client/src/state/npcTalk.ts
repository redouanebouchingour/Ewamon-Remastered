/**
 * NPC talk: the conversation the DialogueBox shows over an NPC's lines. Press C and type (`sendText`), or hit the NPC
 * with H / K (`hitNpc`); the line goes to the local model and the reply streams in.
 * One conversation per open dialogue (E on a person starts a new one): every typed line and hit while it stays open
 * is added to it. `leaveTalk` (Back / Enter / E) shows the scripted lines again and keeps the conversation, so the next
 * line resumes it; `endTalk` (dialogue closed or target changed) drops it. Both abort the reply in flight; only
 * `endTalk` stops the tool passes still running (what the NPC said, it still does).
 *
 * After each reply the tool pass picks what the NPC does (`talk/npcChat`) in the background: the player can talk
 * again as soon as the words are in. Tool passes run one at a time, in order, and what one did lands on its own reply.
 * A slap or a kick plays in the world (`state/npcFx`); money and Ewamon go through `POST /npc/act`, which checks the NPC stands in the player's zone and
 * keeps its wallet; the delta lands in the session like any other. A battle (`start_battle`) goes last, through the
 * same route: the zone room opens it, and the dialogue closes so the battle can take the screen.
 *
 * NPC memory (2026-10-24, talk/npcMemory.ts): opening a talkable dialogue (`openTalk`) fetches what the NPC remembers
 * of the player and the town's standing once (`GET /npc/memory`); the first reply waits for it at most
 * `MEMORY_WAIT_MS`, then goes without it. The note it makes is fixed for the conversation. When a conversation with at
 * least one reply ends (`endTalk`), the NPC's summary of it and the talk deeds go to `POST /npc/memory` in the background
 * (the summary call falls back to a templated one), and the answer refreshes the standing shown.
 *
 * NPC side quests (2026-10-24, talk/npcQuest.ts, state/npcQuests.ts): `openTalk` also fetches the NPC's favour
 * (`GET /npc/quests/:npcId`: the open one, and what it would ask now). A typed line may carry the ask (`shouldAsk`:
 * the player asks for work, or their second line to a friendly NPC); the tool pass then stores the offer
 * (`offer_quest` → `POST /npc/quests/offer`). A yes / no to an open offer answers it and "I did it" to an accepted
 * favour hands it in, before the NPC replies, so its reply hears what happened (`nudge`). The card's buttons send those
 * same lines (`acceptQuest`, `declineQuest`, `handInQuest`).
 */
import { create } from 'zustand';
import { NPC_MONEY_MAX } from '@ewa/protocol';
import type { NPC_ACTIONS, NpcMemoryView, NpcQuestState } from '@ewa/protocol';
import { apiFetch, isApiFailure } from '../net/api';
import { speciesName } from '../data/content';
import { GIVE_EWAMON, GIVE_MONEY, KICK, SLAP, START_BATTLE, TAKE_EWAMON, TAKE_MONEY, TOOL_MODEL, challenged, judgeExchange, playerHitTurn, provoked, robbed, streamNpcReply } from '../talk/npcChat';
import type { StrikeKind } from '../scene/npcStrike';
import type { ChatTurn, NpcPersona, ToolCall } from '../talk/npcChat';
import { MEMORY_WAIT_MS, deedsOf, hadExchange, memoryNote, summarize } from '../talk/npcMemory';
import { ACCEPTED, DECLINED, NOT_DONE, OFFER_QUEST, answerOf, askNote, claimedNote, saysDone, shouldAsk } from '../talk/npcQuest';
import { answerNpcQuest, claimNpcQuest, fetchNpcQuest, offerNpcQuest } from './npcQuests';
import { strike } from './npcFx';
import { toast } from './notifications';
import { toInventoryDelta, useSessionStore } from './session';
import { useUiStore } from './ui';

export type TalkPhase = 'idle' | 'thinking' | 'replying';

export interface NpcTalkState {
  /** the dialogue target the conversation belongs to (null = none) */
  readonly targetId: string | null;
  readonly phase: TalkPhase;
  readonly turns: readonly ChatTurn[];
  /** the reply streaming in (shown until it lands in `turns`) */
  readonly partial: string;
  readonly error: string | null;
  /** the player went back to the scripted lines (`leaveTalk`); the conversation is kept and the next line resumes it */
  readonly hidden: boolean;
  /** what the NPC remembers of the player and the town's standing (null until loaded, or without it) */
  readonly memory: NpcMemoryView | null;
  /** NPC side quests: the NPC's favour for the player and what it would ask (null until loaded, or without it) */
  readonly quest: NpcQuestState | null;
}

const IDLE: NpcTalkState = { targetId: null, phase: 'idle', turns: [], partial: '', error: null, hidden: false, memory: null, quest: null };

export const useNpcTalkStore = create<NpcTalkState>()(() => IDLE);

const set = (p: Partial<NpcTalkState>): void => useNpcTalkStore.setState(p);

let inflight: AbortController | null = null;
/** the tool passes of this conversation, run one after another in the background; `endTalk` aborts them */
let tools = new AbortController();
let toolQueue: Promise<void> = Promise.resolve();
/** the memory fetch of this conversation (resolves null without it) */
let memoryReady: Promise<NpcMemoryView | null> = Promise.resolve(null);
/** the note the talk pass reads, fixed at the first reply (undefined = not decided yet) */
let note: string | null | undefined;
/** the NPC as the conversation knows it, for the summary at its end */
let persona: NpcPersona | null = null;
/** the talk pass was told to ask the favour in this conversation (once per conversation) */
let askedQuest = false;

const signedIn = (): boolean => useSessionStore.getState().accessToken !== null;

/**
 * A talkable dialogue opened on `targetId`: the conversation's target is set (nothing shows until the player talks)
 * and what the NPC remembers is fetched once. A target already set is left alone.
 */
export function openTalk(targetId: string): void {
  if (useNpcTalkStore.getState().targetId === targetId) return;
  endTalk();
  set({ targetId });
  if (!signedIn()) return;
  memoryReady = apiFetch('npcMemory', { params: { npcId: targetId } }).then(
    (m) => {
      if (useNpcTalkStore.getState().targetId === targetId) set({ memory: m });
      return m;
    },
    () => null,
  );
  void fetchNpcQuest(targetId).then(
    (q) => {
      if (useNpcTalkStore.getState().targetId === targetId) set({ quest: q });
    },
    () => undefined,
  );
}

/** Joins (or starts, when the target changed) the conversation with `targetId`; false while a reply is on its way. */
function join(targetId: string): boolean {
  const st = useNpcTalkStore.getState();
  if (st.targetId !== targetId) {
    openTalk(targetId);
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
  set({ error: null, phase: 'thinking' });
  void (async () => {
    const turn = await questTurn(targetId, said);
    if (ac.signal.aborted) return;
    await answer(p, turn, ac);
  })().finally(() => {
    if (inflight === ac) inflight = null;
  });
}

/** the lines the favour card's buttons say (they go the way a typed line does) */
export const ACCEPT_LINE = 'Yes, I will do it.';
export const DECLINE_LINE = 'Sorry, not now.';
export const HAND_IN_LINE = 'I did what you asked.';
export const acceptQuest = (targetId: string, p: NpcPersona): void => sendText(targetId, p, ACCEPT_LINE);
export const declineQuest = (targetId: string, p: NpcPersona): void => sendText(targetId, p, DECLINE_LINE);
export const handInQuest = (targetId: string, p: NpcPersona): void => sendText(targetId, p, HAND_IN_LINE);

/**
 * The player's line as a user turn, with what it did to the NPC's favour (talk/npcQuest.ts): a yes / no to an open
 * offer answers it, "I did it" to an accepted favour tries the hand-in, and a line may carry the ask. A server refusal
 * leaves the line as plain talk.
 */
async function questTurn(targetId: string, said: string): Promise<ChatTurn> {
  const plain: ChatTurn = { role: 'user', content: said };
  const { quest: st, memory, turns } = useNpcTalkStore.getState();
  if (st === null || !signedIn()) return plain;
  const open = st.quest;
  try {
    if (open?.status === 'offered') {
      const a = answerOf(said);
      if (a !== null) {
        const q = await answerNpcQuest(open.id, a);
        set({ quest: { ...st, quest: q.status === 'active' ? q : null, next: null } });
        return { ...plain, nudge: a === 'accept' ? ACCEPTED : DECLINED };
      }
    }
    if (open?.status === 'active' && saysDone(said)) {
      if (!open.ready) return { ...plain, nudge: NOT_DONE };
      const { quest } = await claimNpcQuest(targetId);
      set({ quest: { ...st, quest: null, next: null, why: 'cooldown' } });
      // the standing beside the speaker moves with the favour
      void apiFetch('npcMemory', { params: { npcId: targetId } }).then(
        (m) => {
          if (useNpcTalkStore.getState().targetId === targetId) set({ memory: m });
        },
        () => undefined,
      );
      return { ...plain, nudge: claimedNote(quest.objective, quest.reward) };
    }
  } catch (_e) {
    // refused (moved away, already answered, not done after all): the line is just talk
    return plain;
  }
  const userLine = turns.filter((t) => t.role === 'user').length + 1;
  const calm = !provoked(plain) && !robbed(plain) && !challenged(plain);
  if (st.next !== null && shouldAsk({ hasNext: true, asked: askedQuest, feeling: memory?.feeling ?? null, calm, said, userLine })) {
    askedQuest = true;
    return { ...plain, nudge: askNote(st.next), asks: true };
  }
  return plain;
}

/**
 * Adds what the player said and streams the NPC's answer (talk pass); the phase is `idle` again once the words are in,
 * so the next line can go while the tool pass judges this exchange in the background (`judgeInBackground`).
 */
async function answer(p: NpcPersona, said: ChatTurn, ac: AbortController): Promise<void> {
  const turns = [...useNpcTalkStore.getState().turns, said];
  persona = p;
  set({ turns, phase: 'thinking', partial: '' });
  if (note === undefined) {
    // the first reply waits a moment for the memory, then goes without it (the NPC just does not remember)
    const m = await Promise.race([memoryReady, new Promise<null>((r) => setTimeout(() => r(null), MEMORY_WAIT_MS))]);
    if (ac.signal.aborted) return;
    note = memoryNote(m);
  }
  let reply: string;
  try {
    reply = await streamNpcReply(p, turns, (text) => set({ phase: 'replying', partial: text }), ac.signal, note);
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
      const now = useNpcTalkStore.getState().turns;
      const i = now.indexOf(spoken);
      if (i >= 0) set({ turns: [...now.slice(0, i), { ...spoken, events }, ...now.slice(i + 1)] });
    } catch (e) {
      if (signal.aborted) return;
      set({ error: `The tool pass did not answer (is ${TOOL_MODEL} loaded in Llama.cpp?): ${message(e)}` });
    }
  });
}

function targetOf(): string {
  return useNpcTalkStore.getState().targetId ?? '';
}

/** Server actions per tool (slap / kick are client-only). */
const SERVER_ACTION: Readonly<Record<string, (typeof NPC_ACTIONS)[number]>> = {
  [GIVE_MONEY]: 'giveMoney',
  [TAKE_MONEY]: 'takeMoney',
  [GIVE_EWAMON]: 'giveCreature',
  [TAKE_EWAMON]: 'takeCreature',
  [START_BATTLE]: 'battle',
};

/**
 * Plays the tool calls: the hits first (each waits for contact), then the save-touching ones through `POST /npc/act`
 * (a toast each; a refusal is toasted and told to the talk pass as what happened), the battle last (it ends the talk). Returns the events, in English,
 * addressed to the NPC ("You slapped the traveller.") so the talk pass keeps speaking as itself.
 */
export async function runTools(npcId: string, name: string, calls: readonly ToolCall[]): Promise<string[]> {
  const events: string[] = [];
  const rank = (c: ToolCall): number => (c.name === SLAP || c.name === KICK ? 0 : c.name === START_BATTLE ? 2 : 1);
  const ordered = [...calls].sort((a, b) => rank(a) - rank(b));
  for (const c of ordered) {
    if (c.name === SLAP || c.name === KICK) {
      await strike(c.name === SLAP ? 'slap' : 'kick', npcId);
      events.push(c.name === SLAP ? 'You slapped the traveller.' : 'You kicked the traveller.');
      continue;
    }
    if (c.name === OFFER_QUEST) {
      events.push(await offer(npcId));
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
      case 'battle':
        // the zone room opens the battle; the dialogue makes way (closing it ends the talk)
        useUiStore.getState().setDialogue(null);
        return 'You started an Ewamon battle with the traveller.';
    }
  } catch (e) {
    const code = isApiFailure(e) ? e.error.code : '';
    toast('info', REFUSED[code]?.(name) ?? `${name} could not do that.`);
    return REFUSED_TALK[code] ?? 'You tried something, but it did not work.';
  }
}

/** The NPC asked a favour: the server stores the offer and the dialogue shows it (Accept / Decline). */
async function offer(npcId: string): Promise<string> {
  try {
    const st = await offerNpcQuest(npcId);
    if (useNpcTalkStore.getState().targetId === npcId) set({ quest: st });
    return 'You asked the traveller for a favour and wait for their answer.';
  } catch (_e) {
    return 'You thought of asking the traveller for a favour, but let it go.';
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
  const turns = useNpcTalkStore.getState().turns;
  set({ phase: 'idle', partial: '', error: null, hidden: true, turns: turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns });
}

export function endTalk(): void {
  inflight?.abort();
  inflight = null;
  tools.abort();
  tools = new AbortController();
  toolQueue = Promise.resolve();
  const { targetId, turns } = useNpcTalkStore.getState();
  if (targetId !== null && persona !== null && hadExchange(turns) && signedIn()) void remember(targetId, persona, turns);
  memoryReady = Promise.resolve(null);
  note = undefined;
  persona = null;
  askedQuest = false;
  useNpcTalkStore.setState(IDLE);
}

/**
 * The NPC keeps the conversation: its summary (the model's, else a templated one) and the talk deeds go to the server,
 * which caps the standing change. In the background; a failure is dropped (the NPC just forgets this one).
 */
async function remember(npcId: string, p: NpcPersona, turns: readonly ChatTurn[]): Promise<void> {
  try {
    const summary = await summarize(p, turns);
    const m = await apiFetch('npcMemoryWrite', { body: { npcId, summary, deeds: deedsOf(turns) } });
    if (useNpcTalkStore.getState().targetId === npcId) set({ memory: m });
  } catch (_e) {
    // the server refused (another zone, rate limit, NPC actions off) or is unreachable: nothing to remember
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
