/**
 * Haggling with a shopkeeper (LLM feature 4). The shop screen's Haggle opens the talk with the zone's keeper
 * (`state/haggle.ts`); this module is the talk side: the keeper's persona (who it is, what it sells, that it is
 * haggling), what the player's line is (`haggleMove`: flattery, an argument, a plea, a bulk offer, rudeness), the
 * bracketed note that tells the keeper what it may do (`haggleNote`, from the server's cap: the model never picks the
 * number), the tool pass's `give_discount` / `raise_prices` and the guard on them (`guardHaggle`). The server
 * (`POST /shop/haggle`) caps whatever comes through again.
 *
 * - The note: a haggling line gets "You give in: say you give them fifteen percent off ..." with the server's cap (all
 *   of it for a bulk offer or flattery with an ask, half of it, in fives, for a plain ask, an argument or a plea), the
 *   percent in words (the favour finding in talk/npcQuest.ts: given digits, gemma4-e2b garbles amounts). A keeper with
 *   nothing to give (cap 0: it dislikes the player, or the haggling is spent) or waiting out the cooldown is told to
 *   refuse; a keeper that already gave a deal in this conversation refuses to go lower. A rude line (an insult, a
 *   threat, "rip-off", "thief") gets "say you raise your prices by ten percent for them" (twenty for a threat).
 * - The tool pass gets `give_discount` / `raise_prices` (a `percent`), `slap_user`, `kick_user` and `do_nothing` only:
 *   money and Ewamon tools are left out of a shop's talk ("I'll knock twenty coins off for you" read as give_money).
 * - The guard (the words decide, like money in npcChat): a discount needs a percent stated in the reply, not in a
 *   refusing sentence, and is clamped to the stated one; a raise needs raise words. A call the words contradict is
 *   dropped; when the note asked for one and the words carry it out but the call is missing, it is added.
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24) with the shipped code (`streamNpcReply` with the keeper's
 * persona and the note, the shop tool pass, `guardHaggleExchange`): 3 keepers (Mirevale, Cinderhold, Solenne) x 10
 * lines x 2 runs = 60 exchanges: a bulk offer, flattery, a plain ask, a plea, an argument (cap 10), an insult, a
 * threat, an ask to a keeper with nothing to give (cap 0), and two small-talk lines.
 * - The words: 41 of the 42 replies that were told to discount or mark up stated a percent, and all 41 stated the
 *   note's percent ("Fine. Twenty percent off for ten minutes."); no em-dash in any of the 60.
 * - The tool pass, bare: the right tool on 53 of 60 (discounts 30 of 30, markups 8 of 12, refusals 3 of 6, small talk
 *   12 of 12); the right percent on 38 of the 42. Its misses: give_discount on a rude line the keeper answered with
 *   "Ten percent more" or "Super Potion is now 770 coins", and give_discount on a refusal.
 * - Guarded: 59 of 60 right, none wrong (the miss: a rude line answered with new prices but no percent: nothing
 *   happens). A first wording of the rude note ("You are offended: tell them you raise your prices by ten percent")
 *   got a raise in only 2 of 6 (gruff keepers said "Fine. Ten percent off."), and the first guard then granted one of
 *   those as a discount; "You are offended, so you charge them more: say your prices go up by ..." and the rule that a
 *   discount never follows a markup or refusal note fixed both. A first discount guard needed a discount word and
 *   missed "Twenty percent for ten minutes. A fair trade." (the note's own percent now counts).
 * - Talk pass 0.7 to 6.8 s (median 2.3 s), tool pass 1.3 to 3.3 s (median 1.9 s) on the shared docker model.
 */
import { HAGGLE_PERCENT_MAX } from '@ewa/protocol';
import type { HaggleKeeper } from '@ewa/protocol';
import { NO_DASHES } from './llm';
import type { NpcPersona } from './npcChat';
import { numberWords } from './npcQuest';

export const GIVE_DISCOUNT = 'give_discount';
export const RAISE_PRICES = 'raise_prices';

/** What the keeper sells, as its persona says it ("Potion for 300 coins"). */
export interface ShopPersona {
  readonly stock: readonly { readonly name: string; readonly price: number }[];
}

