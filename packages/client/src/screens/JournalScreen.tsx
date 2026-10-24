/**
 * LLM feature 9 `/play/journal`: the adventure journal, a page for every day the player plays (the UTC day), in their
 * own voice. Today first (its page, the facts of the day as chips, Copy and Rewrite today), then the earlier pages,
 * newest first. The missing pages are written when the screen opens (state/journal.ts): the model's words when they
 * hold to the day's facts, else the facts themselves. Opened from the More menu.
 */
import { useEffect } from 'react';
import type { TypeName } from '@ewa/core';
import type { JournalDay, JournalEntryView, JournalFact, JournalFactKind } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { noDashes } from '../talk/llm';
import { closeJournal, copyEntry, isStale, openJournal, rewriteToday, useJournalStore } from '../state/journal';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import { TypeBadge } from '../ui/TypeBadge';
import s from './JournalScreen.module.css';
import { useClosePanel } from './shared';

const KIND_ICON: Readonly<Record<JournalFactKind, IconName>> = {
  badge: 'star',
  champion: 'trophy',
  legendary: 'sparkle',
  shiny: 'sparkle',
  caught: 'orb',
  hatched: 'heart',
  evolved: 'arrowUp',
  received: 'heart',
  rival: 'sword',
  league: 'trophy',
  villager: 'sword',
  trainers: 'sword',
  wild: 'leaf',
  pvp: 'sword',
  raid: 'shield',
  bounty: 'tag',
  nemesis: 'warn',
  favour: 'check',
  haggle: 'coin',
  deed: 'social',
  zones: 'map',
};

const TYPES: ReadonlySet<string> = new Set(['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel', 'Fairy', 'Dark', 'Cosmic']);
const typeOf = (t: string | null): TypeName | null => (t !== null && TYPES.has(t) ? (t as TypeName) : null);

/** A fact's chip label: short, the fact's own words in full on hover. */
export function chipLabel(f: JournalFact): string {
  const sp = f.speciesId !== null ? speciesName(f.speciesId) : '';
  const n = f.count > 1 ? `${f.count}× ` : '';
  switch (f.kind) {
    case 'caught':
      return `${n}${sp}`;
    case 'shiny':
      return `Shiny ${sp}`;
    case 'hatched':
      return `Hatched ${sp}`;
    case 'evolved':
      return `Evolved ${sp}`;
    case 'received':
      return `${n}${sp}`;
    case 'legendary':
      return sp;
    case 'badge':
      return /the (.+ Badge)/.exec(f.text)?.[1] ?? 'Badge';
    case 'champion':
      return 'Champion';
    case 'rival':
      return 'Rival';
    case 'league':
      return 'League';
    case 'villager':
      return 'Villager';
    case 'trainers':
      return `${f.count} trainer${f.count === 1 ? '' : 's'}`;
    case 'wild':
      return `${f.count} wild`;
    case 'pvp':
      return `${f.count} arena`;
    case 'raid':
      return 'Raid';
    case 'bounty':
      return 'Bounty';
    case 'nemesis':
      return 'Nemesis';
    case 'favour':
      return 'Favour';
    case 'haggle':
      return 'Haggle';
    case 'deed':
      if (/kind words/.test(f.text)) return 'Kind words';
      if (/gift/.test(f.text)) return 'Gift';
      return /^I (\w+)/.exec(f.text)?.[1] ?? 'Deed';
    case 'zones':
      return `${f.count} place${f.count === 1 ? '' : 's'}`;
  }
}

