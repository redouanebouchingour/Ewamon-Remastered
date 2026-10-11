/**
 * Arena PvP lobby (protocol arena.ts) — everything about an arena battle before its room exists: the queue
 * (`ArenaQueue`) and its match step, friend invites, AI training, the reload rejoin, the busy rules, and the pushes.
 *
 * Pushes reach the player wherever they are through the per-player presence topic `ewa:arena:<playerId>` (payload: a
 * ServerMessage); the zone room and the arena room holding the player forward it (ZoneRoom.subscribePlayer,
 * ArenaRoom). A match creates an `arena` room (rooms/ArenaRoom.ts) with the server ticket, reserves one seat per human,
 * and hands each player their seat (`arenaStatus matched` / the REST response).
 *
 * Busy (may neither queue, be matched, invite nor be invited): presence battleId or tradeId set (an in-world battle,
 * a raid fight, a trade), or seated in an arena room still `waiting` / `fighting`. Online = any presence.
 */
import { randomUUID } from 'node:crypto';
import { ARENA_TRAINING, cupRefusal, weeklyCup } from '@ewa/content';
import type { ActiveCup } from '@ewa/content';
import { ARENA_INVITE_TTL_MS, arenaLevel, rankedWindow } from '@ewa/protocol';
import type { ArenaCupView, ArenaDifficulty, ArenaIdleReason, ArenaKind, ArenaMode, ArenaRules, ArenaSeatView, ArenaStatus, SeatReservation, ServerMessage } from '@ewa/protocol';
import type { CreatureInstance } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import type { Logger } from '../log';
import { ArenaQueue, arenaTopic } from './arenaQueue';
import type { ArenaEntry, ArenaKV } from './arenaQueue';
import { openArenaRoom, reserveArenaSeat, zoneRoomById } from './matchmaking';
import type { ArenaMatch } from './matchmaking';
import type { PresenceMirror } from './presenceMirror';

/** The phases in which an arena room still holds its players (a reload rejoins it; they are busy). */
export const ARENA_LIVE_PHASES: readonly string[] = ['waiting', 'fighting'];

/** The arena room's listing metadata (rooms/ArenaRoom.ts `setMetadata`). */
export interface ArenaMeta {
  readonly matchId: string;
  readonly kind: ArenaKind;
  readonly phase: string;
}

export function arenaInviteKey(inviteId: string): string {
  return `ewa:arena:invite:${inviteId}`;
}

export interface ArenaInvite {
  readonly inviteId: string;
  readonly fromId: string;
  readonly fromName: string;
  readonly fromRating: number;
  readonly toId: string;
  readonly toName: string;
  readonly rules: ArenaRules;
  /** server clock ms */
  readonly expiresAt: number;
}

export type LobbyKV = ArenaKV & { del(key: string): unknown };

export interface ArenaLobbyDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly clock: () => number;
  readonly log: Logger;
  readonly presenceMirror: PresenceMirror;
  readonly ticket: string;
}

// ---- status shapes ---------------------------------------------------------------------------------------------

export function idleStatus(reason: ArenaIdleReason | null, detail: string | null = null): ArenaStatus {
  return { state: 'idle', kind: null, waitedMs: 0, window: 0, opponent: null, seat: null, reason, detail };
}

export function queuedStatus(mode: ArenaMode, entry: ArenaEntry, now: number): ArenaStatus {
  const waitedMs = Math.max(0, now - entry.joinedAt);
  return { state: 'queued', kind: mode, waitedMs, window: mode === 'ranked' ? rankedWindow(waitedMs) : 0, opponent: null, seat: null, reason: null, detail: null };
}

export function matchedStatus(kind: ArenaKind, seat: SeatReservation, opponent: ArenaSeatView | null): ArenaStatus {
  return { state: 'matched', kind, waitedMs: 0, window: 0, opponent: opponent === null ? null : { name: opponent.name, rating: opponent.rating }, seat, reason: null, detail: null };
}

export function statusMsg(s: ArenaStatus): ServerMessage {
  return { type: 'arenaStatus', ...s };
}

/** The cup on show (ISO end, the featured zone filled into the description). */
export function cupView(cup: ActiveCup): ArenaCupView {
  return { id: cup.def.id, name: cup.def.name, description: cup.description.slice(0, 200), endsAt: new Date(cup.endsAt).toISOString() };
}

/**
 * Why `party` may not enter a battle of `kind` (`party`: no creature at all — arena copies are healed, so a fainted
 * party still fights; `cup`: this week's rule, with the sentence in `detail`), or null.
 */
