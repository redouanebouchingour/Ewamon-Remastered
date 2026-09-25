# EWAMON REMASTERED — AUDIO BIBLE v1.0

**Status:** BINDING for `.design/audio/manifest.json` (every prompt, duration, bpm, key, gain and concurrency in it is transcribed from §4–§6 of this file) and for `tools/audio-pipeline` behaviour that SPEC §40.4 leaves to "the bible". Subordinate to `.design/SPEC.md` §20.7 (the client's graph, mixer values, `AudioDirector` and the `public/audio/manifest.json` shape) and §40.4 (the pipeline); where this file proposes something those sections do not say, it is marked **proposal** and changes nothing until the SPEC adopts it. Subordinate to `.design/story-bible.md` for what the world *is*; this file only decides what it sounds like. Closes SPEC OQ-6 (the provider, §9) and `PLAN.md` open dependency 1 up to the point where the user's key is needed.

**Inputs read for this file:** SPEC §20.7.1–§20.7.4, §40.0.2, §40.4.1–§40.4.7, §40.6, §50.4.8, §50.5 M5; `packages/content/src/types.ts` (`ZONE_ORDER`, `Biome`) and `src/data/zones.ts` (21 zones, their biome, kind, harvest state and links); `packages/client/src/battle/{moveAnims,timeline}.ts` (the sfx ids the battle timeline emits); story bible §1, §2, §6, §7; provider documentation and rate cards checked 2026-09-25 (§9, with sources).

**Reading order:** §0 numbers → §1 identity → §2 the thinning → §3 adaptive model → §4 theme prompts → §5 beds → §6 sfx → §7 mixer → §8 manifest and pipeline → §9 provider → §10 placeholders → §11 QA → §12 hand-offs.

---

## 0. THE NUMBERS

0.1 **Final counts** (asserted by `tools/audio-pipeline/test/plan.test.ts`, printed by `pnpm --filter @ewa/audio-pipeline plan`):

| Kind | Entries | Generation jobs | Generated seconds | Encoded estimate |
|---|---|---|---|---|
| Themes | 17 (11 biome + 6 cue) | 68 stems (17 × 4) | 2 742 | 58.5 MiB |
| Ambience beds | 11 (one per biome) | 11 | 682 | 14.3 MiB |
| Sfx ids, sfx bus | 129 | 238 variants | 208 | — |
| Sfx ids, ui bus | 45 (26 ui + 19 stingers) | 49 variants | 91 | — |
| **Sfx total** | **174 ids** | **287 variants** | 299 | 5.9 MiB |
| **All** | — | **366 jobs** | 3 723 | **78.7 MiB of 80 MiB** |

0.2 **Reconciling §50.4.8 with the zone list.** §50.4.8 counts "17 themes × 4 stems + 11 ambiences + every sfx variant". The zone list has 21 zones, not 17: zones share their biome's theme, so 21 zones collapse onto the 11 biome themes (`zoneThemes` maps all 21; `umbral_observatory` is a `vesper` zone, both `eclipse_shrine` and `celestial_spire` are `shrine` zones, `solenne` alone is `capital`, `the_rift` alone is `rift`, every other biome has one town and one route). The other 6 themes (`battle gym elite champion raid victory`) are cues and belong to no zone. So: **17 × 4 = 68 stems + 11 beds + 287 sfx variants = 366 jobs**. §40.4.2's "≈ 250" sfx variants became 287 because the per-type creature layers (§6.3) are 133 of them; the "~120 SFX" of §40.4.1 became 174 ids for the same reason, plus 19 stingers.

0.3 **Budget and cost.** The encoded estimate (§8.4) is 78.7 MiB against the 80 MiB ceiling of SPEC §40.6. The recommended provider (Stable Audio 2.5, §9) charges a flat $0.20 per generation: **$73.20 list for all 366 jobs**, about $85 with a typical re-roll rate. It needs **the user's API key** in `EWA_AUDIO_API_KEY`; nothing in the repo contains or defaults one.

---

## 1. SONIC IDENTITY

1.1 **The thesis.** Ewa is something's memory of a world, and the memory is thinning (story bible §1.1). A memory is most itself in its *specifics*: the particular bird, the particular bell, the cooper's particular knack. The score is therefore built so that **specificity lives in the upper register and in timbre** — the flute, the glass, the anvil's ring, the choir's vowel — while **the generic lives low**: chords, bass, pulse. Forgetting is subtraction from the top. A harvested place keeps its harmony and loses its voice, exactly as a harvested town's cooper "can still make a barrel but cannot tell you how" (story bible §2.6.3).

1.2 **Three rules every prompt obeys.**
1. **Specific, not epic.** Each biome is one instrument family doing one recognisable thing (§1.3). No generic "epic orchestral" except where the story earns it (`capital`, `champion`).
2. **Thinning is subtraction.** The biome layer carries identity above 1.2 kHz; the base layer carries harmony below it. The engine's harvested low-pass (§2.2) then removes exactly the identity and nothing else — no separate "sad" mix is ever generated.
3. **Cosmic has no body.** The shrine and the Rift are the two places outside the body registers (story bible §2.9). They get drones, bells and air — no melody that a body could hum.

1.3 **Palette per biome.** Keys and tempos are in §3.5; the prompts are in §4.

| Biome | Zones | Signature (biome layer) | Bed under it (base layer) | Story tie | What forgetting removes |
|---|---|---|---|---|---|
| grove | mirevale, mire_route | wooden flute, clarinet, kalimba; birdsong field recording in the bed | nylon guitar, upright bass, frame drum | home; Mira's meter says two-thirds; the hedgerow Seam | the flute and kalimba — the Mire Route in Act II keeps a guitar and loses its birds |
| cinder | cinderhold, ash_route | anvil ring, cimbalom sparks, solo euphonium | low brass chorale, slow bass drum | the provisioned forge; 4 100 names on a wall; the drawn hedge | the anvil's ring and the euphonium's line; `ash_route` is harvested for good, so it only ever sounds low brass |
| salt | saltmourn, tide_route | bowed glass harmonica, bowed vibraphone, harp | swelling cellos, harp arpeggios | a harbour everyone agrees was always there; the sunk quay; a marsh dim for 35 years | the glass: the tide route is `thinning`, a glass-less sea |
| storm | stormrook, galvan_route | analog synth arpeggios, portamento lead | pulse bass, sidechained pads | the grid, three pylon lines; Tam who cannot say "junction" | the arpeggios — the line still hums, the words are gone |
| marrow | marrowdig, deepcut_route | lithophone, stone clacks, marimba | bowed bass drone, struck stone | hands that remember what mouths forgot; the lit shaft | the stone melody; the pulse of the pick survives, like the cutter's hands |
| vesper | vesperveil, hollow_route, umbral_observatory | wordless choir ("ooh/aah"), detuned music box | harmonium, muted strings | memory is loose; lanterns; the Office's lens | the choir and the music box; the Observatory, harvested from the start, is a harmonium in a flat room |
| forge | forgewall, siege_route | anvil, steel plate, chains, defiant trumpet | hammered pipes, synth-bass pulse, marching snare | the town that said no in the open; made things argue with memory | the trumpet's defiance; the machinery keeps going |
| sky | skyrend, ascent_route | soaring violins, wooden flute, panpipes | string orchestra, open fifths | three centuries of star-charts, fewer stars each; the winter that stayed | the high strings — fewer stars |
| capital | solenne | full-orchestra melody, harp glissandi, trumpets | strings, low brass, a clockwork pizzicato "ledger" | the Sun-City and its open ledger; its own name at stake in Act III | the proud tune; in Act III's `thinning` the ledger ostinato is what is left |
| shrine | eclipse_shrine, celestial_spire | singing bowls, crystal bells, breathy flute | organ and string drone on an open fifth, a temple bell per bar | the sky as it was; the first night and the first morning | the bells; the fifth remains, because a fifth is the least specific interval there is |
| rift | the_rift | almost nothing: low bowed bass, a sine, a felt-piano note per bar | sub drone, a muted piano note | the floor of the Held; nothing was ever here | nothing — it is composed below 1 kHz, so the permanent harvested filter changes nothing (§2.4) |

1.4 **What is deliberately absent.** No lyrics and no words anywhere (`instrumental: true` on every prompt, "lyrics, words" in every negative). No leitmotif is promised across the 17 themes: a text-prompted generator cannot hold one melody through seventeen independent generations, and pretending it can would set QA an impossible bar. Identity travels through **timbre and key relationships**, which prompts do hold. The one recurring idea is harmonic: every victory resolves into D major, Mirevale's key (§3.6).

---

## 2. THE THINNING — HOW A FORGOTTEN PLACE SOUNDS

2.1 **Which zones, when** (`harvestState` from `packages/content`, beats from story bible §6):

| Zone | Act I | Act II | Act III | Audio consequence |
|---|---|---|---|---|
| mire_route | intact | **harvested** (beat 15) | intact (beat 27) | the grove theme loses its flute; the restored stinger plays at beat 27 |
| ash_route | harvested (beat 5, permanent) | harvested | harvested | cinder theme low-passed forever; `ui_stinger_thinning` plays once at beat 5 |
| tide_route, galvan_route, marrowdig, hollow_route | thinning | thinning | thinning | **proposal** §2.3 only |
| solenne | intact | intact | **thinning** (beat 28) → intact (beat 31) | proposal §2.3; restored stinger at beat 31 |
| umbral_observatory | harvested | harvested | harvested | vesper theme low-passed; the first harvested place the player *enters* |
| the_rift | harvested (by nature) | harvested | harvested | nothing to remove (§2.4) |

2.2 **What the engine does** (SPEC §20.7.2, verbatim values): in a harvested zone every stem is low-passed at **1 200 Hz** (`BiquadFilterNode`, Q 0.7) and the `night` stem is forced to 0. The composition is built for that filter: biome-layer prompts ask for the "bright upper register above the bed, no bass, no drums"; base-layer prompts ask for "warm low-mid register … carry the chords". So the filter removes the signature and leaves a coherent, playable piece — the audio equivalent of the flat-shaded look. Night is forced off because a forgotten place has no evening either.

2.3 **Beyond the mixer.**
- **Footsteps.** Every surface in a harvested zone plays `step_flat` — "one single dull, toneless footstep tap with no surface texture at all". The world forgot what the ground was made of. (Client hook; no SPEC change — it is a choice of sfx id.)
- **Ambience.** The bed is a `StemRef` on the music bus, so it should ride through the same filter; the grove's birdsong then goes first, which is the point. (**Proposal**: §20.7.2 says "every stem"; this reads it as including the bed.)
- **Stingers.** `ui_stinger_thinning` is the signature sound of the game: a music-box melody whose notes drop out one by one while its tone dulls to a tick. It plays when a zone is harvested in front of the player (beat 5, beat 15). `ui_stinger_restored` is its reverse and plays when `restoreZone` succeeds.
- **`thinning` zones — proposal only.** §20.7.2 knows `setHarvested(on)` and nothing between. A gentler step (biome stem −6 dB, filter at 4 kHz) for `thinning` zones would let tide_route and hollow_route sound dim rather than normal. Needs a §20.7.2 row before anyone builds it.

2.4 **The Rift.** "The flat look is not damage there; it is the floor" (story bible §2.2.3). The `rift` theme is composed below 1 kHz ("nothing above 1 kHz" is in its base prompt) so the permanent harvested filter has almost nothing to take. Its `night` stem exists only to satisfy the four-stem contract and is never heard (harvested ⇒ night forced 0).

2.5 **Legendaries lift the filter.** "A singular memory does not need the place to hold it" (story bible §7.2, sunjaw on the harvested Ash Route). During a legendary static battle the client keeps the zone's own theme, turns `threat` on, and calls `setHarvested(false)` for the fight — the one time a flat place sounds whole. At the Rift (`voidraxis`) there is nothing to restore and the filter stays. (Client behaviour; see §3.6 and §12.)

---

## 3. THE ADAPTIVE MUSIC MODEL

3.1 **Four layers per theme** (SPEC §20.7.3: four stems, sample-aligned, started together, looped from one loop point):

| Layer | World theme carries | Cue theme carries | Mixer (§20.7.2) |
|---|---|---|---|
| `base` | chords, bass, soft pulse; the only layer that must stand alone | drums, bass, rhythm section, the chords | always 1 |
| `biome` | signature instruments and the melody, upper register | counter-melody, runs, harmonic colour | 1 in the zone's own theme; 0 during the 400 ms handover |
| `night` | sparse bells/music box/pads; one soft event on beat 1 of every bar | a quiet shimmer under the fight | smoothstep over time of day, night = [0.80, 0.22); forced 0 when harvested |
| `threat` | percussion + an ostinato **on the tonic**, no melody | the lead melody and the heaviest percussion | 0 in the world, 1 in battle; raid: 1 from phase 1 |

In a world theme `threat` is heard when a trainer spots the player (`spotted`, the 400 ms before the battle swap), during swarms and hotspots, and for the whole of a legendary battle (§2.5). In a cue theme it is simply on for the fight, except in `raid` phase 0, where the fight starts as a stalk and turns at phase 1.

3.2 **The harmonic contract.** The four layers of a theme are generated independently (§9: no provider conditions one generation on another), so they are made compatible *by construction*: all four prompts carry the same bpm, key, bar count and chord list, one chord per bar; `threat` stays on the tonic; `biome` melodies are asked for in the key's pentatonic or mode; `night` is sparse enough to avoid clashes. §4.1 shows how each prompt is assembled.

3.3 **The loop contract** (SPEC §40.4.4 plus IMPLEMENTATION-NOTES D1–D3). Each stem is requested as "exactly N bars of 4/4 at B BPM … the final bar leads straight back into the first", generated **2 bars + 2 s longer** than the loop so the autocorrelation window can cover the 2 bars §40.4.4 step 3 compares. `process` finds each layer's loop (start in [0.25, 1.0] s, length within ±2 % of nominal; the five best 10 ms candidates — the true loop and its ± 1-beat aliases — are each refined to 1 ms and the best refined score wins; snapped to a zero crossing), rejects a layer that scores < 0.6 or lands > 1 % from nominal, requires the layers to agree within 5 ms, and then gives all four the **base layer's** loop, keeps 50 ms of head, and bakes a 10 ms seam cross-fade at `loopEnd` on every layer. `loopStartSec`/`loopEndSec` are identical across the four stems of a theme, so `AudioDirector` can schedule one loop point.

3.4 **Phase alignment.** Independently generated layers do not share a downbeat. `process` nudges `threat`, `biome` and `night` towards `base` by cross-correlating onset envelopes within ± ⅛ beat, and only when the shift beats the unshifted correlation by 10 % — enough to remove a flam, never enough to drag an off-beat music box or a syncopated ostinato onto the beat (a ± ½-beat window did exactly that to every placeholder night layer). A layer that is a half or whole beat out is invisible to onset correlation, because every instrument's onsets correlate at every beat: it is a listening item in §11 and is fixed by re-rolling that layer.

3.5 **Keys and tempos: the journey is a walk through shared notes.** Adjacent biomes share six or seven of their seven pitch classes, so the 400 ms handover cross-fade never sounds like two songs colliding:

| Boundary (zone → zone) | From | To | Pitch collections | Shared |
|---|---|---|---|---|
| mire_route → cinderhold | grove, D major | cinder, A dorian | D major ↔ G major | 6 of 7 |
| ash_route → saltmourn | cinder, A dorian | salt, E minor | G major ↔ G major | 7 of 7 |
| tide_route → stormrook | salt, E minor | storm, B minor | G major ↔ D major | 6 of 7 |
| galvan_route → marrowdig | storm, B minor | marrow, F# phrygian | D major ↔ D major | 7 of 7 |
| marrowdig → the_rift | marrow, F# phrygian | rift, F# open fifth | F# drone continues down | tonic held |
| deepcut_route → vesperveil | marrow, F# phrygian | vesper, F# minor | D major ↔ A major; same tonic | 6 of 7 |
| hollow_route → forgewall | vesper, F# minor | forge, C# phrygian | A major ↔ A major | 7 of 7 |
| siege_route → skyrend | forge, C# phrygian | sky, A lydian | A major ↔ E major | 6 of 7 |
| ascent_route → eclipse_shrine | sky, A lydian | shrine, E open fifth | E and B are in both | fifth held |
| eclipse_shrine → solenne → celestial_spire | shrine, E fifth | capital, E major | E and B are in both | fifth held |

Tempos are chosen per place (grove 96, storm 128, vesper 66, shrine and rift 60 …) rather than locked to one grid: the handover is 400 ms, shorter than a beat at every tempo here, so beat alignment matters less than key. **Proposal for `AudioDirector`:** start the incoming theme on the outgoing theme's next beat when that beat falls inside the 400 ms window (the manifest's `bpm` makes this computable).

