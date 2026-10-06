/**
 * Phase C5 `/play/bag` (key `B`). The session's items grouped Consumables · Orbs · Held items · Key items (content
 * `CONSUMABLES`, `ORBS`, `ITEMS` held / key). What each row offers:
 *   - a creature consumable (potions, cures, revives, PP, Rare Candy): Use → a party picker → `POST /item/use { item,
 *     target, qty }` (Rare Candy takes a quantity); creatures it would not affect are disabled with the reason;
 *   - a field item (repel, lure, escape rope): Use → `POST /item/use { target: null, qty: 1 }` at once;
 *   - a held item: Give → a party picker → `POST /creature/:id/setup { ability: current, heldItem }` (the previous
 *     held item returns to the bag server-side);
 *   - orbs and key items: no action here (orbs are thrown in battle).
 * Every result lands through the route action (`bagAction`) and the one inventory writer.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CreatureInstance } from '@ewa/core';
import { BAG_GROUPS, groupBag, noEffectReason } from '../data/bag';
import type { BagRow } from '../data/bag';
import { MULTI_USE_ITEMS, displayName, itemInfo, maxHpOf } from '../data/content';
import type { ItemInfo } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Stepper } from '../ui/Field';
import { HpBar } from '../ui/HpBar';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Panel } from '../ui/Panel';
import s from './BagScreen.module.css';
import l from './layout.module.css';
import { useClosePanel, useIntent } from './shared';
import type { IntentFetcher } from './shared';

const KIND_ICON: Readonly<Record<ItemInfo['kind'], IconName>> = { consumable: 'heart', orb: 'orb', held: 'bag', key: 'star' };
const NO_PARTY: readonly CreatureInstance[] = [];

type Picker = { readonly mode: 'use' | 'give'; readonly row: BagRow } | null;

function PickerModal({ picker, onClose, fetcher }: { readonly picker: Picker; readonly onClose: () => void; readonly fetcher: IntentFetcher }) {
  const party = useSessionStore((st) => st.inventory?.party ?? NO_PARTY);
  const [qty, setQty] = useState(1);
  const row = picker?.row;
  const give = picker?.mode === 'give';
  const multi = row !== undefined && !give && MULTI_USE_ITEMS.has(row.info.id);
  const close = (): void => {
    setQty(1);
    onClose();
  };
  return (
    <Modal
      open={picker !== null}
      onClose={close}
      title={row === undefined ? '' : give ? `Give ${row.info.name}` : `Use ${row.info.name}`}
      description={row === undefined ? undefined : give ? 'The creature holds it in battle. Anything it already holds goes back into your bag.' : row.info.description}
      footer={
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      }
    >
      {row !== undefined && (
        <div className={l.stack}>
          {multi && (
            <div className={l.rowBetween}>
              <span className={l.kvLabel}>How many</span>
              <Stepper label={`${row.info.name} quantity`} value={Math.min(qty, row.count)} min={1} max={Math.min(99, row.count)} onChange={setQty} />
            </div>
          )}
          <ul className={s.targets} aria-label="Party">
            {party.map((c) => {
              const reason = give ? (c.heldItem === row.info.id ? `Already holds ${row.info.name}` : null) : noEffectReason(row.info.id, c);
              const holds = c.heldItem === null ? null : itemInfo(c.heldItem).name;
              const name = displayName(c);
              return (
                <li key={c.id} className={s.target}>
                  <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="sm" />
                  <span className={s.targetText}>
                    <span className={s.targetName}>
                      {name} <span className={l.caption}>Lv {c.level}</span>
                    </span>
                    {give ? <span className={l.caption}>{holds === null ? 'Holds nothing' : `Holds ${holds}`}</span> : <HpBar hp={c.hp} maxHp={maxHpOf(c)} status={c.status} size="sm" showNumbers />}
                    {reason !== null && <span className={s.reason}>{reason}</span>}
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={reason !== null}
                    ariaLabel={`${give ? 'Give' : 'Use'} ${row.info.name} ${give ? 'to' : 'on'} ${name}`}
                    onClick={() => {
                      if (give) fetcher.submit({ intent: 'give', id: c.id, ability: c.ability, heldItem: row.info.id, name });
                      else fetcher.submit({ intent: 'useItem', item: row.info.id, target: c.id, qty: multi ? Math.min(qty, row.count) : 1 });
                      close();
                    }}
                  >
                    {give ? 'Give' : 'Use'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function ItemRow({ row, holders, onPick, fetcher }: { readonly row: BagRow; readonly holders: readonly string[]; readonly onPick: (p: Picker) => void; readonly fetcher: IntentFetcher }) {
  const busy = fetcher.busy((p) => p['item'] === row.info.id || p['heldItem'] === row.info.id);
  let action: ReactNode;
  if (row.use === 'creature') {
    action = (
      <Button size="sm" busy={busy} onClick={() => onPick({ mode: 'use', row })} ariaLabel={`Use ${row.info.name}`}>
        Use
      </Button>
    );
  } else if (row.use === 'field') {
    action = (
      <Button size="sm" busy={busy} onClick={() => fetcher.submit({ intent: 'useItem', item: row.info.id, target: '', qty: 1 })} ariaLabel={`Use ${row.info.name}`}>
        Use
      </Button>
    );
  } else if (row.use === 'give') {
    action = (
      <Button size="sm" busy={busy} onClick={() => onPick({ mode: 'give', row })} ariaLabel={`Give ${row.info.name}`}>
        Give
      </Button>
    );
  } else {
    action = <span className={l.caption}>{row.info.kind === 'orb' ? 'Throw in battle' : row.info.kind === 'key' ? 'Always with you' : row.info.sellPrice > 0 ? 'Sell at a shop' : '—'}</span>;
  }
  return (
    <li className={s.item} aria-label={`${row.info.name} ×${row.count}`}>
      <span className={s.itemIcon} data-kind={row.info.kind} aria-hidden>
        <Icon name={KIND_ICON[row.info.kind]} size="sm" />
      </span>
      <span className={s.itemText}>
        <span className={s.itemName}>{row.info.name}</span>
        <span className={s.itemDesc}>{row.info.description}</span>
        {holders.length > 0 && <span className={l.caption}>Held by {holders.join(', ')}</span>}
      </span>
      <span className={s.count}>×{row.count}</span>
      <span className={s.action}>{action}</span>
    </li>
  );
}

export function BagScreen() {
  const close = useClosePanel();
  const items = useSessionStore((st) => st.inventory?.items);
  const party = useSessionStore((st) => st.inventory?.party ?? NO_PARTY);
  const fetcher = useIntent('/play/bag');
  const [picker, setPicker] = useState<Picker>(null);
  const groups = groupBag(items);
  const total = BAG_GROUPS.reduce((n, g) => n + groups[g.key].length, 0);
  const holdersOf = (id: string): string[] => party.filter((c) => c.heldItem === id).map(displayName);

  return (
    <Panel title="Bag" eyebrow={total === 1 ? '1 kind of item' : `${total} kinds of items`} subtitle="Use items on your party, give held items, check what you carry." onClose={close}>
      {total === 0 ? (
        <EmptyState icon="bag" title="Your bag is empty" hint="Buy potions and orbs at a town shop, or earn them from quests and battles." />
      ) : (
        <div className={l.stackLg}>
          {BAG_GROUPS.map((g) => {
            const rows = groups[g.key];
            return (
              <section key={g.key} className={l.section} aria-label={g.label}>
                <div className={s.groupHead}>
                  <h3 className={l.sectionTitle}>
                    {g.label} <span className={s.groupCount}>{rows.length}</span>
                  </h3>
                  <span className={l.caption}>{g.hint}</span>
                </div>
                {rows.length === 0 ? (
                  <p className={s.none}>None yet.</p>
                ) : (
                  <ul className={s.items}>
                    {rows.map((r) => (
                      <ItemRow key={r.info.id} row={r} holders={g.key === 'held' ? holdersOf(r.info.id) : []} onPick={setPicker} fetcher={fetcher} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      <PickerModal picker={picker} onClose={() => setPicker(null)} fetcher={fetcher} />
    </Panel>
  );
}
