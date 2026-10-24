/**
 * Followers with field powers (SPEC §3.18, §20.4.8): the world side. The lead walking behind the player (the first
 * party creature still standing) and its types decide what works; the server has the last word on every one of them.
 *
 * - Flying: `glider()` hands LocalPlayerController content's `planGlide` over the prediction collider (FIELD_POWERS on in
 *   this room, outdoors); the controller glides, World3D lifts the avatar along `glideAltitude`.
 * - Fire: the follower carries a light in dark places (`isDarkHere`: the rift and the shrines, night, a deep honor
 *   shadow), and E on a bramble patch burns it (`fieldPower burn`). Unburnt patches block this player's prediction like
 *   the server's gates do (collider blockers) and stand in the zone (render obstacles `bramble:<id>`).
 * - Ground: E beside a camp's fire digs (`dig`), once per camp per UTC day (the server says when it is too soon).
 * - Water: E over a dark-water spot (a slow dark ring with bubbles marks each one near the player) dives (`dive`).
 * - Psychic: the power key (F) senses: the server answers with the ghost trainers walking here; their haunts glow on
 *   the ground for `HAUNT.senseMs` (a wanted one in hot orange), with a ring where each walks now.
 *
 * The hint chip's state (`useFieldPowerStore`) is rebuilt when what it shows changes. Allocation-free on the per-frame
 * path except the 1 Hz chip check and the sense trail's short list.
 */
