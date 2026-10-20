/**
 * Arena PvP content (30-server-netcode.md §30.4.10): the Weekly Cup rotation (legacy liveOps.js WEEKLY_CUPS, re-keyed to
 * this game's species and zones) and the AI training opponents. Pure data plus the rules the server enforces and the
 * client shows before a player queues.
 */
import type { WeeklyCupDef, ZoneId } from '../types';
import { SPECIES } from './species';
import { TOWER } from './tower';
import { ZONES } from './zones';

/** Every cup fights at Lv 50 with a full party. */
export const CUP_PARTY_SIZE = 6;

/** The three starters (protocol STARTERS); a starter line is any species whose evolution root is one of them. */
export const STARTER_ROOTS: readonly string[] = Object.freeze(['bramblecub', 'glimfin', 'cindercap']);

/** The featured zones the Origin Grounds cup cycles through, one per appearance (routes with a full wild table). */
const ORIGIN_ZONES: readonly ZoneId[] = ['mire_route', 'ash_route', 'tide_route', 'galvan_route', 'deepcut_route', 'hollow_route', 'siege_route', 'ascent_route'];

/** The rotation, one cup per week (Monday 00:00 UTC), in this order. */
export const WEEKLY_CUPS: readonly WeeklyCupDef[] = Object.freeze([
  { id: 'cup_mirror_clause', name: 'Mirror Clause Cup', description: 'No type may appear more than once across your party of six.', rule: { kind: 'noRepeatedTypes' } },
  { id: 'cup_starter_bond', name: 'Starter Bond Cup', description: 'Bring at least two Ewamon from the starter lines.', rule: { kind: 'starterLines', count: 2 } },
  { id: 'cup_origin_grounds', name: 'Origin Grounds Cup', description: 'Bring at least three Ewamon caught on the featured route.', rule: { kind: 'caughtIn', count: 3, zones: ORIGIN_ZONES } },
  { id: 'cup_mono_pulse', name: 'Mono Pulse Cup', description: 'Every Ewamon in your party must share one type.', rule: { kind: 'sharedType' } },
]);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Monday 1970-01-05 00:00 UTC: weeks are counted from here. */
const FIRST_MONDAY_MS = 4 * 24 * 60 * 60 * 1000;

export interface ActiveCup {
  readonly def: WeeklyCupDef;
  /** the featured zone of a `caughtIn` cup this week; null for the other rules */
  readonly zone: ZoneId | null;
  /** the cup's description with the featured zone filled in */
  readonly description: string;
  readonly startsAt: number;
  readonly endsAt: number;
}

/** The cup running at `atMs` (unix ms). */
export function weeklyCup(atMs: number): ActiveCup {
  const week = Math.floor((atMs - FIRST_MONDAY_MS) / WEEK_MS);
  const def = WEEKLY_CUPS[((week % WEEKLY_CUPS.length) + WEEKLY_CUPS.length) % WEEKLY_CUPS.length]!;
  const startsAt = FIRST_MONDAY_MS + week * WEEK_MS;
  let zone: ZoneId | null = null;
  let description = def.description;
  if (def.rule.kind === 'caughtIn') {
    const appearance = Math.floor(week / WEEKLY_CUPS.length);
    zone = def.rule.zones[((appearance % def.rule.zones.length) + def.rule.zones.length) % def.rule.zones.length]!;
    description = `Bring at least ${def.rule.count} Ewamon caught on ${zoneLabel(zone)}.`;
  }
  return { def, zone, description, startsAt, endsAt: startsAt + WEEK_MS };
}

const byId = new Map(SPECIES.map((s) => [s.id, s]));

/** The first stage of a species' line (walks `evolvesFrom`). */
export function evolutionRoot(speciesId: string): string {
  let id = speciesId;
  for (let guard = 0; guard < 8; guard++) {
    const prev = byId.get(id)?.evolvesFrom ?? null;
    if (prev === null) return id;
    id = prev;
  }
  return id;
}

/** The party member fields a cup reads. */
export interface CupMember {
  readonly speciesId: string;
  readonly caughtAt: { readonly zoneId: string } | null;
}

/** Why `party` cannot enter `cup` (a sentence for the player), or null when it can. */
export function cupRefusal(party: readonly CupMember[], cup: ActiveCup): string | null {
  if (party.length < CUP_PARTY_SIZE) return `The ${cup.def.name} needs a full party of ${CUP_PARTY_SIZE}.`;
  const typesOf = (m: CupMember): readonly string[] => byId.get(m.speciesId)?.types ?? [];
  const rule = cup.def.rule;
  switch (rule.kind) {
    case 'noRepeatedTypes': {
      const seen = new Set<string>();
      for (const m of party) {
        for (const t of typesOf(m)) {
          if (seen.has(t)) return `The ${t} type appears more than once in your party.`;
          seen.add(t);
        }
      }
      return null;
    }
    case 'starterLines': {
      const n = party.filter((m) => STARTER_ROOTS.includes(evolutionRoot(m.speciesId))).length;
      return n >= rule.count ? null : `Bring at least ${rule.count} Ewamon from the starter lines (you have ${n}).`;
    }
    case 'caughtIn': {
      const n = party.filter((m) => m.caughtAt !== null && m.caughtAt.zoneId === cup.zone).length;
      return n >= rule.count ? null : `Bring at least ${rule.count} Ewamon caught on ${zoneLabel(cup.zone ?? '')} (you have ${n}).`;
    }
    case 'sharedType': {
      const first = typesOf(party[0]!);
      const shared = first.find((t) => party.every((m) => typesOf(m).includes(t)));
      return shared !== undefined ? null : 'Every Ewamon in your party must share one type.';
    }
  }
}

function zoneLabel(zoneId: string): string {
  return ZONES.find((z) => z.id === zoneId)?.name ?? zoneId;
}

/**
 * AI training: the sparring partner per difficulty — its name, the tower pool its species come from, and the team size
 * (at most the player's own usable party size). The AI is core's `chooseNpcAction`, as every trainer.
 */
export const ARENA_TRAINING: Readonly<Record<'easy' | 'normal' | 'hard', { readonly name: string; readonly trainerId: string; readonly pool: readonly string[] }>> = Object.freeze({
  easy: { name: 'Sparring Rookie', trainerId: 'arena.training.easy', pool: TOWER.pools[0]! },
  normal: { name: 'Sparring Partner', trainerId: 'arena.training.normal', pool: TOWER.pools[1]! },
  hard: { name: 'Sparring Ace', trainerId: 'arena.training.hard', pool: TOWER.pools[TOWER.pools.length - 1]! },
});

/** The daily challenge's AI side (the server's game/daily.ts builds its team; the client names and dresses it). */
export const ARENA_DAILY: { readonly name: string; readonly trainerId: string } = Object.freeze({ name: 'Daily Rival', trainerId: 'arena.daily' });
