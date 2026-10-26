# EWAMON REMASTERED — SPEC §0–§5: THE DATA SPINE

**Status:** BINDING. Where `.design/PLAN.md` and this file disagree, this file wins. Where a later section file (`10-render.md` … `50-verification-budget.md`) disagrees with this file, this file wins — the other sections code against the interfaces below and may not redefine them. Reconciled 2026-09-18 against `10`–`50`, `story-bible.md`, `roster-coverage.md`, `audits/legacy-render-audit.md` and the implemented `packages/core` + `packages/persist`; every edit carries a `<!-- reconciled 2026-09-18 -->` mark and an entry in `spec/CHANGELOG.md`.

Inputs: `PLAN.md`; the legacy data under `.design/legacy/` (`ewamon.js` 130 species / 193 moves / 19 types / 25 abilities / 17 held items / 10 orbs; `world.js` 21 zones; `league.js`; `liveOps.js`; `questUtils.js`; `battleSocket.js` + `wildBattleService.js`, the two divergent battle paths this spine replaces; `Player.model.js`; `battlePass.js`; `shop.js`); the installed `.d.ts` of `@colyseus/schema 5.0.32`, `@colyseus/core 0.18.14`, `drizzle-orm 0.45.2`. Every library name below was read from `node_modules`, not from memory.

---

## §0 STATUS + READING ORDER

0.1 Every TypeScript block in this file is **verbatim**: implementers copy it into `packages/*/src` unchanged. Prose around a block explains; the block rules.

0.2 Reading order for the whole spec, assembled into `.design/SPEC.md` by the reconciler:

| File | Owns |
|---|---|
| `00-spine.md` (this) | Art pillars as binding; `@ewa/core` API; `@ewa/content` schema; `@ewa/protocol` wire; `@ewa/persist` tables |
| `10-render.md` | `@ewa/render`: WebGPU pipeline, materials, lighting, sprite system, zone builder, disposal contract |
| `20-client.md` | `@ewa/client`: React shell, routing, HUD, battle staging, input, audio, prediction/reconciliation |
| `30-server-netcode.md` | `@ewa/server`: zone rooms, AOI, tick, handover, battle/raid/trade sub-states, Fastify REST, auth |
| `40-pipelines.md` | `tools/sprite-pipeline`, `tools/audio-pipeline`, `tools/asset-audit`, content build |
| `50-verification-budget.md` | Frame budget numbers, determinism fuzz, leak test, netcode harness, authority test, hostile render audit |

0.3 Package names and the only import directions (machine-checked by `eslint.config.js`):

```
@ewa/core     -> (nothing)
@ewa/content  -> @ewa/core, zod
@ewa/protocol -> @ewa/core, @ewa/content, @colyseus/schema
@ewa/persist  -> @ewa/core, @ewa/content, drizzle-orm, pg, @electric-sql/pglite
@ewa/render   -> three (only)
@ewa/server   -> core, content, protocol, persist, colyseus, @colyseus/core, fastify, zod
@ewa/client   -> core, content, protocol, render, react, react-dom, react-router, zustand, @colyseus/sdk
```

0.4 Vocabulary. **Species** = a `SpeciesDef` (content). **Creature** = a `CreatureInstance` (persisted row). **Battler** = the battle-time projection of a creature. **Side** = one of the two parties in a battle. **Slot** = index into a side's party array. **Zone** = one of the 21 area ids. **Content id** = a string key into `ContentIndex`; ids are `snake_case` for species/zones/items/orbs/quests/beats and the legacy display-name string for moves and abilities (`"Vine Lash"`, `"Intimidate"`).

---

## §1 ART DIRECTION — THE EIGHT PILLARS, BINDING

Each pillar ends with its single acceptance test. `10-render.md` may add tests; it may not remove these.

**Pillar 1 — A diorama under a real lens.** One `PerspectiveCamera`, 35 mm-equivalent (vertical FOV 28° at 16:9), fixed high three-quarter angle: pitch −52° from horizontal, yaw locked to one of four 90° headings the player rotates between. Tilt-shift depth of field with the focal plane through the player's feet; falloff above and below; the DOF mask excludes the player's creature and every active battler at all times. Not a "zoomed-out RPG camera" — a photograph of a model village. *Test:* in a still at default zoom, the player and the active battler have zero DOF blur (mask value 1.0 over their whole billboard), and a prop 12 units nearer or farther than the focal plane has a measurable circle of confusion ≥ 3 px at 1440p.

**Pillar 2 — Every surface carries three maps.** Albedo (sRGB) + channel-packed ORM (AO in R, roughness in G, metalness in B, one texture bound to all three slots) + a tangent-space normal derived by 3×3 Sobel from a procedural heightfield. Generated at build time into KTX2 (`tools/`), cached by content hash, never into a runtime `CanvasTexture`. *Test:* `tools/asset-audit` walks every material in a loaded zone and fails if any lit opaque material lacks all three of `map`, the ORM texture, and `normalMap`.

**Pillar 3 — Nothing stays a primitive.** Rocks are lathed and fractured; trunks are tapered extrusions with root flares; building edges carry 3–5 cm chamfers; every biome has its own geometry generators. *Test:* the audit asserts zero `BoxGeometry`, `ConeGeometry`, `IcosahedronGeometry(r, 0)` or `SphereGeometry` with `widthSegments < 24` in the zone scene graph, excluding debug/helper layers.

**Pillar 4 — Every light has a visible source.** Lamps, forge fires, gym beacons and lava are real punctual lights with an emissive housing in frame. Night is a lighting change (IBL swap + light-set change), not a global multiply. Sun uses 4 cascaded shadow maps. Budget per zone: 8 shadow-casting + 24 non-shadowing lights, plus sun. *Test:* for every `PointLight`/`SpotLight` in a zone, an emissive mesh exists within 0.6 units of the light position; the count check fails the build at 9 shadow casters or 25 non-shadowing lights.

**Pillar 5 — The sprite is lit, not pasted.** A creature billboard is shaded by scene lights through its derived normal map, casts a real shadow from its alpha, carries a type-coloured rim light, and grounds with a contact shadow and a soft occlusion gradient at its feet. *Test:* a screenshot of the same creature under the noon and the dusk light set differ by ≥ 12 % mean luminance over the billboard's opaque pixels, and its shadow-map footprint is non-empty.

**Pillar 6 — Pixels stay pixels.** Creature albedo samples with `NearestFilter` when magnified; anti-aliasing is TAA on the scene, never a bilinear smear on the sprite; variant palettes are shader uniforms, never re-baked pixels. *Test:* a 1024² sprite rendered at 1.3× magnification shows hard 1-texel edges (no intermediate alpha values along a straight opaque edge, sampled over 200 edge pixels).

**Pillar 7 — Battles happen where you are standing.** No screen transition. The camera pushes in over 600 ms, the zone dresses itself into an arena (ring, spectators, lights), and the same light set that lit the field lights the fight. *Test:* the world scene graph remains mounted for the whole battle (no `scene.remove` of the zone root), and the battle camera's position is within 40 units of the pre-battle player position.

**Pillar 8 — Readability outranks atmosphere, and everything has an off switch.** Bloom threshold sits between the brightest environment pixel and the creature's brightest pixel. No effect may cover an HP bar, a type icon or a move result. `prefers-reduced-motion` and an explicit reduced-effects toggle remove grain, chromatic aberration, camera shake and hitstop; the game plays identically. *Test:* with reduced effects on, a 600-frame capture of a full battle turn has zero frames with camera shake offset ≠ 0 or hitstop dt ≠ frame dt, and `resolveTurn` output is byte-identical to the same battle with effects on.

The story mechanic that fuses with these pillars: a zone in `harvestState: 'harvested'` renders with pillars 2–5 deliberately *disabled* (flat vertex colour, primitives, no punctual lights, unlit sprites). That degraded look is in-fiction and is produced by the same render package through a `HarvestLevel` uniform set, never by a second code path. `10-render.md` specifies it.

---

## §2 @ewa/core PUBLIC API

`packages/core/src/index.ts` exports exactly the symbols in this section. Core imports nothing, allocates no `Date`, never calls `Math.random`, and iterates only arrays and sorted key lists (the `ewa/no-unordered-iteration` rule). Core knows **no data**: every function that needs a species, move, ability, item or the type chart takes a `ContentIndex`.

### 2.1 Rng — sfc32

Algorithm: **sfc32** (Chris Doty-Humphrey). State is four `uint32`. Every arithmetic step is forced to 32-bit integer with `| 0` and read back with `>>> 0`, so V8, JavaScriptCore and SpiderMonkey produce identical sequences. `next()` returns `u32 / 4294967296`, which is exact in IEEE double; `int(n)` uses `Math.floor(next() * n)` — a product of an exact double and an integer ≤ 2³¹, floored, which is deterministic across engines.

```ts
/** Four uint32 words. Serialisable as JSON; the only thing a battle stores about randomness. */
export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). n must be an integer 1..2^31-1; throws otherwise. */
  int(n: number): number;
  /** True with probability p (0..1). Consumes exactly one draw. */
  chance(p: number): boolean;
  /** One element, uniform. Throws on empty. Consumes exactly one draw. */
  pick<T>(a: readonly T[]): T;
  /** Fisher–Yates, returns a NEW array; consumes exactly a.length - 1 draws. */
  shuffle<T>(a: readonly T[]): T[];
  /** A new independent stream seeded from 4 draws of this one (this stream advances by 4). */
  fork(): Rng;
  /** The current state. Feeding it to createRng resumes the identical sequence. */
  snapshot(): RngState;
}

/**
 * number  -> seeded via splitmix32 expansion of (seed | 0) into 4 words, then 12 warm-up draws.
 * string  -> fnv1a32(seed) is the number seed above.
 * RngState-> used verbatim, no warm-up (this is how a battle resumes).
 */
export function createRng(seed: RngState | number | string): Rng;

/** FNV-1a, 32-bit, over UTF-16 code units. Also used by digestBattleState (§2.20). */
export function fnv1a32(s: string): number;
```

The exact step, for the test vector in `packages/core/test/rng.test.ts`:

```ts
// state a,b,c,d (uint32)
const t = (((a + b) | 0) + d) | 0;
d = (d + 1) | 0;
a = b ^ (b >>> 9);
b = (c + (c << 3)) | 0;
c = ((c << 21) | (c >>> 11)) | 0;
c = (c + t) | 0;
return (t >>> 0) / 4294967296;
```

splitmix32 expansion for numeric seeds: `x = (seed | 0) >>> 0; for i in 0..3: x = (x + 0x9e3779b9) | 0; z = x; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); word[i] = (z ^ (z >>> 16)) >>> 0`. Test vector: `createRng(12345).int(1000)` after warm-up must equal the committed constant in the test file on every engine CI runs (Node 22, Chromium, Firefox, WebKit via Playwright).

### 2.2 Types and the chart

```ts
export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ice' | 'Fighting' | 'Poison'
  | 'Ground' | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Steel'
  | 'Fairy' | 'Dark' | 'Cosmic';

export const TYPE_NAMES: readonly TypeName[]; // the 19 above, in that order (dex/UI order)

/** chart[attacking][defending] = 0 | 0.5 | 2. Missing entry = 1. */
export type TypeChart = Readonly<Record<TypeName, Readonly<Partial<Record<TypeName, 0 | 0.5 | 2>>>>>;

/** Product over defender types; exact results in {0, 0.25, 0.5, 1, 2, 4}. */
export function typeMultiplier(
  chart: TypeChart, moveType: TypeName, defenderTypes: readonly TypeName[],
): 0 | 0.25 | 0.5 | 1 | 2 | 4;
```

The chart data lives in `@ewa/content` and is the legacy `TYPE_CHART` verbatim (19 rows, including `Cosmic: { Psychic: 2, Fairy: 2, Dark: 0.5, Steel: 0.5, Cosmic: 0.5 }`, `Steel` hits `Cosmic` 2, `Dark` hits `Cosmic` 2, `Fairy` hits `Cosmic` 0.5). Core defines the shape; content defines the values.

### 2.3 SpeciesDef

```ts
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';
export type SpeciesRole =
  | 'Physical Attacker' | 'Special Attacker' | 'Mixed Attacker' | 'Physical Defender'
  | 'Special Defender' | 'Mixed Defender' | 'Healer' | 'Speed' | 'Tank';

export interface LearnEntry { readonly move: string; readonly level: number } // level 1 = known at creation

export type Evolution =
  | { readonly kind: 'level'; readonly into: string; readonly atLevel: number }
  | { readonly kind: 'split'; readonly atLevel: number;
      readonly branches: readonly { readonly into: string;
        // 'honor' <!-- amended 2026-10-08: the honor ledger, lawlander (#137) -->: the creature's honor ledger (CreatureInstance.honor, absent = 0) is at least `atLeast`
        readonly condition: { readonly kind: 'ability'; readonly ability: string } | { readonly kind: 'honor'; readonly atLeast: number } | null }[] }
  | { readonly kind: 'item'; readonly item: string; readonly into: string }   // Phase D3: an evolution stone, any level
  | { readonly kind: 'trade'; readonly into: string }                         // Phase D3: when traded
  | null;

export interface SpeciesDef {
  readonly id: string;                 // snake_case, e.g. 'bramblecub'
  readonly name: string;               // display, e.g. 'Bramblecub'
  readonly dexNumber: number;          // 1..145 <!-- amended 2026-10-13: hyoryu (#138) --> <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> <!-- amended 2026-10-25: the Elemutt line (#142–144) --> <!-- amended 2026-10-26: kykaiser (#145) -->, unique, dense (1..130 legacy, 131.. `.design/additions/species.js`)
  readonly flavor: string;
  readonly types: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly baseHp: number; readonly baseAtk: number; readonly baseDef: number; readonly baseSpd: number;
  readonly rarity: Rarity;
  readonly catchRate: number;          // 3..255
  readonly sizeScale: number;          // billboard scale, 0.5..2.2
  readonly expYield: number;
  readonly moves: readonly string[];   // the default 4 at creation, length 1..4
  readonly learnableMoves: readonly LearnEntry[]; // sorted by level asc, includes `moves` at level 1
  readonly abilities: readonly string[];          // 1..2 ability ids; index 0 is the default
  readonly role: SpeciesRole;
  readonly evolution: Evolution;
  readonly evolvesFrom: string | null;
  readonly sprite: { readonly front: string; readonly back: string }; // pipeline output ids, e.g. 'bramblecub_front'
  readonly legendary: boolean;         // true for exactly the 10 legendaries incl. the 2 mythicals
  readonly battleForm?: BattleFormDef; // a mid-battle form (hollowmane's rage form); absent on every other species
  readonly battleForms?: readonly BattleFormDef[]; // <!-- amended 2026-10-25: the Elemutt line (#142–144) --> several forms, each opened by its own held item (ravatar's relic forms); never beside battleForm; core `formsOf` reads either
}

// <!-- amended 2026-10-08: battle forms (hollowmane's rage form) -->
// Once per battle, never persisted: a standing battler on the field whose hp * 100 < maxHp * hpBelowPct changes — after
// any damage (`dealDamage`) or on entering the field. atk / def / spd then derive from the form's base stats everywhere
// they are computed (projection, level-up, the damage formula, the confusion self-hit: core `formBase`); max hp, types,
// ability and status are the species'. It emits `formChange`, then onEnter: its own negative stages back to 0
// (`statStage`, cause 'ability'), every standing foe on the field lowered (`statStage`, cause 'ability'). The form is kept
// through a switch-out. The client shows the creature manifest entry `<species>_<form>` while the battler holds it.
// <!-- amended 2026-10-11: Majin / Tenjin --> `kind` makes it the Majin / Tenjin gimmick (`.design/majin-tenjin.md`): a 'majin' form opens below the
// line, a 'tenjin' form at or above it, and on a trainer's side neither changes on its own — the side transforms by choice
// (§2.10 `Action.transform`, once per side per battle, holding the band of that kind, `Side.bands`). A WILD 'majin'
// battler still changes on its own as above; a 'tenjin' never does. `kind` absent = the automatic form above, any side.
export type BandKind = 'majin' | 'tenjin';
export interface BattleFormDef {
  readonly id: string;                 // e.g. 'rage'
  readonly name: string;               // e.g. 'Rage Form' / 'Majin Form'
  readonly kind?: BandKind;            // <!-- amended 2026-10-11: Majin / Tenjin --> absent = automatic (any side)
  readonly hpBelowPct?: number;        // <!-- amended 2026-10-25: the Elemutt line (#142–144) --> absent only on a form with `heldItem` (it opens as the battler lands). 1..99 — the line: majin / automatic change when hp * 100 < maxHp * hpBelowPct; tenjin when ≥
  readonly baseAtk: number; readonly baseDef: number; readonly baseSpd: number;
  // <!-- amended 2026-10-13: hyoryu (#138) --> the battler's types while it holds the form (hyoryu's Majin Form: Ice/Dragon becomes Dragon/Dark): the type
  // chart, STAB, status and weather immunities and the orb type bonus read them (core `formTypes`); absent = the species' types
  readonly types?: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly onEnter: {
    readonly clearNegativeStages: boolean;
    readonly lowerFoes: { readonly stat: StatKey; readonly stages: number } | null;
    readonly cureStatus?: boolean;     // <!-- amended 2026-10-11: Majin / Tenjin --> Tenjin: its major status cured (`statusCured`, cause 'ability')
    readonly healFraction?: number;    // <!-- amended 2026-10-11: Majin / Tenjin --> Tenjin: heals floor(maxHp × this) (`heal`, cause 'form'), after the stages
  };
  readonly sprite: { readonly front: string; readonly back: string }; // '<species>_<form>_front' / '_back'
  // <!-- amended 2026-10-08: signature move --> while the battler holds the form, using the known move `replaces` executes `move` instead (its own MoveDef);
  // the replaced slot pays the PP, validation and choice lock keep the slot's id, move order uses the executed move's
  // priority, a trainer AI scores the slot by it, and the battle menu shows it in that slot. Learned by no species.
  readonly signatureMove?: { readonly replaces: string; readonly move: string };
}
```

Legacy `learnableMoves` is a flat string list with no levels. Migration rule for content: the species' default `moves` get level 1; the remaining entries get levels `evolvesAt`-aware — spaced evenly between 5 and `min(evolution.atLevel ?? 40, 60)` in list order, rounded to a multiple of 3. The generated table is committed as data, validated, and thereafter hand-edited; the generator is a one-shot tool, not a runtime rule.

The `split` evolution exists exactly once in legacy (`Lightning Rod → aonred`, default `→ darkyon`); its branch with `condition: null` is the default and must be last.

