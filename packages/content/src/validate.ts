/**
 * §3.10 validate.ts — the build gate, as a pure function. Every rule 1–12 of the spine plus the §3.3 league,
 * §3.4 quest, §3.5 story, §3.6 live-ops and §3.12 body checks. Returns `{ ok, errors, stats }`; the CLI wrapper in
 * scripts/validate-cli.ts prints and exits non-zero. Nothing here touches disk.
 */
import { TYPE_NAMES } from '@ewa/core';
import type { ConsumableDef, ItemDef, MoveDef, OrbDef, SpeciesDef } from '@ewa/core';
import type {
  BadgeId,
  LinkDir,
  RosterReport,
  ValidationResult,
  ValidationStats,
  ZoneDef,
  ZoneId,
} from './types';
import { BADGE_ORDER, ZONE_MARGIN, ZONE_ORDER, ZONE_SIZE } from './types';
import {
  AbilityDefSchema,
  BattlePassRewardSchema,
  BodyDefSchema,
  ConsumableDefSchema,
  DailySwarmSchema,
  EncounterTableSchema,
  ItemDefSchema,
  LeagueTrainerSchema,
  LegendaryStaticSchema,
  MoveDefSchema,
  OrbDefSchema,
  QuestDefSchema,
  RaidHotspotSchema,
  SeasonalEventSchema,
  SpeciesDefSchema,
  StoryBeatSchema,
  TypeChartSchema,
  ZoneDefSchema,
  schemaErrors,
} from './schema';
import { SPECIES } from './data/species';
import { MOVES } from './data/moves';
import { ABILITIES } from './data/abilities';
import { ITEMS } from './data/items';
import { ORBS } from './data/orbs';
import { CONSUMABLES } from './data/consumables';
import { TYPE_CHART } from './data/typechart';
import { ZONES } from './data/zones';
import { ENCOUNTER_BANDS, ENCOUNTER_TABLES } from './data/encounters';
import { LEGENDARY_IDS, LEGENDARY_STATICS, MYTHICAL_IDS } from './data/statics';
import { BADGES, LEAGUE } from './data/league';
import { QUESTS } from './data/quests';
import { STORY } from './data/story';
import { DAILY_SWARMS, RAID_HOTSPOTS, SEASONAL_EVENTS } from './data/liveops';
import { BATTLE_PASS } from './data/battlePass';
import { BODIES, LOOKS, TITLES } from './data/bodies';
import { SHOP_STOCK_DEFAULT } from './data/shop';
import { FLAG_REGISTRY, isKnownFlag } from './flags';
import { computeRosterReport } from './roster';
import { getHeightfield, isWater, nearestWalkable, walkableRatio, waterRatio } from './heightfield';
import type { Heightfield } from './heightfield';
import { beatDoneFlag, BEAT_DONE_PREFIX } from './story';

/** Legacy orb prices (§3.10 rule 10: "orb prices are the legacy values"). */
const LEGACY_ORB_PRICES: Readonly<Record<string, number>> = {
  spark_orb: 200,
  crest_orb: 600,
  prism_orb: 1200,
  aether_orb: 50000,
  mythos_orb: 5000,
  verdant_orb: 800,
  ember_orb: 800,
  tide_orb: 800,
  dusk_orb: 900,
  phantom_orb: 900,
};

const OPPOSITE: Readonly<Record<LinkDir, LinkDir>> = { n: 's', s: 'n', e: 'w', w: 'e' };

export interface ValidateOptions {
  /** Skip the heightfield rules (9's walkability half and 12). Tests that mutate data use this to stay fast. */
  readonly skipHeightfields?: boolean;
}

/** Data inputs, overridable for mutation tests. */
export interface ContentTables {
  readonly species: readonly SpeciesDef[];
  readonly moves: readonly MoveDef[];
  readonly items: readonly ItemDef[];
  readonly orbs: readonly OrbDef[];
  readonly consumables: readonly ConsumableDef[];
  readonly zones: readonly ZoneDef[];
}

export const DEFAULT_TABLES: ContentTables = {
  species: SPECIES,
  moves: MOVES,
  items: ITEMS,
  orbs: ORBS,
  consumables: CONSUMABLES,
  zones: ZONES,
};

