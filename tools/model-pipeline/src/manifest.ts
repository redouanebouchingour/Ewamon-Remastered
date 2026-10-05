/**
 * SPEC §40.2.5 `models.manifest.json` (version 2, amended 2026-10-05: the KayKit character set) — the interfaces
 * verbatim, plus the build of the file.
 *
 * Conventions this tool fixes (IMPLEMENTATION-NOTES M9, K1–K6):
 *  - every `url` is relative to `public/models/` (`legendaries/lumyth.glb`, `characters/knight.glb`), the manifest's own
 *    directory; the client prefixes `/models/` and appends `?v=<hash8>` (§40.2.6) from `hash`.
 *  - `bytes` of a legendary is its LOD0 GLB **plus the external KTX2 textures it references**; the LOD1 GLB is not in
 *    `bytes`. Every other entry's `bytes` is its one file.
 *  - `clips` sorted by name; `triangles` is LOD0's.
 *  - `totalBytes` is every file under `public/models/`, this manifest included (solved to a fixed point).
 */

export interface ModelEntry {
  readonly url: string; readonly lod1: string | null;
  readonly bytes: number; readonly triangles: number; readonly clips: readonly string[];
  readonly textures: 'ktx2' | 'webp' | 'none'; readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
  readonly hash: string;                                     // sha256 of the written GLB
}
/** One written file of the character set. */
export interface CharacterFile { readonly url: string; readonly bytes: number; readonly hash: string }
/** A body shape: one skinned primitive (one material, no image) on the `Rig_Medium` skin; bounds in the bind pose, model units. */
export interface ShapeEntry extends CharacterFile {
  readonly triangles: number;
  readonly texture: 'barbarian' | 'knight' | 'mage' | 'ranger' | 'rogue';   // the swatch layout its UVs address
  readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
}
/** A rigid hand-held mesh (UVs into its own texture's layout), parented to `bone` at runtime. */
export interface AccessoryEntry extends CharacterFile {
  readonly triangles: number;
  readonly texture: 'barbarian' | 'knight' | 'mage' | 'ranger' | 'rogue';
  readonly bone: 'handslot.l' | 'handslot.r';
  /** XYZ Euler (radians) of the item in the slot's frame. */
  readonly rotation: readonly [number, number, number];
}
/** The shared clips (node-only rig; tracks bind by joint name). `gaitSpeed`: model units / s of the planted toe at time scale 1. */
export interface AnimationsEntry extends CharacterFile {
  readonly clips: readonly string[];
  readonly durations: Readonly<Record<string, number>>;
  readonly gaitSpeed: { readonly walk: number; readonly run: number };
}
/** One look per tile, row-major; tile `i` covers columns [i % columns] and rows [⌊i / columns⌋] in `tileSize` px. */
export interface AtlasEntry extends CharacterFile {
  readonly textures: 'ktx2' | 'webp';
  readonly width: number; readonly height: number;
  readonly columns: number; readonly rows: number; readonly tileSize: number;
}
export interface CharactersEntry {
  readonly rig: 'Rig_Medium';
  /** World metres per model unit (one factor for every look: `heightM` / the median bare-head top). */
  readonly scale: number;
  /** A bare-headed character's standing height (m). */
  readonly heightM: number;
  readonly animations: AnimationsEntry;
  readonly atlas: AtlasEntry;
  readonly shapes: Readonly<Record<string, ShapeEntry>>;
  readonly accessories: Readonly<Record<string, AccessoryEntry>>;
}
/** A look: a shape, its atlas tile, an optional accessory (with the tile its UVs sample) and its height. */
export interface LookEntry {
  readonly shape: string;
  readonly tile: number;
  readonly accessory: string | null;
  readonly accessoryTile: number | null;
  readonly scale: number;
  /** Top of the look (headwear included) above the feet in the bind pose, metres. */
  readonly heightM: number;
}
export interface ModelsManifest {
  readonly version: 2;
  readonly legendaries: Readonly<Record<'lumyth' | 'noxmyth' | 'voidraxis' | 'zenryu', ModelEntry>>;
  readonly characters: CharactersEntry;
  readonly looks: Readonly<Record<string, LookEntry>>;      // the 19 @ewa/content LOOKS + the BODIES palette variants (`casual2_male:dusk` …)
  readonly totalBytes: number;
}

export const MANIFEST_FILE = 'models.manifest.json';
