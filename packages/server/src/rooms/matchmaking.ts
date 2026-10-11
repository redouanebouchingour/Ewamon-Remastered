/**
 * §30.2.6 capacity and sharding — shared by `POST /zone/enter` and the room's handover (§30.2.7 step 2).
 *
 * Join tickets (IMPLEMENTATION-NOTES R2): every seat the server reserves carries `ticket` (a per-process
 * random secret) in its join options. Seat-reservation options never reach the client (`ISeatReservation`
 * has no options), and `ZoneRoom.onCreate`/`onAuth` refuse options without the ticket — so Colyseus' own
 * `/matchmake/*` HTTP routes cannot create shards or join rooms behind the REST gate checks.
 */
import { matchMaker } from '@colyseus/core';
import type { ZoneId } from '@ewa/content';
import type { ArenaDifficulty, ArenaKind, ArenaSeatView, SeatReservation } from '@ewa/protocol';

export const ZONE_ROOM = 'zone';

export interface ZoneSeatOptions {
  readonly zoneId: ZoneId;
  readonly shard: number;
  readonly ticket: string;
  readonly handover?: { readonly fromRoomId: string; readonly x: number; readonly z: number };
}

type RoomCache = Awaited<ReturnType<typeof matchMaker.createRoom>>;

const creating = new Map<ZoneId, Promise<RoomCache>>();

/** Steps 1–2: the lowest-shard room with space, else create shard (max + 1). Serialised per zone in-process. */
export async function pickZoneRoom(zoneId: ZoneId, ticket: string): Promise<RoomCache> {
  const inflight = creating.get(zoneId);
  if (inflight !== undefined) await inflight.catch(() => undefined);
  const rooms = (await matchMaker.query({ name: ZONE_ROOM, zoneId } as never)) as RoomCache[];
  const open = rooms
    .filter((r) => r.clients < r.maxClients && r.locked !== true)
    .sort((a, b) => Number(a.metadata?.shard ?? 0) - Number(b.metadata?.shard ?? 0));
  if (open.length > 0) return open[0]!;
  let maxShard = -1;
  for (const r of rooms) maxShard = Math.max(maxShard, Number(r.metadata?.shard ?? 0));
  const p = matchMaker.createRoom(ZONE_ROOM, { zoneId, shard: maxShard + 1, ticket });
  creating.set(zoneId, p);
  try {
    return await p;
  } finally {
    if (creating.get(zoneId) === p) creating.delete(zoneId);
  }
}

/** The listing of one live room (any process), or null — a reload mid-battle rejoins the battle's own room (P3). */
export async function zoneRoomById(roomId: string): Promise<RoomCache | null> {
  const room = (await matchMaker.getRoomById(roomId)) as RoomCache | undefined | null;
  return room ?? null;
}

/** Step 3: reserve a seat; the whole ISeatReservation goes to the client unchanged. */
export async function reserveZoneSeat(room: RoomCache, opts: ZoneSeatOptions): Promise<SeatReservation> {
  const seat = await matchMaker.reserveSeatFor(room, opts, null);
  return { ...seat };
}

// ─── Arena PvP (rooms/ArenaRoom.ts) ─────────────────────────────────────────────────────────────────────────────────

export const ARENA_ROOM = 'arena';

/** One arena match: who fights, at which level, under which rules. The `arena` room is created per match. */
export interface ArenaMatch {
  readonly matchId: string;
  readonly kind: ArenaKind;
  /** ARENA_LEVEL, or null = each creature's own level */
  readonly level: number | null;
  /** the human seats in side order (side 0 = the longer-waiting player / the inviter); training: one */
  readonly players: readonly ArenaSeatView[];
  readonly training?: { readonly difficulty: ArenaDifficulty };
  /** `cup`: the cup in force when the match was made */
  readonly cupId?: string;
  /** server clock ms the match was made (the cup week, the arrival window) */
  readonly createdAt: number;
}

/** Creates the match's `arena` room (server ticket) and reserves one seat per human player (playerId → seat). */
export async function openArenaRoom(match: ArenaMatch, ticket: string): Promise<{ readonly roomId: string; readonly seats: ReadonlyMap<string, SeatReservation> }> {
  const room = await matchMaker.createRoom(ARENA_ROOM, { ticket, match });
  const seats = new Map<string, SeatReservation>();
  for (const p of match.players) seats.set(p.playerId, await reserveArenaSeat(room, ticket));
  return { roomId: room.roomId, seats };
}

/** A seat in a live arena room (the match's players are checked by the room's onAuth when it is consumed). */
export async function reserveArenaSeat(room: RoomCache, ticket: string): Promise<SeatReservation> {
  const seat = await matchMaker.reserveSeatFor(room, { ticket }, null);
  return { ...seat };
}
