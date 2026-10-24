/**
 * §30.4 Battle sub-state — `BattleSession` + `BattleCoordinator`.
 *
 * - `state` (core `BattleState`) is the ONLY copy of the truth; every number comes out of `resolveTurn`.
 * - §30.4.2 message → action: notFound (not seated == missing), wrongTurn, validateAction, alreadySubmitted.
 * - §30.4.3 one transaction per resolved turn, in ascending playerId order, BEFORE any `battleEvents` is sent;
 *   a failed transaction leaves `session.state` unchanged (NON-NEGOTIABLE 1).
 * - Badges are written only here, by `awardBadge`, from a league win inside that transaction (NON-NEGOTIABLE 6).
 *
 * No Colyseus import: the room is a `BattleHost` (send + lifecycle hooks), so this module is testable alone.
 */
import { randomUUID } from 'node:crypto';
import { ARENA_TRAINING, CHALLENGE_CLEARED_FLAG, CHALLENGE_FAILED_FLAG, FALLEN_RIBBON, MAJIN_BAND, TENJIN_BAND, TOWER, challengeActive, challengeMetFlag, cupRefusal, isFallen, league as leagueById, leagueRematchFlag, storyBeat as beatById, towerSetReward } from '@ewa/content';
import type { ActiveCup, BadgeId, ChallengeMode, LeagueRematch, LeagueTrainer, LegendaryStatic, TrainerDef, ZoneDef } from '@ewa/content';
import {
  TRAINER_EXP,
  atLevel,
  createBattle,
  createRng,
  digestBattleState,
  eloDelta,
  eloDrawDelta,
  projectBattler,
  replayBattle,
  requiredPositions,
  resolveTurn,
  validateAction,
} from '@ewa/core';
import type { Action, BandKind, BattleEvent, BattleFormat, BattleOutcome, BattleState, ContentIndex, CreatureInstance, Rng, RngState, Side, SideChoice, Terrain, WeatherKind } from '@ewa/core';
import type { ArenaDifficulty, ArenaKind, QuestProgressEntry, RewardsSummary, ServerMessage } from '@ewa/protocol';
import type { BattleStartSnapshot, Db, Repos, StreakState } from '@ewa/persist';
import type { Logger } from '../log';
import type { RoomMetrics } from '../metrics';
import { isPersistedId, newCreature, persistableAfterBattle, withSyntheticId } from '../game/creatures';
import { DAILY_TRAINER, dailyMarks, dailyPuzzle, dailySeed, dailySides } from '../game/daily';
import { failIfNothingLeft, orbsOnly } from '../game/challenge';
import { CHAMPION_SPLIT, badgeSplit } from '../game/speedrun';
import { replayOpts } from '../game/replay';
import { advanceQuests } from '../game/quests';
import type { QuestEvent } from '../game/quests';
import type { SpawnRecord } from './spawnDirector';
import { completeBeatInTx } from './storyBeats';
import { FACTION_POINTS, deedsOf, ecoWeek, seasonAt } from '@ewa/content';
import { countsForEcosystem, takeOf } from '../game/ecosystem';
import { claimGhostBounties, claimNemesisBounty } from '../game/bounties';
import type { BroughtIn } from '../game/bounties';
import { ghostReward, ghostTrainerId } from '@ewa/content';
import { CAMP_RAID_SHADOW, campGuardTrainerId } from '@ewa/content';
import { settleRaid } from '../game/camps';
import { NEMESIS_MAX, nemesisFullName, nemesisPromoteChance, nemesisScarRibbon } from '@ewa/content';
import type { NemesisScar } from '@ewa/content';
import type { Nemesis, Tx } from '@ewa/persist';
import { EMPTY_TRACK, isNemesisSpawn, nemesisCreature, promotionOf, rankUpOf, riseNemesis, trackNemesis } from '../game/nemesis';
import type { NemesisTrack } from '../game/nemesis';
import { villagerTeam } from '../game/villagers';
import { recordNpcDeed } from '../game/npcMemory';
import { villagerNpcId, villagerTrainerId } from '@ewa/protocol';
import type { ZoneId } from '@ewa/content';

export const TURN_DEADLINE_MS = 60_000;
export const REPLACEMENT_DEADLINE_MS = 20_000;
/** The champion id checked anywhere in server code (NON-NEGOTIABLE 11). */
export const CHAMPION_ID = 'zeon';
export const CHAMPION_FLAG = 'champion:zeon:beaten';

/** Phase D14: what a finished tower fight wrote — the streak after it and the set reward it paid (null = none). */
export interface TowerResult {
  readonly won: boolean;
  readonly streak: StreakState;
  readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> } | null;
}

/** null player = wild/NPC/league side */
export interface Seat {
  readonly side: 0 | 1;
  readonly playerId: string | null;
  readonly sessionId: string | null;
}

/** Honor shapes the world: the battles whose deeds count in their zone. */
const HONOR_FORMATS: ReadonlySet<string> = new Set(['wild', 'trainer', 'league', 'pvp']);

/** One roaming legendary per season: a roamer encounter's spawn id (`<zone>:roamer:<season>:<n>`, ZoneRoom). */
export function isRoamerSpawn(spawnId: string | null): boolean {
  return spawnId !== null && spawnId.includes(':roamer:');
}

export interface BattleSession {
  readonly id: string;
  readonly format: BattleFormat;
  /** the zone id (an `arena` room's battles: 'arena') */
  readonly zoneId: string;
  readonly seats: readonly [Seat, Seat];
  /** core; the ONLY copy of the truth */
  state: BattleState;
  /** createBattle's seed snapshot, for battle_history.seed */
  readonly seed: RngState;
  /** one entry per resolved resolveTurn, for battle_history.actions */
  readonly actionsLog: [SideChoice, SideChoice][];
  /**
   * actions received for the CURRENT turn. Singles: one Action (or null) per side. Phase D6 doubles
   * (`state.slots === 2`): one `[pos0, pos1]` pair per side, filled position by position.
   */
  pending: [SideChoice, SideChoice];
  /** ms; 30 s after the turn opened */
  deadlineAt: number;
  resolving: boolean;
  /** wild: the SpawnRecord it consumes */
  readonly spawnId: string | null;
  readonly npc: { readonly trainerId: string; readonly reward: number; readonly leagueId: string | null } | null;
  /** §30.4.8: the story beat this battle completes on a side-0 win */
  readonly beatId: string | null;
  /** §30.4.6 `static`: the LegendaryStatic whose flag is set on win or catch */
  readonly staticSpecies: string | null;
  readonly startedAt: number;
  /** where the arena forms: a hall's room arena inside an interior (Phase A), else the player's position */
  readonly x: number;
  readonly z: number;
  /** the hall's battle-axis yaw inside an interior; null in the open world */
  readonly yaw: number | null;
  // ---- server bookkeeping beyond the spec's shape ----
  /** per-side inventory snapshot (item/orb balance checks at validate time); null for non-player sides */
  inventory: [Record<string, number> | null, Record<string, number> | null];
  /** consecutive deadline auto-actions per side (pvp: 2 → forfeit) */
  autoActions: [number, number];
  /** consecutive persistence failures (2 → void) */
  faults: number;
  /** trainer rematch (half reward); Phase D14: also a league rematch (`LEAGUE_REMATCH` team, ×1.5, no badge / setsFlags) */
  readonly rematch: boolean;
  /**
   * Phase D14 battle tower: true for a tower fight (format 'trainer', `noExp`, synthetic battlers — nothing about the
   * creatures is written; the end writes the streak and, every `TOWER.setLength` wins, the set reward). Absent otherwise.
   */
  readonly tower?: true;
  /**
   * Ghost trainers (content ghosts.ts): a fight with another trainer's ghost (format 'trainer', the AI drives healed
   * copies of the party they left with; nothing of theirs is written). The end records the fight for the owner.
   */
  readonly ghost?: { readonly ownerId: string; readonly name: string };
  /**
   * NPC talk: a battle a villager started (`POST /npc/act battle`; format 'trainer', trainerId `villager:<npc id>`). A
   * win pays trainer exp and no money and sets no flag: a villager fights again whenever it is asked.
   */
  readonly villager?: true;
  /**
   * Camp bases (content camps.ts): a raid on another trainer's camp (format 'trainer', `noExp`: the AI drives healed
   * copies of the owner's guard snapshot; the fight itself moves no exp and no honor). The end settles the raid
   * (game/camps.ts `settleRaid`: the cut, the raider's lead's honor, a takeover, the held point, the camp log).
   */
  readonly camp?: { readonly ownerId: string; readonly ownerName: string; readonly zoneId: string };
  /** Phase D14: the tower result for side 0, set after the end transaction commits (read by the host's `onEnd`) */
  towerResult?: TowerResult;
  /**
   * Arena PvP (rooms/ArenaRoom.ts): an out-of-world battle between healed synthetic copies (`noExp`, no items, nothing
   * about the creatures written). `ranked`: only then the end moves the rating (Elo); every other arena PvP kind pays
   * the pvp trainer exp + the `win pvp` quest event; `training` (format 'trainer' vs an AI) pays nothing at all;
   * `daily` (the daily challenge, `dayKey`) likewise pays nothing and records the try in `daily_results`.
   */
  readonly arena?: { readonly kind: ArenaKind; readonly ranked: boolean; readonly dayKey?: string };
  /**
   * Challenge modes (content challenge.ts): the active run of each side's player (null: none / a non-player side). A
   * fainted creature of such a side falls (`FALLEN_RIBBON`); Hardcore's bag snapshot holds orbs only.
   */
  readonly challenge?: readonly [ChallengeMode | null, ChallengeMode | null];
  /** Nemeses (content nemesis.ts): the player's nemesis this wild battle is an ambush by (absent otherwise) */
  readonly nemesis?: Nemesis;
  /** Nemeses: what the wild side did to the player so far (a knockout, an orb broken out of), set after each commit */
  nemesisTrack?: NemesisTrack;
  /** the LegendaryStatic flag to set on win/catch */
  readonly staticFlag: string | null;
  /** createBattle's input minus seed, deep-copied before the call — battle_history.start (P6, DB-only replay) */
  readonly start: BattleStartSnapshot;
}

export interface BattleHost {
  send(playerId: string, msg: ServerMessage): void;
  /** state.battles.set, PlayerState.inBattle, userData.battleId, presence battle */
  onStart(session: BattleSession): void;
  /** cleanup: state.battles.delete, inBattle false, battleId null, spawn release, presence */
  onEnd(session: BattleSession, outcome: BattleOutcome | 'void' | 'playerLeft'): void;
  /** refresh the room's per-player caches (flags/badges for beats and gates, inventory for surf) */
  onProgress(playerId: string, p: { readonly flags?: readonly string[]; readonly badges?: readonly BadgeId[]; readonly inventory?: Readonly<Record<string, number>> }): void;
}

