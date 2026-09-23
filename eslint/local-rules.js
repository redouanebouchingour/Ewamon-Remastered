/**
 * Local ESLint rules: the architectural laws of Ewamon Remastered, machine-checked.
 *
 * These three rules exist because the invariants they guard are the ones that stop being
 * true silently. Nothing fails loudly the day @ewa/core acquires a dependency or reads the
 * wall clock - the build still passes, the game still runs, and prediction starts fighting
 * the server weeks later in a way that reproduces on one machine in ten. A comment asking
 * future readers to keep core pure is exactly the kind of promise that gets broken; the
 * project plan already claimed these were "enforced by lint config" when no lint existed
 * at all.
 *
 * They are deliberately hand-written rather than pulled from an import-boundary plugin.
 * A plugin would need a module resolver to turn '@ewa/protocol' into a path, which means a
 * second source of truth for the workspace layout that can disagree with pnpm. These rules
 * only ever look at the specifier string and at path arithmetic, so they cannot be wrong
 * about what the bundler will do - and they need no dependency of their own, which matters
 * for the same reason core has none.
 */

import path from 'node:path';

/** Turn a Windows or POSIX absolute path into one with forward slashes, for comparisons. */
function slashes(p) {
  return p.replace(/\\/g, '/');
}

/**
 * True when `target` is inside `dir` (or is `dir` itself).
 *
 * Done with path.relative rather than a string prefix test, because a prefix test says
 * `packages/core-extra` is inside `packages/core`.
 */
function isInside(dir, target) {
  const rel = path.relative(dir, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Every place a module specifier can appear, reduced to one callback.
 *
 * The static `import`/`export ... from` forms are the ones people write, but the others are
 * the ones a boundary rule gets defeated by: `import('node:fs')` at runtime, an
 * `import('./x').T` type reference, or a stray `require`. Missing any of them would make the
 * rule advisory, which is worse than not having it - it would be believed.
 */
function specifierVisitor(check) {
  const fromSource = (node) => {
    if (node.source && node.source.type === 'Literal' && typeof node.source.value === 'string') {
      check(node.source, node.source.value);
    }
  };

  return {
    ImportDeclaration: fromSource,
    ExportNamedDeclaration: fromSource,
    ExportAllDeclaration: fromSource,
    ImportExpression: fromSource,

    /**
     * `import('./x').Thing` in a type position. The specifier is a literal *type* node in the
     * TS-ESTree AST rather than a plain Literal, so it needs unwrapping - and the property was
     * renamed from `argument` to `source`, with the old name kept as a deprecated getter that
     * warns when touched. Read `source` first and only fall back if it is absent.
     */
    TSImportType(node) {
      const arg = 'source' in node ? node.source : node.argument;
      if (!arg) return;
      if (arg.type === 'Literal' && typeof arg.value === 'string') check(arg, arg.value);
      else if (
        arg.type === 'TSLiteralType' &&
        arg.literal &&
        arg.literal.type === 'Literal' &&
        typeof arg.literal.value === 'string'
      ) {
        check(arg.literal, arg.literal.value);
      }
    },

    'CallExpression[callee.name="require"]': (node) => {
      const arg = node.arguments[0];
      if (arg && arg.type === 'Literal' && typeof arg.value === 'string') check(arg, arg.value);
    },
  };
}

/**
 * A package may import nothing outside itself. Applied to @ewa/core.
 *
 * Not "no npm dependencies" - *nothing*. No node builtin, no DOM, no sibling workspace
 * package, no relative path that climbs out of the package directory. The client and the
 * server import core from source and must therefore compile the identical bytes; the moment
 * core needs a platform, one of the two sides gets a different build and the shared
 * simulation that client prediction rests on is gone.
 */
const noExternalImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid any import that leaves the package (used for @ewa/core).' },
    schema: [
      {
        type: 'object',
        properties: { boundary: { type: 'string' } },
        required: ['boundary'],
        additionalProperties: false,
      },
    ],
    messages: {
      external:
        "'{{source}}' is outside {{boundary}}, which must import nothing at all - no npm package, no node builtin, no DOM, no other workspace package. The client and the server run these exact bytes, and that is the only reason client-side prediction agrees with the server. If you need this, add it to {{boundary}} as pure code.",
      escapes:
        "'{{source}}' resolves outside {{boundary}}, which must import nothing at all. A relative path that climbs out of the package is the same dependency as a bare import, just harder to see.",
    },
  },

  create(context) {
    const boundary = context.options[0].boundary;
    const boundaryAbs = path.resolve(context.cwd, boundary);
    const fileDir = path.dirname(path.resolve(context.cwd, context.filename));

    return specifierVisitor((node, source) => {
      if (source.startsWith('.')) {
        if (!isInside(boundaryAbs, path.resolve(fileDir, source))) {
          context.report({ node, messageId: 'escapes', data: { source, boundary } });
        }
        return;
      }
      context.report({ node, messageId: 'external', data: { source, boundary } });
    });
  },
};

