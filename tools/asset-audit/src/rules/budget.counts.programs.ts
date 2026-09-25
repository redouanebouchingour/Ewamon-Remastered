/** `budget.counts.programs`: `counts.programs ≤ 96` (SPEC §50.2.2). */
import { countCapRule } from '../caps.js';

export const { id, rule, measure } = countCapRule('programs');