export function arenaRefusal(party: readonly CreatureInstance[], kind: ArenaKind, now: number): { readonly reason: 'party' | 'cup'; readonly detail: string | null } | null {
  if (party.length === 0) return { reason: 'party', detail: null };
  if (kind === 'cup') {
    const why = cupRefusal(party.slice(0, 6), weeklyCup(now));
    if (why !== null) return { reason: 'cup', detail: why.slice(0, 200) };
  }
  return null;
}

export class ArenaLobby {
  readonly queue: ArenaQueue;
  private readonly inviteTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly kv: LobbyKV,
    private readonly deps: ArenaLobbyDeps,
  ) {
    this.queue = new ArenaQueue(kv, {
      clock: deps.clock,
      isOnline: async (playerId) => (await deps.presenceMirror.lookup(playerId)) !== null,
      match: (mode, a, b) => this.matchPair(mode, a, b),
      timedOut: (_mode, e) => this.notify(e.playerId, statusMsg(idleStatus('timeout'))),
    });
  }

  /** Pushes a message to the player wherever they are (zone room or arena room). */
  notify(playerId: string, msg: ServerMessage): void {
    void this.kv.publish(arenaTopic(playerId), msg);
  }

  /** The arena room this player is seated in while it is still waiting / fighting, or null. */
  async liveRoom(playerId: string): Promise<{ readonly roomId: string } | null> {
    const p = await this.deps.presenceMirror.lookup(playerId);
    if (p === null || p.arena !== true) return null;
    const room = await zoneRoomById(p.roomId);
    const phase = (room?.metadata as Partial<ArenaMeta> | undefined)?.phase;
    if (room === null || phase === undefined || !ARENA_LIVE_PHASES.includes(phase)) return null;
    return { roomId: room.roomId };
  }

  /** 'offline' (no presence), 'busy' (battle / trade / raid fight / a live arena), or null = free. */
  async availability(playerId: string): Promise<'offline' | 'busy' | null> {
    const p = await this.deps.presenceMirror.lookup(playerId);
    if (p === null) return 'offline';
    if (p.battleId !== null || p.tradeId !== null) return 'busy';
    if (p.arena === true && (await this.liveRoom(playerId)) !== null) return 'busy';
    return null;
  }

  /** The player's queue status (idle when not queued). */
  async status(playerId: string): Promise<ArenaStatus> {
    const found = await this.queue.find(playerId);
    return found === null ? idleStatus(null) : queuedStatus(found.mode, found.entry, this.deps.clock());
  }

  /** Creates the arena room and its seats; null when the room could not be made. */
  async open(match: ArenaMatch): Promise<ReadonlyMap<string, SeatReservation> | null> {
    try {
      return (await openArenaRoom(match, this.deps.ticket)).seats;
    } catch (e) {
      this.deps.log.error({ err: e, matchId: match.matchId }, 'arena room creation failed');
      return null;
    }
  }

  /** A new match record (`createdAt` = now; `cup` records this week's cup id). */
  newMatch(kind: ArenaKind, players: readonly ArenaSeatView[], o: { readonly rules?: ArenaRules; readonly difficulty?: ArenaDifficulty } = {}): ArenaMatch {
    const now = this.deps.clock();
    return {
      matchId: randomUUID(),
      kind,
      level: arenaLevel(kind, o.rules ?? null),
      players,
      ...(o.difficulty !== undefined ? { training: { difficulty: o.difficulty } } : {}),
      ...(kind === 'cup' ? { cupId: weeklyCup(now).def.id } : {}),
      createdAt: now,
    };
  }

  /**
   * The queue's match step: a side that went offline is dropped, a busy side is told `idle / busy`; the other side
   * goes back into the queue with its wait. Both free → the arena room, both seats, `arenaStatus matched` to each.
   */
  private async matchPair(mode: ArenaMode, a: ArenaEntry, b: ArenaEntry): Promise<readonly ArenaEntry[]> {
    const av = await this.availability(a.playerId);
    const bv = await this.availability(b.playerId);
    if (av !== null || bv !== null) {
      for (const [e, v] of [[a, av], [b, bv]] as const) if (v === 'busy') this.notify(e.playerId, statusMsg(idleStatus('busy')));
      return [[a, av] as const, [b, bv] as const].filter(([, v]) => v === null).map(([e]) => e);
    }
    const match = this.newMatch(mode, [
      { playerId: a.playerId, name: a.name, rating: a.rating },
      { playerId: b.playerId, name: b.name, rating: b.rating },
    ]);
    const seats = await this.open(match);
    if (seats === null) {
      for (const e of [a, b]) this.notify(e.playerId, statusMsg(idleStatus('cancelled')));
      return [];
    }
    this.notify(a.playerId, statusMsg(matchedStatus(mode, seats.get(a.playerId)!, match.players[1]!)));
    this.notify(b.playerId, statusMsg(matchedStatus(mode, seats.get(b.playerId)!, match.players[0]!)));
    return [];
  }

  // ---- friend invites ------------------------------------------------------------------------------------------

  /** Stores an invite (presence, TTL `ARENA_INVITE_TTL_MS`), pushes `arenaInvite` to the friend, arms the expiry push. */
  async invite(p: Omit<ArenaInvite, 'inviteId' | 'expiresAt'>): Promise<ArenaInvite> {
    const inv: ArenaInvite = { ...p, inviteId: randomUUID(), expiresAt: this.deps.clock() + ARENA_INVITE_TTL_MS };
    await this.kv.setex(arenaInviteKey(inv.inviteId), JSON.stringify(inv), Math.ceil(ARENA_INVITE_TTL_MS / 1000) + 5);
    this.notify(inv.toId, { type: 'arenaInvite', inviteId: inv.inviteId, fromId: inv.fromId, fromName: inv.fromName, rules: inv.rules, expiresAt: inv.expiresAt });
    const t = setTimeout(() => void this.expire(inv.inviteId), ARENA_INVITE_TTL_MS);
    t.unref();
    this.inviteTimers.set(inv.inviteId, t);
    return inv;
  }

  /** Takes an invite out of presence (null when gone). An expired one is dropped and its inviter told `expired`. */
  async takeInvite(inviteId: string): Promise<ArenaInvite | null> {
    const raw = await this.kv.get(arenaInviteKey(inviteId));
    if (typeof raw !== 'string' || raw.length === 0) return null;
    await this.kv.del(arenaInviteKey(inviteId));
    this.clearTimer(inviteId);
    const inv = JSON.parse(raw) as ArenaInvite;
    if (this.deps.clock() >= inv.expiresAt) {
      this.notify(inv.fromId, { type: 'arenaInviteResult', inviteId, toName: inv.toName, result: 'expired' });
      return null;
    }
    return inv;
  }

  /** Reads an invite without taking it (the reply route checks the addressee first). */
  async peekInvite(inviteId: string): Promise<ArenaInvite | null> {
    const raw = await this.kv.get(arenaInviteKey(inviteId));
    if (typeof raw !== 'string' || raw.length === 0) return null;
    return JSON.parse(raw) as ArenaInvite;
  }

  private async expire(inviteId: string): Promise<void> {
    this.inviteTimers.delete(inviteId);
    const raw = await this.kv.get(arenaInviteKey(inviteId));
    if (typeof raw !== 'string' || raw.length === 0) return;
    await this.kv.del(arenaInviteKey(inviteId));
    const inv = JSON.parse(raw) as ArenaInvite;
    this.notify(inv.fromId, { type: 'arenaInviteResult', inviteId, toName: inv.toName, result: 'expired' });
  }

  private clearTimer(inviteId: string): void {
    const t = this.inviteTimers.get(inviteId);
    if (t !== undefined) clearTimeout(t);
    this.inviteTimers.delete(inviteId);
  }

  // ---- training / rejoin ---------------------------------------------------------------------------------------

  /** An AI battle for one player: the room and its one seat (null when the room could not be made). */
  async training(me: ArenaSeatView, rules: ArenaRules, difficulty: ArenaDifficulty): Promise<SeatReservation | null> {
    const seats = await this.open(this.newMatch('training', [me], { rules, difficulty }));
    return seats?.get(me.playerId) ?? null;
  }

  /** A fresh seat in the live arena room this player is seated in (a reload mid-battle), or null. */
  async rejoin(playerId: string): Promise<SeatReservation | null> {
    const live = await this.liveRoom(playerId);
    if (live === null) return null;
    const room = await zoneRoomById(live.roomId);
    return room === null ? null : reserveArenaSeat(room, this.deps.ticket);
  }

  /** The AI opponent's display name for a training match. */
  static foeName(match: ArenaMatch): string | null {
    return match.training === undefined ? null : ARENA_TRAINING[match.training.difficulty].name;
  }

  async tick(): Promise<void> {
    await this.queue.tick();
  }

  dispose(): void {
    for (const t of this.inviteTimers.values()) clearTimeout(t);
    this.inviteTimers.clear();
  }
}
