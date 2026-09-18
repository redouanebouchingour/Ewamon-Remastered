# EWAMON REMASTERED — STORY BIBLE v1.0

**Status:** BINDING for `packages/content` `STORY`, `ZONES[*].npcs / lore / storyRole / harvestState`, the institution's `TrainerDef`s, the dex `flavor` voice, and every story flag id. Subordinate to `.design/spec/00-spine.md`: the `StoryBeat`, `QuestDef`, `ZoneDef`, `NpcDef`, `TrainerDef`, `LoreTabletDef` and `LeagueTrainer` shapes are consumed verbatim from §3 and never redefined here. Subordinate to `.design/roster-coverage.md` for where species live; this file never places a species. Where `PLAN.md` "Story" and this file disagree, this file wins, because this file is the deliverable that section promised.

**Inputs:** `PLAN.md` §"Story — new cosmology, new plot"; `spec/00-spine.md` §1 (last paragraph: the harvested render state), §3.1, §3.3, §3.4, §3.5; `roster-coverage.md` §7 (statics), §12.1 (12 quests, their givers and flags); the legacy `world.js` (`GYMS`, `ELITE`, `CHAMPION`, zone names) and `ewamon.js` (130 species names, legendary flavour) under `.design/legacy/`. The legacy plot (Lumyth the Day-Mote, the Veins, the Eclipse Order, the Eclipse Engine, Hierophant Erebos, the First Dark) is **not carried**; no line of it appears below.

**What is kept from legacy, by id:** all 21 `ZoneId`s and their display names; all 130 species ids and names; the 8 `BadgeId`s and badge names; the 8 gym ids (`verdant_gym, blaze_gym, tidal_gym, volt_gym, stone_gym, phantom_gym, iron_gym, draco_gym`) with their leaders' names; the 3 elite ids (`veil, aurelia, kirei`) and the champion id `zeon` with their names; the rival's name Sable; the mentor's name Prof. Wynn. Everything else about those people is rewritten.

**Reading order:** §1 premise → §2 cosmology → §3 institution → §4 cast → §5 beats (the data) → §6 zones (the data) → §7 legendaries → §8 dex voice → §9 style → §10 glossary → §11 flags. An implementer entering `STORY` needs §5 and §11; an implementer entering `ZONES` needs §6; a writer adding a line needs §9.

---

## 1. PREMISE AND TONE

1.1 **The premise, in one sentence.** Ewa is not a world; it is something's memory of a world, and the memory is thinning.

1.2 **The premise, in four claims the game can show.**

| # | Claim | How the player sees it |
|---|---|---|
| a | Ewamon are recollections with bodies. They precipitate at the Seams — places where the memory runs thin enough to see through. | Wild spawns cluster where a zone is oldest and least maintained: hedgerows, quays, cuttings, shrines. The Dex calls a catch a *witnessing*. |
| b | A memory can be spent. Unmake an Ewamon back into raw recollection and the world re-remembers itself with something new in it: grain, a harbour, a cure. | The Provision's public works are everywhere and everyone is grateful. Its ledger is open on a lectern in Solenne. |
| c | What is spent is not killed. It never was. The place it was drawn from loses specificity. | A harvested zone renders as flat-shaded primitives (spine §1, `HarvestLevel 2`). Craftsmen in it forget their trade. Names slip. |
| d | A memory that two things hold cannot be quietly lost. The Dex is the second holder. | `catchSpecies` counts drive Act III quests; the mythicals are handed to a player with 100 and 120 species witnessed (roster-coverage §12.1). Completing the Dex is the theme's win condition. |

1.3 **Tone.** Civil, quiet, specific. The antagonist is not a cult and does not monologue about darkness. It publishes minutes. The horror is administrative: a column in a book, a polite person with a clipboard, a harbour that everyone agrees has always been there. Nobody in this story is stupid and nobody is a monster; the Provision's case is strong enough that a player who sides with it for the first two acts is not wrong to.

1.4 **Three acts on eight badges.**

| Act | Name | Badges | Zones entered | The question the act asks |
|---|---|---|---|---|
| 1 | The Thinning | bloom, ember, current | mirevale → tide_route (6 zones) | Something is wrong. What is it, and why can nobody name it? |
| 2 | The Ledger | circuit, fault, wraith, anvil | stormrook → siege_route + umbral_observatory (9 zones) | Who is doing it, why does it work, and why is the rival helping them? |
| 3 | What's Left | ascend + the league | skyrend → the_rift (6 zones) | The Provision's final withdrawal: spend the memory of the world's own name to buy permanence. What is worth keeping, and who holds it? |

1.5 **What this story is not.** No prophecy; no chosen one; no ancient evil; no doom device with a countdown. The player is a witness who becomes very good at witnessing. The ending is not the destruction of the Provision — it is still there in the last scene, still needed, and its ledger has a new column.

1.6 **Rating and content lines.** No on-screen death of a person. Creatures are "unsaid", never shown dying; the unsaying happens behind a lens in a room the player is not allowed into until Act II, and what the player sees is the after: a flat place, a person who cannot remember a word. No blood, no gore. Grief is allowed; despair is not the note the game ends on.

---

## 2. COSMOLOGY

### 2.1 The Held and the Holder

2.1.1 Ewa is **the Held**: a world that exists because something remembers it. In-fiction nobody knows what does the remembering; scholars at the Sky-Shrine call it **the Holder** and refuse to say more; the Provision's charter calls it "the substrate"; children in Mirevale call it "the one who's asleep". The game never shows it, names it, or gives it a face. It is not a god and no one prays to it. This is a hard rule (§9.4).

2.1.2 The memory is **thinning**. This is observable: light through the Mirevale canopy is greyer than the Grove-Stone says it should be; charts of the Saltmourn tide no longer match the tide; the Skyrend astronomers have three centuries of records and the sky has fewer stars in each. Nobody knows why. The Provision's own position (§3.6) is that thinning is natural entropy in the substrate and that the Provision is the only institution doing anything about its consequences.

2.1.3 The truth the player assembles across Act II: the thinning has a natural component, and the Provision has been *accelerating* it for forty-one years, one purchase at a time, and does not dispute this when asked. It disputes that it matters.

### 2.2 Seams

2.2.1 A **Seam** is a place where the Held is thin enough that recollection precipitates on its own: a hedgerow no one has trimmed in a century, the sunk quay under Saltmourn harbour, the Deep Cut where the miners went past bedrock into something that is not rock. Ewamon appear at Seams. The eight route zones are each a long Seam; the towns are built at the safe distance from one.

2.2.2 Seams are not wounds and are not evil. They are where the world is honest about what it is. The Ghost-type zones (`vesperveil`, `hollow_route`) are Seam-dense — memory there is always a little loose — which is why `hollow_route`'s default `harvestState` is `thinning` and has been for as long as anyone has lived there (§6.12).

2.2.3 The Rift (`the_rift`) is the exception that explains the rule: it is not a Seam but the place where the Held ends. There was never anything there to remember. It renders `harvested` by default because there is nothing for pillars 2–5 to show — the flat look is not damage there; it is the floor.

### 2.3 Ewamon as recollections

2.3.1 An Ewamon is a recollection of an animal that has precipitated into a body. Not the animal — the world's *memory* of it. This is why species are stable (the memory is the same memory each time), why they can be caught into a device (a recollection can be re-recorded), and why they can be spent (§2.6).

2.3.2 Wild Ewamon are the Held remembering out loud. A trainer's Ewamon is a recollection with a second holder, which is why a trained creature is steadier, stronger and — the Attestor's key claim — cannot be unsaid without the trainer's consent.

2.3.3 In dialogue, ordinary people say "Ewamon", "creature", "partner". Only Wynn, the Provision and the Wardens say "recollection". A gym leader says "recollection" exactly once each, at the moment they concede the point (§4.4).

### 2.4 Types are registers

2.4.1 A type is the **register** a memory is held in — the key it is filed under. Fire is the register of things remembered by their heat; Water by their motion; Rock by their persistence; Ghost by their absence; Normal by nothing in particular, which is its own kind of clarity. Dual-typed species are filed under two keys.

2.4.2 The type chart is a chart of which register overwrites which. Water over Fire is not physics; it is that a memory of a river is easier to hold than a memory of a flame, and when they meet the river is what remains. Content does not need this reading to work — the chart is the legacy chart verbatim (spine §2.2) — but every line about type advantage in the game is written from it.

2.4.3 **Cosmic** is the register for things remembered *about the world itself* rather than about anything in it: the first morning, the first night, the fact that there was a before. Only three species are filed there (`lumyth`, `noxmyth`, `voidraxis`), all of them legendary or mythical. Cosmic is hit hard by Steel and Dark and resists Psychic, Fairy, Cosmic (spine §2.2, chart verbatim), and the reason is in §2.9.

### 2.5 Evolution is certainty

2.5.1 A memory becoming more certain of itself. `bramblecub` is the Held half-remembering a cub in the brambles; `briarbear` is the same memory now sure of its size; `thornback` is the memory settled and unarguable. This is why evolution is by level only (roster-coverage §9: zero stones, zero trades) — certainty is earned by being witnessed in use, not bought.

2.5.2 The one ability split (`darkone` → `aonred` / `darkyon`, roster-coverage §8) is the one memory that is certain of *two different things* depending on what it was seen doing. The Dex entry for `darkone` says so (§8.3).

2.5.3 Finals do not spawn wild (roster-coverage pillar 7) because a memory does not arrive certain; someone had to be there while it made its mind up. The exceptions (`aonred`, `darkyon` at the observatory) are memories the Provision *made* certain under the lens and let go — a clue, not a tuning accident (§6.19).

### 2.6 Spending

2.6.1 A recollection can be **unsaid**: taken apart, under a lens, back into the raw stuff of the Held's remembering. Raw recollection can be spent — the Held, re-remembering the world without that creature in it, will remember something else in the gap if you tell it what. Grain in a granary. A harbour where there was a mudflat. A cure in a hospital's dispensary that the pharmacist swears she has stocked for twenty years.

2.6.2 The purchase is retroactive. The harbour was not built; it *was always there*. The people who use it remember using it as children. The only record that it was ever otherwise is the ledger entry that bought it, and the fact that the ledger exists at all is the Provision's one genuine act of conscience (§3.8).

2.6.3 The cost is paid in **specificity**, at the place the recollection was drawn from. A route whose hedgerow-memories were unsaid loses the hedgerow's detail first — the texture of the bark, the way the light came through — then the geometry, then the light itself. That is the render state `harvested` (spine §1). People are drawn from too: a harvested town's cooper can still make a barrel but cannot tell you how; his hands remember and his mouth does not. Names go last and go quietly — a person says "the, the — you know the one" about a street they have lived on for thirty years.

2.6.4 Spending is not killing. Nothing dies. A species that has been drawn on heavily gets *rarer* — it precipitates less often, because the Held holds it less firmly — and a species that had every instance unsaid would simply never have existed, and no one would miss it, because there would be nothing to miss. The Attestor exists to make that last sentence false (§2.8).

2.6.5 **Mechanical scope, stated so nobody over-builds it.** In v1 `harvestState` is a render state and a dialogue gate (`NpcDef.react`). It does not alter spawn tables, weights, or bands (roster-coverage owns those and does not read it). "Rarer" in 2.6.4 is fiction the dialogue asserts, not a multiplier the server applies. If a later milestone wants a spawn effect it adds a field; this file does not promise one.

### 2.7 Legendaries are singular memories

2.7.1 The eight legendaries are memories of things that only ever happened once: the storm that struck the pylon (`raikitsune`), the oath sworn on a sealed blade (`bankaiser`), the burning star that came down (`galaxion`), the laugh at the caldera lip (`sunjaw`), the winter that did not end (`glacinid`), the lightning that hit a fallen star (`voltaura`), the dragon that tested the first Champion (`zenryu`). One event; one memory; one body. That is why each appears exactly once, gated, in `LEGENDARY_STATICS` (roster-coverage §7) and why a KO'd legendary is gone for that player — you were the second holder and you dropped it.

2.7.2 The Provision has never spent a legendary. Not from scruple: a singular memory unsaid buys almost nothing, because the Held did not use it to hold anything else up. The Comptroller says this out loud in Act II and it is one of the moments the player is meant to find her reasonable.

### 2.8 The two mythicals and the Attestor

2.8.1 **Lumyth** is the Held's memory of the **first morning** — the first time there was light to remember anything by. **Noxmyth** is the memory of the **first night** — the first time there was dark to remember it against. Neither is good or evil. The Long Night event (roster-coverage §12.2) is Noxmyth's season; Verdant Bloom is Lumyth's. They are the two oldest things the Held holds and they are handed to the player as quest rewards at 100 and 120 species witnessed, because by then the player is the largest second holder in Ewa and the Held, in the story's logic, trusts them with its oldest two.

2.8.2 The **Attestor** is the Dex. Wynn built it (§4.2). Its claim, which Act III tests: a recollection recorded in a second place cannot be *quietly* unsaid — the Held will notice the discrepancy between what it remembers and what the Attestor remembers, and hesitate. It does not stop spending. It makes spending cost the spender something, and it makes restoration possible (`restoreZone` in q10: a zone can be re-remembered from Attestor records if enough of what was drawn from it has been witnessed). This is the mechanic the story is built on and it is stated in plain words by Wynn in beat `first_witness` (§5).

### 2.9 Why Cosmic has no body-bound weaknesses

2.9.1 Every other register is a memory *of a body*: a thing with heat, weight, motion. Its weaknesses are the weaknesses of the body remembered — fire and water, rock and wind. Cosmic remembers no body. It remembers that there was a morning, a night, a before. Nothing in the world can be brought against it, because it is not in the world; it is what the world is remembered against.

2.9.2 It has exactly two weaknesses, and both are outside the body. **Steel** is the register of the deliberately *made* — the thing that was never remembered but built, and which therefore insists on itself against memory. **Dark** is the register of the refused — what memory will not hold. A made thing and a refusal are the only two things that can be set against a memory of the world itself. This is why the Provision's field agents run Steel and Dark (§4.7) and why `voidraxis` (Cosmic/Dragon, ability `Void Sovereign`, immune to Fairy) is what waits at the Rift.

2.9.3 **Voidraxis** is the memory of *before there was anything to remember*. It is not a villain and has no plan. It is at the Rift because the Rift is where the before still is. Its legacy flavour line — no trainer has seen its face and remembered it — is kept in substance (§8.3) because it was already this story.

---
## 3. THE INSTITUTION — THE PROVISION

### 3.1 Name and forms of address

3.1.1 Formal name: **The Provision of Ewa**. On documents: *the Office of Provision*. In speech: *the Provision*. Staff: *Provisioners*. Field staff: *Assessors*. The head: *the Comptroller*. Adjective in common use: *provisioned*, as in "the harbour was provisioned in my grandmother's time" — the word people use without knowing what it means.

3.1.2 It is never called an order, a cult, a cabal or a conspiracy by anyone credible in the game. Karn Emberlitt calls it "the Office" with respect. Wynn calls it "the Provision" with weariness. The Comptroller calls it "we".

3.1.3 Livery: dove-grey coat, a brass **assay token** on a cord (a flat disc with a lens-hole through it — the "eye"), a ledger-case. Assessors carry a portable **field lens** the size of a hand mirror. Nothing hooded. Nothing black. In `remoteAppearance`/`look` terms: `look: 'provisioner'` (grey coat, brass token), `look: 'comptroller'` (the same coat with a white collar). The two looks are the only visual signal the Provision gives, and they are worn openly in every town from Act I.

### 3.2 History

3.2.1 Founded 212 years before the game as the **Granary Office of Solenne**: a civil body that stored grain against bad years and moved it where it was needed. For 171 years it did that, competently, and nothing else.

3.2.2 **The Grey Year**, 41 years before the game. A canopy-blight in the Mirevale groves and a failed salt-harvest at Saltmourn in the same season; the granaries were emptied by midwinter; by spring the Office was recording deaths by district. Its records from that year survive and are quoted on a lore tablet in Solenne (§6.17).

3.2.3 **The discovery.** A Granary clerk named **Oswin Marle**, working in the disused Umbral Observatory because it was the only stone building with a lens large enough to dry grain sacks under, found that a wild Ewamon that wandered under the great lens at noon came apart — and that the sacks under the lens were, the next morning, full. He wrote it down. He did it again on purpose. The Office fed Solenne through the last two months of the Grey Year on what Marle drew from the hollow-route hedgerows, and 4,100 people who the district rolls had marked as likely to die did not.

3.2.4 The Granary Office was rechartered as the Provision the following year. Marle was made the first Comptroller. He is dead; the current Comptroller is his student's student. His portrait hangs in the Provision Hall in Solenne and his name is on the Grey Year memorial. The game does not make him a villain; he was a clerk who found a way to feed people.

3.2.5 **Since.** Forty-one years of provisioning, all recorded: the Saltmourn harbour (year 6), the Cinderhold forge-relief after the Emberlitt fire (year 19), the Marrowdig cave-in relief (year 38 — Act II turns on this one), the Provision Hospital in Solenne and its dispensary (continuous), the Stormrook grid's third pylon line (year 27), grain in every bad year (eleven of them). The public ledger (§3.8) runs to 1,400 pages.

### 3.3 How spending works — the procedure, as the Provision describes it

3.3.1 **Stock.** Assessors and contracted trainers (§4.3: this is what Sable is) catch wild Ewamon at the Seams and bring them to the Observatory. The Provision pays by the head, on a public rate card (`common` 120, `uncommon` 300, `rare` 900; legendaries are not bought — §2.7.2). Stock is kept in the Observatory's **holding** — a ring of orbs on a wall the player sees in Act II.