**The honor ledger (dustcub's line).** <!-- amended 2026-10-08: the honor ledger, lawlander (#137) --> A species whose `split` evolution has an `honor` branch keeps a ledger in `CreatureInstance.honor` (core `honor.ts`; absent = 0, clamped to −10..10). Inside the battle engine, for a creature of a `player` side only and never when `noExp` (the tower): a damaging hit with a Dark-type move −1 (`dirtyTrick`); a wild creature fainting while it stands on the field opposite −1 (`wildKo`); a wild creature caught while it stands on the field +1 (`spared`); its side winning a non-wild battle it took part in +2 (`duelWon`, emitted just before `battleEnd`). Each change emits `honor { who, delta, honorAfter, reason }`; at the clamp nothing is emitted. `evolutionTarget(evolution, ability, honor = 0)` takes the first branch whose condition holds (`honor >= atLeast`), so dustcub at 30 becomes `lawlander` (High Honor, #137) at honor ≥ 0 and `badlander` (Low Honor) below. <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> cryptorb at 34 likewise becomes `vysion` (High Honor, #141) at honor ≥ 0 and `ultraze` (Low Honor, #140) below. A creature that never keeps a ledger never gains the field or the event, so both fuzz digest files are byte-identical. `POST /creature/:id/evolve` on an honor split accepts either branch and evolves into the one the persisted ledger picks (the ledger can move after the battle event that queued the prompt); the evolve prompt names that branch.

**Phase D3 — stone and trade evolutions.** `item` and `trade` are never level-triggered: `applyExp` reports no `evolveReady` for them, and their species keep their legacy learnset (spaced by the legacy level). Core exports `itemEvolutionTarget(evolution, item)`, `tradeEvolutionTarget(evolution)` and `evolutionChildren(evolution)` (every target, any trigger); `evolve` is trigger-agnostic. Nine families use them (`packages/content/src/data/evolutions.ts`, applied by the generator): `embrock`, `flampling` → Ember Stone; `stormchick` → Storm Stone; `mossling` → Tide Stone; `seedrift` → Verdant Stone; `berkest` → Moon Stone; `hexroach` → Dusk Stone; `glowtent`, `resilith` → trade. None is in a league team or in the progression walker's parties. Eviolite and the speed tie-break keep reading `evolution !== null`, so battle semantics (and the fuzz digests) are unchanged. The roster report's `AcquisitionPath` gains `{ kind: 'item', from, item }` and `{ kind: 'trade', from }`; validate requires every stone an `item` evolution names to be sold, found or rewarded somewhere.

### 2.4 MoveDef and the 23 effects

```ts
export type MoveEffect =
  | 'lower_atk' | 'first' | 'paralyze' | 'flinch' | 'crit' | 'confuse' | 'poison' | 'raise_def'
  | 'burn' | 'recoil' | 'lower_def' | 'drain' | 'heal' | 'sun' | 'lower_spd' | 'freeze'
  | 'raise_all' | 'trap' | 'weather' | 'sleep' | 'lower_spAtk' | 'raise_atk' | 'raise_spd';

export type MoveTarget = 'foe' | 'self' | 'field';
export type MoveSpread = 'foes' | 'all';   // Phase D6: doubles reach — 'foes' both foes, 'all' every other battler (ally too)

export interface MoveDef {
  readonly id: string;              // the legacy display name, e.g. 'Vine Lash' — ids ARE names
  readonly type: TypeName;
  readonly power: number;           // 0 = status move
  readonly pp: number;              // 5..40
  readonly accuracy: number | null; // 1..100; null = never misses
  readonly priority: -1 | 0 | 1;    // 'first' moves are 1; content may set -1 on none in v1
  readonly contact: boolean;        // derived at content build: power > 0 && type not in the non-contact set
  readonly effect: MoveEffect | null;
  readonly effectChance: number;    // 1..100, applied AFTER the move hits (see table)
  readonly target: MoveTarget;      // 'field' for weather/sun; 'self' for raise_*/heal; else 'foe'. Read ONLY when power === 0 (see below)
  readonly description: string;
  readonly spread?: MoveSpread;     // Phase D6: absent = single target; read only in doubles (content's curated SPREAD_MOVES)
  readonly typeFromForm?: true;     // <!-- amended 2026-10-25: the Elemutt line (#142–144) --> the move takes the held form's `moveType` (else its first type) through core `formMove`
  readonly effectOnlyBaseForm?: true; // <!-- amended 2026-10-25: the Elemutt line (#142–144) --> the effect applies only while no battle form is held
}
```

<!-- reconciled 2026-09-18: folded packages/core IMPLEMENTATION-NOTES item 6 — damaging moves always target the foe -->
`target` is consulted only for power-0 moves (`self`/`field` skip the foe-facing accuracy, evasion and immunity checks). A damaging move always targets the foe and its effect handler applies to whichever side the §2.4 table names, regardless of `target` — legacy has damaging moves with self-directed effects (`Cosmic Miracle` 120 power + `heal`, `Ancient Power` + `raise_all`, `Charge Beam` + `raise_atk`) that must still deal damage.

Semantics for all 23. "Attacker" = the user of the move. Stage changes go through §2.9 and are clamped at ±6 (a clamped change emits `statStage` with `delta: 0` and `clamped: true`). Chances are `effectChance` defaults; content may override per move.

| Effect | Affects | Magnitude | Default chance | Duration / notes |
|---|---|---|---|---|
| `lower_atk` | **defender** | Atk −1 stage | 100 (power 0) / 30 (power > 0) | Legacy PvP lowered the attacker's own Atk in 9 moves — fixed here |
| `lower_def` | defender | Def −1 | 100 / 30 | |
| `lower_spd` | defender | Spd −1 | 100 / 30 | |
| `lower_spAtk` | defender | Atk −1 | 100 / 30 | **There is no Sp.Atk in this game.** Mapped to `lower_atk` on the defender at content build; `validate.ts` rewrites it and the key never reaches core. Listed so the legacy id is accounted for |
| `raise_atk` | attacker | Atk +1 | 100 | |
| `raise_def` | attacker | Def +1 | 100 | |
| `raise_spd` | attacker | Spd +1 | 100 | |
| `raise_all` | attacker | Atk +1, Def +1, Spd +1 | 100 | Three `statStage` events, in that order |
| `crit` | this move | crit stage +2 (§2.11: crit rate 1/2) | always | Not a stat stage; a per-move modifier |
| `first` | this move | `priority` = 1 | always | Data-only: content sets `priority: 1`; core reads `priority`, never `effect === 'first'` |
| `flinch` | defender | skips its move this turn | 30 | Only if the attacker moved **before** the defender this turn; no effect otherwise |
| `burn` | defender | status `burn`: 1/16 max HP end of turn, Atk-based damage ×0.5 | 100 / 30 | Until cured. Fire types immune |
| `poison` | defender | status `poison`: 1/8 max HP end of turn | 100 / 30 | Until cured. Poison and Steel types immune |
| `paralyze` | defender | status `paralyze`: Spd ×0.5; 25 % full paralysis each turn | 100 / 30 | Until cured. Electric types immune |
| `freeze` | defender | status `freeze`: cannot act; 20 % thaw at start of own action; any Fire-type hit thaws | 100 / 10 | Ice types immune |
| `sleep` | defender | status `sleep`: cannot act for `1 + rng.int(3)` turns | 100 (power 0 only) | Counter decrements at the start of the sleeper's action |
| `confuse` | defender | volatile `confusedTurns = 2 + rng.int(3)`; 33 % self-hit before acting | 30 | Self-hit = 40-power typeless move with own Atk vs own Def, no crit, no STAB |
| `trap` | defender | volatile `trappedTurns = 4 + rng.int(2)`; 1/8 max HP end of turn; cannot `switch`/`flee` | 100 | Cleared when either side's active battler leaves the field |
| `recoil` | attacker | loses `floor(damageDealt / 4)` HP (min 1 when damage > 0) | always | Emits `damage` with `cause: 'recoil'` |
| `drain` | attacker | heals `floor(damageDealt / 2)` (min 1 when damage > 0) | always | Capped at max HP |
| `heal` | attacker | heals `floor(maxHp / 2)` | always | Fails (event `moveFailed`, reason `'fullHp'`) at full HP; PP still spent |
| `weather` | field | sets weather from move type: Water→`rain`, Fire→`sun`, Ice→`hail`, Rock/Ground→`sand`; other types→`sand` | always | 5 turns (the setting turn counts as turn 1). Replaces any current weather |
| `sun` | field | sets `sun` | always | 5 turns |

Status-move accuracy: a power-0 move still rolls accuracy (§2.12). If it misses, no effect and `moveMissed` is emitted. Status immunity by type is checked *after* the hit roll; an immune target yields `statusBlocked { reason: 'type' }`.

Non-contact set for `contact` derivation: `Fire`, `Water`, `Grass`, `Electric`, `Ice`, `Psychic`, `Ghost`, `Cosmic`, `Fairy` at power > 0 are **non-contact**; `Normal`, `Fighting`, `Poison`, `Ground`, `Flying`, `Bug`, `Rock`, `Dragon`, `Steel`, `Dark` are contact. Content may override per move. Power-0 moves are never contact.

Legacy data bug: one move carries `effect: "weaknessPolicy"` (a held-item key leaking into a move). `validate.ts` rejects it; content sets that move's effect to `null`.

### 2.5 AbilityDef and hooks

Every one of the 25 legacy abilities is expressed as data in this union; core implements the union, content supplies the 25 rows below. No ability is special-cased by name in core except through these hooks.

```ts
export type StatKey = 'atk' | 'def' | 'spd' | 'acc' | 'eva';
export type WeatherKind = 'none' | 'sun' | 'rain' | 'sand' | 'hail';
export type MajorStatus = 'burn' | 'poison' | 'paralyze' | 'sleep' | 'freeze';
export type StatusId = MajorStatus | 'confuse';

export type AbilityHook =
  | { readonly kind: 'onSwitchIn'; readonly lowerFoe: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'onSwitchOut'; readonly action: 'healFraction' | 'cureStatus'; readonly fraction?: number }
  | { readonly kind: 'modifySpeed'; readonly whenWeather: WeatherKind; readonly mul: number }
  | { readonly kind: 'modifyAttack'; readonly when: 'always' | 'statused'; readonly mul: number }
  | { readonly kind: 'modifyDamage'; readonly side: 'attacker' | 'defender';
      readonly moveTypes?: readonly TypeName[]; readonly when?: 'superEffective' | 'flashFired'; readonly mul: number }
  | { readonly kind: 'modifyAccuracy'; readonly side: 'attacker' | 'defender';
      readonly whenWeather?: WeatherKind; readonly onlyDamaging?: boolean; readonly mul: number }
  | { readonly kind: 'typeImmunity'; readonly moveType: TypeName;
      readonly reaction:
        | { readonly kind: 'none' }
        | { readonly kind: 'heal'; readonly fraction: number }
        | { readonly kind: 'flag'; readonly flag: 'flashFired' }
        | { readonly kind: 'raiseStat'; readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'statusImmunity'; readonly statuses: readonly StatusId[] }
  | { readonly kind: 'stageLowerImmunity'; readonly stats: readonly StatKey[] }
  | { readonly kind: 'onContact';
      readonly reaction:
        | { readonly kind: 'inflictStatus'; readonly status: MajorStatus; readonly chance: number }
        | { readonly kind: 'damageFraction'; readonly fraction: number } }
  | { readonly kind: 'onStatLowered'; readonly raise: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'endOfTurn'; readonly raise: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'wonderGuard' }
  // <!-- amended 2026-10-25: the Elemutt line (#142–144) --> Stance Change: after the user's own damaging hit, a raise by contact / non-contact, at most `cap` per stat per switch-in;
  // `modifyDamage` also takes `when: 'fullHp'` and a `contact` filter (Inner Chi). There is no Sp. Atk / Sp. Def: "special" = non-contact.
  | { readonly kind: 'afterMoveUsed'; readonly contact: { readonly stat: StatKey; readonly stages: number } | null; readonly nonContact: { readonly stat: StatKey; readonly stages: number } | null; readonly cap: number };

export interface AbilityDef {
  readonly id: string;          // legacy display name, e.g. 'Intimidate'
  readonly name: string;
  readonly description: string;
  readonly hooks: readonly AbilityHook[];
}
```

The 25 rows content must ship (fractions written as decimals content stores exactly):

| Ability | Hooks |
|---|---|
| Chlorophyll | `modifySpeed { whenWeather: 'sun', mul: 2 }` |
| Swift Swim | `modifySpeed { whenWeather: 'rain', mul: 2 }` |
| Thick Fat | `modifyDamage { side: 'defender', moveTypes: ['Fire','Ice'], mul: 0.5 }` |
| Lightning Rod | `typeImmunity { moveType: 'Electric', reaction: { kind: 'raiseStat', stat: 'atk', stages: 1 } }` |
| Competitive | `onStatLowered { raise: { stat: 'atk', stages: 2 } }` (fires once per foe-caused lowering) |
| Flame Body | `onContact { reaction: { kind: 'inflictStatus', status: 'burn', chance: 30 } }` |
| Poison Spores | `onContact { reaction: { kind: 'inflictStatus', status: 'poison', chance: 30 } }` |
| Rough Skin | `onContact { reaction: { kind: 'damageFraction', fraction: 0.125 } }` |
| Water Absorb | `typeImmunity { moveType: 'Water', reaction: { kind: 'heal', fraction: 0.25 } }` |
| Volt Absorb | `typeImmunity { moveType: 'Electric', reaction: { kind: 'heal', fraction: 0.25 } }` |
| Flash Fire | `typeImmunity { moveType: 'Fire', reaction: { kind: 'flag', flag: 'flashFired' } }`, `modifyDamage { side: 'attacker', moveTypes: ['Fire'], when: 'flashFired', mul: 1.5 }` |
| Immunity | `statusImmunity { statuses: ['poison'] }` |
| Speed Boost | `endOfTurn { raise: { stat: 'spd', stages: 1 } }` |
| Intimidate | `onSwitchIn { lowerFoe: { stat: 'atk', stages: 1 } }` — **applied once**, on entry only. The legacy ×0.75 per-calc multiplier is gone |
| Wonder Guard | `wonderGuard` (only `typeMultiplier ≥ 2` moves deal damage; status moves unaffected) |
| Regenerator | `onSwitchOut { action: 'healFraction', fraction: 0.3333 }` → `floor(maxHp / 3)` |
| Keen Eye | `stageLowerImmunity { stats: ['acc'] }` (no v1 move lowers accuracy; the hook is live but untriggered) |
| Solid Rock | `modifyDamage { side: 'defender', when: 'superEffective', mul: 0.75 }` |
| Natural Cure | `onSwitchOut { action: 'cureStatus' }` (clears all major statuses, not confusion) |
| Sand Veil | `modifyAccuracy { side: 'defender', whenWeather: 'sand', mul: 0.8 }` |
| Hustle | `modifyAttack { when: 'always', mul: 1.5 }`, `modifyAccuracy { side: 'attacker', onlyDamaging: true, mul: 0.8 }` |
| Guts | `modifyAttack { when: 'statused', mul: 1.5 }` (any major status; also cancels the burn ×0.5) |
| Iron Barbs | `onContact { reaction: { kind: 'damageFraction', fraction: 0.125 } }` |
| Levitate | `typeImmunity { moveType: 'Ground', reaction: { kind: 'none' } }` |
| Void Sovereign | `typeImmunity { moveType: 'Fairy', reaction: { kind: 'none' } }` |

### 2.6 Items: held, key, orbs, consumables

```ts
export type HeldItemHook =
  | { readonly kind: 'statMul'; readonly stat: 'atk' | 'def' | 'spd'; readonly mul: number; readonly unevolvedOnly?: boolean }
  | { readonly kind: 'typeBoost'; readonly type: TypeName; readonly mul: number }
  | { readonly kind: 'berry'; readonly belowFraction: number;
      readonly heal: { readonly kind: 'fraction'; readonly value: number } | { readonly kind: 'flat'; readonly value: number } }
  | { readonly kind: 'onSuperEffectiveHit'; readonly raise: { readonly stat: StatKey; readonly stages: number }; readonly consume: true }
  | { readonly kind: 'choiceLock' }          // locked to the first move used until switched out
  | { readonly kind: 'noStatusMoves' }       // cannot select power-0 moves
  | { readonly kind: 'hazardImmunity' };     // no hazards exist in v1: documented no-op

export interface ItemDef {
  readonly id: string;             // legacy display name, e.g. 'Choice Band'
  readonly name: string;
  readonly description: string;
  readonly slot: 'held' | 'key';   // 'key' = inventory-only field verb (HM Surf / Cut / Strength)
  readonly fieldVerb: 'surf' | 'cut' | 'strength' | null;
  readonly hooks: readonly HeldItemHook[];
  readonly price: number | null;   // null = not sold
}

export interface OrbDef {
  readonly id: string;             // 'spark_orb' … 'phantom_orb'
  readonly name: string;
  readonly description: string;
  readonly catchRate: number;      // flat multiplier; 999 = guaranteed (aether_orb)
  readonly bonus:
    | { readonly kind: 'type'; readonly type: TypeName; readonly multiplier: number }
    | { readonly kind: 'alpha_or_variant'; readonly multiplier: number }
    | null;
  readonly price: number; readonly sellPrice: number; readonly maxStack: number; readonly rarity: Rarity;
}

export type ConsumableEffect =
  | { readonly kind: 'healHp'; readonly amount: number | 'full' }
  | { readonly kind: 'revive'; readonly fraction: 0.5 | 1 }
  | { readonly kind: 'cureStatus'; readonly statuses: readonly StatusId[] | 'all' }
  | { readonly kind: 'fullRestore' }
  | { readonly kind: 'restorePp'; readonly amount: number | 'full' }
  | { readonly kind: 'rareCandy' }
  | { readonly kind: 'repel'; readonly steps: number }
  | { readonly kind: 'lure'; readonly steps: number }
  | { readonly kind: 'escapeRope' }
  | { readonly kind: 'evolutionStone' } // Phase D3: the species it evolves name it in SpeciesDef.evolution { kind: 'item', item }
  | { readonly kind: 'sellOnly' };

export interface ConsumableDef {
  readonly id: string;             // snake_case
  readonly name: string;
  readonly description: string;
  readonly effect: ConsumableEffect;
  readonly usableInBattle: boolean;
  readonly price: number; readonly sellPrice: number; readonly maxStack: number;
}
```

The 17 held/key items and their hooks (Sp.Atk / Sp.Def do not exist; the two "special" items map to the one physical stat and this is stated in their description strings):

| Item | slot | hooks |
|---|---|---|
| Assault Vest | held | `statMul { def, 1.25 }`, `noStatusMoves` |
| Choice Band | held | `statMul { atk, 1.25 }`, `choiceLock` |
| Choice Scarf | held | `statMul { spd, 1.25 }`, `choiceLock` |
| Choice Specs | held | `statMul { atk, 1.25 }`, `choiceLock` (identical to Choice Band by construction) |
| Eviolite | held | `statMul { def, 1.5, unevolvedOnly: true }` |
| Heavy Duty Boots | held | `hazardImmunity` |
| Sitrus Berry | held | `berry { belowFraction: 0.5, heal: { fraction, 0.25 } }` (consumed) |
| Oran Berry | held | `berry { belowFraction: 0.25, heal: { flat, 10 } }` (consumed) |
| Charcoal | held | `typeBoost { Fire, 1.2 }` |
| Mystic Water | held | `typeBoost { Water, 1.2 }` |
| Mirrorcoat | held | `typeBoost { Psychic, 1.2 }` |
| Black Sludge | held | `typeBoost { Poison, 1.2 }` |
| Weakness Policy | held | `onSuperEffectiveHit { raise: { atk, 2 }, consume: true }` |
| Speed Scarf | held | `statMul { spd, 1.1 }` |
| HM Surf / HM Cut / HM Strength | key | none; `fieldVerb` set |

**Phase D1–D3 items** (hand-authored in `packages/content/src/data/progressionItems.ts`; the generated `ITEMS` stays 17 and `CONSUMABLES` 23):

| Item | kind | notes |
|---|---|---|
| `old_rod` | ItemDef, `key` | Maren's gift at `drowned_harbour`; cast with the client's timing prompt, a landed bite sends `fish { angle }` (§4.3, Phase D9); `fieldVerb` stays null (the verb is the message) |
| `bike` (Bicycle) | ItemDef, `key`, 30 000 (`BIKE_PRICE`) | Phase D11: sold in Saltmourn only (`PROGRESSION_STOCK`), never granted, never a gate; ridden outdoors on land (`InputMsg.bike`, `MOVEMENT.bikeSpeed` 10.5 m/s) |
| `tm:<Move>` × 39 (`TM_MOVES`) | ItemDef, `key`, priced 2000–5000 by power | reusable: `POST /creature/:id/moves` accepts a TM move while the TM is owned; the shop sells one copy (`alreadyOwned`, `oneAtATime`); key items are never sold back. Sold from Saltmourn on (`PROGRESSION_STOCK`), three are quest rewards |
| `ember_stone`, `tide_stone`, `storm_stone`, `verdant_stone`, `moon_stone`, `dusk_stone` | ConsumableDef, `evolutionStone`, 3000 / 1500, not in battle | `POST /item/use` on a creature that reacts answers `evolveReady { into, item }` without spending; the confirmed `POST /creature/:id/evolve` spends one. Sold from Stormrook on |

Machine / tutor learnability (`canLearnMachineMove`): the move is Normal-type, or shares a type with the species, or is in the species' level learnset. Moves the creature already knows are always accepted by `POST /creature/:id/moves` (a taught move stays).

Orbs: the 10 legacy rows verbatim (`spark_orb 1.0`, `crest_orb 1.75`, `prism_orb 2.5`, `aether_orb 999 maxStack 1`, `mythos_orb 1.5 + alpha_or_variant ×4`, `verdant_orb / ember_orb / tide_orb / dusk_orb / phantom_orb 1.0 + type ×3` for Grass / Fire / Water / Dark / Ghost). Legacy aliases `ewamon_ball, great_ball, ultra_ball, ultraball, master_ball` are **not** carried: there is no old database.

Consumables (from `shop.js`; canonical ids, with the two legacy misspellings noted):

| id | effect | battle |
|---|---|---|
| `potion` | `healHp 20` | yes |
| `superpotion` | `healHp 50` | yes |
| `hyper_potion` (legacy `world.js` typo `hyperpotion` rejected) | `healHp 100` | yes |
| `max_potion` | `healHp 'full'` | yes |
| `full_restore` | `fullRestore` | yes |
| `revive` | `revive 0.5` | yes |
| `max_revive` | `revive 1` | yes |
| `antidote` / `burn_heal` / `ice_heal` / `awakening` / `paralyze_heal` | `cureStatus [poison] / [burn] / [freeze] / [sleep] / [paralyze]` | yes |
| `full_heal` (legacy `fullheal` rejected) | `cureStatus 'all'` | yes |
| `elixir` | `restorePp 10` | no |
| `max_ether` | `restorePp 'full'` | no |
| `rarecandy` | `rareCandy` | no |
| `repel` | `repel 50` | no |
| `lure` | `lure 30` | no |
| `escape_rope` | `escapeRope` | wild only |
| `nugget` / `big_nugget` / `stardust` / `star_piece` | `sellOnly` | no |

The 27 extra held items priced in legacy `shop.js` `HELD_ITEMS_SHOP` (Miracle Seed, Life Orb, Rocky Helmet, Focus Sash …) had no battle effect anywhere in legacy code. They are **not** carried; adding one requires a `HeldItemHook` that core implements.

### 2.7 Stats and stages

```ts
export function calcStat(base: number, level: number): number;   // Math.floor(base * level / 50) + level + 10
export function calcMaxHp(base: number, level: number): number;  // Math.floor(base * level / 50) + level + 20

export type StatStage = -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** atk/def/spd: s >= 0 ? (2 + s) / 2 : 2 / (2 - s). Returned as [num, den] so callers floor(x * num / den). */
export function stageRatio(s: StatStage): readonly [number, number];
/** acc/eva: s >= 0 ? (3 + s) / 3 : 3 / (3 - s), as [num, den]. Evasion is applied inverted by the caller. */
export function accStageRatio(s: StatStage): readonly [number, number];
export function clampStage(n: number): StatStage;
```

Stage table (atk/def/spd), for tests: `-6 → 2/8, -5 → 2/7, -4 → 2/6, -3 → 2/5, -2 → 2/4, -1 → 2/3, 0 → 1, +1 → 3/2, +2 → 4/2, +3 → 5/2, +4 → 6/2, +5 → 7/2, +6 → 8/2`. Accuracy: `-6 → 3/9 … -1 → 3/4, 0 → 1, +1 → 4/3 … +6 → 9/3`. Every stat multiplication in core is `Math.floor(value * num / den)` — integers in, integers out.

### 2.8 CreatureInstance — the persisted truth

```ts
export type VariantKey = 'normal' | 'dawn' | 'dusk' | 'verdant' | 'ember';

export interface MoveSlot { readonly id: string; readonly pp: number; readonly ppMax: number }

export interface CreatureInstance {
  readonly id: string;                 // uuid v4, assigned by persist
  readonly ownerId: string | null;     // uuid of the player; null for a wild/NPC battler projection
  readonly speciesId: string;
  readonly nickname: string | null;    // null = show species name
  readonly level: number;              // 1..100
  readonly exp: number;                // total exp; expToLevel(level) <= exp < expToLevel(level + 1)
  readonly hp: number;                 // 0..calcMaxHp
  readonly moves: readonly MoveSlot[]; // length 1..4
  readonly status: readonly StatusId[];// major statuses mutually exclusive; 'confuse' may coexist
  readonly ability: string;            // one of species.abilities
  readonly heldItem: string | null;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  readonly isShiny?: boolean;          // Phase D4: the 1/512 tier; present (true) only on a shiny, absent otherwise; no battle effect
  readonly caughtAt: { readonly zoneId: string; readonly at: number } | null; // at = unix ms; null = starter/gift
  readonly honor?: number;             // <!-- amended 2026-10-08: the honor ledger, lawlander (#137) --> the honor ledger, -10..10; only a species with an `honor` split keeps one (dustcub, cryptorb <!-- amended 2026-10-24: cryptorb (#139) -->); absent = 0
  readonly bandborn?: true;            // <!-- added 2026-10-21: breeding --> hatched from a Majin-form and a Tenjin-form parent (content daycare.ts): its form answers either band at that band's hp line (`transformError`); absent on every other creature
  readonly ribbons: readonly string[];
  readonly favorite: boolean;
  readonly locked: boolean;            // locked creatures cannot be released, traded or listed
}

/** Enforces the exclusivity rule. Returns a new array; never mutates. */
export function addStatus(status: readonly StatusId[], s: StatusId): readonly StatusId[];
export function removeStatus(status: readonly StatusId[], s: StatusId): readonly StatusId[];
export function majorStatus(status: readonly StatusId[]): MajorStatus | null;
export function hasStatus(status: readonly StatusId[], s: StatusId): boolean;
```

`status` is an **array**. `addStatus` returns the input unchanged if it already holds a major status and `s` is major. Derived stats (`maxHp`, `atk`, `def`, `spd`) are never persisted — they are computed from species + level every time (`projectBattler`, §2.9).

### 2.9 Battler and BattleState

```ts
export interface Volatile {
  readonly confusedTurns: number;    // 0 = not confused
  readonly trappedTurns: number;     // 0 = not trapped
  readonly sleepTurns: number;       // remaining, 0 when not asleep
  readonly flinched: boolean;        // this turn only
  readonly flashFired: boolean;      // Flash Fire triggered; cleared on switch-out
  readonly choiceLockedMove: string | null;
  readonly berryConsumed: boolean;
  readonly weaknessPolicyUsed: boolean;
  readonly lastMove: string | null;
  readonly movedThisTurn: boolean;
}

export interface Battler {
  readonly creature: CreatureInstance;      // hp here is the AUTHORITATIVE current HP
  readonly maxHp: number;                   // calcMaxHp(species.baseHp, level)
  readonly atk: number; readonly def: number; readonly spd: number; // calcStat(...) — unstaged
  readonly stages: Readonly<Record<StatKey, StatStage>>;
  readonly volatile: Volatile;
  readonly participated: boolean;           // was ever active; drives exp share
  readonly form?: string;                   // the species' battleForm.id once changed this battle; absent otherwise (§2.3) <!-- amended 2026-10-08: battle forms (hollowmane's rage form) -->
}

export function projectBattler(c: CreatureInstance, content: ContentIndex): Battler;
/** Phase D14 (battle tower): level min(level, cap) (exp clamped to that level when lowered), full hp, no status, full pp; pure, the input untouched. */
export function capLevel(c: CreatureInstance, cap: number, content: ContentIndex): CreatureInstance;
/** Arena PvP <!-- amended 2026-10-11: arena PvP -->: exactly `level` (raised or lowered; exp = expToLevel(level) when it changes), or the own level when null; full hp, no status, full pp; pure, the input untouched. */
export function atLevel(c: CreatureInstance, level: number | null, content: ContentIndex): CreatureInstance;

export type BattleFormat = 'wild' | 'trainer' | 'league' | 'pvp' | 'raid';
export type SideKind = 'player' | 'wild' | 'npc';

export interface Side {
  readonly kind: SideKind;
  readonly party: readonly Battler[];      // 1..6
  readonly active: number;                 // index into party
  readonly trainerId: string | null;       // player uuid, or content id of the NPC/league trainer
  readonly canFlee: boolean;               // wild: player side true; trainer/league/pvp: false
  readonly canCatch: boolean;              // wild + raid catch window: player side true
  readonly mustSwitch: boolean;            // active fainted and a replacement exists (doubles: a position holds a fainted battler and a bench creature stands)
  readonly consumedItems: readonly string[]; // consumable ids used this battle (raid/pvp limits)
  readonly actives?: readonly [number, number]; // Phase D6, doubles only: party index on field position 0 / 1; `active` mirrors actives[0]
  readonly bands?: readonly BandKind[];  // <!-- amended 2026-10-11: Majin / Tenjin --> the bands this side holds (player: key items majin_band / tenjin_band; NPC: content `bands`); absent = none, state shape unchanged
  readonly transformed?: true;           // <!-- amended 2026-10-11: Majin / Tenjin --> present once this side has used its one transformation this battle
}

export type Terrain = 'none' | 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'shrine' | 'rift';

export interface Field {
  readonly weather: { readonly kind: WeatherKind; readonly turns: number }; // turns remaining incl. current
  readonly terrain: Terrain;   // cosmetic in v1: no rule reads it. Exists so the render arena can dress.
}

export type BattleOutcome =
  | { readonly winner: 0 | 1 }
  | { readonly winner: 'draw' }
  | { readonly winner: 'fled' }                          // side 0 (player) fled
  | { readonly winner: 'caught'; readonly slot: number }; // the wild battler at sides[1].party[slot] was caught

export interface BattleState {
  readonly id: string;
  readonly format: BattleFormat;
  readonly sides: readonly [Side, Side];
  readonly field: Field;
  readonly turn: number;          // 1-based; the first resolveTurn produces turn 1
  readonly rng: RngState;
  readonly ended: BattleOutcome | null;
  readonly zoneId: string;
  readonly slots?: 2;             // Phase D6: present only in a doubles battle; absent = singles (state byte-identical to pre-D6)
  readonly noExp?: true;          // Phase D14: present only in a battle tower fight — no battler gains exp (CreateBattleOpts.noExp); absent = byte-identical to pre-D14
  readonly catchBonus?: Readonly<Record<string, number>>; // Dex research (§30.9.4): catch multiplier per wild species id, present only when one applies; absent = 1 (byte-identical)
}

export interface CreateBattleOpts {
  readonly id: string;
  readonly format: BattleFormat;
  readonly zoneId: string;
  readonly terrain: Terrain;
  readonly seed: RngState | number | string;
  readonly sides: readonly [Omit<Side, 'mustSwitch' | 'consumedItems'>, Omit<Side, 'mustSwitch' | 'consumedItems'>];
  readonly weather?: WeatherKind;      // Phase D7: ambient zone weather — field.weather = { kind, turns: 0 } (turns 0 = no countdown, no weatherTick) and one weatherSet { turns: 0, source: null } before the switch-in hooks; a move's weather replaces it for 5 turns; absent / 'none' = byte-identical state and events (fuzz digests unchanged)
  readonly slots?: 1 | 2;              // Phase D6: 2 = doubles (trainer / league / pvp only; each side needs two standing creatures — its `actives`, else `active` + the lowest other standing one; RangeError otherwise); absent / 1 = singles, byte-identical
}
/** Applies onSwitchIn hooks for both leads (side 0 first) and returns those events. */
export function createBattle(o: CreateBattleOpts, content: ContentIndex): TurnResult;
```

### 2.10 Actions and resolveTurn

```ts
export interface FieldRef { readonly side: 0 | 1; readonly pos: 0 | 1 } // Phase D6: a field position (NOT a party index)

export type Action =
  | { readonly kind: 'move'; readonly move: string; readonly target?: FieldRef; readonly transform?: true } // must be in active.creature.moves with pp > 0; target: doubles only (foe or ally position; absent = first standing foe); transform (<!-- amended 2026-10-11: Majin / Tenjin -->): the battler transforms first (§2.11 step 5b)
  | { readonly kind: 'switch'; readonly to: number }          // party index, not active, hp > 0
  | { readonly kind: 'item'; readonly item: string; readonly target?: number } // consumable id; target = party index (default active)
  | { readonly kind: 'catch'; readonly orb: string }
  | { readonly kind: 'flee' }
  | { readonly kind: 'forfeit' };

export type ActionError =
  | 'battleEnded' | 'unknownMove' | 'noPp' | 'choiceLocked' | 'statusMoveBlocked'
  | 'badSwitchIndex' | 'switchToFainted' | 'switchToActive' | 'trapped'
  | 'unknownItem' | 'itemNotUsableInBattle' | 'badItemTarget'
  | 'cannotCatch' | 'unknownOrb' | 'cannotFlee' | 'cannotForfeit' | 'mustSwitch' | 'actionNotRequired'
  | 'badTarget'    // Phase D6: a doubles move target at the user itself / not a field position
  | 'cannotTransform'; // <!-- amended 2026-10-11: Majin / Tenjin --> transform without a Majin / Tenjin form, without that band, already transformed (battler or side), or the line not met; doubles: two positions of one side in one turn

/** Phase D6: one side's input to resolveTurn — singles an Action / null; doubles one entry per field position (a bare Action = position 0). */
export type SideChoice = Action | null | readonly [Action | null, Action | null];

/**
 * null = valid. Pure. The server calls this before resolveTurn; resolveTurn throws InvalidActionError on an invalid action.
 * `content` is optional: without it every structural check runs; `unknownMove`, `statusMoveBlocked` (Assault Vest needs
 * the move's power), `unknownItem`, `itemNotUsableInBattle`, `badItemTarget` (revive vs fainted) and `unknownOrb` need it.
 * resolveTurn always passes content.
 */
export function validateAction(state: BattleState, side: 0 | 1, action: Action | null, content?: ContentIndex | null, pos?: 0 | 1): ActionError | null; // pos: Phase D6, the doubles position (default 0; ignored in singles)

/** Thrown by resolveTurn. `code: 'battleEnded'` with `side: 0` when called on an ended battle. */
export class InvalidActionError extends Error { readonly side: 0 | 1; readonly code: ActionError }

export interface TurnResult { readonly state: BattleState; readonly events: readonly BattleEvent[] }

/**
 * Pure. Never mutates `state`. Advances rng from state.rng and stores the new state in result.state.rng.
 * `actions[i]` may be null (a) when sides[i].kind !== 'player', in every phase — including a replacement phase in which
 * that wild/NPC side is the one that must switch — or (b) when sides[1-i].mustSwitch && !sides[i].mustSwitch (replacement phase).
 * Wild/NPC sides never pass actions: core chooses for them via chooseNpcAction, deterministically.
 */
export function resolveTurn(
  state: BattleState,
  actions: readonly [SideChoice, SideChoice],   // Phase D6: singles passes Action | null per side (an array throws TypeError); doubles one pair per side
  content: ContentIndex,
): TurnResult;

/** Deterministic NPC policy. Wild: uniform pick among moves with pp > 0. NPC trainer: highest expected damage, rng tiebreak. */
export function chooseNpcAction(state: BattleState, side: 0 | 1, content: ContentIndex, rng: Rng, pos?: 0 | 1): Action; // doubles: position `pos` of chooseNpcDoubles

// Phase D6 — doubles helpers
export function chooseNpcDoubles(state: BattleState, side: 0 | 1, content: ContentIndex, rng: Rng): [Action | null, Action | null];
export function requiredPositions(state: BattleState, side: 0 | 1): (0 | 1)[];
export function validateSideChoice(state: BattleState, side: 0 | 1, choice: SideChoice, content?: ContentIndex | null): { readonly pos: 0 | 1; readonly code: ActionError } | null;
```

Server rule: for `wild`, `trainer`, `league` and `raid`, the server passes `null` for the NPC side and core calls `chooseNpcAction` internally with the battle rng (so the choice is part of the deterministic stream). For `pvp`, both actions must be non-null (or the replacement-phase exception). `validateAction(state, side, null)` is therefore valid for every non-player side in every phase; for a player side `null` is valid only in the replacement-phase exception. <!-- amended 2026-09-25: the resolveTurn comment said "ONLY when … replacement phase", which contradicted this rule; folded packages/core IMPLEMENTATION-NOTES item 14 -->

The §2.20 fuzz digest committed in `packages/core/test/fuzz-digests.json` is, per seed, `fnv1a32` over the joined per-turn `digestBattleState` values (the `createBattle` state first), so it captures every turn, not only the final state (`packages/core/test/fuzz.ts`). <!-- amended 2026-09-25: core IMPLEMENTATION-NOTES item 17 -->

**Sleep counter** (§2.4 `sleep`, §2.11 step 6, as implemented and pinned by the fuzz digests): the counter decrements at the start of every sleeper action, including an action later in the same turn the status landed, and the action that brings it to 0 is taken normally (`statusCured`, then the move). A sleep of `N = 1 + rng.int(3)` therefore skips exactly `N − 1` of the sleeper's actions — 0, 1 or 2 — not `N`. <!-- amended 2026-09-25: core IMPLEMENTATION-NOTES item 15 — the §2.4 row "cannot act for 1 + rng.int(3) turns" read as N skipped actions; changing the feel is a semantics change (fuzz digests), see .design/audits/spec-verification.md -->

**Doubles (Phase D6, `slots: 2`).** <!-- amended 2026-10-06 Phase D6 --> Doubles has its own resolution path; with `slots` absent or 1 nothing above changes and `packages/core/test/fuzz-digests.json` is byte-identical (a 300-seed doubles fuzz is committed separately in `packages/core/test/doubles-fuzz-digests.json`, built by `test/doubles-fuzz.ts` over the legacy fixture with a spread overlay). The rules, each pinned by `packages/core/test/doubles.test.ts`:
- **Field.** `Side.actives` holds the party index on positions 0 and 1 (`active` mirrors position 0). A battler that faints with no bench left stays on its position at hp 0: it takes no action and is skipped by every rule. Event `Ref.slot` stays a party index; `switchIn` / `switchOut` carry `pos` in doubles.
- **Required positions** (`requiredPositions`): in a normal turn every position whose battler stands; in a replacement phase the fainted positions in order, as many as the bench can fill (the player picks only who comes in); while the other side replaces, none. Two positions may not switch to the same creature (`switchToActive`). Catch and flee do not exist in doubles (`cannotCatch` / `cannotFlee`).
- **Order.** Replacement phase as singles (all leavers, all newcomers, then hooks; side 0 position 0 first). Otherwise forfeit (any position forfeits its side; side 0 first) → switches → items → moves, each step across all four positions by priority (moves only) desc, then effective speed desc; each group of exact ties is shuffled with the battle rng (`rng.shuffle`, size − 1 draws).
- **Targets.** A single-target move aims at `Action.target` (foe or ally; not the user), default the first standing foe. A foe target that has fainted retargets to the other standing foe; a fainted ally target fails (`moveFailed { reason: 'noTarget' }`). Self / field status moves take no target.
- **Spread** (`MoveDef.spread`): `'foes'` hits each standing foe, `'all'` each other standing battler (foe pos 0, foe pos 1, ally), in that order; one accuracy roll, damage roll and defender-effect roll per target (`moveUsed.targets` lists them; a per-target failure is `moveFailed { target }`). When 2+ targets are aimed at, each damage is `max(1, floor(dmg × 3 / 4))` after the whole §2.14 pipeline. Attacker-side effects (raise_*, heal, weather, recoil, drain) apply once after the last target with the total dealt, if at least one target was hit. In singles `spread` is ignored.
- **Abilities.** Intimidate lowers every standing foe (one `abilityTrigger`); a battler leaving the field ends every foe's trap.
- **EXP.** Unchanged and unsplit: every participating standing battler of the winning player side gains the full §2.16 yield of each foe that faints; both positions' battlers are participants.
- **NPC policy** (`chooseNpcDoubles`, position 0 first): a replacement takes the bench in ascending order; otherwise per standing position the best (move, target) pair by expected damage — a spread move scores the sum over the foes it reaches (×0.75 at 2+ targets, minus the ally's share for `'all'`) — rng tiebreak; no usable move → the lowest unchosen bench creature (not trapped), else flee / forfeit.

### 2.11 Turn resolution order

1. **Replacement phase.** If any `sides[i].mustSwitch`, only `switch` actions are accepted for that side; the other side's action must be `null`. Switch-ins fire `onSwitchIn`. Turn counter does not advance. Return.
2. **Forfeit / flee.** `forfeit` ends the battle immediately (`ended: { winner: 1 - side }`). `flee` (wild only, side 0 only): fails if `trappedTurns > 0` (`fled` is not emitted; a `moveFailed { reason: 'trapped' }` is, and the wild side still acts); otherwise `ended: { winner: 'fled' }`, return.
3. **Switches**, both sides, ordered by effective speed (§2.13) with rng tiebreak. `onSwitchOut` hooks, then `onSwitchIn`. A switched-out battler's volatile resets to defaults; stages reset to 0.
4. **Items**, same ordering. Item on a fainted target is only `revive`/`max_revive`.
5. **Catch** (side 0 only). Resolve §2.15; on success `ended: { winner: 'caught' }`, return after step 7's end-of-turn is *skipped*. On failure the wild side still acts in step 6.
5b. **Transformations** <!-- amended 2026-10-11: Majin / Tenjin --> — every `move` action carrying `transform: true` (validated: core `transformError`), ordered by effective speed (rng tiebreak only on a full tie), before any move: the side's `transformed` is set, then `formChange` and the form's `onEnter` (negative stages to 0, foes lowered, Tenjin's `statusCured` and `heal { cause: 'form' }`). Move order and priority are then computed from the transformed battler (a signature move's priority, the new speed). Doubles: the same step between items and moves. NPC trainers holding a band transform as soon as `transformError` is null (`chooseNpcAction`, no rng draw); wild sides never choose (a wild Majin changes on its own). <!-- amended 2026-10-21: breeding --> A **bandborn** battler (`creature.bandborn`) also transforms with the other band when that band's hp line is met (a bandborn Majin species at or above half with the Tenjin Band, a bandborn Tenjin species below half with the Majin Band); it changes into its own form either way, once per side as always; `bandsFor(sp, b)` lists the bands that can open it.
6. **Moves**, ordered by `priority` desc, then effective speed desc, then `rng.int(2)`. For each actor in order, if still able: pre-action checks in this order — fainted (skip) → `flinched` (emit `flinch`, skip) → `sleepTurns > 0` (decrement; if still > 0 emit `statusTick { status: 'sleep' }`, skip; if 0 emit `statusCured`) → `freeze` (20 % thaw → `statusCured`; else `statusTick`, skip) → `paralyze` full-para 25 % (`statusTick`, skip) → `confusedTurns > 0` (decrement; if now 0 `statusCured { 'confuse' }`; else 33 % self-hit: `damage { cause: 'confusion' }`, skip). Then PP −1, `moveUsed`, accuracy roll (§2.12), damage (§2.14), effect (§2.4 table), contact hooks, `onSuperEffectiveHit` items, faint checks. The second actor's move is skipped if its own battler fainted; it still resolves if the *target* fainted (retargeting is not needed — the target simply takes no damage and the move emits `moveFailed { reason: 'noTarget' }`).
7. **End of turn**, exactly this order: weather damage (`sand`: 1/16 to non-Rock/Ground/Steel; `hail`: 1/16 to non-Ice) → burn chip 1/16 → poison chip 1/8 → trap chip 1/8 and `trappedTurns − 1` → berries (`Sitrus`, `Oran`) → `Speed Boost` → weather `turns − 1` (at 0 → `weatherEnd`, kind `none`) → faint checks → `mustSwitch` computation → `turn + 1` → `turnEnd`.
8. **Battle end** check: a side with no `hp > 0` battler loses; both → `draw`. Raid: the boss side never has `mustSwitch`; `raid` end conditions are in `30-server-netcode.md` (the room aggregates many players' `resolveTurn` calls against one boss `Side`).

Faint chip damage that KOs is applied in the listed order; a battler that faints from burn does not take the later poison/trap ticks (it cannot hold both anyway) and does not trigger berries.

<!-- reconciled 2026-09-18: folded packages/core IMPLEMENTATION-NOTES items 4, 5, 7–13 — behaviour the first draft left open, now as written -->
Clarifications that are part of the contract (each has a core test):

- **`cannotForfeit`.** A side with `canFlee === true` cannot `forfeit` (it leaves by fleeing); every other side — trainer/league/pvp players, NPC and wild sides — may. `chooseNpcAction` uses this when a side has no usable move and no standing bench: it flees when it may, otherwise forfeits. There is no Struggle in v1; this is what guarantees termination.
- **`chooseNpcAction` never proposes an illegal action**: it filters Assault-Vest-blocked status moves, respects choice lock and does not switch while trapped. Every action it returns passes `validateAction` (asserted by the fuzz).
- **Wonder Guard never stops a status move** (§2.5): in §2.14 step 0 the `power === 0` check runs *before* the Wonder Guard check, so a status move gets no `moveFailed { reason: 'wonderGuard' }`. `amount` is 0 either way.
- **"Always" effects never roll `effectChance`.** `crit`, `first`, `recoil`, `drain`, `heal`, `weather`, `sun` consume no rng draw even if content sets `effectChance < 100`; chance-gated effects draw exactly once when `effectChance < 100` and zero times at 100.
- **Replacement phase with two fainted leads:** both `switchOut`, then both `switchIn` (side 0 first), then `onSwitchIn` hooks (side 0 first) — the same shape as `createBattle`, so an Intimidate sees the replacement actually on the field.
- **`weatherTick`** is emitted at end of turn while weather persists (`turnsLeft` = turns remaining after the decrement); `weatherEnd` when it reaches 0.
- **Flinch** is stored as `volatile.flinched` on the defender only when the defender has not yet acted this turn (`movedThisTurn === false`), consumed at the defender's next pre-action check in the same turn, and cleared at the next `turnStart`.
- **Contact hooks** (Flame Body, Rough Skin, Poison Spores, Iron Barbs) fire only when the move was damaging (`power > 0 && contact`) and the attacker is still standing after its move.

### 2.12 Accuracy

```ts
// hit iff accuracy === null || rng.int(100) < threshold
// threshold = floor(floor(floor(accuracy * accNum / accDen) * evaDen / evaNum) * abilityMul)
//   [accNum, accDen] = accStageRatio(attacker.stages.acc)
//   [evaNum, evaDen] = accStageRatio(defender.stages.eva)      // evasion divides
//   abilityMul: product of every applicable modifyAccuracy hook (attacker side, then defender side), applied as floor(x * mul)
// Exactly ONE rng draw per accuracy check, drawn even when accuracy === null (draw and discard) so event counts stay stable.
```

### 2.13 Effective speed

`spd = calcStat(baseSpd, level)` → `floor(spd * num / den)` for `stages.spd` → `floor(spd * 1.25)` Choice Scarf / `floor(spd * 1.1)` Speed Scarf → `spd * 2` Chlorophyll in sun / Swift Swim in rain → `floor(spd / 2)` if paralyzed. Floors after every step, in that order.

### 2.14 Damage

Written as the code core ships. `L` attacker level, `P` move power, `A`/`D` the staged and item/ability-modified Atk/Def.

```ts
export interface DamageResult {
  readonly amount: number;                          // 0 only on immunity / Wonder Guard
  readonly effectiveness: 0 | 0.25 | 0.5 | 1 | 2 | 4;
  readonly crit: boolean;
  readonly stab: boolean;
  readonly absorbed: 'heal' | 'flag' | 'raiseStat' | null; // typeImmunity reaction that fired
}

export function calcDamage(
  state: BattleState, attackerSide: 0 | 1, move: MoveDef, rng: Rng, content: ContentIndex,
): DamageResult;
```

Order, each step flooring:

```
 0. effectiveness = typeMultiplier(chart, move.type, defender.types)
    if effectiveness === 0                              -> amount 0 (typeChart immunity)   [no rng draw]
    if defender typeImmunity hook matches move.type     -> amount 0, absorbed = reaction   [no rng draw]
    if move.power === 0                                 -> amount 0                        [no rng draw]  // before Wonder Guard: status moves are never "blocked" (§2.11 clarifications)
    if defender wonderGuard && effectiveness < 2        -> amount 0, moveFailed 'wonderGuard' [no rng draw]
 1. A = calcStat(baseAtk, L); A = floor(A * num/den) [stages.atk]; A = floor(A * 1.25) [Choice Band/Specs];
    A = floor(A * 1.5) [Hustle]; A = floor(A * 1.5) [Guts, if majorStatus !== null]
    D = calcStat(baseDef, defLevel); D = floor(D * num/den) [stages.def]; D = floor(D * 1.25) [Assault Vest];
    D = floor(D * 1.5) [Eviolite, if defender species.evolution !== null]
 2. base = floor(floor(floor(2 * L / 5 + 2) * P * A / D) / 50) + 2
 3. stab: if move.type in attacker.types -> dmg = floor(base * 3 / 2) else dmg = base
 4. type: dmg = floor(dmg * effectiveness)                                  (exact: x1/4, x1/2, x2, x4)
 5. crit: critStage = move.effect === 'crit' ? 2 : 0
    critDen = [16, 8, 2][critStage]; crit = rng.int(critDen) === 0            [1 rng draw]
    if crit -> dmg = floor(dmg * 3 / 2)
 6. random: r = 85 + rng.int(16); dmg = floor(dmg * r / 100)                  [1 rng draw]
 7. burn: if attacker has 'burn' and ability lacks Guts -> dmg = floor(dmg / 2)
 8. weather: sun & Fire -> floor(dmg * 3 / 2); sun & Water -> floor(dmg / 2);
             rain & Water -> floor(dmg * 3 / 2); rain & Fire -> floor(dmg / 2)
 9. abilities, attacker side then defender side, in hook-array order:
    modifyDamage { attacker, Fire, flashFired } -> floor(dmg * 3 / 2)
    modifyDamage { defender, [Fire, Ice] }      -> floor(dmg / 2)          (Thick Fat)
10. held items: attacker typeBoost matching move.type -> floor(dmg * 6 / 5)
11. Solid Rock: if effectiveness >= 2 -> floor(dmg * 3 / 4)
12. amount = max(1, dmg)                                                      (only reached when step 0 passed)
```

The min-1 clamp is step 12 and cannot be reached by an immune target — the legacy "×0 still does 1" bug is structurally impossible. `calcDamage` consumes exactly 2 rng draws when it reaches step 5, exactly 0 otherwise; the fuzz test asserts draw counts.

### 2.15 Catch

Gen-3/4 curve. `M` = wild `maxHp`, `H` = wild current hp, `rate` = species.catchRate (halved and floored, min 3, when `isAlpha`), `orb` = orb catchRate × bonus multiplier when the bonus matches, `statusBonus` = 2 for `sleep`/`freeze`, 1.5 for `burn`/`poison`/`paralyze`, 1 otherwise.

```
a = floor((3 * M - 2 * H) * rate * orb * statusBonus / (3 * M))      // orb and statusBonus applied as exact decimal multiplies before the single floor
a = max(1, a)
if a >= 255                       -> caught; emit catchShake 1..3 then catchResult { caught: true }   [0 rng draws]
b = CATCH_B[a]                     // committed 256-entry integer table: CATCH_B[a] = floor(65536 / (255 / a) ** 0.1875), CATCH_B[0] = 0
shakes = 0
repeat 4 times: if rng.int(65536) < b then shakes++ else break         [1..4 rng draws]
emit catchShake { n } for n = 1..shakes (max 3 emitted as shakes; the 4th success is the catch)
caught = shakes === 4
```

`CATCH_B` is generated once by `packages/core/scripts/gen-catch-table.ts`, committed as a literal array and **exported** from `index.ts` (`export const CATCH_B: readonly number[]` — a table, not a second catch formula; the only catch resolution runs inside `resolveTurn`), so `Math.pow` never runs at sim time and the table is engine-independent. <!-- reconciled 2026-09-18: CATCH_B export folded from packages/core IMPLEMENTATION-NOTES item 3 --> The test asserts `CATCH_B.length === 256`, `CATCH_B[0] === 0`, `CATCH_B[255] === 65536`, monotonic non-decreasing, and regenerates the table with `Math.pow` on the CI engine to compare against the committed literal; a mismatch is reported and the literal wins.

Orb consumption: the orb is deducted whether or not the catch succeeds. Catching a creature at full party sends it to the box (`inventoryDelta` + `progressionDelta.dex`).

### 2.16 EXP, levels, evolution

```ts
export const MAX_LEVEL = 100;
/** Total exp required to BE level l. Medium-fast: l^3. expToLevel(1) = 1, expToLevel(100) = 1_000_000. */
export function expToLevel(l: number): number;
/** Level for a total exp value: the largest l in 1..100 with expToLevel(l) <= exp. */
export function levelForExp(exp: number): number;
/** floor(expYield * defeatedLevel / 7), then floor(x * 3 / 2) when the defeated battler belongs to a trainer/league/pvp side. */
export function expGain(defeated: SpeciesDef, defeatedLevel: number, trainerBattle: boolean): number;

export interface LevelUpResult {
  readonly creature: CreatureInstance;      // level/exp/hp updated; hp raised by the maxHp delta
  readonly levelsGained: readonly number[]; // e.g. [12, 13]
  readonly learnable: readonly { readonly level: number; readonly move: string }[]; // moves reached and not yet known
  readonly evolveReady: string | null;      // species id, when level >= evolution.atLevel (branch resolved by ability)
}
export function applyExp(c: CreatureInstance, gained: number, content: ContentIndex): LevelUpResult;

/** Performs the evolution: species swap, nickname kept unless it equalled the old species name, moves kept, hp scaled by new maxHp ratio. */
export function evolve(c: CreatureInstance, into: string, content: ContentIndex): CreatureInstance;
```

Who gains: every battler on the player side *opposite the fainted battler* with `participated && hp > 0` receives the full `expGain` per defeated foe, awarded at the moment of the foe's faint (`expGain` event per recipient). In `pvp` both sides are player sides, so each side's standing participants gain exp when a foe faints. <!-- reconciled 2026-09-18: "winning player side" read as "the player side opposite the fainted battler" (core IMPLEMENTATION-NOTES item 12) --> Level-ups emit `levelUp`; new moves emit `learnMove` (the client offers replace/skip through the server; core never auto-forgets). Evolution is never automatic: `evolveReady` is emitted and the server performs `evolve` on a confirmed `evolveAccept` REST call (§4.7). Exp is capped at `expToLevel(100)`.

### 2.17 Elo

```ts
export interface EloResult { readonly winnerDelta: number; readonly loserDelta: number } // winnerDelta >= 0, loserDelta <= 0
export const ELO_K = 32;
export const ELO_DEFAULT = 1000;
/** expected(a, b) = 1 / (1 + 10 ** ((b - a) / 400)); winnerDelta = round(K * (1 - expected(w, l))); loserDelta = -round(K * expected(l, w)). */
export function eloDelta(winnerRating: number, loserRating: number): EloResult;
/** Draw: both deltas = round(K * (0.5 - expected(self, other))). */
export function eloDrawDelta(a: number, b: number): readonly [number, number];
export const RANK_TIERS: readonly { readonly key: string; readonly label: string; readonly minRating: number }[];
// bronze 0 · silver 1100 · gold 1250 · platinum 1400 · diamond 1600 · master 1800
export function tierFor(rating: number): (typeof RANK_TIERS)[number];
```

Ratings floor at 0. The legacy `Math.max(10, negative)` that paid the loser is gone; `loserDelta` is asserted `<= 0` in tests for 10,000 random rating pairs. Elo runs server-side only; it is not part of `resolveTurn`.

### 2.18 Trainer exp (Battle Pass)

```ts
export type TrainerExpEvent =
  | 'wildWin' | 'catch' | 'catchNewSpecies' | 'trainerWin' | 'gymWin' | 'eliteWin' | 'championWin'
  | 'pvpWin' | 'pvpLoss' | 'raidClear' | 'questComplete' | 'dailyLogin' | 'tradeComplete' | 'zoneRestored';
export const TRAINER_EXP: Readonly<Record<TrainerExpEvent, number>>;
// wildWin 10 · catch 25 · catchNewSpecies 50 (in addition to catch) · trainerWin 40 · gymWin 200 · eliteWin 400
// championWin 1000 · pvpWin 60 · pvpLoss 20 · raidClear 150 · questComplete 100 · dailyLogin 30 · tradeComplete 15 · zoneRestored 500
export function trainerExpFor(e: TrainerExpEvent): number;
/** Linear: level = min(100, floor(exp / 1000) + 1). */
export function trainerLevelFor(exp: number): number;
```

The Battle Pass reward table (100 levels; `money`, `items`, `creature`, `mythicalChoice` at 50) is content, not core (§3.9).

### 2.19 BattleEvent — the animation contract

Every event names the side and slot it concerns so `20-client.md` can build a timeline without re-deriving state. `who: Ref` is `{ side: 0 | 1, slot: number }`.

```ts
export interface Ref { readonly side: 0 | 1; readonly slot: number }

export type BattleEvent =
  | { readonly t: 'turnStart'; readonly turn: number }
  | { readonly t: 'switchOut'; readonly who: Ref; readonly reason: 'action' | 'faint'; readonly pos?: 0 | 1 }   // pos: Phase D6, doubles only
  | { readonly t: 'switchIn'; readonly who: Ref; readonly pos?: 0 | 1 }
  | { readonly t: 'abilityTrigger'; readonly who: Ref; readonly ability: string; readonly detail: string }
  | { readonly t: 'moveUsed'; readonly who: Ref; readonly move: string; readonly target: Ref; readonly ppLeft: number; readonly targets?: readonly Ref[] } // targets: Phase D6, a doubles spread move
  | { readonly t: 'moveMissed'; readonly who: Ref; readonly move: string; readonly target: Ref }
  | { readonly t: 'moveFailed'; readonly who: Ref; readonly move: string | null;
      readonly reason: 'fullHp' | 'noTarget' | 'trapped' | 'noEffect' | 'immune' | 'wonderGuard' }
  | { readonly t: 'damage'; readonly target: Ref; readonly amount: number; readonly hpAfter: number; readonly maxHp: number;
      readonly effectiveness: 0 | 0.25 | 0.5 | 1 | 2 | 4; readonly crit: boolean; readonly stab: boolean;
      readonly cause: 'move' | 'confusion' | 'recoil' | 'burn' | 'poison' | 'trap' | 'sand' | 'hail' | 'contact';
      readonly source: Ref | null; readonly move: string | null }
  | { readonly t: 'heal'; readonly target: Ref; readonly amount: number; readonly hpAfter: number;
      readonly cause: 'drain' | 'move' | 'berry' | 'absorb' | 'regenerator' | 'item' | 'form'; readonly item: string | null } // 'form': <!-- amended 2026-10-11: Majin / Tenjin --> a Tenjin form's healFraction
  | { readonly t: 'statusApplied'; readonly target: Ref; readonly status: StatusId; readonly source: Ref | null; readonly turns: number | null }
  | { readonly t: 'statusBlocked'; readonly target: Ref; readonly status: StatusId; readonly reason: 'type' | 'ability' | 'alreadyStatused' }
  | { readonly t: 'statusTick'; readonly target: Ref; readonly status: StatusId; readonly detail: 'asleep' | 'frozen' | 'paralyzed' | 'confused' }
  | { readonly t: 'statusCured'; readonly target: Ref; readonly status: StatusId; readonly cause: 'timer' | 'thaw' | 'fireHit' | 'item' | 'ability' }
  | { readonly t: 'flinch'; readonly who: Ref }
  // <!-- amended 2026-10-08: battle forms (hollowmane's rage form) --> a battle form (§2.3 BattleFormDef): the new unstaged stats; its onEnter statStage events follow
  | { readonly t: 'formChange'; readonly who: Ref; readonly form: string; readonly atk: number; readonly def: number; readonly spd: number }
  | { readonly t: 'statStage'; readonly target: Ref; readonly stat: StatKey; readonly delta: number; readonly after: StatStage;
      readonly clamped: boolean; readonly source: Ref | null; readonly cause: 'move' | 'ability' | 'item' }
  | { readonly t: 'weatherSet'; readonly kind: WeatherKind; readonly turns: number; readonly source: Ref | null }
  | { readonly t: 'weatherTick'; readonly kind: WeatherKind; readonly turnsLeft: number }
  | { readonly t: 'weatherEnd'; readonly kind: WeatherKind }
  | { readonly t: 'trapped'; readonly target: Ref; readonly turns: number; readonly source: Ref }
  | { readonly t: 'trapEnd'; readonly target: Ref }
  | { readonly t: 'itemUsed'; readonly who: Ref; readonly item: string; readonly target: Ref; readonly consumedHeld: boolean }
  | { readonly t: 'heldItemTrigger'; readonly who: Ref; readonly item: string; readonly consumed: boolean }
  | { readonly t: 'faint'; readonly who: Ref }
  | { readonly t: 'switchRequired'; readonly side: 0 | 1 }
  | { readonly t: 'catchThrow'; readonly orb: string; readonly target: Ref }
  | { readonly t: 'catchShake'; readonly n: 1 | 2 | 3 }
  | { readonly t: 'catchResult'; readonly caught: boolean; readonly target: Ref; readonly shakes: 0 | 1 | 2 | 3 | 4 }
  | { readonly t: 'fled'; readonly side: 0 | 1 }
  | { readonly t: 'forfeit'; readonly side: 0 | 1 }
  | { readonly t: 'expGain'; readonly who: Ref; readonly amount: number; readonly expAfter: number }
  | { readonly t: 'levelUp'; readonly who: Ref; readonly level: number; readonly maxHp: number; readonly atk: number; readonly def: number; readonly spd: number }
  | { readonly t: 'learnMove'; readonly who: Ref; readonly move: string; readonly level: number }
  | { readonly t: 'evolveReady'; readonly who: Ref; readonly into: string }
  // <!-- amended 2026-10-08: the honor ledger, lawlander (#137) --> the honor ledger moved (37 kinds); reason 'dirtyTrick' | 'wildKo' | 'spared' | 'duelWon'
  | { readonly t: 'honor'; readonly who: Ref; readonly delta: number; readonly honorAfter: number; readonly reason: HonorReason }
  | { readonly t: 'turnEnd'; readonly turn: number }
  | { readonly t: 'battleEnd'; readonly outcome: BattleOutcome; readonly turns: number };
```

Rules: `damage` always carries `hpAfter`; the client never computes HP. Every event is JSON-serialisable with no `undefined` — optional-looking fields are `null`. Event order within a turn is exactly the resolution order in §2.11. The `catchShake` count is `min(3, shakes)` events followed by one `catchResult` whose `shakes` is the raw 0..4.

### 2.20 ContentIndex, digest, determinism

```ts
export interface ContentIndex {
  species(id: string): SpeciesDef;          // throws RangeError on unknown id
  move(id: string): MoveDef;
  ability(id: string): AbilityDef;
  item(id: string): ItemDef | ConsumableDef;
  orb(id: string): OrbDef;
  readonly typeChart: TypeChart;
  allSpecies(): readonly SpeciesDef[];      // sorted by dexNumber
}

/** Canonical JSON: object keys sorted ascending by UTF-16 code units, arrays in order, no whitespace, numbers via JSON.stringify. */
export function canonicalJson(value: unknown): string;
/** fnv1a32(canonicalJson(state)) as 8 lowercase hex chars. Carried on every battleEvents wire message (§4.5). */
export function digestBattleState(state: BattleState): string;
```

**Determinism contract.** For any `(state, actions, content)`: `canonicalJson(resolveTurn(state, actions, content))` is byte-identical on every engine, every run. `resolveTurn` performs no iteration over object keys except through `Object.keys(x).sort()`; no `Map`/`Set` iteration reaches output order; no floating-point value reaches state except `effectiveness` (drawn from the closed set `{0, 0.25, 0.5, 1, 2, 4}`) and the `stageRatio` fractions, which are consumed by `Math.floor` before storage.

The fuzz test, `packages/core/test/fuzz.test.ts`:

```ts
export function fuzzBattles(opts: {
  readonly seeds: number;           // 1000 in CI
  readonly content: ContentIndex;
  readonly maxTurns: number;        // 200; a battle hitting it is a failure
}): { readonly battles: number; readonly turns: number; readonly digests: readonly string[] };
// For each seed: build two random 1..6-creature parties from allSpecies(), levels 5..100, random held items/abilities,
// random format among the five; drive both sides with chooseNpcAction over a forked rng; assert
//   (a) every action passes validateAction before resolveTurn,
//   (b) resolveTurn(state, a) called twice yields identical canonicalJson,
//   (c) replaying from turn 0 with the recorded actions reproduces every digest,
//   (d) no battler hp < 0 or > maxHp, no stage outside -6..6, no pp < 0,
//   (e) the battle ends within maxTurns.
// The 1000 digests are written to test/fuzz-digests.json; a change to that file in a PR is the signal that battle semantics changed.
```

M0's exit criterion in `PLAN.md` ("a headless battle between two seeded teams resolves identically on client and server 1,000 times") is this test run once in Node and once in a browser worker (Playwright) with the digests compared.

### 2.21 Replays <!-- added 2026-10-20: battle replays -->

```ts
/** One resolved step of a replay: the choices fed to resolveTurn and what they produced. */
export interface ReplayStep {
  readonly choices: readonly [SideChoice, SideChoice];
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly digest: string;
}

export interface ReplayRun {
  readonly start: { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly digest: string };
  /** one entry per resolveTurn call (a replacement phase is its own step, so steps can outnumber `turn`) */
  readonly steps: readonly ReplayStep[];
  /** the digest of the last state (the start's when there are no steps) */
  readonly finalDigest: string;
}

export function replayBattle(opts: CreateBattleOpts, choices: readonly (readonly [SideChoice, SideChoice])[], content: ContentIndex): ReplayRun;
```

`replayBattle` is `createBattle` then one `resolveTurn` per recorded choice pair, digesting every state. Pure (the determinism contract above), so the server's `battle_history` row (`start` + `seed` + `actions`) replays to its `final_digest` anywhere, and a shared replay (§4.7 `GET /replay/:token`) plays in the client exactly as it happened. Core never reads `trainerId`, `ownerId` or a creature `id` for a rule, so a replay with those ids replaced (anonymised) plays out the same; only the digest differs.

---

## §3 @ewa/content SCHEMA

`packages/content/src/` holds typed data files plus `schema.ts` (zod v4 schemas mirroring every interface in §2 and this section) and `validate.ts`. `pnpm --filter @ewa/content build` runs `validate.ts`; any failure fails the build. Content exports `createContentIndex(): ContentIndex` and the raw typed tables. Nothing in content is loaded at runtime from disk or network — it is a compiled module.

### 3.1 Zone record — the ~15-field authoring shape

```ts
export type ZoneId =
  | 'mirevale' | 'mire_route' | 'cinderhold' | 'ash_route' | 'saltmourn' | 'tide_route'
  | 'stormrook' | 'galvan_route' | 'marrowdig' | 'deepcut_route' | 'vesperveil' | 'hollow_route'
  | 'forgewall' | 'siege_route' | 'skyrend' | 'ascent_route' | 'solenne' | 'eclipse_shrine'
  | 'umbral_observatory' | 'celestial_spire' | 'the_rift';
export const ZONE_ORDER: readonly ZoneId[]; // the 21 above, in that order

export type Biome = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';
export type BadgeId = 'bloom' | 'ember' | 'current' | 'circuit' | 'fault' | 'wraith' | 'anvil' | 'ascend';
export type HarvestState = 'intact' | 'thinning' | 'harvested';
export type Act = 1 | 2 | 3;

export interface NpcDef {
  readonly id: string; readonly name: string; readonly x: number; readonly z: number;
  readonly look: string;                       // character model id (render descriptor key)
  readonly lines: readonly string[];
  readonly when: string | null;                // story flag required to appear
  readonly until: string | null;               // story flag that removes them
  readonly react: readonly { readonly when: string; readonly lines: readonly string[] }[];
  readonly tutor?: readonly string[];          // Phase D2: move ids this NPC teaches for MOVE_TUTOR_PRICE (3000); data only, x/z alone feed the layout
}
export interface TrainerDef {
  readonly id: string; readonly name: string; readonly x: number; readonly z: number; readonly look: string;
  readonly team: readonly { readonly species: string; readonly level: number }[]; // 1..6
  readonly lines: readonly string[]; readonly reward: number; readonly rematchDays: number | null;
  readonly doubles?: true;   // Phase D6: fights 2-on-2 (team ≥ 2; the player needs 2 usable creatures, else singles); never a gate
  readonly bands?: readonly BandKind[]; // <!-- amended 2026-10-11: Majin / Tenjin --> the trainer fights with these bands (shipped: reeve_observatory, hollis_siege, varn_spire — majin)
}
export interface GroundItemDef { readonly id: string; readonly x: number; readonly z: number; readonly item: string; readonly qty: number }
export interface LoreTabletDef { readonly id: string; readonly x: number; readonly z: number; readonly title: string; readonly text: readonly string[] }
/** An in-zone teleport pair (building door ↔ interior sub-area). `interact { kind: 'warp' }` within 3 m of (x, z) moves the player to (toX, toZ). */
export interface WarpDef { readonly id: string; readonly x: number; readonly z: number; readonly toX: number; readonly toZ: number; readonly label: string }

export interface ZoneDef {
  readonly id: ZoneId;
  readonly name: string;
  readonly kind: 'town' | 'route' | 'story';
  readonly biome: Biome;
  readonly type: TypeName | null;              // the zone's signature type; null for solenne/the_rift
  readonly palette: string;                    // palette id in render descriptors (10-render.md)
  readonly layoutSeed: number;                 // uint32; the zone rebuilds identically from it
  readonly signature: string;                  // the one unique set-piece id for this zone
  readonly spawn: { readonly x: number; readonly z: number }; // authored point (the heightfield's clearings and pond placement are seeded around it); must be walkable. mirevale: { x: 0, z: 6 }. Arrivals without an edge crossing use `arrivalPoint(id)` (below)
  readonly links: Readonly<Partial<Record<'n' | 'e' | 's' | 'w', ZoneId>>>;
  readonly gate: BadgeId | null;               // badge required to ENTER this zone
  readonly encounterTable: string | null;      // EncounterTable id; null = no wild spawns
  readonly npcs: readonly NpcDef[];
  readonly trainers: readonly TrainerDef[];
  readonly items: readonly GroundItemDef[];
  readonly lore: readonly LoreTabletDef[];
  readonly warps: readonly WarpDef[];          // [] for most zones
  readonly shop: readonly string[] | null;     // consumable/orb ids in stock; null = no shop
  readonly healer: boolean;
  readonly gym: string | null;                 // gym id
  readonly storyRole: Readonly<Record<Act, string | null>>; // one-line role per act, or null
  readonly harvestState: HarvestState;         // the zone's DEFAULT; the effective state is per player, from story flags (§3.5 harvestStateFor)
  readonly obstacles?: readonly ObstacleDef[];  // Phase D10: Cut / Strength obstacles; absent = none
}

/** Phase D10 (data/obstacles.ts, merged into ZONES). x/z never feed the layout: not an authored point (no clearing, no building moves). */
export interface ObstacleDef {
  readonly id: string;                          // `<zoneId>.<name>`; cleared flag `obstacle:<zoneId>:<id>` (content `obstacleFlag`)
  readonly kind: 'tree' | 'boulder';            // tree: HM Cut + a Grass / Bug / Steel / Dark member; boulder: HM Strength + a Fighting / Rock / Ground / Steel member
  readonly x: number; readonly z: number;
  readonly item?: { readonly item: string; readonly qty: number };   // hidden behind / under it, granted once with the clearing
}
```

**Obstacles** (Phase D10) <!-- amended 2026-10-06: Phase D8–D11 world systems --> — shortcuts and treasure only, never a story gate. The disc `OBSTACLE_RADIUS[kind]` (tree 0.7 m, boulder 0.95 m) + the 0.35 m capsule is stamped `walkable = 0` as the **last** step of the heightfield build (§3.11), on samples that were still walkable, and the stamp records which obstacle owns each sample (`ZoneSurface.obstacleCells`, `obstacleAt(h, x, z)`); zones without obstacles are byte-identical. A player who holds the cleared flag stands on exactly those samples again (server `standable`, client collider) — per player; others still see the prop. Validate: unique ids, a known kind and item, inside ±(interior − 4 m), outside every interior pocket, ≥ 6 m from every authored point, a non-empty stamp, reachable from the spawn within `OBSTACLE_INTERACT_M` = 3 m — and every other reachability rule runs on the stamped field, so no story target can sit behind one. Shipped: `mire_route.thicket` (tree), `tide_route.driftwood` (tree), `deepcut_route.rockfall` + `.cairn` (boulders), `hollow_route.briar` (tree) + `.tomb_stone` (boulder), `ascent_route.scree` (boulder), each hiding an item.

**Spawn and arrival point** <!-- amended 2026-10-06: town arrival point (M3 render audit §1, M3-all-2) --> — `spawn` is an authored point like an npc or a warp: `buildHeightfield` flattens a dry clearing round it and keeps ponds off it (§3.11), so moving it reshuffles ponds → roads → buildings → interiors → the zone plan's R1 fixture and the progression walker's recorded legs. It therefore stays where it is — on the west road at `(−50, 0)` (`saltmourn` `(−50, −6)`) in eight of the nine towns, 50 m from the plaza, `(−92, 0)` on routes — and the place a player **arrives** without crossing an edge is derived instead: `arrivalPoint(zoneId): { zoneId, x, z, angle, rule }` (content `arrival.ts`, memoised; `arrivalPointFor(zone, surface)` is the pure form). **Mirevale**: its spawn `(0, 6)` exactly (already on its plaza). **Other towns**: the first of the candidates on a ring of radius `plaza.r − 3` (= 11 m) round the plaza centre, due south `(0, 11)` first then ±30° steps round the ring (`0°, 30°, −30°, 60°, … 180°` from +z), whose nearest sample — else the nearest walkable sample within 2 m — is walkable with its 8 neighbours, in the 4-neighbour walkable component of the spawn, inside the plaza, outside every pocket footprint and plan solid, ≥ 1 m outside the set-piece's keep-clear extent, and ≥ `ARRIVAL_CLEARANCE_M` = 2.5 m from every authored point (spawn, npcs, trainers, items, lore, warps and their targets, pocket door warps, statics, raid hotspots, obstacles). **Routes and story zones**: their spawn. `angle` faces the plaza centre in towns (protocol heading `atan2(dx, dz)`, wrapped to [−π, π)) and is 0 elsewhere. The arrival point is **not** an authored point — nothing in the layout keeps it clear, it picks ground that already is — so no digest, plan or fixture changes. Shipped: `mirevale (0, 6)`; `stormrook`, `marrowdig` `(0, 11)` (facing −π); `cinderhold`, `saltmourn`, `vesperveil`, `forgewall`, `skyrend`, `solenne` `(5.5, 9.5)` (30°, facing −2.6168; a market stall stands at ≈ `(−2, 9.5)` in front of `(0, 11)`). Used by fast travel (§4.6), the escape rope and a fallback join (`30-server-netcode.md` §30.2.2 `onJoin` step 3, §30.6.3) and by the `spawn-noon` audit anchor (`50-verification-budget.md` §50.6.1); an edge handover keeps its own entry point (§30.2.7). Validate (rule 12): every zone's arrival point is walkable and reachable from its spawn.

<!-- reconciled 2026-09-18: ZoneDef gains `spawn` (30-server-netcode.md OQ 4) and `warps` (the `warp` InteractMsg kind had no data); `shop`/`healer`/`gym` already existed -->
Zone extents (one table, used by content's heightfield, the server's bounds check and render's `ZoneSpec.size`): the heightfield is a square field of **160 m (town) · 240 m (route) · 200 m (story)**; the outer **16 m** on every side is scenery with `walkable = 0`; the playable interior is therefore **±64 (town) · ±104 (route) · ±84 (story)** and every authored coordinate (`npcs`, `trainers`, `items`, `lore`, `warps`, `spawn`, statics, raid hotspots) must lie inside it — `validate.ts` snaps a coordinate on or outside the interior inward with `nearestWalkable(h, x, z, 8)` and fails when none is found. <!-- reconciled 2026-09-18: 20-client.md §20.4.4 (±64 / 128×64 / ±48), 10-render.md §10.5.1 (128×128 / 256×128 / 96×96) and 30-server-netcode.md §30.2.3 (160 / 240 / 200) disagreed; the server's field sizes stand because roster-coverage.md's static/hotspot coordinates (z up to 104 on routes, 84 in story zones) need them -->

The 21 rows' fixed columns (everything else is authored freely):

| id | kind | biome | type | gate |
|---|---|---|---|---|
| mirevale | town | grove | Grass | null |
| mire_route | route | grove | Grass | null |
| cinderhold | town | cinder | Fire | bloom |
| ash_route | route | cinder | Fire | bloom |
| saltmourn | town | salt | Water | ember |
| tide_route | route | salt | Water | ember |
| stormrook | town | storm | Electric | current |
| galvan_route | route | storm | Electric | current |
| marrowdig | town | marrow | Rock | circuit |
| deepcut_route | route | marrow | Rock | circuit |
| vesperveil | town | vesper | Ghost | fault |
| hollow_route | route | vesper | Ghost | fault |
| forgewall | town | forge | Steel | wraith |
| siege_route | route | forge | Steel | wraith |
| skyrend | town | sky | Dragon | anvil |
| ascent_route | route | sky | Dragon | anvil |
| solenne | town | capital | null | ascend |
| eclipse_shrine | story | shrine | Cosmic | ascend |
| umbral_observatory | story | vesper | Ghost | wraith |
| celestial_spire | story | shrine | Cosmic | ascend |
| the_rift | story | rift | null | ascend |

Legacy `mire_route` carried `gate: 'bloom'` on the *route*, locking the first route until the first badge. Here the gate sits on the zone *after* the gym's route, so a fresh player can reach Mire Route. `validate.ts` asserts: (a) every `links` edge is symmetric (`A.links.e === B ⇒ B.links.w === A`); (b) every zone is reachable from `mirevale` ignoring gates; (c) the 8 badges appear as gates in `ZONE_ORDER` order; (d) `layoutSeed` unique.

### 3.2 Encounter tables

```ts
export type EncounterTier = 'common' | 'uncommon' | 'rare' | 'alpha';
export interface EncounterSlot {
  readonly species: string; readonly weight: number; readonly levelMin: number; readonly levelMax: number;
  readonly timeOfDay: 'day' | 'night' | 'any'; readonly tier: EncounterTier;
  readonly medium?: 'land' | 'water';  // default 'land'. 'water' slots spawn on a Heightfield `water` sample and can be engaged only from a water sample (HM Surf, fieldVerb 'surf', or a boardwalk cell the layout marks both walkable and water); they are also what the Old Rod rolls (`fish`, §4.3; Phase D9) — every non-lava zone with a table and open water has at least one (Phase D8 added mire_route mossling / mudbub, skyrend tidalfang, umbral_observatory wraithtide)
}
export interface EncounterTable { readonly id: string; readonly zoneId: ZoneId; readonly slots: readonly EncounterSlot[] }
/** Table id convention `enc_<zoneId>`. Exactly 15: the 8 routes, the 3 town tables (saltmourn, skyrend, solenne) and the 4 story tables (eclipse_shrine, umbral_observatory, celestial_spire, the_rift). The 6 other towns have `encounterTable: null`. */
export const ENCOUNTER_TABLES: readonly EncounterTable[];
export const ALPHA_CHANCE = 0.02;      // per spawn roll, independent of tier weights
export const VARIANT_CHANCE = 0.03;    // per spawn roll; palette uniform over the 4 non-normal keys

/** `badge:<BadgeId>` or `flag:<story flag>`; the server re-checks the gate on every `interact { kind: 'static' }`. */
export type StaticGate = `badge:${BadgeId}` | `flag:${string}`;
export interface LegendaryStatic {
  readonly species: string;            // one of the 8 non-mythical legendaries, each exactly once
  readonly level: number;
  readonly zoneId: ZoneId;
  readonly x: number; readonly z: number;   // authored inside the playable interior (§3.1); snapped with nearestWalkable(h, x, z, 8) at validate
  readonly flag: string;               // set on win OR catch; the static never appears again for that player
  readonly when: StaticGate;
}
export const LEGENDARY_STATICS: readonly LegendaryStatic[];   // exactly 8 rows — the table in .design/roster-coverage.md §7 with galaxion's gate `flag:ledger_read` from .design/story-bible.md §7.2

/** Spawn cadence per zone kind; 30-server-netcode.md §30.3 consumes these verbatim. */
export interface SpawnTuning { readonly targetCount: number; readonly respawnMinMs: number; readonly respawnMaxMs: number; readonly lifetimeMs: number; readonly engagedTimeoutMs: number }
export const ROUTE_TUNING: SpawnTuning = { targetCount: 80, respawnMinMs: 1_500, respawnMaxMs: 3_500, lifetimeMs: 300_000, engagedTimeoutMs: 90_000 };   // amended 2026-10-08: was 14 / 8–20 s / 180 s
export const TOWN_SPAWN_TUNING: SpawnTuning = { targetCount: 20, respawnMinMs: 2_000, respawnMaxMs: 5_000, lifetimeMs: 300_000, engagedTimeoutMs: 90_000 };   // amended 2026-10-08: was 4 / 8–20 s / 180 s
export const STORY_TUNING: SpawnTuning = { targetCount: 36, respawnMinMs: 2_000, respawnMaxMs: 5_000, lifetimeMs: 300_000, engagedTimeoutMs: 90_000 };   // amended 2026-10-08: was 6 / 12–30 s / 180 s
```

<!-- reconciled 2026-09-18: roster-coverage.md amendments A1 (4 story tables + STORY_TUNING) and A2 (`medium`, Heightfield `water`) accepted; LegendaryStatic/StaticGate moved here from roster-coverage §4.2 so content owns the shape (§3.10 rule 7 referenced a record no section defined) -->
Spawn rolling is a server concern (`30-server-netcode.md`) but uses core's `Rng` and this table: weight-proportional pick over slots matching the current `timeOfDay`, level uniform in `[levelMin, levelMax]`. A wild battler's ability is `species.abilities[rng.int(abilities.length)]`, one draw from the spawn's rng at spawn time (roster-coverage A3: makes the `Lightning Rod → aonred` / default `→ darkyon` split reachable from a wild `darkone`).

### 3.3 League

```ts
export interface LeagueTrainer {
  readonly id: string;                 // 'verdant_gym' … 'draco_gym', 'veil', 'aurelia', 'kirei', 'zeon'
  readonly stage: 'gym' | 'elite' | 'champion';
  readonly order: number;              // gyms 1..8, elite 1..3, champion 1
  readonly name: string; readonly title: string; readonly look: string;
  readonly type: TypeName;
  readonly badge: BadgeId | null;      // gyms only
  readonly zoneId: ZoneId;             // gym: its town; elite/champion: 'solenne'
  readonly pre: readonly string[]; readonly post: readonly string[];
  readonly team: readonly { readonly species: string; readonly level: number; readonly nickname: string | null; readonly ability: string | null; readonly heldItem: string | null }[];
  readonly reward: number;
  readonly setsFlags: readonly string[];
  readonly mid?: { readonly halfHp: string; readonly lastStand: string };   // added 2026-10-06 (Phase B7): mid-battle lines, ≤ 140 chars, all 12 rows
  readonly doubles?: true;             // Phase D6: fights 2-on-2 (draco_gym, aurelia); see TrainerDef.doubles
  readonly bands?: readonly BandKind[]; // <!-- amended 2026-10-11: Majin / Tenjin --> see TrainerDef.bands (shipped: veil majin, aurelia tenjin, zeon majin)
}
export const LEAGUE: readonly LeagueTrainer[];  // 12 entries; champion id is exactly 'zeon'
export const BADGES: readonly { readonly id: BadgeId; readonly name: string; readonly type: TypeName; readonly gym: string }[];
```

`validate.ts`: 8 gyms with the 8 badges in `BadgeId` order; 3 elite; exactly one champion with `id === 'zeon'` (the legacy `defeatedSet.has("goku")` check is not reproducible here — there is no `goku`). Gym team levels are monotonically non-decreasing across `order`.

**Post-game (Phase D14, amended 2026-10-06).** Everything below unlocks with `champion:zeon:beaten` (`POSTGAME_FLAG`) and is never a story gate:

```ts
export interface LeagueRematch {
  readonly leagueId: string;                       // = LeagueTrainer.id; exactly one row per LEAGUE entry
  readonly team: readonly LeagueTeamMember[];      // Lv 65–75 (LEAGUE_REMATCH_LEVELS); a legendary only if the original team carries it
  readonly pre: readonly string[]; readonly post: readonly string[];   // the rematch prompt / the line after a won rematch
  readonly reward: number;                         // = round(LeagueTrainer.reward × LEAGUE_REMATCH_REWARD_MULTIPLIER 1.5)
}
export const LEAGUE_REMATCH: readonly LeagueRematch[];          // 12 rows
export const LEAGUE_REMATCH_COOLDOWN_DAYS = 1;                   // between two rematch WINS against the same trainer
export function leagueRematchFlag(leagueId: string): string;     // `league:<id>:rematchAt` — server bookkeeping, cleared + re-set on every rematch win so its set time moves
export const POSTGAME_FLAG = 'champion:zeon:beaten';
export interface TowerDef {
  readonly levelCap: 50; readonly teamSize: 3; readonly setLength: 7;
  readonly attendantId: 'solenne.league.tower';    // the league hall foyer's InteriorNpc, role 'tower'
  readonly trainerId: 'tower.challenger'; readonly trainerName: 'Tower Challenger';
  readonly pools: readonly (readonly string[])[];   // 4 tiers of non-legendary fully evolved species, banded by base-stat total
}
export const TOWER: TowerDef;
export function towerTier(wins: number): number;                 // min(pools.length − 1, floor(wins / setLength))
export function towerSetReward(set: number): { money: number; items: Record<string, number> };   // money 2 500 × set (≤ 15 000) + items
```

`validate.ts` adds: one rematch per league row, levels in range, reward ×1.5, legendary rule, nickname ≤ 16; every tower pool ≥ 6 species, all known and non-legendary; every set-reward item known. The bind-set cap (§3.10 rule 11) is unchanged — rematch and tower teams are battle-only.

### 3.4 Quests

```ts
export type QuestObjective =
  | { readonly kind: 'reachZone'; readonly zoneId: ZoneId }
  | { readonly kind: 'catchSpecies'; readonly count: number }
  | { readonly kind: 'catchSpecific'; readonly species: string }
  | { readonly kind: 'defeatTrainer'; readonly trainerId: string }
  | { readonly kind: 'winBattles'; readonly format: BattleFormat | 'any'; readonly count: number }
  | { readonly kind: 'talkTo'; readonly npcId: string }
  | { readonly kind: 'deliverItem'; readonly item: string; readonly qty: number; readonly npcId: string }
  | { readonly kind: 'flag'; readonly flag: string }
  | { readonly kind: 'earnBadge'; readonly badge: BadgeId }
  | { readonly kind: 'restoreZone'; readonly zoneId: ZoneId }
  // Phase D5 achievements; dexCaught / loginStreak are absolute (progress = the event's value, max-merged)
  | { readonly kind: 'dexCaught'; readonly count: number }
  | { readonly kind: 'catchTier'; readonly tier: 'alpha' | 'shiny'; readonly count: number }
  | { readonly kind: 'completeTrades'; readonly count: number }
  | { readonly kind: 'clearRaids'; readonly count: number }
  | { readonly kind: 'loginStreak'; readonly days: number };

export type QuestKind = 'story' | 'achievement';   // Phase D5

export interface QuestDef {
  readonly id: string; readonly title: string; readonly summary: string;
  readonly kind?: QuestKind;           // Phase D5; absent = 'story'. 'achievement' rows: giver null, requires [], money/item rewards only
  readonly giver: string | null;       // npc id; null = auto-offered
  readonly zoneId: ZoneId;
  readonly act: Act;
  readonly requires: readonly string[]; // quest ids that must be complete
  readonly objectives: readonly { readonly id: string; readonly label: string; readonly objective: QuestObjective }[];
  readonly rewards: { readonly money: number; readonly items: Readonly<Record<string, number>>; readonly creature: { readonly species: string; readonly level: number } | null; readonly flag: string | null };
}
export const QUESTS: readonly QuestDef[];            // the 14 story quests <!-- amended 2026-10-25: the Elemutt line (#142–144) --> (q13 gives elemutt, q14 the Vial of Spirit Water), then the 30 ACHIEVEMENTS (Phase D5)
export const ACHIEVEMENTS: readonly QuestDef[];      // Phase D5: dex 10/30/60/90/145 <!-- amended 2026-10-13: hyoryu (#138) --> <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> <!-- amended 2026-10-25: the Elemutt line (#142–144) --> <!-- amended 2026-10-26: kykaiser (#145) --> (all species; id `ach_dex_130` kept), catches 1/10/50/200, alpha, shiny, wins 10/100/500, trainer 50, PvP 1/25, 8 badges, 12 league trainers, champion, 9 statics <!-- amended 2026-10-13: hyoryu (#138) -->, trades 1/10/50, raids 1/10/50, streaks 7/30/100
export const STORY_QUESTS: readonly QuestDef[];      // QUESTS without the achievements
```

Every `zoneId` is a `ZoneId`; the legacy quests keyed to `bloom-route`/`ember-town` (which never fired) are not carried.

### 3.5 Story beats

```ts
export interface StoryBeat {
  readonly id: string;
  readonly act: Act;
  readonly zoneId: ZoneId;
  readonly need: readonly string[];    // flags; 'badge:<BadgeId>' is sugar for the badge flag
  readonly set: readonly string[];     // flags set when the beat completes
  readonly speaker: string;            // npc id or league id
  readonly lines: readonly string[];
  readonly battle: { readonly trainerId: string } | null;   // a TrainerDef id or LeagueTrainer id
  readonly after: readonly string[];   // lines after the battle / on completion
  readonly harvest: { readonly zoneId: ZoneId; readonly to: HarvestState } | null; // the beat changes a zone's render state
  readonly starter: boolean;           // exactly one beat has this
  readonly grant?: Readonly<Record<string, number>>; // Phase D1: items added when the beat completes (same transaction), sent as inventoryDelta; never a gate. <!-- amended 2026-10-11: Majin / Tenjin --> sables_turn grants majin_band, the_requisition tenjin_band (key items, never sold)
}
export const STORY: readonly StoryBeat[];

/** The done marker the server writes to story_flags when a beat completes. Content never authors a flag with this prefix. */
export function beatDoneFlag(beatId: string): string;                              // `beat:${beatId}:done`
/** The first beat in STORY order with this zoneId whose every `need` is satisfied by `flags` and whose done flag is absent; null when none. `badge:<id>` sugar reads `badge:<id>` in `flags` (the server materialises badges as flags for this call). */
export function nextStoryBeat(zoneId: ZoneId, flags: ReadonlySet<string>): StoryBeat | null;
/** The player's effective HarvestState for a zone: the LAST beat in STORY order whose `harvest.zoneId === zoneId` and whose done flag is in `flags` wins; otherwise ZONES_BY_ID[zoneId].harvestState. Pure; the client and the server call the same function. */
export function harvestStateFor(zoneId: ZoneId, flags: ReadonlySet<string>): HarvestState;
```

<!-- reconciled 2026-09-18: story-bible.md §5.1.2/§11.3 left `nextStoryBeat` and the done-marker spelling to the server, and no section defined either; harvest is per player because the world is shared (one player's Act II cannot flatten Mire Route for everyone) — see §4.1 -->
**The beats themselves come from `.design/story-bible.md`** (the story deliverable in `PLAN.md`); this schema is the shape they are entered in. Runtime (`30-server-netcode.md` §30.4.8): a beat fires on `interact { kind: 'npc' | 'gym' }` with the beat's `speaker`; `set` flags, `harvest` and the done flag are written by the server after the beat's battle (if any) is won, and reach the client as `progressionDelta.flags`. Harvest is **per player**: the room's `ZoneState.harvestState` is only the content default; each client renders `harvestStateFor(zone, ownFlags)`. The legacy `STORY` array (Lumyth/Eclipse Order plot) is not carried. `validate.ts` asserts: exactly one `starter`; every `need` flag is either a `badge:` or appears in some `set`, `QuestDef.rewards.flag`, or `LeagueTrainer.setsFlags`; beats within a zone are acyclic in `need`/`set`; every act 1..3 has ≥ 1 beat; at least one beat sets `harvest.to: 'harvested'` and at least one sets `'intact'` for the same zone (the restoration arc is data, not code).

### 3.6 Live-ops

```ts
export interface SeasonalEvent {
  readonly id: string; readonly name: string; readonly description: string;
  readonly startsAt: string; readonly endsAt: string;        // ISO-8601 UTC
  readonly alphaBonus: number; readonly variantBonus: number; // added to ALPHA_CHANCE / VARIANT_CHANCE
  readonly featuredZones: readonly ZoneId[]; readonly featuredSpecies: readonly string[];
}
export interface DailySwarm { readonly id: string; readonly zoneId: ZoneId; readonly species: readonly string[]; readonly weightBoost: number }
export interface RaidHotspot {
  readonly id: string; readonly zoneId: ZoneId; readonly x: number; readonly z: number;
  readonly boss: { readonly species: string; readonly level: number; readonly hpMultiplier: number };
  readonly minBadges: number; readonly window: { readonly utcHour: number; readonly minutes: number };
}
export const SEASONAL_EVENTS: readonly SeasonalEvent[];
export const DAILY_SWARMS: readonly DailySwarm[];       // 7 entries, one per weekday index 0..6, zone in ZONE_ORDER
export const RAID_HOTSPOTS: readonly RaidHotspot[];
export const WEEKDAY_VARIANT: Readonly<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, VariantKey | null>>; // Mon dawn, Tue dusk, Wed verdant, Thu ember
```

All keyed to `ZoneId`. The legacy tables referenced `pallet_town`, `route_21`, `victory_road` — retired ids — which is why none ever fired.

### 3.7 Variant palettes

```ts
export const VARIANT_PALETTES: Readonly<Record<VariantKey, { readonly hue: number; readonly saturation: number; readonly lightness: number } | null>>;
// normal null · dawn { 18, 1.08, 1.04 } · dusk { 204, 1.10, 0.95 } · verdant { 110, 1.12, 1.05 } · ember { -18, 1.15, 1.02 }
```

These four triples become the sprite material's uniforms (`10-render.md`); no pixel is re-baked.

### 3.7a Shiny palettes <!-- added 2026-10-26: per-species shiny colours -->

```ts
export const SHINY_DERIVED: Readonly<Record<string, VariantPalette>>;   // one per evolution family root, generated
export const SHINY_TUNING: Readonly<Record<string, VariantPalette>>;    // hand-tuned, by family root or species id
export const SHINY_FALLBACK: VariantPalette;                            // { 160, 1.10, 1.00 }: a family not derived yet
export function shinyPaletteOf(speciesId: string): VariantPalette;      // TUNING[id] ?? TUNING[root] ?? DERIVED[root] ?? FALLBACK
```

A shiny wears its family's triple **in place of** its variant's (a shiny dusk creature looks like every other shiny of its species; the variant stays on the record, the dex and the market). Same shape and units as §3.7: hue in degrees (the `hue()` rotation about the grey axis), saturation and lightness multipliers; the billboard writes it through the same three per-object values, so a shiny adds no uniform, material or pixel. `pnpm --filter @ewa/sprite-pipeline shiny` derives `SHINY_DERIVED` from the committed thumbnails: the chroma-weighted dominant hue of the family's members is carried onto one of eight target hues (gold, lime, jade, cyan, azure, violet, magenta, rose), chosen by a hash of the root among those whose shift keeps ≥ 30° from every §3.7 hue (0, ±18, 110, 204); a family with mean chroma under 0.10 also gets saturation 1.6 and lightness 1.3 (dark) or 0.85 (light). Content `shiny.test.ts`: every family root derived, every resolved hue ≥ 30° from every variant hue, saturation 0.5..2.5, lightness 0.6..1.6. Battle, catch and stats are untouched (§2.8 `isShiny` keeps no battle effect).

### 3.8 Shop and marketplace constants

```ts
export const SHOP_STOCK_DEFAULT: readonly string[]; // ['potion','superpotion','hyper_potion','full_heal','revive','spark_orb','crest_orb','prism_orb','dusk_orb']
export const MARKET = { listMaxPerHour: 5, bidMaxPerHour: 30, durationsHours: [12, 24, 48] as const, minStartingBid: 100, feePercent: 5 } as const;
```

### 3.9 Battle Pass

```ts
export interface BattlePassReward {
  readonly level: number; readonly label: string; readonly rarity: Rarity | 'epic';
  readonly money: number; readonly items: Readonly<Record<string, number>>;
  readonly creature: { readonly species: string; readonly level: number } | null;
  readonly mythicalChoice: readonly string[] | null;   // level 50 only: ['lumyth', 'noxmyth'] (`BATTLE_PASS_MYTHICALS`; <!-- amended 2026-10-25: the Elemutt line (#142–144) --> the Elemutt line is a mythical quest family, its root given by q13)
}
export const BATTLE_PASS: readonly BattlePassReward[]; // exactly 100, levels 1..100 in order
```

### 3.10 validate.ts — the build gate

Fails the build on the first of:

1. Any zod schema failure over `SPECIES`, `MOVES`, `ABILITIES`, `ITEMS`, `ORBS`, `CONSUMABLES`, `ZONES`, `ENCOUNTER_TABLES`, `LEAGUE`, `QUESTS`, `STORY`, `SEASONAL_EVENTS`, `DAILY_SWARMS`, `RAID_HOTSPOTS`, `BATTLE_PASS`.
2. Dangling id: species `moves`/`learnableMoves` → `MOVES`; species `abilities` → `ABILITIES`; `evolution.into`/`evolvesFrom` → `SPECIES`; zone `links` → `ZONES`; zone `gym` → `LEAGUE`; `encounterTable` → `ENCOUNTER_TABLES`; encounter/trainer/league/quest/swarm/raid/static `species` → `SPECIES`; shop stock, ground items, quest rewards, battle-pass items → `CONSUMABLES ∪ ORBS ∪ ITEMS`; story `speaker`/`battle.trainerId` → npcs/trainers/league; quest `giver` → an `NpcDef.id` of the quest's `zoneId` or `null`; quest `talkTo`/`deliverItem` `npcId` and `defeatTrainer` `trainerId` → npcs/trainers; `LegendaryStatic.when` → a `badge:` or a flag set by some beat/quest/league row; every `zoneId` anywhere → `ZoneId` (zod enum, build time). <!-- reconciled 2026-09-18: statics, quest givers and flag gates added (roster-coverage OQ 5, legacy-render-audit Q23) -->
3. Counts: `SPECIES.length === 137` <!-- amended 2026-10-08: hollowmane (#131) --> <!-- amended 2026-10-08: dustcub, badlander (#132–133) --> <!-- amended 2026-10-08: veilpup, hollowolf (#134–135) --> <!-- amended 2026-10-08: castlemaw (#136) --> <!-- amended 2026-10-08: the honor ledger, lawlander (#137) --> (138 <!-- amended 2026-10-13: hyoryu (#138) -->; 141 <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) -->; 144 <!-- amended 2026-10-25: the Elemutt line (#142–144) -->; 145 <!-- amended 2026-10-26: kykaiser (#145) -->), `MOVES.length === 198` <!-- amended 2026-10-25: the Elemutt line (#142–144) --> (Cosmic Convergence) <!-- amended 2026-10-08: Hollow Crescent --> <!-- amended 2026-10-08: Vendetta Volley --> <!-- amended 2026-10-13: hyoryu (#138) --> (Aurora Requiem, Crimson Lotus Prison), `TYPE_NAMES.length === 19`, `ABILITIES.length === 28` <!-- amended 2026-10-25: the Elemutt line (#142–144) --> (Inner Chi, Stance Change, Avatar Cycle), `ITEMS.length === 17` (the five relics are a separate `RELICS` list), `ORBS.length === 10`, `ZONES.length === 21`, `LEAGUE.length === 12`, `BATTLE_PASS.length === 100`, dex numbers dense 1..144.
   Phase D6 <!-- amended 2026-10-06 Phase D6 -->: every `SPREAD_MOVES` id (content `data/spreadMoves.ts`, 16 curated moves laid over the generated `MOVES`: Rock Slide, Heat Wave, Blizzard, Dazzling Gleam, Snarl, Twister, Powder Snow, Frozen Tempest, Gem Storm, Growl, String Shot → `'foes'`; Earthquake, Discharge, Bulldoze, Petal Blizzard, Sparkling Aria → `'all'`) is a foe-targeted MOVES row carrying that `spread`; a `doubles: true` trainer / league row has a team of 2+. Authored doubles (all optional, never gates): `draco_gym` (Sylvane), `aurelia` (Warden 2), and the route trainers `galvan_route.rocker`, `deepcut_route.digger`, `hollow_route.medium`, `siege_route.engineer`, `ascent_route.tamer`.
4. Move effect keys ⊆ the 23 `MoveEffect` values after the `lower_spAtk → lower_atk` rewrite; `effect === 'first'` implies `priority === 1` and vice-versa.
5. `learnableMoves` sorted by level, includes every default move at level 1, no duplicates.
6. `evolution.atLevel` in 2..99; `evolvesFrom` consistency both ways; a split evolution's `null`-condition branch is last; all 68 evolution families form trees rooted at a species with `evolvesFrom === null`.
7. **Roster coverage.** Let `E` = the set of species in any `EncounterTable`, `DailySwarm`, `RaidHotspot` boss, quest `rewards.creature`, battle-pass `creature`, or a `StoryBeat` with `battle` against a legendary static. Let `R(E)` = `E` closed under `evolution.into`. Assert `R(E) ∪ LEGENDARY_STATICS ∪ { 'lumyth', 'noxmyth' }` ⊇ all 137 ids, where `LEGENDARY_STATICS` (§3.2) holds the 8 non-mythical legendaries (`raikitsune`, `bankaiser`, `galaxion`, `sunjaw`, `glacinid`, `voltaura`, `zenryu`, `voidraxis`), each exactly once, none in any table/swarm/raid pool. The mythicals `lumyth` and `noxmyth` must each be a `rewards.creature` of some quest or the `mythicalChoice` at battle-pass 50. Non-legendary species may **not** appear in `LEGENDARY_STATICS`. The message on failure lists the unobtainable ids — the legacy set was `wraithtide, kygra, ripshell, bloomsprite, acier` plus 40 others. The roster rules RC-1 … RC-13 of `.design/roster-coverage.md` §3 run here too and the `RosterReport` (roster-coverage §4.2) is written under `roster` in the report.
8. Every `EncounterSlot` has `levelMin <= levelMax`, weights > 0; a table on a `story` zone must satisfy roster-coverage RC-9 (levels inside the zone's band, Ghost/Dark night-only). No table exceeds 16 slots or 14 distinct species. <!-- reconciled 2026-09-18: roster-coverage A1 — story tables allowed -->
9. Zone graph checks from §3.1, and every authored coordinate inside the playable interior (§3.1 extents; snapped, else fail).
10. Prices: every consumable `sellPrice === floor(price / 2)`; orb prices are the legacy values.
11. **Atlas bind cap.** For every zone, `|O(zone)| ≤ 16` where `O(zone)` = species of its encounter table ∪ its statics — the species the zone can show in the overworld at once (`40-pipelines.md` §40.1.4: a zone then binds ≤ 8 sprite atlases without planner duplication). The full `Z(zone)` = `O(zone)` ∪ its trainers' teams ∪ the league teams whose `zoneId` is the zone is computed and written to the report (`bindSets`) for the sprite planner, but is **not** capped: `solenne` (3 Wardens + the Champion, legacy teams) is 26 species and `umbral_observatory` (bible story teams) 20, so a cap on `Z` cannot hold. Battle-only species outside the zone's atlases are bound for the battle (`10-render.md` §10.4.1). <!-- reconciled 2026-09-18: 40-pipelines OQ-4 --> <!-- amended 2026-09-25: `|Z(zone)| ≤ 16` was measured impossible (packages/content IMPLEMENTATION-NOTES D1: solenne 26, umbral_observatory 20); validate.ts enforces the overworld subset -->
12. Heightfields (§3.11): `buildHeightfield` runs for all 21 zones; `walkable` samples ≥ 45 % of `res²` (the playable interior is 64 % of the field at most; legacy was 10.7 %, legacy-render-audit Q12); `spawn` and every authored coordinate are walkable after snapping.

`validate.ts` also emits `dist/content-report.json` (counts, coverage list + `roster` report, per-zone species list `perZone` and the bind sets `Z(zone)`, every zone's heightfield `digest`) and `dist/heightfields/<zoneId>.json` (the full field, for `10-render.md` §10.6.1 `collider.test.ts`), which `tools/asset-audit`, the sprite pipeline and the render tests consume. The field file is an exact compact encoding (`encoding: 'q64-delta-varint-b64+rle'`: heights as 1/64 m integers, row-major, delta + zig-zag varint + base64; the two masks run-length encoded), decoded by `decodeHeightfield` bit for bit with the digest re-verified; heights are quantised to 1/64 m inside `buildHeightfield`, so the runtime field and the file hold the same numbers (routes ≈ 305 KB, 4.5 MB for 21 zones). <!-- amended 2026-09-25: packages/content IMPLEMENTATION-NOTES D2 — raw JSON arrays of a 481² field are > 2 MB -->

### 3.11 Heightfield — the walkable surface, built once, sampled by everyone

<!-- reconciled 2026-09-18: moved here from 30-server-netcode.md §30.2.3 (a higher section may not define a content export); home decided: pure content function, consumed by the server for validation and by the client to build render's ZoneSpec; `water` added per roster-coverage A2 -->
The render package cannot import content (eslint `ewa/render`: three only) and the server cannot import render. Both can import `@ewa/content`, so the walkable surface is a pure content export built from `ZoneDef.layoutSeed`; the client hands the object to render as a descriptor (`HeightfieldData`, structurally identical, `10-render.md` §10.5.1) and the server samples the same arrays. The terrain mesh is built from the same array, so what you see is exactly what you collide with.

```ts
// packages/content/src/heightfield.ts — verbatim
export interface Heightfield {
  readonly zoneId: ZoneId;
  readonly size: number;                    // metres per side (square). town 160 · route 240 · story 200 (§3.1 extents)
  readonly step: 0.5;                       // metres between samples
  readonly res: number;                     // samples per side = size / step + 1 (town 321, route 481, story 401)
  readonly originX: number;                 // world x of sample column 0 = -size / 2
  readonly originZ: number;                 // world z of sample row 0    = -size / 2
  readonly heights: Float32Array;           // res * res, index = row * res + col, metres; row ↔ z, col ↔ x
  readonly walkable: Uint8Array;            // res * res; 1 = walkable. 0 in the 16 m margin, where slope > 35°, or where the layout marks water/void/prop footprint
  readonly water: Uint8Array;               // res * res; 1 = water surface (pond, sea, bog, lava). A sample may be both walkable and water (boardwalk)
  readonly digest: string;                  // fnv1a32 over the little-endian bytes of `heights`, then `walkable`, then `water`; 8 hex chars
}

/** Deterministic from zone.layoutSeed, zone.kind and zone.biome (value noise + the layout's footprints). */
export function buildHeightfield(zone: ZoneDef): Heightfield;
export function getHeightfield(zoneId: ZoneId): Heightfield;                       // memoised buildHeightfield
/** Bilinear over the 4 surrounding samples. Returns NaN when (x, z) is outside [origin, origin + size]. */
export function sampleHeight(h: Heightfield, x: number, z: number): number;
/** Nearest sample. false outside the field. */
export function isWalkable(h: Heightfield, x: number, z: number): boolean;
export function isWater(h: Heightfield, x: number, z: number): boolean;
/** Nearest walkable sample centre within `radius` metres (spiral, 0.5 m ring step); null when none. */
export function nearestWalkable(h: Heightfield, x: number, z: number, radius: number): readonly [number, number] | null;
/** The playable interior: field extent shrunk by the 16 m margin (§3.1). */
export function playableBounds(h: Heightfield): { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
```

`buildHeightfield` uses only core's `createRng(zone.layoutSeed)` and integer/`Math.fround` arithmetic on `Float32Array`, so the `digest` is identical in Node and in a browser worker (`50-verification-budget.md` §50.4.2 `heightfield.test.ts`). The first call per zone costs ≤ 40 ms; memoised thereafter.

**Zone sculpts** <!-- amended 2026-10-20: zone sculpts, every zone hand-shaped (content `sculpt.ts`, `data/sculpts.ts`) -->: every zone carries a hand-authored `ZoneSculpt` (`SCULPTS[zoneId]`, a separate layer like the obstacles) that `buildTerrainField` applies after the biome noise and the kind feature, in this order: **lifts** (polygon, circle or Catmull-Rom stroke outlines raised or sunk by `h` over an `edge` falloff: a cliff when `edge < ≈2.1·|h|`, unwalkable by slope and painted rock; plateaus, terraces, basins, ravines, ramparts, crater rims, spires; scattered `outcrops` are placed from their own seed clear of roads, water, authored points, statics and raid hotspots) and **hills** (smooth domes); the **road profiles** (from the dry terrain, smoothed over ±7 m and limited to a 0.3 grade both ways; across a `bridged` lift the profile runs straight bank to bank); **lakes** (a polygon dug to one level, the lowest dry point of its outline, open water inside, a shore blend outside) and **rivers** (a channel carved to one level, the lowest point of its course); then the **roads flattened** to their profiles with a shoulder blend, so a road crossing a cliff cuts its own ramp, a road through a bridged ravine or wall makes a causeway or a gate, and over water the road's own width becomes a **deck** (walkable and water, like a pond's boardwalk); then the random biome ponds (`sculpt.ponds` overrides the count; they keep off roads, rivers, lakes and lift outlines), the authored-point clearings, quantisation and `walkable`. Arithmetic stays + − × ÷ and `Math.sqrt` / `floor` / `round`, so digests stay engine-independent. The plan (`plan.ts`) takes a sculpt's roads as the zone's: a route's `road_main` (west edge `(−120, 0)` → east edge `(120, 0)`, past the spawn) replaces the meander (`roadMeander = null`), a town's or story zone's `road_<dir>` / `lane_s` replaces that generated road, any other id is an extra lane or trail; `sculpt.grass` replaces the generated tall-grass patches, `sculpt.setPiece` places the set-piece (default: on the main road nearest `x = 0`, along it), `fences` / `props` add hand-placed props. Scatter keeps off slopes over 0.9 and off the water mask (`wetNear`), buildings stand only on walkable ground varying ≤ 1.2 m, props keep off door approaches, lamps and props keep off the spawn, and the plan's water clearances use the mask for every body that is not a round pond (`roundBody`); interior pockets keep 2.5 m off water. The plan carries `bridges` (deck centrelines and heights), `crags` (cliffed round lifts) and `structures` (lifts with `dress: 'wall' | 'palisade' | 'tower'`) for render to draw. Validate's rule 12 (reachability of every authored point, door, pocket warp, obstacle, arrival point and handover band) is what keeps a sculpt honest. **Handover landings** <!-- amended 2026-10-20: handover landings on sculpted edges (server test handover-landing) -->: an edge handover lands on the neighbour's same lateral coordinate (`30-server-netcode.md` §30.2.7), so the two sides of a link must agree: every trigger-line sample a player can reach from the spawn lands, after the snap, on ground in the destination spawn's 4-neighbour walkable component (server `test/handover-landing.test.ts`, every link both ways). Where the neighbour's entry line is cut off (a caldera rim at a town's edge, a ravine floor, a massif tier, a crag top) the edge on this side is closed by a rock face, `shoulder(dir, half, from, to)` in `data/sculpts.ts`: a lift climbing 12 m over a 12 m falloff from 10 m inside the playable edge into the margin, steeper than 35° all the way, so the trigger line cannot be reached in front of it and an arrival landing on it snaps to the ground at its foot rather than onto a ledge; it closes the trigger line to 2.7 m past each end. A lake's shore and bed are applied after the lifts and flatten a face, so where a beach or a lake rim meets such a stretch the water is moved instead (tide_route's sea and lagoon, ascent_route's tarn).

**Open gap — building and prop footprints (blocker for server authority).** The `walkable` comment above requires prop footprints to be 0, but the building/prop placement is decided by render's layout (`10-render.md` §10.5.5 `planBuildings`/`planProps`, fed by `20-client.md` §20.4.4 `spec.buildings`/`spec.props`), which content cannot import. As implemented, `buildHeightfield` marks the margin, slopes and water only; render registers the footprints as client-side **blockers** in `TerrainCollider` (§10.6.2). Consequences until the footprint plan moves into content: the server's `validateInput` accepts a position inside a house or a trunk (a modified client walks through buildings), and `SpawnDirector` can place a wild spawn inside a footprint the client cannot reach. The fix is a pure content export of the footprint plan that both `buildHeightfield` and render's builder consume (`.design/audits/spec-verification.md`, recommendation R1). <!-- amended 2026-09-25: packages/render IMPLEMENTATION-NOTES Z6; packages/content IMPLEMENTATION-NOTES clarification 1 ("prop footprints are render data and are not modelled") -->

### 3.12 Bodies — the player's avatar

<!-- reconciled 2026-09-18: `players.body` defaults to 'ranger_m' (persist, implemented) while 40-pipelines.md ships Quaternius looks named `casual_male …`; a body is a content row that maps to a look -->
```ts
export interface BodyDef { readonly id: string; readonly name: string; readonly look: string; readonly palette: string | null } // look = models.manifest.json `looks` key (40-pipelines.md §40.2.5)
export const BODIES: readonly BodyDef[];   // ≥ 10 rows; 'ranger_m' is the persist default and must exist
export const TITLES: readonly string[];    // `POST /profile` accepts only these (default 'Rookie Trainer' must exist)
```

### 3.13 Interiors — every town building opens into a hall
<!-- added 2026-10-06 (Phase A): interiors, themed gym halls, puzzles, correct arenas -->
Every town building (gym, Solenne's league hall, shop, healer, houses) opens into a **pocket**: a walled, roofless hall
standing in the zone's own playable outer band, reached only through door warps. Pockets are a layer laid out after
the zone plan (`planInteriors(zone, plan, base)`; `ZoneDef`, the plan and its rng streams are untouched), placed by a
deterministic greedy scan (outermost ring first, then angle) clear of buildings, roads, the plaza, water, the set-piece,
authored points, props and lights, ≥ 9 m from every linked edge (the 6 m handover trigger and 6.5 m arrival line stay
outside), tall-grass patches avoided unless no other spot fits. Yaw is a multiple of π/2, the long axis runs along the
nearer side, the door (local +z) faces the town centre.
```ts
export interface InteriorDef {           // authored in the hall's LOCAL frame: origin at the floor centre, door in the +z wall
  readonly id: string;                   // = the building id: '<zone>.gym' | '<zone>.league' | '<zone>.shop' | '<zone>.healer' | '<zone>.house<k>'
  readonly zoneId: ZoneId; readonly building: string;
  readonly template: 'gym_hall' | 'league_hall' | 'shop' | 'healer' | 'house_s' | 'house_m';
  readonly theme: 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'league' | 'shop' | 'healer' | 'house';
  readonly label: string; readonly w: number; readonly d: number;   // inner floor extent (gym 20×34, league 20×62, shop/healer 10×8, houses 8×7 / 9×8)
  readonly entry: LocalPoint; readonly exit: LocalPoint;
  readonly rooms: readonly InteriorRoom[];    // { id, arena, leader (LeagueTrainer id), leaderAt, bounds }
  readonly walls: readonly InteriorWall[];    // internal solids (stamped unwalkable)
  readonly gates: readonly InteriorGate[];    // per-player doors: solid until every `opensWhen` flag is held — never stamped
  readonly switches: readonly InteriorSwitch[]; // interact { kind: 'switch' }: `requires` ⊆ flags, sets `switch:<zone>:<id>` (or null), optional warpTo
  readonly trainers: readonly InteriorTrainer[]; // gym trainers; beaten flag `trainer:<id>:beaten`, no rematch
  readonly npcs: readonly InteriorNpc[];      // shopkeeper / nurse / guide / resident / tower (Phase D14: the battle tower attendant, Solenne league hall foyer) / daycare (2026-10-21: the Daycare keeper, Mirevale house 1, content `withDaycare`) — client-local dialogue
  readonly items: readonly InteriorItem[];    // pickup flag `item:<zone>:<id>`
  readonly props: readonly InteriorProp[];
}
export interface InteriorPlacement { readonly x: number; readonly z: number; readonly yaw: number; readonly floorY: number }
```
Heightfield (§3.11 amended): `planZone → planInteriors → stampFootprints(plan solids minus the scatter that falls in a
pocket) → stampInteriors` — the floor and a 0.4 m wall flatten to `floorY` (quantised to 1/64), a 2 m screen band blends to
the terrain, `water = 0` over the footprint; walkable = the floor inset by the capsule radius minus internal walls; walls
and screen unwalkable. Gates are a per-player overlay (server movement validation, client collider blockers). Phase D10: `→ stampObstacles` follows `stampInteriors` (§3.1 Obstacles); a no-op without `ZoneDef.obstacles`.

Gym halls: a foyer, a puzzle band with 2–3 gym trainers beside gates and one gimmick (grass hedge maze + root-stones,
fire furnace grates, water tide sluices, electric ordered breakers, rock boulder maze + keystone, ghost teleport tiles,
steel anvil sequence, dragon bridge gauntlet), then the leader's chamber behind a gated wall at local z = −2 with the
arena at (0, −9.5) and the leader at (0, −13.7). The league hall: a foyer (nurse, herald) and four 14 m chambers (Veil,
Aurelia, Kirei, Zeon), each gate opening on the previous Warden's `elite:*` flag; healing between fights. A battle
started inside a hall forms at the containing room's arena (gym trainers fight in the leader's chamber) on the hall axis
(`interiorArenaFor`); `battleStart` carries `x`, `z`, `yaw`.

validate (§3.10 amended): every town building has a pocket; pockets disjoint and inside the playable interior; for
every pocket a progression walker from the entry with no flags (beating reachable trainers, using reachable switches
whose `requires` it holds, following teleports) reaches every leader, and with every gate closed reaches none (in the
league hall, none past the first chamber); every arena keeps ≥ 6.5 m of floor and both trainer slots (±4.45 m) on the
floor; entry → gym arena ≤ 30 m; every npc / item / exit reachable.

### 3.14 Breeding — the Daycare and eggs
<!-- added 2026-10-21: breeding and egg moves -->
`content/src/data/daycare.ts`. **The Daycare** is Mirevale's house 1 (`DAYCARE { zoneId: 'mirevale', building:
'mirevale.house1', keeperId, keeper: 'Nan Hob' }`): the interiors layer (`withDaycare`) relabels the hall "the Daycare" and
makes its resident the keeper (role `daycare`, same hall, footprint, walls and props; `ZoneDef` untouched). A trainer
leaves two creatures there (slot kind `daycare`); two that can breed give one egg every `EGG_READY_MS` (10 min) of server
time, one waiting at a time. Rules, chosen to read in one line each:
- **Who breeds** (`breedRefusal`): two of one family (`evolutionRoot`) or two that share a type; never a legendary or
  mythical (`SpeciesDef.legendary`). Tower and arena teams are never persisted, so they never reach the Daycare.
- **What hatches** (`eggSpecies`): the first stage of the family of the creature left FIRST, at `HATCH_LEVEL` 1.
- **Moves** (`eggMoves`, `hatchMoves`): its level moves with the egg moves (moves either parent knows, first parent's
  first, that the hatchling's species learns by level-up at any level or by TM under `canLearnMachineMove`; at most 4)
  in place of the oldest, at most four.
- **Inheritance**: Ewamon has no IVs (stats are base and level, §2.7), so the egg inherits what a creature carries: the
  first parent's coat variant, else the second's (`eggVariant`); the ability in the first parent's ability slot
  (`eggAbility`); honor = the parents' average, rounded half away from zero, clamped (`eggHonor`): honorable parents hatch
  a dustcub that grows into a lawlander ("born Lawlander").
- **Bandborn** (`isBandbornPair`): a parent whose species has a Majin form with one whose species has a Tenjin form always
  gives a bandborn egg; the hatchling carries `bandborn: true` and its line's form answers either band (§2.11 step 5b).
  A bandborn whose line never reaches a form keeps the mark only.
- **Shiny**: 1 in `EGG_SHINY_ODDS` (512, the spawn odds), 1 in `EGG_SHINY_ODDS_SHINY_PARENT` (256) with a shiny parent;
  rolled when the egg is laid from a seeded stream, hidden until it hatches.
- **Hatching**: an egg is carried (`place: 'party'`, at most `EGG_CARRY_MAX` 3, never in a party slot) or waits in the
  box; a carried egg hatches after `eggSteps` metres walked (by rarity: `EGG_STEPS` 600 / 900 / 1200), counted by the
  server from accepted movement. At most `EGG_MAX` 12 eggs in all.
- **Challenge runs**: while a Nuzlocke or Hardcore run is active the Daycare takes no creature and gives no egg, and
  carried eggs count no steps (a run's creatures are the first encounter of each route); taking one back is allowed.

### 3.15 Nemeses
<!-- added 2026-10-21: nemeses, the user's approved pitch (a wild creature that beats or escapes you remembers you) -->
`content/src/data/nemesis.ts`. A wild creature that knocks out one of a trainer's creatures, or breaks out of their orb,
and gets away (the battle ends with it neither caught nor knocked out: the trainer ran, whited out, or the battle ended
otherwise) is promoted for that trainer alone. Rules, one line each:
- **Who rises**: a plain wild creature of a world wild battle (tall grass, surfing, fishing, a visible spawn). Never a
  legendary or mythical (`SpeciesDef.legendary`), the season's roamer, a static, a trainer's or a ghost's creature, and
  never in the tower, the arena or a raid (none of them is a world wild battle).
- **How often**: `NEMESIS_PROMOTE_CHANCE` by the zone's shadow level (honor shapes the world, content `worldHonor.ts`; `ZoneState.shadow`): 0.6 / 0.7 / 0.8 /
  0.9 / 1. At most `NEMESIS_MAX` 3 active per trainer; when one more rises the oldest fades.
- **What it gains** (`riseNemesis` on the server): `NEMESIS_GAIN` 2 to 5 levels (to 100 at most); one move
  (`nemesisMove`: the next move its learnset teaches above its new level that it does not know, else a damaging TM it can
  learn); a name and a title (`nemesisName`: a head by its type and a tail, e.g. "Scarjaw", at most 16 letters so it fits
  a nickname; a title by how it got away or by its type, e.g. "the Unbroken"); a scar (`scarOf`: a torn ear for an orb
  broken out of; for a knockout the mark of the hardest blow it took, by that move's type: burn scar, frostbitten ear,
  lightning mark, venom stain, cracked horn, shadow brand, claw marks; a cracked horn when nothing landed); rank 1; and its
  memory of the fight (`NemesisMemory { how, zoneId, foeSpecies, foeName, move, orb }`: what it knocked out and with
  which move, or which orb it broke out of in front of which creature).
- **Again**: each time it knocks out or escapes the same trainer again its rank rises (to `NEMESIS_RANK_MAX` 5),
  `NEMESIS_RANK_GAIN` 1 to 2 levels, and its memory becomes the newest fight. A meeting that settles nothing (the trainer
  ran before either happened) only moves where it was last seen.
- **Ambush**: `NEMESIS_AMBUSH_CHANCE` of a trainer's grass / surf encounters (0.08 / 0.10 / 0.12 / 0.14 / 0.16 by shadow
  level) is an ambush by one of their active nemeses that rose in another zone (on the water only a Water, Flying or Ice
  species). It fights at `nemesisFightLevel` (its own level held between the lead's level − `NEMESIS_UNDER_LEAD` 2 and
  + `NEMESIS_OVER_LEAD` 3): a darker zone brings more of them, never harder ones. It is the wild battler with its name as
  nickname, its coat, ability and gained move (in place of its oldest), and it opens with a taunt from its memory
  (`nemesisTaunt`, e.g. "Scarjaw remembers your Pyrekit. It remembers Ember."; a higher rank remembers more). A repel does
  not keep it away.
- **Endings**: knocked out, it is gone (`beaten`) and the trainer's creature that landed the blow keeps a history line
  (`nemesis { how: 'beaten' }`, a trophy); caught, it is gone from the list (`caught`) and the new creature keeps its name
  as nickname, its scar as the ribbon `nemesis-scar:<scar>` (`nemesisScarRibbon`, read back by `scarOfRibbons`), its
  gained move, and a history line (`nemesis { how: 'caught' }`).
- **Challenge runs**: an ambush is a wild encounter of the zone it happens in. In a Nuzlocke or Hardcore run it spends that
  zone's first encounter like any other, and may be caught only when it is that first encounter.
- **Switch**: server env `NEMESES` (`on` default; `off` in testEnv, so the suites and the progression walker see wild
  battles end as they always did; `always` promotes every qualifying escape and makes every possible ambush one, for live
  checks). No core change.

### 3.16 A living ecosystem
<!-- added 2026-10-21: a living ecosystem, the user's approved pitch (species hunt and feed each other, players' catches press on them, seasonal migrations, the honor tilt, "This week on <zone>") -->
`content/src/data/ecosystem.ts`. A zone's wild creatures form a food chain; what players catch and knock out there
presses on it week by week; a few species migrate once a ranked season; the zone's honor tilts the roll. Pure: the
server keeps the tallies and calls `ecosystemOf`, the zone room rolls on the table it returns, the Dex shows the same
reading. Rules, one line each:
- **Food chain** (`foodChain`, `foodChainAmong`): `FOOD_CHAIN_HAND` rows where it is obvious (the night hunters and the
  rats, the big fish and the small ones, ...), then the type rule (`huntsByType`): the predator hits the prey super
  effectively with one of its types, the prey hits it back with neither, the predator's base stat total is at least
  `PREDATOR_BST_MARGIN` 20 higher, neither is legendary and they are not one family. Links exist only between species of
  the same zone table (a migrant joins its new zone's chain). Every zone with a table has a chain; no link runs both ways.
- **Weeks** (`ecoWeek`): Monday 00:00 UTC to Monday, counted from the first season's start (`SEASON_ANCHOR_MS`), so four
  of them make a season.
- **Pressure**: a species' take is this week's catches and knockouts plus `ECO_LAST_WEEK_WEIGHT` 0.5 of last week's
  (left alone two weeks, it is back). Below `ECO_MIN_TAKES` 12 in the zone nothing is judged. A species whose share of
  the takes is above its share of the table's weight is overhunted: `overhunt` = clamp(log2(share / fair share) / 2, 0, 1).
  Its weight falls by 2^-overhunt; a predator's rises by 2^(the most overhunted of its prey here). So the pressure
  factor is `2^(surge - overhunt)`, within 0.5x..2x.
- **Migration** (`migrationsFor(season)`): each ranked season `MIGRATIONS_PER_SEASON` 3 of `MIGRATION_ROUTES` (12) are
  drawn by the season number, one per target zone and per species. The species joins the target's table
  (`migrantSlot`: weight `MIGRANT_WEIGHT` 4, uncommon, the target's level band from `ENCOUNTER_BANDS` but never below the
  level it evolves at, its time of day and medium at home) and its home slots weigh `MIGRANT_SOURCE_FACTOR` 0.5. A route
  runs between linked zones or two zones one table-less town apart (`neighbourZones`), and only where the target zone's
  sprite atlases (the manifest's `zones[to]`, planned per zone from roster-coverage.md and bound by the client on
  arrival) already hold the species, so a migrant never needs a texture the zone did not load. A water migrant only goes
  where the target has water slots.
- **Honor tilt** (worldHonor.ts; `lightLevel` new: the mirror of `shadowLevel` over the light share): in a darkened zone
  Ghost species that are not Dark weigh `1 + SHADOW_GHOST_BOOST` 0.25 x level (Dark species already weigh
  `shadowDarkWeight` in the roll, `rollWild`, not twice); in a lit zone its rare slots weigh `1 + LIGHT_RARE_BOOST` 0.25 x
  level. Nemeses keep reading the shadow as before.
- **Bounds**: every slot's ecosystem weight (pressure, migration and tilt together) stays within `ECO_FACTOR_MIN` 0.5 and
  `ECO_FACTOR_MAX` 2 of its authored weight. A zone with no history, no migrant and no tilt rolls its authored table.
- **The reading** (`Ecosystem`): the table, each species' factor and cause (`hunted`, `feeding`, `shadow`, `light`,
  `migrant`, `away`), what it hunts and what hunts it, this week's catches and knockouts, the migrants in and out, the
  shadow and light levels; `surging` / `scarce` at `ECO_NOTABLE` 1.15 and its inverse.
- **What counts**: a plain wild creature of a world wild battle (grass, surf, fishing, a visible spawn) caught or knocked
  out. Not the roamer, a nemesis ambush, a static, a ghost, the tower, the arena or a raid. Nothing is a story gate: a
  table only gains a species or reweighs its own.
- **Switch**: server env `ECOSYSTEM` (`on` default; `off` in testEnv, so the progression walker, the spawn and encounter
  tests and their pins see today's tables). No core change.

### 3.17 The bounty board
<!-- added 2026-10-21: the bounty board, the user's approved pitch (wanted posters in each town, set by the game and by players; Lawlander owners claim with a bonus, Badlander owners post; ghosts, honor and the dustcub split feed into each other) -->
`content/src/data/bounties.ts`. Wanted posters in every town; the server keeps them (`bounties`, migration 0019) and
decides every claim. Rules, one line each:
- **The board** (interiors layer, never `ZoneDef`): `BOUNTY_OFFICES` names one hall per town: its Healer, else its Mart
  (Stormrook, Marrowdig), else (Skyrend) its first house, which becomes "the Marshal's Office" (its resident is the
  Marshal). `withBountyBoard` adds the Marshal (role `bounty`, look `cowboy_male`, two lines) beside the counter at local
  (3.6, -1.8) and a `banner` prop on the wall behind him; in the house the Marshal takes the resident's spot and the board
  goes on the back wall. Walls, footprints, entries and exits are unchanged. Talking to him opens the Wanted board.
- **Game bounties** on ghost trainers (§3 ghosts): every `BOUNTY_PERIOD_MS` (6 h, UTC) the board posts one on each ghost
  still haunting that beat at least `GAME_BOUNTY_MIN_WINS` 5 different trainers this week, counted since its last claimed
  bounty, worth `gameBountyReward` (125 a head, at most 5,000: "beaten 40 people, 5,000"), raised at each posting while it
  stays up; one open game bounty per ghost; it comes down when the ghost fades. Paid by the board.
- **Player bounties** on a ghost: only a party holding a Badlander-line creature (`BADLANDER_LINE`) may post (the right to
  post, not a discount), in a town, never on their own ghost, `PLAYER_BOUNTY_MIN` 500 .. `PLAYER_BOUNTY_MAX` 10,000, one
  open post per ghost and `BOUNTY_OPEN_MAX` 3 open in all. The reward and the board's cut (`bountyFee`, a quarter, rounded
  up) leave the poster at once, in escrow. Up `BOUNTY_POST_HOURS` 72 h, or until the ghost fades if sooner; expired, the
  whole escrow (reward and cut) goes back once. Posting is honor-neutral.
- **Nemesis bounties** (§3.15): a nemesis is one trainer's alone, so its poster is personal ("Wanted by you", seen by its
  trainer only), from rank `NEMESIS_BOUNTY_MIN_RANK` 2, worth `nemesisBounty(rank)` (400 a rank), paid by the board when
  they knock it out or catch it in an ambush.
- **Claiming**: beating the target in its normal fight (a ghost met in its zone's tall grass, a nemesis ambush) claims
  every open bounty on it the claimer may take, each once (one statement guarded by `status = 'open'`): never their own
  post, at most `BOUNTY_CLAIMS_PER_DAY` 3 claims in any 24 hours (the rest stay up for someone else). A party holding a
  Lawlander-line creature (`LAWLANDER_LINE`) takes `lawlanderBonus` (+25%): on a player's post that is exactly the
  escrowed cut, so passing a bounty between friends makes no money; without a Lawlander the cut is the board's (a sink).
- **Honor and history**: a claim gives the claiming party's lead `BOUNTY_HONOR` +1 honor when its species keeps the ledger
  (core `honor.ts` bounds, `clampHonor`; never in the tower, where no ghost or nemesis is met) and the history line
  `bounty { target, targetKind, reward, zoneId }` ("Brought in <target>"). So a dustcub that hunts bounties leans
  Lawlander; a Badlander owner pays to have ghosts hunted.
- **Hunting**: a wanted ghost steps out of its zone's tall grass first, with `WANTED_GHOST_CHANCE` 1/4 of the encounters
  there, before the ordinary ghost roll (still only while its owner is offline and within `GHOST_LEVEL_SPAN`).
- **Switch**: server env `BOUNTIES` (`on` default; `off` in testEnv, so the walker and the ghost / nemesis tests see
  today's fights; `always` = a wanted ghost steps out of every grass encounter it can, for live checks). The board screen
  itself is always there. No core change.

### 3.18 Followers with field powers
<!-- added 2026-10-21: followers with field powers, the user's approved pitch (the lead walks behind its trainer and its type does things on the sculpted terrain: Flying glides off a cliff, Fire lights the dark and burns brambles, Ground digs at the camps, Psychic shows a ghost trainer's route, Water dives in the lakes; exploring depends on the team, not on HM-style tools) -->
`content/src/fieldPowers.ts` (rules) and `data/fieldPowers.ts` (the spots, a layer of their own: never `ZoneDef`, so no
zone's layout RNG or heightfield digest moves). The server decides every power; the client predicts the glide with the
same function. Never a story gate: every spot is optional, and Cut / Strength obstacles, surfing and fishing are as they were.
- **The lead** (`fieldLead`): the first party creature still standing walks behind its trainer (`PlayerState.lead` /
  `leadFlags`, §4.1) and its types give its powers (`fieldPowersOf`, `FIELD_POWER_TYPE`): Flying `glide`, Fire `light`,
  Ground `dig`, Psychic `sense`, Water `dive`; a dual type has both. Every creature has its line on the party screen.
  <!-- amended 2026-10-25: held relic forms outside a battle --> A lead holding a relic walks in the form the relic opens (core `heldForm`: a `heldItem` form with no hp
  line, ravatar's Water / Earth / Fire / Air; the Avatar State waits for a battle), and that form's types give the powers
  (`leadLook`, read by the server's lead and the client's chip alike). The party and creature screens show the same worn
  form (its art, types and atk / def / spd); nothing is persisted, the form follows the held item.
- **Glide** (Flying): a step off a cliff edge glides instead of being stopped. `planGlide(h, x0, z0, dx, dz, standable,
  reach)`: from a standable take-off with at most `GLIDE.edgeM` 1 m of ground ahead, the flier sinks along a line of
  `GLIDE.ratio` 3 m flown per metre lost over cliff samples (`cliffSample`: in bounds, unwalkable, dry, not a Cut /
  Strength stamp, steeper than the walkable limit), the ground below and walkable specks, and touches down where that line
  meets standable ground that the zone's spawn reaches (`reachFromSpawn`), at least `GLIDE.minDropM` 1.5 m below, within
  `GLIDE.maxRunM` 24 m; a house, open water, the margin or rising ground ends it at the last landing that qualified, or
  refuses it. So a glide only ever goes down, onto ground the spawn reaches, and can never strand anyone. It moves at
  `GLIDE.speedMps` 7 m/s (the run speed: the run cap covers it) along the line, whatever the keys say; `glideAltitude`
  is the arc drawn (the line, a 0.8 m hump, never closer than 0.35 m to the ground under it).
- **Light and burn** (Fire): in a dark place (`isDarkHere`: `DARK_ZONES` the_rift, eclipse_shrine and
  umbral_observatory at any hour, night when the day cycle's daylight is under 0.35, a zone the honor shadow darkened to 3
  or more) the follower carries a light. `BRAMBLES`: two thorn patches on each of the 8 routes and in the rift, each on
  open walkable ground off the roads and the tall grass, a few metres from a cliff, hiding a small cache (`item` x `qty`)
  given once with the burning (flag `burnt:<zone>:<id>`). An unburnt patch is a per-player blocker like a hall gate
  (`brambleSolid`: a square of half `BRAMBLE_SOLID_HALF` 1.45 m, the 1.1 m bush grown by the capsule).
- **Dig** (Ground): `DIG_SPOTS`, one beside the campfire of each route's travellers' camp (the zone sculpts' tent and
  campfire). Once per camp per player per UTC day (flag `dug:<zone>:<id>`, its set time is the last dig; `fieldSpotReady`
  re-arms it when the day turns), one draw from `DIG_LOOT` seeded by player, zone, spot and day (`fieldLoot`).
- **Dive** (Water): `DIVE_SPOTS`, the dark middle of a lake or the sea (12, open water at least 2.5 m all round, never in
  a lava zone). The diver surfs out over it (HM Surf, as ever); once per spot per player per UTC day (flag
  `dove:<zone>:<id>`), one draw from `DIVE_LOOT`. A short interaction, not an underwater mode.
- **Sense** (Psychic): ghost trainers (§3 ghosts) walk their haunts: `hauntPath(owner, zone, grassPatches)` is a loop
  through `HAUNT.patches` 3 of the zone's tall-grass patches (shuffled by owner and zone, so every room and client
  agrees), walked at `HAUNT.speedMps` 0.6 m/s (`hauntPosition`). Sensing shows this zone's ghosts whose haunt passes within
  `HAUNT.senseRangeM` 90 m now, and every wanted one (the bounty board, §3.17) wherever it walks, for `HAUNT.senseMs`
  12 s; it rests `HAUNT.cooldownMs` 6 s. Haunts are real: when the grass rolls a ghost, the one whose haunt passes within
  `HAUNT.nearM` 14 m of the player is the one that steps out (wanted ghosts first, as before).
- **Ranges**: `FIELD_INTERACT_M` 3 m from the spot (burn, dig, dive), from the server's accepted position, outdoors.
- **validate rule 13**: a bramble's blocker square (+0.5 m) and a 3.2 m ring round it are all walkable (it can never plug
  a path), it is reachable from the spawn at its range, at least 8 m from every authored point, obstacle, static, raid
  hotspot and camp prop, outside the interiors and the tall grass; a dig spot is walkable, reachable and within 4 m of a
  campfire; a dive spot is open water 2.5 m all round in a zone whose water is not lava; every cache and loot item exists.
- **Switch**: server env `FIELD_POWERS` (`on` default; `off` in testEnv, so the progression walker's movement and the
  handover-landing tests see today's world: no glide in validation, no bramble blocker, every power refused). The
  follower itself is visual and always on. No core change.

### 3.19 Camp bases
<!-- added 2026-10-22: camp bases, the user's approved pitch (claim a route's travellers' camp, decorate it with trophies, your party guards it as AI while you are offline, others raid it for a small cut and an honor hit, camps held count for the factions) -->
`content/src/data/camps.ts`. Every route's travellers' camp (the zone sculpts' tent and campfire) can be held by one
trainer; the server keeps the camps (`camps`, `camp_raids`, migration 0020) and decides every claim and raid. Rules, one
line each:
- **Where** (a layer of its own, never `ZoneDef`): `campOf(zoneId)` reads the sculpt's campfire and nearest tent; the
  banner pole and `CAMP_TROPHY_SLOTS` 3 trophy slots stand on a 3 m ring round the fire, at fixed angles from the side
  away from the tent (the followers' dig spot side), each facing the fire. Walk-through props: nothing is stamped into a
  heightfield, no digest moves. Only routes have a camp (8). Never the tower or the arena (no route there).
- **Claiming** at the fire (`CAMP_RANGE_M` 5 m, the zone room's `camp { action: 'claim' }`): a free camp, one camp per
  trainer, one owner per camp (the row's keys), a party that can fight, not during an active Nuzlocke / Hardcore run.
  The guard is the owner's party as claimed, replaced every time they leave the world (like a ghost's). The banner reads
  "<owner>'s camp" until renamed.
- **Banner and trophies** (`POST /camps/edit`, from anywhere): a name of at most `CAMP_NAME_MAX` 24 characters, cleaned
  like chat and refused on a blocked word; up to three trophies the owner earned, read fresh from what they did: `scar`
  a nemesis they beat or caught ("<name the title>'s scar"), `legend` a legendary species caught, `medal` the Champion's
  medal or their ranked peak's tier from Silver up, `achievement` one claimed, `bounty` one brought in ("Brought in
  <target>"). Everyone in the zone sees the banner and the trophy kinds (`ZoneState.campOwner` / `campName` /
  `campTrophies`). `POST /camps/abandon` frees the camp.
- **Guarding**: while the owner is offline (presence) and not on a challenge run, the guard fights a raider as an AI
  trainer of healed copies of the snapshot (the ghosts' path, `campguard:<owner>`); `noExp`, so the fight itself moves no
  exp and no honor. A guard whose best creature is more than `CAMP_LEVEL_SPAN` 12 levels under the raider's lead is not
  worth a raid (refused); a stronger guard is the raider's risk.
- **Raids** at someone else's fire (`camp { action: 'raid' }`). A win takes `campRaidCut` (2 % of the owner's money,
  floored, at most `CAMP_RAID_CAP` 1,000) once per raider and camp in any 24 hours (later wins that day take nothing and
  are refused at the fire), paid in the battle's own end transaction with an audit row `camp.raid`, plus the trainer exp
  of a won trainer battle; the raider's party lead loses `CAMP_RAID_HONOR` 1 honor (a species that keeps the ledger) and
  the zone's season tally takes `CAMP_RAID_SHADOW` 3 shadow points (§3 honor shapes the world; a raid is never a fair
  win, so it adds no light). A loss takes nothing. A camp whose owner has been away `CAMP_INACTIVE_DAYS` 14 days or more
  passes to a raider who beats its guard and holds none (fresh banner, no trophies, their party on guard).
- **Factions** (§3 Majin vs Tenjin): a guard that holds earns its owner's side `CAMP_HELD_POINTS` 1, at most
  `CAMP_HELD_PER_DAY` 3 a day, in the same transaction as the fight: a camp held is a camp defended.
- **The camp log**: every raid is a row the owner reads on coming back (a toast per raid, the first three, then how many
  more) and on the Camp screen ("bh_outlaw raided your camp and took 120.", "Your guard held against kestrel.").
- **Switch**: server env `CAMPS` (`on` default; `off` in testEnv, so the walker and every other test see today's world:
  nothing can be claimed, edited or raided and the zone shows no owner). No core change.

---

## §4 @ewa/protocol WIRE

Verified against `@colyseus/schema 5.0.32` `build/annotations.d.ts`: `type(type: DefinitionType, options?)`, `view(tag?: number)`, `MapSchema`, `ArraySchema`, `Schema`, `StateView` (`add(obj, tag?)`, `remove(obj, tag?)`, `subscribe(collection)`, `unsubscribe`, `dispose()`). Against `@colyseus/core 0.18.14` `build/Transport.d.ts`: `Client.view?: StateView`. TypeScript must compile with `experimentalDecorators: true` for these classes (the `@type` decorator is a legacy `PropertyDecorator`).

### 4.1 Zone state

```ts
import { Schema, MapSchema, type, view } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';           // player uuid — NOT sessionId; multi-tab collapses to one avatar
  @type('string') name = '';
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float32') angle = 0;        // radians, heading
  @type('boolean') moving = false;
  @type('boolean') running = false;
  @type('string') body = '';         // appearance id (remote appearance descriptor key)
  @type('uint8') emote = 0;          // 0 none; 1..6 = wave happy sad alert heart cool; server clears after 2 s
  @type('boolean') inBattle = false;
  @type('string') guildTag = '';     // '' = none (persist's guildTag is `string | null`; the wire cannot carry null); 3..4 chars (§4.7 /guilds regex)
  @type('uint32') seq = 0;           // last input seq the server applied — the client reconciles against it
  @type('boolean') surfing = false;  // Phase D8: the accepted pose is on open water (water, not walkable) — remotes ride the level
  @type('boolean') biking = false;   // Phase D11: the last accepted input was ridden (the bike cap applied)
  @type('string') lead = '';         // added 2026-10-21 (followers, §3.18): the species of the party lead walking behind this player ('' = every creature fainted); written only on a change
  @type('uint8') leadFlags = 0;      // added 2026-10-21: the lead's look packed (`encodeLeadFlags`: bit 0 shiny, bit 1 alpha, bits 2..4 the variant in core VariantKey order, bits 5..7 the 1-based slot in core `formsOf` of its worn relic form, 0 = none <!-- amended 2026-10-25: held relic forms outside a battle -->)
}

export class SpawnState extends Schema {
  @type('string') id = '';
  @type('string') speciesId = '';
  @type('uint8') level = 1;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('string') variantKey = 'normal';
  @type('boolean') isAlpha = false;
  @type('string') engagedBy = '';    // player uuid while a battle holds it; '' = free
  @type('uint32') despawnAtTick = 0;
  @type('boolean') isShiny = false;   // Phase D4; appended last so the earlier field indexes are unchanged
}

export class BattleSummary extends Schema {
  @type('string') id = '';
  @type(['string']) participants = new ArraySchema<string>(); // player uuids
  @type('string') format = 'wild';
  @type('uint16') turn = 0;
  @type('float32') x = 0;            // where the arena dresses itself (pillar 7)
  @type('float32') z = 0;
}

export class RaidState extends Schema {
  @type('string') id = '';
  @type('string') bossSpecies = '';
  @type('uint8') bossLevel = 1;
  @type('float32') hpPct = 1;        // 0..1, the only HP the client ever sees for a raid boss
  @type('uint8') phase = 0;          // 0 lobby · 1 fight · 2 enraged (hpPct < 0.3) · 3 catchWindow · 4 over
  @type('uint16') roundEndsInMs = 0;
  @type({ map: 'uint32' }) damageBoard = new MapSchema<number>(); // player uuid -> total damage
  @type('float32') x = 0;
  @type('float32') z = 0;
}

export class ZoneState extends Schema {
  @type('uint32') tick = 0;                       // 20 Hz
  @type('float32') timeOfDay = 0;                 // 0..1, one full day = 48 real minutes
  @type('string') weather = 'none';               // WeatherKind; Phase D7: the zone's per-biome schedule (30 §30.2.8 step 1b); wild / trainer / league battles outside interiors start under it
  @type('string') harvestState = 'intact';        // the zone's content DEFAULT (ZoneDef.harvestState), same for every viewer; each client renders harvestStateFor(zone, ownFlags) (§3.5) — the story is per player <!-- reconciled 2026-09-18 -->
  @type('uint8') shadow = 0;                        // honor shapes the world (added 2026-10-20): the zone's shadow level this season 0..4 (content worldHonor.ts), read by the room once a minute; broadcast to all
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>();   // keyed by player uuid
  @view() @type({ map: SpawnState }) spawns = new MapSchema<SpawnState>();     // keyed by spawn id
  @type({ map: BattleSummary }) battles = new MapSchema<BattleSummary>();     // small; broadcast to all
  @type(RaidState) raid: RaidState | null = null;                              // broadcast to all
  @type('boolean') fieldPowers = false;            // added 2026-10-21 (followers, §3.18): the server env FIELD_POWERS is on in this room; set at creation; the client predicts glides and blocks brambles only when true
  @type('string') campOwner = '';                  // added 2026-10-22 (camp bases, §3.19): the holder of this zone's travellers' camp ('' = free, no camp, or CAMPS off)
  @type('string') campName = '';                   // its banner
  @type('string') campTrophies = '';               // its trophy kinds in slot order, comma-separated (TROPHY_KINDS; '' = none)
}

// <!-- amended 2026-10-11: arena PvP --> the state of an `arena` room (30-server-netcode.md §30.4.10): one battle outside the world;
// everything the client draws comes from `arenaState` and the battle messages
export class ArenaState extends Schema {
  @type('string') matchId = '';
  @type('string') phase = 'waiting';              // 'waiting' | 'fighting' | 'ended' | 'cancelled'
}
```

### 4.2 Per-client AOI via `StateView`

Cell size **32 world units**; a client sees the 3×3 block around its own cell. On `onJoin`: `client.view = new StateView(); client.view.add(this.state.players.get(uuid))` (own avatar always visible). Every tick, after movement is applied, for each client: compute `cell = (floor(x / 32), floor(z / 32))`. When `cell` differs from the client's last cell: for every `PlayerState`/`SpawnState` whose cell is inside the new 3×3 and not the old → `client.view.add(entity)`; inside the old and not the new → `client.view.remove(entity)`. Newly created spawns/players are added to every view whose 3×3 contains them; removed entities are removed from every view before `.delete()` on the map. On `onLeave`: `client.view.dispose()`. `battles` and `raid` carry no `@view()` and are broadcast. Nothing else is ever `@view()`-tagged — AOI has exactly these two collections. `30-server-netcode.md` owns the tick loop; this section owns the rule.

### 4.3 Client → server messages (zod v4 schemas, every payload validated before any handler runs)

```ts
import { z } from 'zod';

export const InputMsg = z.object({ seq: z.number().int().min(0).max(0xffffffff), x: z.number(), z: z.number(),   // zod 4: z.number() rejects NaN/±Infinity; .finite() is a deprecated no-op
  angle: z.number(), running: z.boolean(), dtMs: z.number().int().min(1).max(100),
  bike: z.boolean().optional(),   // Phase D11: the window was ridden: the bike cap only for an owner outdoors on land, else run / walk (30-server-netcode.md §30.2.4)
  glide: z.object({ x: z.number(), z: z.number(), dx: z.number().min(-1).max(1), dz: z.number().min(-1).max(1) }).optional() });   // added 2026-10-21 (followers, §3.18): the window glided; the take-off and unit direction the server re-plans from (30-server-netcode.md §30.2.4)
export const EmoteMsg = z.object({ emote: z.number().int().min(1).max(6) });
export const ChatMsg = z.object({ text: z.string().min(1).max(120) });
export const InteractMsg = z.object({ targetId: z.string().min(1).max(64), kind: z.enum(['npc', 'item', 'lore', 'gym', 'healer', 'shop', 'warp', 'static', 'switch', 'obstacle']) });   // 'switch' Phase A, 'obstacle' Phase D10
export const EngageSpawnMsg = z.object({ spawnId: z.string().min(1).max(64) });
export const BattleActionMsg = z.object({ battleId: z.string().uuid(), turn: z.number().int().min(1),
  pos: z.union([z.literal(0), z.literal(1)]).optional(),   // Phase D6: the doubles field position (absent = the lowest still waiting); ignored in singles
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('move'), move: z.string().min(1).max(40),
      target: z.object({ side: z.union([z.literal(0), z.literal(1)]), pos: z.union([z.literal(0), z.literal(1)]) }).optional(), // Phase D6
      transform: z.literal(true).optional() }), // <!-- amended 2026-10-11: Majin / Tenjin --> Majin / Tenjin; the server's player side carries the bands of its inventory snapshot
    z.object({ kind: z.literal('switch'), to: z.number().int().min(0).max(5) }),
    z.object({ kind: z.literal('item'), item: z.string().min(1).max(40), target: z.number().int().min(0).max(5).optional() }),
    z.object({ kind: z.literal('catch'), orb: z.string().min(1).max(40) }),
    z.object({ kind: z.literal('flee') }),
    z.object({ kind: z.literal('forfeit') }),
  ]) });
export const ChallengeMsg = z.object({ targetId: z.string().uuid() });
export const ChallengeReplyMsg = z.object({ fromId: z.string().uuid(), accept: z.boolean() });
export const TradeRequestMsg = z.object({ targetId: z.string().uuid() });
export const TradeReplyMsg = z.object({ tradeId: z.string().uuid(), accept: z.boolean() });
export const TradeOfferMsg = z.object({ tradeId: z.string().uuid(), creatureIds: z.array(z.string().uuid()).max(6), money: z.number().int().min(0) });
export const TradeConfirmMsg = z.object({ tradeId: z.string().uuid(), offerHash: z.string().length(8) }); // fnv1a32 of both offers, canonical
export const TradeCancelMsg = z.object({ tradeId: z.string().uuid() });
export const RaidJoinMsg = z.object({ raidId: z.string().uuid() });
export const RaidReadyMsg = z.object({ raidId: z.string().uuid() });
export const RaidActionMsg = z.object({ raidId: z.string().uuid(), round: z.number().int().min(1), action: BattleActionMsg.shape.action });
export const RaidCatchMsg = z.object({ raidId: z.string().uuid(), orb: z.string().min(1).max(40) });
export const RaidLeaveMsg = z.object({ raidId: z.string().uuid() });
export const HandoverAckMsg = z.object({ roomId: z.string().min(1), seat: z.string().min(1) });   // seat = the destination sessionId from the SeatReservation
export const BattleResyncMsg = z.object({ battleId: z.string().uuid() });                          // §4.5
export const FastTravelMsg = z.object({ zoneId: z.enum(ZONE_IDS) });                               // §4.6; amended 2026-10-06 (Phase C3)
export const FishMsg = z.object({ angle: z.number() });   // Phase D9: a landed Old Rod bite; the cast heading (refusals FISH_REACH_M = 2.5, FISH_REFUSALS noRod / noWater / nothingBites)
export const RankedQueueMsg = z.object({ action: z.enum(['join', 'leave']) });   // Phase D13: the ranked queue (30-server-netcode.md §30.4.5a); answered with `rankedStatus`
export const TowerMsg = z.discriminatedUnion('action', [                          // Phase D14: the battle tower (30-server-netcode.md §30.4.9); answered with `towerState`
  z.object({ action: z.literal('start'), picks: z.array(z.string().min(1).max(64)).length(3) }),   // refusals TOWER_REFUSALS locked / tooFar / badPicks / running / noRun / inBattle
  z.object({ action: z.literal('next') }), z.object({ action: z.literal('quit') }),
]);
export const FieldPowerMsg = z.object({ power: z.enum(['burn', 'dig', 'dive', 'sense']), targetId: z.string().min(1).max(64) });   // added 2026-10-21 (followers, §3.18): the lead's power on a spot of data/fieldPowers.ts (sense: 'here'); refusals FIELD_POWER_REFUSALS powersOff / noPower / noSpot / spotFar / burnt / usedToday / senseResting / powerIndoors, each with a toast
export const CampMsg = z.object({ action: z.enum(['claim', 'raid']) });   // added 2026-10-22 (camp bases, §3.19): at the zone's campfire; refusals CampRefusal (content CAMP_REFUSAL_TEXT), each with a toast

export const CLIENT_MESSAGES = {
  input: InputMsg, emote: EmoteMsg, chat: ChatMsg, interact: InteractMsg, engageSpawn: EngageSpawnMsg,
  battleAction: BattleActionMsg, battleResync: BattleResyncMsg, challenge: ChallengeMsg, challengeReply: ChallengeReplyMsg,
  tradeRequest: TradeRequestMsg, tradeReply: TradeReplyMsg, tradeOffer: TradeOfferMsg, tradeConfirm: TradeConfirmMsg, tradeCancel: TradeCancelMsg,
  raidJoin: RaidJoinMsg, raidReady: RaidReadyMsg, raidAction: RaidActionMsg, raidCatch: RaidCatchMsg, raidLeave: RaidLeaveMsg,
  handoverAck: HandoverAckMsg, fastTravel: FastTravelMsg, fish: FishMsg, rankedQueue: RankedQueueMsg, tower: TowerMsg, fieldPower: FieldPowerMsg,
  camp: CampMsg,
} as const;   // exactly 26 keys (Phase C3 added fastTravel, Phase D9 fish, Phase D13 rankedQueue, Phase D14 tower, 2026-10-21 fieldPower; its limit 2 per second; 2026-10-22 camp, 1 per 2 s)
export type ClientMessageType = keyof typeof CLIENT_MESSAGES;
```

<!-- reconciled 2026-09-18: battleResync (named in §4.5 prose) is now in the block; 50-verification-budget.md §50.4.3 counts 20 -->
Rate limits (per client, sliding window; excess is dropped with one `error { code: 'rateLimited' }` per window): `input` 30/s, `emote` 1 per 1.5 s, `chat` 4 per 4 s, `interact` 4/s, `engageSpawn` 2/s, `battleAction`/`battleResync` 4/s (Phase D6: in a doubles battle a `battleAction` with `pos: 1` counts in its own 4/s window, so a turn's two back-to-back actions never starve each other; singles unchanged), `challenge`/`tradeRequest` 3 per 5 s, raid messages 4/s, `fastTravel` 4/s (plus its own 3 s server cooldown, §4.6), `fish` 1 per 1.5 s (Phase D9), `rankedQueue` 4 per 5 s (Phase D13), `tower` 4/s (Phase D14). A message whose `type` is not a `CLIENT_MESSAGES` key gets no reply: the room's `'*'` handler only counts it (`metrics.unknownMessages`) and 5 within 10 s disconnect the client with code 4003 — the `'*'` handler must exist, because `@colyseus/core` 0.18.14 closes the socket with 4002 on the first message that has no handler outside dev mode (`src/RoomMessages.ts` lines 334–342). `invalidPayload` is for a known type with a malformed body; the zod check therefore runs inside the handler wrapper (`safeParse`), never as the `onMessage` validator argument, which disconnects with 4002 on a rejected payload (`src/RoomMessages.ts` lines 189–196). <!-- amended 2026-09-25: "Colyseus drops it … there is no '*' handler" was false for 0.18.14; packages/server IMPLEMENTATION-NOTES R1, R3 -->

### 4.4 Server → client messages

```ts
export type ServerMessage =
  | { readonly type: 'battleStart'; readonly battleId: string; readonly format: BattleFormat; readonly seat: 0 | 1;
      readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly stateDigest: string;
      readonly deadlineMs?: number }   // amended 2026-10-12: the turn timer — ms left before the §30.4.3 deadline auto-acts, as sent (absent in raids and on the last turn)
  | { readonly type: 'battleEvents'; readonly battleId: string; readonly turn: number; readonly events: readonly BattleEvent[];
      readonly stateDigest: string; readonly rng: RngState; readonly deadlineMs?: number }
  | { readonly type: 'battleResync'; readonly battleId: string; readonly state: BattleState; readonly stateDigest: string; readonly deadlineMs?: number }
  | { readonly type: 'battleEnd'; readonly battleId: string; readonly outcome: BattleOutcome; readonly rewards: RewardsSummary }
  | { readonly type: 'inventoryDelta'; readonly items: Readonly<Record<string, number>>; readonly money: number | null; // absolute counts
      readonly creaturesAdded: readonly CreatureInstance[]; readonly creaturesRemoved: readonly string[]; readonly creaturesUpdated: readonly CreatureInstance[] }
  | { readonly type: 'progressionDelta'; readonly badges: readonly BadgeId[] | null; readonly trainerExp: number | null; readonly trainerLevel: number | null;
      readonly rating: number | null; readonly dexSeen: readonly string[] | null; readonly dexCaught: readonly string[] | null;
      readonly flags: readonly string[] | null; readonly questProgress: readonly { readonly questId: string; readonly objectiveId: string; readonly count: number; readonly done: boolean }[] | null }
  | { readonly type: 'handover'; readonly roomId: string; readonly seat: SeatReservation; readonly zoneId: ZoneId; readonly x: number; readonly z: number }
  | { readonly type: 'challengeReceived'; readonly fromId: string; readonly fromName: string; readonly expiresInMs: number }
  | { readonly type: 'challengeResult'; readonly targetId: string; readonly result: 'declined' | 'expired' | 'unavailable' }
  | { readonly type: 'tradeUpdate'; readonly tradeId: string; readonly phase: 'requested' | 'open' | 'confirming' | 'complete' | 'cancelled';
      readonly offers: readonly [TradeOffer, TradeOffer]; readonly offerHash: string }
  | { readonly type: 'raidEvents'; readonly raidId: string; readonly round: number; readonly events: readonly BattleEvent[]; readonly stateDigest: string }
  | { readonly type: 'chat'; readonly id: string; readonly name: string; readonly text: string }                       // overworld chat, AOI-scoped, censored, never persisted (30-server-netcode.md §30.6.5)
  | { readonly type: 'dm'; readonly id: number; readonly fromId: string; readonly fromName: string; readonly text: string; readonly sentAt: number } // a persisted DM pushed live (30-server-netcode.md §30.7.2)
  | { readonly type: 'storyBeat'; readonly beatId: string; readonly phase: 'start' | 'complete' }                     // §3.5 runtime: the client renders the beat's `lines` on 'start' and `after` on 'complete'
  | { readonly type: 'toast'; readonly level: 'info' | 'success' | 'warn'; readonly text: string }
  | { readonly type: 'trainerSpotted'; readonly trainerId: string }   // amended 2026-10-20: a trainer saw the player (§30.3 trainer sight); the client walks it up and sends its interact
  | { readonly type: 'realWeather'; readonly kind: WeatherKind | null }   // added 2026-10-20: weather from real life (§30.4.3a): the weather of the player's city, on joining a zone and on change; null: no city (or no answer yet). The client shows it instead of `ZoneState.weather`
  | { readonly type: 'rankedStatus'; readonly state: 'idle' | 'queued' | 'matched'; readonly rating: number; readonly waitedMs: number; readonly window: number;
      readonly opponent: { readonly name: string; readonly rating: number } | null;
      readonly reason: 'left' | 'busy' | 'party' | 'cancelled' | 'started' | null }                                // Phase D13 (30-server-netcode.md §30.4.5a); sent last in SERVER_MESSAGE_TYPES
  | { readonly type: 'towerState'; readonly phase: 'fighting' | 'won' | 'lost' | 'ended'; readonly streak: number; readonly runWins: number; readonly best: number;
      readonly set: number; readonly fight: number; readonly picks: readonly string[];
      readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> } | null }      // Phase D14 (30-server-netcode.md §30.4.9); after rankedStatus in SERVER_MESSAGE_TYPES
  | { readonly type: 'eggHatched'; readonly eggId: string; readonly creature: CreatureInstance; readonly placement: 'party' | 'box';
      readonly parents: readonly [string, string]; readonly zoneId: string }   // added 2026-10-21: breeding (30-server-netcode.md §30.4.3a): a carried egg hatched; after the inventoryDelta adding it; after towerState in SERVER_MESSAGE_TYPES (25 variants)
  | { readonly type: 'nemesisAmbush'; readonly battleId: string; readonly nemesisId: string; readonly name: string; readonly title: string; readonly speciesId: string;
      readonly scar: NemesisScar; readonly rank: number; readonly taunt: string }   // added 2026-10-21: nemeses (§3.15): sent right after the ambush's battleStart; the client's lower third
  | { readonly type: 'nemesisNews'; readonly event: 'rose' | 'rankUp' | 'beaten' | 'caught' | 'faded'; readonly nemesisId: string; readonly name: string; readonly title: string;
      readonly speciesId: string; readonly scar: NemesisScar; readonly rank: number; readonly level: number }   // added 2026-10-21: what became of a nemesis, after its battle's battleEnd; both after eggHatched in SERVER_MESSAGE_TYPES (27 variants)
  | { readonly type: 'fieldPower'; readonly power: 'burn' | 'dig' | 'dive' | 'sense'; readonly spotId: string; readonly x: number; readonly z: number;
      readonly item: string | null; readonly qty: number;
      readonly ghosts: readonly { readonly name: string; readonly wanted: boolean; readonly x: number; readonly z: number; readonly path: readonly (readonly [number, number])[] }[] }
      // added 2026-10-21 (followers, §3.18): a power worked: burn / dig / dive name the spot and what it gave (after its inventoryDelta and progressionDelta); sense lists the ghosts walking here (at most 8, nearest first) and where the player stood; after nemesisNews in SERVER_MESSAGE_TYPES (28 variants)
  // arena PvP (30-server-netcode.md §30.4.10; protocol `arena.ts`) <!-- amended 2026-10-11: arena PvP --> — after towerState (22 variants)
  | { readonly type: 'arenaStatus'; readonly state: 'idle' | 'queued' | 'matched'; readonly kind: ArenaKind | null; readonly waitedMs: number; readonly window: number;
      readonly opponent: { readonly name: string; readonly rating: number } | null; readonly seat: SeatReservation | null;   // seat only while `matched`: the arena room
      readonly reason: 'left' | 'busy' | 'party' | 'cup' | 'cancelled' | 'started' | 'timeout' | null; readonly detail: string | null }
  | { readonly type: 'arenaInvite'; readonly inviteId: string; readonly fromId: string; readonly fromName: string; readonly rules: 'standard' | 'level50'; readonly expiresAt: number }
  | { readonly type: 'arenaInviteResult'; readonly inviteId: string; readonly toName: string; readonly result: 'declined' | 'expired' | 'unavailable' }
  | { readonly type: 'arenaState'; readonly matchId: string; readonly kind: ArenaKind; readonly level: number | null; readonly phase: 'waiting' | 'fighting' | 'ended' | 'cancelled';
      readonly players: readonly { readonly playerId: string; readonly name: string; readonly rating: number }[]; readonly foeName: string | null;
      readonly cup: { readonly id: string; readonly name: string; readonly description: string; readonly endsAt: string } | null; readonly reason: string | null }
  | { readonly type: 'error'; readonly code: 'rateLimited' | 'invalidPayload' | 'notAllowed' | 'notFound' | 'busy' | 'internal'; readonly detail: string | null };

export interface TradeOffer { readonly playerId: string; readonly creatureIds: readonly string[]; readonly money: number; readonly confirmed: boolean }
export interface RewardsSummary { readonly money: number; readonly items: Readonly<Record<string, number>>; readonly trainerExp: number; readonly ratingDelta: number | null; readonly badge: BadgeId | null }
/** Mirrors @colyseus/shared-types ISeatReservation (0.18.2) so the client can call sdk.consumeSeatReservation(seat) with no re-encoding. */
export interface SeatReservation { readonly name: string; readonly sessionId: string; readonly roomId: string; readonly publicAddress?: string; readonly processId?: string; readonly reconnectionToken?: string }
```

<!-- reconciled 2026-09-18: `chat`/`dm` variants added (30-server-netcode.md OQ 2 routed them through `toast`); `storyBeat` added (20-client.md §20.4.7 expected a `dialogue` message no section defined); `handover.seat` widened from string to SeatReservation (30-server-netcode.md OQ 1) -->
**`progressionDelta` and `inventoryDelta` are the only messages that change badges, exp, money, items, creatures, dex, rating or flags on the client.** The client store applies them and nothing else; a `BattleEvent` of `expGain` is animation, not state. `50-verification-budget.md`'s authority test fabricates every client message type and asserts the server's persisted rows are unchanged.

There is no raid-end variant: a raid's rewards reach each participant as `battleEnd { battleId: <the raid id>, outcome: { winner: 0 }, rewards }` (after the round's `inventoryDelta`/`progressionDelta`); the client routes a `battleEnd` whose `battleId` equals `ZoneState.raid.id` to the raid UI. <!-- amended 2026-09-25: packages/server IMPLEMENTATION-NOTES Q14 -->

### 4.5 State digests

Every `battleStart`, `battleEvents`, `battleResync` and `raidEvents` carries `stateDigest = digestBattleState(serverState)` (§2.20). The client runs the same `resolveTurn` as a *preview* to start animating before the server's message arrives; when the server's `battleEvents` lands it compares `digestBattleState(previewState)` with `stateDigest`. Mismatch → `console.warn('battle desync', battleId, turn)`, drop the preview, request `battleResync` (`CLIENT_MESSAGES.battleResync`, §4.3), and render from the server's events. A desync counter is exported to the dev HUD; the fuzz test's promise is that it stays at 0.

`battleResync` answers with the full `BattleState`, including — in `pvp` — the opponent's unrevealed party members with `hp`, `moves`, `heldItem` and `ability` intact. This is accepted for v1: there is no team-preview projection type, and PvP is challenge-only between players who can already see each other. <!-- reconciled 2026-09-18: 30-server-netcode.md OQ 6 decided -->

### 4.6 Handover

Crossing a zone link: the source room sends `handover { roomId, seat, zoneId, x, z }` when the player is within 6 units of the link side's **playable** edge (`playableBounds`, §3.11 — the field edge lies inside the 16 m unwalkable margin and cannot be reached) <!-- amended 2026-09-25: packages/server IMPLEMENTATION-NOTES R7 -->; the client pre-joins the destination via `@colyseus/sdk` `client.consumeSeatReservation` and sends `handoverAck` to the *destination*; the destination marks the player present; the source removes the avatar on receiving the destination's IPC confirm, or after 5 s. The player's authoritative position row is written once, by the destination, on ack. Details in `30-server-netcode.md`.

**Fast travel** <!-- amended 2026-10-06: Phase C3 world map --> — `fastTravel { zoneId }` asks for a free trip to a town's arrival point (`arrivalPoint`, §3.1: on its plaza, facing the centre; Mirevale's spawn `(0, 6)`) <!-- amended 2026-10-06: town arrival point; it was the town's `spawn`, on the west road 50 m from the plaza in eight of the nine towns -->. The source room checks, in order: the destination is a town (`notTown`), the player holds `visited:<zoneId>` (`notVisited`), its badge gate is met (`travelGated`), the player is not in a battle, trade, raid or crossing (`travelBusy`), and 3 s have passed since the last accepted trip or any handover arrival (`travelCooldown`). A refusal is a warn `toast` plus `error { code: 'notAllowed', detail: <reason> }` (protocol `FAST_TRAVEL_REFUSALS`). An accepted trip runs the crossing above from step 2 with the destination's arrival point as the entry point — the same `handover` message, reservation, ack and single position write; the destination faces the avatar toward the plaza (`30-server-netcode.md` §30.2.2 `onJoin` step 3); a trip to the zone the player stands in teleports to its arrival point instead. **Visited flags**: the server writes `visited:<ZoneId>` (content `visitedFlag`, accepted by `isKnownFlag`) the first time a player joins a zone — fresh join or handover arrival — through the room's flag writer and a `progressionDelta { flags }`; registration writes `visited:` for the starting zone.

### 4.7 REST (Fastify 5, `@fastify/jwt` access tokens 15 min, refresh tokens 30 d in `refresh_tokens`)

All bodies and responses are zod-validated in `packages/protocol/src/rest.ts`; the table names the schemas the server and client import.

| Method + path | Request | Response | Auth |
|---|---|---|---|
| `POST /auth/register` | `{ username: /^[a-z0-9_]{3,20}$/, email, password: 8..128, starter: 'bramblecub'|'glimfin'|'cindercap', challenge?: 'nuzlocke'|'hardcore' }` (the run starts with the account; added 2026-10-20) | `{ access, refresh, player: PlayerProfile }` | none |
| `POST /auth/login` | `{ username, password }` | `{ access, refresh, player }` | none |
| `POST /auth/refresh` | `{ refresh }` | `{ access, refresh }` (rotating) | none |
| `POST /auth/logout` | `{ refresh }` | `204` | bearer |
| `POST /auth/forgot` | `{ email }` | `204` always — known or unknown address alike (no enumeration); a known, unbanned account is mailed a single-use reset link `${PUBLIC_WEB_URL}/reset?token=…` valid 30 min; 429 over 5/h per IP; over 3 mails/h per address the 204 is answered and nothing is sent | none |
| `POST /auth/reset` | `{ token, password: 8..128 }` | `204` — new argon2id hash, **every** refresh token of the account revoked, `email_verified_at` set (the link proved the address), audit `auth.passwordReset`; 400 `{ code: 'badToken', reason: 'unknown' \| 'expired' \| 'used' }` | none |
| `POST /auth/verify` | `{ token }` | `204` — stamps `players.email_verified_at` (first stamp kept); same 400 `badToken`. Verification never gates play | none |
| `POST /auth/resend` | — | `204` — a fresh 48 h verification link (supersedes the previous one); 409 `alreadyVerified`; 3/h per player | bearer |
| `GET /me` | — | `PlayerProfile & { party: CreatureInstance[]; box: CreatureInstance[]; inventory: Record<string, number>; badges; flags; quests; battlePass; presence: { roomId: string \| null; zoneId: ZoneId; shard: number }; unreadDm: Record<string, number>; friendRequests: number; liveOps: LiveOpsSummary }` | bearer |
| `POST /zone/enter` | `{ zoneId }` | `{ seat: SeatReservation }` — picks/creates the shard (30-server-netcode.md §30.2.6); 403 `{ code: 'gated', badge }` when the zone's `gate` badge is missing; 409 `{ code: 'wrongZone', zoneId }` unless `zoneId` is the player's persisted `zone_id` or live presence zone (crossings are handovers, never a REST call); during a battle the seat is in the battle's own room (a reload rejoins and receives `battleResync`), any other zone 409 `inBattle` | bearer |
| `POST /profile` | `{ title?: string; motto?: 0..120; body?: string }` (`title ∈ TITLES`, `body ∈ BODIES` ids, §3.12) | `PlayerProfile` | bearer |
| `POST /quests/claim` | `{ questId: string; objectiveId?: string }` (daily/weekly ids `daily:<dayKey>` / `weekly:<weekKey>` use `objectiveId`) | `{ inventory, money, creaturesAdded, questProgress }` | bearer |
| `POST /party/reorder` | `{ order: string[] }` (creature ids, 1..6) | `{ party }` | bearer |
| `POST /party/swap` | `{ partyId: string; boxId: string }` | `{ party, box }` | bearer |
| `POST /party/withdraw` / `POST /party/deposit` | `{ id }` | `{ party, box }` | bearer |
| `POST /creature/:id/nickname` | `{ nickname: 1..16 | null }` | `CreatureInstance` | bearer |
| `POST /creature/:id/moves` | `{ moves: string[] }` (1..4; each already known, learnable at level, or — Phase D2 — a `TM_MOVES` move whose TM the player owns and the species can be taught) | `CreatureInstance` | bearer |
| `POST /creature/:id/setup` | `{ ability: string; heldItem: string | null }` | `CreatureInstance & { inventoryDelta: InventoryDeltaBody }` (`CreatureSetupRes`: equipping takes one from the inventory and returns the previously held item) | bearer |
| `POST /creature/:id/evolve` | `{ into: string }` (level: core evolveReady; Phase D3 stone: an owned stone, one spent; trade: the creature carries `TRADE_EVOLVE_RIBBON`, which is removed) | `CreatureInstance & { inventoryDelta? }` (the stone count when one was spent) | bearer |
| `POST /creature/:id/tutor` | `{ move: string; forget: string | null }` (Phase D2: a tutor NPC of the presence zone teaches `move`; learnable; not yet known; `forget` required at four moves) | `CreatureInstance & { inventoryDelta }` (money − `MOVE_TUTOR_PRICE`) | bearer |
| `POST /creature/:id/release` | — | `204` (refused when `locked`) | bearer |
| `POST /creature/:id/flags` | `{ favorite?: boolean; locked?: boolean }` | `CreatureInstance` | bearer |
| `POST /item/use` | `{ item: string; target: string | null; qty: 1..99 }` | `{ inventory, creaturesUpdated, events }` (server-validated effect) | bearer |
| `POST /heal` | — | `{ party }` (must be in a `healer: true` zone) | bearer |
| `GET /dex` | - | `{ seen: string[]; caught: string[]; variants: Record<string, VariantKey[]>; alpha: string[]; shiny?: string[]; entries?: Record<string, { seenAt; caughtAt; counters; firstSeenZone; viewedAt }>; research?: Record<string, 0..5>; rewards?: string[] }` (Phase D4 `shiny`: species with a shiny catch; Dex research §30.9.4) <!-- amended 2026-10-26: Dex research --> | bearer |
| `POST /dex/viewed/:speciesId` | - | `{ speciesId; viewedAt }` (404 when not in the dex) | bearer |
| `POST /dex/rewards/:rewardId/claim` | - | `{ rewardId; rewards: string[]; inventory; money }` (404, 409 `rewardIncomplete` / `AlreadyClaimed`) | bearer |
| `GET /shop/:zoneId` | — | `{ stock: string[]; prices: Record<string, number> }` | bearer |
| `POST /shop/buy` / `POST /shop/sell` | `{ item: string; qty: 1..99 }` | `{ inventory, money }` | bearer |
| `GET /marketplace` | query `search, variant, isAlpha, isShiny (Phase D4), levelMin, levelMax, sort, page, pageSize<=50` | `{ listings: ListingView[]; total }` (`ListingView.isShiny?` present when true) | bearer |
| `GET /marketplace/my/active` · `GET /marketplace/my/bids` · `GET /marketplace/:id` | — | `ListingView[]` / `ListingView & { bids: BidView[] }` | bearer |
| `POST /marketplace/list` | `{ creatureId, startingBid >= 100, buyNowPrice: number | null, durationHours: 12|24|48 }` | `ListingMutationRes` = `ListingView & { inventoryDelta }` (`creaturesRemoved: [creatureId]`) (5/h; 409 `inBattle` during a battle) | bearer |
| `POST /marketplace/:id/bid` | `{ amount }` | `ListingMutationRes` (`inventoryDelta.money` after escrow) (30/h) | bearer |
| `POST /marketplace/:id/buy-now` · `POST /marketplace/:id/cancel` | — | `ListingMutationRes` (buy-now: `money` + `creaturesAdded`; cancel: `creaturesAdded`) | bearer |
| `GET /friends` | — | `{ friends: FriendView[]; incoming; outgoing }` | bearer |
| `POST /friends/request` · `/accept` · `/decline` · `/remove` | `{ username }` | `{ friends, incoming, outgoing }` | bearer |
| `GET /messages/:username?before=&limit<=50` | — | `{ messages: MessageView[] }` | bearer |
| `POST /messages/:username` | `{ text: 1..300 }` | `MessageView` | bearer |
| `POST /messages/read` | `{ username }` | `204` | bearer |
| `GET /guilds?search=` · `GET /guilds/:id` | — | `GuildView[]` / `GuildView & { members }` | bearer |
| `POST /guilds` | `{ name: 3..24, tag: /^[A-Z0-9]{3,4}$/ }` (costs `GUILD.createCost` 5000, 409 `InsufficientFunds`) | `GuildCreateRes` = `GuildView & { inventoryDelta }` (`money` after the charge) | bearer |
| `POST /guilds/:id/join` · `/leave` · `/kick` · `/promote` | `{ playerId? }` | `GuildView` | bearer |
| `GET /leaderboard?mode=rating|dex|trainerLevel|towerStreak|daily|nuzlocke|hardcore|speedrun&page=` | - | `{ rows: LeaderboardRow[] }` (Phase D14: `towerStreak` ranks `player_streaks.best` desc, then `current`, then username, players with best > 0 only; every row carries `towerBest?` / `towerCurrent?`; `daily` (added 2026-10-20) ranks today's winners by `daily_results.turns` asc, then the earlier win, and carries `dailyTurns?` / `dailyMarks?`; `nuzlocke` / `hardcore` (added 2026-10-20) list the players holding the mode's flag: cleared runs first (earliest clear first), then runs still going, then failed ones, each by badges desc, with `challengeBadges?` / `challengeState?`; `speedrun` (added 2026-10-20) ranks the `champion` split of runs that hold the first beat's split, fastest first, with `speedrunMs?`) | bearer |
| `GET /players/:username` | — | `PublicProfile` (allow-list, §5.3) | bearer |
| `GET /battle-pass` | — | `{ trainerExp, trainerLevel, claimed: number[], mythicalChoice: string | null, rewards: BattlePassReward[] }` | bearer |
| `POST /battle-pass/claim` | `{ level }` | `{ claimed, inventory, money, creaturesAdded }` | bearer |
| `POST /battle-pass/mythical-choice` | `{ species: 'lumyth' | 'noxmyth' }` | `{ creaturesAdded }` | bearer |
| `GET /history/battles?page=` · `GET /history/trades?page=` | — | rows (a battle row's optional `arena`: the `ArenaKind` from its start snapshot) | bearer |
| `GET /creature/:id/history` <!-- added 2026-10-20: creature history --> | - | `CreatureHistoryRes { originalTrainer: string \| null, events: CreatureEvent[] }` oldest first (at most 200): `met { how: 'caught' \| 'received', speciesId, level, zoneId \| null, trainer }`, `traded` / `sold` / `gift { from, to }`, `evolved { from, into }`, `badge { badge }`, `champion`, `legendary { species, caught }`, `hatched` (breeding), `nemesis { how: 'beaten' \| 'caught', name, speciesId, rank, zoneId }` (added 2026-10-21: it struck down the nemesis `name`, or was it), `bounty { target, targetKind: 'ghost' \| 'nemesis', reward, zoneId }` (added 2026-10-21: it led the party that brought `target` in, §3.17), each with `at`; names as they were then. Any signed-in player may read any creature's history; 404 `notFound` | bearer |
| `POST /history/battles/:battleId/share` <!-- added 2026-10-20: battle replays --> | `{}` | `{ token }`: 12 url-safe characters, the same token on every share of that battle (404 `notFound` for another player's battle; 409 `notReplayable` for a row without `start` / `final_digest`, 409 `stale` when the row no longer replays to its `final_digest`) | bearer |
| `GET /replay/:token` | - | `ReplayRes { token, format, seat, labels: [string \| null, string \| null], result, turns, happenedAt, seed, start, actions, finalDigest }`: the battle frozen and anonymised at share time (player sides' trainers `r:<side>`, creatures `r:<side>:<i>`, owners null; `createBattle({ id: REPLAY_BATTLE_ID, format, seed, ...start })` + the actions end on `finalDigest`); `seat` the sharer's side; 404 `notFound` | none (rate limit `replay` per IP) |
| `GET /seasons` <!-- added 2026-10-20: ranked seasons --> | - | `SeasonsRes { current: { season, startsAt, endsAt, finalsAt, finals, top }, past: { season, startsAt, endsAt, finalsAt, top }[] }`: the running season (content `seasonAt`) with its top eight so far, and the latest six closed seasons' top eight; a row is `{ rank, username, rating, wins, losses, title: 'champion' \| 'finalist' \| null }`; banned trainers left out | bearer |
| `GET /seasons/:season?page=` <!-- added 2026-10-20 --> | - | `SeasonStandingsRes { season, rows }`: a closed season's final standings, 50 a page; 404 for a season not closed | bearer |
| `GET /seasons/titles/:username` <!-- added 2026-10-20 --> | - | `SeasonTitlesRes { username, titles: { season, rank, title }[] }`: every season the trainer ended in the top eight, newest first; 404 unknown or banned | bearer |
| `GET /arena/live` <!-- added 2026-10-20: spectator mode --> | - | `LiveListRes { matches: { matchId, kind, finals, players: [{ name, rating }, { name, rating }], turn, startedAt }[] }` (≤ 50): the arena's queued two-player matches being fought (never a friend battle, training or the daily), League Finals first, then the highest rated pairs | bearer |
| `GET /arena/live/:matchId` <!-- added 2026-10-20 --> | - | `LiveFeedRes`: the match row plus `replay { format: 'pvp', seat: 0, labels, seed, start, actions, digest }` (anonymised like a shared replay, a turn behind the players: `createBattle` + `resolveTurn` over `actions` ends on `digest`) and `outcome` (null while it goes on; the finished fight stays 3 min); 404 when there is none | bearer |
| `GET /world/shadow` <!-- added 2026-10-20: honor shapes the world --> | - | `WorldShadowRes { season, zones: { zoneId, level: 1..4, light, shadow }[] }`: the zones a shadow lies over this season and the tally behind each; a zone not listed is clear | bearer |
| `GET /bounties` <!-- added 2026-10-21: the bounty board --> | - | `BountiesRes { enabled, nextPostingAt, wanted: BountyPoster[] (≤ 40, richest first), personal: BountyPoster[] (≤ 10, the caller's nemeses from rank 2), posted: { id, target, reward, fee, status: 'open' \| 'claimed' \| 'expired', claimedBy, postedAt, expiresAt }[] (≤ 10), claims: { kind, target, claimedBy, payout, bonus, zoneId, at }[] (≤ 10, nemeses left out), ghosts: { name, zoneId, speciesId, level, wins, wanted }[] (≤ 30, the caller's own left out), you: { badlander, lawlander, open, claimsToday, atBoard }, money }`, `BountyPoster { id, kind: 'game' \| 'player' \| 'nemesis', target, speciesId, level, zoneId, wins \| null, rank \| null, reward, withLawlander, postedBy \| null, postedAt, expiresAt \| null, mine }` (§3.17). Expired posts are refunded and the game's bounties posted (on schedule) first. `enabled` false and every list empty while env `BOUNTIES` is off | bearer |
| `GET /camps` <!-- added 2026-10-22: camp bases --> | - | `CampsRes { enabled, here: { zoneId, camp: CampView \| null } \| null (the camp of the zone the caller stands in), mine: CampView \| null, earned: CampTrophy[] (≤ 80), log: { zoneId, raider, won, cut, tookOver, line, at }[] (≤ 20, newest first), camps: { zoneId, owner, name }[] (every held camp), you: { inRun, money } }`; `CampView { zoneId, owner, name, trophies: CampTrophy[] (≤ 3), guard: { speciesId, level, isShiny }[] (≤ 6), claimedAt, mine, ownerOnline, ownerInRun, inactive, raidedToday, cut }`, `CampTrophy { id: '<kind>:<ref>', kind: 'scar' \| 'legend' \| 'medal' \| 'achievement' \| 'bounty', label }`. CAMPS=off: `enabled: false`, all empty | bearer |
| `POST /camps/edit` <!-- added 2026-10-22 --> | `{ name?: string (1..24), trophies?: string[] (≤ 3, ids from earned) }` (one at least) | `CampsRes`; audit row `camp.edit`; the zone rooms told (`ewa:camp`). 400 `blockedWord` \| `invalidPayload`; 409 `noCamp` \| `badTrophy` \| `campsOff` \| `inBattle` | bearer |
| `POST /camps/abandon` <!-- added 2026-10-22 --> | `{}` | `CampsRes`; audit row `camp.abandon`. 409 `noCamp` \| `campsOff` \| `inBattle` | bearer |
| `POST /bounties` <!-- added 2026-10-21 --> | `{ target: username, reward: int }` | `BountiesRes`; reward + cut taken into escrow in one transaction with an audit row `bounty.post`. 409 `noBadlander` \| `ownGhost` \| `noGhost` \| `tooLow` \| `tooHigh` \| `alreadyPosted` \| `tooMany` \| `notAtBoard` (not in a town) \| `bountiesOff` \| `InsufficientFunds` \| `inBattle` | bearer |
| `GET /world/ecosystem/:zoneId` <!-- added 2026-10-21: a living ecosystem --> | - | `EcosystemRes { zoneId, enabled, season, week: 1..4, endsAt, takes, judged, surging, scarce, tilted: EcoSpecies[] (≤ 40), migrantsIn: { speciesId, from }[], migrantsOut: { speciesId, to }[] (≤ 8), shadow: 0..4, light: 0..4 }`, `EcoSpecies { speciesId, factor, cause: 'hunted' \| 'feeding' \| 'shadow' \| 'light' \| 'migrant' \| 'away' \| null, caught, ko, preyOn, huntedBy }`: "This week on <zone>" (§3.16). Surging: the feeding predators; scarce: overhunted or away; tilted: drawn by shadow or light. `enabled` false and every list empty while env `ECOSYSTEM` is off; 404 for a zone without wild creatures | bearer |
| `GET /factions` <!-- added 2026-10-20: Majin vs Tenjin seasons --> | - | `FactionsRes { season, endsAt, mine: { side, points } \| null, points: { majin, tenjin }, members: { majin, tenjin }, top: { majin, tenjin }: { username, points }[] (≤ 5, banned left out), sky: side \| null, chronicle: { season, winner \| null, line }[] (≤ 6, newest first) }`: the season's two sides, the caller's, the side holding Solenne's sky (the last closed season's winner) | bearer |
| `POST /factions/join` <!-- added 2026-10-20 --> | `{ side: 'majin' \| 'tenjin' }` | `FactionsRes`; the side holds for the season: the other side is 409 `alreadyJoined { side }`, the same side again is 200 | bearer |
| `GET /factions/sky` <!-- added 2026-10-20 --> | - | `{ sky: side \| null }`: the last closed season's winner (null in season 1 or on a tie) | bearer |
| `GET /legends` <!-- added 2026-10-20: one roaming legendary per season --> | - | `LegendsRes { season, species, zoneId \| null, movesAt \| null, caught: { season, species, username, at } \| null, past: { season, species, username, at }[] (≤ 50, newest first) }`: the season's roamer (content `roamerOf`), the route it is on and when it moves on while nobody has caught it, its first catcher this season, every season's first catcher | bearer |
| `GET /daycare` <!-- added 2026-10-21: breeding --> | - | `DaycareRes { zoneId, pair: CreatureInstance[] (≤ 2, in the order left), refusal: 'legendary' \| 'unrelated' \| null, hatches: speciesId \| null, bandborn, eggAt \| null, eggReady, eggs: { id, place: 'party' \| 'box', stepsTotal, stepsWalked, bandborn, parents: [name, name], zoneId, laidAt }[] (≤ 64), carryMax, eggMax }` (content daycare.ts); anywhere | bearer |
| `POST /daycare/leave` <!-- added 2026-10-21 --> | `{ id }` | `DaycareActionRes { daycare, party, box }`: a party or box creature goes to the Daycare (slot kind `daycare`); 409 `notAtDaycare` outside Mirevale, `daycareFull` (two there), `challenge` (an active run), `fallen`, `InvalidSlot`, `PartyMinimum`; a pair that can breed sets the egg timer to now + `EGG_READY_MS` | bearer |
| `POST /daycare/take` <!-- added 2026-10-21 --> | `{ id }` | `DaycareActionRes`: back to the party while it has room, else the box; the timer stops; 409 `notAtDaycare`, `InvalidSlot` | bearer |
| `POST /daycare/collect` <!-- added 2026-10-21 --> | - | `DaycareActionRes`: the ready egg, carried while fewer than `EGG_CARRY_MAX` are, else boxed; the timer starts over; 409 `notAtDaycare`, `noEgg`, `eggsFull`, `challenge` | bearer |
| `POST /eggs/:id/move` <!-- added 2026-10-21 --> | `{ place: 'party' \| 'box' }` | `DaycareActionRes`; 409 `eggsCarried` past `EGG_CARRY_MAX`; 404 for anyone else's egg | bearer |
| `GET /nemeses` <!-- added 2026-10-21: nemeses --> | - | `NemesesRes { nemeses: { id, name, title, speciesId, level, isShiny, scar, move \| null, rank, bornZone, lastZone, lastSeenAt, memory: { how: 'ko' \| 'breakout', zoneId, foeSpecies, foeName \| null, move \| null, orb \| null } }[] (≤ 10, newest first), max }`: the caller's active nemeses (§3.15) | bearer |
| `GET /ghost` <!-- added 2026-10-20: ghost trainers --> | - | `GhostRes { haunting: { zoneId, leftAt, party: { speciesId, level }[] (≤ 6) } \| null, won, lost, fights: { challenger, zoneId, won, at }[] (≤ 20, newest first) }`: where the caller's ghost haunts (null before they ever left, or after `GHOST_DAYS`), its record and latest fights | bearer |
| `GET /weather/cities?q=` <!-- added 2026-10-20: weather from real life --> | - | `WeatherCitiesRes { cities: { name, region?, country, lat, lon }[] }` (≤ 5, Open-Meteo geocoding asked by the server, `region` its province or state, a place reading exactly like one already listed dropped, coordinates rounded to 0.1°); `q` 2..60 characters; 503 `weatherUnavailable` when the service does not answer; limit `weather` | bearer |
| `POST /weather/city` <!-- added 2026-10-20 --> | `{ city: { name, region?, country, lat, lon } \| null }` | `RealWeatherRes { city \| null, kind \| null }`: the city stored on the player (coordinates rounded to 0.1°) and its weather now; null turns it off. The room holding the player hears it on `ewa:weather:<playerId>` | bearer |
| `GET /weather` <!-- added 2026-10-20 --> | - | `RealWeatherRes`: the player's city and its cached weather | bearer |
| `GET /speedrun` · `GET /speedrun/:username` <!-- added 2026-10-20: verified speedruns --> | - | `SpeedrunRes { username, playMs, running, counted, finishMs \| null, splits: { split, playMs, at }[] }`: the server's play clock now, whether the run holds the first beat's split (`counted`), the Champion split's time; another trainer's by name (404 unknown or banned) | bearer |
| `POST /challenge` <!-- added 2026-10-20: challenge modes --> | `{ mode: 'normal' \| 'nuzlocke' \| 'hardcore' }` | `{ flags }`: every `challenge:` flag cleared, then the mode's set (`normal`: none); 409 `badges` after the first badge, 409 `fallen` once a creature has fallen, 409 `inBattle` | bearer |
| `GET /daily` <!-- added 2026-10-20: the daily challenge --> | - | `DailyRes { dayKey, number, endsAt, team[3], foe[3] ({ speciesId, level, moves, ability }), foeName, par, best: { turns, marks, battleId } \| null, attempts, winners }` for today (UTC) | bearer |
| `POST /daily/start` | `{}` | `{ seat }` in a fresh arena room of kind `daily` (409 `offline` / `busy`; any party may play: the team is the day's) | bearer |
| `GET /arena` <!-- amended 2026-10-11: arena PvP --> | — | `{ rating, peakRating, rankedMatches, level: 50, cup: { id, name, description, endsAt }, status: ArenaStatus, live: { roomId } \| null }` | bearer |
| `POST /arena/queue` · `POST /arena/queue/leave` | `{ mode: 'standard' \| 'level50' \| 'ranked' \| 'cup' }` · `{}` | `ArenaStatus` (a refusal is `idle` + `reason` / `detail`) | bearer |
| `POST /arena/training` | `{ rules: 'standard' \| 'level50', difficulty: 'easy' \| 'normal' \| 'hard' }` | `{ seat }` (409 `busy` / `party`) | bearer |
| `POST /arena/invite` · `POST /arena/invite/reply` | `{ username, rules }` · `{ inviteId, accept }` | `{ inviteId, expiresAt }` (409 `notFriends` / `self` / `friendOffline` / `friendBusy` / `busy` / `party`) · `{ seat \| null }` (404 `NotFound` / `expired`) | bearer |
| `POST /arena/rejoin` | `{}` | `{ seat }` in the arena room holding the player (404 when none) | bearer |
| `GET /admin/stats` · `GET /admin/players?q=&page=` · `GET /admin/metrics` · `POST /admin/ban` · `POST /admin/unban` | `{ username, reason: 1..200 }` | — / `ProcessMetrics` (30-server-netcode.md §30.10.2) | bearer + `is_admin` |
| `GET /health` | — | `{ status: 'ok', time }` | none |

<!-- reconciled 2026-09-18: `/zone/enter`, `/profile`, `/quests/claim`, `/admin/metrics` added (30-server-netcode.md §30.2.6, §30.5, §30.9.1, §30.10.2 used them; OQ 3); `GET /me` gains presence/unread/liveOps; guild tag {3,4} (30-server-netcode.md OQ 5 — the persist column is varchar(4) and a 2-char tag collides with the 2-letter type glyphs in the HUD) -->
<!-- amended 2026-10-11: arena PvP — every `/arena/*` route needs presence (409 `offline`); `POST /zone/enter` answers 409 `inArena` (+ `roomId`) while an `arena` room holds the player in `waiting` / `fighting`, and the client rejoins through `POST /arena/rejoin` (30-server-netcode.md §30.4.10) -->
<!-- amended 2026-09-25: `/zone/enter` wrongZone + battle-room seat, and the `inventoryDelta` extensions of `/creature/:id/setup`, `/guilds`, `/marketplace/*` (protocol `InventoryDeltaBodySchema`, additive) — packages/server IMPLEMENTATION-NOTES R2, P1, P3. Without `wrongZone` a client could "fast travel" by entering any ungated zone and being placed at its spawn -->
Every user-supplied string that reaches SQL `LIKE`/`ILIKE` goes through `escapeLike()` in `@ewa/persist`; there is no regex search anywhere. Domain errors from persist (§5.5) map to `409 { code }`; `RateLimited` → 429; zod → 400 `invalidPayload`; JWT → 401; everything else → 500 `internal`.

---

## §5 @ewa/persist

<!-- reconciled 2026-09-18: §5 now follows packages/persist as implemented (IMPLEMENTATION-NOTES.md, 55/55 tests on PGlite and PostgreSQL 17.6); every deviation below is marked -->
Drizzle `pg-core` schema in `packages/persist/src/schema/*.ts` (one file per area, all re-exported from `schema/index.ts`; `drizzle.config.ts` globs the folder — the code is the reference, this section documents it); verified APIs: `pgTable`, `pgEnum`, `uuid`, `text`, `varchar`, `integer`, `smallint`, `bigint`, `boolean`, `timestamp`, `jsonb`, `index`, `uniqueIndex`, `primaryKey`, `foreignKey`, `check`; `drizzle()` from `drizzle-orm/node-postgres` and `drizzle-orm/pglite`; `migrate()` from `drizzle-orm/node-postgres/migrator` and `drizzle-orm/pglite/migrator`; `db.transaction(tx => …)`; `tx.select().from(t).where(…).for('update')`.

### 5.1 Tables

```ts
export const slotKind = pgEnum('slot_kind', ['party', 'box', 'listing', 'trade_escrow', 'daycare']);   // 'daycare' added 2026-10-21 (migration 0016_breeding): left at the Daycare, out of play like a listing
export const listingStatus = pgEnum('listing_status', ['active', 'sold', 'expired', 'cancelled']);
export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted']);
export const guildRole = pgEnum('guild_role', ['leader', 'officer', 'member']);
export const battleFormat = pgEnum('battle_format', ['wild', 'trainer', 'league', 'pvp', 'raid']);

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 20 }).notNull(),
  usernameLower: varchar('username_lower', { length: 20 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  passwordHash: text('password_hash').notNull(),              // @node-rs/argon2, argon2id, m=19456 t=2 p=1
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),   // migration 0002: set by POST /auth/verify (or a reset); null = unverified
  money: integer('money').notNull().default(3000),
  zoneId: varchar('zone_id', { length: 32 }).notNull().default('mirevale'),
  x: real('x').notNull().default(0), z: real('z').notNull().default(6), angle: real('angle').notNull().default(0),
  body: varchar('body', { length: 32 }).notNull().default('ranger_m'),
  title: varchar('title', { length: 40 }).notNull().default('Rookie Trainer'),
  motto: varchar('motto', { length: 120 }).notNull().default(''),
  rating: integer('rating').notNull().default(1000),
  peakRating: integer('peak_rating').notNull().default(1000),
  rankedMatches: integer('ranked_matches').notNull().default(0),
  trainerExp: integer('trainer_exp').notNull().default(0),
  isAdmin: boolean('is_admin').notNull().default(false),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  playMs: bigint('play_ms', { mode: 'number' }).notNull().default(0),           // verified speedruns (migration 0009): the banked play clock
  playStartedAt: timestamp('play_started_at', { withTimezone: true }),          // set while a zone or arena room holds the player
  weatherCity: jsonb('weather_city').$type<WeatherCity>(),                         // weather from real life (migration 0010): { name, region?, country, lat, lon } rounded to 0.1°, null: off
}, (t) => [
  uniqueIndex('players_username_lower_uq').on(t.usernameLower),
  uniqueIndex('players_email_uq').on(t.email),
  index('players_rating_idx').on(t.rating),
  check('players_money_ck', sql`${t.money} >= 0`),            // reconciled 2026-09-18: defence in depth behind addMoney's `WHERE money + delta >= 0`
]);

export const creatureInstances = pgTable('creature_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  slotKind: slotKind('slot_kind').notNull(),
  slotIndex: integer('slot_index').notNull(),                 // party 0..5; box 0..; listing/escrow 0
  speciesId: varchar('species_id', { length: 32 }).notNull(),
  nickname: varchar('nickname', { length: 16 }),
  level: smallint('level').notNull(),
  exp: integer('exp').notNull().default(0),
  hp: integer('hp').notNull(),
  moves: jsonb('moves').$type<MoveSlot[]>().notNull(),
  status: jsonb('status').$type<StatusId[]>().notNull().default([]),
  ability: varchar('ability', { length: 32 }).notNull(),
  heldItem: varchar('held_item', { length: 32 }),
  variantKey: varchar('variant_key', { length: 8 }).notNull().default('normal'),
  isAlpha: boolean('is_alpha').notNull().default(false),
  isShiny: boolean('is_shiny').notNull().default(false),           // migration 0003_shiny (Phase D4)
  honor: smallint('honor').notNull().default(0),                   // migration 0005_honor: the honor ledger (-10..10) <!-- amended 2026-10-08: the honor ledger, lawlander (#137) -->
  caughtZoneId: varchar('caught_zone_id', { length: 32 }),
  caughtAt: timestamp('caught_at', { withTimezone: true }),
  ribbons: jsonb('ribbons').$type<string[]>().notNull().default([]),
  favorite: boolean('favorite').notNull().default(false),
  locked: boolean('locked').notNull().default(false),
  version: integer('version').notNull().default(0),           // bumped on every write; informational only — locks do the work
}, (t) => [
  uniqueIndex('creature_owner_slot_uq').on(t.ownerId, t.slotKind, t.slotIndex),
  index('creature_owner_idx').on(t.ownerId),
  index('creature_species_idx').on(t.speciesId),
  check('creature_level_ck', sql`${t.level} between 1 and 100`),
  check('creature_hp_ck', sql`${t.hp} >= 0`),
  // reconciled 2026-09-18: the 100..105 band is the transaction-local staging area of reorderParty/swap (`slot_index += 100`, then final); a committed row is never parked there (asserted in slots.test.ts)
  check('creature_party_slot_ck', sql`${t.slotKind} <> 'party' or ${t.slotIndex} between 0 and 5 or ${t.slotIndex} between 100 and 105`),
]);

export const inventoryItems = pgTable('inventory_items', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  itemId: varchar('item_id', { length: 32 }).notNull(),
  qty: integer('qty').notNull(),
}, (t) => [primaryKey({ columns: [t.playerId, t.itemId] }), check('inventory_qty_ck', sql`${t.qty} between 0 and 999`)]);

export const badges = pgTable('badges', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  badgeId: varchar('badge_id', { length: 16 }).notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.badgeId] })]);

export const storyFlags = pgTable('story_flags', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  flag: varchar('flag', { length: 64 }).notNull(),
  setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.flag] })]);

export const dexEntries = pgTable('dex_entries', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  speciesId: varchar('species_id', { length: 32 }).notNull(),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  caughtAt: timestamp('caught_at', { withTimezone: true }),
  variants: jsonb('variants').$type<VariantKey[]>().notNull().default([]),
  alphaSeen: boolean('alpha_seen').notNull().default(false),
  shinyCaught: boolean('shiny_caught').notNull().default(false),   // migration 0003_shiny (Phase D4)
  counters: jsonb('counters').$type<Record<string, number>>().notNull().default({}), // migration 0025_dex_research (§30.9.4)
  firstSeenZone: varchar('first_seen_zone', { length: 32 }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.playerId, t.speciesId] })]);

export const dexRewards = pgTable('dex_rewards', {   // migration 0025_dex_research: a Dex completion reward claimed, once each
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  rewardId: varchar('reward_id', { length: 64 }).notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.rewardId] })]);

export const questProgress = pgTable('quest_progress', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  questId: varchar('quest_id', { length: 48 }).notNull(),
  objectiveId: varchar('objective_id', { length: 48 }).notNull(),
  count: integer('count').notNull().default(0),
  done: boolean('done').notNull().default(false),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.playerId, t.questId, t.objectiveId] })]);

export const friendships = pgTable('friendships', {
  requesterId: uuid('requester_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  status: friendshipStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] }), index('friendships_addressee_idx').on(t.addresseeId),
  // reconciled 2026-09-18: one row per unordered pair; a reverse request accepts the pending row instead of inserting a mirror
  uniqueIndex('friendships_pair_uq').on(sql`least(${t.requesterId}, ${t.addresseeId})`, sql`greatest(${t.requesterId}, ${t.addresseeId})`),
  check('friendship_not_self_ck', sql`${t.requesterId} <> ${t.addresseeId}`)]);

export const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  fromId: uuid('from_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  toId: uuid('to_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 300 }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (t) => [index('messages_pair_idx').on(t.fromId, t.toId, t.sentAt), index('messages_to_unread_idx').on(t.toId, t.readAt)]);

export const guilds = pgTable('guilds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 24 }).notNull(),
  nameLower: varchar('name_lower', { length: 24 }).notNull(),
  tag: varchar('tag', { length: 4 }).notNull(),
  leaderId: uuid('leader_id').notNull().references(() => players.id),
  motd: varchar('motd', { length: 200 }).notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('guilds_name_lower_uq').on(t.nameLower), uniqueIndex('guilds_tag_uq').on(t.tag)]);

export const guildMembers = pgTable('guild_members', {
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  role: guildRole('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.guildId, t.playerId] }), uniqueIndex('guild_members_player_uq').on(t.playerId)]); // one guild per player

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => players.id),
  creatureId: uuid('creature_id').notNull().references(() => creatureInstances.id),
  speciesId: varchar('species_id', { length: 32 }).notNull(),    // denormalised for search
  level: smallint('level').notNull(), variantKey: varchar('variant_key', { length: 8 }).notNull(), isAlpha: boolean('is_alpha').notNull(),
  isShiny: boolean('is_shiny').notNull().default(false),           // migration 0003_shiny (Phase D4), denormalised for the filter
  startingBid: integer('starting_bid').notNull(),
  currentBid: integer('current_bid'),
  currentBidderId: uuid('current_bidder_id').references(() => players.id),
  buyNowPrice: integer('buy_now_price'),
  status: listingStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [index('listings_active_idx').on(t.status, t.expiresAt), index('listings_seller_idx').on(t.sellerId),
  index('listings_search_idx').on(t.status, t.speciesId, t.level), uniqueIndex('listings_creature_active_uq').on(t.creatureId).where(sql`${t.status} = 'active'`)]);

export const bids = pgTable('bids', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  bidderId: uuid('bidder_id').notNull().references(() => players.id),
  amount: integer('amount').notNull(),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('bids_listing_idx').on(t.listingId, t.placedAt)]);

export const battleHistory = pgTable('battle_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  battleId: uuid('battle_id').notNull(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  opponent: varchar('opponent', { length: 64 }).notNull(),         // username or content trainer id
  format: battleFormat('format').notNull(),
  result: varchar('result', { length: 8 }).notNull(),              // 'win' | 'loss' | 'draw' | 'fled' | 'caught'
  turns: smallint('turns').notNull(),
  ratingDelta: integer('rating_delta'),
  rewards: jsonb('rewards').$type<RewardsSummary>().notNull(),
  seed: jsonb('seed').$type<RngState>().notNull(),                  // replay: start + seed + actions reproduce the battle
  actions: jsonb('actions').$type<[ReplayChoice, ReplayChoice][]>().notNull(),   // Phase D6: ReplayChoice = Action | null | [Action | null, Action | null] (doubles: one pair per player side)
  start: jsonb('start').$type<BattleStartSnapshot>(),               // migration 0001: the createBattle input minus the seed; null before 0001
  finalDigest: varchar('final_digest', { length: 8 }),               // migration 0001: digestBattleState of the final state; null before 0001
  happenedAt: timestamp('happened_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('battle_history_player_idx').on(t.playerId, t.happenedAt)]);

export const tradeHistory = pgTable('trade_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tradeId: uuid('trade_id').notNull(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id').notNull().references(() => players.id),
  sent: jsonb('sent').$type<{ id: string; speciesId: string; level: number }[]>().notNull(),
  received: jsonb('received').$type<{ id: string; speciesId: string; level: number }[]>().notNull(),
  moneySent: integer('money_sent').notNull().default(0),
  moneyReceived: integer('money_received').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('trade_history_player_idx').on(t.playerId, t.completedAt)]);

export const battlePass = pgTable('battle_pass', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  level: smallint('level').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  mythicalChoice: varchar('mythical_choice', { length: 16 }),      // set on the level-50 row only
}, (t) => [primaryKey({ columns: [t.playerId, t.level] })]);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),                        // sha-256 of the opaque token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash), index('refresh_tokens_player_idx').on(t.playerId)]);

// migration 0002_email_tokens (Phase C6): single-use password-reset / email-verification tokens, stored hashed like refresh tokens
export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 8 }).$type<'reset' | 'verify'>().notNull(),
  tokenHash: text('token_hash').notNull(),                        // sha-256 of the opaque token (32 random bytes, base64url)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),   // reset 30 min, verify 48 h
  usedAt: timestamp('used_at', { withTimezone: true }),            // consumed, or superseded by a newer token of the same kind
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('email_tokens_hash_uq').on(t.tokenHash), index('email_tokens_player_kind_idx').on(t.playerId, t.kind), check('email_tokens_kind_ck', sql`${t.kind} in ('reset', 'verify')`)]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorId: uuid('actor_id'),                                      // null = system
  action: varchar('action', { length: 48 }).notNull(),           // 'creature.transfer' | 'listing.bid' | 'admin.ban' | 'badge.award' | …
  subject: varchar('subject', { length: 64 }),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('audit_log_actor_idx').on(t.actorId, t.at), index('audit_log_action_idx').on(t.action, t.at)]);
```

`players.x/z` use `real`; `real` is imported from `drizzle-orm/pg-core` alongside the others. `bigserial` likewise. `BattleStartSnapshot` is `{ readonly zoneId: string; readonly terrain: string; readonly sides: readonly [unknown, unknown]; readonly weather?: string; readonly slots?: 2; readonly noExp?: true; readonly catchBonus?: Readonly<Record<string, number>> }` (`slots` — Phase D6: a doubles battle; `noExp` — Phase D14: a battle tower fight) (the two `createBattle` sides, deep-copied before the call); with it a battle replays from the row alone — `createBattle({ id, format, seed, ...start })` then `resolveTurn` over `actions` reproduces `final_digest`. The original table (seed + actions only) could not replay without the starting parties. <!-- amended 2026-09-25: migration 0001_battle_replay, packages/server IMPLEMENTATION-NOTES S10/P6, packages/persist IMPLEMENTATION-NOTES "Server part 2 additions" --> There is no `party_slots`/`box_slots` table: the `(owner_id, slot_kind, slot_index)` unique index on `creature_instances` *is* the slot model, and a reorder is one transaction that rewrites `slot_index` for the affected rows.

### 5.2 Repository interfaces

<!-- reconciled 2026-09-18: signatures as implemented in packages/persist/src/repos/*.ts — explicit `now: Date` on every method that stamps a time (persist never reads the wall clock), `toPublic(row, extras)`, `CreatureRecord`, `lockMany`, a `battlePass` repo, `swap`, and the closed `PersistErrorCode` union of §5.5 -->
<!-- amended 2026-09-25: server part 1/2 repo additions folded (PlayerRepo setAdmin/bannedIds/byIds/search/counts and leaderboard 'dex', ProgressRepo markSeen → boolean/flagSetAt/claimObjective/pruneSyntheticQuests, MarketRepo closeExpiredDetailed + ClosedListing, AuthRepo ownerOf) — packages/persist/src/repos/*.ts -->
```ts
import type { PgTransaction } from 'drizzle-orm/pg-core';
export type Tx = PgTransaction<any, any, any>;   // the one place `any` is permitted: driver-generic transaction handle
export interface Db { transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }

/** A CreatureInstance plus the persist-side facts core does not model. */
export interface CreatureRecord extends CreatureInstance { readonly slotKind: 'party' | 'box' | 'listing' | 'trade_escrow'; readonly slotIndex: number; readonly version: number }
export type SlotTarget = { readonly kind: 'party'; readonly index: number } | { readonly kind: 'box'; readonly index: number | 'nextBox' };
export type TransferReason = 'trade' | 'marketSale' | 'gift';
/** What toPublic needs beyond the players row; playerRepo.publicProfile gathers them, tests pass them directly. */
export interface PublicExtras { readonly badges: readonly BadgeId[]; readonly guildTag: string | null; readonly dexCaughtCount: number; readonly showcase: readonly CreatureInstance[] }

export interface PlayerRepo {
  create(tx: Tx, p: { username: string; email: string; passwordHash: string }, now: Date): Promise<{ id: string }>;   // UsernameTaken | EmailTaken
  byId(tx: Tx, id: string): Promise<PlayerRow | null>;
  byUsername(tx: Tx, usernameLower: string): Promise<PlayerRow | null>;
  byEmail(tx: Tx, email: string): Promise<PlayerRow | null>;
  /** SELECT … FOR UPDATE. Every write to money/rating/trainerExp/position goes through a row locked by this. */
  lock(tx: Tx, id: string): Promise<PlayerRow>;
  /** Locks several player rows in ascending uuid order (the deadlock-free order of §5.5). */
  lockMany(tx: Tx, ids: readonly string[]): Promise<Map<string, PlayerRow>>;
  addMoney(tx: Tx, id: string, delta: number): Promise<number>;      // `UPDATE … WHERE money + delta >= 0`; throws InsufficientFunds when no row matched; players_money_ck is the backstop
  setPosition(tx: Tx, id: string, zoneId: ZoneId, x: number, z: number, angle: number): Promise<void>;
  applyRating(tx: Tx, id: string, delta: number): Promise<{ rating: number; peakRating: number }>;   // floors at 0; peak = max(peak, rating)
  addTrainerExp(tx: Tx, id: string, delta: number): Promise<{ trainerExp: number; trainerLevel: number }>;
  setIdentity(tx: Tx, id: string, identity: { title?: string; motto?: string; body?: string }): Promise<void>;   // POST /profile; value lists are validated by the server against §3.12
  setPasswordHash(tx: Tx, id: string, passwordHash: string): Promise<void>;
  touchLastSeen(tx: Tx, id: string, now: Date): Promise<void>;
  ban(tx: Tx, id: string, reason: string, now: Date): Promise<void>;   // Forbidden when the target is_admin
  unban(tx: Tx, id: string): Promise<void>;
  setAdmin(tx: Tx, id: string, isAdmin: boolean): Promise<void>;     // dev-only ADMIN_BOOTSTRAP_USERNAME at boot
  bannedIds(tx: Tx): Promise<string[]>;                              // the server's ban-cache rebuild (§30.6.7)
  leaderboard(tx: Tx, mode: 'rating' | 'trainerLevel' | 'dex', page: number, pageSize: number): Promise<PlayerRow[]>;   // banned excluded in SQL (pages stay full); rating ties by peak then username_lower; dex = caught count
  byIds(tx: Tx, ids: readonly string[]): Promise<PlayerRow[]>;       // friend views; order unspecified
  search(tx: Tx, q: string, page: number, pageSize: number): Promise<{ rows: PlayerRow[]; total: number }>;   // admin: username_lower ILIKE escapeLike(q), newest first, pageSize 1..50
  counts(tx: Tx): Promise<{ total: number; banned: number; admins: number }>;   // /admin/stats
  toPublic(row: PlayerRow, extras: PublicExtras): PublicProfile;      // ALLOW-LIST, pure, see 5.3
  publicProfile(tx: Tx, id: string): Promise<PublicProfile | null>;   // gathers extras (badges, guild tag, dex caught count, first 3 party slots) and calls toPublic
}

export interface CreatureRepo {
  party(tx: Tx, ownerId: string): Promise<CreatureInstance[]>;        // ordered by slot_index
  box(tx: Tx, ownerId: string, offset: number, limit: number): Promise<CreatureInstance[]>;
  byOwner(tx: Tx, ownerId: string): Promise<CreatureRecord[]>;
  byId(tx: Tx, id: string): Promise<CreatureInstance | null>;
  recordById(tx: Tx, id: string): Promise<CreatureRecord | null>;
  lock(tx: Tx, id: string): Promise<CreatureRecord>;                  // FOR UPDATE on the creature row
  /** SELECT … FOR UPDATE on both owners' player rows (ascending uuid) THEN the creature row — the global lock order of §5.5. */
  lockForTransfer(tx: Tx, id: string, fromOwner: string, toOwner: string): Promise<CreatureRecord>;
  insert(tx: Tx, c: Omit<CreatureInstance, 'id'>, slot: SlotTarget): Promise<CreatureInstance>;   // PartyFull when party index taken/party has 6
  update(tx: Tx, c: CreatureInstance): Promise<void>;                 // version + 1; full-row write
  reorderParty(tx: Tx, ownerId: string, orderedIds: readonly string[]): Promise<void>; // InvalidReorder unless a permutation of the party; two-phase via the 100..105 band
  moveToSlot(tx: Tx, id: string, kind: 'party' | 'box' | 'listing' | 'trade_escrow', index: number | 'nextBox'): Promise<void>;   // locks owner then row (lockOwnerThenRow)
  swap(tx: Tx, ownerId: string, partyId: string, boxId: string): Promise<void>;   // POST /party/swap; parks one row in the band
  /**
   * Atomic ownership transfer. Locks via lockForTransfer, asserts current owner === fromOwner and !locked,
   * rewrites owner_id + slot to (box, nextBox) of toOwner, writes audit_log 'creature.transfer'.
   * Throws NotOwner | Locked | PartyMinimum (fromOwner would be left with zero party members).
   */
  transferCreature(tx: Tx, id: string, fromOwner: string, toOwner: string, reason: TransferReason, now: Date): Promise<void>;
  /** Refuses locked (Locked), the last party member (PartyMinimum) and a creature that has ever been listed (InvalidArgument — listings.creature_id references it). */
  release(tx: Tx, id: string, ownerId: string): Promise<void>;
}

export interface InventoryRepo {
  all(tx: Tx, playerId: string): Promise<Record<string, number>>;     // zero-quantity rows do not exist (add deletes at 0)
  qty(tx: Tx, playerId: string, itemId: string): Promise<number>;
  /** INSERT … ON CONFLICT DO UPDATE SET qty = qty + delta; throws InsufficientItems below 0 and InventoryOverflow above 999 (inventory_qty_ck is the backstop). */
  add(tx: Tx, playerId: string, itemId: string, delta: number): Promise<number>;
  addMany(tx: Tx, playerId: string, deltas: Readonly<Record<string, number>>): Promise<Record<string, number>>;   // sorted key order; all-or-nothing through the enclosing tx
}

export interface ProgressRepo {
  badges(tx: Tx, playerId: string): Promise<BadgeId[]>;
  awardBadge(tx: Tx, playerId: string, badge: BadgeId, now: Date): Promise<boolean>;   // false if already held; audit 'badge.award'
  flags(tx: Tx, playerId: string): Promise<string[]>;
  setFlags(tx: Tx, playerId: string, flags: readonly string[], now: Date): Promise<void>;
  dex(tx: Tx, playerId: string): Promise<{ seen: string[]; caught: string[]; variants: Record<string, VariantKey[]>; alpha: string[] }>;
  markSeen(tx: Tx, playerId: string, speciesId: string, now: Date): Promise<boolean>;   // idempotent; true when the species was new to the dex (live-ops newSpeciesSeen)
  flagSetAt(tx: Tx, playerId: string, flag: string): Promise<Date | null>;              // trainer rematch windows (§30.4.4)
  markCaught(tx: Tx, playerId: string, speciesId: string, variant: VariantKey, isAlpha: boolean, now: Date, isShiny?: boolean): Promise<{ newSpecies: boolean }>;   // isShiny (Phase D4) sets dex shiny_caught, never cleared
  caughtCount(tx: Tx, playerId: string): Promise<number>;   // Phase D5: distinct species caught (the dexCaught achievement value)
  quest(tx: Tx, playerId: string, questId: string): Promise<{ objectiveId: string; count: number; done: boolean; claimedAt: Date | null }[]>;
  advance(tx: Tx, playerId: string, questId: string, objectiveId: string, count: number, done: boolean): Promise<void>;
  claim(tx: Tx, playerId: string, questId: string, now: Date): Promise<boolean>;   // false when already claimed
  claimObjective(tx: Tx, playerId: string, questId: string, objectiveId: string, now: Date): Promise<boolean>;   // daily/weekly mission claim; false when missing, not done or already claimed
  pruneSyntheticQuests(tx: Tx, prefix: string, beforeKey: string): Promise<number>;   // live-ops rollover: deletes `<prefix><key>` rows whose key sorts before beforeKey
  clearFlags(tx: Tx, playerId: string, flags: readonly string[]): Promise<void>;    // live-ops streak/daily rows only; story flags are never cleared
  allQuests(tx: Tx, playerId: string): Promise<Record<string, { objectiveId: string; count: number; done: boolean; claimedAt: Date | null }[]>>;
  claimedQuestIds(tx: Tx, playerId: string): Promise<string[]>;
}

export interface MarketRepo {
  search(tx: Tx, q: MarketQuery): Promise<{ rows: ListingView[]; total: number }>;   // MarketQuery carries `now` so "active" has one meaning per request
  byId(tx: Tx, id: string): Promise<ListingView | null>;
  bidsFor(tx: Tx, listingId: string): Promise<BidView[]>;
  myActive(tx: Tx, sellerId: string): Promise<ListingView[]>;
  myBids(tx: Tx, bidderId: string): Promise<ListingView[]>;
  create(tx: Tx, l: { sellerId: string; creatureId: string; startingBid: number; buyNowPrice: number | null; durationHours: 12 | 24 | 48 }, now: Date): Promise<ListingView>;
  /**
   * Lock order: listing FOR UPDATE, then the player rows involved (ascending uuid). Assert status active && now < expiresAt (ListingClosed),
   * bidder !== seller (SelfBid), amount >= max(startingBid, currentBid + 50) (BidTooLow), amount < buyNowPrice when set (BidAboveBuyNow — use buyNow);
   * refund the previous bidder's escrow (raising your own bid refunds your previous escrow first, so only the difference must be on hand);
   * addMoney(bidder, -amount) (InsufficientFunds); insert bids row; update current_bid/current_bidder_id; audit 'listing.bid'.
   * Bidder money is escrowed at bid time, never re-checked at close.
   */
  placeBid(tx: Tx, listingId: string, bidderId: string, amount: number, now: Date): Promise<ListingView>;
  /** FOR UPDATE; assert active && buyNowPrice !== null (NoBuyNow); refund current bidder; addMoney(buyer, -price); transferCreature(…, 'marketSale'); addMoney(seller, price - marketFee(price)). */
  buyNow(tx: Tx, listingId: string, buyerId: string, now: Date): Promise<ListingView>;
  /** FOR UPDATE; assert seller (NotOwner) && active && currentBid === null (ListingHasBids — a listing with a bid can only settle at expiry, so no escrow is ever stranded); creature back to seller's box; status cancelled. */
  cancel(tx: Tx, listingId: string, sellerId: string, now: Date): Promise<ListingView>;
  /** Expiry job: FOR UPDATE SKIP LOCKED over active && expiresAt <= now, `limit` rows; sold → transfer + pay seller; no bids → return + expired. Returns rows closed. */
  closeExpired(tx: Tx, now: Date, limit: number): Promise<number>;   // = (await closeExpiredDetailed(tx, now, limit)).length
  closeExpiredDetailed(tx: Tx, now: Date, limit: number): Promise<ClosedListing[]>;   // what each closed listing became (dex marks, trade exp, notifications)
  creatureSlot(tx: Tx, creatureId: string): Promise<{ ownerId: string; slotKind: string; slotIndex: number } | null>;
}
export function marketFee(price: number): number;   // floor(price * MARKET.feePercent / 100)
export interface ClosedListing { readonly id: string; readonly sold: boolean; readonly sellerId: string; readonly buyerId: string | null; readonly creatureId: string; readonly speciesId: string; readonly variantKey: VariantKey; readonly isAlpha: boolean; readonly isShiny: boolean; readonly price: number | null }

export interface SocialRepo {
  requestFriend(tx: Tx, requesterId: string, addresseeId: string, now: Date): Promise<'requested' | 'accepted'>;   // a reverse pending request is accepted, not mirrored (friendships_pair_uq); AlreadyFriends
  acceptFriend(tx: Tx, addresseeId: string, requesterId: string): Promise<void>;
  declineFriend(tx: Tx, playerId: string, otherId: string): Promise<void>;
  removeFriend(tx: Tx, playerId: string, otherId: string): Promise<void>;
  areFriends(tx: Tx, a: string, b: string): Promise<boolean>;
  friendLists(tx: Tx, playerId: string): Promise<{ friends: FriendView[]; incoming: FriendView[]; outgoing: FriendView[] }>;
  sendMessage(tx: Tx, fromId: string, toId: string, text: string, now: Date): Promise<MessageView>;
  thread(tx: Tx, a: string, b: string, before: Date | null, limit: number): Promise<MessageView[]>;
  markRead(tx: Tx, readerId: string, fromId: string, now: Date): Promise<number>;
  unreadCounts(tx: Tx, playerId: string): Promise<Record<string, number>>;   // fromId -> count
  createGuild(tx: Tx, p: { leaderId: string; name: string; tag: string; cost?: number }, now: Date): Promise<GuildView>;   // cost defaults to GUILD_CREATE_COST 5000, charged in the same tx; GuildNameTaken | AlreadyInGuild | InsufficientFunds
  joinGuild(tx: Tx, guildId: string, playerId: string, now: Date): Promise<GuildView>;   // GuildFull at 50 (counted under the guild row lock) | AlreadyInGuild
  leaveGuild(tx: Tx, guildId: string, playerId: string): Promise<void>;   // Forbidden for a leader with other members; the last member's leave deletes the guild
  kickMember(tx: Tx, guildId: string, actorId: string, targetId: string): Promise<void>;
  setRole(tx: Tx, guildId: string, actorId: string, targetId: string, role: 'leader' | 'officer' | 'member'): Promise<void>;
  setMotd(tx: Tx, guildId: string, actorId: string, motd: string): Promise<void>;
  guildById(tx: Tx, guildId: string): Promise<GuildView | null>;
  guildOf(tx: Tx, playerId: string): Promise<GuildView | null>;
  guildMembers(tx: Tx, guildId: string): Promise<GuildMemberView[]>;
  searchGuilds(tx: Tx, search: string, limit: number): Promise<GuildView[]>;   // escapeLike
}
/** Creature history (migration 0007_creature_history): `creature_instances.original_trainer_id` (→ players, set null) and `original_trainer_name` written by `insert` (the owner at insert), and `creature_events (id bigserial PK, creature_id → creature_instances cascade, kind varchar(16), detail jsonb, at)`. `insert` writes a `met` event (`caught` at the catch time when `caughtAt` is set, else `received`), or the `firstEvent` it is given (breeding: `hatched`, added 2026-10-21); `transferCreature` writes `traded` / `sold` / `gift` with both usernames. */
export interface CreatureHistoryRepo {   // methods on CreatureRepo
  addEvent(tx: Tx, ids: readonly string[], detail: CreatureEventDetail, now: Date): Promise<void>;   // one row per id
  history(tx: Tx, id: string): Promise<{ originalTrainer: string | null; events: { detail: CreatureEventDetail; at: Date }[] } | null>;   // oldest first, ≤ 200; null for an unknown creature
}
export interface HistoryRepo {
  recordBattle(tx: Tx, row: NewBattleHistory): Promise<void>; recordTrade(tx: Tx, row: NewTradeHistory): Promise<void>;   // rows carry their own timestamps; NewBattleHistory carries optional `start` / `finalDigest` (§5.1)
  /** Battle replays (migration 0006_battle_shares): `battle_shares (token varchar(16) PK, player_id uuid → players cascade, battle_id uuid, replay jsonb SharedReplay, created_at)`, unique (player_id, battle_id). */
  shareOf(tx: Tx, playerId: string, battleId: string): Promise<BattleShareRow | null>;
  createShare(tx: Tx, row: { token: string; playerId: string; battleId: string; replay: SharedReplay }, now: Date): Promise<BattleShareRow | null>;   // the player's share of that battle (a concurrent one wins); null when `token` is another share's
  shareByToken(tx: Tx, token: string): Promise<BattleShareRow | null>;
  battles(tx: Tx, playerId: string, page: number, pageSize: number): Promise<BattleHistoryRow[]>; battleById(tx: Tx, playerId: string, battleId: string): Promise<BattleHistoryRow | null>;
  trades(tx: Tx, playerId: string, page: number, pageSize: number): Promise<TradeHistoryRow[]>;
  /** The whole two-player trade in one call (the transaction below): locks, escrow asserts, transfers both ways, money both ways, two trade_history rows, audit. */
  completeTrade(tx: Tx, tradeId: string, a: TradeSide, b: TradeSide, now: Date): Promise<void>;
}
export interface TradeSide { readonly playerId: string; readonly creatureIds: readonly string[]; readonly money: number }
export interface BattlePassRepo {
  claimedLevels(tx: Tx, playerId: string): Promise<number[]>;
  claim(tx: Tx, playerId: string, level: number, now: Date): Promise<boolean>;            // false when AlreadyClaimed; the level ≤ trainerLevel check is the server's
  mythicalChoice(tx: Tx, playerId: string): Promise<string | null>;
  setMythicalChoice(tx: Tx, playerId: string, species: string, now: Date): Promise<void>;  // requires the level-50 row with mythical_choice null; AlreadyClaimed otherwise
}
export interface AuthRepo {
  issueRefresh(tx: Tx, playerId: string, now: Date): Promise<{ token: string; expiresAt: Date }>;
  rotateRefresh(tx: Tx, token: string, now: Date): Promise<{ playerId: string; token: string; expiresAt: Date } | null>;   // null = unknown, expired or already revoked (the server then calls revokeAll)
  revoke(tx: Tx, token: string, now: Date): Promise<boolean>; revokeAll(tx: Tx, playerId: string, now: Date): Promise<number>; purge(tx: Tx, before: Date): Promise<number>;
  ownerOf(tx: Tx, token: string): Promise<{ playerId: string; revokedAt: Date | null; expiresAt: Date } | null>;   // refresh-reuse detection needs the owner of an already-revoked token (§30.5.1 #24)
}
export function hashRefreshToken(token: string): string;   // sha-256 hex; the only form stored
export interface AuditRepo { write(tx: Tx, e: { actorId: string | null; action: string; subject: string | null; detail: Record<string, unknown> }, now: Date): Promise<void> }

export function escapeLike(s: string): string;   // escapes \ % _ ; callers add their own wildcards and `ESCAPE '\'`
/** Phase D14 (migration 0004_player_streaks): `player_streaks (player_id uuid PK → players cascade, current int ≥ 0, best int ≥ current, updated_at)`, index on best. */
/** The daily challenge (migration 0008_daily_results): `daily_results (player_id → players cascade, day_key varchar(10), attempts int, turns smallint null, marks varchar(200) null, battle_id uuid null, won_at)`, PK (player_id, day_key). */
/** Challenge modes (no migration: the run lives in story flags): `challengeBoard(tx, { mode, cleared, failed }, page, pageSize)` on ProgressRepo, the flags passed in by the server (persist knows no content); banned excluded. */
/** Verified speedruns (migration 0009_play_clock): `run_splits (player_id → players cascade, split varchar(48), play_ms bigint, at)`, PK (player_id, split). The clock now is `play_ms + (now - play_started_at)`, computed in SQL so a split is written inside any transaction. */
export interface RunRepo {
  start(tx: Tx, playerId: string, now: Date): Promise<void>;   // play_started_at = coalesce(play_started_at, now): a running clock keeps its start
  stop(tx: Tx, playerId: string, now: Date): Promise<void>;    // banks the running session, play_started_at = null
  clock(tx: Tx, playerId: string, now: Date): Promise<{ playMs: number; running: boolean } | null>;
  stopAll(tx: Tx): Promise<number>;                            // at boot: stale clocks stop, the gap not charged
  split(tx: Tx, playerId: string, split: string, now: Date): Promise<void>;   // the first time only
  splits(tx: Tx, playerId: string): Promise<{ split: string; playMs: number; at: Date }[]>;
  board(tx: Tx, start: string, finish: string, page: number, pageSize: number): Promise<{ player: PlayerRow; playMs: number }[]>;
}
/** Ranked seasons (migration 0011_seasons): `seasons (season int PK, closed_at)` (the row is the close's lock) and `season_results (season → seasons cascade, player_id → players cascade, rank, rating, wins, losses)`, PK (season, player_id). A season's participants are the players with a `battle_history` row carrying a `rating_delta` inside it; their record is that row's wins and losses; they rank by rating, then wins, then name. */
/** Honor shapes the world (migration 0012_world_honor): `world_honor (season int, zone_id varchar(32), light int, shadow int)`, PK (season, zone_id). Added to in the battle turn's own transaction. */
/** Majin vs Tenjin seasons (migration 0013_season_factions): `season_factions (season int, player_id → players cascade, side varchar(8), points int, joined_at)`, PK (season, player_id). */
/** One roaming legendary per season (migration 0014_season_legends): `season_legends (season int PK, species varchar(32), player_id → players set null, player_name varchar(20), caught_at)`. */
/** Breeding (migration 0016_breeding): slot kind `daycare`; `creature_instances.bandborn boolean default false`; `daycare (player_id PK → players cascade, egg_at timestamptz null)`; `eggs (id uuid PK, owner_id → players cascade, place 'party' | 'box', species_id, steps_total, steps_walked (0..total), honor, variant_key, ability, moves jsonb string[] (the egg moves), is_shiny, bandborn, parents jsonb { speciesId, nickname }[], zone_id, laid_at)`. `creatures.insert(tx, c, slot, firstEvent?)`: a hatchling's history starts with `hatched { speciesId, zoneId, parents: [name, name], trainer }` in place of `met`. */
export interface BreedingRepo {
  pair(tx: Tx, ownerId: string): Promise<CreatureRecord[]>;   // the `daycare` slot kind, in the order left
  eggAt(tx: Tx, ownerId: string): Promise<Date | null>;
  setEggAt(tx: Tx, ownerId: string, at: Date | null): Promise<void>;
  eggs(tx: Tx, ownerId: string): Promise<Egg[]>;   // carried first, then oldest first
  insertEgg(tx: Tx, e: NewEgg, now: Date): Promise<Egg>;
  moveEgg(tx: Tx, ownerId: string, id: string, place: 'party' | 'box'): Promise<void>;   // NotFound for anyone else's
  addSteps(tx: Tx, ownerId: string, steps: number): Promise<Egg[]>;   // carried eggs only, capped at their total; returns the carried eggs
  takeHatched(tx: Tx, ownerId: string, id: string): Promise<Egg | null>;   // deletes a carried egg that walked its total
}
/** Ghost trainers (migration 0015_ghosts): `ghosts (player_id PK → players cascade, name, zone_id, party jsonb CreatureInstance[], top_level, left_at)` and `ghost_battles (id, ghost_id → players cascade, challenger, zone_id, won (the ghost), seen, at)`. */
export interface GhostRepo {
  save(tx: Tx, playerId: string, name: string, zoneId: string, party: readonly CreatureInstance[], now: Date): Promise<void>;   // replaces; an empty party saves nothing
  of(tx: Tx, playerId: string): Promise<Ghost | null>;
  recent(tx: Tx, zoneId: string, since: Date, limit: number): Promise<Ghost[]>;   // newest first, banned left out
  record(tx: Tx, ghostId: string, challenger: string, zoneId: string, won: boolean, now: Date): Promise<void>;
  report(tx: Tx, ghostId: string): Promise<GhostFight[]>;   // the fights not yet told, now marked told
  fights(tx: Tx, ghostId: string, limit: number): Promise<{ fights: GhostFight[]; won: number; lost: number }>;
}
/** Nemeses (migration 0017_nemeses): `nemeses (id uuid PK, owner_id → players cascade, species_id, level 1..100, name varchar(16), title varchar(32), scar varchar(16), move varchar(32) null, rank 1..5, ability, variant_key, is_shiny, is_alpha, born_zone, last_zone, memory jsonb, status 'active' | 'beaten' | 'caught' | 'faded', created_at, updated_at)`, index (owner_id, status). */
export interface NemesisRepo {
  active(tx: Tx, ownerId: string): Promise<Nemesis[]>;   // newest first
  of(tx: Tx, id: string): Promise<Nemesis | null>;
  rise(tx: Tx, n: NewNemesis, max: number, now: Date): Promise<{ nemesis: Nemesis; faded: Nemesis[] }>;   // rank 1, last seen where it rose; beyond `max` active the oldest fade
  rankUp(tx: Tx, id: string, p: { rank: number; level: number; memory: NemesisMemory; zoneId: string }, now: Date): Promise<Nemesis | null>;   // null when no longer active
  seen(tx: Tx, id: string, zoneId: string, now: Date): Promise<void>;
  end(tx: Tx, id: string, status: 'beaten' | 'caught', zoneId: string, now: Date): Promise<boolean>;   // once
}
/** A living ecosystem (migration 0018_ecosystem): `eco_takes (zone_id varchar(32), week int, species_id varchar(32), caught int, ko int)`, PK (zone_id, week, species_id). Added to in the wild battle turn's own transaction. */
export interface EcosystemRepo {
  add(tx: Tx, zoneId: string, week: number, speciesId: string, caught: number, ko: number): Promise<void>;   // an upsert; nothing for an empty take
  week(tx: Tx, zoneId: string, week: number): Promise<{ speciesId: string; caught: number; ko: number }[]>;   // by species id
}
/** The bounty board (migration 0019_bounties): `bounties (id, kind, target_id, target_name, species_id, level, zone_id, wins, poster_id, poster_name, reward, fee, status, claimer_id, claimer_name, payout, bonus, created_at, expires_at, claimed_at)`, one open game bounty per ghost (partial unique index). Money moves are the caller's, each with an audit row (`bounty.post`, `bounty.claim`, `bounty.refund`). */
export interface BountyRepo {
  post(tx: Tx, p: NewGhostBounty & { posterId: string; posterName: string; fee: number }, now: Date): Promise<Bounty>;   // escrow already taken
  upsertGame(tx: Tx, p: NewGhostBounty, now: Date): Promise<void>;   // posted, or raised (never lowered)
  open(tx: Tx, now: Date, limit: number): Promise<Bounty[]>;   // game and player posts, richest first
  wanted(tx: Tx, targetIds: readonly string[], now: Date): Promise<Set<string>>;
  openBy(tx: Tx, posterId: string, now: Date): Promise<Bounty[]>;
  postedBy(tx: Tx, posterId: string, limit: number): Promise<Bounty[]>;
  recentClaims(tx: Tx, limit: number): Promise<Bounty[]>;   // nemesis records left out
  claimsSince(tx: Tx, claimerId: string, since: Date): Promise<number>;
  claim(tx: Tx, p: { targetId: string; claimerId: string; claimerName: string; bonus: boolean; max: number; payoutOf: (reward: number) => number }, now: Date): Promise<Bounty[]>;   // each once, never the claimer's own post
  recordNemesis(tx: Tx, p: { targetName: string; speciesId: string; level: number; zoneId: string; rank: number; reward: number; claimerId: string; claimerName: string; payout: number; bonus: boolean }, now: Date): Promise<Bounty>;
  expireDue(tx: Tx, now: Date): Promise<Bounty[]>;   // each once; the caller refunds
  ghostWins(tx: Tx, since: Date): Promise<Map<string, number>>;   // different trainers beaten since `since` and the last claim
}
/** Camp bases (migration 0020_camps): `camps (zone_id pk, owner_id unique, owner_name, name, trophies jsonb, guard jsonb, guard_top, claimed_at, updated_at)` and `camp_raids (id, zone_id, owner_id, raider_id, raider_name, won, cut, took_over, held, seen, at)`. Money moves are the caller's, with an audit row (`camp.raid`). Also `NemesisRepo.ended(tx, ownerId, limit)` (beaten or caught, newest first) and `BountyRepo.claimedBy(tx, claimerId, limit)` for the trophies. */
export interface CampRepo {
  of(tx: Tx, zoneId: string): Promise<Camp | null>;
  byOwner(tx: Tx, ownerId: string): Promise<Camp | null>;
  all(tx: Tx): Promise<Camp[]>;   // by zone
  claim(tx: Tx, c: NewCamp, now: Date): Promise<boolean>;   // false: held, or the owner holds one (nothing written)
  abandon(tx: Tx, ownerId: string): Promise<Camp | null>;
  edit(tx: Tx, ownerId: string, p: { name?: string; trophies?: readonly CampTrophyJson[] }, now: Date): Promise<Camp | null>;
  setGuard(tx: Tx, ownerId: string, party: readonly CreatureInstance[], now: Date): Promise<boolean>;   // nothing for an empty party
  transfer(tx: Tx, zoneId: string, fromOwnerId: string, to: Omit<NewCamp, 'zoneId'>, now: Date): Promise<boolean>;   // only from the owner it names
  recordRaid(tx: Tx, r: Omit<CampRaid, 'id' | 'at'>, now: Date): Promise<void>;
  wonSince(tx: Tx, raiderId: string, zoneId: string, since: Date): Promise<boolean>;   // the daily cooldown
  heldSince(tx: Tx, ownerId: string, since: Date): Promise<number>;   // faction points earned by holding
  report(tx: Tx, ownerId: string): Promise<CampRaid[]>;   // unseen, oldest first; marked seen
  log(tx: Tx, ownerId: string, limit: number): Promise<CampRaid[]>;   // newest first
}
export interface LegendRepo {
  claim(tx: Tx, season: number, species: string, playerId: string, playerName: string, now: Date): Promise<boolean>;   // the first catch only
  of(tx: Tx, season: number): Promise<{ season: number; species: string; playerName: string; caughtAt: Date } | null>;
  all(tx: Tx, limit?: number): Promise<{ season: number; species: string; playerName: string; caughtAt: Date }[]>;   // newest first
}
export interface FactionRepo {
  join(tx: Tx, season: number, playerId: string, side: 'majin' | 'tenjin', now: Date): Promise<'majin' | 'tenjin'>;   // insert once; returns the side held
  of(tx: Tx, season: number, playerId: string): Promise<{ side: 'majin' | 'tenjin'; points: number } | null>;
  award(tx: Tx, season: number, playerId: string, points: number): Promise<'majin' | 'tenjin' | null>;   // nothing without a side
  totals(tx: Tx, season: number): Promise<{ points: { majin: number; tenjin: number }; members: { majin: number; tenjin: number } }>;
  top(tx: Tx, season: number, side: 'majin' | 'tenjin', limit: number): Promise<{ player: PlayerRow; points: number }[]>;   // banned left out
}
export interface WorldHonorRepo {
  add(tx: Tx, season: number, zoneId: string, light: number, shadow: number): Promise<void>;   // one upsert; nothing for an empty turn
  of(tx: Tx, season: number, zoneId: string): Promise<{ zoneId: string; light: number; shadow: number }>;   // zeros when nothing happened there
  season(tx: Tx, season: number): Promise<{ zoneId: string; light: number; shadow: number }[]>;
}
export interface SeasonRepo {
  lastClosed(tx: Tx): Promise<number>;                                                        // 0 before the first close
  close(tx: Tx, season: { number: number; startsAt: number; endsAt: number }, now: Date, reset?: boolean): Promise<boolean>;   // once: the standings by rating now; with reset (default) every rating = 1000 + trunc((rating - 1000) / 2)
  standings(tx: Tx, season: number, page: number, pageSize: number): Promise<SeasonStanding[]>;
  current(tx: Tx, from: number, now: number, limit: number): Promise<SeasonStanding[]>;       // the standings so far (banned excluded)
  titles(tx: Tx, playerId: string): Promise<{ season: number; rank: number }[]>;              // the top-eight places, newest first
}
export interface DailyRepo {
  get(tx: Tx, playerId: string, dayKey: string): Promise<{ attempts: number; best: { turns: number; marks: string; battleId: string } | null }>;
  record(tx: Tx, playerId: string, dayKey: string, won: { turns: number; marks: string; battleId: string } | null, now: Date): Promise<{ attempts: number; best: { turns: number; marks: string; battleId: string } | null }>;   // attempts + 1; a win with fewer turns replaces the best (a tie keeps the earlier)
  winners(tx: Tx, dayKey: string): Promise<number>;   // banned excluded
  leaderboard(tx: Tx, dayKey: string, page: number, pageSize: number): Promise<{ player: PlayerRow; turns: number; marks: string }[]>;   // turns asc, won_at asc, username_lower; banned excluded
}
export interface StreakRepo {
  get(tx: Tx, playerId: string): Promise<{ current: number; best: number }>;                     // 0 / 0 without a row
  byPlayers(tx: Tx, ids: readonly string[]): Promise<Map<string, { current: number; best: number }>>;
  recordWin(tx: Tx, playerId: string, now: Date): Promise<{ current: number; best: number }>;    // upsert current + 1, best = greatest(best, current + 1)
  endRun(tx: Tx, playerId: string, now: Date): Promise<{ current: number; best: number }>;       // current = 0, best kept
  leaderboard(tx: Tx, page: number, pageSize: number): Promise<{ player: PlayerRow; current: number; best: number }[]>;   // best > 0, banned excluded, best desc, current desc, username_lower
}
export interface Repos { players: PlayerRepo; creatures: CreatureRepo; inventory: InventoryRepo; progress: ProgressRepo; market: MarketRepo; social: SocialRepo; history: HistoryRepo; battlePass: BattlePassRepo; auth: AuthRepo; audit: AuditRepo; streaks: StreakRepo }
/** Repositories are stateless (every method takes `tx`); `db` is returned alongside so one handle can be carried around. */
export function createRepos(db: Db): Repos & { readonly db: Db };
```

Trade completion (`30-server-netcode.md` owns the handshake) is one transaction, `historyRepo.completeTrade`: lock both players (ascending uuid), lock every creature in both offers (ascending uuid), assert each is in `trade_escrow` for its owner (`NotInEscrow`), `addMoney` both ways, `transferCreature` each way with reason `'trade'`, `recordTrade` twice, `audit`. A failure anywhere rolls back everything; there is no partial trade.

### 5.3 `toPublic()` allow-list

`PublicProfile` is built by naming fields, never by deleting them: `{ id, username, title, motto, body, rating, peakRating, tier, trainerLevel, badges, guildTag: string | null, dexCaughtCount, showcase: CreatureInstance[] (≤ 3, with ownerId nulled), createdAt }`. `badges`, `guildTag`, `dexCaughtCount` and `showcase` do not live on the `players` row, so the pure function is `toPublic(row, extras: PublicExtras)`; `publicProfile(tx, id)` gathers the extras. `guildTag` is `null` for a player in no guild. The list is exported as `PUBLIC_PROFILE_KEYS` and a unit test asserts `Object.keys(toPublic(row, extras))` equals it exactly, in order. Adding a column to `players` never leaks it. <!-- reconciled 2026-09-18: extras arg + nullable guildTag from the implementation -->

### 5.5 Error codes, constants and the lock order

<!-- reconciled 2026-09-18: from packages/persist/src/errors.ts and constants.ts (implemented) -->
```ts
/** Every domain failure persist can raise. Callers switch on `code`, never on message text. Thrown inside db.transaction it rolls back only if it propagates: a caller must never catch a PersistError inside the transaction and carry on (placeBid refunds before charging, completeTrade moves money before creatures). */
export type PersistErrorCode =
  | 'NotFound' | 'UsernameTaken' | 'EmailTaken' | 'Forbidden' | 'InvalidArgument'
  | 'InsufficientFunds' | 'InsufficientItems' | 'InventoryOverflow'
  | 'NotOwner' | 'Locked' | 'PartyMinimum' | 'PartyFull' | 'InvalidSlot' | 'InvalidReorder' | 'NotInEscrow'
  | 'ListingClosed' | 'ListingHasBids' | 'BidTooLow' | 'BidAboveBuyNow' | 'SelfBid' | 'NoBuyNow'
  | 'AlreadyFriends' | 'GuildFull' | 'AlreadyInGuild' | 'NotGuildMember' | 'GuildNameTaken'
  | 'AlreadyClaimed';
export class PersistError extends Error { readonly code: PersistErrorCode }
export function isPersistError(e: unknown, code?: PersistErrorCode): e is PersistError;

export const MIN_BID_INCREMENT = 50;
export const GUILD_MAX_MEMBERS = 50;
export const GUILD_CREATE_COST = 5000;
export const INVENTORY_MAX_QTY = 999;
export const PARTY_MAX = 6;
export const PARTY_REORDER_OFFSET = 100;      // the 100..105 staging band of creature_party_slot_ck
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const BATTLE_PASS_MAX_LEVEL = 100;
export const BATTLE_PASS_MYTHICAL_LEVEL = 50;
```

Lock order, global, so no two transactions can deadlock: (1) `listings` row (`FOR UPDATE`; `SKIP LOCKED` in `closeExpired`) → (2) `players` rows, ascending uuid (`lockMany`) → (3) `creature_instances` rows, ascending uuid → (4) the `guilds` row for membership changes. `moveToSlot`/`release` peek the owner without a lock, lock the owner, then lock the creature and re-check the owner.

### 5.4 Test strategy and migrations

- Unit and repository tests run on **PGlite** (`drizzle-orm/pglite`) inside vitest with an in-memory database per test file; `migrate()` from `drizzle-orm/pglite/migrator` applies the committed SQL first. No Docker, no external service.
- `DATABASE_URL` set → the same suite runs against real Postgres via `drizzle-orm/node-postgres` (CI nightly, and required before any release). The `FOR UPDATE`/`SKIP LOCKED` tests spawn 20 concurrent transactions against one listing and assert exactly one wins and the loser sees `BidTooLow`/`ListingClosed`, never a duplicate transfer.
- Migrations: `drizzle-kit generate` writes SQL into `packages/persist/drizzle/`; `packages/persist/src/migrate.ts` is the only runner (`pnpm --filter @ewa/persist migrate`), picking the driver from `DATABASE_URL` presence. Migrations are never edited after commit; a fix is a new migration.
- Seed: `packages/server/src/seed.ts` creates three demo players with the three registration starters at level 5 (there are no `yahit/fennorange/resilian` demo trainers — those ids are legacy). It lives in the server package because creature construction (species defaults, `hp = maxHp`) needs `@ewa/core` + `@ewa/content`, which persist does not import at runtime. <!-- reconciled 2026-09-18: moved from persist per its IMPLEMENTATION-NOTES -->
- Types persist needs from core/content (`CreatureInstance`, `MoveSlot`, `StatusId`, `Action`, `RngState`, `ZoneId`, `BadgeId`, `RewardsSummary`, `MARKET`, `RANK_TIERS`, `tierFor`, `trainerLevelFor`) are structural copies in `src/types.ts`/`src/constants.ts` marked `TODO(core|content)`; they become re-exports when both packages ship. Shapes are verbatim so the switch is mechanical.

---

## NON-NEGOTIABLES (this file)

1. `@ewa/core` imports nothing, has no wall clock, no `Math.random`, no unordered iteration; client preview and server truth run the same bytes.
2. Every number that reaches `BattleState` is an integer except `effectiveness ∈ {0, 0.25, 0.5, 1, 2, 4}`.
3. `progressionDelta`/`inventoryDelta` are the only client-state mutations for progression; badges, exp, money, items, catches, rating and flags are server-only.
4. Status is an array; major statuses are mutually exclusive through `addStatus` and nowhere else.
5. Immunity is zero damage, checked before any clamp.
6. All cross-player creature movement goes through `transferCreature` inside one transaction with `FOR UPDATE` in the §5.5 lock order; no read-modify-write on `listings` or `creature_instances` outside a locked row.
7. Content ids are validated at build; the server never resolves an unknown id at runtime.
8. `toPublic()` is an allow-list.
9. `CATCH_B` is a committed literal; `Math.pow` never runs in the simulation.
10. The champion's id is `'zeon'`.

## CUT DELIBERATELY (this file)

- **Sp.Atk / Sp.Def.** Four stats stay four. The two "special" items and `lower_spAtk` are mapped, not modelled.
- **Terrain mechanics.** `Field.terrain` exists for the arena dressing; no rule reads it in v1.
- **Accuracy/evasion-changing moves.** Stages exist; no v1 move sets them. Keen Eye is data-complete and untriggered.
- **Entry hazards.** Heavy Duty Boots is a documented no-op.
- **The 27 unimplemented legacy shop held items.** No hook, no item.
- **Legacy orb/ball aliases and the `hyperpotion`/`fullheal` misspellings.** Fresh database; `validate.ts` rejects them.
- **Legacy story, quests, seasonal events, swarms and hotspots.** Their zone ids do not exist; the story bible supplies new beats.
- **Auto-evolution and auto-forget.** Both are explicit player choices via REST.
- **Optimistic-concurrency retry wrappers.** Row locks replace them; a `version` column remains for diagnostics only.
- ~~**Evolution stones.**~~ Shipped in Phase D3 (six stones, §2.3 / §2.6).
