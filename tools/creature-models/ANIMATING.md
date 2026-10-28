# Animating an Ewamon: findings and learnings

What we learned rigging and animating the first 3D Ewamons (Flowbot, then the first template batch: Joeyjab, Moflame,
Puffinch, Malice and Serpyre, 2026-10-28). Read this before rigging the next one. Start from the body-plan template
that fits (`rigs/lib/`, below) and the creature of that plan already done; `rigs/flowbot.mjs` is the hand-written
example. The tool is `src/rig.mjs`; the game side is `packages/render/src/sprites/creatureRig.ts` (render
IMPLEMENTATION-NOTES "Rigged creatures").

## How it fits together

- `build.mjs` makes the static `<id>.glb` from the scad (one mesh, vertex colours, 1 m tall, feet on y = 0).
- `rig.mjs <id>` reads that GLB plus `rigs/<id>.mjs` and writes `<id>.rig.glb`: a skeleton, rigid skin weights (one
  joint per triangle) and the clips baked at 30 fps. `index.json` then serves the rigged file (`rig: true`).
- The client ships the rig only. The first rig moves the static GLB from `packages/client/public/creature-models/` to
  `glb/<id>.glb` here, where it stays as the rig's input; `build.mjs` writes a rigged creature's static GLB there too.
  A rig is about 1.17 × its static GLB, so rigging all 203 adds about 5.5 MiB to the public folder.
- The clips are baked into ONE animation, clip after clip, with the table `{ name: [start, end] }` in its extras; the
  game cuts it back into named clips when the GLB loads (`splitClips`). One track per moving channel instead of one per
  channel per clip took Flowbot's glTF JSON from 98 KB to 15 KB. Meshopt runs in `FILTER` mode (quaternion and
  exponential filters on the keys, octahedral normals): Flowbot's rig went from 293 to 142 KiB, a third more than its
  static GLB (108 KiB).
- The rig works on the GLB, not the scad, so it needs no OpenSCAD. That matters: the OpenSCAD on this machine is
  2021.01, too old for the Manifold backend and coloured 3MF that `build.mjs` needs. Rigging still works.
- In game, each creature clones the template and an `AnimationMixer` picks the clip. Nothing else in the game had to
  change: palettes, hurt flash, faint dissolve, rims and glow all keep working on the moving parts.
