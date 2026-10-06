# CC0 audio build helpers (Phase E4)

Copies of the helper scripts used to turn the approved CC0 downloads (`assets-src/audio/cc0/`, gitignored — url,
sha256 and licence evidence per file in `assets-src/audio/cc0/DOWNLOADS.json`) into `.design/audio/sources.json`
and the premixed beds / layered sfx. Run them from `assets-src/audio/cc0/_tools/` (they expect that layout):

- `gen-sources.mjs` — generates `.design/audio/sources.json` (edit this, never the JSON by hand).
- `mix.py` — builds the 74 premixes (ambience beds, the rift theme, layered sound designs) with ffmpeg.
- `analyze.py`, `freeloop.py`, `seamcheck.py`, `onsets.py`, `durations.py`, `describe.py` — the tempo / loop-window /
  seam / onset analysis behind the loop choices.

Then `pnpm --filter @ewa/audio-pipeline ingest`, `credits`, and `process` (see `../IMPLEMENTATION-NOTES.md`,
"Phase E4 downloads", and `REBUILD.md` for the step list).
