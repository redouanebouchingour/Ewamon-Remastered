/**
 * §30.4.7 Raids — shared boss HP, a public damage board, 20 s rounds, enrage below 30 %, a 60 s catch window.
 *
 * `RaidSession` is pure (injected `now`, no I/O): the boss is ONE `Battler` whose HP/stages/status are copied into
 * each participant's private `BattleState` (side 1) before that participant's `resolveTurn` and written back after,
 * participants processed in ascending playerId order, so a round's outcome is a function of the seed and the
 * actions. Every number comes out of core (`resolveTurn`, `chooseNpcAction` via a null NPC action, the §2.15 catch
 * through a catch-only `resolveTurn`).
 *
 * Rounds resolve in two phases (`prepareRound` → the caller's ONE transaction → `commitRound`), the battle pipeline's
 * rule: a failed transaction leaves every private state and the boss unchanged. `RaidRunner` is that caller for a
 * room (DB + `RaidHost`, no Colyseus import).
 */
import { randomUUID } from 'node:crypto';
import type { RaidHotspot, ZoneDef } from '@ewa/content';
import { TRAINER_EXP, calcMaxHp, clampStage, createBattle, digestBattleState, projectBattler, resolveTurn, validateAction } from '@ewa/core';
import type { Action, ActionError, BattleEvent, BattleState, Battler, ContentIndex, CreatureInstance, Rng, Side, Terrain } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import type { QuestProgressEntry, RewardsSummary, ServerMessage } from '@ewa/protocol';
import { isPersistedId, newCreature, persistableAfterBattle, withSyntheticId } from '../game/creatures';
import { advanceQuests } from '../game/quests';
import type { Logger } from '../log';
import { autoAction, toInstance } from './battleSession';

export const RAID_ROUND_MS = 20_000;
export const RAID_LOBBY_MS = 90_000;
export const RAID_MAX_PLAYERS = 8;
export const RAID_CATCH_WINDOW_MS = 60_000;
/** phase 2 below this hpPct */
export const RAID_ENRAGE_HP = 0.3;
/** applied once when phase 2 begins */
export const RAID_ENRAGE_ATK_STAGES = 2;
/** raidJoin requires being within this distance of the hotspot (§30.9.2) */
export const RAID_JOIN_RANGE_M = 8;
/** money reward per boss level (§30.4.4 `raid` row) */
export const RAID_MONEY_PER_LEVEL = 50;
/** a finished raid stays visible (phase 4) this long before the room drops it */
export const RAID_LINGER_MS = 10_000;

/** 0 lobby · 1 fight · 2 enraged (hpPct < 0.3) · 3 catch window · 4 over */
export type RaidPhase = 0 | 1 | 2 | 3 | 4;

export interface RaidParticipant {
  readonly playerId: string;
  ready: boolean;
  /** the participant's private battle (side 0 = their party, side 1 = the shared boss as of their last turn) */
  state: BattleState;
  pending: Action | null;
  damage: number;
  caughtAttempted: boolean;
  /** fainted all six (or forfeited): stays on the board, acts no more */
  spectator: boolean;
  /** the catch roll's rng (continues the private battle's stream) */
  catchRng: BattleState['rng'];
}

/** The plain mirror of protocol's `RaidState` schema (the room copies it into `state.raid`). */
export interface RaidView {
  readonly id: string;
  readonly bossSpecies: string;
  readonly bossLevel: number;
  readonly hpPct: number;
  readonly phase: RaidPhase;
  readonly roundEndsInMs: number;
  readonly damageBoard: Readonly<Record<string, number>>;
  readonly x: number;
  readonly z: number;
}

export type RaidJoinResult = 'ok' | 'full' | 'started' | 'badges' | 'already' | 'noParty';
export type RaidActionResult = ActionError | 'wrongRound' | 'notParticipant' | 'alreadySubmitted' | 'notFighting' | null;

