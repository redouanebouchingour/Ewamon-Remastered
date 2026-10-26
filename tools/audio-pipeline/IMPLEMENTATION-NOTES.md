# audio-pipeline — implementation notes and deviations from SPEC §40.4

The SPEC is not edited. Every place where this implementation does something other than the letter of
`.design/SPEC.md` §40.4 / §50.4.8 is listed here with the reason and the evidence. Written 2026-09-25.

## Environment when written

- ffmpeg **8.1.2** (gyan.dev full build, libopus + native aac) on PATH, so every ffmpeg-gated test ran.
- Provider key: none. Nothing here calls the network in tests; the adapter tests inject `fetch` and `env`.
- `pnpm install --offline` added `@ewa/content` (workspace) and `zod` to this package; the lockfile change is the
  `tools/audio-pipeline` importer block only.
- `process` was **not** run into `packages/client/public/audio/` (owned by the client agent). Three full placeholder runs
  were made into scratch directories; the last: 366/366 clips, 0 rejected, all 17 themes at nominal loop ± 5 ms, 77.82 MiB
  (estimate 78.71 MiB), 6.4 min.

## Deviations

| # | SPEC says | Implemented | Why |
|---|---|---|---|
| D1 | §40.4.4: stems generated `bars × 4 × 60 / bpm + 2` s | `(bars + 2) × 240 / bpm + 2` s (`STEM_TAIL_BARS = 2`) | Step 3 compares "k covering 2 bars" after `s + L`; a 2 s tail cannot hold 2 bars. Measured on the first full placeholder run with the 2 s tail: 20 of 68 stems landed one or two beats off nominal (a ≤ 1.75 s window holds 2–4 onsets, whose normalised correlation is ≈ 1 at any beat-aligned lag). Free at Stable Audio's flat per-generation price; the tail is trimmed by `process`. The longer window alone still left 12 stems on a 1-beat alias (second run), because on a 10 ms grid a loop length that is not a whole number of hops (e.g. 35.556 s at 108 bpm) splits every onset between two bins; step 4 therefore refines the **5 best coarse L peaks** (coarse RMS window 30 ms) at 1 ms and keeps the best refined score, ties to the L nearest nominal. Third run: 68/68 placeholder stems at nominal ± 5 ms. |
| D2 | §40.4.4: loop points by autocorrelation for stems **and ambience** | Ambience loops are *made*: a baked 2 s equal-power cross-fade from tail into head; loop = [0, T − 2 s) (plus pre-skip) | Beds have no onsets; onset autocorrelation on wind/water is noise and would reject every bed. |
| D3 | §40.4.4: snap `s` and `s + L` per stem; stems of a theme agree within 5 ms | One loop per theme: the base layer's `(s, L)` for all four; other layers nudged towards base (onset cross-correlation within ± ⅛ beat, applied only when it beats lag 0 by 10 %); head trimmed to 50 ms before `loopStart`; 10 ms seam cross-fade baked before `loopEnd` on every layer; the 5 ms agreement check is kept as a reject rule | `AudioDirector` schedules one loop point (§20.7.3). A 5 ms per-stem disagreement drifts 5 ms more every pass. Independently generated layers do not share a downbeat, so `s` alone does not align them. A ± ½-beat window (tried first) shifted every placeholder night layer — written on the off-beats — by half a beat onto the beat; ± ⅛ beat removes flams without touching syncopation. Half- and whole-beat offsets are invisible to onset correlation (bible §3.4 makes them a listening item). |
| D4 | §40.4.5: Opus `-vbr on`, 96 k (sfx 64 k mono); AAC 128 k. §40.4.7: stems AAC 112 k, ambience AAC 96 k | Opus `-vbr constrained`; stems Opus 96 k / AAC 112 k; ambience Opus **80 k** / AAC 96 k; sfx Opus 64 k mono / AAC **80 k** mono | Unconstrained VBR measured 123 kb/s on a 40 s tonal stem at a 96 k target (constrained: 99 kb/s), which the 80 MB ceiling cannot absorb. With the bible's 17 themes the estimate is 78.7 MiB only with the ambience/sfx reductions. |
| D5 | §40.4.2: the adapter writes a 48 kHz WAV | The raw cache keeps the provider's WAV (Stable Audio: 44.1 kHz stereo); `process` decodes every input to 48 kHz float with ffmpeg's resampler | Stable Audio has no 48 kHz option; resampling once, in the step that already needs ffmpeg, keeps `generate` free of ffmpeg. |
| D6 | §40.4.2: `qa/plan.json` = `{ total, cached, toGenerate, estimatedSeconds, estimatedCost: null }` | Same five fields, `estimatedCost` = USD at the provider's list price for the uncached jobs; added `provider`, `costBasis`, `fullCost`, `byKind`, `counts`, `bytes` (size estimate), `jobs` | The provider is now chosen (bible §9), so the price is known without a key. |
| D7 | Task brief: "normalise via ffmpeg loudnorm two-pass" | §40.4.3 as written: `loudnorm` measuring pass (`print_format=json`) → static gain applied in TypeScript → true peak by `ebur128=peak=true` → post-gain loudness re-measured and written as `lufs` | §40.4.3 forbids dynamic two-pass loudnorm (it changes the envelope and the loop points). Clips < 1 s are measured with `apad=whole_dur=1`, which the BS.1770 gate ignores. |
| D8 | §40.4.3: reject and re-run with `seed + 1000` | Reject + re-roll up to `MAX_REROLLS = 2` (persisted in `.cache/audio/rerolls.json`); after that, and always for placeholders, the gain is clamped to the ceiling and the clip is flagged in `qa/process-report.json` | Unbounded re-rolls could spend without end. `manifest.json` is written only when nothing awaits a re-roll. |
| D9 | — | Sfx trimming: leading silence (< −50 dBFS) dropped with 5 ms pre-roll, capped at the requested `durationSec`, 10 ms fade-out | Providers have minimum lengths (Stable Audio 1 s); a 0.15 s click is generated at 1 s and cut back. |
| D10 | §40.4.7 names `determinism.test.ts` | The determinism assertion is in `plan.test.ts` (as §50.4.8's binding row lists it); `budget.test.ts` per §40.6; plus `manifest.test.ts`, `loop.test.ts`, `provider.test.ts` | One slow ffmpeg test instead of two identical ones. |
| D11 | §40.4.1: `zoneThemes` validated against `ZONE_ORDER` | Also: `zoneThemes[z]` must equal the zone's `biome` from `@ewa/content` `ZONES`; ambience ids must equal their biome; ui bus ⇔ `ui_` prefix; every boot-validated sfx id (§20.7.4) must exist | Catches the transcription errors that would otherwise surface as a silent id at client boot. |
| D12 | §40.4.6: the output type is §20.7.4 verbatim, not restated | Restated in `src/output-manifest.ts` | A tool may not import `@ewa/client` (§40.0.2 rule 5). The client's `packages/client/src/audio/manifest.ts`, written concurrently by the client agent, declares the identical shape (checked 2026-09-25); `manifest.test.ts` pins the key sets. |
| D13 | §40.4.1 "~120" sfx; §40.4.2 "≈ 250" variants | 174 ids (45 on the ui bus, 19 of them stingers), 287 variants | Bible §0.2: 19 types × (move, impact, cry, hurt) alone is 76 ids / 133 variants. |
| D14 | §40.4.5: loop points shifted by the Opus pre-skip | Implemented (312 samples read back with ffprobe `initial_padding`); AAC priming is left to the MP4 edit list (ffprobe reports `initial_padding` 0 for the m4a) | **Resolved 2026-10-06 (Phase E4):** measured in headless Chrome, `decodeAudioData` trims the pre-skip (a 60 s bed decodes to exactly 2 880 000 frames), so the shift put every bed's loopEnd 6.5 ms past its buffer. Loop points are now written unshifted (`LOOP_POINTS_INCLUDE_PRESKIP = false`); spec §40.4.5 amended. |
| D15 | — | `-map_metadata -1` added to the bitexact flags | Keeps container metadata out of the hashed bytes. |

## Things the SPEC leaves open that the code decides

- Job ids are the output paths (`themes/<t>/<layer>`, `ambience/<biome>`, `sfx/<id>_<n>`, n from 1).
- URLs in the output manifest are root-absolute, `/audio/<layout path>?v=<hash8>` (`--url-base` changes the prefix),
  because the client's `AudioDirector` fetches `url` as written and loads the manifest from `/audio/manifest.json`;
  the webm hash serves both `url` and `urlFallback`.
- `requestHash` includes the provider name, so switching provider re-plans every job.
- Seeds in the source manifest are the first 4 bytes of `sha256(<job id stem>)`; sfx variant *i* uses seed + *i*.

## Phase E4 ingest (2026-10-06): CC0 sources instead of a paid provider

The user chose CC0 packs (orchestral/adventure) over Stable Audio. **Nothing was downloaded**: the candidate list is
`.design/audio/sources.candidates.md` (41 downloads awaiting approval), and `.design/audio/sources.json` is an empty
mapping (`$comment` only) until the files exist. Spec: `.design/spec/40-pipelines.md` §40.4.8.

### Commands

- `ingest` (`src/ingest.ts`): for every job `sources.json` covers, it decodes the file with ffmpeg (wav, ogg, mp3, flac, or anything else ffmpeg reads) to 48 kHz float, applies `trim` and `gainDb`, and shapes the audio (below). It writes `rawWavPath(cache, requestHash)` plus a `jobs.json` record `{ provider: 'cc0', source: { file, sha256, role: direct|layer|variant, from? } }`, and saves incrementally. Outputs: `qa/ingest-report.json` (coverage, ingested, cached, missing, blocked, failed, overrides, stretch ratios) and the credits. It exits 1 when anything is missing or failed, but every other job is still ingested. A missing file is a report line, never a throw.
- `credits` (`src/credits.ts`) writes `assets-src/audio/CREDITS.md` (one row per source file: title, author, licence, page, file, the jobs it fills, with derived jobs counted) and the licence texts listed from `assets-src/audio/licenses/`. It also writes `public/audio/CREDITS.txt`, which the client ships; Settings → Audio links to it. `ingest` runs it at the end. The output is deterministic, with no dates.
- `--provider cc0` (or `EWA_AUDIO_PROVIDER=cc0`) changes three commands:
  - `plan` and `process` use the source salts and tempo overrides, so `process` finds the ingested WAVs.
  - `plan` writes `qa/plan-cc0.json`, so the committed `plan.json` (Stable Audio) is not replaced.
  - `generate` prints that cc0 has no generator.
  - `all` runs plan → ingest → process.
  - `pnpm … cc0` is `all --provider cc0 --placeholders`: unmapped jobs stay placeholders.

### sources.json

Format: `{ "<jobId>": { file, licence: "CC0-1.0", author, url, title?, licenceFile?, trim?: [s, e], gainDb?, bpm?, bars?, crossfadeSec?, derive?, note? } }`.
- Keys starting with `$` are ignored.
- Validation is in `src/sources.ts`. Entries with problems are dropped and reported:
  - a licence other than `CC0-1.0`
  - a key that is not a job id
  - `bpm`/`bars`/`derive` outside a theme's base entry
  - `crossfadeSec` outside themes
  - `..` or an absolute path in `file`
- Malformed JSON is a config error (exit 1, message).

### requestHash and the cache

`requestHash(provider, kind, prompt, salt?)` appends the salt only when one exists, so **every provider-generated hash is unchanged** (a test pins this). The salts:
- direct job: `sha256('cc0', INGEST_RECIPE, sha256(file bytes), JSON(trim, gainDb, bpm, bars, crossfadeSec))`
- derived layer: `sha256(base salt, 'layer', layer, DERIVE_RECIPE)`
- sfx variant: `sha256(sibling salt, 'variant', ratio)`

What re-ingests:
- A swapped or edited file re-ingests exactly the jobs made from it (a test covers this).
- Editing attribution (author, url, title, note) re-ingests nothing.
- Bumping `INGEST_RECIPE` / `DERIVE_RECIPE` re-ingests everything affected.

Salted jobs ignore `rerolls.json`, because a fixed file cannot be re-rolled.

### Shaping

| Kind | What the ingest writes |
|---|---|
| theme stem | The region (`trim`, default the whole file) is one seamless loop; `crossfadeSec` bakes a seam fade from the audio just before `trim[0]` (`bakeSeamCrossfade`). It is conformed to the theme's nominal loop `bars × 240 / bpm`: equal ±2 samples passes through; up to ±6 % is time-stretched with ffmpeg `atempo` over three tiled periods, keeping the middle one so the stretched loop still joins itself; beyond that, a clear error says to set `trim` to whole bars or declare `bpm`/`bars`. It is then laid out like a generated stem: 0.5 s of the loop's own tail, then the loop, repeated to `(bars + 2) × 240 / bpm + 2` s. That is periodic by construction, so `findLoop` scores ≈ 1. |
| tempo override | A base entry's `bpm`/`bars` re-time the theme (`applySourceOverrides`: theme bpm/bars and every stem prompt's bpm + durationSec). `process` finds the loop at the track's real length and writes the real `bpm` to the output manifest, instead of forcing a track written at 128 bpm onto the bible's 96. `bars` may be any integer 2–64 here, because the client reads loop points, not bars. |
| derived layers | Used when a theme has only a base track (`derive` defaults to true). Each layer is an ffmpeg-filtered copy of the same periodic signal. The kept window starts ≥ 8 s into the filtered stream at the same loop phase, so the filters are in steady state and the copies stay periodic and sample-aligned with base. RMS is set relative to base over the loop. The layers follow the roles in audio-bible §3.1:<br>• **threat**: 110 Hz–7 kHz band → slow-attack compressor (transients punch through) → a decaying eighth-note gate locked to the loop downbeat (depth 0.65); −6 dB.<br>• **biome**: above 2.2 kHz (two poles), widened (`extrastereo=m=2`), eighth- and quarter-note echoes; −10 dB. The harvested 1 200 Hz low-pass removes it entirely, as the bible intends.<br>• **night**: below 1 kHz (two poles), widened, 1-, 2- and 3-beat echoes as a soft wash; −9 dB. |
| ambience | Stereo, trimmed, cut to the bed's `durationSec`. Must be ≥ 6.5 s for process's 2 s loop cross-fade. |
| sfx / ui | Mono, trimmed. A clip longer than the id's `durationSec` (after its −50 dBFS lead-in) fades out over min(0.25 s, 30 %) and is cut there, so process's cap is not an abrupt cut. A missing variant is a sibling's clip pitch-shifted (`asetrate` + `aresample`; ratios ±1 then ±2 semitones, `VARIANT_PITCH`). |

