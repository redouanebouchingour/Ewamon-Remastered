/**
 * Arena PvP (protocol arena.ts) — the out-of-world PvP as the client sees it: the PvP screen's data (GET /arena), the
 * one queue (`arenaStatus`), the arena the player is in (`arenaState`, the outcome of its battle), a friend's invite
 * and the player's own outgoing invite, and the short "Match found" card. Written by the message router and the arena
 * flow (app/arena.ts); display state only — every decision is the server's.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ARENA_KIND_LABELS, ARENA_LEVEL } from '@ewa/protocol';
import type { ArenaCupView, ArenaDifficulty, ArenaKind, ArenaMode, ArenaRules, ArenaStatus, ServerMessageOf } from '@ewa/protocol';
import { CUP_PARTY_SIZE, cupRefusal, weeklyCup } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';

/** GET /arena minus the queue status (kept apart: pushes update it). */
export interface ArenaInfo {
  readonly rating: number;
  readonly peakRating: number;
  readonly rankedMatches: number;
  readonly level: number;
  readonly cup: ArenaCupView;
  readonly live: { readonly roomId: string } | null;
}

/** The arena room's `arenaState` minus `type`. */
export type ArenaMatch = Omit<ServerMessageOf<'arenaState'>, 'type'>;

/** What the player started last (Queue again / Rematch repeat it). */
export type ArenaLast =
  | { readonly kind: 'queue'; readonly mode: ArenaMode }
  | { readonly kind: 'training'; readonly rules: ArenaRules; readonly difficulty: ArenaDifficulty }
  | { readonly kind: 'friend'; readonly username: string; readonly rules: ArenaRules };

/** The arena battle's end as the player saw it (`battleEnd` in the arena). */
export interface ArenaOutcome {
  readonly battleId: string;
  /** true won, false lost, null no winner (a draw) */
  readonly won: boolean | null;
  readonly ratingDelta: number | null;
}

export interface ArenaInviteUi {
  readonly inviteId: string;
  readonly fromId: string;
  readonly fromName: string;
  readonly rules: ArenaRules;
  /** unix ms */
  readonly expiresAt: number;
}

export interface OutgoingInvite {
  readonly inviteId: string;
  readonly toName: string;
  readonly rules: ArenaRules;
  readonly expiresAt: number;
  readonly state: 'pending' | 'declined' | 'expired' | 'unavailable';
}

export interface MatchFound {
  readonly kind: ArenaKind;
  readonly opponent: { readonly name: string; readonly rating: number } | null;
  readonly at: number;
}

export const IDLE_STATUS: ArenaStatus = { state: 'idle', kind: null, waitedMs: 0, window: 0, opponent: null, seat: null, reason: null, detail: null };
/** How long the "Match found" card stays up (the arena join runs under it). */
export const MATCH_FOUND_MS = 2600;

export interface ArenaUi {
  readonly info: ArenaInfo | null;
  readonly status: ArenaStatus;
  /** Date.now() the player joined the queue (receipt − waitedMs); 0 when not queued */
  readonly queuedAt: number;
  /** the session is in an arena (from `enterArena` until the return) */
  readonly inArena: boolean;
  readonly match: ArenaMatch | null;
  readonly outcome: ArenaOutcome | null;
  readonly last: ArenaLast | null;
  readonly invite: ArenaInviteUi | null;
  readonly outgoing: OutgoingInvite | null;
  readonly matchFound: MatchFound | null;
  /** an arena request in flight (queue, training, invite, return) */
  readonly busy: boolean;
  /**
   * the arena battle's id as last seen by the message router (battleStart / battleResync / battleEvents): the scene,
   * built after a reload's rejoin, asks for a `battleResync` with it when the server's arrived before it existed
   */
  readonly battleId: string | null;
  /** the opponents' bodies by player id (GET /players/:name, for the foe trainer in the arena) */
  readonly bodies: Readonly<Record<string, string>>;
  setInfo(i: ArenaInfo, status?: ArenaStatus, now?: number): void;
  applyStatus(s: ArenaStatus, now?: number): void;
  setInArena(on: boolean): void;
  setMatch(m: ArenaMatch | null): void;
  setOutcome(o: ArenaOutcome | null): void;
  setLast(l: ArenaLast | null): void;
  setInvite(i: ArenaInviteUi | null): void;
  setOutgoing(o: OutgoingInvite | null): void;
  setMatchFound(m: MatchFound | null): void;
  setBusy(b: boolean): void;
  setBody(playerId: string, body: string): void;
  setBattleId(id: string | null): void;
  reset(): void;
}

