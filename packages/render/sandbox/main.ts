/**
 * @ewa/render sandbox — a small test diorama built WITHOUT content imports:
 * a ground plane with two terrain materials (moss | gravel path | moss), chamfered boxes (plaster house,
 * cobble plinth, stone wall, timber crates/frame, slate roof), a lamp with a real shadow-casting light and a
 * visible emissive housing, a brazier point light with flicker, a tree (bark + leaf cards), tall grass, a
 * pond, and a stand-in quad where a creature billboard will go (DOF-sharp, GTAO-excluded through `mask`).
 *
 * `window.__ewaSandbox` exposes `stats()`, `counts()`, `dump()`, `setTime(hours)`, `setReducedEffects(bool)`,
 * `setHarvest(level)`, `setWeather(kind)`, `plan()`, `warnings()`, `shot(name)` for inspection.
 */
import {
  BufferAttribute, CircleGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Shape, Vector2,
} from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { color, mrt, vec2 } from 'three/tsl';
import {
  ALL_EFFECTS, WATER_DEPTH_ATTRIBUTE, applyReducedEffects, capViolations, createBudgetProbe, createRenderer, paintSurfaceColor,
  rendererInternals,
} from '../src/index.js';
import type { BasicDioramaRig, HarvestLevel, LightSource, Renderer, SurfaceId, WeatherKind } from '../src/index.js';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLDivElement;
const errEl = document.getElementById('err') as HTMLDivElement;

// ---- geometry helpers (sandbox-only; the zone builder owns the real generators) ----------------------------

/** A box with 4 cm chamfers (Pillar 3), bottom at y = 0, centred in x/z; UVs in metres (WorldUVGenerator). */
function chamferedBox(w: number, h: number, d: number, c = 0.04): BufferGeometry {
  const s = new Shape();
  const hw = w / 2 - c; const hd = d / 2 - c;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.lineTo(-hw, -hd);
  const g = new ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * c), bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  return g;
}

/** A gable roof prism: triangle profile (span × rise) extruded over `length`, chamfered. */
function roofPrism(span: number, rise: number, length: number, c = 0.04): BufferGeometry {
  const s = new Shape();
  s.moveTo(-span / 2, 0); s.lineTo(span / 2, 0); s.lineTo(0, rise); s.lineTo(-span / 2, 0);
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -length / 2);
  return g;
}

function lathe(points: readonly [number, number][], segments: number): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments).toNonIndexed();
}

