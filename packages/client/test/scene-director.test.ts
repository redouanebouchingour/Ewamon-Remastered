/**
 * §20.4.3 SceneDirector over a recording renderer: loadZone builds the adapter's spec and spawns the NPCs present for
 * the player's flags + trainers, registers the interactables (the gym leader at its hall `leaderAt`), plays the
 * banner, starts the theme; enterBattle pushes the camera in (Pillar 7) and dresses the arena without unloading;
 * exitBattle undresses + releases; a flags change that changes harvestStateFor calls setHarvestLevel exactly once
 * (§50.4.7 store.test's harvest clause); unloadZone disposes the handle and despawns everything.
 */
import { describe, expect, it } from 'vitest';
import { beatDoneFlag, interiorLeaders, zone } from '@ewa/content';
import type { Renderer, ZoneHandle, ZoneSpec } from '@ewa/render';
import { createAudioDirector } from '../src/audio/AudioDirector';
import { HudWriter } from '../src/scene/HudWriter';
import { InteractionTargets } from '../src/scene/interaction';
import { FRAME_SHIFT_M, MARGIN_M, arenaOcclusion, createSceneDirector, pickBattleHeading } from '../src/scene/SceneDirector';

function fakeRenderer() {
  const log: string[] = [];
  const actors = new Set<string>();
  let disposed = 0;
  let heading = 0;
  const r = {
    loadZone: async (spec: ZoneSpec): Promise<ZoneHandle> => {
      log.push(`loadZone ${spec.id} harvest ${spec.harvestLevel}`);
      return {
        id: spec.id, group: {} as ZoneHandle['group'], collider: { blocked: () => false, sample: () => 0 } as unknown as ZoneHandle['collider'],
        bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 }, geometryDigest: '00000000', stats: () => ({}) as ReturnType<ZoneHandle['stats']>,
        dispose: () => { disposed++; },
      };
    },
    actors: {
      spawn: (id: string) => { actors.add(id); },
      setTransform: () => undefined,
      despawn: (id: string) => { actors.delete(id); },
    },
    camera: {
      get headingIndex() { return heading; },
      setHeading: (h: number) => { heading = h; log.push(`heading ${h}`); },
      pushIn: (t: { x: number; z: number }, ms: number) => log.push(`pushIn ${t.x.toFixed(1)} ${t.z.toFixed(1)} ${ms}`),
      release: (ms: number) => log.push(`release ${ms}`),
    },
    stage: {
      dress: (at: { x: number; z: number }, terrain: string) => log.push(`dress ${at.x} ${at.z} ${terrain}`),
      undress: (ms: number) => log.push(`undress ${ms}`),
    },
    setWeather: (w: string) => log.push(`weather ${w}`),
    setTimeOfDay: () => undefined,
    setHarvestLevel: (l: number) => log.push(`harvest ${l}`),
  };
  return { r: r as unknown as Renderer, log, actors, disposed: () => disposed };
}

