# @ewa/core — implementation notes

Deviations from and clarifications of `.design/spec/00-spine.md` §2 made while implementing. The spec is
not edited; each item here is a candidate for a `.design/spec/CHANGELOG.md` entry under §50.7.

## Deviations (public surface)

1. **`validateAction` takes an optional 4th argument `content: ContentIndex | null = null`.** §2.10 writes
   the signature as `(state, side, action)`, but `unknownMove` (against content), `statusMoveBlocked`
   (Assault Vest needs the move's power), every item error (`unknownItem`, `itemNotUsableInBattle`,
   `badItemTarget` for revive-vs-fainted) and `unknownOrb` cannot be decided without the ContentIndex,
   and core knows no data. Callers passing three arguments still compile and get every structural check;
   `resolveTurn` always passes content. A hidden module-level content slot (the previous approach) was
   removed because it made a pure function depend on call order.
2. **`InvalidActionError` is exported.** §2.10 says "resolveTurn throws on an invalid action"; the thrown
   value is a typed `Error` subclass carrying `side: 0 | 1` and `code: ActionError` so the server can map
   it to a wire error without parsing a message string. Same for a `resolveTurn` call on an ended battle
   (`code: 'battleEnded'`, `side: 0`).
3. **`CATCH_B` is exported** (the committed 256-entry table). §2.15 names it and §50.4.1 `catch.test.ts`
   asserts on it; it is a table, not a second catch formula — the only catch resolution runs inside
   `resolveTurn`.

## Clarifications (behaviour the spec leaves open)

4. **`cannotForfeit`** — a side with `canFlee === true` cannot forfeit (it leaves by fleeing); every other
   side (trainer/league/pvp players, NPC and wild sides) may forfeit. `chooseNpcAction` uses this rule when
   a side has no usable move and no standing bench: it flees when it may, otherwise forfeits. There is no
   Struggle in v1, so this is what guarantees termination.
5. **`chooseNpcAction` never proposes an illegal action:** it filters Assault-Vest-blocked status moves,
   respects choice lock, and will not switch while trapped. Every action it returns passes `validateAction`
   (asserted by the fuzz).
6. **A damaging move always targets the foe.** `MoveDef.target` is read only for power-0 moves (`self` /
   `field` skip the foe-facing accuracy/evasion and immunity checks). Legacy has damaging moves whose
   *effect* is self-directed (`Cosmic Miracle` 120 power + `heal`, `Ancient Power` + `raise_all`,
   `Charge Beam` + `raise_atk`): under a literal reading of §2.4 ("`self` for raise_*/heal") they would
   never deal damage. The effect handlers apply to the attacker regardless of `target`.
7. **Wonder Guard never stops a status move** (§2.5: "status moves unaffected"). §2.14 step 0 lists the
   Wonder Guard check before the `power === 0` check; the two checks are order-swapped here. `amount` is
   0 either way, so the only observable difference is that a status move gets no `moveFailed
   { reason: 'wonderGuard' }`.
8. **"Always" effects never roll `effectChance`.** `crit`, `first`, `recoil`, `drain`, `heal`, `weather`,
   `sun` are listed as "always" in the §2.4 table; core does not consume an rng draw for them even if
   content sets `effectChance < 100`. Chance-gated effects draw once when `effectChance < 100`.
9. **Replacement phase with two fainted leads:** both switch-outs, then both switch-ins (side 0 first),
   then `onSwitchIn` hooks (side 0 first) — the same shape as `createBattle`, so an Intimidate sees the
   replacement actually on the field.
10. **`weatherTick`** is emitted at end of turn while weather persists (`turnsLeft` = turns remaining);
    §2.11 step 7 only names `weatherEnd`, §2.19 declares the event.
11. **Flinch** is stored as `volatile.flinched` on the defender and only when the defender has not yet
    acted this turn (`movedThisTurn`); it is consumed at the defender's next pre-action check in the
    same turn and cleared at the next `turnStart`.
12. **Exp for pvp:** both sides are players, so each side's participating, standing battlers gain exp when
    a foe faints. "Winning player side" in §2.16 is read as "the player side opposite the fainted battler".
13. **Contact hooks** (Flame Body, Rough Skin, …) fire only when the attacker is still standing after its
    move and the move was damaging (`power > 0 && contact`).
