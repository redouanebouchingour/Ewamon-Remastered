/**
 * Arena PvP — `/play/pvp` (hotkey K, More menu; Rankings links here). Battles that live outside the world: the player
 * queues for a mode, starts AI training or challenges an online friend, and the match moves them into an arena room
 * (app/arena.ts); afterwards they return to the world where they stood. Every team fights as fully healed copies (no hp
 * lost, no creature exp); Level 50 / Ranked / the Weekly Cup put every creature at Lv 50; only Ranked moves the rating.
 *
 * Broadcast cards, one per mode: Standard, Level 50, Ranked (rating / peak / matches; the rating window while queued),
 * Weekly Cup (this week's cup, time left, the party checked client-side with content `cupRefusal` — the server's rule —
 * and why it is locked), Training (rules × difficulty → straight into the arena) and Challenge a friend (online
 * friends, rules, the outgoing invite's fate) and the daily challenge (today's two teams, par, your best and its strip,
 * Copy result, Play) and Watch live (the live matches, League Finals first). One queue at a time: while queued the other starts wait, the queued card
 * carries the elapsed time and Leave queue; the player may close the screen and keep walking (the top bar's queue chip
 * shows it; a match moves them automatically).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLoaderData } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { ARENA_DIFFICULTIES, ARENA_KIND_LABELS, ARENA_LEVEL, ARENA_RULES, rankedWindow } from '@ewa/protocol';
import type { ArenaDifficulty, ArenaMode, ArenaRules, FriendView } from '@ewa/protocol';
import type { pvpLoader } from '../app/loaders';
import { copyDailyResult, inviteFriend, leaveArenaQueue, queueArena, startDaily, startTraining } from '../app/arena';
import { DIFFICULTY_LABELS, RULES_LABELS, arenaBlockReason, cupLockReason, timeLeft, useArenaStore } from '../state/arena';
import { formatElapsed } from '../state/ranked';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './PvpScreen.module.css';
import { useClosePanel } from './shared';
import { TrainerAvatar } from './TrainerCard';
import { LiveMatches } from './LiveMatches';

const NO_PARTY: readonly never[] = [];

/** 1 s while something counts (the queue, an open invite), else every 30 s (the cup's time left). */
export function useNow(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [fast]);
  return now;
}

interface ModeDef {
  readonly mode: ArenaMode;
  readonly blurb: string;
}

const QUEUE_MODES: readonly ModeDef[] = [
  { mode: 'standard', blurb: 'Your party at its own levels.' },
  { mode: 'level50', blurb: `Every creature fights at exactly Lv ${ARENA_LEVEL}, raised or lowered.` },
  { mode: 'ranked', blurb: `Lv ${ARENA_LEVEL}. You meet trainers near your rating; wins and losses move it.` },
];

function LevelTag({ level }: { readonly level: number | null }) {
  return <span className={cx(s.tag, level !== null && s.tagLevel)}>{level === null ? 'Own levels' : `Lv ${level}`}</span>;
}

