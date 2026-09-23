/**
 * §30.7.4 PresenceStore — keyed by playerId, pure, no I/O. The process-local half of presence; the
 * distributed mirror (`presence.setex('ewa:presence:<id>', …, 90)`) is written by `presenceMirror.ts`.
 *
 * Multi-tab collapses: one entry per player. `enter` returns the previous room when the player was present
 * elsewhere (the caller kicks it); a stale `leave` from the kicked room does not remove the newer entry —
 * the legacy onlinePresence.js guarantee, rebuilt without the refcount.
 */
import type { ZoneId } from '@ewa/content';

export interface PresenceEntry {
  readonly roomId: string;
  readonly zoneId: ZoneId;
  readonly shard: number;
  battleId: string | null;
  tradeId: string | null;
  readonly since: number;
}

export class PresenceStore {
  private readonly entries = new Map<string, PresenceEntry>();
  private readonly ips = new Map<string, number>();

  /** Returns the previous entry if the player was already present in ANOTHER room (caller kicks it). */
  enter(playerId: string, e: PresenceEntry): PresenceEntry | null {
    const prev = this.entries.get(playerId) ?? null;
    this.entries.set(playerId, { ...e });
    if (prev !== null && prev.roomId !== e.roomId) return prev;
    return null;
  }

  /** false when the player is in a different room now (stale leave — ignored). */
  leave(playerId: string, roomId: string): boolean {
    const cur = this.entries.get(playerId);
    if (cur === undefined || cur.roomId !== roomId) return false;
    this.entries.delete(playerId);
    return true;
  }

  get(playerId: string): PresenceEntry | null {
    return this.entries.get(playerId) ?? null;
  }

  isOnline(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  setBattle(playerId: string, battleId: string | null): void {
    const cur = this.entries.get(playerId);
    if (cur !== undefined) cur.battleId = battleId;
  }

  setTrade(playerId: string, tradeId: string | null): void {
    const cur = this.entries.get(playerId);
    if (cur !== undefined) cur.tradeId = tradeId;
  }

  battleOf(playerId: string): string | null {
    return this.entries.get(playerId)?.battleId ?? null;
  }

  ipCount(ip: string): number {
    return this.ips.get(ip) ?? 0;
  }

  ipEnter(ip: string): void {
    this.ips.set(ip, this.ipCount(ip) + 1);
  }

  ipLeave(ip: string): void {
    const n = this.ipCount(ip) - 1;
    if (n <= 0) this.ips.delete(ip);
    else this.ips.set(ip, n);
  }

  /** Player ids currently present (for the presence sweep). */
  playerIds(): readonly string[] {
    return [...this.entries.keys()];
  }

  get size(): number {
    return this.entries.size;
  }
}
