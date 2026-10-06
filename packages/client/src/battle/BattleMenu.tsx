/**
 * SPEC §20.5.6 — the battle menu (DOM, inside BattleOverlay): root `Fight · Party · Bag · Orbs · Run/Forfeit`
 * (hotkeys 1–5), a 4-button moves grid (1–4, Escape back), the party list (switch), the bag (usableInBattle items the
 * player holds) and the orbs. Disabled reasons come from `validateAction` through the controller (`ACTION_ERROR_LABEL`).
 * The last 3 log lines render in the left third at --t-body-lg. HP shown here is `authoritative` — the state the
 * server's events produced (hpAfter), never a client computation.
 * Phase C1 raids: Run is "Leave raid" (`raidLeave`, confirmed); in the catch window only Orbs (one `raidCatch`) and
 * Done (straight to the raid summary) are live.
 */
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { typeMultiplier } from '@ewa/core';
import type { Action, BattleState, Battler } from '@ewa/core';
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

function Moves({ st, seat }: { readonly st: BattleState; readonly seat: 0 | 1 }) {
  const me = activeOf(st, seat);
  const foe = activeOf(st, seat === 0 ? 1 : 0);
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
            <MoveButton move={def} pp={m.pp} ppMax={m.ppMax} effectiveness={eff} disabled={why !== null} onClick={() => submit(a)} hotkey={String(i + 1) as '1' | '2' | '3' | '4'} />
            {why !== null && <span className={s.why}>{why}</span>}
          </div>
        );
      })}
    </div>
  );
}

const EMPTY: readonly string[] = [];

function PartyList({ st, seat, forced }: { readonly st: BattleState; readonly seat: 0 | 1; readonly forced: boolean }) {
  const side = st.sides[seat];
  return (
    <div className={s.list} role="list" aria-label={forced ? 'Choose a replacement' : 'Switch'}>
      {side.party.map((b, i) => {
        const a: Action = { kind: 'switch', to: i };
        const why = i === side.active ? 'In battle' : reason(a);
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

  useEffect(() => {
    if (!selectable) setConfirmForfeit(false);
  }, [selectable]);

  useEffect(() => {
    if (!selectable || st === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
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
      } else if (menu === 'moves' && n <= 4) {
        const m = activeOf(st, seat)?.creature.moves[n - 1];
        if (m !== undefined) {
          e.preventDefault();
          const a: Action = { kind: 'move', move: m.id };
          if (reason(a) === null) submit(a);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectable, st, seat, menu, forced, runNow, catchWindow, confirmForfeit, runAction]);

  if (b === null || st === null) return null;
  const me = activeOf(st, seat);
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
          ? 'Choose your next creature'
          : catchWindow
            ? 'The boss is down — throw an orb to catch it (one try)'
            : me !== undefined
              ? `What will ${displayName(me.creature)} do?`
              : null;
  const runLabel =
    raid !== null ? (catchWindow ? 'Done' : confirmForfeit ? 'Confirm leave' : 'Leave raid') : canFlee ? 'Run' : confirmForfeit ? 'Confirm forfeit' : 'Forfeit';
  const runWhy = reason(runAction);

  return (
    <div className={s.menu} data-testid="battlemenu" data-phase={phase}>
      <LogLines log={b.log} />
      <div className={s.actions}>
        {status !== null && <p className={s.prompt}>{status}</p>}
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
              <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => setMenu('root')}>
                Back
              </Button>
            )}
            {menu === 'moves' && <Moves st={st} seat={seat} />}
            {menu === 'party' && <PartyList st={st} seat={seat} forced={forced} />}
            {menu === 'bag' && <Bag st={st} seat={seat} orbs={false} />}
            {menu === 'orbs' && <Bag st={st} seat={seat} orbs />}
          </div>
        )}
      </div>
    </div>
  );
}
