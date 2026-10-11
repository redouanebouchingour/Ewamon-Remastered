/**
 * Phase C1 — the raid's shared numbers beside the battle (BattleOverlay renders it for format 'raid'): the boss and
 * its shared HP (`RaidState.hpPct`, the only boss HP every participant sees), the phase (Enraged in danger tone), the
 * round countdown (`roundEndsInMs`, patched once a second) and the public damage board. All of it is read from
 * `room.state.raid` through `useRoomState`; the canvas HP bars and the timeline stay the battle's own.
 * Broadcast UI (2026-10-11): a black card — the boss on a label strip, the phase a slab (Enraged red, the others
 * outlined: orange is never a status), the shared HP as a big number, the board in tabular display figures.
 */
import { speciesName } from '../data/content';
import { useRoomState } from '../net/useRoomState';
import { useUiStore } from '../state/ui';
import { HpBar } from '../ui/HpBar';
import { cx } from '../ui/cx';
import { boardFlat, countdownLine, phaseLabel, unflattenBoard } from './raid';
import s from './RaidPanel.module.css';

/** rows the panel lists (the summary card shows more) */
export const RAID_PANEL_ROWS = 5;
const NONE = null;
const NO_BOARD: readonly (string | number | boolean | null)[] = [];

export function RaidPanel() {
  const raid = useUiStore((st) => (st.battle?.format === 'raid' && st.battle.result === null ? (st.battle.raid ?? null) : null));
  const raidId = raid?.raidId ?? '';
  const view = useRoomState(
    (st) => {
      const r = st.raid;
      if (r === null || r === undefined || r.id !== raidId) return NONE;
      return { species: r.bossSpecies, level: r.bossLevel, hpPct: r.hpPct, phase: r.phase, ends: r.roundEndsInMs };
    },
    NONE,
  );
  const flat = useRoomState((st, me) => (raidId === '' ? NO_BOARD : boardFlat(st, me, raidId)), NO_BOARD);
  if (raid === null || view === null) return null;
  const board = unflattenBoard(flat);
  const shown = board.slice(0, RAID_PANEL_ROWS);
  const mine = board.findIndex((r) => r.self);
  if (mine >= RAID_PANEL_ROWS) shown.push(board[mine]!);
  const pct = Math.round(view.hpPct * 1000);
  const enraged = view.phase === 2;
  return (
    <aside className={s.panel} data-testid="raidpanel" data-phase={view.phase} aria-label="Raid">
      <header className={s.head}>
        <span className={s.boss}>
          {speciesName(view.species)} <span className={s.level}>Lv {view.level}</span>
        </span>
        <span className={cx(s.phase, enraged && s.enraged)}>{phaseLabel(view.phase)}</span>
      </header>
      <div className={s.hp}>
        <HpBar hp={pct} maxHp={1000} size="sm" />
        <span className={s.pct} data-testid="raidpanel-hp">
          {Math.round(view.hpPct * 100)}%
        </span>
      </div>
      <p className={s.timer} data-testid="raidpanel-timer" aria-live="off">
        {raid.catchWindow ? countdownLine(3, view.ends) : `Round ${raid.round} · ${countdownLine(view.phase, view.ends)}`}
      </p>
      <ol className={s.board} aria-label="Damage board" data-testid="raidpanel-board">
        {shown.map((r) => (
          <li key={r.playerId} className={cx(s.row, r.self && s.self)}>
            <span className={s.rank}>{board.indexOf(r) + 1}</span>
            <span className={s.name}>{r.self ? `${r.name} (you)` : r.name}</span>
            <span className={s.damage}>{r.damage.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
