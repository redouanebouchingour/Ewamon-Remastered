/**
 * §10.9 HUD layer (node, no GPU; a recording 2D context): the HudModel field set, per-region dirty bits, one upload
 * per drawn frame, zero work on idle frames (600 frames → 0 uploads, 0 context calls), world anchors re-marking only
 * on ≥ 1 px moves, chat fade repaint, the HP tween, legibility minimums and the overlay material.
 */
import { describe, expect, it } from 'vitest';
import { CustomBlending, NoColorSpace, OneFactor, OneMinusSrcAlphaFactor } from 'three/webgpu';
import { CanvasHudLayer, FIELD_REGION, HUD, HUD_FIELDS, type Ctx2D, type HudAnchors, type HudModel, type HudSurface, type Ref } from '../src/hud/layer.js';

function recordingSurface() {
  let calls = 0;
  const texts: string[] = [];
  const fonts: string[] = [];
  const makeCtx = (): Ctx2D => {
    const ctx: Record<string, unknown> = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    };
    for (const m of ['save', 'restore', 'beginPath', 'rect', 'clip', 'clearRect', 'fillRect', 'strokeRect', 'strokeText', 'moveTo', 'lineTo', 'arc', 'closePath', 'fill', 'stroke', 'roundRect']) {
      ctx[m] = () => { calls++; };
    }
    ctx.fillText = (t: string) => { calls++; texts.push(t); fonts.push(ctx.font as string); };
    ctx.measureText = (t: string) => { calls++; return { width: t.length * 8 } as TextMetrics; };
    return ctx as unknown as Ctx2D;
  };
  const factory = (w: number, h: number): HudSurface => ({ canvas: { width: w, height: h }, ctx: makeCtx() });
  return { factory, calls: () => calls, texts, fonts, reset: () => { calls = 0; texts.length = 0; fonts.length = 0; } };
}

function anchors(): HudAnchors & { pos: Map<string, [number, number]> } {
  const pos = new Map<string, [number, number]>();
  return {
    pos,
    nameplate: (id, out, o) => { const p = pos.get(id); if (!p) return false; out[o] = p[0]; out[o + 1] = p[1]; return true; },
    battler: (ref: Ref, out, o) => { const p = pos.get(`${ref.side}:${ref.slot}`); if (!p) return false; out[o] = p[0]; out[o + 1] = p[1]; return true; },
  };
}

const bars = (hpA: number): HudModel['battle'] => ({
  bars: [
    { who: { side: 0, slot: 0 }, name: 'Mossling', level: 14, hp: hpA, maxHp: 58, status: null, stages: '', showNumbers: true },
    { who: { side: 1, slot: 0 }, name: 'Snapling', level: 12, hp: 40, maxHp: 64, status: 'par', stages: 'Spe▼1', showNumbers: false },
  ],
  turnLabel: 'Turn 1', shakes: 0,
});

