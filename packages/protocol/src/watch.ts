/**
 * Watching battles in the open world: every battle in a zone shows its creatures in its spectator ring, and a player
 * near it can follow it turn by turn.
 *
 * Only what both trainers in the fight already see goes out: the creatures on the field (species, look, level), their
 * hp as a percentage (never the exact number), the moves used, what hit, missed, fainted, the status changes, a catch
 * and the end. No exp, no bench, no held items, no exact hp, no nicknames.
 *
 * - `BattleSummary` (room state, every client) carries the field as it stands after the last turn (`watchField`), so a
 *   player who walks up mid fight sees the creatures at once.
 * - `battleWatch` (a room message to players within `SPECTATE_RANGE_M` of the ring, never to the fighters) carries a
 *   turn as `WatchEvent`s (`watchEvents`); the client plays them on the ring and words them in the Watch panel.
 */
import { formsOf } from '@ewa/core';
import type { BattleEvent, BattleState, ContentIndex, Ref, StatusId } from '@ewa/core';
import { z } from 'zod';
import { encodeLeadFlags } from './state/PlayerState';

/** A ring is dressed (and its feed sent) for players within this distance of its centre (the old spectator rule). */
export const SPECTATE_RANGE_M = 40;
/** "Watch" is offered this close to a ring's centre (the ring is 7 m across; the trainers stand 4.45 m out). */
export const WATCH_RANGE_M = 9;
/** The Watch panel keeps this many lines. */
export const WATCH_LOG_MAX = 6;

/** One creature on a battle's field, as a spectator sees it. */
export interface WatchBattler {
  readonly side: 0 | 1;
  /** the field position (0, or 1 in doubles) */
  readonly pos: 0 | 1;
  readonly species: string;
  /** `encodeLeadFlags`: shiny, alpha, variant and the battle form's slot in `formsOf` */
  readonly flags: number;
  readonly level: number;
  /** 0..100, rounded up while standing (1 hp shows 1 %), 0 fainted */
  readonly hpPct: number;
  /** the major status ('' none) */
  readonly status: string;
}

export type WatchEffect = 'none' | 'weak' | 'normal' | 'super';

export type WatchEvent =
  | { readonly k: 'in'; readonly b: WatchBattler }
  | { readonly k: 'move'; readonly side: 0 | 1; readonly pos: 0 | 1; readonly move: string }
  | { readonly k: 'miss'; readonly side: 0 | 1; readonly pos: 0 | 1 }
  | { readonly k: 'hit'; readonly side: 0 | 1; readonly pos: 0 | 1; readonly hpPct: number; readonly eff: WatchEffect; readonly crit: boolean; readonly byMove: boolean }
  | { readonly k: 'heal'; readonly side: 0 | 1; readonly pos: 0 | 1; readonly hpPct: number }
  | { readonly k: 'status'; readonly side: 0 | 1; readonly pos: 0 | 1; readonly status: string }
  | { readonly k: 'form'; readonly b: WatchBattler }
  | { readonly k: 'faint'; readonly side: 0 | 1; readonly pos: 0 | 1 }
  | { readonly k: 'throw'; readonly side: 0 | 1 }
  | { readonly k: 'catch'; readonly caught: boolean }
  | { readonly k: 'fled'; readonly side: 0 | 1 }
  | { readonly k: 'forfeit'; readonly side: 0 | 1 }
  | { readonly k: 'end'; readonly winner: 0 | 1 | 'draw' | 'fled' | 'caught' };

const MAJOR: ReadonlySet<StatusId> = new Set<StatusId>(['burn', 'poison', 'paralyze', 'sleep', 'freeze']);

function pct(hp: number, maxHp: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.min(100, Math.max(1, Math.ceil((hp / maxHp) * 100)));
}

/** The field positions of a side: singles [active], doubles its `actives`. */
function fieldOf(state: BattleState, side: 0 | 1): readonly number[] {
  const s = state.sides[side];
  return state.slots === 2 && s.actives !== undefined ? s.actives : [s.active];
}

/** The field position a party slot stands on (0 when it is not on the field: singles, or a doubles switch-out). */
function posOf(state: BattleState, r: Ref): 0 | 1 {
  return fieldOf(state, r.side).indexOf(r.slot) === 1 ? 1 : 0;
}

function battlerAt(state: BattleState, side: 0 | 1, slot: number, pos: 0 | 1, content: ContentIndex, hp?: number): WatchBattler | null {
  const b = state.sides[side].party[slot];
  if (b === undefined) return null;
  const c = b.creature;
  let form = 0;
  if (b.form !== undefined) {
    try {
      form = formsOf(content.species(c.speciesId)).findIndex((f) => f.id === b.form) + 1;
    } catch {
      form = 0;
    }
  }
  return {
    side,
    pos,
    species: c.speciesId,
    flags: encodeLeadFlags({ isShiny: c.isShiny === true, isAlpha: c.isAlpha, variantKey: c.variantKey, form }),
    level: c.level,
    hpPct: pct(hp ?? c.hp, b.maxHp),
    status: c.status.find((s) => MAJOR.has(s)) ?? '',
  };
}

/** The creatures on the field after a turn (the `BattleSummary` copy), side 0 first. */
export function watchField(state: BattleState, content: ContentIndex): WatchBattler[] {
  const out: WatchBattler[] = [];
  for (const side of [0, 1] as const) {
    const f = fieldOf(state, side);
    for (let p = 0; p < f.length; p++) {
      const b = battlerAt(state, side, f[p]!, p === 1 ? 1 : 0, content);
      if (b !== null) out.push(b);
    }
  }
  return out;
}

