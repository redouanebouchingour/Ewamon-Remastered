/**
 * SettingsState (SPEC §20.8.1): persisted with zustand `persist` under 'ewa.settings' v1. Changes apply
 * immediately (no Save button); applySettings.ts mirrors them onto :root and into the renderer.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

export type Colorblind = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type InputAction =
  | 'forward' | 'back' | 'left' | 'right' | 'run' | 'interact' | 'jump' | 'bike' | 'fieldPower' | 'chat'
  | 'emote1' | 'emote2' | 'emote3' | 'emote4' | 'emote5' | 'emote6'
  | 'challenge' | 'rotateLeft' | 'rotateRight' | 'party' | 'bag' | 'journal' | 'map' | 'pvp' | 'professor' | 'buddyTalk' | 'pause' | 'toggleHud';

/** Quality preset (render `quality.ts`); 'auto' = low on integrated Intel GPUs, else high. */
export type GraphicsQualitySetting = 'auto' | 'low' | 'medium' | 'high';
/**
 * Frames per second the world renders at most; 0 = the display's refresh rate, `FRAME_CAP_UNLIMITED` = as fast as the
 * GPU finishes frames (beyond the refresh rate: the extra frames are never shown, a benchmark mode).
 */
export type FrameCap = -1 | 0 | 30 | 60;
export const FRAME_CAP_UNLIMITED = -1;

export interface GraphicsSettings {
  readonly reducedEffects: boolean;
  readonly renderScale: 0.75 | 1;
  readonly quality: GraphicsQualitySetting;
  readonly frameCap: FrameCap;
  /** frames per second in the top bar */
  readonly showFps: boolean;
  readonly dof: boolean;
  readonly bloom: boolean;
  readonly grain: boolean;
  readonly chroma: boolean;
  readonly shake: boolean;
  readonly hitstop: boolean;
  readonly slowmo: boolean;
}
export interface AccessibilitySettings {
  readonly reducedMotion: 'system' | 'on' | 'off';
  readonly colorblind: Colorblind;
  /** 0.9..1.4 step 0.05 */
  readonly uiScale: number;
  readonly battleTextSpeed: 'normal' | 'fast' | 'instant';
  readonly screenFlash: boolean;
  /** verified speedruns: the server's play clock in the top bar */
  readonly speedrunTimer: boolean;
  /** the battle commentator's caption (LLM feature 3; templates when the model is down) */
  readonly battleCommentary: boolean;
  /** the opposing trainer's lines during a battle */
  readonly trainerBanter: boolean;
  /** LLM feature 6: the lead walking behind the player says a short line now and then (a speech bubble) */
  readonly followerChatter: boolean;
}
/** 0..1 */
export interface AudioSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly ui: number;
  readonly muteWhenHidden: boolean;
}
export interface SocialSettings {
  readonly showChat: boolean;
  readonly allowChallenges: boolean;
  readonly allowTrades: boolean;
  readonly allowDmsFrom: 'everyone' | 'friends';
}
export type Keybinds = Readonly<Record<InputAction, readonly string[]>>;

export interface SettingsData {
  readonly graphics: GraphicsSettings;
  readonly accessibility: AccessibilitySettings;
  readonly audio: AudioSettings;
  /** KeyboardEvent.code values, 1..2 per action */
  readonly keybinds: Keybinds;
  readonly social: SocialSettings;
}

export interface SettingsState extends SettingsData {
  set<K extends keyof SettingsData>(k: K, v: Partial<SettingsData[K]>): void;
  resetKeybinds(): void;
}

