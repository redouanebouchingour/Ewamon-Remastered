/**
 * §2.20 — canonical JSON and the battle-state digest.
 * Object keys sorted ascending by UTF-16 code units, arrays in order, no whitespace, numbers via
 * JSON.stringify. `undefined` properties are omitted (as JSON.stringify does); `undefined` array
 * elements become `null`.
 */
import { fnv1a32 } from './rng';
import type { BattleState } from './types';

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) parts.push(canonicalJson(value[i]));
    return '[' + parts.join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      const v = obj[k];
      if (v === undefined) continue;
      parts.push(JSON.stringify(k) + ':' + canonicalJson(v));
    }
    return '{' + parts.join(',') + '}';
  }
  // functions, symbols, bigint: not representable; treat as null so the digest never throws
  return 'null';
}

/** fnv1a32(canonicalJson(state)) as 8 lowercase hex chars. */
export function digestBattleState(state: BattleState): string {
  return fnv1a32(canonicalJson(state)).toString(16).padStart(8, '0');
}
