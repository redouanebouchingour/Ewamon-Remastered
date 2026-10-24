/**
 * The adventure journal (LLM feature 9): a day's digest (`buildDigest`, pure: catches grouped by species with the zone,
 * shinies, evolutions, a badge over its league win, the rival and villagers by name, route trainers and wild battles
 * counted, favours, haggles, deeds inside the day, the zones the day touched; deterministic and capped), the day
 * number, the cleaning of an entry, and the routes: today's digest from real rows, writing and rewriting today, the
 * unwritten days before it, an earlier day written once, the backfill window, an empty day, 404 outside the account's
 * days, `NPC_TOOLS=off`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JOURNAL_BACKFILL_DAYS, JOURNAL_FACTS_MAX, JOURNAL_TEXT_MAX, JournalDaySchema, JournalEntryViewSchema, JournalRes } from '@ewa/protocol';
import type { JournalBattle, JournalCreatureEvent } from '@ewa/persist';
import { DAY_MS } from '../src/liveops/schedule';
import { EMPTY_DAY, buildDigest, cleanEntry, dayNumberOf, dayStartOfKey } from '../src/game/journal';
import type { JournalDayRows } from '../src/game/journal';
import { api, rawQuery, register, startServer } from './helpers';
import type { TestServer } from './helpers';

const DASH = String.fromCharCode(0x2014);
const DAY = Date.UTC(2026, 9, 22);
const at = (h: number): Date => new Date(DAY + h * 3_600_000);

const met = (speciesId: string, zoneId: string | null, h: number, over: Partial<JournalCreatureEvent> = {}): JournalCreatureEvent => ({
  kind: 'met',
  detail: { how: 'caught', speciesId, level: 5, zoneId, trainer: 'red' },
  at: at(h),
  speciesId,
  nickname: null,
  isShiny: false,
  isAlpha: false,
  ...over,
});
const battle = (opponent: string, format: string, result: string, zoneId: string | null, h: number): JournalBattle => ({ opponent, format, result, zoneId, at: at(h) });

const ROWS: JournalDayRows = {
  events: [
    met('mossling', 'mire_route', 9),
    met('mossling', 'mire_route', 10),
    met('glimfin', 'tide_route', 11, { isShiny: true }),
    { kind: 'evolved', detail: { from: 'mossling', into: 'verdatide' }, at: at(12), speciesId: 'verdatide', nickname: null, isShiny: false, isAlpha: false },
    { kind: 'hatched', detail: { speciesId: 'dustcub', zoneId: 'mirevale', parents: ['a', 'b'], trainer: 'red' }, at: at(13), speciesId: 'dustcub', nickname: null, isShiny: false, isAlpha: false },
  ],
  battles: [
    battle('verdant_gym', 'league', 'win', 'mirevale', 14),
    battle('rival:Corin', 'trainer', 'loss', 'mire_route', 15),
    battle('villager:mirevale.archivist', 'trainer', 'win', 'mirevale', 16),
    battle('mire_route.youngster', 'trainer', 'win', 'mire_route', 17),
    battle('mire_route.lass', 'trainer', 'win', 'mire_route', 17),
    battle('mire_route.hiker', 'trainer', 'loss', 'mire_route', 18),
    battle('mossling', 'wild', 'win', 'mire_route', 19),
    battle('mossling', 'wild', 'fled', 'mire_route', 19),
  ],
  audits: [
    { action: 'npc.quest.claim', subject: 'mirevale.archivist', detail: { zone: 'mirevale' }, at: at(20) },
    { action: 'shop.haggle', subject: 'mirevale.shop.keeper', detail: { zone: 'mirevale', kind: 'flattery', granted: 10 }, at: at(20) },
  ],
  badges: [{ badgeId: 'bloom', at: at(14) }],
  splits: [],
  memories: [
    {
      npcId: 'mirevale.child',
      zoneId: 'mirevale',
      deeds: [
        { deed: 'insulted', at: at(21).toISOString() },
        { deed: 'hit', at: at(-3).toISOString() },
      ],
    },
    { npcId: 'mirevale.shop.keeper', zoneId: 'mirevale', deeds: [{ deed: 'giftReceived', at: at(20).toISOString() }] },
  ],
};

describe("a day's digest", () => {
  it('tells the day in first-person facts, in a fixed order, the same every time', () => {
    const f = buildDigest(ROWS, DAY);
    expect(buildDigest(ROWS, DAY)).toEqual(f);
    const text = (kind: string) => f.filter((x) => x.kind === kind).map((x) => x.text);
    expect(text('badge')).toEqual(['I won the Bloom Badge from Mira Thornwell!']);
    // the league win that gave the badge is not said twice
    expect(text('league')).toEqual([]);
    expect(text('shiny')).toEqual(['I caught a shiny Glimfin!']);
    expect(text('caught')).toEqual(['I caught 2 Mossling on Mire Route.']);
    expect(f.find((x) => x.kind === 'caught')).toMatchObject({ speciesId: 'mossling', count: 2, type: 'Water' });
    expect(text('evolved')).toEqual(['My Mossling evolved into Verdatide.']);
    expect(text('hatched')).toEqual(['A Dustcub hatched from my eggs at the Mirevale Daycare.']);
    expect(text('rival')).toEqual(['My rival Corin beat me on Mire Route.']);
    expect(text('villager')[0]).toMatch(/^I beat \S.* in a battle\.$/);
    expect(text('trainers')).toEqual(['I beat 2 trainers and lost to one.']);
    expect(text('wild')).toEqual(['I won a battle against wild Ewamon.']);
    expect(text('favour')[0]).toMatch(/^I did a favour for \S.*, and was paid for it\.$/);
    expect(text('haggle')).toEqual([expect.stringMatching(/^I haggled \S+ down 10% at the shop\.$/)]);
    // only the day's deeds; the discount is the haggle's, not a gift
    expect(text('deed')).toEqual([expect.stringMatching(/^I insulted \S/)]);
    expect(text('zones')).toEqual(['I was on Mire Route, Tide Route and Mirevale.']);
    expect(f.map((x) => x.kind)).toEqual(['badge', 'shiny', 'caught', 'hatched', 'evolved', 'rival', 'villager', 'trainers', 'wild', 'favour', 'haggle', 'deed', 'zones']);
    for (const x of f) expect(x.text.includes(DASH)).toBe(false);
  });

  it('is empty for an empty day, caps a busy one, and drops the zone of a species caught in two places', () => {
    expect(buildDigest(EMPTY_DAY, DAY)).toEqual([]);
    const busy = buildDigest({ ...EMPTY_DAY, events: Array.from({ length: 40 }, (_, i) => met(['mossling', 'glimfin', 'dustcub', 'cindercap', 'bramblecub', 'ampmite', 'pebblit', 'flampling', 'shiveruff', 'brookrawl', 'ripshell', 'seedrift', 'resilian', 'gustuff', 'grubolt', 'acier', 'hexroach', 'yahit'][i % 18]!, 'mire_route', 1)) }, DAY);
    expect(busy.length).toBe(JOURNAL_FACTS_MAX);
    const two = buildDigest({ ...EMPTY_DAY, events: [met('mossling', 'mire_route', 1), met('mossling', 'ash_route', 2)] }, DAY);
    expect(two.find((x) => x.kind === 'caught')?.text).toBe('I caught 2 Mossling.');
  });

  it('counts the Champion (not its league win again), the rival won, a received creature', () => {
    const f = buildDigest({ ...EMPTY_DAY, splits: [{ split: 'champion', at: at(1) }], battles: [battle('rival:Corin', 'trainer', 'win', null, 2), battle('zeon', 'league', 'win', 'solenne', 1)], events: [met('glimfin', null, 3, { detail: { how: 'received', speciesId: 'glimfin', level: 5, zoneId: null, trainer: 'red' } })] }, DAY);
    expect(f.map((x) => x.text)).toEqual(['I beat the Champion!', 'I was given a Glimfin.', 'I beat my rival Corin.', 'I was on Solenne.']);
  });
});

describe('day numbers, day keys and the cleaning of an entry', () => {
  it('counts the player day from the account', () => {
    expect(dayNumberOf(new Date(DAY + 5 * 3_600_000), DAY)).toBe(1);
    expect(dayNumberOf(new Date(DAY - 11 * DAY_MS + 1000), DAY)).toBe(12);
    expect(dayStartOfKey('2026-10-22')).toBe(DAY);
    expect(dayStartOfKey('2026-02-31')).toBeNull();
    expect(dayStartOfKey('nope')).toBeNull();
  });

  it('cleans an entry: control characters, em-dashes, whitespace, a sentence cut', () => {
    expect(cleanEntry(`Day 3: I caught a Mossling ${DASH} at last.\u0007\n  Then I slept.`)).toBe('Day 3: I caught a Mossling, at last. Then I slept.');
    const long = cleanEntry('I walked a long way. '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(JOURNAL_TEXT_MAX);
    expect(long.endsWith('.')).toBe(true);
  });
});

describe('the journal routes', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  const today = (): number => Math.floor(s.time.clock() / DAY_MS) * DAY_MS;
  const key = (t: number): string => new Date(t).toISOString().slice(0, 10);

  it("reads today from real rows, writes and rewrites today's entry, and lists it", async () => {
    const acc = await register(s, 'glimfin');
    const r = await api(s, 'GET', '/journal', acc.access);
    expect(r.status).toBe(200);
    const view = JournalRes.parse(r.body);
    expect(view.today).toMatchObject({ day: key(today()), dayNumber: 1, entry: null });
    // the starter, handed over at registration
    expect(view.today.facts.map((f) => f.text)).toContain('I was given a Glimfin.');
    expect(view.unwritten).toEqual([]);
    expect(view.entries).toEqual([]);

    const w = await api(s, 'POST', `/journal/day/${key(today())}`, acc.access, { text: `Day 1: Prof. Wynn gave me a Glimfin ${DASH} my first Ewamon.` });
    expect(w.status).toBe(200);
    const e = JournalEntryViewSchema.parse(w.body);
    expect(e).toMatchObject({ day: key(today()), dayNumber: 1, text: 'Day 1: Prof. Wynn gave me a Glimfin, my first Ewamon.' });
    expect(e.facts.map((f) => f.kind)).toContain('received');
    const again = await api(s, 'POST', `/journal/day/${key(today())}`, acc.access, { text: 'Day 1: A Glimfin joined me today.' });
    expect(again.status).toBe(200);
    const list = JournalRes.parse((await api(s, 'GET', '/journal', acc.access)).body);
    expect(list.today.entry?.text).toBe('Day 1: A Glimfin joined me today.');
    expect(list.entries.map((x) => x.day)).toEqual([key(today())]);
    expect((await api(s, 'POST', `/journal/day/${key(today())}`, acc.access, { text: ' \u0007 ' })).status).toBe(400);
  });

  it('offers the days before today that have facts; an earlier day is written once, within the window', async () => {
    const acc = await register(s);
    await rawQuery(s.db, `update players set created_at = now() - interval '10 days' where id = $1`, [acc.id]);
    const yesterday = today() - DAY_MS;
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, acc.id, 'bloom', new Date(yesterday + 3_600_000)));
    const old = today() - (JOURNAL_BACKFILL_DAYS + 2) * DAY_MS;
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, acc.id, 'ember', new Date(old + 3_600_000)));

    const view = JournalRes.parse((await api(s, 'GET', '/journal', acc.access)).body);
    expect(view.unwritten).toEqual([key(yesterday)]);
    const day = JournalDaySchema.parse((await api(s, 'GET', `/journal/day/${key(yesterday)}`, acc.access)).body);
    expect(day).toMatchObject({ day: key(yesterday), dayNumber: 10, entry: null });
    expect(day.facts.map((f) => f.text)).toEqual(['I won the Bloom Badge from Mira Thornwell!']);

    expect((await api(s, 'POST', `/journal/day/${key(yesterday)}`, acc.access, { text: 'Day 10: I won the Bloom Badge.' })).status).toBe(200);
    const twice = await api(s, 'POST', `/journal/day/${key(yesterday)}`, acc.access, { text: 'Day 10: Again.' });
    expect([twice.status, twice.body.code]).toEqual([409, 'journalWritten']);
    expect(JournalRes.parse((await api(s, 'GET', '/journal', acc.access)).body).unwritten).toEqual([]);

    const closed = await api(s, 'POST', `/journal/day/${key(old)}`, acc.access, { text: 'Day 6: The Ember Badge.' });
    expect([closed.status, closed.body.code]).toEqual([409, 'journalClosed']);
    const empty = await api(s, 'POST', `/journal/day/${key(today() - 2 * DAY_MS)}`, acc.access, { text: 'Day 9: Nothing.' });
    expect([empty.status, empty.body.code]).toEqual([409, 'journalEmpty']);
    expect((await api(s, 'GET', `/journal/day/${key(today() + DAY_MS)}`, acc.access)).status).toBe(404);
    expect((await api(s, 'GET', `/journal/day/${key(today() - 20 * DAY_MS)}`, acc.access)).status).toBe(404);
    expect((await api(s, 'GET', '/journal/day/2026-02-31', acc.access)).status).toBe(400);
  });

  it('answers npcToolsOff when NPC_TOOLS=off', async () => {
    const off = await startServer({ NPC_TOOLS: 'off' });
    try {
      const acc = await register(off);
      expect((await api(off, 'GET', '/journal', acc.access)).body.code).toBe('npcToolsOff');
      expect((await api(off, 'POST', `/journal/day/${new Date(off.time.clock()).toISOString().slice(0, 10)}`, acc.access, { text: 'x' })).body.code).toBe('npcToolsOff');
    } finally {
      await off.stop();
    }
  }, 120_000);
});
