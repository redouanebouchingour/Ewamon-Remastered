/**
 * Phase B7 — the VS intro card over the battle push-in of a trainer / league battle: the opponent's name, a league
 * trainer's title, their type colour and a type emblem (the 3D looks have no DOM thumbnail; a monogram on the type
 * colour stands in, with the TypeBadge so colour is never the only signal). BattleController writes `ui.battleIntro`
 * only for a fresh trainer / league battle and never under reduced motion; the card clears it after INTRO_MS.
 * Non-blocking (pointer-events none); announced once as a status.
 */
import { useEffect, useState } from 'react';
import { useUiStore } from '../state/ui';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import s from './BattleIntroCard.module.css';

/** On screen for this long (the 600 ms push-in plus the lead switch-ins). */
export const INTRO_MS = 1800;
/** The last part of it plays the exit (--motion-slow). */
export const INTRO_OUT_MS = 240;

export function BattleIntroCard() {
  const intro = useUiStore((st) => st.battleIntro);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (intro === null) return;
    setLeaving(false);
    const out = setTimeout(() => setLeaving(true), INTRO_MS - INTRO_OUT_MS);
    const done = setTimeout(() => {
      const ui = useUiStore.getState();
      if (ui.battleIntro === intro) ui.setBattleIntro(null);
    }, INTRO_MS);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, [intro]);
  if (intro === null) return null;
  const initial = intro.name.replace(/^(Warden|Champion|Captain|Marshal)\s+/, '').slice(0, 1).toUpperCase();
  return (
    <div className={s.layer} role="status" aria-label={`Battle against ${intro.name}${intro.title !== null ? `, ${intro.title}` : ''}`}>
      <div className={cx(s.card, leaving && s.leaving)} data-testid="battleintro" data-type={intro.type ?? undefined} data-league={intro.league || undefined}>
        <span className={s.vs}>VS</span>
        <span className={s.emblem}>{initial}</span>
        <span className={s.text}>
          {intro.title !== null && <span className={s.title}>{intro.title}</span>}
          <span className={s.name}>{intro.name}</span>
        </span>
        {intro.type !== null && <TypeBadge type={intro.type} size="sm" className={s.type} />}
      </div>
    </div>
  );
}