function crossedCards(w: number, h: number, count: number): BufferGeometry {
  const parts: number[] = []; const uvs: number[] = []; const normals: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI;
    const cx = Math.cos(a) * w / 2; const cz = Math.sin(a) * w / 2;
    const nx = -Math.sin(a); const nz = Math.cos(a);
    const quad: [number, number, number, number, number][] = [
      [-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, h, cz, 1, 1],
      [-cx, 0, -cz, 0, 0], [cx, h, cz, 1, 1], [-cx, h, -cz, 0, 1],
    ];
    for (const [x, y, z, u, v] of quad) { parts.push(x, y, z); uvs.push(u, v); normals.push(nx, 0, nz); }
  }
  const g = new PlaneGeometry(1, 1).toNonIndexed();
  g.setAttribute('position', new BufferAttribute(new Float32Array(parts), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  return g;
}

// ---- the diorama ------------------------------------------------------------------------------------------

const SURFACES_USED: SurfaceId[] = [
  'grove_moss', 'path_gravel', 'dirt', 'cobble', 'plaster', 'timber', 'slate_roof', 'stone_wall', 'lantern_metal', 'glass_warm',
  'grove_bark', 'grove_leaf_canopy', 'tall_grass', 'water_pond',
];

function buildDiorama(r: Renderer): Group {
  const lib = r.materials;
  const root = new Group();
  root.name = 'sandbox:zone';
  const add = (geo: BufferGeometry, id: SurfaceId, x: number, y: number, z: number, opts: { ry?: number; shadow?: boolean } = {}): Mesh => {
    paintSurfaceColor(geo, id);
    const m = new Mesh(geo, lib.get(id));
    m.position.set(x, y, z);
    m.rotation.y = opts.ry ?? 0;
    m.castShadow = opts.shadow ?? true;
    m.receiveShadow = true;
    m.name = `sandbox:${id}`;
    root.add(m);
    return m;
  };

  // Ground: moss | gravel path (4 m) | moss; triplanar terrain layers (world-constant 3 m tiles).
  const ground = (w: number, cx: number, id: SurfaceId): void => {
    const g = new PlaneGeometry(w, 60, Math.max(1, Math.round(w / 2)), 30);
    g.rotateX(-Math.PI / 2);
    add(g, id, cx, 0, 0, { shadow: false });
  };
  ground(28, -16, 'grove_moss');
  ground(4, 0, 'path_gravel');
  ground(28, 16, 'grove_moss');

  // Cobble plinth under the lamp, dirt patch by the house.
  add(chamferedBox(5, 0.12, 5), 'cobble', 4.5, 0, 3.5, { shadow: false });
  add(chamferedBox(4, 0.06, 3), 'dirt', -6, 0, 5.5, { shadow: false });

  // House: plaster walls, slate roof, timber corner posts.
  add(chamferedBox(6, 3, 5), 'plaster', -6, 0, -3);
  add(roofPrism(6.7, 2.2, 5.7), 'slate_roof', -6, 3, -3);
  for (const [dx, dz] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]] as const) add(chamferedBox(0.24, 3.05, 0.24), 'timber', -6 + dx, 0, -3 + dz);

  // Stone wall and crates.
  add(chamferedBox(8, 0.9, 0.5), 'stone_wall', 7, 0, -6, { ry: 0.25 });
  add(chamferedBox(0.8, 0.8, 0.8), 'timber', 2.8, 0, -1.2, { ry: 0.4 });
  add(chamferedBox(0.7, 0.7, 0.7), 'timber', 3.4, 0, -0.2, { ry: -0.3 });

  // Lamp: lathed post (lantern_metal), faceted housing (glass_warm = the light source, Pillar 4), cap.
  const lx = 4.5; const lz = 3.5;
  add(lathe([[0.001, 0], [0.13, 0], [0.13, 0.12], [0.07, 0.18], [0.05, 2.32], [0.09, 2.4], [0.001, 2.4]], 12), 'lantern_metal', lx, 0.12, lz);
  add(lathe([[0.001, 2.4], [0.15, 2.42], [0.18, 2.6], [0.15, 2.78], [0.001, 2.8]], 6), 'glass_warm', lx, 0.12, lz, { shadow: false });
  add(lathe([[0.001, 2.8], [0.22, 2.82], [0.05, 3.0], [0.001, 3.02]], 6), 'lantern_metal', lx, 0.12, lz);

  // Brazier (point light with flicker): metal bowl + glowing coals.
  const bx = -2.8; const bz = 6.5;
  add(lathe([[0.001, 0], [0.12, 0], [0.1, 0.5], [0.42, 0.7], [0.46, 0.82], [0.001, 0.72]], 10), 'lantern_metal', bx, 0, bz);
  add(lathe([[0.001, 0.72], [0.36, 0.74], [0.2, 0.86], [0.001, 0.9]], 7), 'glass_warm', bx, 0, bz, { shadow: false });

  // Tree: bark trunk with root flare (wind) + leaf cards (alpha-tested, double-sided, wind).
  const tx = 9; const tz = 6;
  add(lathe([[0.001, 0], [0.5, 0], [0.34, 0.5], [0.26, 2], [0.18, 4.2], [0.12, 5.6], [0.001, 5.8]], 12), 'grove_bark', tx, 0, tz);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    add(crossedCards(2.2, 2.0, 2), 'grove_leaf_canopy', tx + Math.cos(a) * 0.9, 3.6 + (i % 2) * 0.8, tz + Math.sin(a) * 0.9, { ry: a });
  }

  // Tall grass tufts by the path.
  for (let i = 0; i < 12; i++) add(crossedCards(0.7, 0.7, 3), 'tall_grass', -3.2 - (i % 3) * 0.6, 0, -8 + i * 1.1, { ry: i * 0.7 });

  // Pond with a painted depth attribute (§10.5.6 depthBelow).
  const pond = new CircleGeometry(2.4, 32);
  pond.rotateX(-Math.PI / 2);
  pond.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(pond.getAttribute('position').count).fill(1.2), 1));
  add(pond, 'water_pond', 12, 0.03, -2, { shadow: false });

  // Creature stand-in: a lit quad marked DOF-sharp (mask.y = 1) and GTAO-excluded (mask.x = 1), as §10.4.5 will.
  const standIn = new MeshStandardNodeMaterial();
  standIn.colorNode = color('#e8d9b0');
  standIn.roughness = 0.85;
  standIn.mrtNode = mrt({ mask: vec2(1, 1) });
  const quad = new PlaneGeometry(1.2, 1.6);
  quad.translate(0, 0.8, 0);
  const creature = new Mesh(quad, standIn);
  creature.name = 'sandbox:creature-standin';
  creature.position.set(0.9, 0, 1.2);
  creature.rotation.y = -35 * Math.PI / 180;
  creature.castShadow = true;
  root.add(creature);

  return root;
}

const LIGHTS: LightSource[] = [
  { id: 'lamp_plinth', kind: 'lantern', color: '#ffb35c', intensity: 45, position: [4.5, 2.72, 3.5], castShadow: true, range: 14, housing: { kind: 'generated', generator: 'lantern', seed: 1 }, flicker: null },
  { id: 'brazier_path', kind: 'brazier', color: '#ff8a3c', intensity: 18, position: [-2.8, 1.05, 6.5], castShadow: false, range: 9, housing: { kind: 'mesh', meshId: 'sandbox:brazier' }, flicker: { amplitude: 0.12, hz: 5 } },
];

