/**
 * NPC voice talk's slap / kick (2026-10-22): at contact a comic burst ("PETS!" / "BOEM!") pops beside the dialogue and
 * the screen edges flash red; it clears itself when its animation ends. The world half (the NPC's lunge, the camera
 * shake, a kick's knockback) is `scene/npcStrike.ts`.
 */
import { clearHit, useNpcFxStore } from '../state/npcFx';
import s from './NpcStrikeFx.module.css';

const WORD = { slap: 'PETS!', kick: 'BOEM!' } as const;

export function NpcStrikeFx() {
  const hit = useNpcFxStore((st) => st.hit);
  if (hit === null) return null;
  return (
    <div key={hit.seq} className={s.layer} data-kind={hit.kind} aria-hidden="true" data-testid="npc-strike">
      <div className={s.flash} />
      <p className={s.burst} onAnimationEnd={clearHit}>
        {WORD[hit.kind]}
      </p>
    </div>
  );
}
