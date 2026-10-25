/**
 * Followers with field powers (content fieldPowers.ts, SPEC §3.18): the room-side helpers. The lead (the first party
 * creature still standing) walks behind its trainer (`PlayerState.lead` / `leadFlags`) and its types decide which
 * powers work: Flying glides (movement.ts), Fire burns brambles, Ground digs at camps, Psychic senses ghost trainers,
 * Water dives. Pure over the content tables and the room's ghost list; the room does the writes.
 */
import { FIELD_POWER_TEXT, FIELD_POWER_TYPE, HAUNT, fieldLead, fieldPowersOf, hauntPath, hauntPosition, leadLook } from '@ewa/content';
import type { FieldPower, PlanEllipse, ZoneId } from '@ewa/content';
import type { CreatureInstance, SpeciesDef } from '@ewa/core';
import { encodeLeadFlags } from '@ewa/protocol';
import type { FieldPowerAction, FieldPowerRefusal, SensedGhost } from '@ewa/protocol';
import type { Ghost } from '@ewa/persist';

/** The lead as the room keeps it: what walks behind the player and what it can do. */
export interface FieldLead {
  readonly speciesId: string;
  readonly types: readonly string[];
  /** `PlayerState.leadFlags` */
  readonly flags: number;
}

/**
 * The lead of a party (null: every creature fainted, or an unknown species). A held relic puts it in its form
 * (`leadLook`): the form's types give the powers and the form rides in `leadFlags`.
 */
export function fieldLeadOf(party: readonly CreatureInstance[], speciesOf: (speciesId: string) => SpeciesDef | null): FieldLead | null {
  const c = fieldLead(party);
  if (c === null) return null;
  const sp = speciesOf(c.speciesId);
  if (sp === null) return null;
  const look = leadLook(sp, c.heldItem);
  return { speciesId: c.speciesId, types: look.types, flags: encodeLeadFlags({ ...c, form: look.form }) };
}

/** The power an action uses. */
export const POWER_OF_ACTION: Readonly<Record<FieldPowerAction, FieldPower>> = Object.freeze({ burn: 'light', dig: 'dig', dive: 'dive', sense: 'sense' });

/** Whether the lead has the power an action needs. */
export function leadCan(lead: FieldLead | null, power: FieldPower): boolean {
  return lead !== null && fieldPowersOf(lead.types).includes(power);
}

/** The toast for a refusal (player copy: no em-dashes). */
export function fieldRefusalText(why: FieldPowerRefusal, action: FieldPowerAction): string {
  const power = POWER_OF_ACTION[action];
  switch (why) {
    case 'powersOff':
      return 'Nothing answers. Field powers are quiet on this server.';
    case 'noPower':
      return `${FIELD_POWER_TEXT[power].label} needs a ${FIELD_POWER_TYPE[power]}-type lead walking with you.`;
    case 'noSpot':
      return 'There is nothing to do that with here.';
    case 'spotFar':
      return action === 'dive' ? 'Swim out over the dark water first.' : 'Step closer first.';
    case 'burnt':
      return 'Only ash is left here.';
    case 'usedToday':
      return action === 'dig' ? 'Someone dug here today already. Come back tomorrow.' : 'The water is still churned up. Come back tomorrow.';
    case 'senseResting':
      return 'Your lead needs a moment before it can reach out again.';
    case 'powerIndoors':
      return 'Not indoors.';
  }
}

/** Where a ghost walks now in this zone (its haunt through the grass), or null when the zone has no grass. */
export function ghostAt(g: Pick<Ghost, 'playerId'>, zoneId: ZoneId, patches: readonly PlanEllipse[], nowMs: number): { readonly path: (readonly [number, number])[]; readonly at: readonly [number, number] } | null {
  const path = hauntPath(g.playerId, zoneId, patches);
  const at = hauntPosition(path, nowMs);
  return at === null ? null : { path, at };
}

/**
 * What a Psychic lead senses: this zone's ghosts (never the player's own) whose haunt passes within
 * `HAUNT.senseRangeM` now, and every wanted one wherever it walks, nearest first, at most 8.
 */
export function senseGhosts(
  ghosts: readonly Pick<Ghost, 'playerId' | 'name'>[],
  wanted: ReadonlySet<string>,
  selfId: string,
  zoneId: ZoneId,
  patches: readonly PlanEllipse[],
  x: number,
  z: number,
  nowMs: number,
): SensedGhost[] {
  const out: (SensedGhost & { readonly d: number })[] = [];
  for (const g of ghosts) {
    if (g.playerId === selfId) continue;
    const w = ghostAt(g, zoneId, patches, nowMs);
    if (w === null) continue;
    const d = Math.hypot(w.at[0] - x, w.at[1] - z);
    const isWanted = wanted.has(g.playerId);
    if (d > HAUNT.senseRangeM && !isWanted) continue;
    out.push({ name: g.name.slice(0, 32), wanted: isWanted, x: Math.round(w.at[0] * 10) / 10, z: Math.round(w.at[1] * 10) / 10, path: w.path, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, 8).map(({ d: _d, ...g }) => g);
}

/** The ghost whose haunt brings it within `HAUNT.nearM` of (x, z) now (nearest first), else null. */
export function hauntingNear<G extends Pick<Ghost, 'playerId'>>(ghosts: readonly G[], zoneId: ZoneId, patches: readonly PlanEllipse[], x: number, z: number, nowMs: number): G | null {
  let best: G | null = null;
  let bd: number = HAUNT.nearM;
  for (const g of ghosts) {
    const w = ghostAt(g, zoneId, patches, nowMs);
    if (w === null) continue;
    const d = Math.hypot(w.at[0] - x, w.at[1] - z);
    if (d <= bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}
