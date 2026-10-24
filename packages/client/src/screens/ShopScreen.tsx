/**
 * `/play/shop` (SPEC §20.9.6). Tabs `?tab=buy|sell`. Buy: the zone's stock (GET /shop/:zoneId — the server's
 * prices) with a 1..99 quantity stepper and a running total against the money counter; the buy button is disabled
 * with "Not enough" when qty × price > money. Sell: the inventory filtered to sellPrice > 0. Each transaction is one
 * fetcher action applied through applyInventoryDelta. 404 → "There is no shop here" (the panel still opens).
 *
 * Shop haggling (2026-10-24, state/haggle.ts): in a town whose shop has a keeper, Haggle opens the keeper's talk beside
 * the panel. A deal the keeper grants (or a markup it slaps on) shows as a strip over the table ("Hessa's deal: 15% off
 * for 10 minutes") and the prices follow it at once, the old price struck through; the server applies the same deal
 * on buy and sell (`dealBuyPrice` / `dealSellPrice`), the client never sends a price.
 */
import { useEffect, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { dealBuyPrice, dealSellPrice } from '@ewa/protocol';
import type { ShopData } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { itemInfo, zoneName } from '../data/content';
import type { ItemInfo } from '../data/content';
import { useSessionStore } from '../state/session';
import { dealLabel, liveDeal, openHaggle, useHaggleStore } from '../state/haggle';
import { useUiStore } from '../state/ui';
import { noDashes } from '../talk/llm';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Stepper } from '../ui/Field';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { Table } from '../ui/Table';
import type { TableColumn } from '../ui/Table';
import { Tabs } from '../ui/Tabs';
import l from './layout.module.css';
import s from './ShopScreen.module.css';
import { useClosePanel, useIntent } from './shared';

type Tab = 'buy' | 'sell';
const KIND_ICON: Readonly<Record<ItemInfo['kind'], IconName>> = { consumable: 'heart', orb: 'orb', held: 'bag', key: 'star' };

interface Row {
  readonly info: ItemInfo;
  /** the price under the deal in force (the base price without one) */
  readonly price: number;
  readonly base: number;
  readonly owned: number;
}

const TALK_ON = import.meta.env['VITE_NPC_TALK'] !== '0';

/** the clock the deal's minutes are read against: ticks while a deal is shown */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** a price, struck-through base before it when a deal moved it */
function PriceCell({ r }: { readonly r: Row }) {
  if (r.price === r.base) return <span className={l.mono}>{formatMoney(r.price)}</span>;
  return (
    <span className={s.dealPrice} data-up={r.price > r.base || undefined}>
      <s className={s.was}>{formatMoney(r.base)}</s>
      <span className={l.mono}>{formatMoney(r.price)}</span>
    </span>
  );
}

function ItemName({ info }: { readonly info: ItemInfo }) {
  return (
    <span className={s.item}>
      <span className={s.itemIcon} data-kind={info.kind} aria-hidden>
        <Icon name={KIND_ICON[info.kind]} size="sm" />
      </span>
      <span className={s.itemText}>
        <span className={s.itemName}>{info.name}</span>
        <span className={s.itemDesc}>{info.description}</span>
      </span>
    </span>
  );
}

