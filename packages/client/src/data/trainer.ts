/**
 * Phase C4 display lookups for trainer identity: rank tiers (core `RANK_TIERS`), the body choices (content `BODIES`)
 * and the titles (content `TITLES`) `POST /profile` accepts. Display only — the server validates every choice.
 */
import { BODIES, TITLES } from '@ewa/content';
import { RANK_TIERS } from '@ewa/core';

export { TITLES };

export function tierLabel(key: string): string {
  return RANK_TIERS.find((t) => t.key === key)?.label ?? key;
}

export interface BodyChoice {
  readonly id: string;
  readonly label: string;
}

/** "Ranger (f)" — content gives masculine / feminine looks the same name, the id suffix tells them apart. */
export const BODY_CHOICES: readonly BodyChoice[] = BODIES.map((b) => ({
  id: b.id,
  label: b.id.endsWith('_f') ? `${b.name} (f)` : b.id.endsWith('_m') ? `${b.name} (m)` : b.name,
}));

export function bodyLabel(id: string): string {
  return BODY_CHOICES.find((b) => b.id === id)?.label ?? id;
}

export function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
