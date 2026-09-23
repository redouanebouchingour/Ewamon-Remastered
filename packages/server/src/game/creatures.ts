/**
 * Creature construction — the only place the server builds a CreatureInstance from content. Every number
 * comes from @ewa/core (calcMaxHp, expToLevel); the server never re-implements a formula.
 */
import { calcMaxHp, expToLevel, removeStatus } from '@ewa/core';
import type { ContentIndex, CreatureInstance, MoveSlot, SpeciesDef, VariantKey } from '@ewa/core';

export type NewCreature = Omit<CreatureInstance, 'id'>;

function slot(content: ContentIndex, id: string): MoveSlot {
  const pp = content.move(id).pp;
  return { id, pp, ppMax: pp };
}

/**
 * The species' moves at `level`: the last four distinct moves learnable at or below the level (newest last),
 * falling back to `species.moves` (the default 4 at creation) when the learnset yields none.
 */
export function movesAtLevel(content: ContentIndex, sp: SpeciesDef, level: number): MoveSlot[] {
  const seen: string[] = [];
  for (const e of sp.learnableMoves) {
    if (e.level > level) continue;
    const i = seen.indexOf(e.move);
    if (i !== -1) seen.splice(i, 1);
    seen.push(e.move);
  }
  const ids = seen.length > 0 ? seen.slice(-4) : sp.moves.slice(0, 4);
  return ids.map((id) => slot(content, id));
}

export interface CreatureOpts {
  readonly ownerId?: string | null;
  readonly ability?: string | null;
  readonly variantKey?: VariantKey;
  readonly isAlpha?: boolean;
  readonly heldItem?: string | null;
  readonly nickname?: string | null;
  readonly caughtAt?: { readonly zoneId: string; readonly at: number } | null;
  /** 'default' = species.moves (starters, §30.6.2); 'level' = movesAtLevel (wild/NPC projections, §30.4.4) */
  readonly moves?: 'default' | 'level';
}

/** A full-HP creature of `speciesId` at `level` (exp = expToLevel(level)). */
export function newCreature(content: ContentIndex, speciesId: string, level: number, o: CreatureOpts = {}): NewCreature {
  const sp = content.species(speciesId);
  const moves = o.moves === 'default' ? sp.moves.slice(0, 4).map((id) => slot(content, id)) : movesAtLevel(content, sp, level);
  const ability = o.ability ?? sp.abilities[0]!;
  return {
    ownerId: o.ownerId ?? null,
    speciesId,
    nickname: o.nickname ?? null,
    level,
    exp: expToLevel(level),
    hp: calcMaxHp(sp.baseHp, level),
    moves,
    status: [],
    ability: sp.abilities.includes(ability) ? ability : sp.abilities[0]!,
    heldItem: o.heldItem ?? null,
    variantKey: o.variantKey ?? 'normal',
    isAlpha: o.isAlpha ?? false,
    caughtAt: o.caughtAt ?? null,
    ribbons: [],
    favorite: false,
    locked: false,
  };
}

/** A projection that is never persisted (wild/NPC battlers): gets a synthetic, non-uuid id. */
export function withSyntheticId(c: NewCreature, id: string): CreatureInstance {
  return { ...c, id };
}

/** Real rows have uuid ids; wild/NPC projections use `wild:` / `npc:` prefixes. */
export function isPersistedId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** What persists after a battle: confusion is battle-volatile and stripped. */
export function persistableAfterBattle(c: CreatureInstance): CreatureInstance {
  return { ...c, status: removeStatus(c.status, 'confuse'), moves: c.moves.map((m) => ({ ...m })) };
}

/** Full heal (POST /heal): hp = maxHp, no status, pp = ppMax. */
export function healed(content: ContentIndex, c: CreatureInstance): CreatureInstance {
  const sp = content.species(c.speciesId);
  return { ...c, hp: calcMaxHp(sp.baseHp, c.level), status: [], moves: c.moves.map((m) => ({ ...m, pp: m.ppMax })) };
}
