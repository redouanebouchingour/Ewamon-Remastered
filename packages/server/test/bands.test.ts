/**
 * Majin / Tenjin on the server (`.design/majin-tenjin.md`): a player's bands come from the inventory snapshot of the
 * start transaction (`majin_band` / `tenjin_band`), an NPC trainer's from content (`TrainerDef.bands`), a
 * `transform: true` move is validated by core and resolves with no desync, and a player without the band is refused.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAJIN_BAND, TENJIN_BAND, zone } from '@ewa/content';
import { createRng, digestBattleState, formTypes, resolveTurn } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator, bandsOf } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { content, openRepos, uniqueName } from './helpers';

let db: AnyDb;
let repos: Repos & { readonly db: Db };
const now = 1_800_000_000_000;

beforeAll(async () => {
  ({ db, repos } = await openRepos());
}, 120_000);
afterAll(async () => {
  await db?.close();
});

function host(): BattleHost & { readonly msgs: Map<string, ServerMessage[]> } {
  const msgs = new Map<string, ServerMessage[]>();
  return {
    msgs,
    send: (pid, m) => void (msgs.get(pid) ?? msgs.set(pid, []).get(pid)!).push(m),
    onStart: () => undefined,
    onEnd: () => undefined,
    onProgress: () => undefined,
  };
}

function coordinator(h: BattleHost, zoneId: 'forgewall' | 'mire_route' = 'forgewall'): BattleCoordinator {
  return new BattleCoordinator(createRng('bands'), {
    repos, content, clock: () => now, log: silentLogger(), zone: zone(zoneId), host: h, metrics: createRoomMetrics('r', zoneId, 0),
  });
}

async function mkPlayer(party: { species: string; level: number }[], items: Record<string, number>): Promise<string> {
  return repos.db.transaction(async (tx) => {
    const name = uniqueName('band');
    const { id } = await repos.players.create(tx, { username: name, email: `${name}@b.test`, passwordHash: 'x' }, new Date(now));
    for (let i = 0; i < party.length; i++) await repos.creatures.insert(tx, newCreature(content, party[i]!.species, party[i]!.level, { ownerId: id }), { kind: 'party', index: i });
    if (Object.keys(items).length > 0) await repos.inventory.addMany(tx, id, items);
    return id;
  });
}

const firstMove = (s: BattleState): string => s.sides[0].party[s.sides[0].active]!.creature.moves.find((m) => m.pp > 0)!.id;

async function settle(c: BattleCoordinator, id: string): Promise<void> {
  for (let i = 0; i < 200 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
}

describe('Majin / Tenjin bands', () => {
  it('bandsOf reads the two key items', () => {
    expect(bandsOf({})).toEqual([]);
    expect(bandsOf({ [MAJIN_BAND]: 1 })).toEqual(['majin']);
    expect(bandsOf({ [TENJIN_BAND]: 1, [MAJIN_BAND]: 1, potion: 3 })).toEqual(['majin', 'tenjin']);
    expect(bandsOf({ [TENJIN_BAND]: 0 })).toEqual([]);
  });

  it('a player with the Tenjin Band transforms a Tenjin species by choice, with no desync; the NPC side carries its authored band', async () => {
    const h = host();
    const c = coordinator(h);
    const pid = await mkPlayer([{ species: 'thornback', level: 60 }], { [TENJIN_BAND]: 1 });
    const trainer = zone('forgewall').trainers.find((t) => t.id === 'hollis_siege')!;
    expect(trainer.bands).toEqual(['majin']);
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer, rematch: false }, null, { x: 0, z: -6 });
    if (!res.ok) throw new Error(res.detail);
    const st = res.session.state;
    expect(st.sides[0].bands).toEqual(['tenjin']);
    expect(st.sides[1].bands).toEqual(['majin']);
    const a: Action = { kind: 'move', move: firstMove(st), transform: true };
    const preview = resolveTurn(st, [a, null], content);
    const before = (h.msgs.get(pid) ?? []).length;
    expect(c.action(pid, res.session.id, 1, a)).toBeNull();
    await settle(c, res.session.id);
    const ev = (h.msgs.get(pid) ?? []).slice(before).find((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents')!;
    expect(ev.stateDigest).toBe(digestBattleState(preview.state));
    const now0 = c.get(res.session.id)?.state ?? preview.state;
    expect(now0.sides[0].party[0]!.form).toBe('tenjin');
    expect(now0.sides[0].transformed).toBe(true);
    // the side's one transformation is spent
    if (c.get(res.session.id) !== null) {
      expect(c.action(pid, res.session.id, now0.turn + 1, { kind: 'move', move: firstMove(now0), transform: true })).toMatchObject({ detail: 'cannotTransform' });
    }
  }, 120_000);

  it('kykaiser goes Tenjin with the band and holds Water/Steel in the form, with no desync', async () => {
    const h = host();
    const c = coordinator(h);
    const pid = await mkPlayer([{ species: 'kykaiser', level: 60 }], { [TENJIN_BAND]: 1 });
    const trainer = zone('forgewall').trainers.find((t) => t.id === 'hollis_siege')!;
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer, rematch: false }, null, { x: 0, z: -6 });
    if (!res.ok) throw new Error(res.detail);
    const st = res.session.state;
    const sp = content.species('kykaiser');
    expect(formTypes(sp, st.sides[0].party[0]!)).toEqual(['Water']);
    const a: Action = { kind: 'move', move: firstMove(st), transform: true };
    const preview = resolveTurn(st, [a, null], content);
    const before = (h.msgs.get(pid) ?? []).length;
    expect(c.action(pid, res.session.id, 1, a)).toBeNull();
    await settle(c, res.session.id);
    const ev = (h.msgs.get(pid) ?? []).slice(before).find((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents')!;
    expect(ev.stateDigest).toBe(digestBattleState(preview.state));
    const b = (c.get(res.session.id)?.state ?? preview.state).sides[0].party[0]!;
    expect(b.form).toBe('tenjin');
    expect(formTypes(sp, b)).toEqual(['Water', 'Steel']);
  }, 120_000);

  it('without the band the transform is refused (notAllowed / cannotTransform) and the side has no bands key', async () => {
    const h = host();
    const c = coordinator(h, 'mire_route');
    const pid = await mkPlayer([{ species: 'thornback', level: 60 }], { potion: 1 });
    const trainer = zone('mire_route').trainers.find((t) => t.id === 'mire_route.bug_catcher')!;
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer, rematch: false }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect('bands' in res.session.state.sides[0]).toBe(false);
    expect(c.action(pid, res.session.id, 1, { kind: 'move', move: firstMove(res.session.state), transform: true })).toMatchObject({ code: 'notAllowed', detail: 'cannotTransform' });
  }, 120_000);
});
