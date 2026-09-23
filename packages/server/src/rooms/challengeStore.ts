/**
 * §30.4.5 ChallengeStore — pure; the legacy `createChallengeStore` shape (worldSocket.js, 45 s TTL), ported.
 * The room re-checks presence/range/busy state on accept; this store only remembers who invited whom.
 */

export const CHALLENGE_TTL_MS = 45_000;

export interface PendingChallenge {
  readonly fromId: string;
  readonly toId: string;
  readonly at: number;
}

export class ChallengeStore {
  private readonly byKey = new Map<string, PendingChallenge>();

  private static key(fromId: string, toId: string): string {
    return `${fromId}>${toId}`;
  }

  /** `targetBusy`: the target already has a live invite from someone else, or has one out themselves. */
  offer(fromId: string, toId: string, now: number): 'ok' | 'duplicate' | 'targetBusy' | 'selfChallenge' {
    if (fromId === toId) return 'selfChallenge';
    const existing = this.byKey.get(ChallengeStore.key(fromId, toId));
    if (existing !== undefined && now - existing.at <= CHALLENGE_TTL_MS) return 'duplicate';
    for (const c of this.byKey.values()) {
      if (now - c.at > CHALLENGE_TTL_MS) continue;
      if ((c.toId === toId && c.fromId !== fromId) || c.fromId === toId) return 'targetBusy';
    }
    this.byKey.set(ChallengeStore.key(fromId, toId), { fromId, toId, at: now });
    return 'ok';
  }

  /** Consumes the invite. true iff one exists from `fromId` to `toId` and now - at <= TTL. */
  consume(fromId: string, toId: string, now: number): boolean {
    const k = ChallengeStore.key(fromId, toId);
    const c = this.byKey.get(k);
    if (c === undefined) return false;
    this.byKey.delete(k);
    return now - c.at <= CHALLENGE_TTL_MS;
  }

  /** Both directions; returned so the room can send challengeResult 'unavailable'. */
  dropFor(playerId: string): readonly PendingChallenge[] {
    const out: PendingChallenge[] = [];
    for (const [k, c] of this.byKey) {
      if (c.fromId === playerId || c.toId === playerId) {
        out.push(c);
        this.byKey.delete(k);
      }
    }
    return out;
  }

  /** Expired; returned so the room can send challengeResult 'expired'. */
  sweep(now: number): readonly PendingChallenge[] {
    const out: PendingChallenge[] = [];
    for (const [k, c] of this.byKey) {
      if (now - c.at > CHALLENGE_TTL_MS) {
        out.push(c);
        this.byKey.delete(k);
      }
    }
    return out;
  }

  get size(): number {
    return this.byKey.size;
  }
}
