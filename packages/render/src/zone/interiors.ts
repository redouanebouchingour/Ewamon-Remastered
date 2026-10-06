/**
 * Phase A — `ZoneHandle.interiors` (`InteriorsHandle`): live control of a town's pockets. Every call only changes
 * transforms, visibility or easing targets; `step(dtMs)` (the zone's per-frame hook) eases them. Nothing is built,
 * disposed or re-bound after the zone build (no geometry / material churn: Pillar 7, the compile budget).
 *
 * - `setActive(id)`: that pocket's hall shows and its canopy hides; every other pocket shows its canopy (a thicket
 *   from outside) and hides its hall; walls of a pocket that stops being active stand up again at once.
 * - `setView(yaw)`: walls of the ACTIVE pocket whose outward normal faces the camera (normal · (sin yaw, cos yaw) >
 *   `INTERIOR.facingDot`) ease down to the 0.5 m kerb (`scale.y`), the others back up to 2.4 m.
 * - `setGateOpen(id, open)`: the gate eases down into the floor (or aside, hedges / boulders) and is hidden once fully
 *   open; closing shows it and eases it back.
 * - `setSwitchOn(id, on)`: the emissive part shows (a library emissive surface) and the moving part eases to its "on"
 *   transform (lever thrown, stone risen, keystone set, tile pressed …).
 *
 * Unknown ids are ignored (the client may know gates of pockets a zone does not draw).
 */
import type { InteriorsHandle } from '../contracts.js';
import { INTERIOR, type BuiltInterior, type GateRec, type SwitchRec } from './generators/interiors.js';

interface GateState { readonly rec: GateRec; t: number; target: number }
interface SwitchState { readonly rec: SwitchRec; t: number; target: number }
interface WallState { readonly obj: BuiltInterior['walls'][number]; t: number; target: number }   // t: 1 = full height, 0 = kerb

function smooth(t: number): number { return t * t * (3 - 2 * t); }

export class InteriorSystem implements InteriorsHandle {
  private activeId: string | null = null;
  private viewYaw: number | null = null;
  private readonly byId = new Map<string, BuiltInterior>();
  private readonly walls = new Map<string, WallState[]>();
  private readonly gates = new Map<string, GateState>();
  private readonly switches = new Map<string, SwitchState>();
  private moving = false;

  constructor(readonly pockets: readonly BuiltInterior[]) {
    for (const p of pockets) {
      this.byId.set(p.id, p);
      this.walls.set(p.id, p.walls.map((obj) => ({ obj, t: 1, target: 1 })));
      for (const g of p.gates) this.gates.set(g.id, { rec: g, t: 0, target: 0 });
      for (const s of p.switches) this.switches.set(s.id, { rec: s, t: 0, target: 0 });
    }
    this.setActive(null);
  }

  /** The active pocket id (null = outside every pocket). */
  get active(): string | null { return this.activeId; }

  setActive(id: string | null): void {
    const next = id !== null && this.byId.has(id) ? id : null;
    const prev = this.activeId;
    this.activeId = next;
    for (const p of this.pockets) {
      const on = p.id === next;
      p.hall.visible = on;
      p.canopy.visible = !on;
    }
    if (prev !== null && prev !== next) for (const w of this.walls.get(prev) ?? []) { w.t = 1; w.target = 1; this.applyWall(w); }
    this.retargetWalls();
  }

  setView(yaw: number): void {
    if (!Number.isFinite(yaw)) return;
    this.viewYaw = yaw;
    this.retargetWalls();
  }

  setGateOpen(gateId: string, open: boolean): void {
    const g = this.gates.get(gateId);
    if (g === undefined) return;
    g.target = open ? 1 : 0;
    if (g.target !== g.t) { g.rec.object.visible = true; this.moving = true; }
  }

  setSwitchOn(switchId: string, on: boolean): void {
    const s = this.switches.get(switchId);
    if (s === undefined) return;
    s.target = on ? 1 : 0;
    if (s.rec.glow) s.rec.glow.visible = on;
    if (s.target !== s.t) this.moving = true;
  }

  /** Per frame (real ms): eases walls, gates and switches toward their targets. Zero allocation. */
  step(dtMs: number): void {
    if (!this.moving) return;
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    let busy = false;
    if (this.activeId !== null) {
      for (const w of this.walls.get(this.activeId) ?? []) {
        if (w.t === w.target) continue;
        w.t = w.target > w.t ? Math.min(w.target, w.t + dt / INTERIOR.wallMs) : Math.max(w.target, w.t - dt / INTERIOR.wallMs);
        this.applyWall(w);
        if (w.t !== w.target) busy = true;
      }
    }
    for (const g of this.gates.values()) {
      if (g.t === g.target) continue;
      g.t = g.target > g.t ? Math.min(1, g.t + dt / INTERIOR.gateMs) : Math.max(0, g.t - dt / INTERIOR.gateMs);
      this.applyGate(g);
      if (g.t !== g.target) busy = true;
    }
    for (const s of this.switches.values()) {
      if (s.t === s.target) continue;
      s.t = s.target > s.t ? Math.min(1, s.t + dt / INTERIOR.switchMs) : Math.max(0, s.t - dt / INTERIOR.switchMs);
      this.applySwitch(s);
      if (s.t !== s.target) busy = true;
    }
    this.moving = busy;
  }

  /** Test / sandbox hook: finishes every ease at once. */
  settle(): void { this.moving = true; this.step(1e9); }

  gateOpenness(gateId: string): number { return this.gates.get(gateId)?.t ?? 0; }
  switchState(switchId: string): number { return this.switches.get(switchId)?.t ?? 0; }

  private retargetWalls(): void {
    const id = this.activeId;
    if (id === null) return;
    const yaw = this.viewYaw;
    const cx = yaw === null ? 0 : Math.sin(yaw); const cz = yaw === null ? 0 : Math.cos(yaw);
    for (const w of this.walls.get(id) ?? []) {
      const facing = yaw !== null && w.obj.nx * cx + w.obj.nz * cz > INTERIOR.facingDot;
      w.target = facing ? 0 : 1;
      if (w.t !== w.target) this.moving = true;
    }
  }

  private applyWall(w: WallState): void {
    const k = INTERIOR.kerbH / INTERIOR.wallH;
    w.obj.object.scale.y = k + (1 - k) * smooth(w.t);
  }

  private applyGate(g: GateState): void {
    const r = g.rec; const e = smooth(g.t);
    r.object.position.set(r.rest[0] + r.delta[0] * e, r.rest[1] + r.delta[1] * e, r.rest[2] + r.delta[2] * e);
    if (r.roll !== 0) { const child = r.object.children[0]; if (child) child.rotation.z = r.roll * e; }
    r.object.visible = g.t < 1;
  }

  private applySwitch(s: SwitchState): void {
    const r = s.rec; const m = r.moving;
    if (m === null) return;
    const e = smooth(s.t);
    m.rotation.x = r.off[0] + (r.on[0] - r.off[0]) * e;
    m.position.y = r.off[1] + (r.on[1] - r.off[1]) * e;
  }
}
