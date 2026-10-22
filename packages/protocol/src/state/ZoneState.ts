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
  /** honor shapes the world: the zone's shadow level this season, 0..4 (content worldHonor.ts); broadcast to all */
  @type('uint8') shadow = 0;
  /** keyed by player uuid — AOI-scoped */
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  /** keyed by spawn id — AOI-scoped */
  @view() @type({ map: SpawnState }) spawns = new MapSchema<SpawnState>();
  /** small; broadcast to all */
  @type({ map: BattleSummary }) battles = new MapSchema<BattleSummary>();
  /** broadcast to all */
  @type(RaidState) raid: RaidState | null = null;
  /**
   * Followers with field powers (SPEC §3.18): the server env FIELD_POWERS is on here (glides, brambles, digs, dives and
   * the Psychic sense work). Set once at room creation; the client predicts glides and blocks brambles only when true.
   */
  @type('boolean') fieldPowers = false;
  /**
   * Camp bases (SPEC §3.19): the zone's travellers' camp as everyone sees it. `campOwner` the holder's name ('' = free,
   * no camp here, or the server env CAMPS off); `campName` its banner; `campTrophies` the trophy kinds in slot order,
   * comma-separated (content `TROPHY_KINDS`; '' = none). Written when the camp changes.
   */
  @type('string') campOwner = '';
  @type('string') campName = '';
  @type('string') campTrophies = '';
}
