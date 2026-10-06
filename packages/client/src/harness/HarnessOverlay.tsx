/**
 * The DOM half of the in-battle HUD for the harness page: BattleOverlay's panel (turn label + the real BattleMenu with
 * its log lines) without the router blocker, which needs a data router the harness does not mount. Everything it shows
 * comes from `ui.battle`, written by the real BattleController. The evolution banner reads `ui.evolution`.
 */
import { useUiStore } from '../state/ui';
import { BattleMenu } from '../battle/BattleMenu';
import { EvolutionBanner } from '../world/EvolutionBanner';
import s from '../battle/BattleOverlay.module.css';

export function HarnessOverlay() {
  const active = useUiStore((st) => st.battle !== null);
  const turnLabel = useUiStore((st) => st.battle?.turnLabel ?? '');
  return (
    <>
      {active && (
        <section className={s.overlay} data-testid="battleoverlay" aria-label="Battle">
          <p className={s.turn}>{turnLabel}</p>
          <div className={s.body}>
            <BattleMenu />
          </div>
        </section>
      )}
      {/* §20.5.6 the evolution banner (the harness's `evolve()`) */}
      <EvolutionBanner />
    </>
  );
}
