/** Escapes `\`, `%` and `_` for LIKE/ILIKE. Callers add their own wildcards. Postgres' default escape is `\`. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Ascending uuid order — every multi-row lock in persist takes rows in this order to avoid deadlocks. */
export function sortIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

export function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
