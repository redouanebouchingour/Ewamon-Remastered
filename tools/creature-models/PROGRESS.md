# Sprite-accuracy pass over the 3D models (started 2026-10-28)

Goal (the user): every model an almost exact copy of its sprite. Method: `MODELLING.md` (the brief every modelling
agent follows), `src/measure.mjs` (gridded sheet + palette + traced outlines), `src/compare.mjs` (silhouette IoU),
lib.scad's new helpers (`plate`, `slab`, `pp`, `ppBack`, `prism`, `lathe`, `fromSheet`, `eye(lid_dir)`). OpenSCAD
2026.10.27 snapshot lives in `.cache/openscad/openscad.com` (set `OPENSCAD` to it; the installed 2021.01 cannot build).

## Order (agreed with the rigging session "Animate all Ewamons like Flowbot")

Body-plan lists in `.cache/plans.json`, the agent batches in `.cache/batches.json` (regenerate with
`node .cache/batch.mjs`). Order: bipeds A (its rigging session local_96f67494 is told to rig a creature only once its
new model is in: message it the ids after each batch, copy local_9b2a1552), then bipeds B, quadrupeds, birds,
floaters, serpents + fish + insects, and the six already rigged (flowbot, joeyjab, moflame, puffinch, malice, serpyre)
last. Report to local_9b2a1552 when a plan's last id lands.

## State

- Done and reviewed: smellduck (IoU 0.89), bloomduck (0.83): the pilot; the previews read as the drawings.
- Started 2026-10-28 ~18:45, cut off by the usage limit while running: pilot scalewisp + rexaloft; bipeds A1
  (bramblecub, briarbear, cindercap, infernomorel, infernomorel_majin), A2 (dustcub, badlander, badlander_majin,
  fennorange, berkest), A3 (clementar, clementar_majin, acier, acier_majin, chrysotox), A4 (castlemaw,
  castlemaw_rage, hollowmane, hollowmane_rage, hollowolf), A5 (gemknight, gemknight_tenjin, coldplate, glaciarm,
  craterhulk, geoboxer). Check each of these: `node src/build.mjs <id>` must succeed and `previews/<id>.png` must
  read as the sprite; a scad that does not build or still looks like the old model is redone.
- Not started: A6 (elemutt, katamute, florasage, brookrawl, caldermole), A7 (astaroth, gnashfin, dreadmaw), and
  every batch of the other plans.

## Finishing a wave

1. Look at every `previews/<id>.png` (repo root); send a miss back to an agent with the brief.
2. `node src/build.mjs --frames --all` (concurrent builds can drop a frames.json entry), `node src/build.mjs --index`.
3. Message the rigging sessions the ids that landed.
4. Stage only `tools/creature-models/scad/<id>.scad`, the GLBs, `index.json`, `frames.json`, the tool files
   (`src/measure.mjs`, `src/compare.mjs`, `MODELLING.md`, `PROGRESS.md`, `scad/lib.scad`), never `git add -A`; the
   rigging session has uncommitted work in `rigs/`, `src/rig.mjs`, `glb/` and the render package.
5. `pnpm check` before a commit to main (close any headless Chrome first).
