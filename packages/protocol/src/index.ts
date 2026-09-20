/**
 * @ewa/protocol — the wire. Shared by client and server: Colyseus schema classes (§4.1/§4.2),
 * zod message schemas (§4.3/§4.4), digests (§4.5), REST contracts (§4.7), the AOI cell rule and the
 * one movement constants table (20-client.md §20.4.5 / 30-server-netcode.md §30.2.4).
 *
 * No platform: no three, no react, no node builtins, no server/persist/render/client imports.
 */

// §4.1 / §4.2 — schema classes + the AOI view rule
export { PlayerState, SpawnState, BattleSummary, RaidState, ZoneState, AOI_VIEW_FIELDS } from './state/index';
export {
  AOI_CELL,
  AOI_RADIUS,
  cellOf,
  cellIndex,
  cellKey,
  sameCell,
  neighbourCells,
  inNeighbourhood,
  inView,
  cellTransition,
} from './aoi';
export type { Cell } from './aoi';

// §4.3 / §4.4 — messages
export * from './messages/index';

// §4.5 — digests
export { canonicalJson, digestBattleState, fnv1a32, digestOf, digestMatches, tradeOfferHash } from './digest';

// §20.4.5 / §30.2.4 — movement
export {
  MOVEMENT,
  MOVEMENT_VALIDATION,
  NO_COLLIDER,
  speedCap,
  maxStep,
  createPose,
  wrapAngle,
  stepMovement,
} from './movement';
export type { MoveInput, MovePose, Collider } from './movement';

// §4.7 — REST
export * from './rest';

// structural copies of content types (see types.ts TODO)
export * from './types';