export interface BattleDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly content: ContentIndex;
  readonly clock: () => number;
  readonly log: Logger;
  /** where battles form: the zone room's ZoneDef, or the arena room's `{ id: 'arena', biome: 'capital' }` (terrain none) */
  readonly zone: { readonly id: string; readonly biome: ZoneDef['biome'] };
  readonly host: BattleHost;
  readonly metrics: RoomMetrics;
  /** Phase D7: the ambient weather a battle of this format forming at this point starts under (absent → 'none') */
  /** `players`: the battle's human seats (weather from real life: a player's own weather replaces the zone's) */
  readonly weather?: (format: BattleFormat, at: BattleAt, players: readonly string[]) => WeatherKind;
  /**
   * Nemeses (content nemesis.ts): whether wild creatures may rise here (null / absent: never, env `NEMESES=off`) and
   * the zone's shadow level now (a darker zone promotes more often); `always` promotes every qualifying escape.
   */
  readonly nemeses?: () => { readonly always: boolean; readonly shadow: number } | null;
  /** A living ecosystem (content ecosystem.ts): whether a wild battle's catches and knockouts are tallied (absent: no) */
  readonly ecosystem?: () => boolean;
  /** The bounty board (content bounties.ts): whether a beaten ghost or nemesis claims its bounties (absent: no, env BOUNTIES=off) */
  readonly bounties?: () => boolean;
  /** Camp bases: a raid settled on this zone's camp (the room re-reads it: a takeover changes owner and banner) */
  readonly campChanged?: (zoneId: string) => void;
}

/** Where a battle forms (ZoneRoom `battleAt`): a hall arena + its battle-axis yaw inside an interior, else the player. */
export interface BattleAt {
  readonly x: number;
  readonly z: number;
  readonly yaw?: number | null;
}

export interface PlayerSeat {
  readonly playerId: string;
  readonly sessionId: string;
}

/** A failed start; `playerId` (pvp) names the side whose party / battle stopped it. */
export type StartResult = { readonly ok: true; readonly session: BattleSession } | { readonly ok: false; readonly code: 'notAllowed' | 'busy' | 'internal'; readonly detail: string; readonly playerId?: string };

/** Arena PvP: what `startArena` needs (the arena room's match). */
/** What the start transaction read for one player (`loadPlayers`). */
interface LoadedPlayer {
  readonly party: CreatureInstance[];
  readonly inventory: Record<string, number>;
  readonly questProgress: QuestProgressEntry[];
  /** the player's active challenge run (content challenge.ts), null for none */
  readonly challenge: ChallengeMode | null;
  /** false in a challenge run when this zone's first encounter is already spent */
  readonly canCatch: boolean;
  /** the first-encounter flag this start set (sent to the client and the room cache) */
  readonly metFlag: string | null;
}

export interface ArenaStart {
  readonly kind: ArenaKind;
  /** every creature at exactly this level, or null = own levels (healed) */
  readonly level: number | null;
  /** the human seats, side order (training: one) */
  readonly players: readonly PlayerSeat[];
  /** `cup`: the cup in force at the match (its rule is re-checked against the stored party) */
  readonly cup?: ActiveCup;
  /** `training`: the AI's difficulty and the seed of its team */
  readonly training?: { readonly difficulty: ArenaDifficulty; readonly seed: string };
}

/** Arena PvP: the start refusals (`detail`), with `playerId` naming the side. */
export type ArenaStartRefusal = 'party' | 'cup' | 'inBattle';

/**
 * Arena training: the AI's team — `size` distinct species from the difficulty's pool (seeded shuffle), each at
 * `level` with its level-up moves and a seeded ability, synthetic `arena:foe:<i>` ids. Pure and deterministic in `seed`.
 */
export function arenaTrainingTeam(seed: string, difficulty: ArenaDifficulty, size: number, level: number, content: ContentIndex): CreatureInstance[] {
  const rng = createRng(seed);
  const pool = rng.shuffle(ARENA_TRAINING[difficulty].pool);
  const out: CreatureInstance[] = [];
  for (let i = 0; i < size && i < pool.length; i++) {
    const sp = content.species(pool[i]!);
    const ability = sp.abilities[rng.int(sp.abilities.length)]!;
    out.push(withSyntheticId(newCreature(content, sp.id, level, { ability }), `arena:foe:${i}`));
  }
  return out;
}

/** Arena PvP: the party as it fights — the first six, each at `level` (null = own), fully healed, synthetic `arena:` ids. */
export function arenaCopies(party: readonly CreatureInstance[], level: number | null, content: ContentIndex): CreatureInstance[] {
  // a fallen creature (challenge modes) never fights again, not even as a healed copy
  return party.filter((c) => !isFallen(c)).slice(0, 6).map((c) => withSyntheticId(atLevel(toInstance(c), level, content), `arena:${c.id}`));
}
export type ActionResult = null | { readonly code: 'notFound' | 'notAllowed' | 'busy'; readonly detail: string | null };

export const TERRAIN_BY_BIOME: Readonly<Record<ZoneDef['biome'], Terrain>> = {
  grove: 'grove',
  cinder: 'cinder',
  salt: 'salt',
  storm: 'storm',
  marrow: 'marrow',
  vesper: 'vesper',
  forge: 'forge',
  sky: 'sky',
  capital: 'none',
  shrine: 'shrine',
  rift: 'rift',
};

/** Per-player accumulation of what one transaction changed (becomes inventoryDelta / progressionDelta / RewardsSummary). */
interface PlayerDelta {
  items: Record<string, number>;
  money: number | null;
  creaturesAdded: CreatureInstance[];
  /** where each creaturesAdded entry was inserted (protocol inventoryDelta.placement) */
  placement: Record<string, 'party' | 'box'>;
  creaturesUpdated: CreatureInstance[];
  trainerExp: number | null;
  trainerLevel: number | null;
  rating: number | null;
  badges: BadgeId[] | null;
  dexSeen: string[];
  dexCaught: string[];
  flags: string[];
  questProgress: QuestProgressEntry[];
  rewards: RewardsSummary | null;
  beatCompleted: string | null;
  inventoryAll: Record<string, number> | null;
  /** Phase D14: a finished tower fight's result */
  tower: TowerResult | null;
  /** Nemeses: what became of a nemesis in this battle (`nemesisNews`, sent after `battleEnd`) */
  nemesis: ServerMessage[];
  /** The bounty board: the payout toast of a claim (sent after `battleEnd`) */
  bounty: ServerMessage[];
  /** Camp bases: what a won raid took (sent after `battleEnd`) */
  camp: ServerMessage[];
}

function emptyDelta(): PlayerDelta {
  return {
    items: {},
    money: null,
    creaturesAdded: [],
    placement: {},
    creaturesUpdated: [],
    trainerExp: null,
    trainerLevel: null,
    rating: null,
    badges: null,
    dexSeen: [],
    dexCaught: [],
    flags: [],
    questProgress: [],
    rewards: null,
    beatCompleted: null,
    inventoryAll: null,
    tower: null,
    nemesis: [],
    bounty: [],
    camp: [],
  };
}

/** Pick exactly the CreatureInstance keys (a CreatureRecord carries slot/version too). */
export function toInstance(c: CreatureInstance): CreatureInstance {
  return {
    id: c.id,
    ownerId: c.ownerId,
    speciesId: c.speciesId,
    nickname: c.nickname,
    level: c.level,
    exp: c.exp,
    hp: c.hp,
    moves: c.moves.map((m) => ({ id: m.id, pp: m.pp, ppMax: m.ppMax })),
    status: [...c.status],
    ability: c.ability,
    heldItem: c.heldItem,
    variantKey: c.variantKey,
    isAlpha: c.isAlpha,
    ...(c.isShiny === true ? { isShiny: true } : {}),
    caughtAt: c.caughtAt === null ? null : { zoneId: c.caughtAt.zoneId, at: c.caughtAt.at },
    ...(c.honor !== undefined ? { honor: c.honor } : {}),
    ...(c.bandborn === true ? { bandborn: true as const } : {}),
    ribbons: [...c.ribbons],
    favorite: c.favorite,
    locked: c.locked,
  };
}

function battleFieldsEqual(a: CreatureInstance, b: CreatureInstance): boolean {
  if (a.hp !== b.hp || a.exp !== b.exp || a.level !== b.level || a.heldItem !== b.heldItem) return false;
  if (a.status.join(',') !== b.status.join(',')) return false;
  if (a.moves.length !== b.moves.length) return false;
  for (let i = 0; i < a.moves.length; i++) if (a.moves[i]!.id !== b.moves[i]!.id || a.moves[i]!.pp !== b.moves[i]!.pp) return false;
  return true;
}

function resultFor(outcome: BattleOutcome, side: 0 | 1): 'win' | 'loss' | 'draw' | 'fled' | 'caught' {
  if (outcome.winner === 'draw') return 'draw';
  if (outcome.winner === 'fled') return 'fled';
  if (outcome.winner === 'caught') return 'caught';
  return outcome.winner === side ? 'win' : 'loss';
}

/** Side 0 won for reward purposes: KO win, or a catch (which is also a win for exp purposes). */
function side0Won(outcome: BattleOutcome): boolean {
  return outcome.winner === 0 || outcome.winner === 'caught';
}

/** The turn timer the client shows: ms until `tick` auto-acts, as of `now` (whole ms, never negative). */
function deadlineLeft(session: BattleSession, now: number): number {
  return Math.max(0, Math.round(session.deadlineAt - now));
}

/** The auto-action of §30.4.3 "Deadline" for a seat that did not act. */
export function autoAction(state: BattleState, side: 0 | 1, content: ContentIndex): Action {
  const s = state.sides[side];
  if (s.mustSwitch) {
    for (let i = 0; i < s.party.length; i++) if (i !== s.active && s.party[i]!.creature.hp > 0) return { kind: 'switch', to: i };
  }
  const active = s.party[s.active]!;
  for (const m of active.creature.moves) {
    const a: Action = { kind: 'move', move: m.id };
    if (m.pp > 0 && validateAction(state, side, a, content) === null) return a;
  }
  const flee: Action = { kind: 'flee' };
  if (validateAction(state, side, flee, content) === null) return flee;
  return { kind: 'forfeit' };
}

/** Phase D6: the doubles deadline / forfeit auto-choice — fills every required position still null in `have`. */
export function autoPair(state: BattleState, side: 0 | 1, content: ContentIndex, have: readonly [Action | null, Action | null] = [null, null]): [Action | null, Action | null] {
  const out: [Action | null, Action | null] = [have[0], have[1]];
  const s = state.sides[side];
  const a = s.actives!;
  const taken = (to: number): boolean => out.some((x) => x !== null && x.kind === 'switch' && x.to === to);
  for (const p of requiredPositions(state, side)) {
    if (out[p] !== null) continue;
    if (s.mustSwitch) {
      const to = s.party.findIndex((b, i) => i !== a[0] && i !== a[1] && b.creature.hp > 0 && !taken(i));
      out[p] = { kind: 'switch', to };
      continue;
    }
    const b = s.party[a[p]]!;
    let pick: Action = { kind: 'forfeit' };
    for (const m of b.creature.moves) {
      const mv: Action = { kind: 'move', move: m.id };
      if (m.pp > 0 && validateAction(state, side, mv, content, p) === null) {
        pick = mv;
        break;
      }
    }
    out[p] = pick;
  }
  return out;
}

/** Phase D6: true when the session runs a doubles battle. */
export function isDoubles(session: BattleSession): boolean {
  return session.state.slots === 2;
}

