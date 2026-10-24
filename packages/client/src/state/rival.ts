/**
 * A recurring rival (LLM feature 7, talk/rival.ts): the rival the server says is on this route (`rival` near /
 * approach), its taunt (pre-written by the model from `near` while the player walks, else the template), its parting
 * line once a battle with it is over, and the Profile's reload counter. World3D plays the scenes; foe.ts and the
 * commentator read the view for the rival's look and persona. Nothing here touches the save: the parting line the
 * player saw is sent to `POST /rival/words` for the Profile, flavour only.
 */
import { create } from 'zustand';
import { rivalNameOf } from '@ewa/content';
import type { RivalView } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { fetchRivalLine, templateParting, templateTaunt } from '../talk/rival';
import type { RivalOutcome, RivalScene } from '../talk/rival';
import { useSessionStore } from './session';
import { useSettingsStore } from './settings';

export interface RivalUi {
  /** the rival met on this route (the last `rival` message) */
  readonly view: RivalView | null;
  /** bumped after every meeting, so the Profile's section reloads */
  readonly version: number;
  setView(v: RivalView | null): void;
  bump(): void;
}

export const useRivalStore = create<RivalUi>()((set) => ({
  view: null,
  version: 0,
  setView: (view) => set({ view }),
  bump: () => set((st) => ({ version: st.version + 1 })),
}));

/** The rival's view when `trainerId` is its battle id (foe.ts, the commentator), else null. */
export function rivalViewFor(trainerId: string): RivalView | null {
  const name = rivalNameOf(trainerId);
  const v = useRivalStore.getState().view;
  return name !== null && v !== null && v.name === name ? v : null;
}

/** The scene the rival speaks in: its view, the player, the party and badges from the session, the zone. */
export function rivalScene(view: RivalView, zoneId: string): RivalScene {
  const s = useSessionStore.getState();
  return { rival: view, player: s.profile?.username ?? 'traveller', party: s.inventory?.party ?? [], badges: s.progression?.badges.length ?? 0, zoneId };
}

/** The model may speak for the rival (Settings › Accessibility "Trainer banter", like the in-battle lines). */
const modelOn = (): boolean => useSettingsStore.getState().accessibility.trainerBanter;

/** What the rival says, and whether the model wrote it. */
export interface RivalLine {
  readonly text: string;
  readonly fromModel: boolean;
}

let taunt: { readonly key: string; readonly line: Promise<string | null> } | null = null;

/**
 * A taunt is written for one scene: the rival's meeting, the zone and the party it was checked against (the live check
 * found `near` arriving before the session's party was in hand: a line checked against an empty party drops every
 * "your X", so it waits for the party).
 */
const tauntKey = (s: RivalScene): string => `${s.rival.name}:${s.rival.record.meetings}:${s.zoneId}:${s.badges}:${s.party.map((c) => `${c.speciesId}@${c.level}`).join(',')}`;

/** `near`: the rival is on this route; the model writes its taunt now, while the player walks. */
export function prewriteTaunt(s: RivalScene, fetchLine: typeof fetchRivalLine = fetchRivalLine): void {
  const key = tauntKey(s);
  if (taunt?.key === key || !modelOn() || s.party.length === 0) return;
  taunt = { key, line: fetchLine(s, null).catch(() => null) };
}

/** Resolves with `p`'s line, or null after `ms`. */
function within(p: Promise<string | null>, ms: number): Promise<string | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/**
 * The taunt the rival says on walking up: the pre-written one when it is back (waiting at most `waitMs` more), else
 * the template.
 */
export async function tauntLine(s: RivalScene, waitMs: number, fetchLine: typeof fetchRivalLine = fetchRivalLine): Promise<RivalLine> {
  prewriteTaunt(s, fetchLine);
  const pending = taunt?.key === tauntKey(s) ? taunt.line : null;
  const text = pending === null ? null : await within(pending, waitMs);
  return text === null ? { text: templateTaunt(s), fromModel: false } : { text, fromModel: true };
}

/** The parting line once the battle is over: the model's when it is back within `waitMs`, else the template. */
export async function partingLine(s: RivalScene, outcome: RivalOutcome, line: Promise<string | null> | null, waitMs: number): Promise<RivalLine> {
  const text = line === null ? null : await within(line, waitMs);
  return text === null ? { text: templateParting(s, outcome), fromModel: false } : { text, fromModel: true };
}

/** Starts the parting line's model call at the battle's end (null with the model off). */
export function writeParting(s: RivalScene, outcome: RivalOutcome, fetchLine: typeof fetchRivalLine = fetchRivalLine): Promise<string | null> | null {
  return modelOn() ? fetchLine(s, outcome).catch(() => null) : null;
}

/** The parting line the player saw goes to the Profile (once per meeting; a refusal is not the player's problem). */
export async function sendWords(text: string): Promise<void> {
  try {
    await apiFetch('rivalWords', { body: { text } });
  } catch (_e) {
    // the Profile shows the template line instead
  }
  useRivalStore.getState().bump();
}

/** Tests. */
export function resetRivalTalk(): void {
  taunt = null;
  useRivalStore.setState({ view: null, version: 0 });
}
