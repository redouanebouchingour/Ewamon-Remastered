/**
 * One-shot generator for CATCH_B (§2.15). Run with `pnpm exec tsx packages/core/scripts/gen-catch-table.ts`
 * and paste the printed literal into src/catch.ts. Math.pow never runs at sim time; the committed
 * literal wins over any engine's regeneration.
 */
const rows: string[] = [];
const table: number[] = [0];
for (let a = 1; a <= 255; a++) table.push(Math.floor(65536 / (255 / a) ** 0.1875));
for (let i = 0; i < table.length; i += 16) rows.push('  ' + table.slice(i, i + 16).join(', ') + ',');
console.log('export const CATCH_B: readonly number[] = [\n' + rows.join('\n') + '\n];');
