/**
 * Creature texture residency (client IMPLEMENTATION-NOTES "Creature textures"; render §10.4.2 bind / release; SPEC
 * §50.2.2 texture cap): the bind / release refcounts (one bind per side however many views show it, nothing left over
 * after 100 show / hide cycles), the side each context shows (never the other side's flipbook), the grace period and
 * the idle LRU, the budget guard (idle flipbooks first, never a held texture or one a billboard samples; a flipbook that
 * does not fit waits on the static frame and binds when room frees up), the zone / battle holds — first on a fake pool,
 * then end to end on render's real `BillboardPool` (node, fake decoder): render frees what the client released.
 */
import { describe, expect, it, vi } from 'vitest';
import { BillboardPool, animAtlasSetBytes, atlasSetBytes } from '@ewa/render';
import type { AnimAtlasSet, AtlasDecoder, AtlasSet, CreatureBillboard } from '@ewa/render';
import type { CreatureManifest } from '../src/scene/spriteCatalog';
import { createSpriteCatalog } from '../src/scene/spriteCatalog';
import { BattleSprites, CreatureTextures, NO_LEASE, sideFor, stageSide } from '../src/scene/creatureTextures';
import type { CreatureSide, ShowContext, SpritePart, TexturePool } from '../src/scene/creatureTextures';
import { SpawnViews } from '../src/scene/SpawnViews';
import { LegendaryViews, STATIC_FLIPBOOK_FAR_M, STATIC_FLIPBOOK_NEAR_M } from '../src/scene/LegendaryViews';
import { RaidDen } from '../src/scene/RaidViews';
import { InteractionTargets } from '../src/scene/interaction';

// ---- fixtures ---------------------------------------------------------------------------------------------------

const map = (u: string) => ({ url: `atlases/${u}.webp`, mips: [1, 2, 3].map((i) => `atlases/${u}.m${i}.webp`), bytes: 10 });
const amap = (u: string) => ({ url: `anim/${u}.webp`, mips: [1, 2, 3].map((i) => `anim/${u}.m${i}.webp`), bytes: 100 });
const rect = (atlas: string, x: number) => ({ atlas, px: [x * 2048, 0, 1024, 1024] as const, uv: [x, 0.5, x + 0.5, 1] as const, footV: 0.08, aspect: 1 });
const pages = (n: number): [number, number, number, number][] => Array.from({ length: n }, (_u, i) => [(i % 6) / 6, 0.5, (i % 6) / 6 + 1 / 6, 1]);

/** 6 static atlases (a-000..a-005, two species each) and 3 animated legends with both sides as flipbooks. */
const STILL = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
const LEGENDS = ['legA', 'legB', 'legC'];
function manifest(): CreatureManifest {
  const atlases = Array.from({ length: 6 }, (_u, i) => {
    const id = `a-00${i}`;
    return { id, species: [] as string[], size: 2048 as const, albedo: map(`${id}.albedo`), normal: map(`${id}.normal`), emissive: map(`${id}.emissive`), normalScale: 0.5 as const };
  });
  const sprites: Record<string, CreatureManifest['sprites'][string]> = {};
  STILL.forEach((sp, i) => {
    const a = `a-00${Math.floor(i / 2)}`;
    sprites[sp] = { front: rect(a, (i % 2) * 0.5), back: rect(a, (i % 2) * 0.5), sizeScale: 1, home: a };
  });
  const animAtlases: NonNullable<CreatureManifest['animAtlases']>[number][] = [];
  for (const sp of LEGENDS) {
    sprites[sp] = {
      front: rect('a-005', 0.5), back: rect('a-005', 0), sizeScale: 1.4, home: 'a-005',
      anim: {
        front: { atlas: `anim-${sp}-front`, frames: pages(24), delays: Array(24).fill(125) as number[], staticFrame: 0 },
        back: { atlas: `anim-${sp}-back`, frames: pages(24), delays: Array(24).fill(125) as number[], staticFrame: 0 },
      },
    };
    for (const side of ['front', 'back'] as const) {
      animAtlases.push({ id: `anim-${sp}-${side}`, species: sp, side, width: 3072, height: 2048, cell: 512, albedo: amap(`${sp}.${side}.a`), normal: amap(`${sp}.${side}.n`), emissive: amap(`${sp}.${side}.e`), normalScale: 0.5 });
    }
  }
  return { version: 2, atlases, zones: { zoneA: ['a-000', 'a-001', 'a-002'], zoneB: ['a-002', 'a-003', 'a-004'] }, sprites, animAtlases };
}

