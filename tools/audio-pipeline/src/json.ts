/** SPEC §40.0.2 rule 1: object keys sorted, 2-space indent, trailing LF. Arrays keep their order (callers sort by id). */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

/** Pretty, sorted, LF-terminated. */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

/** Compact, sorted — the canonical form hashed into `requestHash`. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, stableStringify(value));
}

export function sha256Hex(...parts: (string | Uint8Array)[]): string {
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(p);
    h.update('\u0000');
  }
  return h.digest('hex');
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A deterministic uint32 from a string (first 4 bytes of sha256). Used to author seeds. */
export function seedFor(id: string): number {
  return createHash('sha256').update(id).digest().readUInt32BE(0);
}
