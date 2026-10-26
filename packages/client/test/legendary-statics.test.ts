/**
 * Phase B1 — legendary statics in the client: which statics stand for a flag set (gate held, capture flag not), at
 * the server's snapped point (`nearestWalkable(h, x, z, 8)`); `LegendaryViews` spawns a billboard + a `static`
 * "Challenge" interactable and despawns it when its flag arrives; the SceneDirector syncs it on load / flags / unload.
 */
import { describe, expect, it } from 'vitest';
import { getHeightfield, nearestWalkable, statics, staticsFor } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { CreatureBillboard, Renderer, SpriteDescriptor, ZoneHandle, ZoneSpec } from '@ewa/render';
import { createAudioDirector } from '../src/audio/AudioDirector';
import { HudWriter } from '../src/scene/HudWriter';
import { InteractionTargets } from '../src/scene/interaction';
import type { HudPrompt } from '../src/scene/HudWriter';
import { LegendaryViews, STATIC_PREFIX, staticGateFlag, staticTargetId, visibleStatics } from '../src/scene/LegendaryViews';
import { NO_LEASE } from '../src/scene/creatureTextures';
import type { LegendaryViewDeps } from '../src/scene/LegendaryViews';
import { createSceneDirector } from '../src/scene/SceneDirector';

const RAI = staticsFor('galvan_route').find((s) => s.species === 'raikitsune')!;

function fakeViews() {
  const live = new Set<string>();
  const disposed: string[] = [];
  const prompts: (HudPrompt | null)[] = [];
  const targets = new InteractionTargets((p) => prompts.push(p));
  const deps: LegendaryViewDeps = {
    parent: { add: () => undefined } as unknown as LegendaryViewDeps['parent'],
    acquire: (d: SpriteDescriptor) => {
      live.add(d.key);
      return {
        object: { removeFromParent: () => live.delete(d.key), visible: true },
        setFacing: () => undefined,
        setFlipbook: () => undefined,
        setPosition: () => undefined,
        dispose: () => disposed.push(d.key),
      } as unknown as CreatureBillboard;
    },
    descriptor: (sp, key) => ({ key, speciesId: sp }) as unknown as SpriteDescriptor,
    leaseSprites: () => NO_LEASE,
    height: () => 0,
    targets,
    interactKey: () => 'E',
  };
  return { views: new LegendaryViews(deps), live, disposed, prompts, targets };
}

describe('legendary statics (Phase B1)', () => {
  it('gate flags: badge:<id> stays a badge flag, flag:<f> is f', () => {
    expect(staticGateFlag({ when: 'badge:circuit' })).toBe('badge:circuit');
    expect(staticGateFlag({ when: 'flag:champion:zeon:beaten' })).toBe('champion:zeon:beaten');
    expect(staticTargetId(`${STATIC_PREFIX}raikitsune`)).toBe('raikitsune');
  });

  it('visibleStatics: only with the gate held and the capture flag absent, at the server-snapped point', () => {
    expect(visibleStatics('galvan_route', new Set())).toEqual([]);
    const shown = visibleStatics('galvan_route', new Set(['badge:circuit']));
    const snapped = nearestWalkable(getHeightfield('galvan_route'), RAI.x, RAI.z, 8) ?? [RAI.x, RAI.z];
    expect(shown).toEqual([{ species: 'raikitsune', level: RAI.level, flag: RAI.flag, x: snapped[0], z: snapped[1], interior: null }]);
    expect(visibleStatics('galvan_route', new Set(['badge:circuit', RAI.flag]))).toEqual([]);
    // every static of the game appears once its gate is held
    for (const st of statics()) {
      const got = visibleStatics(st.zoneId as ZoneId, new Set([staticGateFlag(st)]));
      expect(got.map((g) => g.species), st.species).toContain(st.species);
    }
  });

  it('LegendaryViews: billboard + "Challenge" prompt; despawned (billboard disposed, interactable gone) when its flag arrives', () => {
    const { views, live, disposed, prompts, targets } = fakeViews();
    views.sync('galvan_route', new Set(['badge:circuit']));
    expect(views.size).toBe(1);
    expect(live.has(`${STATIC_PREFIX}raikitsune`)).toBe(true);
    const e = targets.dynamicEntry(`${STATIC_PREFIX}raikitsune`)!;
    expect(e).toMatchObject({ kind: 'static', prompt: { key: 'E', verb: 'Challenge', target: `Raikitsune Lv ${RAI.level}` } });
    targets.step(e.x + 1, e.z, false);
    expect(targets.current?.id).toBe(`${STATIC_PREFIX}raikitsune`);
    expect(prompts.at(-1)).toEqual(e.prompt);
    // the same flags again: nothing respawns
    views.sync('galvan_route', new Set(['badge:circuit']));
    expect(disposed).toEqual([]);
    // the capture / win flag arrives
    views.sync('galvan_route', new Set(['badge:circuit', RAI.flag]));
    expect(views.size).toBe(0);
    expect(disposed).toEqual([`${STATIC_PREFIX}raikitsune`]);
    expect(targets.dynamicEntry(`${STATIC_PREFIX}raikitsune`)).toBeUndefined();
    expect(targets.current).toBeNull();
    targets.step(e.x + 1, e.z, false); // the next fixed step clears the prompt
    expect(prompts.at(-1)).toBeNull();
  });

  it('SceneDirector syncs the statics on load, on a flag refresh and on unload', async () => {
    const calls: string[] = [];
    const r = {
      loadZone: async (spec: ZoneSpec): Promise<ZoneHandle> => ({
        id: spec.id, group: {} as ZoneHandle['group'], collider: { blocked: () => false, sample: () => 0 } as unknown as ZoneHandle['collider'],
        bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 }, geometryDigest: '00000000', stats: () => ({}) as ReturnType<ZoneHandle['stats']>,
        dispose: () => undefined,
      }),
      actors: { spawn: () => undefined, setTransform: () => undefined, despawn: () => undefined },
      camera: { headingIndex: 0, setHeading: () => undefined },
      setWeather: () => undefined,
      setTimeOfDay: () => undefined,
      setHarvestLevel: () => undefined,
    } as unknown as Renderer;
    let flags: ReadonlySet<string> = new Set(['badge:circuit']);
    const sync = { sync: (z: ZoneId | null, f: ReadonlySet<string>) => calls.push(`${z ?? 'null'} ${[...f].sort().join(',')}`) };
    const d = createSceneDirector({
      renderer: r, hud: new HudWriter(null), audio: createAudioDirector({ createContext: () => null }), targets: new InteractionTargets(() => undefined),
      selfId: () => 'me', flags: () => flags, interactKey: () => 'E', onZone: () => undefined, setInputEnabled: () => undefined,
      setAccentType: () => undefined, reducedMotion: () => false, legendaries: () => sync,
    });
    await d.loadZone('galvan_route', 'intact');
    expect(calls).toEqual(['galvan_route badge:circuit']);
    flags = new Set(['badge:circuit', RAI.flag]);
    d.refreshFlags(flags);
    expect(calls.at(-1)).toBe(`galvan_route badge:circuit,${RAI.flag}`);
    d.unloadZone();
    expect(calls.at(-1)?.startsWith('null')).toBe(true);
  });
});
