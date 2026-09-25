/**
 * §10.9 regional redraw correctness: a coverage-tracking fake canvas (clip-aware clear/fill) proves that moving
 * world-anchored regions never leave a static region (the party strip) erased.
 */
import { it, expect } from 'vitest';
import { CanvasHudLayer, type Ctx2D, type HudSurface, type HudAnchors } from '../src/hud/layer.js';

function coverageSurface(w: number, h: number) {
  const grid = new Uint8Array(w * h);   // 1 = painted
  let clip: [number, number, number, number] | null = null;
  const stack: ([number, number, number, number] | null)[] = [];
  let pathRect: [number, number, number, number] | null = null;
  const paint = (x: number, y: number, ww: number, hh: number, v: number) => {
    let x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(w, Math.ceil(x + ww)), y1 = Math.min(h, Math.ceil(y + hh));
    if (clip) { x0 = Math.max(x0, clip[0]); y0 = Math.max(y0, clip[1]); x1 = Math.min(x1, clip[0] + clip[2]); y1 = Math.min(y1, clip[1] + clip[3]); }
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) grid[yy * w + xx] = v;
  };
  const ctx: Record<string, unknown> = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1 };
  ctx.save = () => stack.push(clip);
  ctx.restore = () => { clip = stack.pop() ?? null; };
  ctx.beginPath = () => { pathRect = null; };
  ctx.rect = (x: number, y: number, ww: number, hh: number) => { pathRect = [x, y, ww, hh]; };
  ctx.roundRect = (x: number, y: number, ww: number, hh: number) => { pathRect = [x, y, ww, hh]; };
  ctx.clip = () => { clip = pathRect ? [Math.floor(pathRect[0]), Math.floor(pathRect[1]), Math.ceil(pathRect[2]), Math.ceil(pathRect[3])] : clip; };
  ctx.clearRect = (x: number, y: number, ww: number, hh: number) => paint(x, y, ww, hh, 0);
  ctx.fillRect = (x: number, y: number, ww: number, hh: number) => paint(x, y, ww, hh, 1);
  ctx.fill = () => { if (pathRect) paint(...pathRect, 1); };
  for (const m of ['strokeRect', 'strokeText', 'moveTo', 'lineTo', 'arc', 'closePath', 'stroke']) ctx[m] = () => {};
  ctx.fillText = (t: string, x: number, y: number) => paint(x - 4, y - 6, 8 * t.length, 12, 1);
  ctx.measureText = (t: string) => ({ width: t.length * 8 });
  return { surface: { canvas: { width: w, height: h }, ctx: ctx as unknown as Ctx2D } as HudSurface, at: (x: number, y: number) => grid[y * w + x] };
}

it('party thumb stays painted while battle bars move (narrow canvas)', () => {
  let cov: ReturnType<typeof coverageSurface> | null = null;
  const pos: Record<string, [number, number]> = { '0:0': [300, 500], '1:0': [400, 110] };
  const anchors: HudAnchors = {
    nameplate: () => false,
    battler: (r, out, o) => { const p = pos[`${r.side}:${r.slot}`]; if (!p) return false; out[o] = p[0]; out[o + 1] = p[1]; return true; },
  };
  const hud = new CanvasHudLayer({ surface: (w, h) => (cov = coverageSurface(w, h)).surface, anchors });
  hud.resize(786, 1034, 1);
  hud.set({ party: [0, 1, 2, 3, 4, 5].map((i) => ({ speciesId: 'ab' + i, variantKey: 'normal' as const, hpFrac: 1, status: null, fainted: false })), timeOfDay: 0.4, questHint: 'Find the Fenkeeper by the old lantern',
    battle: { bars: [{ who: { side: 0, slot: 0 }, name: 'A', level: 1, hp: 5, maxHp: 10, status: null, stages: '', showNumbers: true }, { who: { side: 1, slot: 0 }, name: 'B', level: 1, hp: 5, maxHp: 10, status: null, stages: '', showNumbers: false }], turnLabel: 'Turn 1', shakes: 0 } });
  hud.tick(16); hud.drawIfDirty();
  expect(cov!.at(40, 40)).toBe(1);
  for (let i = 0; i < 60; i++) { pos['1:0'] = [400 - i * 3, 110 - i]; pos['0:0'] = [300 + i, 500 - i * 2]; hud.tick(16); hud.drawIfDirty(); expect(cov!.at(40, 40), `frame ${i}`).toBe(1); }
});
