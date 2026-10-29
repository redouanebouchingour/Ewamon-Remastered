/**
 * `?demo=gallery` (2026-10-29): every 3D creature model of `/creature-models/index.json` standing on a flat floor, in
 * dex order (each form right after its species), with a player to walk between them. The bodies load as the client's
 * do (`SpriteDescriptor.model`, models on); no atlas is bound, so a creature without a body shows nothing.
 *
 * Keys: WASD / arrows walk (Shift runs), Q / E turn the camera, drag orbits, the wheel zooms, N / P (or ] / [) jump to
 * the next / previous model, F a close-up of the nearest one, T spins it, R turns it round, C makes every model face
 * the camera (as in the game), Z toggles game heights / one even height. `&at=<id>` starts at that model,
 * `&size=even` starts with even heights. Controls on `__ewaSandbox.gallery`: `go(i | id)`, `next()`, `prev()`,
 * `nearest()`, `exhibits`, `missing()` (models whose GLB never loaded).
 */
import { Group, Mesh, PlaneGeometry, Vector3 } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { SPECIES } from '@ewa/content';   // sandbox only (vite alias); the render package never imports content
import { paintSurfaceColor, part3Of, rendererInternals } from '../src/index.js';
import type { CreatureBillboard, FrameHook, Renderer, SpriteDescriptor, SurfaceId, TypeName } from '../src/index.js';

interface IndexJson { readonly models: Readonly<Record<string, { readonly url: string; readonly bytes?: number; readonly rig?: boolean }>> }
interface ManifestRect { readonly atlas: string; readonly uv: readonly [number, number, number, number]; readonly px: readonly [number, number, number, number]; readonly footV: number; readonly aspect: number }
interface Manifest { readonly sprites: Readonly<Record<string, { readonly front: ManifestRect; readonly back: ManifestRect }>> }

interface Exhibit {
  readonly id: string;
  readonly name: string;
  readonly dex: number;
  readonly heightM: number;
  readonly rigged: boolean;
  readonly x: number;
  readonly z: number;
  readonly bb: CreatureBillboard;
  readonly label: HTMLDivElement;
  yaw: number;
  /** Frustum culling turned off on its meshes (the body loads after the billboard exists). */
  unculled: boolean;
}

const GALLERY = {
  /** Width of one row of models (m). */
  rowWidth: 44,
  /** Free floor in front of each row (m). */
  aisle: 5,
  /** The even height `Z` gives every model (m). */
  evenHeightM: 1.6,
  walkSpeed: 4.2,
  runSpeed: 7,
  /** Labels show within this distance of the player (m). */
  labelRange: 18,
  /** Models draw within this distance of the player (m). */
  showRange: 40,
  /** Camera distance range for the wheel (m); the diorama stops are 20 / 26 / 34. */
  zoom: [5, 34] as const,
  startZoom: 11,
};

/** The species a model id belongs to (`<species>` or `<species>_<form>`). */
function speciesOf(id: string): (typeof SPECIES)[number] | undefined {
  let best: (typeof SPECIES)[number] | undefined;
  for (const s of SPECIES) if ((id === s.id || id.startsWith(`${s.id}_`)) && (best === undefined || s.id.length > best.id.length)) best = s;
  return best;
}

function heightOf(id: string): number {
  const s = speciesOf(id);
  if (s === undefined) return 1.2;
  const form = [...(s.battleForms ?? []), ...(s.battleForm ? [s.battleForm] : [])].find((f) => `${s.id}_${f.id}` === id);
  return form?.heightM ?? s.heightM;
}

function nameOf(id: string): string {
  const s = speciesOf(id);
  if (s === undefined) return id;
  return id === s.id ? s.name : `${s.name} (${id.slice(s.id.length + 1).replace(/_/g, ' ')})`;
}