### Deviations / decisions

| # | Decision | Why |
|---|---|---|
| E4-1 | Stems for single-track themes are **derived in ingest**, not handled by single-stem themes in the client | Derivation keeps the four-stem contract (§20.7.3/§20.7.4), threat/night still change the music in battle and at night, and nothing downstream changes. The alternative (themes with only `base`) would make every CC0 theme lose its battle intensity and night colour. The client was still made tolerant of absent layers (below) as a safety net. |
| E4-2 | `process`: derived layers skip `alignLag` and **take the base layer's static gain** (`normaliseClip(..., fixedGainDb)`); base is normalised first | Independent normalisation to −16 LUFS would raise a −10 dB "air" layer by 10 dB and turn base + biome into a +6 dB coherent doubling. With linked gain, the relations ingest set (−6/−10/−9 dB) survive. The output theme gets `derived: ['threat','biome','night']` (optional field; the client type has it as `DerivedStem[]`). |
| E4-3 | `process`: a CC0 source is **fixed**: loop / true-peak rejections are flagged with the gain clamped, never queued for a re-roll | A re-roll bumps the seed, which for a salted job only changes the hash and then finds no WAV. |
| E4-4 | Licence must be exactly `CC0-1.0` | The user's decision. CC-BY items are listed as excluded in the candidates file. |
| E4-5 | One file per job; no multi-file mixing in `sources.json` | Keeps the hash and credits model simple. Beds or sfx that need layering are premixed into `assets-src/audio/cc0/mix/` (noted in the candidates file). |
| E4-6 | `assets-src/audio/cc0/` is gitignored; `assets-src/audio/licenses/` and `CREDITS.md` are tracked | Same policy as the creature and model sources (re-fetchable from the URLs in `sources.json`). `licenses/CC0-1.0.txt` is the full CC0 1.0 legal code (creativecommons.org `legalcode.txt`); the seven Kenney packs' own `License.txt` files sit next to it as `KENNEY-<pack>-License.txt`. |

