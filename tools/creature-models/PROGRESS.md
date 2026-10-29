# Sprite-accuracy pass over the 3D models (started 2026-10-28)

Goal (the user): every model an almost exact copy of its sprite. Method: `MODELLING.md` (the brief every modelling
agent follows), `src/measure.mjs` (gridded sheet + palette + traced outlines), `src/compare.mjs` (silhouette IoU),
lib.scad's new helpers (`plate`, `slab`, `pp`, `ppBack`, `prism`, `lathe`, `fromSheet`, `eye(lid_dir)`). OpenSCAD
2026.10.27 snapshot lives in `.cache/openscad/openscad.com` (set `OPENSCAD` to it; the installed 2021.01 cannot build).

## Order

Body-plan lists in `.cache/plans.json`, the agent batches in `.cache/batches.json` (regenerate with
`node .cache/batch.mjs`). Order: bipeds A, bipeds B, quadrupeds, birds, floaters, serpents + fish + insects, and the
six already rigged (flowbot, joeyjab, moflame, puffinch, malice, serpyre) last. Do NOT message the animation /
rigging sessions (the user, 2026-10-29): no reports, no coordination messages.

## State (2026-10-29)

- Model: from 2026-10-29 the modelling agents run on Opus 5.5 at high effort (the user's call), not Fable.
- Done and reviewed: smellduck, bloomduck, scalewisp, rexaloft, dustcub. The WIP commit 8e76f7fc holds the
  half-reworked bipeds A scads from the cut-off Fable agents.
- Running (Opus, launched 2026-10-29 15:40): bipeds A1 to A7, all 34 ids (see the batches below).
- Not started: bipeds B, quadrupeds, birds, floaters, serpents + fish + insects, then the six rigged last.

## Finishing a wave

1. Look at every `previews/<id>.png` (repo root); send a miss back to an agent with the brief.
2. `node src/build.mjs --frames --all` (concurrent builds can drop a frames.json entry), `node src/build.mjs --index`.
3. Stage only `tools/creature-models/scad/<id>.scad`, the GLBs, `index.json`, `frames.json`, the tool files
   (`src/measure.mjs`, `src/compare.mjs`, `MODELLING.md`, `PROGRESS.md`, `scad/lib.scad`), never `git add -A`; the
   rigging session has uncommitted work in `rigs/`, `src/rig.mjs`, `glb/` and the render package.
4. `pnpm check` before a commit to main (close any headless Chrome first).