const STATIC_BYTES = atlasSetBytes(2048, 0.5);          // 33.5 MB
const ANIM_BYTES = animAtlasSetBytes(3072, 2048, 0.5);   // 50.2 MB

/** A fake sprite pool: what is bound, every bind / release in order, settable billboard users, deferrable binds. */
function fakePool(o: { defer?: boolean } = {}) {
  const bound = new Map<string, number>();
  const log: string[] = [];
  const users = new Map<string, number>();
  const pending: (() => void)[] = [];
  const bind = (id: string): Promise<void> => {
    bound.set(id, (bound.get(id) ?? 0) + 1);
    log.push(`bind ${id}`);
    if (!o.defer) return Promise.resolve();
    return new Promise<void>((res) => pending.push(res));
  };
  const pool: TexturePool = {
    bindAtlas: (s: AtlasSet) => bind(s.id),
    bindAnimAtlas: (s: AnimAtlasSet) => bind(s.id),
    releaseAtlas: (id: string) => {
      const n = bound.get(id) ?? 0;
      if (n <= 1) bound.delete(id);
      else bound.set(id, n - 1);
      log.push(`release ${id}`);
    },
    atlasUsers: (id: string) => users.get(id) ?? 0,
  };
  return { pool, bound, log, users, land: () => pending.splice(0).forEach((f) => f()) };
}

/** A manual clock + timer the residency schedules its grace sweeps on. */
function fakeTime() {
  let t = 0;
  let timer: { at: number; fn: () => void } | null = null;
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      timer = { at: t + ms, fn };
      return timer;
    },
    clearTimer: (h: unknown) => {
      if (timer === h) timer = null;
    },
    advance(ms: number) {
      t += ms;
      while (timer !== null && timer.at <= t) {
        const f = timer.fn;
        timer = null;
        f();
      }
    },
  };
}

function setup(o: { budgetBytes?: number; graceMs?: number; idleAnim?: number; idleStatic?: number; defer?: boolean } = {}) {
  const cat = createSpriteCatalog(manifest(), () => undefined);
  const p = fakePool({ defer: o.defer });
  const time = fakeTime();
  const warn = vi.fn();
  const tex = new CreatureTextures({
    catalog: () => cat, pool: () => p.pool, now: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer, warn,
    budgetBytes: o.budgetBytes ?? 1e12, graceMs: o.graceMs ?? 20_000, idleAnim: o.idleAnim ?? 2, idleStatic: o.idleStatic ?? 4,
  });
  return { cat, tex, time, warn, ...p };
}

// ---- side selection ------------------------------------------------------------------------------------------------

