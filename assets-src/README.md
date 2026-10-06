# assets-src — raw art inputs (not tracked)

Raw sources for the asset pipelines. They are **gitignored** because the creature
illustrations alone are 398 MB. The pipelines under `tools/` read from here and write
compressed, normalized outputs into `packages/client/public/`, which *is* tracked.

| Folder | Origin | Licence |
|---|---|---|
| `creatures/front`, `creatures/back` | `Ewamon/ewamon/frontend/ewamon-sprites/ewamon(front|back)` — AI-generated creature illustrations, recipes in `.design/imagegen/` | Project-owned |
| `creatures/animations` | `.../ewamon(animations)` — 4 legendary idle sheets | Project-owned |
| `models/legendaries/*.glb` | `Ewamon/ewamon/frontend/public/models/legendaries` — rigged legendary GLBs | Project-owned |
| `models/quaternius/` | Quaternius "Ultimate Animated Character Pack" | CC0 — see `licenses/QUATERNIUS-CREDITS.txt` |
| `models/kaykit-adventurers/` | KayKit "Character Pack: Adventurers" 2.0, free tier, by Kay Lousberg — downloaded 2026-10-05 from https://kaylousberg.itch.io/kaykit-adventurers (`Free 2.0`, 12 MB zip): 6 characters on `Rig_Medium`, 2 animation GLBs, accessories | CC0 — see `licenses/KAYKIT-ADVENTURERS-LICENSE.txt` (credit optional: "Kay Lousberg, www.kaylousberg.com") |
| `licenses/TABLER-LICENSE.txt` | Tabler Icons | MIT — notice is legally required and ships with the client |
| `audio/cc0/` (gitignored) | CC0 music / ambience / sfx packs, downloaded by hand on approval from the pages listed in `.design/audio/sources.candidates.md`; mapped to audio jobs by `.design/audio/sources.json` and read by `pnpm --filter @ewa/audio-pipeline ingest` | CC0 only — `audio/CREDITS.md` (generated) and `audio/licenses/` (tracked) |

To restore from the original repository:

```bash
pnpm exec tsx tools/sprite-pipeline/src/import-legacy.ts "C:/Users/Flowmatic - Redouane/Ewamon"
```
