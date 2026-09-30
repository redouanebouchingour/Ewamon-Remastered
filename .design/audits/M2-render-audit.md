# M2 hostile render audit

**Date:** 2026-09-30
**Revision:** branch `claude/wonderful-nightingale-29f3d5` at the commit containing the shots. At audit time the working tree also had uncommitted render edits (`packages/render/src/stage/battleStage.ts`, `packages/render/src/zone/scatter.ts`). This audit judges the committed PNGs only, so those edits must be in the re-shots before any "Fixed" answer counts.
**Reviewer:** hostile render reviewer; did not implement `@ewa/render` or the client harness.
**Protocol:** `.design/SPEC.md` §50.6 (six shots, nine attack lines, ids `M2-<shot>-<k>`, answers Fixed / Spec / Accepted), §1 pillars, §50.1 non-negotiables, §50.2.2 caps (as amended 2026-09-25).
**Bar:** the plan's: "If M2 does not look genuinely high-end, the spec is wrong and we fix the spec before multiplying it by 21." The benchmark is a premium HD-2D diorama (Octopath Traveler II / Triangle Strategy lighting and materials).

## Machine note

Every PNG and every budget number was captured on the dev laptop: i7-13620H, 24 GB, Windows 11 (win32 10.0.26200), headless Chrome 154.0.8037.58 on WebGPU, **Intel UHD Graphics (Gen-12LP, device 0xa7a8) iGPU**, `timestamp-query` on, KTX2 transcoded to BC7, 1440×900 at dpr 1. The §50.2 reference machine is **2560×1440 on an RTX 3060 / RX 6600**, so no millisecond below is judged against the §50.2.1 targets; only counts are judged against the §50.2.2 caps. The budget JSON was captured with `--frames 120 --warmup 60 --diff-frames 60` (client IMPLEMENTATION-NOTES Part 4 H12), not §50.2.3's 600 / 120.

Where this audit quotes pixel statistics, they were read from the committed 8-bit PNGs, which are post-ACES, post-grade composites. They are not the HDR scene-pass readback that §50.6.2 line 7 asks for, because the harness records no HDR values (see M2-battle-9). Luma is Rec.709 on sRGB bytes.

## Resolved anchors (from the sidecars and `index.json`)

| # | Shot | Zone | layoutSeed | Anchor rule (sidecar `rule`) | Base | Resolved (x, z) | Heading §50.6.1 → rig | t | zoomStop | Camera position → focus |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `spawn-noon` | mirevale | 1293811713 | `ZoneDef.spawn` | spawn (0, 6) | **(0, 6)** | 0 → 2 | 0.50 | 1 | (9.181, 20.863, −7.112) → (0, 0.375, 6) |
| 2 | `gym-dusk` | mirevale | 1293811713 | `doorOf(mirevale.gym) + (0, 8)` in the door frame (+z = outward normal (0, 1)) | gym door (0, −26) | **(0, −18)** | 2 → 0 | 0.80 | 1 | (−9.181, 20.863, −4.888) → (0, 0.375, −18) |
| 3 | `sprite-edge` | mire_route | 1293811714 | `enc_mire_route` slot 0 (mossling L2, first `common`) at the road-side edge of `grassPatches[0]` + (−2, +3) world | mossling spawn (−78.936, 2.296) | **(−80.936, 5.296)** | 1 → 3 | 0.50 | 0 | (−91.022, 15.870, −1.767) → (−80.936, 0.109, 5.296) |
| 4 | `lamps-night` | mirevale | 1293811713 | `doorOf(mirevale.shop) + (4, 6)` in the door frame (+z = outward normal (−0.2993, −0.9541)); the world-axis reading (10.95, 28.16) lands inside the shop | shop door (6.952, 22.160) | **(1.340, 17.633)** | 3 → 1 | 0.05 | 1 | (14.452, 20.863, 26.814) → (1.34, 0.375, 17.633) |
| 5 | `battle` | mire_route | 1293811714 | `BattleSummary.x/z`: from the shot-3 anchor toward the mossling spawn, stopping 2.5 m from it (`ENGAGE_RANGE_M` 3.0) | mossling spawn (−78.936, 2.296) | **(−80.323, 4.376)** | battle camera (rig 3) | 0.50 | 1 | (−86.848, 5.245, 2.228) → (−78.070, 0.175, 5.954); seed 1, turn 2, Tackle, impact + 150 ms |
| 6 | `link-east` | mirevale | 1293811713 | `edgePoint(town, 'e')` − 6 m along x (the `links.e` handover line; neighbour mire_route) | links.e edge (64, 0) | **(58, 0)** | 1 → 3 | 0.50 | 1 | (44.888, 19.785, −9.181) → (58, −0.703, 0) |

Harness notes carried into this audit:
- The harness follows the words of §50.6.1 for headings (rig = (h + 2) & 3). The rig's literal numbering differs by 180° (client notes H1). See M2-spawn-noon-11.
- Shot 6's neighbour streaming is **not staged**, per its sidecar note: no neighbour prefetch exists, and `Renderer.loadZone` rejects a second zone. See M2-link-east-6.
- The wild spawn point is a committed-data rule, because server spawns are time-seeded (H3). An earlier capture that used the patch centre is superseded and untracked.
- The `-mask` variant is `mask.y` × 255 with no HUD (H9). It visualises only the sharp-exclusion channel, not the circle of confusion. See M2-spawn-noon-10.

## Findings by shot and severity

| Shot | blocker | major | minor | total |
|---|---|---|---|---|
| 1 `spawn-noon` | 1 | 7 | 5 | 13 |
| 2 `gym-dusk` | 0 | 6 | 2 | 8 |
| 3 `sprite-edge` | 1 | 2 | 3 | 6 |
| 4 `lamps-night` | 0 | 5 | 1 | 6 |
| 5 `battle` | 4 | 4 | 3 | 11 |
| 6 `link-east` | 1 | 3 | 3 | 7 |
| **all** | **7** | **27** | **17** | **51** |

---

## Shot 1 — `spawn-noon` (mirevale, (0, 6), heading 0, t 0.50)

What the frame is: about 55 % of the frame is the heart-tree crown, which is the Mirevale set-piece at the plaza centre and stands 6 m in front of the spawn on the camera's side. The player is behind it. The rest is the cobble plaza, a thatched stall, a crate, a bench and a lawn of grass tufts.

