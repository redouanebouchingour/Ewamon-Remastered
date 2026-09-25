# M3 zone smoke test

2026-09-25 — every zone loaded in the render sandbox (`?zone=<id>`, real `ZoneSpec` through the client adapter, baked KTX2 materials) in headless Chrome 153 with WebGPU on the dev machine (Intel Gen-12 iGPU), 1440×900, gameplay camera at the zone spawn, 10:00. `draws` is the whole frame including 4 shadow cascades and post; `gpu` is one sampled frame and is noisy on this GPU. No zone logged a warning or a console error.

| Zone | Draws | Triangles | Materials | Programs | Lights (shadow + non) | GPU ms |
|---|---|---|---|---|---|---|
| `mirevale` | 368 | 587,257 | 18 | 107 | 3 + 17 | 174 |
| `mire_route` | 163 | 839,453 | 13 | 101 | 3 + 9 | 107 |
| `cinderhold` | 157 | 326,791 | 16 | 95 | 2 + 18 | 44 |
| `ash_route` | 98 | 308,915 | 10 | 93 | n/a | n/a |
| `saltmourn` | 200 | 327,129 | 16 | 103 | 3 + 16 | 100 |
| `tide_route` | 107 | 301,129 | 10 | 97 | 2 + 8 | 45 |
| `stormrook` | 166 | 354,609 | 15 | 101 | 2 + 18 | 28 |
| `galvan_route` | 102 | 379,311 | 12 | 99 | 2 + 9 | 89 |
| `marrowdig` | 210 | 394,269 | 13 | 99 | 3 + 20 | 41 |
| `deepcut_route` | 95 | 275,399 | 7 | 91 | 2 + 8 | 40 |
| `vesperveil` | 198 | 421,479 | 14 | 99 | 2 + 20 | 43 |
| `hollow_route` | 118 | 590,579 | 9 | 97 | 2 + 10 | 34 |
| `forgewall` | 193 | 371,631 | 17 | 99 | 2 + 19 | 35 |
| `siege_route` | 106 | 322,475 | 9 | 97 | 2 + 8 | 31 |
| `skyrend` | 210 | 435,391 | 15 | 99 | 3 + 20 | 154 |
| `ascent_route` | 115 | 392,069 | 11 | 97 | 2 + 9 | 22 |
| `solenne` | 252 | 468,049 | 16 | 101 | 3 + 16 | 136 |
| `eclipse_shrine` | 72 | 288,167 | 6 | 93 | 2 + 9 | 21 |
| `umbral_observatory` | 103 | 407,145 | 10 | 97 | 2 + 5 | 70 |
| `celestial_spire` | 71 | 261,911 | 6 | 93 | 2 + 5 | 20 |
| `the_rift` | 82 | 274,429 | 5 | 91 | 2 + 5 | 65 |

Caps (SPEC §50.2.2 as amended 2026-09-25: render targets ≤ 41, programs ≤ 128, materials ≤ 48): all zones pass. Render targets are 33–34 everywhere; the render package's own cap constants still carry the old 24 / 96 and flag every zone until updated.

Visual note for the M3 audit: from spawn, most zones show a road over largely flat ground with scattered grass tufts. The biomes read as distinct, but prop and scatter density is well below the Mirevale plaza and below the "handsome miniature" bar. Towns other than Mirevale show no buildings from their spawn point.