3.3.2 **Assay.** Each creature is assessed under the field lens: how firmly the Held holds it (the Provision's word is *tenure*). High-tenure recollections buy more. Species that have been drawn on heavily assay low, so the Provision rotates Seams — this is why the Assessors are always *moving*, and why the harvest the player sees in Act I is on a route nobody has provisioned in twenty years.

3.3.3 **Unsaying.** Under the great lens — the flattened mirror at the Observatory's heart, ground to see nothing and therefore able to un-see. The recollection comes apart. The Provision does not call this killing and the game does not show it; the room is entered only after the fact.

3.3.4 **Provisioning.** The raw recollection is *directed*: a Bursar states, in the charter's prescribed form, what the Held is to remember instead. The form is on a lore tablet (§6.19): "Let it have been that —". The next morning it has been.

3.3.5 **Settlement.** The purchase and its draw are entered in the ledger. Both columns. Always. Marle's rule.

### 3.4 The cost, as the player sees it

3.4.1 Places: `harvestState` goes `intact → thinning → harvested`. Thinning is legible as fewer textures and dimmer lamps; harvested is spine §1's flat look. The Provision's own term for a harvested place is *settled*; the people who live in one say *grey*, after the Grey Year, without noticing the irony.

3.4.2 People: `NpcDef.react` on a `harvested`-gated flag swaps an NPC's lines for a degraded set — the cooper who can't explain the barrel, the lineman who can't name the pylon. Written so it is unmistakable and never a joke (§9.6).

3.4.3 Species: asserted in dialogue only (§2.6.5).

3.4.4 The spender: the Provision's staff are drawn on too, slowly, because they stand nearest the lens. Senior Provisioners keep **name-cards** in their coat pockets with their own name and the names of their children, and consult them without embarrassment. The Comptroller does it in front of the player in Act II. This is the one place the story lets the cost be personal to the antagonist, and it is played straight.

### 3.5 The ledger

3.5.1 A physical book in two copies: the working copy at the Observatory, the public copy on a lectern in the Provision Hall in Solenne, updated by courier monthly. Anyone may read either. Nobody does, because the draw column is written in **register notation** — a species name and a place, in the Wardens' old shorthand for filing recollections — which reads as an accountant's code to anyone who has not been taught it. The player has: Wynn's Attestor uses the same notation on every Dex entry, so by Act II the player can read the ledger and nobody else in Ewa can. This is the reveal (§5, beat `the_ledger`).

3.5.2 A ledger line, verbatim, as it appears on the lore tablet in the Observatory and in the beat:

```
  Yr 38 · 14th of Fall · Bursar Quill
  PROVISIONED   Marrowdig — relief of the Deep Cut cave-in; 61 miners recovered; shaft restored.
  DRAWN AGAINST mire_route · seedrift ×22 · mossling ×31 · bloomsprite ×4 · smellduck ×19 · resilian ×9
                (tenure high; Seam last drawn Yr 17)
```

3.5.3 The new column the ending adds (§5, beat `the_new_column`) is **ATTESTED**: whether the recollections drawn were held elsewhere first, and by whom. It is not a ban. It is a cost that appears on paper.

### 3.6 The Provision's defensible case

Stated in full because the player must be able to lose the argument in Act II and win it only in Act III. Every point below is spoken by a Provisioner somewhere in §5 or §6.

1. The thinning is natural. Records show the sky losing stars for three centuries; the Provision is 41 years old.
2. Nobody dies. Nothing that is spent suffers, because it never was.
3. Everything bought is real, retroactively and permanently. A provisioned harbour does not fail.
4. The alternative to provisioning in a bad year is the Grey Year, and the Grey Year has a memorial with 4,100 names on it that would have been longer.
5. Wild recollections are the Held remembering out loud to nobody. Spending them is using an unused resource.
6. The ledger is public. The Provision has never hidden a purchase or a draw.
7. Settled places are quiet and poor, but nobody in them is hungry, and every one of them was quiet and poor before.
8. Legendaries are not touched, trained creatures are not touched without consent (the Provision *buys* them, on the rate card), and children's partners are exempt by charter.

The story's answer is not that any of these is false. It is that point 2 is not the same as "nothing is lost", and that a world which can be bought is a world with a price, and Act III shows what happens when the price is the world's name.

### 3.7 Leadership and ranks

| Rank | Count | Role | Named in the game |
|---|---|---|---|
| Comptroller | 1 | Head of the Provision; signs every provisioning above 200 heads; decides the Permanence Provision alone | **Odile Varn** (§4.7) |
| Bursar | 3 | Direct the raw recollection at the great lens; keep the working ledger | **Elias Quill** (§4.7); two unnamed |
| Assessor | ~40 | Field staff; assay stock, close Seams for drawing, escort, enforce requisitions | **Tamsin Reeve**, **Bram Hollis** (§4.7) |
| Junior Assessor | ~60 | Contracted trainers who catch stock by the head; paid on the rate card; no lens access | **Sable** (§4.3), until beat `sables_turn` |
| Clerk | ~200 | Granaries, hospital, hall, couriers | unnamed NPCs in solenne |

3.7.1 The Provision has no soldiers. Its Assessors are trainers, and a requisition is enforced the way everything in Ewa is enforced: by battle, in the open, with the town watching. This is why the "siege" of Forgewall (§5) is a standoff in a courtyard and not a war.

### 3.8 Why it cannot simply be exposed

3.8.1 **It is not hidden.** Every purchase and every draw is in a public book. A player who runs to the Solenne watch with the ledger is shown the ledger.

3.8.2 **The evidence is what spending destroys.** Nobody remembers the mudflat where the harbour is. The harbourmaster has a chart from before year 6 that shows no harbour and everyone, including him, agrees the chart is wrong. Testimony cannot exist about a thing that never was.

3.8.3 **Gratitude is real.** The Grey Year memorial is in every town. Karn Emberlitt's forge, Maren's harbour, Petra's miners. The Provision saved people the player talks to, and they know it.

3.8.4 **It is legal.** The charter (year 1) grants the Provision the right to draw on any wild Seam and to requisition any *place* for drawing with the Comptroller's signature and 30 days' notice. Forgewall's bastion is requisitioned, on paper, correctly.

3.8.5 **There is no one to expose it to.** Solenne has a council, and the Provision feeds it. The Wardens at the Sky-Shrine (§4.6) have known for 41 years, hold no civil power, and have spent those years building the one thing that can answer it: not a court, a record. The Attestor.

3.8.6 So the player does not expose the Provision. The player *out-holds* it: witnesses enough of what it draws on that the ledger's arithmetic changes, restores the grove from the record to prove restoration is possible (q10), and at the Spire makes the Comptroller's final withdrawal fail because the thing she reaches for — the world's name — is by then held in a second place. The ending is a new column in a book (§3.5.3), not a fire.

---

## 4. CAST

Ids in this section are `NpcDef.id` / `TrainerDef.id` / `LeagueTrainer.id` as they must appear in content. NPC ids follow roster-coverage §12.1's `<zoneId>.<role>` convention; a person who appears in several zones has one id per zone (`mirevale.wynn`, `celestial_spire.wynn`) because `NpcDef` is per zone.

### 4.1 The player

4.1.1 Seventeen or so; from Mirevale; no parents on screen and no tragic backstory — the game does not spend words on where the player came from. Wynn chooses them because they are the one who keeps asking why the light through the canopy is grey. Silent protagonist: no player lines are authored; every beat is written so the speaker carries it.

4.1.2 What the player *is*, by Act III, in the story's own terms: the largest second holder in Ewa. The Dex is the character arc. At 3 species the player is a child with a notebook; at 120 the Held hands them the first morning.

### 4.2 Prof. Wynn — `mirevale.wynn`, `celestial_spire.wynn`, `the_rift.wynn`

4.2.1 Sixty-one. Former Assessor of the Provision — twelve years in the grey coat, two of them under the great lens as a Bursar's assistant. Left in year 26 after the Stormrook pylon draw, when a lineman she had grown up with could no longer say her name. Not bitter: she still believes the Grey Year had to be answered. She stopped believing the answer was free.

4.2.2 Built the **Attestor** over fifteen years from the Wardens' old register notation and a Provision field lens turned backwards — a lens that records instead of un-sees. She has given out eleven of them. The player's is the twelfth. The starters are creatures she witnessed herself, at the Seam, and has held for the player since they hatched: she says so in `first_witness`, and it is the reason the starter choice is the first witnessing — the player's Dex opens with one entry that was Wynn's and becomes theirs.

4.2.3 Re-characterisation from legacy: legacy Wynn was a benign professor with a vague warning. This Wynn is a defector with a plan she has never been sure will work, and the player is the test of it. She is wrong once on screen (she believed the Provision would not draw on Mire Route while an Attestor-holder was from there; beat `grove_gone`) and says so.

4.2.4 Voice: short sentences; technical when nervous; never says "destiny". Calls the player "you" and, once, at the Spire, by name (the player's chosen name, interpolated — the only place the game does this).

### 4.3 Sable — the rival

Ids: `mire_route.sable`, `tide_route.sable`, `deepcut_route.sable`, `umbral_observatory.sable`, `siege_route.sable`, `celestial_spire.sable`, `the_rift.sable`. Trainer ids for battles: `sable_mire`, `sable_tide`, `sable_deepcut`, `sable_observatory`.

4.3.1 Eighteen; from Cinderhold. Their younger brother **Teo** has been in the Provision Hospital in Solenne for two years with a wasting illness that the dispensary treats and does not cure; the treatment is provisioned, monthly, and the Provision does not charge for it — but a bed in the hospital is held for the families of Provision staff first. Sable is a Junior Assessor because it keeps Teo in the bed. This is stated plainly in beat `sable_livery` and never made mysterious.

4.3.2 **The arc in five beats.** *Mire Route*: an eager friend with a Provision-issued `coalette`, racing you to the first badge, already on the payroll and not hiding it ("It's a job. It's a good job."). *Tide Route*: in the grey coat now, catching stock, defending it well — point 5 of §3.6 in their own words. *Deepcut*: refuses to talk about it; fights hard; wins or loses without grace. *The Observatory*: Sable is present when the Comptroller shows the player the ledger, reads the Yr 38 line over the player's shoulder, and sees `bloomsprite ×4` — Sable caught those four, on Mire Route, the week after the first battle, and was paid 3,600 for them. Sable fights the player because it is the only thing in the room Sable can do, and after losing takes the brass token off and puts it on the ledger. *Siege Road*: fights beside the player; no battle; two lines. *Spire and Rift*: present, quiet, has found a different way to keep Teo's bed (Wynn's — the Wardens fund it; this is said in one line and not dwelt on).

4.3.3 Sable's turn is **not** a redemption from evil. Sable was never wrong about the money or about Teo. Sable learns that the ledger has two columns and that they were in the second one. The game does not punish Sable and Sable does not apologise; Sable says "I read it" and that is the whole confession.

4.3.4 Teams (species:level; within the band of the beat's zone; Cinderhold roots):

| Trainer id | Zone | Team |
|---|---|---|
| `sable_mire` | mire_route | coalette:5, glimp:4 |
| `sable_tide` | tide_route | coalette:15, glimp:14, mudbub:13 |
| `sable_deepcut` | deepcut_route | caldermole:25, glimmereen:23, bogmaw:24 |
| `sable_observatory` | umbral_observatory | caldermole:45, glimmereen:44, bogmaw:44, murmink:43, ignispectre:45 |

### 4.4 The eight gym leaders — each a person with a stake

Ids and names are legacy, verbatim (`LeagueTrainer.id` / `name`). Titles are rewritten. Teams are the legacy teams (levels monotone across order, spine §3.3 validate) and are not restated here; league `pre`/`post` lines are authored in content from the voice notes below. The "concession" is the one line in which each leader says *recollection* (§2.3.3); it belongs in `post`.

| id | Name, title | Stake | Concession line (`post[1]`) |
|---|---|---|---|
| `verdant_gym` | **Mira Thornwell**, Grove-Keeper of Mirevale | Keeps the Grove-Stone and the canopy. Has measured the noon light for twenty years and watched it grey. Suspects nothing about the Provision; suspects the world. First to tell the player the thinning is real. | "You held them like they were yours to keep. Maybe that's all a recollection needs." |
| `blaze_gym` | **Karn Emberlitt**, Ash-Forge Master | The Emberlitt fire (year 19) took his father's forge; the Provision *provisioned* it back — the forge the player fights in has always been there, and Karn remembers his father working it, and his father died in the fire before it existed. He does not know this. He defends the Office with his whole chest. In Act III (`react` on `act3_started`) he has read the ledger and does not defend it, and does not condemn it either. | "The Office would call that a recollection. I'd call it a partner. Might be the same thing said twice." |
| `tidal_gym` | **Captain Maren**, Harbourmaster of Saltmourn | Runs a harbour that was provisioned in year 6. Has his grandfather's chart, which shows a mudflat, and has spent his life agreeing the chart is wrong. Under the harbour, at the sunk quay, `wraithtide` precipitates at night — the memory of the old harbour that nobody holds. He is the quest giver for `q04_drowned_harbour` (id `saltmourn.harbourmaster`, a distinct `NpcDef` from the league entry — the league fight is `tidal_gym`; the man on the quay is the NPC). | "Read the wave and you'll know it isn't water. It's a recollection of water. Same rules. Wetter." |
| `volt_gym` | **Zia Volt**, Storm-Grid Keeper | The Provision is her grid's largest customer: the third pylon line (year 27) was provisioned and the Observatory draws 40 % of Stormrook's output through it, at night. She is the first person in the game who has *numbers* and shows them to the player. Neutral — she sells power — until Act II, when she works out what the power is for. | "You out-ran a current. That's not speed, that's a recollection that's sure of itself." |
| `stone_gym` | **Petra Stonewright**, Mine-Boss of Marrowdig | The Deep Cut cave-in of year 38: 61 miners under rock, and the Provision recovered them, and the shaft was restored. She owes the Provision every one of those 61 lives. Her miners are forgetting their trade — the Deep Cut went past bedrock into a Seam, the Provision leases it, and the drawing happens under her town. She knows both facts and has not yet let them touch. | "A recollection of stone still breaks your hand. Ask mine." |
| `phantom_gym` | **Nyx Hollow**, Medium of Vesperveil | Lives where memory is loosest and hears it. In legacy she heard a dark voice; here she hears *the ledger being read aloud* every night — the Bursars at the Observatory, a mile east, directing the Held in the charter's form. She has never told anyone because she was not sure it was real. The player is the first person who can read the notation she has been transcribing in her sleep. Quest giver `vesperveil.medium`. | "You kept your head in a haunted field. A recollection's only a ghost that decided to stay." |
| `iron_gym` | **Marshal Rell**, Warden of Forgewall | Forgewall's bastion sits on the richest un-drawn Seam in Ewa (the Provision's assay; the Wardens agree). The Provision has requisitioned it, legally, with 30 days' notice, and Rell has read the notice and refused. He is the only civil authority in the game to refuse the Provision, and he does it by standing in his own gate. Quest giver via `forgewall.quartermaster` (his second). | "Plating's a recollection of being hit and not moving. Yours has it." |
| `draco_gym` | **Sylvane**, Keeper of the Sky-Shrine | Not a Warden but keeps their shrine at Skyrend and their records — the three centuries of star-counts. Knows the Wardens' plan (§4.6) and Wynn's part in it; the Ascend Badge is her judgement that the player is a holder worth handing the rest to. The gate to Act III. | "Every recollection up here is older than my shrine. You made them answer anyway." |

### 4.5 The three Wardens — `veil`, `aurelia`, `kirei`

4.5.1 The **Wardens of the Sky-Shrine** are the oldest institution in Ewa and the smallest: an order of record-keepers who have counted the stars from Skyrend for three centuries and who invented the register notation the Provision borrowed for its ledger. They hold no civil power and have wanted none. They knew what Marle had found within a year of his finding it. Their answer was the Attestor project — Wynn is their agent, and has been since she left the grey coat.

4.5.2 They sit as the league's Elite Three in Solenne (`zoneId: 'solenne'`, spine §3.3) because the league is theirs: the eight badges were always the Wardens' way of finding holders. Their `pre` lines say so.

| id | Name | Type | What they hold | `pre[0]` |
|---|---|---|---|---|
| `veil` | **Warden Veil** | Ghost | The record of what has been drawn — every settled place, every Seam closed. Veil is the Wardens' reader of the ledger and has read all 1,400 pages. | "I have read every line the Provision ever wrote. Show me one it can't." |
| `aurelia` | **Warden Aurelia** | Fairy | The record of what is still whole — the intact zones, the unspent Seams, the hospital's real stock. She funds Teo's bed after Sable's turn (§4.3.2). | "I keep the count of what's left. You've been adding to it. Let's see how much." |
| `kirei` | **Warden Kirei** | Psychic | The record of the records: the Attestors themselves, all twelve, and what each has witnessed. Kirei is the one who tells the player, before the Champion, exactly how many species they hold and what that number means. | "Twelve Attestors. Yours is the loudest. Let's find out if it's the truest." |

4.5.3 Teams are legacy verbatim (`bankaiser`, `voltaura`, `galaxion` in their sixth slots are NPC-owned and do not count toward coverage — roster-coverage §12.4 note 3).

### 4.6 Champion Zeon — `zeon`

4.6.1 **Zeon** is the Wardens' Champion and the holder of the one recollection the Wardens have kept out of every book: the world's **name**. Not "Ewa" — that is what people call it. The name the Held holds it by, which Zeon carries the way a Champion carries a title: by having beaten everyone who came for it. Zeon is fifty, unshowy, and has been Champion for nineteen years because nobody has out-held them.

4.6.2 In Act III the Comptroller's Permanence Provision (§4.7.1) needs the name, and the name is in Zeon. The Spire withdrawal (§5, `spire_withdrawal`) half-succeeds — Varn draws on Solenne's *common* memory of the name and the capital goes `thinning` — and fails to finish because the name proper is held in a second place. The player beats Zeon not to take the name but to be told it: beat `name_restored` (§5) is the only place the name is spoken, and the Attestor records it as the 131st entry, which the Dex UI shows as an unnumbered final card (`20-client.md` may render it; nothing else reads it). That is the beat `name_restored`.

4.6.3 `championWin` sets `champion:zeon:beaten` (30-server-netcode §30.4.4). `LeagueTrainer.setsFlags` for `zeon` also lists `champion:zeon:beaten` so beat `name_restored` can `need` it by data, not by special case (§5.1.3, §11).

### 4.7 The Provision's faces

Trainer ids for battle beats and NPC ids per zone. Teams run Steel and Dark by doctrine (§2.9.2) with Poison and Ghost where the band demands.

4.7.1 **Comptroller Odile Varn** — `umbral_observatory.comptroller_varn`, `solenne.comptroller_varn`, `celestial_spire.comptroller_varn`; trainer `varn_spire`. Fifty-eight. Marle's student's student; twenty years in the great lens's room. Keeps a name-card and reads it in front of the player (§3.4.4). Her case (§3.6) is the best-argued position in the game and she never raises her voice. Her final act, the **Permanence Provision**, is her own: the thinning is natural and accelerating, the Grey Year will come again and the Provision will have to spend more each time, and the only purchase that ends the cycle is to spend the world's *name* — the Held's largest single recollection — and direct it to "Let it have been that this world does not need to be remembered to be." A world that is real without a holder. She believes this is mercy. Wynn's answer, at the Rift, is that a world real without a holder already exists and they are standing at its edge. Team (`varn_spire`, celestial_spire band 50–55): archonosis:53, velvetomb:53, necrogeist:54, glaciarm:52, rivetalon:54, aonred:55.

4.7.2 **Bursar Elias Quill** — `umbral_observatory.bursar_quill`. Directs at the lens; wrote the Yr 38 line. Believes the ledger is a confession and keeps it perfectly for that reason. No battle. In Act III (`react` on `spire_confronted`) he is the one who agrees to the ATTESTED column.

4.7.3 **Assessor Tamsin Reeve** — `ash_route.assessor_reeve`, `umbral_observatory.assessor_reeve`; trainer `reeve_observatory`. The Provision's public face in Act I: polite, competent, hands the player a leaflet at the first harvest. Escorts the player out of the Observatory in Act II, by battle, without malice ("You've read it. That's more than most. Now you leave, because that's the procedure."). Team (`reeve_observatory`, band 42–48): chrysotox:45, fedoraith:45, toxshade:46, glaciarm:44, aonred:47.

4.7.4 **Assessor Bram Hollis** — `forgewall.assessor_hollis`; trainer `hollis_siege`. Serves the Forgewall requisition and enforces it in the courtyard when Rell refuses. Believes every word of §3.6 and says point 4 to Rell's face. Team (`hollis_siege`, forgewall Act II, band ~38–41): trenchtusk:40, ironcarab:39, gemknight:39, rivetalon:41, toxshade:40.

4.7.5 Unnamed Provisioners: `<zoneId>.provisioner_a/_b` in solenne, cinderhold, saltmourn, stormrook, marrowdig — clerks and Assessors with two lines each (§6), all courteous, all grateful to be useful.

---
## 5. ACT STRUCTURE WITH BEATS

### 5.1 How to read this section

5.1.1 Table 5.2 is the `STORY` array. One row = one `StoryBeat` (spine §3.5). Column mapping: `id → id`, `act → act`, `zoneId → zoneId`, `needs → need[]` (space-separated; `badge:<id>` sugar as the spine allows; `-` = `[]`), `sets → set[]`, `speaker → speaker` (an `NpcDef.id` or `LeagueTrainer.id`), `battle → battle` (`{ trainerId }`; the team after the dash is the `TrainerDef.team` content must author; `-` = `null`), `harvest → harvest` (`zone→state`; `-` = `null`), `starter → starter`. `lines` and `after` are in the blocks of §5.3, keyed by id, one line per bullet; `-` under *after* = `[]`.

5.1.2 Ordering within the array is the table order. `nextStoryBeat` semantics (30-server-netcode owns the runtime) fire the first beat in a zone whose `need` is satisfied and which is not yet done; the table is authored so that at most one beat is eligible per zone at any time (checked by hand in §5.4).

5.1.3 Flags: every `set` flag and every non-badge `need` flag is in §11. Quest flags (`harbour_witness`, `act3_started`, `grove_restored`, `mythical_night`, `mythical_morning`) are set by `QuestDef.rewards.flag` (roster-coverage §12.1) and are only ever *needed* here. `champion:zeon:beaten` is set by the server on `championWin` (30-server-netcode §30.4.4) and is also listed in `zeon.setsFlags` so the spine's validate rule ("every `need` flag appears in some `set`, quest flag or `setsFlags`") holds by data, not by special case.

5.1.4 Counts: **33 beats** — Act I 9, Act II 14, Act III 10. Exactly one `starter`. Harvest transitions: `ash_route → harvested` (Act I, permanent), `mire_route → harvested` (Act II) and `mire_route → intact` (Act III), `solenne → thinning` (Act III) and `solenne → intact` (Act III). The spine's requirement (one zone gets both `harvested` and `intact` from beats) is met by `mire_route`; `solenne` is a second, thinning-only pair. Battles: 8 (`sable_mire`, `sable_tide`, `sable_deepcut`, `sable_observatory`, `reeve_observatory`, `hollis_siege`, `varn_spire`, plus none in Act I's harvest beat by design — the player has no standing to fight a lawful Assessor and the story wants that felt).

### 5.2 The beats

| # | id | act | zoneId | needs | sets | speaker | battle | harvest | starter |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `first_witness` | 1 | mirevale | - | `met_wynn` | `mirevale.wynn` | - | - | **true** |
| 2 | `mire_rival` | 1 | mire_route | `met_wynn` | `met_sable` | `mire_route.sable` | `sable_mire` — coalette:5, glimp:4 | - | false |
| 3 | `grove_stone` | 1 | mirevale | `met_sable` | `saw_thinning` | `verdant_gym` | - | - | false |
| 4 | `bloom_after` | 1 | mirevale | `badge:bloom` | `bloom_spoken` | `verdant_gym` | - | - | false |
| 5 | `first_harvest` | 1 | ash_route | `badge:bloom` | `saw_assessment` | `ash_route.assessor_reeve` | - | `ash_route→harvested` | false |
| 6 | `forge_gratitude` | 1 | cinderhold | `saw_assessment` | `heard_grey_year` | `blaze_gym` | - | - | false |
| 7 | `sable_livery` | 1 | tide_route | `badge:ember` | `sable_livery` | `tide_route.sable` | `sable_tide` — coalette:15, glimp:14, mudbub:13 | - | false |
| 8 | `drowned_harbour` | 1 | saltmourn | `badge:ember` | `saw_old_harbour` | `saltmourn.harbourmaster` | - | - | false |
| 9 | `current_after` | 1 | saltmourn | `badge:current saw_old_harbour` | `act1_done` | `tidal_gym` | - | - | false |
| 10 | `grid_numbers` | 2 | stormrook | `act1_done` | `saw_grid_draw` | `volt_gym` | - | - | false |
| 11 | `the_lineman` | 2 | galvan_route | `saw_grid_draw` | `saw_forgetting` | `galvan_route.lineman` | - | - | false |
| 12 | `sable_refuses` | 2 | deepcut_route | `badge:circuit` | `sable_refused` | `deepcut_route.sable` | `sable_deepcut` — caldermole:25, glimmereen:23, bogmaw:24 | - | false |
| 13 | `the_seam` | 2 | marrowdig | `badge:circuit` | `saw_seam` | `stone_gym` | - | - | false |
| 14 | `fault_after` | 2 | marrowdig | `badge:fault saw_seam` | `read_lease` | `stone_gym` | - | - | false |
| 15 | `grove_gone` | 2 | vesperveil | `badge:fault` | `grove_harvested` | `vesperveil.medium` | - | `mire_route→harvested` | false |
| 16 | `wraith_after` | 2 | vesperveil | `badge:wraith grove_harvested` | `observatory_open` | `phantom_gym` | - | - | false |
| 17 | `the_holding` | 2 | umbral_observatory | `observatory_open` | `saw_holding` | `umbral_observatory.bursar_quill` | - | - | false |
| 18 | `the_ledger` | 2 | umbral_observatory | `saw_holding` | `ledger_read` | `umbral_observatory.comptroller_varn` | - | - | false |
| 19 | `sables_turn` | 2 | umbral_observatory | `ledger_read` | `sable_turned` | `umbral_observatory.sable` | `sable_observatory` — caldermole:45, glimmereen:44, bogmaw:44, murmink:43, ignispectre:45 | - | false |
| 20 | `escorted_out` | 2 | umbral_observatory | `sable_turned` | `escorted_out` | `umbral_observatory.assessor_reeve` | `reeve_observatory` — chrysotox:45, fedoraith:45, toxshade:46, glaciarm:44, aonred:47 | - | false |
| 21 | `the_requisition` | 2 | forgewall | `escorted_out` | `saw_requisition` | `iron_gym` | - | - | false |
| 22 | `siege_of_forgewall` | 2 | forgewall | `saw_requisition` | `siege_held` | `forgewall.assessor_hollis` | `hollis_siege` — trenchtusk:40, ironcarab:39, gemknight:39, rivetalon:41, toxshade:40 | - | false |
| 23 | `sable_beside` | 2 | siege_route | `siege_held badge:anvil` | `act2_done` | `siege_route.sable` | - | - | false |
| 24 | `star_counts` | 3 | skyrend | `act2_done` | `saw_star_counts` | `draco_gym` | - | - | false |
| 25 | `shrine_of_first_night` | 3 | eclipse_shrine | `badge:ascend` | `shrine_seen` | `eclipse_shrine.shrinekeeper` | - | - | false |
| 26 | `permanence_notice` | 3 | solenne | `badge:ascend` | `act3_started` | `solenne.comptroller_varn` | - | - | false |
| 27 | `restore_the_grove` | 3 | mire_route | `act3_started ledger_read` | `grove_reremembered` | `mire_route.wynn` | - | `mire_route→intact` | false |
| 28 | `spire_withdrawal` | 3 | celestial_spire | `act3_started` | `spire_confronted` | `celestial_spire.comptroller_varn` | `varn_spire` — archonosis:53, velvetomb:53, necrogeist:54, glaciarm:52, rivetalon:54, aonred:55 | `solenne→thinning` | false |
| 29 | `capital_thinning` | 3 | solenne | `spire_confronted` | `saw_capital_thinning` | `solenne.clerk_of_hall` | - | - | false |
| 30 | `wardens_charge` | 3 | solenne | `saw_capital_thinning` | `wardens_met` | `kirei` | - | - | false |
| 31 | `name_restored` | 3 | solenne | `champion:zeon:beaten wardens_met` | `name_held` | `zeon` | - | `solenne→intact` | false |
| 32 | `the_new_column` | 3 | solenne | `name_held` | `new_column` | `solenne.bursar_quill` | - | - | false |
| 33 | `rift_edge` | 3 | the_rift | `name_held` | `rift_seen` | `the_rift.wynn` | - | - | false |

### 5.3 Lines and after, by id

Every line is a separate `lines[]` / `after[]` entry. Parenthetical lines are stage directions rendered in the dialogue box as italics (20-client.md owns the styling; the convention is legacy's and is kept). No line exceeds 140 characters.

**1 · `first_witness`** — mirevale, the Attestor bench behind Wynn's house. The starter choice UI opens after line 4 and the beat completes on the choice.
- lines:
  - "You keep asking why the noon light's grey. Nobody else in this town asks. So: here."
  - "This is an Attestor. It records a recollection — an Ewamon — so that it's held in two places. Mine, and the world's."
  - "The world is forgetting itself. Slowly, I think. I want to know how slowly, and I want a record that doesn't depend on me."
  - "Three partners. I witnessed each one at the Seam on Mire Route and I've held them since. Pick one. The first entry in your Attestor will be mine, and then it will be yours."
  - "Walk the eight badges. Record what you meet. And if anyone in a grey coat asks to see that device — show them. We are not hiding anything either."
- after: -

**2 · `mire_rival`** — mire_route, the hedgerow gap, thirty steps in.
- lines:
  - "So Wynn gave you one too. Figures. Mine's from the Office — Cinderhold station. It's a job. It's a good job."
  - "Junior Assessor. I catch what turns up at the Seams and they pay by the head. Pays better than the forge did."
  - "You've got that look. Like you've got a question. Ask it after."
  - "Race you to the first badge. Don't sulk when I win."
- after:
  - "Right. Well. That's a thing that happened."
  - "Cinderhold, after. The Office has a station there. Come and see it's not what Wynn's face says it is."

**3 · `grove_stone`** — mirevale, the Grove-Stone at the town's north edge. Mira has a brass light-meter on a tripod.
- lines:
  - "Mira Thornwell. Grove-Keeper. You're the one with Wynn's device — good. Look at this."
  - "Noon reading, this day, twenty years ago: the stone says what it should be. Noon reading today. Two-thirds."
  - "Not the trees. The trees are fine. The light through them is thinner, as if there were less of it to remember."
  - "I don't know what's doing it. I know it's real. Come to the gym when you're ready and I'll find out if you're real too."
- after: -

**4 · `bloom_after`** — mirevale, the gym door, after the badge.
- lines:
  - "The Bloom Badge. Roots that held. Take it east."
  - "The Office keeps a station at Cinderhold. They're good people; they fed this town in the Grey Year. Ask them about the light. They have more instruments than I do."
  - "And keep that device open. Whatever's thinning the noon, I'd like it on a record somewhere that isn't my tripod."
- after: -

**5 · `first_harvest`** — ash_route, the cinder-hedge at the route's midpoint. A Provision crew of four is packing a field lens into a case; a stretch of hedge behind them has gone flat. The zone's `harvestState` flips to `harvested` on line 3 so the player watches it happen.
- lines:
  - "Afternoon. Assessor Reeve, Office of Provision. You're the twelfth Attestor — Wynn's. She said you'd come this way."
  - "We've just closed this Seam. Cinderhold's granary was two hundred sacks short for winter; it isn't now. Everything's in the ledger."
  - "(The hedge behind her loses its bark, then its leaves, then its shadow. It stands there, the colour of a hedge.)"
  - "That's a settled Seam. It'll grow back in a manner of speaking. Nobody's hurt. Here — the leaflet explains it better than I do."
  - "Record what you like. We do."
- after: -

**6 · `forge_gratitude`** — cinderhold, in front of the Grey Year memorial by the forge.
- lines:
  - "You saw an assessment on the road. I can tell — everyone gets that face the first time."
  - "Read the names. Four thousand one hundred. My grandmother's is the third column. The Office fed the rest."
  - "This forge was my father's. When it burned the Office provisioned it back, and I've had it since. I don't ask how. I say thank you."
  - "You want to fight about the light, come to the gym. You want to fight about the Office, go and read the ledger first. It's public."
- after: -

**7 · `sable_livery`** — tide_route, the salt-marsh boardwalk. Sable is in the grey coat with a brass token.
- lines:
  - "Don't. I know. It's a coat."
  - "Teo's in the Provision Hospital in Solenne. Two years. The treatment's provisioned, monthly. The bed goes to staff families first. So I'm staff."
  - "A wild thing at a Seam is the world talking to nobody. I catch it, it feeds a town. Tell me which part of that is wrong."
  - "Wynn's device or the Office's lens. Let's see which one you've been paying attention to."
- after:
  - "Fine. You're better. That's not the same as right."
  - "Saltmourn's harbour was provisioned. Ask the Captain how the town ate before it. Ask him."

**8 · `drowned_harbour`** — saltmourn, the harbourmaster's hut at the end of the quay. Maren has an old chart unrolled.
- lines:
  - "Maren. Harbourmaster, and gym, when I'm not being harbourmaster. Wynn wrote. Sit."
  - "My grandfather's chart. Same coast. No harbour. A mudflat and a tide-race. Every soul in this town will tell you the chart's wrong, and I've told them so myself."
  - "Go down to the sunk quay at night. There's a recollection there — a wraithtide. Water and ghost. It's the only thing that remembers the harbour wasn't here."
  - "Witness it for me. Put it in your device. I want the mudflat held somewhere I can point at."
- after: -

**9 · `current_after`** — saltmourn, the gym, after the badge.
- lines:
  - "The Current Badge. You rode it."
  - "Stormrook next. Zia Volt keeps the grid, and the Office buys more of her power than the rest of Ewa together. She'll have numbers. She always has numbers."
  - "And when you're back this way, tell the wraithtide the harbour's sorry. I can't. I'm the harbour."
- after: -

**10 · `grid_numbers`** — stormrook, the grid-house control room. Zia has a ledger of her own open.
- lines:
  - "Zia. Don't touch that. Wynn said you'd want the draw figures, so — draw figures."
  - "Third pylon line, provisioned year twenty-seven, runs east over Galvan and terminates at the Umbral Observatory. Forty per cent of my night output."
  - "Forty. For a telescope with a mirror ground flat. I've asked what it powers. The answer is 'assay'. I sell power; I stopped asking."
  - "Cross the span and look at the pylons. Then come back and beat me and we'll both stop pretending it's a telescope."
- after: -

**11 · `the_lineman`** — galvan_route, the foot of the third pylon. An old lineman in Stormrook orange is oiling a junction he cannot name.
- lines:
  - "Afternoon. You're Wynn's. She used to come up here as a girl, before the — before she wore the grey."
  - "I do the, the. This. Every third day. Thirty-one years. My hands know it."
  - "I had a word for it. It's on the tip of my — it was there this morning."
  - "(He looks at the pylon for a long moment, then goes back to oiling it.)"
  - "Tell Wynn the — tell her the thing's fine. She'll know which thing."
- after: -

**12 · `sable_refuses`** — deepcut_route, the cutting's mouth.
- lines:
  - "No."
  - "Whatever you were going to say about the pylons. No. I've got a quota and a brother."
  - "Fight me or move."
- after:
  - "…You're still better. Fine."
  - "Marrowdig. Petra's people. The Office recovered sixty-one of them from under a mountain. Sixty-one. Go and tell *them* about the pylons."

**13 · `the_seam`** — marrowdig, the pithead above the Deep Cut. Petra has a lease document in a tin.
- lines:
  - "Petra Stonewright. You'll want the pit. Everyone with a device wants the pit."
  - "Year thirty-eight we went past bedrock and hit something that isn't rock. A Seam, the Office calls it. Then the roof came in on sixty-one of my people."
  - "The Office got them out. Every one. Then it leased the Seam. Then my cutters started forgetting how to cut."
  - "Both of those things are true and I've kept them in separate pockets for three years. Beat me at the gym and I'll put them in the same one."
- after: -

**14 · `fault_after`** — marrowdig, the gym, after the badge. Petra hands over the lease.
- lines:
  - "The Fault Badge. Now hold out your hand."
  - "The lease. Bursar Quill's signature, year thirty-eight, fourteenth of Fall. And under it — that. Those marks. The Office's shorthand."
  - "Your device writes in the same marks. I've seen it. Read them to me."
  - "(The Attestor renders the line: DRAWN AGAINST mire_route · seedrift ×22 · mossling ×31 · bloomsprite ×4 · smellduck ×19 · resilian ×9.)"
  - "…That's your road. That's the road you grew up on. They paid for my sixty-one with your hedgerow. Go east. Nyx Hollow hears them read that book every night."
- after: -

**15 · `grove_gone`** — vesperveil, Nyx Hollow's parlour, night. Nyx has pages of transcribed notation. The player's home route flips to `harvested` as she reads.
- lines:
  - "Sit down before I say it. Sit."
  - "I hear the Observatory. A mile east. Every night a Bursar reads the book aloud, in the form — 'let it have been that' — and I write down what I hear. I thought I was ill."
  - "Last night's line. Mire Route. Second draw. Tenure — they said 'tenure low, Attestor-held, proceed regardless'."
  - "(Somewhere west, a hedgerow that a child walked to school through becomes the colour of a hedgerow.)"
  - "I'm sorry. It's done. It was done at about four in the morning. Wynn thought they wouldn't touch a road an Attestor-holder was from. She was wrong. Tell her I said so gently."
- after: -

**16 · `wraith_after`** — vesperveil, the gym, after the badge.
- lines:
  - "The Wraith Badge. You kept your head in a haunted field."
  - "The cliff road east goes to the Observatory. The Office keeps the gate open — they'll let you in. They'll let anyone in. That's the frightening part."
  - "Read their book. You're the only one outside that building who can."
- after: -

**17 · `the_holding`** — umbral_observatory, the entry hall. A ring of orbs on a wall, floor to ceiling. Bursar Quill, thin, ink on his cuffs.
- lines:
  - "The twelfth Attestor. The Comptroller asked that you be let in when you came. Elias Quill. Bursar. I keep the book."
  - "This is the holding. Stock, assayed and waiting. Every orb has a line in the ledger already written — I write the draw before the purchase, so I can't forget to."
  - "Don't touch the wall. Not because it's dangerous. Because they're not yours and the charter is very clear about consent."
  - "She's upstairs, under the lens. Go up. Read what you like. That's what the book is for."
- after: -

**18 · `the_ledger`** — umbral_observatory, the lens room. The great mirror, ground flat, aimed at nothing. The working ledger open on a stand. Comptroller Varn, grey coat, white collar, a small card in her hand.
- lines:
  - "Odile Varn. Comptroller. Give me a moment — (she reads the card) — Odile. Varn. Yes. Twenty years under this lens; the name goes first and comes back with paper."
  - "You can read the draw column. Good. Then read it. Every purchase for forty-one years, every Seam it cost. Nothing is hidden because nothing is wrong."
  - "Nobody dies. A recollection unsaid never was; there is nothing to grieve. And what we buy is real, retroactively and forever. The harbour will never fail."
  - "The alternative is the Grey Year. Four thousand one hundred names, and I know how many more there would have been because I have the roll."
  - "We have never touched a legendary — a singular memory buys nothing. Never a trained creature without consent. Never a child's partner. Read the charter."
  - "Your road was on the rate card. I'm sorry it was yours. It fed sixty-one miners' families for a winter. Show me the column where that was wrong."
- after: -

**19 · `sables_turn`** — umbral_observatory, the lens room. Sable has been standing by the door in the grey coat through the whole of beat 18 and has read the Yr 38 line over the player's shoulder.
- lines:
  - "Bloomsprite times four. Mire Route. The week after I beat you — after you beat me."
  - "I caught those. Three thousand six hundred, by the head. I bought Teo's month with them."
  - "I'm not going to say anything clever. I'm going to fight you because it's the only thing in this room I know how to do."
- after:
  - "(Sable takes the brass token off and lays it on the open ledger, on the Yr 38 line.)"
  - "I read it. That's all. I read it."
  - "…Wynn's people can pay for a bed. She told me at Mirevale and I laughed at her. Tell her I've stopped laughing."

**20 · `escorted_out`** — umbral_observatory, the stair. Assessor Reeve, polite as at the hedge.
- lines:
  - "You've read it. That's more than most manage. Now you leave, because that's the procedure, and I'm the procedure."
  - "Nothing personal. It never is. That's rather the point of an office."
- after:
  - "…Well. The procedure says I escort you out. It doesn't say I have to win."
  - "The Comptroller has signed a requisition on Forgewall's bastion. Thirty days' notice, served. Marshal Rell has refused it. That's not a thing that happens. Go and see what it looks like."

**21 · `the_requisition`** — forgewall, the bastion gate. Rell has the requisition notice nailed to the gate.
- lines:
  - "Rell. You'll have come from the cliff. Read that."
  - "Requisition of the bastion Seam for drawing, Comptroller's hand, thirty days. Legal. Correct. Served with a bow."
  - "My answer's also legal. I stand in my own gate and anyone who wants the Seam under it comes through me, in the open, with the town watching."
  - "The Assessor arrives at noon with a team. Stand the gate with me. Not for the badge. For the record — so someone with a device saw a town say no."
- after: -

**22 · `siege_of_forgewall`** — forgewall, the courtyard, noon. Assessor Hollis with four Provisioners behind him. The town on the walls.
- lines:
  - "Marshal. Attestor. Bram Hollis, Office of Provision. The notice is valid and the thirty days are up."
  - "The Grey Year memorial in this town has ninety names on it. This Seam would keep the next one at ninety. That is the whole of my argument and it is a good one."
  - "The Marshal's declined. So — the old way. Whoever's standing at the end holds the gate."
- after:
  - "(Sable steps out of the crowd on the wall, no coat, and stands at the player's shoulder.)"
  - "…Right. That's the gate held, in the open, with the town watching. It'll go to the Comptroller as such."
  - "For the record, Attestor — I'd have preferred to lose to the Marshal. It's nothing against you."

**23 · `sable_beside`** — siege_route, the road up.
- lines:
  - "Don't make it a thing."
  - "Skyrend. Sylvane keeps the Wardens' shrine. Wynn says they've been waiting forty years for someone with a device to get this far. So get this far."
- after: -

**24 · `star_counts`** — skyrend, the Sky-Shrine records room. Three centuries of star-charts pinned floor to ceiling.
- lines:
  - "Sylvane. Keeper — of the shrine, not a Warden; they sit in Solenne. These are theirs. Three hundred years of counting the sky."
  - "Fewer stars in every chart. Slow, then faster. The Office says: natural. The Wardens say: natural, *and* forty-one years of drawing on the thing the stars are held in."
  - "Both true. The Wardens' answer wasn't a court — there isn't one that outranks a granary. It was the Attestors. Wynn is theirs. So, now, are you."
  - "The Ascend Badge is my judgement that you're a holder worth handing the rest to. Come and be judged."
- after: -

**25 · `shrine_of_first_night`** — eclipse_shrine, the altar-stone under the open sky, night.
- lines:
  - "Shrinekeeper. This is the oldest shrine the Wardens have. Older than counting."
  - "Here they first recorded the first night — the recollection of the first dark there ever was to remember anything against. They called it Noxmyth."
  - "It isn't here. It hasn't been held by anyone in three centuries. But when a holder has witnessed enough, it comes to be counted. That's the shrine's only rule."
  - "Keep witnessing. Come back when you have a hundred."
- after: -

**26 · `permanence_notice`** — solenne, the Provision Hall, the public lectern. Comptroller Varn is reading a notice to the hall.
- lines:
  - "— and so the Office gives thirty days' notice, in the charter's form, of the Permanence Provision."
  - "The thinning is natural. It is accelerating. The Grey Year will come again and each time we will spend more to answer it. That cycle ends only if this world no longer needs to be remembered to be."
  - "We will draw, once, on the largest recollection the substrate holds: the name it holds this world by. And we will direct: let it have been that Ewa does not need a holder."
  - "(She reads her card.) Nothing dies. Everything bought is real. I have never asked you to trust me. I have asked you to read. The ledger is here. Thirty days."
  - "Attestor. I know you're there. You have thirty days too. Use them for something better than an argument."
- after: -

**27 · `restore_the_grove`** — mire_route, the harvested hedgerow. Wynn, with her own Attestor and the player's open side by side. The zone flips to `intact` on line 4.
- lines:
  - "They use a form. 'Let it have been that.' It directs the world to remember something in the gap. I'm going to use the same form and direct it to remember what was there."
  - "It only works if the thing's held somewhere. You've witnessed the seedrift, the mossling, the bloomsprite — from this road and others. Your device holds them. Read them out with me."
  - "Let it have been that this road had a hedgerow, and light through it, and these in it — "
  - "(Bark. Leaves. A shadow. The hedge is a hedge.)"
  - "…That's the first settled Seam in forty-one years to come back. Write down the time. Then go to the Spire. She's early."
- after: -

**28 · `spire_withdrawal`** — celestial_spire, the top step, dawn. Varn alone with a field lens the size of a door. Solenne's `harvestState` goes to `thinning` on the after-block's first line.
- lines:
  - "Twenty-two days. You did the hedgerow. I read the entry — Quill wrote it up in the form; he insisted."
  - "It doesn't change the arithmetic. One road back does not stop the Grey Year coming. This does."
  - "I would rather you didn't stand there. I'd rather nobody stood there. Stand there anyway, if you must; I've never once asked anyone to leave a room they'd read their way into."
- after:
  - "(The lens turns. Below, in Solenne, a thousand people reach for the name of their city and find the shape of it and not the word.)"
  - "…It's held. The name. Not the common one — the one under it. It's held in a second place and the substrate won't let it go."
  - "Who. Who has it. (She reads her card, and her hand is not steady.) Odile. Varn. Who has the name."

**29 · `capital_thinning`** — solenne, the Hall steps. The Clerk of the Hall, holding the public ledger and unable to read its cover.
- lines:
  - "Attestor — Attestor. The city. Everyone's saying 'the, the'. I can't — this is the ledger of the Office of Provision of —"
  - "I've lived here fifty years."
  - "The Wardens are in the league hall. Warden Kirei says to tell you it's held, and to tell you who by, and that you have to earn being told."
- after: -

**30 · `wardens_charge`** — solenne, the league hall's antechamber. Kirei, with twelve Attestor records laid out.
- lines:
  - "Kirei. I keep the count of the counts. Twelve devices; yours is the loudest by some way."
  - "The name is held in a person. It has been for nineteen years. The person is the Champion, and the Champion tells the name to whoever out-holds them. That's the whole of the league and always was."
  - "She can't draw on what's held in two places. Make it three. Go through Veil, Aurelia, me, and then Zeon — and be told."
- after: -

**31 · `name_restored`** — solenne, the Champion's hall, after the title. Solenne's `harvestState` returns to `intact` on line 3.
- lines:
  - "Nineteen years. Every one of them I've waited for someone to walk in here who'd been to enough Seams to deserve this and hadn't spent a single one of them."
  - "Lean in. It's not a secret; it's just not for shouting."
  - "(Zeon says it. The Attestor hears it. Below, a city remembers its own name all at once, and the noise of that comes up the stairs.)"
  - "There. Held in three places — the world, me, and a record that doesn't depend on either of us. She can't draw on that. Nobody can."
  - "Now go and tell the Comptroller. She'll want it in the book."
- after: -

**32 · `the_new_column`** — solenne, the Provision Hall, the lectern. Quill with the working ledger; Varn beside him, standing very straight.
- lines:
  - "Elias Quill. Bursar. I've added a column. ATTESTED — whether what we draw on is held elsewhere first, and by whom."
  - "It's not a ban. The charter's a granary charter; it doesn't know how to ban. It's a cost that appears on paper. Costs that appear on paper get argued about. That's all I could do and I've done it."
  - "(Varn:) The thinning is still natural and the Grey Year will still come. I was not wrong about that. I was wrong about what the name was for."
  - "(Varn:) Odile. Varn. …I didn't need the card for that one. Good."
- after: -

**33 · `rift_edge`** — the_rift, the edge. Wynn and Sable, and the black water. `voidraxis` waits at the far edge behind its own gate (§7).
- lines:
  - "This is what she was buying. A world that's real without anyone holding it. Look at it."
  - "Nothing to remember and nothing remembering. Not evil. Just — the floor. What's under the Held when the Held runs out."
  - "(Sable:) There's something down there. It was here before there was a first morning to be here in. Your device can't file it under anything."
  - "She wasn't a monster. She was a clerk who found a way to feed people and never found where to stop. Neither did I, for twelve years. Write that down too."
  - "Go home when you're done here. Mira wants a noon reading with your name on it."
- after: -

### 5.4 Eligibility check, by zone

For each zone, the beats in `need`/`set` order, confirming at most one is eligible at a time: mirevale `1 → 3 → 4` (3 needs `met_sable` set on mire_route; 4 needs the badge, which cannot precede 3 because the gym's `pre` conversation is gated by the league system, not by flags — content sets `verdant_gym` interaction to require `saw_thinning`, see §6.1); mire_route `2 → 27` (27 needs Act III flags); ash_route `5`; cinderhold `6`; tide_route `7`; saltmourn `8 → 9` (9 needs 8's flag); stormrook `10`; galvan_route `11`; deepcut_route `12`; marrowdig `13 → 14`; vesperveil `15 → 16`; umbral_observatory `17 → 18 → 19 → 20` (chain); forgewall `21 → 22`; siege_route `23`; skyrend `24`; eclipse_shrine `25`; solenne `26 → 29 → 30 → 31 → 32` (29 needs `spire_confronted` from the Spire; 31 needs the champion flag); celestial_spire `28`; the_rift `33`. Acyclic within every zone; every act has ≥ 1 beat; exactly one `starter`.

### 5.5 Where the quests sit against the beats

| Quest (roster-coverage §12.1) | Unlocks after beat | Feeds beat |
|---|---|---|
| `q01_first_witness` | 1 | 3 (three witnessed before Mira's meter reading lands) |
| `q02_thin_hedgerow` | 2 | 15 (the hedgerow the player learned to catch in is the one drawn) |
| `q03_ember_yard` | 6 | 7 |
| `q04_drowned_harbour` | 8 (`saltmourn.harbourmaster` is the speaker) | 9; its flag `harbour_witness` gates the harbourmaster's `react` in §6.5 |
| `q05_static_at_midnight` | 10 | 11 |
| `q06_the_deep_cut` | 13 | 14 |
| `q07_lens_and_latch` | 16 | 17 |
| `q08_anvil_debt` | 21 | 22 |
| `q09_thin_air` | 24 | 25 |
| `q10_restore_the_grove` | 26 (needs `act3_started`) | its `restoreZone mire_route` objective is satisfied by beat 27's `harvest` completing; its flag `grove_restored` gates §6.2's post-restoration NPC lines |
| `q11_first_night` | 31 (needs `champion:zeon:beaten`) | §7.4 |
| `q12_first_morning` | q11 | §7.4 |

---
## 6. ZONE BIBLE

### 6.0 Conventions

6.0.1 One entry per `ZoneId`, in `ZONE_ORDER`. Fixed columns (`kind`, `biome`, `type`, `gate`) are the spine §3.1 table and are restated only where the entry relies on them. **Harvest** gives the `harvestState` the zone shows in each act; the Act I value is `ZoneDef.harvestState` (the new-game default); any change is a beat's `harvest` field from §5.2, cited by beat number. **Story role** is the three `storyRole` strings verbatim (`null` written as `-`).

6.0.2 **NPC voices**: `id` is `NpcDef.id`; `when`/`until` are flags from §11 (`-` = `null`); two sample `lines` each, with a `react` line where the zone's harvest state or a story flag changes what they say. Quest-giver ids from roster-coverage §12.1 appear here with a `[q]` tag. Beat speakers appear with a `[b#]` tag. Coordinates are not authored in this file; the zone author places them and RC-13 snaps them.

6.0.3 **Lore tablets**: two per zone, `LoreTabletDef` — `id`, `title`, and `text[]` of three lines. Tablets are the only place the game speaks in the Wardens' formal register (§9.3).

6.0.4 **Signature**: the one set-piece the render's `signature` id builds (spine §3.1). Named here so the story and the zone builder agree on what the unique thing in each zone is.

### 6.1 mirevale — Mirevale

- town · grove · Grass · gate `null` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I "Home. Wynn hands over the Attestor; Mira shows the thinning is measurable." · II "Off-screen: its route is drawn while the player is east (beat 15)." · III "Wynn's base for the restoration; Mira's final noon reading."
- **Signature:** `grove_stone` — the Wardens' light-sieve stone at the north edge, with Mira's brass meter beside it. The noon light through the canopy is a real light with a real housing (pillar 4); its intensity is the one environment value the story asserts is "two-thirds".
- **League:** `verdant_gym` (Mira). Content gates the gym interaction on `saw_thinning` so beat 3 precedes the fight (§5.4).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `mirevale.wynn` [b1] | Prof. Wynn | - / `act3_started` | "Two-thirds. Mira's meter doesn't lie; it's brass." · "If a grey coat asks for your device, show them. We aren't hiding either." · react `grove_harvested`: "…Nyx told you gently. Good. She's kinder than I am. I was wrong about them and it cost your road." |
| `mirevale.archivist` [q01] | Hessa Dunmore, town archivist | - / - | "Three witnessed. That's a record, not a hobby. Come back with three and I'll show you what a record is for." · react `grove_restored`: "First settled Seam to come back in forty-one years, and it's ours. I've started a new ledger. Ours has one column." |
| `mirevale.child` | a child | - / - | "When I grow up I'll walk all eight badges and put everything in a device!" · react `grove_harvested`: "The road to school went grey. Mum says it's fine. It's not fine, it's grey." |
| `mirevale.gardener` | the berry-gardener | - / - | "Pick the partner that suits you, not the badge. The badge comes either way." · "Bloomsprite in the hedge by the school, some days. Rarer than it was. My mother saw them every spring." |

- **Lore tablets**
  - `lore_mirevale_grovestone` — *The Grove-Stone*: "The Wardens did not plant this grove for shade. They grew it as a sieve, to break the noon light into something a town could measure." / "Read the stone at noon. It says what the light should be. If the light says less, the stone is not wrong." / "A thing that is measured is a thing that is held twice. Measure it."
  - `lore_mirevale_attestor` — *The Twelfth* (behind Wynn's house): "Eleven devices given; eleven roads walked; the count stands at what the count stands at." / "The twelfth is for whoever keeps asking about the light." / "Register notation, for the reader: species, place, count. Nothing else. The Office uses the same three."

### 6.2 mire_route — Mire Route

- route · grove · Grass · gate `null` · **Harvest:** I intact · II **harvested** (beat 15) · III **intact** (beat 27).
- **Story role:** I "The first Seam; the rival; the hedgerow the player learns to witness in." · II "Drawn. The player's home route rendered flat while they are away." · III "The first settled Seam in forty-one years to be re-remembered, from the player's own record."
- **Signature:** `hedgerow_gap` — a century-old hedgerow with a walked-through gap; the Seam. In `harvested` it is the reference image for `HarvestLevel 2` (10-render's `harvest.spec.ts` should capture here).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `mire_route.sable` [b2] | Sable | `met_wynn` / `saw_assessment` | "It's a job. It's a good job." · "Race you to the first badge." |
| `mire_route.forager` [q02] | Odd Pell, forager | - / - | "Seedrift by day, snapling after dark. The hedge keeps two rosters." · react `grove_harvested`: "I can find the hedge. I can't find the — the — I've picked in it forty years." · react `grove_restored`: "Bark's back. I put my hand on it for an hour. Don't tell anyone." |
| `mire_route.wynn` [b27] | Prof. Wynn | `act3_started` / - | "Read them out with me." · react `grove_reremembered`: "Write down the time. I want the hour in the record." |
| `mire_route.walker` | a route-walker | - / - | "Mossling in the wet ditch, glimp in the dry. Same hedge, two registers." · react `grove_harvested`: "Walked this road since I was six. Today I couldn't have told you its name if you'd paid me. Then I could. Then I couldn't." |

- **Lore tablets**
  - `lore_mire_seam` — *The Hedge Nobody Cut*: "Left uncut for a hundred years because the Wardens asked, and nobody remembers being asked." / "Where a thing is left alone long enough, the world remembers it out loud. That is all a Seam is." / "If you find this stone grey, someone drew on this road. If you find it green again, someone held it."
  - `lore_mire_rate` — *Rate Card, Yr 41* (a Provision notice-board, weathered): "Common 120 · Uncommon 300 · Rare 900 · by the head, at Cinderhold station." / "Legendaries: not purchased. Trained stock: by consent only, at double." / "The Office thanks Mire Route for its contribution to the relief of Marrowdig."

### 6.3 cinderhold — Cinderhold

- town · cinder · Fire · gate `bloom` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I "The Provision's face at its best: the station, the memorial, Karn's gratitude." · II "Sable's home; Teo's absence." · III "Karn has read the ledger."
- **Signature:** `grey_year_memorial` — a wall of 4,100 names beside the forge, with a brazier that is a real shadow-casting light. The forge itself is the provisioned one (§4.4): it renders intact and is, in fiction, older than the fire that destroyed it.
- **League:** `blaze_gym` (Karn).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `cinderhold.yardmaster` [q03] | Brann Sorrel, yardmaster | - / - | "Fennorange in the ash-yard, kindler on the road. Deal with both and I'll call you useful." · "The Office station's the clean building. It's always the clean building." |
| `cinderhold.provisioner_a` | Clerk Anwen Rusk | - / - | "Office of Provision, Cinderhold station. Rate card's on the wall; ledger copy's on the desk. Read either." · react `ledger_read`: "You read the working copy. Then you know more than I do; I only see the purchases." |
| `cinderhold.sable_neighbour` | Sable's neighbour | - / - | "Sable's the one in grey now. Their brother's in Solenne. You don't get to judge that from here." · react `sable_turned`: "Sable came home without the coat. Sat on the step an hour. Went back east. Didn't say." |
| `cinderhold.smith` | a smith | - / - | "Karn's forge is the oldest in town. His father worked it. Everybody knows that." · react `act3_started`: "Karn's stopped saying 'oldest in town'. Says 'my forge'. I don't know why that's different. It is." |

- **Lore tablets**
  - `lore_cinderhold_names` — *The Third Column*: "Four thousand one hundred. The Granary Office counted them by district and the count is the only honest thing that year produced." / "Below the names: 'and those who were fed, who are not counted here, because they are alive.'" / "Nobody who reads this wall is asked to be against the Office. The wall is the Office's argument. It is a good one."
  - `lore_cinderhold_forge` — *The Emberlitt Forge*: "Provisioned Yr 19 after the Emberlitt fire. Drawn against Ash Route, first draw." / "The forge has always stood here. The plate that says when it was bought is the only thing in Cinderhold that disagrees." / "Both are true. Hold both."

### 6.4 ash_route — Ash Route

- route · cinder · Fire · gate `bloom` · **Harvest:** I intact → **harvested** (beat 5) · II harvested · III harvested. **Permanent.** Not every settled place comes back; this one does not, and no line promises it.
- **Story role:** I "The first visible harvest — the player watches a Seam settle." · II "A flat road the player crosses twice." · III "Still flat. Sunjaw at the caldera lip after the title (§7)."
- **Signature:** `cinder_hedge` — the drawn hedge at the midpoint, with the Provision's four packing-cases left where the crew stood; a small brass plate reads "Settled Yr 41 · Cinderhold granary · 200 sacks".
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `ash_route.assessor_reeve` [b5] | Assessor Tamsin Reeve | `badge:bloom` / `saw_assessment` | "Everything's in the ledger." · "Record what you like. We do." |
| `ash_route.kindler` (`TrainerDef`, q03 target) | Kindler Ysolde | - | pre: "Flampling by day, wickling by night. I light both. Try me." · post: "Hot enough. Go and see the hedge before the Office packs up — it's a thing to have seen." — team flampling:9, wickling:9, embrock:10 |
| `ash_route.charcoal_burner` | a charcoal-burner | - / - | "Hedge was there this morning with birds in it. Now it's — it's hedge-coloured." · react `heard_grey_year`: "I'm not against them. My daughter eats. I'd just like to have been asked what the hedge was worth." |
| `ash_route.provisioner_b` | Provisioner Cole | `saw_assessment` / - | "Crew's gone back to station. I stay a day in case anyone's upset. Nobody's usually upset. They're usually fed." |

- **Lore tablets**
  - `lore_ash_settled` — *Settled Seam, Yr 41* (the brass plate): "Drawn against Ash Route, second draw: flampling ×18, embrock ×14, coalette ×7, moflame ×2." / "Provisioned: Cinderhold granary, 200 sacks, winter Yr 41." / "Assessor T. Reeve. Witnessed by the twelfth Attestor, who was not asked to consent because consent was not required."
  - `lore_ash_caldera` — *The Lip*: "Something laughed here once, loud enough that the rock remembers it. One laugh. One time." / "A memory that only happened once cannot be spent; it holds nothing else up. The Office knows this and has never come here." / "Wait until you are the kind of holder a singular memory would answer. Then come back."

### 6.5 saltmourn — Saltmourn

- town · salt · Water · gate `ember` · **Harvest:** I intact · II intact · III intact. The *harbour* is a purchase; purchases render intact. The cost was paid on tide_route.
- **Story role:** I "The provisioned harbour and the chart that shows no harbour; the drowned quay." · II "Maren points the player to Stormrook's numbers." · III "The harbourmaster's chart is entered into the Attestor as the only record of the mudflat."
- **Signature:** `sunk_quay` — the old harbour's quay, underwater, visible at low tide as a line of stones in the basin. Every town spawn is `water` (roster-coverage §6.9) and `wraithtide` precipitates over the quay at night: the memory of the harbour nobody holds.
- **League:** `tidal_gym` (Maren). The NPC `saltmourn.harbourmaster` is the same man in his hut; two ids because `NpcDef` and `LeagueTrainer` are different tables.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `saltmourn.harbourmaster` [b8, q04] | Captain Maren | `badge:ember` / - | "Every soul in this town will tell you the chart's wrong." · react `harbour_witness`: "You held it. The wraithtide. Then the mudflat's in your device, and I can stop telling people my grandfather was a liar." |
| `saltmourn.fishwife` | a fish-seller | - / - | "Harbour's been here since my great-grandmother. Everyone knows that." · "Kygra in the basin some mornings. Rarer than it was. Or I'm older than I was." |
| `saltmourn.provisioner_a` | Assessor Wren Tally | - / - | "Office station, Saltmourn. We don't draw here — you don't draw on a purchase. Tide Route, yes. Ask me anything." · react `ledger_read`: "You've read the Yr 6 line then. Tide Route, first draw. It's why the marsh is the colour it is. It's also why there's a town." |
| `saltmourn.diver` | a salvage diver | - / - | "There's a quay down there. Stones, laid. Nobody laid them. I stopped asking." · react `harbour_witness`: "You caught the thing that sits on the stones. Does it — does it know what they are?" |

- **Lore tablets**
  - `lore_saltmourn_chart` — *Grandfather's Chart* (the hut wall): "Same coast. Tide-race, mudflat, a fishing stage on stilts. No harbour." / "The Office provisioned the harbour Yr 6. The chart is from Yr 2. The chart is the only object in Saltmourn that predates the harbour and disagrees with it." / "Hold the chart. Hold the harbour. Notice that you can."
  - `lore_saltmourn_quay` — *The Drowned Harbour* (on the quay stones, legible at low tide): "We fished from this stage and we were poor and we were here." / "Whatever stands above these stones now, someone paid for it, and the payment was not made here." / "Water and ghost. The register for a thing that moved and is gone."

### 6.6 tide_route — Tide Route

- route · salt · Water · gate `ember` · **Harvest:** I thinning · II thinning · III thinning. Drawn Yr 6 for the harbour; the salt-marsh has been dim for thirty-five years and the people who walk it think that is what a salt-marsh looks like.
- **Story role:** I "Sable in the grey coat; the first defence of the Provision in a friend's mouth." · II - · III -
- **Signature:** `salt_boardwalk` — a long boardwalk over the marsh with lamps that are real lights, half of them dark. The surf zone: `water` spawns on the basin side.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `tide_route.sable` [b7] | Sable | `badge:ember` / `sable_refused` | "It's a coat." · "Tell me which part of that is wrong." |
| `tide_route.marsh_warden` | the marsh-warden | - / - | "Marsh has always been this grey. It's a marsh." · react `ledger_read`: "…Yr 6. Thirty-five years I've been telling visitors that. My father would have told them different." |
| `tide_route.surfer` | a surf-hand | - / - | "Glimfin in the shallows, ripshell under the boards. Kygra out past the stage if the day's bright, and it's never bright." |
| `tide_route.lamp_lighter` | the lamp-lighter | - / - | "Half these lamps won't take a flame. Wick's fine. Oil's fine. They just — don't hold it." |

- **Lore tablets**
  - `lore_tide_firstdraw` — *Yr 6* (a Provision plate, older brass): "Drawn against Tide Route, first draw: mudbub ×40, brookrawl ×36, slushpup ×22, glowtent ×11, tidespine ×9." / "Provisioned: a harbour at Saltmourn. Let it have been that there was a harbour." / "Comptroller O. Marle. First provisioning of a *place*. The Office notes the marsh dimmed and considers the exchange sound."
  - `lore_tide_lamps` — *The Half-Dark Boardwalk*: "The lamps were made to hold a flame and half of them cannot. The oil is not at fault." / "A thinning place forgets small things first: how a wick takes fire, how bark feels, the third verse of a song." / "You are walking through a payment. Most people never notice. You have a device that does."

### 6.7 stormrook — Stormrook

- town · storm · Electric · gate `current` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II "Zia's numbers: 40 % of the grid at night to a telescope that cannot see." · III -
- **Signature:** `grid_house` — the switching hall with three live pylon lines leaving it; the third (east, to the Observatory) hums louder at night. Every breaker is an emissive housing with a real light behind it.
- **League:** `volt_gym` (Zia).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `stormrook.linekeeper` [q05] | Linekeeper Dov Marrat | - / - | "Ampmite in the substation, darkone on the span after dark. Both chew insulation. Bring me both." · react `saw_forgetting`: "You met old Tam at the third pylon. He trained me. He can't say 'junction' any more. He can do one blindfolded." |
| `stormrook.provisioner_a` | Bursar's courier Ilse Penn | - / - | "Office courier. I carry the ledger copy west once a month. Heavy book. Nobody reads it." · react `ledger_read`: "You did. That's a first for me. Was it — was it what you thought?" |
| `stormrook.child` | a child | - / - | "The east line hums at night! Zia says it's a telescope. Telescopes don't hum." |
| `stormrook.meter_reader` | a meter-reader | - / - | "Forty per cent, nights. I read the dial. I don't ask what a mirror wants with it." |

- **Lore tablets**
  - `lore_stormrook_thirdline` — *The Third Line, Yr 27*: "Provisioned: a pylon line east to the Umbral Observatory, forty-one pylons." / "Drawn against Galvan Span, first draw. The linemen who raised the pylons were the ones drawn from; the Office notes this was not intended." / "Assessor E. Wynn. Resigned the following spring."
  - `lore_stormrook_dial` — *The Night Dial*: "Power is a memory of motion held in a wire. The Observatory takes forty in every hundred and gives back nothing that can be metered." / "A lens that sees needs no power. A lens ground to un-see needs a great deal." / "Read the dial. Then read the ledger. The two books agree."

### 6.8 galvan_route — Galvan Span

- route · storm · Electric · gate `current` · **Harvest:** I thinning · II thinning · III thinning. The Yr 27 pylon draw.
- **Story role:** I - · II "The lineman who cannot name his trade; the first person the player watches forgetting." · III "Raikitsune at the struck pylon (badge gate); Voltaura in the storm's eye after the title (§7)."
- **Signature:** `struck_pylon` — the pylon the storm hit, its crossarm fused; `raikitsune`'s static (roster-coverage §7) with a night-only glow that is a real light.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `galvan_route.lineman` [b11] | Tam Ossory, lineman | `saw_grid_draw` / - | "I do the, the. This." · react `name_held`: "Junction. It's a junction. I said it this morning and I said it again to make sure. Tell Wynn." |
| `galvan_route.span_walker` | a span-walker | - / - | "Stormchick under the wires by day. Raidori after dark if the storm's up. Don't stand under the third pylon in rain." |
| `galvan_route.provisioner_b` | Assessor Pim Corrow | - / - | "We don't draw here any more. Tenure's low; it'd buy nothing. We drew once and got a pylon line for it." · "Tam? Good man. Trained half the grid. Yes, we know." |

- **Lore tablets**
  - `lore_galvan_struck` — *The Struck Pylon*: "One storm, one strike, one memory of nine tails of blue fire. It has never happened again and it will not." / "The Office assayed it Yr 29 and recorded 'singular; nil tenure; no purchase possible'." / "Come with the Circuit Badge and it will look at you. What it does after is between you and it."
  - `lore_galvan_hands` — *What the Hands Keep*: "A trade is held in two places: the hands and the mouth. The Office drew on the mouth." / "Tam Ossory raised eleven of these pylons and cannot name the part he is oiling. His hands have never once been wrong." / "If you are drawn on, be drawn on like Tam. Keep working."

### 6.9 marrowdig — Marrowdig

- town · marrow · Rock · gate `circuit` · **Harvest:** I thinning · II thinning · III thinning. The Deep Cut Seam has been drawn under the town since Yr 38.
- **Story role:** I - · II "Sixty-one lives owed; cutters forgetting how to cut; the lease that carries the Mire Route line." · III -
- **Signature:** `pithead` — the winding-gear above the Deep Cut with the Provision's brass lease-plate on the frame; the shaft lamp is a real light and the only bright thing in a dim town.
- **League:** `stone_gym` (Petra).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `marrowdig.foreman` [q06] | Foreman Aldous Grell | - / - | "Yahit in the lower cut, thirty species between here and the Hollow if you're counting. I'm counting. Count with me." · "I was one of the sixty-one. I don't say a word against the Office. I also can't remember how to set a prop. Make of that what you like." |
| `marrowdig.cutter` | a cutter | - / - | "Twenty years cutting. Went to show the apprentice a face-cut Tuesday and my hands did it and my mouth couldn't." · react `read_lease`: "You read the plate. Then you know what they paid for us with. Was it worth it? Don't answer. I don't want to know your answer." |
| `marrowdig.provisioner_a` | Assessor Hal Bray | - / - | "The lease is legal and the miners are alive. I'm sorry about the trade. Trades come back. People don't." · react `siege_held`: "Forgewall said no. In the open. I've written it up as such. I don't know what happens to a no." |
| `marrowdig.widow_not` | a miner's wife | - / - | "My husband was under that rock for two days and he came up. Whatever they took for it, I'd have given more." |

- **Lore tablets**
  - `lore_marrowdig_lease` — *Lease of the Deep Cut Seam, Yr 38*: "Granted to the Office of Provision in perpetuity, in consideration of the recovery of sixty-one." / "Drawn against, for the recovery itself: Mire Route, first draw — seedrift ×22, mossling ×31, bloomsprite ×4, smellduck ×19, resilian ×9." / "Bursar E. Quill. The Office notes the Seam under Marrowdig will be drawn on hereafter and the town's tenure will fall. The town agreed. The town was not told what tenure was."
  - `lore_marrowdig_sixtyone` — *The Sixty-One*: "Under this stone for two days. Above it now." / "Nothing here is against the Office. The Office is why there are names on this stone and not on the other one." / "Both stones are true. The Attestor is for people who can hold two stones."

### 6.10 deepcut_route — Deepcut

- route · marrow · Rock · gate `circuit` · **Harvest:** I intact · II intact · III intact. The route beyond the pit is undrawn; the Seam is under the town.
- **Story role:** I - · II "Sable refuses to talk and fights." · III -
- **Signature:** `the_cutting` — a deep straight cutting through banded rock, the strata chamfered and real (pillar 3), with the lit mouth of the Provision's lease-tunnel visible in one wall and barred.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `deepcut_route.sable` [b12] | Sable | `badge:circuit` / `sable_turned` | "No." · "Fight me or move." |
| `deepcut_route.prospector` | a prospector | - / - | "Pebblit in the scree, lithokrysm where the bands go pink. Rimeidol at night, and it watches you back." |
| `deepcut_route.gate_guard` | a Provision gate-guard | - / - | "Lease tunnel. Office staff only. It's not a secret; it's a hazard." · react `ledger_read`: "…You've been to the Observatory. Then you know it's not a hazard. I'll still not open it. I've got a family too." |
| `deepcut_route.pyrecap_keeper` | an old woman with a lantern | - / - | "Pyrecap in the warm cut. My grandson's a cindercap-holder; I keep an eye out for the next stage for him. Certainty's a thing you watch happen." |

- **Lore tablets**
  - `lore_deepcut_strata` — *Banded Rock*: "Each band is a year the ground remembers. Count them and you have a number older than the Office, the Wardens and the town." / "Below the last band the miners found something that is not rock and does not have years." / "Rock is the register of persistence. What is under it persists differently."
  - `lore_deepcut_tunnel` — *Lease Tunnel* (the bar's plate): "Office of Provision. Drawn under lease. Do not enter. Nothing here is hidden from you; it is only kept from you." / "The distinction matters to the Office." / "Consider whether it matters to you."

### 6.11 vesperveil — Vesperveil

- town · vesper · Ghost · gate `fault` · **Harvest:** I intact · II intact · III intact. The Provision does not draw within a mile of its lens ("you do not draw the well you drink from" — Quill).
- **Story role:** I - · II "Nyx hears the ledger read aloud each night; the Mire Route draw lands here as news." · III -
- **Signature:** `medium_parlour` — Nyx Hollow's house at the cliff's edge, every window facing east toward the Observatory a mile off; at night the Observatory's lens-room light is visible from her step as a real point light in the far scene.
- **League:** `phantom_gym` (Nyx). `vesperveil.medium` is Nyx as NPC in her parlour.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `vesperveil.medium` [b15, q07] | Nyx Hollow | `badge:fault` / - | "I thought I was ill." · react `ledger_read`: "You've stood in the room I hear. Is it — is it a room? I've never been sure it was a room." · react `new_column`: "They read a new word last night. 'Attested.' Then they stopped, and argued. I've never heard them argue." |
| `vesperveil.constable` | the constable | - / - | "Cliff road east is Office land. Gate's open. Always is. Most folk don't go because most folk don't want to." |
| `vesperveil.lantern_maker` | a lantern-maker | - / - | "Memory's loose here. Always was. Ghosts are just recollections that decided not to be certain. I make lanterns so they can find the way back to the hedge." |
| `vesperveil.gravetender` | the gravetender | - / - | "Nothing's buried here. There's nothing to bury — this is where things that never were come to be almost." · react `grove_harvested`: "Your road came through last night. Went past the graves like a draught. Didn't stop. Nothing to stop for." |

- **Lore tablets**
  - `lore_vesperveil_loose` — *Where Memory Is Loose*: "Built at the edge of the thinnest Seam in Ewa, on purpose, by people who wanted to hear it." / "A Ghost is the register of absence. Every one you meet here is the world remembering something it is no longer sure of." / "The Office chose the cliff beyond for its lens because the Held is thin here and easy to un-see through. Nyx Hollow hears them do it. She was not consulted."
  - `lore_vesperveil_transcript` — *Night 414* (Nyx's own hand, pinned inside her door): "'Let it have been that.' Every night. I write the form and then the line." / "Tonight the line had a place I know in it. I stopped writing." / "If you can read register notation: the pages are on the table. Take them to someone who can act. I can only hear."

### 6.12 hollow_route — Hollow Road

- route · vesper · Ghost · gate `fault` · **Harvest:** I thinning · II thinning · III thinning. **The Grey Year draw.** Oswin Marle's first drawing, Yr 0, was from these hedgerows; the road has been dim for forty-one years and the Provision's own histories call it "the road that fed Solenne".
- **Story role:** I - · II "The player crosses the first Seam ever spent, on the way to the room where spending is done." · III -
- **Signature:** `marle_hedge` — a hedgerow with a small, well-kept Provision memorial: "Here, Yr 0, the Office first provisioned. 4,100 fed." Fresh flowers, always. The only harvested-looking place in Ewa with a monument that is proud of it.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `hollow_route.pilgrim` | a Grey Year pilgrim | - / - | "I walk here every Fall. My mother was fed from this hedge. I bring flowers. It's the least grey thing I can do for a grey road." |
| `hollow_route.night_walker` | a night-walker | - / - | "Nettlewisp and murkrat after dark; miscarmen if it's late and you're quiet. Malice if you're unlucky. Wraithtide in the black pool — that one's not from here. Nothing in the pool is from here." |
| `hollow_route.provisioner_a` | Assessor Neve Odell | - / - | "This is where it started. Tenure's been nil since — you can't draw twice on a road you've emptied. We keep the flowers up." · react `escorted_out`: "Reeve let you walk. She'd have told you it was procedure. It wasn't. She likes you." |
| `hollow_route.zaptus_watcher` | a child with a notebook | - / - | "Zaptus float here in the day. I count them. Fewer than last year. Or I count worse." |

- **Lore tablets**
  - `lore_hollow_yr0` — *Yr 0* (the Provision memorial): "Granary Clerk O. Marle, working in the disused Observatory, discovered that a recollection brought under the great lens could be directed." / "Drawn against Hollow Road, all hedgerows, over sixty-one nights: nettlewisp ×210, murkrat ×188, zaptus ×95, hexroach ×70, others." / "Provisioned: grain, Solenne, two months. 4,100 fed. Let it have been that there was bread."
  - `lore_hollow_pool` — *The Black Pool*: "Water that is the register of water and holds a ghost of a harbour that was never here." / "Wraithtide appears in every black water in Ewa because the Held has begun filing it under 'lost' rather than under 'Saltmourn'." / "Witness it here and you have witnessed a memory learning to be homeless. Then take it home."

### 6.13 forgewall — Forgewall

- town · forge · Steel · gate `wraith` · **Harvest:** I intact · II intact · III intact. The richest un-drawn Seam in Ewa is under the bastion, and the town said no.
- **Story role:** I - · II "The requisition; the town that refused; the standoff in the courtyard." · III "Bankaiser in the sealed vault under the bastion (badge gate, §7)."
- **Signature:** `bastion_gate` — a courtyard inside a Steel-plated gate, requisition notice nailed to the timber; the forge-lights along the walls are eight real shadow-casting lights, the pillar-4 budget spent in one place on purpose.
- **League:** `iron_gym` (Rell).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `forgewall.quartermaster` [q08] | Quartermaster Sef Anvard | - / - | "Three full heals for the wall-watch and an acier from the road, and I'll count you one of ours." · react `siege_held`: "They came, they said their piece, they lost in the open. That's a debt paid, not a war won. Rell knows the difference." |
| `forgewall.assessor_hollis` [b22] | Assessor Bram Hollis | `saw_requisition` / `siege_held` | "The notice is valid and the thirty days are up." · "That is the whole of my argument and it is a good one." |
| `forgewall.wall_watch` | a wall-watch | - / - | "Ninety names on our memorial. Small town. Every one of them the Office fed the family of. And we still said no. Both things." |
| `forgewall.plater` | an armour-plater | - / - | "Steel's the register of made things. Nothing remembered it; someone forged it. That's why the Office's people carry so much of it — a made thing argues with a memory." |
| `forgewall.child` | a child on the wall | `siege_held` / - | "I saw it! The Marshal and the one with the device and then Sable came out of *our* crowd and the grey ones went home!" |

- **Lore tablets**
  - `lore_forgewall_requisition` — *Requisition, Yr 41* (the notice): "The Office of Provision, under charter clause nine, requisitions the Seam beneath the bastion of Forgewall for drawing, effective thirty days from service." / "Assay: tenure very high; last drawn never. Estimated purchase: relief of two Grey Years." / "Comptroller O. Varn. Served with a bow, received with a refusal. Both in the ledger."
  - `lore_forgewall_vault` — *The Sealed Vault*: "Under the bastion a blade was sealed with an oath. One oath, once. It is the reason the Seam here is so rich: a singular memory holds a great deal around it." / "The Office would not draw the oath itself — nil tenure — but would draw everything it holds up." / "Come with the Anvil Badge. The oath will look at you and decide whether you are the kind of holder it would answer."

### 6.14 siege_route — Siege Road

- route · forge · Steel · gate `wraith` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II "Sable, coatless, walking beside the player without making it a thing." · III -
- **Signature:** `old_siege_line` — a ridge of rusted siege-engines from a war nobody in Ewa can name (a Steel-register joke the game plays straight: the war was drawn on, long ago, by nobody — it simply thinned), now a `grubolt`/`scraphog` warren.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `siege_route.sable` [b23] | Sable | `siege_held` / `act3_started` | "Don't make it a thing." · "So get this far." |
| `siege_route.scrapper` | a scrapper | - / - | "Engines from a war. Whose? Nobody knows. Not drawn on — just old enough to have thinned by itself. That happens too. The Office isn't wrong about that." |
| `siege_route.acier_hunter` | an acier-hunter | - / - | "Acier in the engine-hulks. Steel and fighting. The rarest made thing on the road and it hits back. Twice I've seen one. Twice." |
| `siege_route.provisioner_b` | a Provision courier, resting | `siege_held` / - | "Carrying Forgewall's no to the Comptroller. First no I've ever carried. It's not heavier. I thought it would be heavier." |

- **Lore tablets**
  - `lore_siege_engines` — *The Nameless War*: "These engines fought for something. No record says what. No one drew on it; it thinned by itself, the way the Office says everything does." / "The Office is right that the world forgets on its own. It is wrong that this means it does not matter how fast." / "A war that faded is a war nobody has to have again. A hedge that faded fed no one twice."
  - `lore_siege_alloylark` — *Rivet and Feather*: "Alloylark nest in the engine-barrels by day; the Held remembers birds in the guns and finds nothing strange in it." / "Steel is the register of the made; Flying, of the released. A made thing that lets go is the Wardens' oldest emblem." / "It is on Sylvane's door at Skyrend. Climb and see."

### 6.15 skyrend — Skyrend Peak

- town · sky · Dragon · gate `anvil` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II - · III "The star-counts; the Wardens explained; the Ascend Badge as judgement."
- **Signature:** `sky_shrine_records` — the Wardens' shrine with three centuries of star-charts pinned floor to ceiling in a lit round room; each chart is a real texture with a countable number of points, decreasing chart by chart (the render authors ~24 charts; the counts are content data).
- **League:** `draco_gym` (Sylvane).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `skyrend.shrinekeeper` [q09] | Under-keeper Rowan Vane | - / - | "Serpyre on the Ascent, sixty species in your device, and the Ascend Badge — then the shrine will show you the upper room." · react `saw_star_counts`: "You've seen the charts. Most people look at one. You looked at the gap between them." |
| `skyrend.astronomer` | an astronomer | - / - | "I have charted the sky since I was a girl. Fewer stars each year. Slow, then faster. The Office says natural. I say: natural, *and*." |
| `skyrend.roost_keeper` | a roost-keeper | - / - | "Scalewisp on the cliffs, glacifang after dark. Dragons are the register of things that were certain from the start. Nothing up here was ever a cub." |
| `skyrend.pilgrim` | a Warden pilgrim | - / - | "The Wardens hold no office and want none. They counted the sky for three hundred years and built twelve devices. That's their whole answer to the Provision. It's a slow answer." |

- **Lore tablets**
  - `lore_skyrend_charts` — *Three Hundred Years*: "Chart 1: the sky as it was. Chart 300: the sky as it is. Count the points if you doubt." / "The loss is old, slow and natural. The Wardens have never said otherwise, and neither has the Office." / "The loss steepens in Yr 0 of the Office. The Wardens have said this. The Office has not."
  - `lore_skyrend_emblem` — *Rivet and Feather* (the shrine door): "A made thing that lets go. The Wardens' mark since before counting." / "We hold records, not power. A record is a made thing. It must let go of the thing it records or it becomes a cage." / "The Attestor is a record. It holds without owning. That is the difference between it and a ledger."

### 6.16 ascent_route — The Ascent

- route · sky · Dragon · gate `anvil` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II - · III "The climb; Glacinid in the frozen cirque after the title (§7)."
- **Signature:** `glacier_melt` — the surf zone at altitude: a meltwater tarn under a hanging glacier, `tidalfang` in the water, the ice a real refractive material (10-render owns the shader; the story only asks that it read as ice).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `ascent_route.guide` | a mountain guide | - / - | "Serpyre high up, budwing in the meadows, blizzhowl after dark. Don't fight a serpyre tired." |
| `ascent_route.hermit` | a hermit | - / - | "Came up here to be forgotten. Turns out the Held remembers hermits very clearly. Something about the silence." · react `act3_started`: "Thirty days, the Comptroller says. To make the world not need remembering. I came up here for that and it's the loneliest thing there is." |
| `ascent_route.cirque_watcher` | a cirque-watcher | - / - | "There was a winter once that didn't end. One winter. It's in the cirque still, a memory of cold that never spent itself." |

- **Lore tablets**
  - `lore_ascent_thin_air` — *Thin Air*: "The Held is thin up here not because it was drawn but because it was never thick. Few people; few memories; a sky and a mountain." / "This is what a place looks like when it has always been nearly forgotten and is at peace with it." / "It is not the same as a settled Seam. Learn the difference by standing in both."
  - `lore_ascent_cirque` — *The Winter That Stayed*: "One winter did not end. The Held could not decide it had, and so a memory of endless cold precipitated here and has never thawed." / "Singular. Nil tenure. The Office has assayed it and gone home." / "It answers Champions. Become one."

### 6.17 solenne — Solenne, the Sun-City

- town · capital · type `null` · gate `ascend` · **Harvest:** I intact · II intact · III **thinning** (beat 28) → **intact** (beat 31).
- **Story role:** I - · II - · III "The Provision Hall and its lectern; the Permanence notice; the league; the city that forgets its own name for a day and gets it back."
- **Signature:** `provision_hall` — the Hall with the public ledger on a lectern under a skylight; the Grey Year memorial's original (4,100 names) along one wall; the league hall opposite across the square. In `thinning`, the Hall's carved name over the door renders as an unreadable relief.
- **League:** `veil`, `aurelia`, `kirei`, `zeon` (spine §3.3 `zoneId: 'solenne'`).
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `solenne.comptroller_varn` [b26] | Comptroller Odile Varn | `badge:ascend` / `spire_confronted` | "I have never asked you to trust me. I have asked you to read." · "Thirty days." |
| `solenne.clerk_of_hall` [b29] | the Clerk of the Hall | - / - | "The ledger's here. Anyone may read it. Nobody does." · react `saw_capital_thinning`: "The, the — I've lived here fifty years." · react `name_held`: "Solenne. Solenne! I said it to the doorman four times. He said it back four times." |
| `solenne.bursar_quill` [b32] | Bursar Elias Quill | `name_held` / - | "I've added a column." · "Costs that appear on paper get argued about." |
| `solenne.hospital_nurse` | a nurse at the Provision Hospital | - / - | "Dispensary's stocked. Always has been. I've worked here twenty years." · react `sable_turned`: "Teo's bed is paid a different way now. Some Warden. He doesn't know and I'm not telling him; he's twelve." |
| `solenne.granary_clerk` | a granary clerk | - / - | "Eleven bad years since the Office. Nobody hungry in any of them. I'm not sorry. I'm — I'd like to know what it cost. That's all. I'd like the number." |

- **Lore tablets**
  - `lore_solenne_greyyear` — *District Rolls, Grey Year* (the Hall wall): "'Mirevale district: 612 marked likely. Saltmourn: 890. Solenne inner: 1,400 …' The clerk who kept this roll was O. Marle." / "'Twelfth of Winter. The lens. I have done a thing and the sacks are full. I will do it again tomorrow and write both down.'" / "He wrote both down. Every Comptroller since has. Read the second column."
  - `lore_solenne_lectern` — *The Public Ledger*: "Working copy at the Observatory; this copy monthly by courier. 1,400 pages. Two columns." / "Anyone may read. Register notation on the draw side: species, place, count." / "If you can read it, you are one of thirteen people in Ewa who can. Twelve carry devices. One is the Comptroller."

### 6.18 eclipse_shrine — The Eclipse Shrine

- story · shrine · Cosmic · gate `ascend` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II - · III "The Wardens' oldest shrine; where the first night was first counted; where Noxmyth comes to a holder with a hundred witnessed."
- **Signature:** `altar_stone` — an open-air altar under a sky that shows the star-count of chart 1 (the sky as it was), the one place in Ewa where the render draws the full old sky. `zenryu`'s static after the title.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `eclipse_shrine.shrinekeeper` [b25] | the Shrinekeeper | `badge:ascend` / - | "Come back when you have a hundred." · react `mythical_night`: "It came to be counted. Three hundred years. You were the one it counted for." |
| `eclipse_shrine.night_warden` | a night-warden | - / - | "Look up. That's the sky as it was. The Wardens keep it here so someone remembers what the count started at." |
| `eclipse_shrine.pilgrim` | a pilgrim | - / - | "Malice and devourest after dark. Ghost and fairy — absence and wonder. The two registers the first night was filed under." |

- **Lore tablets**
  - `lore_eclipse_firstnight` — *The First Night*: "Before there was a morning there was a dark to have it against. The Held remembers that dark as a single thing and calls it nothing; the Wardens called it Noxmyth." / "Not evil. The register of the refused is Dark; the first night refused nothing. It simply came first." / "It is counted here. It comes to be counted by whoever has counted most."
  - `lore_eclipse_oldsky` — *Chart One*: "The sky above this altar is drawn as it was on the first chart. Stand here and look up and you are seeing three hundred years ago." / "Then walk to Skyrend and look up again." / "That difference is the whole argument, and both sides agree on it."

### 6.19 umbral_observatory — Umbral Observatory

- story · vesper · Ghost · gate `wraith` · **Harvest:** I **harvested** · II harvested · III harvested. The Provision's headquarters is a settled place. Forty-one years of standing beside the lens have drawn the grounds flat; the staff work in it and keep name-cards. It is the first `harvested` zone the player *enters* rather than watches settle, and the flat look is not a ruin — it is clean, swept and administered.
- **Story role:** I - · II "The holding, the ledger, Sable's turn, the escort out." · III "Galaxion at the great lens (gate `flag:ledger_read`, §7)."
- **Signature:** `great_lens` — the flattened mirror at the heart of the dome, aimed at nothing, on a mount that turns; the working ledger on its stand; the ring of orbs (the holding) in the entry hall. The third pylon line terminates here in a real, humming transformer housing with the only bright light in the zone.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `umbral_observatory.bursar_quill` [b17] | Bursar Elias Quill | `observatory_open` / - | "I write the draw before the purchase, so I can't forget to." · react `spire_confronted`: "She's gone up. I told her the name was held. She said 'held by whom' and I didn't know. I write the book; I don't read the Wardens'." |
| `umbral_observatory.comptroller_varn` [b18] | Comptroller Odile Varn | `saw_holding` / `act3_started` | "Show me the column where that was wrong." · react `sable_turned`: "The Junior Assessor has resigned. On the ledger. I've left the token where it lies; it's a record." |
| `umbral_observatory.sable` [b19] | Sable | `ledger_read` / `escorted_out` | "I read it. That's all." |
| `umbral_observatory.assessor_reeve` [b20] | Assessor Tamsin Reeve | `sable_turned` / - | "Nothing personal. It never is." · react `new_column`: "Attested. It's a good word. Quill's. I've started asking, at the Seams. Nobody's ever asked before." |
| `umbral_observatory.aonred_keeper` | a lens-technician | - / - | "Darkone under the lens comes out certain. Aonred or darkyon, depending what it was watched doing. We let a few go. Quill says a memory we made certain isn't ours to spend." |

- **Lore tablets**
  - `lore_observatory_form` — *The Form* (brass, beside the lens): "'Let it have been that —'. The Bursar names the purchase in the charter's words and the substrate re-remembers." / "The draw is stated first, aloud, so that the room hears what it costs. Marle's rule. No Bursar has ever skipped it." / "A mile west a woman hears every word through her window. The Office has known this since Yr 12 and has never drawn on her."
  - `lore_observatory_ledger_line` — *Yr 38, 14th of Fall* (the open page): "PROVISIONED — Marrowdig: relief of the Deep Cut cave-in; 61 recovered; shaft restored." / "DRAWN AGAINST — mire_route · seedrift ×22 · mossling ×31 · bloomsprite ×4 · smellduck ×19 · resilian ×9 (tenure high; Seam last drawn Yr 17)." / "Below, in a different hand, a brass token pressed into the paper hard enough to dent it."

### 6.20 celestial_spire — The Celestial Spire

- story · shrine · Cosmic · gate `ascend` · **Harvest:** I intact · II intact · III intact.
- **Story role:** I - · II - · III "The Permanence withdrawal; where the first morning was first counted; where Lumyth comes to a holder with a hundred and twenty witnessed."
- **Signature:** `top_step` — an open stair to a platform above the cloud, the sun a real key light at dawn and the DOF's focal plane cutting the platform (pillar 1's showpiece). Varn's door-sized field lens stands here after beat 28, dark.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `celestial_spire.comptroller_varn` [b28] | Comptroller Odile Varn | `act3_started` / `spire_confronted` | "I'd rather nobody stood there." · "Who has the name." |
| `celestial_spire.wynn` | Prof. Wynn | `spire_confronted` / - | "She left the lens. Dark. I'll not touch it; I've touched enough of them." · react `mythical_morning`: "The first morning. In your device. I sent a child up a road with one partner and a meter reading. Look what you held." |
| `celestial_spire.sable` | Sable | `spire_confronted` / - | "Teo's coming out in the spring. Not cured. Better. The Warden pays and doesn't ask for anything and I keep waiting for her to." |
| `celestial_spire.keeper` | the Spire-keeper | - / - | "The first morning was counted here, once, three hundred years ago. It comes to whoever has counted most. Not to be owned. To be counted again." |

- **Lore tablets**
  - `lore_spire_firstmorning` — *The First Morning*: "Before there was anything to see, there was light to see it by. The Held remembers that as one thing and the Wardens called it Lumyth." / "Not good. The register of wonder is Fairy; the first morning was filed under Cosmic and Psychic — the world, and the mind that noticed it." / "It comes to be counted last of all. A holder with everything else is the only one it trusts."
  - `lore_spire_vigil` — *The Vigil*: "We do not worship the light; worship asks only for your knees. We keep a record, which asks for your whole life and gives you a number." / "If you climbed to kneel, climb down. If you climbed to count: sit. The count is long." / "The Comptroller climbed to end the counting. That was the one thing this stair was never for."

### 6.21 the_rift — The Rift Below

- story · rift · type `null` · gate `ascend` · **Harvest:** I **harvested** · II harvested · III harvested. **By nature, not by draw.** There was never anything here to remember; the flat look is the floor of the Held, and `setHarvestLevel(2)` here is what the world looks like when nothing holds it.
- **Story role:** I - · II - · III "What Varn was buying, shown; Voidraxis at the edge after the title (§7)."
- **Signature:** `the_edge` — a shelf of flat black stone over black water, and beyond it nothing rendered at all: the skybox ends. The one place the render is permitted an empty frame.
- **NPC voices**

| id | name | when / until | lines |
|---|---|---|---|
| `the_rift.wynn` [b33] | Prof. Wynn | `name_held` / - | "This is what she was buying." · react `leg_voidraxis`: "You looked at it and remembered its face. Your device has an entry for a thing that was here before entries. I don't know what that means. I'd like to find out with you." |
| `the_rift.sable` | Sable | `name_held` / - | "Your device can't file it under anything." · "Don't go down to the edge. …Or do. You're the one who held a city's name. Maybe the before is afraid of you." |
| `the_rift.rift_watch` | a Warden rift-watch | `name_held` / - | "We post a watch here in shifts. Nothing to do but count. The count here is always nought. That's the job: to notice when it isn't." |

- **Lore tablets**
  - `lore_rift_floor` — *The Floor* (scored into the black stone): "Before the first morning and the first night there was this: nothing to remember and nothing remembering." / "Not evil. Older than evil. The Held is the latecomer; this is what it is held against." / "Everything the Office ever settled was a step toward here. Everything the Attestors ever held was a step back from it. Neither side had seen the floor. Now one has."
  - `lore_rift_before` — *Voidraxis*: "The memory of before there was anything to remember. Cosmic, because it is about the world and not in it; Dragon, because it was certain from the start." / "No trainer who has seen its face has remembered it — until an Attestor, which remembers for them." / "It waits at the edge for the kind of holder who has held everything else. It does not want anything. It has never wanted. Wanting came with the morning."

---
## 7. LEGENDARY ENCOUNTERS

### 7.1 The rule

7.1.1 A legendary is a singular memory (§2.7). It appears once, in one place, behind one gate, as a `LegendaryStatic` (roster-coverage §4.2). The bible does not move any static, change any level, or add a ninth; it supplies the one thing roster-coverage §7 left to it — the Act II flag for `galaxion` — and the staging line each static speaks through the zone's lore tablet (§6). `LEGENDARY_STATICS` remains exactly 8 rows; `voidraxis` is the eighth.

7.1.2 Gate reading: `badge:<id>` = the badge flag; `flag:<id>` = a story flag from §11. The server re-checks the gate on every `interact { kind: 'static' }` (roster-coverage §4.2).

### 7.2 The eight statics

| species | zoneId | gate (`when`) | level | flag set on win or catch | Why this gate, in the story |
|---|---|---|---|---|---|
| raikitsune | galvan_route | `badge:circuit` | 30 | `leg_raikitsune` | The struck pylon looks at whoever Zia has certified can out-run a current (§6.8). |
| bankaiser | forgewall | `badge:anvil` | 42 | `leg_bankaiser` | The oath under the bastion answers the holder Rell stood the gate with (§6.13). |
| galaxion | umbral_observatory | **`flag:ledger_read`** | 45 | `leg_galaxion` | The star that came down drifts to the great lens once someone outside the Office has read the book under it. Replaces roster-coverage's placeholder `badge:anvil`, as §7 there invites; `ledger_read` is set by beat 18, which precedes the Anvil Badge in play order, so the static becomes available slightly earlier than the placeholder and inside its zone's band (42–48). Nothing else changes. |
| sunjaw | ash_route | `flag:champion:zeon:beaten` | 55 | `leg_sunjaw` | The one laugh at the caldera lip answers a Champion, and the road it is on stays flat around it — a singular memory does not need the place to hold it (§6.4). |
| glacinid | ascent_route | `flag:champion:zeon:beaten` | 55 | `leg_glacinid` | The winter that stayed (§6.16). |
| voltaura | galvan_route | `flag:champion:zeon:beaten` | 55 | `leg_voltaura` | The storm's eye over the span; the second static on the one route that has two (roster-coverage §7 coordinates keep them 176 units apart). |
| zenryu | eclipse_shrine | `flag:champion:zeon:beaten` | 60 | `leg_zenryu` | The dragon that tested the first Champion roosts on the altar under the old sky once there is a new one (§6.18). |
| voidraxis | the_rift | `flag:champion:zeon:beaten` | 65 | `leg_voidraxis` | The before, at the edge (§6.21). It becomes visible to a holder of the name; beat 33 places Wynn and Sable on the shelf above it. |

7.2.1 Battle format for all eight is `wild` with `canFlee: false` on the legendary's side and `canCatch: true` (roster-coverage §7). A KO is a dropped memory — the static never returns for that player, and `the_rift.wynn`'s `react` on `leg_voidraxis` is written to read correctly whether the player caught it or beat it ("You looked at it and remembered its face").

### 7.3 The mythicals — story rewards, not statics

| species | quest | zoneId | needs (quest objectives, roster-coverage §12.1) | level | flag |
|---|---|---|---|---|---|
| noxmyth | `q11_first_night` | eclipse_shrine | `champion:zeon:beaten`; 100 species witnessed; 5 PvP wins | 60 | `mythical_night` |
| lumyth | `q12_first_morning` | celestial_spire | `mythical_night`; 120 species witnessed; 20 wins any format | 60 | `mythical_morning` |

7.3.1 Both quests have `giver: null` (auto-offered) — the shrines "count" the holder when the count is reached; the shrinekeepers' `react` lines on the two flags (§6.18, §6.20) are the only ceremony. The first night is handed out before the first morning because the Held remembers the dark first (§2.8.1) and because 100 precedes 120.

7.3.2 The battle-pass level-50 `mythicalChoice: ['lumyth', 'noxmyth']` (spine §3.9) is unchanged. A player who takes one there still receives the other from its quest and a second copy of the first from the remaining quest; the bible does not special-case this, and neither does content.

### 7.4 What legendaries never do

No legendary is spent, bought, held in the Observatory's holding, or named on a rate card. `lore_mire_rate` and `lore_galvan_struck` state the Office's position ("not purchased"; "nil tenure") so the player never has to wonder whether the antagonist will take the endgame roster away from them. It will not; it has no reason to.

---

## 8. DEX FRAMING AND SAMPLE ENTRIES

### 8.1 The Attestor

8.1.1 The Dex UI is **the Attestor** (§2.8.2). Its title bar says so; the word "Dex" appears nowhere in-fiction. A caught species is **witnessed**; a seen-but-uncaught species is **glimpsed**; a completed evolution line is **held certain**. `catchSpecies` counts witnessed species and is displayed as "held: N / 130".

8.1.2 Every entry shows the register line first — species · place · count — in the same notation as the ledger (§3.5.1), so that when the player reads the Yr 38 line at Marrowdig (beat 14) they have been reading that notation since Mirevale. The place is `caughtAt.zoneId`'s display name; the count is the player's own witnessed instances.

8.1.3 The 131st card (§4.6.2) is unnumbered, titled only with the register line's place column ("Ewa"), and shows after `name_held`. It has no flavour text. `20-client.md` decides whether to render it; the bible only requires that nothing else read it.

### 8.2 The flavour voice

8.2.1 Every `SpeciesDef.flavor` is rewritten in the **recollection voice**: the Held remembering, transcribed by a Warden. Rules: present tense; the creature is described as a memory *of* something, not as an animal; one concrete detail; one line about how certain the memory is or where it precipitates; no exclamation marks; no "legend says" (the Wardens have records, not legends); ≤ 240 characters. The legacy flavour is source material, not text — its concrete details are kept where they were good.

8.2.2 The word "recollection" appears in at most one entry in three. The others use "the Held remembers", "filed under", "precipitates", "certain", "held".

### 8.3 Twelve sample entries

| id | Entry |
|---|---|
| bramblecub | The Held half-remembers a cub in the brambles: the weight of it, not yet its size. It precipitates on Mire Route where the hedge has never been cut. Wynn held the first one for a year before she gave it away. |
| briarbear | The same memory, now sure of its shoulders. Nothing new was added; the Held simply stopped hesitating. It appears wild only where a bramblecub was witnessed growing — the Hollow, at level, never earlier. |
| thornback | The cub made certain. Grass filed under Rock: a thing that was soft and is now unarguable. It does not precipitate wild. Someone had to be there while it made its mind up. |
| glimfin | Water filed under Electric — a memory of a fish that carried a current, precipitated in the Tide shallows and the drowned basin at Saltmourn. It is steadier with a holder. Most things are. |
| cindercap | The Held remembers a cap of embers on a stalk and is not sure whether it was a mushroom or a fire. Both. It is rare on Ash Route since the second draw, and the Office notes this without comment. |
| bloomsprite | Grass filed under Fairy: the memory of something small opening in a hedge in spring. The rarest thing a new holder can meet, by day, on Mire Route. Four were drawn Yr 38. The Attestor holds the rest. |
| wraithtide | Water filed under Ghost. It is the memory of a harbour that was never here, sitting on the stones of one. It precipitates in any black water at night because the Held has begun filing it under *lost*. Take it home. |
| darkone | The Held remembers this one twice and cannot decide which. Watched drawing lightning, it becomes aonred; watched refusing to be lowered, darkyon. The only memory in Ewa certain of two things. |
| acier | Steel filed under Fighting — the memory of a thing that was made, and then hit back. Rare in the engine-hulks on Siege Road; the Held did not remember many made things that fought for themselves. |
| voidraxis | The memory of before there was anything to remember. Cosmic, because it is about the world and not in it; Dragon, because it was certain from the start. No one who saw its face has held it — until a record held it for them. |
| lumyth | The first morning: the first time there was light to remember anything by. Cosmic and Psychic — the world, and the mind that noticed. It comes to be counted last, by the holder who has counted everything else. |
| noxmyth | The first night: the dark there had to be for a morning to be first. Cosmic and Dark, and Dark here refuses nothing; it only came before. It comes to be counted at the shrine where it was first written down. |

### 8.4 The register index — all 130, in dex order

8.4.1 Every species id and display name, with its register (types) and the stage word the Attestor uses (`root` = evolves and has no parent; `mid` = evolves and has a parent; `certain` = final of a line; `single` = neither; `singular` = legendary; `first` = mythical). Placement is roster-coverage §10 and is not restated. Flavour for the 118 not sampled in §8.3 is written to the §8.2 rules at content time; this table is the checklist that none is dropped.

| # | id | name | register | stage |
|---|---|---|---|---|
| 1 | smellduck | Smellduck | Grass/Normal | root |
| 2 | bloomduck | Bloomduck | Grass/Normal | certain |
| 3 | budwing | Budwing | Dragon/Grass | root |
| 4 | bloomdrake | Bloomdrake | Dragon/Grass | mid |
| 5 | florasage | Florasage | Dragon/Grass | certain |
| 6 | fennorange | Fennorange | Ground | root |
| 7 | berkest | Berkest | Ground | mid |
| 8 | clementar | Clementar | Ground/Grass | certain |
| 9 | glimp | Glimp | Fairy | root |
| 10 | glimmereen | Glimmereen | Fairy | certain |
| 11 | bramblecub | Bramblecub | Grass | root |
| 12 | briarbear | Briarbear | Grass | mid |
| 13 | thornback | Thornback | Grass/Rock | certain |
| 14 | shiveruff | Shiveruff | Ice/Normal | root |
| 15 | blizzhowl | Blizzhowl | Ice/Normal | mid |
| 16 | auroracle | Auroracle | Ice/Psychic | certain |
| 17 | pebblit | Pebblit | Rock | root |
| 18 | lithokrysm | Lithokrysm | Rock | mid |
| 19 | prismolith | Prismolith | Rock | certain |
| 20 | nettlewisp | Nettlewisp | Ghost/Grass | root |
| 21 | briarvaunt | Briarvaunt | Ghost/Grass | certain |
| 22 | ampmite | Ampmite | Electric/Bug | root |
| 23 | luxtrik | Luxtrik | Electric/Bug | certain |
| 24 | gustuff | Gustuff | Fairy/Flying | root |
| 25 | cirrileap | Cirrileap | Fairy/Flying | certain |
| 26 | brookrawl | Brookrawl | Water/Fighting | single |
| 27 | zaptus | Zaptus | Psychic | root |
| 28 | nebucloak | Nebucloak | Psychic | mid |
| 29 | archonosis | Archonosis | Psychic | certain |
| 30 | grubolt | Grubolt | Bug/Steel | root |
| 31 | ironcarab | Ironcarab | Bug/Steel | certain |
| 32 | embrock | Embrock | Rock/Fire | root |
| 33 | magmolith | Magmolith | Rock/Fire | certain |
| 34 | mudbub | Mudbub | Ground/Water | root |
| 35 | bogmaw | Bogmaw | Ground/Water | certain |
| 36 | mufflo | Mufflo | Normal | root |
| 37 | wooltug | Wooltug | Normal | mid |
| 38 | rambull | Rambull | Normal | certain |
| 39 | stormchick | Stormchick | Electric/Flying | root |
| 40 | thundrix | Thundrix | Electric/Flying | certain |
| 41 | scalewisp | Scalewisp | Dragon/Flying | root |
| 42 | rexaloft | Rexaloft | Dragon/Flying | certain |
| 43 | tidalfang | Tidalfang | Dragon/Water | root |
| 44 | abyssrake | Abyssrake | Dragon/Water | certain |
| 45 | glacifang | Glacifang | Dragon/Ice | root |
| 46 | blizzraak | Blizzraak | Dragon/Ice | certain |
| 47 | mossling | Mossling | Water/Grass | root |
| 48 | verdatide | Verdatide | Water/Grass | certain |
| 49 | slushpup | Slushpup | Water/Ice | root |
| 50 | frofloe | Frofloe | Water/Ice | certain |
| 51 | glowtent | Glowtent | Water/Poison | root |
| 52 | toxiveil | Toxiveil | Water/Poison | certain |
| 53 | snapling | Snapling | Grass/Poison | root |
| 54 | venobulb | Venobulb | Grass/Poison | certain |
| 55 | seedrift | Seedrift | Grass/Flying | root |
| 56 | blossomsail | Blossomsail | Grass/Flying | certain |
| 57 | coldplate | Coldplate | Ice/Steel | root |
| 58 | glaciarm | Glaciarm | Ice/Steel | certain |
| 59 | wickling | Wickling | Ghost/Fire | root |
| 60 | ignispectre | Ignispectre | Ghost/Fire | certain |
| 61 | dreambud | Dreambud | Psychic/Fairy | root |
| 62 | starwhim | Starwhim | Psychic/Fairy | certain |
| 63 | shardling | Shardling | Steel/Fairy | root |
| 64 | gemknight | Gemknight | Steel/Fairy | certain |
| 65 | murkrat | Murkrat | Poison/Dark | root |
| 66 | toxshade | Toxshade | Poison/Dark | certain |
| 67 | pebfist | Pebfist | Fighting/Ground | root |
| 68 | geoboxer | Geoboxer | Fighting/Ground | certain |
| 69 | flampling | Flampling | Fire/Flying | root |
| 70 | solpyre | Solpyre | Fire/Flying | certain |
| 71 | resilian | Resilian | Bug/Flying | root |
| 72 | resilith | Resilith | Bug/Flying | mid |
| 73 | resilithorn | Resilithorn | Grass/Rock | certain |
| 74 | rimeidol | Rimeidol | Dark | root |
| 75 | murmink | Murmink | Dark/Fairy | mid |
| 76 | velvetomb | Velvetomb | Dark/Fairy | certain |
| 77 | darkone | Darkone | Dark | root |
| 78 | darkyon | Darkyon | Dark/Fire | certain |
| 79 | aonred | Aonred | Dark/Fire | certain |
| 80 | nerohat | Nerohat | Ghost/Poison | root |
| 81 | fedoraith | Fedoraith | Ghost/Poison | certain |
| 82 | tidespine | Tidespine | Water/Rock | root |
| 83 | tsunamite | Tsunamite | Water/Rock | certain |
| 84 | fibrostis | Fibrostis | Poison | root |
| 85 | chrysotox | Chrysotox | Rock/Poison | certain |
| 86 | cindercap | Cindercap | Fire | root |
| 87 | pyrecap | Pyrecap | Fire | mid |
| 88 | infernomorel | Infernomorel | Fire/Dark | certain |
| 89 | glimfin | Glimfin | Water/Electric | root |
| 90 | voltide | Voltide | Water/Electric | mid |
| 91 | abysspark | Abysspark | Water/Electric | certain |
| 92 | alloylark | Alloylark | Steel/Flying | root |
| 93 | rivetalon | Rivetalon | Steel/Flying | certain |
| 94 | hexroach | Hexroach | Poison/Bug | root |
| 95 | blighthex | Blighthex | Poison/Bug | certain |
| 96 | scraphog | Scraphog | Steel/Ground | root |
| 97 | trenchtusk | Trenchtusk | Steel/Ground | certain |
| 98 | coalette | Coalette | Fire/Ground | root |
| 99 | caldermole | Caldermole | Fire/Ground | certain |
| 100 | ripshell | Ripshell | Water/Fighting | single |
| 101 | bloomsprite | Bloomsprite | Grass/Fairy | single |
| 102 | umbrit | Umbrit | Ghost/Dark | root |
| 103 | voidraith | Voidraith | Ghost/Dark | certain |
| 104 | acier | Acier | Steel/Fighting | single |
| 105 | miscarmen | Miscarmen | Psychic | root |
| 106 | mismagmen | Mismagmen | Ghost/Psychic | certain |
| 107 | moflame | Moflame | Fire | root |
| 108 | moblaze | Moblaze | Fire | certain |
| 109 | yahit | Yahit | Fighting | root |
| 110 | yaschamp | Yaschamp | Fighting | mid |
| 111 | yasprime | Yasprime | Fighting | certain |
| 112 | serpyre | Serpyre | Dragon | root |
| 113 | pyrothal | Pyrothal | Fire/Dragon | certain |
| 114 | wraithtide | Wraithtide | Water/Ghost | single |
| 115 | flowbot | Flowbot | Electric/Steel | single |
| 116 | kygra | Kygra | Water | single |
| 117 | raidori | Raidori | Electric | single |
| 118 | malice | Malice | Ghost/Fairy | root |
| 119 | devourest | Devourest | Ghost/Fairy | mid |
| 120 | necrogeist | Necrogeist | Ghost/Fairy | certain |
| 121 | glacinid | Glacinid | Ice/Dragon | singular |
| 122 | galaxion | Galaxion | Fire/Psychic | singular |
| 123 | voltaura | Voltaura | Electric/Fairy | singular |
| 124 | voidraxis | Voidraxis | Cosmic/Dragon | singular |
| 125 | sunjaw | Sunjaw | Fire/Fighting | singular |
| 126 | raikitsune | Raikitsune | Electric/Fire | singular |
| 127 | bankaiser | Bankaiser | Ghost/Steel | singular |
| 128 | zenryu | Zenryu | Dragon/Fighting | singular |
| 129 | lumyth | Lumyth | Cosmic/Psychic | first |
| 130 | noxmyth | Noxmyth | Cosmic/Dark | first |

8.4.2 Counts, for the validator: root 49, mid 13, certain 50, single 8, singular 8, first 2 — total 130. These match the header of roster-coverage.md (base 49 / mid 13 / final 50 / single 18, where its 18 singles = these 8 singles + 8 singular + 2 first).

---

## 9. DIALOGUE STYLE GUIDE

9.1 **Every sentence checkable.** A line asserts something the player can verify in the world or the record: a number on a plate, a state a zone is in, a flag another NPC reacts to. "Something terrible is coming" is not a line in this game. "Two-thirds" is.

9.2 **Short.** ≤ 140 characters per `lines[]` entry; ≤ 6 entries per beat; ≤ 3 per NPC idle set. A person who has a lot to say (Varn, beat 18) says it in six short lines, not two long ones.

9.3 **Three registers, kept apart.**
- *Townsfolk*: contractions, concrete nouns, their trade's vocabulary, no cosmology. They say "grey", "settled", "the Office", "partner".
- *The Office*: complete sentences, charter vocabulary (`provisioned`, `drawn against`, `tenure`, `assay`, `settled`), no adjectives of feeling, always polite, never sarcastic. An Assessor apologises exactly once per scene and means it.
- *Wardens and tablets*: formal, declarative, aphoristic, second person. Tablets are the only place the game is allowed to sound like a sermon, and each tablet earns it with a concrete fact in its first line.
- Wynn moves between the first and third; Sable between the first and second; the gym leaders are townsfolk who each say "recollection" once (§4.4).

9.4 **Hard rules.** The Holder is never named, shown, or addressed (§2.1.1). Nobody says "destiny", "chosen", "evil", "cult", "engine" (the last is the legacy plot's word). Nobody threatens anyone. The Provision never lies on screen; when it is wrong it is wrong sincerely. Deaths are not depicted; the Grey Year is numbers on a wall.

9.5 **Stage directions** are parenthetical `lines[]` entries, present tense, one sentence, describing a thing the player can see the render do or a thing an NPC does — never a thing a character feels. "(Bark. Leaves. A shadow. The hedge is a hedge.)" is allowed; "(She feels the weight of forty years.)" is not.

9.6 **Forgetting is written, never performed as comedy.** A drawn-on NPC loses a *noun* mid-sentence ("the, the —"), finishes the task with their hands, and moves on. They do not stammer, weep or notice the loss for more than one line. The reader supplies the grief.

9.7 **Names.** People are named once, in full, by themselves ("Petra Stonewright. You'll want the pit."), and by first name or role afterwards. Sable is always "Sable". The player is never named except in Wynn's Spire `react` line (§4.2.4), which content interpolates from the profile name and is the only interpolation in the script.

9.8 **Silence.** The player has no lines. A beat that needs the player to have said something states the answer in the speaker's next line ("Both. It's both.") or leaves it. No "…" from the player's side.

9.9 **`react` precedence.** `NpcDef.react` is first-match (legacy convention kept). List reactions most-progressed first: `new_column` before `ledger_read` before `saw_assessment`. §6 tables are already in that order and content must keep it.

9.10 **Numbers are canon.** 4,100 names. 61 miners. 41 years. 40 % of Stormrook's night output. 1,400 pages. Two-thirds. Twelve Attestors. 3,600 for four bloomsprite (900 × 4, rate card). Thirty days. Nineteen years as Champion. If a line needs a number, it uses one of these or §3's tables; if it needs a new one, add it to §10 first.

---

## 10. GLOSSARY

| Term | Meaning | Who says it |
|---|---|---|
| **The Held** | Ewa, the world, as a memory held by something. | Wardens, Wynn, tablets |
| **The Holder** | Whatever remembers the Held. Never shown or named further (§2.1.1). | Wardens (once), Wynn |
| **the substrate** | The Office's word for the Holder. | Provisioners |
| **thinning** | The memory losing specificity; also `HarvestState 'thinning'` / `HarvestLevel 1`. | Everyone |
| **settled** | The Office's word for a harvested Seam; `HarvestState 'harvested'` / `HarvestLevel 2`. | Provisioners |
| **grey** | Townsfolk's word for settled or thinning, after the Grey Year. | Townsfolk |
| **Seam** | A place where the Held is thin enough for recollection to precipitate; where wild Ewamon appear. | Everyone |
| **recollection** | An Ewamon, in the formal registers. | Wardens, Office, Wynn; gym leaders once |
| **precipitate** | A recollection taking a body at a Seam; a wild spawn. | Wardens, Wynn, Attestor text |
| **register** | The key a memory is filed under; a type. Also *register notation*: species · place · count. | Wardens, Attestor text, ledger |
| **certain / certainty** | Evolution; a memory becoming sure of itself. | Wardens, Wynn, Attestor text |
| **singular memory** | A legendary: a memory of a thing that happened once. Nil tenure. | Wardens, Office |
| **witness / witnessed** | To catch and record a species; a Dex entry. | Wynn, Wardens, UI |
| **glimpsed** | Seen, not caught. | UI |
| **held certain** | An evolution line completed in the Attestor. | UI |
| **holder** | Someone who holds recollections in a second place — a trainer; specifically an Attestor-bearer. | Wardens, Wynn |
| **the Attestor** | The Dex device; twelve exist. | Everyone |
| **The Provision / the Office** | The Office of Provision of Ewa (§3.1). | Everyone |
| **Provisioner / Assessor / Junior Assessor / Bursar / Comptroller** | Ranks (§3.7). | Everyone |
| **assay / tenure** | Assessing how firmly the Held holds a recollection; the measure of it. High tenure buys more. | Provisioners |
| **stock / the holding** | Caught wild recollections awaiting unsaying; the orb wall at the Observatory. | Provisioners |
| **unsay / unsaying** | Taking a recollection apart under the great lens. Never "kill". | Provisioners, Wynn |
| **provision (verb) / provisioned** | To direct raw recollection into a purchase; the state of having been bought. | Everyone |
| **draw / drawn against** | To spend from a Seam; the ledger's second column. | Provisioners, ledger |
| **the form** | "Let it have been that —", the charter's words for directing. | Bursars, Wynn (beat 27) |
| **the ledger** | The two-column book; working copy at the Observatory, public copy in Solenne. | Everyone |
| **ATTESTED** | The third column added in beat 32. | Quill, Reeve |
| **the rate card** | Public prices by the head (§3.3.1). | Provisioners, Sable |
| **the Grey Year** | The famine 41 years before the game; 4,100 names. | Everyone |
| **the Permanence Provision** | Varn's plan to spend the world's name (§4.7.1). | Varn, Wardens |
| **the name** | The recollection the Held holds the world by; carried by the Champion; spoken once (beat 31). | Wardens, Zeon, Varn |
| **the Wardens / the Sky-Shrine** | The record-keeping order at Skyrend; the league's Elite and Champion. | Everyone |
| **the great lens / field lens** | The flattened mirror at the Observatory; the hand-mirror-sized portable. | Provisioners, Zia |
| **the first morning / the first night / the before** | Lumyth, Noxmyth, Voidraxis (§2.8, §2.9). | Wardens, tablets |
| **the floor** | The Rift; the Held's edge. | Wynn, tablets |

---

## 11. FLAGS REGISTRY

11.1 Every non-badge flag id that appears in this document. **Set by** names the single place a flag is set (a beat number from §5.2, a quest from roster-coverage §12.1, a `LegendaryStatic`, or `LeagueTrainer.setsFlags`). **Needed by** lists beats (`b#`), quests (`q##`), statics, and `NpcDef.when/until/react` uses (`npc`). Validate's rule (spine §3.5) — every `need` is a `badge:` or is set somewhere — is satisfied by inspection of the *Set by* column: no row is empty.

| flag | Set by | Needed by |
|---|---|---|
| `met_wynn` | b1 | b2; npc `mire_route.sable` when |
| `met_sable` | b2 | b3 |
| `saw_thinning` | b3 | `verdant_gym` interaction gate (§6.1) |
| `bloom_spoken` | b4 | — (terminal; available to `react`) |
| `saw_assessment` | b5 | b6; npc `mire_route.sable` until, `ash_route.assessor_reeve` until, `ash_route.provisioner_b` when |
| `heard_grey_year` | b6 | npc `ash_route.charcoal_burner` react |
| `sable_livery` | b7 | — |
| `saw_old_harbour` | b8 | b9 |
| `act1_done` | b9 | b10 |
| `saw_grid_draw` | b10 | b11; npc `galvan_route.lineman` when |
| `saw_forgetting` | b11 | npc `stormrook.linekeeper` react |
| `sable_refused` | b12 | npc `tide_route.sable` until |
| `saw_seam` | b13 | b14 |
| `read_lease` | b14 | npc `marrowdig.cutter` react |
| `grove_harvested` | b15 (`harvest mire_route→harvested`) | b16; npc reacts in mirevale, mire_route, vesperveil |
| `observatory_open` | b16 | b17; npc `umbral_observatory.bursar_quill` when |
| `saw_holding` | b17 | b18; npc `umbral_observatory.comptroller_varn` when |
| `ledger_read` | b18 | b19, b27; static `galaxion` (`flag:ledger_read`); npc reacts in cinderhold, saltmourn, tide_route, stormrook, deepcut_route, vesperveil |
| `sable_turned` | b19 | b20; npc `deepcut_route.sable` until, `cinderhold.sable_neighbour` react, `solenne.hospital_nurse` react, `umbral_observatory.comptroller_varn` react |
| `escorted_out` | b20 | b21; npc `umbral_observatory.sable` until, `hollow_route.provisioner_a` react |
| `saw_requisition` | b21 | b22; npc `forgewall.assessor_hollis` when |
| `siege_held` | b22 | b23; npc reacts in forgewall, marrowdig, siege_route |
| `act2_done` | b23 | b24 |
| `saw_star_counts` | b24 | npc `skyrend.shrinekeeper` react |
| `shrine_seen` | b25 | — |
| `act3_started` | b26 | b27, b28; q10 objective 1 (roster-coverage §12.1: "flag `act3_started` (bible)"); npc `mirevale.wynn` until, `mire_route.wynn` when, `siege_route.sable` until, `ascent_route.hermit` react, `cinderhold.smith` react |
| `grove_reremembered` | b27 (`harvest mire_route→intact`; satisfies q10 `restoreZone mire_route`, §5.5) | npc `mire_route.wynn` react |
| `spire_confronted` | b28 (`harvest solenne→thinning`) | b29; npc `solenne.comptroller_varn` until, `celestial_spire.*` when, `umbral_observatory.bursar_quill` react |
| `saw_capital_thinning` | b29 | b30; npc `solenne.clerk_of_hall` react |
| `wardens_met` | b30 | b31 |
| `name_held` | b31 (`harvest solenne→intact`) | b32, b33; npc `the_rift.*` when, `solenne.bursar_quill` when, `solenne.clerk_of_hall` react, `galvan_route.lineman` react |
| `new_column` | b32 | npc `vesperveil.medium` react, `umbral_observatory.assessor_reeve` react |
| `rift_seen` | b33 | — |
| `harbour_witness` | q04 `rewards.flag` | npc `saltmourn.harbourmaster` react, `saltmourn.diver` react |
| `grove_restored` | q10 `rewards.flag` | npc `mirevale.archivist` react, `mire_route.forager` react |
| `mythical_night` | q11 `rewards.flag` | q12 objective 1; npc `eclipse_shrine.shrinekeeper` react |
| `mythical_morning` | q12 `rewards.flag` | npc `celestial_spire.wynn` react |
| `champion:zeon:beaten` | server `championWin` (30-server-netcode §30.4.4) **and** `zeon.setsFlags` | b31; q11 objective 1; statics `sunjaw`, `glacinid`, `voltaura`, `zenryu`, `voidraxis` |
| `elite:veil:beaten`, `elite:aurelia:beaten`, `elite:kirei:beaten` | `veil` / `aurelia` / `kirei` `setsFlags` | — (registered for `react` use; the champion gate itself is the league order rule, not these flags) |
| `leg_raikitsune`, `leg_bankaiser`, `leg_galaxion`, `leg_sunjaw`, `leg_glacinid`, `leg_voltaura`, `leg_zenryu`, `leg_voidraxis` | `LegendaryStatic.flag` on win or catch | npc `the_rift.wynn` react (`leg_voidraxis`); the static's own "never again" check |

11.2 Badge sugar used: `badge:bloom` (b4, b5), `badge:ember` (b7, b8), `badge:current` (b9), `badge:circuit` (b12, b13; static raikitsune), `badge:fault` (b14, b15), `badge:wraith` (b16), `badge:anvil` (b23; static bankaiser), `badge:ascend` (b25, b26). All eight appear; they appear in `BadgeId` order across the beat sequence, matching the zone-gate order the spine's validate asserts.

11.3 Flags this document deliberately does **not** define: nothing named `done_<beat>` (the runtime's completion marker is the server's, 30-server-netcode owns its spelling); nothing for gym wins other than the badge (legacy `gymwin_*` is not carried — badges are server-awarded and the badge *is* the flag); no `hq_done`, `saw_order`, `siege_done`, `climax`, `champion` (legacy plot flags, retired with it).

11.4 Naming rule for anyone adding a flag: `snake_case`, past-tense or noun (`saw_x`, `x_done`, `x_held`), no zone prefix (flags are global), and add the row here before using it. Namespaced colon flags (`champion:zeon:beaten`, `elite:<id>:beaten`) are the server's and are not extended by content.

---

*End of story bible v1.0. Counts: 21 zones, 33 beats, 8 battle beats, 5 harvest transitions, 8 statics + 2 mythical rewards, 12 sample entries, a 130-row register index, 44 registered flag ids plus 8 badge sugars.*
