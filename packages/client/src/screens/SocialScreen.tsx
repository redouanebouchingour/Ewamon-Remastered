/**
 * `/play/social` (SPEC §20.9.7). Left 320 px: tabs Friends · Requests (n) · Nearby. Friends show online state and
 * unread DM counts, each row with Message · Challenge · Trade (the latter two only when that player is in this
 * zone — `room.state.players.has(id)` read through useRoomState). Right: the DM thread (`/play/social/:username`,
 * the nested route) or a prompt. `GET /friends` 404 (server part 2) → a "not live yet" state; Nearby still works
 * from the replicated room state.
 */
import { useState } from 'react';
import { Link, Outlet, useLoaderData, useParams, useSearchParams } from 'react-router';
import type { FriendView } from '@ewa/protocol';
import type { friendsLoader } from '../app/loaders';
import { zoneName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useRoomState } from '../net/useRoomState';
import { useNotificationsStore } from '../state/notifications';
import { toast } from '../state/notifications';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { Tabs } from '../ui/Tabs';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './SocialScreen.module.css';
import { relativeTime, useClosePanel, useIntent } from './shared';
import { Unavailable } from './Unavailable';

type Tab = 'friends' | 'requests' | 'nearby';

function useNearby(): readonly { readonly id: string; readonly name: string; readonly inBattle: boolean }[] {
  const rows = useRoomState((state, me) => {
    const out: string[] = [];
    state.players.forEach((p) => {
      if (p.id !== me) out.push(`${p.name}\u0000${p.id}\u0000${p.inBattle ? 1 : 0}`);
    });
    return out.sort();
  }, [] as readonly string[]);
  return rows.map((r) => {
    const [name = '', id = '', b = '0'] = r.split('\u0000');
    return { id, name, inBattle: b === '1' };
  });
}

function sendWorld(kind: 'challenge' | 'tradeRequest', targetId: string, name: string): void {
  try {
    getWorldSession().send(kind, { targetId });
    toast('info', kind === 'challenge' ? `Challenge sent to ${name}.` : `Trade request sent to ${name}.`);
  } catch (e) {
    toast('danger', e instanceof Error ? e.message : 'Could not send.');
  }
}

function FriendRow({ f, here, unread, active }: { readonly f: FriendView; readonly here: boolean; readonly unread: number; readonly active: boolean }) {
  return (
    <li className={cx(s.friend, active && s.friendActive)}>
      <div className={s.friendTop}>
        <span className={cx(s.presence, f.online && s.online)} aria-label={f.online ? 'Online' : 'Offline'} />
        <span className={s.friendName}>{f.username}</span>
        {unread > 0 && <Pill tone="accent">{unread}</Pill>}
      </div>
      <p className={s.friendMeta}>
        {f.online ? (f.inBattle ? 'In a battle' : zoneName(f.zoneId)) : `Last seen ${relativeTime(f.lastSeenAt)}`}
      </p>
      <div className={s.friendActions}>
        <Link to={`/play/social/${f.username}`} className={s.msgLink}>
          <Icon name="social" size="sm" /> Message
        </Link>
        <Button size="sm" variant="ghost" icon="sword" disabled={!here || f.inBattle} onClick={() => sendWorld('challenge', f.id, f.username)} title={here ? undefined : 'Only in the same zone'}>
          Challenge
        </Button>
        <Button size="sm" variant="ghost" icon="trade" disabled={!here} onClick={() => sendWorld('tradeRequest', f.id, f.username)} title={here ? undefined : 'Only in the same zone'}>
          Trade
        </Button>
      </div>
    </li>
  );
}

