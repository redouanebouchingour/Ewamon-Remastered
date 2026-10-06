/**
 * Phase D12 — Prof. Wynn's guided tutorial over the Act I opening. Client-side guidance only: no message, no flag, no
 * story beat changes. Each step completes on a real event the client already sees (moved N metres, `met_wynn` from
 * the first_witness beat, the party panel opened, a wild battle started, a catch, a win, a heal); events are latched
 * per account whenever they happen, so a step done early (a win before the catch) is ticked off when it comes up.
 *
 * Persisted per account in localStorage under 'ewa.tutorial' (zustand `persist`, like settings): `done` once every
 * step is complete or the player pressed "Skip tutorial" — it never shows again for that account in this browser. An
 * account already past the opening (any badge, or a story flag set after the Mire Route rival) is marked done on sight.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STORY } from '@ewa/content';
import { useSessionStore } from './session';
import type { InputAction } from './settings';

export type TutorialEvent = 'moved' | 'metWynn' | 'openedParty' | 'wildBattle' | 'caught' | 'won' | 'healed';

export interface TutorialStep {
  readonly id: string;
  readonly event: TutorialEvent;
  readonly title: string;
  /** Prof. Wynn's line */
  readonly line: string;
  /** key glyphs shown under the line, from the player's own bindings */
  readonly keys: readonly { readonly actions: readonly InputAction[]; readonly label: string }[];
}

/** metres of accepted movement that complete the first step */
export const TUTORIAL_MOVE_M = 8;
/** a single position change longer than this is a teleport / crossing, not walking */
export const TUTORIAL_JUMP_M = 6;

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'move',
    event: 'moved',
    title: 'Find your feet',
    line: 'Walk the square first. It is small; you will not get lost.',
    keys: [
      { actions: ['forward', 'left', 'back', 'right'], label: 'Move' },
      { actions: ['run'], label: 'Run' },
    ],
  },
  {
    id: 'wynn',
    event: 'metWynn',
    title: 'Come and find me',
    line: 'I am outside the lab, on the north side of the square. Walk up and talk to me.',
    keys: [{ actions: ['interact'], label: 'Talk' }],
  },
  {
    id: 'party',
    event: 'openedParty',
    title: 'Look at your partner',
    line: 'That one is yours now. Open your party and look at it properly: moves, health, the lot.',
    keys: [{ actions: ['party'], label: 'Party' }],
  },
  {
    id: 'wild',
    event: 'wildBattle',
    title: 'Mire Route',
    line: 'The route is east of town. Things live in the long grass. Walk up to one and start a battle.',
    keys: [{ actions: ['interact'], label: 'Battle' }],
  },
  {
    id: 'catch',
    event: 'caught',
    title: 'Record your first catch',
    line: 'Wear it down, then throw an orb from the battle menu. Weak ones hold better.',
    keys: [],
  },
  {
    id: 'win',
    event: 'won',
    title: 'Win one',
    line: 'A wild one, a trainer, Sable if she finds you. Wins are how a partner grows.',
    keys: [],
  },
  {
    id: 'heal',
    event: 'healed',
    title: 'Rest them',
    line: 'When they are worn out, the healer in town puts them right. Talk to the nurse, or press Heal in your party there.',
    keys: [{ actions: ['interact'], label: 'Talk' }],
  },
];

/** Beats that are the tutorial's own ground; any flag set by a LATER beat means the opening is behind the player. */
const OPENING_BEATS: ReadonlySet<string> = new Set(['first_witness', 'mire_rival']);
const LATER_FLAGS: ReadonlySet<string> = new Set(STORY.filter((b) => !OPENING_BEATS.has(b.id)).flatMap((b) => b.set));

export function pastOpening(p: { readonly badges: readonly string[]; readonly flags: readonly string[] }): boolean {
  return p.badges.length > 0 || p.flags.some((f) => f.startsWith('badge:') || LATER_FLAGS.has(f));
}

/** The first step whose event has not happened yet; null when all are done. */
export function currentStep(seen: readonly TutorialEvent[]): TutorialStep | null {
  return TUTORIAL_STEPS.find((s) => !seen.includes(s.event)) ?? null;
}

/** Events the account's progression already proves (a reload mid-tutorial, an account older than the tutorial). */
export function derivedEvents(p: { readonly flags: readonly string[]; readonly dexCaught: readonly string[] }): TutorialEvent[] {
  const out: TutorialEvent[] = [];
  if (p.flags.includes('met_wynn')) out.push('metWynn');
  // the starter is the first dex entry; a second one was caught
  if (p.dexCaught.length >= 2) out.push('caught');
  return out;
}

/** Accumulates walked distance from successive authoritative positions, skipping teleports and crossings. */
export class MoveMeter {
  private last: { x: number; z: number } | null = null;
  total = 0;

  feed(x: number, z: number): number {
    if (this.last !== null) {
      const d = Math.hypot(x - this.last.x, z - this.last.z);
      if (d <= TUTORIAL_JUMP_M) this.total += d;
    }
    this.last = { x, z };
    return this.total;
  }

  /** after a room change: the next position is a new origin */
  reset(): void {
    this.last = null;
  }
}

export interface TutorialAccount {
  readonly seen: readonly TutorialEvent[];
  readonly done: boolean;
}

export interface TutorialState {
  readonly accounts: Readonly<Record<string, TutorialAccount>>;
  /** latches an event; marks the account done when it completes the last step. true when it was new. */
  note(accountId: string, event: TutorialEvent): boolean;
  /** "Skip tutorial", the last step, or an account past the opening */
  finish(accountId: string): void;
}

const EMPTY: TutorialAccount = { seen: [], done: false };

export function accountOf(st: Pick<TutorialState, 'accounts'>, accountId: string | null | undefined): TutorialAccount {
  return (accountId != null ? st.accounts[accountId] : undefined) ?? EMPTY;
}

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
    // private mode / blocked storage — progress lives for this tab only
  }
  return memoryStorage();
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      accounts: {},
      note(accountId, event) {
        const cur = accountOf(get(), accountId);
        if (cur.done || cur.seen.includes(event)) return false;
        const seen = [...cur.seen, event];
        set({ accounts: { ...get().accounts, [accountId]: { seen, done: currentStep(seen) === null } } });
        return true;
      },
      finish(accountId) {
        const cur = accountOf(get(), accountId);
        if (cur.done) return;
        set({ accounts: { ...get().accounts, [accountId]: { seen: cur.seen, done: true } } });
      },
    }),
    {
      name: 'ewa.tutorial',
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      partialize: (s) => ({ accounts: s.accounts }),
    },
  ),
);

/** For non-React callers (the heal paths): latch an event for the signed-in account. */
export function noteTutorialEvent(event: TutorialEvent): void {
  const id = useSessionStore.getState().profile?.id;
  if (id !== undefined) useTutorialStore.getState().note(id, event);
}
