/**
 * §30.3 Spawn director — server-owned wild spawns. Pure: no Colyseus, no Date, no Math.random. Every draw
 * comes from the director's own `Rng` (the room's `worldRng.fork()`), so the sequence of spawns for a given
 * seed is reproducible by driving `tick` with synthetic `now` values.
 */
import { ALPHA_CHANCE, ROUTE_TUNING, STORY_TUNING, TOWN_SPAWN_TUNING, VARIANT_CHANCE, interiorFootprintAt, isWalkable, isWater } from '@ewa/content';
import type { EncounterSlot, EncounterTable, Heightfield, SpawnTuning, ZoneDef } from '@ewa/content';
import type { ContentIndex, Rng, VariantKey, WeatherKind } from '@ewa/core';
import { isLava } from './movement';
import { WEATHER_TYPES, WEATHER_TYPE_BOOST } from '../game/realWeather';

export interface SpawnRecord {
  /** `${zoneId}:${counter}` — counter is per-director, monotonic */
  readonly id: string;
  readonly speciesId: string;
  readonly level: number;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  /** Phase D4: the 1/512 shiny tier — the low 9 bits of the alpha draw (no extra draw; absent = false) */
  readonly isShiny?: boolean;
  /** species.abilities[rng.int(abilities.length)] — one draw at spawn */
  readonly ability: string;
  /** EncounterSlot.medium ?? 'land' */
  readonly medium: 'land' | 'water';
  readonly x: number;
  readonly z: number;
  /** ms */
  readonly bornAt: number;
  /** player uuid */
  engagedBy: string | null;
  engagedAt: number | null;
  /** ms; extended by engagement */
  despawnAt: number;
}

export interface LiveOpsMods {
  readonly alphaBonus: number;
  readonly variantBonus: number;
  readonly swarmSpecies: readonly string[];
  readonly swarmWeightBoost: number;
  readonly variantPool: readonly VariantKey[];
  /** Q12 (addition): an active seasonal event's featured species — +0.01 alpha / +0.025 variant when rolled */
  readonly featuredSpecies?: readonly string[];
}

/** §30.9.2 legacy per-species bonus for an event's featured species. */
export const FEATURED_ALPHA_BONUS = 0.01;
export const FEATURED_VARIANT_BONUS = 0.025;

export const NON_NORMAL_VARIANTS: readonly VariantKey[] = ['dawn', 'dusk', 'verdant', 'ember'];
export const DEFAULT_LIVE_OPS: LiveOpsMods = { alphaBonus: 0, variantBonus: 0, swarmSpecies: [], swarmWeightBoost: 1, variantPool: NON_NORMAL_VARIANTS };

/** Phase D4: one spawn in SHINY_ODDS is shiny. */
export const SHINY_ODDS = 512;

/**
 * Phase D4: shiny from the alpha draw's low bits. `next()` is u32 / 2^32 (exact), so `u * 2^32` is the u32 and
 * `u32 mod 512 === 0` has probability exactly 1/512. The alpha test reads the high bits (`u < ~0.01`), so the two
 * are independent to within one part in 2^23 — and the spawn stream gains no draw: every seeded sequence is unchanged.
 */
export function shinyFromDraw(u: number): boolean {
  return (u * 4294967296) % SHINY_ODDS === 0;
}

/** Engage range (§30.3): distance ≤ 3.0 m. */
export const ENGAGE_RANGE_M = 3.0;
export const MIN_SPAWN_SPACING_M = 6;
export const MIN_PLAYER_DISTANCE_M = 10;
export const POSITION_ATTEMPTS = 8;

/** Tuning by zone: route → ROUTE_TUNING; the towns with a table → TOWN_SPAWN_TUNING; story → STORY_TUNING; no table → no director. */
export function tuningFor(zone: ZoneDef): SpawnTuning | null {
  if (zone.encounterTable === null) return null;
  if (zone.kind === 'route') return ROUTE_TUNING;
  if (zone.kind === 'town') return TOWN_SPAWN_TUNING;
  return STORY_TUNING;
}