### Client (`packages/client/src/audio/`)

- `manifest.ts` adds `DerivedStem` and the optional theme field `derived`.
- `AudioDirector.startTheme` now handles three cases:
  - **Absent layer:** a layer missing from the theme stays silent instead of throwing.
  - **Derived layer without base:** it is never played (a filtered copy alone sounds broken). A generated layer still plays without base, as before.
  - **Double start (pre-existing bug, fixed):** the first user gesture reached `startTheme` twice, once via `ensureContext` and once via `init`. Every stem started twice, at double level, and the loop scheduler tracked only one copy. A generation token now lets only the latest call start sources.
- Tests: `packages/client/test/audio-stems.test.ts`, using a fake AudioContext.

### Tests

`test/ingest.test.ts` (14 tests; the ffmpeg-gated ones skip with a reason when ffmpeg is missing). Every fixture is synthesised in the test. Ogg and FLAC inputs are transcoded locally with ffmpeg. The tests cover:
- validation and classification
- coverage
- salts (unsalted hashes unchanged, content change, attribution vs trim)
- tempo overrides
- credits rows / markdown / text
- `conformLoop` (stretch 2 %, refuse above 6 %)
- derived layers: 4 equal lengths, periodic ≥ 0.999, differ from base
- `fitSfx`
- ingest: WAVs + records + layer levels within ±0.5 dB of the recipe + credits files
- re-ingest is all cache hits
- an edited file re-ingests only its 2 jobs
- `process --provider cc0` gives a complete manifest: one shared loop at nominal ± 5 ms, `derived` flagged, threat ≥ 3 LU under base
- missing files reported with their derived siblings blocked
- an absent `sources.json`