/** One prepared (uncommitted) round. */
export interface RaidRound {
  readonly round: number;
  readonly order: readonly string[];
  readonly states: ReadonlyMap<string, BattleState>;
  readonly events: ReadonlyMap<string, readonly BattleEvent[]>;
  readonly actions: ReadonlyMap<string, Action>;
  readonly damage: ReadonlyMap<string, number>;
  readonly boss: Battler;
  readonly enraged: boolean;
  readonly bossDefeated: boolean;
  readonly spectators: ReadonlySet<string>;
}

export interface CatchRoll {
  readonly caught: boolean;
  readonly events: readonly BattleEvent[];
  readonly stateDigest: string;
  /** the creature a successful catch inserts (full HP, the boss's species/level/ability/variant) */
  readonly creature: Omit<CreatureInstance, 'id'>;
}

const BOSS_REF = { side: 1 as const, slot: 0 };

export class RaidSession {
  readonly id: string;
  phase: RaidPhase = 0;
  round = 0;
  /** lobby: RAID_LOBBY_MS after opening; fight: the collecting round's deadline; catch window: its end */
  deadlineAt: number;
  /** the shared boss battler (hp here is the authoritative raid HP) */
  bossBattler: Battler;
  enraged = false;
  endedAt: number | null = null;
  readonly participants = new Map<string, RaidParticipant>();
  private readonly openedAt: number;

  constructor(
    readonly hotspot: RaidHotspot,
    private readonly rng: Rng,
    private readonly content: ContentIndex,
    now: number,
    private readonly terrain: Terrain = 'none',
    id: string = randomUUID(),
  ) {
    this.id = id;
    this.openedAt = now;
    this.deadlineAt = now + RAID_LOBBY_MS;
    const sp = content.species(hotspot.boss.species);
    const creature = withSyntheticId(newCreature(content, hotspot.boss.species, hotspot.boss.level), `raid:${hotspot.id}`);
    const projected = projectBattler(creature, content);
    const maxHp = Math.max(1, Math.floor(calcMaxHp(sp.baseHp, hotspot.boss.level) * hotspot.boss.hpMultiplier));
    this.bossBattler = { ...projected, maxHp, creature: { ...projected.creature, hp: maxHp } };
  }

  /** ONE Side shared by every participant's private BattleState (spec `boss`). */
  get boss(): Side {
    return { kind: 'wild', party: [this.bossBattler], active: 0, trainerId: null, canFlee: false, canCatch: false, mustSwitch: false, consumedItems: [] };
  }

  get hpPct(): number {
    return this.bossBattler.creature.hp / this.bossBattler.maxHp;
  }

  get openedAtMs(): number {
    return this.openedAt;
  }

  /**
   * Side 1 := the shared boss. The boss acts once per participant per round, so its PP is restored to ppMax on
   * every copy-in (Q15): a raid boss never runs dry (core's NPC choice would otherwise end the private battle).
   */
  private withBoss(state: BattleState, boss: Battler): BattleState {
    const s1 = state.sides[1];
    const fresh: Battler = boss.creature.moves.every((m) => m.pp === m.ppMax) ? boss : { ...boss, creature: { ...boss.creature, moves: boss.creature.moves.map((m) => ({ ...m, pp: m.ppMax })) } };
    return { ...state, sides: [state.sides[0], { ...s1, party: [fresh], active: 0, mustSwitch: false }] };
  }

  join(playerId: string, party: readonly CreatureInstance[], badges: number, now: number): RaidJoinResult {
    if (this.participants.has(playerId)) return 'already';
    if (this.phase !== 0) return 'started';
    if (badges < this.hotspot.minBadges) return 'badges';
    if (this.participants.size >= RAID_MAX_PLAYERS) return 'full';
    const battlers = party.slice(0, 6).map((c) => projectBattler(toInstance(c), this.content));
    const active = battlers.findIndex((b) => b.creature.hp > 0);
    if (active === -1) return 'noParty';
    const sides: [Omit<Side, 'mustSwitch' | 'consumedItems'>, Omit<Side, 'mustSwitch' | 'consumedItems'>] = [
      { kind: 'player', party: battlers, active, trainerId: playerId, canFlee: false, canCatch: false },
      { kind: 'wild', party: [this.bossBattler], active: 0, trainerId: null, canFlee: false, canCatch: false },
    ];
    const { state } = createBattle({ id: `${this.id}:${playerId}`, format: 'raid', zoneId: this.hotspot.zoneId, terrain: this.terrain, seed: this.rng.fork().snapshot(), sides }, this.content);
    this.participants.set(playerId, { playerId, ready: false, state, pending: null, damage: 0, caughtAttempted: false, spectator: false, catchRng: state.rng });
    void now;
    return 'ok';
  }

