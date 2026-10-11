/**
 * The battle UI is not a route (SPEC §20.1.1): PlayShell renders this whenever `ui.battle !== null`.
 *
 * Part 1 owns the shell behaviour: the navigation blocker (§20.1.3 (a) — one of the two sanctioned `useBlocker`s)
 * and the anchored container. Part 2 (§20.5.6) renders `BattleMenu` — root menu, moves grid, party/bag/orbs lists,
 * the last log lines — and the BattleResultCard; Phase B7 adds the VS intro card and the mid-battle banner; Phase C1 the
 * raid panel (boss HP, round timer, damage board) and the raid summary card; the signature move cinematic plays over all of it. The in-canvas bars / turn label / orb counter are the HUD's.
 */
import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import s from './BattleOverlay.module.css';
import { BattleBanner } from './BattleBanner';
import { BattleIntroCard } from './BattleIntroCard';
import { BattleMenu } from './BattleMenu';
import { BattleResultCard } from './BattleResultCard';
import { RaidPanel } from './RaidPanel';
import { RaidSummaryCard } from './RaidSummaryCard';
import { BondCinematic } from './BondCinematic';
import { SignatureCinematic } from './SignatureCinematic';
import { setBattlePanelTop } from './panelInset';

/** Reports the panel's top edge while mounted (render T2: the battle camera frames the battlers above it). */
function usePanelTop(ref: React.RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!active || el === null) return;
    const measure = (): void => setBattlePanelTop(el.getBoundingClientRect().top);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      setBattlePanelTop(null);
    };
  }, [ref, active]);
}

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
  const ref = useRef<HTMLElement | null>(null);
  usePanelTop(ref, active);
  if (!active) return null;
  // Phase B7: the VS card and the mid-battle banner sit over the arena, outside the panel (its backdrop-filter would
  // make it their containing block)
  return (
    <>
      <BattleIntroCard />
      <BattleBanner />
      <RaidPanel />
      <SignatureCinematic />
      <BondCinematic />
      <section ref={ref} className={s.overlay} data-testid="battleoverlay" aria-label="Battle">
        <BattleBlocker />
        <p className={s.turn}>{turnLabel}</p>
        <div className={s.body}>
          <BattleMenu />
        </div>
        <BattleResultCard />
        <RaidSummaryCard />
      </section>
    </>
  );
}
