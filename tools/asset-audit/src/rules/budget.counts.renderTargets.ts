/** `budget.counts.renderTargets`: `counts.renderTargets ≤ 24` (SPEC §50.2.2). */
import { countCapRule } from '../caps.js';

export const { id, rule, measure } = countCapRule('renderTargets');