  /** The lobby starts the fight when all present are ready, or RAID_LOBBY_MS elapsed with ≥ 1 ready (tick). */
  ready(playerId: string): void {
    const p = this.participants.get(playerId);
    if (p !== undefined && this.phase === 0) p.ready = true;
  }

  /** Participants still fighting (not spectators). */
  active(): RaidParticipant[] {
    return [...this.participants.values()].filter((p) => !p.spectator).sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
  }

  action(playerId: string, round: number, a: Action): RaidActionResult {
    const p = this.participants.get(playerId);
    if (p === undefined) return 'notParticipant';
    if (this.phase !== 1 && this.phase !== 2) return 'notFighting';
    if (round !== this.round) return 'wrongRound';
    if (p.spectator) return 'actionNotRequired';
    if (p.pending !== null) return 'alreadySubmitted';
    const err = validateAction(this.withBoss(p.state, this.bossBattler), 0, a, this.content);
    if (err !== null) return err;
    p.pending = a;
    return null;
  }

  /** Every active participant has acted → the round can resolve before its deadline. */
  allActed(): boolean {
    const act = this.active();
    return act.length > 0 && act.every((p) => p.pending !== null);
  }

  roundDue(now: number): boolean {
    return (this.phase === 1 || this.phase === 2) && (now >= this.deadlineAt || this.allActed());
  }

  /**
   * Resolves the collecting round WITHOUT mutating the session: each active participant (ascending playerId) acts
   * (its pending action, or the §30.4.3 auto-action) against the boss as left by the previous participant.
   */
  prepareRound(): RaidRound {
    const order: string[] = [];
    const states = new Map<string, BattleState>();
    const events = new Map<string, BattleEvent[]>();
    const actions = new Map<string, Action>();
    const damage = new Map<string, number>();
    const spectators = new Set<string>();
    let boss = this.bossBattler;
    let enraged = this.enraged;
    const enrageEvents: BattleEvent[] = [];
    for (const p of this.active()) {
      if (boss.creature.hp <= 0) break;
      const before = this.withBoss(p.state, boss);
      if (before.ended !== null) {
        // defensive: a private battle that ended while the boss stands leaves its owner spectating
        spectators.add(p.playerId);
        continue;
      }
      const a = p.pending ?? autoAction(before, 0, this.content);
      const result = resolveTurn(before, [a, null], this.content);
      const after = result.state.sides[1].party[0]!;
      const dealt = Math.max(0, boss.creature.hp - after.creature.hp);
      boss = after;
      const evs: BattleEvent[] = [...result.events];
      if (!enraged && boss.creature.hp > 0 && boss.creature.hp / boss.maxHp < RAID_ENRAGE_HP) {
        enraged = true;
        const atk = clampStage(boss.stages.atk + RAID_ENRAGE_ATK_STAGES);
        const clamped = atk !== boss.stages.atk + RAID_ENRAGE_ATK_STAGES;
        boss = { ...boss, stages: { ...boss.stages, atk } };
        enrageEvents.push(
          { t: 'abilityTrigger', who: BOSS_REF, ability: boss.creature.ability, detail: 'enraged' },
          { t: 'statStage', target: BOSS_REF, stat: 'atk', delta: RAID_ENRAGE_ATK_STAGES, after: atk, clamped, source: null, cause: 'ability' },
        );
      }
      order.push(p.playerId);
      states.set(p.playerId, this.withBoss(result.state, boss));
      events.set(p.playerId, evs);
      actions.set(p.playerId, a);
      damage.set(p.playerId, dealt);
      if (result.state.ended !== null && result.state.ended.winner !== 0) spectators.add(p.playerId);
    }
    // everyone sees the enrage in their round events
    if (enrageEvents.length > 0) for (const pid of order) events.get(pid)!.push(...enrageEvents);
    return { round: this.round, order, states, events, actions, damage, boss, enraged, bossDefeated: boss.creature.hp <= 0, spectators };
  }

