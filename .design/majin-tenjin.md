# Majin & Tenjin: Ewamon's form-change gimmick

Status: **built** (2026-10-11). The binding contract is the SPEC (spine §2.3 / §2.9–§2.11, render §10.7.5, client
§20.5); this file keeps the reasoning, the roster and the story placement. Art prompts and the Gemini run log:
`.design/imagegen/majin-tenjin-prompts.md`.

As built, beyond the plan below: Reeve also says one line about the lens in `escorted_out`; bands are not used in
the Battle Tower or in raids; no story flags were added (the client keys its band tutorial off the item itself).

---

## 1. The idea in one paragraph

Some Ewamon can transform mid-battle into a **Majin Form** (魔人, "demon person") and others into a **Tenjin Form**
(天人, "heavenly being"). **A species is one or the other, never both.** To transform, the trainer needs the matching
key item, the **Majin Band** or the **Tenjin Band**. Each trainer may transform **once per battle**. Majin opens only
when the creature is **below half hp** (a comeback). Tenjin opens only when it is **at or above half hp** (taking
control). Both bands come in Act II, from the two sides of the story's argument.

## 2. Lore: why it works in Ewa

Ewamon are memories with bodies (story bible §2.3). The Provision un-makes them with a **field lens** ground to un-see
(§3.3.3). Wynn built the Attestor from the same kind of lens **turned backwards**, so it records instead (§4.2.2).
The two bands are those two lenses, worn on the wrist:

| | **Majin Band** | **Tenjin Band** |
|---|---|---|
| What it is | a Provision field lens on an iron wrist-mount: Sable's, from their Junior Assessor kit | a spare Attestor lens Wynn ground into a gold band |
| What it does | shows your Ewamon what it would be to be **unsaid**. A memory with a second holder **refuses**, and it breaks open with rage | shows your Ewamon that it is **held** in a second place. The memory stops being afraid of thinning and becomes certain and radiant |
| The memory's state | cracking, refusing, furious | mended, serene, untouchable |
| Visual signature | **red cracks** breaking open + a **cracked ring** sigil | **gold kintsugi seams** (cracks mended with gold) + a **whole gold ring** halo |

The ring motif is deliberate: it is the Provision's brass assay token (a disc with a lens-hole, §3.1.3). The Majin sigil
is that ring cracked; the Tenjin halo is the ring whole. One shape, two answers. That is the story's argument, held vs
spent, as a battle mechanic.

**Wild Majin.** A *wild* Majin species with no trainer transforms on its own when hurt, like Rage Form does today: a
wild memory refuses without anyone's help. That's why the player meets wild Majin creatures (castlemaw at the
Observatory, hollowmane at the Rift) behaving the way they already do. In a trainer's party the same species waits for
the band. There are no wild Tenjin: being held needs a holder.

## 3. Rules

1. **Key items, not held items.** The bands sit in the trainer's key items (`slot: 'key'`, not sold, never sold back).
   They don't use the creature's held-item slot, so a Tenjin Gemknight can still hold a Choice Band.
2. **Which band:** a Majin species needs the Majin Band; a Tenjin species needs the Tenjin Band.
3. **Once per battle per trainer.** One transformation in the whole battle, Majin or Tenjin. A team with both kinds has
   to choose which one gets its moment. In doubles it's still one per trainer.
4. **HP gate.** Majin needs hp **below 50 %** of max. Tenjin needs hp **at or above 50 %**. The opponent can see your
   hp bar, so they can see which door is open.
5. **How to trigger:** a toggle in the move menu ("Majin" / "Tenjin", lit only when allowed). You pick a move as usual;
   the transformation happens **at the start of the turn, before anyone moves**, then the move is used in the new form
   (like Mega Evolution).
6. **Duration:** the rest of the battle, kept through switching out (as Rage Form is today). Never saved after the
   battle. Fainting ends it.
