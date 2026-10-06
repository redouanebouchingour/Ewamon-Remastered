/**
 * Presentation for `POST /item/use` results (Rare Candy, potions…) used from a creature's panel: a toast, and the
 * learn-move / evolve prompts the server reports, queued as explicit REST prompts (§20.5.6). This module never
 * writes progression or inventory state — the updated creature arrives as `creaturesUpdated` and goes through the
 * one inventory writer in `actions.ts`; the events here are display only.
 */
import type { CreatureInstance } from '@ewa/core';
import { displayName, itemInfo, speciesName, tradeEvolveTarget } from '../data/content';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';

export interface ItemUseEvent {
  readonly t: string;
  readonly [k: string]: unknown;
}

export function presentItemUse(itemId: string, qty: number, creature: CreatureInstance | undefined, events: readonly ItemUseEvent[]): void {
  const who = creature === undefined ? '' : displayName(creature);
  const name = itemInfo(itemId).name;
  const levels = events.filter((e) => e.t === 'levelUp').map((e) => Number(e['level']));
  // Phase D3: a stone is not spent by /item/use — the server answers evolveReady { item } and the confirmed evolve spends it
  const stone = events.find((e) => e.t === 'evolveReady' && typeof e['item'] === 'string');
  if (stone !== undefined && creature !== undefined) {
    const ui = useUiStore.getState();
    if (!ui.prompts.some((q) => q.kind === 'evolve' && q.creatureId === creature.id)) {
      ui.enqueuePrompt({ kind: 'evolve', creatureId: creature.id, into: String(stone['into']), item: String(stone['item']) });
    }
    toast('info', `${who} reacts to the ${name}.`);
    return;
  }
  if (levels.length > 0) toast('success', `${who} grew to Lv ${Math.max(...levels)}!`);
  // a field item (repel, lure, escape rope) from the Bag has no target creature
  else if (creature === undefined) toast('success', `Used ${name}.`);
  else toast('success', qty > 1 ? `Used ${qty} × ${name} on ${who}.` : `Used ${name} on ${who}.`);
  if (creature === undefined) return;
  const ui = useUiStore.getState();
  const queued = new Set(ui.prompts.map((q) => (q.kind === 'learnMove' ? `m:${q.creatureId}:${q.move}` : `e:${q.creatureId}`)));
  for (const e of events) {
    if (e.t === 'learnMove' && !queued.has(`m:${creature.id}:${String(e['move'])}`)) ui.enqueuePrompt({ kind: 'learnMove', creatureId: creature.id, move: String(e['move']) });
  }
  const evo = [...events].reverse().find((e) => e.t === 'evolveReady');
  if (evo !== undefined && !queued.has(`e:${creature.id}`)) {
    ui.enqueuePrompt({ kind: 'evolve', creatureId: creature.id, into: String(evo['into']) });
    toast('info', `${who} is ready to evolve into ${speciesName(String(evo['into']))}.`);
  }
}

/**
 * Phase D3: a completed trade lists the received trade-evolvers in `creaturesUpdated` (the server wrote their trade
 * marker); each gets one evolve prompt — explicit, like every evolution — unless one is already queued.
 */
export function queueTradeEvolutions(creatures: readonly CreatureInstance[]): void {
  const ui = useUiStore.getState();
  for (const c of creatures) {
    const into = tradeEvolveTarget(c);
    if (into === null || ui.prompts.some((q) => q.kind === 'evolve' && q.creatureId === c.id)) continue;
    ui.enqueuePrompt({ kind: 'evolve', creatureId: c.id, into, trade: true });
    toast('info', `${displayName(c)} is reacting to the trade.`);
  }
}