/** An empty pending slate (singles `[null, null]`; doubles one null pair per PLAYER side — NPC sides stay null). */
function emptyPending(state: BattleState, seats: readonly [Seat, Seat]): [SideChoice, SideChoice] {
  if (state.slots !== 2) return [null, null];
  return [seats[0].playerId === null ? null : [null, null], seats[1].playerId === null ? null : [null, null]];
}

/** Whether `side`'s pending choice is complete (singles: non-null; doubles: every required position filled). */
function sideReady(session: BattleSession, side: 0 | 1): boolean {
  const p = session.pending[side];
  if (!isDoubles(session)) return p !== null;
  const pair = p as readonly [Action | null, Action | null];
  return requiredPositions(session.state, side).every((q) => pair[q] !== null);
}

/** Sides whose player must act this turn: in a replacement phase only the mustSwitch side(s). Doubles: sides with a required position. */
export function mustActSides(session: BattleSession): (0 | 1)[] {
  const st = session.state;
  const replacement = st.sides[0].mustSwitch || st.sides[1].mustSwitch;
  const out: (0 | 1)[] = [];
  for (const seat of session.seats) {
    if (seat.playerId === null) continue;
    if (st.slots === 2) {
      if (requiredPositions(st, seat.side).length > 0) out.push(seat.side);
      continue;
    }
    if (replacement && !st.sides[seat.side].mustSwitch) continue;
    out.push(seat.side);
  }
  return out;
}

/** Majin / Tenjin: the bands a player holds (key items `majin_band` / `tenjin_band` in the inventory snapshot). */
export function bandsOf(inventory: Readonly<Record<string, number>>): BandKind[] {
  const out: BandKind[] = [];
  if ((inventory[MAJIN_BAND] ?? 0) > 0) out.push('majin');
  if ((inventory[TENJIN_BAND] ?? 0) > 0) out.push('tenjin');
  return out;
}

export class BattleCoordinator {
  private readonly sessions = new Map<string, BattleSession>();
  private readonly byPlayer = new Map<string, string>();

  constructor(
    private readonly rng: Rng,
    private readonly deps: BattleDeps,
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  get(battleId: string): BattleSession | null {
    return this.sessions.get(battleId) ?? null;
  }

  ofPlayer(playerId: string): BattleSession | null {
    const id = this.byPlayer.get(playerId);
    return id === undefined ? null : (this.sessions.get(id) ?? null);
  }

  all(): readonly BattleSession[] {
    return [...this.sessions.values()];
  }

  // ─── start ──────────────────────────────────────────────────────────────────

  private playerSide(
    party: readonly CreatureInstance[],
    playerId: string,
    canFlee: boolean,
    canCatch: boolean,
    inventory: Readonly<Record<string, number>> = {},
  ): Omit<Side, 'mustSwitch' | 'consumedItems'> | null {
    const content = this.deps.content;
    const battlers = party.slice(0, 6).map((c) => projectBattler(toInstance(c), content));
    const active = battlers.findIndex((b) => b.creature.hp > 0);
    if (active === -1) return null;
    const bands = bandsOf(inventory);
    return { kind: 'player', party: battlers, active, trainerId: playerId, canFlee, canCatch, ...(bands.length > 0 ? { bands } : {}) };
  }

  /**
   * Reads party + inventory under the player lock and marks the opposing lead seen: the start transaction. Challenge
   * modes: each player's active run; with `encounterZone` (a wild or static battle) the zone's first encounter of the
   * run is consumed here (its flag set) and only that one may be caught (`canCatch`).
   */
  private async loadPlayers(ids: readonly string[], seenSpecies: string | null, encounterZone: string | null = null): Promise<Map<string, LoadedPlayer>> {
    const { repos, clock } = this.deps;
    const out = new Map<string, LoadedPlayer>();
    await repos.db.transaction(async (tx) => {
      await repos.players.lockMany(tx, ids);
      for (const id of [...ids].sort()) {
        const party = await repos.creatures.party(tx, id);
        const inventory = await repos.inventory.all(tx, id);
        let questProgress: QuestProgressEntry[] = [];
        if (seenSpecies !== null && party.some((c) => c.hp > 0) && (await repos.progress.markSeen(tx, id, seenSpecies, new Date(clock())))) {
          questProgress = await advanceQuests(tx, repos, id, [{ kind: 'seen', species: seenSpecies }], clock());
        }
        const challenge = challengeActive(await repos.progress.flags(tx, id));
        let canCatch = true;
        let metFlag: string | null = null;
        if (challenge !== null && encounterZone !== null && party.some((c) => c.hp > 0)) {
          const f = challengeMetFlag(encounterZone);
          if ((await repos.progress.flags(tx, id)).includes(f)) canCatch = false;
          else {
            await repos.progress.setFlags(tx, id, [f], new Date(clock()));
            metFlag = f;
          }
        }
        out.set(id, { party, inventory, questProgress, challenge, canCatch, metFlag });
      }
    });
    return out;
  }

  /** The bag a side fights with: Hardcore keeps the orbs only (bag items are refused as `noItem`). */
  private bagFor(l: LoadedPlayer): Record<string, number> {
    return l.challenge === 'hardcore' ? orbsOnly(l.inventory, this.deps.content) : l.inventory;
  }

  /** Quest / mission progress from the start transaction (a newly seen lead), sent after battleStart. */
  private sendStartProgress(loaded: Map<string, { questProgress: QuestProgressEntry[]; metFlag?: string | null }>): void {
    for (const [pid, l] of loaded) {
      if (l.questProgress.length > 0) this.deps.host.send(pid, progressionOnly({ questProgress: l.questProgress }));
      // challenge modes: this zone's first encounter of the run is spent
      if (l.metFlag != null) {
        this.deps.host.send(pid, progressionOnly({ flags: [l.metFlag] }));
        this.deps.host.onProgress(pid, { flags: [l.metFlag] });
      }
    }
  }

  private open(
    base: Omit<BattleSession, 'state' | 'seed' | 'actionsLog' | 'pending' | 'deadlineAt' | 'resolving' | 'startedAt' | 'autoActions' | 'faults' | 'start'>,
    sides: readonly [Omit<Side, 'mustSwitch' | 'consumedItems'>, Omit<Side, 'mustSwitch' | 'consumedItems'>],
    seed: RngState,
    doubles = false,
  ): { session: BattleSession; events: readonly BattleEvent[] } {
    const now = this.deps.clock();
    const terrain = TERRAIN_BY_BIOME[this.deps.zone.biome];
    const humans = base.seats.flatMap((s) => (s.playerId === null ? [] : [s.playerId]));
    const weather = this.deps.weather?.(base.format, { x: base.x, z: base.z }, humans) ?? 'none';
    const ambient = weather === 'none' ? {} : { weather };
    // Phase D6: `slots: 2` rides the start snapshot so a doubles battle replays from its history row alone
    const slots = doubles ? { slots: 2 as const } : {};
    // Phase D14: a tower fight awards no exp; the flag rides the snapshot so the history row replays alone
    // Arena PvP: healed copies fight with noExp too (no exp, no honor); the kind rides the snapshot (history rows show it)
    // Camp bases: a raid fights with noExp too (no exp, and the fight itself moves no honor: the raid's own toll is settled at the end)
    const noExp = base.tower === true || base.arena !== undefined || base.camp !== undefined ? { noExp: true as const } : {};
    const arena = base.arena !== undefined ? { arena: base.arena.kind } : {};
    const start = JSON.parse(JSON.stringify({ zoneId: base.zoneId, terrain, sides, ...ambient, ...slots, ...noExp, ...arena })) as BattleStartSnapshot;
    const { state, events } = createBattle({ id: base.id, format: base.format, zoneId: base.zoneId, terrain, seed, sides, ...ambient, ...slots, ...noExp }, this.deps.content);
    const session: BattleSession = {
      ...base,
      start,
      state,
      seed,
      actionsLog: [],
      pending: emptyPending(state, base.seats),
      deadlineAt: now + TURN_DEADLINE_MS,
      resolving: false,
      startedAt: now,
      autoActions: [0, 0],
      faults: 0,
    };
    this.sessions.set(session.id, session);
    for (const seat of session.seats) if (seat.playerId !== null) this.byPlayer.set(seat.playerId, session.id);
    this.deps.host.onStart(session);
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      this.deps.host.send(seat.playerId, {
        type: 'battleStart',
        battleId: session.id,
        format: session.format,
        seat: seat.side,
        state,
        events,
        stateDigest: digestBattleState(state),
        x: session.x,
        z: session.z,
        yaw: session.yaw,
        deadlineMs: deadlineLeft(session, now),
      });
    }
    return { session, events };
  }

