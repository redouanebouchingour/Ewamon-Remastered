/**
 * §30.6.5 BLOCKED_WORDS — the legacy `backend/src/utils/chatFilter.js` list, verbatim, as data (lowercase).
 *
 * The spec says "20 entries"; the legacy file has 19 (transcribed from the legacy repository, not re-invented —
 * IMPLEMENTATION-NOTES part 2, Q1). Adding a word is a data change: `filter.ts` compiles one whole-word pattern
 * per entry at module load, and `filter.test.ts` asserts the leet / separator / boundary behaviour.
 */
export const BLOCKED_WORDS: readonly string[] = [
  'fuck',
  'shit',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'asshole',
  'bitch',
  'bastard',
  'whore',
  'slut',
  'retard',
  'kike',
  'spic',
  'chink',
  'gook',
  'tranny',
  'dyke',
];

/** Legacy normalizeLeet substitutions (per character), applied after lowercasing; then 'ph' → 'f'. */
export const LEET_MAP: Readonly<Record<string, string>> = { '3': 'e', '4': 'a', '0': 'o', '1': 'i', '@': 'a', $: 's', '!': 'i', '+': 't' };