/** timeOfDay in [0.25, 0.75) is day (dawn 06:00, dusk 18:00 of the 48-minute day). */
export function isDay(timeOfDay: number): boolean {
  return timeOfDay >= 0.25 && timeOfDay < 0.75;
}

export function slotEligible(slot: EncounterSlot, timeOfDay: number): boolean {
  if (slot.timeOfDay === 'any') return true;
  return slot.timeOfDay === (isDay(timeOfDay) ? 'day' : 'night');
}

/**
 * Phase D9 — a bite on the Old Rod: one of `table`'s `water` slots eligible at `timeOfDay`, rolled with the same draws
 * as a spawn (slot, level, alpha + shiny, variant, ability; swarm and event bonuses included) from `rng` (the room's
 * fishing stream), placed at the cast point `at`. Never enters a director's population: the battle holds it and the
 * room's release of an unknown id is a no-op. null when the table has no eligible water slot (nothing bites).
 */
export function rollFishing(
  table: EncounterTable | null,
  rng: Rng,
  content: ContentIndex,
  timeOfDay: number,
  at: { readonly x: number; readonly z: number },
  id: string,
  now: number,
  mods: LiveOpsMods = DEFAULT_LIVE_OPS,
  weather: WeatherKind | null = null,
): SpawnRecord | null {
  return rollWild(table, 'water', rng, content, timeOfDay, at, id, now, mods, weather);
}

/**
 * One wild creature of `medium` from `table` (the fishing bite's draws, in the same order): a tall-grass encounter rolls
 * the `land` slots, a surf encounter or a bite the `water` slots. Never enters a director's population. null when the
 * table has no eligible slot of that medium at `timeOfDay`.
 */
export function rollWild(
  table: EncounterTable | null,
  medium: 'land' | 'water',
  rng: Rng,
  content: ContentIndex,
  timeOfDay: number,
  at: { readonly x: number; readonly z: number },
  id: string,
  now: number,
  mods: LiveOpsMods = DEFAULT_LIVE_OPS,
  /** weather from real life: the player's own weather, whose types are rolled `WEATHER_TYPE_BOOST` times as often (null: no bias) */
  weather: WeatherKind | null = null,
): SpawnRecord | null {
  if (table === null) return null;
  const eligible = table.slots.filter((s) => (s.medium ?? 'land') === medium && slotEligible(s, timeOfDay));
  if (eligible.length === 0) return null;
  const swarm = new Set(mods.swarmSpecies);
  const favoured: readonly string[] = weather === null || weather === 'none' ? [] : WEATHER_TYPES[weather];
  const weights = eligible.map(
    (s) =>
      s.weight *
      (swarm.has(s.species) ? mods.swarmWeightBoost : 1) *
      (favoured.length > 0 && content.species(s.species).types.some((t) => favoured.includes(t)) ? WEATHER_TYPE_BOOST : 1),
  );
  let total = 0;
  for (const w of weights) total += w;
  let pickAt = rng.next() * total;
  let slot = eligible[eligible.length - 1]!;
  for (let i = 0; i < eligible.length; i++) {
    pickAt -= weights[i]!;
    if (pickAt < 0) {
      slot = eligible[i]!;
      break;
    }
  }
  const level = slot.levelMin + rng.int(slot.levelMax - slot.levelMin + 1);
  const featured = mods.featuredSpecies?.includes(slot.species) === true;
  const alphaDraw = rng.next();
  const isAlpha = slot.tier === 'alpha' || alphaDraw < ALPHA_CHANCE + mods.alphaBonus + (featured ? FEATURED_ALPHA_BONUS : 0);
  const isShiny = shinyFromDraw(alphaDraw);
  let variantKey: VariantKey = 'normal';
  const pool = mods.variantPool.length > 0 ? mods.variantPool : NON_NORMAL_VARIANTS;
  if (rng.next() < VARIANT_CHANCE + mods.variantBonus + (featured ? FEATURED_VARIANT_BONUS : 0)) variantKey = rng.pick(pool);
  const species = content.species(slot.species);
  const ability = species.abilities[rng.int(species.abilities.length)]!;
  return {
    id,
    speciesId: slot.species,
    level,
    variantKey,
    isAlpha,
    isShiny,
    ability,
    medium,
    x: at.x,
    z: at.z,
    bornAt: now,
    engagedBy: null,
    engagedAt: null,
    despawnAt: now,
  };
}

