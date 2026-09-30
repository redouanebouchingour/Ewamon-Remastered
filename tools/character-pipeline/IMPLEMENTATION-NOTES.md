# Character pipeline — implementation notes (2026-09-30)

The Quaternius GLB mannequins (§10.7.7) are replaced by procedural HD-2D pixel-art sprites: a paper-doll generator
in `tools/character-pipeline`, an atlas + manifest in `packages/client/public/characters/`, and an `ActorPool` that
draws every actor as one instance of a lit billboard (`packages/render/src/stage/actors.ts`,
`src/sprites/characterAtlas.ts`, `src/sprites/characterAnim.ts`). The SPEC is not edited here; the proposed
CHANGELOG entries are at the end.

## Design

### Cell, scale, proportions

- **Cell 32 × 52 texels**, character ≈ 42 texels from hair to sole (40 texels crown to sole without hair spikes)
  → **40 texels = 1.7 m**, 23.5 texels/m, a cell is 1.36 × 2.21 m. The brief suggested 32 × 48; the 4 extra rows
  are headroom above the head so plumes, horns, a shako and the cowboy crown never clip during the 1-texel walk bob
  and the 2-texel cheer hop (at 48 rows the knight's plume was cut on 70 frames). Soles sit on row 49, their outline
  on 50, the foot line is row 51 (`footV = 1/52`).
- **Why this size.** At the diorama camera a 1.7 m character is ≈ 170 px tall at 1440p (zoom stop 1, with the
  §10.4.4 lean) and 125–130 px at the zoomed-out stop: 3–4 screen pixels per texel at 1440p, ≈ 2–3 at 1080p. That is
  the chunky-but-readable magnification of HD-2D town sprites, it keeps every zoom stop magnified (NearestFilter,
  no mips needed), and 40 texels leave a 15-row head with 2 × 2 eyes, a highlight and a mouth: a face, not a dot.
- **Chibi proportions**: ≈ 2.6 heads — head + hair 18 rows, torso 12, legs 11; the head is 16 texels wide, the body
  with arms 16.

### Frames (44 per look)

| state | frames | facings | notes |
|---|---|---|---|
| idle | 2 | D U L R | breathing: the upper body sinks 1 texel on frame 2 |
| walk | 4 | D U L R | contact / passing / contact / passing; the body rises 1 texel on passing frames |
| run | 4 | D U L R | knee lift, pumping arms; profile leans 1 texel forward |
| wave | 2 | D | right hand raised beside the head, waving |
| cheer | 2 | D | both arms up; frame 2 is a 2-texel hop |

R is composed from the L templates mirrored **per part**, then its normal map is derived from the mirrored pixels,
so lighting stays correct; a part can override R (the eyepatch keeps its strap only on the far side). Emotes are
face-on only: an emoting actor that stands still turns to the camera (the classic JRPG convention).

### Paper doll

- **Layers** (per facing back-to-front; a cape hangs behind the body face-on and over it from behind; the far arm
  is behind the torso in profile): cape, hairLong, pack, legs, lower, torso, torsoExtra, arm, shoulder, head, face,
  faceExtra, hair, hat, armRaised (raised emote arms paint after the hat so a waving hand is in front of a brim).
- **Parts**: 6 skin tones · 5 faces (young m/f with lashes and blush, old m/f with brows and eye bags, eyes-only
  under a mask) · 11 hair styles (short spiky, messy, neat side-part, crop, ponytail, bob, bun, low chignon, long,
  topknot, balding) · 10 headwear (cowboy, cap, tricorn, knight bascinet + plume, winged gold helm + crest, army
  helmet + strap, shako, horned viking helm, ninja hood + headband tails, bowler) · 16 torsos (tee, open jacket,
  hoodie, cardigan, waistcoat, suit + tie, lab coat + stethoscope, kimono + obi, plate, ninja wrap + sash, captain's
  coat + striped shirt, fatigues, viking tunic, dress uniform + cross belts, bodice, tweed + bow tie) · lower garments
  (skirt, long skirt, coat tails, kimono robe, tunic skirt, tassets) · shoulder pieces (pauldrons, epaulettes, fur
  mantle, shawl) · cape · bandana, scarf, rucksack · viking beard, pirate beard, handlebar moustache, eyepatch,
  spectacles. Arms bind (upper, forearm, hand) so short sleeves, gloves and gauntlets are palette choices; legs bind
  (trousers, shin, shoe) so shorts, boots and tabi are too.
- **Looks**: every one of the 19 `LOOKS` has its own silhouette idea (plume + cape, hood tails, tricorn + coat skirts,
  white coat, horns + beard + mantle, shawl + chignon, brims, shako, cap). A test asserts every pair of base looks
  differs in ≥ 120 texels face-on.
- **Palette variants** (`BODIES.palette`: `casual2_male:dusk`, `casual2_female:dusk`, `cowboy_male:tide`,
  `cowboy_female:tide`, `knight_male:forge`) are baked recolours of clothing slots only (a test forbids skin, hair
  and face inks), exactly like 16-bit palette swaps. A hue-shift uniform (the creature approach) would have turned
  skin and hair too.

### Pixel-art craft rules as code

- **Ramps**: 4 tones per material in OKLCH with hue shifts — highlights toward warm yellow, shadows toward blue-violet,
  skin shadows toward rose (`color.ts`, tested). Kinds tune the steps: cloth, leather, skin, hair, metal (wide
  specular spread), gold, white (cool shadows), dark.
- **Selective outline**: every empty texel 4-adjacent to the sprite becomes a line texel of the neighbouring
  material — a dark, desaturated, hue-shifted relative, never black (tested) — lighter (`lineLit`) on the lit top /
  left edges, darker on the bottom / right.
- **Contact separation**: where a part in front meets a part behind (an arm against the torso below the armpit,
  the chin over the collar, a hem over the belt line, a raised arm over a brim) the texel behind drops to its deep
  tone. This keeps a tee-shirt arm readable against a tee-shirt body without authoring every contact line.
- **No dithering, binary alpha, 1-texel cell margins** (tested), light from the upper left in every template.
- **Authoring**: templates are full 32-column strings; symmetric face-on/back parts were drafted as left halves and
  mirrored with the lit edge turned to shadow on the right (the helper stayed out of the repo — the TS files are the
  source and are edited directly).

### Bake

- One atlas `chars-0`, 2048 × 884 (24 looks × 44 frames, 64 cells per row, cells contiguous per look).
- **Albedo**: straight RGBA, binary alpha; transparent texels within 2 of the sprite carry its RGB (no black pulled
  into edges if a view ever minifies). **Lossless WebP** (94 KB): flat pixel art codes tiny losslessly, while lossy
  chroma subsampling smears 1-texel colour edges that are magnified 3–4× on screen.
- **Normal**: the creatures' derivation, imported from `@ewa/sprite-pipeline` (`deriveNormalMap`: luminance height
  + Sobel + outward alpha-edge bevel) with the kernel scaled to pixel art — σ 0.6 (creature 1.2), strength 0.35,
  bevel 2.5 texels (creature 6 on ~900-texel sprites). Flat and alpha 255 outside the sprite. Lossless WebP (820 KB).
  In the scene the bevel is what makes the sprite lit rather than pasted: a lamp paints a warm rim on the near
  silhouette at night, the sun shades the far edge.