function Choice<K extends string>({ label, options, value, onChange, names }: {
  readonly label: string;
  readonly options: readonly K[];
  readonly value: K;
  readonly onChange: (k: K) => void;
  readonly names: Readonly<Record<K, string>>;
}) {
  return (
    <div className={s.choice} role="group" aria-label={label}>
      <span className={s.choiceLabel}>{label}</span>
      <div className={s.choiceRow}>
        {options.map((o) => (
          <Button key={o} size="sm" variant="ghost" pressed={o === value} onClick={() => onChange(o)}>
            {names[o]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Card({ title, level, active, testId, children, aside }: {
  readonly title: string;
  /** the level rule's tag; absent: none (the watch list) */
  readonly level?: number | null;
  readonly active?: boolean;
  readonly testId: string;
  readonly children: ReactNode;
  readonly aside?: ReactNode;
}) {
  return (
    <section className={cx(s.card, active === true && s.cardActive)} data-testid={testId} aria-label={title}>
      <header className={s.cardHead}>
        <h3 className={s.cardTitle}>{title}</h3>
        {level !== undefined && <LevelTag level={level} />}
      </header>
      {aside}
      <div className={s.cardBody}>{children}</div>
    </section>
  );
}

export function PvpScreen() {
  const close = useClosePanel();
  const data = useLoaderData<typeof pvpLoader>();
  if (!data.available) {
    return (
      <Panel title="PvP" eyebrow="Arena" onClose={close}>
        <EmptyState icon="sword" tone="unavailable" title="The arena is not open yet" hint="This server does not run arena battles. The walk-up challenge (C) still works in the world." />
      </Panel>
    );
  }
  return <PvpBody friends={data.friends} onClose={close} />;
}

function PvpBody({ friends, onClose }: { readonly friends: readonly FriendView[]; readonly onClose: () => void }) {
  const arena = useArenaStore(useShallow((st) => ({ info: st.info, status: st.status, queuedAt: st.queuedAt, busy: st.busy, inArena: st.inArena, outgoing: st.outgoing, daily: st.daily })));
  const party = useSessionStore((st) => st.inventory?.party ?? NO_PARTY);
  const sessionRating = useSessionStore((st) => st.progression?.rating ?? null);
  const inBattle = useUiStore((st) => st.battle !== null);
  const trading = useUiStore((st) => st.trade !== null);
  const connected = useUiStore((st) => st.connection === 'connected');
  const queued = arena.status.state === 'queued' ? arena.status.kind : null;
  const pending = arena.outgoing !== null && arena.outgoing.state === 'pending' ? arena.outgoing : null;
  const now = useNow(queued !== null || pending !== null);
  const blocked = arenaBlockReason({ party, inBattle, trading, inArena: arena.inArena, connected });
  const elapsed = queued !== null ? now - arena.queuedAt : 0;
  const info = arena.info;
  const rating = info?.rating ?? sessionRating;
  const [trainRules, setTrainRules] = useState<ArenaRules>('level50');
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>('normal');
  const [friendRules, setFriendRules] = useState<ArenaRules>('level50');
  // one queue at a time: everything else waits while queued
  const startBlock = blocked ?? (queued !== null ? `Leave the ${ARENA_KIND_LABELS[queued]} queue first.` : null);
  const cupWhy = cupLockReason(party, now);
  const online = friends.filter((f) => f.online);

  const queueAction = (mode: ArenaMode, lockedWhy: string | null): ReactNode => {
    if (queued === mode) {
      return (
        <div className={s.queued} aria-live="polite">
          <dl className={s.figures}>
            <div>
              <dt className={l.caption}>Searching</dt>
              <dd className={s.figure} data-testid={`pvp-elapsed-${mode}`}>
                {formatElapsed(elapsed)}
              </dd>
            </div>
            {mode === 'ranked' && (
              <div>
                <dt className={l.caption}>Rating window</dt>
                <dd className={s.figure}>±{rankedWindow(elapsed)}</dd>
              </div>
            )}
          </dl>
          <Button variant="secondary" busy={arena.busy} onClick={() => void leaveArenaQueue()}>
            Leave queue
          </Button>
        </div>
      );
    }
    const why = startBlock ?? lockedWhy;
    return (
      <div className={s.actions}>
        <Button variant="primary" icon="sword" disabled={why !== null} busy={arena.busy} onClick={() => void queueArena(mode)}>
          Find a match
        </Button>
        {startBlock !== null && <span className={s.why}>{startBlock}</span>}
      </div>
    );
  };

  return (
    <Panel
      title="PvP"
      eyebrow="Arena"
      subtitle="Battles outside the world. Every team fights fully healed: no hp lost, no exp. Back to the world afterwards, where you stood."
      onClose={onClose}
    >
      <div className={s.screen} data-testid="pvpscreen">
        <div className={s.strip}>
          <div className={s.ratingBlock}>
            <span className={s.stripLabel}>Rating</span>
            <span className={s.rating}>{rating ?? '—'}</span>
          </div>
          <dl className={s.stripStats}>
            <div>
              <dt className={l.caption}>Peak</dt>
              <dd className={s.stat}>{info?.peakRating ?? '—'}</dd>
            </div>
            <div>
              <dt className={l.caption}>Ranked matches</dt>
              <dd className={s.stat}>{info?.rankedMatches ?? '—'}</dd>
            </div>
            <div>
              <dt className={l.caption}>Party</dt>
              <dd className={s.partyRow}>
                {party.map((c) => (
                  <CreatureSprite key={c.id} speciesId={c.speciesId} variantKey={c.variantKey} size="sm" />
                ))}
              </dd>
            </div>
          </dl>
          {blocked !== null && (
            <p className={s.blocked} role="status">
              {blocked}
            </p>
          )}
        </div>

        <div className={s.grid}>
          {QUEUE_MODES.map((m) => (
            <Card key={m.mode} title={ARENA_KIND_LABELS[m.mode]} level={m.mode === 'standard' ? null : ARENA_LEVEL} active={queued === m.mode} testId={`pvp-mode-${m.mode}`}>
              <p className={s.blurb}>{m.blurb}</p>
              {m.mode === 'ranked' && (
                <p className={s.meta}>
                  Rating <b className={s.metaValue}>{rating ?? '—'}</b> · Peak <b className={s.metaValue}>{info?.peakRating ?? '—'}</b>
                </p>
              )}
              {queueAction(m.mode, null)}
            </Card>
          ))}

          <Card title={ARENA_KIND_LABELS.cup} level={ARENA_LEVEL} active={queued === 'cup'} testId="pvp-mode-cup">
            <p className={s.cupName}>{info?.cup.name ?? 'This week’s cup'}</p>
            <p className={s.blurb}>{info?.cup.description ?? ''}</p>
            {info !== null && (
              <p className={s.meta}>
                Ends in <b className={s.metaValue}>{timeLeft(info.cup.endsAt, now)}</b> · a full party of six at Lv {ARENA_LEVEL}
              </p>
            )}
            {cupWhy !== null ? (
              <p className={s.lock} data-testid="pvp-cup-lock">
                <span className={s.lockLabel}>Locked</span> {cupWhy}
              </p>
            ) : (
              <p className={s.ok}>Your party meets this week’s rule.</p>
            )}
            {queueAction('cup', cupWhy)}
          </Card>

          {arena.daily !== null && (
            <Card title={`${ARENA_KIND_LABELS.daily} #${arena.daily.number}`} level={arena.daily.team[0]?.level ?? null} testId="pvp-mode-daily">
              <p className={s.blurb}>The same puzzle for everyone today: this team against {arena.daily.foeName}, fewest turns wins.</p>
              <div className={s.dailyTeams} aria-label="Today's teams">
                <span className={s.partyRow} aria-label="Your team">
                  {arena.daily.team.map((c, i) => (
                    <CreatureSprite key={`${c.speciesId}:${i}`} speciesId={c.speciesId} size="sm" />
                  ))}
                </span>
                <span className={s.dailyVs}>vs</span>
                <span className={s.partyRow} aria-label={`${arena.daily.foeName}'s team`}>
                  {arena.daily.foe.map((c, i) => (
                    <CreatureSprite key={`${c.speciesId}:${i}`} speciesId={c.speciesId} size="sm" />
                  ))}
                </span>
              </div>
              <p className={s.meta}>
                {arena.daily.par !== null && (
                  <>
                    Par <b className={s.metaValue}>{arena.daily.par}</b> ·{' '}
                  </>
                )}
                Your best <b className={s.metaValue}>{arena.daily.best === null ? 'not won yet' : `${arena.daily.best.turns} turns`}</b> · Tries{' '}
                <b className={s.metaValue}>{arena.daily.attempts}</b> · Won by <b className={s.metaValue}>{arena.daily.winners}</b> · New in{' '}
                <b className={s.metaValue}>{timeLeft(arena.daily.endsAt, now)}</b>
              </p>
              {arena.daily.best !== null && (
                <p className={s.dailyStrip} aria-label="Your best, turn by turn" data-testid="pvp-daily-strip">
                  {arena.daily.best.marks}
                </p>
              )}
              <div className={s.actions}>
                <Button variant="primary" icon="sword" disabled={startBlock !== null} busy={arena.busy} onClick={() => void startDaily()}>
                  {arena.daily.attempts === 0 ? "Play today's daily" : 'Try again'}
                </Button>
                {arena.daily.best !== null && (
                  <Button variant="ghost" icon="link" onClick={() => void copyDailyResult(arena.daily!)}>
                    Copy result
                  </Button>
                )}
                {startBlock !== null && <span className={s.why}>{startBlock}</span>}
              </div>
            </Card>
          )}

          <Card title={ARENA_KIND_LABELS.training} level={trainRules === 'level50' ? ARENA_LEVEL : null} testId="pvp-mode-training">
            <p className={s.blurb}>A battle against the AI, starting at once. Nothing is at stake.</p>
            <Choice label="Levels" options={ARENA_RULES} value={trainRules} onChange={setTrainRules} names={RULES_LABELS} />
            <Choice label="Difficulty" options={ARENA_DIFFICULTIES} value={difficulty} onChange={setDifficulty} names={DIFFICULTY_LABELS} />
            <div className={s.actions}>
              <Button variant="primary" icon="sword" disabled={startBlock !== null} busy={arena.busy} onClick={() => void startTraining(trainRules, difficulty)}>
                Start training
              </Button>
              {startBlock !== null && <span className={s.why}>{startBlock}</span>}
            </div>
          </Card>

          <Card title="Challenge a friend" level={friendRules === 'level50' ? ARENA_LEVEL : null} testId="pvp-mode-friend">
            <p className={s.blurb}>Invite a friend who is online, wherever they are.</p>
            <Choice label="Levels" options={ARENA_RULES} value={friendRules} onChange={setFriendRules} names={RULES_LABELS} />
            {arena.outgoing !== null && (
              <p className={cx(s.invite, arena.outgoing.state !== 'pending' && s.inviteDone)} aria-live="polite" data-testid="pvp-outgoing">
                {arena.outgoing.state === 'pending'
                  ? `Waiting for ${arena.outgoing.toName} · ${Math.max(0, Math.ceil((arena.outgoing.expiresAt - now) / 1000))} s`
                  : arena.outgoing.state === 'declined'
                    ? `${arena.outgoing.toName} declined.`
                    : arena.outgoing.state === 'expired'
                      ? `${arena.outgoing.toName} did not answer.`
                      : `${arena.outgoing.toName} cannot battle right now.`}
              </p>
            )}
            {online.length === 0 ? (
              <p className={s.why}>{friends.length === 0 ? 'Add friends in Social to challenge them.' : 'None of your friends is online.'}</p>
            ) : (
              <ul className={s.friends} aria-label="Online friends">
                {online.map((f) => (
                  <li key={f.id} className={s.friend}>
                    <TrainerAvatar username={f.username} size="sm" />
                    <span className={s.friendName}>{f.username}</span>
                    {f.inBattle && <span className={s.why}>In a battle</span>}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="send"
                      disabled={startBlock !== null || f.inBattle || pending !== null}
                      busy={arena.busy}
                      onClick={() => void inviteFriend(f.username, friendRules)}
                    >
                      Challenge
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Watch live" testId="pvp-live">
            <p className={s.blurb}>Follow a match as it happens, one turn behind the players. In Finals week the top eight meet in the League Finals.</p>
            <LiveMatches />
          </Card>
        </div>
      </div>
    </Panel>
  );
}