/** "Saturday 24 October", the page's UTC day. */
export function pageDate(day: string): string {
  const t = Date.parse(`${day}T12:00:00Z`);
  return Number.isNaN(t) ? day : new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function Chips({ facts }: { readonly facts: readonly JournalFact[] }) {
  if (facts.length === 0) return null;
  return (
    <ul className={s.chips} aria-label="What happened">
      {facts.map((f, i) => {
        const type = typeOf(f.type);
        return (
          <li key={`${f.kind}:${i}`} className={s.chip} title={noDashes(f.text)} data-kind={f.kind} data-testid="journal-chip">
            {f.speciesId !== null ? <CreatureSprite speciesId={f.speciesId} size="sm" /> : type !== null ? <TypeBadge type={type} size="sm" compact /> : <Icon name={KIND_ICON[f.kind]} size="sm" />}
            <span className={s.chipText}>{chipLabel(f)}</span>
            <span className="visually-hidden">{noDashes(f.text)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Page({ entry, today }: { readonly entry: JournalEntryView; readonly today?: boolean }) {
  return (
    <article className={s.page} data-testid="journal-page" aria-label={`Day ${entry.dayNumber}`}>
      <header className={s.head}>
        <span className={s.day}>Day {entry.dayNumber}</span>
        <span className={s.date}>{today ? `Today · ${pageDate(entry.day)}` : pageDate(entry.day)}</span>
        <Button variant="ghost" size="sm" className={s.copy} onClick={() => void copyEntry(entry.text)}>
          Copy
        </Button>
      </header>
      <p className={s.text}>{noDashes(entry.text)}</p>
      <Chips facts={entry.facts} />
    </article>
  );
}

function Today({ day, writing }: { readonly day: JournalDay; readonly writing: boolean }) {
  const stale = isStale(day.entry, day.facts);
  return (
    <section className={s.today} aria-label="Today">
      {day.entry !== null ? (
        <Page entry={day.entry} today />
      ) : (
        <article className={s.page} aria-label={`Day ${day.dayNumber}`}>
          <header className={s.head}>
            <span className={s.day}>Day {day.dayNumber}</span>
            <span className={s.date}>Today · {pageDate(day.day)}</span>
          </header>
          {day.facts.length === 0 ? (
            <p className={s.note}>Nothing in the journal yet today. Catch something, battle someone, help a villager.</p>
          ) : (
            <p className={s.note} aria-live="polite">
              {writing ? 'Writing today’s page…' : 'Today’s page is not written yet.'}
            </p>
          )}
          <Chips facts={day.facts} />
        </article>
      )}
      {day.entry !== null && (
        <div className={s.actions}>
          {stale && <span className={s.stale}>More happened since this page was written.</span>}
          <Button variant={stale ? 'primary' : 'secondary'} size="sm" disabled={writing} onClick={() => void rewriteToday()}>
            {writing ? 'Writing…' : 'Rewrite today'}
          </Button>
        </div>
      )}
    </section>
  );
}

export function JournalScreen() {
  const close = useClosePanel();
  const status = useJournalStore((st) => st.status);
  const view = useJournalStore((st) => st.view);
  const writing = useJournalStore((st) => st.writing);
  useEffect(() => {
    void openJournal();
    return () => closeJournal();
  }, []);
  const earlier = view?.entries.filter((e) => e.day !== view.today.day) ?? [];
  return (
    <Panel title="Journal" eyebrow="Adventure journal" subtitle="A page for every day you play, in your own words. Days turn at midnight UTC." onClose={close} bodyClassName={s.screen}>
      {status === 'loading' || status === 'idle' ? (
        <Skeleton shape="rows" count={3} label="Opening the journal" />
      ) : status === 'off' ? (
        <p className={s.note}>The journal is closed on this server.</p>
      ) : status === 'error' || view === null ? (
        <div className={s.note}>
          <p>The journal could not be read just now.</p>
          <Button variant="secondary" onClick={() => void openJournal()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <Today day={view.today} writing={writing.includes(view.today.day)} />
          {earlier.length > 0 && (
            <section className={s.earlier} aria-label="Earlier days">
              <h4 className={s.earlierTitle}>Earlier days</h4>
              {earlier.map((e) => (
                <Page key={e.day} entry={e} />
              ))}
            </section>
          )}
          {writing.some((d) => d !== view.today.day) && (
            <p className={s.note} aria-live="polite">
              Writing up the days you missed…
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
