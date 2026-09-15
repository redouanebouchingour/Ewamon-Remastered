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
| `licenses/TABLER-LICENSE.txt` | Tabler Icons | MIT — notice is legally required and ships with the client |

To restore from the original repository:

```bash
pnpm exec tsx tools/sprite-pipeline/src/import-legacy.ts "C:/Users/Flowmatic - Redouane/Ewamon"
```