  /** Applies a prepared round (after the caller's transaction committed) and opens the next one. */
  commitRound(r: RaidRound, now: number): void {
    for (const pid of r.spectators) {
      const p = this.participants.get(pid);
      if (p !== undefined) p.spectator = true;
    }
    for (const pid of r.order) {
      const p = this.participants.get(pid);
      if (p === undefined) continue;
      p.state = r.states.get(pid)!;
      p.catchRng = p.state.rng;
      p.damage += r.damage.get(pid) ?? 0;
      if (r.spectators.has(pid)) p.spectator = true;
    }
    for (const p of this.participants.values()) p.pending = null;
    this.bossBattler = r.boss;
    if (r.enraged && !this.enraged) {
      this.enraged = true;
      if (this.phase === 1) this.phase = 2;
    }
    if (r.bossDefeated) {
      this.phase = 3;
      this.deadlineAt = now + RAID_CATCH_WINDOW_MS;
      return;
    }
    if (this.active().length === 0) {
      this.end(now);
      return;
    }
    this.round += 1;
    this.deadlineAt = now + RAID_ROUND_MS;
  }

  /** A failed round transaction: the round re-opens with a fresh deadline (pending actions dropped). */
  rejectRound(now: number): void {
    for (const p of this.participants.values()) p.pending = null;
    this.deadlineAt = now + RAID_ROUND_MS;
  }

  /** Lobby start / catch-window end — the timer-only transitions (no DB). Returns true when the phase changed. */
  tick(now: number): boolean {
    if (this.phase === 0) {
      const present = [...this.participants.values()];
      const readyCount = present.filter((p) => p.ready).length;
      if (present.length > 0 && (readyCount === present.length || (now >= this.openedAt + RAID_LOBBY_MS && readyCount > 0))) {
        for (const p of present) if (!p.ready) this.participants.delete(p.playerId); // not ready at the start → out
        this.phase = 1;
        this.round = 1;
        this.deadlineAt = now + RAID_ROUND_MS;
        return true;
      }
      return false;
    }
    if (this.phase === 3 && now >= this.deadlineAt) {
      this.end(now);
      return true;
    }
    return false;
  }

  /** Participants eligible for the catch window: damage > 0. */
  catchAttempt(playerId: string, orb: string): 'ok' | 'noWindow' | 'already' | 'notParticipant' | 'unknownOrb' {
    const p = this.participants.get(playerId);
    if (p === undefined || p.damage <= 0) return 'notParticipant';
    if (this.phase !== 3) return 'noWindow';
    if (p.caughtAttempted) return 'already';
    try {
      this.content.orb(orb);
    } catch (_e) {
      return 'unknownOrb';
    }
    p.caughtAttempted = true;
    return 'ok';
  }

