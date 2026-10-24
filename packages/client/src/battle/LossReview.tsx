/**
 * LLM feature 5: "Why did I lose?" on the result card of a lost battle. The button opens Prof. Wynn's breakdown: the
 * facts of the battle at once (battle/lossFacts.ts: the move that hurt most, the type matchups, the level gap, what to
 * bring), the professor's coaching over them when the model has it (state/professor.ts), and a "Bring next time" strip
 * with the types' icons and the creatures to bring (the player's own of those types, else wild ones nearby).
 */
import { noDashes } from '../talk/llm';
import { canReview, openLossReview, useLossReviewStore } from '../state/professor';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TypeBadge } from '../ui/TypeBadge';
import s from './LossReview.module.css';

export function LossReview() {
  const log = useLossReviewStore((st) => st.log);
  const review = useLossReviewStore((st) => st.review);
  if (review === null || review.battleId !== log?.battleId) {
    if (!canReview(log)) return null;
    return (
      <div className={s.ask}>
        <Button size="sm" icon="info" onClick={() => void openLossReview()}>
          Why did I lose?
        </Button>
      </div>
    );
  }
  const report = review.report;
  return (
    <section className={s.review} aria-label="Why you lost" aria-live="polite" aria-busy={review.pending || undefined} data-testid="loss-review">
      <p className={s.head}>
        <span className={s.tag}>Coach</span>
        <span className={s.who}>Prof. Wynn</span>
      </p>
      {review.text !== null ? (
        <p className={s.text} data-testid="loss-text">
          {noDashes(review.text)}
        </p>
      ) : (
        <ul className={s.lines} data-testid="loss-lines">
          {review.lines.map((l) => (
            <li key={l}>{noDashes(l)}</li>
          ))}
        </ul>
      )}
      {review.pending && <p className={s.thinking}>Thinking it over…</p>}
      {report !== null && report.bring.length > 0 && (
        <div className={s.bring} data-testid="loss-bring">
          <span className={s.label}>Bring next time</span>
          {report.bring.map((t) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
          {report.bringSpecies.map((id) => (
            <CreatureSprite key={id} speciesId={id} size="sm" />
          ))}
        </div>
      )}
    </section>
  );
}
