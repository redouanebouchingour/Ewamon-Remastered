/**
 * LLM feature 8 `/play/rumours`: a town's rumour board. Opened by paging past the town crier's lines (beside the
 * Marshal in the town's Healer, else its Mart; Skyrend's Marshal's Office), with `?town=`, or from the More menu (the
 * town the player stands in, else the last one). The day's facts show at once in the crier's template words, each with
 * the creature's sprite or the type it is about; the model's words replace them one by one as they come back checked
 * (state/rumours.ts). The facts about the player sit apart, under "About you". Read-only.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { TypeName } from '@ewa/core';
import type { RumourFact, RumourKind } from '@ewa/protocol';
import { zoneName } from '../data/content';
import { noDashes } from '../talk/llm';
import { templateRumour } from '../talk/rumours';
import { closeRumours, defaultTown, openRumours, reachableTowns, townName, useRumoursStore } from '../state/rumours';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import s from './RumoursScreen.module.css';
import { useClosePanel } from './shared';

/** The tag over each rumour. */
export const KIND_LABEL: Readonly<Record<RumourKind, string>> = {
  badge: 'Badges',
  champion: 'Champion',
  raid: 'Raid',
  swarm: 'Swarm',
  event: 'Event',
  ecosystem: 'Wildlife',
  migrant: 'Migrants',
  bounty: 'Wanted',
  claim: 'Brought in',
  camp: 'Camps',
  nemesis: 'Nemesis',
  weather: 'Weather',
  market: 'Market',
  cup: 'Arena cup',
  gossip: 'Gossip',
  standing: 'Your name',
};

/** The slab's icon for a fact about no creature and no type (never a letter code). */
export const KIND_ICON: Readonly<Record<RumourKind, IconName>> = {
  badge: 'star',
  champion: 'trophy',
  raid: 'sword',
  swarm: 'leaf',
  event: 'sparkle',
  ecosystem: 'leaf',
  migrant: 'map',
  bounty: 'tag',
  claim: 'tag',
  camp: 'shield',
  nemesis: 'warn',
  weather: 'sun',
  market: 'market',
  cup: 'trophy',
  gossip: 'social',
  standing: 'user',
};

const ABOUT_YOU: ReadonlySet<RumourKind> = new Set<RumourKind>(['gossip', 'standing']);

const TYPES: ReadonlySet<string> = new Set(['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel', 'Fairy', 'Dark', 'Cosmic']);
const typeOf = (t: string | null): TypeName | null => (t !== null && TYPES.has(t) ? (t as TypeName) : null);

/** "Thursday 22 October", the board's UTC day. */
export function boardDate(day: string): string {
  const t = Date.parse(`${day}T12:00:00Z`);
  return Number.isNaN(t) ? day : new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function Rumour({ fact, words, town }: { readonly fact: RumourFact; readonly words: string | undefined; readonly town: string }) {
  const type = typeOf(fact.type);
  const text = noDashes(words ?? templateRumour(fact, town));
  return (
    <li className={s.item} data-kind={fact.kind} data-from={words !== undefined ? 'model' : 'template'} data-testid="rumour">
      <span className={s.slab} data-type={type ?? undefined} aria-hidden>
        {fact.speciesId !== null ? <CreatureSprite speciesId={fact.speciesId} size="sm" /> : type !== null ? <TypeBadge type={type} size="sm" compact /> : <Icon name={KIND_ICON[fact.kind]} size="lg" className={s.mark} />}
      </span>
      <span className={s.body}>
        <span className={s.head}>
          <span className={s.kind}>{KIND_LABEL[fact.kind]}</span>
          {fact.zoneId !== null && <span className={s.where}>{zoneName(fact.zoneId)}</span>}
          {type !== null && fact.speciesId !== null && <TypeBadge type={type} size="sm" compact />}
        </span>
        <span className={s.text}>{text}</span>
      </span>
    </li>
  );
}

export function RumoursScreen() {
  const close = useClosePanel();
  const [params, setParams] = useSearchParams();
  const zoneId = useSessionStore((st) => st.zoneId);
  const badges = useSessionStore((st) => st.progression?.badges);
  const town = useRumoursStore((st) => st.town);
  const lastTown = useRumoursStore((st) => st.lastTown);
  const status = useRumoursStore((st) => st.status);
  const view = useRumoursStore((st) => st.view);
  const words = useRumoursStore((st) => st.words);
  const writing = useRumoursStore((st) => st.writing);
  const wanted = defaultTown(params.get('town'), zoneId, lastTown);

  useEffect(() => {
    void openRumours(wanted);
  }, [wanted]);
  useEffect(() => () => closeRumours(), []);

  const towns = reachableTowns(badges ?? []);
  const shown = towns.includes(wanted) ? towns : [...towns, wanted];
  const name = townName(town ?? wanted);
  const world = view?.facts.filter((f) => !ABOUT_YOU.has(f.kind)) ?? [];
  const about = view?.facts.filter((f) => ABOUT_YOU.has(f.kind)) ?? [];

  return (
    <Panel
      title="Rumours"
      eyebrow={`${name} · Town Crier`}
      subtitle="Today's news from the town and the roads around it. Every name and number on the board is true."
      onClose={close}
      bodyClassName={s.screen}
      toolbar={
        shown.length > 1 ? (
          <div className={s.towns} role="group" aria-label="Town">
            {shown.map((t) => (
              <button key={t} type="button" className={cx(s.town, t === wanted && s.townOn)} aria-pressed={t === wanted} onClick={() => setParams({ town: t })}>
                {townName(t)}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {status === 'loading' || status === 'idle' ? (
        <Skeleton shape="rows" count={4} label="Reading the board" />
      ) : status === 'off' ? (
        <p className={s.note}>The crier has the day off. The board is bare.</p>
      ) : status === 'error' || view === null ? (
        <div className={s.note}>
          <p>The board could not be read just now.</p>
          <Button variant="secondary" onClick={() => void openRumours(wanted)}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <p className={s.masthead}>
            <span className={s.title}>The {name} Crier</span>
            <span className={s.date}>{boardDate(view.day)}</span>
          </p>
          <p className={s.status} aria-live="polite" data-testid="rumour-status">
            {writing ? 'The crier is writing up the news…' : ''}
          </p>
          {world.length === 0 ? (
            <p className={s.note}>Nothing on the board today.</p>
          ) : (
            <ol className={s.list} aria-label="The news">
              {world.map((f) => (
                <Rumour key={f.id} fact={f} words={words[f.id]} town={view.town} />
              ))}
            </ol>
          )}
          {about.length > 0 && (
            <section className={s.about} aria-label="About you">
              <h4 className={s.aboutTitle}>About you</h4>
              <ol className={s.list}>
                {about.map((f) => (
                  <Rumour key={f.id} fact={f} words={words[f.id]} town={view.town} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </Panel>
  );
}
