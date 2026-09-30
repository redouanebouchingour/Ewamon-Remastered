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
 * Text: body ≥ 14 px at uiScale 1, a 2 px dark outline under every glyph, numerals drawn digit-by-digit at a fixed
 * advance (tabular). No wall clock: the HUD clock advances by the frame dt (§10 NN 10).
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
import type { HudLayer, VariantKey } from '../contracts.js';
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
  readonly battle: { readonly bars: readonly { readonly who: Ref; readonly name: string; readonly level: number; readonly hp: number; readonly maxHp: number; readonly status: string | null; readonly stages: string; readonly showNumbers: boolean }[]; readonly turnLabel: string; readonly shakes: number } | null;
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
  thumbPx: 48, thumbGap: 8, partyMax: 6,
  chatLines: 6, chatLineH: 21, chatWidth: 440, chatHoldMs: 6000, chatFadeMs: 2000, chatRepaintMs: 250,
  nameplatesMax: 16,
  barW: 210, barH: 52, barLift: 18, barGap: 6,
  /** The battle turn label's reserved box: top-centre, `turnBandTop` below the margin, `turnBandW` × `turnBandH`; bars never enter it. */
  turnBandTop: 120, turnBandH: 34, turnBandW: 320,

  hpTweenMs: 500, hpRepaintMs: 1000 / 30,
  promptW: 520, promptH: 46, promptBottom: 132,
  topRightW: 440,
  scaleMin: 0.9, scaleMax: 1.4,
  moveEpsilonPx: 1,
});

