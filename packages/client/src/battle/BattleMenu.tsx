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
 * Broadcast UI (2026-10-11): a command deck — the root commands are a vertical rail that stays up in every menu (the
 * open one is the orange slab; a click on another slab goes straight there), the log lines are a "Last turn" ticker
 * with the live key hints, and the stage beside the rail holds the prompt, the 4 move cards or the lists.
 * Every choice opens on the moves (`OPEN_MENU`, 2026-10-12): Back / Escape from Party, Bag or Orbs returns to them,
 * Escape on the moves shows the root (1–5 command hotkeys); in a raid's catch window the root shows instead.
 * Majin / Tenjin (`.design/majin-tenjin.md` §3, §6.4): in the moves menu a transform toggle (key T) sits at the end of
 * the head row when `transformOffer` shows it (the side holds the band of the battler's form kind and has not
 * transformed). Disabled, it carries its reason as a caption; armed (`aria-pressed`, the orange 'selected' slab) the
 * next move picked is sent as `{ kind: 'move', transform: true }` (doubles: for the choosing position only — the other
 * position's toggle is then disabled). It resets with the turn, the doubles position and the phase. The first time it
 * lights up for a kind, a one-line coach mark (`state/bandTutorial.ts`, once per kind per account).
 */
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formMove, formMoveId, formTypes, isSpread, requiredPositions, typeMultiplier } from '@ewa/core';
import type { Action, BandKind, BattleState, Battler, FieldRef, MoveDef } from '@ewa/core';
import { CONSUMABLES, ORBS } from '@ewa/content';
import { content, displayName, move as moveDef, species } from '../data/content';
import { COACH_LINE, TRANSFORM_KEY, bandAccountOf, useBandTutorialStore } from '../state/bandTutorial';
import { useSessionStore } from '../state/session';
import { OPEN_MENU, useUiStore } from '../state/ui';
import type { BattleUi } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { cx } from '../ui/cx';
import { FORM_KIND_NAME, FormSigil } from '../ui/FormSigil';
import { MoveButton } from '../ui/MoveButton';
import type { Effectiveness } from '../ui/MoveButton';
import { battleActions } from './controllerRef';
import { transformOffer } from './transform';
import type { TransformOffer } from './transform';
import s from './BattleMenu.module.css';
import { challengeActive } from '@ewa/content';

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

