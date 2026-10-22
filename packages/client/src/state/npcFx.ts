/**
 * NPC voice talk's slap / kick (2026-10-22), either way: the screen burst `NpcStrikeFx` shows at contact, and the
 * world hook World3D binds (the striker's lunge, the sound, a kick's knockback). Without a world (tests, a dialogue
 * with no actor) the burst still plays at once.
 */
import { create } from 'zustand';
import type { StrikeKind } from '../scene/npcStrike';

export interface NpcFxState {
  /** the burst on screen (null = none); `seq` restarts the animation for a second hit */
  readonly hit: { readonly kind: StrikeKind; readonly seq: number } | null;
}

export const useNpcFxStore = create<NpcFxState>()(() => ({ hit: null }));

let seq = 0;

/** The contact moment: show the burst. */
export function showHit(kind: StrikeKind): void {
  seq++;
  useNpcFxStore.setState({ hit: { kind, seq } });
}

export function clearHit(): void {
  useNpcFxStore.setState({ hit: null });
}

/** Who hits whom: the NPC the player (its tool pass), or the player the NPC (H / K in the dialogue). */
export type StrikeBy = 'npc' | 'player';

/** World3D: play the strike on the actors; `onHit` must run at contact (or at once when it cannot be played). */
export type StrikeHook = (kind: StrikeKind, npcId: string, by: StrikeBy, onHit: () => void) => void;

let hook: StrikeHook | null = null;

export function setStrikeHook(h: StrikeHook | null): void {
  hook = h;
}

/** Resolves at contact (the burst is up). */
export function strike(kind: StrikeKind, npcId: string, by: StrikeBy = 'npc'): Promise<void> {
  return new Promise((resolve) => {
    const hit = (): void => {
      showHit(kind);
      resolve();
    };
    if (hook === null) hit();
    else hook(kind, npcId, by, hit);
  });
}