### Not done here → done in "Phase E4 downloads" below

All five items (downloads, the real `sources.json`, the premixes, the licence texts, the `process` run) were done on
2026-10-06 after the user approved the downloads.

## Phase E4 downloads (2026-10-06)

The user approved the 41 downloads in `.design/audio/sources.candidates.md`. Raw files sit in `assets-src/audio/cc0/` (gitignored).
`DOWNLOADS.json` there records the url, file, bytes, sha256 and the licence line quoted from each item's page. Those pages are
saved under `_pages/`. Nothing was executed. Every zip was listed before extraction and held only ogg/wav/txt files, plus
Kenney `.url`/`desktop.ini`, which were not extracted.

### What was fetched

- **58 files, 227.0 MB.**
  - **37 approved rows.** All 7 Kenney packs, all 8 rubberduck packs, the 17 music tracks, and A1 and A3–A6. Every page still said "CC0" (Kenney: "License: Creative Commons CC0"; OGA: "License(s): CC0"; M17: "OGA-BY 3.0, CC0", taken under CC0).
  - **21 substitute files.** All from OpenGameArt, every page "License(s): CC0":
    - **S1 (itch.io, lentikula "Basic Spell Impacts").** itch's own no-payment flow ("No thanks, just take me to the downloads") returned Cloudflare 522/525, then redirected back to the item page. I did not push past it. Replacements:
      - "Magic Spell SFX" (JaggedStone)
      - "Freeze Spell" (artisticdude)
      - "Cure Magic" (Someoneman)
      - "Teleport Spell" (Ogrebane)
      - "Ghost breath" (qubodup)
      - "Earth Element Magic Spell" (qubodup)
      - "RPG Sound Pack" (artisticdude; spells, swings, monster NPC voices, inventory foley)
    - **A2 (Freesound ocean waves, needs a login).** Replacements: "Beach Ocean Waves" and "Water Waves" (qubodup). These are CC0 extracts of Freesound #18363 (jasinski) and #11505 (transitking), and the OGA page states CC0.
    - **A7 (Freesound Torino plaza, login).** No download. The capital bed is a premix: fountain (R8 water_flowing + R5 water loop), echoing footsteps (K3), distant low-passed traffic as carts (R5 highway), far bells (R4), cloth flaps (K4). It has no pigeons and no crowd.
    - **A8 (Freesound drone, login, and its licence was unverified).** No download. The shrine bed is a premix: wind (A6), crickets (A5), a low-passed Kenney engine drone as the "resonant air tone", and sparse glass chimes (K3).
