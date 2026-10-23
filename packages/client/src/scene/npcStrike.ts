/**
 * NPC talk's slap / kick, the world half (2026-10-22). The local model's tool pass decided the NPC hits the
 * player (`state/npcFx.ts`); this plays it on the NPC's director actor: a quick run at the player, a beat at contact
 * (`onHit`: the sound, the screen burst and — for a kick — the player's knockback), then a walk back to its own spot.
 * The rigs have no strike clip, so the lunge is the strike. While it plays World3D turns the player toward the NPC.
 */
import type { ApproachActors } from './trainerApproach';

export type StrikeKind = 'slap' | 'kick';

/** The run in (ms) and how close it gets (m). */
export const LUNGE_MS = 180;
export const CONTACT_M = 0.9;
/** The beat at contact, then the walk home. */
export const HOLD_MS = 160;
export const RETURN_MS = 420;
/** Emote 4 is the "!" card (render hud `EMOTE_GLYPHS`): the NPC is angry. */
export const ANGRY_EMOTE = 4;

type Phase = 'lunge' | 'hold' | 'return' | 'done';

export class NpcStrike {
  private id: string | null = null;
  private phase: Phase = 'done';
  private t = 0;
  private hx = 0;
  private hz = 0;
  private ha = 0;
  private cx = 0;
  private cz = 0;
  private x = 0;
  private z = 0;
  private angle = 0;
  private onHit: (() => void) | null = null;

  constructor(private readonly actors: ApproachActors) {}

  get active(): boolean {
    return this.id !== null;
  }

  /** The NPC at `home` strikes the player at (px, pz); `onHit` fires at contact. A new strike cuts an old one short. */
  start(id: string, home: { readonly x: number; readonly z: number; readonly angle: number }, px: number, pz: number, onHit: () => void): void {
    if (this.id !== null && this.id !== id) this.finish();
    this.id = id;
    this.phase = 'lunge';
    this.t = 0;
    this.hx = home.x;
    this.hz = home.z;
    this.ha = home.angle;
    const dx = px - home.x;
    const dz = pz - home.z;
    const d = Math.hypot(dx, dz);
    const reach = Math.max(0, d - CONTACT_M);
    this.cx = d > 1e-6 ? home.x + (dx / d) * reach : home.x;
    this.cz = d > 1e-6 ? home.z + (dz / d) * reach : home.z;
    this.angle = Math.atan2(dx, dz);
    this.x = home.x;
    this.z = home.z;
    this.onHit = onHit;
    this.actors.setEmote(id, ANGRY_EMOTE);
  }

  /** Per frame. Allocation-free. */
  update(dtMs: number): void {
    if (this.id === null) return;
    this.t += dtMs;
    if (this.phase === 'lunge') {
      const k = Math.min(1, this.t / LUNGE_MS);
      this.x = this.hx + (this.cx - this.hx) * k;
      this.z = this.hz + (this.cz - this.hz) * k;
      this.actors.setTransform(this.id, this.x, this.z, this.angle, true, true);
      if (k < 1) return;
      this.phase = 'hold';
      this.t = 0;
      const hit = this.onHit;
      this.onHit = null;
      hit?.();
      return;
    }
    if (this.phase === 'hold') {
      this.actors.setTransform(this.id, this.x, this.z, this.angle, false, false);
      if (this.t < HOLD_MS) return;
      this.phase = 'return';
      this.t = 0;
      return;
    }
    const k = Math.min(1, this.t / RETURN_MS);
    const x = this.cx + (this.hx - this.cx) * k;
    const z = this.cz + (this.hz - this.cz) * k;
    // walks home facing its spot (backing up would read as a moonwalk)
    this.actors.setTransform(this.id, x, z, Math.atan2(this.hx - this.cx, this.hz - this.cz), true, false);
    if (k >= 1) this.finish();
  }

  /** The heading that turns the player toward the NPC (the actor pool's atan2(dx, dz) convention). */
  facePlayer(px: number, pz: number): number {
    return Math.atan2(this.x - px, this.z - pz);
  }

  /** Puts the NPC back on its spot, facing as it did. */
  finish(): void {
    if (this.id === null) return;
    this.actors.setEmote(this.id, 0);
    this.actors.setTransform(this.id, this.hx, this.hz, this.ha, false, false);
    const hit = this.onHit;
    this.onHit = null;
    this.id = null;
    this.phase = 'done';
    hit?.();
  }
}

/** The player's kick knocks the NPC back this far (m) over this long, then it walks home. */
export const KNOCK_M = 1.4;
export const KNOCK_MS = 220;

