# Animating an Ewamon: findings and learnings

What we learned rigging and animating the first 3D Ewamon (Flowbot, 2026-10-28). Read this before rigging the next
one. The worked example is `rigs/flowbot.mjs`; the tool is `src/rig.mjs`; the game side is
`packages/render/src/sprites/creatureRig.ts` (render IMPLEMENTATION-NOTES "Rigged creatures").

## How it fits together

- `build.mjs` makes the static `<id>.glb` from the scad (one mesh, vertex colours, 1 m tall, feet on y = 0).
- `rig.mjs <id>` reads that GLB plus `rigs/<id>.mjs` and writes `<id>.rig.glb`: a skeleton, rigid skin weights (one
  joint per triangle) and the clips baked at 30 fps. `index.json` then serves the rigged file (`rig: true`).
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

## Calibrating `frame`

`frame` is `{ height, minZ }` of the scad model, which the GLB normalised to 1 m. Get it from the GLB, not by
guessing: dump the GLB's vertices grouped by colour (min / max / average per colour), find two landmarks you know in
the scad (Flowbot: the three flag stripes 2 units apart gave the scale; the lowest thruster gave minZ), solve, and
check it against the top of the model (or export the scad as an ASCII STL and read its min / max z). Flowbot: `height
32.72, minZ 5.406`. Wrong numbers put every pivot in the wrong
place, so it is worth the five minutes.

## Cutting the mesh into parts (`assign`)

- `assign(centroid, rgb)` runs per triangle and returns a joint name. Colour plus position is enough for most parts.
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

## Expressions: add geometry the scad never had (`extras`)

- `extras` adds boxes to the mesh in a joint's frame. Flowbot's happy `^ ^` and dizzy `x x` eyes are two thin
  ink strokes each (`strokes()` in flowbot.mjs).
- Hide an alternate part with a rest **scale of 1e-4**, and show it from a clip. Not 0: the bind pose must be scale 1
  (the tool does that), and the hidden scale only lives on the node.
- Swap faces by scaling: the shown eye set to 1 and the others to 1e-4 (`eyes(kind, open, wide)`). A blink is the
  normal eyes scaled to about 0.08 vertically for two or three frames. Cheap, and it reads at game size.
- Mouth: scaling a smile vertically towards its top line gives a flat, gritted mouth (hurt). Scaling it up is a
  bigger smile (wave, celebrate).

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
- Give the robot character with small things: a monitor that "ratchets" in servo steps while scanning, a glitch with
  a blank screen and a reboot overshoot, bolts that flare on the hit and cut out when hurt.
- Size: Flowbot's 13 clips are about 110 KiB of the 293 KiB file. Constant channels cost one key; `resample` drops
  redundant keys. Watch the client's public byte ceiling (asset-audit `--bytes`); it was already over budget before
  Flowbot.

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

1. Look at its scad and sprite; decide which parts move and what would be funny or charming for it.
2. Calibrate `frame` from the GLB (two landmarks).
3. Joints: pivots at ball centres, parents first, the root at the feet; legs off the root if it stands.
4. `assign`: colour + position, a local frame for rotated parts; `null` for anything it should lose.
5. `extras` for expressions it needs (happy, dizzy, angry...), hidden at 1e-4.
6. Clips: `idle`, `walk`, two or three `idle_*` fidgets, and the eight battle clips at their exact lengths.
7. `node src/rig.mjs <id>`, then a scrub contact sheet in the sandbox; fix, repeat (two or three passes is normal).
8. `npx vitest run packages/render`, then a video for review.