- Kenney packs are small: 0.4–5.6 MB each, not the "unknown" in the candidates list.

### Coverage: 366 / 366 jobs (100 %)

- **Themes: 17/17.** 17 base tracks + 51 derived layers.
- **Ambience: 11/11.** 10 premixes + 1 grove file passed through the bed limiter.
- **Sfx and ui ids: 174/174.** 270 variants mapped directly; 17 are pitch-derived siblings.
- **Premixes: 74.** All in `assets-src/audio/cc0/mix/`, built by `_tools/mix.py` (deterministic). `mix/MIXES.json` lists the parts of each. Each premix is credited through its `parts`; see the new `sources.json` field below.
- **`sources.json`.** Generated by `assets-src/audio/cc0/_tools/gen-sources.mjs` from a mapping table plus `DOWNLOADS.json` and `MIXES.json`. Edit the table and re-run it; do not hand-edit 298 entries.
- **Credits.** `CREDITS.md` / `CREDITS.txt` list 325 source files by 24 authors.

### Theme loop windows (no listening possible: chosen by analysis)

Tools are under `assets-src/audio/cc0/_tools/` (gitignored):
- `analyze.py`: tempo by onset autocorrelation.
- `freeloop.py`: a free (s, L) search by chroma + log-mel self-similarity.
- `seamcheck.py`: waveform correlation of the audio around s against s+L, at −3…+3 s.

Each theme is a window of whole bars at the track's own tempo (`bpm`/`bars` declared, so nothing is stretched). It has a seam fade where the material does not repeat exactly. "corr" is the waveform correlation at the seam (1.0 = identical repeat).

