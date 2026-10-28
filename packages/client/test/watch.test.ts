/**
 * Watching battles in the open world: the Watch panel's lines (battle/watchLines.ts), the field as a turn changes it,
 * the watch store, and the spectator rings (scene/SpectatorViews.ts) against fake render deps: a ring and its creatures
 * for a battle near the player and not their own, the fighters at the trainer slots, the Watch prompt, a switch-in
 * rebinding a stand, and everything gone when the battle ends or the player walks away.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Group } from 'three/webgpu';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import type { WatchBattler, WatchEvent } from '@ewa/protocol';
import { applyWatchEvents, watchLines, watchSideName } from '../src/battle/watchLines';
import { SpectatorViews, WATCH_BEAT_MS, watchTargetId } from '../src/scene/SpectatorViews';
import type { SpectatedBattle } from '../src/scene/SpectatorViews';
import { InteractionTargets } from '../src/scene/interaction';
import { useWatchStore } from '../src/state/watch';

const B = (side: 0 | 1, species: string, hpPct = 100): WatchBattler => ({ side, pos: 0, species, flags: 0, level: 12, hpPct, status: '' });

describe('watch lines', () => {
  /** the names as the panel reads them: `field()` is read on every line, so a switch-in applied mid-turn shows */
  const names = (field: () => readonly WatchBattler[]) => ({
    sides: ['Rex', 'Wild'] as const,
    species: (side: 0 | 1, pos: 0 | 1) => field().find((f) => f.side === side && f.pos === pos)?.species ?? null,
  });

  it('words a turn from the spectator side: moves, effectiveness, status, faint, the end', () => {
    let field = [B(0, 'mossling'), B(1, 'glimp')];
    const events: WatchEvent[] = [
      { k: 'move', side: 0, pos: 0, move: 'Vine Lash' },
      { k: 'hit', side: 1, pos: 0, hpPct: 40, eff: 'super', crit: false, byMove: true },
      { k: 'status', side: 1, pos: 0, status: 'poison' },
      { k: 'move', side: 1, pos: 0, move: 'Tackle' },
      { k: 'miss', side: 1, pos: 0 },
      { k: 'faint', side: 1, pos: 0 },
      { k: 'end', winner: 0 },
    ];
    const lines = watchLines(events, names(() => field), (e) => {
      field = applyWatchEvents(field, [e]);
    });
    expect(lines).toEqual([
      "Rex's Mossling used Vine Lash!",
      "It's super effective!",
      'The wild Glimp was poisoned!',
      'The wild Glimp used Tackle!',
      'The wild Glimp missed!',
      'The wild Glimp fainted!',
      'Rex won the battle!',
    ]);
    for (const l of lines) expect(l).not.toMatch(/—/);
  });

  it('a switch-in names the new creature in the lines after it; a draw, a flight, a catch', () => {
    let field = [B(0, 'mossling'), B(1, 'glimp')];
    const lines = watchLines(
      [
        { k: 'in', b: B(0, 'cindercap') },
        { k: 'move', side: 0, pos: 0, move: 'Ember' },
        { k: 'throw', side: 0 },
        { k: 'catch', caught: true },
        { k: 'end', winner: 'caught' },
      ],
      names(() => field),
      (e) => {
        field = applyWatchEvents(field, [e]);
      },
    );
    expect(lines).toEqual(['Rex sent out Cindercap!', "Rex's Cindercap used Ember!", 'Rex threw an orb!', 'Gotcha! It was caught!', 'Rex caught it!']);
    expect(watchLines([{ k: 'end', winner: 'draw' }], names(() => field))).toEqual(['The battle ended in a draw.']);
    expect(watchLines([{ k: 'fled', side: 0 }], names(() => field))).toEqual(['Rex ran away.']);
    // a player's name keeps its own case at the start of a line
    const lower = { sides: ['rex', 'Wild'] as const, species: () => 'mossling' };
    expect(watchLines([{ k: 'move', side: 0, pos: 0, move: 'Tackle' }, { k: 'faint', side: 1, pos: 0 }], lower)).toEqual(["rex's Mossling used Tackle!", 'The wild Mossling fainted!']);
  });

  it('side names: a player as is, wild empty, an NPC trainer through the battle naming', () => {
    expect(watchSideName('rex')).toBe('rex');
    expect(watchSideName('')).toBe('Wild');
    expect(watchSideName(undefined)).toBe('Wild');
    expect(watchSideName('npc:unknown_trainer_x')).not.toContain('npc:');
  });

  it('applies hp, status and faints to the field without touching the input', () => {
    const f = [B(0, 'mossling'), B(1, 'glimp')];
    const next = applyWatchEvents(f, [
      { k: 'hit', side: 1, pos: 0, hpPct: 30, eff: 'normal', crit: false, byMove: true },
      { k: 'status', side: 1, pos: 0, status: 'burn' },
      { k: 'faint', side: 0, pos: 0 },
    ]);
    expect(next[1]).toMatchObject({ hpPct: 30, status: 'burn' });
    expect(next[0]!.hpPct).toBe(0);
    expect(f[1]!.hpPct).toBe(100);
  });
});

describe('watch store', () => {
  beforeEach(() => useWatchStore.getState().stop());

  it('keeps the last lines of the watched battle only, and its end once', () => {
    const st = useWatchStore.getState();
    st.start('b1');
    st.push('other', ['nope']);
    st.push('b1', ['1', '2', '3', '4', '5', '6', '7']);
    expect(useWatchStore.getState().log.map((l) => l.text)).toEqual(['2', '3', '4', '5', '6', '7']);
    st.end('b1', 'Rex won the battle!');
    st.end('b1', 'again');
    expect(useWatchStore.getState().ended).toBe('Rex won the battle!');
    st.stop();
    expect(useWatchStore.getState()).toMatchObject({ battleId: null, log: [], ended: null });
  });
});

