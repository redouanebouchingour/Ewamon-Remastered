/**
 * The battle commentary on screen (LLM feature 3): the commentator's caption and the opposing trainer's line, each one
 * at a time (a newer line replaces the one showing; nothing queues). battle/commentator.ts is the only writer;
 * battle/BattleCommentary.tsx shows them and clears each when its time is up. Presentation only.
 */
import { create } from 'zustand';
import type { MomentKind, MomentSide } from '../battle/moments';
import type { TrainerMoment } from '../talk/commentary';

export interface CasterLine {
  readonly id: number;
  readonly battleId: string;
  readonly kind: MomentKind;
  readonly side: MomentSide;
  /** the facts, a filled template ("Critical hit from Bramble!") */
  readonly head: string;
  /** the colour line (the model's bank or a template) */
  readonly text: string;
  readonly fromModel: boolean;
}

export interface TrainerLine {
  readonly id: number;
  readonly battleId: string;
  readonly kind: TrainerMoment;
  readonly speaker: string;
  readonly text: string;
  readonly fromModel: boolean;
}

export interface CommentaryState {
  readonly caster: CasterLine | null;
  readonly trainer: TrainerLine | null;
  /**
   * The lines that closed the battle (the commentator's win / loss / catch, the trainer's win / loss): the result card
   * shows them, so they stay until the battle is gone, after the caption's own time is up.
   */
  readonly finalCaster: CasterLine | null;
  readonly finalTrainer: TrainerLine | null;
}

const EMPTY: CommentaryState = { caster: null, trainer: null, finalCaster: null, finalTrainer: null };
export const useCommentaryStore = create<CommentaryState>()(() => EMPTY);

const CLOSING_CASTER: ReadonlySet<MomentKind> = new Set<MomentKind>(['win', 'loss', 'catch']);

export function showCaster(line: CasterLine): void {
  useCommentaryStore.setState(CLOSING_CASTER.has(line.kind) ? { caster: line, finalCaster: line } : { caster: line });
}

export function showTrainer(line: TrainerLine): void {
  useCommentaryStore.setState(line.kind === 'win' || line.kind === 'loss' ? { trainer: line, finalTrainer: line } : { trainer: line });
}

/** Clears a line if it is still the one showing. */
export function dropCaster(id: number): void {
  if (useCommentaryStore.getState().caster?.id === id) useCommentaryStore.setState({ caster: null });
}

export function dropTrainer(id: number): void {
  if (useCommentaryStore.getState().trainer?.id === id) useCommentaryStore.setState({ trainer: null });
}

export function clearCommentary(): void {
  const st = useCommentaryStore.getState();
  if (st.caster !== null || st.trainer !== null || st.finalCaster !== null || st.finalTrainer !== null) useCommentaryStore.setState(EMPTY);
}
