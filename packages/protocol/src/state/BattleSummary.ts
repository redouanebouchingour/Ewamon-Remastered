/** §4.1 BattleSummary — small, broadcast to every client (no @view). The arena dresses itself at (x, z). */
import { ArraySchema, Schema, type } from '@colyseus/schema';

export class BattleSummary extends Schema {
  @type('string') id = '';
  /** player uuids */
  @type(['string']) participants = new ArraySchema<string>();
  @type('string') format = 'wild';
  @type('uint16') turn = 0;
  /** where the arena dresses itself (pillar 7) */
  @type('float32') x = 0;
  @type('float32') z = 0;
}