interface FakeBb {
  readonly id: string;
  pos: [number, number, number];
  poses: string[];
  faint: number;
  disposed: boolean;
}

function fakeDeps() {
  const made: FakeBb[] = [];
  const dressed: string[] = [];
  let leases = 0;
  const targets = new InteractionTargets(() => undefined);
  const deps = {
    parent: new Group(),
    acquire: (d: SpriteDescriptor): CreatureBillboard => {
      const f: FakeBb = { id: d.id, pos: [0, 0, 0], poses: [], faint: 0, disposed: false };
      made.push(f);
      return {
        object: new Group(),
        setFacing: () => undefined,
        setModelScope: () => undefined,
        setPosition: (x: number, y: number, z: number) => {
          f.pos = [x, y, z];
        },
        setPoseAxis: () => undefined,
        setPose: (p: string) => {
          f.poses.push(p);
        },
        setFaint: (v: number) => {
          f.faint = v;
        },
        dispose: () => {
          f.disposed = true;
        },
      } as unknown as CreatureBillboard;
    },
    descriptor: (sp: string, key: string) => ({ id: key, species: sp }) as unknown as SpriteDescriptor,
    leaseSprites: () => {
      leases++;
      return {
        release: () => {
          leases--;
        },
      };
    },
    height: () => 0,
    dress: (x: number, z: number) => dressed.push(`+${x},${z}`),
    undress: (x: number, z: number) => dressed.push(`-${x},${z}`),
    targets,
    interactKey: () => 'E',
  };
  return { deps, made, dressed, targets, leases: () => leases };
}

const battle = (o: Partial<SpectatedBattle> = {}): SpectatedBattle => ({
  id: 'b1', x: 10, z: 0, angle: 0, participants: ['p1', 'p2'], trainers: ['rex', 'mia'], field: [B(0, 'mossling'), B(1, 'glimp')], ...o,
});

describe('spectator rings', () => {
  it('a ring with both creatures for a battle near the player; the fighters on the trainer slots; the Watch prompt', () => {
    const f = fakeDeps();
    const v = new SpectatorViews(f.deps);
    v.sync([battle()], 'me', 0, 0);
    expect(v.ringIds).toEqual(['b1']);
    expect(f.dressed).toEqual(['+10,0']);
    expect(v.standCount('b1')).toBe(2);
    expect(f.leases()).toBe(2);
    // the two creatures stand on opposite sides of the centre along the axis (5.5 m apart)
    const [a, b] = f.made;
    expect(Math.hypot(a!.pos[0] - b!.pos[0], a!.pos[2] - b!.pos[2])).toBeCloseTo(5.5, 3);
    expect((a!.pos[0] + b!.pos[0]) / 2).toBeCloseTo(10, 3);
    const spot = v.trainerSpot('p1')!;
    expect(Math.hypot(spot.x - 10, spot.z)).toBeCloseTo(4.45, 2);
    expect(v.trainerSpot('p2')).not.toBeNull();
    const t = f.targets.dynamicEntry(watchTargetId('b1'))!;
    expect(t).toMatchObject({ kind: 'watch', x: 10, z: 0, prompt: { verb: 'Watch', target: 'rex vs mia' } });
  });

  it('no ring for the player own battle or one out of range; it goes when the battle ends or the player walks off', () => {
    const f = fakeDeps();
    const v = new SpectatorViews(f.deps);
    v.sync([battle({ participants: ['me', 'p2'] })], 'me', 0, 0);
    v.sync([battle({ id: 'far', x: 200 })], 'me', 0, 0);
    expect(v.ringIds).toEqual([]);
    v.sync([battle()], 'me', 0, 0);
    v.sync([battle()], 'me', 60, 0);
    expect(v.ringIds).toEqual([]);
    expect(f.dressed).toEqual(['+10,0', '-10,0']);
    expect(f.made.every((m) => m.disposed)).toBe(true);
    expect(f.leases()).toBe(0);
    expect(f.targets.dynamicEntry(watchTargetId('b1'))).toBeUndefined();
    expect(v.trainerSpot('p1')).toBeNull();
  });

  it('a switch-in rebinds that stand; a turn plays one beat apart; a faint holds', () => {
    const f = fakeDeps();
    const v = new SpectatorViews(f.deps);
    v.sync([battle()], 'me', 0, 0);
    v.play('b1', [
      { k: 'move', side: 0, pos: 0, move: 'Tackle' },
      { k: 'hit', side: 1, pos: 0, hpPct: 0, eff: 'normal', crit: false, byMove: true },
      { k: 'faint', side: 1, pos: 0 },
    ]);
    v.update(1);
    expect(f.made[0]!.poses).toEqual(['lunge']);
    v.update(WATCH_BEAT_MS);
    expect(f.made[1]!.poses).toEqual(['hurt']);
    v.update(WATCH_BEAT_MS);
    expect(f.made[1]!.poses).toEqual(['hurt', 'faint']);
    v.sync([battle({ field: [B(0, 'mossling'), B(1, 'glimp', 0)] })], 'me', 0, 0);
    expect(f.made[1]!.faint).toBe(1);
    v.sync([battle({ field: [B(0, 'mossling'), B(1, 'cindercap')] })], 'me', 0, 0);
    expect(f.made[1]!.disposed).toBe(true);
    expect(f.made).toHaveLength(3);
    expect(v.standCount('b1')).toBe(2);
  });
});
