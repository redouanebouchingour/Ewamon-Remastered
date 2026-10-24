/**
 * A recurring rival on the Profile (GET /rival, LLM feature 7): who the rival is (its signature creature on its type
 * colour, its name and temperament, where it is in its arc), the record between the two of you, the last meeting and
 * the rival's parting words, and the team it brought. Before the first meeting a line says what to expect; with the
 * server's `RIVAL=off` the section is not there. Reloads after every meeting (`useRivalStore.version`).
 */
import { useEffect, useState } from 'react';
import { RIVAL_TEMPERAMENT_TEXT } from '@ewa/content';
import type { RivalArc } from '@ewa/content';
import type { RivalState, RivalView } from '@ewa/protocol';
import { primaryType, species, speciesName, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { useRivalStore } from '../state/rival';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TypeBadge } from '../ui/TypeBadge';
import l from './layout.module.css';
import s from './RivalSection.module.css';
import { relativeTime } from './shared';

export const ARC_LABEL: Readonly<Record<RivalArc, string>> = { cocky: 'Cocky', frustrated: 'Frustrated', respectful: 'Respectful' };
const ARC_TEXT: Readonly<Record<RivalArc, string>> = {
  cocky: 'Sure it will win, every time.',
  frustrated: 'You keep beating it, and it wants revenge.',
  respectful: 'It respects you now, and still wants to win.',
};

/** The last meeting as a line ("Last met on Ash Route 2 hours ago: you won."). */
export function lastLine(r: RivalView): string | null {
  const m = r.last;
  if (m === null) return null;
  const how = m.result === 'won' ? 'you won' : m.result === 'lost' ? `${r.name} won` : 'a draw';
  return `Last met on ${zoneName(m.zoneId)} ${relativeTime(m.at)}: ${how}.`;
}

export function RivalSection() {
  const [state, setState] = useState<RivalState | null>(null);
  const version = useRivalStore((st) => st.version);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('rival', { signal: ctl.signal })
      .then(setState)
      .catch(() => undefined);
    return () => ctl.abort();
  }, [version]);
  if (state === null || !state.enabled) return null;
  const r = state.rival;
  return (
    <section className={l.section} aria-label="Rival" data-testid="rival-section">
      <h4 className={l.sectionTitle}>Rival</h4>
      {r === null ? (
        <p className={l.caption}>
          No rival yet. Once you hold a badge, a trainer on the routes may decide you are worth beating. It will walk up to you, and it will keep coming back.
        </p>
      ) : (
        <RivalCard r={r} />
      )}
    </section>
  );
}

function RivalCard({ r }: { readonly r: RivalView }) {
  const sig = r.team[0]?.speciesId ?? r.signature;
  const types = species(sig)?.types ?? [];
  const line = lastLine(r);
  return (
    <div className={s.card} data-type={primaryType(sig)}>
      <span className={s.slab}>
        <CreatureSprite speciesId={sig} size="md" />
      </span>
      <div className={s.body}>
        <span className={s.head}>
          <span className={s.name}>{r.name}</span>
          <span className={s.title}>Your rival</span>
          <span className={s.arc} title={ARC_TEXT[r.arc]}>
            {ARC_LABEL[r.arc]}
          </span>
        </span>
        <span className={l.caption}>
          {RIVAL_TEMPERAMENT_TEXT[r.temperament][0]!.toUpperCase()}
          {RIVAL_TEMPERAMENT_TEXT[r.temperament].slice(1)}. {ARC_TEXT[r.arc]} Leads with {speciesName(sig)}.
        </span>
        <span className={s.types}>
          {types.map((t) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
        </span>
        <dl className={s.record} aria-label="Record">
          <div className={s.stat}>
            <dt>You</dt>
            <dd>{r.record.playerWins}</dd>
          </div>
          <div className={s.stat}>
            <dt>{r.name}</dt>
            <dd>{r.record.rivalWins}</dd>
          </div>
          <div className={s.stat}>
            <dt>Draws</dt>
            <dd>{r.record.draws}</dd>
          </div>
          <div className={s.stat}>
            <dt>Battles</dt>
            <dd>{r.record.meetings}</dd>
          </div>
        </dl>
        {line !== null && <span className={l.body}>{line}</span>}
        {r.last?.words != null && (
          <blockquote className={s.words}>
            <span className={s.wordsBy}>{r.name}</span>
            {r.last.words}
          </blockquote>
        )}
        {r.team.length > 0 && (
          <span className={s.team} aria-label="The team it brought last time">
            {r.team.map((c, i) => (
              <span key={`${c.speciesId}:${i}`} className={s.member} title={`${speciesName(c.speciesId)} Lv ${c.level}`}>
                <CreatureSprite speciesId={c.speciesId} size="sm" />
                <span className={s.level}>Lv {c.level}</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
