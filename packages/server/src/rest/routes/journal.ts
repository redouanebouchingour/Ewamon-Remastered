/**
 * The adventure journal (LLM feature 9, game/journal.ts), behind `NPC_TOOLS` with the rest of the LLM features (409
 * `npcToolsOff`): the entries are the model's words over the server's digest of a day.
 *
 * - `GET /journal`: today's digest with its entry (the UTC day), the days of the last `JOURNAL_BACKFILL_DAYS` before
 *   today that have facts and no entry (newest first, none before the account's first day), and the entries, newest
 *   day first (at most `JOURNAL_LIST_MAX`).
 * - `GET /journal/day/:day`: one day's digest and entry (404 before the account's first day or after today).
 * - `POST /journal/day/:day` { text }: the day's entry, cleaned (`cleanEntry`: no control characters or em-dashes, cut
 *   at a sentence to `JOURNAL_TEXT_MAX`) and stored with the digest it was written from. Today's may be rewritten; an
 *   earlier day's only written once (409 `journalWritten`), and only within the backfill window (409 `journalClosed`);
 *   a day with nothing in it has no entry (409 `journalEmpty`). Text only, so no audit row; its own rate limit.
 */
import { JOURNAL_BACKFILL_DAYS, JOURNAL_LIST_MAX, JournalDayParams, JournalDaySchema, JournalEntryViewSchema, JournalRes, JournalWriteReq } from '@ewa/protocol';
import type { JournalDay, JournalEntryView, JournalFact } from '@ewa/protocol';
import type { JournalEntry, Repos, Tx } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { DAY_MS, dayKey } from '../../liveops/schedule';
import { buildDigest, cleanEntry, dayNumberOf, dayStartOfKey, gatherDay } from '../../game/journal';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

const iso = (d: Date): string => d.toISOString();

function entryView(e: JournalEntry): JournalEntryView {
  return { day: e.day, dayNumber: e.dayNumber, text: e.text, facts: e.facts as JournalFact[], writtenAt: iso(e.writtenAt) };
}

async function dayOf(repos: Repos, tx: Tx, playerId: string, createdAt: Date, dayStart: number): Promise<JournalDay> {
  const day = dayKey(dayStart);
  const facts = buildDigest(await gatherDay(repos, tx, playerId, dayStart), dayStart);
  const entry = await repos.journal.entry(tx, playerId, day);
  return { day, dayNumber: dayNumberOf(createdAt, dayStart), facts, entry: entry === null ? null : entryView(entry) };
}

export function registerJournalRoutes(app: FastifyInstance, deps: RestDeps, on: boolean): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  /** The player's row, and the first and the last day they may have entries for. */
  const span = async (tx: Tx, id: string) => {
    const me = await repos.players.byId(tx, id);
    if (me === null) throw new HttpError(404, 'NotFound');
    const today = Math.floor(clock() / DAY_MS) * DAY_MS;
    const first = Math.floor(me.createdAt.getTime() / DAY_MS) * DAY_MS;
    return { me, today, first };
  };

  app.get('/journal', bearer, async (req) => {
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const id = req.user.sub;
    const view = await repos.db.transaction(async (tx) => {
      const { me, today, first } = await span(tx, id);
      const todayDay = await dayOf(repos, tx, id, me.createdAt, today);
      const unwritten: string[] = [];
      for (let k = 1; k <= JOURNAL_BACKFILL_DAYS; k++) {
        const start = today - k * DAY_MS;
        if (start < first) break;
        if ((await repos.journal.entry(tx, id, dayKey(start))) !== null) continue;
        if (buildDigest(await gatherDay(repos, tx, id, start), start).length > 0) unwritten.push(dayKey(start));
      }
      const entries = (await repos.journal.entries(tx, id, JOURNAL_LIST_MAX)).map(entryView);
      return { today: todayDay, unwritten, entries };
    });
    return out(deps, JournalRes, view);
  });

  app.get('/journal/day/:day', bearer, async (req) => {
    const { day } = JournalDayParams.parse(req.params);
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const start = dayStartOfKey(day);
    if (start === null) throw new HttpError(400, 'invalidPayload');
    const id = req.user.sub;
    const view = await repos.db.transaction(async (tx) => {
      const { me, today, first } = await span(tx, id);
      if (start > today || start < first) throw new HttpError(404, 'NotFound');
      return dayOf(repos, tx, id, me.createdAt, start);
    });
    return out(deps, JournalDaySchema, view);
  });

  app.post('/journal/day/:day', { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'journal') }, async (req) => {
    const { day } = JournalDayParams.parse(req.params);
    const body = JournalWriteReq.parse(req.body);
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const start = dayStartOfKey(day);
    if (start === null) throw new HttpError(400, 'invalidPayload');
    const text = cleanEntry(body.text);
    if (text === '') throw new HttpError(400, 'invalidPayload');
    const id = req.user.sub;
    const now = new Date(clock());
    const saved = await repos.db.transaction(async (tx) => {
      const { me, today, first } = await span(tx, id);
      if (start > today || start < first) throw new HttpError(404, 'NotFound');
      if (start < today - JOURNAL_BACKFILL_DAYS * DAY_MS) throw new HttpError(409, 'journalClosed');
      if (start < today && (await repos.journal.entry(tx, id, day)) !== null) throw new HttpError(409, 'journalWritten');
      const facts = buildDigest(await gatherDay(repos, tx, id, start), start);
      if (facts.length === 0) throw new HttpError(409, 'journalEmpty');
      return repos.journal.write(tx, { playerId: id, day, dayNumber: dayNumberOf(me.createdAt, start), text, facts }, now);
    });
    return out(deps, JournalEntryViewSchema, entryView(saved));
  });
}
