/**
 * SPEC §20.5.6 (amended 2026-10-05) — the evolution sequence, every evolve path's one entry point.
 *
 * Server truth first: `evolveCreature` sends `POST /creature/:id/evolve { into }`, writes the returned creature
 * through the one inventory writer, and only then plays the sequence with the response's species — a failed call
 * throws (the caller toasts) and plays nothing, so the game never shows an evolution that did not happen. The
 * post-battle evolve prompt, the Party screen's Rare Candy (its `evolveReady` event queues the same prompt) and any
 * later path (stones, trades) call it.
 *
 * World3D registers the `EvolutionPlayer` (render's `stage.evolve` + the input lock); this module never imports scene
 * code, so the DOM side (PostBattlePrompts, tests) stays free of three. Without a player (no world, no zone loaded)
 * the DOM banner alone tells the player. `ui.evolution` is set for the whole sequence (the banner, the hidden panel,
 * the shell's hotkeys and the queued prompts read it) and cleared when it ends.
 */
import type { CreatureInstance, VariantKey } from '@ewa/core';
import { displayName, speciesName } from '../data/content';
import { apiFetch } from '../net/api';
import { applyInventoryDelta, toInventoryDelta } from '../state/session';
import { useUiStore } from '../state/ui';

/** What the world needs to stage one evolution (the server-confirmed species). */
export interface EvolutionRequest {
  readonly creatureId: string;
  /** the display name before the evolution (nickname or the old species' name) */
  readonly name: string;
  readonly fromSpecies: string;
  readonly toSpecies: string;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
}

/** Phase notifications the player sends back (always off the 60 Hz tick: the world defers them). */
export interface EvolutionCallbacks {
  /** the light burst: the new form is on screen (the banner shows) */
  reveal(): void;
  /** the camera starts to pull back (the banner fades) */
  leave(): void;
}

export interface EvolutionPlayer {
  /** Plays the sequence; resolves when it ended (played, skipped or cancelled). null = cannot play here (no zone, a battle). */
  play(req: EvolutionRequest, cb: EvolutionCallbacks): Promise<void> | null;
  /** Binds the species' sprite atlas ahead of the sequence (the evolve prompt calls it when it opens). */
  preload(speciesId: string): void;
}

/** Banner-only fallback (no world): how long the "evolved into" banner stays (ms). */
export const BANNER_ONLY_MS = 2600;

let player: EvolutionPlayer | null = null;
let seq = 0;

/** World3D registers itself (null on dispose). */
export function setEvolutionPlayer(p: EvolutionPlayer | null): void {
  player = p;
}

/** Starts binding a species' atlas (the evolve prompt opened: the sequence must not wait for it later). */
export function preloadEvolution(speciesId: string): void {
  try {
    player?.preload(speciesId);
  } catch (_e) {
    // the sequence binds it again at its start
  }
}

function patch(id: number, phase: 'revealed' | 'leaving'): void {
  const ui = useUiStore.getState();
  const e = ui.evolution;
  if (e === null || e.id !== id || e.phase === phase || (phase === 'revealed' && e.phase === 'leaving')) return;
  ui.setEvolution({ ...e, phase });
}

/**
 * Plays the sequence for an evolution the server has ALREADY confirmed. Resolves when it ended; `ui.evolution` is
 * set meanwhile. A second call while one plays waits for the first.
 */
export async function playEvolution(req: EvolutionRequest): Promise<void> {
  while (useUiStore.getState().evolution !== null) {
    await new Promise<void>((resolve) => {
      const off = useUiStore.subscribe(
        (s) => s.evolution,
        (e) => {
          if (e !== null) return;
          off();
          resolve();
        },
      );
    });
  }
  const id = ++seq;
  useUiStore.getState().setEvolution({ id, creatureId: req.creatureId, name: req.name, species: speciesName(req.toSpecies), phase: 'playing' });
  let run: Promise<void> | null = null;
  try {
    run = player?.play(req, { reveal: () => patch(id, 'revealed'), leave: () => patch(id, 'leaving') }) ?? null;
  } catch (e) {
    console.warn('evolution sequence failed to start', e);
    run = null;
  }
  if (run === null) {
    patch(id, 'revealed');
    await new Promise<void>((resolve) => setTimeout(resolve, BANNER_ONLY_MS));
  } else {
    await run.catch((e: unknown) => console.warn('evolution sequence', e));
  }
  if (useUiStore.getState().evolution?.id === id) useUiStore.getState().setEvolution(null);
}

/**
 * The evolve action: REST first (throws `ApiFailure` / a network error — nothing plays), then the inventory writer,
 * then the sequence (not awaited: the caller's modal closes while it plays). Resolves with the evolved creature.
 */
export async function evolveCreature(c: CreatureInstance, into: string): Promise<CreatureInstance> {
  const { inventoryDelta, ...res } = await apiFetch('creatureEvolve', { params: { id: c.id }, body: { into } });
  // a stone evolution answers the spent stone's count as an inventoryDelta body (Phase D3)
  if (inventoryDelta !== undefined) applyInventoryDelta({ type: 'inventoryDelta', ...inventoryDelta });
  applyInventoryDelta(toInventoryDelta({ creaturesUpdated: [res] }));
  void playEvolution({
    creatureId: c.id,
    name: displayName(c),
    fromSpecies: c.speciesId,
    toSpecies: res.speciesId,
    variantKey: res.variantKey,
    isAlpha: res.isAlpha,
  });
  return res;
}
