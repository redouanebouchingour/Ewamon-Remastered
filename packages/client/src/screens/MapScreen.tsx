/**
 * Phase C3 `/play/map` — the world map. Every zone sits at its content map cell (a BFS over the 4-neighbour links,
 * `zoneMapPositions`), links are drawn between neighbours, badge gates show earned / locked, zones the player has been
 * to (server `visited:<zone>` flags) are lit, the current zone is marked, and visited towns carry a Travel button that
 * sends `fastTravel { zoneId }` — the server answers with the usual `handover` (or a refusal toast). The board scrolls
 * sideways; it opens centred on the current zone.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SHADOW_MAX } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { BadgeId } from '@ewa/protocol';
import { BADGE_GLYPH } from '../data/badgeIcon';
import { KIND_LABEL, MAP_LINKS, MAP_NODES, MAP_SIZE, badgeName, badgeShortName, canTravelTo, visitedSet } from '../data/worldMap';
import type { MapNode } from '../data/worldMap';
import { apiFetch } from '../net/api';
import { speciesName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { cssVars } from '../ui/cssVars';
import { cx } from '../ui/cx';
import { useArenaStore } from '../state/arena';
import l from './layout.module.css';
import s from './MapScreen.module.css';
import { useClosePanel } from './shared';

const NO_FLAGS: readonly string[] = [];
const NO_BADGES: readonly BadgeId[] = [];

const byId = new Map(MAP_NODES.map((n) => [n.id, n]));

function services(n: MapNode): string {
  const out: string[] = [];
  if (n.gym) out.push('Gym');
  if (n.healer) out.push('Healer');
  if (n.shop) out.push('Shop');
  return out.join(' · ');
}

function ZoneNode({
  n,
  visited,
  current,
  earned,
  canTravel,
  onTravel,
  shadow,
  roamer,
}: {
  readonly n: MapNode;
  readonly visited: boolean;
  readonly current: boolean;
  readonly earned: readonly BadgeId[];
  readonly canTravel: boolean;
  readonly onTravel: (id: ZoneId) => void;
  /** honor shapes the world: the zone's shadow level this season (0 = clear) */
  readonly shadow: number;
  /** one roaming legendary per season: the roamer's name while it is on this route (null elsewhere) */
  readonly roamer: string | null;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // open centred on where you stand (jsdom has no scrollIntoView)
    if (current) ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [current]);
  const gateOpen = n.gate === null || earned.includes(n.gate as BadgeId);
  const state = current ? 'you are here' : visited ? 'visited' : 'unexplored';
  return (
    <li
      ref={ref}
      className={s.cell}
      style={cssVars({ '--col': n.col + 1, '--row': n.row + 1 })}
      aria-label={`${n.name}, ${KIND_LABEL[n.kind].toLowerCase()}, ${state}`}
      data-zone={n.id}
    >
      <div className={cx(s.node, s[n.kind], visited && s.visited, current && s.current)}>
        <div className={s.nodeHead}>
          <span className={s.kindMark} aria-hidden />
          <span className={s.name}>{n.name}</span>
        </div>
        <span className={l.caption}>{visited ? KIND_LABEL[n.kind] : `${KIND_LABEL[n.kind]} · unexplored`}</span>
        {n.kind === 'town' && visited && services(n) !== '' && <span className={s.services}>{services(n)}</span>}
        {n.gate !== null && (
          <span className={cx(s.gate, gateOpen && s.gateOpen)} title={gateOpen ? `Gate: ${badgeName(n.gate)} (earned)` : `Needs the ${badgeName(n.gate)}`}>
            <span aria-hidden>{BADGE_GLYPH[n.gate as BadgeId] ?? '•'}</span>
            {gateOpen ? (
              badgeShortName(n.gate)
            ) : (
              <>
                <Icon name="lock" size="sm" /> {badgeShortName(n.gate)}
              </>
            )}
          </span>
        )}
        {shadow > 0 && (
          <span className={s.shadow} title={shadowTitle(shadow)}>
            {shadow >= SHADOW_MAX ? 'Hollowed' : `Shadow ${shadow}`}
          </span>
        )}
        {roamer !== null && (
          <span className={s.roamer} title={`${roamer} roams here until it moves on. The first trainer to catch it this season is remembered.`}>
            {roamer} seen here
          </span>
        )}
        <div className={s.nodeFoot}>
          {current && <Pill tone="accent">You are here</Pill>}
          {canTravel && (
            <Button size="sm" variant="primary" onClick={() => onTravel(n.id)} ariaLabel={`Travel to ${n.name}`}>
              Travel
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** What the shadow tag says on hover. */
export function shadowTitle(level: number): string {
  return level >= SHADOW_MAX
    ? 'Hollowed: the cruellest fights of the season were fought here. Catch, spare and win fair to bring the light back.'
    : `A shadow (level ${level} of ${SHADOW_MAX}): too many fights here were won the cruel way. Catches and fair wins lift it.`;
}

export function MapScreen() {
  const close = useClosePanel();
  const navigate = useNavigate();
  const current = useSessionStore((st) => st.zoneId);
  const flags = useSessionStore((st) => st.progression?.flags ?? NO_FLAGS);
  const earned = useSessionStore((st) => st.progression?.badges ?? NO_BADGES);
  // arena PvP: no fast travel from the arena (the world is left behind until Back to world)
  const battling = useUiStore((st) => st.battle !== null);
  const inArena = useArenaStore((st) => st.inArena);
  const inBattle = battling || inArena;
  const visited = visitedSet(flags, current);
  // honor shapes the world: this season's shadowed zones (a failed read shows none)
  const [shadows, setShadows] = useState<ReadonlyMap<string, number>>(new Map());
  // one roaming legendary per season: the route the roamer is on (none once caught)
  const [roamer, setRoamer] = useState<{ readonly zoneId: string; readonly name: string } | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('worldShadow', { signal: ctl.signal })
      .then((r) => setShadows(new Map(r.zones.map((z) => [z.zoneId, z.level]))))
      .catch(() => undefined);
    apiFetch('legends', { signal: ctl.signal })
      .then((r) => setRoamer(r.zoneId === null ? null : { zoneId: r.zoneId, name: speciesName(r.species) }))
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);

  const travel = (zoneId: ZoneId): void => {
    getWorldSession().send('fastTravel', { zoneId });
    void navigate('/play'); // watch the crossing; a refusal arrives as a toast
  };

  return (
    <Panel title="World map" eyebrow={`${visited.size} of ${MAP_NODES.length} explored`} onClose={close} bodyClassName={s.body}>
      <div className={s.legend} aria-hidden>
        <span className={s.legendItem}>
          <span className={cx(s.swatch, s.swatchTown)} /> Town
        </span>
        <span className={s.legendItem}>
          <span className={cx(s.swatch, s.swatchRoute)} /> Route
        </span>
        <span className={s.legendItem}>
          <span className={cx(s.swatch, s.swatchStory)} /> Landmark
        </span>
        <span className={s.legendItem}>
          <span className={cx(s.swatch, s.swatchCurrent)} /> You are here
        </span>
        <span className={s.legendItem}>
          <span className={cx(s.swatch, s.swatchShadow)} /> Shadow: cruel fights darken a zone
        </span>
        <span className={s.legendHint}>Fast travel is free between towns you have visited.</span>
      </div>
      <div className={s.scroller} tabIndex={0} aria-label="World map, scrolls sideways">
        <div className={s.board} style={cssVars({ '--cols': MAP_SIZE.cols, '--rows': MAP_SIZE.rows })}>
          <svg className={s.links} viewBox={`0 0 ${MAP_SIZE.cols} ${MAP_SIZE.rows}`} preserveAspectRatio="none" aria-hidden>
            {MAP_LINKS.map((k) => {
              const a = byId.get(k.from)!;
              const b = byId.get(k.to)!;
              const known = visited.has(a.id) || visited.has(b.id);
              return (
                <line
                  key={`${k.from}-${k.to}`}
                  className={cx(s.link, known && s.linkKnown)}
                  x1={a.col + 0.5}
                  y1={a.row + 0.5}
                  x2={b.col + 0.5}
                  y2={b.row + 0.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          <ol className={s.nodes} aria-label="Zones">
            {MAP_NODES.map((n) => (
              <ZoneNode
                key={n.id}
                n={n}
                visited={visited.has(n.id)}
                current={n.id === current}
                earned={earned}
                canTravel={!inBattle && canTravelTo(n, visited, current)}
                onTravel={travel}
                shadow={shadows.get(n.id) ?? 0}
                roamer={roamer !== null && roamer.zoneId === n.id ? roamer.name : null}
              />
            ))}
          </ol>
        </div>
      </div>
    </Panel>
  );
}