describe('SceneDirector', () => {
  it('loads Mirevale: statics for the flags, interactables incl. the gym leader in its hall, banner, theme', async () => {
    const { r, log, actors } = fakeRenderer();
    const hud = new HudWriter(null);
    const prompts: unknown[] = [];
    const targets = new InteractionTargets((p) => prompts.push(p));
    const audio = createAudioDirector({ createContext: () => null });
    let flags = new Set<string>();
    let zoneSeen = '';
    const d = createSceneDirector({
      renderer: r, hud, audio, targets, selfId: () => 'me', flags: () => flags, interactKey: () => 'E',
      onZone: (h) => { zoneSeen = h?.id ?? ''; }, setInputEnabled: (on) => log.push(`input ${on}`), setAccentType: (t) => log.push(`accent ${t}`),
      reducedMotion: () => false,
    });
    await d.loadZone('mirevale', 'intact');
    expect(d.currentZone).toBe('mirevale');
    expect(zoneSeen).toBe('mirevale');
    expect(log).toContain('loadZone mirevale harvest 0');
    expect(log).toContain('accent Grass');
    const z = zone('mirevale');
    for (const n of z.npcs.filter((x) => x.when === null)) expect(actors.has(n.id), n.id).toBe(true);
    const gym = targets.staticEntries().find((e) => e.kind === 'gym');
    const leader = interiorLeaders('mirevale').find((l) => l.leagueId === 'verdant_gym')!;
    expect(gym).toMatchObject({ id: 'verdant_gym', x: leader.x, z: leader.z });
    expect(targets.staticEntries().filter((e) => e.kind === 'item' && z.items.some((i) => i.id === e.id))).toHaveLength(z.items.length);
    expect(hud.current().zoneName).toBe('Mirevale');
    expect(audio.state.theme).toBe('grove');
    // walking next to Prof. Wynn prompts "E — Talk to Prof. Wynn"
    const wynn = z.npcs.find((n) => n.id === 'mirevale.wynn')!;
    targets.step(wynn.x + 1, wynn.z, false);
    expect(prompts.at(-1)).toEqual({ key: 'E', verb: 'Talk to', target: 'Prof. Wynn' });

    // Pillar 7: battle in place
    await d.enterBattle({ battleId: 'b', x: 3, z: 4, format: 'wild' });
    expect(d.inBattle).toBe(true);
    expect(log).toContain('input false');
    expect(log.some((l) => l.startsWith('pushIn'))).toBe(true);
    expect(log).toContain('dress 3 4 grove');
    expect(log.filter((l) => l.startsWith('loadZone'))).toHaveLength(1);
    await d.exitBattle();
    expect(log).toContain('undress 400');
    expect(log).toContain('release 600');
    expect(log.at(-1)).toBe('input true');

    d.unloadZone();
    expect(d.currentZone).toBeNull();
    expect(actors.size).toBe(0);

    // Mire Route: the `grove_gone` beat flattens it → exactly one setHarvestLevel(2); the same flags again → none
    await d.loadZone('mire_route', 'intact');
    const before = log.filter((l) => l.startsWith('harvest')).length;
    flags = new Set([beatDoneFlag('grove_gone')]);
    d.refreshFlags(flags);
    d.refreshFlags(flags);
    expect(log.filter((l) => l.startsWith('harvest')).slice(before)).toEqual(['harvest 2']);
    expect(audio.state.harvested).toBe(true);
  });

  it('picks the least-occluded battle heading (blockers between the camera and the arena)', () => {
    // blockers around the midpoint between the arena and the heading-0 battle camera (yaw −35° + 12°, 10.6 m out)
    const yaw = ((-35 + 12) * Math.PI) / 180;
    const mx = Math.sin(yaw) * 5.3;
    const mz = Math.cos(yaw) * 5.3;
    const wall = { blocked: (x: number, z: number) => Math.hypot(x - mx, z - mz) < 1.5 };
    const n0 = arenaOcclusion(wall, 0, 0, 0);
    const best = pickBattleHeading(wall, 0, 0, 0);
    expect(n0).toBeGreaterThan(0);
    expect(arenaOcclusion(wall, 0, 0, best)).toBeLessThan(n0);
    expect(pickBattleHeading({ blocked: () => false }, 0, 0, 2)).toBe(2);
  });

  it('keeps the battle camera out of tree crowns and out of the blocker-free margin forest', () => {
    // one trunk 2 m beside the heading-0 camera's ground point: no ground line crosses it, the crown does
    const yaw = ((-35 + 12) * Math.PI) / 180;
    const fy = (-35 * Math.PI) / 180;
    const camX = Math.sin(fy) * FRAME_SHIFT_M + Math.sin(yaw) * 10.6;
    const camZ = Math.cos(fy) * FRAME_SHIFT_M + Math.cos(yaw) * 10.6;
    const trunk = { blocked: (x: number, z: number) => Math.hypot(x - (camX + 2), z - camZ) < 0.8 };
    expect(arenaOcclusion(trunk, 0, 0, 0)).toBeGreaterThan(0);
    expect(pickBattleHeading(trunk, 0, 0, 0)).not.toBe(0);
    // an arena 6 m inside the +x margin band of a 200 m zone: headings whose camera lands in the band lose
    const open = { blocked: () => false };
    const x = 100 - MARGIN_M - 6;
    const scores = [0, 1, 2, 3].map((h) => arenaOcclusion(open, x, 0, h, 100));
    const best = pickBattleHeading(open, x, 0, scores.indexOf(Math.max(...scores)), 100);
    expect(Math.max(...scores)).toBeGreaterThan(0);
    expect(scores[best]).toBe(Math.min(...scores));
    expect(arenaOcclusion(open, 0, 0, 0, 100)).toBe(0);
  });
});