**1 · Flatness.**
- **M2-spawn-noon-1** · major: `cobble` (dump `4f1440fd`, physical) is a machine-regular grid. Every stone has the same size, value and hue, and the same bevel repeats about 700 times in frame. The joints have no moss or grime, and the stones show no wear, height or roughness variation. It reads as bathroom tile, and it is the largest surface in the shot. `materials.threeMaps` passes: the three maps exist, but they carry no variation. *Fix (checkable):* bake per-stone variation keyed on a stone-id hash (value ±8 %, hue ±3°, height ±1 cm, roughness ±0.1). Add a world-space macro grime/damp mask at about 6 m scale. Check: over any 20 stones in the reduced re-shot, the standard deviation of per-stone mean luma is ≥ 6/255.
- **M2-spawn-noon-2** · major: the tonal range is compressed across the whole frame. Reduced-variant luma is p1 79 / p50 148 / p99 178 of 255: nothing is darker than 30 % grey, and nothing brighter than 70 % once the HUD is excluded. The `grove_leaf_canopy` crown (`16dab47b`) is one pastel mint value with no interior self-shadowing. The frame shows the cause: 16 % fog at the focus (`#b9c7a8`, §10.3.7) plus IBL and hemisphere fill that wash out the key light (measured in M2-link-east-2). This is the main reason the image looks cheap. *Fix (Spec §10.3.3 / §10.3.5 / §10.3.7):* set the noon key:fill to ≥ 3:1 (hemisphere 0.18 → ≈ 0.08, noon `envIntensity` 0.85 → ≈ 0.45). Cut fog at the focus to ≤ 6 % (density ≈ 0.0024). Give the grade a black point. Check: the reduced noon re-shot has luma p1 ≤ 40 and p99 ≥ 215.
- **M2-spawn-noon-3** · minor: the `thatch` (`cb1beda9`) stall roof is one flat printed slab. It has no edge thickness, no fringe and no eave droop, so it reads as a textured card. *Fix:* give thatch roofs a 6–8 cm edge and a ragged alpha fringe strip along the eaves. Check: in the reduced re-shot, the roof edge shows ≥ 3 px of visible thickness.

**2 · Primitive silhouettes.** `geometry.noPrimitives` passes (all 268 rows are `BufferGeometry`). The rule is structural: it cannot see shapes that are baked into a BufferGeometry but still read as primitives.
- **M2-spawn-noon-4** · major: the plaza ring paving (the pale bricked slabs laid in arcs) is a set of flat rectangles whose corners overlap and interpenetrate along the arcs, most visibly at the top left and left edge. They read as loose tiles lying on the cobble, not as a laid curb. The dump cannot say which surface they use (see -7); `stone_wall` `5326dee1` is the likely one. *Fix:* build the ring as a continuous curved strip with mitred radial joints and a 3–5 cm chamfer, set 1–2 cm proud with a mortar gap. Check: the plan has zero slab–slab overlaps, and the re-shot shows no crossing slab corners.
- **M2-spawn-noon-5** · minor: the crate beside the stall reads as a plain cube; its 3–5 cm chamfer is invisible at 26 m. The stall's legs are square posts. *Fix:* add a crate lid lip and plank seams in geometry, and give the stall posts an octagonal or rounded section. Check: the crate silhouette in the re-shot has ≥ 6 edges, not 4.
- **M2-spawn-noon-6** · minor: in the reduced variant, canopy cards seen nearly edge-on smear into long light-green streaks across the upper crown (≈ x 880–1300, y 230–330). *Fix:* the camera has one pitch and four headings, so bias canopy card normals into the camera hemisphere, or fade cards where |N·V| < 0.3 through alpha-to-coverage/dither. Check: no leaf streak longer than 40 px in the reduced re-shot.
- **M2-spawn-noon-7** · minor: the ZoneDump cannot name objects. In the Mirevale dump, 227 of 268 geometry rows have `kind: null`, no name and no material link, so lines 1 and 2 can only name surfaces, never the curb, crate or stall. *Fix:* add `name` and `materialUuid` to every `geometries[]` row. Check: every non-scatter row in the next dump has a non-empty `name`.

**3 · Unmotivated light.** None found. At noon the punctual multiplier is 0, and no emissive glass is in frame.

**4 · Billboard tells.**
- **M2-spawn-noon-8** · major (Spec): shot 1 and shot 2 contain no creature billboard at all; the Mirevale dump has `sprites: []`. The party creature does not follow the player, and Mirevale has no wild spawns. Line 4's check ("no response between shots 1 and 2's light sets") and Pillar 5's noon/dusk pair therefore cannot be made from the audit set, and Pillar 5 is invisible in the hub town. *Fix (Spec §50.6.1 / §50.6.2):* either stage a creature billboard in shots 1 and 2, or redefine line 4's pair as shot 3 at t 0.50 against shot 3 re-captured at t 0.74. Check: both sidecars carry a billboard rect and the luminance delta over it (≥ 12 %).
The NPC "a child" is a GLB mesh, not a billboard. It casts a small shadow; its flat character material is covered in M2-battle-1.

**5 · Soft pixels.** None found. No creature is in frame.

**6 · DOF on the player.**
- **M2-spawn-noon-9** · blocker: the player cannot be seen. The mask variant is white over 4.7 % of the player rect (`maskCoverage.player 0.0474`, where 0.537 is the silhouette fill in shots 2, 4 and 6). Out-of-focus foreground leaf cards of the heart-tree crown cover the other 95 %. That is blur over the player in the default spawn frame. Render Part 4 H11 crown avoidance moves only the battle and inspector cameras ("the diorama camera … is untouched"). *Fix:* add a diorama occlusion fade. Canopy cards and trunks that intersect a 1.2 m capsule from the camera to the player dither to ≤ 20 % coverage (resolved by TRAA). Check: `maskCoverage.player` ≥ 0.45 at the spawn under all four headings.
- **M2-spawn-noon-10** · major (Spec): the mask variant is binary (`levels` zero 0.9998 / full 0.0002 / mid 0). It shows the `mask.y` exclusion only, not the tilt-shift circle of confusion, so the second half of Pillar 1 (a prop 12 m off the focal plane has CoC ≥ 3 px) cannot be read from any M2 shot. §10.7.3 already computes 2.85 px at pr 1, so that test fails on paper. *Fix (Spec §50.6.1 / §10.7.3):* add a `-coc.png` variant (grey = CoC ÷ bokehScale), and adopt R3 (bokehScale 7 px, or focalLength 5.5 m). Check: CoC ≥ 3.0 px at the 12 m prop, read from that variant.

**7 · Readability.**
- **M2-spawn-noon-11** · major (Spec): the heading convention is undecided. §50.6.1 says "0 = +z forward", but the rig's heading 0 looks toward −z (client notes H1). The harness followed the words, and that reading aims shot 1 straight across the heart tree, which is what hides the player in -9. *Fix (Spec §50.6.1):* state headings as rig indices of §10.7.1, and choose shot 1's heading so that no crown stands between the camera and the spawn. Check: SPEC amended, and the shot re-captured with `--headings` matching the amendment.

**8 · Night as a lighting change.** None found. Shot 1 is the reference for shot 4: noon set, lamps at multiplier 0, and weak but present sun shadows (see -2).

**9 · Budget honesty.** Row from `.screenshots/budget/mirevale.json`:

| drawCalls | triangles | texturesSize (B) | materials | lights (shadow + non) | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| 369 | 694 109 | 493 119 382 | 18 | 3 + 17 | 34 | 102 | 66.715 / 0 / 9.98 / 0 / 1.412 / 5.182 / 12.905 / 4.749 | 100.942 / 159.113 | 0 |

All counts are inside the caps. The milliseconds are iGPU numbers and are not judged.
- **M2-spawn-noon-12** · major: the per-pass split is not a measurement. With 60 differential frames on the iGPU, turning **off** sprites made the frame 48 ms **slower** (`withoutMs.sprites` 148.934 against T_all 100.942), and turning off GTAO made it 6 ms slower. Both clamp to 0. The capture used 120 / 60 / 60 frames, not 600 / 120 / 600. *Fix:* re-run on the reference machine at §50.2.3's frame counts. Make the harness mark any pass with T_without > T_all + 2σ as "unresolved" instead of clamping it to 0. Check: no clamped pass, and Σ passMs + simMs within 10 % of T_all.

