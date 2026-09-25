/** `budget.counts.drawCalls`: `counts.drawCalls ≤ 400` (SPEC §50.2.2). */
import { countCapRule } from '../caps.js';

export const { id, rule, measure } = countCapRule('drawCalls');
