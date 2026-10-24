/**
 * Shop haggling, the pure parts (talk/haggle.ts, the shop branch of talk/npcChat.ts, state/haggle.ts): what a player's
 * line is, the note the keeper gets from the server's cap, the percents a reply states, the guard on give_discount /
 * raise_prices, the keeper's prompts and tools, and the call behind the tools with `fetch` mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HaggleDeal, HaggleKeeper } from '@ewa/protocol';
import {
  GIVE_DISCOUNT,
  HAGGLE_OPENING,
  RAISE_PRICES,
  RUDE_MARKUP,
  THREAT_MARKUP,
  grantedDiscount,
  guardHaggle,
  haggleMove,
  haggleNote,
  offerFor,
  percentOf,
  statedMarkup,
  statedPercents,
} from '../src/talk/haggle';
import { DO_NOTHING, GIVE_MONEY, chatMessages, guardHaggleExchange, haggleJudgeMessages, judgeTools, systemPrompt } from '../src/talk/npcChat';
import type { ChatTurn, NpcPersona } from '../src/talk/npcChat';
import { dealLabel, haggleAct, liveDeal, openHaggle, setShopHaggle, useHaggleStore } from '../src/state/haggle';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';

const keeper = (over: Partial<HaggleKeeper> = {}): HaggleKeeper => ({ npcId: 'mirevale.shop.keeper', npcName: 'Hessa', cap: 20, feeling: 'liked', readyAt: null, ...over });
const shop: NpcPersona = { name: 'Hessa', role: 'Shopkeeper', place: 'Mirevale (town, marsh)', lines: [HAGGLE_OPENING], shop: { stock: [{ name: 'Potion', price: 300 }, { name: 'Super Potion', price: 700 }] } };
const NOW = Date.parse('2026-10-24T12:00:00.000Z');

describe('the player line', () => {
  it('reads the haggling move, rudeness first', () => {
    expect(haggleMove("I'd like to buy twenty Potions. Can you do me a better price?")).toBe('bulk');
    expect(haggleMove('You run the finest shop in town. Surely you can do better?')).toBe('flatter');
    expect(haggleMove('These prices are too steep. Can I get a discount?')).toBe('ask');
    expect(haggleMove("Please, I'm broke. Lower the price a bit?")).toBe('ask');
    expect(haggleMove('Your prices are a rip-off, you crook.')).toBe('rude');
    expect(haggleMove('Give me a discount, idiot.')).toBe('rude');
    expect(haggleMove("Give me a discount or else I'll wreck this shop.")).toBe('threat');
    expect(haggleMove('What sells best here?')).toBe('none');
  });

  it('offers all the cap for a bulk offer or flattery, half in fives otherwise', () => {
    expect(offerFor('bulk', 20)).toBe(20);
    expect(offerFor('flatter', 25)).toBe(25);
    expect(offerFor('ask', 20)).toBe(10);
    expect(offerFor('ask', 25)).toBe(10);
    expect(offerFor('ask', 10)).toBe(5);
    expect(offerFor('ask', 5)).toBe(5);
    expect(offerFor('ask', 2)).toBe(2);
    expect(offerFor('bulk', 0)).toBe(0);
  });

  it('notes what the keeper may do, from the server cap, in words and without dashes', () => {
    const d = haggleNote('bulk', keeper(), false, NOW)!;
    expect(d.ask).toEqual({ kind: 'discount', percent: 20 });
    expect(d.note).toContain('twenty percent off');
    expect(haggleNote('ask', keeper({ cap: 10 }), false, NOW)!.note).toContain('five percent off');
    expect(haggleNote('rude', keeper(), false, NOW)!.ask).toEqual({ kind: 'markup', percent: RUDE_MARKUP });
    expect(haggleNote('threat', keeper(), false, NOW)!.ask).toEqual({ kind: 'markup', percent: THREAT_MARKUP });
    expect(haggleNote('threat', keeper(), false, NOW)!.note).toContain('twenty percent');
    // nothing to give, a cooldown, a deal already given, no keeper: a refusal
    expect(haggleNote('ask', keeper({ cap: 0, feeling: 'hostile' }), false, NOW)).toMatchObject({ ask: { kind: 'refuse' }, note: expect.stringContaining('do not like') });
    expect(haggleNote('ask', keeper({ cap: 0, feeling: 'neutral' }), false, NOW)!.note).toContain('all the discount');
    expect(haggleNote('ask', keeper({ readyAt: new Date(NOW + 60_000).toISOString() }), false, NOW)!.ask.kind).toBe('refuse');
    expect(haggleNote('ask', keeper({ readyAt: new Date(NOW - 1).toISOString() }), false, NOW)!.ask.kind).toBe('discount');
    expect(haggleNote('flatter', keeper(), true, NOW)!.ask.kind).toBe('refuse');
    expect(haggleNote('ask', null, false, NOW)!.ask.kind).toBe('refuse');
    // a rude line still costs after a deal
    expect(haggleNote('rude', keeper(), true, NOW)!.ask.kind).toBe('markup');
    expect(haggleNote('none', keeper(), false, NOW)).toBeNull();
    for (const m of ['bulk', 'ask', 'rude', 'threat'] as const) expect(haggleNote(m, keeper(), false, NOW)!.note).not.toMatch(/\u2014/);
  });
});

describe('the keeper words', () => {
  it('finds the percents a reply states', () => {
    expect(statedPercents('Fine. Fifteen percent off, and 20% on orbs. Twenty-five per cent, final. Half price!')).toEqual([15, 20, 25, 50]);
    expect(statedPercents('Ten percent off for ten minutes.')).toEqual([10]);
    expect(statedPercents('Three hundred coins.')).toEqual([]);
  });

  it('reads a granted discount, not a refused one', () => {
    expect(grantedDiscount('Alright. Ten percent off for the next ten minutes.')).toBe(10);
    expect(grantedDiscount('No problem, fifteen percent off for you!')).toBe(15);
    expect(grantedDiscount("I can't give you twenty percent off. Prices stay.")).toBeNull();
    expect(grantedDiscount('Twenty percent for ten minutes. A fair trade.')).toBeNull();
    expect(grantedDiscount('Twenty percent for ten minutes. A fair trade.', 20)).toBe(20);
    expect(grantedDiscount('Twenty percent more for you.', 20)).toBeNull();
  });

  it('reads a markup: with raise words, the asked percent, or raise words alone', () => {
    expect(statedMarkup('Fine! My prices go up by twenty percent for you!')).toBe(20);
    expect(statedMarkup('Hmph. Ten percent. Potion is now three hundred and thirty.', 10)).toBe(10);
    expect(statedMarkup('Your prices just went up, crook.', 10)).toBe(10);
    expect(statedMarkup('Ten percent off for you.', 10)).toBeNull();
    expect(statedMarkup('I will not raise my prices.', 10)).toBeNull();
  });

  it('guards the calls: the words decide, clamped to what they state, at most one', () => {
    const ask = { kind: 'discount', percent: 20 } as const;
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 25 }], 'Twenty percent off, fine.', ask)).toEqual([{ name: GIVE_DISCOUNT, amount: 20 }]);
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 15 }], 'Twenty percent off, fine.', ask)).toEqual([{ name: GIVE_DISCOUNT, amount: 15 }]);
    // missed by the tool pass, carried out by the words: added
    expect(guardHaggle([], 'Fine. Twenty percent off for ten minutes.', ask)).toEqual([{ name: GIVE_DISCOUNT, amount: 20 }]);
    // no percent in the words: nothing
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 20 }], 'Maybe I can knock a little off.', ask)).toEqual([]);
    // a discount never follows a rude line or a refusal note
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 20 }], 'Hmph. Fine. Twenty percent off.', { kind: 'markup', percent: 20 })).toEqual([]);
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 20 }], 'Fine, twenty percent off.', { kind: 'refuse', percent: 0 })).toEqual([]);
    // a raise
    expect(guardHaggle([{ name: RAISE_PRICES, amount: 10 }], 'My prices go up by ten percent for you.', { kind: 'markup', percent: 10 })).toEqual([{ name: RAISE_PRICES, amount: 10 }]);
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 10 }], 'Ten percent more for you, crook.', { kind: 'markup', percent: 10 })).toEqual([{ name: RAISE_PRICES, amount: 10 }]);
    // small talk: a call stands only when the words carry it out
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 10 }], 'Super Potions sell best.', undefined)).toEqual([]);
    expect(guardHaggle([{ name: GIVE_DISCOUNT, amount: 10 }], 'Tell you what, ten percent off.', undefined)).toEqual([{ name: GIVE_DISCOUNT, amount: 10 }]);
  });

  it('parses the percent argument', () => {
    expect(percentOf('{"percent": 15}')).toEqual({ amount: 15 });
    expect(percentOf('{"percent": "20%"}')).toEqual({ amount: 20 });
    expect(percentOf('{"percent": 90}')).toEqual({ amount: 50 });
    expect(percentOf('{}')).toEqual({});
    expect(percentOf('not json')).toEqual({});
  });
});

describe('the keeper prompts', () => {
  it('the talk pass knows the stock and that it haggles; no dashes; no scared or battle nudge in a shop', () => {
    const sys = systemPrompt(shop);
    expect(sys).toContain('You are Hessa, the shopkeeper in Mirevale');
    expect(sys).toContain('Potion for 300 coins');
    expect(sys).toContain('haggles');
    expect(sys).toContain('Never use em-dashes.');
    const turns: ChatTurn[] = [{ role: 'user', content: 'Give me your gold now or else!', nudge: 'You are offended, so you charge them more.', haggle: { kind: 'markup', percent: 20 } }];
    const msgs = chatMessages(shop, turns);
    expect(msgs.at(-1)!.content).not.toContain('scared');
    expect(msgs.at(-1)!.content).toContain('[You are offended');
  });

  it('the tool pass gets the haggle tools and the hits, no money or Ewamon', () => {
    const names = (judgeTools(shop, 1000) as { function: { name: string } }[]).map((t) => t.function.name);
    expect(names).toEqual(['slap_user', 'kick_user', GIVE_DISCOUNT, RAISE_PRICES, DO_NOTHING]);
    expect(names).not.toContain(GIVE_MONEY);
    const msgs = haggleJudgeMessages(shop, [{ role: 'user', content: 'Discount?' }, { role: 'assistant', content: 'Ten percent off.' }]);
    expect(msgs[0]!.content).toContain(GIVE_DISCOUNT);
    expect(msgs[0]!.content).toContain('Never use em-dashes.');
    expect(msgs[1]!.content).toBe('Traveller: Discount?\nHessa: Ten percent off.');
  });

  it('guards a whole exchange: a hit back after an insult, and the deal', () => {
    const ex: ChatTurn[] = [
      { role: 'user', content: 'You idiot, your prices are a rip-off.', haggle: { kind: 'markup', percent: 10 } },
      { role: 'assistant', content: 'How dare you! My prices go up by ten percent for you!' },
    ];
    const got = guardHaggleExchange(
      [
        { name: 'slap_user', arguments: '{}' },
        { name: RAISE_PRICES, arguments: '{"percent": 30}' },
        { name: 'give_money', arguments: '{"amount": 20}' },
      ],
      ex,
    );
    expect(got).toEqual([{ name: 'slap_user' }, { name: RAISE_PRICES, amount: 10 }]);
  });
});

describe('state/haggle', () => {
  const deal: HaggleDeal = { npcId: 'mirevale.shop.keeper', npcName: 'Hessa', zoneId: 'mirevale', kind: 'discount', percent: 15, expiresAt: new Date(NOW + 10 * 60_000).toISOString() };
  beforeEach(() => {
    setShopHaggle('mirevale', null, keeper(), [{ name: 'Potion', price: 300 }]);
    useNotificationsStore.setState({ toasts: [] } as never);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useUiStore.getState().setDialogue(null);
  });

  it('labels and expires a deal', () => {
    expect(dealLabel(deal, NOW)).toBe("Hessa's deal: 15% off for 10 minutes");
    expect(dealLabel({ ...deal, kind: 'markup', percent: 10 }, NOW + 9.5 * 60_000)).toBe("Hessa's prices: 10% up for 1 minute");
    expect(liveDeal(deal, NOW)).toBe(deal);
    expect(liveDeal(deal, NOW + 10 * 60_000)).toBeNull();
  });

  it('opens the keeper dialogue in haggle mode', () => {
    openHaggle();
    expect(useUiStore.getState().dialogue).toMatchObject({ speaker: 'Hessa, Shopkeeper', targetId: 'mirevale.shop.keeper', haggle: true, lines: [HAGGLE_OPENING] });
  });

  it('a haggle goes to the server and the deal lands in the store; a cut is told to the keeper; a refusal is toasted', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        const body = JSON.parse(String(init.body)) as { percent: number };
        bodies.push(body);
        if (body.percent === 40) return Response.json({ code: 'haggleCooldown' }, { status: 409 });
        return Response.json({ deal, granted: Math.min(body.percent, 15), keeper: keeper({ cap: 7 }) });
      }),
    );
    const got = await haggleAct('mirevale.shop.keeper', 'Hessa', 'discount', 20);
    expect(bodies[0]).toEqual({ npcId: 'mirevale.shop.keeper', kind: 'discount', percent: 20 });
    expect(got.granted).toBe(15);
    expect(got.event).toBe('You gave the traveller fifteen percent off, not the twenty you said, for ten minutes.');
    expect(useHaggleStore.getState().deal).toEqual(deal);
    expect(useHaggleStore.getState().keeper?.cap).toBe(7);
    const refused = await haggleAct('mirevale.shop.keeper', 'Hessa', 'discount', 40);
    expect(refused.granted).toBe(0);
    const texts = useNotificationsStore.getState().toasts.map((t: { text: string }) => t.text);
    expect(texts.some((t: string) => t.includes('needs a moment'))).toBe(true);
  });
});
