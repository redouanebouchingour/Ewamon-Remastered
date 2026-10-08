/**
 * Signature move cinematics: a battle form's signature move (`BattleFormDef.signatureMove`) plays a DOM overlay over
 * the arena — a letterboxed dim, a cut-in band with the form's portrait and the move's name, then the move's own
 * SVG/CSS effect (SignatureCinematic.tsx) — while the 3D stage plays the move as usual.
 *
 * Clock (one per cinematic, from the `cinematic` timeline frame): the cut-in band takes `leadMs`; the move's windup
 * (`windupMs`, the charge) and travel (`travelMs`, the release) follow and the impact lands at
 * `leadMs + windupMs + travelMs`, exactly when the timeline's damage frame does (the timeline spends a signature move's
 * lead, windup and travel uncompressed). The overlay fades out by `totalMs`.
 *
 * A battler's first use of its signature move in a battle plays the full cut-in; later uses play `short`: the band is
 * skipped and the clock starts `leadMs − SHORT_LEAD_MS` in, so the dim still has `SHORT_LEAD_MS` to come in.
 *
 * Every content signature move needs an entry here (asserted by signatures.test.ts) and a portrait at
 * `public/signature/<portrait>.webp` (`pnpm --filter @ewa/sprite-pipeline portraits <sprite ids…>`).
 */
import type { MoveAnimDef } from './moveAnims';

/** The bespoke effect layer each cinematic draws (SignatureCinematic.tsx). */
export type SignatureFx = 'crescent' | 'volley';

export interface SignatureCinematic {
  readonly fx: SignatureFx;
  /** the creature manifest entry of the form that owns the move (`<species>_<form>`), shown in the cut-in band */
  readonly portrait: string;
  /** the eye glint in the portrait, % of its square (the portrait is the source sprite's full canvas) */
  readonly glint: readonly [number, number];
  /** the move's name on two lines in the band */
  readonly lines: readonly [string, string];
  /** small caps line over the name */
  readonly kicker: string;
  /** the cut-in band, before the move's windup (full cinematics only) */
  readonly leadMs: number;
  /** the charge: the move's windup */
  readonly windupMs: number;
  /** the release: the move's travel; the impact lands at leadMs + windupMs + travelMs */
  readonly travelMs: number;
  /** the overlay's full length (the dim is gone by then) */
  readonly totalMs: number;
  /** sfx played as the cut-in starts (ids from the audio manifest) */
  readonly sfx: readonly string[];
}

/** A short cinematic's dim-in before its charge. */
export const SHORT_LEAD_MS = 250;

export const SIGNATURE_CINEMATICS: Readonly<Record<string, SignatureCinematic>> = {
  // hollowmane's Rage Form: a black crescent with a crimson edge, charged in a crimson aura, cuts through the foe
  'Hollow Crescent': {
    fx: 'crescent',
    portrait: 'hollowmane_rage',
    glint: [36, 32],
    lines: ['Hollow', 'Crescent'],
    kicker: 'Signature move · Rage Form',
    leadMs: 1100,
    windupMs: 420,
    travelMs: 260,
    totalMs: 2800,
    sfx: ['wind_gust', 'cry_ghost'],
  },
  // castlemaw's Rage Form: both arm cannons charge while a crosshair locks on, an alternating tracer volley, a
  // fireball and the skull mark on the foe
  'Vendetta Volley': {
    fx: 'volley',
    portrait: 'castlemaw_rage',
    glint: [38, 27],
    lines: ['Vendetta', 'Volley'],
    kicker: 'Signature move · Rage Form',
    leadMs: 1100,
    windupMs: 420,
    travelMs: 420,
    totalMs: 3000,
    sfx: ['wind_gust', 'cry_steel'],
  },
};

export function signatureOf(moveId: string): SignatureCinematic | undefined {
  return Object.prototype.hasOwnProperty.call(SIGNATURE_CINEMATICS, moveId) ? SIGNATURE_CINEMATICS[moveId] : undefined;
}

/** The impact's offset from the cinematic frame (full) — the overlay's impact beat. */
export function impactAt(c: SignatureCinematic): number {
  return c.leadMs + c.windupMs + c.travelMs;
}

/** How far into its full clock a cinematic starts: 0 for the full cut-in, the skipped band for a short one. */
export function skipMs(c: SignatureCinematic, mode: 'full' | 'short'): number {
  return mode === 'full' ? 0 : Math.max(0, c.leadMs - SHORT_LEAD_MS);
}

/** The lead the timeline spends before the move's windup. */
export function leadMs(c: SignatureCinematic, mode: 'full' | 'short'): number {
  return mode === 'full' ? c.leadMs : Math.min(c.leadMs, SHORT_LEAD_MS);
}

/** The move animation a signature move plays under its cinematic (MOVE_ANIMS entries take their timing from here). */
export function signatureAnim(c: SignatureCinematic, own: Pick<MoveAnimDef, 'recoverMs' | 'vfx' | 'attackerPose'>): Partial<MoveAnimDef> {
  // 'wide' keeps both battlers framed: the overlay aims at their projected positions
  return { windupMs: c.windupMs, travelMs: c.travelMs, recoverMs: own.recoverMs, vfx: own.vfx, camera: 'wide', attackerPose: own.attackerPose };
}
