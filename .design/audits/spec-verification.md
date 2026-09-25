# SPEC verification — adversarial review of `.design/SPEC.md` (2026-09-25)

Scope: the binding SPEC, assembled from `.design/spec/00-spine.md` … `50-verification-budget.md`, read in full against
(1) the libraries actually installed under `node_modules/.pnpm` (three 0.186.0 + @types/three 0.186.0, @colyseus/core 0.18.14,
@colyseus/schema 5.0.32, @colyseus/sdk 0.18.2, @colyseus/shared-types 0.18.2, fastify 5.12.4, @fastify/jwt 10.2.2, zod 4.6.5,
drizzle-orm 0.45.2, react-router 7.18.4, zustand 5.0.15, sharp 0.34.5 / 0.35.4, ktx2-encoder 0.6.0, gltf-transform 4.5.0,
meshoptimizer 0.24.0), (2) determinism and authority, (3) the art bar of the eight pillars. Inputs besides the SPEC: every
`packages/*/IMPLEMENTATION-NOTES.md`, `tools/{sprite-pipeline,material-bake,model-pipeline,asset-audit}` notes and READMEs, the
shipped manifests under `packages/client/public/`, and the implementing source where a claim needed a line. The 2026-09-23 … 25
CHANGELOG amendments (§50.4.3, §40.1.2 stage 4, §40.1.6.3–.4, §40.3.5) were taken as given and not redone.

Evidence convention: a path + line in `node_modules` (relative to the package root), a code path + line, a measured number
from a notes file, or a contradiction between two sections. Severity: **blocker** (cannot work or opens an exploit as written),
**wrong** (a false statement an implementer would follow into a bug), **stale** (true once, superseded by the code), **cosmetic**.

## Summary

| Lens | Findings | blocker | wrong | stale | cosmetic | fixed in the SPEC | left as recommendation |
|---|---|---|---|---|---|---|---|
| 1 — implementability against the installed libraries | 44 | 6 | 26 | 7 | 5 | 42 | 2 |
| 2 — determinism and authority | 27 | 4 | 16 | 7 | 0 | 23 | 4 (+ R1, R11 on applied items) |
| 3 — art-bar hostility | 23 | 2 | 15 | 2 | 4 | 19 | 4 (+ R3, R4, R5, R8, R9, R12 on applied items) |
| **Total** | **94** | **12** | **57** | **16** | **9** | **84** | **10** |

Fixes were applied to the part files only, with one CHANGELOG entry per change (49 entries dated 2026-09-25 above the
existing ones, grouped under the "2026-09-25 spec-verification pass" marker), and `node .design/spec/assemble.mjs`
re-generated `SPEC.md` (6 598 lines, no redefined identifier). Every edit in a part file carries an
`<!-- amended 2026-09-25: … -->` mark or an inline "amended 2026-09-25" note naming its evidence.

The most consequential items:

1. **Two authority holes in the server design** (L2-02, L2-03): Colyseus 0.18 always mounts `POST /matchmake/*` behind a
   static `onAuth` that returns `true`, and `/zone/enter` accepted any ungated zone — either path placed a player at another
   zone's spawn ("fast travel") or let a client create shards. The implemented server closed both (join tickets, `wrongZone`);
   the SPEC now requires it.
2. **Building footprints are client-only** (L2-01, blocker, recommendation R1): content's heightfield cannot see the
   render layout that places buildings, so the server lets a modified client walk through houses and spawns land inside
   footprints. The SPEC now states the gap; closing it needs the footprint plan to move into `@ewa/content`.
3. **Colyseus message handling as specified would kick every client** (L1-22): the validator argument and a missing `'*'`
   handler both close the socket with 4002 in 0.18.14.
4. **Impossible caps** (L3-02, L3-03): the stock post chain needs 29 render targets before shadows (measured 34; cap was 24)
   and a zone's light set adds program variants (measured 107; cap was 96). Now 41 / 128 with the derivation.
5. **Pillar 1 fails on the reference machine by the SPEC's own numbers** (L3-07): `smoothstep(0, 6, 2.90)` is 0.475 → 2.85 px
   at `pr 1`, not 3.1 px. Arithmetic fixed; the parameter change is recommendation R3.
6. **Billboards as specified are culled** (L3-08): `atan2(camDir.x, camDir.z)` turns the FrontSide quad away from the camera;
   and a vertical card reads at 0.62 of its height from −52°. Fixed with the implemented yaw and half-pitch lean.
7. **Fog and light units** (L3-01, L3-04): fog 0.018/m fogged the player's feet 37 %; three's physically based lights put the
   whole bloom-gap arithmetic off by π, and the SkyMesh PMREM made the IBL two thirds of all light. Fixed to the implemented
   0.0068/m, `× π` units and the 0.3 sky-radiance normalisation.

---

## Lens 1 — implementability against the installed libraries (44)

