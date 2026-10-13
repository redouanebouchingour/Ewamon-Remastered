/**
 * Roster coverage — spine §3.10 rule 7 plus roster-coverage.md RC-1 … RC-13 (RC-13's walkability half runs in
 * validate.ts rule 9 where the heightfield is available). Pure; returns the RosterReport with `ruleFailures`.
 */
import { evolutionChildren } from '@ewa/core';
import type { SpeciesDef } from '@ewa/core';
import type {
  AcquisitionPath,
  BattlePassReward,
  DailySwarm,
  EncounterTable,
  LegendaryStatic,
  QuestDef,
  RaidHotspot,
  RosterReport,
  ZoneDef,
  ZoneId,
} from './types';
import { ZONE_SIZE } from './types';

export interface RosterInputs {
  readonly species: readonly SpeciesDef[];
  readonly zones: readonly ZoneDef[];
  readonly tables: readonly EncounterTable[];
  readonly statics: readonly LegendaryStatic[];
  readonly swarms: readonly DailySwarm[];
  readonly raids: readonly RaidHotspot[];
  readonly quests: readonly QuestDef[];
  readonly battlePass: readonly BattlePassReward[];
  readonly bands: Readonly<Partial<Record<ZoneId, readonly [number, number]>>>;
  readonly legendaryIds: readonly string[];
  readonly mythicalIds: readonly string[];
}

const TIER_WEIGHT: Readonly<Record<string, readonly [number, number]>> = {
  common: [6, 9],
  uncommon: [5, 5],
  rare: [2, 4],
  alpha: [1, 1],
};

export type Stage = 'single' | 'base' | 'mid' | 'final';

export function childrenOf(s: SpeciesDef): readonly string[] {
  return evolutionChildren(s.evolution);
}

/** The level a species evolves at — 0 for none and for the Phase D3 stone / trade kinds (no level gates them). */
export function evolveLevelOf(s: SpeciesDef | undefined): number {
  const e = s?.evolution ?? null;
  return e !== null && (e.kind === 'level' || e.kind === 'split') ? e.atLevel : 0;
}

export function stageOf(s: SpeciesDef): Stage {
  const hasChild = childrenOf(s).length > 0;
  const hasParent = s.evolvesFrom !== null;
  if (!hasParent && !hasChild) return 'single';
  if (!hasParent) return 'base';
  return hasChild ? 'mid' : 'final';
}

