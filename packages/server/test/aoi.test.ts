/**
 * §30.2.5 AOI — pure `AoiGrid` (32-unit cells, 3×3), then the grid driving REAL `StateView`s through the
 * real `@colyseus/schema` Encoder/Decoder: each client decodes exactly its 3×3 population.
 */
import { describe, expect, it } from 'vitest';
import { Decoder, Encoder, StateView } from '@colyseus/schema';
import type { Iterator } from '@colyseus/schema';
import { PlayerState, SpawnState, ZoneState } from '@ewa/protocol';
import { AOI_CELL, AoiGrid, cellOf, neighbours } from '../src/rooms/aoi';

interface E {
  readonly id: string;
  x: number;
  z: number;
}

describe('AoiGrid (pure)', () => {
  it('cell math: 32-unit cells, floor semantics, 9 neighbours row-major', () => {
    expect(AOI_CELL).toBe(32);
    expect(cellOf(0, 0)).toEqual([0, 0]);
    expect(cellOf(31.99, -0.01)).toEqual([0, -1]);
    expect(cellOf(-32, 64)).toEqual([-1, 2]);
    expect(neighbours([0, 0])).toEqual([
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]);
  });

  it('place returns the viewers whose 3×3 an entity entered/left; the entity never "sees" itself', () => {
    const g = new AoiGrid<E>();
    g.moveViewer('v1', null, [0, 0]);
    g.moveViewer('v2', null, [5, 5]);
    const e: E = { id: 'e', x: 10, z: 10 };
    expect(g.place(e)).toEqual({ entered: ['v1'], left: [] });
    e.x = 5 * 32 + 3;
    e.z = 5 * 32 + 3;
    expect(g.place(e)).toEqual({ entered: ['v2'], left: ['v1'] });
    // same cell again: nothing
    e.x += 1;
    expect(g.place(e)).toEqual({ entered: [], left: [] });
    // a player entity with the viewer's own id is excluded from its own viewer list
    g.moveViewer('p', null, [5, 5]);
    const self: E = { id: 'p', x: 5 * 32, z: 5 * 32 };
    expect(g.place(self).entered).toEqual(['v2']);
  });

  it('moveViewer: crossing one cell boundary shows exactly the new column of 3 cells and hides the old', () => {
    const g = new AoiGrid<E>();
    const grid: E[] = [];
    for (let cz = -2; cz <= 2; cz++) {
      for (let cx = -3; cx <= 3; cx++) {
        const e = { id: `e${cx},${cz}`, x: cx * 32 + 16, z: cz * 32 + 16 };
        grid.push(e);
        g.place(e);
      }
    }
    const first = g.moveViewer('v', null, [0, 0]);
    expect(first.show.map((e) => e.id).sort()).toEqual(neighbours([0, 0]).map(([x, z]) => `e${x},${z}`).sort());
    expect(first.hide).toEqual([]);
    const step = g.moveViewer('v', [0, 0], [1, 0]);
    expect(step.show.map((e) => e.id).sort()).toEqual(['e2,-1', 'e2,0', 'e2,1']);
    expect(step.hide.map((e) => e.id).sort()).toEqual(['e-1,-1', 'e-1,0', 'e-1,1']);
    expect(g.entitiesNear([1, 0]).length).toBe(9);
  });

  it('removeEntity returns every viewer that could see it; removeViewer forgets the viewer', () => {
    const g = new AoiGrid<E>();
    g.moveViewer('a', null, [0, 0]);
    g.moveViewer('b', null, [1, 1]);
    g.moveViewer('c', null, [9, 9]);
    const e: E = { id: 'e', x: 40, z: 40 }; // cell [1,1]
    g.place(e);
    expect(g.removeEntity(e)).toEqual(['a', 'b']);
    expect(g.stats.entities).toBe(0);
    g.removeViewer('a');
    expect(g.stats.viewers).toBe(2);
    expect(g.viewersAt(40, 40)).toEqual(['b']);
  });
});

/** One room-like tick: encode shared + per-view, as Colyseus' SchemaSerializer does. */
function tick(encoder: Encoder<ZoneState>, views: readonly StateView[], decoders: readonly Decoder[]): void {
  const it: Iterator = { offset: 0 };
  encoder.encode(it);
  const shared = it.offset;
  for (let i = 0; i < views.length; i++) {
    const bytes = encoder.encodeView(views[i]!, shared, it);
    decoders[i]!.decode(bytes);
    it.offset = shared;
  }
  encoder.discardChanges();
}