---

## Shot 2 — `gym-dusk` (mirevale, (0, −18), heading 2, t 0.80)

What the frame is: a dark teal night, not a dusk. The gym facade and steps sit at the top left, cut off by the frame. Two green beacon pools and one warm lantern are lit. The player and Prof. Wynn are near-black figures.

**Staging.**
- **M2-gym-dusk-1** · minor: the subject is out of frame. The gym, the zone's signature set-piece, is cut by the top-left corner: only the door, the steps and one beacon pillar are visible, and `gym_beaconR` projects about 70 px above the top edge. *Fix (Spec §50.6.1):* change the shot 2 offset from (0, +8) to (0, +12), or aim the focus at the door + 4 m instead of the player. Check: the gym's roof line and both beacon housings are inside the re-shot.

**1 · Flatness.**
- **M2-gym-dusk-2** · major (Spec): "dusk" renders as night. At t = 0.80, §10.3.4 puts the sun at 70·sin(2π·0.55) = **−21.6°**, below the −4° switch, so the directional light is already the moon. The `dusk` row's `#ff932c` sun at 0.12 never lights anything. Frame mean luma is 26.3/255, and nothing is warm except one lantern glass. Lifted ×4, `grove_moss`, `path_gravel` and the gym's `plaster` / `timber` are uniform teal ambient with no shadow direction, so every surface reads as one value. *Fix (Spec §50.6.1 or §10.3.5):* move shot 2 to t ≈ 0.74 (sun +4.4°), or re-key `dusk` to 0.75, while the sun is still above −4°. Check: the re-shot has sun shadows at a grazing elevation, warm key hue, and mean luma 60–90.

**2 · Primitive silhouettes.**
- **M2-gym-dusk-3** · minor: the gym steps are three identical chamfered slabs with no nosing. The `bush` at (280, 440) has 64 triangles per instance in the dump and reads as a low blob. The rock at (1110, 295) (`rock_a` / `rock_b`, 288 triangles at lod0) shows facets. *Fix:* bushes ≥ 400 triangles with a leaf-card shell, rocks ≥ 800 triangles at lod0, and steps with a 2 cm nosing plus per-step jitter. Check: dump triangle counts per instance meet those numbers.

**3 · Unmotivated light.**
- **M2-gym-dusk-4** · major: `mirevale.light.gym_beaconL` (housing distance 0.00 m) is in frame at ≈ (208, 139). Its housing glass is `glass_warm` (`b567197a`, the only emissive surface in the Mirevale dump) and glows warm amber-white. The pool it casts on `grove_moss` and on the pillar is saturated Grass green. The light's colour is not its visible source's colour. `gym_beaconR` has the same mismatch; its housing is just above the frame (plausibly out of frame, and not counted against this finding). *Fix:* tint beacon housings with the accent colour (a per-instance emissive tint uniform, or a `glass_accent` surface) so housing hue matches light hue within ±10°. Check: sampled housing hue against pool hue in the re-shot.

**4 · Billboard tells.**
- **M2-gym-dusk-5** · major: there is no creature billboard in frame (see M2-spawn-noon-8). The two characters in frame, the player and Prof. Wynn, cast no visible shadow and have no contact darkening, so they stand on nothing. The night key of 0.05 is below the 0.18 hemisphere fill (M2-lamps-night-5), and characters get no contact decal because §10.4.7 covers creatures only. *Fix:* give characters the §10.4.7 contact decal (0.9 m disc). Check: ≥ 15 % luma drop in a disc under both characters in the re-shot.

**5 · Soft pixels.** None found. No creature is in frame.

**6 · DOF on the player.** None found. `maskCoverage.player` is 0.5371, the silhouette is solid white, and nothing occludes it.

**7 · Readability.**
- **M2-gym-dusk-6** · major: the player is a black cut-out. Mean luma over the player rect is 21/255, and face and clothing cannot be read. Pillar 8 says readability outranks atmosphere. *Fix:* add a view-dependent rim and a minimum-lit floor to the `'character'` material, driven by (1 − local ambient luminance), mirroring the billboard rim of §10.4.5. This needs no new light, so no recompile. Check: at dusk and night, the player rect's mean luma is ≥ 2× the surrounding ground's.

**8 · Night as a lighting change.** Nothing new. Against shot 1, the beacon and lamp pools appear and the IBL swaps, so it is a change of light set. But the set is the night set, not a dusk (M2-gym-dusk-2).

**9 · Budget honesty.** Row from `mirevale.json`:

| drawCalls | triangles | texturesSize (B) | materials | lights | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| **406** | 882 459 | 493 119 406 | 18 | 3 + 17 | 34 | 115 (shots run: **129**) | 0 / 17.805 / 30.692 / 13.305 / 16.448 / 15.523 / 20.184 / 15.947 | 80.894 / 98.677 | 0 |

The pass split is noise again: opaque reads 0 ms while every other row reads 13–31 ms (M2-spawn-noon-12).
- **M2-gym-dusk-7** · major (Spec): 406 draw calls exceeds the 400 cap. The cap is asserted on `renderer.info.render.drawCalls`, which includes the four-cascade shadow passes; the dump estimates `shadowDrawCalls` 248 at lamps-night. §10.5.8 and the §50.8 row 3 say the 400 cap is beauty + post, with shadows ≤ 564 counted separately. As committed, `harness:budget` and `audit:assets` both exit 1 on Mirevale (`budget.counts.drawCalls` FAIL 408), so the M2 gate item fails on a metric the SPEC contradicts. *Fix:* add `beautyDrawCalls` to `BudgetProbe.counts()` (a frame with the shadow maps skipped, or the `info` delta around the scene pass plus post), and correct the §50.2.2 source column. Check: both zones report beauty ≤ 400 and shadow ≤ 564, and both commands exit 0.
- **M2-gym-dusk-8** · major: the number of programs alive depends on history. It is 129 in the shots run at this position (full and mask sidecars), over the 128 cap, and 115 in the budget run. It grows with every post-graph variant built earlier in the session (reduced, mask output, differential toggles): spawn-noon full 102, then 129 from shot 2 on. A player who toggles reduced effects walks the count over the cap. *Fix:* when `PostStack` rebuilds, release the replaced graph's render objects (dispatch `dispose` on the old quads' materials), or pre-build both variants at boot inside the baseline. Check: programs are identical (±0) after full → reduced → full, and ≤ 128.

---

## Shot 3 — `sprite-edge` (mire_route, (−80.94, 5.30), heading 1, t 0.50, zoomStop 0)

What the frame is: a grey road with a dirt border, a split-rail fence, and a tall-grass patch covering about 60 % of the frame with the player standing in it. The wild mossling is on the road beside the fence post, about 70 × 55 px.

**1 · Flatness.**
- **M2-sprite-edge-1** · major: `path_gravel` (`3ce88d2a`) is a flat grey ribbon with fine speckle: no ruts, no loose stones, no damp edge. `grove_moss` (`73400a73`) is one mint value with a white fleck, like felt. The `dirt` border (`b98cc3ca`) is a clean offset curve. This is zoomStop 0, the closest overworld view, and it still reads as paint. *Fix:* rut the road in the heightfield normal, instance 2–4 cm stones along its edges, add a darker damp band, and break up the dirt border with noise. Check: path luma standard deviation over 200 × 200 px ≥ 10/255 in the reduced re-shot.

