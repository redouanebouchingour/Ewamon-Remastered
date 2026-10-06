/**
 * Phase B7 — a league trainer's mid-battle line (`LeagueTrainer.mid`) as a transient banner above the battle panel:
 * BattleController pushes `ui.battleBanner` as the timeline plays (half HP, last stand); each stays BANNER_MS, then
 * the next queued one takes its place. Non-blocking (pointer-events none); announced politely.
 */
import { useEffect } from 'react';
import { useUiStore } from '../state/ui';
import s from './BattleBanner.module.css';

export const BATTLE_BANNER_MS = 3000;

export function BattleBanner() {
  const banner = useUiStore((st) => st.battleBanner);
  useEffect(() => {
    if (banner === null) return;
    const t = setTimeout(() => useUiStore.getState().dismissBattleBanner(banner.id), BATTLE_BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);
  if (banner === null) return null;
  return (
    <div className={s.layer} role="status" aria-live="polite">
      <p key={banner.id} className={s.banner} data-testid="battlebanner">
        {banner.speaker.length > 0 && <span className={s.speaker}>{banner.speaker}</span>}
        <span className={s.text}>“{banner.text}”</span>
      </p>
    </div>
  );
}
