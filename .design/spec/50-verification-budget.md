# EWAMON REMASTERED — SPEC §50: VERIFICATION, BUDGET, CUTS, DEFINITION OF DONE

**Status:** BINDING. Codes against `00-spine.md`; where the two disagree, `00-spine.md` wins. Where `PLAN.md` and this file disagree, this file wins. Every number below is asserted by a named test or harness command, or it is not in this file.

Inputs: `PLAN.md` (frame-budget table, milestones, verification list); `00-spine.md` §1 pillars, §2.20 determinism contract and `fuzzBattles`, §3.10 `validate.ts`, §4.4 server messages, §5.4 persist test strategy; `eslint.config.js` + `eslint/local-rules.js`; `vitest.config.ts` (root runner, `packages/*/test/**/*.test.ts` and `tools/*/test/**/*.test.ts`); `.github/workflows/ci.yml`; the installed `@types/three` 0.186.0 declarations for `Info`, `Renderer.resolveTimestampsAsync`, `TimestampQuery`, `InspectorBase`, `RenderPipeline`; `three` 0.186.0 `WebGPUBackend.js` (`trackTimestamp`), `WebGPUTimestampQueryPool.js`. Every library symbol named here was read from `node_modules`.

Two facts about the installed toolchain that shape this section:

1. **Playwright is not installed.** `@playwright/test` is added as a root devDependency in M0 (`pnpm add -Dw @playwright/test`, browsers via `pnpm exec playwright install chromium`). Everything below that says "in Chromium" runs through it. Until it lands, no browser-side item in §50.5 can be ticked.
2. **PGlite is one connection.** `@electric-sql/pglite` executes one statement stream; two transactions cannot hold conflicting `FOR UPDATE` locks at the same time. Lock tests therefore have two shapes: a *sequential* shape that runs on PGlite everywhere, and a *concurrent* shape gated on `DATABASE_URL` (`describe.skipIf(!process.env.DATABASE_URL)`). §5.4 of the spine already requires the concurrent shape before any release; this file names the files.

---

## §50.1 NON-NEGOTIABLES

Each is a rule, the thing that enforces it, and the test that fails when it is broken. "Fails the build" means `pnpm check` exits non-zero.

1. **Progression is server-only.** Badges, exp, trainer exp, money, items, creatures, dex, rating, quest progress and story flags change on the client only through `progressionDelta` and `inventoryDelta` (spine §4.4). No client code path writes those store slices from a `BattleEvent`, a REST response body other than the ones the spine lists, or local computation. *Enforced by:* `packages/server/test/authority.test.ts` (§50.4.5) and a client store test that asserts the only two reducers touching `progression`/`inventory` are the two delta handlers.
2. **`@ewa/core` is pure and deterministic.** No imports, no `Math.random`, no `Date`, no `performance.now`, no unordered iteration (`ewa/no-external-imports`, `ewa/no-unordered-iteration`, the `no-restricted-*` blocks in `eslint.config.js`). `canonicalJson(resolveTurn(s, a, c))` is byte-identical across Node 22, Node 24 and Chromium. *Enforced by:* `pnpm lint`, `pnpm test:lint-rules`, `packages/core/test/fuzz.test.ts`, `packages/client/test/fuzz-browser.spec.ts`.
3. **Every lit opaque surface carries three maps** (pillar 2): `map` (sRGB), one ORM texture bound to `aoMap`, `roughnessMap` and `metalnessMap`, and `normalMap`. *Enforced by:* `tools/asset-audit` rule `materials.threeMaps` over the zone dump (§50.4.6). Exempt: materials flagged `unlit`, sprite materials (pillar 5 has its own maps), and the `HarvestLevel ≥ 2` degraded look, which the audit recognises by the uniform, not by a second material class.
4. **Every punctual light has a visible housing** (pillar 4): for each `PointLight`/`SpotLight` an emissive mesh within 0.6 units; ≤ 8 shadow-casting, ≤ 24 non-shadowing per zone, plus the sun. *Enforced by:* audit rules `lights.housing`, `lights.count`.
5. **Nothing stays a primitive** (pillar 3): zero `BoxGeometry`, `ConeGeometry`, `IcosahedronGeometry` with `detail 0`, `SphereGeometry` with `widthSegments < 24` in a zone graph outside the `debug` layer. *Enforced by:* audit rule `geometry.noPrimitives`.
6. **Sprites are never bilinear-smeared** (pillar 6): creature albedo `magFilter === NearestFilter`; anti-aliasing is TRAA on the scene. *Enforced by:* audit rule `sprites.nearest` and the edge test in §50.6 shot 3 (200 sampled edge pixels, zero intermediate alpha).
7. **DOF never touches the player's creature or an active battler** (pillar 1): the DOF mask reads 1.0 over their whole billboard in every frame. *Enforced by:* `packages/client/test/dof-mask.spec.ts` reading the mask target back over the billboard's screen rect (600 frames, any value < 1.0 fails).
8. **Accessibility always wins.** `prefers-reduced-motion` or the reduced-effects toggle zeroes grain, chromatic aberration, camera shake, hitstop, crit slow-motion and DOF (`20-client.md` §20.8.2, `10-render.md` §10.8.4), and `resolveTurn` output is byte-identical with effects on and off. *Enforced by:* `packages/client/test/reduced-effects.spec.ts` (600-frame capture: zero frames with shake offset ≠ 0, zero frames with `timeScale ≠ 1`) and `packages/client/test/timeline.test.ts`.
9. **Disposal returns to baseline.** The baseline is `BudgetCounts` captured after `createRenderer` resolves (library warm-compiled, `10-render.md` §10.1.2 step 8) and **before** any `loadZone`. After every `unloadZone()`, `renderer.info.memory.{geometries, textures, texturesSize, programs, renderTargets, attributes, attributesSize}` equal that baseline — exactly, not within a tolerance; the first cycle is not special. *Enforced by:* `packages/render/test/leak.spec.ts` (§50.4.6), 50 cycles over `mirevale` and `mire_route`. <!-- reconciled 2026-09-18: this file said "after the first warm load/unload cycle", 10-render.md said post-step-8; one baseline -->
10. **No per-frame allocation in the sim step or the input path.** The client fixed step, prediction/reconciliation and remote interpolation allocate zero objects per tick after warm-up. *Enforced by:* `packages/client/test/alloc.spec.ts` — Chromium `--js-flags=--expose-gc`, `gc()` then 600 ticks, `performance.measureUserAgentSpecificMemory()` delta ≤ 64 KiB (sampling noise), and an instrumented `Array`/`Object`/`Map` constructor count of 0 inside the tick.
11. **130/130 obtainable is asserted at build.** `validate.ts` rule 7 (spine §3.10). *Enforced by:* `pnpm --filter @ewa/content validate`, which `pnpm build` runs; `packages/content/test/coverage.test.ts` additionally lists the ids by acquisition path.
12. **Content ids are validated at build.** Every dangling id in spine §3.10 rule 2 fails `pnpm build`. The server never resolves an unknown id at runtime — `ContentIndex` throws `RangeError`, and the server's message handlers catch it as `error { code: 'invalidPayload' }`. A message whose *type* is not a `CLIENT_MESSAGES` key is counted by the room's `'*'` handler and dropped without a reply (spine §4.3; 5 in 10 s → disconnect 4003; without the `'*'` handler `@colyseus/core` 0.18.14 would disconnect on the first one — amended 2026-09-25).
13. **No client-side badge.** There is no code path on the client that produces a `BadgeId` other than reading `progressionDelta.badges`. *Enforced by:* a `grep`-shaped test, `packages/client/test/no-client-badge.test.ts`, which asserts that `packages/client/src` contains no string literal from `BADGES` ids except inside the display map `badgeIcon.ts`, and `authority.test.ts` case A6.
14. **One design system.** `packages/client/src/ui/tokens.css` (generated from `tokens.json`, `20-client.md` §20.2.2) is the only file declaring CSS custom properties; no `style=` attribute except `cssVars({ '--x': … })`; no `font-size` outside the `--t-*` tokens; every spacing value a `--s-*` token. *Enforced by:* `packages/client/test/design-system.test.ts` (regex over the source tree, plus the contrast and ΔE checks of §20.2.2/§20.8.3 and equality of `tokens.json` `typeColors.default` with `10-render.md` §10.4.6) and the local ESLint rule `ewa/no-inline-style` (`20-client.md` §20.2.1). <!-- reconciled 2026-09-18: path and rule name per 20-client.md -->
15. **Readability gates.** The HP bar, the type icon and the move-result text of both active battlers are never covered by bloom, DOF, VFX or camera framing. *Enforced by:* `packages/client/test/readability.spec.ts` — for the 6 audit shots in battle state, the HUD rects are read back from the final composite and compared with a HUD-only render: per-pixel luminance difference ≤ 2/255 over the rect (bloom and DOF are applied before the HUD layer, so a leak shows as a difference).

---

## §50.2 FRAME BUDGET

**Reference machine.** 2560×1440, `devicePixelRatio 1`, RTX 3060 (12 GB) or RX 6600, current stable driver, Chromium stable, headed (GPU timestamps need a real adapter). The budget is measured on this machine and nowhere else; CI measures counts, not milliseconds (§50.2.3).

**Frame.** 16.67 ms at 60 Hz. Target 10.0 ms, hard ceiling 13.5 ms, as `PLAN.md` set; the per-pass split below is the expansion the plan deferred to M2. It is asserted twice: each pass against its own row, and the sum against the total row. A pass under its row does not buy another pass headroom.

### 50.2.1 Per-pass table (ms, GPU unless marked CPU)

| Pass | What is counted | Target | Hard ceiling |
|---|---|---|---|
| sim (CPU) | client fixed step: input sampling, prediction, reconciliation against `PlayerState.seq`, remote interpolation buffer, battle preview `resolveTurn` when a turn lands | 0.6 | 1.0 |
| opaque | depth+normal prepass and the opaque pass, including all `InstancedMesh` scatter and LOD/impostor tiers | 2.6 | 3.4 |
| sprites | alpha-tested, depth-sorted creature/NPC billboards, plus transparent/VFX | 0.8 | 1.2 |
| shadows | sun: 4 cascades (`CSMShadowNode`, `cascades: 4`) + up to 8 local shadow casters | 2.0 | 2.6 |
| GTAO | `GTAONode`, half resolution (1280×720), 16 spp | 1.2 | 1.6 |
| TRAA | `TRAANode` resolve | 0.7 | 1.0 |
| bloom | `BloomNode`, 5 mips | 0.7 | 1.0 |
| DOF | `DepthOfFieldNode` with the tilt-shift focal plane and the battler mask | 0.9 | 1.3 |
| grade / HUD | ACES, grade + vignette + grain (`GrainNode`, `ChromaticAberrationNode`), in-canvas HUD layer <!-- amended 2026-10-06: FilmNode → the zero-mean GrainNode, 10-render.md §10.8.2 --> | 0.5 | 0.7 |
| **Total** | sim + every GPU pass | **10.0** | **13.5** |

Statistic: over a 600-frame capture after 120 warm-up frames, **median ≤ target** and **p95 ≤ hard ceiling**. Either failing fails the capture. The six §50.6 camera positions are each captured; the worst shot is the number reported.

### 50.2.2 Count caps (per loaded zone, any camera position, any time of day)

