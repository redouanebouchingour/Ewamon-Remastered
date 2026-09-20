/**
 * §4.5 State digests. Every `battleStart`, `battleEvents`, `battleResync` and `raidEvents` carries
 * `stateDigest = digestBattleState(serverState)` (core §2.20). The client compares the digest of its
 * preview state against it; a mismatch drops the preview and requests `battleResync`.
 *
 * Protocol adds nothing to the hash itself — it re-exports core's so client and server can only
 * ever use the one function — plus the two derived helpers the wire needs.
 */
import { canonicalJson, digestBattleState, fnv1a32 } from '@ewa/core';
import type { BattleState } from '@ewa/core';
import type { TradeOffer } from './messages/server';

export { canonicalJson, digestBattleState, fnv1a32 };

/** `fnv1a32(canonicalJson(value))` as 8 lowercase hex chars — the encoding every wire digest uses. */
export function digestOf(value: unknown): string {
  return fnv1a32(canonicalJson(value)).toString(16).padStart(8, '0');
}

/** True when the client's preview state hashes to the digest the server sent (§4.5). */
export function digestMatches(preview: BattleState, stateDigest: string): boolean {
  return digestBattleState(preview) === stateDigest;
}

/**
 * §4.3 `TradeConfirmMsg.offerHash`: fnv1a32 of both offers, canonical. Hashed over
 * `{ playerId, creatureIds, money }` only (a `confirmed` flip must not change the hash) with the two
 * offers ordered by `playerId`, so both parties compute the same value regardless of seat order.
 */
export function tradeOfferHash(offers: readonly [TradeOffer, TradeOffer]): string {
  const norm = offers
    .map((o) => ({ playerId: o.playerId, creatureIds: [...o.creatureIds], money: o.money }))
    .sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  return digestOf(norm);
}