export function SocialScreen() {
  const close = useClosePanel();
  const data = useLoaderData<typeof friendsLoader>();
  const { username: openThread } = useParams();
  const [params, setParams] = useSearchParams();
  const unread = useNotificationsStore((st) => st.unreadDm);
  const nearby = useNearby();
  const hereIds = useRoomState((state) => [...state.players.keys()].sort(), [] as readonly string[]);
  const fetcher = useIntent('/play/social');
  const [addName, setAddName] = useState('');
  const tab = (params.get('tab') ?? 'friends') as Tab;

  // after every action React Router revalidates this loader, so the lists are always the server's
  const lists = data.available ? data.data : null;
  const incoming = lists?.incoming ?? [];

  return (
    <Panel title="Social" eyebrow="Trainers" onClose={close} bodyClassName={s.panelBody}>
      <div className={l.splitNarrow}>
        <div className={s.left}>
          <Tabs<Tab>
            label="Social"
            tabs={[
              { key: 'friends', label: 'Friends', count: lists?.friends.length },
              { key: 'requests', label: 'Requests', count: incoming.length },
              { key: 'nearby', label: 'Nearby', count: nearby.length },
            ]}
            value={tab}
            onChange={(k) => setParams({ tab: k }, { replace: true })}
          />
          {tab === 'nearby' ? (
            nearby.length === 0 ? (
              <EmptyState icon="party" title="Nobody nearby" hint="Other trainers in your part of the zone appear here." />
            ) : (
              <ul className={s.list}>
                {nearby.map((p) => (
                  <li key={p.id} className={s.friend}>
                    <div className={s.friendTop}>
                      <span className={cx(s.presence, s.online)} />
                      <span className={s.friendName}>{p.name}</span>
                      {p.inBattle && <Pill tone="warn">In battle</Pill>}
                    </div>
                    <div className={s.friendActions}>
                      <Button size="sm" variant="ghost" icon="sword" disabled={p.inBattle} onClick={() => sendWorld('challenge', p.id, p.name)}>
                        Challenge
                      </Button>
                      <Button size="sm" variant="ghost" icon="trade" onClick={() => sendWorld('tradeRequest', p.id, p.name)}>
                        Trade
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : !data.available ? (
            <Unavailable icon="social" feature="Friends" hint="Friend lists and messages arrive with the server's social update. The Nearby tab already works." />
          ) : tab === 'friends' ? (
            <>
              <form
                className={s.addRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (addName.trim().length < 3) return;
                  fetcher.submit({ intent: 'friendRequest', username: addName.trim() });
                  setAddName('');
                }}
              >
                <TextField label="Add a friend" hideLabel placeholder="Add someone by username" value={addName} onChange={setAddName} maxLength={20} autoFocus={lists?.friends.length === 0} className={l.grow} />
                <Button type="submit" icon="plus" busy={fetcher.busy((p) => p.intent === 'friendRequest')} disabled={addName.trim().length < 3}>
                  Add
                </Button>
              </form>
              {lists!.friends.length === 0 ? (
                <EmptyState icon="party" title="No friends yet" hint="Add someone by username above." />
              ) : (
                <ul className={s.list}>
                  {lists!.friends.map((f) => (
                    <FriendRow key={f.id} f={f} here={hereIds.includes(f.id)} unread={unread[f.username] ?? 0} active={openThread === f.username} />
                  ))}
                </ul>
              )}
            </>
          ) : incoming.length === 0 && (lists?.outgoing.length ?? 0) === 0 ? (
            <EmptyState icon="social" title="No requests" hint="Friend requests you send or receive wait here." />
          ) : (
            <ul className={s.list}>
              {incoming.map((f) => (
                <li key={f.id} className={s.friend}>
                  <div className={s.friendTop}>
                    <span className={s.friendName}>{f.username}</span>
                    <span className={l.caption}>wants to be friends</span>
                  </div>
                  <div className={s.friendActions}>
                    <Button size="sm" variant="primary" onClick={() => fetcher.submit({ intent: 'friendAccept', username: f.username })}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => fetcher.submit({ intent: 'friendDecline', username: f.username })}>
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
              {lists?.outgoing.map((f) => (
                <li key={f.id} className={s.friend}>
                  <div className={s.friendTop}>
                    <span className={s.friendName}>{f.username}</span>
                    <Pill>Pending</Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={s.right}>
          {openThread !== undefined ? <Outlet /> : <EmptyState icon="social" title="Pick a conversation" hint="Choose a friend to read and send messages." />}
        </div>
      </div>
    </Panel>
  );
}
