/**
 * Talk to your own Ewamon (LLM feature 6): when the lead walking behind the player says something unprompted. Pure:
 * World3D hands a snapshot of the world twice a second (`AmbientSnapshot`); `createAmbient` notices what changed and,
 * rarely, returns one event to remark on: a new zone, a rare / shiny / alpha wild creature nearby, low HP after a
 * battle, night falling, a place that suits its type (a Water type at the shore, a Fire type in Cinderhold).
 *
 * Throttled so it reads as a companion, not a ticker: nothing in the first `warmupMs` after the world loads, at most
 * one line per `gapMs`, the same kind at most once per `kindGapMs`, a zone or a spawn remarked on once a session.
 * What happens while the lead may not speak (a battle, a dialogue, a panel, indoors) is not said late.
 */
import { SPECIES, ZONES } from '@ewa/content';
import type { Biome } from '@ewa/content';
import type { SpeciesDef, TypeName } from '@ewa/core';
import { isNight, seedOf, soundOf } from './buddyFacts';
import type { BuddyVoice } from './buddyFacts';

export type AmbientKind = 'rare' | 'lowHp' | 'zone' | 'night' | 'place';

export interface AmbientLead {
  readonly id: string;
  readonly speciesId: string;
  readonly types: readonly TypeName[];
  /** 0..1 */
  readonly hpFrac: number;
}

export interface AmbientSpawn {
  readonly id: string;
  readonly speciesId: string;
  readonly shiny: boolean;
  readonly alpha: boolean;
}

export interface AmbientSnapshot {
  /** ms (performance or wall clock: only differences are used) */
  readonly now: number;
  readonly zoneId: string | null;
  readonly timeOfDay: number | null;
  /** the creature walking behind the player, null when none walks */
  readonly lead: AmbientLead | null;
  readonly inBattle: boolean;
  /** the lead may not speak now: a dialogue, a panel, the talk box, indoors, an evolution, the arena */
  readonly busy: boolean;
  /** the player stands within a few metres of open water */
  readonly nearWater: boolean;
  /** rare, shiny or alpha wild creatures within range (World3D filters them with `notable`) */
  readonly spawns: readonly AmbientSpawn[];
}

export interface AmbientEvent {
  readonly kind: AmbientKind;
  /** what happened, as a "you" fact for the model */
  readonly event: string;
  /** what the lead says when the model is down, slow or wrong */
  readonly template: string;
}

export interface AmbientOptions {
  readonly gapMs?: number;
  readonly kindGapMs?: number;
  readonly warmupMs?: number;
  /** a lead's HP fraction at or under this after a battle is "low" */
  readonly lowHp?: number;
}

export const AMBIENT_GAP_MS = 120_000;
export const AMBIENT_KIND_GAP_MS = 10 * 60_000;
export const AMBIENT_WARMUP_MS = 20_000;
export const AMBIENT_LOW_HP = 0.3;
/** how near (m) a wild creature must be to be remarked on */
export const AMBIENT_SPAWN_RANGE_M = 20;

const speciesById = new Map<string, SpeciesDef>(SPECIES.map((sp) => [sp.id, sp]));
const zoneById = new Map(ZONES.map((z) => [z.id as string, z]));

/** A wild creature worth a remark: rare or above, shiny or alpha. */
export function notable(speciesId: string, shiny: boolean, alpha: boolean): boolean {
  if (shiny || alpha) return true;
  const r = speciesById.get(speciesId)?.rarity;
  return r === 'rare' || r === 'legendary' || r === 'mythical';
}

/** The types a biome feels like home to (the gym's type for each region). */
export const BIOME_TYPES: Readonly<Partial<Record<Biome, readonly TypeName[]>>> = {
  grove: ['Grass', 'Bug'],
  cinder: ['Fire'],
  salt: ['Water'],
  storm: ['Electric'],
  marrow: ['Ground', 'Rock'],
  vesper: ['Ghost', 'Dark'],
  forge: ['Steel'],
  sky: ['Flying'],
};

const PRIORITY: readonly AmbientKind[] = ['rare', 'lowHp', 'zone', 'night', 'place'];

const TEMPLATES: Readonly<Record<Exclude<AmbientKind, 'place'>, readonly string[]>> = {
  rare: ['Psst! Look, a {what} over there!', 'A {what}! Did you see it?', 'Ooh, a {what} nearby!'],
  lowHp: ['Ow... I need a rest.', 'Hurts a bit. Healer soon?', 'Tired... slow down please.'],
  zone: ['{zone}! New smells here.', 'Ooh, {zone}. Let us look around!', '{zone}... what is here?'],
  night: ['It is getting dark. Stay close.', 'Night now. I stay near you.', 'Stars coming out!'],
};

const PLACE_LINES = {
  water: ['Water! Can I splash?', 'The water calls me!', 'Ooh, the water. Swim time?'],
  home: ['This place feels like home.', 'I like it here. It feels like me!', 'Home feelings here.'],
} as const;

