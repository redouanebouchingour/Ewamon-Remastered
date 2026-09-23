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
import { league as leagueById, storyBeat as beatById } from '@ewa/content';
import type { BadgeId, LeagueTrainer, LegendaryStatic, TrainerDef, ZoneDef } from '@ewa/content';
import {
  TRAINER_EXP,
  createBattle,
  createRng,
  digestBattleState,
  eloDelta,
  eloDrawDelta,
  projectBattler,
  resolveTurn,
  validateAction,
} from '@ewa/core';
import type { Action, BattleEvent, BattleFormat, BattleOutcome, BattleState, ContentIndex, CreatureInstance, Rng, RngState, Side, Terrain } from '@ewa/core';
import type { QuestProgressEntry, RewardsSummary, ServerMessage } from '@ewa/protocol';
import type { Db, Repos } from '@ewa/persist';
import type { Logger } from '../log';
import type { RoomMetrics } from '../metrics';
import { isPersistedId, newCreature, persistableAfterBattle, withSyntheticId } from '../game/creatures';
import { advanceQuests } from '../game/quests';
import type { QuestEvent } from '../game/quests';
import type { SpawnRecord } from './spawnDirector';
import { completeBeatInTx } from './storyBeats';

export const TURN_DEADLINE_MS = 30_000;
export const REPLACEMENT_DEADLINE_MS = 20_000;
/** The champion id checked anywhere in server code (NON-NEGOTIABLE 11). */
export const CHAMPION_ID = 'zeon';
export const CHAMPION_FLAG = 'champion:zeon:beaten';

/** null player = wild/NPC/league side */
export interface Seat {
  readonly side: 0 | 1;
  readonly playerId: string | null;
  readonly sessionId: string | null;
}

export interface BattleSession {
  readonly id: string;
  readonly format: BattleFormat;
  readonly zoneId: ZoneDef['id'];
  readonly seats: readonly [Seat, Seat];
  /** core; the ONLY copy of the truth */
  state: BattleState;
  /** createBattle's seed snapshot, for battle_history.seed */
  readonly seed: RngState;
  /** one entry per resolved resolveTurn, for battle_history.actions */
  readonly actionsLog: [Action | null, Action | null][];
  /** actions received for the CURRENT turn */
  pending: [Action | null, Action | null];
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
  readonly x: number;
  readonly z: number;
  // ---- server bookkeeping beyond the spec's shape ----
  /** per-side inventory snapshot (item/orb balance checks at validate time); null for non-player sides */
  inventory: [Record<string, number> | null, Record<string, number> | null];
  /** consecutive deadline auto-actions per side (pvp: 2 → forfeit) */
  autoActions: [number, number];
  /** consecutive persistence failures (2 → void) */
  faults: number;
  /** trainer rematch (half reward) */
  readonly rematch: boolean;
  /** the LegendaryStatic flag to set on win/catch */
  readonly staticFlag: string | null;
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
  readonly zone: ZoneDef;
  readonly host: BattleHost;
  readonly metrics: RoomMetrics;
}

export interface PlayerSeat {
  readonly playerId: string;
  readonly sessionId: string;
}

export type StartResult = { readonly ok: true; readonly session: BattleSession } | { readonly ok: false; readonly code: 'notAllowed' | 'busy' | 'internal'; readonly detail: string };
export type ActionResult = null | { readonly code: 'notFound' | 'notAllowed' | 'busy'; readonly detail: string | null };

const TERRAIN_BY_BIOME: Readonly<Record<ZoneDef['biome'], Terrain>> = {
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
}

