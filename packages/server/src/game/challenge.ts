/**
 * Challenge modes on the server (content challenge.ts holds the rules and flags): Hardcore's bag, and the refusal every
 * route that would bring a fallen creature back into play answers with.
 */
import { FALLEN_MEMORIAL_RIBBON, FALLEN_RIBBON, isFallen } from '@ewa/content';
import type { ContentIndex, CreatureInstance } from '@ewa/core';
import type { CreatureRecord, Db, Repos, Tx } from '@ewa/persist';
import { HttpError } from '../rest/http';

/** Hardcore's battle bag: the orbs alone (a bag item is refused as `noItem`; orbs still catch). */
export function orbsOnly(inventory: Readonly<Record<string, number>>, content: ContentIndex): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(inventory)) {
    try {
      content.orb(id);
      out[id] = n;
    } catch (_e) {
      // not an orb
    }
  }
  return out;
}

/** 409 `fallen` for a creature that has fallen in a challenge run. */
export function refuseFallen(c: { readonly ribbons: readonly string[] }): void {
  if (isFallen(c)) throw new HttpError(409, 'fallen');
}

/**
 * The end of a run that has nothing left: when every party, box and Daycare creature has fallen, the run fails and the fallen
 * keep a memorial ribbon instead (no rule reads it), so the account plays on as normal. Returns the creatures it
 * rewrote (empty when the run goes on). The caller sets `CHALLENGE_FAILED_FLAG`.
 */
export async function failIfNothingLeft(tx: Tx, repos: Repos & { readonly db: Db }, playerId: string): Promise<CreatureInstance[] | null> {
  // breeding: a creature left at the Daycare is still the player's (it comes back with `POST /daycare/take`)
  const mine = (await repos.creatures.byOwner(tx, playerId)).filter((r) => r.slotKind === 'party' || r.slotKind === 'box' || r.slotKind === 'daycare');
  if (mine.length === 0 || !mine.every((r) => isFallen(r))) return null;
  const out: CreatureInstance[] = [];
  for (const r of mine) {
    const mourned: CreatureInstance = { ...instanceOf(r), ribbons: [...r.ribbons.filter((x) => x !== FALLEN_RIBBON), FALLEN_MEMORIAL_RIBBON] };
    await repos.creatures.update(tx, mourned);
    out.push(mourned);
  }
  return out;
}

/** A record without its slot fields. */
function instanceOf(r: CreatureRecord): CreatureInstance {
  const { slotKind: _k, slotIndex: _i, version: _v, ...c } = r;
  return c as CreatureInstance;
}
