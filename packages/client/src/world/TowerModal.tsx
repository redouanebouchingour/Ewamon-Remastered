/**
 * Phase D14 — the battle tower (`ui.modal === 'tower'`, opened from the Tower Attendant in Solenne's league hall foyer
 * once the Champion has fallen, and by the message router on every `towerState` that is not a fight starting).
 *
 *   no run (`ui.tower === null`): pick three party creatures (CreatureCard rows, a fourth click is ignored) →
 *     `tower { action: 'start', picks }`; the server answers with the first fight (`towerState fighting`)
 *   `won`: the streak and the fight just cleared, the set reward when one was paid → Next fight (`tower next`) / Retire
 *     (`tower quit`)
 *   `lost` / `ended`: the run's summary (wins, best streak) → Close clears `ui.tower`
 *
 * The modal renders only while no battle is open, so a result arriving under the battle's result card waits for it.
 * `TowerStreak` is the counter over a tower fight (set · fight n of 7 · streak).
 */
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TOWER } from '@ewa/content';
import { itemInfo } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import type { TowerUi } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { Modal } from '../ui/Modal';
import m from './WorldModals.module.css';
import s from './TowerModal.module.css';

const NONE: readonly string[] = [];

/** The picker's toggle: add up to `TOWER.teamSize` ids in click order, a second click removes one. */
export function togglePick(cur: readonly string[], id: string): readonly string[] {
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  return cur.length >= TOWER.teamSize ? cur : [...cur, id];
}

/** "Set 2 · fight 3 of 7" for the fight a `towerState` names. */
export function towerFightLabel(t: Pick<TowerUi, 'set' | 'fight'>): string {
  return `Set ${t.set} · fight ${t.fight} of ${TOWER.setLength}`;
}

/** The set reward as one line ("2,500 money, Rare Candy ×1"), or null. */
export function towerRewardLine(reward: TowerUi['reward']): string | null {
  if (reward === null) return null;
  const parts = [`${reward.money.toLocaleString()} money`];
  for (const [id, n] of Object.entries(reward.items)) if (n > 0) parts.push(`${itemInfo(id).name} ×${n}`);
  return parts.join(', ');
}

