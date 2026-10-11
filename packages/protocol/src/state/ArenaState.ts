/**
 * Arena PvP (../arena.ts): the state of an `arena` room — one battle outside the world. Deliberately tiny: everything
 * the client draws comes from the `arenaState` and battle messages; the schema only gives the room a state to sync.
 */
import { Schema, type } from '@colyseus/schema';

export class ArenaState extends Schema {
  /** the match id (also `arenaState.matchId`) */
  @type('string') matchId = '';
  /** ArenaPhase: 'waiting' | 'fighting' | 'ended' | 'cancelled' */
  @type('string') phase = 'waiting';
}