function full(encoder: Encoder<ZoneState>, view: StateView): { state: ZoneState; decoder: Decoder } {
  const it: Iterator = { offset: 0 };
  encoder.encodeAll(it);
  const bytes = encoder.encodeAllView(view, it.offset, it);
  const state = new ZoneState();
  const decoder = new Decoder(state);
  decoder.decode(bytes);
  return { state, decoder };
}

describe('AoiGrid → real StateView / Encoder / Decoder', () => {
  it('each client decodes exactly its own row + the 3×3 population; walking across a boundary adds/removes', () => {
    const state = new ZoneState();
    const encoder = new Encoder(state);
    const g = new AoiGrid<PlayerState | SpawnState>();
    const mk = (id: string, x: number, z: number): PlayerState => {
      const p = new PlayerState();
      p.id = id;
      p.x = x;
      p.z = z;
      state.players.set(id, p);
      return p;
    };
    const a = mk('a', 5, 5); // cell [0,0]
    const b = mk('b', 40, 5); // cell [1,0]
    const c = mk('c', 200, 5); // cell [6,0] — far
    const sp = new SpawnState();
    sp.id = 'mire_route:1';
    sp.speciesId = 'mossling';
    sp.x = 70;
    sp.z = 5; // cell [2,0]
    state.spawns.set(sp.id, sp);

    const views = new Map<string, StateView>();
    for (const p of [a, b, c]) {
      const v = new StateView();
      v.add(p); // own avatar, added at join, never removed by AOI
      views.set(p.id, v);
    }
    // first AOI pass: viewers placed, then entities placed
    for (const p of [a, b, c]) {
      const { show } = g.moveViewer(p.id, null, cellOf(p.x, p.z));
      for (const e of show) views.get(p.id)!.add(e);
    }
    for (const e of [a, b, c, sp]) {
      const { entered } = g.place(e);
      for (const v of entered) views.get(v)!.add(e);
    }
    const ca = full(encoder, views.get('a')!);
    const cb = full(encoder, views.get('b')!);
    const cc = full(encoder, views.get('c')!);
    encoder.discardChanges();
    expect([...ca.state.players.keys()].sort()).toEqual(['a', 'b']);
    expect([...ca.state.spawns.keys()]).toEqual([]); // spawn is 2 cells away from a
    expect([...cb.state.players.keys()].sort()).toEqual(['a', 'b']);
    expect([...cb.state.spawns.keys()]).toEqual(['mire_route:1']);
    expect([...cc.state.players.keys()]).toEqual(['c']);

    // a walks east into cell [1,0]: sees the spawn now; c still sees nobody
    a.x = 36;
    const from = cellOf(5, 5);
    const to = cellOf(a.x, a.z);
    const mv = g.moveViewer('a', from, to);
    for (const e of mv.show) views.get('a')!.add(e);
    for (const e of mv.hide) views.get('a')!.remove(e);
    const pl = g.place(a);
    for (const v of pl.entered) views.get(v)!.add(a);
    for (const v of pl.left) views.get(v)!.remove(a);
    tick(encoder, [views.get('a')!, views.get('b')!, views.get('c')!], [ca.decoder, cb.decoder, cc.decoder]);
    expect([...ca.state.spawns.keys()]).toEqual(['mire_route:1']);
    expect(cb.state.players.get('a')?.x).toBe(36);
    expect([...cc.state.players.keys()]).toEqual(['c']);

    // despawn: removed from every view, then deleted from the map
    for (const v of g.removeEntity(sp)) views.get(v)!.remove(sp);
    state.spawns.delete(sp.id);
    tick(encoder, [views.get('a')!, views.get('b')!, views.get('c')!], [ca.decoder, cb.decoder, cc.decoder]);
    expect(ca.state.spawns.size).toBe(0);
    expect(cb.state.spawns.size).toBe(0);

    // leave: b removed from every other view before delete, own view disposed
    for (const v of g.removeEntity(b)) views.get(v)!.remove(b);
    g.removeViewer('b');
    state.players.delete('b');
    views.get('b')!.dispose();
    tick(encoder, [views.get('a')!, views.get('c')!], [ca.decoder, cc.decoder]);
    expect([...ca.state.players.keys()]).toEqual(['a']);
  });
});
