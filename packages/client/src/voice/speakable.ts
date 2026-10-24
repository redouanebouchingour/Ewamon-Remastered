/**
 * Voice talk (LLM feature 10): what the speech synthesis may say, and where a streaming reply's sentences end.
 *
 * - `speakable` tidies a line for the ear: the dash sanitizer (`noDashes`), then bracketed notes (`[smiles]`,
 *   `(laughs)`, `{...}`, `<...>`, `*waves*`), emoji, markdown marks and links go; whitespace collapses. A line with no
 *   letter or digit left (a lone "…") says nothing.
 * - `cleanStream` is the same tidying for a reply still streaming in: an unclosed bracket at the end is dropped too,
 *   so the text grows by its end only (the part already spoken never shifts when the bracket closes later).
 * - `nextSentences` finds the sentences complete since `offset`: a full stop, "!", "?" or "…" (with any closing quote)
 *   followed by a space or a line break, or a line break alone. An abbreviation ("Prof.", "Mr.", "Lv.") or an initial
 *   does not end a sentence, nor does a decimal point. A run of over `LONG_RUN` characters without an end is cut at its
 *   last comma, semicolon or colon (the browser's voice stalls on very long utterances). `final`: the rest is a
 *   sentence too.
 */
import { noDashes } from '../talk/llm';

/** a run this long without a sentence end is cut at a comma */
export const LONG_RUN = 180;

const ABBREV = /(?:^|[\s"'“‘(])(?:mr|mrs|ms|dr|st|prof|vs|etc|lv|no|mt|jr|sr|e\.g|i\.e)\.$/i;
const INITIAL = /(?:^|\s)[A-Z]\.$/;

function strip(text: string, open: boolean): string {
  let t = noDashes(text)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*[^*\n]*\*/g, ' ');
  // a reply still streaming: an aside not closed yet is not said (it is dropped whole once it closes)
  if (open) t = t.replace(/[[({<*][^\])}>*]*$/, ' ');
  return t
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\u200d|\ufe0f/g, '')
    .replace(/[*_#`~|^\])}>]+/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** A line as the voice says it ('' when nothing is left to say). */
export function speakable(text: string): string {
  const t = strip(text, false)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?…:;])/g, '$1')
    .trim();
  return /[\p{L}\p{N}]/u.test(t) ? t : '';
}

/** A streaming reply tidied for the ear; it only ever grows at its end while the reply grows. */
export function cleanStream(text: string): string {
  return strip(text, true);
}

const END = /[.!?…]+["'”’]*(?=\s)|\n+/g;

/** Where the sentences complete after `offset` end, and the new offset. */
export function nextSentences(text: string, offset: number, final = false): { readonly sentences: readonly string[]; readonly offset: number } {
  const sentences: string[] = [];
  let start = offset;
  END.lastIndex = offset;
  for (let m = END.exec(text); m !== null; m = END.exec(text)) {
    const end = m.index + m[0].length;
    const piece = text.slice(start, end);
    if (m[0][0] !== '\n' && (ABBREV.test(piece.trimEnd()) || INITIAL.test(piece.trimEnd()))) continue;
    sentences.push(piece);
    start = end;
  }
  // a long run with no end yet: cut at its last pause
  while (!final && text.length - start > LONG_RUN) {
    const run = text.slice(start);
    const cut = Math.max(run.lastIndexOf(', '), run.lastIndexOf('; '), run.lastIndexOf(': '));
    if (cut < 40) break;
    sentences.push(run.slice(0, cut + 1));
    start += cut + 2;
  }
  if (final && start < text.length) {
    sentences.push(text.slice(start));
    start = text.length;
  }
  return { sentences: sentences.map(speakable).filter((s) => s !== ''), offset: start };
}

/** A whole line as sentences (a line that is already complete: the buddy's, the rival's, the commentator's). */
export function sentencesOf(text: string): readonly string[] {
  return nextSentences(cleanStream(text), 0, true).sentences;
}
