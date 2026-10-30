# @ewa/creature-models

Hand-written OpenSCAD models of every creature, one `scad/<id>.scad` per sprite id in
`packages/client/public/creatures/creatures.manifest.json` (species plus their `_majin`, `_tenjin`, `_rage` and relic
forms), built into GLBs the client can load:

- `packages/client/public/creature-models/<id>.glb`: one mesh, vertex colours (`COLOR_0`), 1 m tall, feet on y = 0,
  centred in x / z, facing +Z, `KHR_mesh_quantization` + `EXT_meshopt_compression` (the loader's `MeshoptDecoder`
  reads it, like the character GLBs); the colour alpha is the glow mask (below). The game scales it to `heightM`.
- `packages/client/public/creature-models/<id>.rig.glb` for a rigged creature (below) instead: its static GLB is then
  only the rig's input and lives in `glb/<id>.glb` here, out of the client's public folder (its byte ceiling).
- `packages/client/public/creature-models/index.json`: every built model with its byte size.
- `previews/<id>.png` (repo root, not tracked): sprite | model from the front | model from the back.

The game draws these bodies in place of the sprite cards per the "Ewamons overworld" and "Ewamons in battle" graphics settings (render
IMPLEMENTATION-NOTES "3D creatures").

## Glow

The vertex colour's alpha is the glow mask (emissive in game). The build applies the sprite pipeline's rule per
colour: bright (HSV value >= 0.92) and vivid (chroma >= 0.4), the most vivid first, until 8 % of the surface glows.
Override a colour in its scad with an alpha marker from `lib.scad`: `[r, g, b, GLOW]` always glows, `[r, g, b,
NOGLOW]` never does. `node src/build.mjs --glow-preview <id>` writes `.cache/glow/<id>.png` (the sprite's glow mask |
the model with only its glowing colours lit), and `COLORS=1` prints each colour's share and whether it glows.

## Commands (from this directory)

```bash
node src/ref.mjs <id …>      # cut the front + back art out of the atlases into .cache/ref/<id>.png (+ _front, _back)
node src/build.mjs <id …>    # scad -> 3mf -> glb + previews/<id>.png
node src/build.mjs --all     # every scad/*.scad
node src/build.mjs --index   # rewrite index.json only
node src/build.mjs --no-preview <id …>   # skip the OpenSCAD preview renders
```

## Modelling a creature

1. `node src/ref.mjs <id>` and look at `.cache/ref/<id>.png` (front on the left, back on the right). The front sprite
   is a three-quarter view facing the viewer's left; the back sprite shows the back facing right.
2. Write `scad/<id>.scad`. Start with `include <lib.scad>` and use its helpers (`ell`, `blob`, `limb`, `chain`,
   `spike`, `petal`, `eye`, `mirror_x`); `scad/cindercap.scad` is the worked example. Conventions:
   - Z up, feet on z = 0, the creature faces -Y, +X is the viewer's right. About 40 units tall (only proportions count).
   - Every part inside a `color()` (RGB vectors 0..1 picked from the sprite). Uncoloured geometry is a warning.
   - Readable at game size: a clear silhouette, the sprite's main colours in the right places, a face with eyes,
     and the signature features (horns, flames, cap, wings, tail, markings). Stylised and chunky beats fiddly.
   - Match the sprite's expression: `eye()` alone is wide open and cute. For glaring or menacing eyes give it `lid`
     (0.4-0.5), `lid_tilt` (25-32, slants down towards the nose) and `lid_c` (the socket or skin): a lidded eye also
     loses its highlight, gets a slit pupil and a lower-lid squint. Make it big enough to read at game size, sink it
     into the head with a brow ridge in the skin colour overhanging it (`scad/gnashfin.scad`), and remember a positive
     `yaw` turns a +X eye outward; a negative one buries it and bulges its white rim out of the side of the head.
   - Big creatures need real anatomy, not a ball head: a snout and separate lower jaw, wings as finger bones with
     membrane between them (`scad/rexaloft.scad`), serpents on a smooth spline (`scad/voidraxis.scad`).
   - Floating parts are fine (flames, orbs, halos) but keep them close to the body.
   - No platforms, pedestals, puddles or ground pools under the creature: it stands on the game's ground. A creature
     that hovers keeps its gap with a `// ground: <z>` line (the scad z of the ground; `scad/flampling.scad`).
   - Budget: aim for under 25k triangles (the build refuses over 40k). No `minkowski()`; keep `$fn` modest.
3. `node src/build.mjs <id>` and look at `previews/<id>.png`. Fix what does not read like the sprite (proportions,
   colours, a hidden face, missing features, the back) and rebuild. Two or three passes is normal.
