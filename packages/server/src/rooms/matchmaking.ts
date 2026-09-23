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
import type { SeatReservation } from '@ewa/protocol';

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

/** Step 3: reserve a seat; the whole ISeatReservation goes to the client unchanged. */
export async function reserveZoneSeat(room: RoomCache, opts: ZoneSeatOptions): Promise<SeatReservation> {
  const seat = await matchMaker.reserveSeatFor(room, opts, null);
  return { ...seat };
}
