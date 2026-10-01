/**
 * SPEC §40.2.5 `models.manifest.json` — the interfaces verbatim, plus the build of the file.
 *
 * Conventions this tool fixes (the SPEC leaves them open; IMPLEMENTATION-NOTES M9):
 *  - `url` / `lod1` are relative to `public/models/` (`legendaries/lumyth.glb`), the manifest's own directory; the
 *    client prefixes `/models/` and appends `?v=<hash8>` (§40.2.6) from `hash`.
 *  - `bytes` of a legendary is its LOD0 GLB **plus the external KTX2 textures it references** (those are the
 *    "3 textures" §40.2.6 counts inside the 1.2 MB LOD0 line); the LOD1 GLB is not in `bytes` (§40.2.6: "`bytes`
 *    counts the GLB only" for LOD1, which reuses the same textures by url).
 *  - `clips` sorted by name; `triangles` is LOD0's.
 *  - `totalBytes` is every file under `public/models/`, this manifest included (the size is solved to a fixed
 *    point), so it equals the directory on disk and `asset-audit --bytes` reads the same number either way.
 *  - `looks` is kept so the file still matches the §40.2.5 interface, and is always `{}`: the Quaternius looks are
 *    no longer built — characters are pixel-art sprites in `public/characters/` (IMPLEMENTATION-NOTES M11).
 */

export interface ModelEntry {
  readonly url: string; readonly lod1: string | null;
  readonly bytes: number; readonly triangles: number; readonly clips: readonly string[];
  readonly textures: 'ktx2' | 'webp' | 'none'; readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
  readonly hash: string;                                     // sha256 of the written GLB
}
export interface ModelsManifest {
  readonly version: 1;
  readonly legendaries: Readonly<Record<'lumyth' | 'noxmyth' | 'voidraxis' | 'zenryu', ModelEntry>>;
  readonly looks: Readonly<Record<string, ModelEntry>>;      // always {} since the looks were dropped (M11)
  readonly totalBytes: number;
}

export const MANIFEST_FILE = 'models.manifest.json';
