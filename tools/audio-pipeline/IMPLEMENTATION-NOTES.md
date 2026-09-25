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
| D14 | §40.4.5: loop points shifted by the Opus pre-skip | Implemented (312 samples read back with ffprobe `initial_padding`); AAC priming is left to the MP4 edit list (ffprobe reports `initial_padding` 0 for the m4a) | **Risk to verify at M5 in real browsers:** Chrome and Firefox honour WebM `CodecDelay` and may already trim the pre-skip in `decodeAudioData`, in which case the shift makes both loop points 6.5 ms late (length unchanged). `SEAM_FADE_SEC` softens but does not remove this. |
| D15 | — | `-map_metadata -1` added to the bitexact flags | Keeps container metadata out of the hashed bytes. |

## Things the SPEC leaves open that the code decides

- Job ids are the output paths (`themes/<t>/<layer>`, `ambience/<biome>`, `sfx/<id>_<n>`, n from 1).
- URLs in the output manifest are root-absolute, `/audio/<layout path>?v=<hash8>` (`--url-base` changes the prefix),
  because the client's `AudioDirector` fetches `url` as written and loads the manifest from `/audio/manifest.json`;
  the webm hash serves both `url` and `urlFallback`.
- `requestHash` includes the provider name, so switching provider re-plans every job.
- Seeds in the source manifest are the first 4 bytes of `sha256(<job id stem>)`; sfx variant *i* uses seed + *i*.
