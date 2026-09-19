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
