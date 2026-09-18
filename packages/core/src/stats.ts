/** §2.7 — stats and stages. Every stat multiplication is floor(value * num / den). */
import type { StatStage } from './types';

export function calcStat(base: number, level: number): number {
  return Math.floor((base * level) / 50) + level + 10;
}

export function calcMaxHp(base: number, level: number): number {
  return Math.floor((base * level) / 50) + level + 20;
}

/** atk/def/spd: s >= 0 ? (2 + s) / 2 : 2 / (2 - s). Returned as [num, den]. */
export function stageRatio(s: StatStage): readonly [number, number] {
  return s >= 0 ? [2 + s, 2] : [2, 2 - s];
}

/** acc/eva: s >= 0 ? (3 + s) / 3 : 3 / (3 - s), as [num, den]. Evasion is applied inverted by the caller. */
export function accStageRatio(s: StatStage): readonly [number, number] {
  return s >= 0 ? [3 + s, 3] : [3, 3 - s];
}

export function clampStage(n: number): StatStage {
  const t = Math.trunc(n);
  if (t < -6) return -6;
  if (t > 6) return 6;
  return t as StatStage;
}

/** floor(value * num / den) — the one stat-multiplication primitive. */
export function applyRatio(value: number, ratio: readonly [number, number]): number {
  return Math.floor((value * ratio[0]) / ratio[1]);
}

/**
 * Turn a decimal multiplier stored in content (1.25, 1.5, 0.5, 1.2, 1.1, 0.125, 0.3333, 0.75…) into an
 * exact small-denominator ratio so `floor(x * num / den)` is integer arithmetic. Denominators up to 16
 * are tried with a loose tolerance (content stores 0.3333 for 1/3); otherwise the decimal is taken to
 * 1/10000. Deterministic for a given input.
 */
export function ratioOf(mul: number): readonly [number, number] {
  for (let den = 1; den <= 16; den++) {
    const num = mul * den;
    const r = Math.round(num);
    if (Math.abs(num - r) < 5e-4) return [r, den];
  }
  return [Math.round(mul * 10000), 10000];
}

/** floor(value * mul) via the exact ratio of `mul`. */
export function mulFloor(value: number, mul: number): number {
  return applyRatio(value, ratioOf(mul));
}