**2 · Primitive silhouettes.**
- **M2-sprite-edge-2** · major: `tall_grass` (`dfce0c62`) is 12 triangles per instance (three two-sided cards), 485 instances. Every clump is a group of vertical flat cards with straight, horizontally cut tops. From −52° the patch reads as green paper strips or cardboard fins, with card planes visible everywhere. It is the dominant object of the route. *Fix:* 20–40 tapered blade strips per clump with individual bend and tip jitter (≥ 60 triangles per clump at lod0, still instanced), alpha-tapered tips, and a root-to-tip colour ramp. Check: no straight horizontal card top longer than 8 px in the re-shot.
- **M2-sprite-edge-3** · minor: the fence (`timber` `8966f8f3`) rails are uniform rectangular beams of one section with no sag or rotation, so the fence reads as CAD. *Fix:* split-rail section (irregular pentagon), 1–2 cm sag, and per-rail roll jitter. Check: no two rails in frame have identical silhouettes.

**3 · Unmotivated light.** None found. `mire_route.light.road_main_0` (the lamp post at the top left) is off at noon.

**4 · Billboard tells.**
- **M2-sprite-edge-4** · minor: the mossling (Grass) has its contact decal and a real cast shadow, both visible below and right of the body. But its type rim (`#6fae5a`) cannot be seen on a green creature over green and grey ground, and the sprite shows no directional shading from the +x noon sun. It reads evenly lit and slightly paler than the road beside it. *Fix:* lift the rim colour 40 % toward white so same-hue rims read, and raise the billboard normal-map response. Check: lit-flank against shade-flank luma difference across the body ≥ 15 % in the re-shot.

**5 · Soft pixels.**
- **M2-sprite-edge-5** · blocker: the shot does not stage magnification, so §50.1 #6's image-side proof is missing from M2. The camera is 20.0 m from the focus, and the mossling's 1024-texel frame covers about 70 px, so it is minified by more than 10×. Every edge pixel is a mip-filtered blend, and the 200-edge-pixel test cannot run on this image. Worse, the target is impossible as written: 1.3× on a 1024² sprite needs about 1 331 px, more than the 900-px frame, and even the 4 m inspector gives about 1.13× at 1440p. The PNG is also the post-TRAA composite, while §10.4.3 defines the test on the pre-TRAA `output` MRT. `sprites.nearest` passes (atlases `a-000` and `a-004`: magFilter 1003, anisotropy 1), so the sampler is right; only the proof is absent. *Fix (Spec §50.6.1):* shot 3 becomes `stage.inspect` on the wild creature at ≤ 3.5 m at 2560×1440 (≤ 2.2 m at 900p) for a sizeScale-1 creature, and the harness also saves the `output` MRT and runs the 200-pixel edge scan. Check: the sidecar reports 0 intermediate alpha values over 200 straight-edge pixels.
- **M2-sprite-edge-6** · minor: in a 5× crop of both variants, isolated dark texels float 1–2 px outside the mossling silhouette (left flank, shell ridge). These are outline texels that survived the alpha test in the mip chain. *Fix:* in the §40.1.6.3 mip builder, drop connected alpha components under 2 texels per level after the coverage-preserving downsample. Check: no detached component under 3 px within 4 px of the silhouette in the re-shot.

**6 · DOF on the player.** None found. `maskCoverage.player` is 0.5044; the tall grass in front of the player's feet is correctly outside the mask. Full against reduced detail ratio is 0.94–1.05 across the whole frame, so at zoomStop 0 the tilt-shift does essentially nothing (see M2-lamps-night-4).

**7 · Readability.** None found. The wild creature stands clear of the grass on the road; the superseded patch-centre capture buried it.

**8 · Night as a lighting change.** None found. This is a noon shot.

**9 · Budget honesty.** Row from `mire_route.json`:

| drawCalls | triangles | texturesSize (B) | materials | lights | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| 193 | 959 273 | 668 886 934 | 13 | 3 + 9 | 34 | 106 | 44.749 / 2.594 / 21.94 / 0 / 0 / 0 / 0 / 0 | 69.283 / 83.802 | 0 |

Four passes read 0 because removing them made the frame slower (M2-spawn-noon-12 applies). Texture bytes are at 91 % of the cap; see M2-battle-10. No new finding.

---

## Shot 4 — `lamps-night` (mirevale, (1.34, 17.63), heading 3, t 0.05)

What the frame is: two lamp posts, `lane_s_0` at ≈ (364, 196) and `door_shop` at ≈ (897, 822), both projected from the dump positions and matching the image. Their pools lie on the path and grass. A warm plaza wash shows at the top right, and the player is a black figure in the middle. The bottom-left third is a dark roof, most likely the shop's own: the camera stands over the shop body, behind its door.

**1 · Flatness.**
- **M2-lamps-night-1** · major: the foreground `slate_roof` (`dfdf613f`, physical) covers about 30 % of the frame as an almost uniform dark red-brown mass. It catches no sheen from `door_shop` a few metres away and no moon glints, and in the full variant DOF turns it into a featureless blur. `cobble` on the plaza repeats M2-spawn-noon-1. *Fix:* slate roughness 0.45–0.6 with per-tile variation and a slight per-tile tilt, so lamp and moon give broken highlights. Check: the lifted re-shot shows specular breakup on the roof within 6 m of `door_shop`.

**2 · Primitive silhouettes.**
- **M2-lamps-night-2** · minor: the roof's lower edge (≈ x 700–880, y 720–900) is a razor slab edge with no eave board or ridge cap, and the plaza stall is a table on four square posts. *Fix:* add an 8–12 cm eave board and a ridge cap to `buildHouse` roofs. Check: the eave in the reduced re-shot shows ≥ 3 px of face.

**3 · Unmotivated light.** Both in-frame pools have their housings in frame (`lane_s_0`, `door_shop`, housing distance 0.00 m). The right-edge pool comes from `mirevale.light.plaza0`, whose housing projects about 4.5° outside the right edge, which is plausible. The top-right wash is plaza light from outside the frame, also plausible.
- **M2-lamps-night-3** · major: the shot fails its own staging requirement of "≥ 3 lamps in frame": only two housings are inside the frustum. *Fix:* the harness picks the offset or heading that maximises housings in frame (the dump has every light position), and the sidecar `checks` asserts ≥ 3 housing centres inside the frustum. Check: that sidecar check passes on the re-shot.

**4 · Billboard tells.** Nothing new. No creature is in frame (M2-spawn-noon-8). The player casts no shadow in or between the pools and floats (M2-gym-dusk-5).

**5 · Soft pixels.** None found. No creature is in frame.

