/**
 * `/play/market` (SPEC §20.9.9). Tabs Browse · My listings · My bids. Every filter is a URL param (`search,
 * variant, isAlpha, isShiny (Phase D4), levelMin, levelMax, sort, page`) so the back button restores it; results as Table rows
 * (sprite, species/level, variant/alpha chips, current bid, buy-now, time left mono). `/play/market/:listingId`
 * renders the detail beside the table. List-from-box modal: starting bid ≥ 100, optional buy-now, 12/24/48 h,
 * the 5 % fee shown before confirm. Refresh keeps the previous page at 0.6 opacity. 404 (server part 2) → "not
 * live yet".
 */
import { useEffect, useState } from 'react';
import { Outlet, useLoaderData, useNavigate, useNavigation, useParams, useSearchParams } from 'react-router';
import { MARKET } from '@ewa/content';
import { MARKET_SORTS, VARIANT_KEYS } from '@ewa/protocol';
import type { ListingView } from '@ewa/protocol';
import type { marketLoader, MarketTab } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { displayName, speciesName } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Segmented, Select, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { Table } from '../ui/Table';
import type { TableColumn } from '../ui/Table';
import { Tabs } from '../ui/Tabs';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './MarketScreen.module.css';
import { timeLeft, useClosePanel, useIntent } from './shared';
import { Unavailable } from './Unavailable';

const SORT_LABEL: Readonly<Record<(typeof MARKET_SORTS)[number], string>> = {
  endingSoon: 'Ending soon',
  newest: 'Newest',
  priceAsc: 'Price: low to high',
  priceDesc: 'Price: high to low',
  levelDesc: 'Level: high to low',
};

export const listingColumns = (): TableColumn<ListingView>[] => [
  {
    key: 'creature',
    header: 'Creature',
    render: (r) => (
      <span className={s.creature}>
        <CreatureSprite speciesId={r.speciesId} variantKey={r.variantKey} size="sm" />
        <span className={s.creatureText}>
          <span className={s.creatureName}>{speciesName(r.speciesId)}</span>
          <span className={s.chips}>
            <span className={l.caption}>Lv {r.level}</span>
            {r.variantKey !== 'normal' && <Pill tone="info">{r.variantKey}</Pill>}
            {r.isAlpha && <Pill tone="danger">Alpha</Pill>}
            {r.isShiny === true && <Pill tone="warn">Shiny</Pill>}
          </span>
        </span>
      </span>
    ),
  },
  { key: 'bid', header: 'Current bid', width: 130, align: 'end', render: (r) => <span className={l.mono}>{formatMoney(r.currentBid ?? r.startingBid)}</span> },
  { key: 'buy', header: 'Buy now', width: 120, align: 'end', render: (r) => <span className={l.mono}>{r.buyNowPrice === null ? '—' : formatMoney(r.buyNowPrice)}</span> },
  { key: 'left', header: 'Time left', width: 110, align: 'end', render: (r) => <span className={l.mono}>{r.status === 'active' ? timeLeft(r.expiresAt) : r.status}</span> },
];

function ListModal({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const box = useSessionStore((st) => st.inventory?.box);
  const fetcher = useIntent('/play/market');
  const [creatureId, setCreatureId] = useState('');
  const [startingBid, setStartingBid] = useState('100');
  const [buyNow, setBuyNow] = useState('');
  const [duration, setDuration] = useState<'12' | '24' | '48'>('24');
  const listable = (box ?? []).filter((c) => !c.locked);
  const bid = Number(startingBid);
  const bn = buyNow.trim() === '' ? null : Number(buyNow);
  const bidError = !Number.isFinite(bid) || bid < MARKET.minStartingBid ? `At least ${MARKET.minStartingBid}.` : null;
  const bnError = bn !== null && (!Number.isFinite(bn) || bn <= bid) ? 'Must be higher than the starting bid.' : null;
  const fee = Math.ceil(((bn ?? bid) * MARKET.feePercent) / 100);
  const ok = creatureId !== '' && bidError === null && bnError === null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="List a creature"
      description="Only unlocked creatures in your box can be listed. The creature is held by the market until the auction ends."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ok}
            busy={fetcher.busy()}
            onClick={() => {
              fetcher.submit({ intent: 'list', creatureId, startingBid: bid, buyNowPrice: bn, durationHours: Number(duration) });
              onClose();
            }}
          >
            List for {duration} h
          </Button>
        </>
      }
    >
      <div className={s.listForm}>
        <Select
          label="Creature"
          value={creatureId}
          options={[{ value: '', label: listable.length === 0 ? 'No unlocked creatures in your box' : 'Choose from your box…' }, ...listable.map((c) => ({ value: c.id, label: `${displayName(c)} · Lv ${c.level}` }))]}
          onChange={setCreatureId}
        />
        <div className={s.listRow}>
          <TextField label="Starting bid" type="number" inputMode="numeric" min={MARKET.minStartingBid} value={startingBid} onChange={setStartingBid} error={bidError} />
          <TextField label="Buy-now price (optional)" type="number" inputMode="numeric" value={buyNow} onChange={setBuyNow} error={bnError} />
        </div>
        <div className={l.stack}>
          <span className={l.kvLabel}>Duration</span>
          <Segmented label="Duration" value={duration} options={MARKET.durationsHours.map((h) => ({ value: String(h) as '12' | '24' | '48', label: `${h} hours` }))} onChange={setDuration} />
        </div>
        <p className={s.fee}>
          Market fee {MARKET.feePercent} %: <span className={l.mono}>{formatMoney(fee)}</span> taken from the sale.
        </p>
      </div>
    </Modal>
  );
}