4. Forms (`<id>_majin`, `_tenjin`, `_rage`, ravatar's relics) start as a copy of the base model and change what the
   form's art changes.

## Rigging and animation

A creature with a `rigs/<id>.mjs` gets a skeleton and animation clips: `node src/rig.mjs <id>` (or `--all`) reads the
built `<id>.glb` and writes `<id>.rig.glb`, which `index.json` serves in its place (`rig: true`). `build.mjs` re-rigs
after rebuilding such a creature. The rig works on the GLB, so it needs no OpenSCAD.

A rig file authors everything in the scad's own coordinates (Z up, facing -Y, +X the creature's left) and exports
`joints` (pivots, parents, rest rotation / scale), `assign(centroid, rgb)` (which joint each triangle belongs to),
`extras` (boxes and ellipsoids added to the mesh, e.g. eyelids and alternate eyes) and `clips` (`pose(t, u)` per clip,
sampled at 30 fps). Most rigs start from a body-plan template in `rigs/lib/` (biped, quadruped, bird, floater,
serpent: `rigs/joeyjab.mjs`, `moflame.mjs`, `puffinch.mjs`, `malice.mjs`, `serpyre.mjs`); `rigs/flowbot.mjs` is written
by hand. How each model sits in its GLB comes from `frames.json`, which `build.mjs` keeps (`--frames` refreshes it
without a rebuild); `rig-parts.json` keeps the triangles per joint, so a re-rig after a scad change warns when an
`assign` rule stops matching. The game plays the clips by name: `idle`,
`walk`, `idle_*` fidgets and one per battle pose (render IMPLEMENTATION-NOTES "Rigged creatures"). Check the result in
the render sandbox: `?demo=rig&species=<id>`. Before rigging a new one, read [ANIMATING.md](ANIMATING.md): the
findings from Flowbot (rotation signs, pivots, planted feet, expressions, pitfalls, how to check and film it).

## The NPC set (`--npc`)

`--npc` on `build.mjs` / `rig.mjs` switches to people and props (2026-10-28: the Mire Route foosball club): sources in
`scad/npc/` and `rigs/npc/`, output in `packages/client/public/npc-models/` with its own `index.json` (rigs only: the
static inputs live in `glb/npc/`, the bookkeeping in `frames.npc.json` and `rig-parts.npc.json`), drawn by render
`stage/npcModels.ts`. Same conventions, three differences: 1 unit = 1 cm, the GLB keeps the scad origin in x / y (a
person's feet, a table's centre; no re-centring) so the game can place models against each other (`frames.npc.json` records `cx` / `cy` = 0), and files starting
with `_` are shared parts that `--all` skips.

- `scad/npc/_human.scad` + `rigs/npc/_human.mjs`: the shared parametric person (body, memoji head, hair / beard styles,
  clothes) and its rig helper (22-ish joints, 2-bone IK for arms and legs, the playing `idle`, `talk`, `cheer`, and
  `h.fidget` for a character's own `idle_*`). A character file is one `human(...)` call plus props and fidgets;
  `fb_king_klinker` is the worked example.
- `foosball_table`: a joint per rod (spin + slide), the ball and the two score beads; `idle` is a match loop,
  `idle_goal` / `cheer` a goal each way.
- Each person's height (max z - min z / 100) is their `heightM` in content `data/foosball.ts`; rebuild, then update it.
- Team Ewamon HQ (2026-10-30, `mirevale.house5`): `ewa_red1`, `ewa_mohaned`, `ewa_yasser`, `ewa_yasin` and the static
  `ewa_desk` set (desk, chairs with jackets, monitors, props). The people are built standing like the others but
  rigged seated: `rigs/npc/_seated.mjs` swaps `human()`'s playing loop for a typing loop (hips back and down onto a
  46 cm seat, vertical shins over the feet, hands on the keyboard) and adds a seated `talk` and `cheer`; the desk
  contract (seat, desk edge, keyboard, mouse, screen, in the person's own frame) is at the top of that file and the
  seat positions in the desk frame at the top of `ewa_desk.scad`. Their `heightM` is still the standing frame height
  (the scale), not the seated one. Shared parts (collar, headset) live in `scad/npc/_ewa_team.scad`; `_human.scad`
  gained `sleeve = "rolled"` and the beards `"trim"` and `"goatee"`. The monitors show Red1's original 2022 sprites:
  `node scad/npc/gen-ewa-screens.mjs` turns the old repo's PNGs into the committed `scad/npc/_ewa_screens.scad` (one
  module per sprite, merged pixel runs, `a` = GLOW or NOGLOW), so builds never need that repo. `ewa_hq_front` is the
  house's outside (static, origin = the door's centre on the wall plane): the team logo (`ewa_logo`, 48 px) on a
  blade sign, a plank sign, a bike rack, a pallet bench group and string lights; its header lists the kept-clear
  zones and the collision rects.
- Rigged parts are whole closed shells: a prop that touches a part of another joint fuses into it
  (`HUMAN_DEBUG=1 node src/rig.mjs --npc <id>` lists shells per joint). Build before rigging (the frame comes from the
  build cache).

```bash
node src/build.mjs --npc fb_king_klinker      # scad -> glb -> rig.glb + previews/fb_king_klinker.png
node src/build.mjs --npc --all
```
