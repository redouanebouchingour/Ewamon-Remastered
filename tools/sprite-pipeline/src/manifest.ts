/**
 * `creatures.manifest.json` — the contract between this pipeline and the client's sprite
 * material. Everything is sorted by species id / atlas id and carries no timestamps, so the
 * same inputs always produce byte-identical output.
 */
export type ManifestEncoding = 'ktx2-uastc' | 'webp';

export interface SpriteRect {
  /** Atlas id (see `atlases[].id`). */
  atlas: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fraction of the sprite cell height at which the creature's feet sit (0.92). */
  footV: number;
  /** Output pixels per source pixel after normalisation. */
  pixelScale: number;
  /** Source file relative to `assets-src/creatures/`. */
  source: string;
}

export interface ManifestAtlas {
  id: string;
  albedo: string;
  normal: string;
  emissive: string;
  group: string;
}

export interface ManifestSprite {
  front: SpriteRect;
  back: SpriteRect;
  /** Legacy `sizeScale` — world-space scale the renderer applies on top of the uniform canvas. */
  sizeScale?: number;
}

export interface ManifestAnimation {
  species: string;
  /** Relative to the manifest, e.g. `animations/voidraxis_idle_sheet.png`. */
  file: string;
  frames?: number;
  fps?: number;
}

export interface SpriteManifest {
  version: 1;
  encoding: ManifestEncoding;
  atlasSize: number;
  spriteSize: number;
  atlases: ManifestAtlas[];
  sprites: Record<string, ManifestSprite>;
  animations: ManifestAnimation[];
}

export const MANIFEST_FILE = 'creatures.manifest.json';

/** Structural validation used by tests and by the build before writing. */
export function validateManifest(m: unknown): m is SpriteManifest {
  if (typeof m !== 'object' || m === null) return false;
  const o = m as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (o.encoding !== 'ktx2-uastc' && o.encoding !== 'webp') return false;
  if (typeof o.atlasSize !== 'number' || typeof o.spriteSize !== 'number') return false;
  if (!Array.isArray(o.atlases) || !Array.isArray(o.animations)) return false;
  const atlasIds = new Set<string>();
  for (const a of o.atlases as Array<Record<string, unknown>>) {
    for (const k of ['id', 'albedo', 'normal', 'emissive', 'group']) if (typeof a[k] !== 'string') return false;
    atlasIds.add(a.id as string);
  }
  if (typeof o.sprites !== 'object' || o.sprites === null) return false;
  const isRect = (r: unknown): boolean => {
    if (typeof r !== 'object' || r === null) return false;
    const x = r as Record<string, unknown>;
    if (typeof x.atlas !== 'string' || !atlasIds.has(x.atlas)) return false;
    for (const k of ['x', 'y', 'w', 'h', 'footV', 'pixelScale']) if (typeof x[k] !== 'number') return false;
    return typeof x.source === 'string';
  };
  for (const s of Object.values(o.sprites as Record<string, Record<string, unknown>>)) {
    if (!isRect(s.front) || !isRect(s.back)) return false;
  }
  for (const an of o.animations as Array<Record<string, unknown>>) {
    if (typeof an.species !== 'string' || typeof an.file !== 'string') return false;
  }
  return true;
}

/** Deterministic JSON: sprite keys and atlases sorted, 2-space indent, trailing newline. */
export function serializeManifest(m: SpriteManifest): string {
  const sprites: Record<string, ManifestSprite> = {};
  for (const id of Object.keys(m.sprites).sort()) sprites[id] = m.sprites[id]!;
  const ordered: SpriteManifest = {
    version: 1,
    encoding: m.encoding,
    atlasSize: m.atlasSize,
    spriteSize: m.spriteSize,
    atlases: [...m.atlases].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    sprites,
    animations: [...m.animations].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
