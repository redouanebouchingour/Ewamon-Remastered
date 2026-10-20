/**
 * Phase D4 — shinies on the server: the 1/512 roll reads the alpha draw's low bits (no extra draw, so every
 * seeded spawn sequence is byte-identical to pre-D4), SpawnState carries it, a wild battle projects it, a catch
 * persists it on the creature and in the dex, and the marketplace filters on it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROUTE_TUNING, encounterTableFor, getHeightfield, getZoneSurface, zone } from '@ewa/content';
import type { EncounterTable, Heightfield } from '@ewa/content';
import { createRng, fnv1a32 } from '@ewa/core';
import { CreatureInstanceSchema, ServerMessageSchema } from '@ewa/protocol';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { SHINY_ODDS, SpawnDirector, shinyFromDraw } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { content, openRepos, rawQuery, uniqueName } from './helpers';

function instantDirector(seed: string): SpawnDirector {
  const z = zone('mire_route');
  return new SpawnDirector(z, encounterTableFor('mire_route'), createRng(seed), getHeightfield('mire_route'), { ...ROUTE_TUNING, targetCount: 1, lifetimeMs: 0, respawnMinMs: 0, respawnMaxMs: 0 }, content);
}

function rollSpawns(d: SpawnDirector, n: number): SpawnRecord[] {
  const out: SpawnRecord[] = [];
  for (let t = 0; out.length < n; t++) out.push(...d.tick(t, 0.5).spawned);
  return out.slice(0, n);
}

describe('the shiny roll', () => {
  it('shinyFromDraw is exactly 1/512 of the u32 space and independent of the alpha threshold', () => {
    expect(SHINY_ODDS).toBe(512);
    expect(shinyFromDraw(0)).toBe(true);
    expect(shinyFromDraw(512 / 4294967296)).toBe(true);
    expect(shinyFromDraw(1 / 4294967296)).toBe(false);
    expect(shinyFromDraw(511 / 4294967296)).toBe(false);
    const rng = createRng('d4-rate');
    const N = 512 * 1000;
    let shiny = 0;
    let lowDraws = 0;
    let lowShiny = 0;
    for (let i = 0; i < N; i++) {
      const u = rng.next();
      const s = shinyFromDraw(u);
      if (s) shiny++;
      if (u < 0.05) {
        lowDraws++;
        if (s) lowShiny++;
      }
    }
    // binomial(512 000, 1/512): mean 1000, σ ≈ 31.6 → ±5 σ
    expect(Math.abs(shiny - 1000)).toBeLessThan(160);
    // among draws that would pass an alpha-style threshold the rate is the same (mean ≈ 50, ±5 σ ≈ 35)
    expect(Math.abs(lowShiny - lowDraws / 512)).toBeLessThan(36);
  });

  it('a seeded director rolls shinies at ≈ 1/512 and every record says isShiny true/false', () => {
    const spawns = rollSpawns(instantDirector('d4-director'), 40_000);
    const shiny = spawns.filter((s) => s.isShiny === true).length;
    for (const s of spawns) expect(typeof s.isShiny).toBe('boolean');
    // mean 78.1, σ ≈ 8.8 → ±5 σ
    expect(Math.abs(shiny - 40_000 / 512)).toBeLessThan(45);
  }, 120_000);

  it('adds no rng draw: the pre-D4 fields of 3 000 seeded spawns hash to the value captured from the pre-D4 director', () => {
    // the director's inputs as they were when the digest was captured: Phase D8 added water slots to mire_route's table
    // and Phase D10 stamped its obstacle — drop the former and un-stamp the latter (the director code is what is pinned)
    const full = encounterTableFor('mire_route')!;
    const table: EncounterTable = { ...full, slots: full.slots.filter((s) => (s.medium ?? 'land') === 'land') };
    const surface = getZoneSurface('mire_route');
    const walkable = Uint8Array.from(surface.heightfield.walkable);
    for (const i of surface.obstacleCells.keys()) walkable[i] = 1;
    const h: Heightfield = { ...surface.heightfield, walkable };
    const d = new SpawnDirector(zone('mire_route'), table, createRng('d4-stream'), h, { ...ROUTE_TUNING, targetCount: 1, lifetimeMs: 0, respawnMinMs: 0, respawnMaxMs: 0 }, content);
    const spawns = rollSpawns(d, 3000);
    const lines = spawns.map((s) => `${s.id}|${s.speciesId}|${s.level}|${s.isAlpha}|${s.variantKey}|${s.ability}|${s.x}|${s.z}`);
    // captured by running HEAD~0's (pre-D4) spawnDirector.ts with the same tuning and seed ('8880f1e7'), then re-captured
    // with the director unchanged on the sculpted mire_route terrain (the zone sculpts moved the walkable samples), and
    // again after its edge shoulders (handover landings)
    expect(fnv1a32(lines.join('\n')).toString(16)).toBe('3214908f');
  });
});

describe('a shiny spawn through battle and catch', () => {
  let db: AnyDb;
  let repos: Repos & { readonly db: Db };
  const now = 1_800_000_000_000;
  beforeAll(async () => {
    ({ db, repos } = await openRepos());
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  it('the wild battler is shiny; the catch persists isShiny on the creature and shiny_caught in the dex', async () => {
    const msgs: ServerMessage[] = [];
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('shiny-catch'), { repos, content, clock: () => now, log: silentLogger(), zone: zone('mire_route'), host, metrics: createRoomMetrics('r', 'mire_route', 0) });
    const pid = await repos.db.transaction(async (tx) => {
      const name = uniqueName('sh');
      const { id } = await repos.players.create(tx, { username: name, email: `${name}@b.test`, passwordHash: 'x' }, new Date(now));
      await repos.creatures.insert(tx, newCreature(content, 'bramblecub', 10, { ownerId: id }), { kind: 'party', index: 0 });
      await repos.inventory.addMany(tx, id, { aether_orb: 1 });
      return id;
    });
    const spawn: SpawnRecord = { id: 'mire_route:shiny', speciesId: 'mossling', level: 4, variantKey: 'dusk', isAlpha: false, isShiny: true, ability: content.species('mossling').abilities[0]!, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const foe = res.session.state.sides[1].party[0]!.creature;
    expect(foe.isShiny).toBe(true);
    const start = msgs.find((m) => m.type === 'battleStart')!;
    expect(ServerMessageSchema.safeParse(start).success).toBe(true);
    expect(c.action(pid, res.session.id, 1, { kind: 'catch', orb: 'aether_orb' })).toBeNull();
    for (let i = 0; i < 200 && c.get(res.session.id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
    const inv = msgs.find((m): m is Extract<ServerMessage, { type: 'inventoryDelta' }> => m.type === 'inventoryDelta' && m.creaturesAdded.length > 0)!;
    expect(inv.creaturesAdded[0]).toMatchObject({ speciesId: 'mossling', variantKey: 'dusk', isShiny: true });
    expect(CreatureInstanceSchema.safeParse(inv.creaturesAdded[0]).success).toBe(true);
    const row = await rawQuery(db, "select is_shiny from creature_instances where owner_id = $1 and species_id = 'mossling'", [pid]);
    expect(row[0]!['is_shiny']).toBe(true);
    const dex = await rawQuery(db, "select shiny_caught from dex_entries where player_id = $1 and species_id = 'mossling'", [pid]);
    expect(dex[0]!['shiny_caught']).toBe(true);
    const summary = await repos.db.transaction((tx) => repos.progress.dex(tx, pid));
    expect(summary.shiny).toEqual(['mossling']);
  }, 120_000);
});