/**
 * A relative import may not reach into a different workspace package.
 *
 * `../../protocol/src/codec.js` compiles, and it quietly bypasses the package's public
 * surface, its declared dependencies, and the client's Vite aliases - so the same code
 * resolves differently under vitest, under vite, and under tsc. Cross-package imports go
 * through the package name, which is the one spelling all three agree on.
 *
 * Escapes that land outside `packages/` are fine and are used on purpose: the client
 * imports `config/*.json` from the repo root so Vite bundles the shipped tuning.
 */
const noCrossPackageRelativeImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid relative imports that reach into another workspace package.' },
    schema: [],
    messages: {
      crossPackage:
        "'{{source}}' reaches into @ewa/{{other}} by relative path. Import from '@ewa/{{other}}' instead: the package name is what pnpm, tsc, vite and vitest all resolve the same way, and a deep relative path bypasses the package's public surface.",
    },
  },

  create(context) {
    const file = slashes(path.resolve(context.cwd, context.filename));
    const own = /(^|\/)packages\/([^/]+)\//.exec(file);
    if (!own) return {};

    const packagesDir = slashes(path.resolve(context.cwd, 'packages'));
    const ownName = own[2];
    const fileDir = path.dirname(file);

    return specifierVisitor((node, source) => {
      if (!source.startsWith('.')) return;
      const target = slashes(path.resolve(fileDir, source));
      if (!isInside(packagesDir, target)) return; // e.g. config/*.json at the repo root
      const other = slashes(path.relative(packagesDir, target)).split('/')[0];
      if (other && other !== ownName) {
        context.report({ node, messageId: 'crossPackage', data: { source, other } });
      }
    });
  },
};

const OBJECT_KEY_READERS = new Set(['keys', 'values', 'entries', 'getOwnPropertyNames']);

/** `Object.keys(x).length` counts; it cannot depend on the order. `.sort()` fixes the order. */
const ORDER_SAFE_CONSUMERS = new Set(['length', 'sort']);

/**
 * Iteration order that could differ between two machines is banned in the simulation.
 *
 * The config maps are assembled by platform-specific loaders - a filesystem scan on the
 * server, a static manifest in the browser - so their key insertion order is genuinely not
 * the same on the two sides. Anything derived from that order (a hash, an index into a
 * compiled array, the order two contacts resolve in) differs too, and a divergence that
 * depends on which side loaded the config is about the worst desync there is to debug:
 * it reproduces only in the combination nobody tests.
 *
 * `for...in` is banned outright rather than sorted, because it also walks the prototype
 * chain. Sorted key reads are allowed: `Object.keys(x).sort()` is exactly the fix.
 */
const noUnorderedIteration = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid iteration whose order could differ between two runs.' },
    schema: [],
    messages: {
      forIn:
        'for...in walks keys in an order that is not guaranteed across engines and includes inherited keys. Iterate a typed array, a Map, or Object.keys(x).sort().',
      unordered:
        'Object.{{method}}() here is order-dependent. The config maps are built by platform-specific loaders, so the client and the server do not see the same key order - add .sort() so both sides agree.',
    },
  },

  create(context) {
    return {
      ForInStatement(node) {
        context.report({ node, messageId: 'forIn' });
      },

      'CallExpression[callee.type="MemberExpression"]'(node) {
        const callee = node.callee;
        if (callee.computed) return;
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'Object') return;
        if (callee.property.type !== 'Identifier') return;
        const method = callee.property.name;
        if (!OBJECT_KEY_READERS.has(method)) return;

        const parent = node.parent;
        const consumed =
          parent &&
          parent.type === 'MemberExpression' &&
          parent.object === node &&
          !parent.computed &&
          parent.property.type === 'Identifier' &&
          ORDER_SAFE_CONSUMERS.has(parent.property.name);
        if (consumed) return;

        context.report({ node, messageId: 'unordered', data: { method } });
      },
    };
  },
};

