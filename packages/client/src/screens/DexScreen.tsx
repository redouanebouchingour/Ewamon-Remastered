/**
 * `/play/dex`: witnessing framing (SPEC §20.9.5). "Witnessed N / 144" in the display face with a segmented bar
 * (caught solid, seen-only hatched, unknown empty), the largest number in the UI. The entries in a sort order (dex number
 * by default): tiles, or a list with the stats as columns (`?density=list`). Unknown = silhouette `#???`, seen =
 * desaturated + name, caught = full colour with variant dots, an alpha mark and a sparkle for a shiny catch. Opening an
 * entry (`?id=`) folds the list into a rail of rows beside the entry (screens/dex/DexEntry.tsx). Filters, sort and
 * density live in the URL (screens/dex/dexList.ts); arrow keys walk the tiles, `[` / `]` the entries.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { BadgeId, Stage, ZoneId } from '@ewa/content';
import { TYPE_NAMES } from '@ewa/core';
import type { Rarity, SpeciesDef, TypeName, VariantKey } from '@ewa/core';
import { DEX_TOTAL, SPECIES_BY_DEX, zoneName } from '../data/content';
import { HABITAT_ZONES, dexAccess, statTotal } from '../data/dexInfo';
import type { DexState } from '../data/dexInfo';
import { buddyPlace } from '../state/buddy';
import { toProgressionDelta, useSessionStore } from '../state/session';
import { apiFetch } from '../net/api';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Segmented, Select, TextField } from '../ui/Field';
import { FormSigil, formMarkLabel } from '../ui/FormSigil';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Table } from '../ui/Table';
import { Tabs } from '../ui/Tabs';
import type { TableColumn } from '../ui/Table';
import { Toggle } from '../ui/Toggle';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import s from './DexScreen.module.css';
import l from './layout.module.css';
import { useClosePanel } from './shared';
import { EcosystemPanel } from './EcosystemPanel';
import { CompareView } from './dex/CompareView';
import { DexEntry } from './dex/DexEntry';
import { HabitatAtlas } from './dex/HabitatAtlas';
import { RewardsView } from './dex/RewardsView';
import { claimDexReward } from './dex/claim';
import { revealOf, startReveal, useRevealFor } from './dex/reveal';
import {
  SORT_DIR,
  SORT_KEYS,
  SORT_LABEL,
  filterRows,
  hasExtraFilters,
  readQuery,
  sortRowsBy,
  sortValue,
} from './dex/dexList';
import type { DexRow, SortKey, StateFilter } from './dex/dexList';

const EMPTY: readonly string[] = [];
const NO_VARIANTS: Readonly<Record<string, readonly VariantKey[]>> = {};
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythical'];
const STAGES: readonly Stage[] = ['base', 'mid', 'final', 'single'];
const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  single: 'Does not evolve',
  base: 'First stage',
  mid: 'Middle stage',
  final: 'Final stage',
};
const NO_BADGES: readonly BadgeId[] = [];

function entryLabel(sp: SpeciesDef, st: DexState): string {
  if (st === 'unknown') return `Unknown entry ${sp.dexNumber}`;
  const form =
    sp.battleForm?.kind !== undefined ? `, ${formMarkLabel(sp.battleForm.kind).toLowerCase()}` : '';
  return `${sp.name}, ${st === 'caught' ? 'recorded' : 'seen'}${form}`;
}

type DexView = 'entries' | 'habitat' | 'rewards';
const VIEWS: readonly { readonly key: DexView; readonly label: string }[] = [
  { key: 'entries', label: 'Entries' },
  { key: 'habitat', label: 'Habitat atlas' },
  { key: 'rewards', label: 'Rewards' },
];

const num3 = (n: number): string => `#${String(n).padStart(3, '0')}`;

/** Keyboard focus for a widget that types into a field is left alone. */
function typing(e: { readonly target: EventTarget | null }): boolean {
  const t = e.target as HTMLElement | null;
  return (
    t !== null &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  );
}

