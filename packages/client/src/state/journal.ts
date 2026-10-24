/**
 * The adventure journal (LLM feature 9, talk/journal.ts): the Journal screen's data. Opening it reads `GET /journal`
 * (today's digest and entry, the recent days with facts and no entry, the entries) and then writes what is missing, one
 * day at a time: today's page when the day has facts and no page yet, and each unwritten day before it. A page is the
 * model's entry when it comes back checked, else the template (the facts as they are); either way it is stored by the
 * server (`POST /journal/day/:day`) and shown at once. "Rewrite today" reads today's digest again and writes today's
 * page anew (the server keeps the last). Closing the screen stops the writing. Nothing here touches the save.
 */
import { create } from 'zustand';
import type { JournalDay, JournalEntryView, JournalFact, JournalView } from '@ewa/protocol';
import { apiFetch, isApiFailure } from '../net/api';
import { templateEntry, writeEntry } from '../talk/journal';
import type { EntryOptions } from '../talk/journal';
import { toast } from './notifications';

const MODEL_ON = (import.meta.env as Record<string, string | undefined> | undefined)?.['VITE_NPC_TALK'] !== '0';

export type JournalStatus = 'idle' | 'loading' | 'ready' | 'off' | 'error';

export interface JournalUi {
  readonly status: JournalStatus;
  readonly view: JournalView | null;
  /** the days being written now */
  readonly writing: readonly string[];
}

export const useJournalStore = create<JournalUi>()(() => ({ status: 'idle', view: null, writing: [] }));

/** The calls the store makes (tests replace them). */
export interface JournalApi {
  load(signal: AbortSignal): Promise<JournalView>;
  day(day: string, signal: AbortSignal): Promise<JournalDay>;
  write(day: string, text: string): Promise<JournalEntryView>;
}

const realApi: JournalApi = {
  load: (signal) => apiFetch('journal', { signal }),
  day: (day, signal) => apiFetch('journalDay', { params: { day }, signal }),
  write: (day, text) => apiFetch('journalWrite', { params: { day }, body: { text } }),
};

export interface JournalOptions extends EntryOptions {
  readonly api?: JournalApi;
  /** tests: the model on or off */
  readonly model?: boolean;
}

let run: AbortController | null = null;

/** Whether today's page was written from other facts than the day has now. */
export function isStale(entry: JournalEntryView | null, facts: readonly JournalFact[]): boolean {
  if (entry === null) return false;
  const a = entry.facts.map((f) => `${f.kind}:${f.text}`).join('|');
  const b = facts.map((f) => `${f.kind}:${f.text}`).join('|');
  return a !== b;
}

function setWriting(day: string, on: boolean): void {
  useJournalStore.setState((st) => ({ writing: on ? [...st.writing.filter((d) => d !== day), day] : st.writing.filter((d) => d !== day) }));
}

/** Puts a written page into the view: the entries newest first, today's entry, the day off the unwritten list. */
function placeEntry(e: JournalEntryView): void {
  useJournalStore.setState((st) => {
    if (st.view === null) return {};
    const entries = [e, ...st.view.entries.filter((x) => x.day !== e.day)].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    const today = st.view.today.day === e.day ? { ...st.view.today, entry: e } : st.view.today;
    return { view: { today, unwritten: st.view.unwritten.filter((d) => d !== e.day), entries } };
  });
}

/** Writes one day's page: the model's entry when it holds, else the template; stored, then shown. */
async function writeDay(day: JournalDay, signal: AbortSignal, o: JournalOptions): Promise<JournalEntryView | null> {
  if (day.facts.length === 0) return null;
  const api = o.api ?? realApi;
  setWriting(day.day, true);
  try {
    const words = (o.model ?? MODEL_ON) ? await writeEntry(day.dayNumber, day.facts, { ...o, signal }) : null;
    if (signal.aborted) return null;
    const saved = await api.write(day.day, words ?? templateEntry(day.dayNumber, day.facts));
    if (signal.aborted) return null;
    placeEntry(saved);
    return saved;
  } catch (_e) {
    return null;
  } finally {
    setWriting(day.day, false);
  }
}

/** Opens the journal: the pages at once, then the missing ones written one by one. */
export async function openJournal(o: JournalOptions = {}): Promise<void> {
  run?.abort();
  const ctl = new AbortController();
  run = ctl;
  const api = o.api ?? realApi;
  useJournalStore.setState({ status: 'loading', writing: [] });
  let view: JournalView;
  try {
    view = await api.load(ctl.signal);
  } catch (e) {
    if (ctl.signal.aborted) return;
    useJournalStore.setState({ status: isApiFailure(e) && e.error.code === 'npcToolsOff' ? 'off' : 'error' });
    return;
  }
  if (ctl.signal.aborted) return;
  useJournalStore.setState({ status: 'ready', view });
  if (view.today.entry === null && view.today.facts.length > 0) await writeDay(view.today, ctl.signal, o);
  for (const d of view.unwritten) {
    if (ctl.signal.aborted) return;
    try {
      const day = await api.day(d, ctl.signal);
      if (day.entry === null) await writeDay(day, ctl.signal, o);
    } catch (_e) {
      // that day waits for the next visit
    }
  }
}

/** Reads today again and writes today's page anew. */
export async function rewriteToday(o: JournalOptions = {}): Promise<void> {
  const st = useJournalStore.getState();
  if (st.view === null || st.writing.includes(st.view.today.day)) return;
  const api = o.api ?? realApi;
  const signal = (run ?? new AbortController()).signal;
  try {
    const day = await api.day(st.view.today.day, signal);
    useJournalStore.setState((s) => (s.view === null ? {} : { view: { ...s.view, today: { ...day, entry: s.view.today.entry } } }));
    await writeDay(day, signal, o);
  } catch (_e) {
    toast('warn', 'Today could not be written just now.');
  }
}

/** The screen closed: the writing stops (written pages stay). */
export function closeJournal(): void {
  run?.abort();
  run = null;
  useJournalStore.setState({ writing: [] });
}

/** Copies a page to the clipboard. */
export async function copyEntry(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast('success', 'Copied the page.');
    return true;
  } catch (_e) {
    toast('warn', 'The page could not be copied.');
    return false;
  }
}
