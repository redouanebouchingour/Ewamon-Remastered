/**
 * §30.10.2 metrics — the counters part 1 maintains. Part 2 (observability) adds the rolling rates
 * (msgs/s, patch bytes/s, tick percentiles), the 60 s log line and `GET /admin/metrics` aggregation; the
 * shapes below are the spec's, so that work is additive.
 */
import type { ZoneId } from '@ewa/content';
import type { RejectReason } from './rooms/movement';

export interface RoomMetrics {
  readonly roomId: string;
  readonly zoneId: ZoneId;
  readonly shard: number;
  players: number;
  spawns: number;
  battles: number;
  raid: boolean;
  msgsInPerSec: number;
  msgsOutPerSec: number;
  patchBytesPerSec: number;
  tickMsP50: number;
  tickMsP99: number;
  tickOverruns: number;
  rejectedInputs: Record<RejectReason, number>;
  aoiAddsPerSec: number;
  aoiRemovesPerSec: number;
  battleFaults: number;
  unknownMessages: number;
  kicks: number;
  /** raw counters behind the per-second rates (part 2 turns these into rates) */
  msgsIn: number;
  msgsOut: number;
  aoiAdds: number;
  aoiRemoves: number;
  lastTickMs: number;
}

export function createRoomMetrics(roomId: string, zoneId: ZoneId, shard: number): RoomMetrics {
  return {
    roomId,
    zoneId,
    shard,
    players: 0,
    spawns: 0,
    battles: 0,
    raid: false,
    msgsInPerSec: 0,
    msgsOutPerSec: 0,
    patchBytesPerSec: 0,
    tickMsP50: 0,
    tickMsP99: 0,
    tickOverruns: 0,
    rejectedInputs: { staleSeq: 0, dtBudget: 0, speed: 0, unwalkable: 0, bounds: 0, inBattle: 0 },
    aoiAddsPerSec: 0,
    aoiRemovesPerSec: 0,
    battleFaults: 0,
    unknownMessages: 0,
    kicks: 0,
    msgsIn: 0,
    msgsOut: 0,
    aoiAdds: 0,
    aoiRemoves: 0,
    lastTickMs: 0,
  };
}

/** Process-wide registry of live rooms' metrics (read by `/admin/metrics`). */
export class MetricsRegistry {
  private readonly rooms = new Map<string, RoomMetrics>();
  register(m: RoomMetrics): void {
    this.rooms.set(m.roomId, m);
  }
  unregister(roomId: string): void {
    this.rooms.delete(roomId);
  }
  all(): readonly RoomMetrics[] {
    return [...this.rooms.values()];
  }
}
