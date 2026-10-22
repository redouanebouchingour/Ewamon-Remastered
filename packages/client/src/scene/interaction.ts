/**
 * SPEC §20.4.7 — interaction targeting. Once per fixed step the nearest interactable within its range is kept:
 * NPC / trainer / tablet / pickup / building 2.5 u, spawn 1.2 u (players, 6 u, are resolved on `C` only). The HUD
 * prompt is written only when the nearest target id changes; each entry carries its prompt object, so a change is
 * a reference swap (no allocation on the step path). `E` → `activate()` (outside the tick).
 */
import type { HudPrompt } from './HudWriter';

export type InteractableKind = 'npc' | 'trainer' | 'item' | 'lore' | 'gym' | 'healer' | 'shop' | 'warp' | 'spawn' | 'switch' | 'pc' | 'static' | 'raid' | 'obstacle' | 'fish' | 'tower' | 'bramble' | 'dig' | 'dive' | 'camp';

/**
 * Client ranges stay inside the server's (3 m for npc / item / warp / switch, 4 m for a league trainer at its
 * `leaderAt`, Phase A): a prompt the client shows is one the server accepts. Shop / healer have no server range (the
 * interact is a no-op over the room); inside a hall they sit on the keeper / nurse behind the counter, 2.1 m from the
 * nearest walkable floor, hence 3 m.
 */
export const RANGE: Readonly<Record<InteractableKind, number>> = {
  npc: 2.5, trainer: 2.5, item: 2.5, lore: 2.5, gym: 3.5, healer: 3, shop: 3, warp: 2.5, spawn: 1.2, switch: 2.5, pc: 2.5,
  // Phase B1: a legendary static (server INTERACT_RANGE_M = 3 around its snapped point)
  static: 2.5,
  // Phase C1: a raid den (server RAID_JOIN_RANGE_M = 8 around the hotspot; raidJoin is checked there)
  raid: 8,
  // Phase D10: a Cut tree / Strength boulder (server OBSTACLE_INTERACT_M = 3 from its centre; the stamped disc is ≈ 1.1 m)
  obstacle: 2.6,
  // Phase D9: the cast point the director keeps on the water ahead of the player (server FISH_REACH_M = 2.5)
  fish: 2.6,
  // Phase D14: the battle tower attendant (server TOWER_RANGE_M = 3 for `tower start`)
  tower: 2.5,
  // followers with field powers (server FIELD_INTERACT_M = 3 from the spot): a bramble's blocker reaches 1.45 m out
  bramble: 2.6,
  dig: 2.5,
  dive: 2.6,
  // camp bases: a travellers' camp's fire (server CAMP_RANGE_M = 5; content CAMP_PROMPT_M = 4)
  camp: 4,
};
export const PLAYER_RANGE = 6;

export interface Interactable {
  readonly id: string;
  readonly kind: InteractableKind;
  x: number;
  z: number;
  readonly range: number;
  readonly prompt: HudPrompt;
  /** false = skipped by the scan (a picked-up item, an engaged spawn, an NPC absent for these flags) */
  enabled: boolean;
}

export function makeInteractable(id: string, kind: InteractableKind, x: number, z: number, verb: string, target: string, key: string, range: number = RANGE[kind]): Interactable {
  return { id, kind, x, z, range, prompt: { key, verb, target }, enabled: true };
}

export class InteractionTargets {
  private statics: Interactable[] = [];
  private readonly dynamic = new Map<string, Interactable>();
  private readonly dynList: Interactable[] = [];
  private nearest: Interactable | null = null;
  private changed = false;

  constructor(private readonly onPrompt: (p: HudPrompt | null) => void) {}

  get current(): Interactable | null {
    return this.nearest;
  }

  setStatics(list: Interactable[]): void {
    this.statics = list;
    this.nearest = null;
    this.onPrompt(null);
  }

  addDynamic(e: Interactable): void {
    if (this.dynamic.has(e.id)) this.removeDynamic(e.id);
    this.dynamic.set(e.id, e);
    this.dynList.push(e);
  }

  removeDynamic(id: string): void {
    const e = this.dynamic.get(id);
    if (e === undefined) return;
    this.dynamic.delete(id);
    const i = this.dynList.indexOf(e);
    if (i >= 0) {
      this.dynList[i] = this.dynList[this.dynList.length - 1]!;
      this.dynList.pop();
    }
    if (this.nearest === e) {
      this.nearest = null;
      this.changed = true;
    }
  }

  dynamicEntry(id: string): Interactable | undefined {
    return this.dynamic.get(id);
  }

  staticEntries(): readonly Interactable[] {
    return this.statics;
  }

  clear(): void {
    this.statics = [];
    this.dynamic.clear();
    this.dynList.length = 0;
    this.nearest = null;
    this.onPrompt(null);
  }

  /** One fixed step: keeps the nearest in-range target; writes the prompt only when it changed. */
  step(x: number, z: number, blocked: boolean): void {
    let best: Interactable | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    if (!blocked) {
      for (let i = 0; i < this.statics.length; i++) {
        const e = this.statics[i]!;
        if (!e.enabled) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d <= e.range && d < bestD) {
          best = e;
          bestD = d;
        }
      }
      for (let i = 0; i < this.dynList.length; i++) {
        const e = this.dynList[i]!;
        if (!e.enabled) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d <= e.range && d < bestD) {
          best = e;
          bestD = d;
        }
      }
    }
    if (best !== this.nearest || this.changed) {
      this.nearest = best;
      this.changed = false;
      this.onPrompt(best === null ? null : best.prompt);
    }
  }
}
