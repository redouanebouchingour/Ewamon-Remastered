/**
 * §10.7.8 hit weight, the HUD's ghost of lost HP: after a hit the bar keeps a pale segment where the HP was, holds it,
 * then drains it to the new value; a heal leaves none.
 */
import { describe, expect, it } from 'vitest';
import { CanvasHudLayer, HUD, type Ctx2D, type HudModel, type HudSurface, type Ref } from '../src/hud/layer.js';

const GHOST = 'rgba(245, 243, 238, 0.42)';

/** A 2D context that records the fill style of every `fill()`. */
function fillsSurface() {
  const fills: string[] = [];
  const makeCtx = (): Ctx2D => {
    const ctx: Record<string, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1 };
    for (const m of ['save', 'restore', 'beginPath', 'rect', 'clip', 'clearRect', 'fillRect', 'strokeRect', 'strokeText', 'moveTo', 'lineTo', 'arc', 'closePath', 'stroke', 'roundRect', 'fillText']) ctx[m] = () => undefined;
    ctx.fill = () => { fills.push(String(ctx.fillStyle)); };
    ctx.measureText = (t: string) => ({ width: t.length * 8 }) as TextMetrics;
    return ctx as unknown as Ctx2D;
  };
  const factory = (w: number, h: number): HudSurface => ({ canvas: { width: w, height: h }, ctx: makeCtx() });
  return { factory, fills };
}

const model = (hp: number): HudModel['battle'] => ({
  bars: [{ who: { side: 1, slot: 0 }, name: 'Snapling', level: 12, hp, maxHp: 64, status: null, stages: '', showNumbers: false }],
  turnLabel: 'Turn 1', shakes: 0,
});

function hudAt() {
  const s = fillsSurface();
  const hud = new CanvasHudLayer({
    surface: s.factory,
    anchors: { nameplate: () => false, battler: (_r: Ref, out, o) => { out[o] = 640; out[o + 1] = 200; return true; } },
  });
  hud.resize(1280, 720, 1);
  return { hud, s };
}

const ghosts = (fills: readonly string[]): number => fills.filter((f) => f === GHOST).length;

describe('the ghost of lost HP', () => {
  it('a hit leaves a ghost segment that holds, then drains away', () => {
    const { hud, s } = hudAt();
    hud.set({ battle: model(60) });
    hud.tick(16); hud.drawIfDirty();
    s.fills.length = 0;
    hud.set({ battle: model(20) });
    hud.tick(100); hud.drawIfDirty();
    expect(ghosts(s.fills)).toBeGreaterThan(0);
    s.fills.length = 0;
    for (let t = 0; t < HUD.ghostHoldMs + HUD.ghostDrainMs + 200; t += 1000 / 60) { hud.tick(1000 / 60); hud.drawIfDirty(); }
    s.fills.length = 0;
    hud.set({ battle: model(20) });
    hud.set({ battle: { ...model(20)!, turnLabel: 'Turn 2' } });
    hud.drawIfDirty();
    expect(ghosts(s.fills)).toBe(0);
  });

  it('a heal shows no ghost', () => {
    const { hud, s } = hudAt();
    hud.set({ battle: model(20) });
    hud.tick(16); hud.drawIfDirty();
    s.fills.length = 0;
    hud.set({ battle: model(50) });
    hud.tick(100); hud.drawIfDirty();
    expect(ghosts(s.fills)).toBe(0);
  });
});
