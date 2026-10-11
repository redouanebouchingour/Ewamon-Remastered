/**
 * SPEC §20.5.6 — BattleResultCard (DOM modal): the outcome and `RewardsSummary` of `battleEnd`, for DISPLAY only —
 * the money / items / exp / badge already reached the session through the server's inventoryDelta /
 * progressionDelta. "Continue" → director.exitBattle, ui.battle = null, then the queued evolve / learn-move prompts.
 * Phase B7: a won badge shows its glyph, name and type colour (`badgeIcon.ts`); a won league battle shows the
 * trainer's concession line (`concessionLine`: a gym leader's post[1], a Warden's / the Champion's post[0]).
 * Broadcast UI (2026-10-11): the badge is a type-colour slab with a label strip, each reward a big number over its label.
 */
import { badgeDisplay } from '../data/badgeIcon';
import { itemInfo } from '../data/content';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { battleActions } from './controllerRef';
import { concessionLine, foeOfState } from './foe';
import { rematchOfBattle } from '../scene/dialogue';
import s from './BattleResultCard.module.css';

export function BattleResultCard() {
  const result = useUiStore((st) => st.battle?.result ?? null);
  const seat = useUiStore((st) => st.battle?.seat ?? 0);
  const format = useUiStore((st) => st.battle?.format ?? null);
  const state = useUiStore((st) => st.battle?.authoritative ?? null);
  // Phase C1: a raid closes with its own summary card (RaidSummaryCard)
  if (result === null || result.raid !== undefined) return null;
  const o = result.outcome;
  const title =
    o.winner === 'caught' ? 'Caught!' : o.winner === 'fled' ? 'Got away safely' : o.winner === 'draw' ? 'A draw' : o.winner === seat ? 'Victory' : 'Defeat';
  const r = result.rewards;
  const items = Object.entries(r.items).filter(([, n]) => n > 0);
  // Broadcast UI: each reward is a big number over its label ("+800 money" reads the same to assistive tech)
  const lines: { readonly value: string; readonly label: string }[] = [];
  if (r.money > 0) lines.push({ value: `+${r.money.toLocaleString()}`, label: 'money' });
  if (r.trainerExp > 0) lines.push({ value: `+${r.trainerExp}`, label: 'trainer EXP' });
  if (r.ratingDelta !== null && r.ratingDelta !== 0) lines.push({ value: `${r.ratingDelta > 0 ? '+' : ''}${r.ratingDelta}`, label: 'rating' });
  for (const [id, n] of items) lines.push({ value: `×${n}`, label: itemInfo(id).name });
  const done = (): void => battleActions()?.dismissResult();
  const badge = r.badge === null ? null : badgeDisplay(r.badge);
  const won = o.winner === seat;
  const foe = won && format === 'league' && state !== null ? foeOfState(state, seat) : null;
  // Phase D14: a won rematch concedes with its own line (the first fight's names the badge)
  const rematch = foe !== null && state !== null ? rematchOfBattle(state, seat) : null;
  const concession = foe === null ? null : rematch !== null ? (rematch.post[0] ?? null) : concessionLine(foe.league);
  return (
    <Modal
      open
      title={title}
      size="sm"
      onClose={done}
      description={o.winner === 'caught' ? 'It joins your party — or your box when the party is full.' : undefined}
      footer={
        <Button variant="primary" onClick={done}>
          {result.prompts > 0 ? 'Continue' : 'Back to the world'}
        </Button>
      }
    >
      <div className={s.body} data-testid="battleresult">
        {badge !== null ? (
          <div className={s.badgeRow} data-testid="battleresult-badge" data-type={badge.type}>
            <span className={s.badgeIcon} aria-hidden>
              {badge.glyph}
            </span>
            <span className={s.badgeText}>
              <span className={s.badgeLabel}>Badge earned</span>
              <span className={s.badge}>{badge.name}</span>
            </span>
          </div>
        ) : (
          r.badge !== null && <p className={s.badge}>Badge earned</p>
        )}
        {foe !== null && concession !== null && (
          <figure className={s.concession} data-testid="battleresult-concession">
            <blockquote className={s.quote}>“{concession}”</blockquote>
            <figcaption className={s.speaker}>{foe.name}</figcaption>
          </figure>
        )}
        {lines.length > 0 ? (
          <ul className={s.rewards}>
            {lines.map((l) => (
              <li key={l.label} className={s.reward}>
                <span className={s.value}>{l.value}</span> <span className={s.label}>{l.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.none}>No rewards this time.</p>
        )}
      </div>
    </Modal>
  );
}
