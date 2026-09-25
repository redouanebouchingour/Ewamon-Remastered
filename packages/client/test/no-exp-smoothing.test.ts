/**
 * §50.4.7 no-exp-smoothing — `src/scene/**` contains no `pos += (target − pos) · k`-shaped assignment to x / z
 * (20-client.md §20.4.6: remote avatars interpolate linearly from a 100 ms buffer; the local avatar blends a render
 * offset linearly over 100 ms; exponential smoothing does not exist in the scene).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scene = fileURLToPath(new URL('../src/scene', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The spec's pattern (an assignment to an x / z name ending in `* 0.<digits>`), plus the explicit lerp-toward-self form. */
export function smoothingHits(text: string): string[] {
  const hits: string[] = [];
  const lines = text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n');
  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '');
    const assign = /(?:^|[^\w.])((?:\w+\.)*\w*[xzXZ])\s*([+\-*]?=)(?!=)\s*(.+)$/.exec(line);
    if (assign === null) continue;
    const [, lhs, , rhs] = assign as unknown as [string, string, string, string];
    if (/\*\s*0\.\d+\s*\)?\s*;?\s*$/.test(rhs)) hits.push(raw.trim());
    // pos += (target - pos) * k   /   pos = pos + (target - pos) * k
    const self = lhs.replace(/[.$]/g, '\\$&');
    if (new RegExp(`\\(\\s*[\\w.]+\\s*-\\s*${self}\\s*\\)\\s*\\*`).test(rhs)) hits.push(raw.trim());
  }
  return hits;
}

describe('no exponential smoothing in src/scene', () => {
  it('the detector flags the forbidden shapes (fixtures)', () => {
    expect(smoothingHits('  pos.x += (target.x - pos.x) * 0.15;')).toHaveLength(2);
    expect(smoothingHits('this.renderZ = this.renderZ + (goalZ - this.renderZ) * k;')).toHaveLength(1);
    expect(smoothingHits('t.x = r[ja + 1]! + (r[jb + 1]! - r[ja + 1]!) * u;')).toEqual([]);
    expect(smoothingHits('this.renderX = this.pose.x + this.offX * k;')).toEqual([]);
  });

  it('no file under src/scene smooths x / z exponentially', () => {
    const hits: string[] = [];
    for (const f of walk(scene)) for (const h of smoothingHits(readFileSync(f, 'utf8'))) hits.push(`${relative(scene, f)}: ${h}`);
    expect(hits).toEqual([]);
  });
});