/** the keeper's first line when the player opens a haggle */
export const HAGGLE_OPENING = 'Looking for a better price, are we? Go on, make me an offer.';
/** how many stock lines the persona names (the prompt stays short) */
const STOCK_SHOWN = 6;

/** The talk pass's system prompt for a keeper being haggled with (`temperament`: npcChat's, from the name). */
export function shopSystemPrompt(p: NpcPersona, shop: ShopPersona, temperament: string): string {
  const where = p.place !== null ? ` in ${p.place}` : '';
  const goods = shop.stock
    .slice(0, STOCK_SHOWN)
    .map((g) => `${g.name} for ${g.price} coins`)
    .join(', ');
  return (
    `You are ${p.name}, the shopkeeper${where}, in Ewamon, a game like Pokémon. You are ${temperament}. ` +
    (goods !== '' ? `You sell ${goods}. ` : '') +
    'The traveller wants a better price and haggles with you. Bargain in character and answer any question, with only the words you say out loud. ' +
    'If the traveller slaps, kicks, threatens or insults you, you are furious. ' +
    NO_DASHES
  );
}

/** What a player's line does in a haggle. */
export type HaggleMove = 'bulk' | 'flatter' | 'ask' | 'rude' | 'threat' | 'none';

const ASK = /\b(discount|cheaper|lower (the |your )?prices?|better (price|deal)|a deal|good deal|bargain|knock (it |something |a bit |\w+ )?(off|down)|(\d+|\w+) ?(%|percent|per ?cent) off|less\b|too (expensive|much|pricey|steep)|overpriced|expensive|reduce|haggle|afford|broke|poor|please|special price|mates? rates?|best price|price down|come down)/i;
const BULK = /\b(bulk|wholesale|stock up|a dozen|(buy|take|get) (\d{2,}|ten|twenty|thirty|fifty|a lot|lots|loads|plenty|many|all))/i;
const FLATTER = /\b(best (shop|shopkeeper|store|prices?|merchant|in town)|(you('re| are)|you look|what a) (so |very |really |the )?(kind|nice|lovely|wonderful|great|sweet|clever|smart|wise|beautiful|generous|handsome|best|honest)|love (your|this) (shop|store)|finest|famous|regular customer|loyal customer)/i;
const RUDE = /\b(idiot|stupid|fool|ugly|dumb|moron|loser|pathetic|useless|worthless|liar|jerk|cretin|shut up|hate you|fuck|shit|bitch|bastard|asshole|crap|rip-?off|ripping me off|thief|crook|scam|swindl|cheat|robber)/i;
const THREAT = /\b(or else|i('ll| will) (hurt|kill|beat|burn|smash|wreck|break|trash|rob)|you('ll| will) (regret|pay)|watch your back|burn (this|your) (shop|store)|i('m| am) going to (hurt|kill|beat|wreck))/i;

/** The player's line as a haggling move (rudeness first: "give me a discount, idiot" is rude). */
export function haggleMove(said: string): HaggleMove {
  if (THREAT.test(said)) return 'threat';
  if (RUDE.test(said)) return 'rude';
  if (BULK.test(said)) return 'bulk';
  if (FLATTER.test(said)) return 'flatter';
  if (ASK.test(said)) return 'ask';
  return 'none';
}

/** markups a rude line and a threat earn (the server caps them at HAGGLE_MARKUP_MAX) */
export const RUDE_MARKUP = 10;
export const THREAT_MARKUP = 20;

/** What the note told the keeper to do on a line, carried on the user turn for the tool pass. */
export interface HaggleAsk {
  readonly kind: 'discount' | 'markup' | 'refuse';
  /** the percent the note named (0 for a refusal) */
  readonly percent: number;
}

/** The discount to offer for a move under the server's cap: all of it, or half rounded down to fives. */
export function offerFor(move: HaggleMove, cap: number): number {
  if (cap <= 0) return 0;
  if (move === 'bulk' || move === 'flatter') return cap;
  const half = Math.floor(cap / 2 / 5) * 5;
  return half > 0 ? half : Math.min(cap, 5);
}

/**
 * The note for the talk pass (without brackets) and what it asks, for a player's line in a haggle; null when the line
 * is no haggling move (small talk goes on as it is). `keeper`: the server's cap and cooldown (null when unknown: then
 * the keeper refuses); `dealt`: a discount was already given in this conversation; `now` for the cooldown.
 */
export function haggleNote(move: HaggleMove, keeper: HaggleKeeper | null, dealt: boolean, now: number): { readonly note: string; readonly ask: HaggleAsk } | null {
  if (move === 'none') return null;
  if (move === 'rude' || move === 'threat') {
    const percent = move === 'threat' ? THREAT_MARKUP : RUDE_MARKUP;
    return { note: `You are offended, so you charge them more: say your prices go up by ${numberWords(percent)} percent for them.`, ask: { kind: 'markup', percent } };
  }
  const refuse = (note: string) => ({ note, ask: { kind: 'refuse' as const, percent: 0 } });
  if (dealt) return refuse('You already gave them a deal: refuse to go any lower, kindly but firmly.');
  if (keeper === null) return refuse('Refuse to lower your prices, politely.');
  if (keeper.readyAt !== null && Date.parse(keeper.readyAt) > now) return refuse('You just gave them a deal: tell them to come back a little later before haggling again.');
  const percent = offerFor(move, keeper.cap);
  if (percent <= 0) {
    return refuse(keeper.feeling === 'hostile' || keeper.feeling === 'wary' ? 'You do not like this traveller: refuse to lower your prices for them.' : 'You have given them all the discount you can today: refuse kindly, your prices stay.');
  }
  const why = move === 'bulk' ? 'They will buy a lot, so you' : move === 'flatter' ? 'Their kind words win you over and you' : 'You';
  return { note: `${why} give in: say you give them ${numberWords(percent)} percent off your prices for the next ten minutes.`, ask: { kind: 'discount', percent } };
}

/** The haggle tools (OpenAI function format) the tool pass gets on a keeper's exchange, beside slap / kick / nothing. */
export function haggleTools(name: string): unknown[] {
  const pct = { type: 'object', properties: { percent: { type: 'integer', minimum: 1, maximum: HAGGLE_PERCENT_MAX, description: `the percent ${name} names` } }, required: ['percent'] };
  return [
    { type: 'function', function: { name: GIVE_DISCOUNT, description: `${name} lowers the prices for the traveller (a discount, some percent off).`, parameters: pct } },
    { type: 'function', function: { name: RAISE_PRICES, description: `${name} raises the prices for the traveller (some percent more).`, parameters: pct } },
  ];
}

/** The tool pass's rule for them. */
export function haggleRule(name: string): string {
  return `If ${name} lowers the prices or gives a discount, call ${GIVE_DISCOUNT} with the percent. If ${name} raises the prices, call ${RAISE_PRICES} with the percent.`;
}

const TENS_WORDS: Readonly<Record<string, number>> = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const ONES_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const PERCENT = /(?:\b(\d{1,3})\s*(?:%|percent\b|per ?cent\b)|\b(twenty|thirty|forty|fifty)(?:[-\s](one|two|three|four|five|six|seven|eight|nine))?\s*(?:%|percent\b|per ?cent\b)|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s*(?:%|percent\b|per ?cent\b)|\bhalf (?:off|price)\b)/gi;

/** The percents a text states ("fifteen percent", "20%", "twenty-five per cent", "half price" = 50), in order. */
export function statedPercents(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PERCENT)) {
    const n = m[1] !== undefined ? Number(m[1]) : m[2] !== undefined ? TENS_WORDS[m[2].toLowerCase()]! + (m[3] !== undefined ? ONES_WORDS[m[3].toLowerCase()]! : 0) : m[4] !== undefined ? ONES_WORDS[m[4].toLowerCase()]! : 50;
    if (n >= 1 && n <= 100) out.push(n);
  }
  return out;
}

const SENTENCE = /[^.!?]+[.!?]*/g;
/** a refusal of the discount in the same sentence ("I can't give you ten percent off"), not "no problem" */
const NEGATION = /\b(no way|nice try|forget it|refuse|(not|never|can'?t|cannot|won'?t|couldn'?t|wouldn'?t)\W+(\w+\W+){0,3}?(discount|percent|lower|cheaper|off|deal|go|give|do|offer))\b/i;
const refused = (s: string): boolean => NEGATION.test(s.replace(/\bno (problem|worries)\b/gi, ''));
const LOWER = /\b(off|discount|cheaper|lower|less|knock|reduc|deal|special price)/i;
const RAISE = /\b(rais|increas|up\b|higher|more|extra|double|surcharge|steeper|dearer|tax|penalty)/i;

/** The sentences of a reply that state a percent, with the percent. */
function percentSentences(reply: string): { readonly s: string; readonly n: number }[] {
  return (reply.match(SENTENCE) ?? []).flatMap((s) => statedPercents(s).map((n) => ({ s, n })));
}

/**
 * The discount the reply grants: a percent stated with discount words ("ten percent off"), or the very percent the
 * note asked for without raise words ("Twenty percent for ten minutes."), in a sentence that does not refuse it.
 */
export function grantedDiscount(reply: string, asked: number | null = null): number | null {
  const hit = percentSentences(reply).find((x) => !refused(x.s) && (LOWER.test(x.s) || (x.n === asked && !RAISE.test(x.s))));
  return hit === undefined ? null : Math.min(HAGGLE_PERCENT_MAX, hit.n);
}

/**
 * The markup the reply states: a percent with raise words, or the very percent the note asked for without discount
 * words ("Ten percent. Potion is now three hundred and thirty."); else, raise words about the prices without a
 * percent: the note's (`asked`); else null.
 */
export function statedMarkup(reply: string, asked: number | null = null): number | null {
  const hit = percentSentences(reply).find((x) => !LOWER.test(x.s) && !/\bnot\b/i.test(x.s) && (RAISE.test(x.s) || x.n === asked));
  if (hit !== undefined) return Math.min(HAGGLE_PERCENT_MAX, hit.n);
  const raises = (reply.match(SENTENCE) ?? []).some((s) => RAISE.test(s) && !LOWER.test(s) && /\b(price|prices|cost|charge|pay)\b/i.test(s) && !/\b(not|never|won'?t)\b/i.test(s));
  return raises ? asked : null;
}

/** A haggle tool call the tool pass made: the name and the percent it named (clamped 1..HAGGLE_PERCENT_MAX). */
export interface HaggleCall {
  readonly name: string;
  readonly amount?: number;
}

/**
 * The haggle calls checked against the keeper's words (see the header): at most one. A discount needs the words to
 * grant one and is clamped to the percent they state; it never follows a note that asked for a markup or a refusal
 * (gruff keepers said "Twenty percent off" to a threat). A raise needs the words to raise, clamped to the stated
 * percent (the note's when they raise without a number). A call the note asked for and the words carry out is added
 * when the tool pass missed it. `ask`: what the note told the keeper (undefined: the line was no haggling move, so a
 * call stands only when the words carry it out).
 */
export function guardHaggle(calls: readonly HaggleCall[], reply: string, ask: HaggleAsk | undefined): HaggleCall[] {
  const discount = ask === undefined || ask.kind === 'discount' ? grantedDiscount(reply, ask?.kind === 'discount' ? ask.percent : null) : null;
  const markup = statedMarkup(reply, ask?.kind === 'markup' ? ask.percent : null);
  const clamp = (said: number, named: number | undefined): number => Math.max(1, Math.min(said, named ?? said));
  const called = (n: string): HaggleCall | undefined => calls.find((c) => c.name === n);
  const give = called(GIVE_DISCOUNT);
  const raise = called(RAISE_PRICES);
  // the words decide the direction; the call or the note decides whether anything happens
  if (discount !== null && markup === null && (give !== undefined || ask?.kind === 'discount')) return [{ name: GIVE_DISCOUNT, amount: clamp(discount, give?.amount) }];
  if (markup !== null && discount === null && (raise !== undefined || ask?.kind === 'markup')) return [{ name: RAISE_PRICES, amount: clamp(markup, raise?.amount) }];
  return [];
}

/** `{"percent": n}` → a clamped percent; anything else → none. */
export function percentOf(args: string | undefined): { amount?: number } {
  try {
    const a = (JSON.parse(args ?? '{}') as { percent?: unknown }).percent;
    const n = typeof a === 'number' ? a : typeof a === 'string' ? Number(a.replace('%', '')) : Number.NaN;
    return Number.isFinite(n) && n >= 1 ? { amount: Math.min(HAGGLE_PERCENT_MAX, Math.round(n)) } : {};
  } catch (_e) {
    return {};
  }
}