  /**
   * §30.4.4 `wild`: one battler projected from the SpawnRecord. Nemeses: with `nemesis` (an ambush) the battler is that
   * nemesis at the spawn's level (held near the lead), with its name, look, ability and gained move.
   */
  async startWild(p: PlayerSeat, spawn: SpawnRecord, at: BattleAt, nemesis?: Nemesis): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([p.playerId], spawn.speciesId, this.deps.zone.id);
    const me = loaded.get(p.playerId)!;
    const side0 = this.playerSide(me.party, p.playerId, true, me.canCatch, me.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const wild =
      nemesis !== undefined
        ? nemesisCreature(this.deps.content, nemesis, spawn.level, `wild:${spawn.id}`)
        : withSyntheticId(
            newCreature(this.deps.content, spawn.speciesId, spawn.level, { ability: spawn.ability, variantKey: spawn.variantKey, isAlpha: spawn.isAlpha, isShiny: spawn.isShiny === true }),
            `wild:${spawn.id}`,
          );
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'wild', party: [projectBattler(wild, this.deps.content)], active: 0, trainerId: null, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'wild',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: spawn.id,
        npc: null,
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(me), null],
        rematch: false,
        challenge: [me.challenge, null],
        ...(nemesis !== undefined ? { nemesis } : {}),
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.deps.host.send(p.playerId, progressionOnly({ dexSeen: [spawn.speciesId] }));
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /** §30.4.6 `static`: format wild, canFlee false, canCatch true; flag set on win or catch. */
  async startStatic(p: PlayerSeat, st: LegendaryStatic, at: BattleAt): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([p.playerId], st.species, this.deps.zone.id);
    const me = loaded.get(p.playerId)!;
    const side0 = this.playerSide(me.party, p.playerId, false, me.canCatch, me.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    const wild = withSyntheticId(newCreature(this.deps.content, st.species, st.level), `static:${st.species}`);
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'wild', party: [projectBattler(wild, this.deps.content)], active: 0, trainerId: null, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'wild',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: null,
        beatId: null,
        staticSpecies: st.species,
        staticFlag: st.flag,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(me), null],
        rematch: false,
        challenge: [me.challenge, null],
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /** §30.4.4 `trainer` / `league`: team from content (league: nickname/ability/heldItem verbatim). */
  async startNpc(
    p: PlayerSeat,
    def:
      | { readonly kind: 'trainer'; readonly trainer: TrainerDef; readonly rematch: boolean }
      // Phase D14: `rematch` = the post-game rematch row (its team and reward replace the league row's)
      | { readonly kind: 'league'; readonly league: LeagueTrainer; readonly rematch?: LeagueRematch },
    beatId: string | null,
    at: BattleAt,
  ): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const trainerId = def.kind === 'trainer' ? def.trainer.id : def.league.id;
    const team: CreatureInstance[] =
      def.kind === 'trainer'
        ? def.trainer.team.map((m, i) => withSyntheticId(newCreature(content, m.species, m.level), `npc:${trainerId}:${i}`))
        : (def.rematch?.team ?? def.league.team).map((m, i) =>
            withSyntheticId(newCreature(content, m.species, m.level, { nickname: m.nickname, ability: m.ability, heldItem: m.heldItem }), `npc:${trainerId}:${i}`),
          );
    const loaded = await this.loadPlayers([p.playerId], team[0]!.speciesId);
    const side0 = this.playerSide(loaded.get(p.playerId)!.party, p.playerId, false, false, loaded.get(p.playerId)!.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    // Phase D6: a trainer authored as doubles (`doubles: true`, ≥ 2 creatures) fights 2-on-2 when the player has two
    // usable creatures; with one, the battle falls back to singles (never a refusal: doubles is never a gate)
    const authoredDoubles = (def.kind === 'trainer' ? def.trainer.doubles : def.league.doubles) === true && team.length >= 2;
    const doubles = authoredDoubles && side0.party.filter((b) => b.creature.hp > 0).length >= 2;
    // Majin / Tenjin: the trainer's authored bands (content `bands`); its side transforms one creature (core chooseNpcAction)
    const npcBands = def.kind === 'trainer' ? def.trainer.bands : def.league.bands;
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = {
      kind: 'npc',
      party: team.map((c) => projectBattler(c, content)),
      active: 0,
      trainerId,
      canFlee: false,
      canCatch: false,
      ...(npcBands !== undefined && npcBands.length > 0 ? { bands: npcBands } : {}),
    };
    const reward = def.kind === 'trainer' ? (def.rematch ? Math.floor(def.trainer.reward / 2) : def.trainer.reward) : (def.rematch?.reward ?? def.league.reward);
    const { session } = this.open(
      {
        id: randomUUID(),
        format: def.kind === 'trainer' ? 'trainer' : 'league',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId, reward, leagueId: def.kind === 'league' ? def.league.id : null },
        beatId,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(loaded.get(p.playerId)!), null],
        challenge: [loaded.get(p.playerId)!.challenge, null],
        rematch: def.kind === 'trainer' ? def.rematch : def.rematch !== undefined,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
      doubles,
    );
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /**
   * Phase D14 battle tower: `picks` are the player's creatures as they fight (capped, healed, synthetic `tower:` ids —
   * never persisted), `foes` the generated team. Format 'trainer' with `noExp`; no items (no inventory snapshot), no
   * flee, no catch. The end transaction writes the streak (and the set reward) instead of trainer rewards.
   */
  startTower(p: PlayerSeat, picks: readonly CreatureInstance[], foes: readonly CreatureInstance[], trainerId: string, at: BattleAt): StartResult {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const side0: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'player', party: picks.map((c) => projectBattler(c, content)), active: 0, trainerId: p.playerId, canFlee: false, canCatch: false };
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'npc', party: foes.map((c) => projectBattler(c, content)), active: 0, trainerId, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'trainer',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId, reward: 0, leagueId: null },
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [null, null],
        rematch: false,
        tower: true,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    return { ok: true, session };
  }

  /** §30.4.5 step 3: lock both players in one tx (ascending uuid) to read parties; seed = createRng(battleId). */
  async startPvp(challenger: PlayerSeat, accepter: PlayerSeat, at: BattleAt): Promise<StartResult> {
    const busy = (): StartResult | null =>
      this.byPlayer.has(challenger.playerId)
        ? { ok: false, code: 'busy', detail: 'inBattle', playerId: challenger.playerId }
        : this.byPlayer.has(accepter.playerId)
          ? { ok: false, code: 'busy', detail: 'inBattle', playerId: accepter.playerId }
          : null;
    const before = busy();
    if (before !== null) return before;
    const loaded = await this.loadPlayers([challenger.playerId, accepter.playerId], null);
    const side0 = this.playerSide(loaded.get(challenger.playerId)!.party, challenger.playerId, false, false, loaded.get(challenger.playerId)!.inventory);
    const side1 = this.playerSide(loaded.get(accepter.playerId)!.party, accepter.playerId, false, false, loaded.get(accepter.playerId)!.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty', playerId: challenger.playerId };
    if (side1 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty', playerId: accepter.playerId };
    const after = busy();
    if (after !== null) return after;
    const id = randomUUID();
    const { session } = this.open(
      {
        id,
        format: 'pvp',
        zoneId: this.deps.zone.id,
        seats: [
          { side: 0, playerId: challenger.playerId, sessionId: challenger.sessionId },
          { side: 1, playerId: accepter.playerId, sessionId: accepter.sessionId },
        ],
        spawnId: null,
        npc: null,
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(loaded.get(challenger.playerId)!), this.bagFor(loaded.get(accepter.playerId)!)],
        challenge: [loaded.get(challenger.playerId)!.challenge, loaded.get(accepter.playerId)!.challenge],
        rematch: false,
      },
      [side0, side1],
      createRng(id).snapshot(),
    );
    return { ok: true, session };
  }

  /**
   * Arena PvP (rooms/ArenaRoom.ts): one transaction locks the human players and reads their parties + inventories;
   * each side is its party's first six as healed synthetic copies at `a.level` (`arenaCopies`) — nothing about a stored
   * creature is ever written. Both human sides are `player` (format 'pvp', seed = createRng(battleId)); training fights
   * an AI (`npc`, format 'trainer') whose team is `arenaTrainingTeam` sized to the player's party, at `a.level` or the
   * player's highest party level. `noExp`, no item snapshot (bag items are refused `noItem`), no flee, no catch, no
   * weather, terrain none; the Majin / Tenjin bands still come from the inventory. Refusals: `party` (an empty party),
   * `cup` (the stored party breaks the cup's rule), `inBattle`.
   */
  async startArena(a: ArenaStart, battleId: string = randomUUID()): Promise<StartResult> {
    const busy = (): StartResult | null => {
      const p = a.players.find((x) => this.byPlayer.has(x.playerId));
      return p === undefined ? null : { ok: false, code: 'busy', detail: 'inBattle', playerId: p.playerId };
    };
    const before = busy();
    if (before !== null) return before;
    const content = this.deps.content;
    const loaded = await this.loadPlayers(
      a.players.map((p) => p.playerId),
      null,
    );
    const sides: Omit<Side, 'mustSwitch' | 'consumedItems'>[] = [];
    for (const p of a.players) {
      const l = loaded.get(p.playerId)!;
      if (l.party.length === 0) return { ok: false, code: 'notAllowed', detail: 'party', playerId: p.playerId };
      if (a.cup !== undefined && cupRefusal(l.party.slice(0, 6), a.cup) !== null) return { ok: false, code: 'notAllowed', detail: 'cup', playerId: p.playerId };
      const bands = bandsOf(l.inventory);
      const party = arenaCopies(l.party, a.level, content).map((c) => projectBattler(c, content));
      sides.push({ kind: 'player', party, active: 0, trainerId: p.playerId, canFlee: false, canCatch: false, ...(bands.length > 0 ? { bands } : {}) });
    }
    let npc: BattleSession['npc'] = null;
    if (a.training !== undefined) {
      const mine = loaded.get(a.players[0]!.playerId)!.party.slice(0, 6);
      const level = a.level ?? Math.max(...mine.map((c) => c.level));
      const foes = arenaTrainingTeam(a.training.seed, a.training.difficulty, mine.length, level, content);
      const trainerId = ARENA_TRAINING[a.training.difficulty].trainerId;
      sides.push({ kind: 'npc', party: foes.map((c) => projectBattler(c, content)), active: 0, trainerId, canFlee: false, canCatch: false });
      npc = { trainerId, reward: 0, leagueId: null };
    }
    if (sides.length !== 2) return { ok: false, code: 'internal', detail: 'seats' };
    const after = busy();
    if (after !== null) return after;
    const seats: [Seat, Seat] = [
      { side: 0, playerId: a.players[0]!.playerId, sessionId: a.players[0]!.sessionId },
      a.players[1] !== undefined ? { side: 1, playerId: a.players[1].playerId, sessionId: a.players[1].sessionId } : { side: 1, playerId: null, sessionId: null },
    ];
    const { session } = this.open(
      {
        id: battleId,
        format: a.training !== undefined ? 'trainer' : 'pvp',
        zoneId: this.deps.zone.id,
        seats,
        spawnId: null,
        npc,
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: 0,
        z: 0,
        yaw: 0,
        inventory: [null, null],
        rematch: false,
        arena: { kind: a.kind, ranked: a.kind === 'ranked' },
      },
      [sides[0]!, sides[1]!],
      createRng(battleId).snapshot(),
    );
    return { ok: true, session };
  }

  /**
   * Ghost trainers: the player against another trainer's ghost, as an AI trainer of healed copies of the party it left
   * the world with (own levels, at most six, synthetic ids: nothing of the owner's is read again or written).
   */
  async startGhost(p: PlayerSeat, ghost: { readonly ownerId: string; readonly name: string; readonly party: readonly CreatureInstance[]; readonly topLevel: number }, at: BattleAt): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle', playerId: p.playerId };
    const loaded = await this.loadPlayers([p.playerId], null, this.deps.zone.id);
    const me = loaded.get(p.playerId)!;
    const side0 = this.playerSide(me.party, p.playerId, false, false, me.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const trainerId = ghostTrainerId(ghost.name);
    const party = arenaCopies(ghost.party.slice(0, 6), null, content).map((c) => projectBattler(c, content));
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'npc', party, active: 0, trainerId, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'trainer',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId, reward: ghostReward(ghost.topLevel), leagueId: null },
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(me), null],
        rematch: false,
        challenge: [me.challenge, null],
        ghost: { ownerId: ghost.ownerId, name: ghost.name },
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /**
   * NPC talk: the player against a villager who took up (or made) a challenge. Its team is `villagerTeam` — the zone's
   * species, seeded by the NPC so it fields the same ones every time, a few levels under the player's strongest.
   */
  async startVillager(p: PlayerSeat, npcId: string, at: BattleAt, seed: string): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([p.playerId], null);
    const me = loaded.get(p.playerId)!;
    const side0 = this.playerSide(me.party, p.playerId, false, false, me.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const trainerId = villagerTrainerId(npcId);
    const top = Math.max(...me.party.map((c) => c.level));
    const team = villagerTeam(this.deps.zone.id as ZoneId, top, createRng(seed)).map((m, i) => withSyntheticId(newCreature(content, m.species, m.level), `npc:${trainerId}:${i}`));
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'npc', party: team.map((c) => projectBattler(c, content)), active: 0, trainerId, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'trainer',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId, reward: 0, leagueId: null },
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(me), null],
        rematch: false,
        challenge: [me.challenge, null],
        villager: true,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /**
   * Camp bases: the player raids another trainer's camp, fighting its guard as an AI trainer of healed copies of the
   * owner's party snapshot (own levels, at most six, synthetic ids: nothing of the owner's creatures is read again or
   * written). `noExp` (see `open`); no flee, no catch. The end settles the raid (`settleRaid`).
   */
  async startCampRaid(p: PlayerSeat, camp: { readonly ownerId: string; readonly ownerName: string; readonly zoneId: string; readonly guard: readonly CreatureInstance[] }, at: BattleAt): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle', playerId: p.playerId };
    const loaded = await this.loadPlayers([p.playerId], null, this.deps.zone.id);
    const me = loaded.get(p.playerId)!;
    const side0 = this.playerSide(me.party, p.playerId, false, false, me.inventory);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (camp.guard.length === 0) return { ok: false, code: 'notAllowed', detail: 'campFree' };
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const trainerId = campGuardTrainerId(camp.ownerName);
    const party = arenaCopies(camp.guard.slice(0, 6), null, content).map((c) => projectBattler(c, content));
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = { kind: 'npc', party, active: 0, trainerId, canFlee: false, canCatch: false };
    const { session } = this.open(
      {
        id: randomUUID(),
        format: 'trainer',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId, reward: 0, leagueId: null },
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: at.x,
        z: at.z,
        yaw: at.yaw ?? null,
        inventory: [this.bagFor(me), null],
        rematch: false,
        challenge: [me.challenge, null],
        camp: { ownerId: camp.ownerId, ownerName: camp.ownerName, zoneId: camp.zoneId },
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.sendStartProgress(loaded);
    return { ok: true, session };
  }

  /**
   * The daily challenge (game/daily.ts): the day's fixed team against the day's AI team, both synthetic and at
   * `DAILY_LEVEL`, on the day's own seed, so every player's daily plays out the same for the same choices. No bands,
   * no items; nothing about the player's creatures is read or written.
   */
  async startDaily(p: PlayerSeat, dayKey: string, battleId: string = randomUUID()): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle', playerId: p.playerId };
    const content = this.deps.content;
    const { team, foe } = dailyPuzzle(dayKey, content);
    const [side0, side1] = dailySides(team, foe, p.playerId, content);
    const { session } = this.open(
      {
        id: battleId,
        format: 'trainer',
        zoneId: this.deps.zone.id,
        seats: [{ side: 0, playerId: p.playerId, sessionId: p.sessionId }, { side: 1, playerId: null, sessionId: null }],
        spawnId: null,
        npc: { trainerId: DAILY_TRAINER.id, reward: 0, leagueId: null },
        beatId: null,
        staticSpecies: null,
        staticFlag: null,
        x: 0,
        z: 0,
        yaw: 0,
        inventory: [null, null],
        rematch: false,
        arena: { kind: 'daily', ranked: false, dayKey },
      },
      [side0, side1],
      createRng(dailySeed(dayKey)).snapshot(),
    );
    return { ok: true, session };
  }

  // ─── actions ────────────────────────────────────────────────────────────────

  /**
   * §30.4.2 `battleAction` handler. null = accepted. Phase D6: in a doubles battle `pos` names the field position
   * the action is for (absent = the lowest required position still waiting); the turn resolves once every required
   * position of every player seat holds an action. `pos` is ignored in singles.
   */
  action(playerId: string, battleId: string, turn: number, action: Action, pos?: 0 | 1): ActionResult {
    const session = this.sessions.get(battleId);
    const seat = session?.seats.find((s) => s.playerId === playerId);
    if (session === undefined || seat === undefined) return { code: 'notFound', detail: null };
    if (session.resolving) return { code: 'notAllowed', detail: 'resolving' };
    if (turn !== session.state.turn + 1) return { code: 'notAllowed', detail: 'wrongTurn' };
    if (isDoubles(session)) return this.actionAt(session, seat.side, action, pos);
    const side = seat.side;
    const err = validateAction(session.state, side, action, this.deps.content);
    if (err !== null) return { code: 'notAllowed', detail: err };
    const inv = session.inventory[side];
    if (action.kind === 'item' && (inv?.[action.item] ?? 0) < 1) return { code: 'notAllowed', detail: 'noItem' };
    if (action.kind === 'catch' && (inv?.[action.orb] ?? 0) < 1) return { code: 'notAllowed', detail: 'noOrb' };
    if (!mustActSides(session).includes(side)) return { code: 'notAllowed', detail: 'actionNotRequired' };
    if (session.pending[side] !== null) return { code: 'notAllowed', detail: 'alreadySubmitted' };
    session.pending[side] = action;
    session.autoActions[side] = 0;
    if (mustActSides(session).every((s) => session.pending[s] !== null)) void this.resolveNow(session);
    return null;
  }

  /** Phase D6: one position's action in a doubles battle (see `action`). */
  private actionAt(session: BattleSession, side: 0 | 1, action: Action, pos: 0 | 1 | undefined): ActionResult {
    const st = session.state;
    if (!mustActSides(session).includes(side)) return { code: 'notAllowed', detail: 'actionNotRequired' };
    const pair = session.pending[side] as [Action | null, Action | null];
    const req = requiredPositions(st, side);
    const p = pos ?? req.find((q) => pair[q] === null);
    if (p === undefined) return { code: 'notAllowed', detail: 'alreadySubmitted' };
    if (!req.includes(p)) return { code: 'notAllowed', detail: 'actionNotRequired' };
    if (pair[p] !== null) return { code: 'notAllowed', detail: 'alreadySubmitted' };
    const err = validateAction(st, side, action, this.deps.content, p);
    if (err !== null) return { code: 'notAllowed', detail: err };
    const other = pair[p === 0 ? 1 : 0];
    if (other !== null && other.kind === 'switch' && action.kind === 'switch' && other.to === action.to) return { code: 'notAllowed', detail: 'switchToActive' };
    const inv = session.inventory[side];
    const sameItem = other !== null && other.kind === 'item' && action.kind === 'item' && other.item === action.item ? 1 : 0;
    if (action.kind === 'item' && (inv?.[action.item] ?? 0) < 1 + sameItem) return { code: 'notAllowed', detail: 'noItem' };
    pair[p] = action;
    session.autoActions[side] = 0;
    if (mustActSides(session).every((s) => sideReady(session, s))) void this.resolveNow(session);
    return null;
  }

  /** `battleResync`: only to a seat holder; the full BattleState (pvp team-preview hiding is cut, §30.4.3). */
  resync(playerId: string, battleId: string): ServerMessage | null {
    const session = this.sessions.get(battleId);
    if (session === undefined || !session.seats.some((s) => s.playerId === playerId)) return null;
    return { type: 'battleResync', battleId, state: session.state, stateDigest: digestBattleState(session.state), deadlineMs: deadlineLeft(session, this.deps.clock()) };
  }

  // ─── resolution ─────────────────────────────────────────────────────────────

  /** §30.4.3 — resolve, persist in ONE transaction, then send. Never runs twice for one session at once. */
  async resolveNow(session: BattleSession): Promise<void> {
    if (session.resolving || !this.sessions.has(session.id)) return;
    session.resolving = true;
    const { content, log, clock } = this.deps;
    const before = session.state;
    const copy = (c: SideChoice): SideChoice => (Array.isArray(c) ? [...(c as readonly (Action | null)[])] as [Action | null, Action | null] : c);
    const actions: [SideChoice, SideChoice] = [copy(session.pending[0]), copy(session.pending[1])];
    let next: BattleState;
    let events: readonly BattleEvent[];
    try {
      const result = resolveTurn(before, actions, content);
      next = result.state;
      events = result.events;
    } catch (e) {
      log.error({ err: e, battleId: session.id }, 'resolveTurn threw — battle voided');
      this.deps.metrics.battleFaults += 1;
      this.voidBattle(session);
      return;
    }
    const now = clock();
    // nemeses: what the wild side did to the player this turn (a knockout, an orb broken out of), kept after the commit
    const track = this.nemesesHere(session) !== null ? trackNemesis(session.nemesisTrack ?? EMPTY_TRACK, before, events, content) : undefined;
    let deltas: Map<string, PlayerDelta>;
    try {
      deltas = await this.persistTurn(session, before, next, events, [...session.actionsLog, actions], now, track);
      if (track !== undefined) session.nemesisTrack = track;
    } catch (e) {
      log.error({ err: e, battleId: session.id }, 'battle turn transaction failed');
      this.deps.metrics.battleFaults += 1;
      session.pending = emptyPending(before, session.seats);
      session.resolving = false;
      session.faults += 1;
      if (session.faults >= 2) {
        this.voidBattle(session);
        return;
      }
      session.deadlineAt = now + TURN_DEADLINE_MS;
      for (const seat of session.seats) if (seat.playerId !== null) this.deps.host.send(seat.playerId, { type: 'error', code: 'internal', detail: 'turnRejected' });
      return;
    }
    // commit succeeded: only now does the session advance (NON-NEGOTIABLE 1)
    session.faults = 0;
    session.actionsLog.push(actions);
    session.state = next;
    session.pending = emptyPending(next, session.seats);
    const anyMustSwitch = next.sides[0].mustSwitch || next.sides[1].mustSwitch;
    session.deadlineAt = now + (anyMustSwitch ? REPLACEMENT_DEADLINE_MS : TURN_DEADLINE_MS);
    this.sendAfterCommit(session, next, events, deltas, now);
    session.resolving = false;
    if (next.ended !== null) {
      this.finish(session, next.ended);
      return;
    }
    // a replacement phase in which only NPC sides must switch resolves immediately (core chooses)
    if (mustActSides(session).length === 0) await this.resolveNow(session);
  }

  private sendAfterCommit(session: BattleSession, next: BattleState, events: readonly BattleEvent[], deltas: Map<string, PlayerDelta>, now: number): void {
    const host = this.deps.host;
    const digest = digestBattleState(next);
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      const pid = seat.playerId;
      const deadline = next.ended === null ? { deadlineMs: deadlineLeft(session, now) } : {};
      host.send(pid, { type: 'battleEvents', battleId: session.id, turn: next.turn, events, stateDigest: digest, rng: next.rng, ...deadline });
      const d = deltas.get(pid);
      if (d === undefined) continue;
      if (d.tower !== null && seat.side === 0) session.towerResult = d.tower;
      // Phase D14: a tower fight keeps its empty item snapshot (no items in the tower); arena PvP likewise
      if (d.inventoryAll !== null && session.tower !== true && session.arena === undefined) {
        session.inventory[seat.side] = session.challenge?.[seat.side] === 'hardcore' ? orbsOnly(d.inventoryAll, this.deps.content) : d.inventoryAll;
      }
      const itemsTouched = Object.keys(d.items).length > 0;
      if (itemsTouched || d.money !== null || d.creaturesAdded.length > 0 || d.creaturesUpdated.length > 0) {
        host.send(pid, {
          type: 'inventoryDelta',
          items: d.items,
          money: d.money,
          creaturesAdded: d.creaturesAdded,
          creaturesRemoved: [],
          creaturesUpdated: d.creaturesUpdated,
          ...(d.creaturesAdded.length > 0 ? { placement: d.placement } : {}),
        });
      }
      const progressed =
        d.trainerExp !== null || d.badges !== null || d.rating !== null || d.dexSeen.length > 0 || d.dexCaught.length > 0 || d.flags.length > 0 || d.questProgress.length > 0;
      if (progressed) {
        host.send(pid, {
          type: 'progressionDelta',
          badges: d.badges,
          trainerExp: d.trainerExp,
          trainerLevel: d.trainerLevel,
          rating: d.rating,
          dexSeen: d.dexSeen.length > 0 ? d.dexSeen : null,
          dexCaught: d.dexCaught.length > 0 ? d.dexCaught : null,
          flags: d.flags.length > 0 ? d.flags : null,
          questProgress: d.questProgress.length > 0 ? d.questProgress : null,
        });
      }
      if (d.flags.length > 0 || d.badges !== null || d.inventoryAll !== null) {
        host.onProgress(pid, { ...(d.flags.length > 0 ? { flags: d.flags } : {}), ...(d.badges !== null ? { badges: d.badges } : {}), ...(d.inventoryAll !== null ? { inventory: d.inventoryAll } : {}) });
      }
      if (d.beatCompleted !== null) host.send(pid, { type: 'storyBeat', beatId: d.beatCompleted, phase: 'complete' });
      if (next.ended !== null) {
        host.send(pid, { type: 'battleEnd', battleId: session.id, outcome: next.ended, rewards: d.rewards ?? { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null } });
      }
      // nemeses: what became of one in this battle
      for (const m of d.nemesis) host.send(pid, m);
      // the bounty board: what a claim paid
      for (const m of d.bounty) host.send(pid, m);
      // camp bases: what a raid took
      for (const m of d.camp) host.send(pid, m);
    }
  }

  /** §30.4.3 step 3 — the one transaction. Throws to roll back (the caller keeps `before`). */
  private async persistTurn(
    session: BattleSession,
    before: BattleState,
    next: BattleState,
    events: readonly BattleEvent[],
    actionsLog: [SideChoice, SideChoice][],
    nowMs: number,
    track?: NemesisTrack,
  ): Promise<Map<string, PlayerDelta>> {
    const { repos } = this.deps;
    const now = new Date(nowMs);
    const seats = session.seats.filter((s) => s.playerId !== null).sort((a, b) => (a.playerId! < b.playerId! ? -1 : 1));
    const out = new Map<string, PlayerDelta>();
    const roamerFirsts: { pid: string; species: string }[] = [];
    // camp bases: the camps a raid touched (their zone rooms redraw them after the commit)
    const campChanges: string[] = [];
    await repos.db.transaction(async (tx) => {
      const rows = await repos.players.lockMany(
        tx,
        seats.map((s) => s.playerId!),
      );
      for (const seat of seats) {
        const pid = seat.playerId!;
        const side = seat.side;
        const other: 0 | 1 = side === 0 ? 1 : 0;
        const d = emptyDelta();
        const questEvents: QuestEvent[] = [];
        let trainerExpGain = 0;

        // b. creature rows: only the fields battle may change, read back from result.state
        const bSide = before.sides[side];
        const aSide = next.sides[side];
        for (let i = 0; i < aSide.party.length; i++) {
          const a = aSide.party[i]!.creature;
          const b = bSide.party[i]?.creature;
          if (!isPersistedId(a.id) || (b !== undefined && battleFieldsEqual(a, b))) continue;
          const row = await repos.creatures.recordById(tx, a.id);
          if (row === null || row.ownerId !== pid) continue;
          const after = persistableAfterBattle(a);
          const cur = toInstance(row);
          // challenge modes: a creature that faints in an active run has fallen for good
          const falls = session.challenge?.[side] != null && after.hp === 0 && !isFallen(cur);
          const merged: CreatureInstance = {
            ...cur,
            hp: after.hp,
            moves: after.moves,
            status: after.status,
            exp: after.exp,
            level: after.level,
            heldItem: after.heldItem,
            ...(after.honor !== undefined ? { honor: after.honor } : {}),
            ...(falls ? { ribbons: [...cur.ribbons, FALLEN_RIBBON] } : {}),
          };
          await repos.creatures.update(tx, merged);
          d.creaturesUpdated.push(merged);
        }

        // c. consumables used (itemUsed, consumedHeld === false) and d. orbs thrown (catchThrow, side 0)
        const spend: Record<string, number> = {};
        for (const ev of events) {
          if (ev.t === 'itemUsed' && ev.who.side === side && !ev.consumedHeld) spend[ev.item] = (spend[ev.item] ?? 0) - 1;
          if (ev.t === 'catchThrow' && side === 0) spend[ev.orb] = (spend[ev.orb] ?? 0) - 1;
        }
        for (const item of Object.keys(spend).sort()) d.items[item] = await repos.inventory.add(tx, pid, item, spend[item]!);

        // e. catch: insert inside the same tx as the roll (nemeses: a caught nemesis keeps its name and its scar)
        const caughtEv = side === 0 ? events.find((ev): ev is Extract<BattleEvent, { t: 'catchResult' }> => ev.t === 'catchResult' && ev.caught) : undefined;
        let caughtId: string | null = null;
        if (caughtEv !== undefined) {
          const wild = next.sides[1].party[caughtEv.target.slot]!.creature;
          const records = await repos.creatures.byOwner(tx, pid);
          const used = new Set(records.filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
          let partyIndex = -1;
          for (let i = 0; i < 6; i++) {
            if (!used.has(i)) {
              partyIndex = i;
              break;
            }
          }
          const base = persistableAfterBattle(wild);
          const { id: _synthetic, ...fields } = base;
          const inserted = await repos.creatures.insert(
            tx,
            {
              ...fields,
              ownerId: pid,
              nickname: session.nemesis?.name ?? null,
              caughtAt: { zoneId: session.zoneId, at: nowMs },
              favorite: false,
              locked: false,
              ribbons: session.nemesis !== undefined ? [nemesisScarRibbon(session.nemesis.scar as NemesisScar)] : [],
            },
            partyIndex === -1 ? { kind: 'box', index: 'nextBox' } : { kind: 'party', index: partyIndex },
          );
          caughtId = inserted.id;
          d.creaturesAdded.push(toInstance(inserted));
          d.placement[inserted.id] = partyIndex === -1 ? 'box' : 'party';
          const { newSpecies } = await repos.progress.markCaught(tx, pid, wild.speciesId, wild.variantKey, wild.isAlpha, now, wild.isShiny === true);
          d.dexCaught.push(wild.speciesId);
          trainerExpGain += TRAINER_EXP.catch + (newSpecies ? TRAINER_EXP.catchNewSpecies : 0);
          questEvents.push({ kind: 'catch', species: wild.speciesId, isAlpha: wild.isAlpha, isShiny: wild.isShiny === true });
          questEvents.push({ kind: 'dex', caught: await repos.progress.caughtCount(tx, pid) });
        }

        // h. markSeen for every opposing species revealed this turn (arena training writes nothing at all)
        // the daily challenge writes as little as training (no exp, quests, flags or seen marks), plus its own result
        const training = session.arena?.kind === 'training' || session.arena?.kind === 'daily';
        for (const ev of events) {
          if (training) break;
          if (ev.t !== 'switchIn' || ev.who.side !== other) continue;
          const sp = next.sides[other].party[ev.who.slot]?.creature.speciesId;
          if (sp === undefined || d.dexSeen.includes(sp)) continue;
          if (await repos.progress.markSeen(tx, pid, sp, now)) questEvents.push({ kind: 'seen', species: sp });
          d.dexSeen.push(sp);
        }

        // g. battle end: rewards, history, audit, beat completion, static flag
        let money = 0;
        let badge: BadgeId | null = null;
        let ratingDelta: number | null = null;
        let rewardItems: Record<string, number> = {};
        const flagsToSet: string[] = [];
        const outcome = next.ended;
        if (outcome !== null) {
          if (!training) questEvents.push({ kind: 'battle', format: session.format });
          const won = side === 0 ? side0Won(outcome) : outcome.winner === 1;
          if (training) {
            // Arena training: no trainer exp, no quest win, no flags, no money
            if (session.arena?.kind === 'daily' && session.arena.dayKey !== undefined) {
              const run = replayBattle(replayOpts(session.id, session.format, session.seed, session.start), actionsLog, this.deps.content);
              const marks = dailyMarks(run.steps, side);
              await repos.daily.record(tx, pid, session.arena.dayKey, won ? { turns: next.turn, marks, battleId: session.id } : null, now);
            }
          } else if (session.arena !== undefined) {
            // Arena PvP: only Ranked moves the rating (Elo, once per player); every other kind pays the pvp trainer exp
            if (outcome.winner !== 'fled' && outcome.winner !== 'caught') {
              const me = rows.get(pid)!;
              const foe = rows.get(session.seats[other].playerId!)!;
              const ranked = session.arena.ranked;
              if (outcome.winner === 'draw') {
                if (ranked) ratingDelta = eloDrawDelta(me.rating, foe.rating)[0];
              } else if (outcome.winner === side) {
                if (ranked) ratingDelta = eloDelta(me.rating, foe.rating).winnerDelta;
                trainerExpGain += TRAINER_EXP.pvpWin;
                questEvents.push({ kind: 'win', format: 'pvp' });
              } else {
                if (ranked) ratingDelta = eloDelta(foe.rating, me.rating).loserDelta;
                trainerExpGain += TRAINER_EXP.pvpLoss;
              }
              if (ranked && ratingDelta !== null) d.rating = (await repos.players.applyRating(tx, pid, ratingDelta)).rating;
              // Majin vs Tenjin seasons: a ranked win earns the winner's side its points
              if (ranked && outcome.winner === side) await repos.factions.award(tx, seasonAt(nowMs).number, pid, FACTION_POINTS.rankedWin);
            }
          } else if (session.format === 'wild') {
            if (won) trainerExpGain += TRAINER_EXP.wildWin;
            if (won && session.staticFlag !== null) flagsToSet.push(session.staticFlag);
            if (won) questEvents.push({ kind: 'win', format: 'wild', zoneId: session.zoneId as ZoneId });
          } else if (session.tower === true) {
            // Phase D14: the streak (a draw or a loss ends the run) and, every TOWER.setLength wins, the set reward
            const streak = won ? await repos.streaks.recordWin(tx, pid, now) : await repos.streaks.endRun(tx, pid, now);
            let reward: TowerResult['reward'] = null;
            if (won && streak.current % TOWER.setLength === 0) {
              reward = towerSetReward(streak.current / TOWER.setLength);
              money += reward.money;
              for (const [item, qty] of Object.entries(reward.items)) d.items[item] = await repos.inventory.add(tx, pid, item, qty);
              rewardItems = { ...reward.items };
              await repos.audit.write(tx, { actorId: pid, action: 'tower.reward', subject: session.id, detail: { streak: streak.current, money: reward.money, items: reward.items } }, now);
            }
            d.tower = { won, streak, reward };
          } else if (session.camp !== undefined) {
            // camp bases: a raid pays only what it takes from the owner (the cut, once a day per camp), plus the trainer
            // exp of a win; the raider's lead pays in honor; the owner reads it all in the camp log
            if (won) {
              trainerExpGain += TRAINER_EXP.trainerWin;
              questEvents.push({ kind: 'win', format: 'trainer' });
            }
            const r = await settleRaid(repos, tx, this.deps.content, { ...session.camp, raiderId: pid, raiderName: rows.get(pid)!.username, battleId: session.id, won }, nowMs);
            money += r.cut;
            if (r.lead !== null) {
              const i = d.creaturesUpdated.findIndex((c) => c.id === r.lead!.id);
              if (i >= 0) d.creaturesUpdated[i] = r.lead;
              else d.creaturesUpdated.push(r.lead);
            }
            if (r.text !== null) d.camp.push({ type: 'toast', level: 'warn', text: r.text });
            campChanges.push(session.camp.zoneId);
          } else if (session.ghost !== undefined) {
            // ghost trainers: a win pays like a route trainer (no flag: a ghost is no content trainer); the owner learns
            // how their ghost fared when they come back
            if (won && session.npc !== null) {
              money += session.npc.reward;
              trainerExpGain += TRAINER_EXP.trainerWin;
              questEvents.push({ kind: 'win', format: 'trainer' });
            }
            await repos.ghosts.record(tx, session.ghost.ownerId, rows.get(pid)!.username, session.zoneId, !won, now);
            // the bounty board: beating a wanted ghost claims its bounties (once each), paid with this battle's money
            if (won && this.deps.bounties?.() === true) {
              const got = await claimGhostBounties(
                repos,
                tx,
                this.deps.content,
                { ghostOwnerId: session.ghost.ownerId, ghostName: session.ghost.name, claimerId: pid, claimerName: rows.get(pid)!.username, zoneId: session.zoneId, battleId: session.id },
                nowMs,
              );
              if (got !== null) {
                money += got.payout;
                this.noteBroughtIn(d, got);
              }
            }
          } else if (session.villager === true) {
            // NPC talk: a villager's battle pays trainer exp only (no money, no flag: it fights again whenever asked)
            if (won) {
              trainerExpGain += TRAINER_EXP.trainerWin;
              questEvents.push({ kind: 'win', format: 'trainer' });
            }
            // NPC memory: the villager remembers how the battle went (the server saw it; the client never reports it)
            const villagerId = villagerNpcId(session.npc?.trainerId);
            if (villagerId !== null) await recordNpcDeed(repos, tx, pid, villagerId, session.zoneId, won ? 'battleWon' : 'battleLost', now);
          } else if (session.format === 'trainer' && won && session.npc !== null) {
            money += session.npc.reward;
            trainerExpGain += TRAINER_EXP.trainerWin;
            flagsToSet.push(`trainer:${session.npc.trainerId}:beaten`);
            questEvents.push({ kind: 'defeatTrainer', trainerId: session.npc.trainerId }, { kind: 'win', format: 'trainer' });
          } else if (session.format === 'league' && won && session.npc?.leagueId != null && session.rematch) {
            // Phase D14 post-game rematch: ×1.5 reward (carried in npc.reward), the stage's trainer exp, no badge and no
            // setsFlags; the cooldown flag is cleared and re-set so its set time is this win
            const lt = leagueById(session.npc.leagueId);
            money += session.npc.reward;
            trainerExpGain += lt.stage === 'gym' ? TRAINER_EXP.gymWin : lt.stage === 'elite' ? TRAINER_EXP.eliteWin : TRAINER_EXP.championWin;
            const flag = leagueRematchFlag(lt.id);
            await repos.progress.clearFlags(tx, pid, [flag]);
            flagsToSet.push(flag);
            questEvents.push({ kind: 'defeatTrainer', trainerId: lt.id }, { kind: 'win', format: 'league' });
          } else if (session.format === 'league' && won && session.npc?.leagueId != null) {
            const lt = leagueById(session.npc.leagueId);
            money += lt.reward;
            trainerExpGain += lt.stage === 'gym' ? TRAINER_EXP.gymWin : lt.stage === 'elite' ? TRAINER_EXP.eliteWin : TRAINER_EXP.championWin;
            if (lt.badge !== null) {
              // NON-NEGOTIABLE 6: the only badge write in the server
              await repos.progress.awardBadge(tx, pid, lt.badge, now);
              // verified speedruns: every badge is a split on the play clock
              await repos.runs.split(tx, pid, badgeSplit(lt.badge), now);
              badge = lt.badge;
              questEvents.push({ kind: 'badge', badge: lt.badge });
            }
            flagsToSet.push(...lt.setsFlags);
            if (lt.id === CHAMPION_ID) {
              flagsToSet.push(CHAMPION_FLAG);
              // verified speedruns: the run's finish
              await repos.runs.split(tx, pid, CHAMPION_SPLIT, now);
            }
            questEvents.push({ kind: 'defeatTrainer', trainerId: lt.id }, { kind: 'win', format: 'league' });
          } else if (session.format === 'pvp' && outcome.winner !== 'fled' && outcome.winner !== 'caught') {
            const me = rows.get(pid)!;
            const foe = rows.get(session.seats[other].playerId!)!;
            if (outcome.winner === 'draw') {
              ratingDelta = eloDrawDelta(me.rating, foe.rating)[0];
            } else if (outcome.winner === side) {
              ratingDelta = eloDelta(me.rating, foe.rating).winnerDelta;
              trainerExpGain += TRAINER_EXP.pvpWin;
              questEvents.push({ kind: 'win', format: 'pvp' });
            } else {
              ratingDelta = eloDelta(foe.rating, me.rating).loserDelta;
              trainerExpGain += TRAINER_EXP.pvpLoss;
            }
            const r = await repos.players.applyRating(tx, pid, ratingDelta);
            d.rating = r.rating;
            // Majin vs Tenjin seasons: a ranked win earns the winner's side its points
            if (outcome.winner === side) await repos.factions.award(tx, seasonAt(nowMs).number, pid, FACTION_POINTS.rankedWin);
          }
          if (money !== 0) d.money = await repos.players.addMoney(tx, pid, money);
          // challenge modes: beating the Champion clears the run; nothing left that has not fallen fails it (the fallen
          // then keep a memorial ribbon only, so the account plays on)
          if (session.challenge?.[side] != null) {
            if (flagsToSet.includes(CHAMPION_FLAG)) flagsToSet.push(CHALLENGE_CLEARED_FLAG);
            else {
              const mourned = await failIfNothingLeft(tx, repos, pid);
              if (mourned !== null) {
                flagsToSet.push(CHALLENGE_FAILED_FLAG);
                d.creaturesUpdated.push(...mourned);
              }
            }
          }
          // creature history: the party that won a badge, beat the Champion, or caught / defeated a legendary
          const partyIds = aSide.party.map((b) => b.creature.id).filter(isPersistedId);
          if (badge !== null) await repos.creatures.addEvent(tx, partyIds, { kind: 'badge', badge }, now);
          if (flagsToSet.includes(CHAMPION_FLAG)) await repos.creatures.addEvent(tx, partyIds, { kind: 'champion' }, now);
          if (won && session.staticSpecies !== null) await repos.creatures.addEvent(tx, partyIds, { kind: 'legendary', species: session.staticSpecies, caught: outcome.winner === 'caught' }, now);
          // one roaming legendary per season: the first catch of the season's roamer is recorded for good
          if (outcome.winner === 'caught' && isRoamerSpawn(session.spawnId)) {
            const species = before.sides[1].party[0]?.creature.speciesId ?? null;
            if (species !== null && (await repos.legends.claim(tx, seasonAt(nowMs).number, species, pid, rows.get(pid)!.username, now))) {
              await repos.creatures.addEvent(tx, partyIds, { kind: 'legendary', species, caught: true }, now);
              roamerFirsts.push({ pid, species });
            }
          }
          // nemeses: a wild creature that knocked out or escaped the player rises; an ambush ends, or its rank rises
          if (side === 0 && track !== undefined) d.nemesis.push(...(await this.settleNemesis(tx, session, before, next, events, track, pid, outcome, caughtId, now)));
          // the bounty board: a nemesis brought in (knocked out or caught, its story ended just now) pays its personal bounty
          const ended = session.nemesis;
          if (side === 0 && ended !== undefined && this.deps.bounties?.() === true && d.nemesis.some((m) => m.type === 'nemesisNews' && m.nemesisId === ended.id && (m.event === 'beaten' || m.event === 'caught'))) {
            const got = await claimNemesisBounty(
              repos,
              tx,
              this.deps.content,
              { fullName: nemesisFullName(ended), speciesId: ended.speciesId, level: ended.level, rank: ended.rank, claimerId: pid, claimerName: rows.get(pid)!.username, zoneId: session.zoneId, battleId: session.id },
              nowMs,
            );
            if (got !== null) {
              money += got.payout;
              d.money = await repos.players.addMoney(tx, pid, got.payout);
              this.noteBroughtIn(d, got);
            }
          }
          if (flagsToSet.length > 0) {
            await repos.progress.setFlags(tx, pid, flagsToSet, now);
            d.flags.push(...flagsToSet);
            questEvents.push({ kind: 'flags', flags: flagsToSet });
          }
          // §30.4.8 step 4: a beat battle completes only on a side-0 win
          if (session.beatId !== null && side === 0 && side0Won(outcome)) {
            const beat = beatById(session.beatId);
            const done = await completeBeatInTx(tx, repos, pid, beat, now);
            // Phase D1: granted items ride this battle's inventoryDelta
            for (const [item, qty] of Object.entries(done.items)) d.items[item] = qty;
            d.flags.push(...done.flags.filter((f) => !d.flags.includes(f)));
            d.questProgress.push(...done.questProgress);
            d.beatCompleted = beat.id;
          }
        }
        if (trainerExpGain > 0) {
          const r = await repos.players.addTrainerExp(tx, pid, trainerExpGain);
          d.trainerExp = r.trainerExp;
          d.trainerLevel = r.trainerLevel;
        }
        if (questEvents.length > 0) d.questProgress.push(...(await advanceQuests(tx, repos, pid, questEvents, nowMs)));
        if (badge !== null) d.badges = await repos.progress.badges(tx, pid);
        if (outcome !== null) {
          const rewards: RewardsSummary = { money, items: rewardItems, trainerExp: trainerExpGain, ratingDelta, badge };
          d.rewards = rewards;
          await repos.history.recordBattle(tx, {
            battleId: session.id,
            playerId: pid,
            opponent: opponentLabel(session, side),
            format: session.format,
            result: resultFor(outcome, side),
            turns: next.turn,
            ratingDelta,
            rewards,
            seed: session.seed,
            actions: actionsLog,
            start: session.start,
            finalDigest: digestBattleState(next),
            happenedAt: now,
          });
          await repos.audit.write(tx, { actorId: pid, action: 'battle.end', subject: session.id, detail: { format: session.format, result: resultFor(outcome, side), turns: next.turn } }, now);
        }
        d.inventoryAll = await repos.inventory.all(tx, pid);
        out.set(pid, d);
      }
      // honor shapes the world: this turn's deeds count in the zone the battle was fought in (world battles only: not
      // the arena, the tower or a raid)
      if (HONOR_FORMATS.has(session.format) && session.arena === undefined && session.tower !== true && seats.length > 0) {
        const ended = next.ended;
        // camp bases: a raid is never a fair win; a won raid is a dark deed of its own
        const raid = session.camp !== undefined;
        const wonBy = ended !== null && session.format !== 'wild' && !raid && (ended.winner === 0 || ended.winner === 1) ? ended.winner : null;
        const deeds = deedsOf(events, seats.map((s) => s.side), session.format === 'wild' ? 1 : null, (id) => this.deps.content.move(id).type, wonBy);
        const raidShadow = raid && ended !== null && ended.winner === 0 ? CAMP_RAID_SHADOW : 0;
        await repos.worldHonor.add(tx, seasonAt(nowMs).number, session.zoneId, deeds.light, deeds.shadow + raidShadow);
      }
      // a living ecosystem: a plain wild creature caught or knocked out counts against its species in this zone's week
      if (session.format === 'wild' && session.arena === undefined && session.tower !== true && countsForEcosystem(session.spawnId) && this.deps.ecosystem?.() === true) {
        const t = takeOf(events);
        const species = before.sides[1].party[0]?.creature.speciesId ?? null;
        if (species !== null) await repos.ecosystem.add(tx, session.zoneId, ecoWeek(nowMs), species, t.caught, t.ko);
      }
    });
    for (const z of campChanges) this.deps.campChanged?.(z);
    // one roaming legendary per season: the first catcher hears it (after the commit)
    for (const r of roamerFirsts) {
      const name = this.deps.content.species(r.species).name;
      this.deps.host.send(r.pid, { type: 'toast', level: 'success', text: `You are the first to catch ${name} this season. The Dex will remember it.` });
    }
    return out;
  }

  /** The bounty board: a claim's lead (honor, history) among the turn's creature updates, and its toast. */
  private noteBroughtIn(d: PlayerDelta, got: BroughtIn): void {
    if (got.lead !== null) {
      const i = d.creaturesUpdated.findIndex((c) => c.id === got.lead!.id);
      if (i >= 0) d.creaturesUpdated[i] = got.lead;
      else d.creaturesUpdated.push(got.lead);
    }
    d.bounty.push({ type: 'toast', level: 'success', text: got.text });
  }

  /** Nemeses: the rules in force for this battle (a world wild battle in a zone with nemeses on), else null. */
  private nemesesHere(session: BattleSession): { readonly always: boolean; readonly shadow: number } | null {
    if (session.format !== 'wild' || session.arena !== undefined || session.tower === true || session.ghost !== undefined) return null;
    return this.deps.nemeses?.() ?? null;
  }

  /**
   * Nemeses, at the end of a wild battle (inside its end transaction): an ambush caught (the creature's history says it
   * was the nemesis), knocked out (the creature that landed the blow keeps a trophy line), escaped again (its rank
   * rises) or merely met; a plain wild creature that knocked out or escaped the player may rise as a new nemesis.
   */
  private async settleNemesis(
    tx: Tx,
    session: BattleSession,
    before: BattleState,
    next: BattleState,
    events: readonly BattleEvent[],
    track: NemesisTrack,
    pid: string,
    outcome: BattleOutcome,
    caughtId: string | null,
    now: Date,
  ): Promise<ServerMessage[]> {
    const { repos, content } = this.deps;
    const here = this.nemesesHere(session);
    if (here === null) return [];
    const rng = createRng(`nemesis:${session.id}:${next.turn}`);
    const zoneId = session.zoneId;
    const news = (event: 'rose' | 'rankUp' | 'beaten' | 'caught' | 'faded', n: Nemesis): ServerMessage => ({
      type: 'nemesisNews',
      event,
      nemesisId: n.id,
      name: n.name,
      title: n.title,
      speciesId: n.speciesId,
      scar: n.scar as NemesisScar,
      rank: n.rank,
      level: n.level,
    });
    const n = session.nemesis;
    if (n !== undefined) {
      const line = (how: 'beaten' | 'caught') => ({ kind: 'nemesis' as const, how, name: nemesisFullName(n), speciesId: n.speciesId, rank: n.rank, zoneId });
      if (outcome.winner === 'caught') {
        if (!(await repos.nemeses.end(tx, n.id, 'caught', zoneId, now))) return [];
        if (caughtId !== null) await repos.creatures.addEvent(tx, [caughtId], line('caught'), now);
        return [news('caught', n)];
      }
      if (outcome.winner === 0) {
        if (!(await repos.nemeses.end(tx, n.id, 'beaten', zoneId, now))) return [];
        const victor = finisherOf(before, next, events);
        if (victor !== null) await repos.creatures.addEvent(tx, [victor], line('beaten'), now);
        return [news('beaten', n)];
      }
      const how = promotionOf(track, outcome);
      if (how === null) {
        await repos.nemeses.seen(tx, n.id, zoneId, now);
        return [];
      }
      const up = await repos.nemeses.rankUp(tx, n.id, rankUpOf(rng, n, track, how, zoneId), now);
      return up === null ? [] : [news('rankUp', up)];
    }
    // a plain wild creature: never a static, the roamer or a legendary
    if (session.staticSpecies !== null || session.spawnId === null || isRoamerSpawn(session.spawnId) || isNemesisSpawn(session.spawnId)) return [];
    const how = promotionOf(track, outcome);
    const wild = next.sides[1].party[0]?.creature;
    if (how === null || wild === undefined || content.species(wild.speciesId).legendary) return [];
    if (!here.always && rng.next() >= nemesisPromoteChance(here.shadow)) return [];
    const taken = (await repos.nemeses.active(tx, pid)).map((x) => x.name);
    const { nemesis, faded } = await repos.nemeses.rise(tx, riseNemesis(rng, content, wild, track, how, zoneId, pid, taken), NEMESIS_MAX, now);
    return [news('rose', nemesis), ...faded.map((f) => news('faded', f))];
  }

  private finish(session: BattleSession, outcome: BattleOutcome): void {
    this.drop(session);
    this.deps.host.onEnd(session, outcome);
  }

  private drop(session: BattleSession): void {
    this.sessions.delete(session.id);
    for (const seat of session.seats) if (seat.playerId !== null && this.byPlayer.get(seat.playerId) === session.id) this.byPlayer.delete(seat.playerId);
  }

  /** A server fault: `battleEnd { winner: 'draw' }` with no rewards, nothing persisted for this turn. */
  private voidBattle(session: BattleSession): void {
    session.resolving = false;
    this.drop(session);
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      this.deps.host.send(seat.playerId, { type: 'battleEnd', battleId: session.id, outcome: { winner: 'draw' }, rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null } });
    }
    this.deps.host.onEnd(session, 'void');
  }

  /**
   * §30.2.2 remove: a PvP battle is a forfeit (resolved through core); wild/trainer/league end with no rewards
   * (nothing further is persisted — every resolved turn already is).
   */
  async forfeitIfActive(playerId: string, _reason: 'disconnect' | 'kicked'): Promise<void> {
    const session = this.ofPlayer(playerId);
    if (session === null) return;
    if (session.format !== 'pvp') {
      this.drop(session);
      this.deps.host.onEnd(session, session.state.turn === 0 ? 'playerLeft' : 'void');
      return;
    }
    const side = session.seats.find((s) => s.playerId === playerId)!.side;
    const other: 0 | 1 = side === 0 ? 1 : 0;
    for (let guard = 0; guard < 3 && this.sessions.has(session.id); guard++) {
      while (session.resolving) await new Promise((r) => setTimeout(r, 5));
      if (!this.sessions.has(session.id)) return;
      const st = session.state;
      const forfeit: Action = { kind: 'forfeit' };
      const mustAct = mustActSides(session);
      session.pending = emptyPending(st, session.seats);
      if (isDoubles(session)) {
        // Phase D6: the leaver forfeits from its first required position (a replacement phase cannot forfeit: auto-fill)
        const req = requiredPositions(st, side);
        const first = req[0];
        const mine: [Action | null, Action | null] = [null, null];
        if (first !== undefined && validateAction(st, side, forfeit, this.deps.content, first) === null) mine[first] = forfeit;
        if (mustAct.includes(side)) session.pending[side] = autoPair(st, side, this.deps.content, mine);
        if (mustAct.includes(other)) session.pending[other] = autoPair(st, other, this.deps.content);
      } else {
        const mine = validateAction(st, side, forfeit, this.deps.content) === null ? forfeit : autoAction(st, side, this.deps.content);
        if (mustAct.includes(side)) session.pending[side] = mine;
        if (mustAct.includes(other)) session.pending[other] = autoAction(st, other, this.deps.content);
      }
      await this.resolveNow(session);
    }
    if (this.sessions.has(session.id)) this.voidBattle(session);
  }

  /** §30.4.3 "Deadline": auto-actions for seats that did not act, then resolve. */
  async tick(now: number): Promise<void> {
    for (const session of [...this.sessions.values()]) {
      if (session.resolving || now < session.deadlineAt) continue;
      const content = this.deps.content;
      for (const side of mustActSides(session)) {
        if (isDoubles(session)) {
          // Phase D6: fill only the positions still waiting
          if (sideReady(session, side)) continue;
          session.autoActions[side] += 1;
          session.pending[side] = autoPair(session.state, side, content, session.pending[side] as [Action | null, Action | null]);
          continue;
        }
        if (session.pending[side] !== null) continue;
        session.autoActions[side] += 1;
        let a = autoAction(session.state, side, content);
        if (session.format === 'pvp' && session.autoActions[side] >= 2 && validateAction(session.state, side, { kind: 'forfeit' }, content) === null) a = { kind: 'forfeit' };
        session.pending[side] = a;
      }
      await this.resolveNow(session);
    }
  }

  dispose(): void {
    this.sessions.clear();
    this.byPlayer.clear();
  }
}

