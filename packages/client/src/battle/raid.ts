/**
 * Phase C1 — raid model helpers shared by the scene (World3D → BattleController `raidInfo`, the den), the lobby modal
 * and the in-battle raid panel. Everything here reads `room.state.raid` (protocol `RaidState`, broadcast to every
 * client: id, bossSpecies, bossLevel, hpPct — the only boss HP a raid shares —, phase, roundEndsInMs, damageBoard,
 * x, z) in place; nothing is copied into a store (§20.0 rule 2).
 *
 * The server constants live in `packages/server/src/rooms/raidSession.ts`; the client may not import the server, so
 * the two it needs are mirrored here.
 */
import { RAID_HOTSPOTS } from '@ewa/content';
import type { ZoneState } from '@ewa/protocol';
import type { Primitive } from '../net/useRoomState';

/** server `RAID_JOIN_RANGE_M`: `raidJoin` is refused farther than this from the hotspot */
export const RAID_JOIN_RANGE_M = 8;
/** server `RAID_MAX_PLAYERS` */
export const RAID_MAX_PLAYERS = 8;

/** 0 lobby · 1 fight · 2 enraged (hpPct < 0.3) · 3 catch window · 4 over (protocol `RaidState.phase`) */
export type RaidPhaseId = 0 | 1 | 2 | 3 | 4;

export const RAID_PHASE_LABEL: Readonly<Record<RaidPhaseId, string>> = {
  0: 'Lobby',
  1: 'Fight',
  2: 'Enraged',
  3: 'Catch window',
  4: 'Over',
};

export function phaseLabel(phase: number): string {
  return RAID_PHASE_LABEL[(phase >= 0 && phase <= 4 ? phase : 4) as RaidPhaseId];
}

export interface RaidBoardRow {
  readonly playerId: string;
  /** the player's name when their avatar is in view (AOI), else a neutral label */
  readonly name: string;
  readonly damage: number;
  readonly self: boolean;
}

/** The scene's snapshot of the open raid (BattleController `raidInfo`, the den, the summary card). */
export interface RaidInfo {
  readonly id: string;
  readonly phase: RaidPhaseId;
  readonly hpPct: number;
  readonly bossSpecies: string;
  readonly bossLevel: number;
  readonly roundEndsInMs: number;
  readonly x: number;
  readonly z: number;
  /** damage descending, then name */
  readonly board: readonly RaidBoardRow[];
}

const OTHER = 'A trainer';

/** The damage board, highest first (ties by name, then id, so it is stable between patches). */
export function boardRows(state: ZoneState, selfId: string, selfName = 'You'): RaidBoardRow[] {
  const r = state.raid;
  if (r === null || r === undefined) return [];
  const rows: RaidBoardRow[] = [];
  r.damageBoard.forEach((damage: number, playerId: string) => {
    const self = playerId === selfId;
    const name = state.players.get(playerId)?.name ?? (self ? selfName : OTHER);
    rows.push({ playerId, name, damage, self });
  });
  rows.sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name) || (a.playerId < b.playerId ? -1 : 1));
  return rows;
}

export function raidInfoOf(state: ZoneState, selfId: string): RaidInfo | null {
  const r = state.raid;
  if (r === null || r === undefined || r.id === '') return null;
  const phase = (r.phase >= 0 && r.phase <= 4 ? r.phase : 4) as RaidPhaseId;
  return {
    id: r.id, phase, hpPct: Math.max(0, Math.min(1, r.hpPct)), bossSpecies: r.bossSpecies, bossLevel: r.bossLevel,
    roundEndsInMs: r.roundEndsInMs, x: r.x, z: r.z, board: boardRows(state, selfId),
  };
}

/**
 * The board flattened to primitives for `useRoomState` (which only returns primitives / arrays of primitives):
 * `[playerId, name, damage, self, …]`. `raidId` restricts it to that raid ('' = whichever is open).
 */
export function boardFlat(state: ZoneState, selfId: string, raidId = ''): readonly Primitive[] {
  const r = state.raid;
  if (r === null || r === undefined || (raidId !== '' && r.id !== raidId)) return NO_BOARD;
  const out: Primitive[] = [];
  for (const row of boardRows(state, selfId)) out.push(row.playerId, row.name, row.damage, row.self);
  return out;
}
const NO_BOARD: readonly Primitive[] = [];

export function unflattenBoard(flat: readonly Primitive[]): RaidBoardRow[] {
  const rows: RaidBoardRow[] = [];
  for (let i = 0; i + 3 < flat.length; i += 4) {
    rows.push({ playerId: String(flat[i]), name: String(flat[i + 1]), damage: Number(flat[i + 2]), self: flat[i + 3] === true });
  }
  return rows;
}

/** `m:ss` for a lobby / catch-window countdown, `Ns` under a minute (rounds up: the server patches whole seconds). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** The phase's countdown line ("Starts in 1:12", "Round ends in 14s", …). */
export function countdownLine(phase: number, ms: number): string {
  switch (phase) {
    case 0:
      return `Starts in ${formatCountdown(ms)} — or as soon as everyone is ready`;
    case 1:
    case 2:
      return `Round ends in ${formatCountdown(ms)}`;
    case 3:
      return `Catch window closes in ${formatCountdown(ms)}`;
    default:
      return 'The raid is over';
  }
}

/** The badge requirement of the hotspot a raid opened at (content `RAID_HOTSPOTS`; matched by boss and position). */
export function raidMinBadges(bossSpecies: string, x: number, z: number): number {
  let best: number | null = null;
  let bd = Number.POSITIVE_INFINITY;
  for (const h of RAID_HOTSPOTS) {
    if (h.boss.species !== bossSpecies) continue;
    const d = Math.hypot(h.x - x, h.z - z);
    if (d < bd) {
      bd = d;
      best = h.minBadges;
    }
  }
  return best ?? 0;
}
