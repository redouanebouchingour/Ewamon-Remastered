/**
 * Nemeses: the ambush's taunt as a broadcast lower third over the battle (bottom left, above the command deck): the
 * hot slab naming it a nemesis and its rank, the scar on a paper strip, the name and title in the display face beside
 * its sprite in its type colour, and the line about the last fight. It waits out the encounter wipe, holds TAUNT_MS,
 * then leaves. Non-blocking (pointer-events none); announced once as a status.
 */
import { useEffect, useState } from 'react';
import { NEMESIS_SCAR_TEXT } from '@ewa/content';
import { primaryType } from '../data/content';
import { useNemesisStore } from '../state/nemesis';
import { useUiStore } from '../state/ui';
import { CreatureSprite } from '../ui/CreatureSprite';
import { cx } from '../ui/cx';
import s from './NemesisTaunt.module.css';

/** After the encounter wipe (wild: 760 ms) the lower third holds this long, the last part its exit. */
export const TAUNT_DELAY_MS = 700;
export const TAUNT_MS = 6500;
export const TAUNT_OUT_MS = 300;

export function NemesisTaunt() {
  const ambush = useNemesisStore((st) => st.ambush);
  const battleId = useUiStore((st) => st.battle?.battleId ?? null);
  const [leaving, setLeaving] = useState(false);
  const live = ambush !== null && ambush.battleId === battleId;
  useEffect(() => {
    if (ambush === null) return;
    // the battle it opened is gone (or another started): drop it
    if (battleId !== null && ambush.battleId !== battleId) {
      useNemesisStore.getState().setAmbush(null);
      return;
    }
    if (battleId === null) return;
    setLeaving(false);
    const out = setTimeout(() => setLeaving(true), TAUNT_DELAY_MS + TAUNT_MS - TAUNT_OUT_MS);
    const done = setTimeout(() => {
      if (useNemesisStore.getState().ambush === ambush) useNemesisStore.getState().setAmbush(null);
    }, TAUNT_DELAY_MS + TAUNT_MS);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, [ambush, battleId]);
  if (!live) return null;
  const scar = NEMESIS_SCAR_TEXT[ambush.scar];
  return (
    <div className={s.layer} role="status" aria-label={`Nemesis: ${ambush.name} ${ambush.title}, rank ${ambush.rank}. ${ambush.taunt}`}>
      <div className={cx(s.third, leaving && s.leaving)} data-testid="nemesis-taunt">
        <p className={s.tags} aria-hidden>
          <span className={s.tag}>Nemesis</span>
          <span className={s.rank}>Rank {ambush.rank}</span>
          <span className={s.scar}>{scar.label}</span>
        </p>
        <div className={s.plate} data-type={primaryType(ambush.speciesId)} aria-hidden>
          <span className={s.slab}>
            <CreatureSprite speciesId={ambush.speciesId} size="md" />
          </span>
          <span className={s.who}>
            <span className={s.name}>{ambush.name}</span>
            <span className={s.title}>{ambush.title}</span>
          </span>
        </div>
        <p className={s.taunt} aria-hidden>
          {ambush.taunt}
        </p>
      </div>
    </div>
  );
}