3.6 **Battle sets — intro / loop A / loop B / victory.** The schema has exactly six cue themes (SPEC §20.7.4), so the seven battle kinds map onto them as below; intros and victories are stingers on the ui bus (§6), because SPEC §20.7.2 plays the victory cue there.

| Battle kind | Intro (stinger, ends on the theme's dominant) | Loop | Loop A / loop B | Victory |
|---|---|---|---|---|
| wild | `ui_stinger_intro_wild` (D minor, 160) | `battle` | 32 bars = A (bars 1–16) + B (17–32) | `ui_stinger_victory_wild` → `victory` loop |
| trainer | `ui_stinger_intro_trainer` (D minor, 160) | `battle` | as wild | `ui_stinger_victory_trainer` → `victory` |
| gym | `ui_stinger_intro_gym` (A minor, 160) | `gym` | 16 bars = A 8 + B 8 | `ui_stinger_victory_gym` → `ui_badge` → `victory` |
| elite | `ui_stinger_intro_elite` (C minor, 144) | `elite` | 16 bars = A 8 + B 8 | `ui_stinger_victory_champion` → `victory` |
| champion | `ui_stinger_intro_champion` (B minor, 168) | `champion` | 32 bars = A 16 + B 16 | `ui_stinger_victory_champion` → `victory` |
| raid | `ui_stinger_intro_raid` (F minor, 138) | `raid` | 8 bars; phase 0 = A (threat off), phase ≥ 1 = B (threat on) | `ui_stinger_victory_raid` → `victory` |
| legendary | `ui_stinger_intro_legendary` (unpitched, fits any key) | the **zone's own theme**, threat on, harvest filter lifted (§2.5) | the world theme's 16 bars | `ui_stinger_victory_legendary` → `victory` |
| defeat | — | — | — | `ui_stinger_defeat` (D minor), then the world theme returns |

Every victory stinger resolves on D and the `victory` theme is in D major at 120 bpm: whatever the fight, it resolves into Mirevale's key — home. `battle` is in D minor so a won wild battle is the parallel-major turn; `champion` is in B minor, the relative minor of the home key. A client that cannot keep the world theme for a legendary falls back to `raid` (the other "one enormous opponent" cue).

3.7 **The flow.**

```
world theme (base+biome [+night]) ─ trainer sees player ─▶ threat 1 (400 ms) + `spotted`
   └─▶ intro stinger (ui bus, 2–4 s, ends on the dominant) ─▶ battle-set theme, all layers, loop A→B→A…
         └─ win ─▶ victory stinger (ui bus, resolves on D) ─▶ `victory` loop under the results panel
         └─ lose ─▶ `ui_stinger_defeat`
   ◀── world theme fades back in (400 ms), threat 0, night by time of day, harvest filter by zone
dialogue or modal open anywhere ─▶ music bus ducked −9 dB (250 ms attack, 600 ms release)
```

3.8 **The 17 themes.** `loop s` = bars × 240 / bpm. `pri` is generation order (§8.3).

| theme | zones / use | bpm | bars | loop s | key | chords (one per bar) | pri |
|---|---|---|---|---|---|---|---|
| `grove` | mirevale, mire_route | 96 | 16 | 40.00 | D major | D, Bm, G, A, repeated four times, one chord per bar | P0 |
| `cinder` | cinderhold, ash_route | 92 | 16 | 41.74 | A dorian | Am, G, D, Am, repeated four times, one chord per bar | P1 |
| `salt` | saltmourn, tide_route | 96 | 16 | 40.00 | E minor | Em, C, G, D, repeated four times, one chord per bar | P1 |
| `storm` | stormrook, galvan_route | 128 | 16 | 30.00 | B minor | Bm, G, D, A, repeated four times, one chord per bar | P1 |
| `marrow` | marrowdig, deepcut_route | 96 | 16 | 40.00 | F# phrygian | F#m, G, F#m, Em, repeated four times, one chord per bar | P1 |
| `vesper` | vesperveil, hollow_route, umbral_observatory | 66 | 8 | 29.09 | F# minor | F#m, D, A, E, F#m, D, Bm, C#, one chord per bar | P1 |
| `forge` | forgewall, siege_route | 112 | 16 | 34.29 | C# phrygian | C#m, D, C#m, Bm, repeated four times, one chord per bar | P1 |
| `sky` | skyrend, ascent_route | 92 | 16 | 41.74 | A lydian | A, B, C#m, A, repeated four times, one chord per bar | P2 |
| `capital` | solenne | 108 | 16 | 35.56 | E major | E, C#m, A, B, repeated four times, one chord per bar | P2 |
| `shrine` | eclipse_shrine, celestial_spire | 60 | 8 | 32.00 | E open fifth | an open fifth E and B held throughout, no third | P2 |
| `rift` | the_rift | 60 | 8 | 32.00 | F# open fifth | an open fifth F# and C# held throughout, no third | P2 |
| `battle` | wild and trainer battles; also the fallback for any unlisted format | 160 | 32 | 48.00 | D minor | section A, bars 1-16: Dm, Bb, C, Dm repeated; section B, bars 17-32: Gm, Bb, C, A repeated | P0 |
| `gym` | the eight gym leaders | 160 | 16 | 24.00 | A minor | section A, bars 1-8: Am, F, G, Am, Am, F, G, E; section B, bars 9-16: Dm, F, G, E, Dm, F, G, E | P1 |
| `elite` | the three Wardens (veil, aurelia, kirei) | 144 | 16 | 26.67 | C minor | section A, bars 1-8: Cm, Ab, Eb, Bb, Cm, Ab, Fm, G; section B, bars 9-16: Ab, Bb, Cm, Cm, Ab, Bb, G, G | P2 |
| `champion` | Champion Zeon | 168 | 32 | 45.71 | B minor | section A, bars 1-16: Bm, G, D, A repeated; section B, bars 17-32: Em, G, A, F# repeated | P2 |
| `raid` | raid bosses (shared HP); also legendary statics fall back here if a client cannot keep the world theme | 138 | 8 | 13.91 | F minor | Fm, Db, Eb, C, Fm, Db, Eb, C, one chord per bar | P2 |
| `victory` | the results panel after any won battle | 120 | 8 | 16.00 | D major | D, G, A, D, Bm, G, A, D, one chord per bar | P0 |

---

## 4. THEME PROMPTS — THE 68 STEMS

4.1 **How a stem prompt is assembled** (the JSON holds the assembled text; this table holds the part that differs). Every prompt is provider-neutral plain English and reads:

> *label* + *layer text* (table below) + *layer role* + *loop contract*

- **label:** "`<Theme>` area theme for a gentle HD-2D creature-collecting RPG (`<mood>`)." — cue themes say "battle-music theme". Moods are the story ties of §1.3 and §3.6.
- **layer role**, world themes: base "harmony and pulse only, warm low-mid register, it must stand alone and carry the chords"; biome "the signature instruments and the melody, bright upper register above the bed, no bass, no drums"; night "sparse and quiet, few notes, lots of air, no drums"; threat "rhythm and tension only, percussion and an ostinato on the tonic, no melody". Cue themes: base = rhythm section with the chords; threat = **lead** (main melody + heaviest accents); biome = **counter** (counter-melody, runs, colour); night = quiet shimmer.
- **loop contract:** "Seamless loop: exactly `<bars>` bars of 4/4 at `<bpm>` BPM in `<key>`; chords: `<chords>`. Constant energy from the first beat to the last, the final bar leads straight back into the first; no intro, no ending, no fade."
- **fields:** `durationSec` = (bars + 2) × 240 / bpm + 2 (§3.3), `bpm`, `key`, `instrumental: true`, `seed` = first 4 bytes of sha256(`themes/<theme>/<layer>`), negative **M** or **C**, target **−16 LUFS** integrated, true peak ≤ −1 dBTP, **loop: yes**.
- **negatives:** **M** = "vocals, singing, lyrics, spoken words, rap, crowd noise, applause, fade-in, fade-out, ending, long silence, tempo change, key change, modulation, distortion, clipping, lo-fi hiss, vinyl crackle, radio static". **C** (layers with a wordless choir) = the same without "vocals, singing, modulation, radio static" and with "words, solo singer" — the choir may sing vowels, never words.

One assembled example, `themes/grove/base` (47 s requested, 40 s loop):

> Grove area theme for a gentle HD-2D creature-collecting RPG (home, morning, a place remembered in full detail). Warm pastoral folk bed: fingerpicked nylon-string guitar arpeggios, soft upright bass on the roots, brushed frame drum and a light shaker on every beat, gentle and unhurried. This is the BASE layer: harmony and pulse only, warm low-mid register, it must stand alone and carry the chords. Seamless loop: exactly 16 bars of 4/4 at 96 BPM in D major; chords: D, Bm, G, A, repeated four times, one chord per bar. Constant energy from the first beat to the last, the final bar leads straight back into the first; no intro, no ending, no fade.

Every night and drone layer names "one soft event on the first beat of every bar": that bar-rate onset is what lets the loop finder (§3.3) lock onto a layer that is otherwise all sustain.

4.2 **Layer texts.**

| theme | layer | layer text (the prompt is: label + this + layer role + loop contract) | neg |
|---|---|---|---|
| `grove` | base | Warm pastoral folk bed: fingerpicked nylon-string guitar arpeggios, soft upright bass on the roots, brushed frame drum and a light shaker on every beat, gentle and unhurried. | M |
| `grove` | threat | Taut frame drums and low toms in steady eighth notes, muted pizzicato cellos pulsing on D, a rising shaker; hedgerow-rustle energy. | M |
| `grove` | biome | Wooden flute and clarinet trade a simple, singable folk melody over a kalimba ostinato in D major pentatonic; birdlike grace notes; bright and close. | M |
| `grove` | night | Slow kalimba and music-box dyads on D major pentatonic, one soft chime on the first beat of every bar, a faint high string pad on D and A. | M |
| `cinder` | base | Low brass chorale: tubas, euphonium and horns in their low register sustaining the chords, a bass drum like a slow heartbeat on beats 1 and 3, warm and heavy. | M |
| `cinder` | threat | Forge percussion: taiko and anvil in driving sixteenths, snarling trombone stabs on A, bellows-like swells; hot and urgent. | M |
| `cinder` | biome | Ringing anvil strikes on beats 2 and 4 with long metallic overtones, a cimbalom throwing spark-like figures, and a solo euphonium carrying a noble, memorial melody in A dorian. | M |
| `cinder` | night | A low horn pedal on A, soft cimbalom tremolo like embers, one quiet anvil ring on the first beat of every bar, very sparse. | M |
| `salt` | base | Slow swelling cellos and double basses on the chords with a lilting triplet sway, soft harp arpeggios on every beat, like water moving under boards. | M |
| `salt` | threat | Surging low-string ostinato in triplets, timpani swelling into every downbeat, a bowed-glass cluster held on E; the tide coming in fast. | M |
| `salt` | biome | Bowed glass harmonica and bowed vibraphone singing long, bell-like melody tones in E minor, a harp answering each phrase; glassy, cold and beautiful. | M |
| `salt` | night | Tide-slow bowed glass pads, a single celesta note on the first beat of every bar, a low bowed cymbal shimmer, distant and quiet. | M |
| `storm` | base | Pulsing analog synth bass in eighth notes, warm sidechained pads on the chords, a soft four-on-the-floor kick, clean and electric. | M |
| `storm` | threat | Gated snares, tom rolls, an aggressive saw-wave ostinato on B with sidechain pumping, rising noise sweeps; voltage building. | M |
| `storm` | biome | Bright analog synth arpeggios in sixteenth notes across B minor, a gliding portamento lead melody, crisp electric sparkle; retro-futurist and precise. | M |
| `storm` | night | A slow filtered arpeggio, a detuned bell synth on the first beat of every bar, a soft sub pad on B, the feeling of a line humming at night. | M |
| `marrow` | base | Bowed double bass and low cellos droning on F# with the G above leaning on it, struck stone slabs marking every beat, earthy and patient. | M |
| `marrow` | threat | Pounding stone and floor-tom percussion with syncopated pick strikes, a low brass drone on F#; the mine shaking. | M |
| `marrow` | biome | A stone percussion ensemble: lithophone melody in F# phrygian, rock clacks, pebble shakers and pick-like strikes, a wooden marimba doubling the tune; dry and rhythmic. | M |
| `marrow` | night | Slow dripping lithophone notes, a deep bowed-bass harmonic, one distant low bell on the first beat of every bar, cavernous and still. | M |
| `vesper` | base | Harmonium and muted low strings sustaining the chords, a soft felt bass drum on the first beat of every bar, slow and candlelit. | M |
| `vesper` | threat | A slow tolling low piano cluster on F#, heartbeat timpani, dissonant string glissandi that always return to F#; something standing behind you. | M |
| `vesper` | biome | A soft wordless choir singing only "ooh" and "aah" and a slightly detuned music box carrying a lullaby-like melody in F# minor; tender and uncanny. | C |
| `vesper` | night | Celesta and music box only: one soft music-box note on the first beat of every bar and a few after it, a reversed choir swell into every other downbeat, almost not there. | C |
| `forge` | base | A mechanical ostinato of hammered metal pipes in eighth notes, a low synth-bass pulse on the chords, a marching snare; stubborn and steady. | M |
| `forge` | threat | Full industrial drive: pounding metal percussion and taiko, brass stabs on C#, clanking sixteenths; a siege line waking up. | M |
| `forge` | biome | Industrial signature: anvil and struck steel plate, chain rattles, tuned steam-hiss accents, and a defiant trumpet and horn melody in C# phrygian. | M |
| `forge` | night | Slow ringing pipe resonances, sustained bowed metal, a far foundry thump on the first beat of every bar, cold and quiet. | M |
| `sky` | base | A warm string orchestra sustaining the chords over open-fifth cellos and basses, soft timpani on beat 1 of every bar, broad and airy. | M |
| `sky` | threat | Driving low-string spiccato ostinato, pounding timpani, horns rising in fifths on A; a dragon's shadow crossing the peak. | M |
| `sky` | biome | A soaring violin melody over high tremolo strings, answered by an airy wooden flute and panpipes, lydian brightness, wind-borne and high. | M |
| `sky` | night | Star-glint harp harmonics and high string harmonics, a soft glockenspiel note on the first beat of every bar, vast and sparse. | M |
| `capital` | base | Full orchestral bed: strings on the chords, a low brass chorale, and a light clockwork pizzicato ostinato like a ledger being kept, stately and warm. | M |
| `capital` | threat | Ominous brass swells, a snare march, timpani rolls into every downbeat, low strings in stern eighth notes. | M |
| `capital` | biome | A proud full-orchestra melody on horns and violins, harp glissandi, bright trumpets and celesta sparkle; ceremonial but humane. | M |
| `capital` | night | Quiet woodwinds and celesta over muted strings, a soft harp note on the first beat of every bar, a city asleep. | M |
| `shrine` | base | A deep sustained drone on E and B from pipe organ and bowed strings, slow breathing swells, a soft temple bell struck on the first beat of every bar. | M |
| `shrine` | threat | A low timpani heartbeat on every beat, deep gong swells into each bar, the drone thickening; the old sky looking back. | M |
| `shrine` | biome | Singing bowls and crystal-bell chimes ringing on E and B, a breathy bamboo flute phrase, sacred, timeless and bright. | M |
| `shrine` | night | A high harmonic shimmer, distant singing-bowl strikes on the first beat of every bar, starry and very quiet. | M |
| `rift` | base | A sub-bass drone on F# with a slow breath in it, one muted low felt-piano note on the first beat of every bar, dark and nearly empty; nothing above 1 kHz. | M |
| `rift` | threat | A sub kick heartbeat on every beat, a low piano cluster on F#, a rumbling swell into each bar; the before, at the edge. | M |
| `rift` | biome | Almost nothing: distant low bowed double bass notes on F# and C#, a pure low sine tone, one soft low felt-piano note on the first beat of every bar. | M |
| `rift` | night | A faint high sine tone and one far-away glass ping on the first beat of every bar, barely audible. | M |
| `battle` | base | Driving live drum kit, punchy electric bass and a rhythm-string ostinato in eighth notes, orchestral rock energy; section B lifts with a half-time crash pattern. | M |
| `battle` | threat | The battle melody: unison trumpets and violins with a heroic, memorable hook in section A and a soaring answer in section B; big tom and cymbal accents. | M |
| `battle` | biome | Piano runs, woodwind flourishes and string counter-lines that answer the melody, harmonic colour only. | M |
| `battle` | night | A soft synth pad and glassy chime accents on the first beat of every bar, adding a night-time sheen under the battle. | M |
| `gym` | base | Fast rock-orchestral rhythm section: double-time drum kit, driving electric bass, staccato strings, taiko accents on every downbeat. | M |
| `gym` | threat | A fierce lead melody on horns, trumpets and violins with stabbing brass accents and a triumphant climb in section B. | M |
| `gym` | biome | Fast marimba and piano counter-lines, harp arpeggios, woodwind runs answering the lead. | M |
| `gym` | night | Shimmering synth pad and bell accents on the first beat of every bar, quiet under the fight. | M |
| `elite` | base | Pipe organ chords, timpani and orchestral bass drum in a martial pattern, staccato low strings in eighth notes, cathedral weight. | M |
| `elite` | threat | A grave, powerful melody on horns and trombones doubled by violins, with a wordless choir singing only "ah" on the long notes. | C |
| `elite` | biome | Harpsichord-like arpeggios, tubular bells and string runs weaving around the organ, severe and intricate. | M |
| `elite` | night | A high string harmonic pad and a single tubular bell on the first beat of every bar, quiet. | M |
| `champion` | base | Epic orchestral rock rhythm section: full drum kit with double kicks, driving electric bass, low brass and staccato strings, relentless. | M |
| `champion` | threat | The champion melody: full brass section and violins in octaves, heroic and tragic, a soaring climax in section B with a wordless choir singing only "ah". | C |
| `champion` | biome | Piano and harp arpeggios, woodwind and string counter-melodies, glockenspiel sparkle, the whole orchestra answering. | M |
| `champion` | night | A soft shimmering pad and crystal bell on the first beat of every bar, glowing under the fight. | M |
| `raid` | base | Massive low percussion and a heavy synth-and-brass bass ostinato, huge and slow-feeling at a fast tempo, the stalk before the fight turns. | M |
| `raid` | threat | Full war drums, pounding taiko and snare, brass stabs and a savage horn melody; the phase-one escalation. | M |
| `raid` | biome | Low string swells and synth risers answering the bass, dark colour, no melody. | M |
| `raid` | night | Eerie high pad and a bell toll on the first beat of every bar, quiet. | M |
| `victory` | base | A bright, bouncy rhythm section with brushed kit, pizzicato strings and warm bass, celebratory but gentle, easy to loop under a results panel. | M |
| `victory` | threat | A proud brass fanfare figure doubled by trumpets and horns, heard on major victories. | M |
| `victory` | biome | A cheerful wooden flute and glockenspiel melody in D major, a callback to the home theme. | M |
| `victory` | night | Soft music-box and harp notes, a chime on the first beat of every bar. | M |

---

## 5. AMBIENCE BEDS — 11

5.1 **Rules.** One bed per biome, looped on the music bus at −12 dB under the theme (SPEC §20.7.4). Requested 62 s; `process` bakes a 2 s equal-power cross-fade from the tail into the head, giving a **60 s loop** that starts at 0 (beds have no pulse, so the loop is made, not found — IMPLEMENTATION-NOTES D2). Each prompt ends "Continuous and even from start to end so it can loop, no single event louder than the rest; any tonal element (chimes, hum) sits in `<the biome theme's key>`" and carries `key` so a wind chime cannot clash with the score. Negative for all beds: "music, melody, speech, words, voices, crowd chatter, sudden loud events, fade-in, fade-out, clipping, distortion". Target −16 LUFS, true peak ≤ −1 dBTP, loop: yes. No bed contains people: in Ewa the crowd is the players.

5.2 **The beds.**

| bed | prompt (+ "continuous and even … tonal elements in <key>") | sec | loop s | LUFS | pri |
|---|---|---|---|---|---|
| `grove` | Hedgerow morning field recording: layered birdsong (wren, blackbird, finches) near and far, leaves moving in a light breeze, a small brook trickling, occasional bees; peaceful, detailed, no people. | 62 | 60 | −16 | P0 |
| `cinder` | Forge-town ambience: distant hammer rings from a smithy, a low furnace roar, wood fire crackle, warm wind carrying ash, a far cart on cobbles; no people talking. | 62 | 60 | −16 | P1 |
| `salt` | Harbour and salt-marsh ambience: gentle tide lapping on old stone, water sucking under a boardwalk, far gulls, creaking rigging, wind in reeds; grey and calm, no people. | 62 | 60 | −16 | P1 |
| `storm` | Windy hilltop grid ambience: wind across high-voltage lines, soft crackle of insulators, a distant thunder roll, gusts through a steel pylon, light drizzle now and then; no people. | 62 | 60 | −16 | P1 |
| `marrow` | Mine ambience: water dripping in a stone cavern, distant pick strikes, a slow creaking winding gear, low rumble of rock, a lamp buzzing faintly; enclosed and dim, no people. | 62 | 60 | −16 | P1 |
| `vesper` | Cliff-top graveyard at dusk: soft wind through grass and stones, lantern flames fluttering, crickets, a distant single bell now and then, the sea far below; hushed and uncanny, no people. | 62 | 60 | −16 | P1 |
| `forge` | Fortified steel town ambience: steam vents hissing, distant metal clanks and chains, heavy flags flapping, wind on stone walls, a far foundry thump; no people talking. | 62 | 60 | −16 | P1 |
| `sky` | High mountain ambience: strong wind gusts, blowing snow, distant ice cracking in a glacier, a hawk calling far away, thin cold air; vast, no people. | 62 | 60 | −16 | P2 |
| `capital` | Grand city plaza ambience: a stone fountain, pigeons, footsteps on marble echoing, distant carts, far bell tower chimes, banners in the wind; busy but calm, no voices, no words. | 62 | 60 | −16 | P2 |
| `shrine` | Open-air mountain altar at twilight: gentle wind, far soft wind chimes, crickets, a faint resonant air tone, the hush of height; sacred and still, no people. | 62 | 60 | −16 | P2 |
| `rift` | Near silence at the edge of nothing: a very low rumble, moving air, an occasional distant drip into black water, nothing else; empty and enormous. | 62 | 60 | −16 | P2 |

---

## 6. SOUND EFFECTS AND STINGERS — 174 IDS, 287 VARIANTS

6.1 **Families.**

| Family | Ids | Variants | Bus | Boot-validated (§20.7.4) |
|---|---|---|---|---|
| Battle core: `hit_*` ×4, `faint`, `switch`, `orb_*` ×4, `status_*` ×7, `stage_*` ×2, `weather_*` ×4, `flee` | 24 | 43 | sfx | all but `flee` |
| Per type (19 registers): `move_<type>`, `impact_<type>`, `cry_<type>`, `hurt_<type>` | 76 | 133 | sfx | `move_*` (the `DEFAULT_BY_TYPE` default) |
| Footsteps per surface: 11 surfaces + `step_flat`; `grass_rustle` | 13 | 39 | sfx | — |
| World: doors, warp, `spotted`, splash, lore tablet, spawn shimmer, lens hum, thunder, wind, anvil, bell, pylon, raid | 16 | 23 | sfx | — |
| UI: clicks, menus, dialogue, level-up, evolve, shop, items, healer, quests, badge, witness, trade, notify | 26 | 30 | ui | `ui_levelup` |
| Stingers: 7 battle intros, 6 victories, defeat, story beat, thinning, restored, zone title, catch | 19 | 19 | ui | — |
| **Total** | **174** | **287** | 129 sfx + 45 ui | 43 ids |

6.2 **Rules for every clip.**
- One event, dry, close, no background, mono (`process` downmixes). Sfx and ui are normalised to **−20 LUFS** integrated and must peak ≤ **−3 dBTP** after gain (SPEC §20.7.2 / §40.4.3); the per-id `gainDb` then places them in the mix (§7.2). Loop: no.
- `durationSec` ≤ 4. Clips shorter than the provider's minimum (1 s for Stable Audio) are generated at the minimum and cut back by `process`: leading silence below −50 dBFS is dropped (5 ms pre-roll kept), the clip is capped at the requested length and a 10 ms fade-out is applied.
- Variants are round-robin clips (§20.7.4 `clips.length 1..4`); variant *i* re-rolls the seed (seed + *i*). `maxConcurrent` ≤ 4 (§20.7.2 per-id concurrency); the engine's 40 ms per-id cooldown and 24-voice cap still apply.
- Ids starting `ui_` are on the ui bus and nothing else is (`validateSourceManifest` enforces it), matching `AudioDirector.play(id, null)`'s prefix rule. Stingers are `ui_stinger_*` so the victory cue lands on the ui bus as §20.7.2 requires.
- Negative prompts: **S** = "music, melody, speech, words, voice, crowd, background ambience, room reverb, long echo tail, hiss, hum, clipping, distortion"; **V** (creature voices) = "human speech, words, singing, music, melody, background ambience, room reverb, clipping, distortion"; **T** (jingles and stingers) = "vocals, singing, lyrics, speech, crowd, applause, long reverb tail, fade-in, clipping, distortion". A key (and bpm) after the code is sent with the prompt so the jingle lands in key.

6.3 **Types are registers.** "A type is the register a memory is held in" (story bible §2.4). Each of the 19 types gets four sounds in one timbral family — the wind-up (`move_*`, played at the attacker when the move starts, the `MOVE_ANIMS` default), the impact (`impact_*`), the creature's cry (`cry_*`) and its hurt yelp (`hurt_*`) — so a player can hear which register is in play with their eyes closed. Cosmic, the register of the world itself, is the only one with no body sound: a sub swell, a bloom of air, a whale-like tone.

6.4 **Client hooks beyond the boot list** (recommendations to the owner of `packages/client`; the manifest carries the clips either way):
- at impact, layer `impact_<move type>` under the `hit_*` the timeline already emits; just after a damaging hit, `hurt_<defender type>`;
- on switch-in and on a successful catch, `cry_<primary type>`; on faint, `faint` plus the same cry at `playbackRate 0.8` (no separate faint set — the dropped memory is the same voice, lower);
- footsteps by surface from the heightfield sample (`water` where the sample is water, `wood` on boardwalks), `step_flat` everywhere in a harvested zone (§2.3); `grass_rustle` while moving in an encounter patch;
- the stingers and world sounds at the moments in the "when" column.

6.5 **The full list.** `var` = variants, `sec` = requested seconds, `gain` = `gainDb`, `max` = `maxConcurrent`, `neg` = negative prompt code (+ key and bpm when sent).

| id | bus | var | sec | gain | max | pri | neg | prompt | when |
|---|---|---|---|---|---|---|---|---|---|
| `hit_normal` | sfx | 3 | 0.45 | 0 | 3 | P0 | S | A single solid impact of a creature being struck, punchy low-mid thud with a short crack, close and dry. | a hit at ×1 effectiveness |
| `hit_super` | sfx | 3 | 0.6 | 1 | 3 | P0 | S | A single very heavy, bright impact with a sharp crack and a quick bass boom, satisfying and powerful, close and dry. | a super-effective hit (×2 or more) |
| `hit_weak` | sfx | 2 | 0.4 | -3 | 3 | P0 | S | A single soft, muffled impact, dull and small, like a blow absorbed by padding, close and dry. | a not-very-effective hit |
| `hit_crit` | sfx | 2 | 0.7 | 1 | 2 | P0 | S | A single critical-hit impact: a sharp glassy crack layered over a heavy punch and a brief metallic ring, close and dry. | a critical hit |
| `faint` | sfx | 2 | 1.3 | -2 | 2 | P0 | S | A creature collapsing: a soft heavy body fall on the ground followed by a gentle descending whoosh, no voice. | a creature faints (the client layers the creature's cry at playbackRate 0.8) |
| `switch` | sfx | 2 | 0.9 | -4 | 2 | P0 | S | A capture orb opening: a bright mechanical click, a short beam-of-light whoosh and a soft pop as a creature appears. | recall / send out |
| `orb_throw` | sfx | 2 | 0.8 | -3 | 2 | P0 | S | A small hard orb thrown through the air: a quick hand whoosh then a spinning whistle ending in a light tap. | catch orb leaves the hand |
| `orb_shake` | sfx | 3 | 0.5 | -4 | 1 | P0 | S | A small closed orb wobbling on the ground: two muffled plastic-and-metal rattles, tense and quiet. | each catch shake (up to 3) |
| `orb_catch` | sfx | 1 | 1.5 | -2 | 1 | P0 | S | A small orb locking shut: a firm mechanical click, a tiny spark crackle and a soft settling tone. | catch success (the ui_stinger_catch jingle follows) |
| `orb_break` | sfx | 2 | 0.9 | -3 | 1 | P0 | S | A small orb bursting open: a sharp pop, a spray of light shimmer and a whoosh as the creature escapes. | catch fail, the creature breaks free |
| `status_burn` | sfx | 2 | 1 | -5 | 2 | P0 | S | A creature catching fire: a quick flame flare whoosh and crackling burn, short. | burn applied / burn tick |
| `status_poison` | sfx | 2 | 1 | -5 | 2 | P0 | S | Poison taking hold: a bubbling, gurgling ooze with a small sickly hiss, short. | poison applied / tick |
| `status_paralyze` | sfx | 2 | 1 | -5 | 2 | P0 | S | Paralysis: a crackling electric seize with stuttering static zaps, short. | paralysis applied / tick |
| `status_sleep` | sfx | 2 | 1.2 | -6 | 2 | P0 | S | Falling asleep: a soft descending chime-like whistle and a gentle airy puff, drowsy. | sleep applied / tick |
| `status_freeze` | sfx | 2 | 1 | -5 | 2 | P0 | S | Freezing solid: rapid ice crystallising with crackles and a glassy lock. | freeze applied / tick |
| `status_confuse` | sfx | 2 | 1 | -6 | 2 | P0 | S | Confusion: a woozy warbling tone circling and bending in pitch with little birdlike twitters. | confusion applied / tick |
| `status_heal` | sfx | 2 | 1.2 | -6 | 2 | P0 | S | Healing: a warm rising shimmer of soft bells and a gentle breath of air. | any HP restore, drain or absorb |
| `stage_up` | sfx | 1 | 0.9 | -6 | 2 | P0 | S | A stat rising: a quick bright ascending sweep with a small sparkle at the top. | a stat stage rises |
| `stage_down` | sfx | 1 | 0.9 | -6 | 2 | P0 | S | A stat falling: a quick dull descending sweep with a soft thud at the bottom. | a stat stage falls |
| `weather_sun` | sfx | 1 | 2.5 | -6 | 1 | P0 | S | Harsh sunlight breaking through: a warm swelling whoosh with a bright shimmering heat haze. | weather set: sun |
| `weather_rain` | sfx | 1 | 3 | -6 | 1 | P0 | S | Rain beginning: a quick build from scattered drops to steady rainfall on the ground. | weather set: rain |
| `weather_sand` | sfx | 1 | 3 | -6 | 1 | P0 | S | A sandstorm rising: a gusting wind swell full of hissing, rattling sand grains. | weather set: sand |
| `weather_hail` | sfx | 1 | 3 | -6 | 1 | P0 | S | Hail starting: a gust followed by hard ice pellets clattering on stone and ground. | weather set: hail |
| `flee` | sfx | 1 | 1 | -6 | 1 | P0 | S | Running away: quick scrambling footsteps on grass fading off, with a small whoosh. | a successful flee |
| `move_normal` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a normal-type creature attack: a quick cloth-and-air whoosh of a body lunging, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_normal) |
| `impact_normal` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a normal-type attack: a solid padded thump of a body blow, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_normal` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a normal-type creature: a plain, friendly mid-pitched mammal chirp-bark; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_normal` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small normal-type creature hurt: a short startled yelp; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_fire` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a fire-type creature attack: a gas-flare ignition whoosh that roars up, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_fire) |
| `impact_fire` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a fire-type attack: a fireball burst with crackling embers, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_fire` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a fire-type creature: a raspy crackling growl with an ember hiss; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_fire` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small fire-type creature hurt: a hissing yelp like water on coals; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_water` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a water-type creature attack: a rushing swirl of water gathering, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_water) |
| `impact_water` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a water-type attack: a heavy splash burst of water, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_water` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a water-type creature: a bubbly gurgling seal-like chirp; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_water` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small water-type creature hurt: a wet sputtering squeal; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_grass` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a grass-type creature attack: leaves rustling into a vine whip crack, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_grass) |
| `impact_grass` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a grass-type attack: a leafy thwack with scattering seeds, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_grass` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a grass-type creature: a soft reedy whistle with a woody creak; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_grass` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small grass-type creature hurt: a squeaky woody creak of pain; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_electric` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a electric-type creature attack: a rising capacitor charge whine, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_electric) |
| `impact_electric` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a electric-type attack: a sharp electric zap and crack, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_electric` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a electric-type creature: a buzzy chirp with crackling static; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_electric` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small electric-type creature hurt: a fizzing squeak with a spark pop; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_ice` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a ice-type creature attack: frost crystallising with a glassy tinkle, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_ice) |
| `impact_ice` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a ice-type attack: an ice-shard shatter, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_ice` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a ice-type creature: a glassy high call with a breathy chill; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_ice` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small ice-type creature hurt: a brittle high yelp with a crackle of frost; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_fighting` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a fighting-type creature attack: a fast punch-and-kick whoosh, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_fighting) |
| `impact_fighting` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a fighting-type attack: a meaty punch impact, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_fighting` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a fighting-type creature: a short determined grunt-bark (animal, no words); expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_fighting` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small fighting-type creature hurt: a winded animal grunt; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_poison` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a poison-type creature attack: a bubbling ooze gathering, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_poison) |
| `impact_poison` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a poison-type attack: an acid splat with a sizzle, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_poison` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a poison-type creature: a wet hissing croak; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_poison` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small poison-type creature hurt: a gurgling hiss; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_ground` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a ground-type creature attack: an earth rumble building under the feet, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_ground) |
| `impact_ground` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a ground-type attack: a dirt burst thud with pebbles falling, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_ground` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a ground-type creature: a low burrowing grumble; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_ground` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small ground-type creature hurt: a low muffled grunt; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_flying` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a flying-type creature attack: a strong wing flap gust, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_flying) |
| `impact_flying` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a flying-type attack: an air-slash whoosh ending in a thwip, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_flying` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a flying-type creature: a bright bird screech call; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_flying` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small flying-type creature hurt: a sharp bird squawk; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_psychic` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a psychic-type creature attack: a shimmering phase tone rising in pitch, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_psychic) |
| `impact_psychic` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a psychic-type attack: a warped pulsing wub impact, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_psychic` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a psychic-type creature: an eerie humming chime-like call; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_psychic` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small psychic-type creature hurt: a wavering glassy whine; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_bug` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a bug-type creature attack: a fast insect wing buzz, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_bug) |
| `impact_bug` | sfx | 2 | 0.6 | -3 | 3 | P0 | S | The impact of a bug-type attack: a chitin crunch with a click, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_bug` | sfx | 2 | 1.2 | -4 | 2 | P0 | V | A small creature's cry for a bug-type creature: a rapid clicking chitter; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_bug` | sfx | 1 | 0.5 | -6 | 2 | P0 | V | A small bug-type creature hurt: a short shrill chirr; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_rock` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a rock-type creature attack: stones grinding together, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_rock) |
| `impact_rock` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a rock-type attack: a boulder crash with gravel scatter, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_rock` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a rock-type creature: a gravelly low rumble-growl; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_rock` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small rock-type creature hurt: a stony grunt with a crunch; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_ghost` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a ghost-type creature attack: a hollow breath swelling backwards, airy, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_ghost) |
| `impact_ghost` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a ghost-type attack: a hollow spectral thump with a short echo, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_ghost` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a ghost-type creature: an airy wordless moaning wail; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_ghost` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small ghost-type creature hurt: a thin fading whimper-wail; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_dragon` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a dragon-type creature attack: a deep roaring breath intake, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_dragon) |
| `impact_dragon` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a dragon-type attack: a heavy draconic blast of air and force, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_dragon` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a dragon-type creature: a big reptile roar; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_dragon` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small dragon-type creature hurt: a pained reptile snarl; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_steel` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a steel-type creature attack: a metal blade ring and scrape, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_steel) |
| `impact_steel` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a steel-type attack: a heavy metal clang, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_steel` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a steel-type creature: a metallic resonant clank-growl; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_steel` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small steel-type creature hurt: a metallic grinding grunt; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_fairy` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a fairy-type creature attack: a sparkling chime sweep, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_fairy) |
| `impact_fairy` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a fairy-type attack: a bright bell-burst impact, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_fairy` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a fairy-type creature: a tinkling trill (no human voice); expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_fairy` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small fairy-type creature hurt: a sad tinkling squeak; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_dark` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a dark-type creature attack: a low sinister whoosh, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_dark) |
| `impact_dark` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a dark-type attack: a dull muted bite and snap, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_dark` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a dark-type creature: a low hissing snarl; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_dark` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small dark-type creature hurt: a guttural hiss; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `move_cosmic` | sfx | 2 | 0.8 | -4 | 2 | P0 | S | The wind-up of a cosmic-type creature attack: a deep sub-bass swell with starry shimmer, building for about half a second, no impact at the end. | attacker, at windup start (MOVE_ANIMS default move_cosmic) |
| `impact_cosmic` | sfx | 2 | 0.6 | -3 | 3 | P1 | S | The impact of a cosmic-type attack: a vast bloom of air and chime, like light arriving, sharp attack and a short tail. | defender, at impact, layered with hit_* (client hook, bible §7.3) |
| `cry_cosmic` | sfx | 2 | 1.2 | -4 | 2 | P1 | V | A small creature's cry for a cosmic-type creature: a distant resonant whale-like tone; expressive, not human, no words. | switch-in, catch, faint at rate 0.8 (client hook) |
| `hurt_cosmic` | sfx | 1 | 0.5 | -6 | 2 | P1 | V | A small cosmic-type creature hurt: a deep wavering hum dropping away; short, not human, no words. | defender, just after a damaging hit (client hook) |
| `step_grass` | sfx | 3 | 0.35 | -14 | 4 | P0 | S | One single footstep of a light walking shoe on soft grass and leaf litter, close-miked and dry, no second step. | local and remote players on grass surfaces |
| `step_dirt` | sfx | 3 | 0.35 | -14 | 4 | P0 | S | One single footstep of a light walking shoe on packed dry dirt path, close-miked and dry, no second step. | local and remote players on dirt surfaces |
| `step_gravel` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on loose gravel, close-miked and dry, no second step. | local and remote players on gravel surfaces |
| `step_sand` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on damp sand, close-miked and dry, no second step. | local and remote players on sand surfaces |
| `step_stone` | sfx | 3 | 0.35 | -14 | 4 | P0 | S | One single footstep of a light walking shoe on hard stone paving, close-miked and dry, no second step. | local and remote players on stone surfaces |
| `step_wood` | sfx | 3 | 0.35 | -14 | 4 | P0 | S | One single footstep of a light walking shoe on hollow wooden boardwalk planks, close-miked and dry, no second step. | local and remote players on wood surfaces |
| `step_metal` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on a steel grate walkway, close-miked and dry, no second step. | local and remote players on metal surfaces |
| `step_snow` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on fresh crunchy snow, close-miked and dry, no second step. | local and remote players on snow surfaces |
| `step_water` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on ankle-deep shallow water, close-miked and dry, no second step. | local and remote players on water surfaces |
| `step_ash` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on soft ash and cinders over stone, close-miked and dry, no second step. | local and remote players on ash surfaces |
| `step_salt` | sfx | 3 | 0.35 | -14 | 4 | P1 | S | One single footstep of a light walking shoe on a crunchy salt crust, close-miked and dry, no second step. | local and remote players on salt surfaces |
| `step_flat` | sfx | 3 | 0.3 | -16 | 4 | P0 | S | One single dull, toneless footstep tap with no surface texture at all, as if on nothing in particular, close and dry. | every surface in a harvested zone (bible §2.3) |
| `grass_rustle` | sfx | 3 | 0.6 | -10 | 3 | P0 | S | Walking through tall grass: a single brushing rustle of long stems against legs. | moving through an encounter patch |
| `door_open` | sfx | 2 | 0.9 | -8 | 2 | P0 | S | A wooden house door opening: latch click and a short creak. | entering a building warp |
| `door_close` | sfx | 1 | 0.7 | -8 | 2 | P0 | S | A wooden door closing gently with a latch click. | leaving a building warp |
| `door_heavy` | sfx | 1 | 1.6 | -8 | 1 | P1 | S | A heavy steel-banded gate or stone door grinding open with a deep clunk. | gyms, forgewall bastion, observatory, shrine doors |
| `warp` | sfx | 1 | 0.8 | -10 | 1 | P0 | S | A soft airy transition whoosh with a faint chime, like stepping through a threshold. | interior/exterior warp, zone handover |
| `spotted` | sfx | 1 | 0.6 | -6 | 1 | P0 | S | A sharp alert sting: a quick bright two-note exclamation blip with a whoosh (not musical phrase, just an alert). | a trainer's line of sight catches the player |
| `splash` | sfx | 2 | 0.8 | -8 | 2 | P1 | S | A medium splash of something stepping into or jumping into water. | entering water, fishing, creatures in water |
| `lore_tablet` | sfx | 1 | 2 | -10 | 1 | P1 | S | An old stone tablet awakening: a low resonant stone hum with a soft shimmer of dust. | reading a lore tablet |
| `spawn_shimmer` | sfx | 2 | 1.2 | -10 | 3 | P0 | S | A creature condensing out of the air: a soft rising shimmer, like breath on glass turning into a small pop of presence. | a wild creature precipitating at a Seam |
| `lens_hum` | sfx | 1 | 3 | -8 | 1 | P2 | S | A great glass lens powering: a deep electrical hum rising with a faint glassy whine, then settling. | the Provision lens (observatory, assessments) |
| `thunder` | sfx | 2 | 3.5 | -4 | 1 | P1 | S | A close thunder crack followed by a rolling rumble. | storm biome weather, raid hotspots |
| `wind_gust` | sfx | 2 | 2.5 | -8 | 2 | P1 | S | A single strong wind gust rising and falling. | sky and storm biomes, ledges |
| `anvil_strike` | sfx | 2 | 1.2 | -8 | 2 | P1 | S | One hammer strike on an anvil with a long bright metallic ring. | cinder and forge smithies (positional emitter) |
| `bell_toll` | sfx | 1 | 3.5 | -8 | 1 | P1 | S | One distant, deep town bell toll with a long natural decay. | vesper and capital on the hour |
| `pylon_crackle` | sfx | 2 | 1.5 | -10 | 2 | P1 | S | High-voltage crackle and buzz from a power line insulator, erratic. | storm biome pylons (positional emitter) |
| `raid_roar` | sfx | 1 | 2.5 | 0 | 1 | P2 | S | An enormous monster roar, deep and long, with a ground-shaking low end. | raid boss appears / phase change |
| `raid_phase` | sfx | 1 | 2 | -4 | 1 | P2 | S | A massive impact boom with a shattering crack and a rising rumble, signalling a boss growing stronger. | raid phase ≥ 1 begins |
| `ui_click` | ui | 2 | 0.15 | -14 | 2 | P0 | S | A tiny soft wooden click, like a small bead tapped on a board, clean and short. | button press (mixer: click −14 dB) |
| `ui_confirm` | ui | 1 | 0.35 | -12 | 1 | P0 | S | A soft pleasant two-tone confirm chime, warm and rounded. | confirm, select move |
| `ui_back` | ui | 1 | 0.25 | -14 | 1 | P0 | S | A soft short descending pluck, like closing a small wooden box. | back / cancel |
| `ui_error` | ui | 1 | 0.4 | -10 | 1 | P0 | S | A soft low dull double buzz-thunk, clearly "no" but not harsh. | invalid action (mixer: error −10 dB) |
| `ui_toast` | ui | 1 | 0.6 | -12 | 1 | P0 | S | A gentle bright notification chime, one soft bell ping with a short tail. | toast (mixer: toast −12 dB) |
| `ui_open` | ui | 1 | 0.35 | -14 | 1 | P0 | S | A soft paper-and-wood swish of a menu or journal opening. | menu / panel open |
| `ui_close` | ui | 1 | 0.3 | -14 | 1 | P0 | S | A soft paper-and-wood swish of a menu or journal closing, slightly lower. | menu / panel close |
| `ui_tab` | ui | 1 | 0.15 | -16 | 1 | P1 | S | A very small soft page-flick tick. | tab change |
| `ui_type` | ui | 3 | 0.06 | -22 | 2 | P0 | S | One tiny soft typewriter-like tick, very short and quiet. | dialogue text reveal, every third glyph |
| `ui_dialogue_advance` | ui | 1 | 0.2 | -16 | 1 | P0 | S | A soft short pop-click, like a page turning in a small book. | advance dialogue |
| `ui_levelup` | ui | 1 | 1.8 | -6 | 1 | P0 | T · D major | A bright level-up jingle made of quick rising bell and marimba notes ending on a sparkle. | level up (timeline ui_levelup) |
| `ui_evolve_start` | ui | 1 | 3.5 | -8 | 1 | P1 | T · D major | A building shimmer: rising glassy tones and airy whoosh, growing in intensity, with a heartbeat-like pulse. | evolution sequence starts |
| `ui_evolve_done` | ui | 1 | 3 | -6 | 1 | P1 | T · D major | A radiant burst of bells and a warm major chord bloom, then a gentle sparkle tail. | evolution completes |
| `ui_shop_buy` | ui | 2 | 0.6 | -10 | 2 | P1 | S | Coins dropping into a leather purse, a small satisfying jingle. | purchase |
| `ui_shop_sell` | ui | 1 | 0.6 | -10 | 1 | P1 | S | A few coins counted onto a wooden counter. | sell |
| `ui_shop_deny` | ui | 1 | 0.4 | -10 | 1 | P1 | S | A soft empty purse shake and a low dull tap, "not enough". | cannot afford |
| `ui_item_use` | ui | 1 | 0.8 | -12 | 1 | P1 | S | A small glass bottle uncorked with a soft fizz. | use an item |
| `ui_item_get` | ui | 1 | 1.5 | -8 | 1 | P0 | T · D major | A cheerful short item-found jingle of plucked strings and a bell. | item picked up / received |
| `ui_heal` | ui | 1 | 2.5 | -8 | 1 | P0 | T · D major | A calm healing jingle: soft harp and bell arpeggio rising and resolving. | healer restores the party |
| `ui_save` | ui | 1 | 0.8 | -14 | 1 | P1 | S | A soft quill scratch and a small wax-seal thump. | progress saved |
| `ui_quest` | ui | 1 | 1 | -10 | 1 | P1 | S | A soft paper unrolling with a gentle chime, a new task. | quest accepted |
| `ui_quest_done` | ui | 1 | 2 | -8 | 1 | P1 | T · D major | A satisfying short completion jingle: warm plucked chord and a bell. | quest completed |
| `ui_badge` | ui | 1 | 3 | -6 | 1 | P1 | T · D major | A proud short brass-and-bell flourish for earning a badge, triumphant but brief. | badge received |
| `ui_witness` | ui | 1 | 1.6 | -8 | 1 | P0 | T · D major | A soft recording sound: a gentle mechanical shutter click followed by a warm rising chime, something being remembered. | a new species witnessed (Dex entry) |
| `ui_trade` | ui | 1 | 1.5 | -10 | 1 | P1 | S | A light exchange sound: two soft whooshes crossing and a gentle chime. | trade complete |
| `ui_notify` | ui | 1 | 0.5 | -14 | 1 | P1 | S | A very soft double ping, unobtrusive. | friend online, mention, invite |
| `ui_stinger_intro_wild` | ui | 1 | 2 | -4 | 1 | P0 | T · D minor 160 | A short battle intro sting: a quick orchestral swoosh, snare roll and brass hit landing on an A major chord (dominant of D minor), energetic. | wild battle begins, then theme battle |
| `ui_stinger_intro_trainer` | ui | 1 | 2.5 | -4 | 1 | P0 | T · D minor 160 | A short trainer-battle intro sting: rising strings, a snare roll and two stabbing brass hits ending on an A major chord (dominant of D minor). | trainer battle begins, then theme battle |
| `ui_stinger_intro_gym` | ui | 1 | 3 | -4 | 1 | P1 | T · A minor 160 | A gym-leader battle intro: taiko hits, a fast string run and a bold brass rise ending on an E major chord (dominant of A minor). | gym battle begins, then theme gym |
| `ui_stinger_intro_elite` | ui | 1 | 3.5 | -4 | 1 | P2 | T · C minor 144 | A Warden battle intro: a grave pipe-organ chord, timpani roll and low brass swell ending on a G major chord (dominant of C minor). | elite battle begins, then theme elite |
| `ui_stinger_intro_champion` | ui | 1 | 4 | -3 | 1 | P2 | T · B minor 168 | A champion battle intro: the full orchestra rising with a massive timpani roll and brass fanfare ending on an F sharp major chord (dominant of B minor). | champion battle begins, then theme champion |
| `ui_stinger_intro_raid` | ui | 1 | 3.5 | -3 | 1 | P2 | T · F minor 138 | A raid intro: war drums and a monstrous low brass blast rising into a C major chord (dominant of F minor), huge. | raid begins, then theme raid |
| `ui_stinger_intro_legendary` | ui | 1 | 4 | -3 | 1 | P2 | T | An unpitched vast swell for meeting a legendary creature: a reversed cymbal, deep drum roll and a sub boom, no melody and no chord, awe. | legendary static begins; the world theme stays and threat turns on (bible §4.5) |
| `ui_stinger_victory_wild` | ui | 1 | 2.5 | -4 | 1 | P0 | T · D major 120 | A short victory jingle: bright brass and strings in D major, a quick rising figure resolving on a D major chord. | wild battle won, then theme victory |
| `ui_stinger_victory_trainer` | ui | 1 | 3 | -4 | 1 | P0 | T · D major 120 | A victory fanfare: trumpets and strings in D major, a proud rising figure resolving on D. | trainer battle won, then theme victory |
| `ui_stinger_victory_gym` | ui | 1 | 3.5 | -3 | 1 | P1 | T · D major 120 | A triumphant victory fanfare for beating a gym leader: full brass, timpani and strings in D major resolving on a big D chord. | gym won, then ui_badge and theme victory |
| `ui_stinger_victory_champion` | ui | 1 | 4 | -3 | 1 | P2 | T · D major 120 | A grand, emotional victory fanfare: full orchestra in D major, brass and strings soaring to a final D major chord. | elite or champion won, then theme victory |
| `ui_stinger_victory_raid` | ui | 1 | 4 | -3 | 1 | P2 | T · D major 120 | A huge communal victory fanfare: drums, brass and strings in D major, celebratory, resolving on D. | raid cleared, then theme victory |
| `ui_stinger_victory_legendary` | ui | 1 | 4 | -3 | 1 | P2 | T · D major 120 | A hushed, awed victory: soft strings and bells in D major rising to a warm D chord with a shimmering tail. | legendary caught or beaten, then theme victory |
| `ui_stinger_defeat` | ui | 1 | 3 | -5 | 1 | P0 | T · D minor 120 | A gentle defeat sting: a slow descending phrase on muted strings and piano in D minor, sad but not bleak, ending softly on D. | the party is out (whiteout) |
| `ui_stinger_beat` | ui | 1 | 3 | -6 | 1 | P0 | T | A soft story sting: a single sustained low string note under three quiet music-box notes, thoughtful, unresolved. | a story beat starts (music ducked) |
| `ui_stinger_thinning` | ui | 1 | 4 | -5 | 1 | P2 | T | A music-box melody that forgets itself: notes drop out one by one and the tone grows duller and more muffled until only a dull tick remains. | a zone becomes harvested in front of the player |
| `ui_stinger_restored` | ui | 1 | 4 | -4 | 1 | P2 | T · D major | The reverse of forgetting: a dull tick blossoms into a bright music-box melody, notes returning one by one, ending on a warm open chord. | a zone is re-remembered (restoreZone) |
| `ui_stinger_title` | ui | 1 | 2.5 | -8 | 1 | P0 | T | A soft zone-title sting: a gentle harp glissando and a single warm chime. | zone name card on first entry |
| `ui_stinger_catch` | ui | 1 | 2.5 | -4 | 1 | P0 | T · D major 120 | A short cheerful catch-success jingle: plucked strings and bells in D major ending on a bright D chord. | after orb_catch |

---

## 7. MIXER DESIGN

7.1 **The engine's values** (SPEC §20.7.2, restated so this file can be read alone; the SPEC wins on any difference):

| Bus / parameter | Value | How this bible uses it |
|---|---|---|
| master | 0 dB; compressor −12 dB threshold, knee 6, ratio 4, attack 3 ms, release 250 ms | catches stinger + battle peaks; nothing is mastered louder to fight it |
| music | −6 dB | the four stems and the ambience bed (bed at a further −12 dB) |
| sfx | −3 dB | everything not `ui_*`, positional through the HRTF panner |
| ui | −8 dB | `ui_*` including every stinger; non-positional |
| duck | music −9 dB while dialogue or a modal is open; 250 ms attack, 600 ms release | `ui_stinger_beat` plays inside a duck, so it is written soft (§6.5) |
| battle swap | world theme out 400 ms, battle theme in 400 ms; victory cue on the ui bus | intro stinger covers the swap; victory stingers resolve into the `victory` loop (§3.6) |
| stems | threat 0 world / 1 battle / 1 raid phase ≥ 1; night by time of day; biome 1, 0 during handover; base 1 | the layer roles of §3.1 are written for exactly these gains |
| harvested | all stems low-passed 1 200 Hz, Q 0.7; night 0 | §2.2 |
| panner, listener | HRTF, inverse, ref 4, max 60, rolloff 1.5; listener = camera | sfx are mono and dry so the panner and reverb place them |
| reverb send | outdoor 0.12, plaza 0.18, interior 0.35, cave/shrine/rift 0.50; algorithmic IRs 0.5 / 1.2 / 2.4 s | every sfx prompt asks for "dry, no room reverb" — the room comes from here, per zone |
| polyphony | 24 voices, 40 ms per-id cooldown, ≤ 4 per id, quietest stolen | `maxConcurrent` per id ≤ 4 (§6.5) |
| ui levels | hover 0 (silent — no `ui_hover` clip exists), click −14, error −10, toast −12 dB | transcribed as those ids' `gainDb` |
| loudness | stems −16 LUFS, sfx peaks ≤ −3 dBTP | §40.4.3 in `process`; sfx/ui at −20 LUFS |

7.2 **`gainDb` policy** (per-id, applied after normalisation; changing it needs no regeneration because it is outside the prompt hash): impacts 0 to +1 (`hit_super`, `hit_crit` +1, `hit_weak` −3); `faint` −2; `impact_*` −3, `move_*` −4, `cry_*` −4, `hurt_*` −6; status −5/−6; weather −6; footsteps −14 (`step_flat` −16, quieter still); world emitters −8/−10; raid roar 0; ui per §7.1, other ui −8 to −16, text ticks −22; stingers −3 to −8 (intros and big victories loudest).

7.3 **Gain staging and a proposal.** Every stem is normalised to −16 LUFS on its own, so a sparse night layer arrives as loud as the full base, and four uncorrelated layers sum to about −10 LUFS before the music bus (≈ −16 LUFS after it) while a hit at `gainDb` 0 sits near −23 LUFS momentary after the sfx bus. **Proposal for §20.7.2:** constant layer trims inside `AudioDirector` — `biome` −2 dB, `threat` −3 dB, `night` −6 dB relative to `base` — restoring the written balance without breaking the "stems −16 LUFS" rule the manifest's `lufs` field reports. Until then, "battle hits read over the battle theme at default settings" is a listening check (§11).

---

## 8. THE MANIFEST AND THE PIPELINE

8.1 **This file → data.** §4–§6 are transcribed into `.design/audio/manifest.json` in the exact SPEC §40.4.1 shape (sorted keys, 2-space indent, trailing LF; arrays sorted by id). `tools/audio-pipeline/test/manifest.test.ts` fails if any theme, bed or sfx id in the JSON is missing from this file's tables, if the JSON is not in canonical form, or if a stem's duration, bpm or key breaks §3.3. zod (`src/schema.ts`) plus cross-field rules reject: unknown or missing theme ids, a `zoneThemes` key that is not a `ZoneId` or a zone that is missing (checked against `@ewa/content` `ZONE_ORDER`), a zone mapped to a theme other than its biome's, layers disagreeing on bpm/key/length, sfx > 4 s, a ui-bus id without the `ui_` prefix (or the reverse), and any boot-validated sfx id that is absent.

8.2 **Commands** (`pnpm --filter @ewa/audio-pipeline <script>`; flags after `--`):

| Script | Needs | Does |
|---|---|---|
| `plan` | nothing | validates, expands 366 jobs, diffs `.cache/audio/jobs.json`, prices them, estimates bytes, writes `qa/plan.json`; `--verbose` lists every job |
| `generate` | `EWA_AUDIO_API_KEY` | uncached jobs → `.cache/audio/raw/<requestHash>.wav` (never committed); without the key prints `audio-pipeline: EWA_AUDIO_API_KEY not set — skipping generation (N jobs pending); run plan to see them` and exits 0; `--only themes/grove,sfx/hit_` limits by id prefix |
| `process` | ffmpeg ≥ 6.0 with libopus | loops, normalisation, Opus/AAC, `public/audio/manifest.json`, `qa/process-report.json`; refuses without ffmpeg |
| `placeholders` | ffmpeg | `process --placeholders` (§10) |
| `all` | key + ffmpeg | plan → generate → process, re-rolling rejected clips (seed + 1000, ≤ 2 times) for up to 3 rounds |

8.3 **Generation order.** `pri` in §3.8, §5.2 and §6.5: **P0** = the vertical slice (Mirevale and Mire Route: `grove`, `battle`, `victory`, the grove bed, every boot-validated sfx, the slice's eight creature types, core ui and the wild/trainer battle stingers) — 170 sfx variants + 12 stems + 1 bed; **P1** = Act I–II; **P2** = endgame (`sky`, `capital`, `shrine`, `rift`, `elite`, `champion`, `raid` and their stingers). Run P0 first with `--only` so the slice sounds finished while the rest renders; `process --placeholders` fills whatever is not generated yet.

8.4 **Budget** (SPEC §40.6: `public/audio/` ≤ 83 886 080 B). Estimate from the manifest at the encode settings (`src/budget.ts`, asserted by `budget.test.ts`):

| Class | Seconds encoded | Opus (webm) | AAC (m4a) | Estimate |
|---|---|---|---|---|
| 68 stems | loop + 70 ms each | 96 kb/s stereo, constrained VBR | 112 kb/s | 58.5 MiB |
| 11 beds | 60 s each | 80 kb/s stereo | 96 kb/s | 14.3 MiB |
| 287 sfx clips | 299 s total | 64 kb/s mono | 80 kb/s mono | 5.9 MiB |
| **Total** | | | | **78.7 MiB** |

A full placeholder build measured 77.8 MiB, which the estimate matches to within 1 %. The long-loop, slow themes (`vesper` 66 bpm, `shrine` and `rift` 60 bpm) are 8 bars and `battle` is 160 bpm rather than 152 for this reason; a bible edit that pushes the estimate over 80 MiB fails CI before any credit is spent.

8.5 **Determinism.** Same cache, same bytes: seeds are derived from ids, the loop search is integer-grid and tie-broken, gains are applied in float32 in TypeScript, encoders run with `-fflags +bitexact -flags:a +bitexact -map_metadata -1`, and `process` twice over the same inputs is byte-identical with manifests equal after deleting `builtAt` (asserted in `plan.test.ts`).

8.6 **Deviations from SPEC §40.4** are listed with reasons in `tools/audio-pipeline/IMPLEMENTATION-NOTES.md` (stem tail of 2 bars, ambience loops made by cross-fade, one loop point per theme with phase alignment, constrained VBR and the sfx/ambience bitrates, 44.1 kHz provider output resampled in `process`, a priced `estimatedCost`).

---

## 9. PROVIDER EVALUATION AND RECOMMENDATION

9.1 **What exists, callable from Node with a key** (documentation and rate cards checked 2026-09-25; "this manifest" is `plan --provider <name>` over the 366 jobs at list price):

| Provider / endpoint | Generates | Length | Loop | Seed | Output | Licence for a monetised, multi-platform game | This manifest |
|---|---|---|---|---|---|---|---|
| **Stability AI Stable Audio 2.5** — `POST api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio`, `authorization: Bearer`, multipart | music, beds, sfx; audio-to-audio and inpainting exist | 1–190 s | no flag | yes, 0–4 294 967 294 | WAV/MP3, 44.1 kHz stereo | "you own the Output", no tier condition, no attribution; don't present it as human-made or strip provenance marks | **$73.20** (flat $0.20 per generation) |
| Stable Audio 3.0 — async `…/stable-audio/text-to-audio` + poll | same | 1–380 s | no | yes | 44.1 kHz | same | $95.16 ($0.26) |
| ElevenLabs Music — `POST /v1/music`, `xi-api-key` | music, sections via `composition_plan` | 3 s – 5 min | no | only with a plan, not reproducible | `pcm_48000`, MP3 | self-serve plans exclude "Studio Games" (monetised **and** on more than one platform); Enterprise needed | $6.86 stems + subscription |
| ElevenLabs Sound Effects — `POST /v1/sound-generation` | sfx, short beds | 0.5–30 s | yes (`loop`, v2) | no | `pcm_48000`, MP3, Opus | royalty-free commercial use on any paid plan | $0.62 sfx; beds > 30 s must be tiled |
| Google Lyria 2 — Vertex `lyria-002:predict`, OAuth token | instrumental music | fixed 30 s | no | yes | 48 kHz WAV (base64) | Google claims no ownership; SynthID watermark; not on Google's IP-indemnity list | $26.64 by tiling 30 s clips; no sfx |
| Lyria 3.5 / 3 Clip — Gemini API, `x-goog-api-key` | music, length by prompt | ≈ 30 s clips / songs | no | no | MP3 (WAV on 3.5) | as above, SynthID on all output | $0.04–0.08 per clip |
| Beatoven.ai — `POST public-api.beatoven.ai/api/v1/tracks/compose` | music **with stems** (bass, chords, melody, percussion), `looping` | by prompt | yes | not documented | WAV | "cleared for commercial use"; API price unpublished | unknown |
| Mubert API v3 | music, `mode: loop`, `bpm`, `key` | parameter | yes | not documented | MP3/WAV | keys on request; terms unpublished | unknown |
| fal.ai `stable-audio-25` | Stable Audio 2.5, hosted | 190 s | no | yes | file URL | commercial | $0.20 per generation |
| Suno, Udio | — | — | — | — | — | no public API (Suno exploring a partner programme, July 2026) | — |
| Replicate `meta/musicgen` | music | — | — | — | — | CC-BY-NC weights: **excluded** | — |

Sources: platform.stability.ai/docs/api-reference, platform.stability.ai/pricing, stability.ai/terms-of-service; elevenlabs.io/docs/api-reference/music/compose, elevenlabs.io/docs/api-reference/text-to-sound-effects/convert, elevenlabs.io/pricing/api, elevenlabs.io/eleven-music-model-specific-terms; docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation, ai.google.dev/gemini-api/docs/music-generation, cloud.google.com/terms/generative-ai-indemnified-services; beatoven.ai/api; mubert.com/api/docs.

9.2 **Recommendation: Stability AI Stable Audio 2.5 — NEEDS THE USER'S KEY.** Implemented as `tools/audio-pipeline/src/providers/stable-audio.ts`, reading `EWA_AUDIO_API_KEY` and nothing else.
- **Licence first.** Ewamon is a monetised game (battle pass) on the web and whatever follows; ElevenLabs' music terms exclude exactly that below Enterprise, and Lyria carries a watermark and no indemnity. Stability assigns the output to the customer with no tier condition.
- **One key, all three kinds.** Stems, beds and sfx from one adapter, one rate card, one invoice.
- **Seeds.** The pipeline's cache, re-rolls (seed + 1000) and round-robin variants (seed + *i*) assume a seeded provider; Stable Audio is the only music-capable candidate with reproducible seeds.
- **Length.** 190 s covers the longest request (a 32-bar battle stem at 53 s, the 62 s beds), and the flat price makes the 2-bar loop tail (§3.3) free.
- **Weaknesses, accepted:** 44.1 kHz output (resampled to 48 kHz by `process`); no negative prompt (the manifest's `negative` stays in the request hash and in this file, and is not sent); no loop flag (loops are found, §3.3); sfx cost as much as a stem, so sfx are $57 of the $73; very short ui ticks are the likeliest QA rejects.
- **Fallback, not implemented:** if QA rejects many sfx, add an ElevenLabs Sound Effects adapter for kinds `sfx`/`ui` only (licence fine on a paid plan, $0.62 for all 287 clips); the `AudioProvider` interface and the provider name in `requestHash` already support a per-kind split.

9.3 **Cost.** List $73.20 for 366 jobs. At one re-roll for a quarter of the stems and a tenth of the rest, about $85; **a 10 000-credit ($100) top-up covers the manifest with room for a second pass on the P0 themes.** Stability's 429 limit (150 requests / 10 s) is far above the adapter's default concurrency of 2.

9.4 **Running it** (the user, once, with their own key — never committed, never logged):

```
$env:EWA_AUDIO_API_KEY = '<your Stability key>'        # PowerShell, this shell only
pnpm --filter @ewa/audio-pipeline plan
pnpm --filter @ewa/audio-pipeline generate -- --only themes/grove,themes/battle,themes/victory,ambience/grove
pnpm --filter @ewa/audio-pipeline generate              # the rest
pnpm --filter @ewa/audio-pipeline process               # then listen (§11) and re-run `all` for re-rolls
```

---

## 10. PLACEHOLDERS — THE GAME PLAYS BEFORE GENERATION

10.1 **Level 0, silent.** With no `public/audio/manifest.json` the client runs silent: SPEC §20.7.4 logs missing ids in dev and boots on; `play()` is a no-op for them. A fresh clone is always playable.

10.2 **Level 1, synthesized.** `pnpm --filter @ewa/audio-pipeline placeholders` synthesizes a deterministic stand-in for every job (`src/placeholder.ts`) and runs the real `process` over them: stems are beat grids in the theme's key, bpm and bar count (chords on the base layer, a percussion-and-tonic ostinato on threat, a pentatonic pluck melody on biome, off-beat music box and a drone on night), beds are filtered-noise textures, sfx are short families (clicks, bursts, thumps, chirps, arpeggio stingers). The output is real Opus/AAC and a complete §20.7.4 manifest, so loop scheduling, the night and threat ramps, the harvested filter, ducking, the battle swap and the budget can all be exercised. On this machine the full set (366 clips) takes 6–10 minutes and comes to 77.8 MiB; every one of the 17 themes locks onto its nominal loop within 5 ms. `qa/process-report.json` lists every placeholder in `placeholders[]`.

10.3 **Level 2, mixed.** Generate P0 first; `process --placeholders` uses generated WAVs where they exist and stand-ins elsewhere, so the slice sounds real while Act II is still synthetic.

10.4 **Placeholders are never shipped.** They are not committed (they would add ~80 MB of binaries to history only to be replaced); the M5 release rule (§11.3) requires `placeholders: []`.

---

## 11. QA CHECKLIST

11.1 **Automated — must be green before anyone listens.**
- [ ] `pnpm --filter @ewa/audio-pipeline plan` exits 0: manifest valid, 21 zones mapped, 43 boot-validated sfx ids present, estimate ≤ 80 MiB.
- [ ] `pnpm vitest run tools/audio-pipeline` green: job count, `ZONE_ORDER` validation, the 4-bar 120 bpm click track loops at 8.000 s ± 5 ms, a fixture normalises to −16 LUFS ± 1, the key-less skip line is exact, `process` is deterministic after deleting `builtAt`, the provider adapter honours its HTTP contract without touching the network.
- [ ] `qa/process-report.json`: `rejected: []`; every theme present in `themes` with base score ≥ 0.6; every `flagged` entry heard and either accepted or re-rolled; `bytes.total ≤ 83 886 080`.
- [ ] Every stem's `lufs` within −16 ± 1; every sfx clip's post-gain true peak ≤ −3 dBTP.

11.2 **Listening — per theme** (headphones, then laptop speakers):
- [ ] Each layer solo: base stands alone and carries the chords; biome has no bass and no drums; night is sparse; threat has no melody and sits on the tonic.
- [ ] All four together through three loop passes: no click at the seam, no flam, no drift, no whole-beat offset (§3.4); nothing clashes harmonically.
- [ ] With a 1.2 kHz low-pass (the harvested state): still coherent, identity gone (§2.2). `rift` sounds unchanged.
- [ ] Handover into each neighbour of §3.5 over 400 ms: no collision.
- [ ] No vocals, no pseudo-lyrics, no word-like syllables — the commonest generative failure; choirs sing vowels only.
- [ ] No fade-in, fade-out or ending inside the loop; no watermark-like tones or artifacts.
- [ ] Battle sets: intro stinger → theme → victory stinger → `victory` resolves in D major, for all seven kinds (§3.6).

11.3 **Listening — sfx and mix.**
- [ ] Each clip is one event, starts within 5 ms, has no cut tail and no music; its variants differ but belong together.
- [ ] Type registers are recognisable blind (play `move_*`/`impact_*` for five types to someone who has not seen the list).
- [ ] UI sounds are not fatiguing after 100 repetitions; `ui_type` is barely there.
- [ ] Battle hits read over the battle theme at default settings (§7.3); dialogue ducks music and stays intelligible.
- [ ] **Release rule (M5):** `plan` lists every entry; `generate` ran with the user's key; tests green; every zone theme has a detected loop point; `placeholders: []`; `rejected: []`; the provider's terms page saved beside the release notes as provenance.

---

## 12. HAND-OFFS AND OPEN ITEMS

- **Client (`packages/client`, not owned here):** implement `AudioDirector` per SPEC §20.7; the sfx hooks of §6.4; legendary battles keep the world theme with threat on and the harvest filter lifted (§2.5, §3.6), falling back to `raid`; stingers per §3.6; `step_flat` in harvested zones.
- **SPEC proposals (§20.7.2), none built:** a `thinning` step (§2.3); the ambience bed rides the harvest filter (§2.3); constant layer trims (§7.3); start the incoming theme on the outgoing theme's next beat (§3.5).
- **User:** supply `EWA_AUDIO_API_KEY` for Stability AI and approve the ~$100 spend (§9.3); then run §9.4 and the §11 listening pass.