  /**
   * The §2.15 roll for an accepted attempt: core's catch with H = 1 (a defeated boss counts as 1 HP), the boss's
   * status bonus and the participant's orb, run as a catch-only `resolveTurn` on a copy of their private battle.
   */
  rollCatch(playerId: string, orb: string): CatchRoll {
    const p = this.participants.get(playerId)!;
    const lead = p.state.sides[0].party.find((b) => b.creature.hp > 0) ?? p.state.sides[0].party[0]!;
    const healedLead: Battler = { ...lead, creature: { ...lead.creature, hp: lead.maxHp } };
    const boss1: Battler = { ...this.bossBattler, creature: { ...this.bossBattler.creature, hp: 1 } };
    const s0 = p.state.sides[0];
    const state: BattleState = {
      ...p.state,
      ended: null,
      rng: p.catchRng,
      sides: [
        { ...s0, party: [healedLead], active: 0, canCatch: true, mustSwitch: false },
        { ...p.state.sides[1], party: [boss1], active: 0, mustSwitch: false },
      ],
    };
    const result = resolveTurn(state, [{ kind: 'catch', orb }, null], this.content);
    p.catchRng = result.state.rng;
    const caught = result.events.some((e) => e.t === 'catchResult' && e.caught);
    const b = this.bossBattler.creature;
    const creature = newCreature(this.content, b.speciesId, b.level, { ability: b.ability, variantKey: b.variantKey, isAlpha: b.isAlpha });
    return { caught, events: result.events, stateDigest: digestBattleState(result.state), creature };
  }

  leave(playerId: string, now: number = this.openedAt): void {
    if (!this.participants.has(playerId)) return;
    if (this.phase === 0) {
      this.participants.delete(playerId);
      return;
    }
    const p = this.participants.get(playerId)!;
    p.spectator = true;
    p.pending = null;
    // everyone gone or fainted before the boss → over, no rewards
    if ((this.phase === 1 || this.phase === 2) && this.active().length === 0) this.end(now);
  }

  /** phase 4 */
  end(now: number): void {
    this.phase = 4;
    this.endedAt = now;
  }

  /** The window closed before any fight started. */
  closeUnstarted(now: number): boolean {
    if (this.phase !== 0) return false;
    this.end(now);
    return true;
  }

  toState(now: number): RaidView {
    const damageBoard: Record<string, number> = {};
    for (const p of this.participants.values()) damageBoard[p.playerId] = p.damage;
    const until = this.phase === 4 ? 0 : Math.max(0, this.deadlineAt - now);
    return {
      id: this.id,
      bossSpecies: this.hotspot.boss.species,
      bossLevel: this.hotspot.boss.level,
      hpPct: Math.max(0, Math.min(1, this.hpPct)),
      phase: this.phase,
      roundEndsInMs: Math.min(0xffff, Math.round(until)),
      damageBoard,
      x: this.hotspot.x,
      z: this.hotspot.z,
    };
  }
}

// ─── the room-side runner ─────────────────────────────────────────────────────

export interface RaidHost {
  send(playerId: string, msg: ServerMessage): void;
  /** fight start/end for a participant: userData.battleId / PlayerState.inBattle / presence battle (raidId or null) */
  setFighting(playerId: string, raidId: string | null): void;
  /** refresh the room's per-player inventory cache */
  onInventory(playerId: string, inventory: Readonly<Record<string, number>>): void;
}

export interface RaidDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly content: ContentIndex;
  readonly clock: () => number;
  readonly log: Logger;
  readonly zone: ZoneDef;
  readonly host: RaidHost;
}

type RaidErr = { readonly code: 'notFound' | 'notAllowed' | 'busy' | 'internal'; readonly detail: string | null };

/** One raid of one room: joins (DB reads), rounds (one transaction each), catches, rewards. */
export class RaidRunner {
  private resolving = false;
  /** per-participant inventory snapshots (item/orb balance checks at action time), refreshed after each round */
  private readonly inventory = new Map<string, Record<string, number>>();
  private closing = false;

  constructor(
    readonly session: RaidSession,
    private readonly deps: RaidDeps,
  ) {}

  get id(): string {
    return this.session.id;
  }

  isParticipant(playerId: string): boolean {
    return this.session.participants.has(playerId);
  }

  fighting(playerId: string): boolean {
    const p = this.session.participants.get(playerId);
    return p !== undefined && (this.session.phase === 1 || this.session.phase === 2) && !p.spectator;
  }

