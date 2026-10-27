/**
 * Sandbox demos for render part 3 (`?demo=lineup` | `?demo=battle` | `?demo=wild` | `?demo=people`), on top of whatever scene main.ts built
 * (the part-1 diorama, or a real zone with `?zone=`). Uses the REAL creature output
 * (`/creatures/creatures.manifest.json`, SpriteManifestV2) adapted exactly as the client's adapter will:
 * `uv → rect`, `px`, `footV`, `aspect`, atlas maps with their mip files. Species types come from content's
 * species table (sandbox only; the render package never imports content).
 *
 * `window.__ewaSandbox.part3` exposes the bundle and demo controls (`setTime`, `shot` come from main.ts).
 *
 * `?demo=people`: every look of `models.manifest.json` (24) in two rows facing the camera, a few creature billboards
 * beside them for scale, and walkers / runners circling in front at 1.0, 4.2 and 7.0 m/s (the protocol's walk and run
 * speeds). Controls on `part3.people`: `emote(n)` (all, 0..6), `close(i)` (inspector close-up on look i), `wide()`,
 * `march(on)` (the lineup walks 3 m along its row and back, `&marchSpeed=` m/s), `gait(i)`, `stats()`.
 *
 * `?demo=legends` (amended 2026-10-06, §10.4.5 flipbook): the 10 animated legendaries / mythicals (`&species=a,b` to
 * pick) in two rows facing the camera, static + anim atlases bound (`&anim=0` binds only the static atlases: the A/B
 * baseline), `&side=back`. Controls on `part3.legends`: `frames()` (each card's flipbook page), `facing(side)`,
 * `pose(i, pose, ms)`, `faint(i)`, `inspect(i | null)`, `bindAnim()`, `stats()`. `?demo=battle&mine=&foe=` puts any two
 * species in the arena; `?demo=arena` (same controls, `&terrain=`, `&h=0..3`) fights it in the PvP stadium with no zone (their atlases, flipbooks included, are bound first).
 */
import { Group, Vector3 } from 'three/webgpu';
import { SPECIES } from '@ewa/content';   // sandbox only (vite alias); the render package never imports content
import { ARENA_BACKDROP, part3Of, rendererInternals, type Terrain, type AnimAtlasSet, type AtlasSet, type AuraKind, type CreatureBillboard, type FrameHook, type Renderer, type SpriteDescriptor, type TypeName, type VariantKey, type VfxId } from '../src/index.js';

interface ManifestMap { readonly url: string; readonly mips: readonly string[] }
interface ManifestAtlas { readonly id: string; readonly species: readonly string[]; readonly size: 2048; readonly albedo: ManifestMap; readonly normal: ManifestMap; readonly emissive: ManifestMap; readonly normalScale: 0.5 | 1 }
interface ManifestRect { readonly atlas: string; readonly px: readonly [number, number, number, number]; readonly uv: readonly [number, number, number, number]; readonly footV: number; readonly aspect: number; readonly bodyV?: number }
interface ManifestAnimSide { readonly atlas: string; readonly frames: readonly (readonly [number, number, number, number])[]; readonly delays: readonly number[]; readonly staticFrame: number }
interface ManifestAnimAtlas { readonly id: string; readonly width: number; readonly height: number; readonly cell: number; readonly albedo: ManifestMap; readonly normal: ManifestMap; readonly emissive: ManifestMap; readonly normalScale: 0.5 | 1 }
interface ManifestSprite { readonly front: ManifestRect; readonly back: ManifestRect; readonly sizeScale: number; readonly home: string; readonly anim?: { readonly front?: ManifestAnimSide; readonly back?: ManifestAnimSide } }
interface Manifest {
  readonly version: 2; readonly atlases: readonly ManifestAtlas[]; readonly zones: Readonly<Record<string, readonly string[]>>; readonly sprites: Readonly<Record<string, ManifestSprite>>;
  readonly animAtlases?: readonly ManifestAnimAtlas[];
}

const BASE = '/creatures/';

