/**
 * Majin vs Tenjin seasons `/play/factions` (GET /factions, POST /factions/join): the season's two sides as a tug of war
 * with their points and members, each side's creed and best contributors, the player's own side and points (or the
 * choice, once a season), how points are earned, who holds the sky over Solenne, and the Chronicle of past seasons.
 */
import { useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { FACTIONS, FACTION_LABELS, FACTION_POINTS } from '@ewa/content';
import type { Faction } from '@ewa/content';
import type { FactionsView } from '@ewa/protocol';
import type { factionsLoader } from '../app/loaders';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { timeLeft } from '../state/arena';
import { toast } from '../state/notifications';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { cssVars } from '../ui/cssVars';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './FactionsScreen.module.css';
import { useClosePanel } from './shared';

export function FactionsScreen() {
  const close = useClosePanel();
  const { view: loaded } = useLoaderData<typeof factionsLoader>();
  const [view, setView] = useState<FactionsView>(loaded);
  const [busy, setBusy] = useState(false);
  const total = view.points.majin + view.points.tenjin;

  const join = async (side: Faction): Promise<void> => {
    setBusy(true);
    try {
      setView(await apiFetch('factionJoin', { body: { side } }));
      toast('success', `You fight for the ${FACTION_LABELS[side].name} this season.`);
    } catch (e) {
      toast('warn', describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Majin vs Tenjin" eyebrow={`Season ${view.season}`} subtitle={`Ends in ${timeLeft(view.endsAt, Date.now())}`} onClose={close}>
      <div className={l.stackLg}>
        <section className={l.section} aria-label="Standings" data-testid="factions-standings">
          <p className={s.score}>
            <span>Majin {view.points.majin}</span>
            <span>{view.points.tenjin} Tenjin</span>
          </p>
          <div className={s.tug} style={cssVars({ '--majin': total === 0 ? 1 : view.points.majin, '--tenjin': total === 0 ? 1 : view.points.tenjin })} aria-hidden>
            <span className={s.tugMajin} />
            <span className={s.tugTenjin} />
          </div>
          <p className={l.caption}>
            {view.members.majin} on the Majin side, {view.members.tenjin} on the Tenjin side. A ranked win earns your side {FACTION_POINTS.rankedWin}, a raid cleared{' '}
            {FACTION_POINTS.raidClear}, a mission claimed {FACTION_POINTS.mission}. The side ahead when the season ends holds the sky over Solenne all the next.
          </p>
          {view.sky !== null && <p className={l.body}>The {FACTION_LABELS[view.sky].name} hold the sky over Solenne this season.</p>}
        </section>

        <div className={s.sides}>
          {FACTIONS.map((side) => {
            const mine = view.mine?.side === side;
            return (
              <section key={side} className={cx(s.side, side === 'majin' ? s.sideMajin : s.sideTenjin, mine && s.sideMine)} aria-label={FACTION_LABELS[side].name} data-testid={`faction-${side}`}>
                <h4 className={s.sideName}>{FACTION_LABELS[side].name}</h4>
                <p className={s.motto}>{FACTION_LABELS[side].motto}</p>
                <p className={l.caption}>{FACTION_LABELS[side].creed}</p>
                {view.top[side].length > 0 && (
                  <ol className={s.top} aria-label={`Best ${FACTION_LABELS[side].name}`}>
                    {view.top[side].map((r) => (
                      <li key={r.username} className={s.topRow}>
                        <Link to={`/play/players/${r.username}`}>{r.username}</Link>
                        <span className={s.points}>{r.points}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {mine && <Pill tone="accent">Your side · {view.mine!.points} points</Pill>}
                {view.mine === null && (
                  <Button variant="primary" busy={busy} onClick={() => void join(side)}>
                    Side with the {FACTION_LABELS[side].name}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
        {view.mine === null && <p className={l.caption}>Your side holds until the season ends. Every season you choose again.</p>}

        <section className={l.section} aria-label="The Chronicle" data-testid="factions-chronicle">
          <h4 className={l.sectionTitle}>The Chronicle</h4>
          {view.chronicle.length === 0 ? (
            <p className={l.caption}>No season has ended yet. The first one writes the first line.</p>
          ) : (
            <ol className={s.chronicle}>
              {view.chronicle.map((c) => (
                <li key={c.season} className={l.body}>
                  {c.line}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Panel>
  );
}
