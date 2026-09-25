/** `budget.counts.texturesSize`: `counts.texturesSize ≤ 734 003 200` bytes (700 MB, SPEC §50.2.2). */
import { countCapRule } from '../caps.js';

export const { id, rule, measure } = countCapRule('texturesSize');
