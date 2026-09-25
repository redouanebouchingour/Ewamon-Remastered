/**
 * The in-canvas battle HUD model (SPEC §20.5.6 / §20.6 `HudModel.battle`): both active battlers' bars (name, level,
 * HP — numbers on the viewer's side only —, status glyph, stage arrows), the turn label and the orb shake counter.
 *
 * Render's HudLayer detects a change by reference (`v === model[f]` is "unchanged"), so the model is double-buffered:
 * mutations write the back buffer's scalars and `commit()` hands the writer the swapped buffer — no allocation per
 * update. Bars are keyed to the STAGE refs (side, slot 0): the stage shows one active battler per side and the HUD
 * anchors each bar to `stage.projectBattler(ref)`. Render's stage side 0 is the near (viewer's) position, so the
 * setters take CORE sides and map them through the viewer's seat (`setSeat`): the seat-1 player of a pvp battle sees
 * their own creature near, like everyone else.
 */
import type { StatKey } from '@ewa/core';
import { STAT_SHORT } from './timeline';

export interface BarState {
  who: { readonly side: 0 | 1; readonly slot: number };
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  status: string | null;
  stages: string;
  showNumbers: boolean;
}

export interface BattleHudModel {
  bars: BarState[];
  turnLabel: string;
  shakes: number;
}

/** The two stage positions (one active battler per side in v1 formats). */
export const STAGE_REFS: readonly [{ readonly side: 0; readonly slot: 0 }, { readonly side: 1; readonly slot: 0 }] = [
  { side: 0, slot: 0 },
  { side: 1, slot: 0 },
];

const STAT_ORDER: readonly StatKey[] = ['atk', 'def', 'spd', 'acc', 'eva'];
/** Flip on once render's HUD keeps the turn label clear of the battler bars. */
export const CANVAS_TURN_LABEL = false;

function makeModel(): BattleHudModel {
  return {
    bars: [0, 1].map((side) => ({ who: STAGE_REFS[side as 0 | 1], name: '', level: 1, hp: 0, maxHp: 1, status: null, stages: '', showNumbers: side === 0 })),
    turnLabel: '',
    shakes: 0,
  };
}

export class BattleHud {
  private readonly buffers: readonly [BattleHudModel, BattleHudModel] = [makeModel(), makeModel()];
  private front = 0;
  private dirty = false;
  private active = false;
  /** stage deltas per side, STAT_ORDER order */
  private readonly stagesBySide: readonly [Int8Array, Int8Array] = [new Int8Array(5), new Int8Array(5)];
  /** the viewer's core side (stage position 0) */
  private seat: 0 | 1 = 0;

  constructor(private readonly sink: (m: BattleHudModel | null) => void) {}

  private back(): BattleHudModel {
    return this.buffers[1 - this.front]!;
  }

  /** Copies the front buffer's scalars into the back buffer (so a mutation starts from the current values). */
  private prepare(): BattleHudModel {
    const b = this.back();
    if (this.dirty) return b;
    const f = this.buffers[this.front]!;
    for (let i = 0; i < 2; i++) {
      const src = f.bars[i]!;
      const dst = b.bars[i]!;
      dst.name = src.name; dst.level = src.level; dst.hp = src.hp; dst.maxHp = src.maxHp;
      dst.status = src.status; dst.stages = src.stages; dst.showNumbers = src.showNumbers;
    }
    b.turnLabel = f.turnLabel;
    b.shakes = f.shakes;
    this.dirty = true;
    return b;
  }

  get isActive(): boolean {
    return this.active;
  }

  /** The viewer's core side; call before the first setBar of a battle. */
  setSeat(seat: 0 | 1): void {
    this.seat = seat;
  }

  /** Stage position (bar index) of a core side. */
  private at(side: 0 | 1): 0 | 1 {
    return (side ^ this.seat) as 0 | 1;
  }

  /** Full bar reset (battle start, switch-in, resync). */
  setBar(side: 0 | 1, name: string, level: number, hp: number, maxHp: number, status: string | null, showNumbers: boolean): void {
    const bar = this.prepare().bars[this.at(side)]!;
    bar.name = name; bar.level = level; bar.hp = hp; bar.maxHp = Math.max(1, maxHp); bar.status = status; bar.showNumbers = showNumbers;
    this.stagesBySide[side].fill(0);
    bar.stages = '';
    this.active = true;
  }

  setHp(side: 0 | 1, hp: number, maxHp: number): void {
    const bar = this.prepare().bars[this.at(side)]!;
    bar.hp = hp;
    if (maxHp > 0) bar.maxHp = maxHp;
  }

  setLevel(side: 0 | 1, level: number, maxHp: number): void {
    const bar = this.prepare().bars[this.at(side)]!;
    bar.level = level;
    if (maxHp > 0) bar.maxHp = maxHp;
  }

  setStatus(side: 0 | 1, status: string | null): void {
    this.prepare().bars[this.at(side)]!.status = status;
  }

  addStage(side: 0 | 1, stat: string, delta: number): void {
    const i = STAT_ORDER.indexOf(stat as StatKey);
    if (i < 0) return;
    const s = this.stagesBySide[side];
    s[i] = Math.max(-6, Math.min(6, s[i]! + delta));
    this.prepare().bars[this.at(side)]!.stages = this.stageText(side);
  }

  setShakes(n: number): void {
    this.prepare().shakes = n;
  }

  /**
   * The canvas turn label stays empty (IMPLEMENTATION-NOTES part 2, L2): render draws it at a fixed y (16 + 137 px,
   * centre) where the near battler's anchored bar lands in the battle framing, and the two overprint. The DOM battle
   * panel shows the same "Turn n" (BattleOverlay), so nothing is lost; the orb shake dots still draw.
   */
  setTurnLabel(label: string): void {
    const b = this.prepare();
    b.turnLabel = CANVAS_TURN_LABEL ? label : '';
  }

  private stageText(side: 0 | 1): string {
    const s = this.stagesBySide[side];
    let out = '';
    for (let i = 0; i < STAT_ORDER.length; i++) {
      const v = s[i]!;
      if (v === 0) continue;
      out += `${out.length > 0 ? ' ' : ''}${STAT_SHORT[STAT_ORDER[i]!]}${v > 0 ? '▲' : '▼'}${Math.abs(v)}`;
    }
    return out;
  }

  /** Hands the writer the updated buffer (once per step at most). */
  commit(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.front = 1 - this.front;
    this.sink(this.active ? this.buffers[this.front]! : null);
  }

  clear(): void {
    this.active = false;
    this.dirty = false;
    this.stagesBySide[0].fill(0);
    this.stagesBySide[1].fill(0);
    this.sink(null);
  }

  /** Test/inspection: the model the HUD currently shows. */
  current(): Readonly<BattleHudModel> | null {
    return this.active ? this.buffers[this.front]! : null;
  }
}
