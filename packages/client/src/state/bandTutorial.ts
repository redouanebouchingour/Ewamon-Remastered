/**
 * Majin / Tenjin (`.design/majin-tenjin.md` §6.3–6.4): the band cards and the in-battle coach marks. Client-side
 * guidance only, separate from Prof. Wynn's opening tutorial (`state/tutorial.ts`, its own persisted key).
 *
 * - A band card runs once the band (`majin_band` / `tenjin_band`) is in the inventory: 3 steps, each ticked by a real
 *   event the client already sees — the party opened (`/play/party`), a battle with a creature of that form kind on
 *   the player's field, and a transformation of that kind by the player. A transformation also completes the card
 *   (the player has done the whole thing), so an account that already transformed is done on sight. Skippable.
 * - A coach mark: the first time the battle menu's transform toggle is enabled for a kind, one line, once per kind.
 *
 * Persisted per account in localStorage under 'ewa.bandTutorial' (zustand `persist`, like the opening tutorial).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAJIN_BAND, TENJIN_BAND } from '@ewa/content';
import type { BandKind, BattleState } from '@ewa/core';
import { species } from '../data/content';
import type { InputAction } from './settings';

export type BandEvent = 'openedParty' | 'formOnField' | 'transformed';

export interface BandStep {
  readonly id: string;
  readonly event: BandEvent;
  readonly title: string;
  readonly line: string;
  /** a key chip under the line: a player binding (`action`) or a fixed battle key (`glyph`) */
  readonly keys: readonly { readonly action?: InputAction; readonly glyph?: string; readonly label: string }[];
}

export const BAND_KINDS: readonly BandKind[] = ['majin', 'tenjin'];

/** the key item of each band */
export const BAND_ITEM: Readonly<Record<BandKind, string>> = { majin: MAJIN_BAND, tenjin: TENJIN_BAND };

/** the band's name (the card's heading) */
export const BAND_NAME: Readonly<Record<BandKind, string>> = { majin: 'Majin Band', tenjin: 'Tenjin Band' };

/** the battle menu's key for the transform toggle */
export const TRANSFORM_KEY = 'T';

export const BAND_STEPS: Readonly<Record<BandKind, readonly BandStep[]>> = {
  majin: [
    {
      id: 'majin_party',
      event: 'openedParty',
      title: 'The cracked red ring',
      line: 'Open your party. A creature marked with the cracked red ring can go Majin.',
      keys: [{ action: 'party', label: 'Party' }],
    },
    {
      id: 'majin_field',
      event: 'formOnField',
      title: 'Below half',
      line: 'Majin opens only when its HP is below half. Take one into a battle and watch its HP.',
      keys: [],
    },
    {
      id: 'majin_transform',
      event: 'transformed',
      title: 'Once a battle',
      line: 'In the Fight menu, arm Majin, then pick a move. It transforms before anyone moves. One transformation per battle.',
      keys: [{ glyph: TRANSFORM_KEY, label: 'Majin' }],
    },
  ],
  tenjin: [
    {
      id: 'tenjin_party',
      event: 'openedParty',
      title: 'The gold ring',
      line: 'Open your party. A creature marked with the whole gold ring can go Tenjin.',
      keys: [{ action: 'party', label: 'Party' }],
    },
    {
      id: 'tenjin_field',
      event: 'formOnField',
      title: 'At or above half',
      line: 'Tenjin opens only while its HP is at or above half. Take one into a battle while it is still healthy.',
      keys: [],
    },
    {
      id: 'tenjin_transform',
      event: 'transformed',
      title: 'Once a battle',
      line: 'In the Fight menu, arm Tenjin, then pick a move. It transforms before anyone moves. One transformation per battle.',
      keys: [{ glyph: TRANSFORM_KEY, label: 'Tenjin' }],
    },
  ],
};

/** The in-battle coach line, the first time the toggle lights up for a kind. */
export const COACH_LINE: Readonly<Record<BandKind, string>> = {
  majin: 'Majin ready — its HP is below half. One transformation per battle.',
  tenjin: 'Tenjin ready — its HP is at or above half. One transformation per battle.',
};

/** The first step of `kind` whose event has not happened yet; null when all are done. */
export function currentBandStep(kind: BandKind, seen: readonly BandEvent[]): BandStep | null {
  return BAND_STEPS[kind].find((s) => !seen.includes(s.event)) ?? null;
}

