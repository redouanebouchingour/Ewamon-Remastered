/**
 * §30.7.4 distributed half of presence: every `enter` / `leave` / `setBattle` / `setTrade` on the process-local
 * `PresenceStore` also writes `ewa:presence:<playerId>` (90 s TTL, refreshed by the 30 s presence sweep), so REST on
 * any process answers `online / zoneId / inBattle` with one `get`. With `LocalPresence` the key lives in this
 * process and the store is the cache in front of it.
 *
 * The key/value store is structural (`PresenceKV`), so this wrapper stays free of Colyseus imports.
 */
import type { ZoneId } from '@ewa/content';
import type { PresenceEntry, PresenceStore } from './presenceStore';

export interface PresenceKV {
  setex(key: string, value: string, seconds: number): unknown;
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  del(key: string): unknown;
}

/** What any process can learn about a player from the mirror key. */
export interface RemotePresence {
  readonly roomId: string;
  readonly zoneId: ZoneId;
  readonly shard: number;
  readonly battleId: string | null;
  readonly tradeId: string | null;
  /** Arena PvP: `roomId` is an `arena` room (the player is outside the world) */
  readonly arena?: true;
}

export const PRESENCE_TTL_S = 90;

export function presenceKey(playerId: string): string {
  return `ewa:presence:${playerId}`;
}

export class PresenceMirror {
  constructor(
    readonly store: PresenceStore,
    private readonly kv: PresenceKV,
  ) {}

  /** PresenceStore.enter + mirror write. Returns the previous entry when it was in ANOTHER room (caller kicks it). */
  enter(playerId: string, e: PresenceEntry): PresenceEntry | null {
    const prev = this.store.enter(playerId, e);
    this.write(playerId);
    return prev;
  }

  /** false when the player is in a different room now (stale leave — ignored, the newer key stays). */
  leave(playerId: string, roomId: string): boolean {
    const left = this.store.leave(playerId, roomId);
    if (left) void this.kv.del(presenceKey(playerId));
    return left;
  }

  setBattle(playerId: string, battleId: string | null): void {
    this.store.setBattle(playerId, battleId);
    this.write(playerId);
  }

  setTrade(playerId: string, tradeId: string | null): void {
    this.store.setTrade(playerId, tradeId);
    this.write(playerId);
  }

  /** Rewrites the key of every present player (the 30 s presenceSweep keeps the 90 s TTL alive). */
  sweep(): void {
    for (const id of this.store.playerIds()) this.write(id);
  }

  /** Local entry first; otherwise the mirror key another process wrote. */
  async lookup(playerId: string): Promise<RemotePresence | null> {
    const local = this.store.get(playerId);
    if (local !== null) return { roomId: local.roomId, zoneId: local.zoneId, shard: local.shard, battleId: local.battleId, tradeId: local.tradeId, ...(local.arena === true ? { arena: true as const } : {}) };
    const raw = await this.kv.get(presenceKey(playerId));
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
      const v = JSON.parse(raw) as Partial<RemotePresence>;
      if (typeof v.roomId !== 'string' || typeof v.zoneId !== 'string') return null;
      return { roomId: v.roomId, zoneId: v.zoneId, shard: Number(v.shard ?? 0), battleId: v.battleId ?? null, tradeId: v.tradeId ?? null, ...(v.arena === true ? { arena: true as const } : {}) };
    } catch (_e) {
      return null;
    }
  }

  private write(playerId: string): void {
    const e = this.store.get(playerId);
    if (e === null) return;
    const v: RemotePresence = { roomId: e.roomId, zoneId: e.zoneId, shard: e.shard, battleId: e.battleId, tradeId: e.tradeId, ...(e.arena === true ? { arena: true as const } : {}) };
    void this.kv.setex(presenceKey(playerId), JSON.stringify(v), PRESENCE_TTL_S);
  }
}