  async join(playerId: string, now: number): Promise<RaidErr | null> {
    const { repos } = this.deps;
    const loaded = await repos.db.transaction(async (tx) => ({
      party: await repos.creatures.party(tx, playerId),
      badges: await repos.progress.badges(tx, playerId),
      inventory: await repos.inventory.all(tx, playerId),
    }));
    const r = this.session.join(playerId, loaded.party, loaded.badges.length, now);
    if (r !== 'ok') return { code: r === 'already' ? 'busy' : 'notAllowed', detail: r };
    this.inventory.set(playerId, loaded.inventory);
    return null;
  }

  ready(playerId: string): RaidErr | null {
    if (!this.session.participants.has(playerId)) return { code: 'notFound', detail: null };
    this.session.ready(playerId);
    return null;
  }

  action(playerId: string, round: number, a: Action): RaidErr | null {
    const inv = this.inventory.get(playerId);
    if (a.kind === 'item' && (inv?.[a.item] ?? 0) < 1) return { code: 'notAllowed', detail: 'noItem' };
    const r = this.session.action(playerId, round, a);
    if (r === null) return null;
    return { code: r === 'notParticipant' ? 'notFound' : 'notAllowed', detail: r };
  }

  leave(playerId: string): void {
    const wasFighting = this.fighting(playerId);
    this.session.leave(playerId, this.deps.clock());
    if (wasFighting) this.deps.host.setFighting(playerId, null);
    if (this.session.phase === 4) this.releaseFighters();
  }

  private releaseFighters(): void {
    for (const p of this.session.participants.values()) this.deps.host.setFighting(p.playerId, null);
  }

  /** Room tick step 7: lobby start, deadlines (one transaction per round), catch window end. Never overlaps itself. */
  async tick(now: number): Promise<void> {
    const s = this.session;
    const before = s.phase;
    if (s.tick(now)) {
      if (before === 0 && s.phase === 1) for (const p of s.participants.values()) this.deps.host.setFighting(p.playerId, s.id);
      if (s.phase === 4) this.releaseFighters();
      return;
    }
    if (this.resolving || !s.roundDue(now)) return;
    this.resolving = true;
    try {
      await this.resolveRound(now);
    } finally {
      this.resolving = false;
    }
  }

