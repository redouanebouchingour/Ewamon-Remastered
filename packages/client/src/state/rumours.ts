/**
 * The rumour board (LLM feature 8, talk/rumours.ts): the town whose board is open, the day's facts from `GET
 * /world/rumours/:zoneId`, and the crier's words for each. The facts show at once with their templates; the model then
 * writes the facts one at a time (one call in flight, so the small model on a CPU is never asked twice at once), and a
 * fact's words replace its template as they come back checked. Words are kept for the day (`RumourCache`), so a board
 * read again is not written again. Closing the screen or opening another town stops the writing; what was written
 * stays. Nothing here touches the save.
 */
import { create } from 'zustand';
import { BADGES, ZONES, hasRumourBoard, rumourZones } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { RumourFact, RumoursView } from '@ewa/protocol';
import { apiFetch, isApiFailure } from '../net/api';
import { RumourCache, writeRumour } from '../talk/rumours';
import type { RumourOptions } from '../talk/rumours';
import { useSessionStore } from './session';

const MODEL_ON = (import.meta.env as Record<string, string | undefined> | undefined)?.['VITE_NPC_TALK'] !== '0';

export type RumourStatus = 'idle' | 'loading' | 'ready' | 'off' | 'error';

export interface RumoursUi {
  /** the town whose board is open */
  readonly town: ZoneId | null;
  /** the last town the player stood in (the board the More menu opens) */
  readonly lastTown: ZoneId | null;
  readonly status: RumourStatus;
  readonly view: RumoursView | null;
  /** fact id → the crier's checked words (absent: the template shows) */
  readonly words: Readonly<Record<string, string>>;
  /** the model is writing */
  readonly writing: boolean;
}

export const useRumoursStore = create<RumoursUi>()(() => ({ town: null, lastTown: null, status: 'idle', view: null, words: {}, writing: false }));

const cache = new RumourCache();
let run: AbortController | null = null;

/** Notes the town the player stands in (World3D's zone changes), for the board the More menu opens. */
export function noteZone(zoneId: string | null): void {
  if (zoneId !== null && hasRumourBoard(zoneId)) useRumoursStore.setState({ lastTown: zoneId as ZoneId });
}

const zoneDef = new Map(ZONES.map((z) => [z.id, z]));

/** The towns whose boards the player may read: those whose entry badge they hold (or that need none), in route order. */
export function reachableTowns(badges: readonly string[]): ZoneId[] {
  return ZONES.filter((z) => z.kind === 'town' && hasRumourBoard(z.id) && (z.gate === null || badges.includes(z.gate))).map((z) => z.id);
}

/** The board to open: the asked town, else the one the player stands in, else the last one, else the town next to the route, else the first. */
export function defaultTown(asked: string | null, zoneId: string | null, lastTown: string | null): ZoneId {
  for (const t of [asked, zoneId, lastTown]) if (t !== null && hasRumourBoard(t)) return t as ZoneId;
  if (zoneId !== null) {
    const near = ZONES.find((z) => z.kind === 'town' && rumourZones(z.id).includes(zoneId as ZoneId));
    if (near !== undefined) return near.id;
  }
  return (ZONES.find((z) => z.kind === 'town')?.id ?? 'mirevale') as ZoneId;
}

/** The town's short name ("Solenne" for "Solenne, the Sun-City"). */
export function townName(id: string): string {
  return (zoneDef.get(id as ZoneId)?.name ?? id).split(',')[0]!;
}

/** A badge's type for a chip (the badge facts carry it already; kept for older payloads). */
export function badgeType(id: string): string | null {
  return BADGES.find((b) => b.id === id)?.type ?? null;
}

export interface OpenOptions extends RumourOptions {
  /** tests: the facts without the network */
  readonly fetchView?: (town: ZoneId, signal: AbortSignal) => Promise<RumoursView>;
  /** tests: the model on or off */
  readonly model?: boolean;
}

/** Writes the day's words for the facts that have none yet, one call at a time, until done or aborted. */
async function writeAll(view: RumoursView, signal: AbortSignal, o: OpenOptions): Promise<void> {
  const town = view.town;
  const todo = view.facts.filter((f) => cache.get(view.day, view.zoneId, f) === null);
  if (todo.length === 0) return;
  useRumoursStore.setState({ writing: true });
  try {
    for (const f of todo) {
      if (signal.aborted) return;
      const text = await writeRumour(f, town, { ...o, signal });
      if (signal.aborted) return;
      if (text === null) continue;
      cache.set(view.day, view.zoneId, f, text);
      useRumoursStore.setState((st) => (st.view === view ? { words: { ...st.words, [f.id]: text } } : {}));
    }
  } finally {
    if (useRumoursStore.getState().view === view) useRumoursStore.setState({ writing: false });
  }
}

/** Opens `town`'s board: the facts, the words already written today, then the rest written by the model. */
export async function openRumours(town: ZoneId, o: OpenOptions = {}): Promise<void> {
  run?.abort();
  const ctl = new AbortController();
  run = ctl;
  useRumoursStore.setState({ town, status: 'loading', view: null, words: {}, writing: false });
  let view: RumoursView;
  try {
    view = o.fetchView !== undefined ? await o.fetchView(town, ctl.signal) : await apiFetch('worldRumours', { params: { zoneId: town }, signal: ctl.signal });
  } catch (e) {
    if (ctl.signal.aborted) return;
    const code = isApiFailure(e) ? e.error.code : '';
    useRumoursStore.setState({ status: code === 'npcToolsOff' ? 'off' : 'error' });
    return;
  }
  if (ctl.signal.aborted) return;
  const words: Record<string, string> = {};
  for (const f of view.facts) {
    const w = cache.get(view.day, view.zoneId, f);
    if (w !== null) words[f.id] = w;
  }
  useRumoursStore.setState({ status: 'ready', view, words });
  if (o.model ?? MODEL_ON) await writeAll(view, ctl.signal, o);
}

/** The screen closed: the writing stops (what was written stays for the day). */
export function closeRumours(): void {
  run?.abort();
  run = null;
  useRumoursStore.setState({ writing: false });
}

/** The fact's words: the crier's when written, else null (the screen shows the template). */
export function wordsFor(f: RumourFact): string | null {
  return useRumoursStore.getState().words[f.id] ?? null;
}

/** The session's badges and zone, for the screen's town picker. */
export function sessionTowns(): { readonly towns: ZoneId[]; readonly zoneId: ZoneId | null } {
  const s = useSessionStore.getState();
  return { towns: reachableTowns(s.progression?.badges ?? []), zoneId: s.zoneId };
}
