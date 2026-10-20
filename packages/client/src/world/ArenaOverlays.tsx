/**
 * Arena PvP — the DOM over the arena and the world (app/arena.ts drives the state):
 *
 * - `ArenaInvitePrompt`: a friend's `arenaInvite` → "X invites you to a battle" with the rules, a countdown to
 *   `expiresAt`, Decline / Accept (→ POST /arena/invite/reply → into the arena). Declined automatically when Settings ›
 *   Social `allowChallenges` is off or the player is busy (a battle, a trade, already in an arena).
 * - `MatchFoundCard`: the short card while a queue match moves the player into the arena.
 * - `ArenaHud`: in the arena — the top-left strip (Arena · mode · level, you vs the opponent), the waiting card before
 *   the battle starts, and after the result card the result actions: Back to world, Queue again (the same mode) /
 *   Rematch (training) / Try again (the daily challenge) / Challenge again (friend); a re-queue shows its elapsed time and
 *   Leave queue in place. After a daily the card refetches GET /daily and shows today's best and Copy result.
 */
import { useEffect, useState } from 'react';
import { ARENA_KIND_LABELS, rankedWindow } from '@ewa/protocol';
import { backToWorld, copyDailyResult, leaveArenaQueue, loadDaily, playAgain, replyInvite } from '../app/arena';
import { getWorldSession } from '../net/WorldSession';
import { MATCH_FOUND_MS, RULES_LABELS, levelLabel, useArenaStore } from '../state/arena';
import type { ArenaLast } from '../state/arena';
import { formatElapsed } from '../state/ranked';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { cx } from '../ui/cx';
import s from './ArenaOverlays.module.css';
import w from './WorldModals.module.css';

function useTicker(on: boolean, ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return now;
}

// ---- the invite --------------------------------------------------------------------------------------------------

export function ArenaInvitePrompt() {
  const inv = useArenaStore((st) => st.invite);
  const busy = useUiStore((st) => st.battle !== null || st.trade !== null);
  const inArena = useArenaStore((st) => st.inArena);
  const allow = useSettingsStore((st) => st.social.allowChallenges);
  const now = useTicker(inv !== null);

  useEffect(() => {
    if (inv === null) return;
    if (!allow || busy || inArena) void replyInvite(false);
  }, [inv, allow, busy, inArena]);
  useEffect(() => {
    if (inv !== null && now >= inv.expiresAt) useArenaStore.getState().setInvite(null);
  }, [inv, now]);

  if (inv === null || !allow || busy || inArena) return null;
  const left = Math.max(0, Math.ceil((inv.expiresAt - now) / 1000));
  return (
    <Modal
      open
      size="sm"
      title="Arena invite"
      onClose={() => void replyInvite(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => void replyInvite(false)}>
            Decline
          </Button>
          <Button variant="primary" icon="sword" onClick={() => void replyInvite(true)}>
            Accept
          </Button>
        </>
      }
    >
      <div className={w.stack} data-testid="arenainvite">
        <p className={w.text}>
          <strong className={w.name}>{inv.fromName}</strong> invites you to an arena battle.
        </p>
        <p className={s.rules}>
          <span className={s.label}>{RULES_LABELS[inv.rules]}</span> Fully healed teams, no exp. You come back here afterwards.
        </p>
        <p className={w.caption}>Expires in {left} s</p>
      </div>
    </Modal>
  );
}

// ---- match found ---------------------------------------------------------------------------------------------------

export function MatchFoundCard() {
  const m = useArenaStore((st) => st.matchFound);
  const now = useTicker(m !== null, 250);
  if (m === null || now - m.at > MATCH_FOUND_MS) return null;
  return (
    <div className={s.center} aria-live="assertive">
      <div className={s.found} data-testid="matchfound">
        <span className={s.label}>Match found</span>
        <p className={s.foundKind}>{ARENA_KIND_LABELS[m.kind]}</p>
        {m.opponent !== null && (
          <p className={s.foundVs}>
            vs <b className={s.foundName}>{m.opponent.name}</b>
            {m.kind === 'ranked' && <span className={s.foundRating}> {m.opponent.rating}</span>}
          </p>
        )}
        <p className={s.caption}>Heading to the arena…</p>
      </div>
    </div>
  );
}

// ---- in the arena -------------------------------------------------------------------------------------------------

function againLabel(last: ArenaLast | null): string | null {
  if (last === null) return null;
  if (last.kind === 'queue') return 'Queue again';
  if (last.kind === 'training') return 'Rematch';
  if (last.kind === 'daily') return 'Try again';
  return 'Challenge again';
}