14. **`validateAction(state, side, null)` is valid for every non-player side in every phase** — including a
    replacement phase in which that NPC/wild side is the one that must switch. §2.10 says NPC sides never pass
    actions and that the server validates before `resolveTurn`; without this rule the server could not get past
    validation for an NPC whose active fainted. `resolveTurn` fills the choice via `chooseNpcAction` before its own
    validation, exactly as before. (Found by the §2.20 fuzz; `turn.test.ts` pins it.)
15. **Sleep / confusion counters tick at the sleeper's action in the SAME turn the status landed** when the
    sleeper acts after the attacker (§2.11 step 6 is applied literally: "decrement at the start of the sleeper's
    action"). Consequence: a sleep of N turns skips N − 1 actions in total, and a 1-turn sleep landing before the
    sleeper's action is cured at that very action. The original `effects.test.ts` assumed no same-turn tick; it
    was changed to the spec's algorithm. If N skipped actions is the intended feel, the fix is a spec sentence
    ("the counter does not tick on the turn the status was inflicted") plus a one-line guard in `canAct`.
16. **A type-chart immunity stops a power-0 move before its status is even attempted** (§2.14 step 0 order:
    `effectiveness === 0` → `moveFailed { reason: 'immune' }`, no `statusBlocked`). So a Poison-typed status move
    into a Steel type fails as "immune"; the Steel type's own poison immunity (`statusBlocked { reason: 'type' }`)
    shows only when the move can connect (a non-Poison-typed poison move). Likewise a Fire-typed Will-O-Wisp into
    Flash Fire is absorbed by `typeImmunity` (flag set) rather than refused by the Fire type's burn immunity.
17. **The §2.20 fuzz digest** (`test/fuzz-digests.json`, 1,000 entries) is `fnv1a32` over the joined per-turn
    `digestBattleState` values of each seeded battle (createBattle state first), so it captures every turn, not
    just the final state. Construction is in `test/fuzz.ts`; `maxTurns` is 200 as §2.20 says (the longest fuzz
    battle is 65 turns). §50.7 rule 3 makes a change to that file a SPEC change needing a
    `.design/spec/CHANGELOG.md` entry; its *creation* in this commit is not recorded there because the spec
    directory is out of scope for the core task — the entry to add is "`00-spine.md` §2.20 — first commit of
    `packages/core/test/fuzz-digests.json` (1,000 seeds, maxTurns 200, digest = fnv1a32 over per-turn digests)".
    Items 1–13 above were folded into `00-spine.md` by the 2026-09-18 reconciliation; 14–19 are still pending.
18. **Repair row "champion is zeon"** (`repairs.test.ts`) is asserted against the legacy roster
    `.design/legacy/league.js` (`LEAGUE_TRAINERS`), because `@ewa/content` ships no `LEAGUE` yet. Re-point the
    test at the content export when it exists.
19. **`test/helpers.ts` `turn()` teaches a content-registered move to the active creature** before calling
    `resolveTurn` (movesets never touch the rng stream), so scenario suites can register dozens of `customMove`s
    and use them on stock creatures; `customMove` re-derives the §2.4 default `effectChance` when `effect`/`power`
    is patched without pinning a chance. Core's `unknownMove` rule is unchanged and asserted through `resolveTurn`
    directly in `turn.test.ts`.

## Test-file naming vs §50.4.1

The task's suite list is used where it differs from §50.4.1's table: `turn.test.ts` covers both
`turn-order.test.ts` and `validate-action.test.ts`; `determinism.test.ts` covers `fuzz.test.ts` and
`determinism-replay.test.ts` (the shared driver is `test/fuzz.ts`); `effects.test.ts` is one file with one test
per effect rather than 22 files; `typechart.test.ts` / `trainerExp.test.ts` stand for `types.test.ts` /
`trainer-exp.test.ts`. Content is the same; only the file boundaries differ.

## Test fixture

`test/fixtures/legacyContent.ts` builds a `ContentIndex` from `.design/legacy/ewamon.js` (via
`createRequire`), applying the §2.3/§2.4/§2.5/§2.6 migration rules: dex numbers from insertion order,
`learnableMoves` levels spaced 5..min(evolveAt ?? 40, 60) rounded to multiples of 3, `lower_spAtk →
lower_atk`, `effect: 'weaknessPolicy' → null`, `first → priority 1`, contact derivation, default
`effectChance` per the §2.4 table, the 25 ability hook rows, the 17 held/key items, the 10 orbs, the §2.6
consumables with `shop.js` prices. It is a test fixture, not `@ewa/content`.

## Phase D1–D3 — stone and trade evolutions (2026-10-06)

- `Evolution` gains `{ kind: 'item', item, into }` and `{ kind: 'trade', into }`. Neither is level-triggered: `applyExp`
  reads `atLevel` only for `level` / `split`, so it reports `evolveReady: null` for them at any level. `evolutionTarget`
  (the level resolver) returns null for them.
- New pure helpers: `itemEvolutionTarget(evolution, item)`, `tradeEvolutionTarget(evolution)`, `evolutionChildren(evolution)`.
  `evolve` is unchanged and trigger-agnostic; the server decides which trigger applies.
- `ConsumableEffect.evolutionStone` is now `{ kind: 'evolutionStone' }` (the reserved `species` / `into` fields are gone:
  the species a stone evolves name it in their own `SpeciesDef.evolution`). `validateAction` already rejects it in battle.
- Battle semantics untouched: Eviolite and the speed tie-break read `evolution !== null`, still true for the new kinds;
  `createBattle` / `BattleState` unchanged; `test/fuzz-digests.json` unchanged (the fuzz runs on the legacy fixture).
- Tests: `test/evolution-items.test.ts` (6).

## Phase D4/D5/D7 (2026-10-06)

- **D7 ambient weather.** `CreateBattleOpts.weather?: WeatherKind`. Present and not 'none': `field.weather = { kind, turns: 0 }`
  and one `weatherSet { kind, turns: 0, source: null }` is emitted before the switch-in hooks. `turns: 0` with a kind is the
  new "ambient" state: the end-of-turn countdown now runs only when `turns > 0`, so ambient weather never ticks or ends; a
  move's weather replaces it with the usual 5 turns (and ends to 'none', not back to the ambient kind). Absent / 'none' →
  state and events byte-identical; `test/fuzz-digests.json` unchanged (`npx vitest run packages/core` green).
- **D4.** `CreatureInstance.isShiny?: boolean` — optional, present (true) only on a shiny, no battle effect; the digest
  omits undefined keys, so non-shiny states hash as before.
- Tests: `test/weather-ambient.test.ts` (4).

## Phase D6 — doubles (2026-10-06)

- **The `slots` rule.** `CreateBattleOpts.slots?: 1 | 2`, `BattleState.slots?: 2`, `Side.actives?: readonly [number, number]`.
  With `slots` absent or 1, `createBattle` / `validateAction` / `resolveTurn` run the unchanged singles code and no new key
  appears anywhere in a singles state (`cloneSide` / `cloneState` copy `actives` / `slots` only when present), so
  `test/fuzz-digests.json` is byte-identical (sha256 `47e764f9…` before and after; `npx vitest run packages/core`).
- **Refactor that keeps singles identical.** The engine primitives that read "the foe's active" now take explicit Refs:
  `EffectHandler(ctx, atk, def, move, dealt)`, `switchOutAt`, `fireSwitchInHooksAt`, `canActAt`, `executeMoveAt`,
  `useItemAt`, `endOfTurnAt(field)`, `awardExp(ctx, defeatedRef)`, `checkFaint` via `onField`. The singles call sites
  pass exactly the refs they used to compute (`activeRef(side)`, `activeRef(other)`), in the same order, so every rng draw
  and event is unchanged — the 1,000-battle fuzz is the proof.
- **`src/doubles.ts`** holds construction (`createDoubles`: wild/raid refused, two standing creatures per side or
  RangeError), per-position validation (`validateDoublesAction`, `validateSideChoice`, `requiredPositions`), ordering
  across four battlers (priority, speed, `rng.shuffle` of exact-tie groups), targeting (retarget a fainted foe target,
  fail on a fainted ally), spread moves (`executeSpreadAt`, ×0.75 at 2+ targets after the §2.14 pipeline), and
  `resolveDoublesTurn`. `npc.ts` adds `chooseNpcDoubles` and `expectedDamageVs`; `chooseNpcAction(…, pos)` delegates in
  doubles. The rules are written out in the module header and in spine §2.10 "Doubles".
- **Choices.** `SideChoice = Action | null | [Action | null, Action | null]`; a bare Action in doubles is position 0.
  `Action` move gains `target?: FieldRef` (`{ side, pos }` — a field position, not a party index); new `ActionError`
  `badTarget`. Events: `switchIn` / `switchOut` gain `pos`, `moveUsed` gains `targets` (spread), `moveFailed` gains
  `target` (per-target spread failure) — all only in doubles. `MoveDef.spread?: 'foes' | 'all'` (ignored in singles).
- **Decisions the task left open.** EXP is not split (each participant gets the full yield, as singles); the spread
  ×0.75 applies only when 2+ targets were aimed at (Pokémon rule) and after the whole pipeline; a fainted position with no
  bench stays on the field at hp 0 rather than becoming −1; in a replacement with fewer bench creatures than fainted
  positions the FIRST fainted positions are filled (the player picks who, not where); doubles has no catch / flee.
- **Tests.** `test/doubles.test.ts` (21): construction + singles shape identity, validation/targeting/retarget/ally,
  spread (`'foes'`, `'all'`, one target left, ignored in singles), order across four + priority, switch before moves,
  replacement per position (incl. 2 fainted / 1 bench), end, forfeit, EXP no split, Intimidate on both foes, NPC policy;
  and a 300-seed doubles fuzz (`test/doubles-fuzz.ts`) with its own committed `test/doubles-fuzz-digests.json`, two
  content instances agreeing and replays matching.

## Phase D14 — battle tower rules (2026-10-06)

- `capLevel(c, cap, content)` (`battler.ts`): level `min(level, cap)`, exp clamped to `expToLevel(level)` when lowered,
  full hp at that level, no status, full pp. Pure; moves kept as known. Stats follow via `projectBattler`.
- `CreateBattleOpts.noExp` → `BattleState.noExp: true` (singles and doubles); `awardExp` returns at once when set, so no
  `expGain` / `levelUp` / `learnMove` / `evolveReady`. `cloneState` carries it. Absent (or false) = the key is not on the
  state: every committed fuzz digest is unchanged.
- Tests: `test/tower.test.ts` (5).

## Battle forms: hollowmane's rage form (2026-10-08)

- `SpeciesDef.battleForm?: BattleFormDef` and `Battler.form?: string` (spine §2.3 / §2.9 as amended). `checkBattleForm`
  (`engine.ts`) runs at the end of `dealDamage` (when hp was lost) and at the end of `fireSwitchInHooksAt` (every entry
  path: `createBattle` leads, switches, replacements, doubles), so one sent in already below the line changes as it
  lands. A standing battler on the field, not yet changed, with `hp * 100 < maxHp * hpBelowPct` (integer discipline):
  `form` set, `refreshDerived` (atk / def / spd from the form base, max hp unchanged), `formChange`, then onEnter —
  its own negative stages to 0 and every standing foe on the field lowered, both through `changeStage` with cause
  'ability' (Keen Eye and Competitive react as to Intimidate). Once per battle: `form` is never cleared, so a switch-out
  keeps it and nothing re-triggers.
- `formBase(sp, b)` (`forms.ts`) is read wherever stats come from base stats: `projectBattler` (no form at projection),
  `refreshDerived`, the `levelUp` event, `damageAmount` (A and D were recomputed from species, not `b.atk`), the
  confusion self-hit. Speed reads the cached `b.spd` and follows.
- Digests: `form` is absent until a change and `cloneBattler` copies it only when present; the check consumes no rng and
  returns at once for a species without a form; the fuzz content has none — `fuzz-digests.json` and
  `doubles-fuzz-digests.json` are unchanged. The event union has 36 kinds (`events.test.ts`).
- Not persisted: the form lives on the battler; `applyBattleOutcome` returns the creature.
- Tests: `test/forms.test.ts` (8), `test/events.test.ts` (a form scenario).

## Battle forms: signature move (2026-10-08)

- `BattleFormDef.signatureMove?: { replaces, move }`; `formMoveId(sp, b, moveId)` (`forms.ts`) maps a known move to the
  move the battler executes. `executeMoveAt` executes the signature's MoveDef (type, power, accuracy, effect) and emits
  it in `moveUsed` / `damage` / `moveMissed`; the replaced slot pays the PP, and `lastMove` / `choiceLockedMove` keep the
  slot's id, so `validateAction` and choice lock are unchanged and the moveset is never touched. Move order (singles
  and doubles), doubles' spread check and the trainer AI's scoring (`npc.ts`) read the executed move. A signature must
  not be a spread move (content `validate.ts`): `executeSpreadAt` pays PP by the executed id.
