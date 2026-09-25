/**
 * Creature sprite descriptors from the pipeline manifest (SPEC §40.1.5 `creatures.manifest.json` v2 → render
 * §10.4.1): `uv → rect`, `px`, `footV`, `aspect` per side; atlas maps `{ url, mips }` resolved against
 * `/creatures/`; `normalScale`. Types come from content (the manifest carries none). Pure over the parsed manifest;
 * `loadSpriteCatalog()` fetches it once.
 */
import type { SpeciesDef, TypeName as CoreTypeName, VariantKey } from '@ewa/core';
import type { AtlasSet, SpriteDescriptor, SpriteFrame, TypeName } from '@ewa/render';

export const CREATURE_BASE = '/creatures/';

interface ManifestMap { readonly url: string; readonly mips: readonly string[]; readonly bytes?: number }
interface ManifestAtlas {
  readonly id: string;
  readonly species: readonly string[];
  readonly size: 2048;
  readonly albedo: ManifestMap;
  readonly normal: ManifestMap;
  readonly emissive: ManifestMap;
  readonly normalScale: 0.5 | 1;
}
interface ManifestRect {
  readonly atlas: string;
  readonly px: readonly [number, number, number, number];
  readonly uv: readonly [number, number, number, number];
  readonly footV: number;
  readonly aspect: number;
}
interface ManifestSprite { readonly front: ManifestRect; readonly back: ManifestRect; readonly sizeScale: number; readonly home: string; readonly thumb?: string }
export interface CreatureManifest {
  readonly version: 2;
  readonly atlases: readonly ManifestAtlas[];
  readonly zones: Readonly<Record<string, readonly string[]>>;
  readonly sprites: Readonly<Record<string, ManifestSprite>>;
}

export interface SpriteCatalog {
  /** AtlasSet for an atlas id (null when unknown). */
  atlas(id: string): AtlasSet | null;
  /** The atlas ids a zone binds (§40.1.4 `zones[zoneId]`). */
  zoneAtlases(zoneId: string): readonly string[];
  /** Every atlas a species' two sides live in. */
  atlasesOf(speciesId: string): readonly string[];
  /** Level-0 bytes (albedo + normal + emissive, mips included when listed) of a set of atlases, for the boot bar. */
  bytesOf(ids: readonly string[]): number;
  descriptor(speciesId: string, key: string, variant?: VariantKey, isAlpha?: boolean): SpriteDescriptor | null;
  readonly speciesCount: number;
}

function frame(r: ManifestRect): SpriteFrame {
  return { atlas: r.atlas, rect: r.uv, px: r.px, footV: r.footV, aspect: r.aspect };
}

export function createSpriteCatalog(m: CreatureManifest, species: (id: string) => SpeciesDef | undefined, base: string = CREATURE_BASE): SpriteCatalog {
  const sets = new Map<string, AtlasSet>();
  const bytes = new Map<string, number>();
  const url = (u: string): string => (u.startsWith('/') || u.startsWith('http') ? u : base + u);
  for (const a of m.atlases) {
    const map = (x: ManifestMap) => ({ url: url(x.url), mips: x.mips.map(url) });
    sets.set(a.id, { id: a.id, albedo: map(a.albedo), normal: map(a.normal), emissive: map(a.emissive), size: a.size, normalScale: a.normalScale });
    bytes.set(a.id, (a.albedo.bytes ?? 0) + (a.normal.bytes ?? 0) + (a.emissive.bytes ?? 0));
  }
  return {
    atlas: (id) => sets.get(id) ?? null,
    zoneAtlases: (zoneId) => m.zones[zoneId] ?? [],
    atlasesOf: (speciesId) => {
      const sp = m.sprites[speciesId];
      if (sp === undefined) return [];
      return sp.front.atlas === sp.back.atlas ? [sp.front.atlas] : [sp.front.atlas, sp.back.atlas];
    },
    bytesOf: (ids) => ids.reduce((n, id) => n + (bytes.get(id) ?? 0), 0),
    descriptor(speciesId, key, variant = 'normal', isAlpha = false) {
      const sp = m.sprites[speciesId];
      if (sp === undefined) return null;
      const def = species(speciesId);
      const t = (def?.types ?? ['Normal']) as readonly CoreTypeName[];
      const types = (t.length > 1 ? [t[0]!, t[1]!] : [t[0]!]) as unknown as readonly [TypeName] | readonly [TypeName, TypeName];
      return { id: key, front: frame(sp.front), back: frame(sp.back), sizeScale: def?.sizeScale ?? sp.sizeScale, types, variant, isAlpha };
    },
    get speciesCount() {
      return Object.keys(m.sprites).length;
    },
  };
}

let pending: Promise<CreatureManifest | null> | null = null;

/** Fetches the manifest once (null when the pipeline output is absent). */
export function loadCreatureManifest(): Promise<CreatureManifest | null> {
  pending ??= fetch(`${CREATURE_BASE}creatures.manifest.json`, { priority: 'high' } as RequestInit)
    .then(async (r) => (r.ok ? ((await r.json()) as CreatureManifest) : null))
    .catch(() => null);
  return pending;
}