/** After a daily: today's best (refetched, so this try counts) against par, with Copy result. */
function DailyResult() {
  const daily = useArenaStore((st) => st.daily);
  useEffect(() => {
    void loadDaily().catch(() => undefined);
  }, []);
  if (daily === null) return null;
  return (
    <p className={s.caption} data-testid="arenaresult-daily">
      {daily.best === null ? 'Not won yet today.' : `Your best today: ${daily.best.turns} turns${daily.par !== null ? ` (par ${daily.par})` : ''} · ${daily.best.marks}`}{' '}
      {daily.best !== null && (
        <Button size="sm" variant="ghost" icon="link" onClick={() => void copyDailyResult(daily)}>
          Copy result
        </Button>
      )}
    </p>
  );
}

export function ArenaHud() {
  const inArena = useArenaStore((st) => st.inArena);
  const match = useArenaStore((st) => st.match);
  const outcome = useArenaStore((st) => st.outcome);
  const status = useArenaStore((st) => st.status);
  const queuedAt = useArenaStore((st) => st.queuedAt);
  const last = useArenaStore((st) => st.last);
  const busy = useArenaStore((st) => st.busy);
  const selfId = useSessionStore((st) => st.profile?.id ?? '');
  const battle = useUiStore((st) => st.battle !== null);
  const queued = status.state === 'queued';
  const now = useTicker(inArena && queued, 1000);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!inArena) setLeaving(false);
  }, [inArena]);
  if (!inArena) return null;

  const foe = match?.players.find((p) => p.playerId !== selfId) ?? null;
  const foeName = match?.foeName ?? foe?.name ?? null;
  const over = !battle && (outcome !== null || match?.phase === 'ended');
  const waiting = !battle && !over && (match === null || match.phase === 'waiting');
  const goBack = (): void => {
    setLeaving(true);
    void backToWorld(getWorldSession());
  };
  const again = againLabel(last);
  const delta = outcome?.ratingDelta ?? null;

  return (
    <>
      <div className={s.layer} aria-live="polite">
        <p className={s.strip} data-testid="arenastrip">
          <span className={s.stripLabel}>Arena</span>
          <span className={s.stripMode}>{match === null ? 'Joining' : ARENA_KIND_LABELS[match.kind]}</span>
          {match !== null && match.kind !== 'level50' && <span className={cx(s.stripLevel, match.level !== null && s.stripLevelOn)}>{levelLabel(match.level)}</span>}
          {foeName !== null && (
            <span className={s.stripVs}>
              vs <b className={s.stripName}>{foeName}</b>
              {match?.kind === 'ranked' && foe !== null && <span className={s.stripRating}> {foe.rating}</span>}
            </span>
          )}
        </p>
      </div>
      {waiting && (
        <div className={s.bottom}>
          <section className={s.card} data-testid="arenawaiting" aria-label="Waiting">
            <span className={s.label}>Get ready</span>
            <p className={s.cardTitle}>{foeName !== null ? `Waiting for ${foeName}` : 'Setting up the arena'}</p>
            <p className={s.caption}>The battle starts when both trainers are here.</p>
            <div className={s.actions}>
              <Button variant="ghost" busy={leaving} onClick={goBack}>
                Back to world
              </Button>
            </div>
          </section>
        </div>
      )}
      {over && (
        <div className={s.bottom}>
          <section className={s.card} data-testid="arenaresult" aria-label="Arena result">
            <span className={s.label}>{match !== null ? ARENA_KIND_LABELS[match.kind] : 'Arena'}</span>
            <p className={s.cardTitle}>{outcome?.won === true ? 'Victory' : outcome?.won === false ? 'Defeat' : 'Battle over'}</p>
            {match?.kind === 'daily' && <DailyResult />}
            {delta !== null && delta !== 0 && (
              <p className={s.delta} data-testid="arenaresult-rating">
                <span className={s.deltaValue}>{`${delta > 0 ? '+' : ''}${delta}`}</span> rating
              </p>
            )}
            {queued ? (
              <div className={s.actions} aria-live="polite">
                <span className={s.searching}>
                  Searching <b className={s.searchingValue}>{formatElapsed(now - queuedAt)}</b>
                  {status.kind === 'ranked' && <> · ±{rankedWindow(now - queuedAt)}</>}
                </span>
                <Button variant="secondary" busy={busy} onClick={() => void leaveArenaQueue()}>
                  Leave queue
                </Button>
                <Button variant="ghost" busy={leaving} onClick={goBack}>
                  Back to world
                </Button>
              </div>
            ) : (
              <div className={s.actions}>
                {again !== null && (
                  <Button variant="primary" icon="sword" busy={busy} disabled={leaving} onClick={() => void playAgain()}>
                    {again}
                  </Button>
                )}
                <Button variant={again === null ? 'primary' : 'secondary'} busy={leaving} onClick={goBack}>
                  Back to world
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
