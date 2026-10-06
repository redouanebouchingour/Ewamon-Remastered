# @ewa/audio-pipeline

SPEC §40.4. Turns the prompt manifest transcribed from `.design/audio-bible.md` into the game's audio:
`.design/audio/manifest.json` → provider → `.cache/audio/raw/*.wav` → loop points, loudness, Opus/AAC →
`packages/client/public/audio/` + `manifest.json` (the SPEC §20.7.4 shape `AudioDirector` consumes).

The design — what every theme, bed and sound is and why — lives in `.design/audio-bible.md`. This file is how to run
the tool. Deviations from the SPEC are in `IMPLEMENTATION-NOTES.md`.

## Commands

```
pnpm --filter @ewa/audio-pipeline plan           # no key, no network: validate + job list + cost + size → qa/plan.json
pnpm --filter @ewa/audio-pipeline generate       # needs EWA_AUDIO_API_KEY; otherwise prints the skip line, exits 0
pnpm --filter @ewa/audio-pipeline process        # needs ffmpeg ≥ 6.0 with libopus; writes public/audio/
pnpm --filter @ewa/audio-pipeline placeholders   # process --placeholders: synthesized stand-ins for missing WAVs
pnpm --filter @ewa/audio-pipeline all            # plan → generate → process, re-rolling rejects (≤ 3 rounds)
pnpm --filter @ewa/audio-pipeline ingest         # Phase E4: CC0 files (.design/audio/sources.json → assets-src/audio/cc0/) → raw cache + credits
pnpm --filter @ewa/audio-pipeline credits        # assets-src/audio/CREDITS.md + public/audio/CREDITS.txt from sources.json
pnpm --filter @ewa/audio-pipeline cc0            # plan → ingest → process --provider cc0 --placeholders (unmapped jobs stay placeholders)
```

Flags (after `--`): `--manifest FILE`, `--cache DIR`, `--qa DIR`, `--out DIR`, `--provider NAME` (or
`EWA_AUDIO_PROVIDER`), `--only prefix,prefix` (generate; job-id prefixes such as `themes/grove,sfx/hit_`),
`--limit N`, `--concurrency N` (generate, default 2), `--jobs N` (process parallelism), `--verbose` (plan),
`--placeholders` (process/all), `--url-base PREFIX` (process/all; clip urls are `/audio/…?v=<hash8>` by default).

## The key

The recommended provider is **Stability AI Stable Audio 2.5** (bible §9). The adapter reads `EWA_AUDIO_API_KEY` and
nothing else; the repo contains no key and no default. Set it in your shell only:

```
$env:EWA_AUDIO_API_KEY = '<your Stability key>'     # PowerShell
export EWA_AUDIO_API_KEY='<your Stability key>'     # bash
```

List price for the whole manifest is $73.20 (366 generations × $0.20); `plan` prints the live estimate for what is
not cached yet.

## What each step does

- **plan** (`src/plan.ts`): zod + cross-field validation (`src/schema.ts`) — 17 themes, 11 beds, every
  boot-validated sfx id, `zoneThemes` exactly `@ewa/content` `ZONE_ORDER`, each zone mapped to its biome's theme;
  expands one job per stem × theme, per bed, per sfx variant; `requestHash = sha256(provider, kind, canonical prompt)`;
  diffs `.cache/audio/jobs.json`; prices with `src/pricing.ts`; estimates encoded bytes against 80 MiB
  (`src/budget.ts`).
- **generate** (`src/generate.ts`, `src/providers/stable-audio.ts`): uncached jobs through the provider, 3 retries
  with backoff on 429/5xx, throws on other 4xx, writes the raw WAV and records it in `jobs.json` after each job.
- **process** (`src/process.ts`): checks ffmpeg/ffprobe first. Themes: decode four layers at 48 kHz, find each loop
  (`src/loop.ts`, pure TS), reject bad layers, align layers to base, give all four the base loop, bake the seam.
  Beds: 2 s cross-fade loop. Sfx: trim and cap. All: loudnorm measurement → static gain → ebur128 true-peak check →
  Opus/WebM + AAC/M4A with bitexact flags → Opus pre-skip added to loop points → `manifest.json` +
  `qa/process-report.json` (`rejected`, `flagged`, `placeholders`, per-theme loop scores and alignment, bytes).
- **placeholders** (`src/placeholder.ts`): deterministic synthesis in the theme's key/bpm/bars so the whole pipeline
  and the client's audio graph can run before any generation. Never shipped (bible §10).

## Layout

```
src/       cli.ts plan.ts generate.ts process.ts schema.ts jobs.ts loop.ts ffmpeg.ts budget.ts output-manifest.ts
           placeholder.ts pricing.ts provider.ts wav.ts json.ts paths.ts providers/{index,stable-audio}.ts
test/      plan.test.ts (§50.4.8) budget.test.ts manifest.test.ts loop.test.ts provider.test.ts helpers.ts
qa/        plan.json (committed), process-report.json
.cache/    audio/{jobs.json, rerolls.json, raw/, placeholder/, work/}  (git-ignored)
```

## Tests

`pnpm exec vitest run tools/audio-pipeline`. The loudness and determinism tests need ffmpeg and are skipped with the
reason printed when it is missing (`ffmpeg -version` is the probe). No test reads a real key or opens a socket.
