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
 *
 * Phase D6 doubles (`setLayout(true)`): four bars keyed to the stage refs (side, slot = field position 0 / 1), in the
 * order near 0, near 1, far 0, far 1 (`STAGE_REFS_DOUBLES`); every setter takes the field position as its last
 * argument (default 0). Render's HudLayer anchors each bar over its own battler and keeps the four apart. Singles keeps
 * the two bars [near, far] exactly as before.
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
  /** the creature's type(s), drawn as badges on the plate (§50.1 #15; audit M2-battle-7) */
  types: readonly string[];
}

export interface BattleHudModel {
  bars: BarState[];
  turnLabel: string;
  shakes: number;
}

/** The singles stage refs: one active battler per stage side, at render slot 0 (index = stage side). */
export const STAGE_REFS: readonly [{ readonly side: 0; readonly slot: 0 }, { readonly side: 1; readonly slot: 0 }] = [
  { side: 0, slot: 0 },
  { side: 1, slot: 0 },
];

type StageRef = { readonly side: 0 | 1; readonly slot: 0 | 1 };
/** Phase D6: the doubles stage refs — render slot = field position; index = stage side × 2 + position. */
export const STAGE_REFS_DOUBLES: readonly [StageRef, StageRef, StageRef, StageRef] = [
  { side: 0, slot: 0 },
  { side: 0, slot: 1 },
  { side: 1, slot: 0 },
  { side: 1, slot: 1 },
];

const STAT_ORDER: readonly StatKey[] = ['atk', 'def', 'spd', 'acc', 'eva'];
/** Flip on once render's HUD keeps the turn label clear of the battler bars. */
export const CANVAS_TURN_LABEL = false;

const NO_TYPES: readonly string[] = Object.freeze([]);

function makeModel(doubles = false): BattleHudModel {
  const refs: readonly { readonly side: 0 | 1; readonly slot: number }[] = doubles ? STAGE_REFS_DOUBLES : STAGE_REFS;
  return {
    bars: refs.map((who) => ({ who, name: '', level: 1, hp: 0, maxHp: 1, status: null, stages: '', showNumbers: who.side === 0, types: NO_TYPES })),
    turnLabel: '',
    shakes: 0,
  };
}

export class BattleHud {
  private buffers: readonly [BattleHudModel, BattleHudModel] = [makeModel(), makeModel()];
  private front = 0;
  private dirty = false;
  private active = false;
  /** stage deltas per bar, STAT_ORDER order */
  private readonly stagesByBar: readonly Int8Array[] = [new Int8Array(5), new Int8Array(5), new Int8Array(5), new Int8Array(5)];
  /** the viewer's core side (stage position 0) */
  private seat: 0 | 1 = 0;
  /** Phase D6: four bars (two per side) */
  private doubles = false;

  constructor(private readonly sink: (m: BattleHudModel | null) => void) {}

  private back(): BattleHudModel {
    return this.buffers[1 - this.front]!;
  }

  /** Copies the front buffer's scalars into the back buffer (so a mutation starts from the current values). */
  private prepare(): BattleHudModel {
    const b = this.back();
    if (this.dirty) return b;
    const f = this.buffers[this.front]!;
    for (let i = 0; i < f.bars.length; i++) {
      const src = f.bars[i]!;
      const dst = b.bars[i]!;
      dst.name = src.name; dst.level = src.level; dst.hp = src.hp; dst.maxHp = src.maxHp;
      dst.status = src.status; dst.stages = src.stages; dst.showNumbers = src.showNumbers; dst.types = src.types;
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

  /**
   * Phase D6: two bars (singles) or four (doubles). Call at battle start, before the first setBar; a change rebuilds
   * both buffers (the only allocation, once per battle).
   */
  setLayout(doubles: boolean): void {
    if (doubles === this.doubles) return;
    this.doubles = doubles;
    this.buffers = [makeModel(doubles), makeModel(doubles)];
    this.front = 0;
    this.dirty = false;
    for (const s of this.stagesByBar) s.fill(0);
  }

  get isDoubles(): boolean {
    return this.doubles;
  }

  /** Bar index of a core side's field position (singles: the stage side). */
  private at(side: 0 | 1, pos: 0 | 1 = 0): number {
    const st = side ^ this.seat;
    return this.doubles ? st * 2 + pos : st;
  }

  /** Full bar reset (battle start, switch-in, resync). */
  setBar(side: 0 | 1, name: string, level: number, hp: number, maxHp: number, status: string | null, showNumbers: boolean, types: readonly string[] = NO_TYPES, pos: 0 | 1 = 0): void {
    const i = this.at(side, pos);
    const bar = this.prepare().bars[i]!;
    bar.name = name; bar.level = level; bar.hp = hp; bar.maxHp = Math.max(1, maxHp); bar.status = status; bar.showNumbers = showNumbers; bar.types = types;
    this.stagesByBar[i]!.fill(0);
    bar.stages = '';
    this.active = true;
  }

  /** A battle form with its own types (hyoryu's Majin Form) re-labels the plate; hp, status and stages stay. */
  setTypes(side: 0 | 1, types: readonly string[], pos: 0 | 1 = 0): void {
    this.prepare().bars[this.at(side, pos)]!.types = types;
  }

  setHp(side: 0 | 1, hp: number, maxHp: number, pos: 0 | 1 = 0): void {
    const bar = this.prepare().bars[this.at(side, pos)]!;
    bar.hp = hp;
    if (maxHp > 0) bar.maxHp = maxHp;
  }

  setLevel(side: 0 | 1, level: number, maxHp: number, pos: 0 | 1 = 0): void {
    const bar = this.prepare().bars[this.at(side, pos)]!;
    bar.level = level;
    if (maxHp > 0) bar.maxHp = maxHp;
  }

  setStatus(side: 0 | 1, status: string | null, pos: 0 | 1 = 0): void {
    this.prepare().bars[this.at(side, pos)]!.status = status;
  }

  addStage(side: 0 | 1, stat: string, delta: number, pos: 0 | 1 = 0): void {
    const i = STAT_ORDER.indexOf(stat as StatKey);
    if (i < 0) return;
    const b = this.at(side, pos);
    const s = this.stagesByBar[b]!;
    s[i] = Math.max(-6, Math.min(6, s[i]! + delta));
    this.prepare().bars[b]!.stages = this.stageText(b);
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

  private stageText(bar: number): string {
    const s = this.stagesByBar[bar]!;
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
    for (const s of this.stagesByBar) s.fill(0);
    this.sink(null);
  }

  /** Test/inspection: the model the HUD currently shows. */
  current(): Readonly<BattleHudModel> | null {
    return this.active ? this.buffers[this.front]! : null;
  }
}