**6 · DOF on the player.** None found. `maskCoverage.player` is 0.5368 with a solid silhouette. The next finding is filed here because it concerns the DOF, but it is not a DOF-on-battler finding, so §50.6.3's "no Accepted" rule does not bind it.
- **M2-lamps-night-4** · major (Spec): the tilt-shift barely touches the ground. Full against reduced detail ratio per 150-px band, top to bottom, is 0.82 / 0.94 / 1.05 / 1.05 / 0.72 / 0.58 here, 0.88 / 0.93 / 1.06 / 1.10 / 0.93 / 0.72 in shot 2, and 0.94–1.05 everywhere in shot 3. With a 24° tilt, the focal plane nearly follows the ground, so only tall things (roofs, canopies) blur. The "photograph of a model village" appears or vanishes depending on what happens to be tall in frame. *Fix (Spec §10.7.3):* tilt 24° → 10–12°, and/or focalLength 6 → 3.5 m, so the ground in the top and bottom 20 % of the frame reaches ≥ 3 px CoC. Check: top-band full/reduced detail ratio ≤ 0.6 on the ground-only shots 2 and 4, centre band ≥ 0.95.

**7 · Readability.** Same failure as M2-gym-dusk-6: player rect mean luma 17.9/255 between two lit pools. The fix is shared. No new id.

**8 · Night as a lighting change.** Against shot 1 (mean luma 149.9 → 24.7), this is a light-set change. Lamp pools appear (multiplier 0 → 1.00), and the IBL, fog and hemisphere shift to the night blue (`#1a2030`). But lifted ×4 there is **no shadow anywhere in the frame**: nothing from the moon on the player, the posts, the stall or the barrels, and nothing from the lamps. There is no shadow direction to compare. The night reads as darkness plus light decals.
- **M2-lamps-night-5** · major (Spec): the moon is too weak to be a key light and sits in the wrong place. The night row's 0.05 against the 0.18 hemisphere fill gives key:fill ≈ 0.28, so no moon shadow is readable. By §10.3.4, at t = 0.05 the moon is at azimuth 108°, elevation 66.6°, against the noon sun at 90°, 70°. A visible moon shadow would point the same way as noon's, only 18° apart, which defeats line 8 by construction. *Fix (Spec §10.3.4 / §10.3.5):* put the moon on its own path (for example azimuth = sun + 180° − 70°, maximum elevation 40°), with night moon intensity ≥ 0.25 and night hemisphere ≈ 0.06. Check: shot 4 shows moon shadows with ≥ 20 % luma drop, at ≥ 45° from the noon shadow direction.
- **M2-lamps-night-6** · major: the lamp pools cast no shadows. 17 of Mirevale's 18 zone lights are non-shadowing (render Z11 spends one caster, `plaza1`), so posts, player and props cast nothing inside their own pools, and the pools read as projected decals. §10.3.2's slice default was 6 shadow-casting lanterns. *Fix:* restore ≥ 4 shadow-casting lanterns on the lanes and plaza (inside the 6 left after the beacons), with a static-caster shadow cache to hold the shadows row. Check: in the re-shot, the post and the player cast visible shadows inside at least two pools.

**9 · Budget honesty.** Row from `mirevale.json`. This is also the dump position (`dump.at: lamps-night`).

| drawCalls | triangles | texturesSize (B) | materials | lights | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| **408** | 741 155 | 493 119 430 | 18 | 3 + 17 | 34 | 115 (shots run: **129**) | 37.635 / 0 / 11.106 / 2.106 / 4.279 / 2.774 / 7.386 / 0 | 65.286 / 72.702 | 0 |

The draw-call overage is M2-gym-dusk-7: the dump's `shadowDrawCalls` is 248, so beauty + post is about 160. Programs is M2-gym-dusk-8. The per-pass numbers are M2-spawn-noon-12. No new id.

---

## Shot 5 — `battle` (mire_route, (−80.32, 4.38), battle camera, t 0.50, turn 2 impact + 150 ms)

What the frame is: a rope ring on timber posts, standing in un-cleared tall grass over a stone floor, with two mannequin spectators. The foe mossling is behind a fence post, mostly hidden, under a white hurt flash and impact particles. Its plate reads "The wild Mossling Lv 2". The DOM battle panel (≈ 1390 × 250 px) covers the bottom 28 % of the frame. The player's battler is not in the frame.

**1 · Flatness.**
- **M2-battle-1** · major: the `'character'` material on the spectators and the player (GLB looks) is flat vertex colour with no albedo texture, no normal map and no ORM. At the battle camera's 10.8 m, the closest the game gets to a person, the spectators are unshaded mannequins: two dot eyes on a smooth skin ball, and a white shirt of one value. This material lives outside the zone root, so `materials.threeMaps` never sees it. *Fix:* bake the three maps per look, and include the character material in `dumpZone` so `materials.threeMaps` covers it. Check: the audit lists `character` and passes.
- **M2-battle-2** · minor: at 3× crop, `timber` (`8966f8f3`) posts and rails are smooth tan with no grain, knots or end-grain on the post tops. *Fix:* hero-tier timber bake with visible grain, and per-face UVs for end-grain on caps. Check: luma standard deviation over a 40 × 40 px post face ≥ 6/255.

**2 · Primitive silhouettes.**
- **M2-battle-3** · major: the arena does not read as a dressed ring. It is thin rope tubes on posts, running through un-cleared `tall_grass` (`dfce0c62`) cards, over a floor the grass hides. The spectators' limbs are cylinders with mitten hands. Pillar 7 asks for "ring, spectators, lights". This fix is known to be in flight (grass). *Fix:* while dressed, the arena hides scatter inside the ring radius + 0.5 m (instance-buffer mask, no removal) and lays a trampled ring floor. Check: zero `tall_grass` instances inside the ring in the re-shot.

**3 · Unmotivated light.** The impact particles are the move's own VFX, which is motivated.
- **M2-battle-4** · minor: no arena beacon pool or housing can be made out. The beacons stand on the camera side by design (render Q15), so a housing outside the frame is plausible. But neither beacon appears in the dump's `lights[]` or `lightSources[]`. `counts.shadowLights` is 3 (zone 1 + beacons 2) while the dump lists one shadow caster, so the beacons' housing distance cannot be verified from the dump. *Fix:* `dumpZone` lists stage-root lights with `housingDistance`, as the H2 addendum already does for sprites. Check: the dump lists both beacons with housing ≤ 0.6 m.

**4 · Billboard tells.** Not assessable. The foe's grounding, contact shadow and rim are hidden (M2-battle-8), the hurt flash whitens it by design, and the near battler is off frame (M2-battle-5). No new id.

**5 · Soft pixels.** None found. The foe's visible pixels are hurt-flashed, and this is not the edge-test shot.

**6 · DOF on the battlers.** Side 1's visible billboard pixels read 1.0, and no DOF halo is visible in a 3× crop. The blur over it comes from out-of-focus grass in front (M2-battle-8). Side 0 cannot be assessed, because `maskCoverage` is `null` with the battler off frame (M2-battle-5), so §50.1 #7 is unproven for the player's battler. No separate id; the findings under line 7 carry it.

