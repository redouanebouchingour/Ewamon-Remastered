/**
 * §20.5.8 the hit callout: a Broadcast lower-third over the arena when a hit lands in a way worth naming, on the side
 * of the battler it hit (high right for the opponent, low left for the viewer's own). The matchup is a slab in the
 * move's type colour ("SUPER EFFECTIVE", "NOT VERY EFFECTIVE", "NO EFFECT"), a crit a paper chip ("CRITICAL HIT")
 * beside it. It holds for CALLOUT_MS (a new hit replaces it); under reduced motion it appears and fades without the
 * slide. Decorative (the battle log carries the same words): aria-hidden, pointer-events none.
 */
import { useEffect } from 'react';
import { useUiStore } from '../state/ui';
import { cx } from '../ui/cx';
import type { CalloutKind } from './timeline';
import s from './BattleCallout.module.css';

export const CALLOUT_MS = 1100;

const WORDS: Readonly<Record<CalloutKind, string>> = {
  super: 'Super effective',
  resist: 'Not very effective',
  immune: 'No effect',
  crit: 'Critical hit',
};

export function BattleCallout() {
  const c = useUiStore((st) => st.battleCallout);
  useEffect(() => {
    if (c === null) return;
    const t = setTimeout(() => {
      const ui = useUiStore.getState();
      if (ui.battleCallout === c) ui.setBattleCallout(null);
    }, CALLOUT_MS);
    return () => clearTimeout(t);
  }, [c]);
  if (c === null) return null;
  const matchup = c.kinds.find((k) => k !== 'crit') ?? null;
  const crit = c.kinds.includes('crit');
  return (
    <div className={cx(s.layer, c.foe ? s.foe : s.own, c.reduced && s.reduced)} aria-hidden="true">
      <div key={c.id} className={s.callout} data-testid="battlecallout" data-kinds={c.kinds.join(' ')} data-type={c.type}>
        {matchup !== null && <span className={cx(s.matchup, s[matchup])}>{WORDS[matchup]}</span>}
        {crit && <span className={s.crit}>{WORDS.crit}</span>}
      </div>
    </div>
  );
}