/**
 * Nemeses: the player's creature (a persisted id) that knocked out the wild battler this turn: the source of the last
 * damage it took before fainting, else the player's active creature; null when none is a stored creature.
 */
function finisherOf(before: BattleState, next: BattleState, events: readonly BattleEvent[]): string | null {
  let slot: number | null = null;
  for (const e of events) {
    if (e.t === 'damage' && e.target.side === 1 && e.source?.side === 0) slot = e.source.slot;
    if (e.t === 'faint' && e.who.side === 1) break;
  }
  const id = (slot !== null ? before.sides[0].party[slot]?.creature.id : undefined) ?? next.sides[0].party[next.sides[0].active]?.creature.id;
  return id !== undefined && isPersistedId(id) ? id : null;
}

function opponentLabel(session: BattleSession, side: 0 | 1): string {
  const other = session.seats[side === 0 ? 1 : 0];
  if (other.playerId !== null) return other.playerId;
  if (session.npc !== null) return session.npc.trainerId;
  const lead = session.state.sides[side === 0 ? 1 : 0].party[0];
  return (lead?.creature.speciesId ?? 'wild').slice(0, 64);
}

/** A progressionDelta carrying only the given fields. */
export function progressionOnly(p: Partial<Omit<Extract<ServerMessage, { type: 'progressionDelta' }>, 'type'>>): ServerMessage {
  return {
    type: 'progressionDelta',
    badges: p.badges ?? null,
    trainerExp: p.trainerExp ?? null,
    trainerLevel: p.trainerLevel ?? null,
    rating: p.rating ?? null,
    dexSeen: p.dexSeen ?? null,
    dexCaught: p.dexCaught ?? null,
    flags: p.flags ?? null,
    questProgress: p.questProgress ?? null,
  };
}