function fill(tpl: string, vars: Readonly<Record<string, string>>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
}

function pick<T>(xs: readonly T[], seed: number): T {
  return xs[seed % xs.length]!;
}

export interface Ambient {
  /** one snapshot; an event to remark on, or null */
  step(s: AmbientSnapshot, voice: (lead: AmbientLead) => BuddyVoice): AmbientEvent | null;
  /** the world was left (a new session): start over */
  reset(): void;
}

export function createAmbient(o: AmbientOptions = {}): Ambient {
  const gap = o.gapMs ?? AMBIENT_GAP_MS;
  const kindGap = o.kindGapMs ?? AMBIENT_KIND_GAP_MS;
  const warmup = o.warmupMs ?? AMBIENT_WARMUP_MS;
  const lowHp = o.lowHp ?? AMBIENT_LOW_HP;
  let started: number | null = null;
  let last = Number.NEGATIVE_INFINITY;
  const lastKind = new Map<AmbientKind, number>();
  let prevZone: string | null = null;
  let prevNight: boolean | null = null;
  let prevBattle = false;
  const zonesSeen = new Set<string>();
  const spawnsSeen = new Set<string>();
  const placesSaid = new Set<string>();

  return {
    reset() {
      started = null;
      last = Number.NEGATIVE_INFINITY;
      lastKind.clear();
      prevZone = null;
      prevNight = null;
      prevBattle = false;
      zonesSeen.clear();
      spawnsSeen.clear();
      placesSaid.clear();
    },
    step(s, voice) {
      started ??= s.now;
      // what changed, noticed whether or not the lead may speak (a change is never said late)
      const found = new Map<AmbientKind, { event: string; vars: Record<string, string>; place?: keyof typeof PLACE_LINES; key: string }>();
      const zone = s.zoneId !== null ? zoneById.get(s.zoneId) : undefined;
      const zoneName = zone?.name ?? s.zoneId ?? '';
      if (s.zoneId !== null && s.zoneId !== prevZone) {
        if (prevZone !== null && !zonesSeen.has(s.zoneId)) found.set('zone', { event: `You just arrived in ${zoneName}, a new place.`, vars: { zone: zoneName.split(',')[0]! }, key: s.zoneId });
        zonesSeen.add(s.zoneId);
      }
      prevZone = s.zoneId;
      if (s.timeOfDay !== null) {
        const night = isNight(s.timeOfDay);
        if (prevNight === false && night) found.set('night', { event: 'Night is falling.', vars: {}, key: 'night' });
        prevNight = night;
      }
      if (prevBattle && !s.inBattle && s.lead !== null && s.lead.hpFrac > 0 && s.lead.hpFrac <= lowHp) {
        found.set('lowHp', { event: 'You are hurt after the battle and need rest.', vars: {}, key: 'lowHp' });
      }
      prevBattle = s.inBattle;
      for (const sp of s.spawns) {
        if (spawnsSeen.has(sp.id)) continue;
        spawnsSeen.add(sp.id);
        if (found.has('rare')) continue;
        const name = speciesById.get(sp.speciesId)?.name ?? sp.speciesId;
        const what = `${sp.shiny ? 'shiny ' : ''}${sp.alpha ? 'alpha ' : ''}${name}`;
        found.set('rare', { event: `A ${what} is nearby.`, vars: { what }, key: sp.id });
      }
      const lead = s.lead;
      if (lead !== null && zone !== undefined) {
        const waterKey = `${lead.id}:${zone.id}:water`;
        const homeKey = `${lead.id}:${zone.id}:home`;
        if (s.nearWater && lead.types.includes('Water') && !placesSaid.has(waterKey)) {
          found.set('place', { event: 'You are at the edge of the water, and you are a Water type.', vars: {}, place: 'water', key: waterKey });
        } else if (!placesSaid.has(homeKey) && (BIOME_TYPES[zone.biome] ?? []).some((t) => lead.types.includes(t))) {
          found.set('place', { event: `${zoneName} feels like home to a ${lead.types[0]} type like you.`, vars: {}, place: 'home', key: homeKey });
        }
      }
      // may the lead speak now?
      if (lead === null || s.busy || s.inBattle || s.now - started < warmup || s.now - last < gap) return null;
      for (const kind of PRIORITY) {
        const f = found.get(kind);
        if (f === undefined) continue;
        if (s.now - (lastKind.get(kind) ?? Number.NEGATIVE_INFINITY) < kindGap) continue;
        last = s.now;
        lastKind.set(kind, s.now);
        if (kind === 'place') placesSaid.add(f.key);
        const v = voice(lead);
        const seed = seedOf(`${lead.id}:${kind}:${f.key}`);
        const body = kind === 'place' ? pick(PLACE_LINES[f.place ?? 'home'], seed) : fill(pick(TEMPLATES[kind], seed), f.vars);
        return { kind, event: f.event, template: `${soundOf(v, seed)} ${body}` };
      }
      return null;
    },
  };
}
