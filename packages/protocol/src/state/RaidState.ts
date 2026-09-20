/** §4.1 RaidState — broadcast to every client (no @view). hpPct is the only boss HP a client ever sees. */
import { MapSchema, Schema, type } from '@colyseus/schema';

export class RaidState extends Schema {
  @type('string') id = '';
  @type('string') bossSpecies = '';
  @type('uint8') bossLevel = 1;
  /** 0..1, the only HP the client ever sees for a raid boss */
  @type('float32') hpPct = 1;
  /** 0 lobby · 1 fight · 2 enraged (hpPct < 0.3) · 3 catchWindow · 4 over */
  @type('uint8') phase = 0;
  @type('uint16') roundEndsInMs = 0;
  /** player uuid -> total damage */
  @type({ map: 'uint32' }) damageBoard = new MapSchema<number>();
  @type('float32') x = 0;
  @type('float32') z = 0;
}