| # | Section | SPEC claimed | Evidence | Sev. | Fix |
|---|---|---|---|---|---|
| L1-01 | §10 header, §10.1.2 step 1, §50.2.3 | `trackTimestamp` is missing from `WebGPUBackendParameters`; pass it through a typed cast | declared: `@types/three` `src/renderers/webgpu/WebGPUBackend.d.ts` line 11; `WebGPURenderer.d.ts` line 5 | stale | applied |
| L1-02 | §10.1.5 | `pipeline.dispose()` also disposes the display nodes' render targets | `three` `src/renderers/common/RenderPipeline.js` lines 165–167 dispose only the quad material; render notes C2 | wrong | applied (`PostStack` walk) |
| L1-03 | §10.7.3, §10.8.2 | `cameraProjectionMatrixInverse` / `cameraWorldMatrix` reconstruct the DOF plane | in a post graph they resolve to the `QuadMesh`'s ortho camera: `src/nodes/accessors/Camera.js` lines 140, 236; `QuadMesh.js` line 9 | wrong | applied (own uniforms) |
| L1-04 | §10.2.4 | `triplanarTexture(texture(set.albedo), …)` | reads `texX.value` at build and creates fresh nodes: `src/nodes/utils/TriplanarTextures.js` lines 26–46 — a hero re-point never reaches it | wrong | applied |
| L1-05 | §10.2.4 | `colorNode = mix(…)` is a vec3 | alpha test reads `diffuseColor.a`; shadow pass multiplies by `colorNode.a` (`Renderer.js` line 3546) | wrong | applied (`vec4`) |
| L1-06 | §10.2.4 | `mix(normalMap(…), normalGeometry, h)` | `normalMap()` is view space (`NormalMapNode.js` line 126); `normalGeometry` is the object-space attribute (`Normal.js` line 15) | wrong | applied (`normalView`) |
| L1-07 | §10.2.5 | `windDisplace = Fn(([…], u: SharedUniforms) => …)` | a `Fn` callback's second argument is the NodeBuilder: `src/nodes/tsl/TSLCore.js` line 596 | wrong | applied (plain factory) |
| L1-08 | §10.1.3, §10.3.1 | `csm.updateFrustums()` on resize | dereferences `this.camera`, set only on the first build: `examples/jsm/csm/CSMShadowNode.js` lines 65, 160, 215–216, 506 — throws before the first render | wrong | applied |
| L1-09 | §10.1.2 | the client owns the loop; `setAnimationLoop` unused | `Renderer.init()` always starts `Animation` (`Renderer.js` line 842), which resets `info` (`Animation.js` line 81) | cosmetic | applied |
| L1-10 | §10.1.1 | `caps.adapter` from `GPUAdapterInfo.description` | the backend keeps no adapter; `device.adapterInfo` (render notes C10) | cosmetic | applied |
| L1-11 | §10.1.2 step 8, §10.5.9 | `compileAsync` warm-up ⇒ "the first zone frame compiles nothing"; programs constant across a zone load | `compileAsync` compiles non-MRT programs the pass never uses; programs are keyed by WGSL, which includes the light set: +28 on Mirevale (render notes C11, Part 2 "Measured") | wrong | applied; R6 |
| L1-12 | §10.3.3 | `SkyMesh` scaled 200 at the origin | far-plane projection with the ray from `positionWorld − cameraPosition` (`SkyMesh.js` lines 215, 239); a 200 m box is exited on a 240 m route | wrong | applied (re-centred) |
| L1-13 | §10.8.2 | `chromaticAberration(focused, u.chroma, null, …)` | the documented null→centre default is not implemented; the null reaches the layout `Fn` and the build throws (`ChromaticAberrationNode.js` lines 136, 169) | blocker | applied (`vec2(0.5, 0.5)`) |
| L1-14 | §50.2.2 | `renderer.info.memory.texturesSize` is the texture metric | every compressed texture counts 1 byte (`Info.js` lines 449–453): the KTX2 materials were invisible to the 700 MB cap | wrong | applied (`RenderStats.textureBytes`) |
| L1-15 | §10.8.2 comment | `PassNode` allocates one type for all MRT attachments | each attachment is a clone of the output texture and can be retyped (`PassNode.js` line 616) | cosmetic | not applied |
| L1-16 | §10.1.4, §10.9 | HUD `CanvasTexture` `SRGBColorSpace`, plain `gpu.render()` after the pipeline | with `outputColorSpace ≠ workingColorSpace` the render goes through the intermediate target whose output pass overwrites the post image (render notes P1) | blocker | applied |
| L1-17 | §10.4.1 | `texture.mipmaps = [level1, level2, level3]` | level `i` = `mipmaps[i]`, count = `mipmaps.length` (`Textures.js` lines 506–508; `WebGPUTextureUtils.js` line 772) | wrong | applied (`[l0..l3]`) |
| L1-18 | §10.4.7, §10.7.5 | decal multiply-blended with its own mask; VFX never write `mask.y` | per-attachment blending comes from the pass MRT, not the material's `mrtNode` (`WebGPUPipelineUtils.js` lines 131, 146; `MRTNode.js` line 123): transparent overlays overwrite normal/mask; a zero normal made GTAO NaN | wrong | applied |
| L1-19 | §10.4.5 | FrontSide card casts a shadow; `userData('typeColor', 'vec3')`; albedo on `map` | shadow pass renders FrontSide as BackSide (`Renderer.js` lines 50, 3767); a `'vec3'` Color uploads NaN (`UniformsGroup.js` 365–367 vs 431–433); `map.a` sampled at raw uv (`Renderer.js` line 3540) | wrong | applied |
| L1-20 | §30.2.1 | `Room<{ state; metadata; auth; userData }>` | 0.18 `RoomOptions { state?, metadata?, client? }`, auth/userData on `Client<…>` (`@colyseus/core` `src/Room.ts` 107–121, `src/Transport.ts` 213) | wrong | applied |
| L1-21 | §30.2.2 | `allowReconnection` in `onLeave` | a non-consented close goes to `onDrop`; `onLeave` only after a failed reconnection (`src/Room.ts` 650, 2313–2373) | wrong | applied |
| L1-22 | §4.3, §30.2.2, §30.5.1 #1, §50.1.12 | validator rejection → `invalidPayload`; no `'*'` handler, Colyseus drops unknown types | both close the client with 4002: `src/RoomMessages.ts` 189–196 and 334–342 | blocker | applied |
| L1-23 | §30.2.5 | `state.spawns.set` **after** `view.add` | `StateView.add` throws on a detached instance (`@colyseus/schema` `src/encoder/StateView.ts` 334–349) | blocker | applied |
| L1-24 | §30.1.1 | `gracefullyShutdown: true`, `matchMaker.gracefullyShutdown()` | the default registers SIGINT/SIGTERM/SIGUSR2 + `uncaughtException` and ends in `process.exit` (`src/Server.ts` 180–181, 411) | wrong | applied |
| L1-25 | §30.2.2, §20.3.4, §50.4.5 A14 | a replaced tab is closed with 4001 | 4001 is `CloseCode.SERVER_SHUTDOWN` (`@colyseus/shared-types` `src/Protocol.ts` 279–284); a restart looked like "another tab" | wrong | applied (4101) |
| L1-26 | §20.3.4 | hand-rolled `client.reconnect()` at 1, 2, 4, 8, 8, 8 s | the SDK reconnects internally on 1001/1005/1006/4010 (`@colyseus/sdk` `src/Room.ts` 166–173, `Reconnection.ts` 68–82): a second loop races it | wrong | applied |
| L1-27 | §20 header | react-router 7.9 | lockfile resolves 7.18.4 (symbols unchanged) | cosmetic | applied |
| L1-28 | §20.1.1–§20.1.2 | module-level `router`; `apiFetch(route: RestRoute<T>)` | `RestRoute` defined nowhere; a module-level router starts in every test importing `routes` (`router.tsx` 31, 171; `api.ts` 174) | stale | applied |
| L1-29 | §30.6.2 | `algorithm: Algorithm.Argon2id` | `@node-rs/argon2` exports an ambient `const enum`, unusable under `isolatedModules` (`packages/server/src/rest/auth.ts` 6–13) | wrong | applied |
| L1-30 | §4.3 | `z.number().finite()` | zod 4: deprecated no-op (`src/v4/classic/schemas.ts` 1132, 1215–1216) | cosmetic | applied |
| L1-31 | §10.3.6, §10.7.5 | rain as `Points` with `pointWidth 3`; VFX as pooled `Points` | WebGPU points are 1 px (`PointsNodeMaterial.js` 21–22, 166–173); no wide lines | wrong | applied (`LineSegments`, instanced `Sprite`) |
| L1-32 | §10.5.7 | one `InstancedMesh` per (kind, chunk, tier); `LOD` objects | small instanced meshes get per-mesh uniform arrays → own program (`Instance.js` 41–67; 175 → 271 programs); `LOD.update` runs for shadow cameras (`Renderer.js` 3258); alternating `alphaTest` in the shadow override cost 185 ms CPU (render notes C20) | wrong | applied |
| L1-33 | §10.5.9 | geometry/instance disposal returns memory to baseline | plain meshes keep render objects until a `dispose` event; later-pass attributes leak +141 / 9.8 MB per reload (render notes C22, C26) | wrong | applied |
| L1-34 | §40.2.2 | `…quantize(…), meshopt(…), textureCompress({ targetFormat: 'ktx2' })`; `join()` merges looks | `meshopt()` re-runs reorder+quantize (`functions` `src/meshopt.ts` 82–93); `textureCompress` supports jpeg/png/webp/avif only (`src/texture-compress.ts` 24); `join()` skips skinned nodes (`src/join.ts` 177–178) | blocker | applied |
| L1-35 | §40.2.3 | `simplify({ ratio 0.35, error 0.001 })` with skin weights locked | `simplify()` is position-only (`src/simplify.ts` 176–183); 0.001 stops at 24–29 k of 30 k tris, LOD1 505–619 KB (model notes M4) | wrong | applied (`simplifyWithAttributes`, 0.01) |
| L1-36 | §40.3.3, §40.2.4 | mips as extra slices through `setSliceSourceImage`; `uastcLDRQualityLevel 2`; `zstd: 18` | no per-level input (`ktx2-encoder` `types/type.d.ts` 16), Basis refuses mips-as-slices, supercompression is on/off only (line 37); pack 0 = same PSNR at 0.6× bytes (material notes D1, D2; model M7) | blocker | applied |
| L1-37 | §40.2.3 | texture roles from mean colour; clips "detached" then pruned | sources bind slots explicitly and the heuristic misreads them (normals average (127, 127, 234)); `Animation.dispose()` leaves samplers alive (`@gltf-transform/core` `src/properties/animation.ts`) | wrong | applied |
| L1-38 | §40.0.2 rule 5, §40.3.1–§40.3.2 | bake reads `dist/surfaces.json`; recipes in `tools/material-bake/src/recipe.ts`; literal column seam check | the JSON was never built — pure subpath `@ewa/render/surfaces` (`packages/render/src/surfaces/recipe.ts`); literal seam check fails every textured map; `fbm2` cannot tile without `periodic` (material notes D0, D3, D6) | wrong | applied |
| L1-39 | §40.1.2 rows 5–6, §40.1.5 | "Today: `selectEncoding('auto', 4096)`", v1 block "as it exists today", v2 comments for 4096² | code is v2 (`tools/sprite-pipeline/src/manifest.ts` 24–65, incl. `alt?`) | stale | applied |
| L1-40 | §5.2 | repository interfaces | server parts 1–2 added `setAdmin`, `bannedIds`, `byIds`, `search`, `counts`, leaderboard `'dex'`, `markSeen → boolean`, `flagSetAt`, `claimObjective`, `pruneSyntheticQuests`, `closeExpiredDetailed`, `ownerOf` (`packages/persist/src/repos/*.ts`) | stale | applied |
| L1-41 | §3.10 | `dist/heightfields/<zone>.json` is "the full field" | compact exact encoding `q64-delta-varint-b64+rle` (content notes D2) | stale | applied |
| L1-42 | §40.2.1, §40.2.5–§40.2.6, §50.4.8 | 20 Quaternius looks | 19 files in `assets-src/models/quaternius`, 19 `LOOKS` (content D10, model M0) | stale | applied |
| L1-43 | §40.1.6.4 test 7 | `sharp` exposes no `exact` flag | true for the sprite pipeline's pinned 0.34.5; 0.35.4 (installed for model-pipeline) has `webp({ exact })` (`sharp@0.35.4` `lib/index.d.ts` 1441–1442) | stale | R16 (not redone: 2026-09-24 amendment) |
| L1-44 | §50.4.8 `encoding.test.ts` | PSNR ≥ 36 dB, edge ≤ 18 %, interior ≤ 2 %, luma ≤ 24, ± 2, ± 12 | contradicts §40.1.6.4 as amended 2026-09-24 | wrong | applied |