// ---- boot -------------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const r = await createRenderer({
    canvas,
    pixelRatio: window.devicePixelRatio || 1,
    effects: ALL_EFFECTS,
    trackTimestamp: true,
    transcoderPath: '/basis/',
    materialsUrl: '/materials/',
    clock: () => performance.now(),
  });
  const host = rendererInternals(r)!;
  const probe = createBudgetProbe(r, 'sandbox');

  await r.materials.preload(SURFACES_USED);
  const root = buildDiorama(r);
  host.lighting.createPunctuals(LIGHTS, root);
  r.scene.add(root);
  host.setZoneRoot(root);
  (r.camera as BasicDioramaRig).setFocus(0.9, 0, 1.2);

  let hours = 10;
  r.setTimeOfDay(hours / 24);
  const resize = (): void => { if (canvas.clientWidth > 0 && canvas.clientHeight > 0) r.resize(canvas.clientWidth, canvas.clientHeight); };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    r.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  void r.materials.preloadHero(SURFACES_USED);

  const api = {
    renderer: r,
    probe,
    stats: () => ({ ...r.stats(), passMs: { ...r.stats().passMs } }),
    counts: () => probe.counts(),
    dump: () => probe.dumpZone(),
    plan: () => host.post.plan.map((s) => s.id),
    warnings: () => r.materials.warnings(),
    caps: () => r.caps,
    setTime: (h: number) => { hours = h; r.setTimeOfDay(h / 24); (document.getElementById('time') as HTMLInputElement).value = String(h); },
    setReducedEffects: (on: boolean) => r.setEffects(on ? applyReducedEffects(ALL_EFFECTS) : ALL_EFFECTS),
    setHarvest: (l: HarvestLevel) => r.setHarvestLevel(l),
    setWeather: (w: WeatherKind) => r.setWeather(w),
    capViolations: () => capViolations(probe.counts()),
    /**
     * Renders `frames` frames at a forced 1280×720 drawing buffer (works while the window is hidden and rAF
     * is paused) and POSTs a JPEG to the dev server, which writes `sandbox/.shots/<name>.jpg`.
     */
    shot: async (name: string, frames = 24): Promise<unknown> => {
      if (canvas.clientWidth === 0) r.resize(1280, 720);
      for (let i = 0; i < frames; i++) r.frame(1000 / 60);
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      c.getContext('2d')!.drawImage(canvas, 0, 0, 1280, 720);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88));
      if (!blob) return null;
      const resp = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      return resp.json();
    },
  };
  (window as unknown as { __ewaSandbox: typeof api }).__ewaSandbox = api;

  (document.getElementById('time') as HTMLInputElement).addEventListener('input', (e) => api.setTime(Number((e.target as HTMLInputElement).value)));
  (document.getElementById('reduced') as HTMLInputElement).addEventListener('change', (e) => api.setReducedEffects((e.target as HTMLInputElement).checked));
  (document.getElementById('harvest') as HTMLSelectElement).addEventListener('change', (e) => api.setHarvest(Number((e.target as HTMLSelectElement).value) as HarvestLevel));
  (document.getElementById('weather') as HTMLSelectElement).addEventListener('change', (e) => api.setWeather((e.target as HTMLSelectElement).value as WeatherKind));

  setInterval(() => {
    const s = r.stats();
    const c = probe.counts();
    const hh = Math.floor(hours); const mm = Math.round((hours - hh) * 60);
    hudEl.textContent = [
      `backend ${r.backend}  ktx2 ${r.caps.ktx2}  ts ${r.caps.timestampQuery}  ${r.caps.adapter ?? ''}`,
      `time ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  harvest ${host.harvestLevel()}`,
      `draws ${s.drawCalls}  tris ${s.triangles}  programs ${s.programs}  RTs ${s.renderTargets}`,
      `textures ${s.textures} (${(s.textureBytes / 1048576).toFixed(1)} MB)  geometries ${s.geometries}  materials ${s.materials}`,
      `lights ${s.shadowLights} shadow + ${s.nonShadowLights}  gpu ${s.gpuMs === null ? '—' : s.gpuMs.toFixed(2) + ' ms'}  cpu ${s.frameMs.toFixed(2)} ms`,
      `post ${host.post.plan.map((p) => p.id).join(' → ')}`,
      `library ${JSON.stringify(r.materials.stats())}  warnings ${r.materials.warnings().length}`,
      capViolations(c).length ? `CAP VIOLATIONS ${JSON.stringify(capViolations(c))}` : 'caps ok',
    ].join('\n');
  }, 250);
}

main().catch((e: unknown) => {
  errEl.textContent = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(e);
});
