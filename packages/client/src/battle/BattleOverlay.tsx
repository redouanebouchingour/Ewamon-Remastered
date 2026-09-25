/**
 * The battle UI is not a route (SPEC §20.1.1): PlayShell renders this whenever `ui.battle !== null`.
 *
 * Part 1 owns the shell behaviour: the navigation blocker (§20.1.3 (a) — one of the two sanctioned `useBlocker`s)
 * and the anchored container. Part 2 (§20.5.6) renders `BattleMenu` — root menu, moves grid, party/bag/orbs lists,
 * the last log lines — and the BattleResultCard. The in-canvas bars / turn label / orb counter are the HUD's.
 */
import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import s from './BattleOverlay.module.css';
import { BattleMenu } from './BattleMenu';
import { BattleResultCard } from './BattleResultCard';

function BattleBlocker() {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      toast('warn', 'Finish the battle first.');
      blocker.reset();
    }
  }, [blocker]);
  return null;
}

export function BattleOverlay() {
  const active = useUiStore((st) => st.battle !== null);
  const turnLabel = useUiStore((st) => st.battle?.turnLabel ?? '');
  if (!active) return null;
  return (
    <section className={s.overlay} data-testid="battleoverlay" aria-label="Battle">
      <BattleBlocker />
      <p className={s.turn}>{turnLabel}</p>
      <div className={s.body}>
        <BattleMenu />
      </div>
      <BattleResultCard />
    </section>
  );
}
