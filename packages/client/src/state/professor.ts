/**
 * Prof. Wynn (LLM feature 5): the "Ask the Professor" conversation and the "Why did I lose?" review.
 *
 * - `useProfessorStore`: the questions asked this session, newest last (at most `MAX_ENTRIES`). `askProfessor` puts the
 *   facts in at once (talk/professorFacts.ts, from the session snapshot) and the professor's words when the model has
 *   them; facts only when the model is down, slow, wrong or switched off (`VITE_NPC_TALK=0`).
 * - `useLossReviewStore`: the battle log (the battle's start state and every event its timelines played, written by
 *   `createBattleLogger`, which World3D tees beside the commentator) and the review the result card asked for.
 *   `openLossReview` computes the facts (battle/lossFacts.ts) and asks the model to coach with them.
 */
import { create } from 'zustand';
import type { BattleEvent } from '@ewa/core';
import { speciesName } from '../data/content';
import { lossReport, fallbackLines } from '../battle/lossFacts';
import type { BattleLog, LossReport } from '../battle/lossFacts';
import type { Commentator } from '../battle/commentator';
import { lossMessages, mineOf, phrase, answerMessages } from '../talk/professor';
import type { PhraseOptions } from '../talk/professor';
import { factsFor, saveOf } from '../talk/professorFacts';
import type { FactSheet, ProfSave } from '../talk/professorFacts';
import { useSessionStore } from './session';

const MODEL_ON = (import.meta.env as Record<string, string | undefined> | undefined)?.['VITE_NPC_TALK'] !== '0';

/** the questions the panel keeps */
export const MAX_ENTRIES = 6;
/** a question longer than this is cut (the prompt stays small) */
export const MAX_QUESTION = 160;

export interface ProfEntry {
  readonly id: number;
  readonly question: string;
  readonly sheet: FactSheet;
  /** the professor's words; null while thinking or when the facts stand alone */
  readonly text: string | null;
  readonly pending: boolean;
}

interface ProfessorState {
  readonly entries: readonly ProfEntry[];
}

export const useProfessorStore = create<ProfessorState>()(() => ({ entries: [] }));

let nextId = 1;
let askAbort: AbortController | null = null;

/** The professor's snapshot of the player, from the session store. */
export function currentSave(): ProfSave {
  const s = useSessionStore.getState();
  return saveOf({ progression: s.progression, inventory: s.inventory, zoneId: s.zoneId });
}

function patch(id: number, p: Partial<ProfEntry>): void {
  useProfessorStore.setState((st) => ({ entries: st.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
}

/**
 * Asks the professor: the facts show at once, the words follow. A newer question cancels the one still thinking (its
 * facts stay). `o` is for tests (the model, a timeout).
 */
export async function askProfessor(question: string, o: PhraseOptions & { readonly model?: boolean } = {}): Promise<void> {
  const q = question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
  if (q === '') return;
  askAbort?.abort();
  const ctl = new AbortController();
  askAbort = ctl;
  const save = currentSave();
  const sheet = factsFor(q, save);
  const id = nextId++;
  const useModel = o.model ?? MODEL_ON;
  useProfessorStore.setState((st) => ({ entries: [...st.entries.map((e) => (e.pending ? { ...e, pending: false } : e)), { id, question: q, sheet, text: null, pending: useModel }].slice(-MAX_ENTRIES) }));
  if (!useModel) return;
  const text = await phrase(answerMessages(q, sheet.facts), sheet.facts, q, mineOf(save, speciesName), { ...o, signal: ctl.signal });
  if (ctl.signal.aborted) return;
  patch(id, { text, pending: false });
  if (askAbort === ctl) askAbort = null;
}

export function clearProfessor(): void {
  askAbort?.abort();
  askAbort = null;
  useProfessorStore.setState({ entries: [] });
}

// ---- the loss review ----------------------------------------------------------------------------------------------

export interface LossReview {
  readonly battleId: string;
  readonly report: LossReport | null;
  /** the professor's coaching; null while thinking or when the facts stand alone */
  readonly text: string | null;
  /** the facts shown without the model */
  readonly lines: readonly string[];
  readonly pending: boolean;
}

interface LossReviewState {
  readonly log: BattleLog | null;
  readonly review: LossReview | null;
}

export const useLossReviewStore = create<LossReviewState>()(() => ({ log: null, review: null }));

let reviewAbort: AbortController | null = null;

/**
 * The battle log as a Commentator (BattleController hands every commentator the battle's start, each timeline's events
 * and the end): it keeps the start state and the events until the battle is over and its card dismissed.
 */
export function createBattleLogger(): Commentator {
  let events: BattleEvent[] = [];
  return {
    begin(b) {
      reviewAbort?.abort();
      events = [];
      useLossReviewStore.setState({ log: b.spectator || b.format === 'raid' ? null : { battleId: b.battleId, seat: b.seat, start: b.state, events }, review: null });
    },
    timeline(evs) {
      if (useLossReviewStore.getState().log === null) return;
      for (const e of evs) events.push(e);
    },
    played() {},
    end() {
      reviewAbort?.abort();
      reviewAbort = null;
      events = [];
      useLossReviewStore.setState({ log: null, review: null });
    },
  };
}

/** Two commentators as one (World3D: the commentator and the battle logger). */
export function teeCommentary(a: Commentator, b: Commentator): Commentator {
  return {
    begin: (x) => {
      a.begin(x);
      b.begin(x);
    },
    timeline: (e, f) => {
      a.timeline(e, f);
      b.timeline(e, f);
    },
    played: () => {
      a.played();
      b.played();
    },
    end: () => {
      a.end();
      b.end();
    },
  };
}

/** Whether the result card can offer "Why did I lose?": a log with a landed hit. */
export function canReview(log: BattleLog | null): boolean {
  return log !== null && log.events.some((e) => e.t === 'damage' && e.cause === 'move');
}

/** "Why did I lose?": the facts at once, the coaching when the model has it. */
export async function openLossReview(o: PhraseOptions & { readonly model?: boolean } = {}): Promise<void> {
  const log = useLossReviewStore.getState().log;
  if (log === null) return;
  if (useLossReviewStore.getState().review?.battleId === log.battleId) return;
  const save = currentSave();
  const report = lossReport(log, save);
  const lines = report === null ? ['Nothing landed in that battle: try again with a full party.'] : fallbackLines(report);
  const useModel = (o.model ?? MODEL_ON) && report !== null;
  useLossReviewStore.setState({ review: { battleId: log.battleId, report, text: null, lines, pending: useModel } });
  if (!useModel || report === null) return;
  reviewAbort?.abort();
  const ctl = new AbortController();
  reviewAbort = ctl;
  const text = await phrase(lossMessages(report.facts), report.facts, '', mineOf(save, speciesName), { ...o, signal: ctl.signal });
  if (ctl.signal.aborted) return;
  const cur = useLossReviewStore.getState().review;
  if (cur?.battleId !== log.battleId) return;
  useLossReviewStore.setState({ review: { ...cur, text, pending: false } });
}
