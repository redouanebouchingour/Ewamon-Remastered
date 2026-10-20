/**
 * Spectator mode on the PvP screen: the arena's live queued matches (GET /arena/live, read again every
 * `LIVE_LIST_MS` while the screen is open), League Finals first. Watch opens `/play/watch/:matchId`.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ARENA_KIND_LABELS } from '@ewa/protocol';
import type { LiveMatchView } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import s from './LiveMatches.module.css';

export const LIVE_LIST_MS = 10_000;

export function LiveMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<readonly LiveMatchView[] | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    const read = (): void => {
      apiFetch('arenaLive', { signal: ctl.signal })
        .then((r) => setMatches(r.matches))
        .catch(() => {
          if (!ctl.signal.aborted) setMatches((m) => m ?? []);
        });
    };
    read();
    const t = setInterval(read, LIVE_LIST_MS);
    return () => {
      ctl.abort();
      clearInterval(t);
    };
  }, []);

  if (matches === null) return <p className={s.meta}>Looking for live matches…</p>;
  if (matches.length === 0) return <p className={s.meta}>No match is being played right now.</p>;
  return (
    <ul className={s.list} aria-label="Live matches">
      {matches.map((m) => (
        <li key={m.matchId} className={s.match} data-testid="live-match">
          <p className={s.players}>
            {m.players[0].name} <span className={s.rating}>{m.players[0].rating}</span> vs {m.players[1].name} <span className={s.rating}>{m.players[1].rating}</span>
          </p>
          <p className={cx(s.meta, m.finals && s.finals)}>{m.finals ? 'League Finals' : ARENA_KIND_LABELS[m.kind]} · turn {m.turn}</p>
          <Button size="sm" icon="play" onClick={() => void navigate(`/play/watch/${m.matchId}`)}>
            Watch
          </Button>
        </li>
      ))}
    </ul>
  );
}