/** The bands the inventory holds, in card order (Majin first: it comes first in the story). */
export function bandsHeld(items: Readonly<Record<string, number>> | undefined): BandKind[] {
  if (items === undefined) return [];
  return BAND_KINDS.filter((k) => (items[BAND_ITEM[k]] ?? 0) > 0);
}

function kindOf(speciesId: string): BandKind | null {
  return species(speciesId)?.battleForm?.kind ?? null;
}

/** The form kinds of the creatures on `seat`'s field (singles: the active; doubles: both positions). */
export function fieldKinds(st: BattleState, seat: 0 | 1): BandKind[] {
  const sd = st.sides[seat];
  const out: BandKind[] = [];
  for (const i of sd.actives ?? [sd.active]) {
    const b = sd.party[i];
    const k = b === undefined || b.creature.hp <= 0 ? null : kindOf(b.creature.speciesId);
    if (k !== null && !out.includes(k)) out.push(k);
  }
  return out;
}

/** The kind of the transformation `seat` used this battle (its side's `transformed` + the battler in its form), else null. */
export function transformedKind(st: BattleState, seat: 0 | 1): BandKind | null {
  const sd = st.sides[seat];
  if (sd.transformed !== true) return null;
  for (const b of sd.party) {
    if (b.form === undefined) continue;
    const f = species(b.creature.speciesId)?.battleForm;
    if (f?.kind !== undefined && f.id === b.form) return f.kind;
  }
  return null;
}

export interface BandCardState {
  readonly seen: readonly BandEvent[];
  readonly done: boolean;
}

export interface BandAccount {
  readonly majin: BandCardState;
  readonly tenjin: BandCardState;
  /** kinds whose coach mark has been shown */
  readonly coached: readonly BandKind[];
}

export interface BandTutorialState {
  readonly accounts: Readonly<Record<string, BandAccount>>;
  /** latches an event of `kind`'s card; a transformation completes the card. true when it was new. */
  note(accountId: string, kind: BandKind, event: BandEvent): boolean;
  /** "Skip" (or the card's last step) */
  finish(accountId: string, kind: BandKind): void;
  /** records that `kind`'s coach mark was shown; true the first time */
  coach(accountId: string, kind: BandKind): boolean;
}

const EMPTY_CARD: BandCardState = { seen: [], done: false };
const EMPTY: BandAccount = { majin: EMPTY_CARD, tenjin: EMPTY_CARD, coached: [] };

export function bandAccountOf(st: Pick<BandTutorialState, 'accounts'>, accountId: string | null | undefined): BandAccount {
  return (accountId != null ? st.accounts[accountId] : undefined) ?? EMPTY;
}

/** The pure step of `note`: the card after `event` (unchanged when done or already seen). */
export function noteBand(card: BandCardState, kind: BandKind, event: BandEvent): BandCardState {
  if (card.done || card.seen.includes(event)) return card;
  const seen = [...card.seen, event];
  return { seen, done: event === 'transformed' || currentBandStep(kind, seen) === null };
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

export const useBandTutorialStore = create<BandTutorialState>()(
  persist(
    (set, get) => ({
      accounts: {},
      note(accountId, kind, event) {
        const cur = bandAccountOf(get(), accountId);
        const next = noteBand(cur[kind], kind, event);
        if (next === cur[kind]) return false;
        set({ accounts: { ...get().accounts, [accountId]: { ...cur, [kind]: next } } });
        return true;
      },
      finish(accountId, kind) {
        const cur = bandAccountOf(get(), accountId);
        if (cur[kind].done) return;
        set({ accounts: { ...get().accounts, [accountId]: { ...cur, [kind]: { seen: cur[kind].seen, done: true } } } });
      },
      coach(accountId, kind) {
        const cur = bandAccountOf(get(), accountId);
        if (cur.coached.includes(kind)) return false;
        set({ accounts: { ...get().accounts, [accountId]: { ...cur, coached: [...cur.coached, kind] } } });
        return true;
      },
    }),
    {
      name: 'ewa.bandTutorial',
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      partialize: (s) => ({ accounts: s.accounts }),
    },
  ),
);
