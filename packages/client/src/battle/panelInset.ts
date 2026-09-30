/**
 * The DOM battle panel's top edge (viewport px) while it is shown, for render's battle framing and HUD bar inset
 * (render IMPLEMENTATION-NOTES Part 5, T2: the camera frames both battlers above the panel's REAL height; the HUD
 * keeps the HP bars off it). BattleOverlay measures, World3D converts it to canvas px and hands it to render.
 */
let top: number | null = null;
const listeners = new Set<(top: number | null) => void>();

export function setBattlePanelTop(v: number | null): void {
  const next = v === null || !Number.isFinite(v) ? null : Math.round(v);
  if (next === top) return;
  top = next;
  for (const l of listeners) l(top);
}

export function battlePanelTop(): number | null {
  return top;
}

export function onBattlePanelTop(cb: (top: number | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