export interface SpawnTickResult {
  readonly spawned: readonly SpawnRecord[];
  readonly despawned: readonly string[];
  /** engaged spawns whose engagement stalled past `engagedTimeoutMs`: freed for everyone (engagedBy → null) */
  readonly freed: readonly string[];
}

export class SpawnDirector {
  private readonly records = new Map<string, SpawnRecord>();
  private counter = 0;
  private nextSpawnAt = Number.NEGATIVE_INFINITY;
  private mods: LiveOpsMods = DEFAULT_LIVE_OPS;
  private readonly pendingDespawn: string[] = [];
  /** Until the population first reaches targetCount the respawn delay is skipped (one spawn per tick) — IMPLEMENTATION-NOTES W1. */
  private warm = false;

  constructor(
    private readonly zone: ZoneDef,
    private readonly table: EncounterTable | null,
    private readonly rng: Rng,
    private readonly h: Heightfield,
    private readonly tuning: SpawnTuning,
    private readonly content: ContentIndex,
  ) {}

  /** Re-read from live-ops at each rollover. */
  setLiveOps(m: LiveOpsMods): void {
    this.mods = { ...m, variantPool: m.variantPool.length > 0 ? m.variantPool : NON_NORMAL_VARIANTS };
  }

  get liveOps(): LiveOpsMods {
    return this.mods;
  }

  /**
   * One director step. `players` are the current player positions (≥ 10 m spawn clearance) — an addition to
   * the spec's `(now, timeOfDay)` signature, since the rule needs them (IMPLEMENTATION-NOTES W2).
   */
  tick(now: number, timeOfDay: number, players: readonly { readonly x: number; readonly z: number }[] = []): SpawnTickResult {
    const despawned: string[] = this.pendingDespawn.splice(0, this.pendingDespawn.length);
    const freed: string[] = [];
    for (const r of [...this.records.values()]) {
      if (r.engagedBy === null && now >= r.despawnAt) {
        this.records.delete(r.id);
        despawned.push(r.id);
      } else if (r.engagedBy !== null && r.engagedAt !== null && now >= r.engagedAt + this.tuning.engagedTimeoutMs) {
        r.engagedBy = null;
        r.engagedAt = null;
        freed.push(r.id);
      }
    }
    const spawned: SpawnRecord[] = [];
    if (this.table !== null && this.records.size < this.tuning.targetCount && now >= this.nextSpawnAt) {
      const rec = this.roll(now, timeOfDay, players);
      if (rec !== null) {
        this.records.set(rec.id, rec);
        spawned.push(rec);
        if (this.records.size >= this.tuning.targetCount) this.warm = true;
        const span = this.tuning.respawnMaxMs - this.tuning.respawnMinMs + 1;
        const delay = this.tuning.respawnMinMs + this.rng.int(span);
        this.nextSpawnAt = this.warm ? now + delay : now;
      }
    }
    return { spawned, despawned, freed };
  }

