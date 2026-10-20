/**
 * Phase C4 `/play/rankings` — the leaderboard (GET /leaderboard?mode=&page=, 25 rows a page; banned players are
 * excluded server-side). Tabs per mode (Rating · Dex · Trainer level · Tower, Phase D14) bound to `?mode=`, the mode's column leads, the
 * player's own row is highlighted (Table `selectedKey`) with a "You" pill, and every name links to the public profile.
 * The ranks and numbers are the server's; nothing here re-sorts them. Phase D13: the ranked queue (RankedPanel) heads it.
 */
import { Link, useLoaderData, useNavigation, useSearchParams } from 'react-router';
import type { LeaderboardRow } from '@ewa/protocol';
import type { RankingMode, rankingsLoader } from '../app/loaders';
import { DEX_TOTAL } from '../data/content';
import { tierLabel } from '../data/trainer';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { Table } from '../ui/Table';
import type { TableColumn } from '../ui/Table';
import { Tabs } from '../ui/Tabs';
import l from './layout.module.css';
import { RankedPanel } from './RankedPanel';
import s from './RankingsScreen.module.css';
import { useClosePanel } from './shared';
import { TrainerAvatar } from './TrainerCard';

export const RANKINGS_PAGE = 25;

const MODE_TABS: readonly { readonly key: RankingMode; readonly label: string; readonly blurb: string }[] = [
  { key: 'rating', label: 'Rating', blurb: 'Ranked battle rating; ties go to the higher peak.' },
  { key: 'dex', label: 'Dex', blurb: 'Species caught.' },
  { key: 'trainerLevel', label: 'Trainer level', blurb: 'Trainer experience earned.' },
  // Phase D14: the battle tower (Solenne) — best streak; only trainers who have won a tower fight appear
  { key: 'towerStreak', label: 'Tower', blurb: 'Best battle tower streak; ties go to the longer run in progress.' },
  // the daily challenge: today's winners (UTC), fewest turns first; ties go to the earlier win
  { key: 'daily', label: 'Daily', blurb: "Today's daily challenge: fewest turns to win; ties go to the earlier win." },
  // challenge modes: cleared runs first (earliest), then runs still going, then failed ones, by badges
  { key: 'nuzlocke', label: 'Nuzlocke', blurb: 'Nuzlocke runs: cleared first, then the runs still going, then the failed, by badges.' },
  { key: 'hardcore', label: 'Hardcore', blurb: 'Hardcore runs: cleared first, then the runs still going, then the failed, by badges.' },
];

/** A challenge run's cell: its badges and how it stands. */
function runLabel(r: LeaderboardRow): string {
  const badges = `${r.challengeBadges ?? 0} ${r.challengeBadges === 1 ? 'badge' : 'badges'}`;
  return r.challengeState === 'cleared' ? `Cleared · ${badges}` : r.challengeState === 'failed' ? `Failed · ${badges}` : badges;
}

function columns(mode: RankingMode, myId: string | null): TableColumn<LeaderboardRow>[] {
  const metric: Record<RankingMode, TableColumn<LeaderboardRow>> = {
    rating: { key: 'rating', header: 'Rating', width: 96, align: 'end', render: (r) => <span className={l.mono}>{r.rating}</span> },
    dex: { key: 'dex', header: 'Caught', width: 110, align: 'end', render: (r) => <span className={l.mono}>{r.dexCaughtCount} / {DEX_TOTAL}</span> },
    trainerLevel: { key: 'trainerLevel', header: 'Level', width: 80, align: 'end', render: (r) => <span className={l.mono}>{r.trainerLevel}</span> },
    towerStreak: { key: 'towerStreak', header: 'Streak', width: 96, align: 'end', render: (r) => <span className={l.mono}>{r.towerBest ?? 0}</span> },
    nuzlocke: { key: 'nuzlocke', header: 'Run', width: 150, align: 'end', render: (r) => <span className={l.mono}>{runLabel(r)}</span> },
    hardcore: { key: 'hardcore', header: 'Run', width: 150, align: 'end', render: (r) => <span className={l.mono}>{runLabel(r)}</span> },
    daily: {
      key: 'daily',
      header: 'Turns',
      width: 180,
      align: 'end',
      render: (r) => (
        <span className={l.mono}>
          {r.dailyTurns ?? '-'} <span className={s.dim}>{r.dailyMarks ?? ''}</span>
        </span>
      ),
    },
  };
  const rest = (['rating', 'dex', 'trainerLevel'] as const).filter((k) => k !== mode).map((k) => ({ ...metric[k], render: (r: LeaderboardRow) => <span className={s.dim}>{metric[k].render(r)}</span> }));
  return [
    { key: 'rank', header: '#', width: 64, render: (r) => <span className={r.rank <= 3 ? s.rankTop : s.rank}>{r.rank}</span> },
    {
      key: 'trainer',
      header: 'Trainer',
      render: (r) => (
        <span className={s.trainer}>
          <TrainerAvatar username={r.username} size="sm" />
          <span className={s.trainerText}>
            <span className={s.nameRow}>
              <Link to={`/play/players/${r.username}`} className={s.name}>
                {r.username}
              </Link>
              {r.guildTag !== null && <span className={s.guild}>[{r.guildTag}]</span>}
              {r.id === myId && <Pill tone="info">You</Pill>}
            </span>
            <span className={l.caption}>{r.title}</span>
          </span>
        </span>
      ),
    },
    { key: 'tier', header: 'Tier', width: 104, render: (r) => <span className={s.tier}>{tierLabel(r.tier)}</span> },
    metric[mode],
    ...rest,
  ];
}