function effOf(e: number): WatchEffect {
  if (e === 0) return 'none';
  if (e < 1) return 'weak';
  return e > 1 ? 'super' : 'normal';
}

/**
 * A resolved turn as a spectator sees it. `after` is the state the turn produced (party slots never move, so a ref
 * names the same creature before and after); positions are read from it, which places a switch-in where it landed.
 */
export function watchEvents(after: BattleState, events: readonly BattleEvent[], content: ContentIndex): WatchEvent[] {
  const out: WatchEvent[] = [];
  for (const e of events) {
    switch (e.t) {
      case 'switchIn': {
        const pos = e.pos ?? posOf(after, e.who);
        const b = battlerAt(after, e.who.side, e.who.slot, pos, content);
        // the hp it came in with: the state's hp is the end of the turn, a later hit this turn sends its own event
        if (b !== null) out.push({ k: 'in', b });
        break;
      }
      case 'moveUsed':
        out.push({ k: 'move', side: e.who.side, pos: posOf(after, e.who), move: e.move });
        break;
      case 'moveMissed':
        out.push({ k: 'miss', side: e.who.side, pos: posOf(after, e.who) });
        break;
      case 'damage':
        out.push({ k: 'hit', side: e.target.side, pos: posOf(after, e.target), hpPct: pct(e.hpAfter, e.maxHp), eff: effOf(e.effectiveness), crit: e.crit, byMove: e.cause === 'move' });
        break;
      case 'heal': {
        const b = after.sides[e.target.side].party[e.target.slot];
        if (b !== undefined) out.push({ k: 'heal', side: e.target.side, pos: posOf(after, e.target), hpPct: pct(e.hpAfter, b.maxHp) });
        break;
      }
      case 'statusApplied':
        out.push({ k: 'status', side: e.target.side, pos: posOf(after, e.target), status: e.status });
        break;
      case 'formChange': {
        const b = battlerAt(after, e.who.side, e.who.slot, posOf(after, e.who), content);
        if (b !== null) out.push({ k: 'form', b });
        break;
      }
      case 'faint':
        out.push({ k: 'faint', side: e.who.side, pos: posOf(after, e.who) });
        break;
      case 'catchThrow':
        out.push({ k: 'throw', side: e.target.side === 1 ? 0 : 1 });
        break;
      case 'catchResult':
        out.push({ k: 'catch', caught: e.caught });
        break;
      case 'fled':
        out.push({ k: 'fled', side: e.side });
        break;
      case 'forfeit':
        out.push({ k: 'forfeit', side: e.side });
        break;
      case 'battleEnd':
        out.push({ k: 'end', winner: e.outcome.winner });
        break;
      default:
        break;
    }
  }
  return out;
}

// ---- the wire ---------------------------------------------------------------------------------------------------------

const Side = z.union([z.literal(0), z.literal(1)]);
const Pct = z.number().int().min(0).max(100);

export const WatchBattlerSchema = z.object({
  side: Side,
  pos: Side,
  species: z.string().min(1).max(64),
  flags: z.number().int().min(0).max(255),
  level: z.number().int().min(1).max(100),
  hpPct: Pct,
  status: z.string().max(16),
});

export const WatchEventSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('in'), b: WatchBattlerSchema }),
  z.object({ k: z.literal('move'), side: Side, pos: Side, move: z.string().min(1).max(64) }),
  z.object({ k: z.literal('miss'), side: Side, pos: Side }),
  z.object({ k: z.literal('hit'), side: Side, pos: Side, hpPct: Pct, eff: z.enum(['none', 'weak', 'normal', 'super']), crit: z.boolean(), byMove: z.boolean() }),
  z.object({ k: z.literal('heal'), side: Side, pos: Side, hpPct: Pct }),
  z.object({ k: z.literal('status'), side: Side, pos: Side, status: z.string().max(16) }),
  z.object({ k: z.literal('form'), b: WatchBattlerSchema }),
  z.object({ k: z.literal('faint'), side: Side, pos: Side }),
  z.object({ k: z.literal('throw'), side: Side }),
  z.object({ k: z.literal('catch'), caught: z.boolean() }),
  z.object({ k: z.literal('fled'), side: Side }),
  z.object({ k: z.literal('forfeit'), side: Side }),
  z.object({ k: z.literal('end'), winner: z.union([z.literal(0), z.literal(1), z.literal('draw'), z.literal('fled'), z.literal('caught')]) }),
]);

/** A turn of a battle near the player (never one of theirs). */
export const BattleWatchMsg = z.object({
  type: z.literal('battleWatch'),
  battleId: z.string().min(1),
  turn: z.number().int().min(1),
  events: z.array(WatchEventSchema).max(200),
});

export interface BattleWatchServerMessage {
  readonly type: 'battleWatch';
  readonly battleId: string;
  readonly turn: number;
  readonly events: readonly WatchEvent[];
}

/**
 * `BattleSummary.trainers`: what each side is called. A player's name as it is; an NPC trainer `npc:<trainerId>` (the
 * client names it the way its own battles do); a wild side ''. A username never holds a colon.
 */
export const NPC_TRAINER_PREFIX = 'npc:';
