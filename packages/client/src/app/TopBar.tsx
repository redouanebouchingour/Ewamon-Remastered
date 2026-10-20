/**
 * The 56 px /play top bar (SPEC §20.9.2), Broadcast strip (2026-10-11): the brand as a black slab with an orange
 * edge block, the zone, the panel nav — five primary links (Party · Bag · Dex · Map · Quests, each with its key chip
 * where a shell hotkey exists) and a "More" disclosure for the rest (Box · Shop · Social · Guild · Market · Pass ·
 * Settings; their unread counts roll up onto More) — then money, trainer level, badges and the account menu as
 * condensed numbers on the right.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { BADGE_CASE } from '../data/badgeIcon';
import { zoneName } from '../data/content';
import { readyCount } from '../data/quests';
import { apiFetch, endSession } from '../net/api';
import { getRefreshToken } from '../net/tokens';
import { useRoomState } from '../net/useRoomState';
import { ARENA_KIND_LABELS } from '@ewa/protocol';
import { leaveArenaQueue } from './arena';
import { levelLabel, useArenaStore } from '../state/arena';
import { formatElapsed } from '../state/ranked';
import { useNotificationsStore } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import type { InputAction } from '../state/settings';
import { useUiStore } from '../state/ui';
import { cssVars } from '../ui/cssVars';
import { keyGlyph } from '../world/TutorialCard';
import { cx } from '../ui/cx';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import s from './TopBar.module.css';
import { CHALLENGE_LABELS, challengeOf } from '@ewa/content';
import type { ChallengeMode, ChallengeState } from '@ewa/content';
import { Pill } from '../ui/Pill';
import { formatPlayMs } from '../data/speedrun';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  /** in the bar itself; the rest live in the More menu */
  readonly primary: boolean;
  /** the shell hotkey that opens it (PlayShell `useShellHotkeys`), shown as a key chip */
  readonly action?: InputAction;
}

/** Every /play panel the nav reaches: the five primary links first, then the More menu in its order. */
export const NAV: readonly NavItem[] = [
  { to: '/play/party', label: 'Party', icon: 'party', primary: true, action: 'party' },
  { to: '/play/bag', label: 'Bag', icon: 'bag', primary: true, action: 'bag' },
  { to: '/play/dex', label: 'Dex', icon: 'dex', primary: true, action: 'journal' },
  { to: '/play/map', label: 'Map', icon: 'map', primary: true, action: 'map' },
  { to: '/play/quests', label: 'Quests', icon: 'quest', primary: true },
  // arena PvP: queues, the Weekly Cup, training and friend challenges (K)
  { to: '/play/pvp', label: 'PvP', icon: 'sword', primary: false, action: 'pvp' },
  { to: '/play/box', label: 'Box', icon: 'box', primary: false },
  { to: '/play/shop', label: 'Shop', icon: 'shop', primary: false },
  { to: '/play/social', label: 'Social', icon: 'social', primary: false },
  { to: '/play/guild', label: 'Guild', icon: 'guild', primary: false },
  { to: '/play/market', label: 'Market', icon: 'market', primary: false },
  { to: '/play/pass', label: 'Pass', icon: 'pass', primary: false },
  // Escape opens Settings from the bare world (PlayShell)
  { to: '/play/settings', label: 'Settings', icon: 'settings', primary: false, action: 'pause' },
];

export const NAV_PRIMARY: readonly NavItem[] = NAV.filter((n) => n.primary);
export const NAV_MORE: readonly NavItem[] = NAV.filter((n) => !n.primary);

/** Phase C4: the trainer's own pages live in the account menu. */
export const ACCOUNT_LINKS: readonly { readonly to: string; readonly label: string; readonly icon: IconName }[] = [
  { to: '/play/profile', label: 'Profile', icon: 'user' },
  { to: '/play/rankings', label: 'Rankings', icon: 'trophy' },
  { to: '/play/history', label: 'History', icon: 'clock' },
];

export const formatMoney = (n: number): string => n.toLocaleString('en-US');