describe('creature textures: which side each context shows', () => {
  it('the player\'s battlers show their back; everything else (spawns, statics, raid, remotes, evolution, inspector, foes) the front', () => {
    const want: Record<ShowContext, CreatureSide> = {
      wild: 'front', static: 'front', raid: 'front', remote: 'front', battleFoe: 'front', evolution: 'front', inspect: 'front', battlePlayer: 'back',
    };
    for (const [ctx, side] of Object.entries(want)) expect(sideFor(ctx as ShowContext), ctx).toBe(side);
    // render's stage side 0 is the near (viewer's) slot — singles and doubles alike
    expect(stageSide(0)).toBe('back');
    expect(stageSide(1)).toBe('front');
  });

  it('a lease binds the shown side\'s static atlas and flipbook, never the other side\'s flipbook', () => {
    const s = setup();
    expect(s.tex.sideAtlases('legA', 'front')).toEqual(['a-005', 'anim-legA-front']);
    expect(s.tex.sideAtlases('legA', 'back')).toEqual(['a-005', 'anim-legA-back']);
    expect(s.tex.sideAtlases('s3', 'back')).toEqual(['a-001']);
    expect(s.tex.sideAtlases('nobody', 'front')).toEqual([]);
    s.tex.show('legA', 'front');
    expect([...s.bound.keys()]).toEqual(['a-005', 'anim-legA-front']);
    expect(s.bound.has('anim-legA-back')).toBe(false);
    s.tex.show('legB', 'back');
    expect(s.bound.has('anim-legB-front')).toBe(false);
    expect(s.bound.has('anim-legB-back')).toBe(true);
  });

  it('BattleSprites: the near slot leases the back, the far slot the front, doubles too; a re-set of the same creature leases nothing new', () => {
    const s = setup();
    const b = new BattleSprites(() => s.tex);
    b.begin(['legA', 'legB', 's0', 's9']);
    // the teams' static atlases (both sides' — here one each) for the battle's life, no flipbook
    expect([...s.bound.keys()].sort()).toEqual(['a-000', 'a-004', 'a-005']);
    b.set({ side: 0, slot: 0 }, 'legA');
    b.set({ side: 1, slot: 0 }, 'legB');
    b.set({ side: 0, slot: 1 }, 's0');
    b.set({ side: 1, slot: 1 }, 'legC');
    expect(s.bound.has('anim-legA-back') && !s.bound.has('anim-legA-front')).toBe(true);
    expect(s.bound.has('anim-legB-front') && !s.bound.has('anim-legB-back')).toBe(true);
    expect(s.bound.has('anim-legC-front') && !s.bound.has('anim-legC-back')).toBe(true);
    const binds = s.log.length;
    b.set({ side: 0, slot: 0 }, 'legA');                      // the controller re-shows the same battler
    expect(s.log.length).toBe(binds);
    expect(s.tex.refs('anim-legA-back')).toBe(1);
    // a switch: the new battler's side binds, the old one idles
    b.set({ side: 1, slot: 0 }, 'legA');
    expect(s.tex.refs('anim-legA-front')).toBe(1);
    expect(s.tex.refs('anim-legB-front')).toBe(0);
    b.set({ side: 1, slot: 1 }, null);
    expect(s.tex.refs('anim-legC-front')).toBe(0);
    b.end();
    expect(b.size).toBe(0);
    for (const e of s.tex.stats().entries) expect(e.refs, e.id).toBe(0);
  });

  it('a switch-in animates on a full budget: its flipbook displaces benched team atlases (parked), which rebind once the old flipbook idles out', () => {
    // room for the four team atlases and ONE flipbook: the case a 3v3 of legendaries hit (9 sheets + 2 flipbooks of 400 MiB)
    const s = setup({ budgetBytes: 4 * STATIC_BYTES + ANIM_BYTES + 1 });
    const b = new BattleSprites(() => s.tex);
    b.begin(['s0', 's2', 's4', 'legA']);
    b.set({ side: 0, slot: 0 }, 'legA');
    expect(s.bound.has('anim-legA-back')).toBe(true);
    // the switch: the old billboard still samples legA's flipbook while legB's binds
    s.users.set('anim-legA-back', 1);
    b.set({ side: 0, slot: 0 }, 'legB');
    expect(s.bound.has('anim-legB-back')).toBe(true);
    expect(s.warn).not.toHaveBeenCalledWith(expect.stringContaining('waits (static frame)'));
    const parked = s.tex.stats().entries.filter((e) => e.parked).map((e) => e.id);
    expect(parked).toHaveLength(2);
    // the shown battler's own atlas (held by its slot too) is never displaced
    expect(parked).not.toContain('a-005');
    expect(s.bound.has('a-005')).toBe(true);
    // the old billboard is gone: the idle flipbook makes room and the benched atlases come back
    s.users.delete('anim-legA-back');
    s.tex.refresh();
    expect(s.tex.stats().entries.filter((e) => e.parked)).toHaveLength(0);
    for (const id of ['a-000', 'a-001', 'a-002', 'a-005', 'anim-legB-back']) expect(s.bound.has(id), id).toBe(true);
    expect(s.bound.has('anim-legA-back')).toBe(false);
    expect(s.tex.boundBytes).toBeLessThanOrEqual(4 * STATIC_BYTES + ANIM_BYTES + 1);
    b.end();
    for (const e of s.tex.stats().entries) expect(e.refs, e.id).toBe(0);
  });

  it('only a shown flipbook displaces reserve atlases: a held static or another reserve hold never does', () => {
    const s = setup({ budgetBytes: 2 * STATIC_BYTES + 1 });
    const team = s.tex.hold(['a-000', 'a-001'], undefined, null, { reserve: true });
    // a static atlas binds anyway over budget (a creature is always drawn) and parks nothing
    const other = s.tex.show('s4', 'front');
    expect(s.tex.stats().entries.filter((e) => e.parked)).toHaveLength(0);
    // a reserve-held flipbook waits rather than displace
    const res = s.tex.hold(['anim-legC-front'], undefined, null, { reserve: true });
    expect(s.bound.has('anim-legC-front')).toBe(false);
    expect(s.bound.has('a-000') && s.bound.has('a-001')).toBe(true);
    res.release();
    other.release();
    team.release();
    for (const e of s.tex.stats().entries) expect(e.refs, e.id).toBe(0);
  });
});

