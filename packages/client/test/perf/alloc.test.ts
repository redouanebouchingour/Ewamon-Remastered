/**
 * §50.4.7 perf/alloc (§20.10.2 rule 2): a 600-step run of the client-owned frame grows the heap by ≤ 64 KB between
 * forced GCs, and the bodies of `step | sample | flush | reconcile` in LocalPlayerController, RemoteInterpolator,
 * HudWriter, TimelinePlayer (and the targeting / audio steps) contain no `new `, `[]`, `{}`, `.map(`, `.filter(`
 * or `...` unless the line carries `// alloc-ok: <reason>` (≤ 3 such lines per file).
 */
import { readFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STEP, TICK_MS, createFrame } from './harness';

const FILES = ['scene/LocalPlayerController.ts', 'scene/RemoteInterpolator.ts', 'scene/HudWriter.ts', 'battle/TimelinePlayer.ts', 'scene/interaction.ts', 'audio/AudioDirector.ts'];
const NAMES = /^\s*(?:(?:private|public|protected|readonly|static|async)\s+)*(step|sample|flush|reconcile)\s*\([^)]*\)\s*(?::\s*[\w<>[\]| ]+)?\s*\{\s*$/;
const FORBIDDEN: readonly RegExp[] = [/\bnew\s+[A-Z_a-z]/, /\[\s*\]/, /\{\s*\}/, /\.map\(/, /\.filter\(/, /\.\.\./];

/** The lines of every step / sample / flush / reconcile body (brace-matched; comments stripped). */
export function hotBodies(text: string): { name: string; lines: string[] }[] {
  const lines = text.split('\n');
  const out: { name: string; lines: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = NAMES.exec(lines[i]!);
    if (m === null) continue;
    let depth = 0;
    const body: string[] = [];
    for (let j = i; j < lines.length; j++) {
      const l = lines[j]!;
      const code = l.replace(/\/\/.*$/, '').replace(/'[^']*'|`[^`]*`/g, "''");
      for (const ch of code) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (j > i) body.push(l);
      if (depth === 0 && j > i) break;
    }
    out.push({ name: m[1]!, lines: body.slice(0, -1) });
  }
  return out;
}

describe('perf/alloc', () => {
  it('hot bodies allocate nothing without an alloc-ok reason (≤ 3 per file)', () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const text = readFileSync(fileURLToPath(new URL(`../../src/${f}`, import.meta.url)), 'utf8');
      const bodies = hotBodies(text);
      expect(bodies.length, f).toBeGreaterThan(0);
      let oks = 0;
      for (const b of bodies) {
        for (const l of b.lines) {
          const code = l.replace(/\/\/.*$/, '').replace(/'[^']*'|`[^`]*`/g, "''");
          if (!FORBIDDEN.some((re) => re.test(code))) continue;
          if (/\/\/\s*alloc-ok:\s*\S/.test(l)) {
            oks++;
            continue;
          }
          hits.push(`${f} ${b.name}(): ${l.trim()}`);
        }
      }
      expect(oks, `${f} alloc-ok lines`).toBeLessThanOrEqual(3);
    }
    expect(hits).toEqual([]);
  });

  it('600 steps with 48 remotes and a battle turn grow the heap by ≤ 64 KB between forced GCs', () => {
    setFlagsFromString('--expose_gc');
    const gc = runInNewContext('gc') as () => void;
    let clock = 0;
    const f = createFrame(() => clock);
    const run = (n: number): void => {
      let tick = Math.floor(clock / TICK_MS);
      for (let i = 0; i < n; i++) {
        clock += STEP;
        if (Math.floor(clock / TICK_MS) > tick) {
          tick = Math.floor(clock / TICK_MS);
          f.patch(tick);
        }
        f.frame(clock);
      }
    };
    run(600); // warm: JIT, first-touch maps
    f.replay();
    gc();
    gc();
    const before = process.memoryUsage().heapUsed;
    run(600);
    gc();
    gc();
    const growth = process.memoryUsage().heapUsed - before;
    expect(growth).toBeLessThanOrEqual(64 * 1024);
  });
});
