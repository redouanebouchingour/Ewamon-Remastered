/** §4.1 BattleSummary — one per ongoing battle in the room. Broadcast to all (small). */
import { ArraySchema, Schema, type } from '@colyseus/schema';

/** Watching battles (protocol `watch.ts` `WatchBattler`): one creature on the field as every spectator sees it. */
export class WatchBattlerState extends Schema {
  @type('uint8') side = 0;
  @type('uint8') pos = 0;
  @type('string') species = '';
  /** `encodeLeadFlags` */
  @type('uint8') flags = 0;
  @type('uint8') level = 1;
  /** 0..100 (never the exact hp) */
  @type('uint8') hpPct = 100;
  /** the major status, '' none */
  @type('string') status = '';
}

export class BattleSummary extends Schema {
  @type('string') id = '';
  /** player uuids */
  @type(['string']) participants = new ArraySchema<string>();
  @type('string') format = 'wild';
  @type('uint16') turn = 0;
  /** where the arena dresses itself (pillar 7) */
  @type('float32') x = 0;
  @type('float32') z = 0;
  /**
   * Watching battles (last fields: earlier indexes unchanged). `field` the creatures on the field after the last turn;
   * `trainers` what each side is called (watch.ts `NPC_TRAINER_PREFIX`); `angle` the heading of side 0's trainer at the
   * start (it faces the foe), which lays the spectator ring's battle axis.
   */
  @type([WatchBattlerState]) field = new ArraySchema<WatchBattlerState>();
  @type(['string']) trainers = new ArraySchema<string>();
  @type('float32') angle = 0;
}