type PlayerPhase = 'lunge' | 'hold' | 'return' | 'done';

/**
 * The player hits the NPC (2026-10-22): render-only, the simulation never moves (the dialogue holds the keys). The
 * player's actor runs at the NPC and back to where it stands; at contact `onHit` (sound, shake, burst). A kick sends
 * the NPC's actor flying back `KNOCK_M` and lets it walk home.
 */
export class PlayerStrike {
  private npc: string | null = null;
  private phase: PlayerPhase = 'done';
  private kind: StrikeKind = 'slap';
  private t = 0;
  // player: home and contact
  private px = 0;
  private pz = 0;
  private cx = 0;
  private cz = 0;
  /** the player's drawn pose this frame */
  x = 0;
  z = 0;
  angle = 0;
  moving = false;
  running = false;
  // NPC: home and where the kick sends it
  private nx = 0;
  private nz = 0;
  private na = 0;
  private kx = 0;
  private kz = 0;
  private onHit: (() => void) | null = null;

  constructor(private readonly actors: ApproachActors) {}

  get active(): boolean {
    return this.npc !== null;
  }

  start(kind: StrikeKind, npcId: string, npcHome: { readonly x: number; readonly z: number; readonly angle: number }, px: number, pz: number, onHit: () => void): void {
    if (this.npc !== null) this.finish();
    this.npc = npcId;
    this.kind = kind;
    this.phase = 'lunge';
    this.t = 0;
    this.px = px;
    this.pz = pz;
    this.nx = npcHome.x;
    this.nz = npcHome.z;
    this.na = npcHome.angle;
    const dx = npcHome.x - px;
    const dz = npcHome.z - pz;
    const d = Math.hypot(dx, dz);
    const ux = d > 1e-6 ? dx / d : 0;
    const uz = d > 1e-6 ? dz / d : 1;
    const reach = Math.max(0, d - CONTACT_M);
    this.cx = px + ux * reach;
    this.cz = pz + uz * reach;
    this.kx = npcHome.x + ux * KNOCK_M;
    this.kz = npcHome.z + uz * KNOCK_M;
    this.angle = Math.atan2(dx, dz);
    this.x = px;
    this.z = pz;
    this.onHit = onHit;
  }

  /** Per frame. Allocation-free. */
  update(dtMs: number): void {
    if (this.npc === null) return;
    this.t += dtMs;
    if (this.phase === 'lunge') {
      const k = Math.min(1, this.t / LUNGE_MS);
      this.x = this.px + (this.cx - this.px) * k;
      this.z = this.pz + (this.cz - this.pz) * k;
      this.moving = true;
      this.running = true;
      if (k < 1) return;
      this.phase = 'hold';
      this.t = 0;
      if (this.kind === 'kick') this.actors.setEmote(this.npc, ANGRY_EMOTE);
      const hit = this.onHit;
      this.onHit = null;
      hit?.();
      return;
    }
    const back = Math.atan2(this.nx - this.kx, this.nz - this.kz);
    if (this.phase === 'hold') {
      this.moving = false;
      this.running = false;
      if (this.kind === 'kick') {
        const k = Math.min(1, this.t / KNOCK_MS);
        // flies back still facing the player
        this.actors.setTransform(this.npc, this.nx + (this.kx - this.nx) * k, this.nz + (this.kz - this.nz) * k, this.angle + Math.PI, false, false);
      }
      if (this.t < Math.max(HOLD_MS, this.kind === 'kick' ? KNOCK_MS : 0)) return;
      this.phase = 'return';
      this.t = 0;
      return;
    }
    const k = Math.min(1, this.t / RETURN_MS);
    this.x = this.cx + (this.px - this.cx) * k;
    this.z = this.cz + (this.pz - this.cz) * k;
    this.moving = k < 1;
    this.running = false;
    if (this.kind === 'kick') this.actors.setTransform(this.npc, this.kx + (this.nx - this.kx) * k, this.kz + (this.nz - this.kz) * k, back, k < 1, false);
    if (k >= 1) this.finish();
  }

  /** Puts the NPC back on its spot; the player's actor follows the simulation again. */
  finish(): void {
    if (this.npc === null) return;
    this.actors.setEmote(this.npc, 0);
    this.actors.setTransform(this.npc, this.nx, this.nz, this.na, false, false);
    const hit = this.onHit;
    this.onHit = null;
    this.npc = null;
    this.phase = 'done';
    this.moving = false;
    this.running = false;
    hit?.();
  }
}
