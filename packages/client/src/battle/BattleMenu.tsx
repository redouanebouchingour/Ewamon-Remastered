/**
 * SPEC §20.5.6 — the battle menu (DOM, inside BattleOverlay): root `Fight · Party · Bag · Orbs · Run/Forfeit`
 * (hotkeys 1–5), a 4-button moves grid (1–4, Escape back), the party list (switch), the bag (usableInBattle items the
 * player holds) and the orbs. Disabled reasons come from `validateAction` through the controller (`ACTION_ERROR_LABEL`).
 * The last 3 log lines render in the left third at --t-body-lg. HP shown here is `authoritative` — the state the
 * server's events produced (hpAfter), never a client computation.
 * Phase C1 raids: Run is "Leave raid" (`raidLeave`, confirmed); in the catch window only Orbs (one `raidCatch`) and
 * Done (straight to the raid summary) are live.
 * Phase D6 doubles (`state.slots === 2`): the menu picks for one field position at a time — position 0, then position 1
 * (`ui.battle.pick`, owned by BattleController; the prompt names the creature choosing). Each pick is recorded, not
 * sent; "Back to …" re-opens the earlier position; both `battleAction { pos }` go out once the last required position
 * has picked. A single-target move (power > 0 or target 'foe', not spread) opens target selection — each standing foe
 * and the standing ally (never the user), hotkeys 1–3, Escape back to the moves; with one candidate it is taken
 * directly. Spread / self / field moves skip it. Party switches the choosing position's creature (one already on the
 * field, or chosen by the other position this turn, is disabled); the replacement phase asks once per required position.
 */
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isSpread, requiredPositions, typeMultiplier } from '@ewa/core';
import type { Action, BattleState, Battler, FieldRef, MoveDef } from '@ewa/core';
import { CONSUMABLES, ORBS } from '@ewa/content';
import { content, displayName, move as moveDef, species } from '../data/content';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import type { BattleUi } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { cx } from '../ui/cx';
import { MoveButton } from '../ui/MoveButton';
import type { Effectiveness } from '../ui/MoveButton';
import { battleActions } from './controllerRef';
import s from './BattleMenu.module.css';

type Menu = BattleUi['menu'];

function setMenu(menu: Menu): void {
  const b = useUiStore.getState().battle;
  if (b !== null && b.menu !== menu) useUiStore.getState().setBattle({ ...b, menu });
}

function submit(a: Action): void {
  battleActions()?.submit(a);
}

function reason(a: Action): string | null {
  return battleActions()?.check(a) ?? null;
}

function activeOf(st: BattleState, side: 0 | 1): Battler | undefined {
  const sd = st.sides[side];
  return sd.party[sd.active];
}

/** Phase D6: the battler choosing now — the doubles pick's position, else the side's active. */
function chooserOf(st: BattleState, side: 0 | 1, pos: 0 | 1 | null): Battler | undefined {
  const sd = st.sides[side];
  if (pos === null || sd.actives === undefined) return activeOf(st, side);
  return sd.party[sd.actives[pos]];
}

/** Phase D6: the first standing foe on the field (the default target; the effectiveness hint reads it). */
function firstFoeOf(st: BattleState, seat: 0 | 1): Battler | undefined {
  const sd = st.sides[seat === 0 ? 1 : 0];
  if (sd.actives === undefined) return sd.party[sd.active];
  for (const i of sd.actives) if ((sd.party[i]?.creature.hp ?? 0) > 0) return sd.party[i];
  return sd.party[sd.actives[0]];
}

/** Phase D6: whether a doubles move asks for a target (single-target: power > 0 or target 'foe', not spread). */
export function needsTarget(def: MoveDef): boolean {
  return !isSpread(def) && (def.power > 0 || def.target === 'foe');
}

export interface TargetOption {
  readonly ref: FieldRef;
  readonly battler: Battler;
  readonly ally: boolean;
}

/** Phase D6: the targets a single-target move may aim at from `pos` — every standing foe, then the standing ally. */
export function targetOptions(st: BattleState, seat: 0 | 1, pos: 0 | 1): TargetOption[] {
  const out: TargetOption[] = [];
  const foe = (seat === 0 ? 1 : 0) as 0 | 1;
  const fs = st.sides[foe];
  const me = st.sides[seat];
  if (fs.actives === undefined || me.actives === undefined) return out;
  for (const p of [0, 1] as const) {
    const b = fs.party[fs.actives[p]];
    if (b !== undefined && b.creature.hp > 0) out.push({ ref: { side: foe, pos: p }, battler: b, ally: false });
  }
  const other = (pos === 0 ? 1 : 0) as 0 | 1;
  const ally = me.party[me.actives[other]];
  if (ally !== undefined && ally.creature.hp > 0) out.push({ ref: { side: seat, pos: other }, battler: ally, ally: true });
  return out;
}

