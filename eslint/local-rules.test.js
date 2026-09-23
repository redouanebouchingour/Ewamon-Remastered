/**
 * Tests for the architectural lint rules.
 *
 * Two halves, and the second is the one that would actually save us. The RuleTester cases
 * prove each rule reports what it should and stays quiet otherwise. The wiring cases prove
 * the rules are switched on for the right paths at the right severity - because the way a
 * boundary rule fails in practice is not a logic bug, it is a `files:` glob that stopped
 * matching after a directory moved, at which point the config still loads, `pnpm lint` still
 * passes, and nothing is enforced any more. That is exactly the state this repo was in when
 * the plan already claimed core's zero-dependency rule was "enforced by lint config".
 *
 * Run with `pnpm test:lint-rules`. Kept out of the main vitest project on purpose: the root
 * config collects `packages/<pkg>/test/**` and this is tooling, not a package.
 */

import path from 'node:path';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';
import ewa from './local-rules.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(import.meta.dirname, '..');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// A file deep inside core, so a `../..` escape has somewhere to escape to.
const CORE_FILE = 'packages/core/src/sim/step.ts';
const CORE_OPTIONS = [{ boundary: 'packages/core' }];

ruleTester.run('no-external-imports', ewa.rules['no-external-imports'], {
  valid: [
    { filename: CORE_FILE, options: CORE_OPTIONS, code: "import { stepBall } from './ball.js';" },
    { filename: CORE_FILE, options: CORE_OPTIONS, code: "import type { SimState } from '../state/simstate.js';" },
    { filename: CORE_FILE, options: CORE_OPTIONS, code: "export * from './substep.js';" },
    // Not an import at all. The require check must not fire on a local function named require.
    { filename: CORE_FILE, options: CORE_OPTIONS, code: 'export const x = Math.imul(1, 2);' },
  ],
  invalid: [
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "import { readFileSync } from 'node:fs';",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "import { encodeSnapshot } from '@ewa/protocol';",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "import { Vector3 } from 'three';",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "export { quantize } from '@ewa/protocol';",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "export * from '@ewa/ai';",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "const later = import('node:perf_hooks');",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "const fs = require('node:fs');",
      errors: [{ messageId: 'external' }],
    },
    {
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "type Stats = import('node:fs').Stats;",
      errors: [{ messageId: 'external' }],
    },
    {
      // A relative path out of the package is the same dependency, spelled quietly.
      filename: CORE_FILE,
      options: CORE_OPTIONS,
      code: "import { quantize } from '../../../protocol/src/quantize.js';",
      errors: [{ messageId: 'escapes' }],
    },
  ],
});

ruleTester.run('no-cross-package-relative-imports', ewa.rules['no-cross-package-relative-imports'], {
  valid: [
    {
      filename: 'packages/client/src/net/local-host.ts',
      code: "import { Room } from '@ewa/server';",
    },
    {
      filename: 'packages/client/src/net/local-host.ts',
      code: "import { Room } from './session.js';",
    },
    {
      // The client bundles the shipped tuning from the repo root. Outside packages/, allowed.
      filename: 'packages/client/src/config/load.ts',
      code: "import physics from '../../../../config/physics.json';",
    },
    { filename: 'eslint/local-rules.js', code: "import path from 'node:path';" },
  ],
  invalid: [
    {
      filename: 'packages/client/src/net/local-host.ts',
      code: "import { Room } from '../../../server/src/core/index.js';",
      errors: [{ messageId: 'crossPackage', data: { source: '../../../server/src/core/index.js', other: 'server' } }],
    },
    {
      filename: 'packages/server/src/core/room.ts',
      code: "import { stepSim } from '../../../core/src/index.js';",
      errors: [{ messageId: 'crossPackage' }],
    },
  ],
});

ruleTester.run('no-unordered-iteration', ewa.rules['no-unordered-iteration'], {
  valid: [
    { filename: CORE_FILE, code: 'for (const k of Object.keys(o).sort()) use(k);' },
    { filename: CORE_FILE, code: 'if (Object.keys(o).length === 0) fail();' },
    { filename: CORE_FILE, code: 'for (const v of arr) use(v);' },
    { filename: CORE_FILE, code: 'for (const [k, v] of map) use(k, v);' },
    { filename: CORE_FILE, code: 'const s = Object.keys(o).sort().join(",");' },
    // A user-defined `keys` on something else is not Object.keys.
    { filename: CORE_FILE, code: 'const k = registry.keys(o);' },
  ],
  invalid: [
    { filename: CORE_FILE, code: 'for (const k in o) use(k);', errors: [{ messageId: 'forIn' }] },
    {
      filename: CORE_FILE,
      code: 'for (const [id, t] of Object.entries(o)) use(id, t);',
      errors: [{ messageId: 'unordered', data: { method: 'entries' } }],
    },
    { filename: CORE_FILE, code: 'const ks = Object.keys(o);', errors: [{ messageId: 'unordered' }] },
    { filename: CORE_FILE, code: 'Object.values(o).forEach(use);', errors: [{ messageId: 'unordered' }] },
    {
      filename: CORE_FILE,
      code: 'const h = Object.keys(o).map(String).join("|");',
      errors: [{ messageId: 'unordered' }],
    },
  ],
});

