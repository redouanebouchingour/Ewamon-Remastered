/**
 * The battle UI is not a route (SPEC §20.1.1): PlayShell renders this whenever `ui.battle !== null`.
 *
 * Part 1 owns the shell behaviour: the navigation blocker (§20.1.3 (a) — one of the two sanctioned `useBlocker`s)
 * and the anchored container. Part 2 (§20.5.6) renders `BattleMenu` — root menu, moves grid, party/bag/orbs lists,
 * the last log lines — and the BattleResultCard; Phase B7 adds the VS intro card and the mid-battle banner; Phase C1 the
 * raid panel (boss HP, round timer, damage board) and the raid summary card; the signature move cinematic plays over all of it;
 * LLM feature 3 the commentator's caption and the trainer's banter (BattleCommentary);
 * a battle replay shows its ReplayBar in place of the menu. The in-canvas bars / turn label / orb counter are the HUD's.
 */
import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { blocksPanelNavigation } from '../app/navigation';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import s from './BattleOverlay.module.css';
import { BattleBanner } from './BattleBanner';
import { BattleIntroCard } from './BattleIntroCard';
import { NemesisTaunt } from './NemesisTaunt';
import { EncounterWipe } from './EncounterWipe';
import { BattleCallout } from './BattleCallout';
import { BattleCommentary } from './BattleCommentary';
import { BattleMenu } from './BattleMenu';
import { BattleResultCard } from './BattleResultCard';
import { RaidPanel } from './RaidPanel';
import { RaidSummaryCard } from './RaidSummaryCard';
import { ReplayBar } from './ReplayBar';
import { isReplayBattle } from './replayId';
import { BondCinematic } from './BondCinematic';
import { SignatureCinematic } from './SignatureCinematic';
import { TurnTimer } from './TurnTimer';
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
  const blocker = useBlocker(blocksPanelNavigation);
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
  // battle replays: the replay's controls stand where the menu would (nothing is sent to the server)
  const replay = useUiStore((st) => isReplayBattle(st.battle?.battleId));
  const ref = useRef<HTMLElement | null>(null);
  usePanelTop(ref, active);
  if (!active) return null;
  // Phase B7: the VS card and the mid-battle banner sit over the arena, outside the panel (its backdrop-filter would
  // make it their containing block)
  return (
    <>
      <EncounterWipe />
      <BattleIntroCard />
      <NemesisTaunt />
      <BattleBanner />
      <BattleCallout />
      <BattleCommentary />
      <RaidPanel />
      <SignatureCinematic />
      <BondCinematic />
      <section ref={ref} className={s.overlay} data-testid="battleoverlay" aria-label="Battle">
        <BattleBlocker />
        {turnLabel !== '' && (
          <p className={s.turn}>
            <span className={s.turnLabel}>{turnLabel}</span>
            <TurnTimer />
          </p>
        )}
        <div className={s.body}>{replay ? <ReplayBar /> : <BattleMenu />}</div>
        <BattleResultCard />
        <RaidSummaryCard />
      </section>
    </>
  );
}
