/**
 * SPEC §10.9 — the in-canvas HUD layer (Pillar 8: readability outranks atmosphere).
 *
 * One 2D canvas (`OffscreenCanvas`, fallback `HTMLCanvasElement`) at `cssWidth·pr × cssHeight·pr`, one
 * `CanvasTexture`, one full-screen quad drawn AFTER the post pipeline — so bloom, DOF, grain, aberration and every
 * VFX sit under it and can never cover an HP bar, a type pip or a move result. Regions carry their own dirty bit;
 * `set` marks only the regions its keys belong to; `drawIfDirty` clears the union of the dirty regions' old and new
 * boxes, pulls in every region overlapping that area, redraws them clipped to it and uploads once. Nothing changed →
 * nothing drawn, nothing uploaded (600 idle frames = 0 uploads; `hud.test.ts`).
 *
 * World-anchored regions (nameplates, battle bars, emote cards) poll their anchors in `tick` and re-mark themselves
 * only when an anchor moved ≥ 1 px; the chat fade re-marks at 4 Hz while a line fades; HP bars tween at 30 Hz.
 * Text: body ≥ 14 px at uiScale 1, a 2 px dark outline under every glyph on a dark slab, numerals drawn digit-by-digit
 * at a fixed advance (tabular). No wall clock: the HUD clock advances by the frame dt (§10 NN 10).
 *
 * Look: the "Broadcast" UI (IMPLEMENTATION-NOTES "Broadcast UI (2026-10-11)") — black / carbon slabs at 0.92 over the
 * world, paper text, fog labels, one orange for "active / the key you press", hard edges with 12° cuts, skewed HP
 * bars, names / numbers / labels in the display face (uppercase, 800, italic for names), flat type-colour badges.
 *
 * Corrections vs the SPEC text (IMPLEMENTATION-NOTES "Part 3"):
 * - The overlay must be drawn with `outputColorSpace = workingColorSpace` (the host does so around its HUD render):
 *   with sRGB output three 0.186's `needsFrameBufferTarget` routes a plain `render()` through the intermediate
 *   framebuffer target and its output pass would overwrite the post image. The canvas texture therefore carries its
 *   raw sRGB bytes (`NoColorSpace`) and composites premultiplied (One, OneMinusSrcAlpha) exactly like the browser.
 * - A resize re-creates the texture (the GPU texture's size is fixed at creation) and re-points the texture node.
 */
import {
  CanvasTexture, CustomBlending, LinearFilter, Mesh, MeshBasicNodeMaterial, NoColorSpace, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera,
  PlaneGeometry, Scene,
} from 'three/webgpu';
import type { TextureNode } from 'three/webgpu';
import { texture as textureNode } from 'three/tsl';
import type { HudLayer, TypeName, VariantKey } from '../contracts.js';
import { TYPE_COLORS } from '../sprites/typeColors.js';
import { TYPE_ICON_PATHS } from './typeIcons.js';
import { isDevBuild } from '../env.js';

// ---- the model (20-client.md §20.6, verbatim; mirrored because render may not import the client) -----------------

/** spine §2.19, verbatim. */
export interface Ref { readonly side: 0 | 1; readonly slot: number }

export interface HudModel {
  readonly party: readonly { readonly speciesId: string; readonly variantKey: VariantKey; readonly hpFrac: number; readonly status: string | null; readonly fainted: boolean }[]; // ≤ 6; top-left strip, 48 px thumbs
  readonly zoneName: string | null;            // display face 48 px, centre-top, banner timing §20.2.6; null after the banner
  readonly timeOfDay: number;                  // 0..1 -> sun/moon glyph + hh:mm in the top-right
  readonly questHint: string | null;           // one line ≤ 60 chars, below the time; from the active quest's first undone objective label
  readonly chat: readonly { readonly name: string; readonly text: string; readonly at: number }[]; // last 6 lines, bottom-left, each fades 8 s after `at`
  readonly prompt: { readonly key: string; readonly verb: string; readonly target: string } | null; // "E — Talk to Fenkeeper", bottom-centre
  readonly nameplates: readonly { readonly id: string; readonly name: string; readonly guildTag: string; readonly inBattle: boolean }[]; // ≤ 16 nearest; render positions them over actors
  readonly battle: { readonly bars: readonly { readonly who: Ref; readonly name: string; readonly level: number; readonly hp: number; readonly maxHp: number; readonly status: string | null; readonly stages: string; readonly showNumbers: boolean; readonly types?: readonly string[] }[]; readonly turnLabel: string; readonly shakes: number } | null;   // `types`: addition (Part 5, M2-battle-7)
  readonly connection: 'connected' | 'reconnecting' | 'offline';
  readonly dev: { readonly fps: number; readonly drawCalls: number; readonly gpuMs: number; readonly desyncs: number; readonly rubberBands: number } | null; // F3 in dev builds
}

export type HudField = keyof HudModel;
export const HUD_FIELDS: readonly HudField[] = Object.freeze([
  'party', 'zoneName', 'timeOfDay', 'questHint', 'chat', 'prompt', 'nameplates', 'battle', 'connection', 'dev',
] as const);

export type HudRegion = 'party' | 'zoneName' | 'timeOfDay' | 'chat' | 'prompt' | 'nameplates' | 'battle' | 'connection' | 'dev';
/** Draw order (later regions paint over earlier ones where boxes overlap). */
export const HUD_REGIONS: readonly HudRegion[] = Object.freeze(['nameplates', 'battle', 'party', 'zoneName', 'timeOfDay', 'chat', 'prompt', 'connection', 'dev'] as const);

/** §10.9: `questHint` shares the top-right region with `timeOfDay`. */
export const FIELD_REGION: Readonly<Record<HudField, HudRegion>> = Object.freeze({
  party: 'party', zoneName: 'zoneName', timeOfDay: 'timeOfDay', questHint: 'timeOfDay', chat: 'chat', prompt: 'prompt',
  nameplates: 'nameplates', battle: 'battle', connection: 'connection', dev: 'dev',
});

// ---- numbers (CSS px at uiScale 1) -------------------------------------------------------------------------------

export const HUD = Object.freeze({
  margin: 16,
  bodyPx: 15, smallPx: 14, displayPx: 48, numPx: 15,
  outlinePx: 2,
  thumbPx: 56, thumbGap: 8, partyMax: 6,
  chatLines: 6, chatLineH: 21, chatWidth: 440, chatHoldMs: 6000, chatFadeMs: 2000, chatRepaintMs: 250,
  nameplatesMax: 16,
  barW: 240, barH: 52, barLift: 18, barGap: 6,
  /** Type badges on a battle plate (M2-battle-7): height, inner padding, gap (CSS px at uiScale 1). */
  badgeH: 16, badgePad: 5, badgeGap: 4,
  /** The zone banner's paper tag strip above the name slab. */
  zoneTagH: 22,
  /** The battle turn label's reserved box: top-centre, `turnBandTop` below the margin, `turnBandW` × `turnBandH`; bars never enter it. */
  turnBandTop: 120, turnBandH: 34, turnBandW: 320,

  hpTweenMs: 500, hpRepaintMs: 1000 / 30,
  /** §10.7.8 the ghost of lost HP: held this long after a hit, then drained to the new value over `ghostDrainMs` */
  ghostHoldMs: 420, ghostDrainMs: 600,
  promptW: 520, promptH: 46, promptBottom: 132,
  topRightW: 440,
  scaleMin: 0.9, scaleMax: 1.4,
  moveEpsilonPx: 1,
});

/**
 * The Broadcast palette (client `tokens.css`, mirrored: render may not import the client): black `--bg-0`, carbon
 * `--bg-1`, `--bg-3` tracks, `--line-2`, paper `--text-hi`, fog `--text-2`, ONE orange `--accent` (selected / active /
 * the key you press, never decoration or status), `--hp-mid` amber and `--hp-lo` red. Panels sit over the world at 0.92.
 */
const BLACK = '#0d0d0f';
const SLAB = 'rgba(13, 13, 15, 0.92)';
const CARBON = 'rgba(24, 24, 28, 0.92)';
const TRACK = '#2a2a31';
const LINE = '#4a4a54';
const PAPER = '#f5f3ee';
const FOG = '#a3a3ad';
const ACCENT = '#ff5b1f';
const ON_ACCENT = BLACK;
const HP_HI = PAPER; const HP_MID = '#ffb020'; const HP_LO = '#ff4b3e';
/** the ghost of lost HP: paper over the track, so the chunk a hit took reads before it drains away */
const HP_GHOST = 'rgba(245, 243, 238, 0.42)';
/** The glyph outline (Pillar 8). */
const INK = 'rgba(8, 10, 14, 0.92)';
/** The 12° slant of every cut edge and skewed bar. */
const TAN12 = Math.tan((12 * Math.PI) / 180);
const ZONE_TAG = 'NOW ENTERING';
const OBJECTIVE = 'OBJECTIVE';
const TYPE_FALLBACK = '#9aa0a6';
/**
 * Where the party cards' creature thumbnails are served: the sprite pipeline's 128 px WebP fronts, the same files the
 * client's DOM uses (`public/creatures/thumbs/<id>_front.webp`, client `data/thumbs.ts`).
 */
const THUMB_BASE = '/creatures/thumbs/';
const STATUS_FALLBACK = '#77777f';