| Theme | Track | Window | Bars @ bpm | Seam |
|---|---|---|---|---|
| battle | Battle Theme A | 28.82 + 39.46 s | 24 @ 145.97 | corr ≈ 0.4 (same material, varied), 1 s fade |
| gym | Battle Theme B | 2.09 + 20.00 | 12 @ 144 | 0.67 / 0.53, 0.75 s |
| champion | Epic Boss Battle | 51.39 + 49.37 | 36 @ 175 | **weak** (through-composed), 2 s |
| elite | Dramatic Boss Encounter | 4.92 + 15.00 | 8 @ 128 | 0.74 clean repeat; short |
| raid | Determined Pursuit | 50.97 + 36.00 | 24 @ 160 | 1.00 exact |
| victory | Victory Theme | 19.37 + 19.64 | 9 @ 110 | ≈ 0.35, 1 s |
| grove | Town Theme | 43.24 + 31.04 | 12 @ 92.8 | **weak** (no repeat anywhere in the track), 2 s |
| capital | New Sunrise V2 | 44.95 + 36.92 | 16 @ 104 | 0.87–0.90 |
| cinder | Entering the Volcano | 54.10 + 32.00 | 16 @ 120 | 0.77–0.80 |
| forge | Factory Ambiance | 26.10 + 36.00 | 12 @ 80 | 0.85 / 0.56 |
| marrow | Crystal Cave | 4.16 + 33.71 | 14 @ 99.66 | **weak** (0.45), 1.5 s |
| rift | Post Apocalyptic Wastelands, 100–142 s low-passed 1 kHz (premix) | 6.00 + 32.00 | 8 @ 60 (bible) | no pulse; 2 s fade |
| salt | Seaside Village | 43.56 + 24.00 | 16 @ 160 | 0.50 / 0.39 |
| shrine | Dark Shrine Loop | 5.02 + 25.09 | 9 @ 86.1 | 0.67, 1.5 s |
| sky | Rise Of The Early Dawn | 69.57 + 16.00 | 8 @ 120 | 0.86–0.90; short |
| storm | Energy Storm | 35.62 + 41.38 | 20 @ 116 | 0.90–0.95 |
| vesper | Creepy Forest | 29.93 + 36.00 | 10 @ 66.7 | 0.80 / 0.81 |

**Budget shaped these choices.** Every theme second costs about 107 KB (4 layers × Opus + AAC), so the shipped whole-file loops (Boss Battle 123 s, Wastelands 323 s) cannot ship whole. The total is 523 s of theme loop against the bible's 621 s.

**Tempo may not match the bible.** The bible's tempos and keys are not matched (e.g. battle 146 rather than 160; storm 116 rather than 128). The output manifest carries each track's real `bpm`.

### Stingers and designed sfx

- **Stingers.** The 19 `ui_stinger_*` are excerpts of the CC0 tracks themselves, cut on an onset: New Sunrise for the champion intro and the gym / raid / champion victories, Victory Theme for the wild / trainer victories, the battle themes for the wild / trainer intros, and Crystal Cave for beat / restored / thinning. `thinning` is a premix of a Crystal Cave phrase with notes gated out and a closing low-pass. Three come from Kenney Pizzicato jingles (catch rising, defeat descending, picked by pitch contour). `fitSfx` fades every excerpt's tail.
- **Creature sounds.** Cries and hurts were picked from the rubberduck creature packs and artisticdude's NPC voices, by name plus spectral centroid / f0 (bright and high for electric and ice, low and voiced for ground and rock, and so on).
- **Layered premixes.** fairy, cosmic and steel cries; ash, salt, sand and gravel steps; grass rustle; crit; faint; orb throw / shake / catch / break; weather; raid phase / roar; several move / impact designs.

### Pipeline changes made here

1. **`sources.json` `parts`.** Optional `[{ file, author, url, title?, licenceFile? }]`, in `src/sources.ts` and `src/credits.ts`. A premix is credited through one row per part, and its derived siblings count for the parts. Attribution only, so the salt does not change. Spec §40.4.8 is amended. Test: `ingest.test.ts`, "a premix is credited through its parts".
2. **`findLoop` always refines the nominal length** (`src/loop.ts`).
   - Marrow's base stem is exactly periodic at 33.714 s (max sample error 0), yet the finder returned 33.760 s at score 0.728.
   - Cause: the dense 200 bpm arpeggio filled the five coarse candidate slots with aliases. The nearest coarse peak sat 2 hops off, so its ±15 ms fine window missed the true L by 1 ms.
   - Now the nominal L is always one of the refined candidates. Result: 33.714 s, score 1.000, and all 17 themes at nominal with score 1.
   - No synthetic test reproduces this coarse-hop situation (dense synthetic arpeggios lock correctly with or without the fix). The evidence is this real stem; the existing loop tests pass.
3. **D14 resolved: loop points are no longer shifted by the Opus pre-skip** (`LOOP_POINTS_INCLUDE_PRESKIP = false` in `src/process.ts`; spec §40.4.5 amended). Headless Chrome decoded all 366 shipped webm clips:
   - A 60 s bed decodes to exactly 2 880 000 frames, so `decodeAudioData` trims the pre-skip.
   - The shifted `loopEndSec` (60.0065) of all 11 beds fell past the buffer.
   - After the change no loop point is out of range. Decoded base-layer seams (15 ms after loopStart against after loopEnd) correlate at 0.96–0.998 on all 17 themes.
   - Firefox was not measured. It honours WebM `CodecDelay` the same way.