export function MarketScreen() {
  const close = useClosePanel();
  const data = useLoaderData<typeof marketLoader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { listingId } = useParams();
  const [params, setParams] = useSearchParams();
  const [listing, setListing] = useState(false);
  const tab = data.tab;
  const refreshing = navigation.state === 'loading' && navigation.location.pathname.startsWith('/play/market');

  const available = tab === 'browse' ? data.search.available : data.mine.available;
  const setParam = (k: string, v: string): void =>
    setParams((p) => {
      if (v === '') p.delete(k);
      else p.set(k, v);
      if (k !== 'page') p.delete('page');
      return p;
    });

  // the search box writes its URL param 350 ms after the last keystroke (one GET /marketplace, not one per key)
  const urlSearch = params.get('search') ?? '';
  const [searchDraft, setSearchDraft] = useState(urlSearch);
  useEffect(() => {
    if (searchDraft === urlSearch) return;
    const t = setTimeout(() => setParam('search', searchDraft.trim()), 350);
    return () => clearTimeout(t);
  }, [searchDraft]); // setParam/urlSearch are read fresh; only the draft drives this

  const rows: readonly ListingView[] = tab === 'browse' ? (data.search.available ? data.search.data.listings : []) : data.mine.available ? data.mine.data : [];
  const total = tab === 'browse' && data.search.available ? data.search.data.total : rows.length;
  const page = Number(params.get('page') ?? '1') || 1;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <Panel
      title="Marketplace"
      eyebrow="Auctions"
      subtitle="Bid on creatures other trainers have listed. Every bid is checked by the server."
      onClose={close}
      refreshing={refreshing}
      actions={
        <Button variant="primary" icon="tag" disabled={!available} onClick={() => setListing(true)}>
          List a creature
        </Button>
      }
      toolbar={
        <div className={l.stack}>
          <Tabs<MarketTab>
            label="Marketplace"
            tabs={[
              { key: 'browse', label: 'Browse' },
              { key: 'mine', label: 'My listings' },
              { key: 'bids', label: 'My bids' },
            ]}
            value={tab}
            onChange={(k) => setParams(k === 'browse' ? {} : { tab: k })}
          />
          {tab === 'browse' && available && (
            <div className={l.toolbar}>
              <TextField label="Search" hideLabel icon="search" type="search" placeholder="Species name" value={searchDraft} onChange={setSearchDraft} className={s.search} />
              <Select
                label="Variant"
                hideLabel
                value={params.get('variant') ?? ''}
                options={[{ value: '', label: 'Any variant' }, ...VARIANT_KEYS.map((v) => ({ value: v as string, label: v }))]}
                onChange={(v) => setParam('variant', v)}
              />
              <Select
                label="Alpha"
                hideLabel
                value={params.get('isAlpha') ?? ''}
                options={[
                  { value: '', label: 'Alpha or not' },
                  { value: 'true', label: 'Alpha only' },
                  { value: 'false', label: 'No alphas' },
                ]}
                onChange={(v) => setParam('isAlpha', v)}
              />
              <Select
                label="Shiny"
                hideLabel
                value={params.get('isShiny') ?? ''}
                options={[
                  { value: '', label: 'Shiny or not' },
                  { value: 'true', label: 'Shiny only' },
                  { value: 'false', label: 'No shinies' },
                ]}
                onChange={(v) => setParam('isShiny', v)}
              />
              <TextField label="Min level" hideLabel type="number" placeholder="Lv min" value={params.get('levelMin') ?? ''} onChange={(v) => setParam('levelMin', v)} className={s.level} min={1} max={100} />
              <TextField label="Max level" hideLabel type="number" placeholder="Lv max" value={params.get('levelMax') ?? ''} onChange={(v) => setParam('levelMax', v)} className={s.level} min={1} max={100} />
              <Select
                label="Sort"
                hideLabel
                value={params.get('sort') ?? 'endingSoon'}
                options={MARKET_SORTS.map((k) => ({ value: k as string, label: SORT_LABEL[k] }))}
                onChange={(v) => setParam('sort', v)}
              />
            </div>
          )}
        </div>
      }
    >
      {!available ? (
        <Unavailable icon="market" feature="The marketplace" hint="Auctions, bids and listings arrive with the server's marketplace update." />
      ) : (
        <div className={cx(s.body, listingId !== undefined && s.withDetail)}>
          <div className={l.stack}>
            <Table<ListingView>
              caption="Listings"
              columns={listingColumns()}
              rows={rows}
              rowKey={(r) => r.id}
              selectedKey={listingId ?? null}
              onRowClick={(r) => void navigate({ pathname: `/play/market/${r.id}`, search: params.toString() })}
              empty={
                tab === 'browse' ? (
                  <EmptyState icon="market" title="No listings match — widen the filters." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />
                ) : (
                  <EmptyState icon="tag" title={tab === 'mine' ? 'You have no active listings' : 'You have no active bids'} hint={tab === 'mine' ? 'List a creature from your box to start an auction.' : 'Bids you place appear here until the auction ends.'} />
                )
              }
            />
            {tab === 'browse' && pages > 1 && (
              <nav className={s.pager} aria-label="Pages">
                <Button size="sm" variant="ghost" icon="chevronLeft" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                  Previous
                </Button>
                <span className={l.mono}>
                  {page} / {pages}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
                  Next
                </Button>
              </nav>
            )}
          </div>
          {listingId !== undefined && <Outlet />}
        </div>
      )}
      <ListModal open={listing} onClose={() => setListing(false)} />
    </Panel>
  );
}
