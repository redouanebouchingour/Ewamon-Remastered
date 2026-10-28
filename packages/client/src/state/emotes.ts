/**
 * The emote wheel (2026-10-27, replaces the G breakdance): G or the Emotes button in the key legend opens a PUBG-style
 * wheel of eight emotes (`EmoteWheel`); picking one calls `playEmote(n)`, and World3D binds the action (it sends the
 * emote, plays it on the player's own actor, and for the dances makes the villagers nearby hop along). Ids are the
 * protocol's (7 the breakdance, 8..14 the rest; `emoteLengthMs`).
 */
import { create } from 'zustand';

export type WheelEmote = 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface WheelEntry {
  readonly id: WheelEmote;
  readonly label: string;
  /** the glyph in the wheel (the render HUD card over the head shows its own) */
  readonly glyph: string;
}

/** Clockwise from the top (the bird on the right, six seven on the left). */
export const WHEEL: readonly WheelEntry[] = [
  { id: 8, label: 'High five', glyph: '✋' },
  { id: 9, label: 'You, me, battle', glyph: '⚔️' },
  { id: 13, label: 'The bird', glyph: '🖕' },
  { id: 10, label: 'Whip / Nae Nae', glyph: '🕺' },
  { id: 7, label: 'Breakdance', glyph: '🔥' },
  { id: 11, label: 'DAB aggressively', glyph: '😤' },
  { id: 12, label: 'Six sevennn', glyph: '🤷' },
  { id: 14, label: 'Crying', glyph: '😭' },
];

export interface EmoteWheelState {
  readonly open: boolean;
  setOpen(open: boolean): void;
}

export const useEmoteWheelStore = create<EmoteWheelState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

let action: ((n: WheelEmote) => void) | null = null;

export function setEmoteAction(a: ((n: WheelEmote) => void) | null): void {
  action = a;
}

export function playEmote(n: WheelEmote): void {
  action?.(n);
}