| Metric | Source | Cap |
|---|---|---|
| Draw calls (beauty + post) | `BudgetCounts.beautyDrawCalls` = `renderer.info.render.drawCalls` − the frame's shadow-map draws (`shadowDrawCalls`, ≤ 564 separately, §10.5.8) <!-- amended 2026-09-30: the source column counted the shadow cascades, which §10.5.8 excludes — audit M2-gym-dusk-7 --> | ≤ 400 |
| Triangles | `renderer.info.render.triangles` | ≤ 2 500 000 |
| Texture memory | `renderer.info.memory.texturesSize` **+** `materials.residentTextureBytes()` **−** the sprite pool's `infoOvercountBytes()` (= `RenderStats.textureBytes`; three counts every compressed texture as 1 byte, `Info.js` lines 449–453, and counts a creature atlas's level 0 twice because §10.4.1 puts level 0 into `mipmaps`, `Info.js` lines 449–509) <!-- amended 2026-10-06 --> | ≤ 700 MB (734 003 200 bytes); creature textures get a live share = the cap − every other texture byte − 16 MiB (`20-client.md` §20.4.4 residency) |
| Unique materials | distinct `Material.uuid` reachable from the zone root, excluding the `debug` layer | ≤ 48 |
| Shadow-casting lights | `PointLight`/`SpotLight` with `castShadow === true`, scene-wide (the 2 arena beacons included) | ≤ 8 (+ sun) |
| Non-shadowing lights | `PointLight`/`SpotLight` with `castShadow === false` | ≤ 24 |
| Render targets alive | `renderer.info.memory.renderTargets` | ≤ 41 (29 post/IBL + 4 cascades + ≤ 8 local casters, `10-render.md` §10.10.2; measured 34) |
| Shader programs alive | `renderer.info.memory.programs` | ≤ 128 (measured 107 with a zone loaded; baseline 79) |

<!-- amended 2026-09-25: texture metric per render IMPLEMENTATION-NOTES C17; render-target and program caps 24 / 96 were measured impossible (C18: 34; Part 2: 107) — see 10-render.md §10.10.2 -->
The 700 MB texture cap is itself doubtful at the 3840-wide drawing buffer once atlases, singles and cascade colour attachments are counted (`10-render.md` §10.8.3; recommendation R5 in `.design/audits/spec-verification.md`).

Counts are read after `renderer.render()`/`pipeline.render()` returns for the frame; `renderer.info.autoReset` stays `true` so `render.*` is the last frame's figure.

### 50.2.3 How it is measured — the `BudgetProbe` contract

`@ewa/render` exports this interface verbatim and `createZoneView()` (`10-render.md`) returns an object that implements it. The harness codes against nothing else.

```ts
export type BudgetPass =
  | 'opaque' | 'sprites' | 'shadows' | 'gtao' | 'traa' | 'bloom' | 'dof' | 'grade';

export interface BudgetCounts {
  readonly drawCalls: number;        // renderer.info.render.drawCalls (the whole frame, shadow maps included)
  readonly triangles: number;        // renderer.info.render.triangles
  readonly texturesSize: number;     // renderer.info.memory.texturesSize (bytes)
  readonly textures: number;         // renderer.info.memory.textures
  readonly geometries: number;       // renderer.info.memory.geometries
  readonly programs: number;         // renderer.info.memory.programs
  readonly renderTargets: number;    // renderer.info.memory.renderTargets
  readonly attributes: number;       // renderer.info.memory.attributes
  readonly attributesSize: number;   // renderer.info.memory.attributesSize
  readonly materials: number;        // distinct Material.uuid under the zone root, debug layer excluded
  readonly shadowLights: number;
  readonly nonShadowLights: number;
}

export interface BudgetProbe {
  /** Disables one pass in the pipeline graph. The frame still renders (the pass's input is passed through). */
  setPassEnabled(pass: BudgetPass, on: boolean): void;
  /** Counts for the frame that most recently completed. */
  counts(): BudgetCounts;
  /**
   * Whole-frame GPU time in ms for the last resolved frame:
   * `await renderer.resolveTimestampsAsync(TimestampQuery.RENDER)`; undefined when the adapter lacks 'timestamp-query'.
   */
  gpuFrameMs(): Promise<number | undefined>;
  /** CPU time of the last fixed step in ms, measured by the client around its tick and pushed here. */
  simMs(): number;
  /** JSON dump of the zone graph for tools/asset-audit: materials, geometries (class + parameters), lights, sprite textures. */
  dumpZone(): ZoneDump;
}
```

GPU timing uses the renderer's own timestamp queries: the `WebGPURenderer` is constructed with `trackTimestamp: true` (a `WebGPUBackend.js` parameter, `@property {boolean} [trackTimestamp=false]`, declared in `@types/three` 0.186's `WebGPUBackendParameters` at `src/renderers/webgpu/WebGPUBackend.d.ts` line 11, so no cast is needed; the backend forces it to `false` when the adapter lacks `timestamp-query`). <!-- amended 2026-09-25: "missing from @types/three … one typed cast" was false — render IMPLEMENTATION-NOTES C1 --> `resolveTimestampsAsync('render')` returns the summed duration of all render contexts of the frame — the total row. It requires the adapter feature `timestamp-query`; Chromium exposes it behind `--enable-webgpu-developer-features`, which the harness launches with.

**Per-pass time is differential, not per-context.** Three's pool keys timestamps by an internal render-context uid, and the display nodes (`BloomNode`, `GTAONode`, …) own their own render targets, so mapping uids to the table's rows would depend on internals this file does not control. Instead: `T_all` = median of 600 frames with every pass on; for each pass `p`, `T_without_p` = median with `setPassEnabled(p, false)`; `pass_ms(p) = T_all − T_without_p`. `opaque` is measured last as the remainder: `T_all − Σ pass_ms(others) − simMs`. Each pass is asserted against its row; `T_all + simMs` is asserted against the total row. Cross-check only: an `InspectorBase` subclass (`renderer.inspector = new BudgetInspector()`) logs `beginRender(uid, scene, camera, renderTarget)` / `finishRender(uid)` pairs and, after `resolveTimestampsAsync`, prints `renderer.backend.timestampQueryPool.render.getTimestamp(uid)` per uid next to the render target's `name`, so a reviewer can see which contexts a pass is made of. The printed values are not asserted.

**Harness command** (script added to `packages/client/package.json` at M2):

```
pnpm --filter @ewa/client harness:budget -- --zone mirevale --shots all --frames 600 --warmup 120 --out .screenshots/budget/mirevale.json
```

It launches Chromium through Playwright with `--enable-webgpu-developer-features --enable-unsafe-webgpu`, loads `/harness/budget?zone=<id>` (a client route that mounts `createZoneView()` with a scripted camera and no network), runs the differential procedure per shot, writes JSON `{ machine, adapter, zone, shots: [{ id, counts, passMs, totalMs: { median, p95 }, simMs }] }`, and exits 1 on any assertion failure. `--budget-ms 0` disables millisecond assertions (CI mode); counts are always asserted.

