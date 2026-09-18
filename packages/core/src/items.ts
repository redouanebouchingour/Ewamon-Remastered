/** §2.6 — held item, orb and consumable lookups. Pure data readers; the turn engine applies them. */
import type { Battler, ConsumableDef, ContentIndex, HeldItemHook, ItemDef, TypeName } from './types';

type HeldHookOf<K extends HeldItemHook['kind']> = Extract<HeldItemHook, { kind: K }>;

export function isConsumableDef(def: ItemDef | ConsumableDef): def is ConsumableDef {
  return (def as ConsumableDef).effect !== undefined && (def as ItemDef).hooks === undefined;
}

export function isHeldItemDef(def: ItemDef | ConsumableDef): def is ItemDef {
  return (def as ItemDef).hooks !== undefined;
}

/** The held item's hooks, in order. No item / unknown id / consumable in the held slot → none. */
export function heldHooks(b: Battler, content: ContentIndex): readonly HeldItemHook[] {
  const id = b.creature.heldItem;
  if (id === null) return [];
  try {
    const def = content.item(id);
    return isHeldItemDef(def) ? def.hooks : [];
  } catch (_e) {
    return [];
  }
}

export function heldHooksOfKind<K extends HeldItemHook['kind']>(
  hooks: readonly HeldItemHook[],
  kind: K,
): readonly HeldHookOf<K>[] {
  const out: HeldHookOf<K>[] = [];
  for (let i = 0; i < hooks.length; i++) {
    const h = hooks[i]!;
    if (h.kind === kind) out.push(h as HeldHookOf<K>);
  }
  return out;
}

/** statMul multipliers for `stat`, in hook order. `unevolvedOnly` hooks apply only when `canEvolve`. */
export function statMultipliers(
  hooks: readonly HeldItemHook[],
  stat: 'atk' | 'def' | 'spd',
  canEvolve: boolean,
): readonly number[] {
  const out: number[] = [];
  const list = heldHooksOfKind(hooks, 'statMul');
  for (let i = 0; i < list.length; i++) {
    const h = list[i]!;
    if (h.stat !== stat) continue;
    if (h.unevolvedOnly === true && !canEvolve) continue;
    out.push(h.mul);
  }
  return out;
}

/** typeBoost multipliers matching the move type, in hook order. */
export function typeBoostMultipliers(hooks: readonly HeldItemHook[], moveType: TypeName): readonly number[] {
  const out: number[] = [];
  const list = heldHooksOfKind(hooks, 'typeBoost');
  for (let i = 0; i < list.length; i++) if (list[i]!.type === moveType) out.push(list[i]!.mul);
  return out;
}

export function hasChoiceLock(hooks: readonly HeldItemHook[]): boolean {
  return heldHooksOfKind(hooks, 'choiceLock').length > 0;
}

export function blocksStatusMoves(hooks: readonly HeldItemHook[]): boolean {
  return heldHooksOfKind(hooks, 'noStatusMoves').length > 0;
}

/** The consumable definition for an in-battle `item` action, or null when the id is unknown or not a consumable. */
export function consumableFor(content: ContentIndex, id: string): ConsumableDef | null {
  try {
    const def = content.item(id);
    return isConsumableDef(def) ? def : null;
  } catch (_e) {
    return null;
  }
}
