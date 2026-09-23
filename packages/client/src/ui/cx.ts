/** Joins class names, dropping falsy entries: cx(s.button, busy && s.busy, className). */
export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  let out = '';
  for (const p of parts) {
    if (p) out = out.length === 0 ? p : `${out} ${p}`;
  }
  return out;
}