- Tests: `test/forms.test.ts` (+2).

## The honor ledger (2026-10-08)

`honor.ts` (`HONOR_MIN` / `HONOR_MAX` ±10, `HONOR_DELTAS`, `tracksHonor`, `clampHonor`) and the engine hooks `adjustHonor`,
`honorOnCatch`, `honorOnWin`: `dealDamage` (a Dark-type move hit), `checkFaint` (a wild creature fainted on the field, after
`awardExp`), the catch (before `endBattle`) and `endBattle` (a won non-wild battle, before `battleEnd`). `keepsHonor` is checked
first (a player side, not `noExp`, a species with an honor split), so no other battle looks a move up or changes shape;
the fuzz digests are unchanged. `evolutionTarget` takes `honor = 0` and is exported; `applyExp` passes `c.honor ?? 0`.

## Majin / Tenjin transformations (2026-10-11)

The user's form-change gimmick (`.design/majin-tenjin.md`; spine §2.3 `BattleFormDef.kind`, §2.9 `Side.bands` /
`transformed`, §2.10 `Action.transform`, §2.11 step 5b).

- `forms.ts`: `formLineMet(form, b)` (majin / automatic below the line, tenjin at or above it — the same integer compare as
  the automatic change) and `transformError(side, b, species)`: no Majin / Tenjin form, no band of that kind, side already
  transformed, battler already in a form or fainted, or the line not met → `'cannotTransform'`.
