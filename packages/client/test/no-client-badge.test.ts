/**
 * §50.1 #13 no-client-badge: no client code path produces a BadgeId other than reading progressionDelta.badges.
 * `packages/client/src` contains no string literal equal to a BADGES id except in the display map badgeIcon.ts,
 * and nothing outside session.ts assigns progression/inventory slices (badges, exp, money, items, creatures).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BADGES } from '@ewa/content';

const src = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Source with comments removed, so documentation may name a badge. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = walk(src).map((p) => ({ path: relative(src, p).replace(/\\/g, '/'), text: code(readFileSync(p, 'utf8')) }));
const ids = BADGES.map((b) => b.id);

describe('no client-side badge', () => {
  it('knows all eight badge ids', () => {
    expect(ids).toHaveLength(8);
  });

  it('no string literal equals a badge id outside src/data/badgeIcon.ts', () => {
    const hits: string[] = [];
    const re = new RegExp(`(['"\`])(${ids.join('|')})\\1`, 'g');
    for (const f of files) {
      if (f.path === 'data/badgeIcon.ts') continue;
      for (const m of f.text.matchAll(re)) hits.push(`${f.path}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });

  it('only session.ts writes progression / inventory (badges, exp, money, items, party, box)', () => {
    const writers: string[] = [];
    for (const f of files) {
      if (f.path === 'state/session.ts') continue;
      if (/\b(progression|inventory)\s*:\s*\{/.test(f.text) && /\bset(State)?\(/.test(f.text)) writers.push(f.path);
      if (/useSessionStore\.setState\(/.test(f.text)) writers.push(f.path);
    }
    expect(writers).toEqual([]);
  });

  it('BattleEvent kinds that look like rewards are never handled on the client', () => {
    const hits = files.filter((f) => /['"](expGain|levelUp|catchResult)['"]/.test(f.text) && /applyProgressionDelta|applyInventoryDelta/.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
});
