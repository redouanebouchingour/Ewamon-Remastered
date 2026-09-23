/**
 * `/play/shop` (SPEC §20.9.6). Tabs `?tab=buy|sell`. Buy: the zone's stock (GET /shop/:zoneId — the server's
 * prices) with a 1..99 quantity stepper and a running total against the money counter; the buy button is disabled
 * with "Not enough" when qty × price > money. Sell: the inventory filtered to sellPrice > 0. Each transaction is one
 * fetcher action applied through applyInventoryDelta. 404 → "There is no shop here" (the panel still opens).
 */
import { useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import type { ShopData } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { itemInfo, zoneName } from '../data/content';
import type { ItemInfo } from '../data/content';
import { useSessionStore } from '../state/session';
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
  readonly price: number;
  readonly owned: number;
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

  if (shop.kind === 'noShop') {
    return (
      <Panel title="Shop" eyebrow={zoneName(shop.zoneId)} onClose={close}>
        <EmptyState icon="shop" tone="unavailable" title="There is no shop here" hint="Towns with a market stall sell potions and orbs. Travel to one and open this panel again." />
      </Panel>
    );
  }

  const buyRows: Row[] = shop.stock.map((id) => ({ info: itemInfo(id), price: shop.prices[id] ?? 0, owned: items?.[id] ?? 0 })).filter((r) => r.price > 0);
  const sellRows: Row[] = Object.entries(items ?? {})
    .map(([id, n]) => ({ info: itemInfo(id), price: itemInfo(id).sellPrice, owned: n }))
    .filter((r) => r.price > 0 && r.owned > 0)
    .sort((a, b) => a.info.name.localeCompare(b.info.name));

  const buyColumns: TableColumn<Row>[] = [
    { key: 'item', header: 'Item', render: (r) => <ItemName info={r.info} />, sortValue: (r) => r.info.name },
    { key: 'owned', header: 'Owned', width: 80, align: 'end', render: (r) => <span className={l.mono}>{r.owned}</span> },
    { key: 'price', header: 'Price', width: 100, align: 'end', render: (r) => <span className={l.mono}>{formatMoney(r.price)}</span>, sortValue: (r) => r.price },
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
    { key: 'price', header: 'Each', width: 100, align: 'end', render: (r) => <span className={l.mono}>{formatMoney(r.price)}</span> },
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
        <Pill tone="warn" title="Your money">
          <Icon name="coin" size="sm" /> {formatMoney(money)}
        </Pill>
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
