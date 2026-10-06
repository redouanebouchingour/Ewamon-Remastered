/**
 * Phase C5 — the Bag as `/play/bag` reads it: the session's item counts grouped by what the item is (content
 * `CONSUMABLES`, `ORBS`, `ITEMS` held / key) and what the player can do with it out of battle. Display only: the
 * server decides every effect (`POST /item/use` answers 409 `noEffect` / `notUsableHere`); `wouldAffect` only greys
 * out creatures the server would refuse anyway, so a click is never wasted on an obvious no-op.
 */
import { CONSUMABLES } from '@ewa/content';
import type { ConsumableEffect, CreatureInstance } from '@ewa/core';
import { itemInfo, maxHpOf } from './content';
import type { ItemInfo } from './content';

export type BagGroup = 'consumable' | 'orb' | 'held' | 'key';

export const BAG_GROUPS: readonly { readonly key: BagGroup; readonly label: string; readonly hint: string }[] = [
  { key: 'consumable', label: 'Consumables', hint: 'Potions, cures and field items.' },
  { key: 'orb', label: 'Orbs', hint: 'Thrown in battle to catch a wild creature.' },
  { key: 'held', label: 'Held items', hint: 'Give one to a creature; it takes effect in battle.' },
  { key: 'key', label: 'Key items', hint: 'Kept for good; they open the way in the world.' },
];

const effects = new Map<string, ConsumableEffect>(CONSUMABLES.map((c) => [c.id, c.effect]));

/** How the item is used from the Bag: on one creature, straight away (field items), given to hold, or not at all. */
export type BagUse = 'creature' | 'field' | 'give' | 'none';

export function bagUse(id: string): BagUse {
  const info = itemInfo(id);
  if (info.kind === 'held') return 'give';
  if (info.kind !== 'consumable') return 'none';
  const e = effects.get(id);
  if (e === undefined) return 'none';
  switch (e.kind) {
    case 'healHp':
    case 'revive':
    case 'cureStatus':
    case 'fullRestore':
    case 'restorePp':
    case 'rareCandy':
      return 'creature';
    case 'repel':
    case 'lure':
    case 'escapeRope':
      return 'field';
    default:
      return 'none';
  }
}

export interface BagRow {
  readonly info: ItemInfo;
  readonly count: number;
  readonly use: BagUse;
}

/** The owned items (count > 0) in their four groups, each sorted by name. */
export function groupBag(items: Readonly<Record<string, number>> | undefined): Readonly<Record<BagGroup, readonly BagRow[]>> {
  const out: Record<BagGroup, BagRow[]> = { consumable: [], orb: [], held: [], key: [] };
  for (const [id, count] of Object.entries(items ?? {})) {
    if (count <= 0) continue;
    const info = itemInfo(id);
    out[info.kind].push({ info, count, use: bagUse(id) });
  }
  for (const g of Object.values(out)) g.sort((a, b) => a.info.name.localeCompare(b.info.name));
  return out;
}

/**
 * Whether using `id` on `c` would change anything — the server's `noEffect` rules mirrored for display. Returns the
 * reason when it would not ("Already at full HP"), or null when it would.
 */
export function noEffectReason(id: string, c: CreatureInstance): string | null {
  const e = effects.get(id);
  if (e === undefined) return 'Cannot be used on a creature';
  const max = maxHpOf(c);
  switch (e.kind) {
    case 'healHp':
      if (c.hp <= 0) return 'Fainted';
      return c.hp >= max ? 'Already at full HP' : null;
    case 'revive':
      return c.hp > 0 ? 'Not fainted' : null;
    case 'cureStatus': {
      const cures = e.statuses === 'all' ? c.status : c.status.filter((s) => (e.statuses as readonly string[]).includes(s));
      return cures.length > 0 ? null : 'No status to cure';
    }
    case 'fullRestore':
      if (c.hp <= 0) return 'Fainted';
      return c.hp >= max && c.status.length === 0 ? 'Already at full HP' : null;
    case 'restorePp':
      return c.moves.every((m) => m.pp >= m.ppMax) ? 'PP already full' : null;
    case 'rareCandy':
      return c.level >= 100 ? 'Already level 100' : null;
    default:
      return 'Cannot be used on a creature';
  }
}
