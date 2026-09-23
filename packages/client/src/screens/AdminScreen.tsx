/**
 * `/admin` (SPEC §20.9.12). Not a /play child — no canvas; admins moderate from a plain page. Stats cards (total,
 * banned, online), process metrics (`GET /admin/metrics`), a player search Table (`?q=&page=`) with Ban / Unban
 * requiring a reason (1..200). 403 / non-admin → redirect('/play') in the loader. `/admin/stats` and
 * `/admin/players` are server part 2: their 404 renders a "not live yet" card; ban/unban by username works today.
 */
import { useState } from 'react';
import { Link, useLoaderData, useNavigation, useSearchParams } from 'react-router';
import type { adminLoader } from '../app/loaders';
import { NotificationHost } from '../app/NotificationHost';
import { zoneName } from '../data/content';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/Pill';
import { Skeleton } from '../ui/Skeleton';
import { Table } from '../ui/Table';
import s from './AdminScreen.module.css';
import l from './layout.module.css';
import { relativeTime, useIntent } from './shared';

type PlayerRow = { readonly username: string; readonly email: string; readonly isAdmin: boolean; readonly bannedAt: string | null; readonly banReason: string | null; readonly lastSeenAt: string; readonly id: string };

function Stat({ label, value, tone }: { readonly label: string; readonly value: string | number; readonly tone?: 'danger' | 'accent' }) {
  return (
    <div className={s.stat}>
      <span className={l.kvLabel}>{label}</span>
      <span className={tone === 'danger' ? s.statDanger : tone === 'accent' ? s.statAccent : s.statValue}>{value}</span>
    </div>
  );
}

