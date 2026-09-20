/**
 * §4.1 ZoneState — the room state. §4.2: `players` and `spawns` are the ONLY @view()-tagged fields
 * (per-client AOI via StateView); everything else broadcasts to every client.
 */
import { MapSchema, Schema, type, view } from '@colyseus/schema';
import { BattleSummary } from './BattleSummary';
import { PlayerState } from './PlayerState';
import { RaidState } from './RaidState';
import { SpawnState } from './SpawnState';

export class ZoneState extends Schema {
  /** 20 Hz */
  @type('uint32') tick = 0;
  /** 0..1, one full day = 48 real minutes */
  @type('float32') timeOfDay = 0;
  /** WeatherKind, cosmetic in the overworld; battles set their own */
  @type('string') weather = 'none';
  /** the zone's content DEFAULT (ZoneDef.harvestState), same for every viewer; each client renders harvestStateFor(zone, ownFlags) (§3.5) */
  @type('string') harvestState = 'intact';
  /** keyed by player uuid — AOI-scoped */
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  /** keyed by spawn id — AOI-scoped */
  @view() @type({ map: SpawnState }) spawns = new MapSchema<SpawnState>();
  /** small; broadcast to all */
  @type({ map: BattleSummary }) battles = new MapSchema<BattleSummary>();
  /** broadcast to all */
  @type(RaidState) raid: RaidState | null = null;
}
