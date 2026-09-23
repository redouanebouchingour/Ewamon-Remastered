/**
 * The single exception to `ewa/no-inline-style` (SPEC §20.2.1): dynamic values reach module CSS as
 * custom properties. Only `--` keys are accepted (typed here, re-checked by the lint rule).
 *
 *   <div className={s.fill} style={cssVars({ '--hp': 0.42 })} />   // .fill { inline-size: calc(var(--hp) * 100%) }
 */
import type { CSSProperties } from 'react';

export type CssVarName = `--${string}`;
export type CssVarMap = Readonly<Partial<Record<CssVarName, string | number>>>;

export function cssVars(vars: CssVarMap): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const key of Object.keys(vars) as CssVarName[]) {
    if (!key.startsWith('--')) throw new RangeError(`cssVars: '${key}' is not a custom property`);
    const v = vars[key];
    if (v !== undefined) out[key] = v;
  }
  return out as CSSProperties;
}