const INITIAL = {
  info: null,
  status: IDLE_STATUS,
  queuedAt: 0,
  inArena: false,
  match: null,
  outcome: null,
  last: null,
  invite: null,
  outgoing: null,
  matchFound: null,
  busy: false,
  bodies: {},
  battleId: null,
} as const;

export const useArenaStore = create<ArenaUi>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL,
    setInfo(info, status, now = Date.now()) {
      set({ info });
      if (status !== undefined) get().applyStatus(status, now);
    },
    applyStatus(status, now = Date.now()) {
      // the seat is consumed once (the router hands it to the session); the store keeps the rest
      set({ status: { ...status, seat: null }, queuedAt: status.state === 'queued' ? now - status.waitedMs : 0 });
    },
    setInArena: (inArena) => set(inArena ? { inArena } : { inArena, match: null, outcome: null, battleId: null }),
    setMatch: (match) => set({ match }),
    setOutcome: (outcome) => set({ outcome }),
    setLast: (last) => set({ last }),
    setInvite: (invite) => set({ invite }),
    setOutgoing: (outgoing) => set({ outgoing }),
    setMatchFound: (matchFound) => set({ matchFound }),
    setBusy: (busy) => set({ busy }),
    setBody: (playerId, body) => set({ bodies: { ...get().bodies, [playerId]: body } }),
    setBattleId: (battleId) => set({ battleId }),
    reset: () => set({ ...INITIAL }),
  })),
);

// ---- pure helpers (screen copy, gates) -------------------------------------------------------------------------

/** Toast copy for a queue status change (null = no toast). */
export function arenaStatusText(s: ArenaStatus): { readonly level: 'info' | 'success' | 'warn'; readonly text: string } | null {
  if (s.state === 'matched') {
    const what = s.kind === null ? 'Match' : `${ARENA_KIND_LABELS[s.kind]} match`;
    return { level: 'success', text: s.opponent !== null ? `${what} found: ${s.opponent.name}. Heading to the arena.` : `${what} found. Heading to the arena.` };
  }
  if (s.state !== 'idle') return null;
  switch (s.reason) {
    case 'busy':
      return { level: 'warn', text: 'Finish your battle, trade or raid before queueing.' };
    case 'party':
      return { level: 'warn', text: 'You need a creature in your party to battle.' };
    case 'cup':
      return { level: 'warn', text: s.detail ?? 'Your party does not meet this week’s cup rule.' };
    case 'cancelled':
      return { level: 'info', text: 'The match fell through. You can queue again.' };
    case 'timeout':
      return { level: 'info', text: 'No opponent found in time. You left the queue.' };
    default:
      // left / started: silent
      return null;
  }
}

/** The copy for an invite's fate (to the inviter). */
export function inviteResultText(toName: string, result: 'declined' | 'expired' | 'unavailable'): string {
  if (result === 'declined') return `${toName} declined your battle.`;
  if (result === 'expired') return `${toName} did not answer in time.`;
  return `${toName} cannot battle right now.`;
}

/** The level line of a kind / rules ("Level 50" or "Own levels"). */
export function levelLabel(level: number | null): string {
  return level === null ? 'Own levels' : `Level ${level}`;
}

export const RULES_LABELS: Readonly<Record<ArenaRules, string>> = { standard: 'Own levels', level50: `Level ${ARENA_LEVEL}` };
export const DIFFICULTY_LABELS: Readonly<Record<ArenaDifficulty, string>> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

/** Why the player cannot start any arena battle now (null = they can). Arena teams are healed copies: any creature counts. */
export function arenaBlockReason(o: {
  readonly party: readonly CreatureInstance[] | null;
  readonly inBattle: boolean;
  readonly trading: boolean;
  readonly inArena: boolean;
  readonly connected: boolean;
}): string | null {
  if (o.inArena) return 'You are in the arena.';
  if (o.inBattle) return 'Finish your battle first.';
  if (o.trading) return 'Finish your trade first.';
  if (!o.connected) return 'Not connected to the world.';
  if (o.party !== null && o.party.length === 0) return 'You need a creature in your party.';
  return null;
}

/** Why the party cannot enter this week's cup (content `cupRefusal`, the rule the server enforces), or null. */
export function cupLockReason(party: readonly CreatureInstance[] | null, now: number): string | null {
  const p = party ?? [];
  return cupRefusal(
    p.map((c) => ({ speciesId: c.speciesId, caughtAt: c.caughtAt === null ? null : { zoneId: c.caughtAt.zoneId } })),
    weeklyCup(now),
  );
}

export { CUP_PARTY_SIZE };

/** "3d 4h" / "5h 12m" / "8m" until `endsAt` (ISO). */
export function timeLeft(endsAt: string, now: number): string {
  const ms = Math.max(0, Date.parse(endsAt) - now);
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}
