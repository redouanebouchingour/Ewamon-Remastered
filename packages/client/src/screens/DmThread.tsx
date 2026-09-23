/**
 * `/play/social/:username` (SPEC §20.9.7): the DM thread (`GET /messages/:username?limit=50`, older pages with
 * `?before=`), composer at the bottom (`POST /messages/:username`, 1..300 chars, counter from 250). Live `dm`
 * room messages from this user append while the thread is open. Empty: "Say hello."
 */
import { useEffect, useRef, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { MessageView } from '@ewa/protocol';
import type { dmLoader } from '../app/loaders';
import { getWorldSession } from '../net/WorldSession';
import { useNotificationsStore } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/Field';
import { cx } from '../ui/cx';
import s from './DmThread.module.css';
import { relativeTime, useIntent } from './shared';
import { Unavailable } from './Unavailable';

interface Line {
  readonly id: string;
  readonly mine: boolean;
  readonly text: string;
  readonly at: string;
}

const toLine = (m: MessageView, me: string): Line => ({ id: `m${m.id}`, mine: m.fromId === me, text: m.text, at: m.sentAt });

export function DmThread() {
  const { username, thread } = useLoaderData<typeof dmLoader>();
  const me = useSessionStore((st) => st.profile?.id ?? '');
  const markRead = useNotificationsStore((st) => st.markDmRead);
  const fetcher = useIntent(`/play/social/${username}`);
  const [draft, setDraft] = useState('');
  const [live, setLive] = useState<readonly Line[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const base: Line[] = thread.available ? [...thread.data.messages].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)).map((m) => toLine(m, me)) : [];
  const seen = new Set(base.map((b) => b.id));
  const lines = [...base, ...live.filter((l) => !seen.has(l.id))];

  useEffect(() => {
    setLive([]);
    markRead(username);
  }, [username, markRead]);

  useEffect(
    () =>
      getWorldSession().onMessage((m) => {
        if (m.type !== 'dm' || m.fromName !== username) return;
        setLive((cur) => [...cur, { id: `m${m.id}`, mine: false, text: m.text, at: new Date(m.sentAt).toISOString() }]);
      }),
    [username],
  );

  useEffect(() => {
    const r = fetcher.result;
    if (r?.ok === true && r.intent === 'send' && r.result !== null && typeof r.result === 'object' && 'id' in r.result) {
      const m = r.result as MessageView;
      setLive((cur) => (cur.some((l) => l.id === `m${m.id}`) ? cur : [...cur, toLine(m, me)]));
    }
  }, [fetcher.result, me]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lines.length]);

  if (!thread.available) {
    return (
      <div className={s.center}>
        <Unavailable icon="social" feature="Direct messages" hint="Messages arrive with the server's social update." />
      </div>
    );
  }

  const send = (): void => {
    const text = draft.trim();
    if (text.length === 0 || text.length > 300) return;
    fetcher.submit({ intent: 'send', username, text });
    setDraft('');
  };

  return (
    <section className={s.thread} aria-label={`Conversation with ${username}`}>
      <header className={s.head}>
        <span className={s.avatar} aria-hidden>
          {username.slice(0, 1).toUpperCase()}
        </span>
        <h3 className={s.name}>{username}</h3>
      </header>
      <div className={s.messages} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <EmptyState icon="social" title="Say hello." hint={`This is the start of your conversation with ${username}.`} />
        ) : (
          lines.map((m) => (
            <div key={m.id} className={cx(s.bubbleRow, m.mine && s.mine)}>
              <p className={s.bubble}>{m.text}</p>
              <span className={s.time}>{relativeTime(m.at)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <TextField label="Message" hideLabel placeholder={`Message ${username}`} value={draft} onChange={setDraft} maxLength={300} counterFrom={250} className={s.input} />
        <Button type="submit" variant="primary" icon="send" disabled={draft.trim().length === 0} busy={fetcher.busy((p) => p.intent === 'send')}>
          Send
        </Button>
      </form>
    </section>
  );
}
