/**
 * Breeding: carried eggs count the steps the player walks (content daycare.ts). The zone room feeds every accepted
 * move's distance here (metres = steps); the walked metres are written every `EGG_FLUSH_M` and when the player leaves
 * the room, and an egg that has walked its total hatches at once: the hatchling joins the party while it has room
 * (else the box), its history starts `hatched`, the Dex marks it caught, and the client gets the `inventoryDelta`, the
 * `progressionDelta` and then `eggHatched` (the reveal).
 *
 * While a challenge run is active the eggs count nothing (daycare routes). Only players who carry eggs have an entry,
 * so everyone else costs one map lookup per move.
 */
import { challengeActive } from '@ewa/content';
import type { ContentIndex } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { eggParents, hatchling } from '../game/breeding';
import { progressionOnly, toInstance } from './battleSession';

/** Walked metres are written at least this often (and on leaving the room). */
export const EGG_FLUSH_M = 20;

interface Carry {
  /** metres each carried egg still has to walk (as the room counts them) */
  eggs: { readonly id: string; left: number }[];
  /** metres walked and not yet written */
  pending: number;
  busy: boolean;
}

export interface EggWalkDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly content: ContentIndex;
  readonly clock: () => number;
  readonly log: { warn(o: object, m: string): void; error(o: object, m: string): void };
  readonly send: (playerId: string, msg: ServerMessage) => void;
}

export class EggWalker {
  private readonly by = new Map<string, Carry>();

  constructor(private readonly deps: EggWalkDeps) {}

  /** True when the player carries an egg this room counts for. */
  carries(playerId: string): boolean {
    return (this.by.get(playerId)?.eggs.length ?? 0) > 0;
  }

  /** Reads the player's carried eggs (on joining the room, and after `ewa:eggs`); hatches any that are due. */
  async load(playerId: string): Promise<void> {
    const { repos } = this.deps;
    const eggs = await repos.db.transaction((tx) => repos.breeding.addSteps(tx, playerId, 0));
    if (eggs.length === 0) {
      this.by.delete(playerId);
      return;
    }
    const prev = this.by.get(playerId);
    this.by.set(playerId, { eggs: eggs.map((e) => ({ id: e.id, left: e.stepsTotal - e.stepsWalked })), pending: prev?.pending ?? 0, busy: prev?.busy ?? false });
    if (eggs.some((e) => e.stepsWalked >= e.stepsTotal)) await this.flush(playerId);
  }

  /** An accepted move of `dist` metres. `flags`: the player's flags (a challenge run counts nothing). */
  step(playerId: string, dist: number, flags: ReadonlySet<string>): void {
    const c = this.by.get(playerId);
    if (c === undefined || c.eggs.length === 0 || !(dist > 0)) return;
    if (challengeActive(flags) !== null) return;
    c.pending += dist;
    let due = false;
    for (const e of c.eggs) {
      e.left -= dist;
      if (e.left <= 0) due = true;
    }
    if (!c.busy && (due || c.pending >= EGG_FLUSH_M)) void this.flush(playerId);
  }

  /** Writes the walked metres and hatches every egg that has walked its total. */
  async flush(playerId: string): Promise<void> {
    const c = this.by.get(playerId);
    if (c === undefined || c.busy) return;
    c.busy = true;
    try {
      const { repos } = this.deps;
      const whole = Math.floor(c.pending);
      c.pending -= whole;
      const eggs = await repos.db.transaction((tx) => repos.breeding.addSteps(tx, playerId, whole));
      for (const e of eggs.filter((x) => x.stepsWalked >= x.stepsTotal)) await this.hatch(playerId, e.id);
      const left = await repos.db.transaction((tx) => repos.breeding.addSteps(tx, playerId, 0));
      c.eggs = left.map((e) => ({ id: e.id, left: e.stepsTotal - e.stepsWalked - c.pending }));
    } catch (e) {
      this.deps.log.error({ err: e, playerId }, 'egg steps write failed');
    } finally {
      c.busy = false;
    }
  }

  /** Flushes and forgets the player (they left the room). */
  async drop(playerId: string): Promise<void> {
    await this.flush(playerId);
    this.by.delete(playerId);
  }

  private async hatch(playerId: string, eggId: string): Promise<void> {
    const { repos, content, clock, send } = this.deps;
    const now = new Date(clock());
    const r = await repos.db.transaction(async (tx) => {
      const owner = await repos.players.lock(tx, playerId);
      const egg = await repos.breeding.takeHatched(tx, playerId, eggId);
      if (egg === null) return null;
      const used = new Set((await repos.creatures.byOwner(tx, playerId)).filter((x) => x.slotKind === 'party').map((x) => x.slotIndex));
      let free = -1;
      for (let i = 0; i < 6 && free === -1; i++) if (!used.has(i)) free = i;
      const parents = eggParents(content, egg);
      const born = await repos.creatures.insert(tx, hatchling(content, egg), free === -1 ? { kind: 'box', index: 'nextBox' } : { kind: 'party', index: free }, {
        kind: 'hatched',
        speciesId: egg.speciesId,
        zoneId: egg.zoneId,
        parents,
        trainer: owner.username,
      });
      await repos.progress.markCaught(tx, playerId, born.speciesId, born.variantKey, born.isAlpha, now, born.isShiny === true);
      return { creature: toInstance(born), placement: free === -1 ? ('box' as const) : ('party' as const), parents, zoneId: egg.zoneId };
    });
    if (r === null) return;
    send(playerId, { type: 'inventoryDelta', items: {}, money: null, creaturesAdded: [r.creature], creaturesRemoved: [], creaturesUpdated: [], placement: { [r.creature.id]: r.placement } });
    send(playerId, progressionOnly({ dexSeen: [r.creature.speciesId], dexCaught: [r.creature.speciesId] }));
    send(playerId, { type: 'eggHatched', eggId, creature: r.creature, placement: r.placement, parents: r.parents, zoneId: r.zoneId });
  }
}
