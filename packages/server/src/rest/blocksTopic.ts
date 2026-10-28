/**
 * Talking to other players: the bus topic `POST /social/block` and `/social/unblock` publish, so every zone room holding
 * either player updates its block sets (challenges, trade requests and world chat between them stop at once).
 */
export const BLOCKS_TOPIC = 'ewa:blocks';

export interface BlocksPush {
  readonly blockerId: string;
  readonly blockedId: string;
  /** true: blocked; false: unblocked */
  readonly on: boolean;
}
