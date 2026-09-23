/**
 * `/play/dex` — witnessing framing (SPEC §20.9.5). "Witnessed N / 130" in the display face with a segmented bar
 * (caught solid, seen-only hatched, unknown empty) — the largest number in the UI. A 6-column grid in dexNumber
 * order: unknown = silhouette `#???`, seen = desaturated + name, caught = full colour with variant chips and an
 * alpha mark. Filters in the URL (`?type=&state=caught|seen|unknown&q=`); `?id=` selects an entry.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { TYPE_NAMES } from '@ewa/core';
import type { SpeciesDef, TypeName, VariantKey } from '@ewa/core';
import { VARIANT_KEYS } from '@ewa/protocol';
import { DEX_TOTAL, SPECIES_BY_DEX, evolutionChain, zoneName } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Segmented, Select, TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import s from './DexScreen.module.css';
import l from './layout.module.css';
import { useClosePanel } from './shared';

type DexState = 'caught' | 'seen' | 'unknown';
const EMPTY: readonly string[] = [];
const NO_VARIANTS: Readonly<Record<string, readonly VariantKey[]>> = {};

function DexDetail({ sp, state, variants, alpha, recordedIn }: {
  readonly sp: SpeciesDef;
  readonly state: DexState;
  readonly variants: readonly VariantKey[];
  readonly alpha: boolean;
  readonly recordedIn: readonly string[];
}) {
  const seenSet = useSessionStore((st) => st.progression?.dexSeen ?? EMPTY);
  const caughtSet = useSessionStore((st) => st.progression?.dexCaught ?? EMPTY);
  const known = (id: string): boolean => seenSet.includes(id) || caughtSet.includes(id);
  const chain = evolutionChain(sp.id);
  if (state === 'unknown') {
    return (
      <aside className={l.detail}>
        <div className={l.detailHead}>
          <CreatureSprite speciesId={sp.id} size="xl" silhouette />
          <div className={l.detailTitle}>
            <p className={l.caption}>#{String(sp.dexNumber).padStart(3, '0')}</p>
            <h3 className={l.h2}>Unknown</h3>
            <p className={l.muted}>Not yet witnessed. Somewhere out there, it is waiting.</p>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside className={l.detail} data-type={sp.types[0]}>
      <div className={l.detailHead}>
        <CreatureSprite speciesId={sp.id} size="xl" desaturate={state === 'seen'} />
        <div className={l.detailTitle}>
          <p className={l.caption}>#{String(sp.dexNumber).padStart(3, '0')} · {sp.role}</p>
          <h3 className={l.h2}>{sp.name}</h3>
          <div className={l.row}>
            {sp.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
      </div>
      <p className={cx(s.verdict, state === 'caught' ? s.recorded : s.seenOnly)}>
        <Icon name={state === 'caught' ? 'shield' : 'eye'} size="sm" />
        {state === 'caught' ? 'Recorded — this one cannot be quietly lost.' : 'Seen, not yet recorded.'}
      </p>
      <p className={l.bodyLg}>{sp.flavor}</p>
      {chain.length > 1 && (
        <section className={l.section}>
          <h4 className={l.sectionTitle}>Evolution</h4>
          <ol className={s.chain}>
            {chain.map((stage, i) => (
              <li key={stage.id} className={s.chainStage}>
                {i > 0 && <Icon name="chevronRight" size="sm" className={s.chainArrow} />}
                <CreatureSprite speciesId={stage.id} size="md" silhouette={!known(stage.id)} desaturate={known(stage.id) && !caughtSet.includes(stage.id)} />
                <span className={l.caption}>{known(stage.id) ? stage.name : '???'}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {state === 'caught' && (
        <section className={l.section}>
          <h4 className={l.sectionTitle}>Variants recorded</h4>
          <div className={l.row}>
            {VARIANT_KEYS.map((v) => (
              <span key={v} className={cx(s.variantChip, s[`v_${v}`], variants.includes(v) && s.variantOn)} title={v}>
                {v}
              </span>
            ))}
            {alpha && (
              <span className={s.alpha}>
                <Icon name="alpha" size="sm" /> Alpha
              </span>
            )}
          </div>
        </section>
      )}
      {recordedIn.length > 0 && (
        <section className={l.section}>
          <h4 className={l.sectionTitle}>Recorded in</h4>
          <p className={l.body}>{recordedIn.map((z) => zoneName(z)).join(' · ')}</p>
        </section>
      )}
      <div className={l.kv}>
        <span className={l.kvLabel}>Rarity</span>
        <span />
        <span className={l.kvValue}>{sp.rarity}</span>
        <span className={l.kvLabel}>Catch rate</span>
        <span />
        <span className={l.kvValue}>{sp.catchRate}</span>
      </div>
    </aside>
  );
}

export function DexScreen() {
  const close = useClosePanel();
  const seen = useSessionStore((st) => st.progression?.dexSeen ?? EMPTY);
  const caught = useSessionStore((st) => st.progression?.dexCaught ?? EMPTY);
  const variants = useSessionStore((st) => st.progression?.dexVariants ?? NO_VARIANTS);
  const alphaIds = useSessionStore((st) => st.progression?.dexAlpha ?? EMPTY);
  const party = useSessionStore((st) => st.inventory?.party);
  const box = useSessionStore((st) => st.inventory?.box);
  const [params, setParams] = useSearchParams();

  const caughtSet = useMemo(() => new Set(caught), [caught]);
  const seenSet = useMemo(() => new Set([...seen, ...caught]), [seen, caught]);
  const stateOf = (id: string): DexState => (caughtSet.has(id) ? 'caught' : seenSet.has(id) ? 'seen' : 'unknown');

  const q = params.get('q') ?? '';
  const type = (params.get('type') ?? '') as TypeName | '';
  const stateFilter = (params.get('state') ?? 'all') as DexState | 'all';
  const setParam = (k: string, v: string): void =>
    setParams(
      (p) => {
        if (v === '' || v === 'all') p.delete(k);
        else p.set(k, v);
        return p;
      },
      { replace: true },
    );

  const needle = q.trim().toLowerCase();
  const entries = SPECIES_BY_DEX.filter((sp) => {
    const st = stateOf(sp.id);
    if (stateFilter !== 'all' && st !== stateFilter) return false;
    if (type !== '' && (st === 'unknown' || !(sp.types as readonly string[]).includes(type))) return false;
    if (needle.length > 0) {
      if (st === 'unknown') return String(sp.dexNumber).includes(needle);
      return sp.name.toLowerCase().includes(needle) || String(sp.dexNumber).includes(needle);
    }
    return true;
  });

  const selectedId = params.get('id');
  const selected = SPECIES_BY_DEX.find((sp) => sp.id === selectedId) ?? null;
  const recordedIn = useMemo(() => {
    if (selected === null) return [];
    const zones = new Set<string>();
    for (const c of [...(party ?? []), ...(box ?? [])]) if (c.speciesId === selected.id && c.caughtAt !== null) zones.add(c.caughtAt.zoneId);
    return [...zones];
  }, [selected, party, box]);

  const witnessed = seenSet.size;
  return (
    <Panel
      title="Dex"
      eyebrow="The record"
      onClose={close}
      toolbar={
        <div className={l.toolbar}>
          <TextField label="Search" hideLabel icon="search" type="search" placeholder="Name or number" value={q} onChange={(v) => setParam('q', v)} className={s.search} />
          <Select
            label="Type"
            hideLabel
            value={type}
            options={[{ value: '' as TypeName | '', label: 'All types' }, ...TYPE_NAMES.map((t) => ({ value: t as TypeName | '', label: t }))]}
            onChange={(v) => setParam('type', v)}
          />
          <Segmented
            label="State"
            value={stateFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'caught', label: 'Recorded' },
              { value: 'seen', label: 'Seen' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            onChange={(v) => setParam('state', v)}
          />
        </div>
      }
    >
      <header className={s.hero}>
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
          </div>
        </div>
      </header>

      <div className={cx(s.body, selected !== null && s.withDetail)}>
        {entries.length === 0 ? (
          <EmptyState icon="dex" title="No entries match" hint="Try another type or clear the search." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />
        ) : (
          <ol className={s.grid}>
            {entries.map((sp) => {
              const st = stateOf(sp.id);
              const v = variants[sp.id] ?? [];
              return (
                <li key={sp.id}>
                  <button
                    type="button"
                    className={cx(s.entry, s[st], selectedId === sp.id && s.selected)}
                    data-type={st === 'unknown' ? undefined : sp.types[0]}
                    onClick={() => setParam('id', selectedId === sp.id ? '' : sp.id)}
                    aria-pressed={selectedId === sp.id}
                    aria-label={st === 'unknown' ? `Unknown entry ${sp.dexNumber}` : `${sp.name}, ${st === 'caught' ? 'recorded' : 'seen'}`}
                  >
                    <span className={s.num}>#{String(sp.dexNumber).padStart(3, '0')}</span>
                    {alphaIds.includes(sp.id) && <Icon name="alpha" size="sm" className={s.alphaMark} label="Alpha recorded" />}
                    <CreatureSprite speciesId={sp.id} size="lg" silhouette={st === 'unknown'} desaturate={st === 'seen'} />
                    <span className={s.name}>{st === 'unknown' ? '???' : sp.name}</span>
                    {st === 'caught' && v.length > 0 && (
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
          <DexDetail sp={selected} state={stateOf(selected.id)} variants={variants[selected.id] ?? []} alpha={alphaIds.includes(selected.id)} recordedIn={recordedIn} />
        )}
      </div>
    </Panel>
  );
}
