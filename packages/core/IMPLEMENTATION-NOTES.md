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

## Test fixture

`test/fixtures/legacyContent.ts` builds a `ContentIndex` from `.design/legacy/ewamon.js` (via
`createRequire`), applying the §2.3/§2.4/§2.5/§2.6 migration rules: dex numbers from insertion order,
`learnableMoves` levels spaced 5..min(evolveAt ?? 40, 60) rounded to multiples of 3, `lower_spAtk →
lower_atk`, `effect: 'weaknessPolicy' → null`, `first → priority 1`, contact derivation, default
`effectChance` per the §2.4 table, the 25 ability hook rows, the 17 held/key items, the 10 orbs, the §2.6
consumables with `shop.js` prices. It is a test fixture, not `@ewa/content`.
