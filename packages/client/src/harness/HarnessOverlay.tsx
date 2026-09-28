/**
 * The DOM half of the in-battle HUD for the harness page: BattleOverlay's panel (turn label + the real BattleMenu with
 * its log lines) without the router blocker, which needs a data router the harness does not mount. Everything it shows
 * comes from `ui.battle`, written by the real BattleController.
 */
import { useUiStore } from '../state/ui';
import { BattleMenu } from '../battle/BattleMenu';
import s from '../battle/BattleOverlay.module.css';

export function HarnessOverlay() {
  const active = useUiStore((st) => st.battle !== null);
  const turnLabel = useUiStore((st) => st.battle?.turnLabel ?? '');
  if (!active) return null;
  return (
    <section className={s.overlay} data-testid="battleoverlay" aria-label="Battle">
      <p className={s.turn}>{turnLabel}</p>
      <div className={s.body}>
        <BattleMenu />
      </div>
    </section>
  );
}
