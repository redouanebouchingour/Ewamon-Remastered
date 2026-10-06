/**
 * The 56 px /play top bar (SPEC §20.9.2): brand + zone, the panel nav (NavLinks with unread counts), the money
 * counter (mono, tabular), the trainer level pip and the account menu.
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { BADGE_CASE } from '../data/badgeIcon';
import { zoneName } from '../data/content';
import { readyCount } from '../data/quests';
import { apiFetch, endSession } from '../net/api';
import { getRefreshToken } from '../net/tokens';
import { useRoomState } from '../net/useRoomState';
import { useNotificationsStore } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { cssVars } from '../ui/cssVars';
import { cx } from '../ui/cx';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import s from './TopBar.module.css';

export const NAV: readonly { readonly to: string; readonly label: string; readonly icon: IconName }[] = [
  { to: '/play/party', label: 'Party', icon: 'party' },
  { to: '/play/box', label: 'Box', icon: 'box' },
  { to: '/play/bag', label: 'Bag', icon: 'bag' },
  { to: '/play/dex', label: 'Dex', icon: 'dex' },
  { to: '/play/shop', label: 'Shop', icon: 'shop' },
  { to: '/play/social', label: 'Social', icon: 'social' },
  { to: '/play/guild', label: 'Guild', icon: 'guild' },
  { to: '/play/market', label: 'Market', icon: 'market' },
  { to: '/play/pass', label: 'Pass', icon: 'pass' },
  { to: '/play/quests', label: 'Quests', icon: 'quest' },
  { to: '/play/map', label: 'Map', icon: 'map' },
  { to: '/play/settings', label: 'Settings', icon: 'settings' },
];

/** Phase C4: the trainer's own pages live in the account menu (the nav row is full under 1400 px). */
export const ACCOUNT_LINKS: readonly { readonly to: string; readonly label: string; readonly icon: IconName }[] = [
  { to: '/play/profile', label: 'Profile', icon: 'user' },
  { to: '/play/rankings', label: 'Rankings', icon: 'trophy' },
  { to: '/play/history', label: 'History', icon: 'clock' },
];

export const formatMoney = (n: number): string => n.toLocaleString('en-US');

function useNavCounts(): Readonly<Record<string, number>> {
  const unread = useNotificationsStore((st) => Object.values(st.unreadDm).reduce((a, b) => a + b, 0));
  const requests = useNotificationsStore((st) => st.friendRequests);
  const claims = useNotificationsStore((st) => st.pendingBattlePassClaims);
  const quests = useSessionStore((st) => readyCount(st.progression));
  return { '/play/social': unread + requests, '/play/pass': claims, '/play/quests': quests };
}

function ZoneChip() {
  const zoneId = useSessionStore((st) => st.zoneId);
  const connection = useUiStore((st) => st.connection);
  const here = useRoomState((state) => state.players.size, 0);
  const label = connection === 'connected' ? (here > 1 ? `${here} here` : 'Connected') : connection === 'reconnecting' ? 'Reconnecting' : 'Offline';
  return (
    <div className={s.zone} title={`World connection: ${connection}`}>
      <span className={cx(s.dot, s[connection])} aria-hidden />
      <span className={s.zoneName}>{zoneName(zoneId)}</span>
      <span className={s.zoneMeta}>{label}</span>
    </div>
  );
}

function Wallet() {
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const level = useSessionStore((st) => st.progression?.trainerLevel ?? 1);
  const exp = useSessionStore((st) => st.progression?.trainerExp ?? 0);
  const frac = level >= 100 ? 1 : (exp % 1000) / 1000;
  return (
    <div className={s.wallet}>
      <span className={s.money} title="Money">
        <Icon name="coin" size="sm" className={s.coin} />
        <span className={s.moneyValue}>{formatMoney(money)}</span>
      </span>
      <span className={s.pip} style={cssVars({ '--p': frac })} title={`Trainer level ${level} · ${exp % 1000} / 1000 exp`}>
        <span className={s.pipInner}>{level}</span>
        <span className="visually-hidden">Trainer level {level}</span>
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
      <span className={s.badgeTitle}>Badges {earned.length} / 8</span>
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
    <div className={s.account}>
      <button type="button" className={s.accountBtn} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <span className={s.avatar} aria-hidden>
          {username.slice(0, 1).toUpperCase()}
        </span>
        <span className={s.username}>{username}</span>
        <Icon name="chevronDown" size="sm" />
      </button>
      {open && (
        <div className={s.menu} role="menu" onMouseLeave={() => setOpen(false)}>
          <BadgeCase />
          {ACCOUNT_LINKS.map((a) => (
            <button key={a.to} type="button" role="menuitem" className={s.menuItem} onClick={() => go(a.to)}>
              <Icon name={a.icon} size="sm" /> {a.label}
            </button>
          ))}
          <span className={s.menuRule} role="separator" />
          {isAdmin && (
            <button type="button" role="menuitem" className={s.menuItem} onClick={() => void navigate('/admin')}>
              <Icon name="shield" size="sm" /> Admin
            </button>
          )}
          <button type="button" role="menuitem" className={s.menuItem} onClick={() => void logout()}>
            <Icon name="logout" size="sm" /> Log out
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
      <div className={s.left}>
        <NavLink to="/play" end className={s.brand} aria-label="Back to the world">
          <span className={s.brandMark} aria-hidden>
            <Icon name="leaf" size="sm" />
          </span>
          Ewamon
        </NavLink>
        <ZoneChip />
      </div>
      <nav className={s.nav} aria-label="Menus">
        {NAV.map((n) => {
          const count = counts[n.to] ?? 0;
          return (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cx(s.link, isActive && s.active)} title={n.label}>
              <Icon name={n.icon} size="sm" />
              <span className={s.linkLabel}>{n.label}</span>
              {count > 0 && (
                <span className={s.count} aria-label={`${count} new`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className={s.right}>
        <Wallet />
        <Account />
      </div>
    </header>
  );
}
