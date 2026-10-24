/**
 * LLM feature 3, Broadcast UI: the commentator's caption and the opposing trainer's line over the battle.
 *
 * - The caption is a lower third bottom right, above the command deck and clear of the HP plates (they ride over the
 *   battlers): a paper LIVE tag and the headline (the facts) in the big italic display face on a carbon slab, the
 *   colour line on a strip under it. It holds CASTER_MS, then slides out.
 * - The trainer speaks top right, on its side of the field: its name on a paper slab, the line on carbon. It holds
 *   TRAINER_MS, and stands aside while a league trainer's own banner (BattleBanner) is up.
 * - The closing lines (the win, the loss, a catch) go on the result card (`ResultCommentary`): the caption would sit
 *   under its scrim.
 *
 * Words only (battle/commentator.ts writes the store): pointer-events none, never over the deck. Under reduced motion
 * the --motion-* tokens are 0 ms, so the lines appear and go without sliding. Every text goes through `noDashes`.
 */
import { useEffect, useState } from 'react';
import { dropCaster, dropTrainer, useCommentaryStore } from '../state/commentary';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';
import { noDashes } from '../talk/llm';
import { cx } from '../ui/cx';
import s from './BattleCommentary.module.css';

export const CASTER_MS = 5200;
export const TRAINER_MS = 4200;
/** the last part of a line's time is its exit */
export const LINE_OUT_MS = 260;

/** Clears line `id` after `ms` (its exit starts LINE_OUT_MS before); returns whether it is leaving. */
function useLineTimer(id: number | null, ms: number, drop: (id: number) => void): boolean {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    if (id === null) return;
    const out = setTimeout(() => setLeaving(true), ms - LINE_OUT_MS);
    const done = setTimeout(() => drop(id), ms);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, [id, ms, drop]);
  return leaving;
}

export function BattleCommentary() {
  const caster = useCommentaryStore((st) => st.caster);
  const trainer = useCommentaryStore((st) => st.trainer);
  const battleId = useUiStore((st) => st.battle?.battleId ?? null);
  const ended = useUiStore((st) => st.battle?.result != null);
  const banner = useUiStore((st) => st.battleBanner !== null);
  const casterOn = useSettingsStore((st) => st.accessibility.battleCommentary);
  const trainerOn = useSettingsStore((st) => st.accessibility.trainerBanter);
  const casterLeaving = useLineTimer(caster?.id ?? null, CASTER_MS, dropCaster);
  const trainerLeaving = useLineTimer(trainer?.id ?? null, TRAINER_MS, dropTrainer);
  const showCaster = casterOn && caster !== null && caster.battleId === battleId && !ended;
  const showTrainer = trainerOn && trainer !== null && trainer.battleId === battleId && !ended && !banner;
  return (
    <>
      {showCaster && (
        <div className={s.casterLayer} role="status" aria-live="polite">
          <div key={caster.id} className={cx(s.caption, casterLeaving && s.leaving)} data-testid="battle-commentary" data-kind={caster.kind} data-side={caster.side}>
            <p className={s.headRow}>
              <span className={s.live} aria-hidden>
                Live
              </span>
              <span className={s.head}>{noDashes(caster.head)}</span>
            </p>
            <p className={s.colour}>{noDashes(caster.text)}</p>
          </div>
        </div>
      )}
      {showTrainer && (
        <div className={s.trainerLayer} role="status" aria-live="polite">
          <p key={trainer.id} className={cx(s.speech, trainerLeaving && s.leaving)} data-testid="battle-banter" data-kind={trainer.kind}>
            <span className={s.speaker}>{trainer.speaker}</span>
            <span className={s.quote}>“{noDashes(trainer.text)}”</span>
          </p>
        </div>
      )}
    </>
  );
}

/**
 * The closing lines on the result card: the commentator's call of the win, the loss or the catch, and the trainer's
 * last word when no concession line (authored) is shown.
 */
export function ResultCommentary({ concession }: { readonly concession: boolean }) {
  const caster = useCommentaryStore((st) => st.finalCaster);
  const trainer = useCommentaryStore((st) => st.finalTrainer);
  const battleId = useUiStore((st) => st.battle?.battleId ?? null);
  const casterOn = useSettingsStore((st) => st.accessibility.battleCommentary);
  const trainerOn = useSettingsStore((st) => st.accessibility.trainerBanter);
  const c = casterOn && caster !== null && caster.battleId === battleId ? caster : null;
  const t = trainerOn && !concession && trainer !== null && trainer.battleId === battleId ? trainer : null;
  if (c === null && t === null) return null;
  return (
    <>
      {c !== null && (
        <p className={s.resultCaster} data-testid="battleresult-commentary">
          <span className={s.live}>Live</span>
          <span className={s.resultHead}>{noDashes(c.head)}</span>
          <span className={s.resultText}>{noDashes(c.text)}</span>
        </p>
      )}
      {t !== null && (
        <figure className={s.resultTrainer} data-testid="battleresult-banter">
          <blockquote className={s.resultQuote}>“{noDashes(t.text)}”</blockquote>
          <figcaption className={s.resultSpeaker}>{t.speaker}</figcaption>
        </figure>
      )}
    </>
  );
}