export function AdminScreen() {
  const { q, stats, players, metrics } = useLoaderData<typeof adminLoader>();
  const navigation = useNavigation();
  const [, setParams] = useSearchParams();
  const fetcher = useIntent('/admin');
  const [search, setSearch] = useState(q);
  const [target, setTarget] = useState<{ readonly username: string; readonly ban: boolean } | null>(null);
  const [manualName, setManualName] = useState('');
  const [reason, setReason] = useState('');
  const loading = navigation.state === 'loading';

  const submitModeration = (): void => {
    if (target === null || reason.trim().length === 0) return;
    fetcher.submit({ intent: target.ban ? 'ban' : 'unban', username: target.username, reason: reason.trim() });
    setTarget(null);
    setReason('');
  };

  return (
    <div className={s.page} data-testid="admin">
      <header className={s.header}>
        <div className={l.row}>
          <span className={s.mark} aria-hidden>
            <Icon name="shield" size="sm" />
          </span>
          <h1 className={s.title}>Moderation</h1>
        </div>
        <Link to="/play" className={s.back}>
          <Icon name="chevronLeft" size="sm" /> Back to world
        </Link>
      </header>

      <main className={s.main}>
        <section className={s.stats} aria-label="Player stats">
          {stats.available ? (
            <>
              <Stat label="Players" value={stats.data.total} />
              <Stat label="Banned" value={stats.data.banned} tone="danger" />
              <Stat label="Verified" value={typeof stats.data['verified'] === 'number' ? (stats.data['verified'] as number) : '—'} />
              <Stat label="Online" value={stats.data.online} tone="accent" />
            </>
          ) : (
            <div className={s.statsNote}>Player totals arrive with the server's admin update (GET /admin/stats is not live yet).</div>
          )}
          {metrics.available && (
            <>
              <Stat label="Rooms" value={metrics.data.rooms.length} />
              <Stat label="Heap" value={`${Math.round(metrics.data.heapMb)} MB`} />
            </>
          )}
        </section>

        <div className={s.grid}>
          <section className={s.card}>
            <div className={l.rowBetween}>
              <h2 className={l.h3}>Players</h2>
              <form
                className={s.searchRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  setParams(search.trim().length > 0 ? { q: search.trim() } : {});
                }}
              >
                <TextField label="Search players" hideLabel icon="search" type="search" placeholder="Username" value={search} onChange={setSearch} maxLength={20} />
                <Button type="submit">Search</Button>
              </form>
            </div>
            {!players.available ? (
              <EmptyState icon="search" tone="unavailable" title="Player search is not live yet" hint="Use Ban / Unban by username on the right in the meantime." />
            ) : loading ? (
              <Skeleton shape="table" count={6} />
            ) : (
              <Table<PlayerRow>
                caption="Players"
                columns={[
                  {
                    key: 'user',
                    header: 'Player',
                    render: (p) => (
                      <span className={l.stack}>
                        <span className={s.username}>
                          {p.username} {p.isAdmin && <Pill tone="info">admin</Pill>}
                        </span>
                        <span className={l.caption}>{p.email}</span>
                      </span>
                    ),
                  },
                  { key: 'seen', header: 'Last seen', width: 140, render: (p) => <span className={l.caption}>{relativeTime(p.lastSeenAt)}</span> },
                  {
                    key: 'status',
                    header: 'Status',
                    width: 200,
                    render: (p) => (p.bannedAt !== null ? <span title={p.banReason ?? ''}><Pill tone="danger">Banned</Pill></span> : <Pill>Active</Pill>),
                  },
                  {
                    key: 'act',
                    header: '',
                    width: 110,
                    align: 'end',
                    render: (p) =>
                      p.isAdmin ? null : (
                        <Button size="sm" variant={p.bannedAt !== null ? 'secondary' : 'danger'} onClick={() => setTarget({ username: p.username, ban: p.bannedAt === null })}>
                          {p.bannedAt !== null ? 'Unban' : 'Ban'}
                        </Button>
                      ),
                  },
                ]}
                rows={players.data.rows}
                rowKey={(p) => p.id}
                empty={<EmptyState icon="search" title="No players match." hint="Try a shorter username." />}
              />
            )}
          </section>

          <aside className={s.side}>
            <section className={s.card}>
              <h2 className={l.h3}>Ban or unban</h2>
              <p className={l.muted}>Every action needs a reason and is written to the audit log.</p>
              <TextField label="Username" value={manualName} onChange={setManualName} maxLength={20} />
              <div className={l.row}>
                <Button variant="danger" disabled={manualName.trim().length < 3} onClick={() => setTarget({ username: manualName.trim(), ban: true })}>
                  Ban
                </Button>
                <Button disabled={manualName.trim().length < 3} onClick={() => setTarget({ username: manualName.trim(), ban: false })}>
                  Unban
                </Button>
              </div>
            </section>
            <section className={s.card}>
              <h2 className={l.h3}>Rooms</h2>
              {!metrics.available ? (
                <p className={l.muted}>Metrics unavailable.</p>
              ) : metrics.data.rooms.length === 0 ? (
                <p className={l.muted}>No zone rooms are open.</p>
              ) : (
                <ul className={s.rooms}>
                  {metrics.data.rooms.map((r) => (
                    <li key={r.roomId} className={s.room}>
                      <span className={s.username}>{zoneName(r.zoneId)}</span>
                      <span className={l.caption}>shard {r.shard}</span>
                      <span className={l.mono}>{r.players} online</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>

      <Modal
        open={target !== null}
        size="sm"
        title={target === null ? '' : `${target.ban ? 'Ban' : 'Unban'} ${target.username}?`}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant={target?.ban === true ? 'danger' : 'primary'} disabled={reason.trim().length === 0} busy={fetcher.busy()} onClick={submitModeration}>
              {target?.ban === true ? 'Ban player' : 'Unban player'}
            </Button>
          </>
        }
      >
        <TextField label="Reason" value={reason} onChange={setReason} maxLength={200} counterFrom={160} autoFocus hint="1 to 200 characters." />
      </Modal>
      <NotificationHost />
    </div>
  );
}