// ---- refcounts, grace, LRU -----------------------------------------------------------------------------------------

describe('creature textures: bind / release bookkeeping', () => {
  it('the same side shown twice binds once; the last release idles it; the grace period releases it once', () => {
    const s = setup();
    const a = s.tex.show('legA', 'front');
    const b = s.tex.show('legA', 'front');
    expect(s.log).toEqual(['bind a-005', 'bind anim-legA-front']);
    expect(s.tex.refs('anim-legA-front')).toBe(2);
    a.release();
    a.release();                                              // idempotent
    expect(s.tex.refs('anim-legA-front')).toBe(1);
    b.release();
    expect(s.tex.refs('anim-legA-front')).toBe(0);
    expect(s.tex.isBound('anim-legA-front')).toBe(true);      // idle, still on the GPU
    s.time.advance(19_999);
    expect(s.log).toEqual(['bind a-005', 'bind anim-legA-front']);
    s.time.advance(1);
    expect(s.log.slice(2).sort()).toEqual(['release a-005', 'release anim-legA-front']);
    expect(s.bound.size).toBe(0);
    expect(s.tex.boundBytes).toBe(0);
    expect(s.tex.stats().entries).toEqual([]);
  });

  it('re-showing within the grace period costs no upload; after it, one', () => {
    const s = setup();
    s.tex.show('legA', 'front').release();
    s.time.advance(10_000);
    const again = s.tex.show('legA', 'front');
    expect(s.log.filter((l) => l.startsWith('bind'))).toHaveLength(2);
    again.release();
    s.time.advance(20_000);
    expect(s.bound.size).toBe(0);
    s.tex.show('legA', 'front');
    expect(s.log.filter((l) => l.startsWith('bind'))).toHaveLength(4);
  });

  it('no leak over 100 show / hide cycles of spawns, statics, battles, evolutions and zone holds', () => {
    const s = setup();
    const battle = new BattleSprites(() => s.tex);
    let zone = s.tex.hold(s.cat.zoneAtlases('zoneA'));
    const all = [...STILL, ...LEGENDS];
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed % n;
    };
    for (let i = 0; i < 100; i++) {
      const spawn = s.tex.show(all[rnd(all.length)]!, sideFor('wild'));
      const statue = s.tex.show(LEGENDS[rnd(3)]!, sideFor('static'));
      battle.begin([all[rnd(all.length)]!, all[rnd(all.length)]!]);
      battle.set({ side: 0, slot: 0 }, all[rnd(all.length)]!);
      battle.set({ side: 1, slot: 0 }, all[rnd(all.length)]!);
      battle.set({ side: 1, slot: 0 }, all[rnd(all.length)]!);
      const evo = [s.tex.show(all[rnd(all.length)]!, 'front'), s.tex.show(all[rnd(all.length)]!, 'front')];
      if (i % 10 === 0) zone = s.tex.hold(s.cat.zoneAtlases(i % 20 === 0 ? 'zoneB' : 'zoneA'), undefined, zone);
      s.time.advance(rnd(5_000));
      battle.end();
      for (const l of evo) l.release();
      statue.release();
      spawn.release();
      s.time.advance(rnd(3_000));
    }
    zone.release();
    // everything idles; nothing is held
    for (const e of s.tex.stats().entries) expect(e.refs, e.id).toBe(0);
    s.time.advance(20_000);
    expect(s.tex.stats().entries).toEqual([]);
    expect(s.tex.boundBytes).toBe(0);
    expect(s.bound.size).toBe(0);
    // every bind was released exactly once
    const binds = s.log.filter((l) => l.startsWith('bind')).length;
    const releases = s.log.filter((l) => l.startsWith('release')).length;
    expect(releases).toBe(binds);
    expect(s.tex.stats().binds).toBe(binds);
  });

  it('the idle LRU keeps at most idleAnim flipbooks and idleStatic static atlases; the oldest go first', () => {
    const s = setup({ idleAnim: 2, idleStatic: 1 });
    s.tex.show('legA', 'front').release();
    s.time.advance(10);
    s.tex.show('legB', 'front').release();
    s.time.advance(10);
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual([]);
    s.tex.show('legC', 'back').release();
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual(['release anim-legA-front']);
    s.tex.show('s0', 'front').release();                       // a-000 idles beside a-005: one static over
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual(['release anim-legA-front', 'release a-005']);
    expect(s.tex.stats().idle).toBe(3);
  });

  it('a hold that replaces another never idles what both hold (a zone handover keeps the shared atlas)', () => {
    const s = setup({ idleStatic: 0 });
    const a = s.tex.hold(s.cat.zoneAtlases('zoneA'));
    const b = s.tex.hold(s.cat.zoneAtlases('zoneB'), undefined, a);
    expect(a.released).toBe(true);
    expect(s.log).toEqual([
      'bind a-000', 'bind a-001', 'bind a-002',
      // zoneA's own atlases idle (and, with no idle room, go) before zoneB binds anything new; a-002 never moves
      'release a-000', 'release a-001', 'bind a-003', 'bind a-004',
    ]);
    expect(s.tex.refs('a-002')).toBe(1);
    b.release();
  });

  it('ready settles once the binds land; onSettled names each', async () => {
    const s = setup({ defer: true });
    const seen: string[] = [];
    const h = s.tex.hold(['a-000', 'anim-legA-front', 'nope'], (id) => seen.push(id));
    expect(h.ids).toEqual(['a-000', 'anim-legA-front']);        // unknown ids are skipped
    let done = false;
    void h.ready.then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    s.land();
    await h.ready;
    expect(done).toBe(true);
    expect(seen.sort()).toEqual(['a-000', 'anim-legA-front']);
  });

  it('a failed bind holds no bytes and is not released to render', async () => {
    const s = setup();
    s.pool.bindAnimAtlas = () => Promise.reject(new Error('404'));
    const h = s.tex.show('legA', 'front');
    await h.ready;
    expect(s.tex.isBound('anim-legA-front')).toBe(false);
    expect(s.tex.boundBytes).toBe(STATIC_BYTES);
    expect(s.warn).toHaveBeenCalledWith(expect.stringContaining('anim-legA-front'));
    h.release();
    s.time.advance(20_000);
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual(['release a-005']);
  });
});