const INK = 'rgba(8, 10, 14, 0.92)';
const PANEL = 'rgba(14, 17, 23, 0.72)';
const PANEL_EDGE = 'rgba(255, 255, 255, 0.14)';
const TEXT = '#f3efe6';
const DIM = '#b9b3a6';
const HP_HI = '#5fd068'; const HP_MID = '#f2c33d'; const HP_LO = '#ec5a4a';
const STATUS_COLORS: Readonly<Record<string, string>> = { brn: '#ee6f4a', psn: '#9a5bb0', par: '#f4cf3f', slp: '#8aa6e0', frz: '#8fd6e8', tox: '#7a3b9a', cnf: '#e06fa0' };
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
  private hpNextRepaint = 0;
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
    if (b === null) { this.hpBars = 0; this.hpTweenLeft = 0; return; }
    let changed = false;
    const n = Math.min(16, b.bars.length);
    for (let i = 0; i < n; i++) {
      const bar = b.bars[i]!;
      const j = prevBars.findIndex((p) => p.who.side === bar.who.side && p.who.slot === bar.who.slot);
      if (j < 0 || j >= shown.length) { this.hpShown[i] = bar.hp; this.hpFrom[i] = bar.hp; this.hpTo[i] = bar.hp; continue; }
      this.hpShown[i] = shown[j]!;
      this.hpFrom[i] = shown[j]!;
      this.hpTo[i] = bar.hp;
      if (prevBars[j]!.hp !== bar.hp) changed = true;
    }
    this.hpBars = n;
    if (changed) this.hpTweenLeft = HUD.hpTweenMs;
  }

  private s(): number { return this.pr * this.ui; }

  private font(px: number, weight: number, display = false): string {
    return `${weight} ${Math.round(px * this.s())}px ${display ? this.displayFamily : this.bodyFamily}`;
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
        out.x = (W - w) / 2; out.y = M; out.w = m.zoneName !== null ? w : 0; out.h = m.zoneName !== null ? (HUD.displayPx + 24) * s : 0;
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

  /** Outlined text: 2 px dark outline under every glyph (Pillar 8). */
  private text(str: string, x: number, y: number, color: string = TEXT): void {
    const { ctx } = this.surface;
    ctx.lineJoin = 'round';
    ctx.lineWidth = HUD.outlinePx * 2 * this.s();
    ctx.strokeStyle = INK;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /** Tabular numerals: digits at a fixed advance, no string allocation. Returns the drawn width. */
  private num(value: number, x: number, y: number, align: 'left' | 'right', color: string = TEXT, minDigits = 1): number {
    const { ctx } = this.surface;
    if (this.digitFont !== ctx.font) { this.digitFont = ctx.font; this.digitAdvance = ctx.measureText('0').width; }
    let v = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
    let digits = 1; for (let t = v; t >= 10; t = Math.floor(t / 10)) digits++;
    digits = Math.max(digits, minDigits);
    const w = digits * this.digitAdvance;
    const saved = ctx.textAlign;
    ctx.textAlign = 'left';
    let cx = (align === 'right' ? x - w : x) + (digits - 1) * this.digitAdvance;
    for (let i = 0; i < digits; i++) { this.text(DIGITS[v % 10]!, cx, y, color); v = Math.floor(v / 10); cx -= this.digitAdvance; }
    ctx.textAlign = saved;
    return w;
  }

  private panel(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this.surface;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = PANEL;
    ctx.fill();
    ctx.lineWidth = Math.max(1, this.s());
    ctx.strokeStyle = PANEL_EDGE;
    ctx.stroke();
  }

  private hpBar(x: number, y: number, w: number, h: number, frac: number): void {
    const { ctx } = this.surface;
    const f = Math.min(1, Math.max(0, Number.isFinite(frac) ? frac : 0));
    ctx.fillStyle = INK;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f > 0.5 ? HP_HI : f > 0.2 ? HP_MID : HP_LO;
    ctx.fillRect(x, y, w * f, h);
  }

  private statusPill(status: string, x: number, y: number): void {
    const { ctx } = this.surface;
    const s = this.s();
    const key = status.slice(0, 3).toLowerCase();
    ctx.beginPath();
    ctx.roundRect(x, y, 38 * s, 17 * s, 4 * s);
    ctx.fillStyle = STATUS_COLORS[key] ?? '#777066';
    ctx.fill();
    ctx.font = this.font(HUD.smallPx, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#101010';
    ctx.fillText(key.toUpperCase(), x + 19 * s, y + 9 * s);
  }

  private drawParty(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.party;
    const party = this.model.party;
    for (let i = 0; i < Math.min(HUD.partyMax, party.length); i++) {
      const p = party[i]!;
      const x = b.x + i * (HUD.thumbPx + HUD.thumbGap) * s; const y = b.y;
      this.panel(x, y, HUD.thumbPx * s, HUD.thumbPx * s, 8 * s);
      ctx.font = this.font(HUD.bodyPx + 3, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = p.fainted ? 0.4 : 1;
      this.text(p.speciesId.slice(0, 2).toUpperCase(), x + HUD.thumbPx * s / 2, y + HUD.thumbPx * s / 2, p.variantKey === 'normal' ? TEXT : '#ffd97a');
      ctx.globalAlpha = 1;
      this.hpBar(x + 3 * s, y + (HUD.thumbPx + 6) * s, (HUD.thumbPx - 6) * s, 6 * s, p.fainted ? 0 : p.hpFrac);
      if (p.status !== null && !p.fainted) {
        ctx.beginPath(); ctx.arc(x + (HUD.thumbPx - 7) * s, y + 7 * s, 5 * s, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_COLORS[p.status.slice(0, 3).toLowerCase()] ?? '#777066'; ctx.fill();
      }
    }
  }

  private drawZoneName(): void {
    const z = this.model.zoneName;
    if (z === null) return;
    const { ctx } = this.surface;
    const b = this.raw.zoneName;
    ctx.font = this.font(HUD.displayPx, 600, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.text(z, b.x + b.w / 2, b.y + b.h / 2);
  }

  private drawTime(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.timeOfDay;
    const t = ((this.model.timeOfDay % 1) + 1) % 1;
    const minutes = Math.floor(t * 1440);
    const hh = Math.floor(minutes / 60); const mm = minutes % 60;
    const day = hh >= 6 && hh < 19;
    const right = b.x + b.w;
    ctx.font = this.font(HUD.numPx + 2, 700);
    ctx.textBaseline = 'middle';
    const y = b.y + 16 * s;
    const mmW = this.num(mm, right, y, 'right', TEXT, 2);
    ctx.textAlign = 'right';
    this.text(':', right - mmW, y);
    const colon = ctx.measureText(':').width;
    const hhW = this.num(hh, right - mmW - colon, y, 'right', TEXT, 2);
    // sun / moon glyph
    const gx = right - mmW - colon - hhW - 16 * s;
    ctx.beginPath(); ctx.arc(gx, y, 8 * s, 0, Math.PI * 2);
    ctx.fillStyle = day ? '#ffd35a' : '#dfe6f5'; ctx.fill();
    ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
    if (!day) { ctx.beginPath(); ctx.arc(gx + 4 * s, y - 3 * s, 7 * s, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); }
    const q = this.model.questHint;
    if (q !== null) {
      ctx.font = this.font(HUD.bodyPx, 500);
      ctx.textAlign = 'right';
      this.text(q.length > 60 ? q.slice(0, 60) : q, right, b.y + 44 * s, DIM);
    }
  }

  private drawChat(): void {
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.chat;
    const chat = this.model.chat;
    const n = Math.min(HUD.chatLines, chat.length);
    ctx.font = this.font(HUD.bodyPx, 500);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const line = chat[chat.length - n + i]!;
      const age = this.clockMs - (this.chatArrival.get(line.at) ?? this.clockMs);
      const a = age <= HUD.chatHoldMs ? 1 : Math.max(0, 1 - (age - HUD.chatHoldMs) / HUD.chatFadeMs);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      const y = b.y + (6 + (i + 0.5) * HUD.chatLineH) * s;
      ctx.font = this.font(HUD.bodyPx, 700);
      this.text(line.name, b.x + 8 * s, y, '#9fd3ff');
      const nw = ctx.measureText(line.name).width;
      ctx.font = this.font(HUD.bodyPx, 500);
      this.text(line.text, b.x + 8 * s + nw + 8 * s, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawPrompt(): void {
    const p = this.model.prompt;
    if (p === null) return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.prompt;
    this.panel(b.x, b.y, b.w, b.h, 10 * s);
    const cy = b.y + b.h / 2;
    const kw = 30 * s;
    ctx.beginPath(); ctx.roundRect(b.x + 12 * s, cy - 13 * s, kw, 26 * s, 5 * s);
    ctx.fillStyle = '#f3efe6'; ctx.fill();
    ctx.font = this.font(HUD.bodyPx, 800);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#15171c'; ctx.fillText(p.key, b.x + 12 * s + kw / 2, cy);
    ctx.textAlign = 'left';
    ctx.font = this.font(HUD.bodyPx + 1, 600);
    this.text(p.verb, b.x + 12 * s + kw + 12 * s, cy);
    const vw = ctx.measureText(p.verb).width;
    this.text(p.target, b.x + 12 * s + kw + 12 * s + vw + 7 * s, cy, '#ffd97a');
  }

  private drawNameplates(): void {
    const { ctx } = this.surface;
    const s = this.s(); const pr = this.pr;
    const plates = this.model.nameplates;
    const n = Math.min(plates.length, HUD.nameplatesMax);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < n; i++) {
      this.plateDrawnXY[i * 2] = this.plateXY[i * 2]!; this.plateDrawnXY[i * 2 + 1] = this.plateXY[i * 2 + 1]!;
      if (this.plateOk[i] !== 1) continue;
      const p = plates[i]!;
      const x = this.plateXY[i * 2]! * pr; const y = this.plateXY[i * 2 + 1]! * pr;
      ctx.font = this.font(HUD.bodyPx, 700);
      this.text(p.name, x, y, p.inBattle ? '#ffb0a0' : TEXT);
      if (p.guildTag.length > 0) { ctx.font = this.font(HUD.smallPx, 600); this.text(p.guildTag, x, y - 17 * s, '#b8e0a8'); }
    }
    if (this.emoteActive && this.anchors?.emotes) this.anchors.emotes(this.emoteDrawVisitor);
  }

  private readonly emoteDrawVisitor = (id: string, emote: number, left: number): void => {
    if (emote <= 0 || this.anchors === null || !this.anchors.nameplate(id, this.emoteXY, 0)) return;
    const { ctx } = this.surface;
    const s = this.s(); const pr = this.pr;
    const x = this.emoteXY[0]! * pr; const y = this.emoteXY[1]! * pr - 62 * s;
    ctx.globalAlpha = Math.min(1, left * 6);
    ctx.beginPath(); ctx.roundRect(x - 22 * s, y - 22 * s, 44 * s, 40 * s, 10 * s);
    ctx.fillStyle = '#f7f3ea'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y + 18 * s); ctx.lineTo(x, y + 26 * s); ctx.lineTo(x + 6 * s, y + 18 * s); ctx.closePath();
    ctx.fillStyle = '#f7f3ea'; ctx.fill();
    ctx.font = this.font(HUD.bodyPx + 7, 400);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(EMOTE_GLYPHS[emote] ?? '', x, y - 1 * s);
    ctx.globalAlpha = 1;
  };

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
      this.panel(x, y, w, h, 8 * s);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = this.font(HUD.bodyPx, 700);
      this.text(bar.name, x + 10 * s, y + 13 * s);
      ctx.font = this.font(HUD.smallPx, 600);
      ctx.textAlign = 'right';
      const lvW = this.num(bar.level, x + w - 10 * s, y + 13 * s, 'right', DIM);
      this.text('Lv', x + w - 12 * s - lvW, y + 13 * s, DIM);
      const shown = i < this.hpBars ? this.hpShown[i]! : bar.hp;
      this.hpBar(x + 10 * s, y + 26 * s, w - 20 * s, 7 * s, bar.maxHp > 0 ? shown / bar.maxHp : 0);
      ctx.font = this.font(HUD.smallPx, 600);
      if (bar.showNumbers) {
        const my = y + 43 * s;
        const maxW = this.num(bar.maxHp, x + w - 10 * s, my, 'right');
        ctx.textAlign = 'right';
        this.text('/', x + w - 12 * s - maxW, my, DIM);
        const slash = ctx.measureText('/').width;
        this.num(shown, x + w - 14 * s - maxW - slash, my, 'right');
      }
      let sx = x + 10 * s;
      if (bar.status !== null) { this.statusPill(bar.status, sx, y + 35 * s); sx += 44 * s; }
      if (bar.stages.length > 0) { ctx.font = this.font(HUD.smallPx, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; this.text(bar.stages, sx, y + 43 * s, '#bfe3ff'); }
    }
    // turn label + orb shakes (top-centre, in the reserved band under the top HUD row / connection pill)
    const W = this.surface.canvas.width;
    const ty = (HUD.margin + HUD.turnBandTop + HUD.turnBandH / 2) * s;
    ctx.font = this.font(HUD.bodyPx + 1, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (b.turnLabel.length > 0) this.text(b.turnLabel, W / 2, ty);
    if (b.shakes > 0) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc(W / 2 + 110 * s + k * 18 * s, ty, 6 * s, 0, Math.PI * 2);
        ctx.fillStyle = k < b.shakes ? '#ffd35a' : 'rgba(255,255,255,0.18)'; ctx.fill();
        ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
      }
    }
  }

  private drawConnection(): void {
    const c = this.model.connection;
    if (c === 'connected') return;
    const { ctx } = this.surface;
    const b = this.raw.connection;
    this.panel(b.x, b.y, b.w, b.h, b.h / 2);
    ctx.font = this.font(HUD.bodyPx, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.text(c === 'reconnecting' ? 'Reconnecting…' : 'Offline', b.x + b.w / 2, b.y + b.h / 2, c === 'offline' ? HP_LO : HP_MID);
  }

  private drawDev(): void {
    const d = this.model.dev;
    if (d === null) return;
    const { ctx } = this.surface;
    const s = this.s(); const b = this.raw.dev;
    this.panel(b.x, b.y, b.w, b.h, 8 * s);
    ctx.font = this.font(HUD.smallPx, 600);
    ctx.textBaseline = 'middle';
    const rows: readonly (readonly [string, number])[] = DEV_ROWS;
    for (let i = 0; i < rows.length; i++) {
      const y = b.y + (14 + i * 20) * s;
      ctx.textAlign = 'left';
      this.text(rows[i]![0], b.x + 10 * s, y, DIM);
      const v = i === 0 ? d.fps : i === 1 ? d.drawCalls : i === 2 ? d.gpuMs * 100 : i === 3 ? d.desyncs : d.rubberBands;
      if (i === 2) {   // gpu ms with 2 decimals, tabular
        const frac = Math.round(v) % 100; const whole = Math.floor(Math.round(v) / 100);
        const fw = this.num(frac, b.x + b.w - 10 * s, y, 'right', TEXT, 2);
        ctx.textAlign = 'right'; this.text('.', b.x + b.w - 10 * s - fw, y);
        this.num(whole, b.x + b.w - 10 * s - fw - ctx.measureText('.').width, y, 'right');
      } else this.num(v, b.x + b.w - 10 * s, y, 'right');
    }
  }
}

const DEV_ROWS: readonly (readonly [string, number])[] = Object.freeze([['fps', 0], ['draw calls', 1], ['gpu ms', 2], ['desyncs', 3], ['rubber-bands', 4]] as const);