/** A KeyboardEvent.code as a key chip label (KeyP → P, Escape → Esc, ArrowUp → ↑), as the tutorial card spells keys. */
export const keyLabel = (code: string | undefined): string => (code === undefined ? '' : keyGlyph(code));

function useNavCounts(): Readonly<Record<string, number>> {
  const unread = useNotificationsStore((st) => Object.values(st.unreadDm).reduce((a, b) => a + b, 0));
  const requests = useNotificationsStore((st) => st.friendRequests);
  const claims = useNotificationsStore((st) => st.pendingBattlePassClaims);
  const quests = useSessionStore((st) => readyCount(st.progression));
  return { '/play/social': unread + requests, '/play/pass': claims, '/play/quests': quests };
}

const countText = (n: number): string => (n > 99 ? '99+' : String(n));

function Count({ n }: { readonly n: number }) {
  if (n <= 0) return null;
  return (
    <span className={s.count} aria-label={`${n} new`}>
      {countText(n)}
    </span>
  );
}

function KeyChip({ action }: { readonly action: InputAction | undefined }) {
  const code = useSettingsStore((st) => (action === undefined ? undefined : st.keybinds[action][0]));
  if (code === undefined) return null;
  return (
    <kbd className={s.key} aria-hidden>
      {keyLabel(code)}
    </kbd>
  );
}

/** Closes a popover on Escape (focus back to its button) and on a pointer press outside it. */
function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>, button: RefObject<HTMLButtonElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // the menu owns this Escape: an open panel behind it must not close too
      e.preventDefault();
      e.stopPropagation();
      close();
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent): void => {
      if (root.current !== null && e.target instanceof Node && !root.current.contains(e.target)) close();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, close, root, button]);
}

/** ↑/↓ (and Home/End) move focus between a popover's items. */
function onListKeys(e: ReactKeyboardEvent<HTMLElement>, selector: string): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)];
  if (items.length === 0) return;
  e.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
  items[next]?.focus();
}

function ZoneChip() {
  const zoneId = useSessionStore((st) => st.zoneId);
  const connection = useUiStore((st) => st.connection);
  const here = useRoomState((state) => state.players.size, 0);
  // arena PvP: the arena replaces the zone (the zone id is where the player returns)
  const arena = useArenaStore((st) => (st.inArena ? (st.match === null ? 'Arena' : `Arena · ${levelLabel(st.match.level)}`) : null));
  const label = connection === 'connected' ? (arena !== null ? 'Connected' : here > 1 ? `${here} here` : 'Connected') : connection === 'reconnecting' ? 'Reconnecting' : 'Offline';
  return (
    <div className={s.zone} title={`World connection: ${connection}`}>
      <span className={s.zoneName}>{arena ?? zoneName(zoneId)}</span>
      <span className={s.zoneMeta}>
        <span className={cx(s.dot, s[connection])} aria-hidden />
        {label}
      </span>
    </div>
  );
}

/** Challenge modes: the run, beside the zone (Nuzlocke / Hardcore, and Cleared / Failed once it ended). */
function ChallengeChip() {
  const run = useSessionStore((st) => {
    const r = challengeOf(st.progression?.flags ?? []);
    return r === null ? null : `${r.mode}:${r.state}`;
  });
  if (run === null) return null;
  const [mode, state] = run.split(':') as [ChallengeMode, ChallengeState];
  const name = CHALLENGE_LABELS[mode].name;
  return (
    <span className={s.challenge} data-testid="challenge-chip">
      <Pill tone={state === 'failed' ? 'danger' : state === 'cleared' ? 'info' : 'neutral'} title={CHALLENGE_LABELS[mode].rules}>
        {state === 'active' ? name : `${name} · ${state === 'cleared' ? 'Cleared' : 'Failed'}`}
      </Pill>
    </span>
  );
}

/**
 * Verified speedruns: the server's play clock (GET /speedrun, refetched on every (re)connect), counted on locally
 * each second while it runs and the world is connected. Off unless Settings asks for it.
 */
