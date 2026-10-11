/**
 * §50.1 #14 + §50.4.7 design-system.test: one token set (generated files current, custom properties only in
 * tokens.css), no font-size outside --t-* and none below 12 px, body 14 px, spacing only from --s-*, every
 * --motion-* ≤ 400 ms and 0 ms under [data-reduced="1"], contrast ratios of §20.2.2, colourblind ΔE of §20.8.3,
 * typeColors.default equal to the 10-render.md §10.4.6 table, no inline style except cssVars, and useBlocker only
 * in BattleOverlay / TradeModal (legacy audit Q31).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TYPE_NAMES } from '@ewa/core';
import {
  buildCss,
  buildTs,
  colorblindViolations,
  contrast,
  customPropertyViolations,
  fontSizeViolations,
  spacingViolations,
} from '../src/ui/gen-tokens';
import type { SourceFile, TokenSource } from '../src/ui/gen-tokens';
import { TYPE_ICON_PATHS } from '../src/ui/typeIcons';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const tokens = JSON.parse(readFileSync(join(src, 'ui', 'tokens.json'), 'utf8')) as TokenSource;

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}
const read = (p: string): SourceFile => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') });
const cssFiles = walk(src, /\.css$/).map(read);
const moduleCss = cssFiles.filter((f) => !f.path.endsWith('/tokens.css'));
const tsxFiles = walk(src, /\.(ts|tsx)$/).map(read);

/** 10-render.md §10.4.6 typeColors.ts (the legacy TYPE_COLORS), in TYPE_NAMES order. */
const RENDER_TYPE_COLORS = {
  Normal: '#a8a290', Fire: '#ee6f4a', Water: '#4aa3d6', Grass: '#6fae5a', Electric: '#f4cf3f', Ice: '#8fd6e8', Fighting: '#c0492f',
  Poison: '#9a5bb0', Ground: '#c9a24a', Flying: '#8aa6e0', Psychic: '#e06fa0', Bug: '#9aa83a', Rock: '#b09a6f', Ghost: '#6a5b9a',
  Dragon: '#6a52d0', Steel: '#9aa6b0', Fairy: '#f0a6d0', Dark: '#5b4b66', Cosmic: '#7be0d0',
};