export function ShopScreen() {
  const close = useClosePanel();
  const shop = useLoaderData() as ShopData;
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const items = useSessionStore((st) => st.inventory?.items);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'sell' ? 'sell' : 'buy';
  const [qty, setQty] = useState<Readonly<Record<string, number>>>({});
  const fetcher = useIntent();
  const q = (id: string): number => qty[id] ?? 1;
  const setQ = (id: string, v: number): void => setQty((cur) => ({ ...cur, [id]: v }));
  const busy = (intent: string, item: string): boolean => fetcher.busy((p) => p.intent === intent && p['item'] === item);
  const haggle = useHaggleStore(useShallow((st) => ({ deal: st.deal, keeper: st.keeper, zoneId: st.zoneId })));
  const haggling = useUiStore((st) => st.dialogue?.haggle === true);
  const shopZone = shop.kind === 'ok' ? shop.zoneId : null;
  const now = useNow(haggle.deal !== null && haggle.zoneId === shopZone);
  const deal = haggle.zoneId === shopZone ? liveDeal(haggle.deal, now) : null;

  if (shop.kind === 'noShop') {
    return (
      <Panel title="Shop" eyebrow={zoneName(shop.zoneId)} onClose={close}>
        <EmptyState icon="shop" tone="unavailable" title="There is no shop here" hint="Towns with a market stall sell potions and orbs. Travel to one and open this panel again." />
      </Panel>
    );
  }

  const buyRows: Row[] = shop.stock
    .map((id) => ({ info: itemInfo(id), base: shop.prices[id] ?? 0, owned: items?.[id] ?? 0 }))
    .filter((r) => r.base > 0)
    .map((r) => ({ ...r, price: dealBuyPrice(r.base, deal) }));
  const sellRows: Row[] = Object.entries(items ?? {})
    .map(([id, n]) => {
      const info = itemInfo(id);
      const buy = info.price !== null && info.price > 0 ? info.price : null;
      return { info, base: info.sellPrice, price: info.sellPrice > 0 ? dealSellPrice(info.sellPrice, buy, deal) : 0, owned: n };
    })
    .filter((r) => r.price > 0 && r.owned > 0)
    .sort((a, b) => a.info.name.localeCompare(b.info.name));

  const buyColumns: TableColumn<Row>[] = [
    { key: 'item', header: 'Item', render: (r) => <ItemName info={r.info} />, sortValue: (r) => r.info.name },
    { key: 'owned', header: 'Owned', width: 80, align: 'end', render: (r) => <span className={l.mono}>{r.owned}</span> },
    { key: 'price', header: 'Price', width: 130, align: 'end', render: (r) => <PriceCell r={r} />, sortValue: (r) => r.price },
    { key: 'qty', header: 'Qty', width: 132, render: (r) => <Stepper label={`${r.info.name} quantity`} value={q(r.info.id)} min={1} max={99} onChange={(v) => setQ(r.info.id, v)} /> },
    {
      key: 'buy',
      header: 'Total',
      width: 200,
      align: 'end',
      render: (r) => {
        const total = r.price * q(r.info.id);
        const short = total > money;
        return (
          <span className={s.buyCell}>
            <span className={short ? s.totalShort : s.total}>{formatMoney(total)}</span>
            <span className={s.buyAction}>
              <Button
                size="sm"
                variant={short ? 'secondary' : 'primary'}
                disabled={short}
                busy={busy('buy', r.info.id)}
                onClick={() => fetcher.submit({ intent: 'buy', item: r.info.id, qty: q(r.info.id) })}
              >
                Buy
              </Button>
              {short && <span className={s.short}>Not enough</span>}
            </span>
          </span>
        );
      },
    },
  ];

  const sellColumns: TableColumn<Row>[] = [
    { key: 'item', header: 'Item', render: (r) => <ItemName info={r.info} />, sortValue: (r) => r.info.name },
    { key: 'owned', header: 'Owned', width: 80, align: 'end', render: (r) => <span className={l.mono}>{r.owned}</span> },
    { key: 'price', header: 'Each', width: 130, align: 'end', render: (r) => <PriceCell r={r} /> },
    {
      key: 'qty',
      header: 'Qty',
      width: 132,
      render: (r) => <Stepper label={`${r.info.name} quantity`} value={Math.min(q(r.info.id), r.owned)} min={1} max={Math.min(99, r.owned)} onChange={(v) => setQ(r.info.id, v)} />,
    },
    {
      key: 'sell',
      header: 'You get',
      width: 170,
      align: 'end',
      render: (r) => {
        const n = Math.min(q(r.info.id), r.owned);
        return (
          <span className={s.buyCell}>
            <span className={s.total}>+{formatMoney(r.price * n)}</span>
            <Button size="sm" busy={busy('sell', r.info.id)} onClick={() => fetcher.submit({ intent: 'sell', item: r.info.id, qty: n })}>
              Sell
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <Panel
      title="Shop"
      eyebrow={zoneName(shop.zoneId)}
      subtitle="Prices are set by the stall keeper — the server — not by you."
      onClose={close}
      actions={
        <>
          {shop.haggle && haggle.keeper !== null && TALK_ON ? (
            <Button size="sm" icon="tag" onClick={openHaggle} disabled={haggling} title={`Talk ${haggle.keeper.npcName} into a better price`}>
              Haggle
            </Button>
          ) : null}
          <Pill tone="warn" title="Your money">
            <Icon name="coin" size="sm" /> {formatMoney(money)}
          </Pill>
        </>
      }
      toolbar={
        <Tabs<Tab>
          label="Shop"
          tabs={[
            { key: 'buy', label: 'Buy', count: buyRows.length },
            { key: 'sell', label: 'Sell', count: sellRows.length },
          ]}
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
        />
      }
    >
      {deal !== null ? (
        <p className={s.deal} data-kind={deal.kind} data-testid="shop-deal" role="status">
          <span className={s.dealTag}>{deal.kind === 'discount' ? 'Deal' : 'Markup'}</span>
          {noDashes(dealLabel(deal, now))}
        </p>
      ) : null}
      {tab === 'buy' ? (
        <Table
          caption="Items for sale"
          columns={buyColumns}
          rows={buyRows}
          rowKey={(r) => r.info.id}
          empty={<EmptyState icon="shop" title="Sold out" hint="This stall has nothing in stock right now." />}
        />
      ) : (
        <Table
          caption="Items you can sell"
          columns={sellColumns}
          rows={sellRows}
          rowKey={(r) => r.info.id}
          empty={<EmptyState icon="bag" title="Nothing to sell" hint="Potions, orbs and other goods you carry show up here." />}
        />
      )}
    </Panel>
  );
}
