/**
 * `/play/box` (SPEC §20.9.4). A tile grid (72 px CreatureCards) paged 60 per page (`?page=`), a sticky filter row
 * (search by name/species, type, sort by level/dex/recent — all URL params), the party strip pinned on top so a
 * deposit/withdraw is two clicks (`POST /party/withdraw` / `deposit`, `POST /party/swap` when the party is full).
 * Selecting a tile shows the same detail column as Party. Empty: "Your box is empty — …".
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TYPE_NAMES } from '@ewa/core';
import type { CreatureInstance, TypeName } from '@ewa/core';
import { displayName, species, speciesName } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { EmptyState } from '../ui/EmptyState';
import { Select, TextField } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { cx } from '../ui/cx';
import s from './BoxScreen.module.css';
import { CreatureDetail } from './CreatureDetail';
import l from './layout.module.css';
import { useClosePanel, useIntent } from './shared';
import { isFallen } from '@ewa/content';

export const BOX_PAGE_SIZE = 60;
const EMPTY: readonly CreatureInstance[] = [];
type SortKey = 'level' | 'dex' | 'recent';

export function filterBox(box: readonly CreatureInstance[], q: string, type: TypeName | '', sort: SortKey): CreatureInstance[] {
  const needle = q.trim().toLowerCase();
  const out = box.filter((c) => {
    if (type !== '' && !(species(c.speciesId)?.types as readonly string[] | undefined)?.includes(type)) return false;
    if (needle.length === 0) return true;
    return displayName(c).toLowerCase().includes(needle) || speciesName(c.speciesId).toLowerCase().includes(needle);
  });
  const dex = (c: CreatureInstance): number => species(c.speciesId)?.dexNumber ?? 999;
  out.sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (sort === 'level') return b.level - a.level || dex(a) - dex(b);
    if (sort === 'dex') return dex(a) - dex(b) || b.level - a.level;
    return (b.caughtAt?.at ?? 0) - (a.caughtAt?.at ?? 0);
  });
  return out;
}

export function BoxScreen() {
  const close = useClosePanel();
  const box = useSessionStore((st) => st.inventory?.box ?? EMPTY);
  const party = useSessionStore((st) => st.inventory?.party ?? EMPTY);
  const [params, setParams] = useSearchParams();
  const fetcher = useIntent();
  const [swapTarget, setSwapTarget] = useState('');

  const q = params.get('q') ?? '';
  const type = (params.get('type') ?? '') as TypeName | '';
  const sort = (params.get('sort') ?? 'level') as SortKey;
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const selectedId = params.get('c');

  const setParam = (k: string, v: string | null): void =>
    setParams(
      (p) => {
        if (v === null || v === '') p.delete(k);
        else p.set(k, v);
        if (k !== 'page' && k !== 'c') p.delete('page');
        return p;
      },
      { replace: k === 'c' || k === 'q' },
    );

  const filtered = useMemo(() => filterBox(box, q, type, sort), [box, q, type, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / BOX_PAGE_SIZE));
  const shown = filtered.slice((Math.min(page, pages) - 1) * BOX_PAGE_SIZE, Math.min(page, pages) * BOX_PAGE_SIZE);
  const selected = [...box, ...party].find((c) => c.id === selectedId) ?? null;
  const selectedInParty = selected !== null && party.some((c) => c.id === selected.id);
  const partyFull = party.length >= 6;

  const busy = (intent: string): boolean => fetcher.busy((p) => p.intent === intent);

  const extra =
    selected === null ? null : !selectedInParty && isFallen(selected) ? (
      // challenge modes: a fallen creature never rejoins the party
      <p className={l.caption}>Fallen in your challenge run: it stays in the box.</p>
    ) : selectedInParty ? (
      <Button icon="box" busy={busy('deposit')} disabled={party.length <= 1} onClick={() => fetcher.submit({ intent: 'deposit', id: selected.id })}>
        Deposit to box
      </Button>
    ) : partyFull ? (
      <div className={s.swap}>
        <Select
          label="Swap with"
          hideLabel
          value={swapTarget}
          options={[{ value: '', label: 'Swap with…' }, ...party.map((c) => ({ value: c.id, label: `${displayName(c)} · Lv ${c.level}` }))]}
          onChange={setSwapTarget}
        />
        <Button
          variant="primary"
          disabled={swapTarget === ''}
          busy={busy('swap')}
          onClick={() => {
            fetcher.submit({ intent: 'swap', partyId: swapTarget, boxId: selected.id });
            setSwapTarget('');
          }}
        >
          Swap
        </Button>
      </div>
    ) : (
      <Button variant="primary" icon="party" busy={busy('withdraw')} onClick={() => fetcher.submit({ intent: 'withdraw', id: selected.id })}>
        Withdraw to party
      </Button>
    );

  return (
    <Panel
      title="Box"
      eyebrow={`${box.length} stored`}
      subtitle="Everything you catch with a full party waits here."
      onClose={close}
      toolbar={
        <div className={l.toolbar}>
          <TextField label="Search" hideLabel icon="search" type="search" placeholder="Search by name or species" value={q} onChange={(v) => setParam('q', v)} className={s.search} />
          <Select
            label="Type"
            hideLabel
            value={type}
            options={[{ value: '' as TypeName | '', label: 'All types' }, ...TYPE_NAMES.map((t) => ({ value: t as TypeName | '', label: t }))]}
            onChange={(v) => setParam('type', v)}
          />
          <Select
            label="Sort"
            hideLabel
            value={sort}
            options={[
              { value: 'level', label: 'Sort: level' },
              { value: 'dex', label: 'Sort: dex number' },
              { value: 'recent', label: 'Sort: most recent' },
            ]}
            onChange={(v) => setParam('sort', v)}
          />
        </div>
      }
    >
      <section className={s.partyStrip} aria-label="Party">
        <span className={l.sectionTitle}>Party</span>
        <div className={s.partyTiles}>
          {party.map((c) => (
            <CreatureCard key={c.id} creature={c} variant="tile" selected={selectedId === c.id} onClick={() => setParam('c', c.id)} className={s.partyTile} />
          ))}
          {Array.from({ length: Math.max(0, 6 - party.length) }, (_, k) => (
            <div key={k} className={s.partyEmpty} aria-hidden />
          ))}
        </div>
      </section>

      <div className={cx(s.body, selected !== null && s.withDetail)}>
        <div className={s.gridCol}>
          {box.length === 0 ? (
            <EmptyState icon="box" title="Your box is empty" hint="Creatures you catch with a full party arrive here." />
          ) : filtered.length === 0 ? (
            <EmptyState icon="search" title="Nothing matches" hint="Clear the search or pick another type." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />
          ) : (
            <>
              <div className={s.grid}>
                {shown.map((c) => (
                  <CreatureCard key={c.id} creature={c} variant="tile" selected={selectedId === c.id} onClick={() => setParam('c', c.id)} />
                ))}
              </div>
              {pages > 1 && (
                <nav className={s.pager} aria-label="Box pages">
                  <Button size="sm" variant="ghost" icon="chevronLeft" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                    Previous
                  </Button>
                  <span className={l.mono}>
                    {Math.min(page, pages)} / {pages}
                  </span>
                  <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
        {selected !== null && (
          <CreatureDetail creature={selected} fetcher={fetcher} extraActions={extra} isLastInParty={selectedInParty && party.length <= 1} />
        )}
      </div>
    </Panel>
  );
}
