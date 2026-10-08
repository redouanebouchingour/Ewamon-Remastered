# Ewamon Remastered

An HD-2D creature-collector MMO: stylised 3D people and lit 2D creature billboards in diorama towns and routes,
turn-based battles that raise an arena out of the ground where you stand, eight gyms, a league, trades, raids,
guilds and a marketplace. Three.js WebGPU on the client, Colyseus + PostgreSQL on the server.

## Layout

| Package | What it is |
|---|---|
| `packages/core` | Pure battle rules, rng, exp — imports nothing. 1,000-battle determinism fuzz. |
| `packages/content` | Typed game data (131 species, 193 moves, 21 zones, league, story, quests), the zone plan, heightfields and interiors; `validate()` is the build gate. |
| `packages/protocol` | Wire schemas (zod), movement prediction, AOI. |
| `packages/persist` | Drizzle schema + repos over PGlite (dev) or Postgres. |
| `packages/server` | Colyseus zone rooms (20 Hz), movement validation, battles, story beats, REST + JWT, trades, raids, social, market, live-ops. |
| `packages/render` | Three.js WebGPU renderer: zone builder, interiors, terrain, post chain, battle stage, actors, camera rig. Imports only `three`. |
| `packages/client` | React shell + 3D world: prediction, battles, HUD, screens, audio. Never imports server/persist. |
| `tools/*` | Asset pipelines (sprites, models, materials, audio) and the asset audit. |

`.design/SPEC.md` is the binding contract (assembled from `.design/spec/*.md`; every part-file change needs a
`.design/spec/CHANGELOG.md` entry). `HANDOFF.md` is the entry point for whoever continues the build.

## Run it

```bash
pnpm install
```

```bash
pnpm dev
```

The server needs `JWT_SECRET` (≥ 32 chars) in its environment; without `DATABASE_URL` it uses PGlite under
`packages/server/.data`. The client runs on <http://localhost:5173> and proxies `/api` to the server on :4000
(WebSocket :2567). The render sandbox is `pnpm --filter @ewa/render sandbox` (port 5180; `?zone=mirevale`,
`?zone=mirevale&interior=mirevale.gym&at=arena`, `?demo=battle`).

## Check it

```bash
pnpm check
```

typecheck + lint (architectural laws are lint rules) + lint-rule tests + all tests + build.

## How the world is put together

- **Zones** are seeded: `ZoneDef.layoutSeed` → the zone plan (roads, plaza, buildings, props, lights, footprints) →
  the heightfield the server validates movement against and the client predicts with.
- **Interiors**: every town building (gym, Solenne's league hall, shop, healer, houses) opens into a walled, roofless
  hall placed in the zone's outer band and reached through its door. From outside a hall reads as a wooded knoll.
- **Gyms** are themed halls: 2–3 gym trainers beside per-player gates, one puzzle (hedge maze, furnaces, tide
  sluices, breakers, boulder maze, teleport tiles, anvils, a bridge gauntlet), the leader waiting at the far end; the
  arena forms at an authored point in the hall. Solenne's league hall has four chambers: three Wardens, then the
  Champion.
