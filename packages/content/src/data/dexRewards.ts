/**
 * Dex completion rewards (2026-10-26): claimed in the Dex once their set is complete, each once per player
 * (`dex_rewards`). Four kinds: a zone's habitat (every species with a wild slot there recorded), a type set (every
 * species of the type recorded), research milestones (n species at research level 5) and the whole record. They pay
 * money and items like the achievements, and some give an earned trainer title (`POST /profile` accepts it once
 * claimed) or a Dex stamp style (the research stamp's look, chosen in the Dex).
 */
import { TYPE_NAMES } from '@ewa/core';
import type { TypeName } from '@ewa/core';
import { ZONE_ORDER } from '../types';
import type { ZoneId } from '../types';
import { ENCOUNTER_TABLES } from './encounters';
import { SPECIES } from './species';
import { ZONES } from './zones';

/** The research stamp's looks; 'paper' is everyone's from the start. */
export const DEX_STAMPS = ['paper', 'bronze', 'silver', 'gold', 'holo'] as const;
export type DexStamp = (typeof DEX_STAMPS)[number];

export type DexRewardNeed =
  | { readonly kind: 'zone'; readonly zoneId: ZoneId; readonly species: readonly string[] }
  | { readonly kind: 'type'; readonly type: TypeName; readonly species: readonly string[] }
  | { readonly kind: 'research'; readonly count: number }
  | { readonly kind: 'recorded'; readonly count: number };

export interface DexRewardDef {
  readonly id: string;
  readonly kind: DexRewardNeed['kind'];
  readonly title: string;
  readonly summary: string;
  readonly need: DexRewardNeed;
  readonly money: number;
  readonly items: Readonly<Record<string, number>>;
  /** an earned trainer title */
  readonly trainerTitle?: string;
  /** a research stamp look */
  readonly stamp?: DexStamp;
}

const zoneName = (id: ZoneId): string => ZONES.find((z) => z.id === id)?.name ?? id;

/** The zones with a wild roster, in story order, each with the species that have a non-alpha slot there. */
function habitatSets(): { readonly zoneId: ZoneId; readonly species: string[] }[] {
  const out: { zoneId: ZoneId; species: string[] }[] = [];
  for (const z of ZONE_ORDER) {
    const t = ENCOUNTER_TABLES.find((x) => x.zoneId === z);
    if (t === undefined) continue;
    const ids = [...new Set(t.slots.filter((s) => s.tier !== 'alpha').map((s) => s.species))].sort();
    if (ids.length > 0) out.push({ zoneId: z, species: ids });
  }
  return out;
}

const ZONE_REWARDS: DexRewardDef[] = habitatSets().map((h, i): DexRewardDef => ({
  id: `dex_zone_${h.zoneId}`,
  kind: 'zone',
  title: `${zoneName(h.zoneId)} Survey`,
  summary: `Record every species living wild in ${zoneName(h.zoneId)}.`,
  need: { kind: 'zone', zoneId: h.zoneId, species: h.species },
  money: 1000 + 500 * i,
  items: i < 5 ? { prism_orb: 3 } : ({ hyper_potion: 2, rarecandy: 1 } as Readonly<Record<string, number>>),
  trainerTitle: `${zoneName(h.zoneId)} Naturalist`,
}));

const TYPE_REWARDS: DexRewardDef[] = TYPE_NAMES.map((t) => ({ t, species: SPECIES.filter((s) => (s.types as readonly string[]).includes(t)).map((s) => s.id).sort() }))
  .filter((x) => x.species.length > 0)
  .map(({ t, species }) => ({
    id: `dex_type_${t.toLowerCase()}`,
    kind: 'type' as const,
    title: `The ${t} Pages`,
    summary: `Record every ${t}-type species.`,
    need: { kind: 'type' as const, type: t, species },
    money: 2000 + 100 * species.length,
    items: { rarecandy: 1 },
    trainerTitle: `${t} Archivist`,
  }));