// ---- the budget guard ----------------------------------------------------------------------------------------------

describe('creature textures: the budget guard', () => {
  it('evicts idle flipbooks first (least recently used), then idle static atlases — never a held one, never one a billboard samples', () => {
    // room for 3 statics + 2 flipbooks
    const s = setup({ budgetBytes: 3 * STATIC_BYTES + 2 * ANIM_BYTES, idleAnim: 9, idleStatic: 9 });
    const held = s.tex.show('legA', 'front');                  // a-005 + anim-legA-front, on screen
    s.tex.show('legB', 'front').release();                     // idle flipbook (older)
    s.time.advance(10);
    s.tex.show('s0', 'front').release();                       // idle static a-000
    s.time.advance(10);
    s.users.set('a-000', 1);                                   // ... which a billboard still samples
    s.tex.show('s2', 'front').release();                       // idle static a-001
    expect(s.tex.boundBytes).toBe(3 * STATIC_BYTES + 2 * ANIM_BYTES);
    // a new flipbook: the idle flipbook goes, not the held one
    const c = s.tex.show('legC', 'back');
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual(['release anim-legB-front']);
    expect(s.tex.isBound('anim-legC-back')).toBe(true);
    // a new static atlas: the idle static nobody samples goes (a-001), never a-000 (sampled) or a-005 (held)
    s.tex.show('s6', 'front');
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual(['release anim-legB-front', 'release a-001']);
    expect(s.tex.isBound('a-000') && s.tex.isBound('a-005') && s.tex.isBound('anim-legA-front')).toBe(true);
    expect(s.tex.boundBytes).toBeLessThanOrEqual(s.tex.budgetBytes);
    held.release();
    c.release();
  });

  it('a flipbook that does not fit waits on the static frame (not bound) and binds once room frees up', () => {
    const s = setup({ budgetBytes: 2 * STATIC_BYTES + ANIM_BYTES });
    const a = s.tex.show('legA', 'front');                     // a-005 + flipbook: 1 static + 1 anim
    const z = s.tex.show('s0', 'front');                       // a-000: full
    const b = s.tex.show('legB', 'front');                     // a-005 shared; its flipbook does not fit
    expect(s.tex.isBound('anim-legB-front')).toBe(false);
    expect(s.tex.stats().denied).toBe(1);
    expect(s.warn).toHaveBeenCalledWith(expect.stringContaining('anim-legB-front'));
    expect(s.tex.boundBytes).toBeLessThanOrEqual(s.tex.budgetBytes);
    a.release();                                               // legA's flipbook idles → released for the waiting one
    expect(s.tex.isBound('anim-legB-front')).toBe(true);
    expect(s.tex.isBound('anim-legA-front')).toBe(false);
    expect(s.tex.stats().denied).toBe(0);
    b.release();
    z.release();
  });

  it('a static atlas always binds (a creature is always drawn), reported once over the budget', () => {
    const s = setup({ budgetBytes: STATIC_BYTES });
    const a = s.tex.show('s0', 'front');
    const b = s.tex.show('s2', 'front');
    const c = s.tex.show('s4', 'front');
    expect(s.tex.isBound('a-001') && s.tex.isBound('a-002')).toBe(true);
    expect(s.warn).toHaveBeenCalledTimes(2);
    for (const l of [a, b, c]) l.release();
  });

  it('the guard never releases a held texture, however far over the budget the request goes', () => {
    const s = setup({ budgetBytes: 1 });
    const leases = LEGENDS.map((sp) => s.tex.show(sp, 'front'));
    expect(s.log.filter((l) => l.startsWith('release'))).toEqual([]);
    expect(s.tex.isBound('a-005')).toBe(true);
    for (const l of leases) l.release();
  });
});