describe('the one token set', () => {
  it('tokens.css and tokens.ts are exactly what tokens.json generates', () => {
    expect(readFileSync(join(src, 'ui', 'tokens.css'), 'utf8')).toBe(buildCss(tokens));
    expect(readFileSync(join(src, 'ui', 'tokens.ts'), 'utf8')).toBe(buildTs(tokens));
  });

  it('declares CSS custom properties nowhere but tokens.css', () => {
    expect(customPropertyViolations(cssFiles)).toEqual([]);
  });

  it('typeColors.default is the render table, in TYPE_NAMES order', () => {
    expect(Object.keys(tokens.typeColors.default)).toEqual([...TYPE_NAMES]);
    expect(tokens.typeColors.default).toEqual(RENDER_TYPE_COLORS);
    for (const mode of ['deuteranopia', 'protanopia', 'tritanopia'] as const) expect(Object.keys(tokens.typeColors[mode])).toEqual([...TYPE_NAMES]);
  });

  it('the type icons are the render table verbatim, one per type (Broadcast UI)', () => {
    expect(Object.keys(TYPE_ICON_PATHS)).toEqual([...TYPE_NAMES]);
    // render's copy, read as text (a test may not reach into another package by path)
    const renderSrc = readFileSync(join(root, '../render/src/hud/typeIcons.ts'), 'utf8');
    const renderIcons = Object.fromEntries([...renderSrc.matchAll(/^ {2}(\w+): '([^']+)',$/gm)].map((m) => [m[1], m[2]]));
    expect(TYPE_ICON_PATHS).toEqual(renderIcons);
    expect(new Set(Object.values(TYPE_ICON_PATHS)).size).toBe(TYPE_NAMES.length);
  });

  it('colourblind palettes keep adjacent types ≥ 40 ΔE apart under Machado 2009', () => {
    expect(colorblindViolations(tokens)).toEqual([]);
  });
});

describe('type', () => {
  it('12 px is the minimum anywhere, running text is 14 px', () => {
    const sizes = Object.values(tokens.type).map((t) => t.size);
    expect(Math.min(...sizes)).toBe(12);
    expect(tokens.type['t-caption']?.size).toBe(12);
    expect(tokens.type['t-body']?.size).toBe(14);
    expect(readFileSync(join(src, 'ui', 'global.css'), 'utf8')).toMatch(/body\s*{[^}]*font-size:\s*var\(--t-body\)/);
  });

  it('every font-size in every stylesheet is a --t-* token', () => {
    expect(fontSizeViolations(cssFiles)).toEqual([]);
  });

  it('no inline font sizes or px text in TSX', () => {
    const hits = tsxFiles.filter((f) => /fontSize\s*:/.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
});

describe('space and motion', () => {
  it('margin / padding / gap use --s-* tokens only', () => {
    expect(spacingViolations(moduleCss)).toEqual([]);
  });

  it('every --motion-* ≤ 400 ms and all are 0 ms under reduced motion', () => {
    for (const ms of Object.values(tokens.motion)) expect(ms).toBeLessThanOrEqual(400);
    const css = buildCss(tokens);
    const reduced = /:root\[data-reduced="1"\]\s*{([^}]*)}/.exec(css)?.[1] ?? '';
    for (const k of Object.keys(tokens.motion)) expect(reduced).toContain(`--${k}: 0ms;`);
  });
});

describe('contrast (§20.2.2)', () => {
  const c = tokens.color;
  it.each([
    ['text-hi', 'bg-1', 15],
    ['text-1', 'bg-1', 11],
    ['text-2', 'bg-1', 7.1],
    ['accent', 'bg-1', 5.7],
    ['on-accent', 'accent', 6.3],
  ] as const)('%s on %s ≥ %s:1 (rounded)', (fg, bg, min) => {
    expect(Number(contrast(c[fg]!, c[bg]!).toFixed(1))).toBeGreaterThanOrEqual(min);
  });
  it('text-2 clears the 4.5:1 floor on every surface it sits on', () => {
    for (const bg of ['bg-0', 'bg-1', 'bg-2']) expect(contrast(c['text-2']!, c[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('zero inline styles; blockers only where sanctioned', () => {
  it('every JSX style attribute is style={cssVars(…)}', () => {
    const bad: string[] = [];
    for (const f of tsxFiles) {
      for (const m of f.text.matchAll(/\sstyle=\{/g)) {
        const rest = f.text.slice((m.index ?? 0) + m[0].length);
        if (!/^\s*cssVars\(/.test(rest)) bad.push(`${f.path}: ${rest.slice(0, 40)}`);
      }
      if (/\.style\.cssText|setAttribute\(\s*['"]style['"]/.test(f.text)) bad.push(`${f.path}: DOM style write`);
    }
    expect(bad).toEqual([]);
  });

  it('useBlocker appears only in BattleOverlay and TradeModal', () => {
    const users = tsxFiles.filter((f) => /\buseBlocker\s*\(/.test(f.text)).map((f) => f.path.split('/').pop());
    for (const u of users) expect(['BattleOverlay.tsx', 'TradeModal.tsx']).toContain(u);
  });

  it('every ui component carries data-testid = its lowercase name', () => {
    const components = ['Button', 'Card', 'Panel', 'Tabs', 'Modal', 'Toast', 'HpBar', 'TypeBadge', 'CreatureCard', 'MoveButton', 'Slider', 'Toggle', 'Table'];
    for (const name of components) {
      const text = readFileSync(join(src, 'ui', `${name}.tsx`), 'utf8');
      expect(text.includes(`data-testid="${name.toLowerCase()}"`) || text.includes(`'data-testid': '${name.toLowerCase()}'`), name).toBe(true);
      expect(text, name).toContain('className');
    }
  });
});