const RESEARCH_REWARDS: DexRewardDef[] = [
  { id: 'dex_research_5', kind: 'research', title: 'First Field Notes', summary: 'Fully research 5 species.', need: { kind: 'research', count: 5 }, money: 2000, items: { prism_orb: 5 }, stamp: 'bronze' },
  { id: 'dex_research_15', kind: 'research', title: 'A Careful Eye', summary: 'Fully research 15 species.', need: { kind: 'research', count: 15 }, money: 5000, items: { rarecandy: 2 }, trainerTitle: 'Field Researcher', stamp: 'silver' },
  { id: 'dex_research_40', kind: 'research', title: 'Senior Fellow', summary: 'Fully research 40 species.', need: { kind: 'research', count: 40 }, money: 10000, items: { rarecandy: 3, max_revive: 1 }, trainerTitle: 'Senior Researcher', stamp: 'gold' },
  { id: 'dex_research_80', kind: 'research', title: 'The Professor’s Peer', summary: 'Fully research 80 species.', need: { kind: 'research', count: 80 }, money: 20000, items: { rarecandy: 5, max_revive: 2 }, trainerTitle: 'Dex Professor' },
  { id: 'dex_research_all', kind: 'research', title: 'Every Page Read', summary: `Fully research all ${SPECIES.length} species.`, need: { kind: 'research', count: SPECIES.length }, money: 50000, items: { big_nugget: 3, rarecandy: 10 }, trainerTitle: 'Keeper of the Record', stamp: 'holo' },
];

const RECORD_REWARDS: DexRewardDef[] = [
  { id: 'dex_complete', kind: 'recorded', title: 'The Living Record', summary: `Record all ${SPECIES.length} species.`, need: { kind: 'recorded', count: SPECIES.length }, money: 0, items: { star_piece: 3 }, trainerTitle: 'Living Record' },
];

export const DEX_REWARDS: readonly DexRewardDef[] = [...ZONE_REWARDS, ...TYPE_REWARDS, ...RESEARCH_REWARDS, ...RECORD_REWARDS];

export function dexRewardById(id: string): DexRewardDef | undefined {
  return DEX_REWARDS.find((r) => r.id === id);
}

/** What a reward reads of the player's dex. */
export interface DexRewardCtx {
  readonly caught: ReadonlySet<string>;
  /** research level by species (absent = 0) */
  readonly research: Readonly<Record<string, number>>;
}

export function dexRewardProgress(r: DexRewardDef, ctx: DexRewardCtx): { readonly have: number; readonly need: number } {
  const n = r.need;
  if (n.kind === 'zone' || n.kind === 'type') return { have: n.species.filter((id) => ctx.caught.has(id)).length, need: n.species.length };
  if (n.kind === 'recorded') return { have: Math.min(n.count, ctx.caught.size), need: n.count };
  return { have: Math.min(n.count, Object.keys(ctx.research).sort().filter((id) => (ctx.research[id] ?? 0) >= 5).length), need: n.count };
}

export function dexRewardReady(r: DexRewardDef, ctx: DexRewardCtx): boolean {
  const p = dexRewardProgress(r, ctx);
  return p.have >= p.need;
}

/** Every trainer title a Dex reward can give. */
export const DEX_TITLES: readonly string[] = DEX_REWARDS.flatMap((r) => (r.trainerTitle === undefined ? [] : [r.trainerTitle]));

/** The trainer titles the claimed rewards gave. */
export function dexTitlesOf(claimed: readonly string[]): string[] {
  return claimed.flatMap((id) => {
    const t = dexRewardById(id)?.trainerTitle;
    return t === undefined ? [] : [t];
  });
}

/** The stamp looks the claimed rewards opened, 'paper' first. */
export function dexStampsOf(claimed: readonly string[]): DexStamp[] {
  const got = new Set<DexStamp>(['paper']);
  for (const id of claimed) {
    const st = dexRewardById(id)?.stamp;
    if (st !== undefined) got.add(st);
  }
  return DEX_STAMPS.filter((s) => got.has(s));
}
