/** §4.1 SpawnState — a server-owned wild spawn. AOI-scoped through ZoneState.spawns (§4.2). */
import { Schema, type } from '@colyseus/schema';

export class SpawnState extends Schema {
  @type('string') id = '';
  @type('string') speciesId = '';
  @type('uint8') level = 1;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('string') variantKey = 'normal';
  @type('boolean') isAlpha = false;
  /** player uuid while a battle holds it; '' = free */
  @type('string') engagedBy = '';
  @type('uint32') despawnAtTick = 0;
  /** Phase D4: the 1/512 shiny tier (last field: earlier field indexes unchanged) */
  @type('boolean') isShiny = false;
}