// SPEC §20.2.1: one passing and (at least) three failing fixtures for the client's inline-style ban.
const jsxTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
const UI_FILE = 'packages/client/src/ui/HpBar.tsx';

jsxTester.run('no-inline-style', ewa.rules['no-inline-style'], {
  valid: [
    // the one sanctioned form: custom properties through cssVars()
    { filename: UI_FILE, code: "const a = <div className={s.fill} style={cssVars({ '--hp': 0.42 })} />;" },
    { filename: UI_FILE, code: 'const a = <div className={s.fill} style={cssVars(vars)} />;' },
    // setProperty is the one programmatic write the spec allows (applySettings.ts, --ui-scale)
    { filename: UI_FILE, code: "document.documentElement.style.setProperty('--ui-scale', '1.1');" },
    // a prop named style on a non-style concept is still a JSX style attribute; plain reads are fine
    { filename: UI_FILE, code: 'const w = el.style.width;' },
    { filename: UI_FILE, code: "el.setAttribute('data-state', 'open');" },
  ],
  invalid: [
    { filename: UI_FILE, code: 'const a = <div style={{ width: 10 }} />;', errors: [{ messageId: 'jsxStyle' }] },
    { filename: UI_FILE, code: 'const a = <div style="color: red" />;', errors: [{ messageId: 'jsxStyle' }] },
    { filename: UI_FILE, code: "el.style.cssText = 'color: red';", errors: [{ messageId: 'domStyle' }] },
    { filename: UI_FILE, code: "el.setAttribute('style', 'color: red');", errors: [{ messageId: 'domStyle' }] },
    { filename: UI_FILE, code: "el.style.width = '10px';", errors: [{ messageId: 'domStyle' }] },
    { filename: UI_FILE, code: 'Object.assign(el.style, { width: 1 });', errors: [{ messageId: 'domStyle' }] },
    {
      filename: UI_FILE,
      code: "const a = <div style={cssVars({ width: '10px' })} />;",
      errors: [{ messageId: 'cssVarsKey', data: { key: 'width' } }],
    },
  ],
});

/**
 * The severity a given file actually gets, straight from the real eslint.config.js.
 * `calculateConfigForFile` runs the same resolution `eslint .` does, so a `files:` glob that
 * no longer matches shows up here as a missing rule rather than as silence.
 */
describe('eslint.config.js wiring', () => {
  const eslint = new ESLint({ cwd: repoRoot });
  const configFor = (relPath) => eslint.calculateConfigForFile(path.join(repoRoot, relPath));

  const severity = (rules, name) => {
    const entry = rules[name];
    if (entry === undefined) return 'not configured';
    return Array.isArray(entry) ? entry[0] : entry;
  };
  const denied = (rules) => (rules['no-restricted-imports'][1].paths ?? []).map((p) => p.name);

  it('enforces core isolation and determinism on the simulation', async () => {
    const { rules } = await configFor('packages/core/src/battle/turn.ts');
    expect(severity(rules, 'ewa/no-external-imports')).toBe(2);
    expect(rules['ewa/no-external-imports'][1]).toEqual({ boundary: 'packages/core' });
    expect(severity(rules, 'ewa/no-unordered-iteration')).toBe(2);
    expect(rules['no-restricted-properties'].slice(1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ object: 'Math', property: 'random' })]),
    );
  });

  it('keeps node out of the browser bundle and three/react off the server', async () => {
    const client = await configFor('packages/client/src/net/session.ts');
    const server = await configFor('packages/server/src/rooms/zone.ts');
    const persist = await configFor('packages/persist/src/schema.ts');
    expect(denied(client.rules)).toContain('fs');
    expect(denied(client.rules)).toContain('@ewa/server');
    expect(denied(client.rules)).toContain('@ewa/persist');
    expect(denied(server.rules)).toContain('three');
    expect(denied(server.rules)).toContain('@ewa/render');
    expect(denied(persist.rules)).toContain('react');
  });

  it('keeps the dependency direction one way for content, protocol and render', async () => {
    const content = await configFor('packages/content/src/species.ts');
    const protocol = await configFor('packages/protocol/src/zone.ts');
    const render = await configFor('packages/render/src/materials.ts');
    expect(denied(content.rules)).toContain('@ewa/protocol');
    expect(denied(protocol.rules)).toContain('@ewa/server');
    expect(denied(render.rules)).toContain('@ewa/core');
    expect(denied(render.rules)).toContain('react');
    expect(denied(render.rules)).toContain('@ewa/protocol');
  });

  it('bans inline styles across the client source (SPEC §20.2.1)', async () => {
    for (const file of ['packages/client/src/ui/HpBar.tsx', 'packages/client/src/screens/PartyScreen.tsx', 'packages/client/src/net/api.ts']) {
      const { rules } = await configFor(file);
      expect(severity(rules, 'ewa/no-inline-style')).toBe(2);
    }
    const server = await configFor('packages/server/src/rooms/zone.ts');
    expect(severity(server.rules, 'ewa/no-inline-style')).toBe('not configured');
  });

  it('applies the cross-package relative import rule to every package', async () => {
    for (const file of [
      'packages/core/src/index.ts',
      'packages/content/src/index.ts',
      'packages/protocol/src/index.ts',
      'packages/render/src/index.ts',
      'packages/server/src/main.ts',
      'packages/persist/src/index.ts',
      'packages/client/src/main.tsx',
    ]) {
      const { rules } = await configFor(file);
      expect(severity(rules, 'ewa/no-cross-package-relative-imports')).toBe(2);
    }
  });
});

