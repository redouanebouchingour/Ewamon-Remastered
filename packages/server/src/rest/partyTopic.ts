/**
 * Followers (SPEC §3.18): the bus topic a REST route publishes when it changed a player's party (order, hp, species,
 * members). The zone room holding the player re-reads the party so the lead walking behind them (`PlayerState.lead`)
 * and its field powers follow.
 */
export const PARTY_TOPIC = 'ewa:party';

/** The REST routes that can change who leads the party (POST, a 2xx answer). */
const PARTY_ROUTES: readonly RegExp[] = [
  /^\/party\//,
  /^\/creature\/[^/]+\/(evolve|release|nickname|setup)$/,
  /^\/item\/use$/,
  /^\/heal$/,
  /^\/daycare\/(leave|take|collect)$/,
  /^\/battle-pass\/(claim|mythical-choice)$/,
  /^\/market\//,
];

/** Whether a POST to this route path (the route pattern, or the url without its query) may have changed the party. */
export function changesParty(path: string): boolean {
  const p = path.split('?')[0] ?? path;
  return PARTY_ROUTES.some((r) => r.test(p));
}
