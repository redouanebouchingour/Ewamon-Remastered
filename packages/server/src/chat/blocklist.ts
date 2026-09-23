/**
 * §30.6.5 BLOCKED_WORDS — data. Part 2 transcribes the legacy chatFilter.js list (20 entries, lowercase)
 * and the LEET_MAP; until then the list is empty and `censor`/`containsBlocked` are pass-throughs.
 */
export const BLOCKED_WORDS: readonly string[] = [];

export const LEET_MAP: Readonly<Record<string, string>> = { '3': 'e', '4': 'a', '0': 'o', '1': 'i', '@': 'a', $: 's', '!': 'i', '+': 't' };