/**
 * Readable text colour on a `#rrggbb` badge, chosen by relative luminance: whichever of black (L ≈ 0.004) and paper
 * (L ≈ 0.90) gives the higher WCAG contrast — black above L ≈ 0.18 (every type colour but the darkest few).
 */
function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m === null) return PAPER;
  const v = parseInt(m[1]!, 16);
  const lin = (c: number): number => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
  return (L + 0.05) / (0.0042 + 0.05) >= (0.9 + 0.05) / (L + 0.05) ? BLACK : PAPER;
}
/** Status squares (keyed by the uppercase 3-letter code). */
const STATUS_COLORS: Readonly<Record<string, string>> = { BRN: '#ee6f4a', PSN: '#9a5bb0', PAR: '#f4cf3f', SLP: '#8aa6e0', FRZ: '#8fd6e8', TOX: '#7a3b9a', CNF: '#e06fa0' };
const EMOTE_GLYPHS: readonly string[] = ['', '👋', '😊', '😢', '❗', '❤', '😎'];
const DIGITS: readonly string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// ---- surfaces (DI for node tests) --------------------------------------------------------------------------------

/** The 2D API subset the HUD draws with (a `CanvasRenderingContext2D` / `OffscreenCanvasRenderingContext2D`). */
export type Ctx2D = Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'rect' | 'clip' | 'clearRect' | 'fillRect' | 'strokeRect' | 'fillText' | 'strokeText' | 'measureText' |
  'moveTo' | 'lineTo' | 'arc' | 'closePath' | 'fill' | 'stroke' | 'roundRect'
> & {
  font: string; fillStyle: string | CanvasGradient | CanvasPattern; strokeStyle: string | CanvasGradient | CanvasPattern; lineWidth: number;
  lineJoin: CanvasLineJoin; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline; globalAlpha: number;
};

export interface HudSurface { readonly canvas: { width: number; height: number }; readonly ctx: Ctx2D }
export type HudSurfaceFactory = (w: number, h: number) => HudSurface;

export function browserSurface(w: number, h: number): HudSurface {
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as unknown as Ctx2D | null;
  if (ctx === null) throw new Error('@ewa/render: HUD 2D context unavailable');
  return { canvas, ctx };
}

/** Where world-anchored HUD elements sit on screen (CSS px). Implemented by the actor pool and the stage. */
export interface HudAnchors {
  nameplate(id: string, out: Float32Array, offset: number): boolean;
  battler(ref: Ref, out: Float32Array, offset: number): boolean;
  /** Visits every actor with an active emote: id, emote 1..6, remaining fraction 0..1. */
  emotes?(visit: (id: string, emote: number, left: number) => void): void;
}

export interface HudLayerOptions {
  readonly surface?: HudSurfaceFactory;
  readonly anchors?: HudAnchors;
}

interface Box { x: number; y: number; w: number; h: number }
const box = (): Box => ({ x: 0, y: 0, w: 0, h: 0 });

function unionInto(a: Box, b: Box): void {
  if (b.w <= 0 || b.h <= 0) return;
  if (a.w <= 0 || a.h <= 0) { a.x = b.x; a.y = b.y; a.w = b.w; a.h = b.h; return; }
  const x0 = Math.min(a.x, b.x); const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w); const y1 = Math.max(a.y + a.h, b.y + b.h);
  a.x = x0; a.y = y0; a.w = x1 - x0; a.h = y1 - y0;
}

