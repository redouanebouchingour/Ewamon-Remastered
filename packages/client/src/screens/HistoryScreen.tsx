/**
 * Phase C4 `/play/history` — the player's own battle and trade logs (GET /history/battles, GET /history/trades; 25 a
 * page, newest first). Tabs bound to `?tab=battles|trades`, paging to `?page=`. Battles: result, opponent, format,
 * turns, rating change, rewards, when. Trades: partner (linked to the public profile), what went each way, when.
 */
import { Link, useLoaderData, useNavigation, useSearchParams } from 'react-router';
import { ARENA_KIND_LABELS } from '@ewa/protocol';
import type { BattleHistoryRow, TradeHistoryRow } from '@ewa/protocol';
import type { HistoryTab, historyLoader } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { itemInfo, speciesName } from '../data/content';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { Table } from '../ui/Table';
import type { TableColumn } from '../ui/Table';
import { Tabs } from '../ui/Tabs';
import s from './HistoryScreen.module.css';
import l from './layout.module.css';
import { relativeTime, useClosePanel } from './shared';

export const HISTORY_PAGE = 25;

type Result = BattleHistoryRow['result'];
const RESULT: Readonly<Record<Result, { readonly label: string; readonly tone: 'accent' | 'danger' | 'neutral' | 'info' }>> = {
  win: { label: 'Win', tone: 'neutral' },
  loss: { label: 'Loss', tone: 'danger' },
  draw: { label: 'Draw', tone: 'neutral' },
  fled: { label: 'Fled', tone: 'neutral' },
  caught: { label: 'Caught', tone: 'info' },
};

const FORMAT_LABEL: Readonly<Record<BattleHistoryRow['format'], string>> = { wild: 'Wild', trainer: 'Trainer', league: 'League', pvp: 'PvP', raid: 'Raid' };

/** Arena PvP: an arena battle names its kind ("Arena · Ranked"), every other battle its format. */
export function formatLabel(r: Pick<BattleHistoryRow, 'format' | 'arena'>): string {
  return r.arena !== undefined && r.arena !== null ? `Arena · ${ARENA_KIND_LABELS[r.arena]}` : FORMAT_LABEL[r.format];
}

function rewardsLine(r: BattleHistoryRow['rewards']): string {
  const parts: string[] = [];
  if (r.money !== 0) parts.push(`${r.money > 0 ? '+' : ''}${formatMoney(r.money)}`);
  if (r.trainerExp > 0) parts.push(`+${r.trainerExp} exp`);
  for (const [id, n] of Object.entries(r.items)) parts.push(`${itemInfo(id).name} ×${n}`);
  return parts.length === 0 ? '—' : parts.join(' · ');
}

function signed(n: number | null): string {
  if (n === null) return '—';
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

const battleColumns: TableColumn<BattleHistoryRow>[] = [
  { key: 'result', header: 'Result', width: 96, render: (r) => <Pill tone={RESULT[r.result].tone}>{RESULT[r.result].label}</Pill> },
  {
    key: 'opponent',
    header: 'Opponent',
    render: (r) => (
      <span className={s.cellStack}>
        <span className={s.strong}>{r.opponent}</span>
        <span className={l.caption}>
          {formatLabel(r)} · {r.turns} {r.turns === 1 ? 'turn' : 'turns'}
          {r.rewards.badge !== null && ' · badge earned'}
        </span>
      </span>
    ),
  },
  { key: 'rating', header: 'Rating', width: 80, align: 'end', render: (r) => <span className={r.ratingDelta !== null && r.ratingDelta < 0 ? s.down : r.ratingDelta !== null && r.ratingDelta > 0 ? s.up : l.mono}>{signed(r.ratingDelta)}</span> },
  { key: 'rewards', header: 'Rewards', render: (r) => <span className={s.rewards}>{rewardsLine(r.rewards)}</span> },
  { key: 'when', header: 'When', width: 120, align: 'end', render: (r) => <time className={l.caption} dateTime={r.happenedAt}>{relativeTime(r.happenedAt)}</time> },
];

function creaturesLine(list: TradeHistoryRow['sent'], money: number): string {
  const parts = list.map((c) => `${speciesName(c.speciesId)} Lv ${c.level}`);
  if (money > 0) parts.push(formatMoney(money));
  return parts.length === 0 ? 'Nothing' : parts.join(', ');
}

const tradeColumns: TableColumn<TradeHistoryRow>[] = [
  {
    key: 'partner',
    header: 'Partner',
    width: 180,
    render: (r) =>
      r.partnerUsername !== undefined && r.partnerUsername !== null ? (
        <Link to={`/play/players/${r.partnerUsername}`} className={s.link}>
          {r.partnerUsername}
        </Link>
      ) : (
        <span className={l.caption}>A departed trainer</span>
      ),
  },
  { key: 'sent', header: 'You gave', render: (r) => <span className={s.rewards}>{creaturesLine(r.sent, r.moneySent)}</span> },
  { key: 'received', header: 'You got', render: (r) => <span className={s.rewards}>{creaturesLine(r.received, r.moneyReceived)}</span> },
  { key: 'when', header: 'When', width: 120, align: 'end', render: (r) => <time className={l.caption} dateTime={r.completedAt}>{relativeTime(r.completedAt)}</time> },
];

export function HistoryScreen() {
  const close = useClosePanel();
  const data = useLoaderData<typeof historyLoader>();
  const navigation = useNavigation();
  const [, setParams] = useSearchParams();
  const refreshing = navigation.state === 'loading' && navigation.location.pathname === '/play/history';
  const count = data.tab === 'battles' ? data.battles.length : data.trades.length;
  const go = (tab: HistoryTab, page: number): void => setParams(page > 1 ? { tab, page: String(page) } : tab === 'battles' ? {} : { tab });

  return (
    <Panel
      title="History"
      eyebrow="Your record"
      subtitle="Every battle and trade the server recorded for you, newest first."
      onClose={close}
      refreshing={refreshing}
      toolbar={
        <Tabs<HistoryTab>
          label="History"
          tabs={[
            { key: 'battles', label: 'Battles' },
            { key: 'trades', label: 'Trades' },
          ]}
          value={data.tab}
          onChange={(k) => go(k, 1)}
        />
      }
    >
      <div className={l.stack}>
        {data.tab === 'battles' ? (
          <Table<BattleHistoryRow>
            caption="Battle history"
            columns={battleColumns}
            rows={data.battles}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState icon="sword" title={data.page > 1 ? 'No older battles' : 'No battles yet'} hint="Wild encounters, trainer fights and duels are logged here once they end." />}
          />
        ) : (
          <Table<TradeHistoryRow>
            caption="Trade history"
            columns={tradeColumns}
            rows={data.trades}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState icon="trade" title={data.page > 1 ? 'No older trades' : 'No trades yet'} hint="Send a trade request to a trainer in your zone from the Social panel." />}
          />
        )}
        {(data.page > 1 || count === HISTORY_PAGE) && (
          <nav className={s.pager} aria-label="Pages">
            <Button size="sm" variant="ghost" icon="chevronLeft" disabled={data.page <= 1} onClick={() => go(data.tab, data.page - 1)}>
              Newer
            </Button>
            <span className={l.mono}>Page {data.page}</span>
            <Button size="sm" variant="ghost" disabled={count < HISTORY_PAGE} onClick={() => go(data.tab, data.page + 1)}>
              Older
            </Button>
          </nav>
        )}
      </div>
    </Panel>
  );
}
