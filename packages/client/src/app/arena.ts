/**
 * Arena PvP — the client flow around the server's arena (protocol arena.ts): the PvP screen's REST calls, the arena
 * messages (`arenaStatus` / `arenaInvite` / `arenaInviteResult` / `arenaState`, routed here by the message router), the
 * session switch (`WorldSession.enterArena` on a match / a training / an accepted invite, `returnToWorld` from the
 * arena's result actions or a cancelled match) and the arena store (state/arena.ts).
 *
 * One queue at a time (the server's), seen everywhere: the PvP screen, the top bar's queue chip and the arena's own
 * result actions (Queue again). A match found anywhere moves the player into the arena after a short "Match found"
 * card; panels close (the arena battle owns the screen).
 */
import { ARENA_KIND_LABELS } from '@ewa/protocol';
import type { ArenaDifficulty, ArenaMode, ArenaRules, ArenaStatus, SeatReservation, ServerMessage } from '@ewa/protocol';
import { ApiFailure, apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import type { ArenaRoom, WorldSession } from '../net/WorldSession';
import { getWorldSession } from '../net/WorldSession';
import { arenaStatusText, inviteResultText, MATCH_FOUND_MS, useArenaStore } from '../state/arena';
import type { ArenaLast } from '../state/arena';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import { navigateTo } from './navigation';

/** The session slice the flow drives (tests pass a fake). */
export type ArenaSession = Pick<WorldSession, 'enterArena' | 'returnToWorld' | 'kind' | 'selfId'>;

/** How long a cancelled arena's toast stays before the player is sent back. */
export const CANCEL_RETURN_MS = 1200;

const ARENA_ERRORS: Readonly<Record<string, string>> = {
  busy: 'Finish your battle, trade or raid first.',
  inBattle: 'Finish your battle first.',
  party: 'You need a creature in your party to battle.',
  noParty: 'You need a creature in your party to battle.',
  inArena: 'You are already in the arena.',
  notFriends: 'You can only challenge a friend.',
  self: 'You cannot challenge yourself.',
  friendOffline: 'That friend is not online.',
  friendBusy: 'That friend is busy right now.',
  // every arena route needs presence (a zone or arena room)
  offline: 'Connect to the world first.',
  expired: 'That invite has expired.',
  NotFound: 'That invite is no longer open.',
};

/** REST failure copy: the server's `detail` when it explains (e.g. the cup rule), else the arena / shared copy. */
export function arenaErrorText(e: unknown): string {
  if (e instanceof ApiFailure) {
    const { code, detail } = e.error;
    if (code === 'cup' && detail !== null && detail.length > 0) return detail;
    const own = ARENA_ERRORS[code];
    if (own !== undefined) return own;
  }
  return describeError(e);
}

async function guarded<T>(run: () => Promise<T>): Promise<T | null> {
  const st = useArenaStore.getState();
  if (st.busy) return null;
  st.setBusy(true);
  try {
    return await run();
  } catch (e) {
    toast('warn', arenaErrorText(e));
    return null;
  } finally {
    useArenaStore.getState().setBusy(false);
  }
}

/** GET /arena → the PvP screen's data and the queue state. */
export async function loadArena(signal?: AbortSignal): Promise<void> {
  const res = await apiFetch('arena', signal === undefined ? {} : { signal });
  const { status, ...info } = res;
  useArenaStore.getState().setInfo(info, status as ArenaStatus);
}

/** Into the arena of `seat` (panels close: the arena battle owns the screen). */
export function goToArena(seat: SeatReservation, ws: Pick<WorldSession, 'enterArena'> = getWorldSession()): Promise<void> {
  navigateTo('/play');
  return ws.enterArena(seat).catch((e: unknown) => {
    console.error('arena entry failed', e);
  });
}

export async function queueArena(mode: ArenaMode): Promise<void> {
  const res = await guarded(() => apiFetch('arenaQueue', { body: { mode } }));
  if (res === null) return;
  useArenaStore.getState().setLast({ kind: 'queue', mode });
  applyStatus(res, getWorldSession());
}

export async function leaveArenaQueue(): Promise<void> {
  const res = await guarded(() => apiFetch('arenaQueueLeave', { body: {} }));
  if (res !== null) useArenaStore.getState().applyStatus(res);
}

export async function startTraining(rules: ArenaRules, difficulty: ArenaDifficulty): Promise<void> {
  const res = await guarded(() => apiFetch('arenaTraining', { body: { rules, difficulty } }));
  if (res === null) return;
  useArenaStore.getState().setLast({ kind: 'training', rules, difficulty });
  await goToArena(res.seat);
}

export async function inviteFriend(username: string, rules: ArenaRules): Promise<void> {
  const res = await guarded(() => apiFetch('arenaInvite', { body: { username, rules } }));
  if (res === null) return;
  useArenaStore.getState().setLast({ kind: 'friend', username, rules });
  useArenaStore.getState().setOutgoing({ inviteId: res.inviteId, toName: username, rules, expiresAt: res.expiresAt, state: 'pending' });
  toast('info', `Invite sent to ${username}.`);
}

/** The invitee's answer; an accept moves them into the arena. */
export async function replyInvite(accept: boolean): Promise<void> {
  const inv = useArenaStore.getState().invite;
  if (inv === null) return;
  useArenaStore.getState().setInvite(null);
  try {
    const res = await apiFetch('arenaInviteReply', { body: { inviteId: inv.inviteId, accept } });
    if (accept && res.seat !== null) {
      useArenaStore.getState().setLast({ kind: 'friend', username: inv.fromName, rules: inv.rules });
      await goToArena(res.seat);
    } else if (accept) toast('info', 'That battle could not start.');
  } catch (e) {
    if (accept) toast('warn', arenaErrorText(e));
  }
}

/** The arena's "Back to world": leave the arena room, enter the zone the player left. */
export async function backToWorld(ws: Pick<WorldSession, 'returnToWorld'> = getWorldSession()): Promise<void> {
  const ui = useUiStore.getState();
  // a result card still up (a cancelled arena, a closed room): the battle view is dropped with the arena
  if (ui.battle !== null && ui.battle.result !== null) useUiStore.getState().setBattle(null);
  await ws.returnToWorld().catch((e: unknown) => console.error('arena return failed', e));
}

/** The arena's "Queue again" (same mode) / "Rematch" (same training) / a friend battle's "Invite again". */
export async function playAgain(last: ArenaLast | null = useArenaStore.getState().last): Promise<void> {
  if (last === null) return;
  if (last.kind === 'queue') await queueArena(last.mode);
  else if (last.kind === 'training') await startTraining(last.rules, last.difficulty);
  else await inviteFriend(last.username, last.rules);
}

// ---- messages ----------------------------------------------------------------------------------------------------

function applyStatus(s: ArenaStatus, ws: ArenaSession): void {
  const st = useArenaStore.getState();
  const before = st.status.state;
  st.applyStatus(s);
  if (s.state === 'matched' && s.seat !== null) {
    st.setMatchFound({ kind: s.kind ?? 'standard', opponent: s.opponent, at: Date.now() });
    setTimeout(() => {
      const cur = useArenaStore.getState().matchFound;
      if (cur !== null && Date.now() - cur.at >= MATCH_FOUND_MS - 50) useArenaStore.getState().setMatchFound(null);
    }, MATCH_FOUND_MS);
    void goToArena(s.seat, ws);
    return;
  }
  // one toast per change worth telling (a repeated `queued` is silent)
  if (s.state === before && s.state !== 'idle') return;
  const t = arenaStatusText(s);
  if (t !== null && s.state !== 'matched') toast(t.level, t.text);
}

/** The arena half of the message router. Returns true when `m` was an arena message. */
export function routeArenaMessage(m: ServerMessage, ws: ArenaSession): boolean {
  switch (m.type) {
    case 'arenaStatus': {
      const { type: _t, ...status } = m;
      applyStatus(status, ws);
      return true;
    }
    case 'arenaInvite':
      useArenaStore.getState().setInvite({ inviteId: m.inviteId, fromId: m.fromId, fromName: m.fromName, rules: m.rules, expiresAt: m.expiresAt });
      return true;
    case 'arenaInviteResult': {
      const out = useArenaStore.getState().outgoing;
      if (out !== null && out.inviteId === m.inviteId) useArenaStore.getState().setOutgoing({ ...out, state: m.result });
      toast(m.result === 'declined' ? 'info' : 'warn', inviteResultText(m.toName, m.result));
      return true;
    }
    case 'arenaState': {
      const { type: _t, ...match } = m;
      const st = useArenaStore.getState();
      const prev = st.match;
      st.setMatch(match);
      // a new arena: forget the last one's outcome; fetch the opponent's look for the foe trainer
      if (prev === null || prev.matchId !== match.matchId) {
        st.setOutcome(null);
        st.setBattleId(null);
        for (const p of match.players) if (p.playerId !== ws.selfId) void fetchBody(p.playerId, p.name);
      }
      if (match.phase === 'cancelled' && (prev === null || prev.phase !== 'cancelled')) {
        toast('info', cancelText(match.reason));
        setTimeout(() => {
          if (useArenaStore.getState().match?.matchId === match.matchId && ws.kind === 'arena') void backToWorld(ws);
        }, CANCEL_RETURN_MS);
      }
      return true;
    }
    case 'battleStart':
    case 'battleResync':
    case 'battleEvents':
      // the arena battle's id (a scene built after the rejoin asks for a resync with it); the scene plays these
      if (useArenaStore.getState().inArena && useArenaStore.getState().battleId !== m.battleId) useArenaStore.getState().setBattleId(m.battleId);
      return false;
    case 'battleEnd': {
      // the outcome for the arena's result actions (the battle controller shows the card itself)
      if (!useArenaStore.getState().inArena) return false;
      const b = useUiStore.getState().battle;
      const w = m.outcome.winner;
      const seat = b !== null && b.battleId === m.battleId ? b.seat : null;
      const won = typeof w === 'number' && seat !== null ? w === seat : null;
      useArenaStore.getState().setOutcome({ battleId: m.battleId, won, ratingDelta: m.rewards.ratingDelta });
      return false; // the scene still plays it
    }
    default:
      return false;
  }
}

export function cancelText(reason: string | null): string {
  switch (reason) {
    case 'noShow':
      return 'Your opponent never arrived. Back to the world.';
    case 'left':
      return 'Your opponent left before the battle. Back to the world.';
    case 'party':
    case 'cup':
      return 'A party no longer met the rules. Back to the world.';
    default:
      return 'The arena battle was cancelled. Back to the world.';
  }
}

async function fetchBody(playerId: string, name: string): Promise<void> {
  if (useArenaStore.getState().bodies[playerId] !== undefined) return;
  try {
    const p = await apiFetch('playerPublic', { params: { username: name.toLowerCase() } });
    useArenaStore.getState().setBody(playerId, p.body);
  } catch (_e) {
    // the generic trainer look stands in
  }
}

/**
 * The session side: the arena store follows `onArena`, and an arena that closed under the player before its battle
 * ended (a server restart, a dead socket) sends them back to the world.
 */
export function installArenaFlow(ws: Pick<WorldSession, 'onArena' | 'returnToWorld'>): () => void {
  return ws.onArena((room: ArenaRoom | null, inArena: boolean, closed: boolean) => {
    const st = useArenaStore.getState();
    if (inArena && !st.inArena) st.setInArena(true);
    if (!inArena) {
      if (st.inArena) st.setInArena(false);
      return;
    }
    if (room !== null || !closed) return;
    const m = useArenaStore.getState().match;
    if (useArenaStore.getState().outcome !== null || m?.phase === 'ended' || m?.phase === 'cancelled') return;
    toast('warn', 'The arena closed. Back to the world.');
    void backToWorld(ws);
  });
}

/** "Level 50 Ranked" style label for a kind (+ its level). */
export function arenaTitle(kind: ArenaMode | 'friend' | 'training', level: number | null): string {
  const label = ARENA_KIND_LABELS[kind];
  return level !== null && kind !== 'level50' ? `${label} · Level ${level}` : label;
}
