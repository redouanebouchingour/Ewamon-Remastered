/**
 * Phase C3 — the HUD minimap: a small DOM `<canvas>` (2D, no WebGL) in the bottom-right corner of the world. It is
 * imperative on purpose: React renders the frame once; a 4 Hz interval reads the room state directly (the player's
 * authoritative pose and the AOI's other players) and redraws the dots over a base that is rasterised once per view
 * (the zone, or the hall the player stands in — `minimapDraw.ts`). Nothing here goes through React state per tick, and
 * the canvas HUD's HudWriter is untouched (this is not one of its fields).
 *
 * Hidden while a panel is open, in battle, and with the rest of the chrome under F1 (`PlayShell` renders it as an
 * `<aside>` of the shell). In environments without a 2D context (jsdom) it renders the frame and draws nothing.
 *
 * Broadcast look (2026-10-11): a black frame and a label strip under the map — the zone (or hall) name and "Map" with
 * the player's own map key as a paper chip.
 */
import { useEffect, useRef, useState } from 'react';
import { interiorAt } from '@ewa/content';
import type { PlacedInterior, ZoneId } from '@ewa/content';
import type { PlayerState } from '@ewa/protocol';
import { zoneName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useSettingsStore } from '../state/settings';
import { MINIMAP_CSS_PX, MINIMAP_TICK_MS, drawBase, drawFrame, hallView, zoneView } from './minimapDraw';
import type { Ctx2D, MinimapDot, MinimapView } from './minimapDraw';
import { keyGlyph } from './TutorialCard';
import s from './Minimap.module.css';

const MAX_OTHERS = 32;

function context2d(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (canvas === null || typeof canvas.getContext !== 'function') return null;
  // jsdom has the method but only logs "not implemented" (tests mount the shell everywhere)
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) return null;
  try {
    return canvas.getContext('2d');
  } catch (_e) {
    return null; // jsdom: "not implemented"
  }
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const mapKey = useSettingsStore((st) => keyGlyph(st.keybinds.map[0]));

  useEffect(() => {
    const canvas = ref.current;
    const ctx = context2d(canvas);
    if (canvas === null || ctx === null) return;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const px = Math.round(MINIMAP_CSS_PX * dpr);
    canvas.width = px;
    canvas.height = px;

    // per-view bases, rebuilt when the zone changes (one zone + its halls at a time)
    const bases = new Map<string, HTMLCanvasElement | null>();
    let baseZone: ZoneId | null = null;
    let view: MinimapView | null = null;
    let viewHall: PlacedInterior | null = null;
    let shownLabel: string | null = null;
    // preallocated dots (no allocation per tick)
    const self: MinimapDot = { x: 0, z: 0, angle: 0 };
    const others: MinimapDot[] = Array.from({ length: MAX_OTHERS }, () => ({ x: 0, z: 0, angle: 0 }));
    let count = 0;
    let selfId = '';
    const collect = (p: PlayerState, id: string): void => {
      if (id === selfId || count >= MAX_OTHERS) return;
      const d = others[count++]!;
      d.x = p.x;
      d.z = p.z;
    };

    const baseFor = (v: MinimapView): HTMLCanvasElement | null => {
      if (bases.has(v.key)) return bases.get(v.key)!;
      let off: HTMLCanvasElement | null = document.createElement('canvas');
      off.width = px;
      off.height = px;
      const octx = context2d(off);
      if (octx === null) off = null;
      else drawBase(octx as unknown as Ctx2D, v, px);
      bases.set(v.key, off);
      return off;
    };

    const tick = (): void => {
      const ws = getWorldSession();
      const room = ws.room;
      const zoneId = ws.zoneId;
      const state = room?.state;
      if (zoneId === null || state === undefined || state.players === undefined) {
        if (view !== null) ctx.clearRect(0, 0, px, px);
        view = null;
        return;
      }
      if (zoneId !== baseZone) {
        bases.clear();
        baseZone = zoneId;
        view = null;
      }
      selfId = ws.selfId;
      const me = state.players.get(selfId);
      if (me === undefined) return;
      self.x = me.x;
      self.z = me.z;
      self.angle = me.angle;
      // the view only changes when the player steps onto / off a hall's floor
      const hall = interiorAt(zoneId, self.x, self.z);
      if (view === null || hall !== viewHall) {
        viewHall = hall;
        view = hall === null ? zoneView(zoneId) : hallView(zoneId, hall);
      }
      const next = view.hall ?? zoneName(zoneId);
      if (next !== shownLabel) {
        shownLabel = next;
        setLabel(next);
      }
      count = 0;
      state.players.forEach(collect);
      drawFrame(ctx as unknown as Ctx2D, baseFor(view), view, px, self, others, count);
    };

    tick();
    const timer = setInterval(tick, MINIMAP_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className={s.minimap} aria-label={label === null ? 'Minimap' : `Minimap: ${label}`} data-testid="minimap">
      <canvas ref={ref} className={s.canvas} width={MINIMAP_CSS_PX} height={MINIMAP_CSS_PX} aria-hidden />
      <div className={s.strip}>
        <span className={s.label}>{label ?? ''}</span>
        <span className={s.hint} aria-hidden>
          Map <kbd className={s.key}>{mapKey}</kbd>
        </span>
      </div>
    </aside>
  );
}
