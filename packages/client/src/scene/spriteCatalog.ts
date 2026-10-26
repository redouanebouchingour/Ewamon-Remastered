/**
 * Creature sprite descriptors from the pipeline manifest (SPEC §40.1.5 `creatures.manifest.json` v2 → render
 * §10.4.1): `uv → rect`, `px`, `footV`, `aspect` per side; atlas maps `{ url, mips }` resolved against
 * `/creatures/`; `normalScale`. Types come from content (the manifest carries none). Pure over the parsed manifest;
 * `loadSpriteCatalog()` fetches it once.
 *
 * Flipbooks (amended 2026-10-06): a side with `sprites[id].anim.<side>` gets `SpriteFrame.anim` (`frames → rects`,
 * `delays → delaysMs`, `staticFrame`), and `animAtlases[]` become render `AnimAtlasSet`s (`animAtlas(id)`,
 * `animAtlasesOf(species)`). `sideAtlases(species, side)` names the static atlas and the flipbook ONE side is drawn
 * from: `creatureTextures.ts` binds the side a view shows, never both (client IMPLEMENTATION-NOTES "Creature textures").
 */
import { shinyPaletteOf } from '@ewa/content';
import { formsOf } from '@ewa/core';
import type { SpeciesDef, TypeName as CoreTypeName, VariantKey } from '@ewa/core';
import type { AnimAtlasSet, AtlasSet, AuraKind, SpriteAnim, SpriteDescriptor, SpriteFrame, SpritePool, TypeName } from '@ewa/render';

export const CREATURE_BASE = '/creatures/';

/**
 * The live aura a battle form shows on the stage (`.design/majin-tenjin.md`): the shipped Rage Forms are Majin forms.
 * A form id not listed here shows no aura.
 */
export const FORM_AURA: Readonly<Record<string, AuraKind>> = Object.freeze({
  rage: 'majin',
  majin: 'majin',
  tenjin: 'tenjin',
  // ravatar's Avatar State shines; its four elemental relic forms carry their element in the art itself (no aura)
  avatar: 'tenjin',
});

/** Species whose Majin form wears a different aura: zenryu's Majin form is its Super Saiyan (golden flames). */
export const SPECIES_MAJIN_AURA: Readonly<Record<string, AuraKind>> = Object.freeze({ zenryu: 'majin_gold' });

/** The aura of form sprite `spriteId` (`<species>_<form>`) of `speciesId`; undefined for the species' own sprite or an unknown form. */
export function auraOfSprite(speciesId: string, spriteId: string | undefined): AuraKind | undefined {
  if (spriteId === undefined || spriteId === speciesId || !spriteId.startsWith(`${speciesId}_`)) return undefined;
  const aura = FORM_AURA[spriteId.slice(speciesId.length + 1)];
  return aura === 'majin' ? (SPECIES_MAJIN_AURA[speciesId] ?? aura) : aura;
}

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
interface ManifestAnimSide {
  readonly atlas: string;
  readonly frames: readonly (readonly [number, number, number, number])[];
  readonly delays: readonly number[];
  readonly staticFrame: number;
}
interface ManifestAnimAtlas {
  readonly id: string;
  readonly species: string;
  readonly side: 'front' | 'back';
  readonly width: number;
  readonly height: number;
  readonly cell: number;
  readonly albedo: ManifestMap;
  readonly normal: ManifestMap;
  readonly emissive: ManifestMap;
  readonly normalScale: 0.5 | 1;
}
interface ManifestSprite {
  readonly front: ManifestRect;
  readonly back: ManifestRect;
  readonly sizeScale: number;
  readonly home: string;
  readonly thumb?: string;
  readonly anim?: { readonly front?: ManifestAnimSide; readonly back?: ManifestAnimSide };
}
export interface CreatureManifest {
  readonly version: 2;
  readonly atlases: readonly ManifestAtlas[];
  readonly zones: Readonly<Record<string, readonly string[]>>;
  readonly sprites: Readonly<Record<string, ManifestSprite>>;
  readonly animAtlases?: readonly ManifestAnimAtlas[];
}

export interface SpriteCatalog {
  /** AtlasSet for an atlas id (null when unknown). */
  atlas(id: string): AtlasSet | null;
  /** The atlas ids a zone binds (§40.1.4 `zones[zoneId]`). */
  zoneAtlases(zoneId: string): readonly string[];
  /** Every atlas a species' two sides live in. */
  atlasesOf(speciesId: string): readonly string[];
  /** AnimAtlasSet for an anim atlas id (null when unknown). */
  animAtlas(id: string): AnimAtlasSet | null;
  /** The flipbook atlases of a species' animated sides (front first; [] for a still creature). */
  animAtlasesOf(speciesId: string): readonly string[];
  /** The atlases ONE side of a species is drawn from: its static atlas and its flipbook (null for a still side); null when unknown. */
  sideAtlases(speciesId: string, side: 'front' | 'back'): { readonly atlas: string; readonly anim: string | null } | null;
  /** Level-0 bytes (albedo + normal + emissive, mips included when listed) of a set of atlases (static or anim), for the boot bar. */
  bytesOf(ids: readonly string[]): number;
  /**
   * `spriteId`: a battle form's manifest entry (`<species>_<form>`) drawn in place of the species' own; size stays the species',
   * types too unless the form names its own (hyoryu's Majin Form: Dragon/Dark, so its type colour follows).
   * A Majin / Tenjin form (`FORM_AURA`) also gets its live aura (`SpriteDescriptor.aura`).
   */
  descriptor(speciesId: string, key: string, variant?: VariantKey, isAlpha?: boolean, isShiny?: boolean, spriteId?: string): SpriteDescriptor | null;
  readonly speciesCount: number;
}