async function loadManifest(): Promise<Manifest> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${BASE}creatures.manifest.json`);
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return await r.json() as Manifest;
    } catch { /* retry */ }
    if (i === 0) console.info('[part3] waiting for /creatures/creatures.manifest.json …');
    await new Promise((res) => setTimeout(res, 2000));
  }
}

function atlasSet(a: ManifestAtlas): AtlasSet {
  const m = (x: ManifestMap) => ({ url: BASE + x.url, mips: x.mips.map((u) => BASE + u) });
  return { id: a.id, albedo: m(a.albedo), normal: m(a.normal), emissive: m(a.emissive), size: a.size, normalScale: a.normalScale };
}

function animAtlasSet(a: ManifestAnimAtlas): AnimAtlasSet {
  const m = (x: ManifestMap) => ({ url: BASE + x.url, mips: x.mips.map((u) => BASE + u) });
  return { id: a.id, albedo: m(a.albedo), normal: m(a.normal), emissive: m(a.emissive), width: a.width, height: a.height, cell: a.cell, normalScale: a.normalScale };
}

/** `&anim=0`: descriptors without flipbooks (the static A/B baseline). */
const ANIM_ON = new URLSearchParams(location.search).get('anim') !== '0';

function typesOf(id: string): readonly [TypeName] | readonly [TypeName, TypeName] {
  const s = SPECIES.find((x) => x.id === id);
  const t = (s?.types ?? ['Normal']) as readonly TypeName[];
  return t.length > 1 ? [t[0]!, t[1]!] : [t[0]!];
}

/** A sprite key's height (m): the species', or a battle form's (`<species>_<form>`) when it names its own. */
function heightOf(key: string): number {
  for (const s of SPECIES) {
    if (s.id === key) return s.heightM;
    const form = [...(s.battleForms ?? []), ...(s.battleForm ? [s.battleForm] : [])].find((f) => `${s.id}_${f.id}` === key);
    if (form !== undefined) return form.heightM ?? s.heightM;
  }
  return 1.2;
}

function descriptor(man: Manifest, species: string, key: string, variant: VariantKey = 'normal', isAlpha = false, aura?: AuraKind): SpriteDescriptor {
  const sp = man.sprites[species]!;
  // the client adapter's mapping (spriteCatalog.ts): frames → rects, delays → delaysMs
  const f = (r: ManifestRect, a: ManifestAnimSide | undefined) => ({
    atlas: r.atlas, rect: r.uv, px: r.px, footV: r.footV, aspect: r.aspect, ...(r.bodyV !== undefined ? { bodyV: r.bodyV } : {}),
    ...(a && ANIM_ON ? { anim: { atlas: a.atlas, rects: a.frames, delaysMs: a.delays, staticFrame: a.staticFrame } } : {}),
  });
  return { id: key, front: f(sp.front, sp.anim?.front), back: f(sp.back, sp.anim?.back), heightM: heightOf(species), types: typesOf(species), variant, isAlpha, ...(aura ? { aura } : {}) };
}

export async function startPart3Demo(r: Renderer, mode: string, api: Record<string, unknown>): Promise<void> {
  const p = part3Of(r)!;
  const host = rendererInternals(r)!;
  const man = await loadManifest();
  const zoneAtlases = man.zones.mire_route ?? [];
  const sets = zoneAtlases.map((id) => atlasSet(man.atlases.find((a) => a.id === id)!));
  const t0 = performance.now();
  await Promise.all(sets.map((s) => p.sprites.bindAtlas(s)));
  console.info(`[part3] bound ${sets.length} atlases in ${(performance.now() - t0).toFixed(0)} ms`, p.sprites.stats());
  const species = sets.flatMap((s) => man.atlases.find((a) => a.id === s.id)!.species);
  // hide part 1's creature stand-in
  const standIn = r.scene.getObjectByName('sandbox:creature-standin');
  if (standIn) standIn.visible = false;
  const focus = p.rig.focus.clone();
  const out: Record<string, unknown> = { bundle: p, species, manifest: man, tsl: await import('three/tsl'), three: await import('three/webgpu') };
  api.part3 = out;
  // a species' static atlases + flipbooks, as the client binds them (World3D.ensureSpecies)
  const bound = new Set(zoneAtlases);
  const bindSpecies = async (list: readonly string[], withAnim = ANIM_ON): Promise<void> => {
    const jobs: Promise<void>[] = [];
    for (const s of list) {
      const sp = man.sprites[s];
      if (!sp) continue;
      for (const id of [sp.front.atlas, sp.back.atlas]) {
        if (bound.has(id)) continue;
        bound.add(id);
        jobs.push(p.sprites.bindAtlas(atlasSet(man.atlases.find((a) => a.id === id)!)));
      }
      if (!withAnim) continue;
      for (const side of [sp.anim?.front, sp.anim?.back]) {
        const a = side ? man.animAtlases?.find((x) => x.id === side.atlas) : undefined;
        if (!a || bound.has(a.id)) continue;
        bound.add(a.id);
        jobs.push(p.sprites.bindAnimAtlas(animAtlasSet(a)));
      }
    }
    await Promise.all(jobs);
  };
  out.bindSpecies = bindSpecies;

  // a few walking characters in every mode (KayKit looks, §10.7.7): a walker at 1.0 m/s, the protocol's walk (4.2 m/s,
  // the run clip at × 1.8) and run (7 m/s); an id the manifest does not list resolves to a deterministic base look
  const walkers = ['casual_male', 'cowboy_female:tide', 'ranger_m'];
  const walkerSpeed = [1.0, 4.2, 7.0];
  const walkerRadius = [2.6, 3.6, 4.6];
  walkers.forEach((look, i) => p.actors.spawn(`walker${i}`, { look, name: ['Rowan', 'Isla', 'Tamsin'][i]!, guildTag: i === 1 ? '[MIRE]' : '', isLocal: i === 0 }));
  const walkerAngle = [0, 2.1, 4.2];
  let walkersOn = true;
  const extraTicks: ((dt: number) => void)[] = [];
  const walk = (dt: number): void => {
    if (walkersOn) {
      walkers.forEach((_, i) => {
        walkerAngle[i]! += (walkerSpeed[i]! / walkerRadius[i]!) * (dt / 1000);
        const a = walkerAngle[i]!;
        const x = focus.x - 5 + Math.cos(a) * walkerRadius[i]!; const z = focus.z - 5 + Math.sin(a) * walkerRadius[i]!;
        p.actors.setTransform(`walker${i}`, x, z, Math.atan2(-Math.sin(a), Math.cos(a)), true, i === 2);
      });
    }
    for (const t of extraTicks) t(dt);
  };
  p.hud.set({
    zoneName: mode === 'battle' || mode === 'arena' ? null : 'Mire Route', timeOfDay: 0.42, questHint: 'Find the Fenkeeper by the old lantern',
    party: species.slice(0, 6).map((s, i) => ({ speciesId: s, variantKey: (i === 2 ? 'dusk' : 'normal') as VariantKey, hpFrac: 1 - i * 0.15, status: i === 3 ? 'psn' : null, fainted: i === 5 })),
    chat: [{ name: 'Isla', text: 'anyone seen a dusk mossling?', at: 1 }, { name: 'Rowan', text: 'by the pond, just now', at: 2 }],
    nameplates: walkers.map((_, i) => ({ id: `walker${i}`, name: ['Rowan', 'Isla', 'Tamsin'][i]!, guildTag: i === 1 ? '[MIRE]' : '', inBattle: false })),
    prompt: mode === 'lineup' ? { key: 'E', verb: 'Talk to', target: 'Fenkeeper' } : null,
  });
  p.actors.setEmote('walker1', 1);

  if (mode === 'lineup') {
    const group = new Group();
    group.name = 'sandbox:lineup';
    r.scene.add(group);
    const variants: VariantKey[] = ['normal', 'normal', 'dawn', 'normal', 'dusk', 'normal', 'verdant', 'normal', 'ember', 'normal'];
    const cards: CreatureBillboard[] = [];
    species.slice(0, 10).forEach((s, i) => {
      const bb = p.sprites.acquire(descriptor(man, s, `lineup:${s}`, variants[i]!, i === 5));
      const x = focus.x - 6.75 + i * 1.5; const z = focus.z + (i % 2) * 0.6;
      bb.setPosition(x, 0, z);
      bb.setSharp(i === 4);
      group.add(bb.object);
      cards.push(bb);
    });
    Object.assign(out, {
      cards,
      facing: (side: 'front' | 'back') => cards.forEach((c) => c.setFacing(side)),
      pose: (i: number, pose: Parameters<CreatureBillboard['setPose']>[0]) => cards[i]?.setPose(pose, 0),
      inspect: (i: number | null) => p.stage.inspect(i === null ? null : descriptor(man, species[i]!, `inspect:${species[i]}`)),
    });
  }

  if (mode === 'legends') {
    const q = new URLSearchParams(location.search);
    const list = (q.get('species') ?? 'bankaiser,galaxion,glacinid,lumyth,noxmyth,raikitsune,sunjaw,voidraxis,voltaura,zenryu').split(',').filter((s) => man.sprites[s]);
    const t1 = performance.now();
    await bindSpecies(list);
    console.info(`[part3] legends: bound ${list.length} species (static${ANIM_ON ? ' + flipbooks' : ' only'}) in ${(performance.now() - t1).toFixed(0)} ms`, p.sprites.stats());
    walkers.forEach((_, i) => p.actors.despawn(`walker${i}`));
    walkersOn = false;
    const group = new Group();
    group.name = 'sandbox:legends';
    r.scene.add(group);
    const fwd = p.rig.dioramaForward(new Vector3());
    const right = new Vector3(-fwd.z, 0, fwd.x);
    const ground = (x: number, z: number): number => ((api.zone as (() => { collider: { sampleClamped(x: number, z: number): number } } | null) | undefined)?.()?.collider.sampleClamped(x, z) ?? 0);
    const perRow = Math.ceil(list.length / (list.length > 5 ? 2 : 1));
    const spacing = Number(q.get('spacing') ?? 2.6);
    const at = focus.clone().addScaledVector(fwd, Number(q.get('back') ?? 1)).addScaledVector(right, Number(q.get('shift') ?? 0));
    p.rig.setFocus(at.x, ground(at.x, at.z), at.z);
    const side = q.get('side') === 'back' ? 'back' : 'front';
    const cards = list.map((s, i) => {
      const row = Math.floor(i / perRow); const col = i % perRow;
      const pos = at.clone().addScaledVector(right, (col - (perRow - 1) / 2) * spacing).addScaledVector(fwd, row * 3.2 - (list.length > perRow ? 1.6 : 0));
      const bb = p.sprites.acquire(descriptor(man, s, `legend:${s}`));
      bb.setFacing(side);
      bb.setPosition(pos.x, ground(pos.x, pos.z), pos.z);
      bb.setSharp(true);
      group.add(bb.object);
      return bb;
    });
    p.hud.set({ nameplates: [], chat: [], prompt: null, zoneName: null, questHint: null, party: [] });
    const legends = {
      list, cards,
      frames: () => cards.map((c) => c.animFrame),
      animated: () => cards.map((c) => c.animated),
      facing: (sd: 'front' | 'back') => cards.forEach((c) => c.setFacing(sd)),
      pose: (i: number, pose: Parameters<CreatureBillboard['setPose']>[0], ms = 0) => cards[i]?.setPose(pose, ms),
      faint: (i: number) => cards[i]?.setPose('faint', 900),
      inspect: (i: number | null) => p.stage.inspect(i === null ? null : descriptor(man, list[i]!, `inspect:${list[i]}`)),
      /** Shows / hides the lineup cards (an inspector close-up without the lineup card behind it). */
      show: (on: boolean) => cards.forEach((c) => c.setShown(on)),
      /** The inspected billboard's flipbook page (−1 when static / none). */
      inspectedPage: () => { const live = p.sprites.liveBillboards(); const b = live.find((x) => x.id.startsWith('inspect:')); return b ? b.animFrame : null; },
      bindAnim: () => bindSpecies(list, true),
      stats: () => ({ sprites: p.sprites.stats(), programs: r.renderer.info.memory.programs, textures: r.renderer.info.memory.textures }),
    };
    Object.assign(out, { legends });
  }

  if (mode === 'wild') {
    // T3: wild creatures standing in tall grass as the client's SpawnViews places them (`&wild=x,z;x,z`, default a
    // ring round the focus at 2–14 m), with the reveal on (`&reveal=0` turns it off for the A/B shot)
    const q = new URLSearchParams(location.search);
    const group = new Group();
    group.name = 'sandbox:wild';
    r.scene.add(group);
    const spots = (q.get('wild') ?? '').split(';').filter((t) => t.includes(',')).map((t) => t.split(',').map(Number) as [number, number]);
    if (spots.length === 0) for (let i = 0; i < 6; i++) { const a = i * 1.05; const d = 2 + i * 2.4; spots.push([focus.x + Math.cos(a) * d, focus.z + Math.sin(a) * d]); }
    const ground = (x: number, z: number): number => ((api.zone as () => { collider: { sampleClamped(x: number, z: number): number } } | null)()?.collider.sampleClamped(x, z) ?? 0);
    const wild = spots.map(([x, z], i) => {
      const s = species[i % species.length]!;
      const bb = p.sprites.acquire(descriptor(man, s, `wild:${i}`));
      bb.setFacing('front');
      bb.setPosition(x, ground(x, z), z);
      group.add(bb.object);
      return bb;
    });
    if (q.get('reveal') === '0') p.reveal.setMask(null);
    walkers.forEach((_, i) => p.actors.despawn(`walker${i}`));
    // `&me=1`: the local player standing at the focus (the occluder fade check, M2-spawn-noon-9); `&fade=0` turns it off
    if (q.get('me') === '1') {
      p.actors.spawn('me', { look: 'casual_male', name: '', guildTag: '', isLocal: true });
      p.actors.setTransform('me', focus.x, focus.z, Number(q.get('face') ?? 0), false, false);
    }
    if (q.get('fade') === '0') { const occ = (host.materials.uniforms as { occlusion?: { camera: unknown } }).occlusion; if (occ) occ.camera = null; }
    p.hud.set({ nameplates: [], chat: [], prompt: null });
    Object.assign(out, { wild, revealed: () => p.reveal.revealed });
  }

  if (mode === 'people') {
    // every look, in two rows facing the camera; creature billboards for scale; walkers / runners in front
    const q = new URLSearchParams(location.search);
    const models = await (await fetch('/models/models.manifest.json')).json() as { looks: Record<string, unknown> };
    const looks = Object.keys(models.looks).sort();
    const fwd = p.rig.dioramaForward(new Vector3());                    // camera → scene, horizontal
    const right = new Vector3(-fwd.z, 0, fwd.x);                        // screen right on the ground
    const faceCam = Math.atan2(-fwd.x, -fwd.z);
    // `&back=` m behind the focus, `&shift=` m to screen-right (the part-1 diorama's house stands left of the focus)
    const at = focus.clone().addScaledVector(fwd, Number(q.get('back') ?? 1.5)).addScaledVector(right, Number(q.get('shift') ?? 2.5));
    p.rig.setFocus(at.x, 0, at.z);                                      // frame the lineup, not the diorama's centre
    const perRow = Math.ceil(looks.length / 2);
    const spacing = Number(q.get('spacing') ?? 1.25);
    const ids: string[] = [];
    looks.forEach((look, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const pos = at.clone().addScaledVector(right, (col - (perRow - 1) / 2) * spacing).addScaledVector(fwd, row * 2.4 - 1.2);
      const id = `look:${look}`;
      ids.push(id);
      p.actors.spawn(id, { look, name: look, guildTag: '', isLocal: false });
      p.actors.setTransform(id, pos.x, pos.z, faceCam, false, false);
    });
    // creature billboards beside the rows, at their true heights
    const group = new Group();
    group.name = 'sandbox:people-creatures';
    r.scene.add(group);
    const sized = species.map((s) => ({ s, k: heightOf(s) })).sort((a, b) => a.k - b.k);
    const pick = [sized[0], sized[Math.floor(sized.length / 2)], sized[sized.length - 1]].filter((x): x is { s: string; k: number } => x !== undefined);
    const creatures = pick.map(({ s }, i) => {
      const bb = p.sprites.acquire(descriptor(man, s, `people:${s}`));
      // in front of the first row, between characters: shortest, median and tallest
      const pos = at.clone().addScaledVector(right, (i - 1) * 3.5 * spacing + spacing / 2).addScaledVector(fwd, -2.4);
      bb.setPosition(pos.x, 0, pos.z);
      bb.setFacing('front');
      group.add(bb.object);
      return { species: s, heightM: heightOf(s), x: pos.x, z: pos.z };
    });
    p.hud.set({ nameplates: q.get('plates') === '1' ? ids.map((id) => ({ id, name: id.slice(5), guildTag: '', inBattle: false })) : [], chat: [], prompt: null, questHint: null, party: [] });
    if (q.get('walkers') === '0') { walkersOn = false; walkers.forEach((_, i) => p.actors.despawn(`walker${i}`)); }
    // march: the lineup walks along its row line and back (feet vs ground check)
    let marchOn = q.get('march') === '1';
    let marchT = 0;
    const marchSpeed = Number(q.get('marchSpeed') ?? 1.0);
    const base = ids.map((id) => p.actors.feetOf(id, new Vector3())!.clone());
    extraTicks.push((dt) => {
      if (!marchOn) return;
      marchT += dt / 1000;
      const span = 3;                                                    // m each way
      const period = (2 * span) / marchSpeed;
      const u = (marchT % period) / period;
      const off = u < 0.5 ? u * 2 * span : (1 - u) * 2 * span;
      const dir = u < 0.5 ? 1 : -1;
      ids.forEach((id, i) => {
        const b = base[i]!;
        p.actors.setTransform(id, b.x + right.x * off, b.z + right.z * off, Math.atan2(right.x * dir, right.z * dir), true, false);
      });
    });
    const people = {
      ids, looks, creatures,
      emote: (n: 0 | 1 | 2 | 3 | 4 | 5 | 6) => ids.forEach((id) => p.actors.setEmote(id, n)),
      march: (on: boolean) => { marchOn = on; if (!on) ids.forEach((id, i) => p.actors.setTransform(id, base[i]!.x, base[i]!.z, faceCam, false, false)); },
      // close-up on look i: the other row steps far away so no head stands between the camera and the subject
      close: (i: number, ms = 400) => {
        const row = Math.floor(i / perRow);
        ids.forEach((id, k) => { if (Math.floor(k / perRow) !== row) p.actors.setTransform(id, base[k]!.x + 200, base[k]!.z, faceCam, false, false); else p.actors.setTransform(id, base[k]!.x, base[k]!.z, faceCam, false, false); });
        const f = p.actors.feetOf(ids[i]!, new Vector3());
        if (f) p.rig.inspect(f.add(new Vector3(0, 0.8, 0)), ms);
      },
      wide: (ms = 400) => { ids.forEach((id, k) => p.actors.setTransform(id, base[k]!.x, base[k]!.z, faceCam, false, false)); p.rig.release(ms); },
      gait: (i: number) => p.actors.gaitOf(ids[i]!),
      stats: () => p.actors.stats(),
    };
    Object.assign(out, { people });
  }

  if (mode === 'battle' || mode === 'arena') {
    const q = new URLSearchParams(location.search);
    // `?demo=arena`: the PvP stadium (main.ts registered the backdrop as the zone root); the ring at the origin, no walkers
    const arena = mode === 'arena';
    if (arena) { walkersOn = false; walkers.forEach((_, i) => p.actors.despawn(`walker${i}`)); }
    // Phase A: with `&interior=<id>` the battle forms at that hall's arena and stays on its floor
    const hallInfo = (window as unknown as { __ewaInterior?: { arena: { x: number; z: number }; hall: { x: number; z: number; yaw: number; hw: number; hd: number } } }).__ewaInterior;
    const at = arena ? { x: 0, z: 0 } : hallInfo ? hallInfo.arena : { x: Number(q.get('ax') ?? focus.x - 0.4), z: Number(q.get('az') ?? focus.z + 9) };   // a clear patch of the part-1 diorama
    // T2: a stand-in for the client's DOM battle panel (§20.5.6: the bottom 28 % + a 24 px margin); `&panel=0` hides it
    if (q.get('panel') !== '0') {
      const panel = document.createElement('div');
      panel.id = 'sandbox-battle-panel';
      panel.textContent = 'battle panel (DOM stand-in)';
      Object.assign(panel.style, { position: 'fixed', left: '24px', right: '24px', bottom: '24px', height: '28vh', background: 'rgba(20, 24, 22, 0.86)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '12px', color: '#9aa39c', font: '12px system-ui', padding: '16px', boxSizing: 'border-box', pointerEvents: 'none' });
      document.body.appendChild(panel);
      const measure = (): void => { const rc = panel.getBoundingClientRect(); p.setBattleInsets(0, Math.max(0, window.innerHeight - rc.top)); };
      measure();
      new ResizeObserver(measure).observe(panel);
    }
    if (arena) p.rig.setHeading((Number(q.get('h') ?? 0) & 3) as 0 | 1 | 2 | 3);
    p.stage.dress(at, arena ? (q.get('terrain') ?? ARENA_BACKDROP.terrain) as Terrain : 'grove', [arena ? 'rival' : 'walker0'], arena ? undefined : hallInfo?.hall);
    p.rig.pushIn(at, 600);
    const mine = q.get('mine') ?? (species.includes('mossling') ? 'mossling' : species[0]!);
    const foe = q.get('foe') ?? (species.includes('snapling') ? 'snapling' : species[1]!);
    await bindSpecies([mine, foe]);
    const me = { side: 0 as const, slot: 0 }; const them = { side: 1 as const, slot: 0 };
    // battle-form auras: `&mineAura=majin|tenjin&foeAura=…`; `aura(0 | 1, kind | null)` switches one live
    const auraOf = (k: string | null): AuraKind | undefined => (k === 'majin' || k === 'tenjin' || k === 'majin_gold' ? k : undefined);
    p.stage.setBattler(me, descriptor(man, mine, 'battler:mine', 'normal', false, auraOf(q.get('mineAura'))));
    p.stage.setBattler(them, descriptor(man, foe, 'battler:foe', 'normal', false, auraOf(q.get('foeAura'))));
    out.aura = (side: 0 | 1, kind: AuraKind | null): void => {
      p.stage.setBattler(side === 0 ? me : them, descriptor(man, side === 0 ? mine : foe, side === 0 ? 'battler:mine' : 'battler:foe', 'normal', false, kind ?? undefined));
    };
    p.stage.setPose(me, 'enter', 450); p.stage.setPose(them, 'enter', 450);
    let hpMe = 58; let hpThem = 64; const maxMe = 58; const maxThem = 64;
    const bars = () => ({
      bars: [
        { who: me, name: mine[0]!.toUpperCase() + mine.slice(1), level: 14, hp: hpMe, maxHp: maxMe, status: null, stages: '', showNumbers: true },
        { who: them, name: foe[0]!.toUpperCase() + foe.slice(1), level: 12, hp: hpThem, maxHp: maxThem, status: hpThem < 30 ? 'par' : null, stages: hpThem < 40 ? 'Spe▼1' : '', showNumbers: false },
      ],
      turnLabel: 'Turn 1', shakes: 0,
    });
    p.hud.set({ battle: bars(), nameplates: [], prompt: null });
    const typeVfx = (s: string): VfxId => `type_${typesOf(s)[0].toLowerCase()}` as VfxId;
    // a scripted loop of turns (setTimeout in the sandbox only)
    const turn = async (n: number): Promise<void> => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      await wait(900);
      // my attack
      p.stage.setPose(me, 'lunge', 300); p.rig.cue('attacker', 0);
      await wait(180);
      p.stage.vfx(typeVfx(mine), me, them, 700);
      await wait(380);
      p.stage.vfx(n % 2 === 0 ? 'impact_super' : 'impact_normal', me, them, 300);
      p.stage.setPose(them, 'hurt', 240); p.rig.cue('impact', 0); p.rig.shake(0.3, 180);
      hpThem = Math.max(0, hpThem - 17); p.hud.set({ battle: { ...bars(), turnLabel: `Turn ${n}` } });
      await wait(900);
      if (hpThem <= 0) {
        p.stage.faint(them, 900); p.stage.vfx('faint', null, them, 900); p.rig.cue('ko', 0);
        await wait(1600);
        hpThem = maxThem; p.stage.setPose(them, 'enter', 450); p.stage.vfx('switch_in', null, them, 450);
        p.hud.set({ battle: { ...bars(), turnLabel: `Turn ${n}` } });
        return;
      }
      // foe's attack
      p.stage.setPose(them, 'windup', 250); p.rig.cue('defender', 0);
      await wait(260);
      p.stage.vfx(typeVfx(foe), them, me, 700);
      await wait(380);
      p.stage.vfx(n % 3 === 0 ? 'impact_crit' : 'impact_normal', them, me, 300);
      p.stage.setPose(me, 'hurt', 240); p.rig.shake(0.2, 180);
      hpMe = Math.max(8, hpMe - 9); p.hud.set({ battle: { ...bars(), turnLabel: `Turn ${n}` } });
      await wait(800);
      const extra: VfxId[] = ['stat_up', 'status_paralyze', 'heal', 'status_confuse', 'drain', 'weather_rain'];
      const e = extra[n % extra.length]!;
      p.stage.vfx(e, me, e === 'status_paralyze' || e === 'status_confuse' ? them : me, 800);
      if (e === 'heal') { hpMe = Math.min(maxMe, hpMe + 12); p.hud.set({ battle: { ...bars(), turnLabel: `Turn ${n}` } }); }
    };
    let n = 1;
    let paused = false;
    const loop = async (): Promise<void> => { for (;;) { if (paused) { await new Promise((res) => setTimeout(res, 100)); continue; } await turn(n++); } };
    out.pause = (on: boolean) => { paused = on; };
    Object.assign(out, { at, turn, loop, battlers: () => [p.stage.battler(me), p.stage.battler(them)] });
    if (new URLSearchParams(location.search).get('auto') !== '0') void loop();
  }

  if (mode === 'evolve') {
    // §10.7.5 evolution sequence: `&from=bramblecub&to=briarbear` (default), `&reduced=1`, `&look=`; the local player
    // stands at the focus facing the camera; `part3.evo.play(reduced?)`, `skip()`, `step(ms)` (with `pause(true)`),
    // `state()`. `&auto=1` plays once on load.
    const q = new URLSearchParams(location.search);
    const from = q.get('from') ?? 'bramblecub'; const to = q.get('to') ?? 'briarbear';
    const need = new Set([man.sprites[from]?.front.atlas, man.sprites[from]?.back.atlas, man.sprites[to]?.front.atlas, man.sprites[to]?.back.atlas]);
    const extra = man.atlases.filter((a) => need.has(a.id) && !zoneAtlases.includes(a.id)).map(atlasSet);
    walkers.forEach((_, i) => p.actors.despawn(`walker${i}`));
    walkersOn = false;
    const fwd = p.rig.dioramaForward(new Vector3());
    const faceCam = Math.atan2(-fwd.x, -fwd.z);
    const ground = (x: number, z: number): number => ((api.zone as (() => { collider: { sampleClamped(x: number, z: number): number } } | null) | undefined)?.()?.collider.sampleClamped(x, z) ?? 0);
    const me = { x: focus.x + Number(q.get('dx') ?? 0), z: focus.z + Number(q.get('dz') ?? 0) };
    p.actors.spawn('me', { look: q.get('look') ?? 'casual_male', name: 'Rowan', guildTag: '', isLocal: true });
    p.actors.setTransform('me', me.x, me.z, faceCam + Number(q.get('face') ?? 0), false, false);
    p.rig.setFocus(me.x, ground(me.x, me.z), me.z);
    p.hud.set({ nameplates: [], chat: [], prompt: null, zoneName: null, questHint: null, party: [] });
    // a wild creature of the zone a few metres off, as the client's SpawnViews would show one (`&wild=0` hides it):
    // the atlas billboard programs (beauty + sun shadow) exist before the sequence, as they do in play
    if (q.get('wild') !== '0') {
      const wildBb = p.sprites.acquire(descriptor(man, species[1] ?? species[0]!, 'evo:wild'));
      wildBb.setFacing('front');
      const wx = me.x - fwd.x * 2 - fwd.z * 5; const wz = me.z - fwd.z * 2 + fwd.x * 5;
      wildBb.setPosition(wx, ground(wx, wz), wz);
      r.scene.add(wildBb.object);
    }
    const host2 =host as unknown as { post: { uniforms: { exposure: { value: number }; vignette: { value: number } } } };
    const phases: { phase: string; at: number }[] = [];
    let handle: ReturnType<typeof p.stage.evolve> | null = null;
    let clock = 0;
    // programs three holds (WGSL keys → names): what the sequence compiles, if anything
    const progs = (): Map<string, string> => {
      const pr = (r.renderer as unknown as { _pipelines?: { programs?: { vertex: Map<string, { name: string }>; fragment: Map<string, { name: string }> } } })._pipelines?.programs;
      const m = new Map<string, string>();
      if (pr) { for (const [k, v] of pr.vertex) m.set(`v:${k}`, `v:${v.name}`); for (const [k, v] of pr.fragment) m.set(`f:${k}`, `f:${v.name}`); }
      return m;
    };
    let progsAtPlay = new Map<string, string>();
    const newPrograms = (): string[] => { const now = progs(); const outN: string[] = []; for (const [k, n] of now) if (!progsAtPlay.has(k)) outN.push(n); return outN; };
    const play = (reduced = q.get('reduced') === '1'): void => {
      void Promise.all(extra.map((s) => p.sprites.bindAtlas(s)));            // the sequence waits for the binds
      progsAtPlay = progs();
      phases.length = 0; clock = 0;
      handle = p.stage.evolve({
        from: descriptor(man, from, `evo:${from}`), to: descriptor(man, to, `evo:${to}`), at: me, reduced, cheer: 'me',
        onPhase: (ph) => phases.push({ phase: ph, at: Math.round(clock) }),
      });
    };
    extraTicks.push((dt) => { clock += dt; });
    const evo = {
      play,
      /** Resolves when the zone's background compile is done (measure programs only after it). */
      idle: async () => { await (r.compileIdle?.() ?? Promise.resolve()); return r.renderer.info.memory.programs; },
      skip: () => handle?.skip(),
      /** Advances `ms` of frames at 60 Hz with the loop paused (`__ewaSandbox.pause(true)` first). */
      step: (ms: number) => { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) r.frame(1000 / 60); },
      state: () => {
        const s = p.stage.evolution;
        return {
          phase: handle?.phase ?? null, clock: s?.clock ?? null, bound: s?.bound ?? null, phases: [...phases],
          sample: s ? { ...s.lastSample } : null, exposure: host2.post.uniforms.exposure.value, vignette: host2.post.uniforms.vignette.value,
          light: p.stage.beaconLights[0]!.intensity, programs: r.renderer.info.memory.programs, live: p.sprites.stats().live,
          rig: p.rig.currentMode, blend: p.rig.shotBlend, newPrograms: newPrograms(),
        };
      },
    };
    Object.assign(out, { evo });
    if (q.get('auto') === '1') setTimeout(() => play(), 300);
  }

  // the sandbox walkers move inside the renderer's frame (before the actor pool's hook), so `shot()` frames animate too
  (host as unknown as { hooks: FrameHook[] }).hooks.unshift({ update: (dt: number) => walk(Math.min(100, dt)) });
  out.focus = focus;
  out.probeFocus = () => new Vector3().copy(p.rig.focus);
  void host;
}