/** SPEC §20.4.5 default bindings, in the order the Controls table lists them. */
export const DEFAULT_KEYBINDS: Keybinds = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft'],
  interact: ['KeyE', 'Enter'],
  jump: ['Space'],
  // Phase D11: mount / fold the bicycle (V was free; persisted blobs without it merge this default in)
  bike: ['KeyV'],
  // followers with field powers: the lead's power that needs no spot (a Psychic lead's sense); F was free
  fieldPower: ['KeyF'],
  chat: ['KeyT'],
  emote1: ['Digit1'],
  emote2: ['Digit2'],
  emote3: ['Digit3'],
  emote4: ['Digit4'],
  emote5: ['Digit5'],
  emote6: ['Digit6'],
  challenge: ['KeyC'],
  rotateLeft: ['KeyQ'],
  rotateRight: ['KeyR'],
  party: ['KeyP'],
  bag: ['KeyB'],
  journal: ['KeyJ'],
  map: ['KeyM'],
  // arena PvP: the PvP screen (K was free; persisted blobs without it merge this default in)
  pvp: ['KeyK'],
  // LLM feature 5: Ask Prof. Wynn (L was free; persisted blobs without it merge this default in)
  professor: ['KeyL'],
  // LLM feature 6: talk to the lead walking behind you (Y was free; persisted blobs without it merge this default in)
  buddyTalk: ['KeyY'],
  pause: ['Escape'],
  toggleHud: ['F1'],
};

export const INPUT_ACTIONS = Object.keys(DEFAULT_KEYBINDS) as InputAction[];

export const DEFAULT_SETTINGS: SettingsData = {
  graphics: { reducedEffects: false, renderScale: 1, quality: 'auto', frameCap: 60, showFps: false, dof: true, bloom: true, grain: true, chroma: true, shake: true, hitstop: true, slowmo: true },
  accessibility: { reducedMotion: 'system', colorblind: 'none', uiScale: 1, battleTextSpeed: 'normal', screenFlash: true, speedrunTimer: false, battleCommentary: true, trainerBanter: true, followerChatter: true },
  audio: { master: 0.8, music: 0.7, sfx: 0.8, ui: 0.6, muteWhenHidden: true },
  keybinds: DEFAULT_KEYBINDS,
  social: { showChat: true, allowChallenges: true, allowTrades: true, allowDmsFrom: 'everyone' },
};

export const UI_SCALE = { min: 0.9, max: 1.4, step: 0.05 } as const;

export function clampUiScale(v: number): number {
  const snapped = Math.round(v / UI_SCALE.step) * UI_SCALE.step;
  return Math.min(UI_SCALE.max, Math.max(UI_SCALE.min, Number(snapped.toFixed(2))));
}

// ---- key remapping rules (§20.8.5) ---------------------------------------------------------------------

const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu', 'CapsLock']);

/** Escape/Enter/Tab and F2, F4–F12 cannot be bound; F1 and F3 can. */
export function isBindable(code: string): boolean {
  if (RESERVED.has(code)) return false;
  const f = /^F(\d{1,2})$/.exec(code);
  if (f !== null) return f[1] === '1' || f[1] === '3';
  return code.length > 0;
}

/** The action already holding `code`, other than `action` itself; null when free. */
export function bindingConflict(keybinds: Keybinds, action: InputAction, code: string): InputAction | null {
  for (const a of INPUT_ACTIONS) {
    if (a !== action && keybinds[a].includes(code)) return a;
  }
  return null;
}

// ---- the store ----------------------------------------------------------------------------------------------

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

function safeLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_e) {
    // private mode / blocked storage — settings live for this tab only
  }
  return memoryStorage();
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...DEFAULT_SETTINGS,
        set(k, v) {
          const next = { ...get()[k], ...v };
          if (k === 'accessibility' && 'uiScale' in v && typeof v.uiScale === 'number') {
            (next as { uiScale: number }).uiScale = clampUiScale(v.uiScale);
          }
          set({ [k]: next } as Partial<SettingsState>);
        },
        resetKeybinds() {
          set({ keybinds: DEFAULT_KEYBINDS });
        },
      }),
      {
        name: 'ewa.settings',
        version: 1,
        storage: createJSONStorage(safeLocalStorage),
        partialize: (s): SettingsData => ({ graphics: s.graphics, accessibility: s.accessibility, audio: s.audio, keybinds: s.keybinds, social: s.social }),
        // a partial or older blob never drops a new default
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<SettingsData>;
          return {
            ...current,
            graphics: { ...current.graphics, ...p.graphics },
            accessibility: { ...current.accessibility, ...p.accessibility },
            audio: { ...current.audio, ...p.audio },
            keybinds: { ...current.keybinds, ...p.keybinds },
            social: { ...current.social, ...p.social },
          };
        },
      },
    ),
  ),
);
