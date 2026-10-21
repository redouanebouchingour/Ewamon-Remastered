/**
 * The encounter transition (SPEC §20.5.7): a short wipe over the battle push-in that says what just started before any
 * text does. Wild: three slashes in the foe's type colour sweep the screen. Trainer / league / PvP: carbon shutters close
 * on a hot orange seam and open again (the VS card follows). Legendary / raid: the world closes to an iris ringed in
 * the type colour, slowly. Shiny: a gold flash and a scatter of sparkles. Reduced motion: a short dark dip, for every
 * kind. The white flash follows the "Screen flash" setting. Non-blocking (pointer-events none), decorative (aria-hidden):
 * the battle announces itself through the panel.
 */
import { useEffect } from 'react';
import { useUiStore } from '../state/ui';
import { useSettingsStore } from '../state/settings';
import { cx } from '../ui/cx';
import { ENCOUNTER_MS, ENCOUNTER_REDUCED_MS } from './encounter';
import s from './EncounterWipe.module.css';

const SPARKS = 12;

export function EncounterWipe() {
  const fx = useUiStore((st) => st.encounterFx);
  const flash = useSettingsStore((st) => st.accessibility.screenFlash);
  const reduced = fx?.reduced === true;
  useEffect(() => {
    if (fx === null) return;
    const ms = reduced ? ENCOUNTER_REDUCED_MS : ENCOUNTER_MS[fx.kind];
    const t = setTimeout(() => {
      const ui = useUiStore.getState();
      if (ui.encounterFx === fx) ui.setEncounterFx(null);
    }, ms);
    return () => clearTimeout(t);
  }, [fx, reduced]);
  if (fx === null) return null;
  if (reduced) return <div className={cx(s.layer, s.dip)} data-testid="encounterwipe" data-kind={fx.kind} data-reduced="true" aria-hidden="true" />;
  const iris = fx.kind === 'legendary' || fx.kind === 'raid';
  const shutters = fx.kind === 'trainer' || fx.kind === 'league' || fx.kind === 'pvp';
  return (
    <div className={cx(s.layer, s[fx.kind])} data-testid="encounterwipe" data-kind={fx.kind} data-type={fx.type} aria-hidden="true">
      {flash && <span className={s.flash} />}
      {fx.kind === 'wild' && (
        <>
          <span className={cx(s.slash, s.slash1)} />
          <span className={cx(s.slash, s.slash2)} />
          <span className={cx(s.slash, s.slash3)} />
        </>
      )}
      {fx.kind === 'shiny' && (
        <>
          <span className={cx(s.slash, s.slash1)} />
          <span className={cx(s.slash, s.slash2)} />
          <span className={s.sparks}>
            {Array.from({ length: SPARKS }, (_, i) => <span key={i} className={s.spark} />)}
          </span>
        </>
      )}
      {shutters && (
        <>
          <span className={cx(s.shutter, s.top)} />
          <span className={cx(s.shutter, s.bottom)} />
          <span className={s.seam} />
        </>
      )}
      {iris && (
        <>
          <span className={s.iris} />
          <span className={s.ring} />
        </>
      )}
    </div>
  );
}
