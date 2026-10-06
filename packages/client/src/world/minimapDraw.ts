/**
 * Phase C3 — the HUD minimap's drawing, React-free. A minimap shows one VIEW: the zone's playable square, or —
 * standing inside a hall (content `interiorAt`) — that hall's footprint. Each view's BASE (walkable / water bits of
 * the content heightfield, exits, gym / shop / healer doors) is rasterised ONCE into an offscreen canvas with
 * `createImageData` + `putImageData` (never `getImageData`); the 4 Hz tick only blits the base and draws the dots
 * (the player with a heading tick, nearby players) — no allocation per tick beyond what the 2D context does.
 *
 * Coordinates: a view has a frame — the zone view is world-aligned (x → right, z → down, n = −z up, as on the world
 * map); a hall view is the hall's own frame (rotated by its placement yaw, the door wall at the bottom), so it matches
 * the camera, which turns to the hall inside (render `CameraRig.setYawBase`).
 */
import { getHeightfield, interiorAt, playableBounds, zone as zoneDef, zonePlan } from '@ewa/content';
import type { BuildingKind, Heightfield, LinkDir, PlacedInterior, ZoneId } from '@ewa/content';
import { COLOR } from '../ui/tokens';

/** CSS px side of the minimap square. */
export const MINIMAP_CSS_PX = 168;
/** How often the dots refresh. */
export const MINIMAP_TICK_MS = 250;

export interface MinimapView {
  /** cache key: the zone, or `<zone>/<interior id>` */
  readonly key: string;
  readonly zoneId: ZoneId;
  /** the frame: local = R(yaw) · (world − (cx, cz)); identity for a zone */
  readonly cx: number;
  readonly cz: number;
  readonly yaw: number;
  /** the square's top-left corner in the LOCAL frame */
  readonly minX: number;
  readonly minZ: number;
  /** metres per side (square) */
  readonly span: number;
  /** the hall's name when the view is a hall */
  readonly hall: string | null;
}

export interface MinimapIcon {
  readonly kind: 'gym' | 'shop' | 'healer' | 'exit';
  readonly x: number;
  readonly z: number;
  readonly dir?: LinkDir;
}

/** The zone's playable square. */
export function zoneView(zoneId: ZoneId): MinimapView {
  const b = playableBounds(getHeightfield(zoneId));
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  return { key: zoneId, zoneId, cx: 0, cz: 0, yaw: 0, minX: b.minX, minZ: b.minZ, span, hall: null };
}

/** A hall's footprint in the hall's own frame (door wall at the bottom), squared up and padded by 2 m. */
export function hallView(zoneId: ZoneId, p: PlacedInterior): MinimapView {
  const f = p.footprint;
  const span = 2 * Math.max(f.hw, f.hd) + 4;
  return { key: `${zoneId}/${p.def.id}`, zoneId, cx: f.x, cz: f.z, yaw: p.at.yaw, minX: -span / 2, minZ: -span / 2, span, hall: p.def.label };
}

/** The view for a player standing at (x, z): the hall they are in, else the zone. */
export function viewAt(zoneId: ZoneId, x: number, z: number): MinimapView {
  const p = interiorAt(zoneId, x, z);
  return p === null ? zoneView(zoneId) : hallView(zoneId, p);
}

const ICON_KINDS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['gym', 'shop', 'healer']);

/** Exits (one per link, at the centroid of the walkable samples on that playable edge) + gym / shop / healer doors. */
export function minimapIcons(zoneId: ZoneId): readonly MinimapIcon[] {
  const h = getHeightfield(zoneId);
  const plan = zonePlan(zoneId);
  const out: MinimapIcon[] = [];
  const kindOf = new Map(plan.buildings.map((b) => [b.id, b.kind]));
  for (const d of plan.doors) {
    const kind = kindOf.get(d.building);
    if (kind !== undefined && ICON_KINDS.has(kind)) out.push({ kind: kind as MinimapIcon['kind'], x: d.door.x, z: d.door.z });
  }
  const b = playableBounds(h);
  const links = zoneDef(zoneId).links;
  for (const dir of Object.keys(links) as LinkDir[]) {
    const p = edgeCentroid(h, b, dir);
    if (p !== null) out.push({ kind: 'exit', x: p[0], z: p[1], dir });
  }
  return out;
}

function edgeCentroid(h: Heightfield, b: ReturnType<typeof playableBounds>, dir: LinkDir): readonly [number, number] | null {
  const inset = 2;
  let sx = 0;
  let sz = 0;
  let n = 0;
  const along = dir === 'n' || dir === 's';
  const fixed = dir === 'n' ? b.minZ + inset : dir === 's' ? b.maxZ - inset : dir === 'w' ? b.minX + inset : b.maxX - inset;
  const lo = along ? b.minX : b.minZ;
  const hi = along ? b.maxX : b.maxZ;
  for (let t = lo; t <= hi; t += h.step) {
    const x = along ? t : fixed;
    const z = along ? fixed : t;
    const col = Math.round((x - h.originX) / h.step);
    const row = Math.round((z - h.originZ) / h.step);
    if (h.walkable[row * h.res + col] === 1) {
      sx += x;
      sz += z;
      n += 1;
    }
  }
  return n === 0 ? null : [sx / n, sz / n];
}