function typesOf(id: string): readonly [TypeName] | readonly [TypeName, TypeName] {
  const t = (speciesOf(id)?.types ?? ['Normal']) as readonly TypeName[];
  return t.length > 1 ? [t[0]!, t[1]!] : [t[0]!];
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return await r.json() as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

export async function startGallery(r: Renderer, api: Record<string, unknown>): Promise<void> {
  const p = part3Of(r)!;
  const host = rendererInternals(r)!;
  p.sprites.setModels(true);
  const [index, man] = await Promise.all([json<IndexJson>('/creature-models/index.json'), json<Manifest>('/creatures/creatures.manifest.json')]);
  const ids = Object.keys(index.models).filter((id) => man.sprites[id] !== undefined);
  ids.sort((a, b) => (speciesOf(a)?.dexNumber ?? 9999) - (speciesOf(b)?.dexNumber ?? 9999) || a.length - b.length || a.localeCompare(b));
  const q = new URLSearchParams(location.search);
  let even = q.get('size') === 'even';

  // ---- layout: rows of `rowWidth`, each model as wide as it is tall (plus a gap), rows set back by their tallest
  const slots: { id: string; x: number; z: number; h: number }[] = [];
  let rowZ = 0; let x = 0; let row: { id: string; w: number; h: number }[] = [];
  const flush = (): void => {
    const total = row.reduce((s, m) => s + m.w, 0);
    let cx = -total / 2;
    const tall = Math.max(...row.map((m) => m.h));
    for (const m of row) { slots.push({ id: m.id, x: cx + m.w / 2, z: rowZ, h: m.h }); cx += m.w; }
    rowZ -= Math.min(6, tall) * 0.9 + GALLERY.aisle;
    row = []; x = 0;
  };
  for (const id of ids) {
    const h = heightOf(id);
    const w = Math.min(6, Math.max(1, h)) * 0.9 + 1.4;
    if (x + w > GALLERY.rowWidth && row.length > 0) flush();
    row.push({ id, w, h }); x += w;
  }
  if (row.length > 0) flush();

  // ---- the floor: moss, a gravel aisle in front of every row
  await r.materials.preload(['grove_moss', 'path_gravel'] satisfies SurfaceId[]);
  const root = new Group();
  root.name = 'sandbox:gallery';
  const floor = (w: number, d: number, cx: number, cz: number, y: number, id: SurfaceId): void => {
    const g: BufferGeometry = new PlaneGeometry(w, d, Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(d / 4)));
    g.rotateX(-Math.PI / 2);
    paintSurfaceColor(g, id);
    const m = new Mesh(g, r.materials.get(id));
    m.position.set(cx, y, cz);
    m.receiveShadow = true;
    m.name = `sandbox:${id}`;
    root.add(m);
  };
  const minZ = rowZ; const W = GALLERY.rowWidth + 16;
  floor(W, -minZ + 16, 0, minZ / 2 + 2, 0, 'grove_moss');
  for (const z of new Set(slots.map((s) => s.z))) floor(GALLERY.rowWidth + 4, 2.4, 0, z + GALLERY.aisle * 0.55, 0.01, 'path_gravel');
  r.scene.add(root);
  host.setZoneRoot(root);
  r.scene.getObjectByName('sandbox:creature-standin')?.removeFromParent();

  // ---- the models, a label each
  // the creatures sit in their own group, as in part3.ts: under the zone root they cast shadows but never draw
  const models = new Group();
  models.name = 'sandbox:gallery-models';
  r.scene.add(models);
  const labels = el('div', 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:20');
  document.body.append(labels);
  const exhibits: Exhibit[] = slots.map((s) => {
    const d: SpriteDescriptor = {
      id: `gallery:${s.id}`,
      front: { atlas: man.sprites[s.id]!.front.atlas, rect: man.sprites[s.id]!.front.uv, px: man.sprites[s.id]!.front.px, footV: man.sprites[s.id]!.front.footV, aspect: man.sprites[s.id]!.front.aspect },
      back: { atlas: man.sprites[s.id]!.back.atlas, rect: man.sprites[s.id]!.back.uv, px: man.sprites[s.id]!.back.px, footV: man.sprites[s.id]!.back.footV, aspect: man.sprites[s.id]!.back.aspect },
      heightM: s.h, types: typesOf(s.id), variant: 'normal', isAlpha: false, model: s.id,
    };
    const bb = p.sprites.acquire(d);
    bb.setFacing('front');
    bb.setPosition(s.x, 0, s.z);
    bb.setHeading(0);
    models.add(bb.object);
    const label = el('div', 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui;color:#fff;background:#0b0d10b8;padding:2px 7px;border-radius:5px;white-space:nowrap;display:none');
    labels.append(label);
    return { id: s.id, name: nameOf(s.id), dex: speciesOf(s.id)?.dexNumber ?? 0, heightM: s.h, rigged: index.models[s.id]!.rig === true, x: s.x, z: s.z, bb, label, yaw: 0, unculled: false };
  });
  const sizeOf = (e: Exhibit): number => (even ? GALLERY.evenHeightM : e.heightM);
  const applySize = (): void => { for (const e of exhibits) e.bb.setSizeMul(even ? GALLERY.evenHeightM / e.heightM : 1); };
  applySize();

  // ---- the player and the camera
  const me = { x: 0, z: GALLERY.aisle * 0.55, angle: Math.PI };
  p.actors.spawn('me', { look: 'casual_male', name: '', guildTag: '', isLocal: true });
  p.actors.setTransform('me', me.x, me.z, me.angle, false, false);
  p.rig.follow('me');
  const setDistance = (m: number): void => {
    const rr = p.rig as unknown as { dist: number; distTo: number; distFrom: number; distT: number };
    rr.dist = rr.distTo = rr.distFrom = Math.max(GALLERY.zoom[0], Math.min(GALLERY.zoom[1], m)); rr.distT = 1;
  };
  let dist = GALLERY.startZoom;
  setDistance(dist);
  p.hud.set({ nameplates: [], chat: [], prompt: null, zoneName: null, questHint: null, party: [] });
  const fwd = new Vector3();
  /** Turns the free camera so it looks along `angle` (atan2(dx, dz) of the view direction). */
  const lookAlong = (angle: number): void => {
    p.rig.dioramaForward(fwd);
    const d = Math.atan2(Math.sin(angle - Math.atan2(fwd.x, fwd.z)), Math.cos(angle - Math.atan2(fwd.x, fwd.z)));
    p.rig.orbitBy(d);
    p.rig.dioramaForward(fwd);
    if (Math.abs(Math.atan2(Math.sin(angle - Math.atan2(fwd.x, fwd.z)), Math.cos(angle - Math.atan2(fwd.x, fwd.z)))) > 0.01) p.rig.orbitBy(-2 * d);
  };
  lookAlong(Math.PI);

  let current = 0;
  let inspecting = false;
  let spinning: Exhibit | null = null;
  let faceCamera = false;
  const nearest = (): Exhibit => {
    let best = exhibits[0]!; let bd = Infinity;
    for (const e of exhibits) { const d = Math.hypot(e.x - me.x, e.z - me.z) - sizeOf(e) * 0.3; if (d < bd) { bd = d; best = e; } }
    return best;
  };
  const closeUp = (e: Exhibit): void => {
    const h = sizeOf(e);
    p.rig.inspect(new Vector3(e.x, h * 0.55, e.z), 500, Math.max(2.2, h * 2.1 + 0.8));
    inspecting = true;
    p.actors.setHidden('me', true);
  };
  const go = (target: number | string): Exhibit => {
    const i = typeof target === 'number' ? ((target % exhibits.length) + exhibits.length) % exhibits.length : Math.max(0, exhibits.findIndex((e) => e.id === target));
    const e = exhibits[i]!;
    current = i;
    // beside the model, not in front of it: the camera looks over the player's shoulder
    me.x = e.x + Math.min(3, sizeOf(e) * 0.35) + 0.9; me.z = e.z + Math.max(1.4, Math.min(6, sizeOf(e)) * 0.4 + 1); me.angle = Math.PI;
    p.actors.setTransform('me', me.x, me.z, me.angle, false, false);
    p.rig.follow('me');
    lookAlong(Math.PI);
    if (inspecting) closeUp(e);
    refreshPanel(true);
    return e;
  };

  // ---- the panel
  const panel = el('div', 'position:fixed;left:12px;bottom:12px;z-index:50;max-width:min(560px,calc(100vw - 24px));background:#0b0d10d9;color:#e8ecf1;border-radius:8px;padding:10px 12px;font:13px/1.4 system-ui');
  const title = el('div', 'font:700 16px system-ui;margin-bottom:2px');
  const meta = el('div', 'opacity:0.75;margin-bottom:8px');
  const nav = el('div', 'display:flex;gap:6px;align-items:center;margin-bottom:8px');
  const btnCss = 'font:600 12px system-ui;padding:5px 9px;border-radius:6px;border:0;background:#2a3346;color:#fff;cursor:pointer';
  const prevB = el('button', btnCss, '◀ prev'); const nextB = el('button', btnCss, 'next ▶'); const closeB = el('button', btnCss, 'close-up');
  const pick = el('select', 'font:12px system-ui;padding:4px;border-radius:6px;background:#1b2130;color:#fff;border:1px solid #39435a;max-width:220px');
  exhibits.forEach((e, i) => pick.append(new Option(`${String(i + 1).padStart(3, ' ')} ${e.name}`, String(i))));
  nav.append(prevB, nextB, pick, closeB);
  const clips = el('div', 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px');
  const help = el('div', 'opacity:0.6;font-size:12px', 'WASD walk · Shift run · Q/E or drag turn · wheel zoom · N/P next/prev · F close-up · T spin · R turn round · C face camera · Z even sizes');
  panel.append(title, meta, nav, clips, help);
  document.body.append(panel);
  for (const id of ['hud', 'controls']) { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
  prevB.onclick = () => { go(current - 1); };
  nextB.onclick = () => { go(current + 1); };
  closeB.onclick = () => { toggleCloseUp(); };
  pick.onchange = () => { go(Number(pick.value)); pick.blur(); };

  let shown: Exhibit | null = null; let shownClips = '';
  const refreshPanel = (force = false): void => {
    const e = exhibits[current]!;
    const names = e.bb.rigPlayer?.clipNames ?? [];
    if (!force && e === shown && names.join() === shownClips) return;
    shown = e; shownClips = names.join();
    title.textContent = e.name;
    const loaded = e.bb.hasBody;
    meta.textContent = `${current + 1} / ${exhibits.length} · ${e.id} · dex ${e.dex} · ${e.heightM} m${e.rigged ? ' · rigged' : ''}${loaded ? '' : ' · loading…'}`;
    pick.value = String(current);
    closeB.textContent = inspecting ? 'walk view' : 'close-up';
    clips.replaceChildren(...names.map((c) => {
      const b = el('button', btnCss.replace('#2a3346', '#1d4a5c'), c);
      b.onclick = () => { e.bb.rigPlayer?.play(c); };
      return b;
    }));
  };
  const toggleCloseUp = (): void => {
    if (inspecting) { inspecting = false; p.rig.release(500); p.actors.setHidden('me', false); } else closeUp(exhibits[current]!);
    refreshPanel(true);
  };

  // ---- input
  const held = new Set<string>();
  const typing = (t: EventTarget | null): boolean => t instanceof HTMLSelectElement || t instanceof HTMLInputElement;
  window.addEventListener('keydown', (ev) => {
    if (typing(ev.target)) return;
    const k = ev.key.toLowerCase();
    held.add(k);
    if (ev.shiftKey) held.add('shift');
    if (k === 'n' || k === ']') go(current + 1);
    else if (k === 'p' || k === '[') go(current - 1);
    else if (k === 'f') toggleCloseUp();
    else if (k === 'q') p.rig.orbitBy(Math.PI / 2);
    else if (k === 'e') p.rig.orbitBy(-Math.PI / 2);
    else if (k === 't') spinning = spinning === exhibits[current] ? null : exhibits[current]!;
    else if (k === 'r') { const e = exhibits[current]!; e.yaw += Math.PI; if (!faceCamera) e.bb.setHeading(e.yaw); }
    else if (k === 'c') { faceCamera = !faceCamera; for (const e of exhibits) e.bb.setHeading(faceCamera ? null : e.yaw); }
    else if (k === 'z') { even = !even; applySize(); if (inspecting) closeUp(exhibits[current]!); }
    else return;
    ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => { held.delete(ev.key.toLowerCase()); if (!ev.shiftKey) held.delete('shift'); });
  window.addEventListener('blur', () => held.clear());
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  let drag: number | null = null;
  canvas.addEventListener('pointerdown', (ev) => { drag = ev.clientX; canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener('pointermove', (ev) => { if (drag === null) return; p.rig.orbitBy(-(ev.clientX - drag) * 0.0042); drag = ev.clientX; });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (ev) => { dist *= Math.exp(ev.deltaY * 0.001); dist = Math.max(GALLERY.zoom[0], Math.min(GALLERY.zoom[1], dist)); setDistance(dist); ev.preventDefault(); }, { passive: false });

  // ---- per frame: walking (pushed out of the models), the spinning model, labels, the panel
  const proj = new Vector3();
  const tick = (dtMs: number): void => {
    const dt = Math.min(100, dtMs) / 1000;
    let ix = 0; let iz = 0;
    if (held.has('w') || held.has('arrowup')) iz += 1;
    if (held.has('s') || held.has('arrowdown')) iz -= 1;
    if (held.has('d') || held.has('arrowright')) ix += 1;
    if (held.has('a') || held.has('arrowleft')) ix -= 1;
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      if (inspecting) { inspecting = false; p.rig.release(400); p.actors.setHidden('me', false); refreshPanel(true); }
      p.rig.dioramaForward(fwd);
      const fl = Math.hypot(fwd.x, fwd.z) || 1;
      const fx = fwd.x / fl; const fz = fwd.z / fl;
      let dx = fx * iz - fz * ix; let dz = fz * iz + fx * ix;
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const run = held.has('shift');
      const v = (run ? GALLERY.runSpeed : GALLERY.walkSpeed) * dt;
      me.x += dx * v; me.z += dz * v; me.angle = Math.atan2(dx, dz);
      for (const e of exhibits) {
        const rad = Math.min(3, sizeOf(e) * 0.32) + 0.35;
        const ox = me.x - e.x; const oz = me.z - e.z; const d = Math.hypot(ox, oz);
        if (d < rad && d > 1e-4) { me.x = e.x + (ox / d) * rad; me.z = e.z + (oz / d) * rad; }
      }
      me.x = Math.max(-W / 2 + 1, Math.min(W / 2 - 1, me.x));
      me.z = Math.max(minZ - 6, Math.min(16, me.z));
      p.actors.setTransform('me', me.x, me.z, me.angle, true, run);
      const n = exhibits.indexOf(nearest());
      if (n !== current) { current = n; refreshPanel(true); }
    } else p.actors.setTransform('me', me.x, me.z, me.angle, false, false);
    if (spinning !== null) { spinning.yaw += dt * 0.8; if (!faceCamera) spinning.bb.setHeading(spinning.yaw); }
    const cam = p.rig.camera;
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    for (const e of exhibits) {
      const far = Math.hypot(e.x - me.x, e.z - me.z);
      e.bb.setShown(far < GALLERY.showRange || e === exhibits[current]);
      // the bodies near the camera were frustum-culled here (shadows only, 2026-10-29); the range above culls instead
      if (!e.unculled && e.bb.hasBody) {
        // the body is in place once `hasBody` is (static mesh, or the rig player's skinned mesh, made in the same call)
        e.bb.object.traverse((o) => { if ((o as Mesh).isMesh === true) o.frustumCulled = false; });
        e.unculled = true;
      }
      const near = far < GALLERY.labelRange || e === exhibits[current];
      if (near) {
        proj.set(e.x, sizeOf(e) + 0.25, e.z).project(cam);
        if (proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1) {
          e.label.style.display = 'block';
          e.label.style.left = `${((proj.x + 1) / 2) * w}px`;
          e.label.style.top = `${((1 - proj.y) / 2) * h}px`;
          e.label.textContent = e.name;
          e.label.style.background = e === exhibits[current] ? '#c8902ae6' : '#0b0d10b8';
          continue;
        }
      }
      e.label.style.display = 'none';
    }
    refreshPanel();
  };
  (host as unknown as { hooks: FrameHook[] }).hooks.unshift({ update: (dt: number) => tick(dt) });

  api.gallery = {
    exhibits,
    go: (t: number | string) => go(t).id,
    next: () => go(current + 1).id,
    prev: () => go(current - 1).id,
    nearest: () => nearest().id,
    current: () => exhibits[current]!.id,
    closeUp: (on: boolean) => { if (on !== inspecting) toggleCloseUp(); },
    missing: () => exhibits.filter((e) => !e.bb.hasBody).map((e) => e.id),
  };
  const at = q.get('at');
  go(at !== null ? at : 0);
}