  /** §30.4.3 applied to a raid round: resolve (pure) → persist in ONE transaction → commit → send. */
  private async resolveRound(now: number): Promise<void> {
    const s = this.session;
    const { repos, log } = this.deps;
    let round: RaidRound;
    try {
      round = s.prepareRound();
    } catch (e) {
      log.error({ err: e, raidId: s.id }, 'raid round threw — raid over');
      s.end(now);
      this.releaseFighters();
      return;
    }
    const rewardsFor = round.bossDefeated ? [...s.participants.values()].filter((p) => p.damage + (round.damage.get(p.playerId) ?? 0) > 0).map((p) => p.playerId) : [];
    type Out = { inventory: Record<string, number>; money: number | null; updated: CreatureInstance[]; trainerExp: number | null; trainerLevel: number | null; rewards: RewardsSummary | null; quest: QuestProgressEntry[] };
    let outs: Map<string, Out>;
    try {
      outs = await repos.db.transaction(async (tx) => {
        const res = new Map<string, Out>();
        const touched = [...new Set([...round.order, ...rewardsFor])].sort();
        await repos.players.lockMany(tx, touched);
        for (const pid of touched) {
          const o: Out = { inventory: {}, money: null, updated: [], trainerExp: null, trainerLevel: null, rewards: null, quest: [] };
          const st = round.states.get(pid);
          const prev = s.participants.get(pid)?.state;
          if (st !== undefined && prev !== undefined) {
            // creature rows: only the fields battle may change (the row is the truth between rounds)
            for (let i = 0; i < st.sides[0].party.length; i++) {
              const a = st.sides[0].party[i]!.creature;
              const b = prev.sides[0].party[i]?.creature;
              if (!isPersistedId(a.id) || (b !== undefined && JSON.stringify(a) === JSON.stringify(b))) continue;
              const row = await repos.creatures.recordById(tx, a.id);
              if (row === null || row.ownerId !== pid) continue;
              const after = persistableAfterBattle(a);
              const merged: CreatureInstance = { ...toInstance(row), hp: after.hp, moves: after.moves, status: after.status, exp: after.exp, level: after.level, heldItem: after.heldItem };
              await repos.creatures.update(tx, merged);
              o.updated.push(merged);
            }
            // consumables used this round
            for (const ev of round.events.get(pid) ?? []) {
              if (ev.t === 'itemUsed' && ev.who.side === 0 && !ev.consumedHeld) o.inventory[ev.item] = await repos.inventory.add(tx, pid, ev.item, -1);
            }
          }
          if (rewardsFor.includes(pid)) {
            const money = RAID_MONEY_PER_LEVEL * s.hotspot.boss.level;
            o.money = await repos.players.addMoney(tx, pid, money);
            const exp = await repos.players.addTrainerExp(tx, pid, TRAINER_EXP.raidClear);
            o.trainerExp = exp.trainerExp;
            o.trainerLevel = exp.trainerLevel;
            o.rewards = { money, items: {}, trainerExp: TRAINER_EXP.raidClear, ratingDelta: null, badge: null };
            o.quest = await advanceQuests(tx, repos, pid, [{ kind: 'battle', format: 'raid' }], now);
            await repos.audit.write(tx, { actorId: pid, action: 'raid.clear', subject: s.id, detail: { hotspot: s.hotspot.id, damage: (s.participants.get(pid)?.damage ?? 0) + (round.damage.get(pid) ?? 0) } }, new Date(now));
          }
          if (Object.keys(o.inventory).length > 0) this.inventory.set(pid, await repos.inventory.all(tx, pid));
          res.set(pid, o);
        }
        return res;
      });
    } catch (e) {
      log.error({ err: e, raidId: s.id }, 'raid round transaction failed');
      s.rejectRound(now);
      for (const pid of round.order) this.deps.host.send(pid, { type: 'error', code: 'internal', detail: 'turnRejected' });
      return;
    }
    // commit succeeded: only now does the raid advance
    s.commitRound(round, now);
    for (const pid of round.order) {
      const st = round.states.get(pid)!;
      this.deps.host.send(pid, { type: 'raidEvents', raidId: s.id, round: round.round, events: round.events.get(pid) ?? [], stateDigest: digestBattleState(st) });
      if (round.spectators.has(pid)) this.deps.host.setFighting(pid, null);
    }
    for (const [pid, o] of outs) {
      if (Object.keys(o.inventory).length > 0 || o.money !== null || o.updated.length > 0) {
        this.deps.host.send(pid, { type: 'inventoryDelta', items: o.inventory, money: o.money, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: o.updated });
      }
      if (Object.keys(o.inventory).length > 0) this.deps.host.onInventory(pid, this.inventory.get(pid) ?? {});
      if (o.trainerExp !== null || o.quest.length > 0) {
        this.deps.host.send(pid, {
          type: 'progressionDelta',
          badges: null,
          trainerExp: o.trainerExp,
          trainerLevel: o.trainerLevel,
          rating: null,
          dexSeen: null,
          dexCaught: null,
          flags: null,
          questProgress: o.quest.length > 0 ? o.quest : null,
        });
      }
      // raid rewards ride battleEnd with battleId = raidId (the spine has no raid-end variant)
      if (o.rewards !== null) this.deps.host.send(pid, { type: 'battleEnd', battleId: s.id, outcome: { winner: 0 }, rewards: o.rewards });
    }
    if (s.phase === 3 || s.phase === 4) this.releaseFighters();
  }