// ---- the views lease what they show ----------------------------------------------------------------------------------

function fakeBillboard(): CreatureBillboard {
  const object = { visible: true, removeFromParent: vi.fn() };
  return { object, setFacing: vi.fn(), setFlipbook: vi.fn(), setPosition: vi.fn(), dispose: vi.fn() } as unknown as CreatureBillboard;
}

describe('creature textures: the world views lease the side they show and release it when they go', () => {
  const parent = { add: vi.fn() } as never;
  it('SpawnViews / LegendaryViews / RaidDen lease the front while they stand', () => {
    const leases: { sp: string; side: CreatureSide; part?: SpritePart; released: boolean }[] = [];
    const leaseSprites = (sp: string, side: CreatureSide, part?: SpritePart) => {
      const l = { sp, side, ...(part !== undefined ? { part } : {}), released: false };
      leases.push(l);
      return { release: () => { l.released = true; } };
    };
    const common = { parent, acquire: () => fakeBillboard(), leaseSprites, height: () => 0, targets: new InteractionTargets(() => undefined), interactKey: () => 'E' };
    const spawns = new SpawnViews({ ...common, descriptor: (sp, key) => ({ id: key } as never) });
    spawns.add({ id: 'w1', speciesId: 'legA', level: 5, x: 0, z: 0, variantKey: 'normal', isAlpha: false, engagedBy: '' });
    spawns.update({ id: 'w1', speciesId: 'legA', level: 5, x: 1, z: 0, variantKey: 'normal', isAlpha: false, engagedBy: '' });
    expect(leases).toEqual([{ sp: 'legA', side: 'front', released: false }]);
    spawns.remove('w1');
    expect(leases[0]!.released).toBe(true);

    const den = new RaidDen({ ...common, descriptor: (sp, key) => ({ id: key, sizeScale: 1 } as never) });
    den.sync({ id: 'r1', bossSpecies: 'legB', bossLevel: 50, phase: 0, x: 0, z: 0 });
    den.sync({ id: 'r1', bossSpecies: 'legB', bossLevel: 50, phase: 1, x: 0, z: 0 });   // a phase change keeps the boss
    expect(leases.slice(1)).toEqual([{ sp: 'legB', side: 'front', released: false }]);
    den.clear();
    expect(leases[1]!.released).toBe(true);

    // statics: the front's static atlas while it stands; its flipbook only while the player is near
    const statics = new LegendaryViews({ ...common, descriptor: (sp, key) => ({ id: key } as never) });
    const live = (): string[] => leases.slice(2).filter((l) => !l.released).map((l) => `${l.sp}:${l.side}:${l.part ?? 'all'}`).sort();
    statics.sync('galvan_route', new Set(['badge:circuit', 'champion:zeon:beaten']));
    // no viewer yet: both count as near
    expect(live()).toEqual(['raikitsune:front:flipbook', 'raikitsune:front:still', 'voltaura:front:flipbook', 'voltaura:front:still']);
    statics.setViewer(-84, 92);                                // beside raikitsune, ~150 m from voltaura
    expect(live()).toEqual(['raikitsune:front:flipbook', 'raikitsune:front:still', 'voltaura:front:still']);
    expect(statics.playing('raikitsune') && !statics.playing('voltaura')).toBe(true);
    statics.setViewer(-84, 92 + STATIC_FLIPBOOK_NEAR_M + 4);  // between NEAR and FAR: raikitsune keeps playing (hysteresis)
    expect(statics.playing('raikitsune')).toBe(true);
    statics.setViewer(-84, 92 + STATIC_FLIPBOOK_FAR_M + 8);
    expect(statics.playing('raikitsune')).toBe(false);
    statics.setViewer(92, -44);                                // at voltaura
    expect(live()).toEqual(['raikitsune:front:still', 'voltaura:front:flipbook', 'voltaura:front:still']);
    statics.sync('galvan_route', new Set(['badge:circuit', 'champion:zeon:beaten', 'leg_voltaura']));   // caught
    expect(live()).toEqual(['raikitsune:front:still']);
    statics.clear();
    expect(leases.every((l) => l.released)).toBe(true);
    expect(NO_LEASE.release()).toBeUndefined();
  });
});

