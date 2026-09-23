/**
 * `/play/guild` (SPEC §20.9.8). No guild: search (`?q=`) and the create form side by side — name 3..24, tag
 * `[A-Z0-9]{3,4}` validated live, the 5 000 founding cost on the button and "Not enough" under it when short. The
 * member view (header, MOTD, member table with role actions, Leave) renders from `GET /guilds/:id` once the server
 * exposes the player's guild. `GET /guilds` 404 (server part 2) → a "not live yet" state.
 */
import { useState } from 'react';
import { useLoaderData, useNavigation, useSearchParams } from 'react-router';
import { GUILD_TAG_RE } from '@ewa/protocol';
import type { GuildView } from '@ewa/protocol';
import type { guildLoader } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import { Table } from '../ui/Table';
import l from './layout.module.css';
import s from './GuildScreen.module.css';
import { useClosePanel, useIntent } from './shared';
import { Unavailable } from './Unavailable';

/** Display only: the server's GUILD.createCost (persist GUILD_CREATE_COST) decides; 409 InsufficientFunds otherwise. */
export const GUILD_FOUNDING_COST = 5000;

export function GuildScreen() {
  const close = useClosePanel();
  const { q, guilds } = useLoaderData<typeof guildLoader>();
  const navigation = useNavigation();
  const [, setParams] = useSearchParams();
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const fetcher = useIntent('/play/guild');
  const [search, setSearch] = useState(q);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const loading = navigation.state === 'loading' && navigation.location.pathname === '/play/guild';

  if (!guilds.available) {
    return (
      <Panel title="Guild" eyebrow="Companions" onClose={close}>
        <Unavailable icon="guild" feature="Guilds" hint="Founding, joining and guild chat arrive with the server's social update." />
      </Panel>
    );
  }

  const nameError = name.length > 0 && (name.trim().length < 3 || name.trim().length > 24) ? 'Use 3 to 24 characters.' : null;
  const tagUpper = tag.toUpperCase();
  const tagError = tag.length > 0 && !GUILD_TAG_RE.test(tagUpper) ? '3–4 capital letters or digits.' : null;
  const short = money < GUILD_FOUNDING_COST;
  const canCreate = !short && name.trim().length >= 3 && nameError === null && GUILD_TAG_RE.test(tagUpper);

  return (
    <Panel title="Guild" eyebrow="Companions" subtitle="Band together with other trainers under one tag." onClose={close}>
      <div className={s.layout}>
        <section className={l.section}>
          <form
            className={s.searchRow}
            onSubmit={(e) => {
              e.preventDefault();
              setParams(search.trim().length > 0 ? { q: search.trim() } : {});
            }}
          >
            <TextField label="Search guilds" hideLabel icon="search" type="search" placeholder="Search guilds by name" value={search} onChange={setSearch} maxLength={24} className={l.grow} />
            <Button type="submit">Search</Button>
          </form>
          {loading ? (
            <Skeleton shape="table" count={5} />
          ) : (
            <Table<GuildView>
              caption="Guilds"
              columns={[
                {
                  key: 'name',
                  header: 'Guild',
                  render: (g) => (
                    <span className={s.guildName}>
                      <span className={s.tag}>{g.tag}</span>
                      {g.name}
                    </span>
                  ),
                },
                { key: 'motd', header: 'Message of the day', render: (g) => <span className={l.caption}>{g.motd || '—'}</span> },
                { key: 'members', header: 'Members', width: 100, align: 'end', render: (g) => <span className={l.mono}>{g.memberCount} / 50</span> },
                {
                  key: 'join',
                  header: '',
                  width: 96,
                  align: 'end',
                  render: (g) => (
                    <Button size="sm" disabled={g.memberCount >= 50} busy={fetcher.busy((p) => p.intent === 'join' && p['id'] === g.id)} onClick={() => fetcher.submit({ intent: 'join', id: g.id })}>
                      Join
                    </Button>
                  ),
                },
              ]}
              rows={guilds.data}
              rowKey={(g) => g.id}
              empty={<EmptyState icon="guild" title="No guilds match." hint="Try another name, or found your own." />}
            />
          )}
        </section>
        <aside className={s.create}>
          <h3 className={l.h3}>Found a guild</h3>
          <p className={l.muted}>You become its leader. The founding fee is paid once.</p>
          <TextField label="Name" value={name} onChange={setName} maxLength={24} error={nameError} placeholder="The Mire Wardens" />
          <TextField label="Tag" value={tagUpper} onChange={(v) => setTag(v.toUpperCase())} maxLength={4} error={tagError} hint="Shown beside your name in the world." placeholder="MIRE" />
          <div className={s.createFoot}>
            <Button
              variant="primary"
              size="lg"
              icon="coin"
              disabled={!canCreate}
              busy={fetcher.busy((p) => p.intent === 'create')}
              onClick={() => fetcher.submit({ intent: 'create', name: name.trim(), tag: tagUpper })}
            >
              Found for {formatMoney(GUILD_FOUNDING_COST)}
            </Button>
            {short && <p className={s.short}>Not enough — you have {formatMoney(money)}.</p>}
          </div>
        </aside>
      </div>
    </Panel>
  );
}