**CI** runs the same command with `--budget-ms 0` under headless Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`, so every count cap in §50.2.2 is enforced on every push; milliseconds are enforced by the M2 and M5 gates in §50.5 on the reference machine, and the JSON they produce is committed under `.screenshots/budget/` (tracked, unlike `.screenshots/**` shots, which `eslint.config.js` ignores and `.gitignore` excludes).

---

## §50.3 CUT DELIBERATELY

Each cut names what it would have cost and what replaces it. Adding any of these back is a SPEC change (§50.7).

| Cut | Reason | Replacement |
|---|---|---|
| **SSR** (`SSRNode` exists in `examples/jsm/tsl/display`) | A second depth-dependent trace per pixel, ≥ 1.5 ms at 1440p on the reference GPU; the budget has no row for it | Correct PMREM from the physical sky + clearcoat on wet stone |
| **SSGI** (`SSGINode`) | ≥ 2.5 ms half-res; the art scale is a model village, baked AO + IBL reads the same at a still | Baked AO in the ORM R channel + GTAO |
| **Raymarched volumetric fog** | 1–3 ms and a noise pattern TRAA cannot fully resolve | Height fog + ≤ 6 light-shaft billboards per zone |
| **Real-time GI** | Zones are authored per `layoutSeed` and rebuild identically, so they can bake | Per-zone baked probes, swapped with the light set |
| **Mobile / touch** | `PLAN.md`: desktop only | None; the client refuses viewports narrower than 1280 CSS px with a message (`20-client.md` §20.2.3) <!-- reconciled 2026-09-18: was 1024 --> |
| **WebGL2 as a designed tier** | Three's automatic `forceWebGL` fallback exists, but no budget, audit shot or pillar test is run on it | `WebGPURenderer` only; the fallback is allowed to run and is not asserted |
| **Quality presets** | One tier plus the accessibility strip (`PLAN.md`); four presets would quadruple the audit matrix | Reduced-effects toggle (§50.1.8) |
| **Pixel-diff screenshot gating** | TRAA and grain make per-pixel equality non-deterministic; a 1 % tolerance hides real regressions and a 0 % tolerance flakes | Fixed-position shots are captured and *read by a person* in the §50.6 audit; numeric assertions are the mask/edge/HUD readbacks, which are deterministic |
| **Millisecond assertions in CI** | Cloud runners have no discrete GPU; SwiftShader numbers mean nothing | Counts in CI, milliseconds on the reference machine at the M2/M5 gates |
| **Code-coverage percentage gate** | A percentage says nothing about which invariant is covered; the matrix in §50.4 names the files instead | The §50.4 files must exist and pass; `vitest --coverage` is available for reading, never for gating |
| **Property-based fuzz of `validateAction` with random bytes** | The zod layer (§50.4.3) rejects malformed payloads before core sees them; fuzzing core with shapes it cannot receive tests nothing | `fuzz.test.ts` drives core with valid actions; `payloads.test.ts` drives protocol with invalid ones |
| **Load testing against a deployed server** | No deployment exists before M5; the AOI harness runs in-process against `@colyseus/core` and measures the same code | `aoi-fanout.test.ts` at N = 50/100/200 |
| **Migrating the legacy database** | `PLAN.md`: fresh DB | `seed.ts` creates three demo players |
| **Everything in `00-spine.md` "CUT DELIBERATELY"** | Listed there; not repeated | — |

---

## §50.4 TEST MATRIX

Runner: root `vitest.config.ts` (`pnpm test`), environment `node`, `testTimeout 60000`. Browser tests are `*.spec.ts` under the same `test/` directories and are run by `@playwright/test` (`pnpm exec playwright test`), not by vitest — the root vitest `include` glob is `*.test.ts`, so the two runners never pick up each other's files. Filtering: `pnpm vitest run packages/core` runs one package; `pnpm vitest run packages/core/test/fuzz.test.ts` runs one file.

Every file listed must exist with at least the assertions listed. A milestone in §50.5 is not done while any of its files is missing.

### 50.4.1 `@ewa/core` — `packages/core/test/`

| File | Asserts |
|---|---|
| `rng.test.ts` | sfc32 step matches the committed vector: `createRng(12345).int(1000)` after warm-up equals the constant in the file; `snapshot()` → `createRng(state)` resumes byte-identically; `shuffle` consumes exactly `n − 1` draws; `fork()` advances the parent by exactly 4; `fnv1a32('')` and `fnv1a32('ewamon')` equal committed constants; string seeds route through `fnv1a32`. Run on Node 22 and 24 (CI matrix) and in Chromium (`fuzz-browser.spec.ts`). |
| `types.test.ts` | `TYPE_NAMES.length === 19`, last is `'Cosmic'`; `typeMultiplier` returns only members of `{0, 0.25, 0.5, 1, 2, 4}` over all 19 × 19 × 19 combinations of one attacking and two defending types; chart rows from `.design/legacy/ewamon.js` `TYPE_CHART` reproduced (`Steel→Cosmic 2`, `Dark→Cosmic 2`, `Fairy→Cosmic 0.5`, `Cosmic→Psychic 2`). |
| `stats.test.ts` | `calcStat`/`calcMaxHp` against 20 tabulated (base, level) pairs; the 13-entry `stageRatio` and `accStageRatio` tables in spine §2.7; `clampStage` on −10..10. |
| `status.test.ts` | `addStatus` refuses a second major status; `confuse` coexists; `removeStatus` idempotent; `majorStatus` on all 32 subsets of `{burn, poison, paralyze, sleep, freeze}` ∪ `confuse` never returns two. |
| `damage.test.ts` | Each of the 12 steps of spine §2.14 with a hand-computed expected value; `calcDamage` consumes exactly 2 rng draws when step 0 passes and exactly 0 otherwise (a counting `Rng` wrapper); immunity → `amount 0` with `effectiveness 0`; `min 1` only when step 0 passed. |
| `accuracy.test.ts` | Exactly one draw per check, including `accuracy === null`; the threshold formula at every combination of `acc`/`eva` stages −6..6 (169 cases) against a table computed in the test with `Math.floor`; Hustle ×0.8 on damaging only; Sand Veil ×0.8 in `sand` only. |
| `effects/<effect>.test.ts` (22 files) | One file per `MoveEffect` that reaches core: `lower_atk`, `lower_def`, `lower_spd`, `raise_atk`, `raise_def`, `raise_spd`, `raise_all`, `crit`, `first`, `flinch`, `burn`, `poison`, `paralyze`, `freeze`, `sleep`, `confuse`, `trap`, `recoil`, `drain`, `heal`, `weather`, `sun`. Each asserts the affected side, the magnitude, the default chance (by driving an rng that returns 0 then 99), the type immunity where the spine lists one, the emitted events in order, and the duration counter. `flinch` asserts no effect when the attacker moved second. `heal` asserts `moveFailed { reason: 'fullHp' }` and PP still spent. The 23rd effect, `lower_spAtk`, never reaches core; it is asserted in `packages/content/test/validate.test.ts` (rewrite to `lower_atk` on the defender). |
| `abilities.test.ts` | All 25 rows of spine §2.5 by hook: Intimidate fires once on switch-in and never in `calcDamage`; Guts cancels the burn halving; Wonder Guard blocks `effectiveness < 2` with `moveFailed { reason: 'wonderGuard' }`; Levitate/Void Sovereign → `absorbed: null`, `amount 0`; Water/Volt Absorb heal `floor(maxHp/4)`; Flash Fire flag set then ×3/2; Competitive +2 once per foe-caused lowering; Regenerator `floor(maxHp/3)`; Natural Cure clears major only. |
| `items.test.ts` | All 14 held rows: Choice lock persists until switch-out, `choiceLocked` from `validateAction`; Assault Vest blocks power-0 (`statusMoveBlocked`) and ×1.25 def; Eviolite only when `evolution !== null`; Sitrus/Oran thresholds and one-shot; Weakness Policy consumed on `effectiveness ≥ 2`; Heavy Duty Boots no-op. |
| `turn-order.test.ts` | Spine §2.11 order with a scripted rng: replacement phase returns without `turn + 1`; forfeit ends immediately; flee while trapped → `moveFailed { reason: 'trapped' }` and the wild side acts; switches before items before catch before moves; priority > speed > `rng.int(2)`; end-of-turn order sand→burn→poison→trap→berries→Speed Boost→weather countdown→faint→mustSwitch; a battler KO'd by burn takes no later tick and triggers no berry. |
| `validate-action.test.ts` | Every `ActionError` value is produced by at least one case; `resolveTurn` throws on each; `null` accepted for every non-player side in every phase (including its own replacement phase) and for a player side only in the replacement-phase exception (spine §2.10, amended 2026-09-25); pvp with a `null` action throws. |
| `catch.test.ts` | `CATCH_B.length === 256`, `CATCH_B[0] === 0`, `CATCH_B[255] === 65536`, monotonic non-decreasing; regeneration with `Math.pow` compared and any mismatch *reported*, the literal wins; the `a` formula on 12 (M, H, rate, orb, status, alpha) rows; `a ≥ 255` → 0 draws, three `catchShake` then `catchResult { caught: true, shakes: 4 }`; otherwise 1..4 draws, `catchShake` count `min(3, shakes)`; alpha halves `rate` with floor and min 3; orb deducted on failure (`consumedItems`). |
| `exp.test.ts` | `expToLevel(l) === l ** 3` for 1..100; `expToLevel(100) === 1_000_000`; `levelForExp` inverse over 0..1_000_000 step 997; `expGain` ×3/2 for trainer/league/pvp only; `applyExp` returns `levelsGained` as a contiguous list, `learnable` only moves not known, `evolveReady` resolves the `split` branch by ability; exp capped at 1_000_000; `evolve` keeps a non-species nickname, resets a species-name nickname, scales hp by the maxHp ratio. |
| `elo.test.ts` | 10 000 seeded rating pairs: `winnerDelta ≥ 0`, `loserDelta ≤ 0`, `|winnerDelta| + |loserDelta|` within 1 of `K`; ratings floor at 0; `tierFor` on the six thresholds and each threshold − 1. |
| `trainer-exp.test.ts` | All 14 `TRAINER_EXP` values; `trainerLevelFor(0) === 1`, `trainerLevelFor(99_999) === 100`, `trainerLevelFor(200_000) === 100`. |
| `events.test.ts` | Every `BattleEvent` emitted by a scripted 12-turn battle is JSON-round-trippable with no `undefined` (`JSON.stringify` then deep-equal); every `damage` carries `hpAfter`, `maxHp`, `effectiveness`, `crit`, `stab`, `cause`; the 35 `t` values are each produced at least once across the core suite (a coverage map written by a shared helper and asserted at the end of this file). |
| `digest.test.ts` | `canonicalJson` sorts keys by UTF-16 code unit, no whitespace, arrays ordered; `digestBattleState` is 8 lowercase hex chars; two states differing in one `pp` differ in digest. |
| `repairs.test.ts` | One `it('repair: …')` per `PLAN.md` combat row, each a regression that the legacy behaviour would fail: `stab ×3/2`; `accuracy rolls` (a 70-accuracy move misses with rng 70..99); `nine effects implemented` (crit, heal, recoil, trap, drain, raise_all, weather, sun are live; lower_spAtk is content-rewritten); `stages not permanent` (switch-out resets to 0, `Battler.atk` unchanged); `burn halves damage`; `immunity is zero` (never 1); `lower_atk hits the defender`; `Intimidate once`; `Elo loser negative`; `champion is zeon` (content check duplicated here as a guard on `LEAGUE`); `one catch formula` (no second `catch*` export exists in `index.ts`). |
| `fuzz.test.ts` | `fuzzBattles({ seeds: 1000, maxTurns: 200 })` exactly as spine §2.20 (a)–(e), plus: `calcDamage` draw-count assertion per turn; every action passes `validateAction`; digests equal `test/fuzz-digests.json` (1000 entries). A diff in that file is a semantics change and needs a §50.7 entry. Runtime target ≤ 40 s on the CI runner. |
| `determinism-replay.test.ts` | For 50 recorded battles (seed + action list from the fuzz run): replay from `createBattle` reproduces every per-turn digest; replaying from a `snapshot()` taken at turn 7 reproduces turns 8..end; `resolveTurn` called twice on the same input yields identical `canonicalJson` and does not mutate the input (deep-frozen input throws on write). |

### 50.4.2 `@ewa/content` — `packages/content/test/`

| File | Asserts |
|---|---|
| `validate.test.ts` | Each of the 10 rules in spine §3.10 is exercised by injecting one broken record into a copy of the tables and asserting `validate()` throws naming the rule and the offending id; the shipped tables pass. Includes: `lower_spAtk` rewritten to `lower_atk` with defender target; `weaknessPolicy` move effect → `null`; `hyperpotion`, `fullheal`, `ewamon_ball`, `great_ball`, `ultra_ball`, `ultraball`, `master_ball` rejected. |
| `counts.test.ts` | `SPECIES 130`, `MOVES 193`, `TYPE_NAMES 19`, `ABILITIES 25`, `ITEMS 17`, `ORBS 10`, `ZONES 21`, `ENCOUNTER_TABLES 15` (8 route + 3 town + 4 story, ids `enc_<zoneId>`), `LEGENDARY_STATICS 8`, `LEAGUE 12`, `BATTLE_PASS 100`, `STORY 33`, `QUESTS 12`, `DAILY_SWARMS 7`, `RAID_HOTSPOTS 8`, dex numbers dense 1..130, `ZONE_ORDER` equals the 21 ids in spine §3.1 order. |
| `coverage.test.ts` | Roster coverage 130/130 with the closure in rule 7 and RC-1 … RC-13; prints and asserts the acquisition path per species (encounter / evolution / static / quest / battle-pass); `LEGENDARY_STATICS` is exactly the 8 ids, none in any table/swarm/raid pool; `lumyth` and `noxmyth` reachable; no non-legendary in statics; **one spawn table per zone id with a table, and no encounter roll exists in `packages/client/src`** (grep for `rollEncounter\|ENCOUNTER_TABLES` outside the sprite-planner import — legacy-render-audit Q21); a 10 000-roll seeded sample of every table yields only species in that table. |
| `statics.test.ts` | Each `LegendaryStatic` `when` gate resolves (`badge:` or a flag set by a beat/quest/league row); coordinates inside the playable interior after snapping (`voidraxis` at `(0, 84)` and hotspot `raid_ascent_pyrothal` at `(0, 104)` sit on the boundary and must snap inward, not fail); `galaxion.when === 'flag:ledger_read'`. |
| `heightfield.test.ts` | `buildHeightfield` for all 21 zones in Node and in a Chromium worker → identical `digest` (rebuilt in `packages/client/test/fuzz-browser.spec.ts`'s worker too); `res` = 321/481/401 by kind; `walkable` share ≥ 45 % of `res²` (legacy-render-audit Q12: legacy was 10.7 %); the 16 m margin is all zeros; `playableBounds` = ±64 / ±104 / ±84; `spawn` walkable; `sampleHeight` bilinear against 100 hand-computed points; `dist/heightfields/mirevale.json` committed and equal to a fresh build. |
| `families.test.ts` | Exactly 67 evolution trees, each rooted at `evolvesFrom === null`; every `into` reachable from a caught species (closure), so every family is completable from a wild or gift base; the one `split` (`Lightning Rod → aonred`, default `darkyon`) has its `null` branch last. |
| `zones.test.ts` | Links symmetric for all 4 directions; every zone reachable from `mirevale` ignoring gates; gates appear in `BadgeId` order along `ZONE_ORDER`; the gate column equals spine §3.1's table row by row; `layoutSeed` unique; `mire_route.gate === null`. |
| `gates-reachable.test.ts` | A simulated player holding badges `[]`, `[bloom]`, `[bloom, ember]`, … in order can reach the town of gym `n + 1` with `n` badges, for `n = 0..7`, and `solenne` with all 8 — BFS over `links` honouring `gate`. |
| `league.test.ts` | 8 gyms with the 8 badges in order, ids `verdant_gym … draco_gym`; elite `veil`, `aurelia`, `kirei`; exactly one champion, `id === 'zeon'`; gym team levels non-decreasing across `order`; every team species/ability/held item resolves. |
| `encounters.test.ts` | `levelMin ≤ levelMax`, weights > 0, story tables satisfy RC-9 (band + Ghost/Dark night-only), ≤ 16 slots and ≤ 14 species per table, `|O(zone)| ≤ 16` (table ∪ statics) for all 21 and the full `Z(zone)` reported in `bindSets` (spine rule 11, amended 2026-09-25: `solenne` 26 and `umbral_observatory` 20 cannot meet a cap on `Z`); `medium` defaults to `'land'` and every `'water'` slot's zone has `water` samples; `ALPHA_CHANCE 0.02`, `VARIANT_CHANCE 0.03`; a 100 000-roll seeded sample of `mire_route` lands within ±1.5 percentage points of each slot's weight share. <!-- reconciled 2026-09-18: story tables allowed (roster-coverage A1) --> |
| `story.test.ts` | Exactly one `starter`; every `need` flag resolvable (`badge:` or set by a beat/quest/league row — the 33 bible beats pass); acyclic per zone and at most one eligible beat per zone for every reachable flag set (BFS over the beat graph); each act has ≥ 1 beat; `mire_route` has both a `harvested` and an `intact` beat; `nextStoryBeat` returns beat 1 for an empty flag set and `null` for a zone whose beats are all done; `harvestStateFor('mire_route', {})` is the content default, `{ 'beat:grove_gone:done' }` → `harvested`, `{ …, 'beat:restore_the_grove:done' }` → `intact`; `beatDoneFlag` never collides with an authored flag. |
| `index.test.ts` | `createContentIndex()` throws `RangeError` on an unknown id for each of the 5 lookups; `allSpecies()` sorted by `dexNumber`; the index is frozen (`Object.isFrozen` on a species). |

### 50.4.3 `@ewa/protocol` — `packages/protocol/test/`

| File | Asserts |
|---|---|
| `payloads.test.ts` | For each of the 20 `CLIENT_MESSAGES` schemas (spine §4.3, `battleResync` included): the documented valid example parses; each field's boundary − 1 / boundary + 1 is rejected (`seq` at `0xffffffff + 1`, `dtMs` 0 and 101, `emote` 0 and 7, `chat` 121 chars, `switch.to` 6, `creatureIds` length 7, non-uuid ids, non-finite `x`); unknown keys are stripped or rejected per the schema's mode, and the test states which; a `progressionDelta`-shaped object sent as a client message matches no schema. |
| `schema.test.ts` | `ZoneState` encodes and decodes through `@colyseus/schema` `Encoder`/`Decoder` with `players` and `spawns` as the only `@view()`-tagged fields (read from the class metadata); `PlayerState` keyed by uuid, not `sessionId`, in a round trip with two sessions for one uuid producing one entry. |
| `digest.test.ts` | `digestBattleState` from `@ewa/core` matches the value carried in a constructed `battleEvents` message; a client-side preview state with one differing field produces a mismatch. |
| `rest.test.ts` | Every request/response schema in spine §4.7 accepts its documented example and rejects: username outside `/^[a-z0-9_]{3,20}$/`, password length 7 and 129, starter not in the three, `pageSize 51`, `nickname` length 17, `moves` length 0 and 5, `qty` 0 and 100, `tag` not `/^[A-Z0-9]{3,4}$/` (`AB` rejected, `ABC`/`ABCD` accepted), `/zone/enter` with a non-`ZoneId`, `/profile` with a `body` not in `BODIES` or a `title` not in `TITLES`, `/quests/claim` without `questId`; the `ServerMessage` union parses one example of each of its 16 variants including `chat`, `dm`, `storyBeat` and a `handover` whose `seat` is a `SeatReservation` object. <!-- reconciled 2026-09-18 --> |
| `movement.test.ts` | `MOVEMENT` values (4.2 / 7.0 / 0.35) equal the server's `WALK_SPEED`/`RUN_SPEED` re-exports and render's `MOVER.capsuleRadius`; `stepMovement` is deterministic and allocation-free over 10 000 steps. |

### 50.4.4 `@ewa/persist` — `packages/persist/test/`

All files open a fresh PGlite (`drizzle-orm/pglite`) per file and run `migrate()` from `drizzle-orm/pglite/migrator` over `packages/persist/drizzle/` first.

| File | Asserts |
|---|---|
| `migrate.test.ts` | Migrations apply on an empty database; applying twice is a no-op; the schema in `schema.ts` matches the migrated database (`drizzle-kit check` equivalent: every table/column/index in `schema.ts` exists). |
| `slots.test.ts` | The `(owner_id, slot_kind, slot_index)` unique index rejects a duplicate party slot; `reorderParty` two-phase never violates it (an order that swaps slots 0 and 1 succeeds) and leaves no row in the 100..105 staging band after commit; `moveToSlot(…, 'box', 'nextBox')` picks `max + 1`; `creature_party_slot_ck` rejects party index 6, 99 and 106 and accepts 0..5 and 100..105 (spine §5.1); `swap` with a full party succeeds; `insert` into a taken party index → `PartyFull`. <!-- reconciled 2026-09-18 --> |
| `transfer.test.ts` | `transferCreature` moves ownership and slot in one transaction; `NotOwner`, `Locked`, `PartyMinimum` thrown and nothing written (row counts and `canonicalJson` of both players' creatures unchanged); an injected failure after the owner rewrite rolls the whole transaction back; `audit_log` gets exactly one `creature.transfer` row on success; `release` of a creature that was ever listed → `InvalidArgument`. |
| `market.test.ts` (PGlite, sequential) | `placeBid` escrows money at bid time (`players.money` decremented, previous bidder refunded; raising one's own bid needs only the difference); `BidTooLow` at `currentBid + 49`, accepted at `+ 50`; `SelfBid`; `amount ≥ buyNowPrice` → `BidAboveBuyNow`; `buyNow` transfers, pays `price − marketFee(price)` (5 %, floored), refunds the standing bidder; `buyNow` on a listing without a price → `NoBuyNow`; `cancel` with a bid → `ListingHasBids`; `closeExpired` returns unsold to the seller's box and marks `expired`, sells to the high bidder otherwise; `listings_creature_active_uq` blocks a second active listing of the same creature; `players_money_ck` rejects a raw negative write. <!-- reconciled 2026-09-18: persist §5.5 codes --> |
| `market-concurrency.test.ts` (`describe.skipIf(!process.env.DATABASE_URL)`) | 20 concurrent `placeBid` transactions on one listing at the same amount: exactly one succeeds, 19 see `BidTooLow`; 20 concurrent `buyNow`: exactly one transfer row, 19 `ListingClosed`; `closeExpired` from 4 concurrent workers with `SKIP LOCKED` closes each listing exactly once (sum of return values equals the listing count). Runs in CI nightly against a Postgres service container and is required by the M4 gate. |
| `trade.test.ts` | Two-player trade completion: both locked in ascending uuid order (asserted via the statement log), every creature in `trade_escrow`, transfers both ways, money both ways, two `trade_history` rows; any creature not in escrow aborts everything. |
| `inventory.test.ts` | `add` upserts and deletes the row at 0 (`all()` never lists zero quantities); going below 0 throws `InsufficientItems` and writes nothing; above 999 throws `InventoryOverflow`; `inventory_qty_ck` rejects a raw 1000; `addMany` is all-or-nothing. |
| `public.test.ts` | `Object.keys(toPublic(row, extras))` equals `PUBLIC_PROFILE_KEYS` = exactly `[id, username, title, motto, body, rating, peakRating, tier, trainerLevel, badges, guildTag, dexCaughtCount, showcase, createdAt]` in order; adding a column to a fixture row does not appear; `guildTag` is `null` for a guildless player; `showcase` ≤ 3 with `ownerId === null`; `publicProfile(tx, id)` gathers the same. |
| `social.test.ts` | `friendships_pair_uq`: a reverse request accepts the pending row instead of inserting a mirror; `AlreadyFriends`; `createGuild` charges 5 000 (`InsufficientFunds` at 4 999), tag regex `{3,4}`, `GuildNameTaken` on name or tag; the 51st `joinGuild` → `GuildFull`; a leader with members cannot `leaveGuild` (`Forbidden`); the last member's leave deletes the guild; `unreadCounts` after `markRead` is 0. |
| `battle-pass.test.ts` | `claim` twice → second returns `false` (`AlreadyClaimed`); `setMythicalChoice` without the level-50 row throws; a second choice throws; `BATTLE_PASS_MYTHICAL_LEVEL === 50`. Amended 2026-10-06 (Phase E5): "throws" is `Forbidden` without the row and `AlreadyClaimed` on a second choice. The REST route claims level 50 itself, gated on trainer level, before the choice (`authority.test.ts` A10b). <!-- amended 2026-10-06: Phase E5 --> |
| `escape-like.test.ts` | `escapeLike` escapes `\`, `%`, `_`; a search for `%` finds only literal `%` usernames. |
| `auth.test.ts` | argon2id parameters `m=19456 t=2 p=1` read back from the hash string; refresh rotation revokes the old token; a rotated-away token returns `null`; `revokeAll` invalidates every row and returns the count; `purge` removes expired rows only; every stamping method takes an explicit `now` (a frozen clock produces identical rows). Amended 2026-10-06 (Phase E5): the argon2id read-back lives in `packages/server/test/rest-auth.test.ts`. The server hashes (`hash-wasm`); persist stores the PHC string opaquely, and `auth.test.ts` asserts it round-trips. <!-- amended 2026-10-06: Phase E5 --> |

### 50.4.5 `@ewa/server` — `packages/server/test/`

Server tests boot `@colyseus/core` in-process with the PGlite-backed repos and connect with `@colyseus/sdk` `Client` over a local WebSocket transport.

| File | Asserts |
|---|---|
| `authority.test.ts` | The adversarial suite. Before each case, snapshot `canonicalJson` of the attacker's rows in `players`, `creature_instances`, `inventory_items`, `badges`, `story_flags`, `dex_entries`, `quest_progress`, `battle_pass`; after, assert byte-identical unless the case says otherwise. Cases: **A1** `progressionDelta` / `inventoryDelta` / `battleEnd` shaped payloads sent as client messages → no reply (no handler), `metrics.unknownMessages + 1`, the 5th within 10 s disconnects with code 4003 (spine §4.3); **A2** `battleAction` for a battle the client is not seated in → `notFound` (identical to a missing id, §30.4.2); **A3** `battleAction` with a move not in the active creature's `moves` → `notAllowed`, turn not advanced; **A4** `battleAction` with `turn` ≠ the collecting turn → `notAllowed 'wrongTurn'`; **A5** `engageSpawn` for a spawn > 3 m away → `notAllowed 'tooFar'`, for a spawn outside the 3×3 → `notFound`; **A6** `interact { kind: 'gym' }` without a win → no badge row; **A7** `POST /creature/:id/evolve` without `evolveReady` → 4xx, species unchanged; **A8** `POST /item/use` for an item at qty 0 → 409 `InsufficientItems`; **A9** `POST /shop/buy` with `money < price` → 409 `InsufficientFunds`; **A10** `POST /battle-pass/claim` above `trainerLevel` → 4xx; **A11** `POST /creature/:id/moves` with a move above level → 4xx; **A12** catching by sending `battleAction { kind: 'catch' }` in a `trainer` format battle → `validateAction` `cannotCatch`; **A13** 200 `input` messages in one second → 170 dropped with one `rateLimited`; **A14** a second socket with the same JWT → one `PlayerState`, the older socket closed with 4101 (`CLOSE_CODES.replaced`; amended 2026-09-25 — 4001 is Colyseus' `SERVER_SHUTDOWN`); **A15** an `input` teleport of 64 units in one `dtMs 50` → position unchanged, `seq` echoed against the unchanged pose, **no error message** (§30.2.4: rejection is silent, 30 in 10 s → kick 4003); **A16** a *legitimate* wild win changes exactly `players.trainer_exp` (+10), `dex_entries`, `creature_instances.exp/level/hp` — the positive control that proves the snapshots would detect a write; **A17** `interact` on a story-beat `speaker` whose beat's `need` is unmet → no `storyBeat` message, no `story_flags` row (§30.4.8); **A18** `interact { kind: 'static' }` without the gate flag, or after the static's own flag is held → `notAllowed`, no battle; **A19** `handoverAck` to a room the player never reserved → join refused (`badHandover`), no position write; **A20** `POST /zone/enter` for a gated zone without the badge → 403 `gated`, no seat; **A21** `POST /matchmake/joinOrCreate/zone` or `/matchmake/create/zone` called directly with a valid token (any `zoneId`/`shard`) → refused `noTicket`, no room created, no avatar; **A22** `POST /zone/enter` for an ungated zone that is not the player's current zone → 409 `wrongZone`, no seat, no position write; **A23** `POST /marketplace/list` of a creature during a live battle → 409 `inBattle`; **A24** `interact` on a story-battle `TrainerDef` whose beat is not eligible → no `battleStart`, no money, no `trainer:<id>:beaten` (§30.4.8 rule 6). <!-- reconciled 2026-09-18: A1/A2/A4/A5/A15 aligned with 30-server-netcode.md; A17–A20 added --> <!-- amended 2026-09-25: A21–A24 added (30-server-netcode.md §30.5.1 #26–#28, §30.4.8 rule 6) --> |
| `aoi-fanout.test.ts` | N ∈ {50, 100, 200} bot clients placed on a uniform grid across `mire_route`'s playable interior (±104, spine §3.1; 6.5 × 6.5 AOI cells of 32 units), each moving 0.30 m per 45 ms running input (6.7 m/s) along its row and bouncing off unwalkable samples — the earlier "1 unit per tick" is 20 m/s, a `speed` reject under §30.2.4's 8.05 m/s cap (amended 2026-09-25, server IMPLEMENTATION-NOTES "aoi-fanout.test.ts deviations"). Over 10 s at 20 Hz: per-client `PlayerState` patches received ≤ (bots in its 3 × 3 cells) × 200 + 10 % ; total patches ≤ 0.3 × (20 · N · (N − 1)); the quadratic model's figure is printed beside the measured one. Also: a bot crossing a cell boundary receives `add` for exactly the new column of 3 cells and `remove` for the old; a bot leaving (`onLeave`) triggers `view.dispose()` (spied) and is removed from every other view before `players.delete`. |
| `movement.test.ts` | Speed cap: an `input` whose displacement exceeds `RUN_SPEED × 1.15 × dtMs` (+ 0.02 m) is rejected with `speed`, the avatar does not move and `seq` **is** echoed against the unchanged pose (the client snaps); the heightfield: an `input` onto a `walkable = 0` sample, or whose segment crosses one at 0.25 m sampling, → `unwalkable`; the dt budget: accepted `dtMs` can exceed real elapsed time by at most 100 ms (`BUDGET_MIN_MS`), so `dtMs 100` every 33 ms is rejected from the 4th input; a `seq ≤ lastSeq` is dropped silently; a `water`-only sample is accepted only with `HM Surf` in inventory; a position outside `playableBounds` → `bounds`. <!-- reconciled 2026-09-18: matches §30.2.4 --> |
| `spawn-director.test.ts` | Driven with synthetic `now`: reaches `targetCount` (14 / 4 / 6 by zone kind — `ROUTE_TUNING`/`TOWN_SPAWN_TUNING`/`STORY_TUNING` from content), never exceeds it, one spawn per tick at most; the same `(seed, zone)` reproduces the same spawn sequence; `ability` is one of `species.abilities`; a `'water'` slot lands on a `water` sample; night-only slots never roll in `[0.25, 0.75)`; engagement extends `despawnAt`; a 100 000-roll sample matches the weights ±1.5 pp. |
| `story-beats.test.ts` | With an in-process room: `interact` on `mirevale.wynn` with no flags → `storyBeat start` then `complete`, `story_flags` gains `met_wynn` and `beat:first_witness:done`, `progressionDelta.flags` sent; a second `interact` → plain NPC (nothing); a battle beat (`mire_rival`) completes only after the win; a `harvest` beat changes `harvestStateFor` for that player only (`ZoneState.harvestState` unchanged, a second player's `harvestStateFor` unchanged). |
| `battle-room.test.ts` | `battleStart` carries `stateDigest === digestBattleState(state)`; each `battleEvents` digest matches a client-side `resolveTurn` preview over 50 seeded wild battles (desync counter 0); NPC side passes `null` and the server never calls `chooseNpcAction` itself; a `battleResync` request returns the current state with a matching digest; rewards on `battleEnd` equal `RewardsSummary` derived from `TRAINER_EXP` and `expGain`. |
| `handover.test.ts` | Crossing within 6 units of a link side's playable edge (`playableBounds`, amended 2026-09-25) emits `handover`; `handoverAck` at the destination marks presence; the source removes the avatar on IPC confirm or after 5 s; the position row is written once, by the destination. |
| `challenge-trade.test.ts` | Challenge handshake re-checks presence before `createBattle`; a challenge to a player who left → `challengeResult { result: 'unavailable' }`; 45 s TTL expiry; trade `offerHash` is `fnv1a32` of the canonical pair of offers and a changed offer resets both `confirmed` flags. |
| `rest-auth.test.ts` | Register → login → refresh → logout; access token expiry 15 min (`exp − iat === 900`); refresh 30 d; a revoked refresh fails; every bearer route returns 401 without a token; admin routes return 403 without `is_admin`. |
| `raid.test.ts` | Boss `hpPct` is the only HP the client sees; phase transitions 0→1→2 (`hpPct < 0.3`)→3→4; `raidEvents` carry digests; the catch window accepts one `raidCatch` per player. |

### 50.4.6 `@ewa/render` — `packages/render/test/` (Playwright, Chromium with WebGPU)

| File | Asserts |
|---|---|
| `leak.spec.ts` | Capture `BudgetCounts` as baseline right after `createRenderer` resolves (§50.1.9); load `mirevale`, unload, repeat 50 times for `mirevale` and 50 for `mire_route`; after **every** unload `geometries`, `textures`, `texturesSize`, `programs`, `renderTargets`, `attributes`, `attributesSize` equal baseline exactly (`programs` constant proves no material graph appeared during a load, `10-render.md` §10.5.9); after the 100th cycle, `renderer.info.memory.total` equals baseline. Runs in CI under SwiftShader. |
| `budget.spec.ts` | Runs `harness:budget` on the slice zones and asserts every §50.2.2 count cap, including `renderTargets ≤ 41` and `programs ≤ 128` (`10-render.md` §10.10.2; amended 2026-09-25 — the earlier "steady state of 20" was measured 34) and texture bytes from `RenderStats.textureBytes`; asserts §50.2.1 milliseconds only when `--budget-ms 1` (reference machine). |
| `pillars.spec.ts` | Pillar 1: the `mask` MRT reads 1.0 over the player billboard; a prop 12 units off the focal plane has CoC ≥ 3 px. Pillar 4/night (legacy-render-audit Q7): at `timeOfDay 0.05` ground luminance directly under a lantern ≥ 4× the ground 10 units away (legacy ratio 1.0). Shadow reach (Q5): with the 4 cascades at 14 / 34 / 72 / 160 m the far cascade's texel is `(160 − 72) / 2048 = 4.3 cm` ≤ 8 cm, and a caster placed 120 units from the camera produces a non-empty footprint in cascade 4. Pillar 5: noon vs dusk light set differ by ≥ 12 % mean luminance over the opaque billboard pixels; shadow-map footprint non-empty. Pillar 6: the scene pass `output` MRT (pre-TRAA) at 1.3× shows no intermediate alpha along a 200-pixel straight edge. Pillar 7 (Q29): zone root never removed during a scripted battle; battle camera within 40 units; the zone's `lights[]` list in `dumpZone()` is identical before and during the battle (the 2 arena beacons are the reserved slots). Pillar 8: reduced effects → 600 frames with zero shake and zero `timeScale ≠ 1`. Bloom gap (Q9): in shot 1's beauty target the brightest non-emissive pixel ≤ 1.15 and the brightest creature-emissive pixel ≥ 1.35 scene-linear. <!-- reconciled 2026-09-18: 10-render.md OQ 4 + legacy audit Q5/Q7/Q9/Q29 --> |
| `harvest.spec.ts` | `HarvestLevel` uniform 0 → three maps, punctual lights, lit sprites present; level 2 → the audit's pillar rules 2–5 *fail on purpose* and the harness asserts exactly that (the degraded look is a uniform, so `dumpZone()` reports the same material classes with `harvestLevel: 2`). |
| `post-graph.test.ts` (vitest, node, mocked `three/tsl`) | `buildPostGraph` produces the node order of `10-render.md` §10.8.1 (GTAO → TRAA → bloom → DOF → chroma → ACES → grade → vignette → grain → output) with the stated parameters (GTAO radius 0.9 / 16 spp / half res, bloom 0.35 / 0.6 / 1.15, DOF tilt 24° / 6 m / 6 px, vignette 0.22, grain 0.035); with each `EffectsFlags` member false the corresponding node is absent from the graph, not zeroed (legacy-render-audit Q8). |
| `camera-constants.test.ts` (vitest, node) | `camera/rig.ts` exports exactly the §10.7.1 table (`FOV_V 28`, `PITCH −52`, `YAW_BASE −35`, `DISTANCE [20, 26, 34]`, `SPRING_TAU 0.12`, `DEAD_ZONE 0.8`, `HEADING_TURN_MS 320`, `ZOOM_MS 260`) and the camera position formula reproduces height 20.49 m / offset 16.01 m at stop 1; a grep of `camera/*.ts` finds no other numeric literal outside that table and the arena constants of §10.7.4 (legacy-render-audit Q11: solved, not tuned). |
| `collider.test.ts` (vitest, node) | For 10 000 prng points over `dist/heightfields/mirevale.json`, `TerrainCollider.sample` equals content's `sampleHeight` to 1e-6, `walkable`/`water` equal `isWalkable`/`isWater` exactly; `resolveMove` never returns an unwalkable position over 10 000 random displacements. |
| `prng.test.ts` (vitest, node) | Render's sfc32 copy reproduces `packages/core/test/rng.test.ts`'s committed constant for `createPrng(12345).int(1000)`. |
| `dispose-contract.test.ts` (vitest, node) | Every builder in `@ewa/render` returns an object with `dispose()`; calling it twice is a no-op; a `Material`/`Texture` obtained from the shared library is never `dispose()`d directly (a spy on `Texture.prototype.dispose` counts calls during a builder's `dispose`). Pure-logic parts of render (`layout`, `lod`, `descriptors`) are tested in node without a GPU. |

`tools/asset-audit` (`pnpm audit:assets`, reads `ZoneDump` JSON written by `harness:budget --dump`) rules, each failing the build, named exactly as `40-pipelines.md` §40.5.2 implements them: `budget.counts.*` (§50.2.2), `materials.count ≤ 48`, `materials.threeMaps` (exempt by class: `billboard`, `impostor`, `decal`, `character`, and `harvestLevel ≥ 1`), `materials.albedoCeiling` (every surface's bake reports `albedoClampedPct`), `textures.ktx2Only` (no `CanvasTexture`, no PNG albedo on a lit material; `billboard` WebP and `character` vertex colour exempt by class), `geometry.noPrimitives`, `geometry.noOutlineShells` (no BackSide scaled clone sharing a geometry — legacy-render-audit Q4), `scatter.instanced` (every scatter kind an `InstancedMesh`; trees with lod0–lod2 + impostor, other kinds with the tiers they are drawn at, ≥ lod0 + lod1 — Q19; amended 2026-09-30, P4-C1), `lights.housing (≤ 0.6 units, both directions: every light has a housing and every `lightSource`-tagged emissive has a light)`, `lights.count (8 / 24)`, `sprites.nearest`, `shadows.drawCalls ≤ 564`, `harvest.same`. Test: `tools/asset-audit/test/rules.test.ts` feeds one violating fixture per rule and asserts the rule name in the error. <!-- reconciled 2026-09-18: rule list unified with 40-pipelines.md and extended for the legacy audit -->

### 50.4.7 `@ewa/client` — `packages/client/test/`

| File | Asserts |
|---|---|
| `routes.test.ts` (vitest, `jsdom`, React Testing Library) | Every route in `routes` exported by `packages/client/src/app/router.tsx` (`20-client.md` §20.1.1) renders under `createMemoryRouter` with a mocked store and no thrown error; an unknown path redirects to `/play`; back navigation from each route restores the previous URL; no route mounts a `WebGPURenderer` in jsdom (the world view is behind a capability check that the test forces to `false`); the canvas host is a pathless layout above `/play` and survives a child loader error (rule 1). <!-- reconciled 2026-09-18: path per 20-client.md --> |
| `timeline.test.ts` | `buildTimeline(events, ctx)`: the 35 `BattleEvent` kinds each map to ≥ 1 keyframe; every turn of the 1 000 fuzz battles builds a sorted timeline ending in `end` with `durationMs ≤ 9 000`; a fixture of 40 events → a snapshot of keyframe `at`/durations committed in the test; total duration of a `damage` with `crit` is longer than without by the slow-mo amount; with `ctx.reduced` every `shake`/`time`/`chroma` frame is absent and the sequence of other frames is identical; a `hp` frame's target equals `hpAfter / maxHp`, never a client computation; every `vfx.id` ∈ `VFX_IDS` (47), every `pose` ∈ render's `BattlerPose`, every `camera.shot` ∈ `CameraRig.cue` kinds; `MOVE_ANIMS` has ≥ 40 entries and `DEFAULT_BY_TYPE` all 19. |
| `store.test.ts` | Applying `progressionDelta`/`inventoryDelta` updates exactly the named slices; applying a `battleEvents` message updates no progression slice; the two delta reducers are the only writers (a `Proxy` on the store state records writers per action); `harvestStateFor` is re-evaluated when `flags` change and `SceneDirector.setHarvest` is called once. |
| `prediction.test.ts` | Input → predicted position; a `PlayerState` with `seq` equal to the last applied input reconciles with zero correction when the server agrees and re-simulates pending inputs when it does not; the `20-client.md` §20.4.5 harness: 2 000 random inputs through client `stepMovement` and a mirrored server loop with 80–200 ms simulated latency and 2 % loss → final positions within 0.01 u, no reconcile > 4.0 u; remote interpolation never extrapolates past 100 ms, and a 100 ms jitter injection on the snapshot stream produces no positional reversal (legacy-render-audit Q26). |
| `no-exp-smoothing.test.ts` | Greps `src/scene/**` for `pos += (target − pos) · k`-shaped assignments to `x`/`z` and fails on a hit (`20-client.md` §20.4.6). |
| `perf/tick.test.ts`, `perf/alloc.test.ts` (vitest, node `--expose-gc`) | §20.10.1: 600-frame headless run with 48 remotes and a battle turn playing, client-owned total ≤ 1.5 ms p95; §20.10.2 rule 2: heap growth ≤ 64 KB between forced GCs over 600 steps and zero `new`/`[]`/`{}`/`.map(`/`.filter(`/`...` in `step|sample|flush|reconcile` bodies without an `// alloc-ok:` reason (≤ 3 per file). |
| `hud-dirty.test.ts` | 600 idle frames → 0 `hud.set` calls; walking → ≤ 2 per second + nameplates at 2 Hz (§20.10.2 rule 3). |
| `no-client-badge.test.ts`, `design-system.test.ts` | §50.1.13 and §50.1.14 as stated; `design-system.test.ts` additionally asserts no `font-size` below 12 px (`--t-caption`) anywhere and body text at `--t-body` 14 px (legacy-render-audit Q30), every `--motion-*` ≤ 400 ms and `0ms` under `[data-reduced="1"]`, and that no route transition blocks input (Q31: `useBlocker` appears only in `BattleOverlay` and `TradeModal`). |
| `no-getimagedata.test.ts` | `packages/client/src` and `packages/render/src` contain no `getImageData`, no `putImageData` and no per-pixel loop over a sprite; the billboard material exposes the 4 variant uniforms (`hueShift`, `satMul`, `lightMul`, `alphaGlow`) — legacy-render-audit Q28. Amended 2026-10-06 (Phase E5): there is one allow-listed `putImageData` / `createImageData` writer, `client/src/world/minimapDraw.ts` (Phase C3). It paints the minimap base from the heightfield once per zone, reads no pixel and touches no sprite. The test also pins the HUD layer and the minimap as the only 2D contexts. The variant check runs at runtime: every variant uses one material per atlas, with the 4 values as per-object scalars. <!-- amended 2026-10-06: Phase E5 --> |
| `fuzz-browser.spec.ts` (Playwright) | Runs `fuzzBattles({ seeds: 1000 })` in a Web Worker and compares all 1000 digests with `packages/core/test/fuzz-digests.json`; rebuilds all 21 heightfields in the same worker and compares digests with `dist/content-report.json`. This is `PLAN.md`'s M0 exit criterion. |
| `dof-mask.spec.ts`, `reduced-effects.spec.ts`, `alloc.spec.ts`, `readability.spec.ts` (Playwright) | §50.1.7, §50.1.8, §50.1.10, §50.1.15 as stated. Amended 2026-10-06 (Phase E5), `dof-mask.spec.ts`: "over the billboard's screen rect" means over the subject's *visible silhouette* inside that rect, because the rect also holds background. The silhouette is the set of pixels that follow the subject's DOF-sharp bit when two re-renders of the frame force it to 1 and to 0; both re-renders reuse the frame's TRAA jitter offset, and the set is eroded by 1 px. The 600 frames are 300 overworld frames on the player's figure and 300 frames of the scripted `mire_route` battle on both active battlers. The page is `test/dof-mask/`, the offline HarnessWorld. <!-- amended 2026-10-06: Phase E5 --> |
| `no-dom-in-frame.spec.ts` (Playwright) | A `MutationObserver` on `document.body` during 10 s of overworld play with a static HUD records 0 mutations; walking and chatting record mutations only from the chat input and toasts (legacy-render-audit Q15 / A-3). Amended 2026-10-06 (Phase E5): the static-HUD window starts after two things finish: the arrival toasts expire, and the background shader-compile pill (`WorldBoot`, a loading surface) is gone. The Phase D12 tutorial card is skipped first, because it advances on events, not frames. <!-- amended 2026-10-06: Phase E5 --> |
| `first-frame.spec.ts` (Playwright, throttled to 50 Mbit/s, cold cache) | `performance.mark('ewa:first-frame')` ≤ 2 500 ms from navigation start on `mirevale`; phase payloads ≤ §20.10.3's bytes (`field` materials ≤ 6 MB, atlases + singles + GLB ≤ 4 MB); the `hero` tier and audio are not awaited before the mark (Q17). Amended 2026-10-06 (Phase E5): "not awaited" is proved by holding every hero-tier and audio request unanswered until the mark lands. As in `handover-hitch.spec.ts`, the 2 500 ms limit is asserted only with `EWA_REFERENCE_GPU=1`; elsewhere the time is annotated. On the dev iGPU it measured about 46–48 s, dominated by the synchronous shader warm-up (a HANDOFF open issue). <!-- amended 2026-10-06: Phase E5 --> |
| `handover-hitch.spec.ts` (Playwright, two zones) | Crossing `mirevale → mire_route` with `mire_route` preloaded: no frame > 33 ms, no full-screen fade, first destination frame ≤ 250 ms after `handoverAck`; non-preloaded ≤ 1 500 ms (§20.10.3, spine §4.6; legacy-render-audit Q16). Amended 2026-10-06 (Phase E3): the spec runs the capture harness page (`/harness/shots?zone=mirevale&bg=1`, background compile on as in the client), crosses with `__ewaHarness.handover(to, { preload })`, and records every requestAnimationFrame gap. The millisecond limits are asserted only with `EWA_REFERENCE_GPU=1`, on the §50.2 reference machine. Elsewhere the numbers are attached and annotated, and the zone change, the destination frame and the absence of a fade are asserted. <!-- amended 2026-10-06: Phase E3 --> |
| `slice-e2e.spec.ts` (Playwright, two browser contexts) | Two players: register, `POST /zone/enter` + join, meet in `mirevale` (each sees the other's `PlayerState`), chat (`chat` variant received by the neighbour only), trade one creature (rows swap owners), challenge and complete a PvP battle (rating rows change with opposite signs), one clears `verdant_gym` and receives `progressionDelta.badges` containing `bloom`; the first player's `interact` on `mirevale.wynn` yields `storyBeat start/complete` and `met_wynn`. Status 2026-10-06 (Phase E5): the file exists and covers register (form), join, meet, chat, the `mirevale.wynn` beat (`met_wynn`), and a gym-hall trainer battle up to move selection. The trade, the PvP battle and the `verdant_gym` clear are *not yet driven* in the browser, so this row still stands. <!-- Phase E5 --> |

### 50.4.8 Pipelines — `tools/*/test/`

| File | Asserts |
|---|---|
| `tools/sprite-pipeline/test/determinism.test.ts` | `runBuild` twice over a 6-species fixture set with `--force` on the second run: byte-identical WebP atlases and mip files, thumbs, `creatures.manifest.json`, `qa-report.json`; a third run without `--force` reports `cacheHits === 12` (6 species × 2 sides). <!-- reconciled 2026-09-18: 40-pipelines.md §40.1.7 --> |
| `tools/sprite-pipeline/test/stages.test.ts` | Alpha recovery: a fixture with a white background yields an alpha channel with ≥ 99 % of border pixels at 0 and transparent RGB within 2 px of an edge equal to the nearest opaque RGB; normalize: a 300×480 input becomes 1024² with the foot line at `round((1 − footV) × 1024) = 942` (±1 texel, `footV 0.08` from the bottom); resample on integer factors uses nearest (a 2-colour checker stays 2 colours); normal map: a flat input yields (128,128,255) ±1 and the 6 px bevel band tilts outward; emissive mask: a fixture with one saturated bright region yields a two-valued mask covering that region and nothing else; multiframe sources decode the `frame-select.json` page. |
| `tools/sprite-pipeline/test/encoding.test.ts` | The seven acceptance tests of `40-pipelines.md` §40.1.6.4 **as amended 2026-09-24**: alpha byte-exact on every map; lossless emissive bit-identical on a hard-edge crop; lossy albedo per sprite whole-cell PSNR ≥ 30 dB and worst-edge-crop PSNR ≥ 26 dB, edge share ≤ 50 %, interior ≤ 15 %, set medians PSNR ≥ 35 dB / edge ≤ 25 % / interior ≤ 3 %, worst-edge-crop luma error ≤ 40; half-res normal mean angular error ≤ 6° (≤ 12° in the bevel band), flat region (128,128,255) ± 2 for ≥ 80 % of its texels and never beyond ± 12; mip coverage within 1 % per level; transparent-RGB band mean luma error ≤ 35 per atlas. <!-- amended 2026-09-25: this row still carried the pre-2026-09-24 thresholds (36 dB, 18 %, 2 %, 24, ± 2, ± 12), contradicting §40.1.6.4 --> |
| `tools/sprite-pipeline/test/qa-flags.test.ts` | Flags with their §40.1.3 classes: `clipped`, `nonsquare`, `multiframe` (informational), `coverage` (review), `leak`, `empty`, `fallback-source`, `missing-side` (must be resolved), `sidemismatch` (front/back `pixelScale` differ by > 20 %, informational); each flag names the species and side; `excluded[]` lists the 4 alternate-style files with `reason: 'alternate-style'`; `accepted[]` carries a reason per entry; a clean fixture yields no non-informational flag. Release rule for M1: no flag that is non-informational and not accepted. <!-- reconciled 2026-09-18: was "flagged must be empty" --> |
| `tools/sprite-pipeline/test/budget.test.ts` | `manifest.totalBytes ≤ 36 700 160` (35 MB); `Object.keys(manifest.sprites)` equals the 130 content species ids; `atlases.length ≤ 68` (65 + ≤ 3 dup), occupied cells `= 260 + 2 × duplicated`, `zones[z].length ≤ 8` for all 21 zones and every zone key present; every sprite has `front`/`back` with `uv` consistent with `px`, `footV === 0.08`, `aspect 1`, a `home` atlas and a `thumb` ≤ 6 KB. |
| `tools/model-pipeline/test/{determinism,budget}.test.ts` | Two `writeBinary` runs byte-identical; legendary LOD0 ≤ 1.2 MB, LOD1 ≤ 0.45 MB, 4 legendaries ≤ 6.5 MB; each look ≤ 0.25 MB, the 19 looks (`@ewa/content` `LOOKS`; amended 2026-09-25, was 20) ≤ 5.0 MB, `public/models/` ≤ 12 MB; every GLB carries `EXT_meshopt_compression`; every legendary texture is KTX2 (`textures: 'ktx2'`), looks have `textures: 'none'`; kept clips are exactly `idle walk run victory defeat sitdown standup`; `CREDITS.txt` present (legacy-render-audit Q18). |
| `tools/material-bake/test/{determinism,budget,seam}.test.ts` | Two bakes byte-identical; per map `field` ≤ 0.10 MB and `hero` ≤ 0.40 MB, `hero` surfaces ≤ 50, `public/materials/` ≤ 90 MB; every `SURFACES` id has a recipe and vice versa; `repeat` surfaces seam ≤ 2/255; albedo luminance ≤ 0.85 with `albedoClampedPct ≤ 5`; every map is KTX2 UASTC with a full mip chain. |
| `tools/asset-audit/test/rules.test.ts` | As §50.4.6 (one violating fixture per rule, rule id in the error); `--bytes` roll-up fails on any §40.6 ceiling; `--baseline` regression at +5 %. |
| `tools/audio-pipeline/test/plan.test.ts` | `plan` produces one job per entry in `.design/audio/manifest.json` (17 themes × 4 stems + 11 ambiences + every sfx variant) and validates `zoneThemes` against `ZONE_ORDER`; loop-point detection on a synthetic 4-bar 120 bpm fixture returns `L` within ±5 ms of 8.000 s; normalization to −16 LUFS ±1; the generator step is skipped with the exact message of §40.4.2 when `EWA_AUDIO_API_KEY` is unset; `process` output deterministic after deleting `builtAt`; total ≤ 80 MB. |

---

## §50.5 DEFINITION OF DONE

A milestone is done when every box is ticked by the command beside it, run from the repo root, exiting 0. Browser steps are performed in the Browser pane and the shot files committed under `.screenshots/audit/M<n>/`.

### M0 — Foundation

- [ ] `pnpm install --frozen-lockfile && pnpm check` passes on Node 22 and 24 (CI matrix in `ci.yml`).
- [ ] `pnpm test:lint-rules` passes; `eslint/local-rules.test.js` covers `no-external-imports`, `no-unordered-iteration`, `no-cross-package-relative-imports`.
- [ ] `pnpm vitest run packages/core` — all §50.4.1 files present and green; `fuzz.test.ts` ≤ 40 s; `test/fuzz-digests.json` committed with 1000 entries.
- [ ] `pnpm vitest run packages/content` — all §50.4.2 files green; `pnpm --filter @ewa/content validate` exits 0 and writes `dist/content-report.json` with `roster.obtainable: 130`, 21 heightfield digests and `dist/heightfields/*.json`.
- [ ] `pnpm vitest run packages/protocol` — §50.4.3 green.
- [ ] `pnpm vitest run packages/persist` — §50.4.4 PGlite files green; `pnpm db:generate` produces no diff (schema and migrations agree); `pnpm db:migrate` on an empty `DATABASE_URL` database succeeds.
- [ ] `@playwright/test` installed; `pnpm exec playwright test packages/client/test/fuzz-browser.spec.ts` compares 1000/1000 digests — **the `PLAN.md` M0 exit criterion**.
- [ ] `.design/spec/CHANGELOG.md` exists with the entry that created this file.

### M1 — Sprite and asset pipeline

- [ ] `pnpm sprites` completes over the 130 species' source files (after the `yaschamp` back rename; the 4 alternate-style files listed under `excluded`); `pnpm --filter @ewa/sprite-pipeline qa` writes `tools/sprite-pipeline/qa/qa-report.json` with no non-informational, non-accepted flag, and `contact-sheet.png`.
- [ ] `pnpm vitest run tools/sprite-pipeline` — §50.4.8 green, including `budget.test.ts` (≤ 35 MB) and `encoding.test.ts`.
- [ ] `pnpm models` and `pnpm materials` complete; `pnpm vitest run tools/model-pipeline tools/material-bake` green (§50.4.8).
- [ ] Browser step: open `contact-sheet.png`; for every species, front and back stand on the same ground line and no white/chroma residue is visible. Record the check as a dated line in the M1 audit file.
- [ ] `pnpm vitest run tools/asset-audit` green; `pnpm audit:assets -- --dump fixtures/empty-zone.json` exits 0; `pnpm audit:assets -- --bytes` exits 0 against §40.6.

### M2 — The vertical slice (the gate)

- [ ] `pnpm --filter @ewa/client harness:budget -- --zone mirevale --shots all --budget-ms 1` and the same for `mire_route` pass on the reference machine; JSON committed under `.screenshots/budget/`.
- [ ] `pnpm audit:assets -- --dump .screenshots/budget/mirevale.dump.json` and `…/mire_route.dump.json` exit 0 (every rule in §50.4.6).
- [ ] `pnpm exec playwright test packages/render/test` — `leak.spec.ts` (100 cycles, exact baseline), `pillars.spec.ts` (all 8 pillar tests plus the night-ratio, shadow-reach, bloom-gap and light-list assertions), `harvest.spec.ts`, `budget.spec.ts` green; `pnpm vitest run packages/render` — `post-graph`, `camera-constants`, `collider`, `prng`, `dispose-contract` green.
- [ ] `pnpm exec playwright test packages/client/test` — `dof-mask`, `reduced-effects`, `alloc`, `readability`, `no-dom-in-frame`, `first-frame`, `handover-hitch`, `slice-e2e` green.
- [ ] `pnpm vitest run packages/server` — `authority.test.ts` (A1–A20), `aoi-fanout.test.ts` at N = 50/100/200, `movement`, `spawn-director`, `story-beats`, `battle-room`, `handover`, `challenge-trade`, `rest-auth` green.
- [ ] `pnpm vitest run packages/client` — `routes`, `timeline`, `store`, `prediction`, `no-exp-smoothing`, `perf/tick`, `perf/alloc`, `hud-dirty`, `no-client-badge`, `no-getimagedata`, `design-system` green.
- [ ] `pnpm --filter @ewa/client harness:shots -- --zone mirevale --set M2` writes the 6 shots of §50.6; the hostile audit `.design/audits/M2-render-audit.md` is written and every finding is either answered in a SPEC section (with a §50.7 entry) or listed as accepted with a reason.
- [ ] Browser step, two Browser-pane tabs, two accounts: meet in Mirevale, chat, trade, battle, one clears Grove-Keeper Mira. The same flow `slice-e2e.spec.ts` automates, performed by a person once and recorded with the six shots.
- [ ] Act I opening plays from `STORY` with the `starter` beat; `validate.ts` still passes with the story data present.

### M3 — World rollout

- [ ] `pnpm --filter @ewa/content validate` with all 21 zones authored; `coverage.test.ts` prints 130 paths; `families.test.ts` 67/67; `gates-reachable.test.ts` 0..8 badges.
- [ ] `harness:budget --budget-ms 1` passes for each of the 21 zone ids on the reference machine (21 JSON files committed); `audit:assets` exits 0 for each dump.
- [ ] `leak.spec.ts` extended to all 21 zones × 10 cycles, exact baseline.
- [ ] `harness:shots --set M3` for every zone (6 shots each, 126 files) and `.design/audits/M3-render-audit.md` written and answered.
- [ ] `pnpm vitest run packages/server/test/battle-room.test.ts` extended with one seeded league battle per `LEAGUE` entry (12), desync counter 0.
- [x] Browser step: an account walks `mirevale → the_rift` following gates, clears all 12 league trainers; `GET /me` shows 8 badges and `flags` containing the champion flag set by `zeon`. <!-- 2026-10-06: met headless by `pnpm test:progression` (packages/server/test/progression-act{1,2,3a,3b,3c}.test.ts, real rooms + movement + battles, 0 desyncs; act3c asserts GET /me) — the walker drives the server the browser drives -->

### M4 — Systems

- [ ] `market-concurrency.test.ts` and `trade.test.ts` pass against Postgres (`DATABASE_URL` set) in the nightly workflow; the nightly job is added to `ci.yml` with a `postgres:16` service.
- [ ] `raid.test.ts`, guild routes in `rest-auth.test.ts`, battle-pass claim/mythical-choice in `authority.test.ts` (A10 plus a positive control at level 50) green.
- [ ] `aoi-fanout.test.ts` at N = 200 with a live `RaidState` broadcast: per-client raid patches ≤ 20/s regardless of N.
- [ ] Browser step: list a creature, bid from a second account, buy-now from a third; `GET /marketplace/:id` shows the bid trail; the seller's money increases by `price − 5 %`.
- [ ] Quests: `story.test.ts` and `coverage.test.ts` still pass with quest rewards granting `lumyth`/`noxmyth` paths.

### M5 — Audio, polish, launch

- [ ] `pnpm --filter @ewa/audio-pipeline plan` lists every manifest entry; `generate` runs with the user-supplied key; `pnpm vitest run tools/audio-pipeline` green; every zone theme has a detected loop point.
- [ ] `harness:budget --budget-ms 1` re-run for all 21 zones with audio playing and the HUD live; every JSON re-committed; no row over target.
- [ ] `pnpm exec playwright test` — the entire browser suite green on the reference machine; `pnpm check` green in CI.
- [ ] Accessibility pass: `reduced-effects.spec.ts` extended to every zone's audit shot 5 (battle); the client's font sizes ≥ 12 CSS px for captions and ≥ 14 CSS px for running text at 1440p asserted in `design-system.test.ts` (`20-client.md` §20.2.2 minimums). <!-- reconciled 2026-09-18: was "≥ 14" for everything -->
- [ ] `.design/audits/M5-render-audit.md` written and answered; `.design/spec/CHANGELOG.md` has the release entry.
- [ ] Deploy: `GET /health` returns `{ status: 'ok' }` from the deployed origin; `slice-e2e.spec.ts` run once against it with `EWA_BASE_URL` set.

---

## §50.6 HOSTILE RENDER AUDIT PROTOCOL

One audit per milestone from M2 onward: `.design/audits/M<n>-render-audit.md`. It attacks the *image*; the SPEC answers it. It is written by a reviewer who did not implement the render package for that milestone.

### 50.6.1 The six shots

Camera per pillar 1: vertical FOV 28°, pitch −52°, yaw one of four headings numbered as the rig numbers them (`10-render.md` §10.7.1: yaw −35° + 90°·k, camera at target + (sin yaw, cos yaw)·d): heading 0 looks toward −z (the camera stands south of the focus), 1 toward −x, 2 toward +z, 3 toward +x. <!-- amended 2026-09-30: the words "0 = +z forward, 1 = +x, 2 = −z, 3 = −x" were 180° from the rig; the rig's numbering is kept (at the Mirevale spawn heading 0 shows the player in front of the heart tree, the words' reading put the crown between camera and player) — M2 harness finding H1 --> Positions are anchors resolved by the harness from content and the zone layout; the resolved world `x, z` and the `layoutSeed` are printed in the shot's file name and in the audit header so a shot is reproducible from the committed data alone. Zoom is the default distance; `timeOfDay` is the `ZoneState` value.

| # | Id | Zone | Anchor (+ offset in world units) | Heading | timeOfDay | State |
|---|---|---|---|---|---|---|
| 1 | `spawn-noon` | `mirevale` | spawn `(0, 6)` | 0 | 0.50 | overworld, player idle |
| 2 | `gym-dusk` | `mirevale` | the `verdant_gym` door (zone `signature` set-piece) + `(0, +8)` | 2 | 0.80 | overworld, gym beacon lit |
| 3 | `sprite-edge` | `mire_route` | encounter table's first `common` slot spawn point + `(−2, +3)` | 1 | 0.50 | wild creature in frame at 1.3× magnification (camera zoomed one step in) |
| 4 | `lamps-night` | `mirevale` | shop door + `(+4, +6)` | 3 | 0.05 | overworld, night light set, ≥ 3 lamps in frame |
| 5 | `battle` | `mire_route` | player position at `battleStart` (spine `BattleSummary.x/z`) | as the battle camera | 0.50 | turn 2 of a scripted wild battle, HUD live, a `damage` cue mid-flight |
| 6 | `link-east` | `mirevale` | 6 units west of the `links.e` playable edge (x = 58) | 1 | 0.50 | overworld; the neighbouring zone streaming in must be visible |

Each shot is captured three times: full effects, reduced effects, and with the DOF mask visualised (mask as greyscale). 18 PNGs per zone per set. **From M3 on, every zone takes all six rows** (`harness:shots -- --set M3`, `harness:budget -- --set M3`), each anchored by its rule in that zone; where the zone lacks the row's subject the harness uses a recorded fallback (sidecar `anchor.rule` starts with `fallback:`): no gym → the zone's set-piece + 8 m past its keep-clear extent; no shop → the generated light nearest the spawn + (2, 3); no encounter table → the first `common` land slot of the first linked neighbour (e, w, n, s) that has one, the creature staged at spawn + (4, 3); no east link → the first other link, 6 m inside it, the heading turned to look at it. The `spawn-noon` row stands on the zone's arrival point (spine §3.1 `arrivalPoint`: Mirevale's spawn `(0, 6)`, so the M2 shots stand; a plaza-ring point in the other eight towns, whose `spawn` is on the west road with nothing of the town in frame; the spawn in routes and story zones; sidecar `anchor.rule` `arrivalPoint (plaza ring …)`) <!-- amended 2026-10-06: town arrival point -->. M2 keeps the table's own zones. <!-- amended 2026-10-06: Phase E1, the M3 shot set (client harness `shotTable.ts` `shotsForZone(zone, set)`, `anchors.ts` `fallbackAnchor`) --> Command: `pnpm --filter @ewa/client harness:shots -- --zone <id> --set M<n>`, writing `.screenshots/audit/M<n>/<zone>/<shotId>-<x>_<z>-<variant>.png`.

Amended 2026-10-06 (Phase E3, audit M2-sprite-edge-5 / M2-link-east-1):
- **Shot 3, the soft-pixel proof.** Shot 3 additionally runs the §50.1 #6 edge scan. The page puts the shot's wild creature in `stage.inspect` at noon. It then narrows the camera's vertical FOV (never the distance, never the sampler) until one level-0 texel covers ≥ 1.6 screen px: the stock 4 m inspector gives ≈ 1.1× on a 1024² frame at 900 px, and the table's "one zoom step in" gives ≈ 0.1×. The page draws the scene pass's `mask.y`, which the inspected billboard writes wherever its alpha test passed, pre-TRAA. The Node runner captures it (`<stem>-edgemask.png`) and checks 200 evenly sampled straight-edge pixels and their 3×3 neighbourhoods, plus every pixel of the billboard's rect, for values strictly between 0 and 255 (`src/harness/edgeScan.ts`; pixels are read in Node, never in the client runtime). It also captures the same frame's `output` MRT (`<stem>-output.png`). The sidecar's `edgeScan` records the magnification, the FOV, the counts and pass/fail.
- **Shot 6.** In shot 6, "the neighbouring zone" is the neighbour skirt of `10-render.md` §10.5.5: the linked zone's terrain and roads beyond the field edge. Its props and creatures appear at the handover.
- **The mask variants** sample the scene pass's MRT texture directly. They do not re-render the scene pass, which used to build a second, TRAA-less program for every visible material (+31 programs for the rest of a shots run). <!-- amended 2026-10-06: Phase E3 -->

### 50.6.2 What the reviewer must attack

For each shot, the audit has one paragraph per line below. A line with nothing to report says "none found" — it is never omitted.

1. **Flatness.** Any surface reading as one value with no normal response or roughness break. Name the material by the `ZoneDump` id.
2. **Primitive silhouettes.** Any box corner, cone tip or low-poly sphere visible. Name the object.
3. **Unmotivated light.** Any highlight or lit area with no visible housing in frame or plausibly just out of it. Name the light by `ZoneDump` id and give the housing distance.
4. **Billboard tells.** Any creature or NPC sprite that reads as pasted: missing contact shadow, missing shadow-map footprint, no rim, no response between shots 1 and 2's light sets.
5. **Soft pixels.** Any sprite edge with intermediate alpha in shot 3; any bilinear smear anywhere on a creature.
6. **DOF on the player or battler.** Any blur over the player in shots 1–4 and 6, or over either active battler in shot 5, read from the mask variant.
7. **Readability.** In shot 5: HP bars, type icons and the move-result text fully legible and unoccluded; bloom threshold between environment and creature peak (report both peak luminances from the readback).
8. **Night as a lighting change.** In shot 4: is the difference from shot 1 a change of light set and IBL (different shadow directions, lamp pools) or a multiply (same shadows, darker)?
9. **Budget honesty.** The shot's row from the `harness:budget` JSON, pasted: draw calls, triangles, texture bytes, materials, lights, `passMs`, total median/p95.

### 50.6.3 How findings are answered

Every finding gets an id `M<n>-<shot>-<k>` and exactly one of three answers, recorded in the audit file's "Answers" table by the render owner within the milestone:

- **Fixed** — a code change; the finding's shot is re-captured and the new file name recorded beside the old.
- **Spec** — the finding exposes a gap or an error in a SPEC section; the section is edited, a §50.7 CHANGELOG entry is written, and the entry id is recorded beside the finding.
- **Accepted** — the finding is true and stays; one sentence says why and which pillar or budget row it trades against. An accepted finding under lines 6 or 7 (DOF on a battler, readability) is not allowed: those are §50.1 non-negotiables.

The milestone is not done while any finding lacks an answer. The M2 audit is the gate `PLAN.md` describes: if its findings under lines 1–4 are not all *Fixed* or *Spec*, the spec is wrong and is fixed before M3 multiplies it by 21.

---

## §50.7 CHANGE CONTROL

1. `.design/SPEC.md` is generated from `.design/spec/*.md` by the reconciler and is never edited by hand.
2. Any edit to a file under `.design/spec/` requires an entry in `.design/spec/CHANGELOG.md` in the same commit, in this form:

   ```
   ## 2026-09-16 — 50-verification-budget.md §50.2.1 — shadows ceiling 2.6 → 2.8
   Why: M2 capture on RTX 3060 shows 4-cascade p95 at 2.7 ms with the slice's 8 casters.
   Evidence: .screenshots/budget/mirevale.json (commit <sha>), audit finding M2-lamps-night-3.
   Affects: packages/render/src/shadows.ts; tests: packages/render/test/budget.spec.ts.
   ```

   Date, file, section, one-line change; then `Why`, `Evidence`, `Affects`. Newest entry at the top.
3. Changes to `packages/core/test/fuzz-digests.json`, to any number in §50.2, to the §50.3 cut list, or to a verbatim TypeScript block in any section are SPEC changes and follow rule 2 even when the edit is one character.
4. CI enforces rule 2 mechanically: a step in `ci.yml` (`scripts/check-spec-changelog.mjs`) fails a pull request whose diff touches `.design/spec/*.md` or `fuzz-digests.json` without touching `.design/spec/CHANGELOG.md`, and fails if the newest CHANGELOG heading's date is not the current or previous UTC day.
5. The reconciler refuses to assemble `SPEC.md` when a lower-numbered section's TypeScript block is redefined by a higher-numbered one (same exported identifier, different text). `00-spine.md` wins; the higher section is the one edited. A **text-identical mirror** is allowed where the import graph forbids the import and the section says so (`10-render.md` mirrors `WeatherKind`, `VariantKey`, `TypeName`, `Terrain`, `Biome` because render imports only `three`; `10-render.md` restates `BudgetPass`/`BudgetProbe` from this file verbatim); the mirror carries a comment naming its source and `dispose-contract.test.ts`/`prng.test.ts`-style equality tests lock it. <!-- reconciled 2026-09-18 -->
6. A finding answered **Spec** in a §50.6 audit is the only route by which a pillar test in `00-spine.md` §1 may gain a test; none may be removed.

---

## §50.8 LEGACY AUDIT QUESTIONS → WHERE EACH IS ANSWERED

<!-- reconciled 2026-09-18: `.design/audits/legacy-render-audit.md` §7 asks 32 questions the SPEC must answer as tests; this table is the map. Q-numbers are the audit's -->
| Q | Test / rule | Stated value |
|---|---|---|
| 1 texture presence | `materials.threeMaps`, `textures.ktx2Only` (§50.4.6); `harvest.spec.ts` for the harvested exemption | 0 unmapped lit materials at `harvestLevel 0` |
| 2 material count | `materials.count` | ≤ 48 (slice ≤ 32) |
| 3 draw calls, measured | `budget.counts.drawCalls`, `shadows.drawCalls` reported separately | ≤ 400 beauty + post; shadow ≤ 564 |
| 4 outlines | `geometry.noOutlineShells` | 0 BackSide scaled clones; BackSide only on `sky` |
| 5 shadow reach | `pillars.spec.ts` shadow-reach | cascades 14 / 34 / 72 / 160 m at 2048²; far texel 4.3 cm ≤ 8 cm |
| 6 visible light sources | `lights.housing` both directions | ≤ 0.6 u (the audit asked 0.5; 0.6 is the spine's Pillar 4 number) |
| 7 night is a lighting change | `pillars.spec.ts` night-ratio | ≥ 4× under a lantern vs 10 u away at `timeOfDay 0.05` |
| 8 post chain presence and order | `post-graph.test.ts` | the §10.8.1 order and parameters |
| 9 bloom threshold | `pillars.spec.ts` bloom-gap | env ≤ 1.10 < 1.15 < creature ≥ 1.35 |
| 10 DOF never touches the actor | `dof-mask.spec.ts` (§50.1.7) | mask 1.0 over 600 frames, per move animation in shot 5 |
| 11 camera solved, not tuned | `camera-constants.test.ts` | the §10.7.1 table; no stray literal |
| 12 walkable = rendered | `heightfield.test.ts` | walkable ≥ 45 % of the field (interior ≤ 64 %); legacy 10.7 % |
| 13 zero allocation in the sim step | `alloc.spec.ts`, `perf/alloc.test.ts` (§50.1.10) | 0 constructions; ≤ 64 KB heap noise |
| 14 disposal contract | `leak.spec.ts` (§50.1.9) | exact baseline over 100 cycles, in CI |
| 15 no DOM in the frame | `no-dom-in-frame.spec.ts` | 0 mutations/s with a static HUD; HUD is canvas (§10.9) |
| 16 zone transition | `handover-hitch.spec.ts` | no frame > 33 ms, no fade; trigger 6 m inside the edge, preload in phase 5 |
| 17 asset gating | `first-frame.spec.ts` | ≤ 2 500 ms; awaited: shell, `/me`, field materials, zone atlases + party + own body |
| 18 compressed assets | model-pipeline / material-bake / sprite-pipeline budget tests | meshopt GLBs, KTX2 materials, WebP creatures ≤ 35 MB, VRAM ≤ 700 MB |
| 19 instancing and LOD | `scatter.instanced`, `10-render.md` §10.5.7 tiers | 0–40 / 40–90 / 90–160 / > 160 m; cull count in `dumpZone().counts` |
| 20 authority | `authority.test.ts` A1–A20 | zero rows changed |
| 21 one spawn table | `coverage.test.ts`, `spawn-director.test.ts` | 15 tables keyed by `ZoneId`; no client roll; 10 000-roll fuzz |
| 22 roster | `coverage.test.ts`, `families.test.ts` | 130/130; 67 families (the audit's "69 roots" was the legacy count) |
| 23 zone ids | `validate.test.ts` (spine rule 1–2, zod) | build-time `ZoneId` enum |
| 24 presence fanout | `aoi-fanout.test.ts` | power-law exponent < 1.3; ≤ 0.3 × quadratic |
| 25 coordinate validation | `movement.test.ts` | `playableBounds` ±64 / ±104 / ±84; cap 4.83 / 8.05 m/s |
| 26 interpolation | `prediction.test.ts` | 100 ms buffer, linear, ≤ 100 ms extrapolation, no reversal under jitter |
| 27 one combat implementation | `fuzz.test.ts`, `repairs.test.ts`, `fuzz-browser.spec.ts` | 1 000 digests equal; the 11 `PLAN.md` repairs |
| 28 variants in shader | `no-getimagedata.test.ts` | 4 uniforms, 0 `getImageData` |
| 29 battle in place | `pillars.spec.ts` Pillar 7 | camera ≤ 40 u; zone root and light list unchanged |
| 30 typography | `design-system.test.ts` | ≥ 12 px caption, ≥ 14 px body |
| 31 transition budget | `design-system.test.ts`, `routes.test.ts` | 0 ms input block; panels 160 ms non-blocking |
| 32 boundaries | `pnpm test:lint-rules` (§50.1.2) | render → three only; core → nothing; client ⊅ server/persist |