describe('§10.9 HudLayer', () => {
  it('accepts exactly the 20-client.md §20.6 HudModel fields; unknown keys throw in dev', () => {
    expect([...HUD_FIELDS].sort()).toEqual(['battle', 'chat', 'connection', 'dev', 'nameplates', 'party', 'prompt', 'questHint', 'timeOfDay', 'zoneName'].sort());
    expect(FIELD_REGION.questHint).toBe('timeOfDay');
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    expect(() => hud.set({ bogus: 1 } as unknown as Partial<HudModel>)).toThrow(TypeError);
  });

  it('a set marks only its regions; drawIfDirty draws once and uploads once; idle frames cost nothing', () => {
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    hud.resize(1280, 720, 1);
    hud.drawIfDirty();
    hud.set({ zoneName: 'Mire Route' });
    expect(hud.isDirty('zoneName')).toBe(true);
    expect(hud.isDirty('party')).toBe(false);
    const up0 = hud.uploads;
    expect(hud.drawIfDirty()).toBe(true);
    expect(hud.uploads).toBe(up0 + 1);
    expect(s.texts).toContain('MIRE ROUTE');   // Broadcast UI: names / labels are drawn uppercase
    hud.set({ zoneName: 'Mire Route' });     // same value: nothing to do
    expect(hud.isDirty()).toBe(false);
    s.reset();
    const up1 = hud.uploads;
    for (let i = 0; i < 600; i++) { hud.tick(1000 / 60); hud.drawIfDirty(); }
    expect(hud.uploads).toBe(up1);            // 600 idle frames → 0 uploads
    expect(s.calls()).toBe(0);                // …and zero canvas work
  });

  it('a static region stays untouched when another region redraws (clip to the dirty area)', () => {
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    hud.resize(1280, 720, 1);
    hud.set({ zoneName: 'Mire Route', prompt: { key: 'E', verb: 'Talk to', target: 'Fenkeeper' } });
    hud.drawIfDirty();
    s.reset();
    hud.set({ prompt: { key: 'E', verb: 'Read', target: 'Tablet' } });
    hud.drawIfDirty();
    expect(s.texts).toContain('TABLET');
    expect(s.texts).not.toContain('MIRE ROUTE');
  });

  it('world anchors: nameplates re-mark only when an anchor moves ≥ 1 px (or appears)', () => {
    const s = recordingSurface();
    const a = anchors();
    const hud = new CanvasHudLayer({ surface: s.factory, anchors: a });
    hud.resize(1280, 720, 1);
    a.pos.set('p1', [400, 300]);
    hud.set({ nameplates: [{ id: 'p1', name: 'Rowan', guildTag: '[MIRE]', inBattle: false }] });
    hud.tick(16); hud.drawIfDirty();
    expect(s.texts).toContain('ROWAN');
    const up = hud.uploads;
    a.pos.set('p1', [400.4, 300.3]);
    hud.tick(16);
    expect(hud.drawIfDirty()).toBe(false);
    a.pos.set('p1', [401.2, 300]);
    hud.tick(16);
    expect(hud.drawIfDirty()).toBe(true);
    expect(hud.uploads).toBe(up + 1);
  });

  it('battle bars tween HP (and drain the ghost of lost HP) at 30 Hz, then stop; own-side numbers only', () => {
    const s = recordingSurface();
    const a = anchors();
    a.pos.set('0:0', [500, 500]); a.pos.set('1:0', [800, 250]);
    const hud = new CanvasHudLayer({ surface: s.factory, anchors: a });
    hud.resize(1280, 720, 1);
    hud.set({ battle: bars(58) });
    hud.tick(16); hud.drawIfDirty();
    hud.set({ battle: bars(29) });
    let draws = 0;
    const animMs = Math.max(HUD.hpTweenMs, HUD.ghostHoldMs + HUD.ghostDrainMs);
    for (let t = 0; t < animMs + 200; t += 1000 / 60) { hud.tick(1000 / 60); if (hud.drawIfDirty()) draws++; }
    expect(draws).toBeGreaterThanOrEqual(12);   // ≈ 30 Hz over the tween and the ghost's drain (+ the settle frames)
    expect(draws).toBeLessThanOrEqual(Math.ceil(animMs / HUD.hpRepaintMs) + 3);
    s.reset();
    for (let i = 0; i < 60; i++) { hud.tick(1000 / 60); hud.drawIfDirty(); }
    expect(s.calls()).toBe(0);
  });

  it('battle bars stay inside the margins, out of the turn label box, and never overlap (IMPLEMENTATION-NOTES Part 4, H10)', () => {
    const s = recordingSurface();
    const a = anchors();
    const hud = new CanvasHudLayer({ surface: s.factory, anchors: a });
    hud.resize(1280, 720, 1);
    const pos = (): number[] => [...(hud as unknown as { barPos: Float32Array }).barPos.slice(0, 4)];
    const W = 1280; const H = 720; const M = HUD.margin; const w = HUD.barW; const h = HUD.barH;
    const label = { x0: W / 2 - HUD.turnBandW / 2, x1: W / 2 + HUD.turnBandW / 2, y0: HUD.margin + HUD.turnBandTop, y1: HUD.margin + HUD.turnBandTop + HUD.turnBandH };
    const check = (): void => {
      const [x0, y0, x1, y1] = pos() as [number, number, number, number];
      for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
        expect(x).toBeGreaterThanOrEqual(M); expect(x + w).toBeLessThanOrEqual(W - M);
        expect(y).toBeGreaterThanOrEqual(M); expect(y + h).toBeLessThanOrEqual(H - M);
        expect(x < label.x1 && x + w > label.x0 && y < label.y1 && y + h > label.y0).toBe(false);   // never on the turn label
      }
      const overlap = x0 < x1 + w && x0 + w > x1 && y0 < y1 + h && y0 + h > y1;
      expect(overlap).toBe(false);
    };
    // the near battler's head at the top centre (its bar would sit on the turn label), the far one off the right edge
    a.pos.set('0:0', [640, 90]); a.pos.set('1:0', [1275, 40]);
    hud.set({ battle: bars(40) }); hud.tick(16); hud.drawIfDirty();
    check();
    // the far battler at the top of the frame, its bar just grazing the label: moved up by the few px, not down onto the creature
    a.pos.set('0:0', [100, 600]); a.pos.set('1:0', [700, 150]);
    hud.tick(16); hud.drawIfDirty();
    check();
    expect(pos()[3]!).toBeLessThan(150 - HUD.barLift - HUD.barH + 1);                 // not below where it wanted to be
    // both anchors on the same spot: the second bar is pushed below the first
    a.pos.set('0:0', [640, 400]); a.pos.set('1:0', [650, 405]);
    hud.tick(16); hud.drawIfDirty();
    check();
    // bottom-left corner
    a.pos.set('0:0', [5, 715]); a.pos.set('1:0', [30, 710]);
    hud.tick(16); hud.drawIfDirty();
    check();
    expect(s.texts).toContain('TURN 1');
  });

  it('chat lines fade after 6 s over 2 s, repainting at ≤ 4 Hz, then go quiet', () => {
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    hud.resize(1280, 720, 1);
    hud.set({ chat: [{ name: 'Isla', text: 'hello', at: 1 }] });
    hud.drawIfDirty();
    let draws = 0;
    for (let t = 0; t < 12000; t += 1000 / 60) { hud.tick(1000 / 60); if (hud.drawIfDirty()) draws++; }
    expect(draws).toBeGreaterThanOrEqual(6);
    expect(draws).toBeLessThanOrEqual(11);      // 2 s at 4 Hz (+ edges)
  });

  it('legibility: body text ≥ 14 px at uiScale 1 (and scales), 2 px outline under every glyph', () => {
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    hud.resize(1280, 720, 1);
    hud.set({ questHint: 'Find the Fenkeeper', chat: [{ name: 'Isla', text: 'hi', at: 1 }], timeOfDay: 0.5 });
    hud.drawIfDirty();
    const sizes = s.fonts.map((f) => Number(/(\d+)px/.exec(f)?.[1] ?? 0)).filter((n) => n > 0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    hud.setScale(1.4);
    s.reset();
    hud.drawIfDirty();
    const scaled = s.fonts.map((f) => Number(/(\d+)px/.exec(f)?.[1] ?? 0)).filter((n) => n > 0);
    expect(Math.min(...scaled)).toBeGreaterThanOrEqual(19);
    expect(s.texts).toContain('1');           // "12:00" drawn digit by digit (tabular numerals)
  });

  it('overlay material: premultiplied One/OneMinusSrcAlpha, raw canvas bytes, no depth; resize re-points the texture', () => {
    const s = recordingSurface();
    const hud = new CanvasHudLayer({ surface: s.factory });
    const m = hud.material;
    expect(m.blending).toBe(CustomBlending);
    expect([m.blendSrc, m.blendDst]).toEqual([OneFactor, OneMinusSrcAlphaFactor]);
    expect(m.depthTest).toBe(false);
    expect(m.depthWrite).toBe(false);
    hud.resize(800, 600, 1.5);
    const t1 = hud.texture;
    expect(t1.colorSpace).toBe(NoColorSpace);
    expect(t1.premultiplyAlpha).toBe(true);
    expect(t1.generateMipmaps).toBe(false);
    expect((t1.image as { width: number }).width).toBe(1200);
    hud.resize(1024, 768, 1);
    expect(hud.texture).not.toBe(t1);
    hud.dispose(); hud.dispose();
  });
});