7. **What changes:** atk / def / spd (max hp, types and ability stay the species'), an on-enter effect, the sprite,
   and (phase 2) a signature move that replaces one known move.
8. **Not usable** in the Battle Tower (`noExp` battles) at first. A ranked PvP setting can decide later.

### Stat templates (starting numbers for balance)

| | atk | def | spd | On enter |
|---|---|---|---|---|
| **Majin** | **+28** | **−18** | **+28** | clears its own negative stages; lowers every foe's stat by 1 (atk or def or spd, per species) |
| **Tenjin** | **+10** | **+30** | **+10** | cures its own status; heals 1/5 of max hp; clears its own negative stages |

Majin matches the shipped Rage Forms (hollowmane +28/−18/+28; castlemaw +32/−18/+28). Tenjin has a bigger total but no
offensive spike: it's a stabiliser you use while you're still healthy.

## 4. The launch roster: 7 Majin, 6 Tenjin

Picked so every starter has a form, both bands have a species the player can own **by the time the band arrives**, and
the Provision's and the Wardens' teams can show each form off.

### Majin (7, plus acier since 2026-10-26 and clementar since 2026-10-27)

| Species | Types | Base atk/def/spd → Majin | Lowers foes' | Has it by Act II? | NPCs who use it |
|---|---|---|---|---|---|
| **infernomorel** (starter final) | Fire/Dark | 118/84/102 → **146/66/130** | spd | yes, @34 | — |
| **badlander** | Ground/Dark | 118/88/74 → **146/70/102** | atk | yes (dustcub, deepcut_route, @30) | — |
| **toxshade** | Poison/Dark | 112/74/106 → **140/56/134** | def | yes (murkrat, hollow_route, @24) | Reeve, Hollis, Warden Veil |
| **necrogeist** | Ghost/Fairy | 138/112/102 → **166/94/130** | atk | late (@50) | **Comptroller Varn** (her ace transforms) |
| **hollowmane** | Ghost/Fighting | shipped Rage Form **162/66/150** | atk | the_rift | — |
| **castlemaw** | Dark/Steel | shipped Rage Form **160/86/104** | def | yes (umbral_observatory, night) | — |
| **zenryu** (legendary) | Dragon/Fighting | 148/112/130 → **176/94/158** | def | post-league (legendary static) | **Champion Zeon** (his ace's rage) |
| **acier** (added 2026-10-26) | Steel/Fighting | 95/110/60 → **123/92/88** | def | wild on siege_route (rare, L33 to 35), the_rift; raid boss on siege_route | - |
| **clementar** (added 2026-10-27) | Ground/Grass | 132/112/82 → **160/94/110** | spd | yes (fennorange on ash_route / deepcut_route, Berkest + Moon Stone) | - |

**Zenryu's Majin form is its Super Saiyan** (added 2026-10-11, the user's call). Zenryu is the Ultra Instinct dragon: a silver mane, an orange gi, silver dragon rings. Its rage form is the golden one: the mane stands up into golden spikes, the eyes go teal-green, the muscles bulk and lightning crackles across the body. It keeps the Majin mark (the crimson cracked-ring sigil, on its forehead) so it still reads as part of the system. This replaces the earlier "Zenryu, the one with both" idea in §Later: Zenryu is Majin only. Its live aura is a question to settle: Majin's aura is crimson flames, Super Saiyan's is gold flames (see §8). Zenryu is a legendary, so its base sprite is a 24-frame flipbook; the Majin sprite is a still until a flipbook is made for it.

hollowmane and castlemaw **become** Majin: their Rage art, stats and signature moves (Hollow Crescent, Vendetta Volley)
carry over. "Rage Form" is renamed "Majin Form" in the UI. The internal id can stay `rage` to avoid churn, or be
renamed to `majin` (sprite keys, the `form_rage` VFX, signature entries).

### Tenjin (6, plus raidori since 2026-10-26)

| Species | Types | Base atk/def/spd → Tenjin | Has it by Act II? | NPCs who use it |
|---|---|---|---|---|
| **thornback** (starter final) | Grass/Rock | 112/102/70 → **122/132/80** | yes, @32 | — |
| **abysspark** (starter final) | Water/Electric | 92/84/116 → **102/114/126** | yes, @35 | — |
| **lawlander** | Ground/Fighting | 106/98/70 → **116/128/80** | yes (dustcub, @30) | — |
| **gemknight** | Steel/Fairy | 108/112/76 → **118/142/86** | yes (shardling, galvan_route, @27) | **Warden Aurelia** |
| **glimmereen** | Fairy | 60/80/90 → **70/110/100** | yes (glimp, @16) | Sable's rematches (optional) |
| **solpyre** | Fire/Flying | 110/75/105 → **120/105/115** | yes (flampling + Ember Stone) | — |
| **raidori** (added 2026-10-26) | Electric | 120/105/100 → **130/135/110** | wild at night on galvan_route (rare), raid boss there | - |

Nice pair that falls out of what's already there: **dustcub's honor split** sends the player to **lawlander (Tenjin)**
or **badlander (Majin)**. The honor ledger still decides the evolution (as now); the form follows the species. No honor
logic touches the forms.

The starters split 2 Tenjin / 1 Majin. That's fine because the Majin Band comes first (§5), so the Majin starter isn't
left waiting.

### Later (not now)

- **The one with both:** a special Ewamon that can take either form. (Zenryu was the first idea; it is now Majin
  only, its Super Saiyan form.)
- **The mythical pair:** Lumyth (first morning) → Tenjin, Noxmyth (first night) → Majin. One each, so it fits the
  "never both" rule and makes the two mythicals a matched set.

## 5. Story: where the bands come from

Neither band is available early. Both arrive in **Act II, after the Wraith badge** (player around level 40–45), two
beats apart, one from each side of the argument. **Majin first** (the dangerous power, from the enemy's tool), then
**Tenjin** (Wynn's answer).

### Beat 19 `sables_turn`: Majin Band (umbral_observatory)

Sable has just read the Yr 38 line and lost the fight. The bible already has them take off the brass token and put
it on the ledger. Add: they unstrap the field lens from their wrist and hand it over.

> **Sable:** "Junior Assessors get the token and the lens. The token goes back. The lens…" *(holds it out)*
> **Sable:** "It only knows how to take things apart. Point it at something that won't come apart."
> **Sable:** "When yours is hurt and it looks through this, it sees itself being unsaid. A held one won't take it. You'll see."
> *Received the **Majin Band**.*

**The debut fight is beat 20 `escorted_out`**, right after: Reeve escorts the player out by battle. Reeve's toxshade goes
**Majin first** (the Assessors all carry lenses; this is how they fight), so the player sees it done to them before
doing it. Her line when it transforms:
> **Reeve:** "Procedure. Every Assessor carries one. You were never supposed to be holding one too."

### Beat 21 `the_requisition`: Tenjin Band (forgewall)

Rell's quartermaster has a parcel that came for the player from Mirevale: Wynn's letter and a gold band.

> **Wynn (letter):** "Sable told me what they gave you. I'm not angry. I'm afraid of it, which is different."
> **Wynn (letter):** "This was the twelfth Attestor's spare lens. It records. Pointed at one of yours, it shows them they're held somewhere else, and a memory that knows that stops being afraid."
> **Wynn (letter):** "Sable's lens shows them what being unmade would be. Mine shows them they won't be. Use whichever you can live with. — W."
> *Received the **Tenjin Band**.*

**The debut fight is beat 22 `siege_of_forgewall`**: Hollis's toxshade goes Majin. It's the player's first chance at
Tenjin, and the first fight where both bands are in their pocket.

### Act III and the league

- **Warden Veil** (toxshade) uses Majin; **Warden Aurelia** (gemknight) uses Tenjin. That reflects their records: Veil
  keeps the record of what was drawn, Aurelia the record of what is still whole.
- **Comptroller Varn** (`varn_spire`): her **necrogeist goes Majin** at the Spire. The calmest person in the game
  reaches for the most furious form, because the Provision only has the lens that takes apart.
- **Sylvane** (Sky-Shrine) at `star_counts` says one line about them: "Anyone can make a memory refuse. Holding one is harder. The Wardens only ever made the gold kind."
- Gym leaders fought **before** the bands never use them. Gym rematches / the Tower can come later.

### Story bible additions

- §3.1.3: Assessors' field lenses are worn strapped to the wrist in battle.
- §4.3.2 (Sable): the Observatory beat adds the lens hand-over.
- §4.2 (Wynn): she made the Tenjin Band from the twelfth Attestor's spare lens.
- New §2.10 "Refusal and certainty": the in-fiction explanation in §2 above.
- §11 flags: `band:majin`, `band:tenjin` (set with the item; nothing needs them as a gate).

These additions don't become story gates. The beats exist already; they gain lines and an item reward, and nothing
`need`s the bands.

## 6. Tutorials

The game teaches each band **three times**: in the story, on screen, and in a fight that shows it.

1. **Story first** (§5): Sable's and Wynn's lines say in-fiction what the band does and when (hurt vs. healthy).
2. **The enemy demonstrates it.** In both debut fights the opponent transforms first, so the player sees the burst,
   the new sprite and the message before they have to do it.
3. **Band card**, the same black-slab `TutorialCard` style as Wynn's opening steps, shown once when each band is
   received. Each step is ticked by a real event:
   - *Majin Band* (3 steps): "Open your party: creatures with the cracked red ring can go Majin" (party opened) →
     "Majin opens when its HP is below half" (a battle where a Majin species drops below half) → "Transform: once a
     battle" (a Majin transformation).
   - *Tenjin Band* (3 steps): the same with the gold ring, "at or above half HP", and a Tenjin transformation.
   - Skippable; marked done on sight for accounts that already transformed.
4. **In-battle coach mark**, the first time the toggle lights up: a pulse on the button and one line:
   "**Majin ready.** Its HP is below half. One transformation per battle." /
   "**Tenjin ready.** Its HP is above half. One transformation per battle."
   The first time it's greyed out with a reason: "Majin needs HP below half." / "Already transformed this battle."
5. **Party and Dex marks.** A small red cracked-ring or gold-ring icon on every eligible species (party, box, Dex). The
   Dex entry shows the form's art and its line once seen. A Forgewall quartermaster NPC repeats the rules for players
   who skipped them: "Red one below half, gold one above. Once a fight. That's the whole manual."

## 7. Build notes (for when we implement)

- **Engine:** today's `BattleFormDef` already does stats, sprite, on-enter and signature move. New fields:
  `kind: 'majin' | 'tenjin'` and `onEnter.cureStatus` / `onEnter.healFraction` (Tenjin). New optional battle input:
  the bands each side holds (absent = none). New optional action flag: `transform: true` on a move action, validated
  against band, hp gate, once-per-side, eligible species. `checkBattleForm` keeps auto-triggering only for **wild**
  sides. Everything new is optional with defaults, so `fuzz-digests.json` stays byte-identical.
- **Turn order:** transformations resolve at the start of the turn, before moves (both sides, faster first). Move
  order then uses the transformed speed.
- **Client:** the move-menu toggle, the `form_tenjin` VFX (gold ring burst, mended-crack shimmer) beside `form_rage`,
  the timeline `form` keyframe (exists), the battle text, the two tutorial cards, the party/Dex ring icons, and two
  sounds (Majin: a crack + roar; Tenjin: a bell + choir swell), from the approved CC0 packs only. The live aura is
  already built (§8).
- **Content:** 2 `slot: 'key'` items (`majin_band`, `tenjin_band`), the reward lines on beats 19 and 21, and the NPC
  teams' band flags (Reeve, Hollis, Veil, Varn, Aurelia).
- **Art budget, the real constraint:** 10 new forms = 20 sprites. The sprite budget was nearly full after castlemaw
  (~0.4 MB headroom). This needs a decision before import: raise the ceiling, or let the encoder drop a quality rung
  for everyone. Majin/Tenjin forms are battle-only (zoneless, like `hollowmane_rage`), so they don't affect zone atlas
  binds.
- **Signature moves (phase 2):** each one needs a cinematic, a portrait and a sound (as the 12 existing ones did), so
  ship the forms first with stat changes only. Proposed names: Majin: *Cinder Maw* (infernomorel), *Dead Man's Draw*
  (badlander), *Plague Tide* (toxshade), *Grudge Coronation* (necrogeist). Tenjin: *Verdant Aegis* (thornback), *Eye of
  the Storm* (abysspark), *High Noon Oath* (lawlander), *Prism Absolution* (gemknight), *Wishlight* (glimmereen),
  *Second Sunrise* (solpyre).

## 8. The aura: how you recognise a form (built 2026-10-11)

A transformed creature wears a **live, animated aura** for the rest of the battle. The game draws it; it is **not**
in the sprite art. It has three layers, and the two forms are opposites in every one:

| | **Majin** | **Tenjin** |
|---|---|---|
| Flames | flame tongues licking **up and outward** off the creature's outline, fast (0.55 s), flickering; orange-hot → blood red; embers spitting off | calm streaks of gold light rising **straight up** from the shoulders and head, slow (1.7 s); gold star motes drifting up |
| Floor sigil | a jagged crimson ring **broken by a crack**, spinning, pulsing hard | a **whole** gold ring + inner ring + a lens circle at the centre + 12 ticks turning slowly, breathing |
| Rim | the creature's silhouette edge glows crimson, pulsing fast | the edge glows gold, pulsing slowly |

- It fades in when the form appears (right after the transformation burst) and fades out on a faint or at battle end.
- It follows the creature (lunges carry it), freezes in hitstop and slows in slow-mo like every other effect.
- It runs on any form: the shipped Rage Forms (hollowmane, castlemaw) are Majin forms and show it already.
- Cost: 4 fixed slots, 2 shared materials compiled at boot, no lights, no CPU per particle.
- Code: `packages/render/src/stage/aura.ts`; the client sets it from the form (`FORM_AURA` in `spriteCatalog.ts`).
- Try it: render sandbox `?demo=battle&mine=thornback&foe=hollowmane_rage&mineAura=tenjin&foeAura=majin`.

## 9. The bond cinematic, "Heartsync" (built 2026-10-11)

The user asked for a Mega-Evolution-like moment for the bond between trainer and Ewamon, with our own twist. Mega
Evolution is a key stone touching a mega stone. Ours is **two heartbeats becoming one**, and then the story's argument
answered on screen.

1. The trainer's wrist and band (the lens on its cuff) and the creature come in on two slanted slabs, each with its own
   heartbeat: the trainer's slow and deep, the creature's fast. Each beat sends a spark down a thread of light from the
   lens to the creature; the beats speed up and close in, and a **SYNC** readout climbs to 100 % as they land together.
2. A breath of silence. Then the band answers:
   - **Majin (REFUSED).** A Provision ledger line reads "TOXSHADE · UNSAID" and is struck through, which is what the
     Provision's lens does. But the memory has a second holder, so it refuses: the strike **cracks**, crimson cracks run
     across the whole screen, the cracked ring sigil breaks in two, and the stamp says **REFUSED**. The roar.
   - **Tenjin (HELD).** The screen cracks too, and then **gold seams flow into every crack and mend it** (kintsugi),
     the whole gold ring closes with its twelve ticks, the ledger reads "HELD BY <trainer>", and the stamp says
     **HELD**. A great bell and a choir.
3. The portrait becomes the form, the slabs break away (Majin) or rise and burn white (Tenjin), and the 3D burst, the
   sprite swap and the aura (§8) play underneath.

Only a trainer's transformation plays it: the player's, an NPC's with bands (Reeve, Hollis, Varn, the Wardens, Zeon) or
a pvp rival's. A wild Majin breaks open alone, with the plain burst, because nobody holds it. About 2.7 s before the
burst, once per side per battle. Code: client `battle/bond.ts`, `BondCinematic.tsx`; sounds `bond_majin` /
`bond_tenjin` (audio bible §6); preview `/bondfx/?species=toxshade`.
