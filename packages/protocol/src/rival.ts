/**
 * A recurring rival (LLM feature 7, content rival.ts): what the client knows of the player's rival. The same view rides
 * the `rival` server message (the rival is on this route: `near`, the client may pre-write its taunt; it stepped out
 * and walks up: `approach`, at `x`, `z`) and `GET /rival` (the Profile's rivalry section). The record and the arc are
 * the server's; the words the rival says are the client's (model or templates), and its parting line comes back once
 * per meeting through `POST /rival/words` so the Profile can show it.
 */
import { z } from 'zod';
import { RIVAL_ARCS, RIVAL_TEMPERAMENTS, RIVAL_WORDS_MAX } from '@ewa/content';

const Iso = z.iso.datetime({ offset: true });
const SpeciesId = z.string().min(1).max(32);

export const RIVAL_RESULTS = ['won', 'lost', 'draw'] as const;
/** a meeting from the player's side */
export type RivalResultView = (typeof RIVAL_RESULTS)[number];

export const RivalTeamMemberSchema = z.object({ speciesId: SpeciesId, level: z.number().int().min(1).max(100) });
export type RivalTeamMember = z.infer<typeof RivalTeamMemberSchema>;

export const RivalViewSchema = z.object({
  name: z.string().min(1).max(16),
  /** a render look stem */
  look: z.string().min(1).max(32),
  temperament: z.enum(RIVAL_TEMPERAMENTS),
  /** the root of its starter line */
  signature: SpeciesId,
  arc: z.enum(RIVAL_ARCS),
  record: z.object({
    playerWins: z.number().int().min(0),
    rivalWins: z.number().int().min(0),
    draws: z.number().int().min(0),
    meetings: z.number().int().min(0),
  }),
  /** the last meeting (null before the first) */
  last: z
    .object({
      result: z.enum(RIVAL_RESULTS),
      zoneId: z.string().min(1).max(32),
      at: Iso,
      /** the rival's parting line as the player saw it (null: not sent) */
      words: z.string().max(RIVAL_WORDS_MAX).nullable(),
    })
    .nullable(),
  /** the team it brings now (`rival` message) or brought last time (`GET /rival`), signature first */
  team: z.array(RivalTeamMemberSchema).max(6),
});
export type RivalView = z.infer<typeof RivalViewSchema>;

/** `GET /rival`: `enabled` false when the server runs `RIVAL=off`; `rival` null until the first battle with it. */
export const RivalRes = z.object({ enabled: z.boolean(), rival: RivalViewSchema.nullable() });
export type RivalState = z.infer<typeof RivalRes>;

/** `POST /rival/words`: the parting line the player saw (once per meeting, soon after it). */
export const RivalWordsReq = z.object({ text: z.string().trim().min(1).max(RIVAL_WORDS_MAX) });

export const RIVAL_PHASES = ['near', 'approach'] as const;
export type RivalPhase = (typeof RIVAL_PHASES)[number];

export const RivalMsg = z.object({
  type: z.literal('rival'),
  phase: z.enum(RIVAL_PHASES),
  /** where the rival steps out (`approach`; 0 with `near`) */
  x: z.number(),
  z: z.number(),
  rival: RivalViewSchema,
});
