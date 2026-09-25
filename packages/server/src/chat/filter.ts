/**
 * §30.6.5 chat filter — the legacy approach as data. `BLOCKED_WORDS` (chat/blocklist.ts) compiled once at module
 * load into whole-word patterns that allow `[\W_]*` between letters, matched over `normalizeLeet(text)`.
 *
 * - overworld chat: `sanitizeChat` → `censor` (soft: each match replaced in the ORIGINAL string by `*` × its length)
 * - DMs: `containsBlocked` → hard reject (400 `blockedWord`)
 *
 * Pure, no I/O (NON-NEGOTIABLE 12). No RegExp is ever built from user input: the only patterns are compiled from
 * the constant blocklist.
 */
import { BLOCKED_WORDS, LEET_MAP } from './blocklist';

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

/** Strip C0/C1 controls + zero-width; collapse whitespace runs to one space; trim; null when empty or > max. */
export function sanitizeChat(s: string, max: number = CHAT_MAX): string | null {
  const out = stripControls(s).replace(WS_RE, ' ').trim();
  if (out.length === 0 || out.length > max) return null;
  return out;
}

/** The normalised text plus, for every normalised code unit, the original [start, end) it came from. */
interface Normalized {
  readonly text: string;
  readonly start: readonly number[];
  readonly end: readonly number[];
}

function normalizeMapped(s: string): Normalized {
  // pass 1: per original code point → lowercase → LEET_MAP per code unit
  const chars: string[] = [];
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of s) {
    const from = i;
    i += ch.length;
    for (const lc of ch.toLowerCase()) {
      for (let k = 0; k < lc.length; k++) {
        const u = lc[k]!;
        chars.push(LEET_MAP[u] ?? u);
        start.push(from);
        end.push(i);
      }
    }
  }
  // pass 2: 'ph' → 'f' (legacy order: after the per-character map)
  const outChars: string[] = [];
  const outStart: number[] = [];
  const outEnd: number[] = [];
  for (let k = 0; k < chars.length; k++) {
    if (chars[k] === 'p' && chars[k + 1] === 'h') {
      outChars.push('f');
      outStart.push(start[k]!);
      outEnd.push(end[k + 1]!);
      k++;
      continue;
    }
    outChars.push(chars[k]!);
    outStart.push(start[k]!);
    outEnd.push(end[k]!);
  }
  return { text: outChars.join(''), start: outStart, end: outEnd };
}

/** lowercase; LEET_MAP per character; then 'ph' → 'f' (the legacy normalizeLeet). */
export function normalizeLeet(s: string): string {
  return normalizeMapped(s).text;
}

function escapeForPattern(ch: string): string {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

/** One pattern per blocked word: `\b` + letters joined by `[\W_]*` + `\b`, compiled once from the constant list. */
const SOURCES: readonly string[] = BLOCKED_WORDS.map((w) => `\\b${[...w].map(escapeForPattern).join('[\\W_]*')}\\b`);
const TEST_PATTERNS: readonly RegExp[] = SOURCES.map((src) => new RegExp(src, 'i'));
const SCAN_PATTERNS: readonly RegExp[] = SOURCES.map((src) => new RegExp(src, 'gi'));

/** Whole-word match allowing [\W_]* between letters, over normalizeLeet(s). */
export function containsBlocked(s: string): boolean {
  if (TEST_PATTERNS.length === 0) return false;
  const text = normalizeLeet(s);
  return TEST_PATTERNS.some((p) => p.test(text));
}

/** Soft censor: each match (found on the normalised text) replaced in the ORIGINAL string with '*' × its length. */
export function censor(s: string): string {
  if (SCAN_PATTERNS.length === 0) return s;
  const n = normalizeMapped(s);
  const masked = new Uint8Array(s.length);
  let any = false;
  for (const p of SCAN_PATTERNS) {
    p.lastIndex = 0;
    for (let m = p.exec(n.text); m !== null; m = p.exec(n.text)) {
      if (m[0].length === 0) {
        p.lastIndex++;
        continue;
      }
      const a = n.start[m.index]!;
      const b = n.end[m.index + m[0].length - 1]!;
      for (let k = a; k < b; k++) masked[k] = 1;
      any = true;
    }
  }
  if (!any) return s;
  let out = '';
  for (let k = 0; k < s.length; k++) out += masked[k] === 1 ? '*' : s[k]!;
  return out;
}