function overlaps(a: Box, b: Box): boolean {
  return a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const EMPTY_MODEL: HudModel = Object.freeze({
  party: [], zoneName: null, timeOfDay: 0.5, questHint: null, chat: [], prompt: null, nameplates: [], battle: null,
  connection: 'connected', dev: null,
});

// ---- the layer ---------------------------------------------------------------------------------------------------

export class CanvasHudLayer implements HudLayer {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: MeshBasicNodeMaterial;
  private readonly quad: Mesh;
  private readonly texNode: TextureNode;
  private tex: CanvasTexture;
  private surface: HudSurface;
  private readonly makeSurface: HudSurfaceFactory;
  private anchors: HudAnchors | null;
  private model: HudModel = EMPTY_MODEL;
  private readonly dirty = new Set<HudRegion>();
  private readonly drawn: Record<HudRegion, Box>;
  private readonly next: Record<HudRegion, Box>;
  /** Un-inflated layout boxes the draw functions anchor to. */
  private readonly raw: Record<HudRegion, Box>;
  private readonly clearBox = box();
  private cssW = 1; private cssH = 1; private pr = 1; private ui = 1;
  private typeTable: Readonly<Record<TypeName, string>> = TYPE_COLORS;
  private readonly typeIcons = new Map<string, Path2D>();
  /** Party-card thumbnails by species: a decoded bitmap, or `null` while loading / when missing (initials drawn). */
  private readonly thumbs = new Map<string, ImageBitmap | null>();
  /** CSS px at the bottom of the canvas covered by the DOM battle panel: battle bars stay above it (T2). */
  private bottomInset = 0;
  private bodyFamily = 'system-ui, sans-serif';
  private displayFamily = 'Georgia, serif';
  private digitAdvance = 0;
  private digitFont = '';
  private clockMs = 0;
  // chat fade bookkeeping
  private readonly chatArrival = new Map<number, number>();
  private chatNextRepaint = 0;
  // world anchors (preallocated)
  private readonly plateXY = new Float32Array(HUD.nameplatesMax * 2);
  private readonly plateDrawnXY = new Float32Array(HUD.nameplatesMax * 2);
  private readonly plateOk = new Uint8Array(HUD.nameplatesMax);
  private readonly barXY = new Float32Array(16 * 2);
  private readonly barDrawnXY = new Float32Array(16 * 2);
  private readonly barOk = new Uint8Array(16);
  /** Placed top-left corners of the battle bars (canvas px): inside the margins, off the reserved boxes, unstacked. */
  private readonly barPos = new Float32Array(16 * 2);
  /** [x0, y0, x1, y1] × 3: the turn label, the party strip, the clock (canvas px, incl. the gap). */
  private readonly reservedBoxes = new Float32Array(12);
  private readonly emoteXY = new Float32Array(2);
  private emoteActive = false;
  // hp tween, per bar index of the current model (≤ 16)
  private readonly hpShown = new Float64Array(16);
  private readonly hpFrom = new Float64Array(16);
  private readonly hpTo = new Float64Array(16);
  private hpBars = 0;
  private hpTweenLeft = 0;
  /** the ghost of lost HP per bar (≥ the shown value; equal = no ghost), its value at the hit, and the shared timers */
  private readonly hpGhost = new Float64Array(16);
  private readonly hpGhostFrom = new Float64Array(16);
  private ghostHoldLeft = 0;
  private ghostDrainLeft = 0;
  private hpNextRepaint = 0;
  // draw-time string caches (uppercase names / labels, thumb initials, the fitted quest hint)
  private readonly upper = new Map<string, string>();
  private readonly initialsCache = new Map<string, string>();
  private hintSrc = ''; private hintAvail = -1; private hintFont = ''; private hintFit = '';
  private uploadCount = 0;
  private drawCount = 0;
  private disposed = false;

  constructor(o: HudLayerOptions = {}) {
    this.makeSurface = o.surface ?? browserSurface;
    this.anchors = o.anchors ?? null;
    this.surface = this.makeSurface(1, 1);
    this.tex = this.makeTexture();
    this.texNode = textureNode(this.tex) as TextureNode;
    const m = new MeshBasicNodeMaterial();
    m.colorNode = this.texNode;
    m.transparent = true;
    m.depthTest = false;
    m.depthWrite = false;
    m.blending = CustomBlending;           // premultiplied canvas bytes: One, OneMinusSrcAlpha
    m.blendSrc = OneFactor; m.blendDst = OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = OneFactor; m.blendDstAlpha = OneMinusSrcAlphaFactor;
    m.fog = false;
    m.toneMapped = false;
    m.name = 'ewa:hud';
    m.userData = { ewaClass: 'hud' };
    this.material = m;
    this.quad = new Mesh(new PlaneGeometry(2, 2), m);
    this.quad.frustumCulled = false;
    this.quad.name = 'ewa:hud-overlay';
    this.scene.add(this.quad);
    this.scene.name = 'ewa:hud';
    const zero = (): Record<HudRegion, Box> => Object.fromEntries(HUD_REGIONS.map((r) => [r, box()])) as Record<HudRegion, Box>;
    this.drawn = zero();
    this.next = zero();
    this.raw = zero();
  }

  setAnchors(a: HudAnchors | null): void { this.anchors = a; this.markDirty('nameplates'); this.markDirty('battle'); }

  // ---- §10.9 -------------------------------------------------------------------------------------------------------

  set(partial: Partial<HudModel>): void {
    if (this.disposed) return;
    let next: Record<string, unknown> | null = null;
    for (const k of Object.keys(partial)) {
      if (!(HUD_FIELDS as readonly string[]).includes(k)) {
        if (isDevBuild()) throw new TypeError(`@ewa/render: HudLayer.set: unknown HudModel field '${k}'`);
        continue;
      }
      const f = k as HudField;
      const v = partial[f];
      if (v === undefined || v === this.model[f]) continue;
      next ??= { ...this.model };
      next[f] = v;
      this.markDirty(FIELD_REGION[f]);
      if (f === 'chat') this.trackChat(v as HudModel['chat']);
      if (f === 'battle') this.trackHp(v as HudModel['battle']);
    }
    if (next !== null) this.model = next as unknown as HudModel;
  }

  drawIfDirty(): boolean {
    if (this.disposed || this.dirty.size === 0) return false;
    const { ctx } = this.surface;
    // new boxes for the dirty regions; the clear area = old ∪ new boxes; pull in every region overlapping it
    const cb = this.clearBox; cb.x = 0; cb.y = 0; cb.w = 0; cb.h = 0;
    for (const r of HUD_REGIONS) if (this.dirty.has(r)) { this.layout(r, this.next[r]); unionInto(cb, this.drawn[r]); unionInto(cb, this.next[r]); }
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of HUD_REGIONS) {
        if (this.dirty.has(r)) continue;
        if (overlaps(cb, this.drawn[r])) { this.dirty.add(r); this.layout(r, this.next[r]); unionInto(cb, this.drawn[r]); unionInto(cb, this.next[r]); grew = true; }
      }
    }
    if (cb.w <= 0 || cb.h <= 0) {
      for (const r of HUD_REGIONS) if (this.dirty.has(r)) { const d = this.drawn[r]; const n = this.next[r]; d.x = n.x; d.y = n.y; d.w = n.w; d.h = n.h; }
      this.dirty.clear();
      return false;
    }
    // integer clear box (the region boxes already carry their own margins, so nothing outside a pulled-in box is cleared)
    const x0 = Math.max(0, Math.floor(cb.x)); const y0 = Math.max(0, Math.floor(cb.y));
    cb.w = Math.min(this.surface.canvas.width, Math.ceil(cb.x + cb.w)) - x0; cb.h = Math.min(this.surface.canvas.height, Math.ceil(cb.y + cb.h)) - y0;
    cb.x = x0; cb.y = y0;
    ctx.save();
    try {
      ctx.beginPath();
      ctx.rect(cb.x, cb.y, cb.w, cb.h);
      ctx.clip();
      ctx.clearRect(cb.x, cb.y, cb.w, cb.h);
      for (const r of HUD_REGIONS) {
        if (!this.dirty.has(r)) continue;
        ctx.globalAlpha = 1;
        this.drawRegion(r);
        const d = this.drawn[r]; const n = this.next[r]; d.x = n.x; d.y = n.y; d.w = n.w; d.h = n.h;
      }
    } finally {
      ctx.restore();   // never leave a clip behind, even if a draw throws
      this.dirty.clear();
    }
    this.tex.needsUpdate = true;
    this.uploadCount++;
    this.drawCount++;
    return true;
  }

  setFonts(body: string, display: string): void {
    this.bodyFamily = body; this.displayFamily = display; this.digitFont = '';
    this.markAll();
  }

  /**
   * T2 (IMPLEMENTATION-NOTES Part 5): CSS px at the bottom of the canvas that DOM chrome covers during a battle (the
   * battle panel). Battle bars are clamped above it; nothing else moves.
   */
  setBottomInset(cssPx: number): void {
    const v = Number.isFinite(cssPx) ? Math.max(0, cssPx) : 0;
    if (v === this.bottomInset) return;
    this.bottomInset = v;
    this.markDirty('battle');
  }

  /** The clamped UI scale (bars, text). */
  get uiScale(): number { return this.ui; }

  setScale(uiScale: number): void {
    const s = Number.isFinite(uiScale) ? Math.min(HUD.scaleMax, Math.max(HUD.scaleMin, uiScale)) : 1;
    if (s === this.ui) return;
    this.ui = s; this.digitFont = '';
    this.markAll();
  }

  resize(cssWidth: number, cssHeight: number, pr: number): void {
    if (!(cssWidth >= 1 && cssHeight >= 1)) return;
    const w = Math.max(1, Math.round(cssWidth * pr)); const h = Math.max(1, Math.round(cssHeight * pr));
    this.cssW = cssWidth; this.cssH = cssHeight; this.pr = pr > 0 ? pr : 1;
    if (this.surface.canvas.width === w && this.surface.canvas.height === h) return;
    this.surface = this.makeSurface(w, h);
    const old = this.tex;
    this.tex = this.makeTexture();
    this.texNode.value = this.tex;
    old.dispose();
    for (const r of HUD_REGIONS) { const d = this.drawn[r]; d.w = 0; d.h = 0; }
    this.digitFont = '';
    this.markAll();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const bmp of this.thumbs.values()) bmp?.close();
    this.thumbs.clear();
    this.tex.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
    this.scene.remove(this.quad);
  }

  // ---- frame hook (host step 3) ---------------------------------------------------------------------------------

  /** Advances the HUD clock (real ms), polls world anchors, chat fades and HP tweens. Zero allocation. */
  tick(dtMs: number): void {
    if (this.disposed) return;
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    this.clockMs += dt;
    const m = this.model;
    // chat fade → 4 Hz repaint while any line is fading
    if (m.chat.length > 0 && this.clockMs >= this.chatNextRepaint) {
      let fading = false;
      for (let i = 0; i < m.chat.length; i++) {
        const age = this.clockMs - (this.chatArrival.get(m.chat[i]!.at) ?? this.clockMs);
        if (age > HUD.chatHoldMs && age < HUD.chatHoldMs + HUD.chatFadeMs + HUD.chatRepaintMs) fading = true;
      }
      if (fading) { this.markDirty('chat'); this.chatNextRepaint = this.clockMs + HUD.chatRepaintMs; }
    }
    // HP tween at 30 Hz
    if (this.hpTweenLeft > 0) {
      this.hpTweenLeft = Math.max(0, this.hpTweenLeft - dt);
      const k = 1 - this.hpTweenLeft / HUD.hpTweenMs;
      const e = k * k * (3 - 2 * k);
      for (let i = 0; i < this.hpBars; i++) this.hpShown[i] = this.hpFrom[i]! + (this.hpTo[i]! - this.hpFrom[i]!) * e;
      if (this.clockMs >= this.hpNextRepaint || this.hpTweenLeft === 0) { this.markDirty('battle'); this.hpNextRepaint = this.clockMs + HUD.hpRepaintMs; }
    }
    // the ghost: held, then drained to the target at 30 Hz
    if (this.ghostHoldLeft > 0) this.ghostHoldLeft = Math.max(0, this.ghostHoldLeft - dt);
    else if (this.ghostDrainLeft > 0) {
      this.ghostDrainLeft = Math.max(0, this.ghostDrainLeft - dt);
      const k = 1 - this.ghostDrainLeft / HUD.ghostDrainMs;
      const e = k * k;
      for (let i = 0; i < this.hpBars; i++) this.hpGhost[i] = Math.max(this.hpTo[i]!, this.hpGhostFrom[i]! + (this.hpTo[i]! - this.hpGhostFrom[i]!) * e);
      if (this.clockMs >= this.hpNextRepaint || this.ghostDrainLeft === 0) { this.markDirty('battle'); this.hpNextRepaint = this.clockMs + HUD.hpRepaintMs; }
    }
    const a = this.anchors;
    if (a === null) return;
    // nameplates: re-mark when an anchor moved ≥ 1 px (or appeared / vanished)
    const plates = m.nameplates;
    const n = Math.min(plates.length, HUD.nameplatesMax);
    let moved = false;
    for (let i = 0; i < n; i++) {
      const ok = a.nameplate(plates[i]!.id, this.plateXY, i * 2) ? 1 : 0;
      if (ok !== this.plateOk[i]) { moved = true; this.plateOk[i] = ok; }
      if (ok === 1 && (Math.abs(this.plateXY[i * 2]! - this.plateDrawnXY[i * 2]!) >= HUD.moveEpsilonPx || Math.abs(this.plateXY[i * 2 + 1]! - this.plateDrawnXY[i * 2 + 1]!) >= HUD.moveEpsilonPx)) moved = true;
    }
    let emotes = false;
    if (a.emotes) { this.emoteScan = false; a.emotes(this.emoteVisitor); emotes = this.emoteScan; }
    if (emotes || this.emoteActive !== emotes) moved = true;
    this.emoteActive = emotes;
    if (moved) this.markDirty('nameplates');
    // battle bars follow the battlers
    const bat = m.battle;
    if (bat !== null) {
      let bmoved = false;
      const bn = Math.min(bat.bars.length, 16);
      for (let i = 0; i < bn; i++) {
        const ok = a.battler(bat.bars[i]!.who, this.barXY, i * 2) ? 1 : 0;
        if (ok !== this.barOk[i]) { bmoved = true; this.barOk[i] = ok; }
        if (ok === 1 && (Math.abs(this.barXY[i * 2]! - this.barDrawnXY[i * 2]!) >= HUD.moveEpsilonPx || Math.abs(this.barXY[i * 2 + 1]! - this.barDrawnXY[i * 2 + 1]!) >= HUD.moveEpsilonPx)) bmoved = true;
      }
      if (bmoved) this.markDirty('battle');
    }
  }

  get uploads(): number { return this.uploadCount; }
  get draws(): number { return this.drawCount; }
  get state(): Readonly<HudModel> { return this.model; }
  get texture(): CanvasTexture { return this.tex; }
  isDirty(r?: HudRegion): boolean { return r === undefined ? this.dirty.size > 0 : this.dirty.has(r); }

  // ---- internals -------------------------------------------------------------------------------------------------

  private emoteScan = false;
  private readonly emoteVisitor = (_id: string, emote: number): void => { if (emote > 0) this.emoteScan = true; };

  private makeTexture(): CanvasTexture {
    const t = new CanvasTexture(this.surface.canvas as unknown as HTMLCanvasElement);
    t.colorSpace = NoColorSpace;      // raw sRGB canvas bytes, composited without conversion (see header)
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = false;
    t.premultiplyAlpha = true;
    t.name = 'ewa:hud';
    return t;
  }

  private markDirty(r: HudRegion): void { this.dirty.add(r); }
  private markAll(): void { for (const r of HUD_REGIONS) this.dirty.add(r); }

  private trackChat(chat: HudModel['chat']): void {
    const keep = new Set<number>();
    for (const line of chat) { keep.add(line.at); if (!this.chatArrival.has(line.at)) this.chatArrival.set(line.at, this.clockMs); }
    for (const k of [...this.chatArrival.keys()]) if (!keep.has(k)) this.chatArrival.delete(k);
    this.chatNextRepaint = 0;
  }

  /** Carries the shown HP of each battler (matched by ref) into the new bar order; a changed target starts a tween. */
  private trackHp(b: HudModel['battle']): void {
    const prevBars = this.model.battle?.bars ?? [];
    const shown = Array.from(this.hpShown.subarray(0, this.hpBars));
    const ghost = Array.from(this.hpGhost.subarray(0, this.hpBars));
    if (b === null) { this.hpBars = 0; this.hpTweenLeft = 0; this.ghostHoldLeft = 0; this.ghostDrainLeft = 0; return; }
    let changed = false; let lost = false;
    const n = Math.min(16, b.bars.length);
    for (let i = 0; i < n; i++) {
      const bar = b.bars[i]!;
      const j = prevBars.findIndex((p) => p.who.side === bar.who.side && p.who.slot === bar.who.slot);
      if (j < 0 || j >= shown.length) { this.hpShown[i] = bar.hp; this.hpFrom[i] = bar.hp; this.hpTo[i] = bar.hp; this.hpGhost[i] = bar.hp; this.hpGhostFrom[i] = bar.hp; continue; }
      this.hpShown[i] = shown[j]!;
      this.hpFrom[i] = shown[j]!;
      this.hpTo[i] = bar.hp;
      // a loss keeps a ghost at the higher of the old ghost and the shown value; a heal leaves none
      const g = Math.max(ghost[j]!, shown[j]!);
      this.hpGhost[i] = bar.hp < shown[j]! ? g : bar.hp;
      this.hpGhostFrom[i] = this.hpGhost[i]!;
      if (prevBars[j]!.hp !== bar.hp) changed = true;
      if (bar.hp < shown[j]!) lost = true;
    }
    this.hpBars = n;
    if (changed) this.hpTweenLeft = HUD.hpTweenMs;
    if (lost) { this.ghostHoldLeft = HUD.ghostHoldMs; this.ghostDrainLeft = HUD.ghostDrainMs; }
  }

  private s(): number { return this.pr * this.ui; }

  private font(px: number, weight: number, display = false, italic = false): string {
    return `${italic ? 'italic ' : ''}${weight} ${Math.round(px * this.s())}px ${display ? this.displayFamily : this.bodyFamily}`;
  }

  /** Region box inflated by the glyph outline / panel stroke, so every pixel a region paints lies inside its box. */
  private layout(r: HudRegion, out: Box): void {
    const raw = this.raw[r];
    this.layoutRaw(r, raw);
    out.x = raw.x; out.y = raw.y; out.w = raw.w; out.h = raw.h;
    if (out.w <= 0 || out.h <= 0) return;
    const m = (HUD.outlinePx + 2) * this.s();
    out.x -= m; out.y -= m; out.w += 2 * m; out.h += 2 * m;
  }

  /** Region boxes in canvas px (static regions) or anchored (world regions). */
  private layoutRaw(r: HudRegion, out: Box): void {
    const s = this.s();
    const W = this.surface.canvas.width; const H = this.surface.canvas.height;
    const M = HUD.margin * s;
    const m = this.model;
    switch (r) {
      case 'party': {
        const n = Math.min(HUD.partyMax, m.party.length);
        out.x = M; out.y = M; out.w = n > 0 ? n * (HUD.thumbPx + HUD.thumbGap) * s : 0; out.h = n > 0 ? (HUD.thumbPx + 20) * s : 0;
        return;
      }
      case 'zoneName': {
        const w = W * 0.6;
        out.x = (W - w) / 2; out.y = M; out.w = m.zoneName !== null ? w : 0; out.h = m.zoneName !== null ? (HUD.zoneTagH + HUD.displayPx + 8) * s : 0;
        return;
      }
      case 'timeOfDay': {
        const w = HUD.topRightW * s;
        out.x = W - M - w; out.y = M; out.w = w; out.h = (m.questHint !== null ? 60 : 34) * s;
        return;
      }
      case 'chat': {
        const n = Math.min(HUD.chatLines, m.chat.length);
        const h = (n * HUD.chatLineH + 12) * s;
        out.x = M; out.y = H - M - h; out.w = n > 0 ? HUD.chatWidth * s : 0; out.h = n > 0 ? h : 0;
        return;
      }
      case 'prompt': {
        const w = HUD.promptW * s; const h = HUD.promptH * s;
        out.x = (W - w) / 2; out.y = H - HUD.promptBottom * s - h; out.w = m.prompt !== null ? w : 0; out.h = m.prompt !== null ? h : 0;
        return;
      }
      case 'connection': {
        const w = 260 * s; const h = 34 * s;
        out.x = (W - w) / 2; out.y = M + (HUD.displayPx + 32) * s; out.w = m.connection === 'connected' ? 0 : w; out.h = m.connection === 'connected' ? 0 : h;
        return;
      }
      case 'dev': {
        const w = 250 * s; const h = 118 * s;
        out.x = W - M - w; out.y = H - M - h; out.w = m.dev !== null ? w : 0; out.h = m.dev !== null ? h : 0;
        return;
      }
      case 'nameplates': this.anchoredBox(out, true); return;
      case 'battle': this.anchoredBox(out, false); return;
    }
  }

  /** Bounding box of the world-anchored elements (nameplates + emote cards, or battle bars + turn label). */
  private anchoredBox(out: Box, plates: boolean): void {
    out.x = 0; out.y = 0; out.w = 0; out.h = 0;
    const s = this.s(); const pr = this.pr;
    const tmp = this.tmpBox;
    const m = this.model;
    if (plates) {
      const n = Math.min(m.nameplates.length, HUD.nameplatesMax);
      for (let i = 0; i < n; i++) {
        if (this.plateOk[i] !== 1) continue;
        const x = this.plateXY[i * 2]! * pr; const y = this.plateXY[i * 2 + 1]! * pr;
        tmp.x = x - 130 * s; tmp.y = y - 34 * s; tmp.w = 260 * s; tmp.h = 40 * s;
        unionInto(out, tmp);
      }
      if (this.emoteActive && this.anchors?.emotes) {
        this.emoteBoxTarget = out;
        this.anchors.emotes(this.emoteBoxVisitor);
      }
      return;
    }
    const b = m.battle;
    if (b === null) return;
    const n = this.placeBars();
    for (let i = 0; i < n; i++) {
      if (this.barOk[i] !== 1) continue;
      tmp.x = this.barPos[i * 2]! - 4 * s; tmp.y = this.barPos[i * 2 + 1]! - 4 * s; tmp.w = (HUD.barW + 8) * s; tmp.h = (HUD.barH + 8) * s;
      unionInto(out, tmp);
    }
    const W = this.surface.canvas.width;
    tmp.x = W / 2 - (HUD.turnBandW / 2) * s; tmp.y = (HUD.margin + HUD.turnBandTop) * s; tmp.w = HUD.turnBandW * s; tmp.h = HUD.turnBandH * s;
    unionInto(out, tmp);
  }

  /**
   * Places the battle bars (IMPLEMENTATION-NOTES Part 4, H10): centred above each battler's anchor, clamped inside the
   * screen margins, moved off the reserved boxes (the turn label — the near battler's bar used to overprint it — the
   * party strip and the clock) by the smallest move among up / down / left / right that stays on screen, so a battler
   * at the top of the frame keeps its bar beside or just above the label instead of over its own sprite, then moved
   * past any earlier bar so two bars never overlap. Writes `barPos`; zero allocation. Returns the bar count.
   */
  private placeBars(): number {
    const b = this.model.battle;
    if (b === null) return 0;
    const s = this.s(); const pr = this.pr;
    const W = this.surface.canvas.width; const H = this.surface.canvas.height;
    const M = HUD.margin * s;
    const w = HUD.barW * s; const h = HUD.barH * s; const gap = HUD.barGap * s;
    const xMax = Math.max(M, W - M - w); const yMax = Math.max(M, H - M - h - this.bottomInset * pr);
    // reserved boxes (+ gap): the turn label, the party strip, the clock / quest hint
    const rb = this.reservedBoxes;
    rb[0] = W / 2 - (HUD.turnBandW / 2) * s - gap; rb[1] = (HUD.margin + HUD.turnBandTop) * s - gap;
    rb[2] = W / 2 + (HUD.turnBandW / 2) * s + gap; rb[3] = (HUD.margin + HUD.turnBandTop + HUD.turnBandH) * s + gap;
    const np = Math.min(HUD.partyMax, this.model.party.length);
    rb[4] = M - gap; rb[5] = M - gap; rb[6] = np > 0 ? M + np * (HUD.thumbPx + HUD.thumbGap) * s + gap : M - gap; rb[7] = np > 0 ? M + (HUD.thumbPx + 20) * s + gap : M - gap;
    rb[8] = W - M - HUD.topRightW * s - gap; rb[9] = M - gap; rb[10] = W - M + gap; rb[11] = M + (this.model.questHint !== null ? 60 : 34) * s + gap;
    const n = Math.min(b.bars.length, 16);
    for (let i = 0; i < n; i++) {
      if (this.barOk[i] !== 1) continue;
      let x = this.barXY[i * 2]! * pr - w / 2;
      let y = this.barXY[i * 2 + 1]! * pr - HUD.barLift * s - h;
      x = Math.min(Math.max(x, M), xMax);
      y = Math.min(Math.max(y, M), yMax);
      for (let pass = 0; pass < 3; pass++) {                  // each box by the smallest move that stays on screen
        let moved = false;
        for (let k = 0; k < rb.length; k += 4) {
          const x0 = rb[k]!; const y0 = rb[k + 1]!; const x1 = rb[k + 2]!; const y1 = rb[k + 3]!;
          if (!(x < x1 && x + w > x0 && y < y1 && y + h > y0)) continue;
          const du = y0 - h >= M ? y - (y0 - h) : Number.POSITIVE_INFINITY;
          const dd = y1 <= yMax ? y1 - y : Number.POSITIVE_INFINITY;
          const dl = x0 - w >= M ? x - (x0 - w) : Number.POSITIVE_INFINITY;
          const dr = x1 <= xMax ? x1 - x : Number.POSITIVE_INFINITY;
          const best = Math.min(du, dd, dl, dr);
          if (best === du) y = y0 - h; else if (best === dd) y = y1; else if (best === dl) x = x0 - w; else if (best === dr) x = x1;
          moved = best !== Number.POSITIVE_INFINITY;
        }
        if (!moved) break;
      }
      for (let pass = 0; pass < n; pass++) {                  // settle against every earlier bar (bounded passes)
        let moved = false;
        for (let j = 0; j < i; j++) {
          if (this.barOk[j] !== 1) continue;
          const px = this.barPos[j * 2]!; const py = this.barPos[j * 2 + 1]!;
          if (!(x < px + w + gap && x + w + gap > px && y < py + h + gap && y + h + gap > py)) continue;
          // below the other bar if that fits on screen, else above it, else beside it (right, then left)
          if (py + h + gap <= yMax) y = py + h + gap;
          else if (py - h - gap >= M) y = py - h - gap;
          else if (px + 2 * w + gap <= W - M) x = px + w + gap;
          else x = Math.max(M, px - w - gap);
          moved = true;
        }
        if (!moved) break;
      }
      this.barPos[i * 2] = x; this.barPos[i * 2 + 1] = y;
    }
    return n;
  }

  private readonly tmpBox = box();
  private emoteBoxTarget: Box = box();
  private readonly emoteBoxVisitor = (id: string, emote: number): void => {
    if (emote <= 0 || this.anchors === null) return;
    if (!this.anchors.nameplate(id, this.emoteXY, 0)) return;
    const s = this.s(); const pr = this.pr;
    const t = this.tmpBox;
    t.x = this.emoteXY[0]! * pr - 30 * s; t.y = this.emoteXY[1]! * pr - 96 * s; t.w = 60 * s; t.h = 64 * s;
    unionInto(this.emoteBoxTarget, t);
  };

  // ---- drawing -----------------------------------------------------------------------------------------------------

  private drawRegion(r: HudRegion): void {
    switch (r) {
      case 'party': this.drawParty(); return;
      case 'zoneName': this.drawZoneName(); return;
      case 'timeOfDay': this.drawTime(); return;
      case 'chat': this.drawChat(); return;
      case 'prompt': this.drawPrompt(); return;
      case 'nameplates': this.drawNameplates(); return;
      case 'battle': this.drawBattle(); return;
      case 'connection': this.drawConnection(); return;
      case 'dev': this.drawDev(); return;
    }
  }

  /** Outlined text: 2 px dark outline under every glyph (Pillar 8). Used for every glyph on a dark slab. */
  private text(str: string, x: number, y: number, color: string = PAPER): void {
    const { ctx } = this.surface;
    ctx.lineJoin = 'round';
    ctx.lineWidth = HUD.outlinePx * 2 * this.s();
    ctx.strokeStyle = INK;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /** Plain text for glyphs on a light slab (paper / orange / a type colour): a dark outline would smear them. */
  private flat(str: string, x: number, y: number, color: string): void {
    const { ctx } = this.surface;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /** Uppercase of a model string, cached (names, labels): redraws at 30 Hz allocate nothing after the first. */
  private up(str: string): string {
    let u = this.upper.get(str);
    if (u === undefined) {
      if (this.upper.size >= 512) this.upper.clear();
      u = str.toUpperCase();
      this.upper.set(str, u);
    }
    return u;
  }

  /**
   * The species' thumbnail for a party card, or null (draw initials). The first ask starts one fetch + decode; when
   * it lands the party region is marked dirty. Nothing loads where `createImageBitmap` does not exist (node tests).
   */
  private thumb(speciesId: string): ImageBitmap | null {
    const hit = this.thumbs.get(speciesId);
    if (hit !== undefined) return hit;
    this.thumbs.set(speciesId, null);
    if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return null;
    fetch(`${THUMB_BASE}${speciesId}_front.webp`)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => createImageBitmap(blob))
      .then((bmp) => { if (this.disposed) { bmp.close(); return; } this.thumbs.set(speciesId, bmp); this.markDirty('party'); })
      .catch(() => undefined);
    return null;
  }

  /** A species' two-letter thumb initials, cached. */
  private initials(speciesId: string): string {
    let u = this.initialsCache.get(speciesId);
    if (u === undefined) {
      if (this.initialsCache.size >= 256) this.initialsCache.clear();
      u = speciesId.slice(0, 2).toUpperCase();
      this.initialsCache.set(speciesId, u);
    }
    return u;
  }

  /** Width of one tabular digit in the current font: the widest of 0–9 (the display face's digits are proportional). */
  private digitW(): number {
    const { ctx } = this.surface;
    if (this.digitFont !== ctx.font) {
      this.digitFont = ctx.font;
      let w = 0;
      for (let d = 0; d < 10; d++) w = Math.max(w, ctx.measureText(DIGITS[d]!).width);
      this.digitAdvance = w;
    }
    return this.digitAdvance;
  }

  /** Tabular numerals: digits at a fixed advance, no string allocation. Returns the drawn width. */
  private num(value: number, x: number, y: number, align: 'left' | 'right' | 'center', color: string = PAPER, minDigits = 1): number {
    const { ctx } = this.surface;
    const adv = this.digitW();
    let v = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
    let digits = 1; for (let t = v; t >= 10; t = Math.floor(t / 10)) digits++;
    digits = Math.max(digits, minDigits);
    const w = digits * adv;
    const saved = ctx.textAlign;
    ctx.textAlign = 'center';            // each digit centred in its fixed cell
    const x0 = (align === 'right' ? x - w : align === 'center' ? x - w / 2 : x) + adv / 2;
    // two passes: every outline first, then every fill, so a digit's outline never eats into its neighbour
    ctx.lineJoin = 'round';
    ctx.lineWidth = HUD.outlinePx * 2 * this.s();
    ctx.strokeStyle = INK;
    for (let i = 0, t = v; i < digits; i++, t = Math.floor(t / 10)) ctx.strokeText(DIGITS[t % 10]!, x0 + (digits - 1 - i) * adv, y);
    ctx.fillStyle = color;
    for (let i = 0; i < digits; i++, v = Math.floor(v / 10)) ctx.fillText(DIGITS[v % 10]!, x0 + (digits - 1 - i) * adv, y);
    ctx.textAlign = saved;
    return w;
  }

  /** A filled quadrilateral (the slab language: hard edges, 12° cuts). */
  private quad4(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fill: string): void {
    const { ctx } = this.surface;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /** A slab whose right edge is cut at 12° (top-right corner at x + w). */
  private slab(x: number, y: number, w: number, h: number, fill: string): void {
    const c = h * TAN12;
    this.quad4(x, y, x + w, y, x + w - c, y + h, x, y + h, fill);
  }

  /** A slab whose left edge is cut at 12° (bottom-left corner at x): the mirror for right-anchored elements. */
  private slabL(x: number, y: number, w: number, h: number, fill: string): void {
    const c = h * TAN12;
    this.quad4(x + c, y, x + w, y, x + w, y + h, x, y + h, fill);
  }

  /** A 12° parallelogram (skewX(-12deg)) spanning x..x+w; the top edge starts h·tan12 in. */
  private skew(x: number, y: number, w: number, h: number, fill: string): void {
    const k = h * TAN12;
    this.quad4(x + k, y, x + w, y, x + w - k, y + h, x, y + h, fill);
  }

  /** Skewed HP bar: a flat fill on the bg-3 track; paper above 50 %, amber above 20 %, red below. */
  private hpBar(x: number, y: number, w: number, h: number, frac: number, ghostFrac = frac): void {
    const f = Math.min(1, Math.max(0, Number.isFinite(frac) ? frac : 0));
    const k = h * TAN12; const iw = w - k;
    this.quad4(x + k, y, x + w, y, x + iw, y + h, x, y + h, TRACK);
    // §10.7.8 the ghost of the HP a hit just took, behind the fill
    const g = Math.min(1, Math.max(f, Number.isFinite(ghostFrac) ? ghostFrac : f));
    if (g > f + 1e-4) { const gw = iw * g; this.quad4(x + k, y, x + k + gw, y, x + gw, y + h, x, y + h, HP_GHOST); }
    if (f <= 0) return;
    const fw = iw * f;
    this.quad4(x + k, y, x + k + fw, y, x + fw, y + h, x, y + h, f > 0.5 ? HP_HI : f > 0.2 ? HP_MID : HP_LO);
  }

  /** A flat status square with its 3-letter code (status colour, ink by luminance). Returns its width. */
  private statusChip(status: string, x: number, cy: number): number {
    const { ctx } = this.surface;
    const s = this.s();
    const key = this.up(status.length > 3 ? status.slice(0, 3) : status);
    const fill = STATUS_COLORS[key] ?? STATUS_FALLBACK;
    ctx.font = this.font(HUD.smallPx, 800, true);
    const w = ctx.measureText(key).width + 2 * HUD.badgePad * s;
    const h = HUD.badgeH * s;
    ctx.fillStyle = fill;
    ctx.fillRect(x, cy - h / 2, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.flat(key, x + w / 2, cy + 0.5 * s, inkOn(fill));
    return w;
  }

  /**
   * Party strip: one 48 px card per creature — a band on top (neutral; paper for a variant: the model carries no
   * types), the initials in the display face, the HP % as a tabular number, a skewed HP bar; the lead card wears the
   * orange ring; a status square in the corner.
   */
  private drawParty(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.party;
    const party = this.model.party;
    const T = HUD.thumbPx * s; const H = (HUD.thumbPx + 20) * s;
    for (let i = 0; i < Math.min(HUD.partyMax, party.length); i++) {
      const p = party[i]!;
      const x = b.x + i * (HUD.thumbPx + HUD.thumbGap) * s; const y = b.y;
      ctx.fillStyle = SLAB; ctx.fillRect(x, y, T, H);
      ctx.fillStyle = p.variantKey === 'normal' ? LINE : PAPER; ctx.fillRect(x, y, T, 4 * s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = p.fainted ? 0.4 : 1;
      // the creature itself (Broadcast UI, 2026-10-11: the user asked for the sprites here), pixel-crisp, contained in
      // the card's top; initials until the thumbnail has loaded or where none exists
      const bmp = this.thumb(p.speciesId);
      const c = ctx as Ctx2D & { drawImage?: (img: ImageBitmap, x: number, y: number, w: number, h: number) => void; imageSmoothingEnabled?: boolean };
      if (bmp !== null && typeof c.drawImage === 'function') {
        const bw = T - 4 * s; const bh = 40 * s;
        const k = Math.min(bw / bmp.width, bh / bmp.height);
        const dw = bmp.width * k; const dh = bmp.height * k;
        c.imageSmoothingEnabled = false;
        c.drawImage(bmp, x + (T - dw) / 2, y + 5 * s + (bh - dh), dw, dh);
        c.imageSmoothingEnabled = true;
      } else {
        ctx.font = this.font(HUD.bodyPx + 5, 800, true, true);
        this.text(this.initials(p.speciesId), x + T / 2, y + 26 * s, PAPER);
      }
      ctx.font = this.font(HUD.smallPx, 800, true);
      if (p.fainted) this.text('KO', x + T / 2, y + 53 * s, FOG);
      else this.num(p.hpFrac * 100, x + T / 2, y + 53 * s, 'center', PAPER);
      ctx.globalAlpha = 1;
      this.hpBar(x + 5 * s, y + 64 * s, T - 10 * s, 6 * s, p.fainted ? 0 : p.hpFrac);
      if (p.status !== null && !p.fainted) {
        ctx.fillStyle = STATUS_COLORS[this.up(p.status.length > 3 ? p.status.slice(0, 3) : p.status)] ?? STATUS_FALLBACK;
        ctx.fillRect(x + T - 12 * s, y + 8 * s, 7 * s, 7 * s);
      }
      if (i === 0) {
        ctx.lineWidth = 2 * s; ctx.strokeStyle = ACCENT;
        ctx.strokeRect(x + s, y + s, T - 2 * s, H - 2 * s);
      }
    }
  }

  /**
   * Zone banner as a broadcast lower-third, centred at the top: a paper tag strip ("NOW ENTERING"), then an orange
   * edge block and a black slab with the name in the display face (48 px, italic 800, uppercase), shrunk to fit.
   */
  private drawZoneName(): void {
    const z = this.model.zoneName;
    if (z === null) return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.zoneName;
    const tagH = HUD.zoneTagH * s; const nameH = (HUD.displayPx + 8) * s;
    const edge = 12 * s; const padL = 20 * s; const padR = 30 * s;
    const name = this.up(z);
    let px: number = HUD.displayPx;
    ctx.font = this.font(px, 800, true, true);
    let tw = ctx.measureText(name).width;
    const maxText = b.w - edge - padL - padR;
    if (tw > maxText && tw > 0) {
      px = Math.max(HUD.bodyPx, px * maxText / tw);
      ctx.font = this.font(px, 800, true, true);
      tw = ctx.measureText(name).width;
    }
    const total = Math.min(b.w, edge + padL + tw + padR);
    const x0 = b.x + (b.w - total) / 2; const ny = b.y + tagH;
    // the tag strip, flush with the slab's left edge
    ctx.font = this.font(HUD.smallPx, 800, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tagW = ctx.measureText(ZONE_TAG).width + 20 * s + tagH * TAN12;
    this.slab(x0 + edge, b.y, tagW, tagH, PAPER);
    this.flat(ZONE_TAG, x0 + edge + 10 * s, b.y + tagH / 2 + 1 * s, BLACK);
    // edge block + name slab
    ctx.fillStyle = ACCENT; ctx.fillRect(x0, ny, edge, nameH);
    this.slab(x0 + edge, ny, total - edge, nameH, SLAB);
    ctx.font = this.font(px, 800, true, true);
    this.text(name, x0 + edge + padL, ny + nameH / 2 + 2 * s, PAPER);
  }

  /**
   * Top-right: the clock slab (sun / moon glyph, DAY / NIGHT label, hh:mm tabular) and, below it, the quest hint as an
   * orange OBJECTIVE label strip + the hint on a black slab (uppercase display face, truncated to the region width).
   */
  private drawTime(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.timeOfDay;
    const t = ((this.model.timeOfDay % 1) + 1) % 1;
    const minutes = Math.floor(t * 1440);
    const hh = Math.floor(minutes / 60); const mm = minutes % 60;
    const day = hh >= 6 && hh < 19;
    const right = b.x + b.w;
    const rowH = 28 * s; const cy = b.y + rowH / 2;
    const pad = 12 * s; const cut = rowH * TAN12; const glyph = 16 * s;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = this.font(HUD.smallPx, 700, true);
    const label = day ? 'DAY' : 'NIGHT';
    const labW = ctx.measureText(label).width;
    ctx.font = this.font(HUD.bodyPx + 5, 800, true);
    const colonW = ctx.measureText(':').width;
    const clockW = 4 * this.digitW() + colonW;
    const slabW = cut + pad + glyph + 8 * s + labW + 10 * s + clockW + pad;
    this.slabL(right - slabW, b.y, slabW, rowH, SLAB);
    let cx = right - slabW + cut + pad;
    // glyph: a paper disc (sun) or a paper crescent (moon)
    ctx.beginPath(); ctx.arc(cx + glyph / 2, cy, 7 * s, 0, Math.PI * 2);
    ctx.fillStyle = PAPER; ctx.fill();
    if (!day) { ctx.beginPath(); ctx.arc(cx + glyph / 2 + 4 * s, cy - 3 * s, 6 * s, 0, Math.PI * 2); ctx.fillStyle = BLACK; ctx.fill(); }
    cx += glyph + 8 * s;
    ctx.font = this.font(HUD.smallPx, 700, true);
    this.text(label, cx, cy + 1 * s, FOG);
    cx += labW + 10 * s;
    ctx.font = this.font(HUD.bodyPx + 5, 800, true);
    cx += this.num(hh, cx, cy, 'left', PAPER, 2);
    this.text(':', cx, cy, FOG);
    cx += colonW;
    this.num(mm, cx, cy, 'left', PAPER, 2);
    const q = this.model.questHint;
    if (q === null) return;
    const qy = b.y + 32 * s; const qh = 28 * s; const qc = qy + qh / 2; const qcut = qh * TAN12;
    ctx.font = this.font(HUD.smallPx, 800, true);
    const tagW = ctx.measureText(OBJECTIVE).width + 2 * 10 * s;
    ctx.font = this.font(HUD.bodyPx + 1, 700, true);
    const avail = b.w - qcut - tagW - 2 * pad;
    const hint = this.fitHint(q, avail);
    const hintW = ctx.measureText(hint).width;
    const total = qcut + tagW + pad + hintW + pad;
    const x0 = right - total;
    this.slabL(x0, qy, total, qh, SLAB);
    this.slabL(x0, qy, qcut + tagW, qh, ACCENT);
    ctx.font = this.font(HUD.smallPx, 800, true);
    this.flat(OBJECTIVE, x0 + qcut + 8 * s, qc + 1 * s, ON_ACCENT);
    ctx.font = this.font(HUD.bodyPx + 1, 700, true);
    this.text(hint, x0 + qcut + tagW + pad, qc + 1 * s, PAPER);
  }

  /** The quest hint, uppercase, ≤ 60 chars, ellipsised to `avail` px in the current font; cached per (hint, width). */
  private fitHint(q: string, avail: number): string {
    if (q === this.hintSrc && avail === this.hintAvail && this.surface.ctx.font === this.hintFont) return this.hintFit;
    const { ctx } = this.surface;
    let t = this.up(q.length > 60 ? q.slice(0, 60) : q);
    if (ctx.measureText(t).width > avail) {
      let n = t.length - 1;
      while (n > 1 && ctx.measureText(t.slice(0, n) + '…').width > avail) n--;
      t = t.slice(0, n).trimEnd() + '…';
    }
    this.hintSrc = q; this.hintAvail = avail; this.hintFont = ctx.font; this.hintFit = t;
    return t;
  }

  /** Chat: one black slab per line (fading with the line), the name as a fog label, the text in the body face. */
  private drawChat(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.chat;
    const chat = this.model.chat;
    const n = Math.min(HUD.chatLines, chat.length);
    const lh = (HUD.chatLineH - 2) * s; const cut = lh * TAN12;
    for (let i = 0; i < n; i++) {
      const line = chat[chat.length - n + i]!;
      const age = this.clockMs - (this.chatArrival.get(line.at) ?? this.clockMs);
      const a = age <= HUD.chatHoldMs ? 1 : Math.max(0, 1 - (age - HUD.chatHoldMs) / HUD.chatFadeMs);
      if (a <= 0) continue;
      const y = b.y + (6 + (i + 0.5) * HUD.chatLineH) * s;
      const name = this.up(line.name);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = this.font(HUD.bodyPx, 800, true);
      const nw = ctx.measureText(name).width;
      ctx.font = this.font(HUD.bodyPx, 500);
      const tw = ctx.measureText(line.text).width;
      const w = Math.min(b.w, 8 * s + nw + 8 * s + tw + 10 * s + cut);
      this.slab(b.x, y - lh / 2, w, lh, SLAB);
      ctx.beginPath(); ctx.rect(b.x, y - lh / 2, Math.max(0, w - cut), lh); ctx.clip();
      ctx.font = this.font(HUD.bodyPx, 800, true);
      this.text(name, b.x + 8 * s, y + 1 * s, FOG);
      ctx.font = this.font(HUD.bodyPx, 500);
      this.text(line.text, b.x + 16 * s + nw, y, PAPER);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Prompt: the orange key chip + a black slab with the uppercase verb and target, centred bottom. */
  private drawPrompt(): void {
    const p = this.model.prompt;
    if (p === null) return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.prompt;
    const h = 40 * s; const y0 = b.y + (b.h - h) / 2; const cy = y0 + h / 2;
    const verb = this.up(p.verb); const target = this.up(p.target);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = this.font(HUD.bodyPx + 7, 800, true);
    const key = this.up(p.key);
    const chipW = Math.max(40 * s, ctx.measureText(key).width + 16 * s);
    ctx.font = this.font(HUD.bodyPx + 5, 700, true);
    const vw = ctx.measureText(verb).width;
    ctx.font = this.font(HUD.bodyPx + 5, 800, true, true);
    const tw = ctx.measureText(target).width;
    const slabW = Math.min(b.w - chipW, 14 * s + vw + (tw > 0 ? 8 * s + tw : 0) + 18 * s + h * TAN12);
    const x0 = b.x + (b.w - chipW - slabW) / 2;
    ctx.fillStyle = ACCENT; ctx.fillRect(x0, y0, chipW, h);
    ctx.font = this.font(HUD.bodyPx + 7, 800, true);
    ctx.textAlign = 'center';
    this.flat(key, x0 + chipW / 2, cy + 1 * s, ON_ACCENT);
    this.slab(x0 + chipW, y0, slabW, h, SLAB);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0 + chipW, y0, Math.max(0, slabW - h * TAN12), h); ctx.clip();
    ctx.textAlign = 'left';
    ctx.font = this.font(HUD.bodyPx + 5, 700, true);
    this.text(verb, x0 + chipW + 14 * s, cy + 1 * s, PAPER);
    ctx.font = this.font(HUD.bodyPx + 5, 800, true, true);
    if (tw > 0) this.text(target, x0 + chipW + 14 * s + vw + 8 * s, cy + 1 * s, PAPER);
    ctx.restore();
  }

  /** Nameplates: a black slab per actor — the guild tag in fog, the name in the display face; in battle → orange edge. */
  private drawNameplates(): void {
    const { ctx } = this.surface;
    const s = this.s(); const pr = this.pr;
    const plates = this.model.nameplates;
    const n = Math.min(plates.length, HUD.nameplatesMax);
    const h = 22 * s; const pad = 8 * s;
    for (let i = 0; i < n; i++) {
      this.plateDrawnXY[i * 2] = this.plateXY[i * 2]!; this.plateDrawnXY[i * 2 + 1] = this.plateXY[i * 2 + 1]!;
      if (this.plateOk[i] !== 1) continue;
      const p = plates[i]!;
      const x = this.plateXY[i * 2]! * pr; const y = this.plateXY[i * 2 + 1]! * pr;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const name = this.up(p.name);
      ctx.font = this.font(HUD.bodyPx + 1, 800, true);
      const nw = ctx.measureText(name).width;
      let gw = 0;
      const tag = p.guildTag.length > 0 ? this.up(p.guildTag) : '';
      if (tag.length > 0) { ctx.font = this.font(HUD.smallPx, 700, true); gw = ctx.measureText(tag).width + 6 * s; }
      const edge = p.inBattle ? 5 * s : 0;
      const cut = h * TAN12;
      const w = Math.min(260 * s, edge + pad + gw + nw + pad + cut);
      const x0 = x - w / 2; const y0 = y - 18 * s; const cy = y0 + h / 2 + 1 * s;
      this.slab(x0, y0, w, h, SLAB);
      if (edge > 0) { ctx.fillStyle = ACCENT; ctx.fillRect(x0, y0, edge, h); }
      if (gw > 0) { ctx.font = this.font(HUD.smallPx, 700, true); this.text(tag, x0 + edge + pad, cy, FOG); }
      ctx.font = this.font(HUD.bodyPx + 1, 800, true);
      this.text(name, x0 + edge + pad + gw, cy, PAPER);
    }
    if (this.emoteActive && this.anchors?.emotes) this.anchors.emotes(this.emoteDrawVisitor);
  }

  private readonly emoteDrawVisitor = (id: string, emote: number, left: number): void => {
    if (emote <= 0 || this.anchors === null || !this.anchors.nameplate(id, this.emoteXY, 0)) return;
    const { ctx } = this.surface;
    const s = this.s(); const pr = this.pr;
    const x = this.emoteXY[0]! * pr; const y = this.emoteXY[1]! * pr - 62 * s;
    ctx.globalAlpha = Math.min(1, left * 6);
    ctx.fillStyle = PAPER; ctx.fillRect(x - 22 * s, y - 22 * s, 44 * s, 40 * s);
    this.quad4(x - 8 * s, y + 18 * s, x + 2 * s, y + 18 * s, x - 8 * s, y + 27 * s, x - 8 * s, y + 27 * s, PAPER);
    ctx.font = this.font(HUD.bodyPx + 7, 400);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = BLACK;
    ctx.fillText(EMOTE_GLYPHS[emote] ?? '', x, y - 1 * s);
    ctx.globalAlpha = 1;
  };

  /**
   * Battle plates (240 × 52 at uiScale 1, placed by `placeBars`): a black slab with a 12° right cut and a type-colour
   * edge, the name (display italic 800, uppercase), LV, a skewed HP bar, then type badges · status · stage arrows on
   * the left and the HP numbers (own side) on the right. The turn label is an orange skewed chip; orb shakes are squares.
   */
  private drawBattle(): void {
    const b = this.model.battle;
    if (b === null) return;
    const { ctx } = this.surface;
    const s = this.s();
    const n = this.placeBars();
    for (let i = 0; i < n; i++) {
      this.barDrawnXY[i * 2] = this.barXY[i * 2]!; this.barDrawnXY[i * 2 + 1] = this.barXY[i * 2 + 1]!;
      if (this.barOk[i] !== 1) continue;
      const bar = b.bars[i]!;
      const w = HUD.barW * s; const h = HUD.barH * s;
      const x = this.barPos[i * 2]!; const y = this.barPos[i * 2 + 1]!;
      const cut = h * TAN12;
      this.slab(x, y, w, h, SLAB);
      const types = bar.types ?? [];
      if (types.length > 0) { ctx.fillStyle = this.typeTable[types[0] as TypeName] ?? TYPE_FALLBACK; ctx.fillRect(x, y, 5 * s, h); }
      const l = x + 14 * s;
      // row 1: name · LV n
      const r1 = y + 14 * s; const right1 = x + w - cut * (14 / HUD.barH) - 12 * s;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = this.font(HUD.bodyPx + 5, 800, true);
      const lvW = this.num(bar.level, right1, r1, 'right', PAPER);
      ctx.font = this.font(HUD.smallPx, 700, true);
      ctx.textAlign = 'right';
      this.text('LV', right1 - lvW - 4 * s, r1 + 1 * s, FOG);
      ctx.textAlign = 'left';
      ctx.font = this.font(HUD.bodyPx + 4, 800, true, true);
      this.text(this.up(bar.name), l, r1, PAPER);
      // row 2: the skewed HP bar
      const shown = i < this.hpBars ? this.hpShown[i]! : bar.hp;
      // the ghost shows only above the target (a loss); a heal tweens the fill up with none ahead of it
      const ghost = i < this.hpBars && this.hpGhost[i]! > this.hpTo[i]! ? Math.max(shown, this.hpGhost[i]!) : shown;
      this.hpBar(l, y + 25 * s, x + w - cut * (34 / HUD.barH) - 10 * s - l, 9 * s, bar.maxHp > 0 ? shown / bar.maxHp : 0, bar.maxHp > 0 ? ghost / bar.maxHp : 0);
      // row 3: numbers on the right (own side), badges · status · stages on the left
      const r3 = y + 43 * s; const right3 = x + w - cut * (43 / HUD.barH) - 10 * s;
      let numL = right3;
      if (bar.showNumbers) {
        ctx.font = this.font(HUD.smallPx, 700, true);
        const maxW = this.num(bar.maxHp, right3, r3, 'right', FOG);
        ctx.textAlign = 'right';
        this.text('/', right3 - maxW - 1 * s, r3, FOG);
        const slash = ctx.measureText('/').width;
        ctx.font = this.font(HUD.bodyPx + 2, 800, true);
        numL = right3 - maxW - 2 * s - slash - this.num(shown, right3 - maxW - 2 * s - slash, r3, 'right', PAPER);
      }
      let sx = l;
      // type badges first (§50.1 #15, M2-battle-7): the §10.4.6 colour (the colourblind table when set), 3-letter name
      for (let t = 0; t < types.length && t < 2; t++) sx += this.typeBadge(types[t]!, sx, r3) + HUD.badgeGap * s;
      if (bar.status !== null) sx += this.statusChip(bar.status, sx, r3) + HUD.badgeGap * s;
      if (bar.stages.length > 0 && sx < numL - 8 * s) {
        ctx.font = this.font(HUD.smallPx, 700, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        this.text(this.up(bar.stages), sx + 2 * s, r3 + 1 * s, PAPER);
      }
    }
    // turn label + orb shakes (top-centre, in the reserved band under the top HUD row / connection pill)
    const W = this.surface.canvas.width;
    const ty = (HUD.margin + HUD.turnBandTop + HUD.turnBandH / 2) * s;
    const ch = (HUD.turnBandH - 4) * s;
    let half = 0;
    if (b.turnLabel.length > 0) {
      const label = this.up(b.turnLabel);
      ctx.font = this.font(HUD.bodyPx + 5, 800, true, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cw = Math.min((HUD.turnBandW - 100) * s, ctx.measureText(label).width + 2 * 16 * s + ch * TAN12);
      half = cw / 2;
      this.skew(W / 2 - half, ty - ch / 2, cw, ch, ACCENT);
      this.flat(label, W / 2, ty + 1 * s, ON_ACCENT);
    }
    if (b.shakes > 0) {
      const q = 10 * s;
      const x0 = W / 2 + Math.max(half, 40 * s) + 12 * s;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = BLACK; ctx.fillRect(x0 + k * 16 * s - 2 * s, ty - q / 2 - 2 * s, q + 4 * s, q + 4 * s);
        ctx.fillStyle = k < b.shakes ? PAPER : TRACK; ctx.fillRect(x0 + k * 16 * s, ty - q / 2, q, q);
      }
    }
  }

  /**
   * One type badge with its left edge at x, vertically centred on cy; returns its width. Broadcast UI (2026-10-11):
   * a flat type-colour square carrying the type's icon (`typeIcons.ts`, stroked in the badge's ink) — no letter
   * code. Where the surface cannot draw a path (no `Path2D`, or a context without `translate`/`scale`: node tests)
   * it falls back to the 3-letter name.
   */
  private typeBadge(type: string, x: number, cy: number): number {
    const { ctx } = this.surface;
    const s = this.s();
    const icon = this.typeIcon(type);
    const c = ctx as Ctx2D & { translate?: (x: number, y: number) => void; scale?: (x: number, y: number) => void; lineCap: CanvasLineCap };
    if (icon !== null && typeof c.translate === 'function' && typeof c.scale === 'function') {
      const h = HUD.badgeH * s;
      const fill = this.typeTable[type as TypeName] ?? TYPE_FALLBACK;
      ctx.fillStyle = fill;
      ctx.fillRect(x, cy - h / 2, h, h);
      const k = (h * 0.8) / 24;
      c.save();
      c.translate(x + h * 0.1, cy - h * 0.4);
      c.scale(k, k);
      c.strokeStyle = inkOn(fill);
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      (c.stroke as (path: Path2D) => void)(icon);
      c.restore();
      return h;
    }
    const label = this.up(type.length > 3 ? type.slice(0, 3) : type);
    ctx.font = this.font(HUD.smallPx, 800, true);
    const w = ctx.measureText(label).width + 2 * HUD.badgePad * s;
    const h = HUD.badgeH * s;
    const fill = this.typeTable[type as TypeName] ?? TYPE_FALLBACK;
    ctx.fillStyle = fill;
    ctx.fillRect(x, cy - h / 2, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.flat(label, x + w / 2, cy + 0.5 * s, inkOn(fill));
    return w;
  }

  /** The type's icon as a cached `Path2D` (built once per type), or null where `Path2D` does not exist. */
  private typeIcon(type: string): Path2D | null {
    if (typeof Path2D === 'undefined') return null;
    const hit = this.typeIcons.get(type);
    if (hit !== undefined) return hit;
    const d = (TYPE_ICON_PATHS as Readonly<Record<string, string>>)[type];
    if (d === undefined) return null;
    const path = new Path2D(d);
    this.typeIcons.set(type, path);
    return path;
  }

  /** The type colour table badges use (the stage's `setTypeColors` forwards the colourblind tables, §20.8.3). */
  setTypeColors(table: Readonly<Record<TypeName, string>>): void {
    if (table === this.typeTable) return;
    this.typeTable = table;
    this.markDirty('battle');
  }

  /** Connection: a black slab with a status edge (amber reconnecting, red offline) and the uppercase state. */
  private drawConnection(): void {
    const c = this.model.connection;
    if (c === 'connected') return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.connection;
    const color = c === 'offline' ? HP_LO : HP_MID;
    ctx.font = this.font(HUD.bodyPx + 1, 800, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = c === 'reconnecting' ? 'RECONNECTING…' : 'OFFLINE';
    const w = Math.min(b.w, 6 * s + 14 * s + ctx.measureText(label).width + 14 * s + b.h * TAN12);
    const x0 = b.x + (b.w - w) / 2;
    this.slab(x0, b.y, w, b.h, SLAB);
    ctx.fillStyle = color; ctx.fillRect(x0, b.y, 6 * s, b.h);
    this.text(label, x0 + 20 * s, b.y + b.h / 2 + 1 * s, color);
  }

  private drawDev(): void {
    const d = this.model.dev;
    if (d === null) return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.dev;
    ctx.fillStyle = CARBON; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = LINE; ctx.fillRect(b.x, b.y, b.w, 1 * s);
    ctx.textBaseline = 'middle';
    const rows: readonly (readonly [string, number])[] = DEV_ROWS;
    for (let i = 0; i < rows.length; i++) {
      const y = b.y + (14 + i * 20) * s;
      ctx.textAlign = 'left';
      ctx.font = this.font(HUD.smallPx, 700, true);
      this.text(rows[i]![0], b.x + 10 * s, y, FOG);
      ctx.font = this.font(HUD.numPx, 800, true);
      const v = i === 0 ? d.fps : i === 1 ? d.drawCalls : i === 2 ? d.gpuMs * 100 : i === 3 ? d.desyncs : d.rubberBands;
      if (i === 2) {   // gpu ms with 2 decimals, tabular
        const frac = Math.round(v) % 100; const whole = Math.floor(Math.round(v) / 100);
        const fw = this.num(frac, b.x + b.w - 10 * s, y, 'right', PAPER, 2);
        ctx.textAlign = 'right'; this.text('.', b.x + b.w - 10 * s - fw, y);
        this.num(whole, b.x + b.w - 10 * s - fw - ctx.measureText('.').width, y, 'right');
      } else this.num(v, b.x + b.w - 10 * s, y, 'right');
    }
  }
}

const DEV_ROWS: readonly (readonly [string, number])[] = Object.freeze([['FPS', 0], ['DRAW CALLS', 1], ['GPU MS', 2], ['DESYNCS', 3], ['RUBBER-BANDS', 4]] as const);