/** True for `x.style` (non-computed), the object every inline-style write goes through. */
function isStyleMember(node) {
  return (
    node &&
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'style'
  );
}

/**
 * The client has one design system (SPEC §20.2.1, §50.1 #14): tokens compiled to CSS custom properties,
 * consumed by CSS Modules. An inline style is a value that bypasses the token set and the reduced-motion /
 * UI-scale / colourblind switches that live on :root, so it is banned outright.
 *
 * The single exception is `style={cssVars({ '--hp': 0.42 })}`: dynamic numbers (HP width, progress) reach
 * module CSS as custom properties, and `cssVars` (src/ui/cssVars.ts) only accepts `--` keys. The rule
 * checks the callee name and, when the argument is an object literal, that every key starts with `--`.
 *
 * Reported: any JSX `style` attribute not written as `cssVars(...)`; any assignment through `x.style`
 * (`el.style.cssText = …`, `el.style.width = …`, `el.style = …`); `el.setAttribute('style', …)`;
 * `Object.assign(el.style, …)`. `style.setProperty('--ui-scale', v)` is not an assignment and stays
 * legal for the one programmatic write the spec allows (applySettings.ts).
 */
const noInlineStyle = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid inline styles in the client; dynamic values go through cssVars() custom properties.' },
    schema: [],
    messages: {
      jsxStyle:
        "Inline `style` bypasses the one token set (SPEC §20.2.1). Put the rule in the component's .module.css; pass a dynamic number as a custom property with style={cssVars({ '--x': value })}.",
      cssVarsKey:
        "cssVars() only carries custom properties: key '{{key}}' must start with '--' and be consumed by module CSS.",
      domStyle:
        'Writing element styles from script bypasses the design system (SPEC §20.2.1). Toggle a class or data-attribute, or set a custom property via cssVars().',
    },
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        const value = node.value;
        const expr = value && value.type === 'JSXExpressionContainer' ? value.expression : null;
        const isCssVars =
          expr && expr.type === 'CallExpression' && expr.callee.type === 'Identifier' && expr.callee.name === 'cssVars';
        if (!isCssVars) {
          context.report({ node, messageId: 'jsxStyle' });
          return;
        }
        const arg = expr.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          for (const prop of arg.properties) {
            if (prop.type !== 'Property') continue;
            const key =
              prop.key.type === 'Literal' ? String(prop.key.value) : prop.key.type === 'Identifier' && !prop.computed ? prop.key.name : null;
            if (key !== null && !key.startsWith('--')) context.report({ node: prop, messageId: 'cssVarsKey', data: { key } });
          }
        }
      },

      AssignmentExpression(node) {
        const left = node.left;
        if (left.type !== 'MemberExpression') return;
        // el.style = …  or  el.style.anything = …
        if (isStyleMember(left) || isStyleMember(left.object)) context.report({ node, messageId: 'domStyle' });
      },

      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return;
        const method = callee.property.name;
        const first = node.arguments[0];
        if (method === 'setAttribute' && first && first.type === 'Literal' && String(first.value).toLowerCase() === 'style') {
          context.report({ node, messageId: 'domStyle' });
        }
        if (
          method === 'assign' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Object' &&
          first &&
          isStyleMember(first)
        ) {
          context.report({ node, messageId: 'domStyle' });
        }
      },
    };
  },
};

/** @type {{ rules: Record<string, unknown> }} */
export default {
  rules: {
    'no-external-imports': noExternalImports,
    'no-cross-package-relative-imports': noCrossPackageRelativeImports,
    'no-unordered-iteration': noUnorderedIteration,
    'no-inline-style': noInlineStyle,
  },
};
