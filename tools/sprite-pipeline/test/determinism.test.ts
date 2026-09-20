import { describe, expect, it } from 'vitest';
import { buildFixture, snapshotDir } from './helpers.js';

describe('determinism + cache', () => {
  it('two forced builds over a 3-species fixture are byte-identical; a third run is fully cached', async () => {
    const ids = ['detone', 'dettwo', 'detthree'];
    const fx = await buildFixture(ids, 256, { force: true });
    const first = snapshotDir(fx.outDir);
    const firstQa = snapshotDir(fx.qaDir);
    expect(first.size).toBe(2 * 3 * 4 + 3 + 1); // 2 atlases × 3 maps × 4 levels + 3 thumbs + manifest
    expect(fx.result.cacheHits).toBe(0);

    const second = await fx.run({ force: true });
    expect(second.cacheHits).toBe(0);
    const again = snapshotDir(fx.outDir);
    expect([...again.keys()]).toEqual([...first.keys()]);
    for (const [file, bytes] of first) expect(again.get(file)!.equals(bytes), file).toBe(true);
    const againQa = snapshotDir(fx.qaDir);
    for (const [file, bytes] of firstQa) expect(againQa.get(file)!.equals(bytes), file).toBe(true);

    const third = await fx.run({ force: false });
    expect(third.cacheHits).toBe(6);
    expect(third.totalBytes).toBe(fx.result.totalBytes);
    const final = snapshotDir(fx.outDir);
    for (const [file, bytes] of first) expect(final.get(file)!.equals(bytes), file).toBe(true);
    // No timestamps anywhere in the JSON outputs.
    expect(final.get('creatures.manifest.json')!.toString()).not.toMatch(/builtAt|timestamp|\d{4}-\d{2}-\d{2}T/);
  }, 300_000);
});