function LogLines({ log }: { readonly log: BattleUi['log'] }) {
  const last = log.slice(-3);
  return (
    <ol className={s.log} aria-live="polite" aria-label="Battle log">
      {last.map((l) => (
        <li key={l.id} className={cx(s.line, s[l.tone])}>
          {l.text}
        </li>
      ))}
    </ol>
  );
}

function Moves({ st, seat, pos, onPick }: { readonly st: BattleState; readonly seat: 0 | 1; readonly pos: 0 | 1 | null; readonly onPick: (move: string) => void }) {
  const me = chooserOf(st, seat, pos);
  const foe = firstFoeOf(st, seat);
  const seen = useSessionStore((x) => x.progression?.dexSeen ?? EMPTY);
  const foeSeen = foe !== undefined && seen.includes(foe.creature.speciesId);
  const foeTypes = foe === undefined ? [] : (species(foe.creature.speciesId)?.types ?? []);
  if (me === undefined) return null;
  return (
    <div className={s.moves}>
      {me.creature.moves.map((m, i) => {
        const def = moveDef(m.id);
        if (def === undefined) return null;
        const a: Action = { kind: 'move', move: m.id };
        const why = reason(a);
        const eff: Effectiveness | null = foeSeen && def.power > 0 ? (typeMultiplier(content().typeChart, def.type, foeTypes) as Effectiveness) : null;
        return (
          <div key={m.id} className={s.moveCell}>
            <MoveButton move={def} pp={m.pp} ppMax={m.ppMax} effectiveness={eff} disabled={why !== null} onClick={() => onPick(m.id)} hotkey={String(i + 1) as '1' | '2' | '3' | '4'} />
            {why !== null && <span className={s.why}>{why}</span>}
          </div>
        );
      })}
    </div>
  );
}

const EMPTY: readonly string[] = [];