function emptyDelta(): PlayerDelta {
  return {
    items: {},
    money: null,
    creaturesAdded: [],
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
    caughtAt: c.caughtAt === null ? null : { zoneId: c.caughtAt.zoneId, at: c.caughtAt.at },
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

/** Sides whose player must act this turn: in a replacement phase only the mustSwitch side(s). */
export function mustActSides(session: BattleSession): (0 | 1)[] {
  const st = session.state;
  const replacement = st.sides[0].mustSwitch || st.sides[1].mustSwitch;
  const out: (0 | 1)[] = [];
  for (const seat of session.seats) {
    if (seat.playerId === null) continue;
    if (replacement && !st.sides[seat.side].mustSwitch) continue;
    out.push(seat.side);
  }
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

  private playerSide(party: readonly CreatureInstance[], playerId: string, canFlee: boolean, canCatch: boolean): Omit<Side, 'mustSwitch' | 'consumedItems'> | null {
    const content = this.deps.content;
    const battlers = party.slice(0, 6).map((c) => projectBattler(toInstance(c), content));
    const active = battlers.findIndex((b) => b.creature.hp > 0);
    if (active === -1) return null;
    return { kind: 'player', party: battlers, active, trainerId: playerId, canFlee, canCatch };
  }

  /** Reads party + inventory under the player lock and marks the opposing lead seen — the start transaction. */
  private async loadPlayers(ids: readonly string[], seenSpecies: string | null): Promise<Map<string, { party: CreatureInstance[]; inventory: Record<string, number> }>> {
    const { repos, clock } = this.deps;
    const out = new Map<string, { party: CreatureInstance[]; inventory: Record<string, number> }>();
    await repos.db.transaction(async (tx) => {
      await repos.players.lockMany(tx, ids);
      for (const id of [...ids].sort()) {
        const party = await repos.creatures.party(tx, id);
        const inventory = await repos.inventory.all(tx, id);
        out.set(id, { party, inventory });
        if (seenSpecies !== null && party.some((c) => c.hp > 0)) await repos.progress.markSeen(tx, id, seenSpecies, new Date(clock()));
      }
    });
    return out;
  }

  private open(
    base: Omit<BattleSession, 'state' | 'seed' | 'actionsLog' | 'pending' | 'deadlineAt' | 'resolving' | 'startedAt' | 'autoActions' | 'faults'>,
    sides: readonly [Omit<Side, 'mustSwitch' | 'consumedItems'>, Omit<Side, 'mustSwitch' | 'consumedItems'>],
    seed: RngState,
  ): { session: BattleSession; events: readonly BattleEvent[] } {
    const now = this.deps.clock();
    const { state, events } = createBattle({ id: base.id, format: base.format, zoneId: base.zoneId, terrain: TERRAIN_BY_BIOME[this.deps.zone.biome], seed, sides }, this.deps.content);
    const session: BattleSession = {
      ...base,
      state,
      seed,
      actionsLog: [],
      pending: [null, null],
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
      this.deps.host.send(seat.playerId, { type: 'battleStart', battleId: session.id, format: session.format, seat: seat.side, state, events, stateDigest: digestBattleState(state) });
    }
    return { session, events };
  }

  /** §30.4.4 `wild`: one battler projected from the SpawnRecord. */
  async startWild(p: PlayerSeat, spawn: SpawnRecord, at: { readonly x: number; readonly z: number }): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([p.playerId], spawn.speciesId);
    const side0 = this.playerSide(loaded.get(p.playerId)!.party, p.playerId, true, true);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const wild = withSyntheticId(
      newCreature(this.deps.content, spawn.speciesId, spawn.level, { ability: spawn.ability, variantKey: spawn.variantKey, isAlpha: spawn.isAlpha }),
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
        inventory: [loaded.get(p.playerId)!.inventory, null],
        rematch: false,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    this.deps.host.send(p.playerId, progressionOnly({ dexSeen: [spawn.speciesId] }));
    return { ok: true, session };
  }

  /** §30.4.6 `static`: format wild, canFlee false, canCatch true; flag set on win or catch. */
  async startStatic(p: PlayerSeat, st: LegendaryStatic, at: { readonly x: number; readonly z: number }): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([p.playerId], st.species);
    const side0 = this.playerSide(loaded.get(p.playerId)!.party, p.playerId, false, true);
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
        inventory: [loaded.get(p.playerId)!.inventory, null],
        rematch: false,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    return { ok: true, session };
  }

  /** §30.4.4 `trainer` / `league`: team from content (league: nickname/ability/heldItem verbatim). */
  async startNpc(
    p: PlayerSeat,
    def: { readonly kind: 'trainer'; readonly trainer: TrainerDef; readonly rematch: boolean } | { readonly kind: 'league'; readonly league: LeagueTrainer },
    beatId: string | null,
    at: { readonly x: number; readonly z: number },
  ): Promise<StartResult> {
    if (this.byPlayer.has(p.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const content = this.deps.content;
    const trainerId = def.kind === 'trainer' ? def.trainer.id : def.league.id;
    const team: CreatureInstance[] =
      def.kind === 'trainer'
        ? def.trainer.team.map((m, i) => withSyntheticId(newCreature(content, m.species, m.level), `npc:${trainerId}:${i}`))
        : def.league.team.map((m, i) =>
            withSyntheticId(newCreature(content, m.species, m.level, { nickname: m.nickname, ability: m.ability, heldItem: m.heldItem }), `npc:${trainerId}:${i}`),
          );
    const loaded = await this.loadPlayers([p.playerId], team[0]!.speciesId);
    const side0 = this.playerSide(loaded.get(p.playerId)!.party, p.playerId, false, false);
    if (side0 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    const side1: Omit<Side, 'mustSwitch' | 'consumedItems'> = {
      kind: 'npc',
      party: team.map((c) => projectBattler(c, content)),
      active: 0,
      trainerId,
      canFlee: false,
      canCatch: false,
    };
    const reward = def.kind === 'trainer' ? (def.rematch ? Math.floor(def.trainer.reward / 2) : def.trainer.reward) : def.league.reward;
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
        inventory: [loaded.get(p.playerId)!.inventory, null],
        rematch: def.kind === 'trainer' && def.rematch,
      },
      [side0, side1],
      this.rng.fork().snapshot(),
    );
    return { ok: true, session };
  }

  /** §30.4.5 step 3: lock both players in one tx (ascending uuid) to read parties; seed = createRng(battleId). */
  async startPvp(challenger: PlayerSeat, accepter: PlayerSeat, at: { readonly x: number; readonly z: number }): Promise<StartResult> {
    if (this.byPlayer.has(challenger.playerId) || this.byPlayer.has(accepter.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
    const loaded = await this.loadPlayers([challenger.playerId, accepter.playerId], null);
    const side0 = this.playerSide(loaded.get(challenger.playerId)!.party, challenger.playerId, false, false);
    const side1 = this.playerSide(loaded.get(accepter.playerId)!.party, accepter.playerId, false, false);
    if (side0 === null || side1 === null) return { ok: false, code: 'notAllowed', detail: 'noUsableParty' };
    if (this.byPlayer.has(challenger.playerId) || this.byPlayer.has(accepter.playerId)) return { ok: false, code: 'busy', detail: 'inBattle' };
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
        inventory: [loaded.get(challenger.playerId)!.inventory, loaded.get(accepter.playerId)!.inventory],
        rematch: false,
      },
      [side0, side1],
      createRng(id).snapshot(),
    );
    return { ok: true, session };
  }

  // ─── actions ────────────────────────────────────────────────────────────────

  /** §30.4.2 `battleAction` handler. null = accepted. */
  action(playerId: string, battleId: string, turn: number, action: Action): ActionResult {
    const session = this.sessions.get(battleId);
    const seat = session?.seats.find((s) => s.playerId === playerId);
    if (session === undefined || seat === undefined) return { code: 'notFound', detail: null };
    if (session.resolving) return { code: 'notAllowed', detail: 'resolving' };
    if (turn !== session.state.turn + 1) return { code: 'notAllowed', detail: 'wrongTurn' };
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

  /** `battleResync`: only to a seat holder; the full BattleState (pvp team-preview hiding is cut, §30.4.3). */
  resync(playerId: string, battleId: string): ServerMessage | null {
    const session = this.sessions.get(battleId);
    if (session === undefined || !session.seats.some((s) => s.playerId === playerId)) return null;
    return { type: 'battleResync', battleId, state: session.state, stateDigest: digestBattleState(session.state) };
  }

  // ─── resolution ─────────────────────────────────────────────────────────────

  /** §30.4.3 — resolve, persist in ONE transaction, then send. Never runs twice for one session at once. */
  async resolveNow(session: BattleSession): Promise<void> {
    if (session.resolving || !this.sessions.has(session.id)) return;
    session.resolving = true;
    const { content, log, clock } = this.deps;
    const before = session.state;
    const actions: [Action | null, Action | null] = [session.pending[0], session.pending[1]];
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
    let deltas: Map<string, PlayerDelta>;
    try {
      deltas = await this.persistTurn(session, before, next, events, [...session.actionsLog, actions], now);
    } catch (e) {
      log.error({ err: e, battleId: session.id }, 'battle turn transaction failed');
      this.deps.metrics.battleFaults += 1;
      session.pending = [null, null];
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
    session.pending = [null, null];
    const anyMustSwitch = next.sides[0].mustSwitch || next.sides[1].mustSwitch;
    session.deadlineAt = now + (anyMustSwitch ? REPLACEMENT_DEADLINE_MS : TURN_DEADLINE_MS);
    this.sendAfterCommit(session, next, events, deltas);
    session.resolving = false;
    if (next.ended !== null) {
      this.finish(session, next.ended);
      return;
    }
    // a replacement phase in which only NPC sides must switch resolves immediately (core chooses)
    if (mustActSides(session).length === 0) await this.resolveNow(session);
  }

  private sendAfterCommit(session: BattleSession, next: BattleState, events: readonly BattleEvent[], deltas: Map<string, PlayerDelta>): void {
    const host = this.deps.host;
    const digest = digestBattleState(next);
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      const pid = seat.playerId;
      host.send(pid, { type: 'battleEvents', battleId: session.id, turn: next.turn, events, stateDigest: digest, rng: next.rng });
      const d = deltas.get(pid);
      if (d === undefined) continue;
      if (d.inventoryAll !== null) session.inventory[seat.side] = d.inventoryAll;
      const itemsTouched = Object.keys(d.items).length > 0;
      if (itemsTouched || d.money !== null || d.creaturesAdded.length > 0 || d.creaturesUpdated.length > 0) {
        host.send(pid, { type: 'inventoryDelta', items: d.items, money: d.money, creaturesAdded: d.creaturesAdded, creaturesRemoved: [], creaturesUpdated: d.creaturesUpdated });
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
    }
  }

  /** §30.4.3 step 3 — the one transaction. Throws to roll back (the caller keeps `before`). */
  private async persistTurn(
    session: BattleSession,
    before: BattleState,
    next: BattleState,
    events: readonly BattleEvent[],
    actionsLog: [Action | null, Action | null][],
    nowMs: number,
  ): Promise<Map<string, PlayerDelta>> {
    const { repos } = this.deps;
    const now = new Date(nowMs);
    const seats = session.seats.filter((s) => s.playerId !== null).sort((a, b) => (a.playerId! < b.playerId! ? -1 : 1));
    const out = new Map<string, PlayerDelta>();
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
          const merged: CreatureInstance = { ...toInstance(row), hp: after.hp, moves: after.moves, status: after.status, exp: after.exp, level: after.level, heldItem: after.heldItem };
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

        // e. catch: insert inside the same tx as the roll
        const caughtEv = side === 0 ? events.find((ev): ev is Extract<BattleEvent, { t: 'catchResult' }> => ev.t === 'catchResult' && ev.caught) : undefined;
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
            { ...fields, ownerId: pid, nickname: null, caughtAt: { zoneId: session.zoneId, at: nowMs }, favorite: false, locked: false, ribbons: [] },
            partyIndex === -1 ? { kind: 'box', index: 'nextBox' } : { kind: 'party', index: partyIndex },
          );
          d.creaturesAdded.push(toInstance(inserted));
          const { newSpecies } = await repos.progress.markCaught(tx, pid, wild.speciesId, wild.variantKey, wild.isAlpha, now);
          d.dexCaught.push(wild.speciesId);
          trainerExpGain += TRAINER_EXP.catch + (newSpecies ? TRAINER_EXP.catchNewSpecies : 0);
          questEvents.push({ kind: 'catch', species: wild.speciesId });
        }

        // h. markSeen for every opposing species revealed this turn
        for (const ev of events) {
          if (ev.t !== 'switchIn' || ev.who.side !== other) continue;
          const sp = next.sides[other].party[ev.who.slot]?.creature.speciesId;
          if (sp === undefined || d.dexSeen.includes(sp)) continue;
          await repos.progress.markSeen(tx, pid, sp, now);
          d.dexSeen.push(sp);
        }

        // g. battle end: rewards, history, audit, beat completion, static flag
        let money = 0;
        let badge: BadgeId | null = null;
        let ratingDelta: number | null = null;
        const flagsToSet: string[] = [];
        const outcome = next.ended;
        if (outcome !== null) {
          const won = side === 0 ? side0Won(outcome) : outcome.winner === 1;
          if (session.format === 'wild') {
            if (won) trainerExpGain += TRAINER_EXP.wildWin;
            if (won && session.staticFlag !== null) flagsToSet.push(session.staticFlag);
            if (won) questEvents.push({ kind: 'win', format: 'wild' });
          } else if (session.format === 'trainer' && won && session.npc !== null) {
            money += session.npc.reward;
            trainerExpGain += TRAINER_EXP.trainerWin;
            flagsToSet.push(`trainer:${session.npc.trainerId}:beaten`);
            questEvents.push({ kind: 'defeatTrainer', trainerId: session.npc.trainerId }, { kind: 'win', format: 'trainer' });
          } else if (session.format === 'league' && won && session.npc?.leagueId != null) {
            const lt = leagueById(session.npc.leagueId);
            money += lt.reward;
            trainerExpGain += lt.stage === 'gym' ? TRAINER_EXP.gymWin : lt.stage === 'elite' ? TRAINER_EXP.eliteWin : TRAINER_EXP.championWin;
            if (lt.badge !== null) {
              // NON-NEGOTIABLE 6: the only badge write in the server
              await repos.progress.awardBadge(tx, pid, lt.badge, now);
              badge = lt.badge;
              questEvents.push({ kind: 'badge', badge: lt.badge });
            }
            flagsToSet.push(...lt.setsFlags);
            if (lt.id === CHAMPION_ID) flagsToSet.push(CHAMPION_FLAG);
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
          }
          if (money !== 0) d.money = await repos.players.addMoney(tx, pid, money);
          if (flagsToSet.length > 0) {
            await repos.progress.setFlags(tx, pid, flagsToSet, now);
            d.flags.push(...flagsToSet);
            questEvents.push({ kind: 'flags', flags: flagsToSet });
          }
          // §30.4.8 step 4: a beat battle completes only on a side-0 win
          if (session.beatId !== null && side === 0 && side0Won(outcome)) {
            const beat = beatById(session.beatId);
            const done = await completeBeatInTx(tx, repos, pid, beat, now);
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
        if (questEvents.length > 0) d.questProgress.push(...(await advanceQuests(tx, repos, pid, questEvents)));
        if (badge !== null) d.badges = await repos.progress.badges(tx, pid);
        if (outcome !== null) {
          const rewards: RewardsSummary = { money, items: {}, trainerExp: trainerExpGain, ratingDelta, badge };
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
            happenedAt: now,
          });
          await repos.audit.write(tx, { actorId: pid, action: 'battle.end', subject: session.id, detail: { format: session.format, result: resultFor(outcome, side), turns: next.turn } }, now);
        }
        d.inventoryAll = await repos.inventory.all(tx, pid);
        out.set(pid, d);
      }
    });
    return out;
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
      const mine = validateAction(st, side, forfeit, this.deps.content) === null ? forfeit : autoAction(st, side, this.deps.content);
      const mustAct = mustActSides(session);
      session.pending = [null, null];
      if (mustAct.includes(side)) session.pending[side] = mine;
      if (mustAct.includes(other)) session.pending[other] = autoAction(st, other, this.deps.content);
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