export function TowerModal() {
  const open = useUiStore((st) => st.modal === 'tower' && st.battle === null);
  const tower = useUiStore((st) => st.tower);
  const party = useSessionStore(useShallow((st) => st.inventory?.party ?? []));
  const [picked, setPicked] = useState<readonly string[]>(NONE);
  if (!open) return null;
  const ws = getWorldSession();
  const ui = useUiStore.getState();
  const close = (): void => {
    if (tower !== null && (tower.phase === 'lost' || tower.phase === 'ended')) ui.setTower(null);
    ui.closeModal();
    setPicked(NONE);
  };

  if (tower === null) {
    const ready = picked.length === TOWER.teamSize;
    return (
      <Modal
        open
        size="md"
        title="Battle tower"
        description={`Choose ${TOWER.teamSize} creatures. Every creature fights at level ${TOWER.levelCap}, healed before each fight; ${TOWER.setLength} wins complete a set. One loss ends the run.`}
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Not now
            </Button>
            <Button
              variant="primary"
              disabled={!ready}
              onClick={() => {
                ws.send('tower', { action: 'start', picks: [...picked] });
                setPicked(NONE);
              }}
            >
              {ready ? 'Start run' : `Pick ${TOWER.teamSize - picked.length} more`}
            </Button>
          </>
        }
      >
        <div className={m.stack} data-testid="towermodal" data-state="pick">
          <p className={m.caption} aria-live="polite">
            {picked.length} of {TOWER.teamSize} chosen
          </p>
          <div className={m.pick} role="list" aria-label="Your party">
            {party.map((c) => (
              <div key={c.id} role="listitem" className={s.option}>
                <CreatureCard creature={c} variant="row" selected={picked.includes(c.id)} onClick={() => setPicked((cur) => togglePick(cur, c.id))} />
                {picked.includes(c.id) && <span className={s.order}>{picked.indexOf(c.id) + 1}</span>}
              </div>
            ))}
          </div>
          {party.length < TOWER.teamSize && <p className={m.caption}>You need at least {TOWER.teamSize} creatures in your party.</p>}
        </div>
      </Modal>
    );
  }

  const chosen = tower.picks.map((id) => party.find((c) => c.id === id)).filter((c) => c !== undefined);
  const reward = towerRewardLine(tower.reward);
  if (tower.phase === 'won' || tower.phase === 'fighting') {
    const fighting = tower.phase === 'fighting';
    return (
      <Modal
        open
        size="md"
        title={fighting ? 'Tower fight' : `${tower.streak} ${tower.streak === 1 ? 'win' : 'wins'} in a row`}
        onClose={() => ui.closeModal()}
        footer={
          fighting ? (
            <Button variant="ghost" onClick={() => ui.closeModal()}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => ws.send('tower', { action: 'quit' })}>
                Retire
              </Button>
              <Button variant="primary" onClick={() => ws.send('tower', { action: 'next' })}>
                Next fight
              </Button>
            </>
          )
        }
      >
        <div className={m.stack} data-testid="towermodal" data-state={tower.phase}>
          <p className={m.text}>{fighting ? `${towerFightLabel(tower)} is under way.` : `${towerFightLabel(tower)} cleared. Your team is healed for the next one.`}</p>
          {reward !== null && (
            <p className={s.reward}>
              <span className={s.rewardLabel}>Set {tower.set} complete</span>
              <span className={s.rewardText}>{reward}</span>
            </p>
          )}
          <dl className={s.stats}>
            <div className={s.stat}>
              <dt className={s.statLabel}>Streak</dt>
              <dd className={s.value}>{tower.streak}</dd>
            </div>
            <div className={s.stat}>
              <dt className={s.statLabel}>Best</dt>
              <dd className={s.value}>{tower.best}</dd>
            </div>
          </dl>
          {chosen.length > 0 && (
            <div className={m.pick} role="list" aria-label="Your tower team">
              {chosen.map((c) => (
                <div key={c.id} role="listitem">
                  <CreatureCard creature={c} variant="row" />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const lost = tower.phase === 'lost';
  return (
    <Modal
      open
      size="sm"
      title={lost ? 'Run over' : 'Retired'}
      onClose={close}
      footer={
        <Button variant="primary" onClick={close}>
          Close
        </Button>
      }
    >
      <div className={m.stack} data-testid="towermodal" data-state={tower.phase}>
        <p className={m.text}>
          {lost ? `Beaten in ${towerFightLabel(tower).toLowerCase()}.` : 'You left the tower.'} This run: {tower.runWins} {tower.runWins === 1 ? 'win' : 'wins'}.
        </p>
        <dl className={s.stats}>
          <div className={s.stat}>
            <dt className={s.statLabel}>Run</dt>
            <dd className={s.value}>{tower.runWins}</dd>
          </div>
          <div className={s.stat}>
            <dt className={s.statLabel}>Best</dt>
            <dd className={s.value}>{tower.best}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

/** The counter over a tower fight: set, fight n of 7, the streak so far. */
export function TowerStreak() {
  const t = useUiStore((st) => (st.tower !== null && st.tower.phase === 'fighting' && st.battle !== null ? st.tower : null));
  if (t === null) return null;
  return (
    <div className={s.layer} aria-live="polite">
      <p className={s.counter} data-testid="towerstreak">
        <span className={s.counterLabel}>Battle tower</span>
        <span className={s.counterFight}>{towerFightLabel(t)}</span>
        <span className={s.counterStreak}>
          Streak <span className={s.counterValue}>{t.streak}</span>
        </span>
      </p>
    </div>
  );
}
