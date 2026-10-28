/**
 * Watching battles in the open world: the Watch panel, a broadcast scorebug under the top bar while the player follows
 * someone else's battle (`useWatchStore`; started by E at a spectator ring or Watch on a player card). Both sides as the
 * room's `BattleSummary` has them after the last turn (what each side is called, the creature on the field with its
 * sprite, level, hp bar as a percentage and status), and the last lines of the fight from the `battleWatch` turns.
 *
 * It closes on Close, when the player's own battle starts, when they walk away from the ring (World3D stops the store)
 * and `WATCH_END_MS` after the battle ends. Watching changes nothing in anyone's game.
 */
import { useEffect } from 'react';
import { formsOf } from '@ewa/core';
import { decodeLeadFlags } from '@ewa/protocol';
import { watchSideName } from '../battle/watchLines';
import { species, speciesName } from '../data/content';
import { useRoomState } from '../net/useRoomState';
import { useUiStore } from '../state/ui';
import { useWatchStore } from '../state/watch';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { HpBar } from '../ui/HpBar';
import { cx } from '../ui/cx';
import s from './WatchPanel.module.css';

/** the panel stays this long after the battle's last line */
export const WATCH_END_MS = 5_000;

const STATUS_TAG: Readonly<Record<string, string>> = { burn: 'BRN', poison: 'PSN', paralyze: 'PAR', sleep: 'SLP', freeze: 'FRZ' };

interface FieldRow {
  readonly side: 0 | 1;
  readonly pos: number;
  readonly species: string;
  readonly flags: number;
  readonly level: number;
  readonly hpPct: number;
  readonly status: string;
}

/** the summary as primitives (useRoomState keeps a shallow-equal snapshot): trainers, turn, then one string per creature */
function useSummary(battleId: string | null): readonly (string | number)[] {
  return useRoomState((state): readonly (string | number)[] => {
    const b = battleId === null ? undefined : state.battles.get(battleId);
    if (b === undefined) return [];
    const out: (string | number)[] = [b.trainers[0] ?? '', b.trainers[1] ?? '', b.turn];
    b.field.forEach((w) => out.push(`${w.side}|${w.pos}|${w.species}|${w.flags}|${w.level}|${w.hpPct}|${w.status}`));
    return out;
  }, []);
}

function rowsOf(summary: readonly (string | number)[]): FieldRow[] {
  return summary.slice(3).map((raw) => {
    const [side = '0', pos = '0', sp = '', flags = '0', level = '1', hp = '0', status = ''] = String(raw).split('|');
    return { side: side === '1' ? 1 : 0, pos: Number(pos), species: sp, flags: Number(flags), level: Number(level), hpPct: Number(hp), status };
  });
}

function formId(speciesId: string, flags: number): string | null {
  const slot = decodeLeadFlags(flags).form;
  const sp = slot === 0 ? undefined : species(speciesId);
  return sp === undefined ? null : (formsOf(sp)[slot - 1]?.id ?? null);
}

function Side({ name, rows, far }: { readonly name: string; readonly rows: readonly FieldRow[]; readonly far: boolean }) {
  return (
    <div className={cx(s.side, far && s.far)}>
      <p className={s.trainer}>{name}</p>
      {rows.length === 0 ? (
        <p className={s.empty}>Choosing...</p>
      ) : (
        rows.map((r) => (
          <div key={`${r.side}:${r.pos}`} className={cx(s.mon, r.hpPct === 0 && s.fainted)}>
            <CreatureSprite speciesId={r.species} form={formId(r.species, r.flags)} shiny={decodeLeadFlags(r.flags).isShiny} size="sm" desaturate={r.hpPct === 0} className={s.sprite} />
            <div className={s.monText}>
              <p className={s.monName}>
                {speciesName(r.species)}
                <span className={s.level}>Lv {r.level}</span>
                {STATUS_TAG[r.status] !== undefined && <span className={s.status}>{STATUS_TAG[r.status]}</span>}
              </p>
              <HpBar hp={r.hpPct} maxHp={100} size="sm" />
            </div>
            <span className={s.pct}>{r.hpPct}%</span>
          </div>
        ))
      )}
    </div>
  );
}

export function WatchPanel() {
  const battleId = useWatchStore((st) => st.battleId);
  const log = useWatchStore((st) => st.log);
  const ended = useWatchStore((st) => st.ended);
  const ownBattle = useUiStore((st) => st.battle !== null);
  const summary = useSummary(battleId);

  // the player's own battle takes the stage: stop watching
  useEffect(() => {
    if (ownBattle && battleId !== null) useWatchStore.getState().stop();
  }, [ownBattle, battleId]);

  useEffect(() => {
    if (ended === null) return;
    const t = setTimeout(() => useWatchStore.getState().stop(), WATCH_END_MS);
    return () => clearTimeout(t);
  }, [ended]);

  if (battleId === null || ownBattle) return null;
  const rows = rowsOf(summary);
  const names = [watchSideName(summary[0] as string | undefined), watchSideName(summary[1] as string | undefined)] as const;
  const turn = typeof summary[2] === 'number' ? summary[2] : 0;

  return (
    <div className={s.layer}>
      <section className={s.panel} aria-label={`Watching ${names[0]} against ${names[1]}`} data-testid="watchpanel">
        <header className={s.head}>
          <span className={s.label}>{ended === null ? 'Watching' : 'Final'}</span>
          <span className={s.matchup}>
            <span className={s.headName}>{names[0]}</span>
            <span className={s.vs}>vs</span>
            <span className={s.headName}>{names[1]}</span>
          </span>
          {turn > 0 && ended === null && <span className={s.turn}>Turn {turn}</span>}
          <Button size="sm" variant="ghost" icon="close" ariaLabel="Stop watching" onClick={() => useWatchStore.getState().stop()} className={s.close}>
            Close
          </Button>
        </header>
        <div className={s.field}>
          <Side name={names[0]} rows={rows.filter((r) => r.side === 0)} far={false} />
          <Side name={names[1]} rows={rows.filter((r) => r.side === 1)} far />
        </div>
        <ol className={s.log} aria-live="polite">
          {log.length === 0 && ended === null && <li className={s.line}>Waiting for the next turn...</li>}
          {log.map((l, i) => (
            <li key={l.seq} className={cx(s.line, i === log.length - 1 && s.newest)}>
              {l.text}
            </li>
          ))}
          {ended !== null && log[log.length - 1]?.text !== ended && <li className={cx(s.line, s.newest)}>{ended}</li>}
        </ol>
      </section>
    </div>
  );
}
