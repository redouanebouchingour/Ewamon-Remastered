/**
 * The rumour board (LLM feature 8): what a town's crier knows of the living world today. `GET /world/rumours/:zoneId`
 * (a town) answers the day's facts: each one a plain sentence the server built from its own data (the client's
 * fallback and the model's only source), with the creature, zone and type it is about for the chips. The server caches
 * the world part per UTC day and town; the gossip about the caller (feature 1's deeds in that town) is added per read.
 */
import { z } from 'zod';

export const RUMOUR_KINDS = [
  'badge',
  'champion',
  'raid',
  'swarm',
  'event',
  'ecosystem',
  'migrant',
  'bounty',
  'claim',
  'camp',
  'nemesis',
  'weather',
  'market',
  'cup',
  'gossip',
  'standing',
] as const;
export type RumourKind = (typeof RUMOUR_KINDS)[number];

/** the world's facts on one board */
export const RUMOUR_WORLD_MAX = 8;
/** the facts about the caller added to them */
export const RUMOUR_GOSSIP_MAX = 3;
/** a fact's sentence */
export const RUMOUR_TEXT_MAX = 240;

export const RumourParams = z.object({ zoneId: z.string().min(1).max(32) });

export const RumourFactSchema = z.object({
  /** stable within the day: `<kind>:<subject>` */
  id: z.string().min(1).max(96),
  kind: z.enum(RUMOUR_KINDS),
  /** the fact as one plain sentence, every name and number in it true */
  text: z.string().min(1).max(RUMOUR_TEXT_MAX),
  zoneId: z.string().max(32).nullable(),
  speciesId: z.string().max(32).nullable(),
  /** a type the fact is about (a badge's gym type, a swarm's species type), for its icon */
  type: z.string().max(16).nullable(),
});
export type RumourFact = z.infer<typeof RumourFactSchema>;

export const RumoursRes = z.object({
  zoneId: z.string().max(32),
  /** "Mirevale" */
  town: z.string().max(64),
  /** the UTC day key `YYYY-MM-DD` the board is for */
  day: z.string().length(10),
  facts: z.array(RumourFactSchema).max(RUMOUR_WORLD_MAX + RUMOUR_GOSSIP_MAX),
});
export type RumoursView = z.infer<typeof RumoursRes>;
