/**
 * `/play/bounties` (the bounty board, content bounties.ts), opened by talking to the Marshal in a town's Healer (else
 * its Mart; Skyrend's Marshal's Office): the Wanted posters (the board's own on ghosts that keep winning, trainers'
 * posts on ghosts), the player's own nemeses wanted by them alone, posting a bounty on a ghost (a party holding a
 * Badlander), their posts and what became of them, and the latest bounties brought in. GET /bounties, POST /bounties.
 */
import { useEffect, useState } from 'react';
import { BOUNTY_CLAIMS_PER_DAY, BOUNTY_OPEN_MAX, BOUNTY_POST_HOURS, BOUNTY_REFUSAL_TEXT, PLAYER_BOUNTY_MAX, PLAYER_BOUNTY_MIN, bountyFee } from '@ewa/content';
import type { BountiesView, BountyClaimView, BountyPosterView, BountyPostView } from '@ewa/protocol';
import { primaryType, speciesName, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { toast } from '../state/notifications';
import { applyInventoryDelta, toInventoryDelta, useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TextField } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import l from './layout.module.css';
import s from './BountyScreen.module.css';
import { relativeTime, useClosePanel } from './shared';

const money = (n: number): string => n.toLocaleString('en-US');

/** The record line under a poster. */
export function recordLine(p: Pick<BountyPosterView, 'kind' | 'wins' | 'rank'>): string {
  if (p.kind === 'nemesis') return `Rank ${p.rank ?? 1} nemesis. It beat or escaped you ${p.rank ?? 1} times.`;
  const w = p.wins ?? 0;
  if (w === 0) return 'No wins on record this week.';
  return `Beat ${w} trainer${w === 1 ? '' : 's'} this week.`;
}

/** Who put it up. */
export function postedByLine(p: Pick<BountyPosterView, 'kind' | 'postedBy' | 'mine'>): string {
  if (p.kind === 'nemesis') return 'Wanted by you alone';
  if (p.mine) return 'Your poster';
  return p.postedBy === null ? 'Posted by the board' : `Posted by ${p.postedBy}`;
}

/** What became of one of your posts. */
export function postStatusLine(p: BountyPostView, nowMs: number = Date.now()): string {
  if (p.status === 'claimed') return `Brought in by ${p.claimedBy ?? 'a hunter'}.`;
  if (p.status === 'expired') return `Came down unclaimed. ${money(p.reward + p.fee)} went back to you.`;
  return `Comes down ${relativeTime(p.expiresAt, nowMs)}.`;
}

/** A claim on the board, as a line. */
export function claimLine(c: BountyClaimView): string {
  return `${c.claimedBy} brought in ${c.target} on ${zoneName(c.zoneId)}: ${money(c.payout)}${c.bonus ? ' with a Lawlander' : ''}.`;
}

/** The cost of a post, in words. */
export function postCostLine(reward: number): string {
  const fee = bountyFee(reward);
  return `Costs ${money(reward + fee)}: the ${money(reward)} bounty and the board's ${money(fee)} cut, held until it is claimed. Unclaimed after ${BOUNTY_POST_HOURS} hours, all of it comes back.`;
}

function Poster({ p, lawlander }: { readonly p: BountyPosterView; readonly lawlander: boolean }) {
  return (
    <li className={s.poster} data-type={primaryType(p.speciesId)} data-kind={p.kind} data-testid="bounty-poster">
      <span className={s.wanted}>{p.kind === 'nemesis' ? 'Wanted by you' : 'Wanted'}</span>
      <span className={s.face}>
        <CreatureSprite speciesId={p.speciesId} size="lg" />
      </span>
      <span className={s.target}>{p.target}</span>
      <span className={l.caption}>
        {speciesName(p.speciesId)} · Lv {p.level} · {p.kind === 'nemesis' ? `last seen on ${zoneName(p.zoneId)}` : `haunts ${zoneName(p.zoneId)}`}
      </span>
      <span className={s.record}>{recordLine(p)}</span>
      <span className={s.reward}>
        <span className={s.rewardValue}>{money(p.reward)}</span>
        <span className={s.bonus} data-on={lawlander || undefined}>
          {money(p.withLawlander)} with a Lawlander
        </span>
      </span>
      <span className={l.caption}>
        {postedByLine(p)}
        {p.expiresAt !== null ? ` · comes down ${relativeTime(p.expiresAt)}` : ''}
      </span>
    </li>
  );
}

export function BountyScreen() {
  const close = useClosePanel();
  const [view, setView] = useState<BountiesView | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [reward, setReward] = useState(String(PLAYER_BOUNTY_MIN));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zoneId = useSessionStore((st) => st.zoneId);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('bounties', { signal: ctl.signal })
      .then(setView)
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);

  const amount = Number(reward);
  const post = (): void => {
    if (target === null) return;
    setBusy(true);
    setError(null);
    apiFetch('bountyPost', { body: { target, reward: amount } })
      .then((res) => {
        setView(res);
        applyInventoryDelta(toInventoryDelta({ money: res.money }));
        toast('success', `Your poster on ${target} is up: ${money(amount)}.`);
        setTarget(null);
      })
      .catch((e: unknown) => setError(describeError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Panel
      title="Wanted"
      eyebrow={`${zoneName(zoneId)} · Marshal`}
      subtitle="Bring a wanted ghost in by beating it in the tall grass where it haunts. The bounty is yours; a Lawlander in your party adds a quarter."
      onClose={close}
    >
      {view === null ? (
        <Skeleton shape="rows" count={3} label="Loading the board" />
      ) : !view.enabled ? (
        <p className={l.body}>The board is bare today. The Marshal is out.</p>
      ) : (
        <div className={s.screen} data-testid="bounty-board">
          <p className={s.strip} data-on={view.you.lawlander || undefined}>
            <span>{view.you.lawlander ? 'A Lawlander rides with you: every bounty pays a quarter more.' : 'No Lawlander in your party: bounties pay their face value.'}</span>
            <span className={l.caption}>
              The board posts again {relativeTime(view.nextPostingAt)} · {view.you.claimsToday} of {BOUNTY_CLAIMS_PER_DAY} claims today
            </span>
          </p>

          <section className={l.section} aria-label="Wanted">
            <h4 className={l.sectionTitle}>On the board</h4>
            {view.wanted.length === 0 ? (
              <p className={l.caption}>Nobody is wanted right now. When a ghost keeps beating trainers, the board puts a price on it.</p>
            ) : (
              <ol className={s.posters}>
                {view.wanted.map((p) => (
                  <Poster key={p.id} p={p} lawlander={view.you.lawlander} />
                ))}
              </ol>
            )}
          </section>

          {view.personal.length > 0 && (
            <section className={l.section} aria-label="Wanted by you">
              <h4 className={l.sectionTitle}>Wanted by you</h4>
              <p className={l.caption}>Your nemeses. Nobody else can see these posters: knock one out or catch it when it finds you.</p>
              <ol className={s.posters}>
                {view.personal.map((p) => (
                  <Poster key={p.id} p={p} lawlander={view.you.lawlander} />
                ))}
              </ol>
            </section>
          )}

          <section className={l.section} aria-label="Post a bounty">
            <h4 className={l.sectionTitle}>Post a bounty</h4>
            {!view.you.badlander ? (
              <p className={s.marshal}>{BOUNTY_REFUSAL_TEXT.noBadlander}</p>
            ) : !view.you.atBoard ? (
              <p className={s.marshal}>{BOUNTY_REFUSAL_TEXT.notAtBoard}</p>
            ) : view.ghosts.length === 0 ? (
              <p className={l.caption}>No ghost haunts the world right now.</p>
            ) : (
              <div className={s.post}>
                <ul className={s.ghosts} aria-label="Ghosts haunting now">
                  {view.ghosts.map((g) => (
                    <li key={g.name}>
                      <button type="button" className={s.ghost} aria-pressed={target === g.name} data-type={primaryType(g.speciesId)} onClick={() => setTarget(g.name)}>
                        <CreatureSprite speciesId={g.speciesId} size="sm" />
                        <span className={s.ghostName}>{g.name}</span>
                        <span className={l.caption}>
                          {zoneName(g.zoneId)} · Lv {g.level} · {g.wins} win{g.wins === 1 ? '' : 's'}
                          {g.wanted ? ' · wanted' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className={s.postForm}>
                  <TextField
                    label="Bounty"
                    type="number"
                    inputMode="numeric"
                    min={PLAYER_BOUNTY_MIN}
                    max={PLAYER_BOUNTY_MAX}
                    value={reward}
                    onChange={setReward}
                    error={error}
                    hint={Number.isInteger(amount) && amount > 0 ? postCostLine(amount) : `${money(PLAYER_BOUNTY_MIN)} to ${money(PLAYER_BOUNTY_MAX)}.`}
                  />
                  <Button variant="primary" busy={busy} disabled={target === null || view.you.open >= BOUNTY_OPEN_MAX} onClick={post}>
                    {target === null ? 'Pick a ghost' : `Post on ${target}`}
                  </Button>
                  <span className={l.caption}>
                    {view.you.open} of {BOUNTY_OPEN_MAX} posters up. Never on your own ghost, and you cannot claim your own poster.
                  </span>
                </div>
              </div>
            )}
          </section>

          {view.posted.length > 0 && (
            <section className={l.section} aria-label="Your posters">
              <h4 className={l.sectionTitle}>Your posters</h4>
              <ul className={s.rows}>
                {view.posted.map((p) => (
                  <li key={p.id} className={s.row} data-status={p.status}>
                    <span className={s.rowTarget}>{p.target}</span>
                    <span className={s.rowValue}>{money(p.reward)}</span>
                    <span className={l.caption}>{postStatusLine(p)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.claims.length > 0 && (
            <section className={l.section} aria-label="Brought in">
              <h4 className={l.sectionTitle}>Brought in</h4>
              <ul className={s.rows}>
                {view.claims.map((c, i) => (
                  <li key={`${c.at}:${i}`} className={s.row}>
                    <span className={l.body}>{claimLine(c)}</span>
                    <time className={l.caption} dateTime={c.at}>
                      {relativeTime(c.at)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