export function computeRosterReport(input: RosterInputs): RosterReport {
  const byId = new Map<string, SpeciesDef>(input.species.map((s) => [s.id, s]));
  const zoneById = new Map<ZoneId, ZoneDef>(input.zones.map((z) => [z.id, z]));
  const fail: string[] = [];
  const legendary = new Set(input.legendaryIds);
  const mythical = new Set(input.mythicalIds);
  const nocturnal = (s: SpeciesDef): boolean => s.types.includes('Ghost') || s.types.includes('Dark');

  // roots / families
  // 72 roots: 61 non-legendary families (57 legacy + hollowmane + dustcub + veilpup + castlemaw) + the 11 legendary/mythical singles (hyoryu post-legacy)
  const roots = input.species.filter((s) => s.evolvesFrom === null);
  const familyCount = roots.length;

  // E: directly placed
  const E = new Set<string>();
  const wildZones = new Map<string, ZoneId[]>();
  const raidZones = new Map<string, ZoneId[]>();
  const perZone: Partial<Record<ZoneId, string[]>> = {};

  for (const t of input.tables) {
    const zone = zoneById.get(t.zoneId);
    const band = input.bands[t.zoneId];
    if (band === undefined) {
      fail.push(`${t.zoneId}: no band defined`);
      continue;
    }
    const [lo, hi] = band;
    const kind = zone?.kind ?? 'route';
    let alpha = 0;
    let anyN = 0;
    let dayOK = 0;
    let nightOK = 0;
    const seen = new Set<string>();
    const distinct = new Set<string>();
    for (const s of t.slots) {
      const sp = byId.get(s.species);
      if (sp === undefined) {
        fail.push(`${t.zoneId}: unknown species ${s.species}`);
        continue;
      }
      E.add(sp.id);
      distinct.add(sp.id);
      const zs = wildZones.get(sp.id) ?? [];
      if (!zs.includes(t.zoneId)) zs.push(t.zoneId);
      wildZones.set(sp.id, zs);
      const st = stageOf(sp);
      if (legendary.has(sp.id) || mythical.has(sp.id)) fail.push(`${t.zoneId}: legendary/mythical ${sp.id} in a table (RC-4)`);
      if (st === 'final' && sp.id !== 'aonred' && sp.id !== 'darkyon') fail.push(`${t.zoneId}: final form ${sp.id} spawns wild (RC-6)`);
      if (st === 'mid') {
        const parent = byId.get(sp.evolvesFrom!);
        const at = evolveLevelOf(parent);
        if (s.levelMin < at + 2) fail.push(`${t.zoneId}: mid ${sp.id} levelMin ${s.levelMin} < evolvesAt+2 (RC-5)`);
      }
      if (nocturnal(sp) && s.timeOfDay !== 'night') fail.push(`${t.zoneId}: Ghost/Dark ${sp.id} not night (RC-7)`);
      if (kind === 'story' && st === 'base' && evolveLevelOf(sp) > lo) {
        fail.push(`${t.zoneId}: story-zone base ${sp.id} evolvesAt ${evolveLevelOf(sp)} > band min ${lo} (RC-9)`);
      }
      if (s.levelMin > s.levelMax) fail.push(`${t.zoneId}: ${sp.id} levelMin > levelMax`);
      if (s.levelMin < lo || s.levelMax > hi) fail.push(`${t.zoneId}: ${sp.id} [${s.levelMin},${s.levelMax}] outside band [${lo},${hi}] (RC-2)`);
      const tw = TIER_WEIGHT[s.tier]!;
      if (s.weight < tw[0] || s.weight > tw[1]) fail.push(`${t.zoneId}: ${sp.id} ${s.tier} weight ${s.weight} not in [${tw[0]},${tw[1]}] (RC-3)`);
      if (s.tier === 'alpha') {
        alpha++;
        if (s.levelMin !== hi || s.levelMax !== hi) fail.push(`${t.zoneId}: alpha slot must be [${hi},${hi}] (RC-8)`);
      }
      if (s.timeOfDay === 'any') anyN++;
      if (s.timeOfDay !== 'night') dayOK++;
      if (s.timeOfDay !== 'day') nightOK++;
      const k = `${sp.id}|${s.timeOfDay}|${s.tier}`;
      if (seen.has(k)) fail.push(`${t.zoneId}: duplicate slot ${k} (RC-11)`);
      seen.add(k);
    }
    if (kind === 'route' && alpha !== 1) fail.push(`${t.zoneId}: route needs exactly one alpha slot, has ${alpha} (RC-8)`);
    if (kind !== 'route' && alpha !== 0) fail.push(`${t.zoneId}: only routes carry alpha slots (RC-8)`);
    if (anyN < 3) fail.push(`${t.zoneId}: fewer than 3 'any' slots (RC-10)`);
    if (dayOK < 4 || nightOK < 4) fail.push(`${t.zoneId}: needs >= 4 day-eligible and >= 4 night-eligible slots (day ${dayOK}, night ${nightOK}) (RC-10)`);
    if (t.slots.length > 16 || distinct.size > 14) fail.push(`${t.zoneId}: over budget — ${t.slots.length} slots / ${distinct.size} species (§13)`);
    perZone[t.zoneId] = [...distinct].sort();
  }
  for (const z of Object.keys(input.bands).sort() as ZoneId[]) {
    if (!input.tables.some((t) => t.zoneId === z)) fail.push(`missing table for ${z}`);
  }

  // swarms (RC-12)
  const weekdays = new Set<number>();
  input.swarms.forEach((sw, i) => {
    weekdays.add(i);
    const zs = new Set(input.tables.filter((t) => t.zoneId === sw.zoneId).flatMap((t) => t.slots.map((s) => s.species)));
    for (const sp of sw.species) {
      if (!zs.has(sp)) fail.push(`swarm ${sw.zoneId}: ${sp} not in that zone's table (RC-12)`);
      if (byId.has(sp)) E.add(sp);
    }
  });
  if (input.swarms.length !== 7) fail.push(`swarms: need weekday 0..6 exactly once (have ${input.swarms.length})`);

  // raids
  for (const r of input.raids) {
    const sp = byId.get(r.boss.species);
    if (sp === undefined) fail.push(`raid ${r.id}: unknown boss ${r.boss.species}`);
    else {
      E.add(sp.id);
      const zs = raidZones.get(sp.id) ?? [];
      zs.push(r.zoneId);
      raidZones.set(sp.id, zs);
      if (legendary.has(sp.id) || mythical.has(sp.id)) fail.push(`raid ${r.id}: legendary boss (RC-4)`);
    }
    const zone = zoneById.get(r.zoneId);
    const h = zone === undefined ? 119 : ZONE_SIZE[zone.kind] / 2 - 1;
    if (Math.abs(r.x) > h || Math.abs(r.z) > h) fail.push(`raid ${r.id}: (${r.x},${r.z}) outside ±${h} (RC-13)`);
  }
  if (input.raids.length !== 8) fail.push(`raids: expected 8, have ${input.raids.length}`);

  // quest / battle-pass creatures
  const questFor = new Map<string, string>();
  for (const q of input.quests) {
    if (q.rewards.creature !== null) {
      E.add(q.rewards.creature.species);
      questFor.set(q.rewards.creature.species, q.id);
    }
  }
  for (const b of input.battlePass) if (b.creature !== null) E.add(b.creature.species);

  // statics
  for (const l of input.statics) {
    if (!legendary.has(l.species)) fail.push(`static ${l.species} is not a legendary (RC-4)`);
    const zone = zoneById.get(l.zoneId);
    const h = zone === undefined ? 119 : ZONE_SIZE[zone.kind] / 2 - 1;
    if (Math.abs(l.x) > h || Math.abs(l.z) > h) fail.push(`static ${l.species}: (${l.x},${l.z}) outside ±${h} (RC-13)`);
  }
  const staticSpecies = new Set(input.statics.map((l) => l.species));
  if (staticSpecies.size !== 9 || input.statics.length !== 9) fail.push(`LEGENDARY_STATICS must be exactly the 9 legendaries (have ${input.statics.length})`);
  for (const id of input.legendaryIds) if (!staticSpecies.has(id)) fail.push(`legendary ${id} has no static`);

  // closure
  const R = new Set<string>(E);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...R].sort()) {
      const sp = byId.get(id);
      if (sp === undefined) continue;
      for (const c of childrenOf(sp)) {
        if (!R.has(c)) {
          R.add(c);
          grew = true;
        }
      }
    }
  }
  for (const l of input.statics) R.add(l.species);
  for (const m of input.mythicalIds) {
    if (questFor.has(m) || input.battlePass.some((b) => b.mythicalChoice?.includes(m))) R.add(m);
    else fail.push(`mythical ${m} is neither a quest rewards.creature nor the battle-pass 50 choice`);
  }
  const unobtainable = input.species.map((s) => s.id).filter((id) => !R.has(id));
  if (unobtainable.length > 0) fail.push(`unobtainable: ${unobtainable.join(', ')}`);
  for (const r of roots) {
    if (!legendary.has(r.id) && !mythical.has(r.id) && !E.has(r.id)) fail.push(`root ${r.id} never spawns (RC-1)`);
  }

  // primary path per species
  const paths: Record<string, AcquisitionPath> = {};
  for (const s of input.species) {
    const w = wildZones.get(s.id);
    const st = input.statics.find((l) => l.species === s.id);
    const q = questFor.get(s.id);
    const rz = raidZones.get(s.id);
    if (w !== undefined) paths[s.id] = { kind: 'wild', zones: [...w].sort() };
    else if (st !== undefined) paths[s.id] = { kind: 'static', zoneId: st.zoneId, when: st.when };
    else if (q !== undefined) paths[s.id] = { kind: 'quest', questId: q };
    else if (rz !== undefined) paths[s.id] = { kind: 'raid', zones: [...rz].sort() };
    else if (s.evolvesFrom !== null) {
      const parent = byId.get(s.evolvesFrom);
      const evo = parent?.evolution ?? null;
      if (evo !== null && evo.kind === 'item') paths[s.id] = { kind: 'item', from: s.evolvesFrom, item: evo.item };
      else if (evo !== null && evo.kind === 'trade') paths[s.id] = { kind: 'trade', from: s.evolvesFrom };
      else paths[s.id] = { kind: 'evolve', from: s.evolvesFrom, atLevel: evolveLevelOf(parent) };
    }
  }

  return {
    species: input.species.length,
    families: familyCount,
    directlyPlaced: E.size,
    obtainable: R.size,
    unobtainable,
    paths,
    perZone,
    ruleFailures: fail,
  };
}