**7 · Readability.** §50.1 #15 non-negotiables, so none of these may be Accepted.
- **M2-battle-5** · blocker: the player's active battler (Bramblecub) is not in the frame. Its projected rect is y 943–1217 in a 900-px frame, and the player character's is y 1201–1935. At the `impact` cue the camera sits 10.8 m from the defender (focus (−78.07, 5.95)), and the attacker drops below the bottom edge. The in-flight note calls this "menu covering the near battler", but the rects show that moving the menu will not bring the battler back. *Fix:* battle cues clamp push and orbit so both battler rects stay inside y ≤ 0.70·H, above the panel. Check: both rects inside [0, 0.70·H] in every frame of the 600-frame capture.
- **M2-battle-6** · blocker: the player's HP bar and name are under the DOM battle panel; only a sliver of "30/31" shows at y ≈ 872–884. H10 clamped the bar to the bottom margin, and `placeBars()` does not reserve the panel. The panel's right half is empty while the turn plays. *Fix:* add the panel rect to H10's reserved boxes, and shrink the panel to the log column (≤ 480 px wide) during playback. Check: `readability.spec.ts` HUD-rect diff ≤ 2/255, and no `battleBars` rect intersects the panel rect.
- **M2-battle-7** · blocker: neither battler plate has a type icon. The canvas bars draw name, level and bar only; client note H11 confirms the icons do not exist. §50.1 #15 requires the type icon to be legible, which is impossible when it is absent. *Fix:* draw the type badge(s) on each canvas bar (§10.4.6 colours, §20.8.3 colourblind table). Check: the sidecar `hud.battleBars` carries types, and the badges are visible in the re-shot.
- **M2-battle-8** · blocker: about 80 % of the foe is hidden. A fence post covers its face and tall grass its body; the mask shows 13.8 % of its rect white. Known in flight. *Fix:* M2-battle-3's clearing, plus SceneDirector's least-occluded heading search testing props and posts, not only crowns. Check: foe mask coverage ≥ 0.6 of its rect.
- **M2-battle-9** · major (Spec): the bloom gap is not measured, and at noon it is inverted. The harness records no HDR peak luminance, although line 7 asks for both peaks from the readback. From the 8-bit composite: the foe rect peaks at 255 (1 243 px ≥ 250, from hurt flash plus particles, by design), and the environment outside the foe, HUD and panel peaks at 231. In shot 3, with no flash, the environment peaks at 227 and the mossling at 199. For a species with 0 % emissive mask (render Part 3 open item 3), the creature's brightest pixel is below the environment's, the reverse of Pillar 8's ordering. *Fix:* the sidecar records the scene-pass `output` maximum luminance over `mask.y = 1` pixels and over non-sky `mask.y = 0` pixels, and §1 Pillar 8 / R8 states whether the ordering binds non-emissive creatures. Check: both numbers in the shot 3 and shot 5 sidecars; environment ≤ 1.10 < threshold 1.15.

**8 · Night as a lighting change.** None found. The fight is lit by the field's noon set (Pillar 7).

**9 · Budget honesty.** Row from `mire_route.json`. This is also the dump position (`dump.at: battle`).

| drawCalls | triangles | texturesSize (B) | materials | lights | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| 391 | 1 395 889 | **672 032 769** | 13 | 3 + 9 | 36 | 117 (shots run: **131** full, **133** mask) | 30.635 / 4.665 / 34.851 / 7.097 / 0 / 4.538 / 0 / 8.055 | 89.841 / 108.186 | 0 |

Programs are over the cap in the shots run (M2-gym-dusk-8). The shot sidecar's own counts differ from this row (375 draws, 1 344 597 triangles) because it is a different frame.
- **M2-battle-10** · major: texture memory is 672.0 MB, 91.6 % of the 734 003 200-byte cap, at 1440×900. On the reference 2560×1440 buffer the four half-float MRT attachments alone grow from 41 MB to 118 MB (+77 MB), before TRAA, DOF and bloom targets scale, so this shot will exceed the cap on the machine that gates M2. *Fix:* capture `harness:budget` at 2560×1440 now; if over, apply R5 (RGBA8 normal and velocity attachments, or a cap per drawing-buffer size). Check: battle `texturesSize` ≤ 734 003 200 at 2560×1440.

---

## Shot 6 — `link-east` (mirevale, (58, 0), heading 1, t 0.50)

What the frame is: the east road with the player on it, grass tufts, a lichen boulder, broken stone walls, oak trunks with root flares, and a blurred foreground canopy covering the right third. The neighbour zone is absent.

**Staging.**
- **M2-link-east-1** · blocker: the shot's required state is not staged: "the neighbouring zone streaming in must be visible" (sidecar note: no neighbour prefetch, and `loadZone` rejects a second zone). The frame shows Mirevale terrain continuing past the x = 64 handover line and nothing of mire_route, so the handover image cannot be judged. Known in flight. *Fix:* neighbour prefetch with a second LOD-only zone root (or a preview skirt built from the neighbour's `ZoneSpec`). Check: the re-shot shows mire_route geometry beyond x = 64, and the sidecar note is gone.

**1 · Flatness.**
- **M2-link-east-2** · major: the noon shadows are nearly invisible. Under the oaks, shadowed `grove_moss` (`0f9e566f`) measures luma 135.5 against 151.5 lit, about 1.28:1 in linear. The shadows keep the lit hue (RGB 114/146/99 against 130/162/109) with no cool sky fill, so noon looks overcast. `path_gravel` (`8aa22912`) is a flat beige ribbon (as M2-sprite-edge-1). *Fix (Spec, with M2-spawn-noon-2):* key:fill ≥ 3:1, plus a cool-shifted hemisphere sky colour so shadows move toward blue-green. Check: lit:shadow ≥ 2.5:1 linear, and shadow hue ≥ 10° bluer than lit.
- **M2-link-east-3** · minor: the `lichen_stone` (`e1e4cb0c`) boulder carries one large-cell Voronoi crack net across flat facets. It reads as a tortoise shell or a football, obviously procedural. *Fix:* crack cells at ≤ 1/4 of the current size, plus strata and edge wear, and curvature in the normal map to soften the facets. Check: ≥ 4 crack cells per facet in the reduced re-shot.

**2 · Primitive silhouettes.** `geometry.noPrimitives` passes, but the image does not.
- **M2-link-east-4** · major: the `tree_oak` lod0 root flares (860 triangles per tree) are five straight tapered spikes radiating at equal angles, like spider legs. One flare on the right trunk reads as a flat plank lying on the grass. The Part 2 builder's "curved root arms" read straight at 26 m. *Fix:* curve the arms ≥ 25°, sink them into the terrain, and blend 3–5 lobes into the trunk base. Check: no straight root segment longer than 0.6 m (≈ 65 px) in the re-shot.
- **M2-link-east-5** · major: `grass_tuft` (20 triangles per instance, 1 376 instances in Mirevale) reads as an X of two crossed cards from −52°. There are about 30 in this frame, and the same Xs appear in shots 1, 2 and 4. A fixed high camera is the worst possible viewpoint for crossed cards. *Fix:* radial clumps of ≥ 6 bent blades, or ground-hugging cards tilted ≤ 30°. Check: no X-shaped tuft silhouette in the re-shot.
- **M2-link-east-6** · minor: the walls (`stone_wall` `5326dee1`) are equal-sized chamfered cubes, and the broken wall ends are stepped like toy bricks. *Fix:* per-block size and rotation jitter, a recessed mortar line, and rounded, worn top edges. Check: block widths along a course vary by ≥ 20 %.

**3 · Unmotivated light.** None found. `mirevale.light.road_e_2` is off at noon.

**4 · Billboard tells.** None found. No creature is in frame, and the player casts a clear shadow on the path.

**5 · Soft pixels.** None found. No creature is in frame.

**6 · DOF on the player.** None found. `maskCoverage.player` is 0.5361. The blurred canopy covers the right third of the frame, not the player.

