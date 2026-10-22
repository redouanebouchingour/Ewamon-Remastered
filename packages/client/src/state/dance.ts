/**
 * The breakdance (emote 7, 2026-10-22): the Dance button in the key legend and G call `dance()`; World3D binds the
 * action (it sends the emote, plays it on the player's own actor and makes the villagers nearby hop along).
 */
let action: (() => void) | null = null;

export function setDanceAction(a: (() => void) | null): void {
  action = a;
}

export function dance(): void {
  action?.();
}
