/**
 * The adventure journal (LLM feature 9): a diary entry per play day (the UTC day), in the player's voice. The server
 * reads what happened that day from what it already keeps (creature history, battles, badges, run splits, audit rows,
 * NPC memory) into a digest of short first-person facts ("I caught a Mossling on Mire Route."); the client asks the
 * model for the entry from the digest (its template otherwise) and stores it: one per player per day, the day before
 * today written once, today's rewritten as the day goes on.
 *
 * - `GET /journal`: today's digest with its entry, the recent days that have facts and no entry yet, and the entries.
 * - `GET /journal/day/:day`: one day's digest and entry.
 * - `POST /journal/day/:day` { text }: the entry for that day.
 */
import { z } from 'zod';

export const JOURNAL_FACT_KINDS = [
  'badge',
  'champion',
  'legendary',
  'shiny',
  'caught',
  'hatched',
  'evolved',
  'received',
  'rival',
  'league',
  'villager',
  'trainers',
  'wild',
  'pvp',
  'raid',
  'bounty',
  'nemesis',
  'favour',
  'haggle',
  'deed',
  'zones',
] as const;
export type JournalFactKind = (typeof JOURNAL_FACT_KINDS)[number];

/** an entry's length, as stored */
export const JOURNAL_TEXT_MAX = 600;
/** what a write may carry before it is cleaned and cut */
export const JOURNAL_WRITE_MAX = 2000;
/** a day's facts */
export const JOURNAL_FACTS_MAX = 16;
/** entries a list carries */
export const JOURNAL_LIST_MAX = 60;
/** the days before today an entry may still be written for (once each) */
export const JOURNAL_BACKFILL_DAYS = 3;

/** a UTC day key */
export const JournalDayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const JournalFactSchema = z.object({
  kind: z.enum(JOURNAL_FACT_KINDS),
  /** one first-person sentence, every name and number in it true */
  text: z.string().min(1).max(200),
  speciesId: z.string().max(32).nullable(),
  zoneId: z.string().max(32).nullable(),
  /** a type for the chip's icon */
  type: z.string().max(16).nullable(),
  /** how many times it happened (catches of a species, battles won) */
  count: z.number().int().min(1),
});
export type JournalFact = z.infer<typeof JournalFactSchema>;

export const JournalEntryViewSchema = z.object({
  day: JournalDayKey,
  /** "Day 12": the player's day, from the day the account was made (1) */
  dayNumber: z.number().int().min(1),
  text: z.string().min(1).max(JOURNAL_TEXT_MAX),
  /** the digest the entry was written from */
  facts: z.array(JournalFactSchema).max(JOURNAL_FACTS_MAX),
  writtenAt: z.iso.datetime({ offset: true }),
});
export type JournalEntryView = z.infer<typeof JournalEntryViewSchema>;

export const JournalDaySchema = z.object({
  day: JournalDayKey,
  dayNumber: z.number().int().min(1),
  facts: z.array(JournalFactSchema).max(JOURNAL_FACTS_MAX),
  entry: JournalEntryViewSchema.nullable(),
});
export type JournalDay = z.infer<typeof JournalDaySchema>;

export const JournalRes = z.object({
  today: JournalDaySchema,
  /** recent days (before today, newest first) with facts and no entry: the client writes them */
  unwritten: z.array(JournalDayKey).max(JOURNAL_BACKFILL_DAYS),
  /** newest day first */
  entries: z.array(JournalEntryViewSchema).max(JOURNAL_LIST_MAX),
});
export type JournalView = z.infer<typeof JournalRes>;

export const JournalDayParams = z.object({ day: JournalDayKey });
export const JournalWriteReq = z.object({ text: z.string().min(1).max(JOURNAL_WRITE_MAX) });