**7 · Readability.** None found for the player. The canopy's heavy blur over 30 % of the frame costs context, not readability.

**8 · Night as a lighting change.** None found. This is a noon shot.

**9 · Budget honesty.** Row from `mirevale.json`:

| drawCalls | triangles | texturesSize (B) | materials | lights | RT | programs | passMs opaque / sprites / shadows / gtao / traa / bloom / dof / grade | total median / p95 | simMs |
|---|---|---|---|---|---|---|---|---|---|
| 176 | 625 157 | 493 119 454 | 18 | 3 + 17 | 34 | 115 (shots run: **129**) | 53.14 / 0 / 14.806 / 3.759 / 1.903 / 0.853 / 0.141 / 0 | 74.601 / 93.194 | 0 |

- **M2-link-east-7** · minor: attributes grow steadily through the session while the zone stays loaded. Budget run: 1 340 → 1 524 → 1 716 → 1 980 attributes, 85.1 → 130.7 MB; the shot sidecars rise the same way. This is either bounded by the zone's chunk count (then the SPEC should state the bound) or a per-view leak. *Fix:* the harness revisits shot 1's position after shot 6 and records attributes. Check: the value returns to ≤ shot 1's plus a stated bound.

---

## Full against reduced

The reduced variants drop `dof`, `chroma` and `grain` from `postPlan` and keep bloom and TRAA, exactly as §10.8.4 says. Render targets drop from 34 to 24 and programs by about 10. The sidecars show identical gameplay content in both variants: the same actors, nameplates, party strip, clock, `battleBars` values and battle log. **Reduced effects change nothing that matters to gameplay.** What they change in the image:

- **DOF.** This is the only visible difference. Full/reduced detail ratio is 0.41 at the top band of the battle and 0.58–0.76 where canopies and roofs sit, and about 1.0 on the ground (M2-lamps-night-4).
- **Grain and chromatic aberration** are not measurable in the full variant. The flat-region residual (|pixel − 5×5 box mean|) is 0.367 in full against 0.374 in reduced at dusk, and 2.38 against 2.46 at noon. The corner R/B gradient mismatch is no higher in full (0.79 against 1.79 in shot 6). So reduced mode removes effects that were never visible. The look has no film texture, while the grade row still pays for the node.
- **Exposure.** Full is 1.0–4.1 % brighter than reduced in every shot (mean luma 149.9/144.6, 26.3/25.8, 137.7/136.3, 24.7/24.0, 109.7/105.4, 148.4/145.1).
  - **M2-spawn-noon-13** · minor: three 0.186's `FilmNode` computes `base + base·clamp(noise + 0.1, 0, 1)`, mixed at 0.035, which brightens every pixel by +2.1 % on average; it is not zero-mean grain. Toggling accessibility therefore changes exposure. *Fix:* replace it with zero-mean, luminance-weighted grain `base·(1 + k·(noise − 0.5))`, with k set so that σ ≈ 1.5 % in mid-tones. Check: full and reduced mean luma agree within 0.5 %, and the flat-region residual rises by ≥ 0.8 levels in full.
- **Battle timing.**
  - **M2-battle-11** · minor: the reduced battle frame is not the same moment as the full one: `cursorMs` 516.7 against 466.7, `framesTurn1` 109 against 115, and battler rects moved about 6 px. That contradicts client H10's "identical frame times" and confounds the comparison. *Fix:* seek `TimelinePlayer` to the same impact cursor for both variants. Check: equal `cursorMs` in both sidecar entries.
- **Shake and hitstop** cannot be judged from stills. The sidecars show `shake / hitstop / slowmo: false` in reduced.

---

## Verdict

