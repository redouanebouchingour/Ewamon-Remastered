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

## Sprite-match wave (started 2026-11-03)

The user's bar this time: Flowbot, Joeyjab, Malice, Glowtent and Toxiveil look almost identical to their sprites; every
other model must get there, face first (eye count, size, colour, expression; head shape; mouth; ears; horns;
markings). Known miss: Clementar had one eye (the far eye was modelled as a wink line). Each fixed model is rebuilt AND
re-rigged (its `rigs/<id>.mjs` parts, pivots and eyeKit follow the new scad), then checked in the sandbox
(`?demo=rig&species=<id>`) over headless Chrome. The per-agent brief is `sprite-match-brief.md` in the session notes
folder; its content: MODELLING.md for the scad, ANIMATING.md for the re-rig, one headless Chrome per agent on its own
CDP port against one shared sandbox.

Survey (2026-11-03): all 204 scads rendered next to their sprites (OpenSCAD, the preview camera). Tiers:

- At the bar, leave: flowbot, joeyjab, malice, glowtent, toxiveil.
- Close, face or detail fixes: augurvane, bloomduck, bramblecub, brookrawl, castlemaw, castlemaw_rage, cindercap,
  coldplate, corvlet, craterhulk, cryptorb, darkone, devourest, dreadmaw, dreambud, dunevenom, elemutt, gemknight,
  glimfin, gnashfin, gravelwisp, gustling, hoarfrowl, kindlegrub, kelvyre, leafcoon, lumistar, meteorb, moflame,
  mossling, mudbub, mufflo, nerohat, puffinch, pyremoth, pyrothal, ravenmourne, rexaloft, scalewisp, scorpit,
  seedrift, serpyre, smellduck, sproutgrub, starwhim, tombdune, trenchtusk, tuskling, twinklit, umbrit, wickling,
  wooltug, yahit, zaptus, dustcub, badlander, infernomorel, infernomorel_majin.
- Big misses (silhouette, pose, proportions or the face read as another creature): everything else, notably
  abysspark(_tenjin), acier(_majin), alloylark, ampmite, aonred, archonosis, astaroth, auroracle, bankaiser, berkest,
  blighthex, blizzhowl, blizzraak, bloomdrake, bloomsprite, blossomsail, bogmaw, briarvaunt, budwing, burrowyrm,
  caldermole, chrysotox, cirrileap, clementar(_majin), coalette, darkyon, dunescale, embrock, fedoraith, fennorange,
  fibrostis, flampling, florasage, frofloe, galeforth, geoboxer, glaciarm, glacifang, glacinid, glimmereen(_tenjin),
  glimp, grubolt, gustuff, hexroach, hollowmane(_rage), hollowolf, hyoryu(_majin), ignispectre, ironcarab, katamute,
  lawlander(_tenjin), luxtrik, lumyth, magmolith, mantleaf, mesadrake, miscarmen, mismagmen, moblaze, murkrat,
  murmink, nebucloak, necrogeist(_majin), nettlewisp, noxmyth, pebblit, pebfist, petraptor, pyrecap, raidori(_tenjin),
  raikitsune, rambull, the six ravatars, resilian, resilith, resilithorn, rimeidol, rimetusk, ripshell, rivetalon,
  roobrawler, scraphog, shagtusk, shalewing, shardling, shiveruff, slushpup, snapling, snowlet, solpyre(_tenjin),
  stellaria, stormchick, sunjaw, thornback(_tenjin), thundrix, tidalfang, tidespine, toxshade(_majin), tsunamite,
  ultraze, veilpup, velvetomb, venobulb, verdatide, voidraith, voidraxis, voltaura, voltide, vysion, wraithtide,
  yaschamp, yasprime, zenryu(_majin), abyssrake, badlander_majin, gemknight_tenjin, kygra, kykaiser(_tenjin),
  lithokrysm, prismolith.

First batch (one per body plan, shown to the user before the rest): clementar, fennorange, burrowyrm, glimp, snowlet,
blizzhowl. Remodelled, re-rigged (no warnings), checked in the sandbox; snowlet and blizzhowl took a second pass
(spike-cone fur read as a blowfish / a spiky disc: use soft lobes and pillow tails, not cones). Not committed yet:
waiting for the user's go on the direction (2026-11-03). Front IoU: clementar 0.74, fennorange 0.81, burrowyrm 0.83,
glimp 0.88, snowlet 0.83, blizzhowl 0.74. Known leftovers: fennorange's tail is a flat slab, burrowyrm's eyes are
smaller than drawn, blizzhowl's tails shade grey in the OpenSCAD preview (pale blue in game).

Pool (from 2026-11-03, the user's go): six Opus agents at a time, one creature or one family each, queue and state in
`sprite-match-queue.md` in the session notes folder. Agents check rigs on a no-HMR sandbox (`EWA_SANDBOX_NO_HMR=1`,
port 5192); eight at once overloaded the machine. Shared JSONs are staged per id by content at each commit.
Committed: abysspark, abysspark_tenjin, acier, acier_majin (modelled from the 2026-11-03 four-armed redraw), alloylark,
aonred, archonosis, astaroth; ampmite, auroracle, bankaiser, berkest, blighthex, blizzraak, bloomsprite; bloomdrake, blossomsail, bogmaw, briarvaunt, chrysotox, clementar_majin; budwing, caldermole, cirrileap, coalette,
darkyon, dunescale, embrock, fedoraith, fibrostis; flampling, florasage, frofloe, geoboxer, glaciarm;
galeforth, glacifang, glimmereen, glimmereen_tenjin, grubolt, gustuff, hexroach; glacinid, hollowolf, hyoryu,
hyoryu_majin, ignispectre, ironcarab; hollowmane, hollowmane_rage, katamute; lawlander, lawlander_tenjin, luxtrik; lumyth, mesadrake; magmolith, mantleaf, miscarmen; mismagmen, murkrat, murmink; moblaze, nebucloak; necrogeist, necrogeist_majin, noxmyth, pebfist; nettlewisp, pebblit; petraptor, raikitsune; pyrecap.
Polish later: auroracle (tails smooth, sausage-like), ampmite (legs a bit stilt-like), chrysotox (strands read as flakes),
briarvaunt (solid where the art is speckled and see-through), cirrileap (cloud reads as a pile of spheres),
coalette (face a bit cute), darkyon (flame hem an even crown band), fibrostis (strands faceted, crystal-like), frofloe (tail a bit tube-like),
geoboxer (plates read as pebbles, not flat slabs), galeforth (wing shoulders a bit square),
glacifang (body a bit lumpy), gustuff (legs thin vs the fluffy stubs), hollowolf (tail tip chunky), hyoryu + majin (head small),
ignispectre (robe tatters stiff), katamute (head still a touch small), lawlander + tenjin (heads a bit small), lumyth (side locks stiff tubes), mesadrake (mesas clean cylinders),
magmolith (tail curl small), miscarmen (head blockier than the soft blob),
mismagmen (brim droops less), murkrat (smoke a smooth mass, not wisps), murmink (back mane blobby),
moblaze (flame tongues part into strokes, not one blaze), noxmyth (shadow strands thin), nettlewisp (tail tuft like a pinecone),
pebblit (far fist reads as two balls), raikitsune (tails smooth vs ragged fur), pyrecap (smoke smooth vs ragged).
Note (lawlander agent): lib.scad ppBack() seems to turn 150 deg where the back render needs 210 deg; back-sheet
outlines land wrong with it. Use prism() with the mirrored back outline until it is checked.