// ---- end to end on render's pool ---------------------------------------------------------------------------------------

function fakeDecoder(): AtlasDecoder {
  return {
    decode: async (url) => {
      const lv = /\.m(\d)\./.exec(url);
      const level = lv ? Number(lv[1]) : 0;
      const anim = url.includes('/anim/');
      const half = url.includes('.n.') || url.includes('.normal.') ? 2 : 1;
      return { width: ((anim ? 3072 : 2048) / half) >> level, height: (2048 / half) >> level, close: () => {} };
    },
  };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('creature textures on render\'s BillboardPool: render frees what the client released', () => {
  it('a billboard shows its still frame, then its side\'s flipbook; hiding it and the grace period leave no atlas behind (100 cycles)', async () => {
    const cat = createSpriteCatalog(manifest(), () => undefined);
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    const time = fakeTime();
    // six idle flipbooks may wait out the grace: most cycles re-show an idle side (no upload), every 25th the grace runs out
    const tex = new CreatureTextures({ catalog: () => cat, pool: () => pool, now: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer, graceMs: 1_000, idleAnim: 6, budgetBytes: 1e12 });
    for (let i = 0; i < 100; i++) {
      const sp = LEGENDS[i % 3]!;
      const side: CreatureSide = i % 2 === 0 ? 'front' : 'back';
      const lease = tex.show(sp, side);
      const bb = pool.acquire(cat.descriptor(sp, `k${i}`)!);
      bb.setFacing(side);
      await settle();
      expect(bb.bound, `${i}`).toBe(true);
      expect(bb.animated, `${i}`).toBe(true);
      expect(pool.atlasUsers(`anim-${sp}-${side}`)).toBe(1);
      expect(tex.refs(`anim-${sp}-${side === 'front' ? 'back' : 'front'}`)).toBe(0);         // the other side is never held
      expect(pool.atlasUsers(`anim-${sp}-${side === 'front' ? 'back' : 'front'}`)).toBe(0);
      // the view goes: billboard first, then its lease
      bb.dispose();
      lease.release();
      time.advance(i % 25 === 24 ? 1_000 : 100);
    }
    expect(tex.stats().binds).toBeLessThanOrEqual(4 * 7);     // 4 grace periods × (6 sides + the static atlas)
    time.advance(1_000);
    expect(tex.boundBytes).toBe(0);
    expect(pool.stats()).toMatchObject({ live: 0, atlases: 0, bytes: 0 });
    pool.dispose();
  });

  it('a released atlas a billboard still samples stays until the billboard goes (render users), then the sweep frees it', async () => {
    const cat = createSpriteCatalog(manifest(), () => undefined);
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    const time = fakeTime();
    const tex = new CreatureTextures({ catalog: () => cat, pool: () => pool, now: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer, graceMs: 1_000 });
    const lease = tex.show('legA', 'front');
    const bb = pool.acquire(cat.descriptor('legA', 'x')!);
    await settle();
    expect(bb.animated).toBe(true);
    lease.release();                                           // a sloppy owner: the billboard is still up
    time.advance(5_000);
    expect(tex.isBound('anim-legA-front')).toBe(true);         // the sweep never releases a sampled atlas ...
    expect(tex.isBound('a-005')).toBe(false);                  // ... while the static one (the billboard plays its flipbook) goes
    expect(pool.stats().atlases).toBe(1);
    bb.dispose();
    time.advance(1_000);
    expect(tex.boundBytes).toBe(0);
    expect(pool.stats().atlases).toBe(0);
    pool.dispose();
  });
});