## Lens 2 — determinism and authority (27)

| # | Section | SPEC claimed | Evidence | Sev. | Fix |
|---|---|---|---|---|---|
| L2-01 | §3.11, §10.5.5, §10.6.2 | `walkable` is 0 on prop footprints; "the footprints content's walkable already encodes"; prediction and truth agree | content cannot see render's layout and marks margin/slope/water only (content notes clarification 1); render adds client-side blockers (`terrain/collider.ts` 8–13). Server accepts positions inside houses; spawns can land in footprints | blocker | gap stated in SPEC; **R1** |
| L2-02 | §4.7, §30.2.6 | `/zone/enter { zoneId }` seats the player in any ungated zone | onJoin step 3 then places them at that zone's spawn: REST fast travel. Code answers 409 `wrongZone` (`rest/routes/me.ts` 96–119) | blocker | applied (+ A22) |
| L2-03 | §30.2.6 | joins go through `/zone/enter` | Colyseus always mounts `POST /matchmake/{joinOrCreate,create,join,…}` (`src/router/default_routes.ts` 6, `src/matchmaker/controller.ts` 22) behind a static `onAuth` returning `true` (`src/Room.ts` 788–794): direct joins/shard creation with arbitrary options | blocker | applied (join ticket, + A21, #26) |
| L2-04 | §30.2.4 vs §50.4.5 | rule 5 `unwalkable` before rule 6 `bounds`; the test expects `bounds` | the margin is `walkable = 0`, so `bounds` is unobservable (server notes S3) | wrong | applied |
| L2-05 | §30.2.4, §30.3, §10.6.2 | water-only samples standable with HM Surf; `validateInput(prev)` has no surf input; `resolveMove` "never unwalkable" | server `MovePrev.canSurf` (`rooms/movement.ts` 32–85); render's `resolveMove` has no surf term → the client can never predict a surf step: surfing unreachable | wrong | applied (render follow-up: `surf` parameter) |
| L2-06 | §4.6, §30.2.7, §50.6.1 shot 6 | trigger 6 m inside the **field** edge | the field edge is inside the 16 m unwalkable margin: no handover can fire (`ZoneRoom.ts` 121–144 uses `playableBounds`) | blocker | applied |
| L2-07 | §30.4.4, §30.4.8 | beats run first on `interact`; trainers otherwise challengeable | a story-battle `TrainerDef` can be fought before its beat (fall-through to `case 'trainer'`, `ZoneRoom.ts` ~826–862): reward + `trainer:<id>:beaten` early, paid again by the beat (content notes clarification 4) | wrong | applied rule 6 (server follow-up, + A24) |
| L2-08 | §30.6.3 | in-battle REST refusals: party/creature/item/heal/shop | `/marketplace/list` of a projected creature → bought mid-battle → the battle tx writes into another owner's row (server notes Q6) | wrong | applied (+ A23, #28) |
| L2-09 | §30.4.7 | boss acts once per participant per round | its PP runs out; core's no-Struggle policy forfeits private battles while the boss stands; no round-failure semantics (server Q14, Q15) | wrong | applied |
| L2-10 | §30.8.3 | `offerHash = fnv1a32([offers[0], offers[1]])` | seat-order dependent; protocol's `tradeOfferHash` (the function the client calls) sorts by playerId (`protocol/src/digest.ts` 30) | wrong | applied |
| L2-11 | §30.7.1 vs §5.2 | request refused with a row "in either direction" | spine `requestFriend` accepts a reverse pending row (`friendships_pair_uq`) | wrong | applied |
| L2-12 | §4.7 | setup/guilds/marketplace return only views | they move items/money/creatures; the client's single writer went stale (server P1, client "Server findings" 1–2) | wrong | applied |
| L2-13 | §30.6.5 | 20 blocked words | legacy list has 19 (server Q1) | stale | applied |
| L2-14 | §50.4.5 vs §30.2.4 | fan-out bots move 1 unit per tick | 20 m/s > 8.05 m/s cap: every input a `speed` reject | wrong | applied |
| L2-15 | §5.1, §30.11 | `seed + actions` replay the battle | no starting parties stored; migration 0001 adds `start` + `final_digest` (server S10/P6) | wrong | applied |
| L2-16 | §30.3 | `tick(now, timeOfDay)` → spawned/despawned | ≥ 10 m player clearance needs positions; stalled engagements need `freed`; featured species; warm-up (server W1, W2, Q12) | stale | applied |
| L2-17 | §4.4 | (no raid-end path) | rewards arrive as `battleEnd { battleId: raidId }` (server Q14) | stale | applied |
| L2-18 | §3.10 rule 11, §50.4.2 | `|Z(zone)| ≤ 16` | `solenne` 26, `umbral_observatory` 20 (content D1) | wrong | applied (overworld subset) |
| L2-19 | §2.10 | `actions[i]` null ONLY in the replacement exception | contradicts the server rule below it (NPC side always null) and blocks an NPC whose active fainted (`core/src/turn.ts` 176–178) | wrong | applied |
| L2-20 | §2.4 vs §2.11 | sleep "cannot act for `1 + rng.int(3)` turns" | the algorithm skips `N − 1` actions (0–2); a third of sleeps do nothing (`core/src/turn.ts` 322–330) | wrong | text applied; **R11** |
| L2-21 | §2.20, §50.7 rule 3 | `fuzz-digests.json` changes need a CHANGELOG entry | its creation was never recorded; construction unstated (core notes 17) | stale | applied |
| L2-22 | §20.3.2 | `authoritative` updated from `hpAfter` | diverges at the first stage/status/PP change → every preview digest mismatches → resync every turn; code adopts the matching preview (`BattleController.ts` 10–13) | wrong | applied |
| L2-23 | §30.6.3 | in-battle check reads presence "(in-memory or Redis)" | `refuseInBattle` and `/zone/enter` read the local store only (`rest/http.ts` 115–117; server notes Q2): under Redis a REST call on another process during a battle is not refused | wrong | **R2** (code) |
| L2-24 | §30.5 | the matrix names "the only writer" | money/inventory/story_flags writers omitted raid rewards, missions, daily login, guild founding, setup equip | stale | applied |
| L2-25 | §3.11 `water`, §30.3 | `water` = pond, sea, bog, **lava**; HM Surf makes water standable | cinder ponds render as lava (`client/src/scene/zoneSpecFor.ts` line 37); a surfer walks on lava and `'water'` spawns can land on lava | wrong | **R10** |
| L2-26 | §30.9.1 | `DAILY_MISSIONS` / `WEEKLY_GOALS` / `LOGIN_STREAK` are `@ewa/content` data | they live in `packages/server/src/liveops/missions.ts` (server Q11): the client cannot render mission text from content | stale | **R13** |
| L2-27 | §30.4.4 | league interact "within 4 m of the gym marker" | no content coordinate exists; the server hard-codes `(0, −26)` and render places the door there (server R5, render Z10) | stale | **R13** |

## Lens 3 — art-bar hostility (23)

| # | Section | SPEC claimed | Evidence | Sev. | Fix |
|---|---|---|---|---|---|
| L3-01 | §10.3.7 | grove fog 0.018 / m | `1 − exp(−26 × 0.018) = 37 %` on the player's feet (46 % at 34 m); render ships 0.018 × 0.38 (`zone/palettes.ts` 65; notes M19, Z12) | wrong | applied (0.0068 → 16 %) |
| L3-02 | §10.10.2, §50.2.2, §40.5.2, §50.4.6 | render targets ≤ 24, steady 20 | stock nodes: 29 before shadows (DOF alone 8: `DepthOfFieldNode.js` 88–134, `GaussianBlurNode.js` 71, 80) + 4 cascades + local casters; measured 34 (notes C18) | wrong | applied (≤ 41 derived) |
| L3-03 | §10.10.2, §50.2.2 | programs ≤ 96, constant across a zone | baseline 79 + zone light-set variants = 107 in every slice shot (notes Part 2) | wrong | applied (≤ 128); R6 |
| L3-04 | §10.2.1, §10.3.5 | "albedo 0.85 × noon sun 1.0 + IBL ≤ 0.25 ⇒ ≤ 1.10 < 1.15" | three lights are physically based (`ρE/π`): off by π; SkyMesh PMREM radiance ≈ 1.05 → IBL 2/3 of all light, frame bloomed; the ceiling ignores specular (notes C15, C16; measured noon p99 0.65) | wrong | applied (`× π`, `norm = 0.3 / L`) |
| L3-05 | §10.3.3 | sky mesh at raw radiance | noon horizon ≈ 5.9, zenith ≈ 2.3 scene-linear ≫ 1.15: any camera that frames the horizon blooms it (no gameplay camera does today) | wrong | stated; **R9** |
| L3-06 | §10.8.3 | vignette corner 0.36 → 8 % | `smoothstep(0.35, 0.85, 0.574) = 0.42` → 9.3 % (notes M20) | cosmetic | applied |
| L3-07 | §10.7.3, Pillar 1 | CoC at 12 m = 0.518 → 3.1 px ≥ 3 px; 4.1 px at 4 m | `t = 0.483 → 0.475` → **2.85 px at `pr 1`**, the reference machine's ratio (§10.1.3); 4.44 px at 4 m (notes Q12) — the pillar test fails as specified | blocker | arithmetic applied; **R3** |
| L3-08 | §10.4.4, §10.4.3 | yaw `atan2(camDir.x, camDir.z)`; Y-axis-only facing; 178 px tall | the quad faces away and FrontSide culls it (notes P3); a vertical card reads at `cos 52° = 0.62` (110 px); implemented half-pitch lean → 0.90 (160 px) | blocker | applied |
| L3-09 | §10.7.4 | battlers on the line **perpendicular** to the heading; player's is "the nearer one" | perpendicular ⇒ equal camera distance; contradicts "nearer" and the +12° anti-eclipse yaw (notes Q5) | wrong | applied |
| L3-10 | §10.3.2 vs §10.7.5 | zone builder throws at the 9th shadow caster; 2 beacons are "reserved slots" | beacons exist scene-wide from boot (a new light recompiles every program: notes P10, Q13): zone + beacons reached 10 > 8 | wrong | applied (throw at 7th) |
| L3-11 | §10.4.5, §50.4.6 bloom gap | emissive `1.8 × albedo ≥ 1.35` sits above the threshold | bloom keys on **luminance** (`BloomNode.js` 12–15): needs luminance(albedo) > 0.639; masked reds/blues/violets reach 0.64–0.66 and never bloom | wrong | restated; **R8** |
| L3-12 | §10.8.3 | 4K MRT 265 MB + ≈ 180 MB zone + ≈ 40 MB atlases < 700 MB | a zone binds ≤ 8 atlases ≈ 256 MB + 48 MB singles (§40.1.4; 167 MB measured for 5), cascades carry colour attachments (≈ 128 MB): ≈ 750 MB before post targets | wrong | arithmetic applied; **R5** |
| L3-13 | §10.7.3 | `mix(dofOut, preDof, mask.y)` keeps battlers clean | the far-field gather still reads sharp pixels: a coloured halo around every sharp billboard off the plane (render open item 2) | wrong | stated; **R4** |
| L3-14 | §20.4.5 vs §10.7.1 | zoom stops 14 / 18 / 24 u | render owns 20 / 26 / 34 m (`camera/rig.ts` 37) | wrong | applied |
| L3-15 | §10.4.1, §10.4.3 | 178 px / 386 px, level 2.9 at zoom 2 | the figures ignored pitch: 160 px diorama, 374 px battle, ≈ 122 px → level 3.1 at zoom 2 | wrong | applied |
| L3-16 | §40.6, §20.10.3 | phase 3 ≈ 4.1 MB for the 14-species zone | 0.544 MB per atlas measured; 8-atlas zones (`galvan_route`, `solenne`) are 4.35 MB before singles and GLB > 4 MB | wrong | arithmetic applied; **R12** |
| L3-17 | §40.6 | `creatures/` basis 31.2 MB | shipped 36.20 MB (binary alpha, q88/q92) | stale | applied |
| L3-18 | §10.3.2 vs §10.5.8 | Mirevale 6 shadow-casting lanterns; `shadows.drawCalls ≤ 4 × (12 + 29 + 60 + 40) = 564` | each local caster re-renders its casters; the derivation counts cascades only; render spends ≤ 1 local caster per zone (notes Z11) | wrong | **R7** |
| L3-19 | §10.4.1 | `lodMaxClamp 3` covers every authored view | a `sizeScale 0.5` creature at zoom 2 is ≈ 61 px → wants level 4.1; clamped at 3 it minifies 2:1 (edge shimmer on small creatures) | cosmetic | **R14** |
| L3-20 | §10.4.1 vs §3.10 rule 11 | zone atlases + ≤ 6 party singles | battle-only species outside the zone set (Warden/Champion, story teams) had no bind path | wrong | applied (per-battle bind; follow-up) |
| L3-21 | §10.7.5 | `undress` fades the arena | opaque library materials cannot fade; implemented rise/sink (notes Q7) | cosmetic | applied |
| L3-22 | §10.7.5 | beacons coloured `accentType`, placement unstated | implemented as audience-side key lights ±40°, r 4.7 m, 2.3 m high, colour 55 % toward white (lateral beacons left the back-view battler a silhouette; notes Q15) | cosmetic | **R13** |
| L3-23 | §10.7.7 | looks are GLBs with `AnimationMixer` | render still draws procedural figures (notes Q9) although `public/models/looks/*.glb` now ship (commit e2d6127) | stale | **R15** |

---

## Fixes applied (CHANGELOG entry titles, all dated 2026-09-25)

Spine (`00-spine.md`)
- §2.10 — `resolveTurn`'s `null` rule includes every non-player side in every phase
- §2.20 — the fuzz digest construction is stated; first commit of `packages/core/test/fuzz-digests.json` recorded
- §2.11 — the sleep counter's effective length (`N − 1` skipped actions) is stated
- §3.10 rule 11 — the bind cap applies to the overworld set `O(zone)` = table ∪ statics; the full `Z(zone)` is reported, not capped
- §3.10 — `dist/heightfields/<zone>.json` is the exact compact encoding `q64-delta-varint-b64+rle`
- §3.11 — the missing building/prop footprints are recorded as an open authority gap
- §4.3 — `InputMsg` drops `.finite()`
- §4.3 — unknown message types are counted by a `'*'` handler (no reply); payload validation runs inside the handler wrapper, not as the `onMessage` validator
- §4.4 — raid rewards arrive as `battleEnd { battleId: raidId }`
- §4.6 — the handover trigger is 6 m inside the **playable** edge, not the field edge
- §4.7 — `POST /zone/enter` answers 409 `wrongZone` unless `zoneId` is the persisted or live presence zone; during a battle it seats the player in the battle's own room
- §4.7 — `/creature/:id/setup`, `/guilds`, `/marketplace/list|bid|buy-now|cancel` responses carry an `inventoryDelta`
- §5.1 — `battle_history` gains `start jsonb` (`BattleStartSnapshot`) and `final_digest varchar(8)`
- §5.2 — repository interfaces gain the server-part-1/2 additions

Render (`10-render.md`)
- header table and §10.1–§10.1.5 — three 0.186 facts (`trackTimestamp`, `Animation` loop, 1-byte compressed textures, `RenderPipeline.dispose`, `updateFrustums`, warm-up and light-set programs, HUD colour space, `adapterInfo`)
- §10.2.4–§10.2.5 — the surface graph block matches the implemented graph; `windDisplace` is a plain factory
- §10.3.3, §10.3.5, §10.2.1 — SPEC light units (`× π`), IBL normalised to a 0.3 sky radiance, sky re-centred, sun/moon fade; the visible sky's radiance stated
- §10.3.7 — grove `fogDensity` 0.018 → 0.0068 per m; the binding number is the fog on the focus
- §10.3.2, §10.7.5 — the ZoneBuilder budget throws at the 7th shadow caster; beacons exist from `createRenderer`; VFX add no lights and draw through one instanced `Sprite`
- §10.3.6 — rain/hail are one `LineSegments` sheet
- §10.4.1, §10.4.3–§10.4.5, §10.4.7 — `mipmaps` holds every level; yaw toward the camera + half-pitch lean; `'color'` uniform; `shadowSide = DoubleSide`; `map = null`; decal MRT values and mask (0, 0); battle-only species bound per battle
- §10.4.5 — the creature-emissive bloom claim is restated in luminance
- §10.5.5, §10.5.7, §10.5.9, §10.6 — geometric splat; zone-wide instanced tier fields; `LOD.autoUpdate = false`; card/solid split; impostor cards; dispose events and attribute release; blockers + `surf` in `resolveMove`
- §10.7.3, §10.8.2–§10.8.3 — DOF camera uniforms; CoC arithmetic (2.85 px at `pr 1`); vignette 9.3 %; chroma centre; GTAO temporal only with TRAA; `vignetteAspect`/`bokehScale`; texture-memory arithmetic
- §10.7.4 — the battlers stand along the heading's view direction
- §10.7.5 — `undress` sinks the arena into the ground instead of fading it
- §10.10.2 — render targets ≤ 41 and programs ≤ 128; programs return to baseline after unload

Client (`20-client.md`)
- §20.1.1, §20.1.2 — `createAppRouter()`; `apiFetch(key: RouteKey, init)`; react-router 7.18.4
- §20.3.4 — reconnection is the SDK's; a replaced tab sees 4101
- §20.3.2, §20.5.5 — a matching preview state becomes `authoritative` wholesale
- §20.4.5 — zoom stops are 20 / 26 / 34 m

Server (`30-server-netcode.md`)
- header, §30.1.1, §30.2.2, §30.2.5, §30.2.7 — Colyseus 0.18.14 behaviours
- §30.2.4 — `bounds` before `unwalkable`; `prev.canSurf`
- §30.2.6 — join tickets; `wrongZone`; battle-room seat on reload
- §30.3 — `SpawnDirector.tick(now, timeOfDay, players)` returns `freed`; `featuredSpecies`; warm-up; footprint gap
- §30.4.7 — raid boss PP restored on copy-in; prepare → transaction → commit
- §30.4.8 — rule 6: a story-battle `TrainerDef` is fired only by its beat
- §30.5 — the authority matrix names every writer of money, inventory and story flags
- §30.6.2 — `ARGON2.algorithm` is the literal `2 as Algorithm`
- §30.6.3 — `/marketplace/list` joins the in-battle refusals; raid participants count as in battle
- §30.6.5, §30.7.1, §30.8.3, §30.11 — 19 blocked words; reverse friend request accepts; `offerHash` sorted by playerId; DB-only replay

Pipelines (`40-pipelines.md`)
- §40.1.2, §40.1.5, §40.6 — stale rows and v1 block marked historical; v2 comments and `alt?`; byte arithmetic from the shipped manifest
- §40.2.2–§40.2.6 — model pipeline against gltf-transform 4.5 (no `meshopt()`, no KTX2 `textureCompress`, `joinPrimitives`, `simplifyWithAttributes` 0.01, slot roles, detached clips, ≤ 512² ladder, 19 looks)
- §40.3.2–§40.3.3, §40.0.2 rule 5, §40.3.1 — `@ewa/render/surfaces`; per-level encode + container assembly; pack level 0; seam metric; `Noise.periodic`, `CardRgb`, `rdo?`

Verification (`50-verification-budget.md`)
- §50.2.2 — texture bytes from `RenderStats.textureBytes`; render targets ≤ 41; programs ≤ 128; shadow lights scene-wide
- §50.2.3 — `trackTimestamp` needs no cast
- §50.4.5 — authority cases A21–A24; A14 expects 4101
- §50.4.5 `aoi-fanout.test.ts` — bots move 6.7 m/s over the playable interior
- §50.4.8 — the `encoding.test.ts` row carries the §40.1.6.4 thresholds as amended on 2026-09-24

## Code follow-ups the applied SPEC changes create (not done here: code is out of this task's scope)

1. `packages/server/src/rooms/ZoneRoom.ts` — skip story-battle trainers in the plain trainer path (§30.4.8 rule 6); `authority.test.ts` A21–A24.
2. `packages/render/src/terrain/collider.ts` — `resolveMove`/`resolveMoveInto(…, surf)`; the client's Collider adapter passes `inventory['HM Surf'] > 0` (§10.6.2).
3. `packages/render` + `packages/client` — bind the `home` atlas of every opponent battler outside the zone set before `battleStart` plays, release after `battleEnd` (§10.4.1).
4. `packages/render` zone builder — assert ≤ 6 zone shadow casters in the builder itself, not only in the adapter test (§10.3.2).
5. `tools/asset-audit` — rule constants `renderTargets ≤ 41`, `programs ≤ 128`, texture bytes from `RenderStats.textureBytes`.

## Open recommendations, ranked

| Rank | Id | Finding | Recommendation | Why it is a decision, not a fix |
|---|---|---|---|---|
| 1 | R1 | L2-01 (blocker) | Move the building/prop footprint plan (`planBuildings`/`planProps` inputs: kinds, positions, yaw, extents) into a pure `@ewa/content` export; `buildHeightfield` marks footprints `walkable = 0`; render's builder consumes the same plan and drops its private blockers; `SpawnDirector` then cannot place inside a footprint. Digest and every committed `dist/heightfields/*.json` change. | Moves layout ownership between packages and re-baselines 21 heightfield digests and the `zoneSpecFor` snapshots. |
| 2 | R3 | L3-07 (blocker for Pillar 1) | DOF strength: `bokehScale` 6 → 7 px (CoC 3.33 px at `pr 1`) or `focalLength` 6 → 5.5 m (3.24 px); judge on the M2 contact sheet. | Art: stronger miniature blur everywhere vs a narrower sharp band. |
| 3 | R2 | L2-23 | Under Redis, `refuseInBattle` and `/zone/enter` must use `PresenceMirror.lookup` (distributed), not the local store. | Code change; harmless single-process, exploitable multi-process. |
| 4 | R5 | L3-12 | Re-derive the 700 MB texture cap with atlases (≤ 304 MB), cascade colour attachments (≈ 128 MB) and resolution-scaled post targets, measured at 1440p and at the 3840 drawing-buffer cap; levers: cap `pr` so the buffer stays ≤ 2560 wide, depth-only or 1024² far cascades, fewer bound atlases. | Budget trade-off between resolution, shadow quality and the atlas set. |
| 5 | R6 | L1-11, L3-03 | Warm-compile each zone's light set inside `loadZone` before adding the root (`compileAsync` with the scene pass's MRT set on the renderer, off the main thread); keep distinct punctual-light sets per zone to one. | Load-time vs first-frame hitch (+28 programs, ≈ 16 s synchronous compile on the dev iGPU at boot). |
| 6 | R8 | L3-11 | Make the creature emissive term luminance-aware, e.g. `a.rgb × max(1.8, 1.25 / max(luminance(a.rgb), 1e-3))`, so masked reds/blues/violets clear the 1.15 threshold; or accept hue-dependent bloom and restate Pillar 8's gap per hue. | Art: which accents should glow. |
| 7 | R7 | L3-18 | Decide the local shadow-caster budget (implemented ≤ 1 per zone vs §10.3.2's 6 lanterns) and extend the `shadows.drawCalls` derivation to count each local caster's passes. | Budget: lamp shadows vs draw calls and the 2.0 ms shadows row. |
| 8 | R9 | L3-05 | Scale the visible sky by the IBL normalisation (or its own exposure) or exclude layer 30 from bloom, before any camera (spectator, hostile audit, future free cam) frames the horizon. | Art: sky brightness is a look decision. |
| 9 | R4 | L3-13 | Feed the DOF a `viewZ` whose CoC is 0 under `mask.y` (e.g. `planeDist.negate().mul(oneMinus(maskT.y))`) so sharp pixels do not bleed into the far field. | Changes the DOF look around every battler; verify on shots 1–5. |
| 10 | R10 | L2-25 | Split lava from water in the heightfield (a `lava` mask or a water-body kind) so HM Surf and `medium: 'water'` spawns exclude lava. | Schema change to `Heightfield` (digests move). |
| 11 | R12 | L3-16 | Phase 3 for 8-atlas zones (4.35 MB + singles + GLB > 4 MB): preload the neighbour zone's atlases in phase 5 (handover budget) or raise phase 3 for non-slice zones; `first-frame.spec.ts` covers Mirevale only. | Load budget per zone. |
| 12 | R11 | L2-20 | Decide sleep length: `N` skipped actions (1–3, one guard in `canAct`) or keep `N − 1` (0–2). Either way a `fuzz-digests.json` change is a SPEC change (§50.7 rule 3). | Battle feel; moves the determinism corpus. |
| 13 | R13 | L2-26, L2-27, L3-22 | Fold implemented choices after review: missions data into `@ewa/content` (server Q11); `ZoneDef.gymAt` instead of the server's `(0, −26)` constant (server R5, render Z10); beacon placement and colour (render Q15). | Package boundaries and art review. |
| 14 | R15 | L3-23 | Wire `GLTFLoader` + `MeshoptDecoder` + `AnimationMixer` for `public/models/looks/*.glb` (now shipped) instead of the procedural figures. | Render work item. |
| 15 | R14 | L3-19 | A level-4 mip (or `lodMaxClamp 4`) for creatures with `sizeScale < 0.8`, or accept 2:1 minification at zoom stop 2. | +1 mip file per atlas map vs slight shimmer. |
| 16 | R16 | L1-43 | Bump `tools/sprite-pipeline` to `sharp` 0.35.x and encode with `webp({ exact: true })`, then tighten §40.1.6.4 test 7 back towards the original ± 12 claim. | Toolchain bump = `PIPELINE_VERSION` bump and a contact-sheet review (§40.1.7). |

## Assembler

`node .design/spec/assemble.mjs` → `SPEC.md written: 6598 lines from 00-spine.md, 10-render.md, 20-client.md,
30-server-netcode.md, 40-pipelines.md, 50-verification-budget.md` (exit 0; the §50.7 rule-5 duplicate-identifier check
passed with the new `ClosedListing`, `ZoneClient`, `SpawnTickResult`, `WindParams`, `Blocker`, `CardRgb` declarations).

Note: §50.7 rule 4's `scripts/check-spec-changelog.mjs` does not exist in the worktree, so the CHANGELOG rule is not yet
enforced by CI; the entries above follow rule 2 by hand.
