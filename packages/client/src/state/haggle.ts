/**
 * Shop haggling on the client (LLM feature 4): the deal and the keeper the shop screen shows, the Haggle action that
 * opens the talk with the keeper, and the call behind the tool pass's `give_discount` / `raise_prices`.
 *
 * Everything here is the server's word: `GET /shop/:zoneId` brings the deal in force and the keeper (its name, the
 * most it would give off now, when it can haggle again), `POST /shop/haggle` answers the deal after a haggle. The
 * shop screen reads `useHaggleStore`, so its prices move the moment a deal lands, wherever the talk is. A deal past
 * its time is dropped by whoever reads it (`liveDeal`).
 */
import { create } from 'zustand';
import type { HaggleDeal, HaggleKeeper, HaggleKind } from '@ewa/protocol';
import { apiFetch, isApiFailure } from '../net/api';
import { HAGGLE_OPENING } from '../talk/haggle';
import { noDashes } from '../talk/llm';
import type { ShopPersona } from '../talk/haggle';
import { numberWords } from '../talk/npcQuest';
import { toast } from './notifications';
import { useUiStore } from './ui';

export interface HaggleState {
  /** the zone the shop data is for */
  readonly zoneId: string | null;
  readonly deal: HaggleDeal | null;
  /** the zone's keeper (null: no keeper here, or haggling is off) */
  readonly keeper: HaggleKeeper | null;
  /** what the keeper sells, for its persona */
  readonly stock: ShopPersona['stock'];
}

const EMPTY: HaggleState = { zoneId: null, deal: null, keeper: null, stock: [] };
export const useHaggleStore = create<HaggleState>()(() => EMPTY);

/** The shop's data as `GET /shop/:zoneId` answered it (the loader). */
export function setShopHaggle(zoneId: string, deal: HaggleDeal | null, keeper: HaggleKeeper | null, stock: ShopPersona['stock']): void {
  useHaggleStore.setState({ zoneId, deal, keeper, stock });
}

export function resetHaggle(): void {
  useHaggleStore.setState(EMPTY);
}

/** The deal while it holds, else null. */
export function liveDeal(deal: HaggleDeal | null, now: number): HaggleDeal | null {
  return deal !== null && Date.parse(deal.expiresAt) > now ? deal : null;
}

/** "Hessa's deal: 15% off for 10 minutes" / "Hessa's prices: 10% up for 3 minutes" */
export function dealLabel(deal: HaggleDeal, now: number): string {
  const mins = Math.max(1, Math.ceil((Date.parse(deal.expiresAt) - now) / 60_000));
  const left = `for ${mins} minute${mins === 1 ? '' : 's'}`;
  return deal.kind === 'discount' ? `${deal.npcName}'s deal: ${deal.percent}% off ${left}` : `${deal.npcName}'s prices: ${deal.percent}% up ${left}`;
}

/** The speaker line of the keeper's dialogue ("Hessa, Shopkeeper": the talk reads the name and the role from it). */
export function keeperSpeaker(k: HaggleKeeper): string {
  return `${k.npcName}, Shopkeeper`;
}

/** The shop screen's Haggle: the keeper's dialogue opens in haggle mode (the talk starts typed, the shop stays open). */
export function openHaggle(): void {
  const k = useHaggleStore.getState().keeper;
  if (k === null) return;
  useUiStore.getState().setDialogue({ speaker: keeperSpeaker(k), lines: [HAGGLE_OPENING], index: 0, targetId: k.npcId, haggle: true });
}

/** The keeper's persona addition for the talk (what it sells). */
export function haggleShop(): ShopPersona {
  return { stock: useHaggleStore.getState().stock };
}

/** What a haggle did, for the talk pass (addressed to the keeper, like every event) and the conversation. */
export interface HaggleOutcome {
  readonly event: string;
  /** the discount (or markup) the server applied (0: nothing) */
  readonly granted: number;
}

const REFUSED: Readonly<Record<string, (n: string) => string>> = {
  haggleCooldown: (n) => `${n} needs a moment before haggling again.`,
  npcNotHere: (n) => `${n} cannot do that from here.`,
  npcToolsOff: () => 'Haggling is off on this server.',
};

/**
 * The tool pass heard the keeper lower or raise its prices: the server caps it and stores the deal, the shop screen
 * takes it, a toast says it. Never throws.
 */
export async function haggleAct(npcId: string, name: string, kind: HaggleKind, percent: number): Promise<HaggleOutcome> {
  try {
    const res = await apiFetch('shopHaggle', { body: { npcId, kind, percent } });
    useHaggleStore.setState({ deal: res.deal, keeper: res.keeper });
    const now = Date.now();
    if (kind === 'markup') {
      if (res.deal !== null) toast('danger', noDashes(dealLabel(res.deal, now)));
      return { granted: res.granted, event: `You raised your prices by ${numberWords(res.granted)} percent for the traveller.` };
    }
    if (res.granted === 0) {
      toast('info', `${name} would not lower the prices after all.`);
      return { granted: 0, event: 'You meant to lower your prices, but in the end you kept them as they were.' };
    }
    if (res.deal !== null) toast('success', noDashes(dealLabel(res.deal, now)));
    const given = res.deal?.percent ?? res.granted;
    return {
      granted: res.granted,
      event:
        res.granted < percent
          ? `You gave the traveller ${numberWords(given)} percent off, not the ${numberWords(percent)} you said, for ten minutes.`
          : `You gave the traveller ${numberWords(given)} percent off your prices for ten minutes.`,
    };
  } catch (e) {
    const code = isApiFailure(e) ? e.error.code : '';
    toast('info', REFUSED[code]?.(name) ?? `${name} could not change the prices.`);
    return { granted: 0, event: code === 'haggleCooldown' ? 'You wanted to change your prices, but you had just made a deal.' : 'You wanted to change your prices, but it did not work.' };
  }
}
