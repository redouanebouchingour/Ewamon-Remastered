/**
 * Nemeses (content nemesis.ts): the ambush taunt on screen (`nemesisAmbush`, shown as a lower third over its battle)
 * and the news of one (`nemesisNews`): its toast waits while the battle UI is open (the server sends it right after
 * `battleEnd`, before the timeline and the result card have played) and shows once the player is back in the world.
 * NemesisTaunt and the Profile's NemesesSection read it.
 */
import { create } from 'zustand';
import type { ServerMessageOf } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { toast } from './notifications';
import { useUiStore } from './ui';

export type NemesisAmbush = Omit<ServerMessageOf<'nemesisAmbush'>, 'type'>;
export type NemesisNews = Omit<ServerMessageOf<'nemesisNews'>, 'type'>;

/** How long a nemesis toast stays. */
export const NEMESIS_TOAST_MS = 8000;

export interface NemesisUi {
  /** the latest ambush's taunt (cleared once shown, or when its battle is gone) */
  readonly ambush: NemesisAmbush | null;
  /** news waiting for the battle UI to close */
  readonly pending: readonly NemesisNews[];
  /** bumped on every nemesisNews, so the Profile's list reloads */
  readonly version: number;
  setAmbush(a: NemesisAmbush | null): void;
  /** a nemesisNews: told now in the world, or once the battle UI closes */
  news(n: NemesisNews): void;
  /** tells the waiting news (the battle UI closed) */
  flush(): void;
}

export const useNemesisStore = create<NemesisUi>()((set, get) => ({
  ambush: null,
  pending: [],
  version: 0,
  setAmbush: (ambush) => set({ ambush }),
  news(n) {
    set((st) => ({ version: st.version + 1 }));
    if (useUiStore.getState().battle !== null) set((st) => ({ pending: [...st.pending, n] }));
    else tell(n);
  },
  flush() {
    const waiting = get().pending;
    if (waiting.length === 0) return;
    set({ pending: [] });
    for (const n of waiting) tell(n);
  },
}));

function tell(n: NemesisNews): void {
  const t = nemesisNewsText(n);
  toast(t.level, t.text, NEMESIS_TOAST_MS);
}

// the battle UI closed: the news it held back is told
useUiStore.subscribe((st, prev) => {
  if (prev.battle !== null && st.battle === null) useNemesisStore.getState().flush();
});

/** "Scarjaw the Unbroken". */
export function fullName(n: { readonly name: string; readonly title: string }): string {
  return `${n.name} ${n.title}`;
}

/** What the player is told when a nemesis rises, ranks up, falls, is caught or fades. */
export function nemesisNewsText(n: NemesisNews): { readonly level: 'info' | 'success' | 'warn'; readonly text: string } {
  const who = fullName(n);
  switch (n.event) {
    case 'rose':
      return { level: 'warn', text: `The ${speciesName(n.speciesId)} got away. It will remember you: ${who}.` };
    case 'rankUp':
      return { level: 'warn', text: `${who} got away again. It is rank ${n.rank} now.` };
    case 'beaten':
      return { level: 'success', text: `${who} is beaten. Your creature keeps the trophy.` };
    case 'caught':
      return { level: 'success', text: `You caught ${who}. It keeps its name and its scar.` };
    case 'faded':
      return { level: 'info', text: `${who} has faded. A newer nemesis took its place.` };
  }
}