function rgb(hex: string): readonly [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** The 2D context surface the drawing needs (a real CanvasRenderingContext2D, or a test double). */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | 'createImageData'
  | 'putImageData'
  | 'drawImage'
  | 'clearRect'
  | 'beginPath'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

/** World → canvas px for a view drawn into a `px`-wide square. */
export function project(v: MinimapView, px: number, x: number, z: number): readonly [number, number] {
  const dx = x - v.cx;
  const dz = z - v.cz;
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  return [((c * dx - s * dz - v.minX) / v.span) * px, ((s * dx + c * dz - v.minZ) / v.span) * px];
}

/** Rasterises the view's terrain (walkable / water / blocked) and its icons into `ctx` (`px` × `px`). */
export function drawBase(ctx: Ctx2D, v: MinimapView, px: number): void {
  const h = getHeightfield(v.zoneId);
  const img = ctx.createImageData(px, px);
  const data = img.data;
  const ground = rgb(COLOR['line-1']);
  const path = rgb(COLOR['line-2']);
  const water = rgb(COLOR.info);
  const blocked = rgb(COLOR['bg-0']);
  const scale = v.span / px;
  const cosY = Math.cos(v.yaw);
  const sinY = Math.sin(v.yaw);
  for (let py = 0; py < px; py++) {
    const lz = v.minZ + (py + 0.5) * scale;
    for (let pxi = 0; pxi < px; pxi++) {
      const lx = v.minX + (pxi + 0.5) * scale;
      // local → world (the inverse rotation)
      const x = v.cx + cosY * lx + sinY * lz;
      const z = v.cz - sinY * lx + cosY * lz;
      const row = Math.round((z - h.originZ) / h.step);
      const col = Math.round((x - h.originX) / h.step);
      const o = (py * px + pxi) * 4;
      const inside = row >= 0 && col >= 0 && row < h.res && col < h.res;
      const i = row * h.res + col;
      const isWater = inside && h.water[i] === 1;
      const walk = inside && h.walkable[i] === 1;
      const c = isWater ? water : walk ? (v.hall !== null ? path : ground) : blocked;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = isWater ? 200 : walk ? 255 : 150;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (v.hall !== null) return; // a hall shows its floor; the town's icons belong to the zone view
  const r = Math.max(4, px / 36);
  ctx.font = `700 ${Math.round(r * 1.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ic of minimapIcons(v.zoneId)) {
    const [cx, cy] = project(v, px, ic.x, ic.z);
    if (ic.kind === 'exit') {
      drawExit(ctx, cx, cy, ic.dir ?? 'e', r);
      continue;
    }
    const fill = ic.kind === 'gym' ? COLOR.warn : ic.kind === 'healer' ? COLOR.danger : COLOR.info;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOR['bg-0'];
    ctx.fillText(ic.kind === 'gym' ? 'G' : ic.kind === 'healer' ? '+' : '$', cx, cy + 0.5);
  }
}

const EXIT_ANGLE: Readonly<Record<LinkDir, number>> = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };

function drawExit(ctx: Ctx2D, x: number, y: number, dir: LinkDir, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(EXIT_ANGLE[dir]);
  ctx.fillStyle = COLOR['text-hi'];
  ctx.beginPath();
  ctx.moveTo(r * 1.2, 0);
  ctx.lineTo(-r * 0.6, -r);
  ctx.lineTo(-r * 0.6, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface MinimapDot {
  x: number;
  z: number;
  angle: number;
}

/**
 * One 4 Hz frame: blit the base, then the other players (small info dots) and the player (accent dot with a heading
 * tick; `angle` is the avatar yaw, 0 facing +z).
 */
export function drawFrame(
  ctx: Ctx2D,
  base: CanvasImageSource | null,
  v: MinimapView,
  px: number,
  self: MinimapDot | null,
  others: readonly MinimapDot[],
  othersCount: number,
): void {
  ctx.clearRect(0, 0, px, px);
  if (base !== null) ctx.drawImage(base, 0, 0);
  const r = Math.max(2.5, px / 64);
  ctx.fillStyle = COLOR.info;
  for (let i = 0; i < othersCount; i++) {
    const o = others[i]!;
    const [x, y] = project(v, px, o.x, o.z);
    if (x < 0 || y < 0 || x > px || y > px) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (self === null) return;
  const [x, y] = project(v, px, self.x, self.z);
  ctx.save();
  ctx.translate(x, y);
  // heading 0 faces +z (down on the map); in the view's frame the heading is `angle − yaw`: rotate the "up" triangle by π − that
  ctx.rotate(Math.PI - (self.angle - v.yaw));
  ctx.fillStyle = COLOR['accent-hi'];
  ctx.beginPath();
  ctx.moveTo(0, -r * 2.6);
  ctx.lineTo(r * 1.4, r * 0.4);
  ctx.lineTo(-r * 1.4, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLOR.accent;
  ctx.strokeStyle = COLOR['bg-0'];
  ctx.lineWidth = Math.max(1, r / 2);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