/** Phase D6: the target list of a single-target doubles move (hotkeys 1–3; Escape goes back to the moves). */
function Targets({ move, options }: { readonly move: string; readonly options: readonly TargetOption[] }) {
  return (
    <div className={s.targets} role="list" aria-label={`Target of ${move}`} data-testid="battle-targets">
      {options.map((o, i) => {
        const a: Action = { kind: 'move', move, target: o.ref };
        const why = reason(a);
        return (
          <button key={`${o.ref.side}:${o.ref.pos}`} type="button" role="listitem" className={cx(s.targetRow, o.ally && s.targetAlly)} disabled={why !== null} onClick={() => submit(a)}>
            <kbd className={s.key}>{i + 1}</kbd>
            <span className={s.itemName}>{displayName(o.battler.creature)}</span>
            <span className={s.targetSide}>{o.ally ? 'Ally' : 'Foe'}</span>
            <span className={s.itemCount}>
              {o.battler.creature.hp}/{o.battler.maxHp}
            </span>
            {why !== null && <span className={s.why}>{why}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PartyList({ st, seat, forced }: { readonly st: BattleState; readonly seat: 0 | 1; readonly forced: boolean }) {
  const side = st.sides[seat];
  const field = side.actives ?? [side.active];
  return (
    <div className={s.list} role="list" aria-label={forced ? 'Choose a replacement' : 'Switch'}>
      {side.party.map((b, i) => {
        const a: Action = { kind: 'switch', to: i };
        // Phase D6: both field positions are "in battle" (a fainted one stays there until replaced)
        const why = field.includes(i) ? (b.creature.hp > 0 ? 'In battle' : 'Fainted') : reason(a);
        return (
          <div key={b.creature.id} role="listitem" className={s.partyRow}>
            <CreatureCard creature={b.creature} variant="row" onClick={why === null ? () => submit(a) : undefined} />
            {why !== null && <span className={s.why}>{why}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Bag({ st, seat, orbs }: { readonly st: BattleState; readonly seat: 0 | 1; readonly orbs: boolean }) {
  const items = useSessionStore(useShallow((x) => x.inventory?.items ?? NO_ITEMS));
  const side = st.sides[seat];
  const rows = orbs
    ? ORBS.filter((o) => (items[o.id] ?? 0) > 0).map((o) => ({ id: o.id, name: o.name, desc: o.description, n: items[o.id] ?? 0 }))
    : CONSUMABLES.filter((c) => c.usableInBattle && (items[c.id] ?? 0) > 0).map((c) => ({ id: c.id, name: c.name, desc: c.description, n: items[c.id] ?? 0 }));
  if (rows.length === 0) return <p className={s.empty}>{orbs ? 'No orbs in the bag.' : 'No usable items.'}</p>;
  return (
    <div className={s.list} role="list">
      {rows.map((r) => {
        let a: Action = orbs ? { kind: 'catch', orb: r.id } : { kind: 'item', item: r.id };
        let why = reason(a);
        if (!orbs && why !== null) {
          // revives target a fainted member: try the first one
          const fainted = side.party.findIndex((b) => b.creature.hp <= 0);
          if (fainted >= 0) {
            const alt: Action = { kind: 'item', item: r.id, target: fainted };
            if (reason(alt) === null) {
              a = alt;
              why = null;
            }
          }
        }
        return (
          <button key={r.id} type="button" role="listitem" className={s.itemRow} disabled={why !== null} onClick={() => submit(a)} title={r.desc}>
            <span className={s.itemName}>{r.name}</span>
            <span className={s.itemCount}>×{r.n}</span>
            {why !== null && <span className={s.why}>{why}</span>}
          </button>
        );
      })}
    </div>
  );
}

const NO_ITEMS: Readonly<Record<string, number>> = {};

const ROOT: readonly { readonly key: Menu | 'run'; readonly label: string }[] = [
  { key: 'moves', label: 'Fight' },
  { key: 'party', label: 'Party' },
  { key: 'bag', label: 'Bag' },
  { key: 'orbs', label: 'Orbs' },
  { key: 'run', label: 'Run' },
];

export function BattleMenu() {
  const b = useUiStore((x) => x.battle);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const st = b?.authoritative ?? null;
  const seat = b?.seat ?? 0;
  const canFlee = st?.sides[seat].canFlee ?? false;
  const phase = b?.phase ?? 'playing';
  const forced = phase === 'replacement';
  const menu: Menu = forced ? 'party' : (b?.menu ?? 'root');
  const selectable = phase === 'selecting' || phase === 'replacement';
  const raid = b?.raid ?? null;
  const catchWindow = raid?.catchWindow === true;
  /** Run fires without a confirmation: fleeing, or Done in a raid's catch window */
  const runNow = canFlee || catchWindow;

  const runAction = useMemo<Action>(() => (canFlee ? { kind: 'flee' } : { kind: 'forfeit' }), [canFlee]);
  // Phase D6: the doubles position choosing now (null in singles) and the move awaiting its target
  const doubles = st?.slots === 2;
  const pickPos: 0 | 1 | null = doubles ? (b?.pick?.pos ?? 0) : null;
  const [targeting, setTargeting] = useState<string | null>(null);
  const options = useMemo(() => (st !== null && pickPos !== null && targeting !== null ? targetOptions(st, seat, pickPos) : []), [st, seat, pickPos, targeting]);

  useEffect(() => {
    if (!selectable) setConfirmForfeit(false);
  }, [selectable]);

  useEffect(() => {
    setTargeting(null);
  }, [menu, pickPos, phase]);

  /** a move from the grid: doubles single-target moves ask for their target first */
  const pickMove = (id: string): void => {
    const a: Action = { kind: 'move', move: id };
    if (st === null || pickPos === null) {
      if (reason(a) === null) submit(a);
      return;
    }
    const def = moveDef(id);
    if (def === undefined || !needsTarget(def)) {
      if (reason(a) === null) submit(a);
      return;
    }
    const opts = targetOptions(st, seat, pickPos);
    if (opts.length === 1) submit({ kind: 'move', move: id, target: opts[0]!.ref });
    else setTargeting(id);
  };

  useEffect(() => {
    if (!selectable || st === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' && targeting !== null) {
        e.preventDefault();
        setTargeting(null);
        return;
      }
      if (e.key === 'Escape' && menu !== 'root' && !forced) {
        e.preventDefault();
        setMenu('root');
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (menu === 'root' && n <= 5) {
        e.preventDefault();
        const k = ROOT[n - 1]!.key;
        if (k === 'run') {
          if (runNow || confirmForfeit) submit(runAction);
          else setConfirmForfeit(true);
        } else if (!catchWindow || k === 'orbs') setMenu(k);
      } else if (menu === 'moves' && targeting !== null) {
        const o = options[n - 1];
        if (o !== undefined) {
          e.preventDefault();
          const a: Action = { kind: 'move', move: targeting, target: o.ref };
          if (reason(a) === null) submit(a);
        }
      } else if (menu === 'moves' && n <= 4) {
        const m = chooserOf(st, seat, pickPos)?.creature.moves[n - 1];
        if (m !== undefined) {
          e.preventDefault();
          pickMove(m.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectable, st, seat, menu, forced, runNow, catchWindow, confirmForfeit, runAction, targeting, options, pickPos]);

  if (b === null || st === null) return null;
  const me = chooserOf(st, seat, pickPos);
  // Phase D6: the earlier required position this turn ("Back to …" re-opens it); doubles only
  const req = pickPos === null ? [] : requiredPositions(st, seat);
  const backTo = pickPos !== null && req.indexOf(pickPos) > 0 ? chooserOf(st, seat, req[req.indexOf(pickPos) - 1]!) : undefined;
  const status =
    phase === 'submitted'
      ? raid !== null
        ? catchWindow
          ? 'Throwing…'
          : 'Waiting for the round to resolve…'
        : b.expectedMs > 0
          ? 'Waiting for the turn…'
          : 'Waiting for the other trainer…'
      : phase === 'playing' || phase === 'ended'
        ? null
        : forced
          ? pickPos !== null && me !== undefined && req.length > 1
            ? `Choose a replacement for ${displayName(me.creature)}`
            : 'Choose your next creature'
          : catchWindow
            ? 'The boss is down — throw an orb to catch it (one try)'
            : me !== undefined
              ? `What will ${displayName(me.creature)} do?${pickPos !== null && req.length > 1 ? ` (${req.indexOf(pickPos) + 1}/${req.length})` : ''}`
              : null;
  const runLabel =
    raid !== null ? (catchWindow ? 'Done' : confirmForfeit ? 'Confirm leave' : 'Leave raid') : canFlee ? 'Run' : confirmForfeit ? 'Confirm forfeit' : 'Forfeit';
  const runWhy = reason(runAction);

  return (
    <div className={s.menu} data-testid="battlemenu" data-phase={phase}>
      <LogLines log={b.log} />
      <div className={s.actions}>
        {status !== null && <p className={s.prompt}>{status}</p>}
        {selectable && backTo !== undefined && (
          <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => battleActions()?.undoPick?.()}>
            {`Back to ${displayName(backTo.creature)}`}
          </Button>
        )}
        {selectable && menu === 'root' && (
          <div className={s.root}>
            {ROOT.map((r, i) => (
              <Button
                key={r.key}
                size="lg"
                variant={r.key === (catchWindow ? 'orbs' : 'moves') ? 'primary' : r.key === 'run' ? (runNow ? 'ghost' : 'danger') : 'secondary'}
                onClick={() => {
                  if (r.key === 'run') {
                    if (runNow || confirmForfeit) submit(runAction);
                    else setConfirmForfeit(true);
                  } else setMenu(r.key);
                }}
                title={r.key === 'run' && runWhy !== null ? runWhy : undefined}
                disabled={r.key === 'run' ? runWhy !== null : r.key === 'orbs' ? !st.sides[seat].canCatch : catchWindow}
              >
                <kbd className={s.key}>{i + 1}</kbd>
                {r.key === 'run' ? runLabel : r.label}
              </Button>
            ))}
          </div>
        )}
        {selectable && menu !== 'root' && (
          <div className={s.sub}>
            {!forced && (
              <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => (targeting !== null ? setTargeting(null) : setMenu('root'))}>
                Back
              </Button>
            )}
            {menu === 'moves' && targeting === null && <Moves st={st} seat={seat} pos={pickPos} onPick={pickMove} />}
            {menu === 'moves' && targeting !== null && <Targets move={targeting} options={options} />}
            {menu === 'party' && <PartyList st={st} seat={seat} forced={forced} />}
            {menu === 'bag' && <Bag st={st} seat={seat} orbs={false} />}
            {menu === 'orbs' && <Bag st={st} seat={seat} orbs />}
          </div>
        )}
      </div>
    </div>
  );
}
