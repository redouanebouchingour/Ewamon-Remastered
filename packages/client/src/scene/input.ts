/**
 * DOM input capture for the world (SPEC §20.4.5 bindings, remappable §20.8.5, stored as `KeyboardEvent.code`).
 *
 * Held keys (movement, run) are latched into a preallocated `Uint8Array` the LocalPlayerController samples once per
 * frame. Edge actions (interact, chat, emotes, challenge, camera heading, zoom, dev HUD) are dispatched from the
 * keydown / wheel / pointer handlers themselves — outside World3D.tick — to the callbacks World3D provides.
 * Nothing fires while a DOM input has focus; world actions are also gated by `blocked()` (battle, dialogue, modal,
 * chat open).
 */
import { useSettingsStore } from '../state/settings';
import type { InputAction } from '../state/settings';

export const HELD = { forward: 0, back: 1, left: 2, right: 3, run: 4 } as const;

export interface InputCallbacks {
  interact(): void;
  openChat(): void;
  emote(n: 1 | 2 | 3 | 4 | 5 | 6): void;
  challenge(): void;
  rotate(dir: -1 | 1): void;
  zoom(dir: -1 | 1): void;
  jump(): void;
  /** Phase D11: the bike key (World3D mounts / folds the bicycle when allowed) */
  toggleBike(): void;
  /** followers with field powers: the lead's power that needs no spot (a Psychic lead senses ghost trainers) */
  fieldPower(): void;
  toggleDev(): void;
  /** true while world actions must not fire (battle, dialogue, modal, chat) */
  blocked(): boolean;
}

export interface InputCapture {
  readonly held: Uint8Array;
  /** true when a text field has focus (movement and hotkeys are ignored) */
  typing(): boolean;
  dispose(): void;
}

const EDGE: readonly InputAction[] = ['interact', 'chat', 'emote1', 'emote2', 'emote3', 'emote4', 'emote5', 'emote6', 'challenge', 'rotateLeft', 'rotateRight', 'jump', 'bike', 'fieldPower'];

export function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function createInputCapture(target: Window, canvas: HTMLElement | null, cb: InputCallbacks): InputCapture {
  const held = new Uint8Array(5);
  const typing = (): boolean => (typeof document !== 'undefined' ? isTypingTarget(document.activeElement) : false);

  const heldIndex = (code: string): number => {
    const b = useSettingsStore.getState().keybinds;
    if (b.forward.includes(code)) return HELD.forward;
    if (b.back.includes(code)) return HELD.back;
    if (b.left.includes(code)) return HELD.left;
    if (b.right.includes(code)) return HELD.right;
    if (b.run.includes(code) || code === 'ShiftRight') return HELD.run;
    return -1;
  };

  const edgeAction = (code: string): InputAction | null => {
    const b = useSettingsStore.getState().keybinds;
    for (const a of EDGE) if (b[a].includes(code)) return a;
    return null;
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'F3') {
      e.preventDefault();
      cb.toggleDev();
      return;
    }
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    const h = heldIndex(e.code);
    if (h >= 0) {
      held[h] = 1;
      if (h !== HELD.run && !cb.blocked()) e.preventDefault();
      return;
    }
    if (e.repeat) return;
    const a = edgeAction(e.code);
    if (a === null || cb.blocked()) return;
    e.preventDefault();
    switch (a) {
      case 'interact': cb.interact(); return;
      case 'chat': cb.openChat(); return;
      case 'challenge': cb.challenge(); return;
      case 'rotateLeft': cb.rotate(-1); return;
      case 'rotateRight': cb.rotate(1); return;
      case 'jump': cb.jump(); return;
      case 'bike': cb.toggleBike(); return;
      case 'fieldPower': cb.fieldPower(); return;
      default: {
        const n = Number(a.slice('emote'.length));
        if (n >= 1 && n <= 6) cb.emote(n as 1 | 2 | 3 | 4 | 5 | 6);
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const h = heldIndex(e.code);
    if (h >= 0) held[h] = 0;
  };
  const onBlur = (): void => {
    held.fill(0);
  };

  // wheel → zoom stop; horizontal drag ≥ 80 px → heading (§20.4.5)
  let wheelAcc = 0;
  const onWheel = (e: WheelEvent): void => {
    if (cb.blocked()) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < 60) return;
    cb.zoom(wheelAcc > 0 ? 1 : -1);
    wheelAcc = 0;
  };
  let dragX: number | null = null;
  const onDown = (e: PointerEvent): void => {
    if (e.button === 0 || e.button === 2) dragX = e.clientX;
  };
  const onMove = (e: PointerEvent): void => {
    if (dragX === null || cb.blocked()) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) >= 80) {
      cb.rotate(dx > 0 ? -1 : 1);
      dragX = e.clientX;
    }
  };
  const onUp = (): void => {
    dragX = null;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  canvas?.addEventListener('wheel', onWheel, { passive: true });
  canvas?.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);

  return {
    held,
    typing,
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      canvas?.removeEventListener('wheel', onWheel);
      canvas?.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    },
  };
}