- **Emissive**: none (the runtime binds a 4 × 4 black mask).
- **Manifest** `characters.manifest.json` v1 (70 KB): cell, footV, pixelsPerMetre, cellM, fps, cycleM, the atlas
  (files + a content hash for cache busting), and per look `heightPx` (nameplate anchor) and facing → state → frame
  UV rects (v up, like the creature manifest). Sorted keys, numeric arrays on one line, trailing LF.
- **Determinism + cache**: integer rasters, `sharp` lossless WebP at effort 6; `.cache/<sha256(PIPELINE_VERSION,
  every src/**/*.ts file, encoder + normal settings)>/` holds the outputs; an unchanged rerun copies them and composes
  nothing (tested, along with byte-identical rebuilds).

### Output bytes (budget ≤ 3 MiB, `test/budget.test.ts`)

| file | bytes |
|---|---|
| `atlas/chars-0.albedo.webp` | 94 322 |
| `atlas/chars-0.normal.webp` | 820 242 |
| `characters.manifest.json` | ≈ 70 400 |
| **total** | **984 943 B (0.94 MiB)** |

Why 3 MiB: the whole set is one atlas loaded once per renderer (every look, because remote players can wear any
body); 3 MiB leaves room for roughly 2.5× more looks or a second atlas at the measured density. GPU: 2 × 2048 × 884
RGBA8 = 14.5 MB, level 0 only.

