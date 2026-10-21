/**
 * Breeding: the hatch moment (`eggHatched`, queued in `useDaycareStore.hatches`). Over the world, never over a battle:
 * the egg rocks, cracks, a paper flash, then the hatchling's sprite and the broadcast line "<Species> hatched!" with
 * its parents, whether it is shiny or bandborn, and where it went. Click, Space or Enter skips to the reveal; on the
 * reveal they close it (Escape too). The world's sound plays the evolution start / done cues when a world is running.
 * Reduced motion keeps the stages as short still frames.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { displayName, speciesName } from '../data/content';
import { currentWorld } from '../scene/worldHost';
import { getEffectiveSettings } from '../state/applySettings';
import { useDaycareStore } from '../state/daycare';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Egg } from '../ui/Egg';
import { useFocusTrap } from '../ui/useFocusTrap';
import s from './HatchReveal.module.css';

export type HatchPhase = 'wobble' | 'crack' | 'reveal';

/** ms each phase lasts before the next (the reveal waits for the player) */
export const HATCH_TIMING: Readonly<Record<'wobble' | 'crack', number>> = { wobble: 1700, crack: 900 };

function cue(id: string): void {
  // the world's audio director, when a world is running (DOM tests and the login shell have none)
  const w = currentWorld() as { readonly audio?: { play(id: string, at: null): void } } | null;
  try {
    w?.audio?.play(id, null);
  } catch (_e) {
    // sound is never worth a broken reveal
  }
}

export function HatchReveal() {
  const hatch = useDaycareStore((st) => st.hatches[0] ?? null);
  const inBattle = useUiStore((st) => st.battle !== null);
  const [phase, setPhase] = useState<HatchPhase>('wobble');
  const ref = useRef<HTMLDivElement>(null);
  const open = hatch !== null && !inBattle;
  useFocusTrap(ref, open, { autoFocus: true });

  useEffect(() => {
    if (!open) return;
    setPhase('wobble');
    cue('ui_evolve_start');
    const k = getEffectiveSettings().reduced ? 0.35 : 1;
    const t1 = setTimeout(() => setPhase('crack'), HATCH_TIMING.wobble * k);
    const t2 = setTimeout(() => setPhase('reveal'), (HATCH_TIMING.wobble + HATCH_TIMING.crack) * k);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, hatch?.eggId]);

  useEffect(() => {
    if (open && phase === 'reveal') cue('ui_evolve_done');
  }, [open, phase]);

  if (!open) return null;
  const c = hatch.creature;
  const name = speciesName(c.speciesId);
  const done = (): void => useDaycareStore.getState().shiftHatch();
  const advance = (): void => {
    if (phase === 'reveal') done();
    else setPhase('reveal');
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      if (e.key === 'Escape' && phase === 'reveal') done();
      else advance();
    }
  };

  return (
    <div
      ref={ref}
      className={s.layer}
      role="dialog"
      aria-modal="true"
      aria-label="An egg is hatching"
      data-testid="hatch-reveal"
      data-phase={phase}
      tabIndex={-1}
      onKeyDown={onKey}
      onClick={phase === 'reveal' ? undefined : advance}
    >
      <div className={s.stage} aria-hidden>
        <span className={s.rays} />
        {phase === 'reveal' ? (
          <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="xl" className={s.sprite} />
        ) : (
          <Egg size="xl" bandborn={c.bandborn === true} stage={phase === 'crack' ? 'crack' : 'wobble'} />
        )}
        {phase === 'reveal' && <span className={s.flash} />}
      </div>
      <div className={s.banner} role="status" aria-live="polite">
        {phase === 'reveal' ? (
          <>
            <span className={s.eyebrow}>Hatched</span>
            <p className={s.line}>
              <strong className={s.species}>{name}</strong> hatched!
            </p>
            <p className={s.detail}>
              From {hatch.parents[0]} and {hatch.parents[1]}
              {c.isShiny === true && <span className={s.tag}>Shiny</span>}
              {c.bandborn === true && <span className={s.bandborn}>Bandborn</span>}
            </p>
            <p className={s.where}>
              {displayName(c)} {hatch.placement === 'party' ? 'joined your party' : 'went to your box (your party is full)'}.
            </p>
            <Button variant="primary" onClick={done}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <span className={s.eyebrow}>Egg</span>
            <p className={s.line}>{phase === 'wobble' ? 'Your egg is moving' : 'It is hatching'}</p>
            <p className={s.hint}>
              <kbd>Space</kbd> or click to skip
            </p>
          </>
        )}
      </div>
    </div>
  );
}