  private roll(now: number, timeOfDay: number, players: readonly { readonly x: number; readonly z: number }[]): SpawnRecord | null {
    const table = this.table!;
    const eligible = table.slots.filter((s) => slotEligible(s, timeOfDay));
    if (eligible.length === 0) return null;
    const swarm = new Set(this.mods.swarmSpecies);
    const weights = eligible.map((s) => s.weight * (swarm.has(s.species) ? this.mods.swarmWeightBoost : 1));
    let total = 0;
    for (const w of weights) total += w;
    // slot: one draw
    let pickAt = this.rng.next() * total;
    let slot = eligible[eligible.length - 1]!;
    for (let i = 0; i < eligible.length; i++) {
      pickAt -= weights[i]!;
      if (pickAt < 0) {
        slot = eligible[i]!;
        break;
      }
    }
    // level: one draw
    const level = slot.levelMin + this.rng.int(slot.levelMax - slot.levelMin + 1);
    // alpha: one draw (an 'alpha' tier slot forces it)
    // Q12: an active event's featured species get +0.01 alpha / +0.025 variant (legacy constants); draws unchanged
    const featured = this.mods.featuredSpecies?.includes(slot.species) === true;
    const alphaDraw = this.rng.next();
    const alphaRoll = alphaDraw < ALPHA_CHANCE + this.mods.alphaBonus + (featured ? FEATURED_ALPHA_BONUS : 0);
    const isShiny = shinyFromDraw(alphaDraw);
    const isAlpha = slot.tier === 'alpha' || alphaRoll;
    // variant: one draw, plus one pick on success
    let variantKey: VariantKey = 'normal';
    if (this.rng.next() < VARIANT_CHANCE + this.mods.variantBonus + (featured ? FEATURED_VARIANT_BONUS : 0)) variantKey = this.rng.pick(this.mods.variantPool);
    // ability: one draw
    const species = this.content.species(slot.species);
    const ability = species.abilities[this.rng.int(species.abilities.length)]!;
    const medium = slot.medium ?? 'land';
    // position: up to 8 attempts
    const h = this.h;
    for (let attempt = 0; attempt < POSITION_ATTEMPTS; attempt++) {
      const x = h.originX + 1 + this.rng.next() * (h.size - 2);
      const z = h.originZ + 1 + this.rng.next() * (h.size - 2);
      // a water spawn never lands on lava (audit L2-25; no draw is added, so seeded sequences are unchanged)
      const surfaceOk = medium === 'water' ? isWater(h, x, z) && !isLava(h, x, z) : isWalkable(h, x, z);
      if (!surfaceOk) continue;
      // never inside an interior pocket (its floor is walkable but only reached through door warps; Phase A)
      if (interiorFootprintAt(this.zone.id, x, z) !== null) continue;
      let clear = true;
      for (const r of this.records.values()) {
        if (Math.hypot(r.x - x, r.z - z) < MIN_SPAWN_SPACING_M) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      for (const p of players) {
        if (Math.hypot(p.x - x, p.z - z) < MIN_PLAYER_DISTANCE_M) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      this.counter += 1;
      return {
        id: `${this.zone.id}:${this.counter}`,
        speciesId: slot.species,
        level,
        variantKey,
        isAlpha,
        isShiny,
        ability,
        medium,
        x,
        z,
        bornAt: now,
        engagedBy: null,
        engagedAt: null,
        despawnAt: now + this.tuning.lifetimeMs,
      };
    }
    return null;
  }

  /**
   * Claims a spawn for a battle. `from` (the player's position) enables the 3 m range check; the room also
   * checks AOI membership before calling (an out-of-AOI id is `notFound` there).
   */
  engage(spawnId: string, playerId: string, now: number, from?: { readonly x: number; readonly z: number }): 'ok' | 'notFound' | 'engaged' | 'tooFar' {
    const r = this.records.get(spawnId);
    if (r === undefined) return 'notFound';
    if (from !== undefined && Math.hypot(from.x - r.x, from.z - r.z) > ENGAGE_RANGE_M) return 'tooFar';
    if (r.engagedBy !== null) return 'engaged';
    r.engagedBy = playerId;
    r.engagedAt = now;
    r.despawnAt = Math.max(r.despawnAt, now + this.tuning.engagedTimeoutMs);
    return 'ok';
  }

  /** Despawns for caught/ko/fled/timeout (reported by the next `tick`); frees for playerLeft. */
  release(spawnId: string, outcome: 'caught' | 'ko' | 'fled' | 'timeout' | 'playerLeft', _now: number): void {
    const r = this.records.get(spawnId);
    if (r === undefined) return;
    if (outcome === 'playerLeft') {
      r.engagedBy = null;
      r.engagedAt = null;
      return;
    }
    this.records.delete(spawnId);
    this.pendingDespawn.push(spawnId);
  }

  get(spawnId: string): SpawnRecord | null {
    return this.records.get(spawnId) ?? null;
  }

  get all(): readonly SpawnRecord[] {
    return [...this.records.values()];
  }

  dispose(): void {
    this.records.clear();
    this.pendingDespawn.length = 0;
  }
}
