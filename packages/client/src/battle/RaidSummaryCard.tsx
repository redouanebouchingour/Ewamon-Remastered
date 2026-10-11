/**
 * Phase C1 — the raid summary card (BattleOverlay; BattleController writes `BattleResult.raid`): how the raid went for
 * this player (cleared / caught / party out / left / over), their damage and place, the damage board, and the
 * rewards of `battleEnd { battleId: raidId }` — for DISPLAY only, the money and trainer EXP already reached the session
 * through the server's inventoryDelta / progressionDelta. "Back to the world" closes the battle (then any evolve /
 * learn-move prompts the raid queued), like the result card.
 * Broadcast UI (2026-10-11): damage and place as big numbers under label strips, the board in display figures.
 */
import { speciesName } from '../data/content';
import { useUiStore } from '../state/ui';
import type { RaidSummary } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { cx } from '../ui/cx';
import { battleActions } from './controllerRef';
import s from './RaidSummaryCard.module.css';

export function raidSummaryTitle(r: RaidSummary): string {
  if (r.caught === true) return 'Caught!';
  if (r.cleared) return 'Raid cleared';
  if (r.left) return 'You left the raid';
  if (r.fainted) return 'Your party is out';
  return 'The raid is over';
}

function catchLine(r: RaidSummary, boss: string): string | null {
  if (!r.cleared) return r.fainted ? 'The fight goes on without you — if the boss falls and you dealt damage, you still get a catch try.' : null;
  if (r.caught === true) return `${boss} joins your party — or your box when the party is full.`;
  if (r.caught === false) return `${boss} broke free.`;
  return r.damage > 0 ? 'No orb thrown this time.' : 'Only trainers who dealt damage get a catch try.';
}

export function RaidSummaryCard() {
  const result = useUiStore((st) => (st.battle?.format === 'raid' ? (st.battle.result ?? null) : null));
  const r = result?.raid;
  if (result === null || r === undefined) return null;
  const boss = speciesName(r.bossSpecies);
  const rewards: { readonly value: string; readonly label: string }[] = [];
  if (result.rewards.money > 0) rewards.push({ value: `+${result.rewards.money.toLocaleString()}`, label: 'money' });
  if (result.rewards.trainerExp > 0) rewards.push({ value: `+${result.rewards.trainerExp}`, label: 'trainer EXP' });
  const done = (): void => battleActions()?.dismissResult();
  const line = catchLine(r, boss);
  return (
    <Modal
      open
      title={raidSummaryTitle(r)}
      size="sm"
      onClose={done}
      description={`${boss} · Lv ${r.bossLevel}`}
      footer={
        <Button variant="primary" onClick={done}>
          {result.prompts > 0 ? 'Continue' : 'Back to the world'}
        </Button>
      }
    >
      <div className={s.body} data-testid="raidsummary" data-cleared={r.cleared || undefined}>
        <dl className={s.stats}>
          <div className={s.stat}>
            <dt className={s.label}>Your damage</dt>
            <dd className={s.value}>{r.damage.toLocaleString()}</dd>
          </div>
          <div className={s.stat}>
            <dt className={s.label}>Place</dt>
            <dd className={s.value}>{r.rank === null ? '—' : `${r.rank} of ${r.board.length}`}</dd>
          </div>
        </dl>
        {line !== null && <p className={s.line}>{line}</p>}
        {r.board.length > 0 && (
          <ol className={s.board} aria-label="Damage board">
            {r.board.map((row, i) => (
              <li key={row.playerId} className={cx(s.row, row.self && s.self)}>
                <span className={s.rank}>{i + 1}</span>
                <span className={s.name}>{row.self ? `${row.name} (you)` : row.name}</span>
                <span className={s.damage}>{row.damage.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
        {rewards.length > 0 ? (
          <ul className={s.rewards} data-testid="raidsummary-rewards">
            {rewards.map((l) => (
              <li key={l.label} className={s.reward}>
                <span className={s.rewardValue}>{l.value}</span> <span className={s.label}>{l.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.none}>{r.cleared && r.damage > 0 ? 'Rewards are on their way.' : 'No rewards this time.'}</p>
        )}
      </div>
    </Modal>
  );
}
