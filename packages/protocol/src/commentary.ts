/**
 * The battle commentary's line banks (LLM feature 3, client only): at a battle's start the client asks the local model
 * for a few lines per moment, the commentator's (name free colour lines) and the opposing trainer's (in their voice),
 * and validates the answer with these schemas before any line is shown. Never sent over the wire and never game
 * truth: they live here because the client reaches zod through the protocol package only.
 *
 * Each key is optional and a key that does not parse is dropped on its own (`.catch`), so one bad array does not cost
 * the rest of the bank; the client still cleans and length-checks every line.
 */
import { z } from 'zod';

/**
 * The commentator's moments the model pre-writes colour for (client battle/moments.ts `MomentKind`, snake case as the
 * model reads them). Not `super`, `knockout` or `status`: the model's lines for those said who or what (the wrong type
 * winning the matchup, "one foe faints", "burned" for a poison), so the templates keep them.
 */
export const CASTER_BANK_KEYS = ['opening', 'crit', 'comeback', 'transform', 'last_one', 'catch', 'escape', 'win', 'loss'] as const;
export type CasterBankKey = (typeof CASTER_BANK_KEYS)[number];
/** The opposing trainer's moments: `faint` = one of the trainer's own creatures fainted, `win` / `loss` from the trainer's side. */
export const TRAINER_BANK_KEYS = ['start', 'faint', 'last_one', 'win', 'loss'] as const;
export type TrainerBankKey = (typeof TRAINER_BANK_KEYS)[number];

/** lines kept per moment */
export const BANK_LINES_MAX = 4;

const lines = z.array(z.string().max(400)).max(12).optional().catch(undefined);

export const CasterBankSchema = z.object(Object.fromEntries(CASTER_BANK_KEYS.map((k) => [k, lines])) as Record<CasterBankKey, typeof lines>);
export const TrainerBankSchema = z.object(Object.fromEntries(TRAINER_BANK_KEYS.map((k) => [k, lines])) as Record<TrainerBankKey, typeof lines>);
export type CasterBankRaw = z.infer<typeof CasterBankSchema>;
export type TrainerBankRaw = z.infer<typeof TrainerBankSchema>;