import {
  DIG_SPOTS,
  DIVE_SPOTS,
  FIELD_POWER_TEXT,
  HAUNT,
  brambleFlag,
  brambleSolid,
  bramblesFor,
  digSpotsFor,
  diveSpotsFor,
  fieldLead,
  fieldPowersOf,
  getHeightfield,
  isDarkHere,
  planGlide,
  reachFromSpawn,
  zonePlan,
} from '@ewa/content';
import type { FieldPower, GlidePlan, ZoneDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { FieldFxKind, FollowerPool, ObstaclesHandle } from '@ewa/render';
import type { SensedGhost, ServerMessageOf } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { useSessionStore } from '../state/session';
import { sameChip, useFieldPowerStore } from '../state/fieldPowers';
import type { FieldChip, FieldHint } from '../state/fieldPowers';
import type { StepCollider } from './collider';
import { makeInteractable } from './interaction';
import type { Interactable, InteractionTargets } from './interaction';

/** Render obstacle ids of the brambles (zoneSpecFor puts them beside the Cut / Strength obstacles). */
export function brambleObstacleId(id: string): string {
  return `bramble:${id}`;
}

export interface FieldLeadInfo {
  readonly speciesId: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly variantKey: string;
  readonly powers: readonly FieldPower[];
}

/** The lead of the session party as the chip and the targets see it (the server reads the same rule). */
export function leadInfo(party: readonly CreatureInstance[], typesOf: (speciesId: string) => readonly string[] | undefined): FieldLeadInfo | null {
  const c = fieldLead(party);
  if (c === null) return null;
  const types = typesOf(c.speciesId) ?? [];
  return { speciesId: c.speciesId, name: c.nickname ?? speciesName(c.speciesId), types, variantKey: c.variantKey, powers: fieldPowersOf(types) };
}

/** What the chip says each power does in this zone now. Pure. */
export function fieldHints(
  zone: ZoneDef,
  powers: readonly FieldPower[],
  ctx: { readonly flags: ReadonlySet<string>; readonly dark: boolean; readonly indoors: boolean; readonly powerKey: string },
): FieldHint[] {
  const out: FieldHint[] = [];
  for (const p of powers) {
    switch (p) {
      case 'glide':
        out.push({ power: p, text: ctx.indoors ? 'No gliding indoors' : 'Step off a cliff edge to glide down', here: !ctx.indoors, key: null });
        break;
      case 'light': {
        const n = bramblesFor(zone.id).filter((b) => !ctx.flags.has(brambleFlag(zone.id, b.id))).length;
        const burn = n === 0 ? '' : `${n} bramble patch${n === 1 ? '' : 'es'} to burn here`;
        const text = ctx.dark ? (n > 0 ? `Lighting the dark. ${burn}` : 'Lighting the dark around you') : n > 0 ? burn.charAt(0).toUpperCase() + burn.slice(1) : 'Lights the dark and burns brambles';
        out.push({ power: p, text, here: ctx.dark || n > 0, key: null });
        break;
      }
      case 'dig': {
        const n = (DIG_SPOTS[zone.id] ?? []).length;
        out.push({ power: p, text: n > 0 ? 'Dig beside the camp fire, once a day' : 'No camp to dig at here', here: n > 0, key: null });
        break;
      }
      case 'sense': {
        const grass = zone.encounterTable !== null && zonePlan(zone.id).grassPatches.length > 0;
        out.push({ power: p, text: grass ? 'Sense the ghost trainers walking here' : 'No ghost trainer walks here', here: grass, key: grass ? ctx.powerKey : null });
        break;
      }
      case 'dive': {
        const n = (DIVE_SPOTS[zone.id] ?? []).length;
        out.push({ power: p, text: n > 0 ? `Dive at the dark water (${n} spot${n === 1 ? '' : 's'} here)` : 'No dark water to dive here', here: n > 0, key: null });
        break;
      }
    }
  }
  return out;
}

export interface FieldPowerDeps {
  readonly targets: InteractionTargets;
  interactKey(): string;
  powerKey(): string;
  send(payload: { readonly power: 'burn' | 'dig' | 'dive' | 'sense'; readonly targetId: string }): void;
  toast(text: string): void;
  /** the room's `state.fieldPowers` (false before a room) */
  enabled(): boolean;
  shadow(): number;
  daylight(): number;
  party(): readonly CreatureInstance[];
  typesOf(speciesId: string): readonly string[] | undefined;
  flags(): ReadonlySet<string>;
  /** the player stands in a hall pocket */
  indoors(): boolean;
  /** the prediction collider (blockers, passable, water) */
  collider(): StepCollider | null;
  obstacles(): ObstaclesHandle | null;
  followers(): FollowerPool | null;
  fx(kind: FieldFxKind, x: number, y: number, z: number, dx?: number, dz?: number): void;
  /** the surface under (x, z): the water level on open water */
  height(x: number, z: number): number;
  selfId(): string;
  player(): { readonly x: number; readonly z: number };
}

interface Spot { readonly entry: Interactable; readonly spotId: string; readonly x: number; readonly z: number }
interface Trail { readonly g: SensedGhost; readonly pts: readonly (readonly [number, number])[]; next: number }

const DIVE_MARK_MS = 1500;
const DIVE_MARK_RANGE_M = 45;
const TRAIL_STEP_M = 1.6;
const TRAIL_EMIT_MS = 110;
/** the haunt points near the player (m, a square) light in turn, one in `TRAIL_PHASES` per beat */
const TRAIL_NEAR_M = 36;
const TRAIL_PHASES = 3;
const RING_MS = 900;

export class FieldPowerSystem {
  private zone: ZoneDef | null = null;
  private spots: Spot[] = [];
  private blockers: string[] = [];
  private lead: FieldLeadInfo | null = null;
  private wasEnabled = false;
  private markLeft = 0;
  private trails: Trail[] = [];
  private trailUntil = 0;
  private trailLeft = 0;
  private ringLeft = 0;
  private chipLeft = 0;
  private glideFn: ((x: number, z: number, dx: number, dz: number) => GlidePlan | null) | null = null;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly d: FieldPowerDeps) {
    // the lead (party order, a faint, a heal) and the flags (a bramble burnt) decide the targets and the chip
    this.offs.push(useSessionStore.subscribe((s) => s.inventory?.party, () => this.refresh()));
    this.offs.push(useSessionStore.subscribe((s) => s.progression, () => this.refresh()));
  }

  /** The lead now (null: none). */
  get currentLead(): FieldLeadInfo | null {
    return this.lead;
  }

  /**
   * The glide rule for the controller in this zone (null: no zone): content's `planGlide` over the prediction collider,
   * answering null whenever a glide is not allowed now (FIELD_POWERS off, indoors, a lead that cannot fly). Built once
   * per zone, so the controller's per-step probe allocates nothing until a take-off.
   */
  glider(): ((x: number, z: number, dx: number, dz: number) => GlidePlan | null) | null {
    return this.glideFn;
  }

  /** A new zone (null: none): its spots become targets, its brambles blockers. */
  onZone(zone: ZoneDef | null): void {
    for (const s of this.spots) this.d.targets.removeDynamic(s.entry.id);
    this.spots = [];
    this.clearBlockers();
    this.trails = [];
    this.zone = zone;
    this.glideFn = null;
    if (zone === null) return;
    const h = getHeightfield(zone.id);
    const reach = reachFromSpawn(zone.id);
    const passable = (px: number, pz: number): boolean => this.d.collider()?.passable(px, pz) === true;
    this.glideFn = (x, zz, dx, dz) => {
      if (!this.d.enabled() || this.d.indoors() || this.lead === null || !this.lead.powers.includes('glide') || this.d.collider() === null) return null;
      return planGlide(h, x, zz, dx, dz, passable, reach);
    };
    const key = this.d.interactKey();
    for (const b of bramblesFor(zone.id)) this.addSpot(makeInteractable(`bramble:${b.id}`, 'bramble', b.x, b.z, 'Burn', 'the brambles', key), b.id);
    for (const s of digSpotsFor(zone.id)) this.addSpot(makeInteractable(`dig:${s.id}`, 'dig', s.x, s.z, 'Dig', 'by the campfire', key), s.id);
    for (const s of diveSpotsFor(zone.id)) this.addSpot(makeInteractable(`dive:${s.id}`, 'dive', s.x, s.z, 'Dive', 'into the dark water', key), s.id);
    this.refresh();
  }

  /** The lead, the flags or the room's switch changed: targets, brambles, the chip. */
  refresh(): void {
    this.lead = leadInfo(this.d.party(), this.d.typesOf);
    const z = this.zone;
    const on = this.d.enabled();
    this.wasEnabled = on;
    const can = (p: FieldPower): boolean => on && this.lead !== null && this.lead.powers.includes(p);
    for (const s of this.spots) s.entry.enabled = can(s.entry.kind === 'bramble' ? 'light' : s.entry.kind === 'dig' ? 'dig' : 'dive');
    if (z !== null) {
      const flags = this.d.flags();
      this.clearBlockers();
      const c = this.d.collider();
      for (const b of bramblesFor(z.id)) {
        const burnt = flags.has(brambleFlag(z.id, b.id));
        this.d.obstacles()?.setCleared(brambleObstacleId(b.id), burnt || !on);
        const spot = this.spots.find((s) => s.entry.id === `bramble:${b.id}`);
        if (spot !== undefined && burnt) spot.entry.enabled = false;
        if (on && !burnt && c !== null) {
          const id = brambleObstacleId(b.id);
          c.addBlocker(id, brambleSolid(b));
          this.blockers.push(id);
        }
      }
    }
    this.writeChip();
  }

  /** E on a field target (the server re-checks everything). */
  activate(t: Interactable): void {
    const spot = this.spots.find((s) => s.entry === t);
    if (spot === undefined) return;
    if (t.kind === 'dive') {
      const c = this.d.collider();
      const p = this.d.player();
      if (c !== null && !c.onWater(p.x, p.z)) {
        this.d.toast('Swim out over the dark water first.');
        return;
      }
    }
    this.d.send({ power: t.kind === 'bramble' ? 'burn' : t.kind === 'dig' ? 'dig' : 'dive', targetId: spot.spotId });
  }

  /** The power key: a Psychic lead senses; anything else says what this lead does instead. */
  usePower(): void {
    const lead = this.lead;
    if (!this.d.enabled()) {
      this.d.toast('Nothing answers. Field powers are quiet on this server.');
      return;
    }
    if (lead === null) {
      this.d.toast('Your party needs a creature standing to lead.');
      return;
    }
    if (lead.powers.includes('sense')) {
      this.d.send({ power: 'sense', targetId: 'here' });
      return;
    }
    const first = lead.powers[0];
    this.d.toast(first === undefined ? `${lead.name} has no field power. Lead with a Flying, Fire, Ground, Psychic or Water type.` : `${lead.name}: ${FIELD_POWER_TEXT[first].does}.`);
  }

  /** The server's answer to a power: the flames, the soil, the splash, the haunts. */
  onMessage(m: ServerMessageOf<'fieldPower'>, nowMs: number): void {
    const y = this.d.height(m.x, m.z);
    if (m.power === 'burn') {
      this.d.fx('burn', m.x, y, m.z);
      this.d.obstacles()?.setCleared(brambleObstacleId(m.spotId), true);
    } else if (m.power === 'dig') {
      this.d.fx('dig', m.x, y, m.z);
    } else if (m.power === 'dive') {
      this.d.fx('dive', m.x, y, m.z);
    } else {
      this.trails = m.ghosts.map((g) => ({ g, pts: loopPoints(g.path), next: 0 }));
      this.trailUntil = nowMs + HAUNT.senseMs;
      this.ringLeft = 0;
      const p = this.d.player();
      this.d.fx('senseRing', p.x, this.d.height(p.x, p.z), p.z);
    }
  }

  /** Per rendered frame: the light, the dark-water marks, the haunt trails; the chip at 1 Hz. */
  frame(dtMs: number, nowMs: number): void {
    const z = this.zone;
    const lead = this.lead;
    const on = this.d.enabled();
    if (on !== this.wasEnabled) this.refresh();
    // Fire: the light rides the follower in dark places
    const pool = this.d.followers();
    if (pool !== null) {
      const lit = on && z !== null && lead !== null && lead.powers.includes('light') && !this.d.indoors();
      pool.setLight(lit ? this.d.selfId() : null, lit ? this.darkness(z.id) : 0);
    }
    if (z === null || !on) return;
    // Water: the dark-water spots near the player breathe
    this.markLeft -= dtMs;
    if (this.markLeft <= 0) {
      this.markLeft = DIVE_MARK_MS;
      const p = this.d.player();
      for (const s of diveSpotsFor(z.id)) {
        if (Math.hypot(s.x - p.x, s.z - p.z) > DIVE_MARK_RANGE_M) continue;
        this.d.fx('diveMark', s.x, this.d.height(s.x, s.z), s.z);
      }
    }
    // Psychic: the haunts glow while the sense lasts
    if (this.trails.length > 0) {
      if (nowMs > this.trailUntil) this.trails = [];
      else this.stepTrails(dtMs);
    }
    this.chipLeft -= dtMs;
    if (this.chipLeft <= 0) {
      this.chipLeft = 1000;
      this.writeChip();
    }
  }

  /** Whether an enabled dive spot is in reach of (x, z) (World3D then offers the dive, not the rod). Allocation-free. */
  diveNear(x: number, z: number): boolean {
    for (let i = 0; i < this.spots.length; i++) {
      const e = this.spots[i]!.entry;
      if (e.kind === 'dive' && e.enabled && Math.hypot(e.x - x, e.z - z) <= e.range + 0.5) return true;
    }
    return false;
  }

  /** The sense's trails still showing (tests, the dev handle). */
  get sensed(): readonly SensedGhost[] {
    return this.trails.map((t) => t.g);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.onZone(null);
    useFieldPowerStore.getState().setChip({ lead: null, enabled: false, hints: [] });
  }

  // ---- internals ---------------------------------------------------------------------------------------------------

  private addSpot(entry: Interactable, spotId: string): void {
    entry.enabled = false;
    this.d.targets.addDynamic(entry);
    this.spots.push({ entry, spotId, x: entry.x, z: entry.z });
  }

  private clearBlockers(): void {
    const c = this.d.collider();
    for (const id of this.blockers) c?.removeBlocker(id);
    this.blockers = [];
  }

  /** 0..1: how dark it is here for the light (the rift and the shrines always; night and a deep shadow ramp in). */
  private darkness(zoneId: ZoneId): number {
    const day = this.d.daylight();
    const shadow = this.d.shadow();
    if (!isDarkHere(zoneId, day, shadow)) return 0;
    if (shadow >= 3) return 1;
    const night = Math.min(1, Math.max(0, (0.45 - day) / 0.3));
    return Math.max(night, day >= 0.35 ? 0.85 : 0.6);
  }

  private stepTrails(dtMs: number): void {
    this.trailLeft -= dtMs;
    this.ringLeft -= dtMs;
    if (this.trailLeft <= 0) {
      this.trailLeft = TRAIL_EMIT_MS;
      // the part of each haunt near the player glows on: a third of its points are lit each beat (a mote lives 1.6 s)
      const me = this.d.player();
      for (const t of this.trails) {
        t.next = (t.next + 1) % TRAIL_PHASES;
        for (let i = t.next; i < t.pts.length; i += TRAIL_PHASES) {
          const p = t.pts[i]!;
          if (Math.abs(p[0] - me.x) > TRAIL_NEAR_M || Math.abs(p[1] - me.z) > TRAIL_NEAR_M) continue;
          this.d.fx(t.g.wanted ? 'wanted' : 'sense', p[0], this.d.height(p[0], p[1]), p[1]);
        }
      }
    }
    if (this.ringLeft <= 0) {
      this.ringLeft = RING_MS;
      for (const t of this.trails) this.d.fx(t.g.wanted ? 'wantedRing' : 'senseRing', t.g.x, this.d.height(t.g.x, t.g.z), t.g.z);
    }
  }

  private writeChip(): void {
    const z = this.zone;
    const lead = this.lead;
    const on = this.d.enabled();
    const chip: FieldChip = {
      lead: lead === null ? null : { speciesId: lead.speciesId, name: lead.name, types: lead.types, variantKey: lead.variantKey },
      enabled: on,
      hints:
        on && z !== null && lead !== null
          ? fieldHints(z, lead.powers, { flags: this.d.flags(), dark: isDarkHere(z.id, this.d.daylight(), this.d.shadow()), indoors: this.d.indoors(), powerKey: this.d.powerKey() })
          : [],
    };
    const st = useFieldPowerStore.getState();
    if (!sameChip(st, chip)) setTimeout(() => useFieldPowerStore.getState().setChip(chip), 0);
  }
}

/** Points every `TRAIL_STEP_M` round a closed haunt loop (the motes walk them in turn). */
export function loopPoints(path: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  if (path.length === 0) return out;
  if (path.length === 1) return [path[0]!];
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % path.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(l / TRAIL_STEP_M));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
