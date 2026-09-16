/**
 * Stage 6 (planning) — which species share an atlas.
 *
 * Order matters ("first group wins") and follows the spec's enumeration: one group per
 * legacy route encounter table (with forward evolutions), then the league rosters, then
 * the starters (bramblecub / glimfin / cindercap lines), then `misc` for the rest.
 * Each group is chunked into atlases of `speciesPerAtlas` species (front + back = 16
 * sprites per 4096² atlas at 1024²), ids `<group>-<n>`.
 */
import type { LegacyData } from './legacy.js';
import { withEvolutions } from './legacy.js';

export interface AtlasGroup {
  group: string;
  species: string[];
}

export interface AtlasPlan {
  id: string;
  group: string;
  species: string[];
}

export const STARTER_ROOTS = ['bramblecub', 'glimfin', 'cindercap'];

export function buildGroups(allIds: string[], legacy: LegacyData | null): AtlasGroup[] {
  const ids = [...allIds].sort();
  const known = new Set(ids);
  const taken = new Set<string>();
  const groups: AtlasGroup[] = [];

  const claim = (group: string, candidates: Iterable<string>): void => {
    const species: string[] = [];
    for (const id of [...candidates].sort()) {
      if (!known.has(id) || taken.has(id)) continue;
      taken.add(id);
      species.push(id);
    }
    if (species.length) groups.push({ group, species });
  };

  if (legacy) {
    for (const table of legacy.encounterTables) {
      claim(table.route, withEvolutions(table.species, legacy.species));
    }
    claim('league', legacy.leagueSpecies);
    claim('starters', withEvolutions(STARTER_ROOTS, legacy.species));
  }
  claim('misc', ids);
  return groups;
}

export function planAtlases(groups: AtlasGroup[], speciesPerAtlas: number): AtlasPlan[] {
  const plans: AtlasPlan[] = [];
  for (const g of groups) {
    for (let i = 0, n = 0; i < g.species.length; i += speciesPerAtlas, n++) {
      plans.push({ id: `${g.group}-${n}`, group: g.group, species: g.species.slice(i, i + speciesPerAtlas) });
    }
  }
  return plans;
}