export function RankingsScreen() {
  const close = useClosePanel();
  const data = useLoaderData<typeof rankingsLoader>();
  const navigation = useNavigation();
  const [, setParams] = useSearchParams();
  const myId = useSessionStore((st) => st.profile?.id ?? null);
  const refreshing = navigation.state === 'loading' && navigation.location.pathname === '/play/rankings';
  const mine = data.rows.find((r) => r.id === myId);
  const tab = MODE_TABS.find((t) => t.key === data.mode) ?? MODE_TABS[0]!;
  const go = (mode: RankingMode, page: number): void => setParams(page > 1 ? { mode, page: String(page) } : mode === 'rating' ? {} : { mode });

  return (
    <Panel
      title="Rankings"
      eyebrow="Leaderboard"
      subtitle={tab.blurb}
      onClose={close}
      refreshing={refreshing}
      toolbar={<Tabs<RankingMode> label="Ranking" tabs={MODE_TABS.map((t) => ({ key: t.key, label: t.label }))} value={data.mode} onChange={(k) => go(k, 1)} />}
    >
      <div className={l.stack}>
        {/* arena PvP: the out-of-world modes (Ranked at Lv 50 among them) live on the PvP screen */}
        <div className={s.pvp} data-testid="rankings-pvp">
          <span className={s.pvpText}>
            <b className={s.pvpTitle}>Arena PvP</b>
            <span className={l.caption}>Ranked at Lv 50, Level 50, the Weekly Cup, training and friend battles — from anywhere.</span>
          </span>
          <Link to="/play/pvp" className={s.pvpLink}>
            Open PvP
          </Link>
        </div>
        {/* Phase D13: the ranked queue sits above the boards */}
        <RankedPanel />
        <p className={l.caption} aria-live="polite">
          {mine !== undefined ? `You are #${mine.rank} on this board.` : data.rows.length > 0 ? 'You are not on this page.' : ''}
        </p>
        <Table<LeaderboardRow>
          caption={`Leaderboard by ${tab.label.toLowerCase()}`}
          columns={columns(data.mode, myId)}
          rows={data.rows}
          rowKey={(r) => r.id}
          selectedKey={mine?.id ?? null}
          empty={<EmptyState icon="trophy" title={data.page > 1 ? 'No trainers this far down' : 'No trainers ranked yet'} hint="Battle, catch and level up to appear here." />}
        />
        {(data.page > 1 || data.rows.length === RANKINGS_PAGE) && (
          <nav className={s.pager} aria-label="Pages">
            <Button size="sm" variant="ghost" icon="chevronLeft" disabled={data.page <= 1} onClick={() => go(data.mode, data.page - 1)}>
              Previous
            </Button>
            <span className={l.mono}>Page {data.page}</span>
            <Button size="sm" variant="ghost" disabled={data.rows.length < RANKINGS_PAGE} onClick={() => go(data.mode, data.page + 1)}>
              Next
            </Button>
          </nav>
        )}
      </div>
    </Panel>
  );
}
