/**
 * Phase D4 — the shiny tier on the wire, every field optional so pre-D4 payloads stay valid: CreatureInstance
 * `isShiny?`, SpawnState `isShiny` (appended last), ListingView `isShiny?`, the market `isShiny` query param,
 * and GET /dex `shiny?`.
 */
import { describe, expect, it } from 'vitest';
import { CreatureInstanceSchema, DexRes, ListingViewSchema, MarketQuery, SpawnState } from '../src/index';
import { ISO, U1, U2, U3, creature } from './fixtures';

describe('Phase D4 shiny fields', () => {
  it('CreatureInstance: isShiny optional boolean', () => {
    const c = creature();
    expect(CreatureInstanceSchema.safeParse(c).success).toBe(true);
    expect(CreatureInstanceSchema.safeParse({ ...c, isShiny: true }).success).toBe(true);
    expect(CreatureInstanceSchema.safeParse({ ...c, isShiny: 'yes' }).success).toBe(false);
  });

  it('ListingView isShiny optional; MarketQuery isShiny parses the query strings', () => {
    const l = { id: U1, sellerId: U2, creatureId: U3, speciesId: 'glimfin', level: 5, variantKey: 'normal', isAlpha: false, startingBid: 100, currentBid: null, currentBidderId: null, buyNowPrice: null, status: 'active', createdAt: ISO, expiresAt: ISO, resolvedAt: null };
    expect(ListingViewSchema.safeParse(l).success).toBe(true);
    expect(ListingViewSchema.safeParse({ ...l, isShiny: true }).success).toBe(true);
    expect(MarketQuery.parse({ isShiny: 'true' }).isShiny).toBe(true);
    expect(MarketQuery.parse({ isShiny: 'false' }).isShiny).toBe(false);
    expect(MarketQuery.parse({}).isShiny).toBeUndefined();
    expect(MarketQuery.safeParse({ isShiny: 'maybe' }).success).toBe(false);
  });

  it('GET /dex: shiny optional species list', () => {
    expect(DexRes.safeParse({ seen: [], caught: [], variants: {}, alpha: [] }).success).toBe(true);
    expect(DexRes.safeParse({ seen: ['glimfin'], caught: ['glimfin'], variants: {}, alpha: [], shiny: ['glimfin'] }).success).toBe(true);
  });

  it('SpawnState.isShiny defaults to false (the field order is pinned in schema.test.ts: appended last)', () => {
    const st = new SpawnState();
    expect(st.isShiny).toBe(false);
    st.isShiny = true;
    expect(st.toJSON()).toMatchObject({ isShiny: true });
  });
});