- `engine.ts`: `checkBattleForm` now returns early for a kinded form on a trainer's side (majin on a non-wild side, any
  tenjin); the change itself moved to `enterForm` (stats, onEnter stages, then Tenjin's `cureAllMajor(…, 'ability')` and
  `healBattler(fractionOfMax(b, healFraction), 'form')`). `transformAt` sets `side.transformed` and enters the form.
  `cloneSide` copies `bands` / `transformed` only when present, so every existing state keeps its exact shape.
- `turn.ts` / `doubles.ts`: `validateAction` / `validateDoublesAction` check `transform` with content; `validateSideChoice`
  rejects two transforms from one side in one doubles turn. The transform step runs after items (and catch in singles),
  before the movers list is built, so priority and speed come from the transformed battler. `order` / `orderActors`
  draw rng only on a full speed tie of two transformers (never in the fuzz: no fuzz content has forms).
- `npc.ts`: `withTransform` adds `transform: true` to an NPC trainer's chosen move whenever `transformError` is null
  (first eligible position in doubles). No rng draw, so NPC choices are unchanged for every band-less side.
- `types.ts`: `BandKind`, `heal` cause `'form'`, ActionError `'cannotTransform'`.
- Tests: `test/transform.test.ts` (7). `npx vitest run packages/core`: 26 files / 303 tests; both fuzz digest files unchanged.

