/**
 * SPEC §20.5.6 (amended 2026-10-05) — the world side of the evolution sequence: World3D's `EvolutionPlayer`
 * (`app/evolution.ts` calls it once the server confirmed an evolution).
 *
 * `play` stages the evolution with render's `stage.evolve` (render §10.7.5: the creature beside the player under the
 * inspector camera, glow, OLD ↔ NEW silhouettes, the burst; reduced effects: a cross-fade), after asking for both
 * forms' atlases (the sequence itself waits for the binds). While it plays: the player's movement is off (and every
 * world action is blocked by `ui.evolution`, which `app/evolution.ts` sets), the canvas HUD is hidden, the avatar faces
 * the creature (`faceAngle`, read by the tick — no allocation), and a primary click or Space / Enter / Escape skips (to
 * the reveal, then to the exit; the keys are swallowed so nothing else reacts). Both forms' front textures (flipbooks
 * included) are leased for the sequence and released when it ends (client IMPLEMENTATION-NOTES "Creature textures"). Render calls `onPhase` from its frame
 * hook, so the reveal / leave callbacks are deferred off the tick. When the sequence ends — played, skipped or
 * cancelled (a battle's `dress`) — the input, the HUD and the listeners are restored exactly.
 */
import type { EvolutionHandle, EvolutionPhase, SpriteDescriptor } from '@ewa/render';
import type { VariantKey } from '@ewa/core';
import type { EvolutionCallbacks, EvolutionRequest } from '../app/evolution';
import { sideFor } from './creatureTextures';
import type { LeaseSprites } from './creatureTextures';

/** The keys that skip the sequence (a primary click does too). */
export const EVOLUTION_SKIP_KEYS: ReadonlySet<string> = new Set(['Space', 'Enter', 'NumpadEnter', 'Escape']);

/** What the director drives (World3D passes the live subsystems; tests pass fakes). */
export interface EvolutionDirectorDeps {
  readonly stage: {
    evolve(r: {
      readonly from: SpriteDescriptor;
      readonly to: SpriteDescriptor;
      readonly at: { readonly x: number; readonly z: number };
      readonly reduced: boolean;
      readonly cheer: string | null;
      readonly onPhase: (phase: EvolutionPhase) => void;
    }): EvolutionHandle;
    /** the running sequence's creature feet (render's `Stage.evolution`) */
    readonly evolution: { readonly feet: { readonly x: number; readonly z: number } } | null;
  };
  readonly descriptor: (speciesId: string, key: string, variant: VariantKey, isAlpha: boolean) => SpriteDescriptor | null;
  /** the textures of the side both forms show (the front), held while the sequence plays */
  readonly leaseSprites: LeaseSprites;
  /** a zone is loaded and no battle runs */
  readonly canPlay: () => boolean;
  /** the player's rendered feet (the creature appears in front of them) */
  readonly position: () => { readonly x: number; readonly z: number };
  readonly selfId: () => string;
  readonly reduced: () => boolean;
  readonly setInputEnabled: (on: boolean) => void;
  /** whether the player's input should be on once the sequence ended (no battle meanwhile) */
  readonly inputAfter: () => boolean;
  readonly setHudVisible: (on: boolean) => void;
  /** the HUD's own visibility (F1) to restore */
  readonly hudVisible: () => boolean;
  /** where the skip listeners go (window) */
  readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** off-tick scheduling for render's phase callbacks (default `setTimeout(f, 0)`) */
  readonly defer?: (f: () => void) => void;
}

export class EvolutionDirector {
  private handle: EvolutionHandle | null = null;
  private faceX = 0;
  private faceZ = 0;

  constructor(private readonly d: EvolutionDirectorDeps) {}

  /** Whether a sequence is playing (the tick then poses the avatar with `faceAngle`). */
  get active(): boolean {
    return this.handle !== null;
  }

  /** The heading from (x, z) to the creature (radians, the actor pool's convention: `atan2(dx, dz)`). */
  faceAngle(x: number, z: number): number {
    return Math.atan2(this.faceX - x, this.faceZ - z);
  }

  /** `EvolutionPlayer.play`: null when it cannot play here (no zone, a battle, an unknown sprite). */
  play(req: EvolutionRequest, cb: EvolutionCallbacks): Promise<void> | null {
    const d = this.d;
    if (!d.canPlay()) return null;
    const from = d.descriptor(req.fromSpecies, `evolve:${req.creatureId}:from`, req.variantKey, req.isAlpha);
    const to = d.descriptor(req.toSpecies, `evolve:${req.creatureId}:to`, req.variantKey, req.isAlpha);
    if (from === null || to === null) return null;
    // both forms' atlases are asked for before the sequence starts (render waits for the binds before the swap)
    const leases = [d.leaseSprites(req.fromSpecies, sideFor('evolution')), d.leaseSprites(req.toSpecies, sideFor('evolution'))];
    this.handle?.cancel();
    d.setInputEnabled(false);
    d.setHudVisible(false);
    const later = d.defer ?? ((f: () => void): void => void setTimeout(f, 0));
    const at = d.position();
    const handle = d.stage.evolve({
      from,
      to,
      at: { x: at.x, z: at.z },
      reduced: d.reduced(),
      cheer: d.selfId(),
      onPhase: (ph) => {
        if (ph === 'reveal') later(() => cb.reveal());
        else if (ph === 'exit') later(() => cb.leave());
      },
    });
    const feet = d.stage.evolution?.feet ?? at;
    this.faceX = feet.x;
    this.faceZ = feet.z;
    this.handle = handle;
    const onKey = (e: Event): void => {
      const k = e as KeyboardEvent;
      if (!EVOLUTION_SKIP_KEYS.has(k.code)) return;
      k.preventDefault();
      k.stopImmediatePropagation();
      if (!k.repeat) handle.skip();
    };
    const onPointer = (e: Event): void => {
      if ((e as PointerEvent).button === 0) handle.skip();
    };
    d.target.addEventListener('keydown', onKey, true);
    d.target.addEventListener('pointerdown', onPointer, true);
    return handle.done.then(() => {
      d.target.removeEventListener('keydown', onKey, true);
      d.target.removeEventListener('pointerdown', onPointer, true);
      for (const l of leases) l.release();
      if (this.handle !== handle) return;            // a newer sequence took over: it restores
      this.handle = null;
      d.setHudVisible(d.hudVisible());
      d.setInputEnabled(d.inputAfter());
    });
  }

  /** Ends a playing sequence at once (the world is disposed). */
  cancel(): void {
    this.handle?.cancel();
  }
}
