# @ewa/creature-models

Hand-written OpenSCAD models of every creature, one `scad/<id>.scad` per sprite id in
`packages/client/public/creatures/creatures.manifest.json` (species plus their `_majin`, `_tenjin`, `_rage` and relic
forms), built into GLBs the client can load:

- `packages/client/public/creature-models/<id>.glb`: one mesh, vertex colours (`COLOR_0`), 1 m tall, feet on y = 0,
  centred in x / z, facing +Z, `KHR_mesh_quantization` + `EXT_meshopt_compression` (the loader's `MeshoptDecoder`
  reads it, like the character GLBs); the colour alpha is the glow mask (below). The game scales it to `heightM`.
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
   - Budget: aim for under 25k triangles (the build refuses over 40k). No `minkowski()`; keep `$fn` modest.
3. `node src/build.mjs <id>` and look at `previews/<id>.png`. Fix what does not read like the sprite (proportions,
   colours, a hidden face, missing features, the back) and rebuild. Two or three passes is normal.
4. Forms (`<id>_majin`, `_tenjin`, `_rage`, ravatar's relics) start as a copy of the base model and change what the
   form's art changes.

## Rigging and animation

A creature with a `rigs/<id>.mjs` gets a skeleton and animation clips: `node src/rig.mjs <id>` (or `--all`) reads the
built `<id>.glb` and writes `<id>.rig.glb`, which `index.json` serves in its place (`rig: true`). `build.mjs` re-rigs
after rebuilding such a creature. The rig works on the GLB, so it needs no OpenSCAD.

`rigs/flowbot.mjs` is the worked example. A rig file authors everything in the scad's own coordinates (Z up, facing
-Y, +X the creature's left) and exports `frame` (the scad model's height and lowest z), `joints` (pivots, parents, rest
rotation / scale), `assign(centroid, rgb)` (which joint each triangle belongs to), `extras` (boxes added to the mesh,
e.g. alternate eyes) and `clips` (`pose(t, u)` per clip, sampled at 30 fps). The game plays the clips by name: `idle`,
`walk`, `idle_*` fidgets and one per battle pose (render IMPLEMENTATION-NOTES "Rigged creatures"). Check the result in
the render sandbox: `?demo=rig&species=<id>`. Before rigging a new one, read [ANIMATING.md](ANIMATING.md): the
findings from Flowbot (rotation signs, pivots, planted feet, expressions, pitfalls, how to check and film it).
