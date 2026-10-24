/**
 * Shop haggling (LLM feature 4): the rules and the book of deals. The client's tool pass reads the keeper's words and
 * asks for a discount or a markup (`POST /shop/haggle`); everything that decides the price is here.
 *
 * - The cap: a discount is at most `HAGGLE_DISCOUNT_CAP[feeling]` (how the keeper feels about the player: its own
 *   standing, else half the town's, the NPC memory rules), times `haggleFactor(won)` for the discounts already won at
 *   that shop within `HAGGLE_WINDOW_MS` (1, 1/2, 1/4, then nothing), rounded down. A markup is at most
 *   `HAGGLE_MARKUP_MAX`.
 * - A discount haggle waits `HAGGLE_COOLDOWN_MS` after the last one at that shop (refused `haggleCooldown`); a markup
 *   never waits (rudeness always lands).
 * - The deal: a discount keeps the larger of the deal in force and the new one, with a fresh `HAGGLE_DEAL_MS`; a
 *   granted 0 leaves the deal as it was. A markup replaces whatever is in force. One deal per player and shop.
 *
 * The book lives in memory, like the NPC wallets (rest/routes/npc.ts): a deal lasts ten minutes, so a restart costs a
 * player at most one short discount (or forgives a markup), and the audit rows keep the record. A table would add a
 * migration and a write per haggle for state that is stale within the hour.
 */
import { interiorNpcs } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { HAGGLE_COOLDOWN_MS, HAGGLE_DEAL_MS, HAGGLE_DISCOUNT_CAP, HAGGLE_MARKUP_MAX, HAGGLE_WINDOW_MS, haggleFactor, shopkeeperName } from '@ewa/protocol';
import type { HaggleDeal, HaggleKeeper, HaggleKind, Standing } from '@ewa/protocol';

/** The zone's shopkeeper (an interior NPC with role 'shopkeeper'), if it has one. */
export function zoneKeeper(zoneId: string): { readonly id: string; readonly name: string } | null {
  try {
    const k = interiorNpcs(zoneId as ZoneId).find((n) => n.role === 'shopkeeper');
    return k === undefined ? null : { id: k.id, name: shopkeeperName(k.id) };
  } catch (_e) {
    return null;
  }
}

export interface Deal {
  readonly kind: HaggleKind;
  readonly percent: number;
  readonly expiresAt: number;
}

export interface ShopHaggle {
  /** the deal in force (may have lapsed: read it through `liveDeal`) */
  readonly deal: Deal | null;
  /** when discounts were won at this shop, oldest first */
  readonly won: readonly number[];
  /** the last discount haggle (granted or not) */
  readonly lastAt: number | null;
}

const EMPTY: ShopHaggle = { deal: null, won: [], lastAt: null };

export function liveDeal(h: ShopHaggle, now: number): Deal | null {
  return h.deal !== null && h.deal.expiresAt > now ? h.deal : null;
}

export function wonRecently(h: ShopHaggle, now: number): number {
  return h.won.filter((t) => now - t < HAGGLE_WINDOW_MS).length;
}

/** The largest discount a haggle can win now. */
export function discountCap(feeling: Standing, h: ShopHaggle, now: number): number {
  return Math.floor(HAGGLE_DISCOUNT_CAP[feeling] * haggleFactor(wonRecently(h, now)));
}

/** When a discount haggle may go again (null: now). */
export function readyAt(h: ShopHaggle, now: number): number | null {
  return h.lastAt !== null && now < h.lastAt + HAGGLE_COOLDOWN_MS ? h.lastAt + HAGGLE_COOLDOWN_MS : null;
}

export type HaggleDecision =
  | { readonly ok: false; readonly code: 'haggleCooldown'; readonly readyAt: number }
  | { readonly ok: true; readonly next: ShopHaggle; readonly granted: number; readonly cap: number };

/** One haggle: what the keeper's words asked for, capped and applied to the shop's state. Pure. */
export function decideHaggle(h: ShopHaggle, kind: HaggleKind, asked: number, feeling: Standing, now: number): HaggleDecision {
  const cur = liveDeal(h, now);
  const won = h.won.filter((t) => now - t < HAGGLE_WINDOW_MS);
  if (kind === 'markup') {
    const granted = Math.max(1, Math.min(asked, HAGGLE_MARKUP_MAX));
    return { ok: true, granted, cap: HAGGLE_MARKUP_MAX, next: { deal: { kind, percent: granted, expiresAt: now + HAGGLE_DEAL_MS }, won, lastAt: h.lastAt } };
  }
  const wait = readyAt(h, now);
  if (wait !== null) return { ok: false, code: 'haggleCooldown', readyAt: wait };
  const cap = discountCap(feeling, h, now);
  const granted = Math.max(0, Math.min(asked, cap));
  if (granted === 0) return { ok: true, granted, cap, next: { deal: cur, won, lastAt: now } };
  const percent = cur?.kind === 'discount' ? Math.max(cur.percent, granted) : granted;
  return { ok: true, granted, cap, next: { deal: { kind, percent, expiresAt: now + HAGGLE_DEAL_MS }, won: [...won, now], lastAt: now } };
}

/** Every player's haggling, per shop; one per server process (`haggleBook`). */
export class HaggleBook {
  private readonly shops = new Map<string, ShopHaggle>();

  of(playerId: string, npcId: string): ShopHaggle {
    return this.shops.get(`${playerId}:${npcId}`) ?? EMPTY;
  }

  set(playerId: string, npcId: string, h: ShopHaggle): void {
    this.shops.set(`${playerId}:${npcId}`, h);
  }

  /** The deal in force with the zone's keeper, as the protocol shows it (null: none). */
  dealView(playerId: string, zoneId: string, now: number): HaggleDeal | null {
    const k = zoneKeeper(zoneId);
    if (k === null) return null;
    const d = liveDeal(this.of(playerId, k.id), now);
    return d === null ? null : { npcId: k.id, npcName: k.name, zoneId: zoneId as HaggleDeal['zoneId'], kind: d.kind, percent: d.percent, expiresAt: new Date(d.expiresAt).toISOString() };
  }

  /** The keeper as the shop screen sees it: the cap now and when a haggle may go. */
  keeperView(playerId: string, keeper: { readonly id: string; readonly name: string }, feeling: Standing, now: number): HaggleKeeper {
    const h = this.of(playerId, keeper.id);
    const at = readyAt(h, now);
    return { npcId: keeper.id, npcName: keeper.name, cap: discountCap(feeling, h, now), feeling, readyAt: at === null ? null : new Date(at).toISOString() };
  }
}

const books = new WeakMap<object, HaggleBook>();
/** The book shared by the haggle route and `/shop/*` (keyed by the app's deps, so each test server has its own). */
export function haggleBook(deps: object): HaggleBook {
  let b = books.get(deps);
  if (b === undefined) {
    b = new HaggleBook();
    books.set(deps, b);
  }
  return b;
}
