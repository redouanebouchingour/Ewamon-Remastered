/**
 * The turn timer (SPEC §20.5.6, 2026-10-12): the seconds left before the server auto-acts for a seat that has not
 * chosen (§30.4.3 "Deadline", 60 s a turn, 20 s for a replacement), counted down on this clock from the `deadlineMs`
 * the last battle message carried. It sits at the right of the turn tag while the player chooses or waits for the
 * other side; under 10 s it turns warn, under 5 s danger. Absent in raids (their round timer is the raid panel's).
 */
import { useEffect, useState } from 'react';
import { useUiStore } from '../state/ui';
import { cx } from '../ui/cx';
import s from './BattleOverlay.module.css';

const TICK_MS = 250;

export function turnTimerText(leftMs: number): string {
  const secs = Math.max(0, Math.ceil(leftMs / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export function TurnTimer() {
  const deadlineAt = useUiStore((st) => st.battle?.deadlineAt ?? null);
  const phase = useUiStore((st) => st.battle?.phase ?? null);
  const raid = useUiStore((st) => st.battle?.raid !== undefined);
  const live = deadlineAt !== null && !raid && (phase === 'selecting' || phase === 'replacement' || phase === 'submitted');
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!live) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, [live, deadlineAt]);
  if (!live) return null;
  const leftMs = deadlineAt - now;
  const secs = Math.max(0, Math.ceil(leftMs / 1000));
  return (
    <span
      className={cx(s.timer, secs <= 5 ? s.timerDanger : secs <= 10 && s.timerWarn)}
      data-testid="turn-timer"
      role="timer"
      aria-label={`${secs} seconds left to choose`}
    >
      {turnTimerText(leftMs)}
    </span>
  );
}
