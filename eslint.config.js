// @ts-check
/**
 * ESLint, flat config. The architectural laws of Ewamon Remastered, machine-checked:
 *
 *   1. @ewa/core imports nothing. Client (preview) and server (truth) run the same bytes.
 *   2. The simulation is deterministic: no wall clock, no Math.random, no unordered iteration.
 *   3. Dependency direction is one way:
 *        core <- content <- protocol <- server
 *        core <- render (three only; no rules, no network)
 *        client sits at the bottom and may import everything except server/persist.
 *   4. Server and persist never see three/react; client never sees node builtins.
 *
 * Each rule carries its reason in the message, so whoever trips it gets the argument and
 * not just a rule name.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import ewa from './eslint/local-rules.js';

const NODE_BUILTINS = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dns', 'events', 'fs', 'http',
  'http2', 'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring',
  'readline', 'stream', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
];
const NODE_BUILTIN_PATTERNS = ['node:*', 'node:*/*'];
const deny = (names, message) => names.map((name) => ({ name, message }));
const denyPatterns = (groups, message) => [{ group: groups, message }];

export default tseslint.config(
  {
    name: 'ewa/ignores',
    ignores: [
      '**/dist/**', '**/dist-types/**', '**/*.d.ts', '**/*.tsbuildinfo', 'coverage/**',
      '.screenshots/**', '.design/**', '.claude/**', 'assets-src/**', '**/public/**', '**/drizzle/**',
    ],
  },
  {
    name: 'ewa/base',
    files: ['**/*.ts', '**/*.tsx'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: { ewa },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: true },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_',
          caughtErrors: 'all', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'ewa/no-cross-package-relative-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-throw-literal': 'error',
    },
  },

  // ---- @ewa/core: pure, deterministic, dependency-free ----------------------------------
  {
    name: 'ewa/core',
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'ewa/no-external-imports': ['error', { boundary: 'packages/core' }],
      'ewa/no-unordered-iteration': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'core is deterministic: use the seeded Rng passed in.' },
        { object: 'Date', property: 'now', message: 'core has no wall clock: time is an input.' },
        { object: 'performance', property: 'now', message: 'core has no wall clock: time is an input.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'core has no wall clock.' },
        { selector: "MemberExpression[object.name='globalThis']", message: 'core touches no globals.' },
        { selector: "Identifier[name='window']", message: 'core has no DOM.' },
        { selector: "Identifier[name='document']", message: 'core has no DOM.' },
        { selector: "Identifier[name='process']", message: 'core has no process.' },
      ],
    },
  },

  // ---- @ewa/content: typed data + zod only ----------------------------------------------
  {
    name: 'ewa/content',
    files: ['packages/content/src/**/*.ts'],
    rules: {
      'ewa/no-unordered-iteration': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: deny(
            ['three', 'react', 'react-dom', '@ewa/protocol', '@ewa/render', '@ewa/server', '@ewa/persist', '@ewa/client', ...NODE_BUILTINS],
            'content is typed data validated by zod. It depends on @ewa/core only.',
          ),
          patterns: denyPatterns([...NODE_BUILTIN_PATTERNS, 'three/*', '@colyseus/*'], 'content depends on @ewa/core and zod only.'),
        },
      ],
    },
  },

  // ---- @ewa/protocol: wire schemas --------------------------------------------------------
  {
    name: 'ewa/protocol',
    files: ['packages/protocol/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: deny(
            ['three', 'react', 'react-dom', '@ewa/render', '@ewa/server', '@ewa/persist', '@ewa/client', ...NODE_BUILTINS],
            'protocol is shared by client and server: schema classes + message types only.',
          ),
          patterns: denyPatterns([...NODE_BUILTIN_PATTERNS, 'three/*'], 'protocol has no platform.'),
        },
      ],
    },
  },

  // ---- @ewa/render: three only, no rules, no network -------------------------------------
  {
    name: 'ewa/render',
    files: ['packages/render/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: deny(
            ['react', 'react-dom', 'zustand', '@ewa/core', '@ewa/content', '@ewa/protocol', '@ewa/server', '@ewa/persist', '@ewa/client', '@colyseus/sdk', ...NODE_BUILTINS],
            'render draws what it is told. It knows no game rules, content, network or React: the client adapts content into render-side descriptors.',
          ),
          patterns: denyPatterns([...NODE_BUILTIN_PATTERNS, '@colyseus/*'], 'render is browser-only Three.js.'),
        },
      ],
    },
  },

  // ---- @ewa/server / @ewa/persist: no three, no react, no render/client ------------------
  {
    name: 'ewa/server-side',
    files: ['packages/server/src/**/*.ts', 'packages/persist/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: deny(
            ['three', 'react', 'react-dom', 'zustand', '@ewa/render', '@ewa/client', '@colyseus/sdk'],
            'the server never renders. All game truth flows core -> server -> protocol.',
          ),
          patterns: denyPatterns(['three/*'], 'the server never renders.'),
        },
      ],
    },
  },

  // ---- @ewa/client: browser only -----------------------------------------------------------
  {
    name: 'ewa/client',
    files: ['packages/client/src/**/*.ts', 'packages/client/src/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: deny(
            ['@ewa/server', '@ewa/persist', 'colyseus', '@colyseus/core', 'pg', 'drizzle-orm', ...NODE_BUILTINS],
            'the client is a browser bundle. Server truth arrives over the wire, never by import.',
          ),
          patterns: denyPatterns(
            [...NODE_BUILTIN_PATTERNS, '@ewa/server/*', '@ewa/persist/*', 'drizzle-orm/*'],
            'the client is a browser bundle.',
          ),
        },
      ],
    },
  },

  {
    name: 'ewa/tools-and-tests',
    files: ['tools/**/*.ts', 'packages/*/test/**/*.ts', 'packages/*/test/**/*.tsx', '*.ts', '*.js', 'eslint/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
