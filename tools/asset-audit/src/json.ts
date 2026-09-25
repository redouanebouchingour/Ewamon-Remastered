/** SPEC §40.0.2 rule 1: object keys sorted, 2-space indent, trailing LF. */
export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = sortKeys(o[k]);
    return out;
  }
  return v;
}

export function stableJson(v: unknown): string {
  return `${JSON.stringify(sortKeys(v), null, 2)}\n`;
}
