/**
 * @ewa/protocol — the wire. Shared by client and server: Colyseus schema classes (§4.1/§4.2),
 * zod message schemas (§4.3/§4.4), digests (§4.5), REST contracts (§4.7), the AOI cell rule and the
 * one movement constants table (20-client.md §20.4.5 / 30-server-netcode.md §30.2.4).
 *
 * No platform: no three, no react, no node builtins, no server/persist/render/client imports.
 */

// §4.1 / §4.2 — schema classes + the AOI view rule
export { PlayerState, SpawnState, BattleSummary, RaidState, ZoneState, ArenaState, AOI_VIEW_FIELDS, LEAD_VARIANTS, decodeLeadFlags, encodeLeadFlags } from './state/index';
export type { LeadVariant } from './state/index';
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
  gaitSpeed,
  createPose,
  wrapAngle,
  stepMovement,
} from './movement';
export type { MoveInput, MovePose, Collider } from './movement';

// §4.7 — REST
export * from './rest';

// arena PvP (out-of-world queues, training, friend invites)
export * from './arena';

// the battle commentary's model line banks (client only, validated here because the client reaches zod through protocol)
export * from './commentary';

// a recurring rival (LLM feature 7): the rival's view (the `rival` message, GET /rival) and its parting words
export * from './rival';

// the rumour board (LLM feature 8): a town's facts of the day (GET /world/rumours/:zoneId)
export * from './rumours';

// the adventure journal (LLM feature 9): a diary entry per play day (GET /journal, GET + POST /journal/day/:day)
export * from './journal';

// structural copies of content types (see types.ts TODO)
export * from './types';
