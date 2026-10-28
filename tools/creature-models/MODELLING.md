# Modelling an Ewamon so it is a copy of its sprite

The bar (2026-10-28, the user's words): every 3D model must be *an almost exact copy of its sprite image*. The
proportions, the pose, the silhouette, the colours in the right places, the markings, the face and its expression,
the signature features, and the back. A model that is "a green dragon" is not done; a model that someone would
recognise as *that* drawing from across the room is. Read this whole file before writing a scad; `README.md` has the
conventions and `scad/lib.scad` the helpers.

## Setup (every command runs from `tools/creature-models/`)

```bash
export OPENSCAD="$PWD/.cache/openscad/openscad.com"   # the 2026 snapshot; the installed 2021 OpenSCAD cannot build these
node src/measure.mjs <id> --trace   # .cache/measure/<id>.png + .txt: the art under a grid in scad units, palette, outlines
node src/build.mjs <id>             # scad -> GLB (+ <repo root>/previews/<id>.png: sprite | model front | model back)
node src/compare.mjs <id>           # silhouette IoU front / back + .cache/compare/<id>.png (red = sprite only, blue = model only)
```

`.cache/ref/<id>.png` is the plain art (front | back). Look at images with the Read tool; they are the whole point.

## The frame: model straight off the measurement sheet

`measure.mjs` draws the front art under a grid where the art's height is **40 units** with the feet on **z = 0** and the
art's horizontal centre at **x = 0**. Build the scad at that size: a part at z 24..31 on the sheet sits at z 24..31 in
the scad, and the whole model spans 40 units tall. The build normalises the GLB to 1 m, so the proportions carry over.

**Sheet x is not scad x.** The art is a three-quarter view and the preview camera (like the game) looks at the scad
turned 30°, so a scad point (x, y, z) lands on the front sheet at `sheet_x = 0.866 x + 0.5 y`: a flank at x = 16
reads 13.9, a snout 10 units forward (y = -10) reads -5, a tail 8 units back reads +4 further right. Also the camera
looks 10° down, so parts further back sit a little higher on the sheet (about 0.17 unit per unit of depth). Use it:

- `fromSheet(sx, z, y)` (lib.scad) gives the scad position for a point read off the front sheet at the depth `y` you
  choose. Mirror parts: read the NEAR one (the creature's +X side, the viewer's right), place it with `fromSheet`,
  mirror it with `mirror_x()`; the far one then lands where the art has it, partly hidden.
- `pp(d) { … }` stands children authored in sheet coordinates (x = sheet x, z = sheet z, +y = depth away from the
  viewer) in the picture plane, `d` units behind it. Flat parts traced from the front sheet (`plate`, `slab`) go
  inside `pp()`, so their outline is 1:1 with the art. `ppBack(d)` does the same for outlines traced from the back
  sheet. Do not wrap the whole model in `pp()`: the creature itself must face -Y (the game turns it).
- `prism(pts)` is the outline's prism along the view: `intersection() { roughVolume; prism(pts) }` cuts a rough
  blob to the art's exact silhouette, and `color(mark) intersection() { bodyPart grown 0.3; prism(markPts) }` lays a
  marking flush on a curved body (a chest patch, a stripe, a mask), which a flat plate cannot do.
- `lathe([[r, z], …], c)` turns a body of revolution from half-widths read off the sheet (eggs, pears, drops).
- Depth (y) is not in the art. A body is about as deep as it is wide; heads a little less; wings, fins, ears, leaves,
  flames and ribbons are thin. The creature faces -Y; its symmetric parts are symmetric about x = 0 in the scad.
- The `.txt` lists the palette (exact scad colour vectors), the **materials** (the shades of one hue grouped: use the
  mid shade as the part's colour; the sprite's lighter and darker shades are its shading, not separate paint) and the
  **regions** of each material with bounding boxes, centroids and, with `--trace`, their outlines as scad polygons.
- The `.txt`'s x values are the SCREEN x of their panel; the back panel's x is seen from behind (the creature's +X on
  the viewer's left). Each region lists its own mean colour: use that when a hue group spans two parts (a red bill and
  pink petals are one material but two colours).
- The sprite's dark outline ink is not a part. Do not model it.
- Platforms, rocks, puddles, pools and ground shadows in the art are NOT modelled (the creature stands on the game's
  ground). The sheet puts the art's lowest pixel on z = 0, so on a platform the feet stand higher: find the foot line
  on the sheet (say z 6), model everything that much lower so the feet are on z = 0, and pass `--ground 6` to
  `compare.mjs` so the art's platform is cut off too. Feet at different heights on a rock stand level on the ground.
  A hovering creature keeps its gap with a `// ground: <z>` comment line (the scad z of the ground).
- `measure.mjs <id> --zoom x0,z0,x1,z1` writes a 6x crop of the front art over that window with a 1-unit grid: use
  it for the eyes, claws, teeth, spikes and small markings the sheet is too coarse for (the `.txt` lists only regions
  over 0.4 %, so a one-pixel eye or a glowing dot is never in it: check the ref and the zoom).

## Getting the silhouette exact

The two outline helpers in `lib.scad` take the traced polygons straight from the `.txt`:

- `plate(pts, t, r, c)`: a flat part `t` thick with the outline `pts` (an [x, z] polygon from the sheet), standing in
  the XZ plane facing -Y. Wings, fins, crests, leaves, flames, ribbons, horns seen flat, capes. Put it where the part
  belongs and turn it: a wing is on the back and spread sideways (`rotate([0, 0, ±a])` about Z swings it round the
  body; `rotate([a, 0, 0])` tips it), an ear or a leaf tilts outwards. The art's front view is turned about 30° (the
  face towards the viewer's left), so a flat part that lies in the picture plane in the art is turned about
  `rotate([0, 0, 30])` in the scad; parts that stick out sideways in the art point along ±X.
- `slab(pts, depth, c, inset)`: a pillow, the exact outline at its mid-plane, swelling to `depth` thick. Bodies,
  heads, tails seen flat, a thick mane. Combine: a slab for the body mass, limbs as `limb()` / `chain()` capsules on
  top, a head blob, plates for the thin parts. A plate or slab cannot lie ON a round flank (it is inside the body or
  floating in front): use the `prism()` intersection for markings and wing roots on a body.
- Round forms still read best as `ell()`, `blob()` (hull of ellipsoids: place the ellipsoids ON the sheet's outline
  so the hull matches it), `limb()` and `chain()` (tails and necks: put the chain's points on the sheet's curve, with
  the radii read off the drawing's thickness at each point).
- Count the parts in the art and make each one: four legs, five claws, three head spikes, the two tail fins. The
  silhouette is the sum of them. Do not merge parts the art separates and do not invent parts it lacks.
- Pose: copy the drawn pose. A raised paw, a turned head, a curled tail, a stepped-forward leg, a hunched back. The
  torso faces -Y (the game turns the creature 30° to the sprite's view); the head, neck, limbs and tail are posed as
  drawn, in the scad frame. Art drawn side-on (a long quadruped or serpent in profile) needs the head turned 30 to
  40° towards the creature's right and the tail swung out, or the body projects at half its drawn length.
- The front and back sprites are two drawings, not one pose seen twice (a raised head in one, a lowered one in the
  other). The FRONT wins; make the back show what the back art has (markings, tail root, wing roots) without
  breaking the front.
- Traced outlines run inside the sprite's ink line: `plate()` and `slab()` grow them 0.45 by default (`grow`), so a
  wing is not a rim short on every edge. Heads and bodies cut with `prism()` keep their rounded volume: do not let
  an intersection leave a flat box face where the art has a rounded head.

## Colours, markings, faces

- Use the sheet's colour vectors as they are (`[r, g, b]`, two decimals). One material = one colour; its share tells
  you how much of the creature it covers, so the model's colour balance matches.
- Markings (stripes, spots, belly patches, a chest crest, a mask round the eyes, bands on a tail) are what makes a
  creature itself. Lay them on as thin patches on the surface (`patchOn`-style flattened spheres on the body, or
  `plate()` pieces a hair outside the surface, or a `slab` of the marking's own outline a little proud of the body).
- Face: eyes the size and shape the art draws them, at the art's position, with the art's expression (`eye()`'s `lid`,
  `lid_tilt`, `slit` for a glare; wide and shiny for cute). A mouth / beak / teeth when the art shows them. An eye
  must be visible from the preview camera: on a round head give it a small positive `yaw`, sink it a little into
  the head, add a brow in the skin colour over an angry eye.
- Glow: decide it, do not leave it to the auto rule (it flips between passes as areas change). Mark the colours the
  sheet lists as `GLOWS` with `[r, g, b, GLOW]` and every other bright vivid colour with `NOGLOW`; a creature whose
  sheet shows nothing glowing gets `NOGLOW` on its bright colours. Keep the build's reported glow share near the
  sprite's (under about 10 %).

## The loop (three passes is normal; stop when it reads right, do not gold-plate)

1. `measure` and `ref`. Look at both. Write a **checklist** at the top of the scad as comments: the body plan, every
   part with its sheet box (x, z) and colour, the pose, the markings, the face, what the back shows that the front
   does not (a back marking, a tail root, the wing roots).
2. Write the scad: `include <lib.scad>`, colours as named constants at the top, parts in the sheet's frame, each with
   a comment naming what it is. `$fn` modest (lib.scad's `$fa` / `$fs` defaults; raise it only on big smooth parts).
3. `build`, then Read `previews/<id>.png` and `compare`. Go through the checklist against the preview: what is
   missing, too small, too big, in the wrong place, the wrong colour, hidden. Look at the overlay: red is where the
   art has mass and the model has none; blue is the reverse. `compare` also prints the worst 5-unit cells (sheet x,
   z) with the missing (-) or extra (+) share: fix those first.
4. Fix and rebuild until the preview reads as the same drawing and the overlay has no big red or blue areas. Aim for
   front IoU 0.75 or better (0.8+ for simple shapes); a creature with thin flying parts (wisps, ribbons, sparks)
   scores lower, judge those by eye. The number is a guide; your eyes decide. The overlay centres both silhouettes
   on their boxes, so one missing tip shifts everything a little: read the big areas, not the rims. Done is when the
   model would be recognised as the drawing at game size (a 1 m figure seen from 10 m): the big shapes, colours,
   pose, face and signature parts right. Do not spend a fourth pass on a half-unit cheek.
5. Under 25k triangles (the build refuses 40k). Big smooth parts eat triangles: lower `$fn` on hidden or tiny
   spheres, keep `plate()` outlines under about 40 points.
6. Forms (`<id>_majin`, `_tenjin`, `_rage`, ravatar's relic forms) are done after the base: copy the base scad and
   change what the form's art changes (colours, aura, horns, armour), measured the same way.

## Rules

- Only write `scad/<id>.scad` for the creatures you were given, and build them. The build writes the GLB, the preview
  and `frames.json` / `index.json` itself. Do not edit `lib.scad`, `src/`, `rigs/`, the render package or anything
  else; do not run git. Another session is rigging creatures at the same time: never touch `rigs/`.
- `scad/<id>.scad` must stay buildable: run the build before you call a creature done, and leave no creature broken.
- Keep what is already right. A current scad that reads well is a starting point; one that does not is replaced
  outright. Do not keep a wrong shape because it was there.
- No platforms. No `minkowski()`. No uncoloured geometry (the build warns).
- The build prints `prune: Removed types…` lines before `ok …`; only `FAIL`, `ERROR`, `WARNING` and `warn` matter.
- Report per creature: triangles, front / back IoU, and in one line what still differs from the art (be honest; the
  user will look at every preview).