export function DexScreen() {
  const close = useClosePanel();
  const seen = useSessionStore((st) => st.progression?.dexSeen ?? EMPTY);
  const caught = useSessionStore((st) => st.progression?.dexCaught ?? EMPTY);
  const variants = useSessionStore((st) => st.progression?.dexVariants ?? NO_VARIANTS);
  const alphaIds = useSessionStore((st) => st.progression?.dexAlpha ?? EMPTY);
  const shinyIds = useSessionStore((st) => st.progression?.dexShiny ?? EMPTY);
  const researchMap = useSessionStore((st) => st.progression?.dexResearch);
  const entriesMap = useSessionStore((st) => st.progression?.dexEntries);
  /** the research level of a species, undefined without research data (an older server) */
  const researchOf = (id: string): number | undefined => (researchMap === undefined ? undefined : (researchMap[id] ?? 0));
  const badges = useSessionStore((st) => st.progression?.badges ?? NO_BADGES);
  const party = useSessionStore((st) => st.inventory?.party);
  const box = useSessionStore((st) => st.inventory?.box);
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const caughtSet = useMemo(() => new Set(caught), [caught]);
  const seenSet = useMemo(() => new Set([...seen, ...caught]), [seen, caught]);
  const shinySet = useMemo(() => new Set(shinyIds), [shinyIds]);
  const stateOf = (id: string): DexState =>
    caughtSet.has(id) ? 'caught' : seenSet.has(id) ? 'seen' : 'unknown';

  const qy = readQuery(params);
  const setParam = (k: string, v: string): void =>
    setParams(
      (p) => {
        if (v === '' || v === 'all') p.delete(k);
        else p.set(k, v);
        return p;
      },
      { replace: true },
    );
  /** open an entry (or close it with ''): a new entry starts on its Overview tab */
  const open = (id: string): void =>
    setParams(
      (p) => {
        if (id === '') p.delete('id');
        else p.set('id', id);
        p.delete('tab');
        return p;
      },
      { replace: true },
    );
  const setSort = (key: SortKey, dir?: 'asc' | 'desc'): void =>
    setParams(
      (p) => {
        if (key === 'num') p.delete('sort');
        else p.set('sort', key);
        const d = dir ?? SORT_DIR[key];
        if (d === SORT_DIR[key]) p.delete('dir');
        else p.set('dir', d);
        return p;
      },
      { replace: true },
    );

  const all: DexRow[] = SPECIES_BY_DEX.map((sp) => ({ sp, state: stateOf(sp.id), research: researchOf(sp.id) ?? null }));
  const rows = sortRowsBy(
    filterRows(all, qy, { shiny: shinySet, badges, timeOfDay: buddyPlace()?.timeOfDay ?? null }),
    qy.sort,
    qy.dir,
  );

  const selectedId = params.get('id');
  const selected = SPECIES_BY_DEX.find((sp) => sp.id === selectedId) ?? null;
  const recordedIn = useMemo(() => {
    if (selected === null) return [];
    const zones = new Set<string>();
    for (const c of [...(party ?? []), ...(box ?? [])])
      if (c.speciesId === selected.id && c.caughtAt !== null) zones.add(c.caughtAt.zoneId);
    return [...zones];
  }, [selected, party, box]);
  const claimedRewards = useSessionStore((st) => st.progression?.dexRewards);
  const viewParam = params.get('view');
  const view: DexView = viewParam === 'habitat' ? 'habitat' : viewParam === 'rewards' && claimedRewards !== undefined ? 'rewards' : 'entries';
  const cmp = (params.get('cmp') ?? '').split(',').filter((x) => x !== '');
  const setCompare = (ids: readonly string[]): void =>
    setParams(
      (p) => {
        const keep = ids.filter((x) => x !== '');
        if (ids.length === 0) p.delete('cmp');
        else p.set('cmp', ids.join(','));
        if (keep.length > 0) {
          p.delete('id');
          p.delete('tab');
          p.delete('view');
        }
        return p;
      },
      { replace: true },
    );
  const comparable = SPECIES_BY_DEX.filter((sp) => dexAccess(stateOf(sp.id), researchOf(sp.id)).compare);
  const at = selected === null ? -1 : rows.findIndex((r) => r.sp.id === selected.id);
  const prev = at > 0 ? rows[at - 1] : undefined;
  const next = at !== -1 && at < rows.length - 1 ? rows[at + 1] : undefined;

  // `[` / `]` walk the entries while one is open
  const step = useRef<{ prev?: string; next?: string }>({});
  step.current = { prev: prev?.sp.id, next: next?.sp.id };
  useEffect(() => {
    if (selected === null) return undefined;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const to = e.key === '[' ? step.current.prev : e.key === ']' ? step.current.next : undefined;
      if (to === undefined) return;
      e.preventDefault();
      open(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected?.id]);

  // the open entry's row stays in view in the rail
  const listRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (selected === null) return;
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  // reveal moments: the first opening since the entry was seen or recorded plays its reveal and marks it viewed
  const reveal = useRevealFor(selected?.id ?? null);
  useEffect(() => {
    if (selected === null || entriesMap === undefined) return;
    const id = selected.id;
    const e = entriesMap[id];
    const kind = revealOf(e);
    if (kind === null || e === undefined) return;
    startReveal(id, kind);
    apiFetch('dexViewed', { params: { speciesId: id } })
      .then((res) => {
        const cur = useSessionStore.getState().progression?.dexEntries;
        const was = cur?.[id];
        if (cur === undefined || was === undefined) return;
        useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ dexEntries: { ...cur, [id]: { ...was, viewedAt: res.viewedAt } } }));
      })
      .catch(() => undefined);
    // the reveal is decided once per opening; the entries changing under it (the viewed mark) must not replay it
  }, [selected?.id]);

  /** arrow keys move between tiles (rows in the rail), Home / End jump */
  const onGridKey = (e: KeyboardEvent<HTMLOListElement>): void => {
    const buttons = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > li > button'),
    ];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    const cols =
      selected === null
        ? Math.max(
            1,
            getComputedStyle(e.currentTarget)
              .gridTemplateColumns.split(' ')
              .filter((x) => x !== '').length,
          )
        : 1;
    let to = -1;
    if (e.key === 'ArrowRight') to = i + 1;
    else if (e.key === 'ArrowLeft') to = i - 1;
    else if (e.key === 'ArrowDown') to = i + cols;
    else if (e.key === 'ArrowUp') to = i - cols;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = buttons.length - 1;
    if (to < 0 || to >= buttons.length) return;
    e.preventDefault();
    buttons[to]!.focus();
    if (selected !== null) open(rows[to]!.sp.id);
  };

  const columns: TableColumn<DexRow>[] = [
    {
      key: 'num',
      header: '#',
      width: 64,
      render: (r) => <span className={s.mono}>{num3(r.sp.dexNumber)}</span>,
      sortValue: sortValue('num', qy.dir),
    },
    {
      key: 'name',
      header: 'Species',
      render: (r) => (
        <span className={s.listName}>
          <CreatureSprite
            speciesId={r.sp.id}
            size="sm"
            silhouette={r.state === 'unknown'}
            desaturate={r.state === 'seen'}
            animated
          />
          <span>{r.state === 'unknown' ? '???' : r.sp.name}</span>
          {shinySet.has(r.sp.id) && (
            <Icon name="sparkle" size="sm" className={s.shinyInline} label="Shiny recorded" />
          )}
        </span>
      ),
      sortValue: sortValue('name', qy.dir),
    },
    {
      key: 'types',
      header: 'Types',
      width: 96,
      render: (r) =>
        r.state === 'unknown' ? null : (
          <span className={l.row}>
            {r.sp.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" compact />
            ))}
          </span>
        ),
    },
    ...(['hp', 'atk', 'def', 'spd'] as const).map((k): TableColumn<DexRow> => ({
      key: k,
      header: k.toUpperCase(),
      width: 64,
      align: 'end',
      render: (r) =>
        r.state === 'caught'
          ? k === 'hp'
            ? r.sp.baseHp
            : k === 'atk'
              ? r.sp.baseAtk
              : k === 'def'
                ? r.sp.baseDef
                : r.sp.baseSpd
          : '-',
      sortValue: sortValue(k, qy.dir),
    })),
    {
      key: 'total',
      header: 'Total',
      width: 72,
      align: 'end',
      render: (r) => (r.state === 'caught' ? <b>{statTotal(r.sp)}</b> : '-'),
      sortValue: sortValue('total', qy.dir),
    },
    {
      key: 'rarity',
      header: 'Rarity',
      width: 104,
      render: (r) =>
        r.state === 'unknown' ? '-' : <span className={s.capital}>{r.sp.rarity}</span>,
      sortValue: sortValue('rarity', qy.dir),
    },
    {
      key: 'state',
      header: 'State',
      width: 96,
      render: (r) => (
        <span className={cx(s.stateTag, s[`st_${r.state}`])}>
          {r.state === 'caught' ? 'Recorded' : r.state === 'seen' ? 'Seen' : 'Unknown'}
        </span>
      ),
    },
  ];

  const witnessed = seenSet.size;
  const extra = hasExtraFilters(qy);
  const activeExtras = [qy.zone !== '', qy.rarity !== '', qy.stage !== '', qy.form, qy.now, qy.minResearch > 0].filter(Boolean).length;
  return (
    <Panel
      title="Dex"
      eyebrow="The record"
      onClose={close}
      toolbar={
        <div className={s.toolbars}>
          <div className={l.toolbar}>
            <TextField
              label="Search"
              hideLabel
              icon="search"
              type="search"
              placeholder="Name or number"
              value={qy.q}
              onChange={(v) => setParam('q', v)}
              className={s.search}
            />
            <Select
              label="Type"
              hideLabel
              value={qy.type}
              options={[
                { value: '' as TypeName | '', label: 'All types' },
                ...TYPE_NAMES.map((t) => ({ value: t as TypeName | '', label: t })),
              ]}
              onChange={(v) => setParam('type', v)}
            />
            <Segmented
              label="State"
              value={qy.state}
              options={[
                { value: 'all' as StateFilter, label: 'All' },
                { value: 'caught' as StateFilter, label: 'Recorded' },
                { value: 'seen' as StateFilter, label: 'Seen' },
                { value: 'unknown' as StateFilter, label: 'Unknown' },
                { value: 'shiny' as StateFilter, label: 'Shiny' },
              ]}
              onChange={(v) => setParam('state', v)}
            />
            <Button
              variant={showFilters || extra ? 'secondary' : 'ghost'}
              size="md"
              icon="grid"
              onClick={() => setShowFilters(!showFilters)}
              ariaLabel={`More filters${activeExtras > 0 ? `, ${activeExtras} on` : ''}`}
            >
              {activeExtras > 0 ? `Filters · ${activeExtras}` : 'Filters'}
            </Button>
            <Select
              label="Sort"
              hideLabel
              value={qy.sort}
              options={SORT_KEYS.map((k) => ({ value: k, label: `Sort: ${SORT_LABEL[k]}` }))}
              onChange={(v) => setSort(v)}
            />
            <Button
              variant="ghost"
              size="md"
              icon={qy.dir === 'asc' ? 'arrowUp' : 'arrowDown'}
              ariaLabel={
                qy.dir === 'asc'
                  ? 'Ascending, switch to descending'
                  : 'Descending, switch to ascending'
              }
              title={qy.dir === 'asc' ? 'Ascending' : 'Descending'}
              onClick={() => setSort(qy.sort, qy.dir === 'asc' ? 'desc' : 'asc')}
            >
              <span className="visually-hidden">
                {qy.dir === 'asc' ? 'Ascending' : 'Descending'}
              </span>
            </Button>
            <Segmented
              label="Density"
              value={qy.density}
              options={[
                { value: 'tiles', label: 'Tiles' },
                { value: 'list', label: 'List' },
              ]}
              onChange={(v) => setParam('density', v === 'tiles' ? '' : v)}
            />
          </div>
          {(showFilters || extra) && (
            <div className={cx(l.toolbar, s.toolbar2)} data-testid="dex-filters">
              <Select
                label="Zone"
                hideLabel
                value={qy.zone}
                options={[
                  { value: '' as ZoneId | '', label: 'Any zone' },
                  ...HABITAT_ZONES.map((z) => ({ value: z as ZoneId | '', label: zoneName(z) })),
                ]}
                onChange={(v) => setParam('zone', v)}
              />
              <Select
                label="Rarity"
                hideLabel
                value={qy.rarity}
                options={[
                  { value: '' as Rarity | '', label: 'Any rarity' },
                  ...RARITIES.map((r) => ({
                    value: r as Rarity | '',
                    label: r[0]!.toUpperCase() + r.slice(1),
                  })),
                ]}
                onChange={(v) => setParam('rarity', v)}
              />
              <Select
                label="Stage"
                hideLabel
                value={qy.stage}
                options={[
                  { value: '' as Stage | '', label: 'Any stage' },
                  ...STAGES.map((st) => ({ value: st as Stage | '', label: STAGE_LABEL[st] })),
                ]}
                onChange={(v) => setParam('stage', v)}
              />
              <Toggle
                label="Has a form"
                checked={qy.form}
                onChange={(v) => setParam('form', v ? '1' : '')}
                className={s.toggle}
              />
              <Toggle
                label="Catchable now"
                checked={qy.now}
                onChange={(v) => setParam('now', v ? '1' : '')}
                className={s.toggle}
              />
              {researchMap !== undefined && (
                <Select
                  label="Research"
                  hideLabel
                  value={String(qy.minResearch)}
                  options={[
                    { value: '0', label: 'Any research' },
                    ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 5 ? 'Fully researched' : `Research ${n}+` })),
                  ]}
                  onChange={(v) => setParam('research', v === '0' ? '' : v)}
                />
              )}
              {extra && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="close"
                  onClick={() =>
                    setParams(
                      (p) => {
                        for (const k of ['zone', 'rarity', 'stage', 'form', 'now', 'research']) p.delete(k);
                        return p;
                      },
                      { replace: true },
                    )
                  }
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      }
    >
      <header className={cx(s.hero, selected !== null && s.heroCompact)}>
        <div className={s.count}>
          <span className={s.countLabel}>Witnessed</span>
          <span className={s.countValue}>
            {witnessed}
            <span className={s.countTotal}> / {DEX_TOTAL}</span>
          </span>
        </div>
        <div className={s.barWrap}>
          <ProgressBar
            value={caught.length / DEX_TOTAL}
            secondary={witnessed / DEX_TOTAL}
            size="lg"
            label="Dex completion"
            valueText={`${caught.length} recorded, ${witnessed - caughtSet.size} seen only, ${DEX_TOTAL - witnessed} unknown`}
          />
          <div className={s.legend}>
            <span className={s.legendItem}>
              <span className={cx(s.swatch, s.swatchCaught)} /> {caughtSet.size} recorded
            </span>
            <span className={s.legendItem}>
              <span className={cx(s.swatch, s.swatchSeen)} /> {witnessed - caughtSet.size} seen
            </span>
            <span className={s.legendItem}>
              <span className={cx(s.swatch, s.swatchUnknown)} /> {DEX_TOTAL - witnessed} unknown
            </span>
            {rows.length !== DEX_TOTAL && (
              <span className={cx(s.legendItem, s.showing)}>Showing {rows.length}</span>
            )}
          </div>
        </div>
      </header>

      {cmp.length > 0 ? (
        <CompareView
          ids={cmp}
          choices={comparable}
          onChange={setCompare}
          onOpen={(id) => {
            setCompare([]);
            open(id);
          }}
          onClose={() => setCompare([])}
        />
      ) : (
        <>
          <Tabs<DexView>
            tabs={claimedRewards === undefined ? VIEWS.filter((v) => v.key !== 'rewards') : VIEWS}
            value={view}
            onChange={(v) => setParam('view', v === 'entries' ? '' : v)}
            label="Dex view"
            className={s.views}
          />
          {view === 'rewards' ? (
            <RewardsView caught={caughtSet} research={researchMap ?? {}} claimed={claimedRewards ?? []} onClaim={claimDexReward} />
          ) : view === 'habitat' ? (
            <HabitatAtlas
              stateOf={stateOf}
              badges={badges}
              onPick={(id) =>
                setParams(
                  (p) => {
                    p.delete('view');
                    p.set('id', id);
                    p.delete('tab');
                    return p;
                  },
                  { replace: true },
                )
              }
            />
          ) : (
            <>
              {selected === null && <EcosystemPanel onPick={open} />}

              <div className={cx(s.body, selected !== null && s.withDetail)}>
                {rows.length === 0 ? (
                  <EmptyState
                    icon="dex"
                    title="No entries match"
                    hint="Try another type or clear the search."
                    action={<Button onClick={() => setParams({})}>Clear filters</Button>}
                  />
                ) : selected === null && qy.density === 'list' ? (
                  <Table<DexRow>
                    columns={columns}
                    rows={rows}
                    rowKey={(r) => r.sp.id}
                    sort={{ key: qy.sort, dir: qy.dir }}
                    onSort={(k) =>
                      setSort(
                        k as SortKey,
                        qy.sort === k ? (qy.dir === 'asc' ? 'desc' : 'asc') : undefined,
                      )
                    }
                    onRowClick={(r) => open(r.sp.id)}
                    empty={null}
                    caption="Dex entries"
                    className={s.list}
                  />
                ) : (
                  <ol
                    ref={listRef}
                    className={selected === null ? s.grid : s.rail}
                    aria-label="Dex entries"
                    onKeyDown={onGridKey}
                  >
                    {rows.map(({ sp, state: st, research }) => {
                      const v = variants[sp.id] ?? [];
                      const isSel = selectedId === sp.id;
                      return (
                        <li key={sp.id}>
                          <button
                            type="button"
                            className={cx(
                              selected === null ? s.entry : s.row,
                              s[st],
                              isSel && s.selected,
                              research === 5 && st === 'caught' && s.goldTile,
                            )}
                            data-type={st === 'unknown' ? undefined : sp.types[0]}
                            onClick={() => open(isSel ? '' : sp.id)}
                            aria-pressed={isSel}
                            aria-current={isSel ? 'true' : undefined}
                            aria-label={entryLabel(sp, st)}
                          >
                            <span className={s.num}>{num3(sp.dexNumber)}</span>
                            {st !== 'unknown' && revealOf(entriesMap?.[sp.id]) !== null && (
                              <span className={s.newTag}>New</span>
                            )}
                            {alphaIds.includes(sp.id) && (
                              <Icon
                                name="alpha"
                                size="sm"
                                className={s.alphaMark}
                                label="Alpha recorded"
                              />
                            )}
                            {shinyIds.includes(sp.id) && (
                              <Icon
                                name="sparkle"
                                size="sm"
                                className={cx(
                                  s.shinyMark,
                                  alphaIds.includes(sp.id) && s.shinyMarkShift,
                                )}
                                label="Shiny recorded"
                              />
                            )}
                            {st !== 'unknown' && sp.battleForm?.kind !== undefined && (
                              <FormSigil
                                kind={sp.battleForm.kind}
                                size="sm"
                                className={s.formMark}
                                label={formMarkLabel(sp.battleForm.kind)}
                              />
                            )}
                            <CreatureSprite
                              speciesId={sp.id}
                              size={selected === null ? 'lg' : 'sm'}
                              silhouette={st === 'unknown'}
                              desaturate={st === 'seen'}
                              animated
                            />
                            <span className={s.name}>{st === 'unknown' ? '???' : sp.name}</span>
                            {selected === null && st !== 'unknown' && research !== null && research !== undefined && (
                              <span className={s.researchPips} aria-label={`Research level ${research}`}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <span key={n} className={cx(s.rpip, n <= research && s.rpipOn)} />
                                ))}
                              </span>
                            )}
                            {selected === null && st !== 'unknown' && (
                              <span className={s.tileTypes}>
                                {sp.types.map((t) => (
                                  <TypeBadge key={t} type={t} size="sm" compact />
                                ))}
                              </span>
                            )}
                            {selected === null && st === 'caught' && v.length > 0 && (
                              <span className={s.dots}>
                                {v.slice(0, 4).map((k) => (
                                  <span key={k} className={cx(s.dot, s[`v_${k}`])} title={k} />
                                ))}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {selected !== null && (
                  <DexEntry
                    key={selected.id}
                    sp={selected}
                    state={stateOf(selected.id)}
                    research={researchOf(selected.id)}
                    reveal={reveal}
                    counters={entriesMap?.[selected.id]?.counters}
                    variants={variants[selected.id] ?? []}
                    alpha={alphaIds.includes(selected.id)}
                    shiny={shinyIds.includes(selected.id)}
                    recordedIn={recordedIn}
                    onOpen={open}
                    onPrev={prev === undefined ? undefined : () => open(prev.sp.id)}
                    onNext={next === undefined ? undefined : () => open(next.sp.id)}
                    actions={
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="grid"
                        disabled={!dexAccess(stateOf(selected.id), researchOf(selected.id)).compare}
                        title={
                          dexAccess(stateOf(selected.id), researchOf(selected.id)).compare
                            ? 'Set it beside another species'
                            : 'Record it to compare it'
                        }
                        onClick={() => setCompare([selected.id, ''])}
                      >
                        Compare
                      </Button>
                    }
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