function frame(r: ManifestRect, a: ManifestAnimSide | undefined): SpriteFrame {
  const f: SpriteFrame = { atlas: r.atlas, rect: r.uv, px: r.px, footV: r.footV, aspect: r.aspect };
  if (a === undefined || a.frames.length === 0) return f;
  const anim: SpriteAnim = { atlas: a.atlas, rects: a.frames, delaysMs: a.delays, staticFrame: a.staticFrame };
  return { ...f, anim };
}

export function createSpriteCatalog(m: CreatureManifest, species: (id: string) => SpeciesDef | undefined, base: string = CREATURE_BASE): SpriteCatalog {
  const sets = new Map<string, AtlasSet>();
  const bytes = new Map<string, number>();
  const url = (u: string): string => (u.startsWith('/') || u.startsWith('http') ? u : base + u);
  const map = (x: ManifestMap) => ({ url: url(x.url), mips: x.mips.map(url) });
  for (const a of m.atlases) {
    sets.set(a.id, { id: a.id, albedo: map(a.albedo), normal: map(a.normal), emissive: map(a.emissive), size: a.size, normalScale: a.normalScale });
    bytes.set(a.id, (a.albedo.bytes ?? 0) + (a.normal.bytes ?? 0) + (a.emissive.bytes ?? 0));
  }
  const animSets = new Map<string, AnimAtlasSet>();
  for (const a of m.animAtlases ?? []) {
    animSets.set(a.id, {
      id: a.id, albedo: map(a.albedo), normal: map(a.normal), emissive: map(a.emissive), width: a.width, height: a.height, cell: a.cell, normalScale: a.normalScale,
    });
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
    animAtlas: (id) => animSets.get(id) ?? null,
    animAtlasesOf: (speciesId) => {
      const a = m.sprites[speciesId]?.anim;
      if (a === undefined) return [];
      const out: string[] = [];
      for (const side of [a.front, a.back]) if (side !== undefined && animSets.has(side.atlas) && !out.includes(side.atlas)) out.push(side.atlas);
      return out;
    },
    sideAtlases: (speciesId, side) => {
      const sp = m.sprites[speciesId];
      if (sp === undefined) return null;
      const a = sp.anim?.[side];
      return { atlas: sp[side].atlas, anim: a !== undefined && a.frames.length > 0 && animSets.has(a.atlas) ? a.atlas : null };
    },
    bytesOf: (ids) => ids.reduce((n, id) => n + (bytes.get(id) ?? 0), 0),
    descriptor(speciesId, key, variant = 'normal', isAlpha = false, isShiny = false, spriteId) {
      const sp = m.sprites[spriteId ?? speciesId];
      if (sp === undefined) return null;
      const def = species(speciesId);
      const form = def === undefined ? undefined : formsOf(def).find((f) => spriteId === `${speciesId}_${f.id}`);
      const formTypes = form?.types;
      const t = (formTypes ?? def?.types ?? ['Normal']) as readonly CoreTypeName[];
      const types = (t.length > 1 ? [t[0]!, t[1]!] : [t[0]!]) as unknown as readonly [TypeName] | readonly [TypeName, TypeName];
      // a flipbook whose atlas the manifest does not list stays static (never a dangling bind)
      const anim = (side: 'front' | 'back'): ManifestAnimSide | undefined => {
        const a = sp.anim?.[side];
        return a !== undefined && animSets.has(a.atlas) ? a : undefined;
      };
      const aura = auraOfSprite(speciesId, spriteId);
      return {
        id: key, front: frame(sp.front, anim('front')), back: frame(sp.back, anim('back')), sizeScale: def?.sizeScale ?? sp.sizeScale, types, variant, isAlpha,
        ...(isShiny ? { isShiny: true, shinyPalette: shinyPaletteOf(speciesId) } : {}), ...(aura !== undefined ? { aura } : {}),
      };
    },
    get speciesCount() {
      return Object.keys(m.sprites).length;
    },
  };
}

/**
 * Every atlas of a species — its static atlases followed by BOTH sides' flipbooks. The world no longer binds this set
 * (a view binds the one side it shows: `sideAtlases`, `creatureTextures.ts`); the harness's `residency=legacy` replays it.
 */
export function speciesAtlases(cat: SpriteCatalog, speciesId: string): readonly string[] {
  const anim = cat.animAtlasesOf(speciesId);
  return anim.length === 0 ? cat.atlasesOf(speciesId) : [...cat.atlasesOf(speciesId), ...anim];
}

/** Binds a static atlas (`bindAtlas`) or a flipbook atlas (`bindAnimAtlas`) by id; null when the catalog knows neither (the harness's legacy residency). */
export function bindCatalogAtlas(pool: Pick<SpritePool, 'bindAtlas' | 'bindAnimAtlas'>, cat: SpriteCatalog, id: string): Promise<void> | null {
  const set = cat.atlas(id);
  if (set !== null) return pool.bindAtlas(set);
  const anim = cat.animAtlas(id);
  return anim !== null ? pool.bindAnimAtlas(anim) : null;
}

let pending: Promise<CreatureManifest | null> | null = null;

/** Fetches the manifest once (null when the pipeline output is absent). */
export function loadCreatureManifest(): Promise<CreatureManifest | null> {
  pending ??= fetch(`${CREATURE_BASE}creatures.manifest.json`, { priority: 'high' } as RequestInit)
    .then(async (r) => (r.ok ? ((await r.json()) as CreatureManifest) : null))
    .catch(() => null);
  return pending;
}