## Runtime (packages/render)

- `sprites/characterAtlas.ts`: the manifest mirror (render never imports tools), `CharacterFrames` (per look a flat
  rect table indexed facing × 5 + state; a facing without an emote falls back to its idle; ids resolve exactly
  (`knight_male:forge`), else to the base look (`casual_male:dusk` → `casual_male`), else to a deterministic hash
  pick among base looks (`ranger_m`, the battle stage's `spectator_<seed>_<i>`)), the textures, and the material.
- **The material is the §10.4.5 creature billboard graph, instanced**: derived-normal lighting, binary alpha cut at
  0.5 with `maskShadowNode` from the same alpha, `NearestFilter` magnification (`sprites.nearest` passes:
  `ewaClass 'billboard'`, `ewaAlbedo`), the §10.4.4 yaw + half-pitch lean with the turned normal/tangent, `mask` MRT
  (x 1 no GTAO darkening, y DOF-sharp), a faint warm rim in place of the type rim, `shadowSide DoubleSide`,
  `map null`. The per-object `userData` of the creature path becomes three instance attributes on an
  `InstancedBufferGeometry` (`iFeet`, `iRect`, `iMisc` = sharp, shown): three applies an `InstancedMesh` matrix
  *before* `positionNode` (NodeMaterial.setupPosition), which would scale the card math, so the card mesh stays at
  the origin and the feet are added after the lean/yaw. Palette, hurt flash, dissolve, shimmer and the emissive mask
  are constants for characters and left out.
- The textures exist from construction as empty `Texture`s (three uploads a default for them), so the material
  compiles in the §10.1.2 step-8 warm-up (`warmupMesh()` is a one-instance card); when the atlas decodes, the images
  are assigned in place (`image` + `needsUpdate`): three's `Textures.updateTexture` creates the real GPU texture and
  bumps the generation, bindings refresh — no recompile, no material re-point (H5c cannot arise).
- `sprites/characterAnim.ts` (pure, node-tested): facing = actor yaw − camera yaw (the `cameraYaw` uniform: the
  direction toward the camera) quantised to D/U/L/R with side sectors ±50°, front/back ±40° (a screen diagonal reads
  as a side view) and 8° hysteresis; walk / run frames advance with the measured ground speed (speed / 1.3 m resp.
  2.4 m × 4 fps, clamped, nominal 7 / 11 fps when stepping in place), a teleport (> 3 m) never reads as speed,
  walk ↔ run keep the stride phase; idle 1.6 fps; emotes 1/6 → wave, 2/5 → cheer (face-on, standing only), 3/4 keep
  idle.
- `stage/actors.ts` `CharacterPool` (§10.7.6 surface unchanged): 48 preallocated slots, zero allocation in
  `setTransform`/`update` (dirty flags, one `needsUpdate` per changed attribute per frame); the camera uniforms are
  the sprite pool's (written once per frame for creatures and characters); one instanced contact decal (the §10.4.7
  material) on the collider normal (central differences on the ground sampler); nameplates / emote cards anchor on
  the **leaned** head top (h·cos λ up, h·sin λ away from the camera) — an upright anchor lands on the forehead of a
  26°-leaned card.
- `RendererOptions.charactersUrl` (default `'/characters/'`, null = none) → `HostContext.charactersUrl` → the pool.
  The client passes it explicitly (`World3D`).
- **Removed**: `stage/looks.ts` (GLTFLoader look source), the procedural capsule figure and its skeleton, the
  `'character'` vertex-colour material, `test/actors-glb.test.ts`, and the `lookFor`/`EMOTE_CLIPS`/
  `buildCharacterGeometry`/`createGlbLookSource` exports. Legendary GLBs were never wired in render (unchanged).

### Measured (render sandbox `?demo=lineup`, part-1 diorama, headless Chrome 154 WebGPU, Intel Gen-12, 1600 × 900)

- **Draw calls, 24 characters vs none**: +2 beauty (1 card + 1 decal) + 5 shadow-map draws = **+7 in total**, for any
  number of live actors (was +128 with one mesh per actor: 24 beauty + 1 decal + 103 shadow casts, the same
  per-actor shadow cost the GLB path had). **0 new programs** (101 → 101): the material compiled at boot.
- Noon / morning / dusk / night shots: sprites are lit by the sun and the lamp through the bevel normals, cast alpha
  shadows, ground on the decal, the far rows take the tilt-shift blur, the local player stays sharp; nameplates sit
  just above the heads; emotes (wave / cheer) play; facings follow the heading while circling; no visible TRAA
  ghosting at ≈ 3 m/s.
- Known limit: instance motion is not in the velocity buffer (positions come from attributes, so VelocityNode sees
  only camera motion). TRAA's neighbourhood clamp hid it in every shot; an `iFeetPrev` attribute would make it exact.

## Tests

`tools/character-pipeline/test/generator.test.ts` (10): LOOKS coverage exact, BODIES variants exist, variants
recolour clothing only, 44-frame table, binary alpha + cell margins, standing frames on the foot line, selective
outline never black, pairwise look distinctness, byte determinism, hue-shifted ramps.
`test/budget.test.ts` (5, real output): ≤ 3 MiB and totalBytes == disk, manifest vs LOOKS/BODIES + full frame tables,
world scale, maps decode to the declared size with binary alpha and unit normals, rebuild byte-identical + cache hit.
`packages/render/test/characters.test.ts` (14): facing sectors + hysteresis, gait rates by speed, walk↔run phase,
teleports, emote mapping, manifest resolution, pool loading + cache-busted URLs + Nearest sampler, one instanced
card on one material with per-instance rects/flags, instance count 0 → no draw, feet + decal normal on a slope,
leaned nameplate anchor, pool exhaustion, dispose, failed manifest, the real manifest. `stage.test.ts`'s ActorPool
block updated (the `lookFor` assertions went with the procedural figure).

## Open / follow-ups (not in this change)

1. **Client palette**: `World3D.lookOf(body)` maps a body to its look and drops `BodyDef.palette`, so the baked
   `:dusk`/`:tide`/`:forge` variants are only drawn once the client passes `` `${look}:${palette}` `` for bodies with a
   palette (render already resolves it, and falls back to the base look).
2. `public/models/looks/*.glb` (3.4 MB) and the model pipeline's looks set are now unused at runtime; removing them is
   the model pipeline's call. `RendererOptions.modelsUrl` no longer feeds characters (kept for the unwired legendaries).
3. `tools/asset-audit` bytes: `characters/` has no line yet (counted as "outside the listed directories" in the total).
4. A root `pnpm characters` script next to `pnpm sprites` (root `package.json` not touched here).
5. Render `IMPLEMENTATION-NOTES.md` Part 3/4 (Q9, H7) still describe the GLB/procedural figure; this file supersedes
   them for characters.

## Proposed SPEC CHANGELOG entries (not applied)

- **§10.7.6 `ActorPool`** — *amended*: "Every actor is one instance of ONE lit pixel-art card: the §10.4.5 billboard
  graph with per-instance attributes `iFeet` (vec3, world foot point), `iRect` (vec4, frame UV), `iMisc` (vec2:
  DOF-sharp, shown) on an `InstancedBufferGeometry` of 48 slots at the origin (an `InstancedMesh` matrix would apply
  before `positionNode`); one instanced §10.4.7 contact decal on the collider normal. Draw calls for any number of
  live actors: 1 card + 1 per shadow cascade + 1 decal; 0 with none. Facing = actor yaw − `cameraYaw` quantised to
  4 (side sectors ±50°, 8° hysteresis); walk/run frames advance at speed / cycleM × 4 fps (walk 1.3 m, run 2.4 m;
  nominal 7 / 11 fps stepping in place); idle 1.6 fps; `setEmote` 1/6 → wave, 2/5 → cheer, played face-on while
  standing, 3/4 → idle; the 2 s card is the HUD's. `screenPositions`/`projectHead` anchor at the leaned head top
  (`heightPx / pixelsPerMetre + 0.16 m`, rotated by `cameraLean`). `setTransform`/`update` allocate nothing."
- **§10.7.7 Character models → Character sprites** — *replaced*: "Player and NPC looks are frames of the character
  atlas (`public/characters/characters.manifest.json` v1, §40.7), loaded once per `createRenderer` from
  `RendererOptions.charactersUrl` (default `/characters/`; null = none). One `MeshStandardNodeMaterial` for every
  character (class `billboard`, `ewaAlbedo` published for `sprites.nearest`), created with empty textures at step 7 so
  it compiles in the step-8 warm-up; the decoded maps are assigned in place. Albedo NearestFilter / LinearFilter,
  level 0 only (magnified at every zoom stop), normal NoColorSpace, emissive a black 4 × 4 R8. Look ids resolve
  exactly (`<look>:<palette>` for `BodyDef.palette`), else to the base look, else to a stable hash pick among base
  looks. The GLB looks, `AnimationMixer` clips and the `'character'` vertex-colour class are cut. Legendary GLBs are
  unchanged."
- **§40.7 (new) CHARACTER PIPELINE — `tools/character-pipeline`** — *added*: "Inputs: code-authored templates (no
  source art). Cell 32 × 52, 40 texels = 1.7 m, footV 1/52; 44 frames per look (D: idle 2, walk 4, run 4, wave 2,
  cheer 2; U/L/R: idle 2, walk 4, run 4; R = L mirrored per part). Paper doll: 15 layer kinds painted per facing,
  OKLCH hue-shifted 4-tone ramps, a selective 1-texel outline (never black), contact separation, binary alpha, no
  dithering. The 19 `LOOKS` + `BODIES` palette variants baked as `<look>:<palette>` clothing recolours. Bake: one
  2048-wide atlas, albedo lossless WebP (transparent RGB dilated 2 texels), normal = `@ewa/sprite-pipeline`
  `deriveNormalMap` at σ 0.6, strength 0.35, bevel 2.5, lossless WebP; manifest v1 (per look `heightPx` and facing →
  state → UV rects). Deterministic; cache keyed by sha256(PIPELINE_VERSION, src/**, settings). QA:
  `qa/contact-sheet.png` (every look × facing × state at 4×). Tests: `test/generator.test.ts`, `test/budget.test.ts`.
  §40.0.1's tool table gains the row; §40.0.2 rule 5 is unaffected (`@ewa/content` + a tool→tool import of
  `@ewa/sprite-pipeline`)."
- **§40.6** — *added row*: "`characters/` | **≤ 3 MB** (3 145 728 B) | `tools/character-pipeline/test/budget.test.ts`
  | measured 0.94 MiB (albedo 94 KB + normal 820 KB lossless WebP + manifest 70 KB)"; layout tree gains
  `characters/ atlas/chars-0.{albedo,normal}.webp, characters.manifest.json`; the total stays ≤ 219 MB (models/
  loses the 3.4 MB of look GLBs when the model pipeline drops them); `tools/asset-audit --bytes` gains the line.
