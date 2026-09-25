/**
 * SPEC §20.5.6 — BattleResultCard (DOM modal): the outcome and `RewardsSummary` of `battleEnd`, for DISPLAY only —
 * the money / items / exp / badge already reached the session through the server's inventoryDelta /
 * progressionDelta. "Continue" → director.exitBattle, ui.battle = null, then the queued evolve / learn-move prompts.
 */
import { itemInfo } from '../data/content';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { battleActions } from './controllerRef';
import s from './BattleResultCard.module.css';

export function BattleResultCard() {
  const result = useUiStore((st) => st.battle?.result ?? null);
  const seat = useUiStore((st) => st.battle?.seat ?? 0);
  if (result === null) return null;
  const o = result.outcome;
  const title =
    o.winner === 'caught' ? 'Caught!' : o.winner === 'fled' ? 'Got away safely' : o.winner === 'draw' ? 'A draw' : o.winner === seat ? 'Victory' : 'Defeat';
  const r = result.rewards;
  const items = Object.entries(r.items).filter(([, n]) => n > 0);
  const lines: string[] = [];
  if (r.money > 0) lines.push(`+${r.money.toLocaleString()} money`);
  if (r.trainerExp > 0) lines.push(`+${r.trainerExp} trainer EXP`);
  if (r.ratingDelta !== null && r.ratingDelta !== 0) lines.push(`${r.ratingDelta > 0 ? '+' : ''}${r.ratingDelta} rating`);
  for (const [id, n] of items) lines.push(`${itemInfo(id).name} ×${n}`);
  const done = (): void => battleActions()?.dismissResult();
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
        {r.badge !== null && <p className={s.badge}>Badge earned</p>}
        {lines.length > 0 ? (
          <ul className={s.rewards}>
            {lines.map((l) => (
              <li key={l} className={s.reward}>
                {l}
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