## Battle forms with their own types (2026-10-13)

- `BattleFormDef.types?` (hyoryu's Majin Form: Ice/Dragon becomes Dragon/Dark). `formTypes(sp, b)` returns the active
  form's types when it names them, else the species'. Every type read in a battle goes through it: the type chart and
  STAB (`damage.ts`), status immunity (`engine.ts` `applyStatus`), hail / sand chip (`turn.ts` end of turn) and the orb's
  type bonus against a wild battler in its form (`catch.ts`). Abilities and the moveset do not change.
- No rng, no new event: the client reads the types from content after `formChange`. Every species without a typed form
  computes exactly what it did; the 1,000-battle fuzz digests are unchanged. `test/formTypes.test.ts` (3).

## Battle replays (2026-10-20)

- `replayBattle(opts, choices, content)` (`src/replay.ts`, spine §2.21) is `createBattle` then one `resolveTurn` per
  recorded choice pair, with the digest of every state. The server checks a history row against its `final_digest`
  with it before sharing, and the client plays a shared replay from it. It adds no rule: the fuzz digests are unchanged.
- `test/fuzz.ts` gained `fuzzOpts(seed, content)`, the createBattle input `buildBattle` uses (same rng draws in the
  same order), so `test/replay.test.ts` replays 60 fuzz records from their input alone.

## Breeding: bandborn (2026-10-21)

- `CreatureInstance.bandborn?: true` (hatched from a Majin-form and a Tenjin-form parent). `transformError` accepts
  the form's own band at its own hp line as before, and for a bandborn also the other band at that band's line; the
  battler still changes into its own form, once per side. `bandsFor(sp, b)` lists the bands that can open it (the
  client's toggle). Absent on every creature but a hatched bandborn, so the singles and doubles fuzz digests are
  unchanged. No IVs were added: Ewamon's stats are base and level only, and breeding passes on what a creature does
  carry (content daycare.ts).

## Relic forms, form-typed moves, Inner Chi and Stance Change (2026-10-25)

- `SpeciesDef.battleForms?` (ravatar's five relic forms) sits beside `battleForm?`; a species carries one or the
  other, and `formsOf(sp)` reads whichever it has. `activeForm`, `formBase`, `formTypes` and `formMoveId` go through
  it; the band rules (`transformError`, `bandsFor`, `transformAt`) still read the one `battleForm`, since a relic form
  never answers a band.
- `BattleFormDef.heldItem?`: the form opens only while that item is held. With no `hpBelowPct` (now optional, absent
  only on a relic form) it opens as the battler lands; with one (the Avatar State, 30) the first time hp is below it.
  `checkBattleForm` takes the first matching form; one form per battle as before, so a vial holder opens nothing else.
- `MoveDef.typeFromForm?` / `effectOnlyBaseForm?` (Cosmic Convergence): `formMove(content, sp, b, id)` is the MoveDef
  the battler executes, `formMoveId`'s move retyped to the form's `moveType` (else its first type) and without its
  effect while a form is held. Singles, doubles and the NPC scoring all resolve the used move through it, so the
  type chart, STAB, weather, immunities and type boosts read the retyped move.
- There is no Sp. Atk / Sp. Def, so the Elemutt line's "special" means a move without contact. `modifyDamage` gained
  `when: 'fullHp'` and `contact` (Inner Chi: non-contact ×1.3 at full hp). The new `afterMoveUsed` hook (Stance
  Change: contact Def +1, non-contact Spd +1) runs after the user's own damaging hit, at most `cap` stages per stat per
  switch-in, counted in the optional `Volatile.stanceGained` (reset with the volatile on switch-out).
- Every new field is optional and absent on legacy content, and no new rng draw sits on a shared path: the singles and
  doubles fuzz digests are unchanged. `test/relicForms.test.ts` (7); the test fixture gained `withAbility` / `withItem`.
- `heldForm(sp, heldItem)` (2026-10-25): the form a creature wears outside a battle, the `heldItem` form with no hp
  line its item opens (ravatar's Water / Earth / Fire / Air), else null; the Avatar State waits for the battle. Read by
  content's `leadLook` (the follower and its field powers) and the client's screens, never by the engine, so battles and
  both fuzz digests are unchanged.

## Dex research catch bonus (2026-10-26)

- `BattleState.catchBonus?` (species id to multiplier) and `CreateBattleOpts.catchBonus?`: `createBattle` copies a
  non-empty map onto the state; `cloneState` carries it (never mutated); `catchValue(wild, species, orb, bonus = 1)`
  multiplies it inside the floor and `resolveCatch` passes `st.catchBonus?.[speciesId] ?? 1`. Absent or empty, the
  state shape, its digest and every catch value are unchanged (a product with 1 is exact): both fuzz digests are
  byte-identical. The server fills it for a wild species at research level 3 or more. `test/catch-bonus.test.ts` (3).

## Species height (2026-10-27)

`SpeciesDef.sizeScale` (a billboard scale, 0.5..2.2) became `heightM`, how tall the creature stands in metres, and a
`BattleFormDef` may carry its own `heightM`. No battle rule reads either, so the fuzz digests are untouched; core's
legacy fixture gives every species 1 m.