### Process result

- **Clips.** 366/366 clips, 0 placeholders, 0 rejected.
- **Budget.** 76 262 417 B = **72.73 MiB of 80 MiB** (webm 35.3 MB + m4a 41.0 MB). `budget.test.ts` "the built public/audio/ fits" now runs and passes.
- **Themes.** All 17 at nominal, loop score 1.0 on all four layers.
- **Ambience.** All 11 beds reach −16 LUFS. An earlier pass had marrow at −26, rift −21, grove −20 and storm −20 because drips, strikes and birds hit the true-peak clamp. Every bed premix now ends with a −7 dBFS look-ahead limiter at −20 dBFS RMS, so the crest factor is ≤ 12.2 dB.
- **184 "gain clamped to the −1 dBTP ceiling" flags.**
  - 179 are sfx/ui transients. Footsteps, clicks, impacts and splashes cannot reach −20 LUFS integrated under −1 dBTP. Median 4 dB short; footsteps and ui clicks 8–14 dB short. Per-id `gainDb` in the bible still applies; nothing is broken.
  - 5 are stems (capital base −17.9, elite base −16.5, vesper base −16.3, and two derived layers).

### Verified in the client

Headless Chrome against Vite on :5176 (scratch user-data dir; the lead's ports were not touched), using the client's own modules:
- `loadAudioManifest()` loads `/audio/manifest.json`.
- `validateAudioManifest(m, TIMELINE_SFX + MOVE_ANIMS sfx)` reports 0 problems.
- All 366 clips decode (webm/Opus, 48 kHz, 3 008 s in total).
- A real `AudioDirector`, given a gesture and `init`, then `setTheme(themeFor('mirevale', 'grove'))`, ends with `contextReady: true, theme: 'grove', silent: false`. The four grove stems are fetched, and `ui_click` plays.
- `npx vitest run tools/audio-pipeline packages/client/test/audio*.test.ts`: 75/75. `pnpm typecheck` passes. `npx eslint tools/audio-pipeline` is clean.

### Needs a human ear (in order of risk)

1. **The grove, marrow and champion seams.** Through-composed tracks with no repeat found; 1.5–2 s seam fades. Grove is the first theme a player hears.
2. **Battle (24 bars, varied repeat) and victory (9 bars).** Is the seam musical? Victory Theme's own ending was avoided.
3. **Short loops.** sky 16 s, elite 15 s, gym 20 s. Is the repetition tiring?
4. **The derived threat / biome / night layers on real music.** Above all the threat eighth-note gate on tracks whose tempo is an estimate (rift has no pulse; shrine and vesper are ambient).
5. **Creature cries and hurts per type.** Chosen by name and spectral analysis; the fairy, cosmic and steel cries are layered designs.
6. **Stingers.** Excerpt start points are onset-aligned but unheard. New Sunrise at 33.6 s (champion intro) and the wastelands burst (legendary intro) are guesses at the right moment.
7. **Beds.** Short-loop tiling (6 s wind, 11 s crickets) can be heard as a pattern. The capital bed has no pigeons or crowd. The shrine drone is a low-passed sci-fi engine.
8. **Kenney digital / sci-fi sources.** status_confuse, paralyze, stage_up / down and the psychic / electric moves are synthetic and may sound arcade next to the orchestral music.

### Re-running

From `assets-src/audio/cc0/`:
1. `node _fetch.mjs`: re-downloads anything missing and checks every sha256.
2. Re-extract the zips in place.
3. `python _tools/mix.py`
4. `node _tools/gen-sources.mjs`

Then run `pnpm --filter @ewa/audio-pipeline ingest` and `pnpm --filter @ewa/audio-pipeline process -- --provider cc0`. `PROGRESS.md` there has the session checklist.

## Signature-move sound designs (2026-10-08)

- 12 new sfx ids `sig_*` (186 ids, 299 variants, 378 jobs; 73.18 MiB of 80): one layered premix per signature move
  (`cc0-tools/mix.py`, "signature moves"), built only from the already-approved CC0 downloads — no new files. Each is
  timed from its cinematic's charge (the client's `aim` frame, t = 0): the charge across the windup, the release, the
  impact transient at windup + travel (the timeline's damage frame), a tail. Checked numerically (25 ms RMS): every
  impact sits on its beat with a 3–13 dB jump; the loudest moment is the impact or the body / shatter just after it.
  Nothing here was auditioned by ear (same open item as the rest of the CC0 set).
- Rebuild: `python _tools/mix.py sig_<move>_1 …` (from `assets-src/audio/cc0/`), `node _tools/gen-sources.mjs`, then
  `ingest`, `credits`, `process -- --provider cc0`. Only the 24 new files, the manifest and the credits change; every
  other clip re-encodes byte-identical. 3 of the 12 are flagged "gain clamped to the -3 dBTP ceiling" (sharp transients).
- Louder (user request, same day): each signature premix ends in `acompressor` (threshold 0.08, ratio 6, makeup 3) +
  `alimiter` (0.7) (`_sig_loud` in mix.py), so the −20 LUFS pass no longer clamps any of them at −3 dBTP, and the
  manifest plays them at **+6 dB** (was −2): 8–10 dB louder than the first cut, the master compressor catches peaks.

## Bond cinematic sound designs (2026-10-11)

- 2 new sfx ids `bond_majin`, `bond_tenjin` (188 ids, 301 variants, 380 jobs; 73.33 MiB of 80): a trainer's Majin /
  Tenjin transformation (client `battle/bond.ts`), timed from the `bond` frame: two lub-dub heartbeats on the client's
  `BOND_BEATS` (the trainer's at rate 0.55, the creature's at 0.72) escalating then capped, a drone and a reversed
  whoosh rising, everything ducked to a breath of silence (−61 dB at 2.36 s), then the lock at 2.40 s (Majin: glass
  crack + wood crack + crunch + a low-frequency thump; Tenjin: one great bell + a soft thump + five rising chimes) and the
  burst at 2.70 s (Majin: a crunch blast and three layered roars + the floor drop; Tenjin: a bright bell strike, the
  cure shimmer and a **synthesized** 'aah' choir — additive detuned saws through vowel formants with a slow vibrato,
  numpy in `mix.py` `_choir`, no source file). Same `_sig_loud` compression and +6 dB as the signature designs; 4.0 s
  (the sfx cap). Built only from already-approved CC0 downloads; nothing new fetched. Not auditioned by ear.
- Rebuild: `python _tools/mix.py bond_majin_1 bond_tenjin_1` (from `assets-src/audio/cc0/`), `node _tools/gen-sources.mjs`,
  then `ingest` and `process -- --provider cc0`. Only the 4 new files, the manifest and the credits change.

## hyoryu's signature sound (2026-10-13)

- 1 new sfx id `sig_crimson_lotus_prison` (189 ids, 302 variants, 381 jobs; 73.37 MiB of 80) for Crimson Lotus Prison,
  timed from the cinematic's charge: a cold shimmer, six glass chimes as the sky flower opens (0.02 to 0.32 s), a rush
  and a low-passed roar for the ice dragon (0.40 / 0.46 s, kept 14 to 16 dB down so the impact stands out), the lotus
  snapping shut on the damage frame at 0.80 s (glass, force field and a low thump), a low crimson swell, the crack at
  1.10 s and the shatter at 1.22 s. Before the `_sig_loud` stage the impact is a 8.7 dB jump over the 25 ms before it.
  Built only from already-approved CC0 downloads; nothing new fetched. Not auditioned by ear.
- Rebuild: `python _tools/mix.py sig_crimson_lotus_prison_1` (from `assets-src/audio/cc0/`), `node _tools/gen-sources.mjs`,
  then `ingest`, `credits` and `process -- --provider cc0`. Only the 2 new files, the manifest and the credits change.

## astaroth's signature sound (2026-10-26)

- 1 new sfx id `sig_demon_lords_descent` (383 jobs; 73.45 MiB of 80) for Demon Lord's Descent, timed from the
  cinematic's charge (impact at windup 640 + travel 300 = 0.94 s): a reversed breath and a low rumble as it dissolves
  into smoke, a short low-passed growl when its eyes flare (0.26 s), a dark falling phaser under the sigil (0.40 s),
  the drop's whoosh (0.64 s), then the greatsword's heavy metal strike with a low boom on the impact at 0.94 s, the
  katana's cut crossing it at 0.97 s, a crunch and an eerie low ring. The charge layers sit 10 to 25 dB down; after the
  `_sig_loud` stage the impact is a 9 dB jump over the 25 ms before it and the loudest moment is the body just after
  it. Built only from already-approved CC0 downloads; nothing new fetched. Not auditioned by ear.
- Rebuild: `python _tools/mix.py sig_demon_lords_descent_1` (from `assets-src/audio/cc0/`), `node _tools/gen-sources.mjs`,
  then `ingest`, `credits` and `process -- --provider cc0`. Only the 2 new files, the manifest and the credits change.
