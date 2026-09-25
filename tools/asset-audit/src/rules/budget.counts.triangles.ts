/** `budget.counts.triangles`: `counts.triangles ≤ 2 500 000` (SPEC §50.2.2). */
import { countCapRule } from '../caps.js';

export const { id, rule, measure } = countCapRule('triangles');
