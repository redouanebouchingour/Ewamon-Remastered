/**
 * The rumour board's crier (LLM feature 8, data/rumours.ts): one per town, in the bounty board's office hall, clear of
 * its walls, props and people; the hall otherwise unchanged; the zones a board talks about.
 */
import { describe, expect, it } from 'vitest';
import {
  BOUNTY_OFFICES,
  CRIER_LINES,
  ZONES,
  crierId,
  crierTown,
  hasRumourBoard,
  interiorsFor,
  rumourZones,
  withBountyBoard,
  withTownCrier,
} from '../src/index';
import { healerHall, shopHall } from '../src/data/interiors';

describe('the town crier', () => {
  it('stands in every town, once, in the hall that keeps the bounty board, and nowhere else', () => {
    for (const z of ZONES) {
      const criers = interiorsFor(z.id).flatMap((p) => p.def.npcs.filter((n) => n.role === 'crier').map((n) => ({ n, p })));
      expect(hasRumourBoard(z.id)).toBe(z.kind === 'town');
      if (z.kind !== 'town') {
        expect(criers).toEqual([]);
        continue;
      }
      expect(criers).toHaveLength(1);
      const { n, p } = criers[0]!;
      expect(p.def.id).toBe(BOUNTY_OFFICES[z.id]);
      expect(n.id).toBe(crierId(p.def.id));
      expect(crierTown(n.id)).toBe(z.id);
    }
    expect(crierTown('mirevale.healer.marshal')).toBeNull();
  });

  it('keeps clear of the walls, the props and the other people, inside the hall', () => {
    for (const z of ZONES.filter((x) => x.kind === 'town')) {
      const def = interiorsFor(z.id).find((p) => p.def.id === BOUNTY_OFFICES[z.id])!.def;
      const c = def.npcs.find((n) => n.role === 'crier')!;
      expect(Math.abs(c.lx)).toBeLessThan(def.w / 2 - 0.5);
      expect(Math.abs(c.lz)).toBeLessThan(def.d / 2 - 0.5);
      for (const w of def.walls) expect(Math.abs(c.lx - w.lx) > w.hw + 0.4 || Math.abs(c.lz - w.lz) > w.hd + 0.4).toBe(true);
      for (const q of def.props.filter((x) => x.kind !== 'rug')) expect(Math.hypot(c.lx - q.lx, c.lz - q.lz)).toBeGreaterThan(0.8);
      for (const n of def.npcs.filter((x) => x !== c)) expect(Math.hypot(c.lx - n.lx, c.lz - n.lz)).toBeGreaterThan(1.2);
      for (const it of def.items) expect(Math.hypot(c.lx - it.lx, c.lz - it.lz)).toBeGreaterThan(0.8);
      expect(Math.hypot(c.lx - def.entry.lx, c.lz - def.entry.lz)).toBeGreaterThan(1.2);
    }
  });

  it('adds only the crier: walls, props, size, doors and the other people unchanged', () => {
    const board = withBountyBoard(healerHall('mirevale', 'mirevale.healer', 'Mirevale Healer'));
    const crier = withTownCrier(board);
    expect(crier.walls).toEqual(board.walls);
    expect(crier.props).toEqual(board.props);
    expect([crier.w, crier.d, crier.entry, crier.exit, crier.label]).toEqual([board.w, board.d, board.entry, board.exit, board.label]);
    expect(crier.npcs.slice(0, board.npcs.length)).toEqual(board.npcs);
    expect(crier.npcs).toHaveLength(board.npcs.length + 1);
    // another town's hall, or a hall that is not the office: untouched
    expect(withTownCrier(shopHall('mirevale', 'mirevale.shop', 'Mirevale Mart'))).toEqual(shopHall('mirevale', 'mirevale.shop', 'Mirevale Mart'));
  });

  it('speaks without an em-dash', () => {
    const dash = String.fromCodePoint(0x2014);
    for (const line of CRIER_LINES) expect(line.includes(dash)).toBe(false);
  });

  it('talks about the town and the zones one link away', () => {
    const z = rumourZones('mirevale');
    expect(z[0]).toBe('mirevale');
    expect(z).toContain('mire_route');
    expect(new Set(z).size).toBe(z.length);
    expect(rumourZones('cinderhold')).toEqual(expect.arrayContaining(['cinderhold', 'mire_route', 'ash_route']));
  });
});