/**
 * End to end: the rules fire through the real config, on a real file path, with the real
 * parser. It is the only check that covers the whole chain - config resolution, plugin
 * registration, and the rule itself.
 */
describe('eslint.config.js end to end', () => {
  const eslint = new ESLint({ cwd: repoRoot });

  const idsFor = async (relPath, code) => {
    const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, relPath) });
    return result.messages.map((m) => m.ruleId);
  };

  it('rejects a dependency, a wall clock and ambient randomness in @ewa/core', async () => {
    const ids = await idsFor(
      'packages/core/src/battle/turn.ts',
      [
        "import { readFileSync } from 'node:fs';",
        'export function tick(): number {',
        '  return Date.now() + Math.random() + readFileSync.length;',
        '}',
      ].join('\n'),
    );
    expect(ids).toContain('ewa/no-external-imports');
    expect(ids).toContain('no-restricted-properties');
  });

  it('rejects a node builtin in the client bundle', async () => {
    const ids = await idsFor(
      'packages/client/src/net/session.ts',
      "import { readFileSync } from 'node:fs';\nexport const n = readFileSync.length;\n",
    );
    expect(ids).toContain('no-restricted-imports');
  });

  it('rejects an inline style in a client component and accepts cssVars()', async () => {
    const bad = await idsFor(
      'packages/client/src/ui/Example.tsx',
      'export const E = (): unknown => <div style={{ width: 4 }} />;\n',
    );
    expect(bad).toContain('ewa/no-inline-style');
    const good = await idsFor(
      'packages/client/src/ui/Example.tsx',
      "declare function cssVars(v: Record<`--${string}`, number>): Record<string, number>;\nexport const E = (): unknown => <div style={cssVars({ '--hp': 0.5 })} />;\n",
    );
    expect(good).not.toContain('ewa/no-inline-style');
  });

  it('rejects three in the server and game rules in render', async () => {
    const server = await idsFor(
      'packages/server/src/rooms/zone.ts',
      "import { Vector3 } from 'three';\nexport const v = Vector3;\n",
    );
    expect(server.filter((id) => id === 'no-restricted-imports')).toHaveLength(1);
    const render = await idsFor(
      'packages/render/src/zone/builder.ts',
      "import { calcDamage } from '@ewa/core';\nexport const d = calcDamage;\n",
    );
    expect(render.filter((id) => id === 'no-restricted-imports')).toHaveLength(1);
  });

  it('accepts the sanctioned imports', async () => {
    const client = await idsFor(
      'packages/client/src/scene/adapter.ts',
      "import { AREAS } from '@ewa/content';\nimport { ZoneBuilder } from '@ewa/render';\nexport const z = [AREAS, ZoneBuilder];\n",
    );
    expect(client).not.toContain('no-restricted-imports');
    const content = await idsFor(
      'packages/content/src/species.ts',
      "import type { SpeciesDef } from '@ewa/core';\nexport const s: SpeciesDef[] = [];\n",
    );
    expect(content).not.toContain('no-restricted-imports');
  });
});
