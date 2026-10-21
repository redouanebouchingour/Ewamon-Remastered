/**
 * A living ecosystem on the Dex (GET /world/ecosystem/:zoneId): "This week on <zone>", a broadcast board for one zone
 * the player has been to (where they stand, by default): what is surging (hunters whose prey was overhunted), what is
 * scarce (overhunted, or away on migration), who migrated in for the season, and the honor tilt. Each creature shows
 * as the Dex knows it (a silhouette and ??? until seen); picking one opens its Dex entry. Hidden while the server runs
 * without it (ECOSYSTEM=off) or before it answers.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ZoneId } from '@ewa/content';
import type { EcoSpeciesView, EcosystemView } from '@ewa/protocol';
import { primaryType, speciesName, zoneName } from '../data/content';
import { defaultEcoZone, ecoZones, factorLabel, takenLine, takesLine, tiltLine } from '../data/ecosystem';
import { visitedSet } from '../data/worldMap';
import { apiFetch } from '../net/api';
import { useSessionStore } from '../state/session';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Select } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { cx } from '../ui/cx';
import s from './EcosystemPanel.module.css';
import l from './layout.module.css';

const NO_FLAGS: readonly string[] = [];
const EMPTY: readonly string[] = [];

function ends(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

interface RowProps {
  readonly speciesId: string;
  readonly known: (id: string) => boolean;
  readonly onPick: (id: string) => void;
  readonly tag: string;
  readonly tone: 'up' | 'down' | 'hot';
  readonly line: string;
}

function Row({ speciesId, known, onPick, tag, tone, line }: RowProps) {
  const seen = known(speciesId);
  const name = seen ? speciesName(speciesId) : '???';
  return (
    <li>
      <button type="button" className={s.row} onClick={() => onPick(speciesId)} aria-label={`${name}: ${tag}. ${line}`} disabled={!seen}>
        <span className={s.slab} data-type={seen ? primaryType(speciesId) : undefined}>
          <CreatureSprite speciesId={speciesId} size="sm" silhouette={!seen} />
        </span>
        <span className={s.rowBody}>
          <span className={s.rowHead}>
            <span className={s.name}>{name}</span>
            <span className={cx(s.tag, s[tone])}>
              {tone === 'up' && <Icon name="arrowUp" size="sm" />}
              {tone === 'down' && <Icon name="arrowDown" size="sm" />}
              {tag}
            </span>
          </span>
          <span className={l.caption}>{line}</span>
        </span>
      </button>
    </li>
  );
}

function names(ids: readonly string[], known: (id: string) => boolean): string {
  const shown = ids.slice(0, 3).map((id) => (known(id) ? speciesName(id) : '???'));
  return ids.length > 3 ? `${shown.join(', ')} and ${ids.length - 3} more` : shown.join(', ');
}

function Column({ title, children, empty, testId }: { readonly title: string; readonly children: ReactNode[]; readonly empty: string; readonly testId: string }) {
  return (
    <section className={s.column} aria-label={title} data-testid={testId}>
      <h4 className={s.columnTitle}>{title}</h4>
      {children.length === 0 ? <p className={l.caption}>{empty}</p> : <ol className={s.list}>{children}</ol>}
    </section>
  );
}

export function EcosystemPanel({ onPick }: { readonly onPick: (speciesId: string) => void }) {
  const current = useSessionStore((st) => st.zoneId);
  const flags = useSessionStore((st) => st.progression?.flags ?? NO_FLAGS);
  const seenIds = useSessionStore((st) => st.progression?.dexSeen ?? EMPTY);
  const caughtIds = useSessionStore((st) => st.progression?.dexCaught ?? EMPTY);
  const zones = useMemo(() => ecoZones(visitedSet(flags, current)), [flags, current]);
  const [picked, setPicked] = useState<ZoneId | null>(null);
  const zoneId = picked !== null && zones.includes(picked) ? picked : defaultEcoZone(current, zones);
  const [view, setView] = useState<EcosystemView | null>(null);
  useEffect(() => {
    if (zoneId === null) return;
    const ctl = new AbortController();
    apiFetch('worldEcosystem', { params: { zoneId }, signal: ctl.signal })
      .then(setView)
      .catch(() => setView(null));
    return () => ctl.abort();
  }, [zoneId]);
  const known = useMemo(() => {
    const set = new Set([...seenIds, ...caughtIds]);
    return (id: string): boolean => set.has(id);
  }, [seenIds, caughtIds]);
  if (zoneId === null || view === null || view.zoneId !== zoneId || !view.enabled) return null;
  const row = (sp: EcoSpeciesView, tone: RowProps['tone'], line: string) => (
    <Row key={sp.speciesId} speciesId={sp.speciesId} known={known} onPick={onPick} tag={factorLabel(sp.factor)} tone={tone} line={line} />
  );
  return (
    <section className={s.panel} aria-label={`This week on ${zoneName(zoneId)}`} data-testid="ecosystem-panel">
      <header className={s.head}>
        <div className={s.title}>
          <span className={s.kicker}>This week on</span>
          <h3 className={s.zone}>{zoneName(zoneId)}</h3>
        </div>
        <p className={s.meta}>
          Season {view.season} · week {view.week} of 4 · until {ends(view.endsAt)}
        </p>
        {zones.length > 1 && (
          <Select
            label="Zone"
            hideLabel
            value={zoneId}
            options={zones.map((z) => ({ value: z, label: zoneName(z) }))}
            onChange={(v) => setPicked(v)}
            className={s.picker}
          />
        )}
      </header>
      <p className={cx(l.body, s.lede)}>{takesLine(view)}</p>
      <div className={s.columns}>
        <Column title="Surging" testId="eco-surging" empty="No hunter is feasting this week.">
          {view.surging.map((sp) => row(sp, 'up', sp.preyOn.length > 0 ? `Hunts ${names(sp.preyOn, known)}` : 'More of them about'))}
        </Column>
        <Column title="Scarce" testId="eco-scarce" empty="Nothing is overhunted.">
          {view.scarce.map((sp) => {
            const away = view.migrantsOut.find((m) => m.speciesId === sp.speciesId);
            return row(sp, 'down', away !== undefined && sp.cause === 'away' ? `Gone to ${zoneName(away.to)} for the season` : takenLine(sp));
          })}
        </Column>
        <Column title="Migrated in" testId="eco-migrants" empty="No one moved in this season.">
          {view.migrantsIn.map((m) => (
            <Row key={m.speciesId} speciesId={m.speciesId} known={known} onPick={onPick} tag="New" tone="hot" line={`From ${zoneName(m.from)}, for the season`} />
          ))}
        </Column>
        <Column title="Honor tilt" testId="eco-tilt" empty={tiltLine(view)}>
          {view.tilted.length === 0
            ? []
            : [
                <li key="line" className={cx(l.caption, s.tiltLine, view.shadow > 0 ? s.tiltShadow : s.tiltLight)}>
                  {tiltLine(view)}
                </li>,
                ...view.tilted.map((sp) => row(sp, 'up', sp.cause === 'shadow' ? 'Drawn by the shadow' : 'Drawn by the light')),
              ]}
        </Column>
      </div>
    </section>
  );
}
