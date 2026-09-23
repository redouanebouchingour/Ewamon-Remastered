/**
 * §30.6.5 chat hygiene — part 1 ships `sanitizeChat` (used by the room's AOI chat) and the `censor` /
 * `containsBlocked` seam. The legacy BLOCKED_WORDS list (chatFilter.js) is not in `.design/legacy/`; part 2
 * fills `blocklist.ts` and the leet/whole-word matcher (IMPLEMENTATION-NOTES "part 2 seams").
 *
 * No RegExp is ever built from user input: the only patterns here are constants.
 */
import { BLOCKED_WORDS } from './blocklist';

/** C0/C1 controls + zero-width characters (U+200B..U+200F, U+2060, U+FEFF). */
/** True for C0/C1 controls and the zero-width set — code points, so no control characters live in this source. */
function isStripped(c: number): boolean {
  return c <= 0x1f || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || c === 0x2060 || c === 0xfeff;
}

function stripControls(s: string): string {
  let out = '';
  for (const ch of s) if (!isStripped(ch.codePointAt(0)!)) out += ch;
  return out;
}
const WS_RE = /\s+/g;

export const CHAT_MAX = 120;
export const DM_MAX = 300;

/** Strip controls + zero-width; collapse whitespace runs to one space; trim; null when empty or > max. */
export function sanitizeChat(s: string, max: number = CHAT_MAX): string | null {
  const out = stripControls(s).replace(WS_RE, ' ').trim();
  if (out.length === 0 || out.length > max) return null;
  return out;
}

/** true when the text contains a blocked word (part 2: leet normalisation + whole-word patterns). */
export function containsBlocked(s: string): boolean {
  if (BLOCKED_WORDS.length === 0) return false;
  const lower = s.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.split(/[^a-z0-9]+/).includes(w));
}

/** Soft censor: each blocked whole word replaced by '*' × its length (part 2 extends to leet forms). */
export function censor(s: string): string {
  if (BLOCKED_WORDS.length === 0) return s;
  const blocked = new Set(BLOCKED_WORDS);
  return s.replace(/[A-Za-z0-9]+/g, (w) => (blocked.has(w.toLowerCase()) ? '*'.repeat(w.length) : w));
}