function SpeedrunChip() {
  const on = useSettingsStore((st) => st.accessibility.speedrunTimer);
  const connected = useUiStore((st) => st.connection === 'connected');
  const [base, setBase] = useState<{ readonly ms: number; readonly running: boolean; readonly at: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on || !connected) return;
    const ctl = new AbortController();
    apiFetch('speedrun', { signal: ctl.signal })
      .then((r) => setBase({ ms: r.finishMs ?? r.playMs, running: r.finishMs === null && r.running, at: Date.now() }))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [on, connected]);
  useEffect(() => {
    if (!on || base === null || !base.running || !connected) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on, base, connected]);
  if (!on || base === null) return null;
  const ms = base.running && connected ? base.ms + (Date.now() - base.at) : base.ms;
  return (
    <span className={s.speedrun} data-testid="speedrun-chip" title="Play time, as the server counts it">
      {formatPlayMs(ms)}
    </span>
  );
}

/** Arena PvP: the queue the player is in, anywhere (elapsed time; opens PvP; × leaves it). */
function QueueChip() {
  const kind = useArenaStore((st) => (st.status.state === 'queued' && !st.inArena ? st.status.kind : null));
  const queuedAt = useArenaStore((st) => st.queuedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (kind === null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [kind]);
  if (kind === null) return null;
  return (
    <div className={s.queue} data-testid="queuechip">
      <NavLink to="/play/pvp" className={s.queueLink} title={`Searching for a ${ARENA_KIND_LABELS[kind]} match — open PvP`}>
        <span className={s.queueLabel}>{ARENA_KIND_LABELS[kind]}</span>
        <span className={s.queueTime}>{formatElapsed(now - queuedAt)}</span>
      </NavLink>
      <button type="button" className={s.queueLeave} aria-label="Leave the queue" onClick={() => void leaveArenaQueue()}>
        <Icon name="close" size="sm" />
      </button>
    </div>
  );
}

function MoreMenu({ counts }: { readonly counts: Readonly<Record<string, number>> }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);
  // a route change (a link chosen, a hotkey) closes it
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('a')?.focus();
  }, [open]);
  const total = NAV_MORE.reduce((sum, n) => sum + (counts[n.to] ?? 0), 0);
  const current = NAV_MORE.find((n) => location.pathname.startsWith(n.to)) ?? null;
  return (
    <div className={s.more} ref={root}>
      <button
        ref={button}
        type="button"
        className={cx(s.link, s.moreBtn, current !== null && s.active)}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.linkInner}>
          <span className={s.linkLabel}>More</span>
          <Count n={total} />
          <Icon name="chevronDown" size="sm" className={s.chevron} />
        </span>
        {current !== null && <span className="visually-hidden"> (current: {current.label})</span>}
      </button>
      {open && (
        <ul id={listId} ref={list} className={s.menu} aria-label="More menus" onKeyDown={(e) => onListKeys(e, 'a')}>
          {NAV_MORE.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} className={({ isActive }) => cx(s.menuItem, isActive && s.menuItemActive)} onClick={close}>
                <Icon name={n.icon} size="sm" />
                <span className={s.menuLabel}>{n.label}</span>
                <Count n={counts[n.to] ?? 0} />
                <KeyChip action={n.action} />
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Wallet() {
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const level = useSessionStore((st) => st.progression?.trainerLevel ?? 1);
  const exp = useSessionStore((st) => st.progression?.trainerExp ?? 0);
  const badges = useSessionStore((st) => st.progression?.badges.length ?? 0);
  const frac = level >= 100 ? 1 : (exp % 1000) / 1000;
  return (
    <div className={s.wallet}>
      <span className={s.stat} title="Money">
        <span className={s.coin} aria-hidden />
        <span className={s.statValue}>{formatMoney(money)}</span>
        <span className="visually-hidden"> money</span>
      </span>
      <span className={s.stat} title={`Trainer level ${level} · ${exp % 1000} / 1000 exp`}>
        <span className={s.statLabel}>Trainer</span>
        <span className={s.levelBox}>
          <span className={s.statValue}>{level}</span>
          <span className={s.expTrack} aria-hidden>
            <span className={s.expFill} style={cssVars({ '--p': frac })} />
          </span>
        </span>
        <span className="visually-hidden">Trainer level {level}</span>
      </span>
      <span className={s.stat} title={`${badges} of 8 badges`}>
        <span className={s.statValue}>
          {badges}
          <span className={s.statOf}>/8</span>
        </span>
        <span className={s.statLabel}>Badges</span>
      </span>
    </div>
  );
}

const NO_BADGES: readonly string[] = [];

/** The eight gym badges; earned ones come only from the session store (progressionDelta / GET /me). */
function BadgeCase() {
  const earned = useSessionStore((st) => st.progression?.badges ?? NO_BADGES);
  return (
    <div className={s.badgeCase} aria-label={`${earned.length} of 8 badges`}>
      <span className={s.badgeTitle}>
        Badges <b className={s.badgeCount}>{earned.length} / 8</b>
      </span>
      <div className={s.badgeRow}>
        {BADGE_CASE.map((b) => {
          const has = earned.includes(b.id);
          return (
            <span key={b.id} className={cx(s.badge, has && s.badgeEarned)} data-type={b.type} title={has ? b.name : `${b.name} — not earned`}>
              {b.glyph}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Account() {
  const username = useSessionStore((st) => st.profile?.username ?? '');
  const isAdmin = useSessionStore((st) => st.profile?.isAdmin ?? false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  const navigate = useNavigate();
  const go = (to: string): void => {
    setOpen(false);
    void navigate(to);
  };
  const logout = async (): Promise<void> => {
    const refresh = getRefreshToken();
    if (refresh !== null) await apiFetch('authLogout', { body: { refresh } }).catch(() => undefined);
    endSession();
    void navigate('/login', { replace: true });
  };
  return (
    <div className={s.account} ref={root}>
      <button ref={button} type="button" className={s.accountBtn} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <span className={s.avatar} aria-hidden>
          {username.slice(0, 1).toUpperCase()}
        </span>
        <span className={s.username}>{username}</span>
        <Icon name="chevronDown" size="sm" className={s.chevron} />
      </button>
      {open && (
        <div className={s.menu} role="menu" onKeyDown={(e) => onListKeys(e, '[role="menuitem"]')}>
          <BadgeCase />
          {ACCOUNT_LINKS.map((a) => (
            <button key={a.to} type="button" role="menuitem" className={s.menuItem} onClick={() => go(a.to)}>
              <Icon name={a.icon} size="sm" />
              <span className={s.menuLabel}>{a.label}</span>
            </button>
          ))}
          <span className={s.menuRule} role="separator" />
          {isAdmin && (
            <button type="button" role="menuitem" className={s.menuItem} onClick={() => void navigate('/admin')}>
              <Icon name="shield" size="sm" />
              <span className={s.menuLabel}>Admin</span>
            </button>
          )}
          <button type="button" role="menuitem" className={s.menuItem} onClick={() => void logout()}>
            <Icon name="logout" size="sm" />
            <span className={s.menuLabel}>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const counts = useNavCounts();
  return (
    <header className={s.bar} data-testid="topbar">
      <NavLink to="/play" end className={s.brand} aria-label="Back to the world">
        <span className={s.brandEdge} aria-hidden />
        <span className={s.brandSlab}>Ewamon</span>
      </NavLink>
      <ZoneChip />
      <ChallengeChip />
      <SpeedrunChip />
      <QueueChip />
      <nav className={s.nav} aria-label="Menus">
        {NAV_PRIMARY.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => cx(s.link, isActive && s.active)}>
            <span className={s.linkInner}>
              <KeyChip action={n.action} />
              <span className={s.linkLabel}>{n.label}</span>
              <Count n={counts[n.to] ?? 0} />
            </span>
          </NavLink>
        ))}
        <MoreMenu counts={counts} />
      </nav>
      <div className={s.right}>
        <Wallet />
        <Account />
      </div>
    </header>
  );
}