- First run on a fresh checkout: `pnpm install` (the tool's `sharp` / gltf-transform were not installed yet).
- To rebuild a model you need a recent OpenSCAD (2024 or later, for `--backend=Manifold` and colour 3MF). A snapshot
  from files.openscad.org/snapshots works without installing: unzip it and set `OPENSCAD=<dir>/openscad.com`. It
  gives the same geometry as the committed GLBs (same triangles and bounds); only the compressed bytes differ.

## The clip contract (the names are the API)

| Clip | When it plays |
| --- | --- |
| `idle` | loop while standing (each creature starts at its own phase, so a crowd is not in step) |
| `walk` | loop while the feet move faster than 0.35 m/s; its speed follows the walk speed |
| `idle_*` | fidgets: one at random every 6 to 13 s while idling, never while walking |
| `windup` `lunge` `hurt` `recoil` `faint` `celebrate` `enter` `exit` | once, on the battle pose, stretched to its ms |

- Battle poses are short: windup 250 ms, lunge 300, hurt 260, recoil 250, celebrate 600, enter 450, exit 350, faint
  900. Author each clip at exactly that length (`seconds`), then the stretch factor is 1.
- `lunge` hits at about u = 0.4 (the card's lunge peak). Put the punch there.
- `faint` holds its last frame; `windup` holds 0.6 s if no lunge follows. Make both end in a pose worth holding.
- The card still moves the whole body on top (lunge forward, hurt knock-back, faint sink). Don't double those in the
  clip; animate the parts.
- A missing clip is fine: that pose just keeps the loop.

## Coordinates and rotation signs (checked on screen, not guessed)

Everything in a rig file is in the scad's own frame and units: Z up, the creature faces -Y, +X is the creature's own
left (the viewer's right). Rotations are degrees in OpenSCAD `rotate([rx, ry, rz])` order.

- `rx > 0` tips a part's top forward (a nod). A hanging arm swings BACK, so a forward arm raise is `rx < 0`.
- `ry > 0` tips the top towards +X. A hanging left arm (+X) lifts outwards with `ry < 0`; the right arm mirrors.
  Arms straight up over the head is about `ry = -128..-150` on the left.
- `rz > 0` turns the face towards +X. In game a front-facing body keeps a three-quarter turn, so +X is the side
  nearest the camera: turn the head with `rz > 0` to look at the player, and wave with the left (+X) arm.
- Mirror a left pose to the right by flipping `ry`, `rz` and the x offset (`both()` / `mirror()` in flowbot.mjs).
- `p` offsets and `r` rotations are in the joint's own rest frame. Give a tilted part (Flowbot's screen is tilted
  -14°) a rest `rot` so "squash vertically" means vertical on that part.

## The frame: automatic (`frames.json`)

The GLB is the scad model scaled to 1 m, its floor on y = 0 and its x / y bounding-box centre moved to the origin.
`build.mjs` records that per creature in `frames.json` (`height`, `minZ`, `cx`, `cy`, the extents and the triangle
count); `node src/build.mjs --frames <id …> | --all` fills it from the scads without rewriting any GLB (all 203 are in
it). `rig.mjs` reads it, so a rig file needs no `frame` and rebuilding a model never breaks the rig's mapping.

- Flowbot's hand calibration matched (32.72 / 5.406) but missed the centring: the build centres x and y, and 145 of the
  203 models are off-centre by more than a unit (a tail, a snout). A hand `frame` without `cx` / `cy` puts every pivot
  of those that far off.
- `rig.mjs` warns when `frames.json` no longer matches the GLB (triangle count or extents): a scad edited and rebuilt
  by an older build, or a frame never refreshed.

## Cutting the mesh into parts (`assign`)

- `assign(centroid, rgb)` runs per triangle and returns a joint name. Colour picks out the obvious parts (gloves,
  flames, a mane); for parts of one colour (fur all over) use the scad's own primitives.
- **The nearest primitive wins.** The scad is a union, so every visible triangle lies on the surface of the primitive
  it came from (normalised distance about 1) and outside all the others (more than 1). Copy the primitives' numbers
  into a list `[[joint, distance], …]` and take `closest()` (`rigs/lib/geo.mjs`: `ellD` for ell / sphere, `capD` /
  `capsule` for limb, `chainHit` for chain, `blobD` for blob, `petalD` for a rotated petal, `plateD` / `slabD` for
  lib.scad's plate() / slab() outlines (wings, fins, flat bodies; pass the point in the part's frame), `subFrame` for a
  `translate() rotate() scale()` block, `fold` / `side` for `mirror_x()` parts). Joeyjab's one fur colour splits into
  head, body, haunches, arms, ears and four tail links this way with no hand-tuned boxes.
- **Look at it:** `RIG_PARTS=1 node src/rig.mjs <id>` colours each joint's triangles apart; shoot it from four sides
  (`src/check/views-steps.mjs`), then re-rig without the flag. One picture shows every boundary.
- Use a part's own frame for the tricky bits: Flowbot's head is rotated in the scad, so the head test transforms the
  centroid into the head frame first (`headLocal`) and checks a box there. Telling eyes from mouth (same ink colour)
  was then just "above or below the eye line".
- **Put each pivot at the centre of a ball.** Shoulders, elbows, wrists and the neck all sit inside a sphere or
  cylinder in the scad. A sphere rotating about its own centre stays put, so rigid skinning shows no seams. Check the
  close-up: Flowbot had no visible cracks at any joint.
- Split on a joint's z where the visible surface changes hands, e.g. the legs end where the pelvis blob's underside
  is (z 14.3), not at the hip pivot.
- The scad was a union: surfaces hidden inside other parts are gone. Dropping a part in the rig leaves a hole where
  it touched (Flowbot's feet were open where they met its old drum). So remove a part in the scad and rebuild when you
  can; that closes the surfaces properly.
- `assign` may return `null` to drop a triangle; the rest is then refitted to 1 m with its lowest point on the
  ground. Use it only when the scad can't be rebuilt. Flowbot's drum first went this way, then out of the scad.
- No platforms at all: creatures stand on the game's ground (the 11 that had a base, puddle or pool lost it on
  2026-10-28). A hovering creature keeps its gap with `// ground: <z>` in its scad (build.mjs), not with a stand.
- Watch the console: a joint with no geometry prints a warning. That usually means a wrong pivot or a rule that
  never matches.
- **Model updates:** `rig-parts.json` keeps the triangles per joint from the last rig. When a re-rig after a scad change
  moves a joint by more than a quarter (and at least 24 triangles) it warns: a recolour or a moved part that an
  `assign` rule no longer catches. Look at the RIG_PARTS view, fix the rule, re-rig.

## Expressions: add geometry the scad never had (`extras`)

- For lib.scad's `eye()` use `eyeKit()` (`rigs/lib/face.mjs`) with the numbers of the eye() call: a skin-coloured lid
  per eye (an ellipsoid extra, `shape: 'ell'`) that closes from the top, plus ink strokes on the shut lid.
  `face.pose('open', blink)` blinks, `'shut'` closes, `'happy'` (∩ ∩), `'dizzy'` (x x) and `'squeeze'` (> <) shut and
  draw. It works on angry lidded eyes and socket eyes (`squash`, and `frame: subFrame(…)` for an eye inside a
  transformed head).
- Painted eyes and mouths (decals, Malice's glow crescents) can scale up or squash a little, never shrink far: a decal
  is a shell of the head with the head's own surface under it removed, so shrinking it opens a hole.
- `extras` adds boxes to the mesh in a joint's frame. Flowbot's happy `^ ^` and dizzy `x x` eyes are two thin
  ink strokes each (`strokes()` in flowbot.mjs).
- Hide an alternate part with a rest **scale of 1e-4**, and show it from a clip. Not 0: the bind pose must be scale 1
  (the tool does that), and the hidden scale only lives on the node.
- Swap faces by scaling: the shown eye set to 1 and the others to 1e-4 (`eyes(kind, open, wide)`). A blink is the
  normal eyes scaled to about 0.08 vertically for two or three frames. Cheap, and it reads at game size.
- Mouth: scaling a smile vertically towards its top line gives a flat, gritted mouth (hurt). Scaling it up is a
  bigger smile (wave, celebrate).

## Body-plan templates (`rigs/lib/`)

A template returns every clip of the contract for its plan, written against standard joint names; `rigDef()` drops
pose entries for joints a creature does not have, so one template fits the whole plan. Each takes the creature's few
numbers (hip height for the walk dip, stride, chain names, the eyeKit) and `add: { clip: (t, u) => pose }` to layer
the creature's own touches (`merge()` adds rotations and offsets, multiplies scales). Fidgets that make the creature
itself go in its rig file next to the template's (Joeyjab's `idle_shadowbox`). `lib/anim.mjs` holds the clip maths
(`K`, `win`, `osc`, `wave`, `both`, `merge`).

| Template | Joints | Walk | Fidgets | First done |
| --- | --- | --- | --- | --- |
| `biped.mjs` | root, legL/R, body, head, jaw, earL/R, arm/fore/handL/R, tail1…, lids | stride with hip dip, or `hop` | `idle_look` | Joeyjab (hop, `guard` arms) |
| `quadruped.mjs` | root, legFL/FR/BL/BR, body, head, jaw, earL/R, tail1…, mane1…, lids | diagonal trot with dip | sniff + sneeze, wet-dog shake, wag | Moflame (`flicker` flames) |
| `bird.mjs` | root, legL/R, body (pivot low), head, wingL/R (+2), crest1…, tail1…, trail chains, lids | waddle | flap, preen, peck | Puffinch (body is head) |
| `floater.mjs` | root, body (bobs), head, arm/handL/R, core, tail1… (hanging wisp), wisp1…, eyes, mouth | glide, tail streaming | head spin, cackle | Malice |
| `serpent.mjs` | root (the coil), spine1…, head, jaw, arm/foreL/R, tail1…, mane…, lids | slither wave | hiss, rear up | Serpyre |

Still to write as the plans come up: insects (six legs, mandibles, wing cases), blobs (squash and stretch, no
limbs), fish and other swimmers, big winged dragons (wing bones), long-necked quadrupeds.

## Writing clips

- A clip is `pose(t, u)` returning `{ joint: { r, p, s } }`, sampled at 30 fps. Plain JS, so sine waves, eased
  keyframes (`K()`), windows (`win()`) and a deterministic hash for flicker are all just functions.
- **Every clip carries every channel any clip moves** (the tool fills in rest values). Without that, a cross-fade
  sends untouched joints back to the rest pose halfway through.
- **Loops must close:** use whole cycles per loop (`osc(u, 2)`, not `osc(u, 1.5)`), and flicker `rate × seconds`
  should be a whole number, or the loop pops at the seam.
- **Never let a pose cross the face.** Celebrate first had the forearms folding inwards over the screen; arms up in
  a wide V with the forearms bending outwards reads better.
- **Planted feet.** Once Flowbot stood on its feet, every vertical root offset pushed them through the ground or off
  it. What worked:
  - pivot the root at foot level and hang the legs off the root, not the pelvis, so the body can sway and breathe
    without moving the feet;
  - breathe with a small upward-only torso / pelvis offset;
  - walk with straight legs swinging from the hip and dip the body by `L × (1 - cos θ)` (L = hip to sole, θ = the
    stance leg's angle) so the planted foot stays on the ground;
  - only leave the ground on purpose (celebrate hops).
- **A forward raise flips "outwards".** `ry < 0` lifts a hanging left arm outwards, but after a forward raise (`rx`
  comes first) the same tilt points it inwards: Joeyjab's gloves met behind its head until the cheer pose used
  `ry > 0`. Check raised poses on the sheet.
- **A wave over many links curls.** The amplitude grows link by link; five links at 20+ degrees roll a tail into a
  ring (Moflame's flame tail). Keep a long chain's swing per link around 10 degrees.
- Flicker on beats counted in `u` and wrapped (`floor(u × steps) % steps`) so a loop's last frame equals its first.
- Give the robot character with small things: a monitor that "ratchets" in servo steps while scanning, a glitch with
  a blank screen and a reboot overshoot, bolts that flare on the hit and cut out when hurt.
- Size: with the one timeline and the meshopt filters a rig is 77 to 190 KiB (Puffinch to Moflame). Constant
  channels cost one key; `resample` drops redundant keys. Watch the client's public byte ceiling (asset-audit
  `--bytes`); it was already over budget before Flowbot.

## Pitfalls we hit

- **Double bob = shaking.** The card's idle bob ran on top of the clip's own hover bob. Rigged bodies now skip the
  card bob (`applyBody`). Don't add a whole-body bob in `idle` unless the creature really floats.
- **three's LoopOnce + clampWhenFinished sets `paused = true` when it ends.** Don't use `paused` to mean "being
  scrubbed"; the player keeps its own `scrubbing` flag.
- **Weighted blending averages, it doesn't layer.** Two full-weight actions give a 50/50 mix. The player cross-fades
  one action out as the next comes in.
- The skinned bounds are computed once and padded × 1.5. A clip that reaches further than that (a very long tail
  swing) can be culled at the screen edge; raise `RIG.boundsPad` if it happens.
- The skinned program is not in the warm-up frame yet, so the first rigged body on screen compiles it once.

## Checking the result

- Sandbox: `pnpm --filter @ewa/render sandbox`, then `?demo=rig&species=<id>`: a close-up with a button per clip and
  a second one walking a circle (`&glide=0` turns it off, `&dist=` moves the camera, `&close=0` keeps the diorama
  view).
- The in-app Browser pane stops rendering while hidden: use headless Chrome over CDP (`scripts/cdp.mjs`, flags in
  HANDOFF.md).
- Scripts (CDP steps for `scripts/cdp.mjs`; run your own sandbox on a free port, `npx vite --config
  vite.sandbox.config.ts --port <p> --strictPort` in packages/render, and pass `PORT`): `src/check/sheet-steps.mjs` +
  `sheet-compose.mjs` (the contact sheet; `HEADING` turns the creature, `DIST` / `W` / `CY` frame it),
  `views-steps.mjs` + `tile.mjs` (four sides, for RIG_PARTS), `video-steps.mjs` (the frame-by-frame showcase). Their
  headers list the options.
- **Timed screenshots lie**: each capture takes 100 to 250 ms, so "a frame at 300 ms" lands much later. Use
  `window.__ewaSandbox.part3.rig.scrub(clip, t01)` to freeze an exact moment, wait ~0.4 s for TRAA to settle, then
  capture. A contact sheet of 6 frames per clip (`scrub` at 0, 0.2, ... 1) shows almost every problem at once.
- **Video**: render it frame by frame with `scrub` at exact 1/30 s steps (about 0.2 s settle per frame), then
  `ffmpeg -framerate 30 -i f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 20 out.mp4`. Real-time recording on this
  machine's headless GPU (30 to 60 ms a frame) stutters. Show battle clips at half speed with a caption, or nobody
  can see them. Keep output under `previews/` (gitignored).
- Things to confirm every time: seams at each joint in a close-up, the faces of every eye set, feet on the ground in
  every clip, no limb through the face, the loop seam, and `walk` kicking in on the walker
  (`part3.rig.glider.rigPlayer.playing`).
- `pnpm check` while a headless Chrome is rendering times out a dozen UI tests. Close Chrome (CDP `Browser.close`)
  and re-run the failed files alone before calling them broken.

## Checklist for the next Ewamon

1. Look at its scad and sprite; pick the body plan and decide what would be funny or charming for it.
2. Check it is in `frames.json` (all 203 are; after a scad change `node src/build.mjs --frames <id>`).
3. Joints: the template's names, pivots at ball centres (the scad's limb / chain points), parents first, the root at
   the feet; legs off the root if it stands.
4. `assign`: colour for the obvious parts, `closest()` over the scad's primitives for the rest; check it with
   RIG_PARTS=1 from four sides.
5. `eyeKit()` for lib.scad eyes; other `extras` for anything else it needs, hidden at 1e-4.
6. Clips: the template, tuned with its options and `add`, plus one or two fidgets of its own.
7. `node src/rig.mjs <id>`, then a scrub contact sheet; fix, repeat (two or three passes is normal).
8. `npx vitest run packages/render`, then a video for review.