export function validate(opts: ValidateOptions = {}, tables: ContentTables = DEFAULT_TABLES): ValidationResult {
  const errors: string[] = [];
  const err = (s: string): void => {
    errors.push(s);
  };
  const { species, moves, items, orbs, consumables, zones } = tables;

  // ── 1. schemas ──
  const idOf = (r: unknown): string => String((r as { id?: unknown })?.id ?? '?');
  errors.push(...schemaErrors('SPECIES', SpeciesDefSchema, species, idOf));
  errors.push(...schemaErrors('MOVES', MoveDefSchema, moves, idOf));
  errors.push(...schemaErrors('ABILITIES', AbilityDefSchema, ABILITIES, idOf));
  errors.push(...schemaErrors('ITEMS', ItemDefSchema, items, idOf));
  errors.push(...schemaErrors('ORBS', OrbDefSchema, orbs, idOf));
  errors.push(...schemaErrors('CONSUMABLES', ConsumableDefSchema, consumables, idOf));
  errors.push(...schemaErrors('ZONES', ZoneDefSchema, zones, idOf));
  errors.push(...schemaErrors('ENCOUNTER_TABLES', EncounterTableSchema, ENCOUNTER_TABLES, idOf));
  errors.push(...schemaErrors('LEGENDARY_STATICS', LegendaryStaticSchema, LEGENDARY_STATICS, (r) => String((r as { species?: unknown })?.species)));
  errors.push(...schemaErrors('LEAGUE', LeagueTrainerSchema, LEAGUE, idOf));
  errors.push(...schemaErrors('QUESTS', QuestDefSchema, QUESTS, idOf));
  errors.push(...schemaErrors('STORY', StoryBeatSchema, STORY, idOf));
  errors.push(...schemaErrors('SEASONAL_EVENTS', SeasonalEventSchema, SEASONAL_EVENTS, idOf));
  errors.push(...schemaErrors('DAILY_SWARMS', DailySwarmSchema, DAILY_SWARMS, idOf));
  errors.push(...schemaErrors('RAID_HOTSPOTS', RaidHotspotSchema, RAID_HOTSPOTS, idOf));
  errors.push(...schemaErrors('BATTLE_PASS', BattlePassRewardSchema, BATTLE_PASS, (r) => String((r as { level?: unknown })?.level)));
  errors.push(...schemaErrors('BODIES', BodyDefSchema, BODIES, idOf));
  {
    const r = TypeChartSchema.safeParse(TYPE_CHART);
    if (!r.success) for (const i of r.error.issues) err(`TYPE_CHART: ${i.path.join('.')} ${i.message}`);
  }

  // ── lookups ──
  const speciesById = new Map(species.map((s) => [s.id, s]));
  const moveIds = new Set(moves.map((m) => m.id));
  const abilityIds = new Set(ABILITIES.map((a) => a.id));
  const itemIds = new Set(items.map((i) => i.id));
  const orbIds = new Set(orbs.map((o) => o.id));
  const consumableIds = new Set(consumables.map((c) => c.id));
  const anyItem = (id: string): boolean => itemIds.has(id) || orbIds.has(id) || consumableIds.has(id);
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const tableIds = new Set(ENCOUNTER_TABLES.map((t) => t.id));
  const leagueIds = new Set(LEAGUE.map((l) => l.id));
  const npcIds = new Set(zones.flatMap((z) => z.npcs.map((n) => n.id)));
  const trainerIds = new Set(zones.flatMap((z) => z.trainers.map((t) => t.id)));
  const looks = new Set(LOOKS);
  const legendary = new Set(LEGENDARY_IDS);
  const mythical = new Set(MYTHICAL_IDS);

  // flags set anywhere (for §3.5 need resolution)
  const setFlags = new Set<string>();
  for (const b of STORY) for (const f of b.set) setFlags.add(f);
  for (const q of QUESTS) if (q.rewards.flag !== null) setFlags.add(q.rewards.flag);
  for (const l of LEAGUE) for (const f of l.setsFlags) setFlags.add(f);
  for (const s of LEGENDARY_STATICS) setFlags.add(s.flag);
  const flagResolvable = (f: string): boolean => f.startsWith('badge:') || setFlags.has(f);
  const checkFlag = (where: string, f: string): void => {
    if (!isKnownFlag(f)) err(`${where}: flag '${f}' is not in the §11 registry`);
    if (f.startsWith(BEAT_DONE_PREFIX)) err(`${where}: flag '${f}' uses the reserved beat-done prefix`);
  };

  // ── 2. dangling ids ──
  for (const s of species) {
    for (const m of s.moves) if (!moveIds.has(m)) err(`species ${s.id}: default move '${m}' not in MOVES`);
    for (const e of s.learnableMoves) if (!moveIds.has(e.move)) err(`species ${s.id}: learnable move '${e.move}' not in MOVES`);
    for (const a of s.abilities) if (!abilityIds.has(a)) err(`species ${s.id}: ability '${a}' not in ABILITIES`);
    if (s.evolution !== null) {
      const intos = s.evolution.kind === 'level' ? [s.evolution.into] : s.evolution.branches.map((b) => b.into);
      for (const into of intos) if (!speciesById.has(into)) err(`species ${s.id}: evolution.into '${into}' not in SPECIES`);
      if (s.evolution.kind === 'split') {
        for (const b of s.evolution.branches) {
          if (b.condition !== null && !abilityIds.has(b.condition.ability)) err(`species ${s.id}: split condition ability '${b.condition.ability}' unknown`);
        }
      }
    }
    if (s.evolvesFrom !== null && !speciesById.has(s.evolvesFrom)) err(`species ${s.id}: evolvesFrom '${s.evolvesFrom}' not in SPECIES`);
  }
  for (const z of zones) {
    for (const dir of Object.keys(z.links).sort() as LinkDir[]) {
      const to = z.links[dir]!;
      if (!zoneById.has(to)) err(`zone ${z.id}: link ${dir} → '${to}' not in ZONES`);
    }
    if (z.gym !== null && !leagueIds.has(z.gym)) err(`zone ${z.id}: gym '${z.gym}' not in LEAGUE`);
    if (z.encounterTable !== null && !tableIds.has(z.encounterTable)) err(`zone ${z.id}: encounterTable '${z.encounterTable}' unknown`);
    if (z.encounterTable !== null && z.encounterTable !== `enc_${z.id}`) err(`zone ${z.id}: encounterTable must be 'enc_${z.id}'`);
    if (z.shop !== null) for (const id of z.shop) if (!anyItem(id)) err(`zone ${z.id}: shop item '${id}' unknown`);
    for (const gi of z.items) if (!anyItem(gi.item)) err(`zone ${z.id}: ground item '${gi.item}' unknown`);
    for (const t of z.trainers) {
      for (const m of t.team) if (!speciesById.has(m.species)) err(`trainer ${t.id}: species '${m.species}' unknown`);
      if (!looks.has(t.look)) err(`trainer ${t.id}: look '${t.look}' not in LOOKS`);
    }
    for (const n of z.npcs) {
      if (!looks.has(n.look)) err(`npc ${n.id}: look '${n.look}' not in LOOKS`);
      if (!n.id.startsWith(`${z.id}.`)) err(`npc ${n.id}: id must be '<zoneId>.<role>' in zone ${z.id}`);
      if (n.when !== null) checkFlag(`npc ${n.id}.when`, n.when);
      if (n.until !== null) checkFlag(`npc ${n.id}.until`, n.until);
      for (const r of n.react) checkFlag(`npc ${n.id}.react`, r.when);
    }
  }
  const tableZones = new Set<ZoneId>();
  for (const t of ENCOUNTER_TABLES) {
    if (tableZones.has(t.zoneId)) err(`table ${t.id}: second table for zone ${t.zoneId}`);
    tableZones.add(t.zoneId);
    const z = zoneById.get(t.zoneId);
    if (z === undefined || z.encounterTable !== t.id) err(`table ${t.id}: zone ${t.zoneId} does not reference it`);
    for (const s of t.slots) if (!speciesById.has(s.species)) err(`table ${t.id}: species '${s.species}' unknown`);
  }
  for (const l of LEAGUE) {
    for (const m of l.team) {
      if (!speciesById.has(m.species)) err(`league ${l.id}: species '${m.species}' unknown`);
      if (m.ability !== null && !abilityIds.has(m.ability)) err(`league ${l.id}: ability '${m.ability}' unknown`);
      if (m.heldItem !== null && !itemIds.has(m.heldItem)) err(`league ${l.id}: held item '${m.heldItem}' unknown`);
    }
    if (!looks.has(l.look)) err(`league ${l.id}: look '${l.look}' not in LOOKS`);
    if (!zoneById.has(l.zoneId)) err(`league ${l.id}: zone '${l.zoneId}' unknown`);
    for (const f of l.setsFlags) checkFlag(`league ${l.id}.setsFlags`, f);
  }
  for (const q of QUESTS) {
    const zone = zoneById.get(q.zoneId);
    if (q.giver !== null && !(zone?.npcs.some((n) => n.id === q.giver) ?? false)) err(`quest ${q.id}: giver '${q.giver}' is not an NpcDef of ${q.zoneId}`);
    for (const r of q.requires) if (!QUESTS.some((o) => o.id === r)) err(`quest ${q.id}: requires unknown quest '${r}'`);
    for (const o of q.objectives) {
      const ob = o.objective;
      if (ob.kind === 'catchSpecific' && !speciesById.has(ob.species)) err(`quest ${q.id}/${o.id}: species '${ob.species}' unknown`);
      if (ob.kind === 'defeatTrainer' && !trainerIds.has(ob.trainerId) && !leagueIds.has(ob.trainerId)) err(`quest ${q.id}/${o.id}: trainer '${ob.trainerId}' unknown`);
      if (ob.kind === 'talkTo' && !npcIds.has(ob.npcId)) err(`quest ${q.id}/${o.id}: npc '${ob.npcId}' unknown`);
      if (ob.kind === 'deliverItem') {
        if (!npcIds.has(ob.npcId)) err(`quest ${q.id}/${o.id}: npc '${ob.npcId}' unknown`);
        if (!anyItem(ob.item)) err(`quest ${q.id}/${o.id}: item '${ob.item}' unknown`);
      }
      if (ob.kind === 'flag') {
        checkFlag(`quest ${q.id}/${o.id}`, ob.flag);
        if (!flagResolvable(ob.flag)) err(`quest ${q.id}/${o.id}: flag '${ob.flag}' is never set`);
      }
    }
    for (const id of Object.keys(q.rewards.items).sort()) if (!anyItem(id)) err(`quest ${q.id}: reward item '${id}' unknown`);
    if (q.rewards.creature !== null && !speciesById.has(q.rewards.creature.species)) err(`quest ${q.id}: reward species unknown`);
    if (q.rewards.flag !== null) checkFlag(`quest ${q.id}.rewards.flag`, q.rewards.flag);
  }
  for (const b of STORY) {
    if (!npcIds.has(b.speaker) && !leagueIds.has(b.speaker)) err(`beat ${b.id}: speaker '${b.speaker}' is neither an npc nor a league id`);
    if (b.battle !== null && !trainerIds.has(b.battle.trainerId) && !leagueIds.has(b.battle.trainerId)) err(`beat ${b.id}: battle trainer '${b.battle.trainerId}' unknown`);
    for (const f of b.need) {
      checkFlag(`beat ${b.id}.need`, f);
      if (!flagResolvable(f)) err(`beat ${b.id}: need '${f}' is neither badge: nor set by any beat/quest/league row`);
    }
    for (const f of b.set) checkFlag(`beat ${b.id}.set`, f);
    if (b.speaker.includes('.')) {
      const zoneOfSpeaker = b.speaker.slice(0, b.speaker.indexOf('.'));
      if (zoneOfSpeaker !== b.zoneId) err(`beat ${b.id}: speaker '${b.speaker}' is not an npc of ${b.zoneId}`);
    } else {
      const l = LEAGUE.find((x) => x.id === b.speaker);
      if (l !== undefined && l.zoneId !== b.zoneId) err(`beat ${b.id}: league speaker '${b.speaker}' sits in ${l.zoneId}, not ${b.zoneId}`);
    }
  }
  for (const s of LEGENDARY_STATICS) {
    if (!speciesById.has(s.species)) err(`static ${s.species}: unknown species`);
    checkFlag(`static ${s.species}.flag`, s.flag);
    if (s.when.startsWith('flag:')) {
      const f = s.when.slice(5);
      checkFlag(`static ${s.species}.when`, f);
      if (!flagResolvable(f)) err(`static ${s.species}: gate flag '${f}' is never set`);
    } else if (!BADGE_ORDER.includes(s.when.slice(6) as BadgeId)) err(`static ${s.species}: bad badge gate '${s.when}'`);
  }
  for (const sw of DAILY_SWARMS) for (const sp of sw.species) if (!speciesById.has(sp)) err(`swarm ${sw.id}: species '${sp}' unknown`);
  for (const r of RAID_HOTSPOTS) if (!speciesById.has(r.boss.species)) err(`raid ${r.id}: boss '${r.boss.species}' unknown`);
  for (const e of SEASONAL_EVENTS) for (const sp of e.featuredSpecies) if (!speciesById.has(sp)) err(`event ${e.id}: species '${sp}' unknown`);
  for (const b of BATTLE_PASS) {
    for (const id of Object.keys(b.items).sort()) if (!anyItem(id)) err(`battle pass ${b.level}: item '${id}' unknown`);
    if (b.creature !== null && !speciesById.has(b.creature.species)) err(`battle pass ${b.level}: species unknown`);
    if (b.mythicalChoice !== null) for (const m of b.mythicalChoice) if (!mythical.has(m)) err(`battle pass ${b.level}: mythicalChoice '${m}' is not a mythical`);
  }
  for (const id of SHOP_STOCK_DEFAULT) if (!anyItem(id)) err(`SHOP_STOCK_DEFAULT: '${id}' unknown`);
  for (const f of FLAG_REGISTRY) if (!f.id.includes(':') && !/^[a-z0-9_]+$/.test(f.id)) err(`flag registry: '${f.id}' is not snake_case`);

  // ── 3. counts ──
  if (species.length !== 130) err(`SPECIES.length ${species.length} !== 130`);
  if (moves.length !== 193) err(`MOVES.length ${moves.length} !== 193`);
  if (TYPE_NAMES.length !== 19) err(`TYPE_NAMES.length ${TYPE_NAMES.length} !== 19`);
  if (ABILITIES.length !== 25) err(`ABILITIES.length ${ABILITIES.length} !== 25`);
  if (items.length !== 17) err(`ITEMS.length ${items.length} !== 17`);
  if (orbs.length !== 10) err(`ORBS.length ${orbs.length} !== 10`);
  if (zones.length !== 21) err(`ZONES.length ${zones.length} !== 21`);
  if (LEAGUE.length !== 12) err(`LEAGUE.length ${LEAGUE.length} !== 12`);
  if (BATTLE_PASS.length !== 100) err(`BATTLE_PASS.length ${BATTLE_PASS.length} !== 100`);
  BATTLE_PASS.forEach((b, i) => {
    if (b.level !== i + 1) err(`BATTLE_PASS[${i}].level ${b.level} !== ${i + 1}`);
  });
  {
    const dex = [...species.map((s) => s.dexNumber)].sort((a, b) => a - b);
    for (let i = 0; i < dex.length; i++) if (dex[i] !== i + 1) { err(`dex numbers are not dense 1..130 (got ${dex[i]} at ${i})`); break; }
    const ids = new Set(species.map((s) => s.id));
    if (ids.size !== species.length) err('duplicate species ids');
    if (moveIds.size !== moves.length) err('duplicate move ids');
    const zoneIdSet = new Set(zones.map((z) => z.id));
    for (const id of ZONE_ORDER) if (!zoneIdSet.has(id)) err(`ZONE_ORDER id '${id}' has no ZoneDef`);
    zones.forEach((z, i) => { if (z.id !== ZONE_ORDER[i]) err(`ZONES[${i}] is '${z.id}', ZONE_ORDER says '${ZONE_ORDER[i]}'`); });
    if (ENCOUNTER_TABLES.length !== 15) err(`ENCOUNTER_TABLES.length ${ENCOUNTER_TABLES.length} !== 15`);
    const legs = species.filter((s) => s.legendary).map((s) => s.id).sort();
    const expected = [...LEGENDARY_IDS, ...MYTHICAL_IDS].sort();
    if (legs.join(',') !== expected.join(',')) err(`legendary flags: ${legs.join(',')} !== ${expected.join(',')}`);
  }

  // ── 4. move effects ──
  for (const m of moves) {
    if (m.effect === 'lower_spAtk') err(`move ${m.id}: effect lower_spAtk must be rewritten to lower_atk`);
    if ((m.effect === 'first') !== (m.priority === 1)) err(`move ${m.id}: effect 'first' ⇔ priority 1 violated`);
    if (m.power === 0 && m.contact) err(`move ${m.id}: power-0 move cannot be contact`);
    if ((m.effect === 'weather' || m.effect === 'sun') && m.target !== 'field') err(`move ${m.id}: weather/sun must target field`);
  }

  // ── 5. learnsets ──
  for (const s of species) {
    const lv = s.learnableMoves;
    for (let i = 1; i < lv.length; i++) if (lv[i]!.level < lv[i - 1]!.level) { err(`species ${s.id}: learnableMoves not sorted by level`); break; }
    const seen = new Set<string>();
    for (const e of lv) { if (seen.has(e.move)) err(`species ${s.id}: duplicate learnable move '${e.move}'`); seen.add(e.move); }
    for (const m of s.moves) if (!lv.some((e) => e.move === m && e.level === 1)) err(`species ${s.id}: default move '${m}' missing at level 1`);
    if (new Set(s.moves).size !== s.moves.length) err(`species ${s.id}: duplicate default moves`);
  }

  // ── 6. evolution trees ──
  {
    const parentOf = new Map<string, string>();
    for (const s of species) {
      if (s.evolution === null) continue;
      if (s.evolution.atLevel < 2 || s.evolution.atLevel > 99) err(`species ${s.id}: evolution.atLevel ${s.evolution.atLevel} outside 2..99`);
      const intos = s.evolution.kind === 'level' ? [s.evolution.into] : s.evolution.branches.map((b) => b.into);
      for (const into of intos) {
        const child = speciesById.get(into);
        if (child !== undefined && child.evolvesFrom !== s.id) err(`species ${into}: evolvesFrom '${child.evolvesFrom}' but ${s.id} evolves into it`);
        if (parentOf.has(into)) err(`species ${into}: two parents (${parentOf.get(into)}, ${s.id})`);
        parentOf.set(into, s.id);
      }
      if (s.evolution.kind === 'split') {
        const br = s.evolution.branches;
        if (br[br.length - 1]!.condition !== null) err(`species ${s.id}: split default (null condition) branch must be last`);
        if (br.slice(0, -1).some((b) => b.condition === null)) err(`species ${s.id}: only the last split branch may have a null condition`);
      }
    }
    for (const s of species) {
      if (s.evolvesFrom !== null) {
        const p = speciesById.get(s.evolvesFrom);
        const pIntos = p?.evolution === null || p === undefined ? [] : p.evolution.kind === 'level' ? [p.evolution.into] : p.evolution.branches.map((b) => b.into);
        if (!pIntos.includes(s.id)) err(`species ${s.id}: evolvesFrom '${s.evolvesFrom}' does not evolve into it`);
      }
      // root reachable without cycles
      let cur: SpeciesDef | undefined = s;
      let hops = 0;
      while (cur !== undefined && cur.evolvesFrom !== null && hops < 8) { cur = speciesById.get(cur.evolvesFrom); hops++; }
      if (hops >= 8) err(`species ${s.id}: evolution chain has a cycle or exceeds depth`);
    }
    // roster-coverage: 67 roots (57 non-legendary families + the 10 legendary/mythical singles), each a tree root
    const families = species.filter((s) => s.evolvesFrom === null).length;
    if (families !== 67) err(`evolution families (roots) ${families} !== 67`);
  }

  // ── 7 + 8. roster coverage and RC rules ──
  const roster: RosterReport = computeRosterReport({
    species,
    zones,
    tables: ENCOUNTER_TABLES,
    statics: LEGENDARY_STATICS,
    swarms: DAILY_SWARMS,
    raids: RAID_HOTSPOTS,
    quests: QUESTS,
    battlePass: BATTLE_PASS,
    bands: ENCOUNTER_BANDS,
    legendaryIds: LEGENDARY_IDS,
    mythicalIds: MYTHICAL_IDS,
  });
  for (const f of roster.ruleFailures) err(`roster: ${f}`);
  if (roster.obtainable !== species.length) err(`roster: obtainable ${roster.obtainable} !== ${species.length}`);
  for (const t of ENCOUNTER_TABLES) {
    for (const s of t.slots) {
      if (s.weight <= 0) err(`table ${t.id}: ${s.species} weight must be > 0`);
      if (s.levelMin > s.levelMax) err(`table ${t.id}: ${s.species} levelMin > levelMax`);
    }
  }
  for (const s of LEGENDARY_STATICS) {
    if (!legendary.has(s.species)) err(`static ${s.species}: non-legendary species in LEGENDARY_STATICS`);
    for (const t of ENCOUNTER_TABLES) if (t.slots.some((x) => x.species === s.species)) err(`static ${s.species} also spawns in ${t.id}`);
  }

  // ── 9. zone graph + coordinates ──
  {
    const seeds = new Map<number, ZoneId>();
    for (const z of zones) {
      if (seeds.has(z.layoutSeed)) err(`zone ${z.id}: layoutSeed ${z.layoutSeed} duplicates ${seeds.get(z.layoutSeed)}`);
      seeds.set(z.layoutSeed, z.id);
      for (const dir of Object.keys(z.links).sort() as LinkDir[]) {
        const to = zoneById.get(z.links[dir]!);
        if (to !== undefined && to.links[OPPOSITE[dir]] !== z.id) err(`zone ${z.id}: link ${dir} → ${to.id} is not mirrored (${to.id}.links.${OPPOSITE[dir]} = ${to.links[OPPOSITE[dir]] ?? 'none'})`);
      }
      if (z.gym !== null) {
        const l = LEAGUE.find((x) => x.id === z.gym);
        if (l !== undefined && l.zoneId !== z.id) err(`zone ${z.id}: gym ${z.gym} sits in ${l.zoneId}`);
        if (l !== undefined && l.stage !== 'gym') err(`zone ${z.id}: gym '${z.gym}' is not a gym`);
      }
      if (z.kind === 'town' && z.shop === null) err(`zone ${z.id}: towns have a shop`);
      if (z.kind === 'town' && !z.healer) err(`zone ${z.id}: towns have a healer`);
      if (z.npcs.length < 3) err(`zone ${z.id}: fewer than 3 npcs`);
      if (z.lore.length !== 2) err(`zone ${z.id}: lore tablets ${z.lore.length} !== 2`);
      if (z.id === 'mirevale' && (z.spawn.x !== 0 || z.spawn.z !== 6)) err('mirevale.spawn must be { x: 0, z: 6 }');
      const ids = new Set<string>();
      for (const x of [...z.npcs, ...z.trainers, ...z.items, ...z.lore, ...z.warps]) { if (ids.has(x.id)) err(`zone ${z.id}: duplicate entity id '${x.id}'`); ids.add(x.id); }
    }
    for (const l of LEAGUE) {
      if (l.stage === 'gym') {
        const z = zoneById.get(l.zoneId);
        if (z !== undefined && z.gym !== l.id) err(`league ${l.id}: zone ${l.zoneId}.gym is '${z.gym}'`);
      } else if (l.zoneId !== 'solenne') err(`league ${l.id}: elite/champion must sit in solenne`);
    }
    // reachability ignoring gates
    const reach = new Set<ZoneId>();
    const queue: ZoneId[] = ['mirevale'];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (reach.has(id)) continue;
      reach.add(id);
      const z = zoneById.get(id);
      if (z !== undefined) for (const dir of Object.keys(z.links).sort() as LinkDir[]) queue.push(z.links[dir]!);
    }
    for (const z of zones) if (!reach.has(z.id)) err(`zone ${z.id}: not reachable from mirevale`);
    // badges appear as gates in ZONE_ORDER order
    const gateOrder: BadgeId[] = [];
    for (const id of ZONE_ORDER) { const g = zoneById.get(id)?.gate ?? null; if (g !== null && !gateOrder.includes(g)) gateOrder.push(g); }
    if (gateOrder.join(',') !== BADGE_ORDER.join(',')) err(`gates in ZONE_ORDER are ${gateOrder.join(',')}, expected ${BADGE_ORDER.join(',')}`);
    // gates reachable in badge order from mirevale: with k badges the (k+1)-th gym's town is reachable
    const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
    for (let k = 0; k <= 8; k++) {
      const have = new Set<BadgeId>(BADGE_ORDER.slice(0, k));
      const seen = new Set<ZoneId>();
      const q: ZoneId[] = ['mirevale'];
      while (q.length > 0) {
        const id = q.shift()!;
        if (seen.has(id)) continue;
        const z = zoneById.get(id);
        if (z === undefined) continue;
        if (z.gate !== null && !have.has(z.gate)) continue;
        seen.add(id);
        for (const dir of Object.keys(z.links).sort() as LinkDir[]) q.push(z.links[dir]!);
      }
      if (k < 8) {
        const gym = gyms[k];
        if (gym !== undefined && !seen.has(gym.zoneId)) err(`with ${k} badges the gym ${gym.id} in ${gym.zoneId} is not reachable`);
      } else {
        for (const z of zones) if (!seen.has(z.id)) err(`zone ${z.id}: not reachable with all 8 badges`);
      }
    }
    // coordinates inside the playable interior (the walkability half of rule 9 runs with rule 12 below)
    for (const z of zones) {
      const half = ZONE_SIZE[z.kind] / 2 - ZONE_MARGIN;
      const inside = (x: number, zz: number): boolean => Math.abs(x) <= half && Math.abs(zz) <= half;
      const pts: (readonly [string, number, number])[] = [['spawn', z.spawn.x, z.spawn.z]];
      for (const n of z.npcs) pts.push([`npc ${n.id}`, n.x, n.z]);
      for (const t of z.trainers) pts.push([`trainer ${t.id}`, t.x, t.z]);
      for (const i of z.items) pts.push([`item ${i.id}`, i.x, i.z]);
      for (const l of z.lore) pts.push([`lore ${l.id}`, l.x, l.z]);
      for (const w of z.warps) { pts.push([`warp ${w.id}`, w.x, w.z]); pts.push([`warp ${w.id} target`, w.toX, w.toZ]); }
      for (const [what, x, zz] of pts) if (!inside(x, zz)) err(`zone ${z.id}: ${what} (${x}, ${zz}) outside the playable interior ±${half}`);
    }
    for (const s of LEGENDARY_STATICS) {
      const z = zoneById.get(s.zoneId);
      if (z !== undefined) { const half = ZONE_SIZE[z.kind] / 2 - ZONE_MARGIN; if (Math.abs(s.x) > half || Math.abs(s.z) > half) err(`static ${s.species}: (${s.x}, ${s.z}) outside ±${half}`); }
    }
    for (const r of RAID_HOTSPOTS) {
      const z = zoneById.get(r.zoneId);
      if (z !== undefined) { const half = ZONE_SIZE[z.kind] / 2 - ZONE_MARGIN; if (Math.abs(r.x) > half || Math.abs(r.z) > half) err(`raid ${r.id}: (${r.x}, ${r.z}) outside ±${half}`); }
    }
  }

  // ── 10. prices ──
  for (const c of consumables) if (c.sellPrice !== Math.floor(c.price / 2)) err(`consumable ${c.id}: sellPrice ${c.sellPrice} !== floor(${c.price} / 2)`);
  for (const o of orbs) {
    const p = LEGACY_ORB_PRICES[o.id];
    if (p === undefined) err(`orb ${o.id}: not a legacy orb`);
    else if (o.price !== p) err(`orb ${o.id}: price ${o.price} !== legacy ${p}`);
  }

  // ── 11. atlas bind cap ──
  // Z(zone) = table ∪ statics ∪ trainers' teams ∪ league teams in the zone is reported in full for the sprite
  // planner. The ≤ 16 cap is enforced on the OVERWORLD subset (table ∪ statics): the full set cannot meet it for
  // solenne (20 distinct legacy league species before any table) or umbral_observatory (bible story teams) — see
  // IMPLEMENTATION-NOTES D1. Battle-only teams render in the arena, which binds its own atlases per battle.
  const bindSets = {} as Record<ZoneId, readonly string[]>;
  for (const z of zones) {
    const world = new Set<string>();
    const t = ENCOUNTER_TABLES.find((x) => x.zoneId === z.id);
    if (t !== undefined) for (const s of t.slots) world.add(s.species);
    for (const s of LEGENDARY_STATICS) if (s.zoneId === z.id) world.add(s.species);
    const full = new Set<string>(world);
    for (const tr of z.trainers) for (const m of tr.team) full.add(m.species);
    for (const l of LEAGUE) if (l.zoneId === z.id) for (const m of l.team) full.add(m.species);
    bindSets[z.id] = [...full].sort();
    if (world.size > 16) err(`zone ${z.id}: overworld species ${world.size} > 16 (${[...world].sort().join(', ')})`);
  }

  // ── §3.3 league ──
  {
    const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
    if (gyms.length !== 8) err(`league: ${gyms.length} gyms !== 8`);
    gyms.forEach((g, i) => {
      if (g.order !== i + 1) err(`league gym ${g.id}: order ${g.order} !== ${i + 1}`);
      if (g.badge !== BADGE_ORDER[i]) err(`league gym ${g.id}: badge ${g.badge} !== ${BADGE_ORDER[i]}`);
    });
    for (let i = 1; i < gyms.length; i++) {
      const prev = Math.max(...gyms[i - 1]!.team.map((m) => m.level));
      const cur = Math.max(...gyms[i]!.team.map((m) => m.level));
      if (cur < prev) err(`league gym ${gyms[i]!.id}: max level ${cur} < previous ${prev}`);
    }
    const elite = LEAGUE.filter((l) => l.stage === 'elite');
    if (elite.length !== 3) err(`league: ${elite.length} elite !== 3`);
    const champs = LEAGUE.filter((l) => l.stage === 'champion');
    if (champs.length !== 1 || champs[0]!.id !== 'zeon') err(`league: champion must be exactly 'zeon'`);
    if (champs[0] !== undefined && !champs[0].setsFlags.includes('champion:zeon:beaten')) err(`league: zeon.setsFlags must include 'champion:zeon:beaten'`);
    for (const l of LEAGUE) if (l.stage !== 'gym' && l.badge !== null) err(`league ${l.id}: only gyms award badges`);
    if (BADGES.length !== 8) err(`BADGES.length ${BADGES.length} !== 8`);
    BADGES.forEach((b, i) => {
      if (b.id !== BADGE_ORDER[i]) err(`BADGES[${i}] ${b.id} !== ${BADGE_ORDER[i]}`);
      const g = LEAGUE.find((l) => l.id === b.gym);
      if (g === undefined || g.badge !== b.id) err(`badge ${b.id}: gym '${b.gym}' does not award it`);
    });
  }

  // ── §3.5 story ──
  {
    const starters = STORY.filter((b) => b.starter);
    if (starters.length !== 1) err(`story: ${starters.length} starter beats !== 1`);
    const ids = new Set<string>();
    for (const b of STORY) { if (ids.has(b.id)) err(`story: duplicate beat id '${b.id}'`); ids.add(b.id); }
    for (const act of [1, 2, 3] as const) if (!STORY.some((b) => b.act === act)) err(`story: act ${act} has no beat`);
    // per zone: need/set acyclic (a beat may only need flags set by earlier beats of the same zone)
    for (const zid of ZONE_ORDER) {
      const beats = STORY.filter((b) => b.zoneId === zid);
      const setBefore = new Set<string>();
      for (const b of beats) {
        const laterSets = new Set(beats.slice(beats.indexOf(b) + 1).flatMap((x) => x.set));
        for (const f of b.need) if (laterSets.has(f) && !setBefore.has(f)) err(`story: beat ${b.id} needs '${f}' set by a later beat in ${zid} (cycle)`);
        for (const f of b.set) setBefore.add(f);
      }
    }
    const harvestZones = new Map<ZoneId, Set<string>>();
    for (const b of STORY) if (b.harvest !== null) { const s = harvestZones.get(b.harvest.zoneId) ?? new Set(); s.add(b.harvest.to); harvestZones.set(b.harvest.zoneId, s); }
    let restoration = false;
    for (const s of harvestZones.values()) if (s.has('harvested') && s.has('intact')) restoration = true;
    if (!restoration) err('story: no zone has both a harvested and an intact harvest beat');
    for (const b of STORY) if (setFlags.has(beatDoneFlag(b.id))) err(`story: authored flag collides with done marker of ${b.id}`);
  }

  // ── §3.6 live-ops ──
  if (SEASONAL_EVENTS.length !== 4) err(`SEASONAL_EVENTS.length ${SEASONAL_EVENTS.length} !== 4`);
  for (const e of SEASONAL_EVENTS) if (e.endsAt <= e.startsAt) err(`event ${e.id}: endsAt <= startsAt`);
  if (DAILY_SWARMS.length !== 7) err(`DAILY_SWARMS.length ${DAILY_SWARMS.length} !== 7`);
  if (RAID_HOTSPOTS.length !== 8) err(`RAID_HOTSPOTS.length ${RAID_HOTSPOTS.length} !== 8`);
  for (const r of RAID_HOTSPOTS) {
    const z = zoneById.get(r.zoneId);
    if (z !== undefined && z.kind !== 'route') err(`raid ${r.id}: hotspots sit on routes`);
    const band = ENCOUNTER_BANDS[r.zoneId];
    if (band !== undefined && r.boss.level <= band[1]) err(`raid ${r.id}: boss level ${r.boss.level} not above the route band ${band[1]}`);
  }
  {
    const bp50 = BATTLE_PASS.find((b) => b.level === 50);
    if (bp50 === undefined || bp50.mythicalChoice === null) err('battle pass: level 50 must carry mythicalChoice');
    else if ([...bp50.mythicalChoice].sort().join(',') !== [...MYTHICAL_IDS].sort().join(',')) err(`battle pass 50: mythicalChoice ${bp50.mythicalChoice.join(',')}`);
    for (const b of BATTLE_PASS) if (b.level !== 50 && b.mythicalChoice !== null) err(`battle pass ${b.level}: only level 50 carries mythicalChoice`);
  }

  // ── §3.12 bodies ──
  if (BODIES.length < 10) err(`BODIES.length ${BODIES.length} < 10`);
  if (!BODIES.some((b) => b.id === 'ranger_m')) err("BODIES: 'ranger_m' (persist default) missing");
  for (const b of BODIES) if (!looks.has(b.look)) err(`body ${b.id}: look '${b.look}' not in LOOKS`);
  if (new Set(BODIES.map((b) => b.id)).size !== BODIES.length) err('BODIES: duplicate ids');
  if (!TITLES.includes('Rookie Trainer')) err("TITLES: 'Rookie Trainer' (persist default) missing");

  // ── 12. heightfields (and the walkability half of 9) ──
  const heightfields = {} as Record<ZoneId, { readonly digest: string; readonly walkable: number; readonly water: number }>;
  if (!opts.skipHeightfields) {
    for (const z of zones) {
      let h: Heightfield;
      try {
        h = getHeightfield(z.id);
      } catch (e) {
        err(`zone ${z.id}: buildHeightfield threw ${String(e)}`);
        continue;
      }
      const wr = walkableRatio(h);
      const water = waterRatio(h);
      heightfields[z.id] = { digest: h.digest, walkable: wr, water };
      if (wr < 0.45) err(`zone ${z.id}: walkable ${(wr * 100).toFixed(1)}% < 45%`);
      const expectRes = ZONE_SIZE[z.kind] / 0.5 + 1;
      if (h.res !== expectRes) err(`zone ${z.id}: heightfield res ${h.res} !== ${expectRes}`);
      const snap = (what: string, x: number, zz: number): void => {
        if (nearestWalkable(h, x, zz, 8) === null) err(`zone ${z.id}: ${what} (${x}, ${zz}) has no walkable sample within 8 m`);
      };
      snap('spawn', z.spawn.x, z.spawn.z);
      for (const n of z.npcs) snap(`npc ${n.id}`, n.x, n.z);
      for (const t of z.trainers) snap(`trainer ${t.id}`, t.x, t.z);
      for (const i of z.items) snap(`item ${i.id}`, i.x, i.z);
      for (const l of z.lore) snap(`lore ${l.id}`, l.x, l.z);
      for (const w of z.warps) { snap(`warp ${w.id}`, w.x, w.z); snap(`warp ${w.id} target`, w.toX, w.toZ); }
      for (const s of LEGENDARY_STATICS) if (s.zoneId === z.id) snap(`static ${s.species}`, s.x, s.z);
      for (const r of RAID_HOTSPOTS) if (r.zoneId === z.id) snap(`raid ${r.id}`, r.x, r.z);
      const t = ENCOUNTER_TABLES.find((x) => x.zoneId === z.id);
      if (t !== undefined && t.slots.some((s) => s.medium === 'water')) {
        if (water === 0) err(`zone ${z.id}: table has water slots but the heightfield has no water samples`);
        // a boardwalk cell (walkable + water) must exist so water spawns can be engaged without HM Surf
        let boardwalk = false;
        for (let i = 0; i < h.walkable.length && !boardwalk; i++) if (h.walkable[i] === 1 && h.water[i] === 1) boardwalk = true;
        if (!boardwalk) err(`zone ${z.id}: no sample is both walkable and water (boardwalk)`);
        void isWater;
      }
    }
  }

  const stats: ValidationStats = {
    species: species.length,
    moves: moves.length,
    abilities: ABILITIES.length,
    items: items.length,
    orbs: orbs.length,
    consumables: consumables.length,
    types: TYPE_NAMES.length,
    zones: zones.length,
    encounterTables: ENCOUNTER_TABLES.length,
    encounterSlots: ENCOUNTER_TABLES.reduce((n, t) => n + t.slots.length, 0),
    statics: LEGENDARY_STATICS.length,
    league: LEAGUE.length,
    quests: QUESTS.length,
    storyBeats: STORY.length,
    seasonalEvents: SEASONAL_EVENTS.length,
    dailySwarms: DAILY_SWARMS.length,
    raidHotspots: RAID_HOTSPOTS.length,
    battlePassLevels: BATTLE_PASS.length,
    bodies: BODIES.length,
    flags: FLAG_REGISTRY.length,
    roster,
    bindSets,
    heightfields,
  };

  return { ok: errors.length === 0, errors, stats };
}