  /** `raidCatch { orb }`: one attempt per participant with damage > 0 during the window; orb consumed either way. */
  async catchAttempt(playerId: string, orb: string): Promise<RaidErr | null> {
    const s = this.session;
    const inv = this.inventory.get(playerId);
    if (s.participants.has(playerId) && s.phase === 3 && (inv?.[orb] ?? 0) < 1 && !(s.participants.get(playerId)?.caughtAttempted ?? false)) return { code: 'notAllowed', detail: 'noOrb' };
    const r = s.catchAttempt(playerId, orb);
    if (r !== 'ok') return { code: r === 'notParticipant' ? 'notFound' : 'notAllowed', detail: r };
    const roll = s.rollCatch(playerId, orb);
    const { repos, clock, zone } = this.deps;
    const nowMs = clock();
    const now = new Date(nowMs);
    let outcome: { inventory: Record<string, number>; added: CreatureInstance[]; placement: Record<string, 'party' | 'box'>; newDex: boolean; quest: QuestProgressEntry[] };
    try {
      outcome = await repos.db.transaction(async (tx) => {
        await repos.players.lock(tx, playerId);
        const left = await repos.inventory.add(tx, playerId, orb, -1);
        const added: CreatureInstance[] = [];
        const placement: Record<string, 'party' | 'box'> = {};
        let newDex = false;
        let quest: QuestProgressEntry[] = [];
        if (roll.caught) {
          const records = await repos.creatures.byOwner(tx, playerId);
          const used = new Set(records.filter((c) => c.slotKind === 'party').map((c) => c.slotIndex));
          let idx = -1;
          for (let i = 0; i < 6; i++) {
            if (!used.has(i)) {
              idx = i;
              break;
            }
          }
          const inserted = await repos.creatures.insert(tx, { ...roll.creature, ownerId: playerId, caughtAt: { zoneId: zone.id, at: nowMs } }, idx === -1 ? { kind: 'box', index: 'nextBox' } : { kind: 'party', index: idx });
          added.push(toInstance(inserted));
          placement[inserted.id] = idx === -1 ? 'box' : 'party';
          await repos.progress.markSeen(tx, playerId, roll.creature.speciesId, now);
          newDex = (await repos.progress.markCaught(tx, playerId, roll.creature.speciesId, roll.creature.variantKey, roll.creature.isAlpha, now)).newSpecies;
          const exp = TRAINER_EXP.catch + (newDex ? TRAINER_EXP.catchNewSpecies : 0);
          await repos.players.addTrainerExp(tx, playerId, exp);
          quest = await advanceQuests(tx, repos, playerId, [{ kind: 'catch', species: roll.creature.speciesId }], nowMs);
        }
        await repos.audit.write(tx, { actorId: playerId, action: 'raid.catch', subject: s.id, detail: { orb, caught: roll.caught } }, now);
        return { inventory: { [orb]: left }, added, placement, newDex, quest };
      });
    } catch (e) {
      this.deps.log.info({ err: e, raidId: s.id }, 'raid catch transaction failed');
      return { code: 'notAllowed', detail: 'noOrb' };
    }
    const inv2 = { ...(this.inventory.get(playerId) ?? {}), ...outcome.inventory };
    this.inventory.set(playerId, inv2);
    this.deps.host.onInventory(playerId, inv2);
    this.deps.host.send(playerId, { type: 'raidEvents', raidId: s.id, round: Math.max(1, s.round), events: roll.events, stateDigest: roll.stateDigest });
    this.deps.host.send(playerId, { type: 'inventoryDelta', items: outcome.inventory, money: null, creaturesAdded: outcome.added, creaturesRemoved: [], creaturesUpdated: [], placement: outcome.placement });
    if (roll.caught) {
      this.deps.host.send(playerId, {
        type: 'progressionDelta',
        badges: null,
        trainerExp: null,
        trainerLevel: null,
        rating: null,
        dexSeen: [roll.creature.speciesId],
        dexCaught: [roll.creature.speciesId],
        flags: null,
        questProgress: outcome.quest.length > 0 ? outcome.quest : null,
      });
    }
    return null;
  }

  /** The room drops a finished raid after it lingered (phase 4 + RAID_LINGER_MS), or an unstarted one at window end. */
  finished(now: number): boolean {
    const s = this.session;
    return s.phase === 4 && s.endedAt !== null && now - s.endedAt >= RAID_LINGER_MS;
  }

  close(now: number): void {
    if (this.closing) return;
    this.closing = true;
    if (this.session.phase !== 4) this.session.end(now);
    this.releaseFighters();
  }
}