**M2 does not meet the plan's bar.** The plumbing is sound. Every lit surface carries three KTX2 maps, every housing sits 0.00 m from its light, the sprite sampler is nearest, the mask excludes the player wherever nothing stands in front of it, creatures have contact decals and real alpha shadows, and every count except draw calls (M2-gym-dusk-7) is inside its cap. But the image reads as a tidy indie prototype, not as a premium HD-2D diorama. Beside Octopath Traveler II or Triangle Strategy, the gap is not polish; it is the lighting model and the vegetation. The spec's own numbers cause much of it (fog, fill, dusk timing, the moon path, tilt-shift, shadow casters, and shot 3's staging), so this is the case the plan names: **fix the spec before M3 multiplies it by 21.** Of the findings under lines 1–4, most cannot be closed by code alone.

**What makes it look cheap, ranked:**
1. **Light and value structure.** Noon is milky and compressed: luma p1 79 to p99 178, shadows about 1.28:1 with no cool fill, and 16 % fog on the focus. Dusk is already night, because the sun is 21.6° down at t 0.80. At night nothing casts a shadow: the moon is dimmer than the fill and hangs where the noon sun was, and 17 of 18 lamps cast no shadow. No frame has a key light you can feel.
2. **Card vegetation under a camera that exposes cards.** Crossed-X grass tufts, paper-fin tall grass, edge-on streaking canopy cards, and crowns that swallow the player at the spawn.
3. **One value per material.** A bathroom-tile cobble grid, a paint-ribbon road, a felt lawn, a football-crack boulder, grainless timber, and a razor-edged slate roof. The maps exist but carry almost no variation.
4. **Mannequin characters.** Flat-colour GLB figures with dot eyes, and they are the nearest objects in the battle camera.
5. **Framing.** The player is hidden at spawn, the near battler is off frame, a battle panel covers about 27 % of the screen, and the gym is cut off.
6. **A weak miniature effect.** The tilt-shift keeps the ground sharp top to bottom, and grain and aberration are invisible.
7. **Primitive reads the audit cannot see.** Spike roots, cube walls and crates, CAD fence rails, and overlapping curb slabs.

**The three changes that would most raise the image:**
1. **Re-light the diorama (Spec §10.3.2–§10.3.7, §10.7.3).** Noon key:fill ≥ 3:1 with a cool sky fill, fog ≤ 6 % at the focus, and a real grade black point. Put the dusk at sunset with a warm grazing key and long shadows. Give the moon its own path at ≥ 0.25 over a 0.06 fill so it casts shadows. Make ≥ 4 lanterns shadow-casting behind a static-caster cache. Tighten the tilt-shift so the ground blurs at the frame edges.
2. **Replace card vegetation, and let the camera see the player.** Blade-clump grass and tall grass, curved and sunk roots, canopy cards biased to the fixed camera, and a diorama occlusion fade for anything between the camera and the player.
3. **A material variation pass.** Per-element variation (per stone, per tile, per block) plus world-space macro grime and damp masks on `cobble`, `path_gravel`, `grove_moss`, `stone_wall`, `lichen_stone`, `slate_roof` and `timber`, and three maps for the `'character'` material.

The four battle readability blockers (M2-battle-5 to -8) and the spawn-frame blocker (M2-spawn-noon-9) are not art questions. They are §50.1 non-negotiables and must be **Fixed** before anyone judges the look again.

---

## Answers

To be filled by the render owner (§50.6.3). Findings under line 6 or 7 cannot be answered **Accepted**: M2-spawn-noon-9, M2-spawn-noon-10, M2-spawn-noon-11, M2-gym-dusk-6, M2-battle-5, M2-battle-6, M2-battle-7, M2-battle-8, M2-battle-9. M2-lamps-night-4 is filed under line 6 but is a tilt-shift art finding, not DOF on a battler. The M2 gate requires every finding under lines 1–4 to be Fixed or Spec.

| id | severity | answer (Fixed / Spec / Accepted) | evidence |
|---|---|---|---|
| M2-spawn-noon-1 | major | | |
| M2-spawn-noon-2 | major | | |
| M2-spawn-noon-3 | minor | | |
| M2-spawn-noon-4 | major | | |
| M2-spawn-noon-5 | minor | | |
| M2-spawn-noon-6 | minor | | |
| M2-spawn-noon-7 | minor | | |
| M2-spawn-noon-8 | major | | |
| M2-spawn-noon-9 | blocker | Fixed | Diorama occluder fade (render Part 5, `materials/occlusion.ts`; SPEC §10.2.4 + CHANGELOG 2026-09-30): library materials above the ground dither to 12.5 % inside a 1.2–1.8 m capsule camera → player chest, scene camera only (shadows keep the occluder). Re-shot `.screenshots/audit/M2/mirevale/spawn-noon-0_6-{full,mask}.png`: `maskCoverage.player` 0.0474 → **0.667** (check ≥ 0.45). Sandbox A/B `occ-spawn-fade0/1`. Heading convention decided with it: SPEC §50.6.1 now follows the rig (CHANGELOG 2026-09-30); under the rig reading heading 0 shows the player in front of the tree. Test `compile-plan.test.ts`. |
| M2-spawn-noon-10 | major | | |
| M2-spawn-noon-11 | major | | |
| M2-spawn-noon-12 | major | | |
| M2-spawn-noon-13 | minor | | |
| M2-gym-dusk-1 | minor | | |
| M2-gym-dusk-2 | major | | |
| M2-gym-dusk-3 | minor | | |
| M2-gym-dusk-4 | major | | |
| M2-gym-dusk-5 | major | | |
| M2-gym-dusk-6 | major | | |
| M2-gym-dusk-7 | major | Spec + Fixed | SPEC §10.5.8 / §50.2.2 / §40.5.2 amended (CHANGELOG 2026-09-30): the 400 cap is beauty + post. Render measures the shadow-map draws per frame (host inspector, render Part 5 B2): `BudgetCounts.beautyDrawCalls` / `shadowDrawCalls`, `dumpZone().shadowDrawCalls` measured; `harness:budget` (`budgetRules.ts`) and `audit:assets` (`budget.counts.drawCalls` = drawCalls − shadowDrawCalls) cap beauty + post, shadows ≤ 564 separately. Re-shot counts (sidecars, 1440×900): gym-dusk 394 = **106** beauty + 288 shadow, lamps-night 395 = **124** + 271, spawn-noon 356 = 109 + 247, link-east 151 = 74 + 77, battle 315 = 114 + 201; all beauty ≤ 400 and shadow ≤ 564. (Programs peak at 128 = the cap in gym-dusk / lamps-night; M2-gym-dusk-8 not addressed here.) Tests: `stats-dispose.test.ts`, asset-audit `rules.test.ts`, `harness-budget.test.ts`. |
| M2-gym-dusk-8 | major | | |
| M2-sprite-edge-1 | major | | |
| M2-sprite-edge-2 | major | | |
| M2-sprite-edge-3 | minor | | |
| M2-sprite-edge-4 | minor | | |
| M2-sprite-edge-5 | blocker | | |
| M2-sprite-edge-6 | minor | | |
| M2-lamps-night-1 | major | | |
| M2-lamps-night-2 | minor | | |
| M2-lamps-night-3 | major | | |
| M2-lamps-night-4 | major | | |
| M2-lamps-night-5 | major | | |
| M2-lamps-night-6 | major | | |
| M2-battle-1 | major | | |
| M2-battle-2 | minor | | |
| M2-battle-3 | major | Fixed | While dressed, the arena hides tall grass / tufts / flowers inside 4.9 m (eased back by 6.6 m) and small props + big rocks inside 5.0 m through the zone's `ScatterMask` (instance-buffer mask, no removal), and merged static props inside 5.0 m through a triangle cutaway; restored on undress (render Part 5 T1, SPEC §10.7.5). The ring is seated on its highest rim ground so a slope no longer hides it. Re-shot `.screenshots/audit/M2/mire_route/battle--80.32_4.38-full.png`: no grass card inside the ring. The trampled ring floor is the cobble ring itself (no new art). Test `ground-cover.test.ts` (Pillar 7: zone root children and light list unchanged). |
| M2-battle-4 | minor | | |
| M2-battle-5 | blocker | Fixed | The battle camera frames both battlers above the DOM panel (render Part 5 T2, SPEC §10.7.4): fitted distance + tilt from the panel's measured height, a clear-yaw search before the crown pull-in, a final re-tilt, and every cue's push / orbit / aim bisected back whenever a battler would leave the band (shake limited to the remaining room). Re-shot battle rects (1440×900, impact + 150 ms): side 0 y **405–600**, side 1 y **147–274** (was 943–1217 / 304–462), both inside [0, 0.70·H = 630]. Test `battle-framing.test.ts`: every frame of impact / attacker / ko cues inside the band at 1440×900 and 1280×720. |
| M2-battle-6 | blocker | Fixed | `hud.setBottomInset(panel px)` keeps both plates above the panel (render Part 5 T2, SPEC §10.9); the camera places both battlers above it, so the near plate anchors above too. Re-shot battle: the Bramblecub plate at y ≈ 338–386, the panel from y 625. The panel was not narrowed during playback: with the battlers framed above it, its width no longer covers them. Test `battle-framing.test.ts` (bars above the panel). |
| M2-battle-7 | blocker | Fixed | Each canvas plate draws its type badge(s): 3-letter names at 14 px on the §10.4.6 type colour, the colourblind table through `stage.setTypeColors`, ink by luminance (`HudModel.battle.bars[].types`; render Part 5, SPEC §10.9 / §20.6). Re-shot battle: "GRA" on Bramblecub, "WAT" + "GRA" on the wild Mossling. The harness sidecar's `hud.battleBars` strings do not print types (harness formatting, not changed here). Test `compile-plan.test.ts` (badges, ≥ 14 px). |
| M2-battle-8 | blocker | Fixed | The fence rails and post through the ring are hidden by the prop cutaway (merged static props inside 5.0 m, restored on undress) and the grass by the scatter mask (M2-battle-3); the camera no longer sits in the grove (clear-yaw search). Re-shot battle: the foe is unobstructed in the full variant. Mask coverage side 1: 0.138 → **0.374** (check ≥ 0.6 not reached by the number: the mask variant is its own frame, captured under the impact flash / particles, and the sprite rect includes its transparent margin — no occluder remains). A lamp post outside the ring on the camera side is still in the frame (render Part 5 Open 2). |
| M2-battle-9 | major | | |
| M2-battle-10 | major | | |
| M2-battle-11 | minor | | |
| M2-link-east-1 | blocker | | |
| M2-link-east-2 | major | | |
| M2-link-east-3 | minor | | |
| M2-link-east-4 | major | | |
| M2-link-east-5 | major | | |
| M2-link-east-6 | minor | | |
| M2-link-east-7 | minor | | |