/** A move action; `transform` (Majin / Tenjin) when the toggle is armed. */
export function moveAction(move: string, target?: FieldRef, transform = false): Action {
  return { kind: 'move', move, ...(target !== undefined ? { target } : {}), ...(transform ? { transform: true as const } : {}) };
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

/** a key hint of the ticker: the key (a paper chip) and what it does */
type Hint = readonly [key: string, verb: string];

/**
 * Broadcast UI: the "Last turn" ticker over the command area — the last 3 log lines in one strip (older ones truncate
 * first), then the keys that work in this menu on the right.
 */
export function Ticker({ log, hints }: { readonly log: BattleUi['log']; readonly hints: readonly Hint[] }) {
  const last = log.slice(-3);
  return (
    <div className={s.ticker} data-testid="battle-ticker">
      <span className={s.tickerLabel} aria-hidden>
        Last turn
      </span>
      <ol className={s.log} aria-live="polite" aria-label="Battle log">
        {last.map((l) => (
          <li key={l.id} className={cx(s.line, s[l.tone])}>
            {l.text}
          </li>
        ))}
      </ol>
      {hints.length > 0 && (
        <span className={s.hints} aria-hidden>
          {hints.map(([k, verb]) => (
            <span key={k} className={s.hint}>
              <kbd className={s.hintKey}>{k}</kbd>
              {verb}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function Moves({ st, seat, pos, onPick }: { readonly st: BattleState; readonly seat: 0 | 1; readonly pos: 0 | 1 | null; readonly onPick: (move: string) => void }) {
  const me = chooserOf(st, seat, pos);
  const foe = firstFoeOf(st, seat);
  const seen = useSessionStore((x) => x.progression?.dexSeen ?? EMPTY);
  const foeSeen = foe !== undefined && seen.includes(foe.creature.speciesId);
  // a foe in a battle form with its own types (hyoryu's Majin Form) is hit as what it is now
  const foeSp = foe === undefined ? undefined : species(foe.creature.speciesId);
  const foeTypes = foe === undefined || foeSp === undefined ? [] : formTypes(foeSp, foe);
  if (me === undefined) return null;
  return (
    <div className={s.moves}>
      {me.creature.moves.map((m, i) => {
        // a battle form's signature move shows (and is what the slot executes) in place of the move it replaces
        const sp = species(me.creature.speciesId);
        const known = moveDef(sp === undefined ? m.id : formMoveId(sp, me, m.id));
        if (known === undefined) return null;
        // a relic form also retypes a typeFromForm move (Cosmic Convergence shows Water in Water Form)
        const def = sp === undefined ? known : formMove(content(), sp, me, m.id);
        const a: Action = { kind: 'move', move: m.id };
        const why = reason(a);
        const eff: Effectiveness | null = foeSeen && def.power > 0 ? (typeMultiplier(content().typeChart, def.type, foeTypes) as Effectiveness) : null;
        return (
          <div key={m.id} className={s.moveCell}>
            <MoveButton move={def} pp={m.pp} ppMax={m.ppMax} effectiveness={eff} disabled={why !== null} onClick={() => onPick(m.id)} hotkey={String(i + 1) as '1' | '2' | '3' | '4'} size="lg" />
            {why !== null && <span className={s.why}>{why}</span>}
          </div>
        );
      })}
    </div>
  );
}

const EMPTY: readonly string[] = [];

/** Phase D6: the target list of a single-target doubles move (hotkeys 1–3; Escape goes back to the moves). */
function Targets({ move, options, transform }: { readonly move: string; readonly options: readonly TargetOption[]; readonly transform: boolean }) {
  return (
    <div className={s.targets} role="list" aria-label={`Target of ${move}`} data-testid="battle-targets">
      {options.map((o, i) => {
        const a = moveAction(move, o.ref, transform);
        const why = reason(a);
        return (
          <button key={`${o.ref.side}:${o.ref.pos}`} type="button" role="listitem" className={cx(s.targetRow, o.ally && s.targetAlly)} disabled={why !== null} onClick={() => submit(a)} aria-keyshortcuts={String(i + 1)}>
            <kbd className={s.key}>{i + 1}</kbd>
            <span className={s.targetSide}>{o.ally ? 'Ally' : 'Foe'}</span>
            <span className={s.itemName}>{displayName(o.battler.creature)}</span>
            <span className={s.itemCount}>
              {o.battler.creature.hp}
              <span className={s.itemMax}>/{o.battler.maxHp}</span>
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

const TRANSFORM_WHY_ID = 'battle-transform-why';

/**
 * Majin / Tenjin: the transform toggle at the end of the moves menu's head row — the key chip, the form's sigil
 * (crimson cracked ring / gold ring) and its name; armed it is the orange 'selected' slab. Disabled, the reason sits
 * beside it as a caption.
 */
function TransformToggle({ offer, armed, pulse, onToggle }: { readonly offer: TransformOffer; readonly armed: boolean; readonly pulse: boolean; readonly onToggle: () => void }) {
  const name = FORM_KIND_NAME[offer.kind];
  return (
    <div className={s.transform}>
      {offer.reason !== null && (
        <span id={TRANSFORM_WHY_ID} className={cx(s.why, s.transformWhy)}>
          {offer.reason}
        </span>
      )}
      <button
        type="button"
        className={cx(s.transformBtn, armed && s.armed, pulse && s.pulse)}
        data-testid="transform-toggle"
        data-kind={offer.kind}
        aria-pressed={armed}
        aria-keyshortcuts={TRANSFORM_KEY}
        aria-describedby={offer.reason !== null ? TRANSFORM_WHY_ID : undefined}
        title={armed ? `${name}: the next move transforms first` : `${name} Form: transform before the move`}
        disabled={!offer.enabled}
        onClick={onToggle}
      >
        <kbd className={s.key}>{TRANSFORM_KEY}</kbd>
        <FormSigil kind={offer.kind} size="md" className={s.transformSigil} />
        <span className={s.cmdLabel}>{name}</span>
      </button>
    </div>
  );
}

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
  const raid = b?.raid ?? null;
  const catchWindow = raid?.catchWindow === true;
  // the moves open by default; in a raid's catch window only Orbs is allowed, so the commands show instead
  const stored: Menu = b?.menu ?? OPEN_MENU;
  const menu: Menu = forced ? 'party' : catchWindow && stored === 'moves' ? 'root' : stored;
  /** where Back / Escape go: the sub-menus back to the moves, the moves to the command hotkeys */
  const back: Menu = menu === 'moves' || catchWindow ? 'root' : OPEN_MENU;
  const selectable = phase === 'selecting' || phase === 'replacement';
  /** Run fires without a confirmation: fleeing, or Done in a raid's catch window */
  const runNow = canFlee || catchWindow;

  const runAction = useMemo<Action>(() => (canFlee ? { kind: 'flee' } : { kind: 'forfeit' }), [canFlee]);
  // Phase D6: the doubles position choosing now (null in singles) and the move awaiting its target
  const doubles = st?.slots === 2;
  const pickPos: 0 | 1 | null = doubles ? (b?.pick?.pos ?? 0) : null;
  const [targeting, setTargeting] = useState<string | null>(null);
  // Majin / Tenjin: the transform toggle for the battler choosing now (null = not shown) and whether it is armed
  const chooser = st === null ? undefined : chooserOf(st, seat, pickPos);
  const otherPick = pickPos === null ? null : (b?.pick?.picks[pickPos === 0 ? 1 : 0] ?? null);
  const offer = st !== null && phase === 'selecting' ? transformOffer(st, seat, chooser, otherPick) : null;
  const [armedRaw, setArmed] = useState(false);
  const armed = armedRaw && offer?.enabled === true;
  const offerKind: BandKind | null = offer?.kind ?? null;
  const offerOn = offer?.enabled === true;
  const accountId = useSessionStore((x) => x.profile?.id ?? '');
  const hardcore = useSessionStore((x) => challengeActive(x.progression?.flags ?? []) === 'hardcore');
  const coached = useBandTutorialStore((x) => bandAccountOf(x, accountId).coached);
  const markCoached = useBandTutorialStore((x) => x.coach);
  const [coach, setCoach] = useState<BandKind | null>(null);
  const options = useMemo(() => (st !== null && pickPos !== null && targeting !== null ? targetOptions(st, seat, pickPos) : []), [st, seat, pickPos, targeting]);

  useEffect(() => {
    if (!selectable) setConfirmForfeit(false);
  }, [selectable]);

  useEffect(() => {
    setTargeting(null);
  }, [menu, pickPos, phase]);

  // the toggle resets after every submit: a new turn, another doubles position, any phase change
  const turn = st?.turn ?? 0;
  useEffect(() => {
    setArmed(false);
  }, [turn, pickPos, phase]);

  // the coach mark: the first time the toggle is enabled in the moves menu, once per kind per account
  useEffect(() => {
    if (offerKind === null || !offerOn || menu !== 'moves' || coached.includes(offerKind)) return;
    setCoach(offerKind);
    markCoached(accountId, offerKind);
  }, [offerKind, offerOn, menu, coached, accountId, markCoached]);
  useEffect(() => {
    if (!selectable) setCoach(null);
  }, [selectable]);

  /** a move from the grid: doubles single-target moves ask for their target first */
  const pickMove = (id: string): void => {
    const a = moveAction(id, undefined, armed);
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
    if (opts.length === 1) submit(moveAction(id, opts[0]!.ref, armed));
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
        setMenu(back);
        return;
      }
      if (e.key.toUpperCase() === TRANSFORM_KEY && menu === 'moves' && targeting === null) {
        if (offerOn) {
          e.preventDefault();
          setArmed((x) => !x);
        }
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
          const a = moveAction(targeting, o.ref, armed);
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
  }, [selectable, st, seat, menu, back, forced, runNow, catchWindow, confirmForfeit, runAction, targeting, options, pickPos, offerOn, armed]);

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
  /** the command a rail slab runs (the same as its root hotkey) */
  const command = (k: Menu | 'run'): void => {
    if (k === 'run') {
      if (runNow || confirmForfeit) submit(runAction);
      else setConfirmForfeit(true);
    } else if (k !== menu) setMenu(k);
  };
  const railDisabled = (k: Menu | 'run'): boolean => {
    if (!selectable) return true;
    if (forced) return k !== 'party';
    // challenge modes: Hardcore takes no bag items into battle (orbs still catch)
    if (k === 'bag' && hardcore) return true;
    return k === 'run' ? runWhy !== null : k === 'orbs' ? !st.sides[seat].canCatch : catchWindow;
  };
  const hints: Hint[] = !selectable
    ? []
    : menu === 'root'
      ? [['1–5', 'Command']]
      : menu === 'moves'
        ? targeting !== null
          ? [[`1–${Math.max(1, options.length)}`, 'Target'], ['Esc', 'Back']]
          : offer !== null && offer.enabled
            ? [['1–4', 'Move'], [TRANSFORM_KEY, FORM_KIND_NAME[offer.kind]], ['Esc', 'Commands']]
            : [['1–4', 'Move'], ['Esc', 'Commands']]
        : forced
          ? []
          : [['Esc', 'Back']];
  // the moves are home now: no Back button there (Esc still reaches the command hotkeys), only out of a target pick
  const showBack = selectable && menu !== 'root' && !forced && (menu !== 'moves' || targeting !== null);
  const showBackTo = selectable && backTo !== undefined;

  return (
    <div className={s.menu} data-testid="battlemenu" data-phase={phase} data-menu={menu}>
      <Ticker log={b.log} hints={hints} />
      {/* Broadcast UI: the command rail stays up in every menu; the active one is the orange slab */}
      <nav className={s.rail} aria-label="Battle commands">
        {ROOT.map((r, i) => {
          const on = selectable && r.key === menu;
          const label = r.key === 'run' ? runLabel : r.label;
          return (
            <button
              key={r.key}
              type="button"
              className={cx(s.cmd, on && s.on, r.key === 'run' && confirmForfeit && !runNow && s.confirm)}
              aria-current={on ? 'true' : undefined}
              aria-keyshortcuts={menu === 'root' ? String(i + 1) : undefined}
              disabled={railDisabled(r.key)}
              title={r.key === 'run' && runWhy !== null ? runWhy : undefined}
              onClick={() => command(r.key)}
            >
              <kbd className={cx(s.key, menu !== 'root' && s.keyIdle)}>{i + 1}</kbd>
              <span className={s.cmdLabel}>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className={cx(s.stage, menu === 'root' && s.stageRoot)}>
        {(status !== null || showBack || showBackTo) && (
          <div className={s.head}>
            {showBackTo && (
              <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => battleActions()?.undoPick?.()}>
                {`Back to ${displayName(backTo.creature)}`}
              </Button>
            )}
            {showBack && (
              <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => (targeting !== null ? setTargeting(null) : setMenu(back))}>
                Back
              </Button>
            )}
            {status !== null && <p className={s.prompt}>{status}</p>}
            {menu === 'moves' && targeting === null && offer !== null && (
              <TransformToggle offer={offer} armed={armed} pulse={coach === offer.kind} onToggle={() => setArmed((x) => !x)} />
            )}
          </div>
        )}
        {menu === 'moves' && coach !== null && offer !== null && coach === offer.kind && (
          <p className={s.coach} role="status" data-testid="transform-coach">
            <FormSigil kind={coach} size="sm" />
            {COACH_LINE[coach]}
          </p>
        )}
        {selectable && menu !== 'root' && (
          <div className={s.sub}>
            {menu === 'moves' && targeting === null && <Moves st={st} seat={seat} pos={pickPos} onPick={pickMove} />}
            {menu === 'moves' && targeting !== null && <Targets move={targeting} options={options} transform={armed} />}
            {menu === 'party' && <PartyList st={st} seat={seat} forced={forced} />}
            {menu === 'bag' && <Bag st={st} seat={seat} orbs={false} />}
            {menu === 'orbs' && <Bag st={st} seat={seat} orbs />}
          </div>
        )}
      </div>
    </div>
  );
}
