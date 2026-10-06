/**
 * Test support for the progression walk (progression-*.test.ts): one headless player driving the real server over
 * the paths a browser uses — REST through Fastify `inject`, the zone room through `@colyseus/sdk`:
 *
 * - movement: legal `input` steps along an A* path whose every segment passes the server's own `segmentStandable`
 *   (pathing.ts), paced by the dt budget the room refills per tick (read from `ZoneState.tick`), each step acked
 *   before the next; crossings are real handovers (`handover` → consume the seat → `handoverAck`);
 * - `interact`, `engageSpawn`, `battleAction` with a client-side `resolveTurn` preview whose digest is compared with
 *   every `battleEvents` (the desync counter);
 * - REST `heal` / `shop/buy` / `party/reorder` / `creature/:id/evolve|moves` like the client's menus.
 *
 * Two test-only liberties, both outside the progression tables:
 * - the per-client room rate limiters (4 interacts / 4 battle actions per second) and the REST windows run on the
 *   server's injected clock, so the walker advances that clock by 260 ms before each such message instead of
 *   sleeping (the movement budget is refilled per real tick and is NOT sped up);
 * - `forceSpawn` places a wild spawn from the current zone's own encounter table (a land slot eligible at the room's
 *   time of day) beside the player, instead of waiting for the director to roll it. The player then engages it with
 *   `engageSpawn` like any spawn; EXP, levels and catches come only from the battle pipeline (no row is written).
 */
import { appendFileSync } from 'node:fs';
import { matchMaker } from '@colyseus/core';
import { Client as SdkClient } from '@colyseus/sdk';
import type { Room as SdkRoom } from '@colyseus/sdk';
import {
  badgeFlag,
  encounterTableFor,
  gatesClosedFor,
  getHeightfield,
  interiorAt,
  interiorLeaders,
  interiorSwitches,
  interiorTrainers,
  interiorWarps,
  interiorsFor,
  isWalkable,
  leaderSpot,
  nearestWalkable,
  walkInterior,
  zone as zoneById,
} from '@ewa/content';
import type { BadgeId, Heightfield, LinkDir, PlacedInterior, RectSolid, TrainerDef, WorldSwitch, ZoneDef, ZoneId } from '@ewa/content';
import { applyExp, calcMaxHp, calcStat, chooseNpcAction, chooseNpcDoubles, createRng, digestBattleState, requiredPositions, resolveTurn, typeMultiplier } from '@ewa/core';
import type { Action, BattleOutcome, BattleState, Battler, CreatureInstance, Rng, SideChoice } from '@ewa/core';
import { ZoneState } from '@ewa/protocol';
import type { RewardsSummary, SeatReservation, ServerMessage } from '@ewa/protocol';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { GYM_RANGE_M, INTERACT_RANGE_M, LEAGUE_MARKER, findTarget } from '../src/rooms/interactables';
import { MAX_RUN_STEP, NO_GATES, QUANTISATION_SLACK } from '../src/rooms/movement';
import { isDay } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, sleep, waitFor } from './helpers';
import type { TestServer } from './helpers';
import { findPath, pathLength, steps } from './pathing';
import type { Goal, Pt } from './pathing';

export type Msg = ServerMessage;
export type BattleEndMsg = Extract<Msg, { type: 'battleEnd' }>;
type BattleStartMsg = Extract<Msg, { type: 'battleStart' }>;
type BattleEventsMsg = Extract<Msg, { type: 'battleEvents' }>;
type HandoverMsg = Extract<Msg, { type: 'handover' }>;

/** One `input` step: ≤ 0.78 m, i.e. ≤ 97 ms of the 8.05 m/s running cap. */
const MAX_STEP_M = 0.78;
const TICK_MS = 50;
const BUDGET_MAX = 250;
const BUDGET_MIN = -100;
const BUDGET_SAFETY = 30;
/** the room's per-client windows (interact / battleAction / engageSpawn) run on the injected clock */
const LIMITER_ADVANCE_MS = 260;

export interface WalkStats {
  metres: number;
  handovers: number;
  battles: number;
  turns: number;
  desyncs: number;
  walkMs: number;
  battleMs: number;
}

export interface FightResult {
  readonly end: BattleEndMsg;
  readonly start: BattleStartMsg;
  readonly after: readonly Msg[];
}

type Mode = { readonly kind: 'win' } | { readonly kind: 'train' } | { readonly kind: 'catch'; readonly orb: string };

export class Walker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's room-type parameter (server room class) is irrelevant here
  room!: SdkRoom<any, ZoneState>;
  zoneId!: ZoneId;
  msgs: Msg[] = [];
  readonly log: string[] = [];
  readonly stats: WalkStats = { metres: 0, handovers: 0, battles: 0, turns: 0, desyncs: 0, walkMs: 0, battleMs: 0 };
  private sdk!: SdkClient;
  private seq = 0;
  private budget = { ms: 0, tick: 0 };
  private readonly rng: Rng;
  private spawnCounter = 0;

  constructor(
    readonly s: TestServer,
    readonly playerId: string,
    public access: string,
    public refresh: string,
    readonly name: string,
  ) {
    this.rng = createRng(`walker:${name}`);
  }

  note(line: string): void {
    const entry = `[${this.zoneId ?? '-'}] ${line}`;
    this.log.push(entry);
    // EWA_WALK_LOG=<file>: a live trace for whoever watches a leg run (minutes of wall time)
    const file = process.env['EWA_WALK_LOG'];
    if (file !== undefined) appendFileSync(file, `${new Date().toISOString().slice(11, 19)} ${this.name} ${entry}\n`);
  }

  get zone(): ZoneDef {
    return zoneById(this.zoneId);
  }

  get h(): Heightfield {
    return getHeightfield(this.zoneId);
  }

  get serverRoom(): ZoneRoom {
    return matchMaker.getLocalRoomById(this.room.roomId) as unknown as ZoneRoom;
  }

  me(): { x: number; z: number; seq: number } {
    const p = this.room.state.players?.get(this.playerId);
    if (p === undefined) throw new Error('walker: own PlayerState missing');
    return p;
  }

  // ─── REST ───────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON bodies are read field by field
  async rest(method: 'GET' | 'POST', url: string, payload?: unknown): Promise<{ status: number; body: any }> {
    this.s.time.advance(1100); // restWrite / restRead windows (per minute) run on the injected clock
    return api(this.s, method, url, this.access, payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GET /me is read field by field
  async me2(): Promise<any> {
    const r = await this.rest('GET', '/me');
    if (r.status !== 200) throw new Error(`GET /me ${r.status}`);
    return r.body;
  }

  async party(): Promise<CreatureInstance[]> {
    return (await this.me2()).party as CreatureInstance[];
  }

  async heal(): Promise<void> {
    const r = await this.rest('POST', '/heal');
    if (r.status !== 200) throw new Error(`POST /heal in ${this.zoneId}: ${r.status} ${JSON.stringify(r.body)}`);
  }

  async buy(item: string, qty: number): Promise<void> {
    const r = await this.rest('POST', '/shop/buy', { item, qty });
    if (r.status !== 200) throw new Error(`POST /shop/buy ${item}×${qty} in ${this.zoneId}: ${r.status} ${JSON.stringify(r.body)}`);
  }

  async money(): Promise<number> {
    return Number((await this.me2()).money);
  }

  async itemCount(item: string): Promise<number> {
    return Number(((await this.me2()).inventory as Record<string, number>)[item] ?? 0);
  }

  /** Evolves every ready party member and gives it the four best damaging moves it can know (a player's menu work). */
  async tend(): Promise<void> {
    for (const c of await this.party()) {
      let cur = c;
      const ready = applyExp(cur, 0, content).evolveReady;
      if (ready !== null) {
        const r = await this.rest('POST', `/creature/${cur.id}/evolve`, { into: ready });
        if (r.status !== 200) throw new Error(`evolve ${cur.speciesId} → ${ready}: ${r.status} ${JSON.stringify(r.body)}`);
        this.note(`evolved ${cur.speciesId} → ${ready} at L${cur.level}`);
        cur = r.body as CreatureInstance;
      }
      const want = bestMoves(cur);
      if (want.join('|') !== cur.moves.map((m) => m.id).join('|')) {
        const r = await this.rest('POST', `/creature/${cur.id}/moves`, { moves: want });
        if (r.status !== 200) throw new Error(`moves ${cur.speciesId} ${want.join(',')}: ${r.status} ${JSON.stringify(r.body)}`);
      }
    }
  }

  /** Puts the party member that matches `foes` best in front (POST /party/reorder). */
  async leadFor(foes: readonly { readonly species: string; readonly level: number }[]): Promise<void> {
    const party = await this.party();
    const lead = foes[0]!;
    const scored = party.map((c) => ({ c, v: c.hp > 0 ? matchup(c.speciesId, c.level, c.moves.map((m) => m.id), lead.species, lead.level) : -1 }));
    scored.sort((a, b) => b.v - a.v);
    const order = scored.map((x) => x.c.id);
    if (order.join() === party.map((c) => c.id).join()) return;
    const r = await this.rest('POST', '/party/reorder', { order });
    if (r.status !== 200) throw new Error(`reorder ${r.status} ${JSON.stringify(r.body)}`);
  }

  // ─── room ───────────────────────────────────────────────────────────────────

  private attach(room: Walker['room'], zoneId: ZoneId): void {
    this.room = room;
    this.zoneId = zoneId;
    const msgs: Msg[] = [];
    this.msgs = msgs;
    room.onMessage('*', (_t: string | number, m: unknown) => void msgs.push(m as Msg));
    this.seq = Math.max(this.seq, room.state.players?.get(this.playerId)?.seq ?? 0);
    this.budget = { ms: 0, tick: room.state.tick };
  }

  /** POST /zone/enter for the persisted zone, then the seat (the client's boot path). */
  async enter(): Promise<void> {
    const me = await this.me2();
    const zoneId = me.presence.zoneId as ZoneId;
    const r = await this.rest('POST', '/zone/enter', { zoneId });
    if (r.status !== 200) throw new Error(`zone/enter ${zoneId}: ${r.status} ${JSON.stringify(r.body)}`);
    this.sdk = new SdkClient(this.s.wsUrl);
    this.sdk.auth.token = this.access;
    const room = (await this.sdk.consumeSeatReservation(r.body.seat as never, ZoneState)) as Walker['room'];
    await waitFor(() => room.state.players?.get(this.playerId) !== undefined, 5000);
    this.attach(room, zoneId);
    this.note(`entered at (${this.me().x.toFixed(1)}, ${this.me().z.toFixed(1)})`);
  }

  async leave(): Promise<void> {
    await this.room?.leave(true).catch(() => undefined);
    await sleep(200);
  }

  private async handover(m: HandoverMsg): Promise<void> {
    const dest = (await this.sdk.consumeSeatReservation(m.seat as SeatReservation as never, ZoneState)) as Walker['room'];
    await waitFor(() => dest.state.players?.get(this.playerId) !== undefined, 5000);
    const from = this.zoneId;
    dest.send('handoverAck', { roomId: dest.roomId, seat: dest.sessionId });
    this.attach(dest, m.zoneId);
    this.stats.handovers += 1;
    this.note(`handover from ${from} at (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
  }

  // ─── movement ───────────────────────────────────────────────────────────────

  private async spend(dtMs: number): Promise<void> {
    for (;;) {
      const t = this.room.state.tick;
      if (t > this.budget.tick) {
        this.budget.ms = Math.min(BUDGET_MAX, this.budget.ms + TICK_MS * (t - this.budget.tick));
        this.budget.tick = t;
      }
      if (this.budget.ms - dtMs >= BUDGET_MIN + BUDGET_SAFETY) {
        this.budget.ms -= dtMs;
        return;
      }
      await sleep(4);
    }
  }

  /** Sends each step, waits for its ack; false when the server kept the old pose (then the caller re-plans). */
  private async follow(pts: readonly Pt[], edge: boolean): Promise<boolean> {
    for (let i = 1; i < pts.length; i++) {
      if (edge && ofTypeIn(this.msgs, 'handover').length > 0) return true; // triggered already
      const [x, z] = pts[i]!;
      const me = this.me();
      const d = Math.hypot(x - me.x, z - me.z);
      const dtMs = Math.min(100, Math.max(1, Math.ceil((Math.max(0, d - QUANTISATION_SLACK) / MAX_RUN_STEP) * 1000) + 2));
      await this.spend(dtMs);
      this.seq += 1;
      const seq = this.seq;
      this.room.send('input', { seq, x, z, angle: Math.atan2(x - me.x, z - me.z), running: true, dtMs });
      await waitFor(() => (this.room.state.players?.get(this.playerId)?.seq ?? 0) >= seq || (edge && ofTypeIn(this.msgs, 'handover').length > 0), 3000).catch((e: unknown) => {
        const ps = this.room.state.players?.get(this.playerId);
        const tail = this.msgs.slice(-5).map((m) => m.type + ('code' in m ? `:${String(m.code)}` : '') + ('detail' in m ? `:${String(m.detail)}` : ''));
        this.note(`no ack for seq ${seq} (server seq ${ps?.seq}, at ${ps?.x},${ps?.z} → ${x},${z}, tick ${this.room.state.tick} / server ${this.serverRoom.state.tick}, server pos ${this.serverRoom.state.players.get(this.playerId)?.x},${this.serverRoom.state.players.get(this.playerId)?.z} seq ${this.serverRoom.state.players.get(this.playerId)?.seq}, budget ${this.budget.ms}); last msgs ${tail.join(' ')}`);
        throw e;
      });
      const now = this.me();
      if (now.seq >= seq && Math.hypot(now.x - x, now.z - z) > 0.05) {
        this.note(`step ${seq} rejected at (${now.x.toFixed(2)}, ${now.z.toFixed(2)}) → (${x}, ${z}); room rejections ${JSON.stringify(this.serverRoom.metrics.rejectedInputs)}`);
        return false;
      }
      this.stats.metres += d;
    }
    return true;
  }

  async walk(goal: Goal): Promise<void> {
    // Phase A: halls are pockets reached only through door warps — leave the one we stand in when the goal lies
    // elsewhere, enter the goal's hall through its door when it lies in one
    const here = this.pocket();
    const there = goal.kind === 'point' ? interiorAt(this.zoneId, goal.x, goal.z) : null;
    if (here !== null && here.def.id !== there?.def.id) await this.leaveHall(here);
    if (there !== null && this.pocket()?.def.id !== there.def.id) await this.enterHall(there);
    const t0 = Date.now();
    for (let attempt = 0; attempt < 6; attempt++) {
      const me = this.me();
      const gates = await this.closedGates();
      const path = findPath(this.zone, this.h, [me.x, me.z], goal, gates);
      if (path === null) throw new Error(`walker: no path in ${this.zoneId} from (${me.x}, ${me.z}) to ${JSON.stringify(goal)} (${gates.length} closed gates)`);
      const ok = await this.follow(steps(this.h, path, MAX_STEP_M, gates), goal.kind === 'edge');
      if (!ok) {
        await sleep(300);
        continue;
      }
      if (goal.kind === 'edge') {
        await waitFor(() => ofTypeIn(this.msgs, 'handover').length > 0 || ofTypeIn(this.msgs, 'toast').some((t) => t.text.startsWith('The way is barred')), 7000);
        const ho = ofTypeIn(this.msgs, 'handover')[0];
        if (ho === undefined) throw new Error(`walker: gated crossing ${this.zoneId} → ${goal.dir}`);
        await this.handover(ho);
      }
      this.stats.walkMs += Date.now() - t0;
      return;
    }
    throw new Error(`walker: could not follow a path in ${this.zoneId} to ${JSON.stringify(goal)}`);
  }

  /** Walks to within interaction range of a content target (npc / trainer / static / warp) or a league trainer. */
  async goTo(kind: 'npc' | 'gym' | 'static' | 'warp', id: string): Promise<void> {
    if (kind === 'gym') return this.reachLeader(id);
    const t = findTarget(this.zone, kind, id);
    if (t === null) throw new Error(`walker: no ${kind} '${id}' in ${this.zoneId}`);
    let [x, z] = [t.x, t.z];
    if (kind === 'static') {
      // the room snaps a static's coordinate to the nearest walkable sample before the range check
      const p = nearestWalkable(this.h, x, z, 8);
      if (p !== null) [x, z] = p;
    }
    return this.walk({ kind: 'point', x, z, radius: INTERACT_RANGE_M - 0.5 });
  }

  // ─── interiors (Phase A) ────────────────────────────────────────────────────

  /** The hall whose floor the player stands on, or null. */
  pocket(): PlacedInterior | null {
    const me = this.me();
    return interiorAt(this.zoneId, me.x, me.z);
  }

  /** The flags the room gates on: story_flags ∪ badge:<id> (what GET /me shows the client). */
  async flagSet(): Promise<Set<string>> {
    const me = await this.me2();
    return new Set<string>([...(me.flags as string[]), ...(me.badges as BadgeId[]).map(badgeFlag)]);
  }

  /** The interior gates still shut for this player (none outside a hall). */
  async closedGates(flags?: ReadonlySet<string>): Promise<readonly RectSolid[]> {
    if (this.pocket() === null) return NO_GATES;
    const f = flags ?? (await this.flagSet());
    const shut = gatesClosedFor(this.zoneId, f);
    return shut.length === 0 ? NO_GATES : shut.map((g) => g.solid);
  }

  /** True when `goal` can be walked to from `from` with these gates shut. */
  private reachable(from: Pt, goal: Goal, gates: readonly RectSolid[]): boolean {
    return findPath(this.zone, this.h, from, goal, gates) !== null;
  }

  /** Where the room puts a teleport to (x, z): that point when walkable, else the nearest walkable sample. */
  private landing(x: number, z: number): Pt {
    if (isWalkable(this.h, x, z)) return [x, z];
    const p = nearestWalkable(this.h, x, z, 8);
    if (p === null) throw new Error(`walker: nothing walkable near (${x}, ${z}) in ${this.zoneId}`);
    return p;
  }

  /** An interact that teleports (door warp / warp switch): resolves once the room moved the player there. */
  private async teleportVia(kind: 'warp' | 'switch', id: string, toX: number, toZ: number): Promise<Msg[]> {
    const [lx, lz] = this.landing(toX, toZ);
    const out = await this.interact(kind, id);
    const err = ofTypeIn(out, 'error')[0];
    if (err !== undefined) throw new Error(`walker: ${kind} ${id} refused: ${err.code} ${String(err.detail)}`);
    await waitFor(() => Math.hypot(this.me().x - lx, this.me().z - lz) < 1, 4000).catch(() => {
      throw new Error(`walker: ${kind} ${id} did not move the player to (${lx.toFixed(1)}, ${lz.toFixed(1)}); at (${this.me().x.toFixed(1)}, ${this.me().z.toFixed(1)})`);
    });
    return out;
  }

  /** In through the building's door (`<id>.in` at the door approach). */
  async enterHall(p: PlacedInterior): Promise<void> {
    const w = interiorWarps(this.zoneId).find((x) => x.id === `${p.def.id}.in`);
    if (w === undefined) throw new Error(`walker: no door warp for ${p.def.id}`);
    await this.walk({ kind: 'point', x: w.x, z: w.z, radius: INTERACT_RANGE_M - 0.5 });
    await this.teleportVia('warp', w.id, w.toX, w.toZ);
    this.note(`entered ${p.def.id}`);
  }

  /** Out by the exit marker (`<id>.out`), taking a warp tile first when the exit lies beyond a sealed wall. */
  async leaveHall(p: PlacedInterior): Promise<void> {
    const w = interiorWarps(this.zoneId).find((x) => x.id === `${p.def.id}.out`);
    if (w === undefined) throw new Error(`walker: no exit warp for ${p.def.id}`);
    const goal: Goal = { kind: 'point', x: w.x, z: w.z, radius: INTERACT_RANGE_M - 0.5 };
    const me = this.me();
    if (!this.reachable([me.x, me.z], goal, await this.closedGates())) {
      if (!(await this.hop(p, [goal]))) throw new Error(`walker: the exit of ${p.def.id} is out of reach`);
    }
    await this.walk(goal);
    await this.teleportVia('warp', w.id, w.toX, w.toZ);
    this.note(`left ${p.def.id}`);
  }

  /**
   * One warp tile toward any of `goals`: a usable switch with `warpTo` the player can walk to, whose landing reaches a
   * goal (the Vesperveil cells are joined only by tiles; its decoys land where no goal is reachable and are skipped).
   */
  private async hop(p: PlacedInterior, goals: readonly Goal[]): Promise<boolean> {
    const flags = await this.flagSet();
    const gates = await this.closedGates(flags);
    const me = this.me();
    for (const sw of interiorSwitches(this.zoneId)) {
      if (sw.interior !== p.def.id || sw.warpTo === null || !sw.requires.every((f) => flags.has(f))) continue;
      const near: Goal = { kind: 'point', x: sw.x, z: sw.z, radius: INTERACT_RANGE_M - 0.5 };
      if (!this.reachable([me.x, me.z], near, gates)) continue;
      const land = this.landing(sw.warpTo.x, sw.warpTo.z);
      if (this.reachable([me.x, me.z], { kind: 'point', x: land[0], z: land[1], radius: 1 }, gates)) continue; // lands where we can walk anyway
      if (!goals.some((g) => this.reachable(land, g, gates))) continue;
      await this.walk(near);
      await this.teleportVia('switch', sw.id, sw.warpTo.x, sw.warpTo.z);
      this.note(`warp tile ${sw.id}`);
      return true;
    }
    return false;
  }

  /** Beats one gym trainer in its hall (healed, best lead first); a loss heals and tries again. */
  async beatTrainer(t: TrainerDef): Promise<FightResult> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.zone.healer) await this.heal();
      await this.leadFor(t.team);
      await this.walk({ kind: 'point', x: t.x, z: t.z, radius: INTERACT_RANGE_M - 0.5 });
      const out = await this.interact('npc', t.id);
      const err = ofTypeIn(out, 'error')[0];
      if (err !== undefined) throw new Error(`walker: trainer ${t.id} refused: ${err.code} ${String(err.detail)}`);
      const r = await this.fight();
      if (r.end.outcome.winner === 0) {
        this.note(`gym trainer ${t.id} ✓`);
        return r;
      }
      this.note(`gym trainer ${t.id} lost (attempt ${attempt}): ${JSON.stringify(r.end.outcome)}`);
    }
    throw new Error(`walker: could not beat gym trainer ${t.id}`);
  }

  /**
   * Walks to where league trainer `leagueId` stands for this player: in its hall (Phase A) through the door, past the
   * hall's trainers, switches, warp tiles and per-player gates — the puzzle plan follows content's own `walkInterior`
   * order, re-planned from the player's real flags and position after every step — or the legacy marker without one.
   */
  async reachLeader(leagueId: string): Promise<void> {
    const l = interiorLeaders(this.zoneId).find((x) => x.leagueId === leagueId);
    if (l === undefined) return this.walk({ kind: 'point', x: LEAGUE_MARKER.x, z: LEAGUE_MARKER.z, radius: GYM_RANGE_M - 0.5 });
    const p = interiorsFor(this.zoneId).find((x) => x.def.id === l.interior)!;
    if (this.pocket()?.def.id !== p.def.id) await this.enterHall(p);
    for (let guard = 0; guard < 40; guard++) {
      const flags = await this.flagSet();
      const gates = await this.closedGates(flags);
      const spot = leaderSpot(l, flags);
      const goal: Goal = { kind: 'point', x: spot.x, z: spot.z, radius: GYM_RANGE_M - 0.5 };
      const me = this.me();
      if (this.reachable([me.x, me.z], goal, gates)) return this.walk(goal);
      // the next puzzle step: content's static plan from these flags, the first step reachable from here
      const plan = walkInterior(this.h, p, flags, { beatLeaders: false }).order;
      const rank = (id: string): number => {
        const k = plan.indexOf(id);
        return k === -1 ? plan.length : k;
      };
      const trainers = interiorTrainers(this.zoneId).filter((t) => interiorAt(this.zoneId, t.x, t.z)?.def.id === p.def.id && !flags.has(`trainer:${t.id}:beaten`));
      const switches = interiorSwitches(this.zoneId).filter((sw) => sw.interior === p.def.id && sw.sets !== null && !flags.has(sw.sets) && sw.requires.every((f) => flags.has(f)));
      type Step = { readonly kind: 'trainer'; readonly t: TrainerDef } | { readonly kind: 'switch'; readonly sw: WorldSwitch };
      const todo: Step[] = [...trainers.map((t): Step => ({ kind: 'trainer', t })), ...switches.map((sw): Step => ({ kind: 'switch', sw }))];
      const idOf = (st: Step): string => (st.kind === 'trainer' ? st.t.id : st.sw.id);
      const at = (st: Step): Goal => {
        const q = st.kind === 'trainer' ? st.t : st.sw;
        return { kind: 'point', x: q.x, z: q.z, radius: INTERACT_RANGE_M - 0.5 };
      };
      todo.sort((a, b) => rank(idOf(a)) - rank(idOf(b)));
      const next = todo.find((st) => this.reachable([me.x, me.z], at(st), gates));
      if (next?.kind === 'trainer') {
        await this.beatTrainer(next.t);
        continue;
      }
      if (next?.kind === 'switch') {
        const sw = next.sw;
        await this.walk(at(next));
        if (sw.warpTo !== null) await this.teleportVia('switch', sw.id, sw.warpTo.x, sw.warpTo.z);
        else {
          const n = this.msgs.length;
          const out = await this.interact('switch', sw.id);
          const err = ofTypeIn(out, 'error')[0];
          if (err !== undefined) throw new Error(`walker: switch ${sw.id} refused: ${err.code} ${String(err.detail)}`);
          await waitFor(() => this.msgs.slice(n).some((m) => m.type === 'progressionDelta' && m.flags?.includes(sw.sets!) === true), 3000);
        }
        this.note(`switch ${sw.id} ✓`);
        continue;
      }
      if (await this.hop(p, [goal, ...todo.map(at)])) continue;
      throw new Error(`walker: stuck in ${p.def.id} before ${leagueId}: flags ${[...flags].filter((f) => f.includes(p.def.id)).join(' ')}; plan ${plan.join(' → ')}`);
    }
    throw new Error(`walker: no way to ${leagueId} in ${p.def.id}`);
  }

  /** Crosses the `dir` edge (a real handover). */
  async cross(dir: LinkDir): Promise<void> {
    const to = this.zone.links[dir];
    if (to === undefined) throw new Error(`walker: ${this.zoneId} has no ${dir} link`);
    await this.walk({ kind: 'edge', dir });
    if (this.zoneId !== to) throw new Error(`walker: crossed into ${this.zoneId}, expected ${to}`);
  }

  /** Stands still until the arrival cooldown is over (a crossing straight back needs it). */
  async settle(ms = 3080): Promise<void> {
    await sleep(ms);
  }

  // ─── interact ───────────────────────────────────────────────────────────────

  /** One interact; resolves when the room answered: a battleStart, an error, a completed beat, or 500 ms of quiet. */
  async interact(kind: 'npc' | 'gym' | 'static' | 'warp' | 'item' | 'switch', targetId: string): Promise<Msg[]> {
    this.s.time.advance(LIMITER_ADVANCE_MS);
    const n = this.msgs.length;
    this.room.send('interact', { kind, targetId });
    const done = (): boolean => {
      const got = this.msgs.slice(n);
      return got.some((m) => m.type === 'battleStart' || m.type === 'error' || (m.type === 'storyBeat' && m.phase === 'complete'));
    };
    await waitFor(done, 1500).catch(() => undefined);
    await sleep(done() ? 80 : 0);
    return this.msgs.slice(n);
  }

  // ─── battles ────────────────────────────────────────────────────────────────

  /** Plays the battle that just started (its battleStart already received) to its end. */
  async fight(mode: Mode = { kind: 'win' }): Promise<FightResult> {
    const t0 = Date.now();
    await waitFor(() => ofTypeIn(this.msgs, 'battleStart').length > 0, 5000);
    const start = ofTypeIn(this.msgs, 'battleStart').at(-1)!;
    const battleId = start.battleId;
    let state: BattleState = start.state;
    let seen = this.msgs.indexOf(start) + 1;
    const nextOfBattle = (): Msg | null => {
      for (let i = seen; i < this.msgs.length; i++) {
        const m = this.msgs[i]!;
        if ((m.type === 'battleEvents' || m.type === 'battleEnd' || m.type === 'battleResync') && m.battleId === battleId) {
          seen = i + 1;
          return m;
        }
        if (m.type === 'error' && m.code !== 'rateLimited') {
          seen = i + 1;
          throw new Error(`walker: battle error ${m.code} ${m.detail}`);
        }
      }
      return null;
    };
    let end: BattleEndMsg | null = null;
    for (let guard = 0; guard < 400 && end === null; guard++) {
      // Phase D6: a doubles battle (draco_gym, aurelia, five route trainers) takes one action per field position
      const a: SideChoice = state.slots === 2 ? this.chooseDoubles(state) : this.choose(state, mode);
      // the preview chain: my turn, then any NPC-only replacement the server resolves on its own
      const previews: BattleState[] = [];
      let p = resolveTurn(state, [a, null], content).state;
      previews.push(p);
      while (p.ended === null && p.sides[1].mustSwitch && !p.sides[0].mustSwitch) {
        p = resolveTurn(p, [null, null], content).state;
        previews.push(p);
      }
      if (state.slots === 2) {
        // one battleAction per required position, each naming its `pos`
        const pair = a as readonly [Action | null, Action | null];
        for (const pos of [0, 1] as const) {
          const x = pair[pos];
          if (x === null) continue;
          // the room counts position 1 in its own limiter window (Phase D6), so the burst of two is accepted
          this.s.time.advance(LIMITER_ADVANCE_MS);
          this.room.send('battleAction', { battleId, turn: state.turn + 1, action: x, pos });
        }
      } else {
        this.s.time.advance(LIMITER_ADVANCE_MS);
        this.room.send('battleAction', { battleId, turn: state.turn + 1, action: a as Action });
      }
      this.stats.turns += 1;
      for (const pv of previews) {
        let m: Msg | null = null;
        await waitFor(() => (m = nextOfBattle()) !== null, 8000).catch((e: unknown) => {
          // a stalled battle names what was sent and where the battle stood (the 8 s wait alone says nothing)
          const sides = state.sides.map((x) => ({ must: x.mustSwitch, active: x.active, actives: x.actives, hp: x.party.map((b) => b.creature.hp) }));
          const tail = this.msgs.slice(-6).map((x) => (x.type === 'error' ? `error:${x.code}:${x.detail}` : x.type));
          throw new Error(`${String(e)} — battle ${battleId} turn ${state.turn + 1} sent ${JSON.stringify(a)} sides ${JSON.stringify(sides)} last ${JSON.stringify(tail)}`);
        });
        const got = m as unknown as Msg;
        if (got.type === 'battleEnd') {
          end = got;
          break;
        }
        const ev = got as BattleEventsMsg;
        if (ev.stateDigest !== digestBattleState(pv)) {
          this.stats.desyncs += 1;
          this.note(`desync at turn ${ev.turn}`);
          const n = this.msgs.length;
          this.room.send('battleResync', { battleId });
          await waitFor(() => this.msgs.slice(n).some((x) => x.type === 'battleResync'), 5000);
          const rs = this.msgs.slice(n).find((x): x is Extract<Msg, { type: 'battleResync' }> => x.type === 'battleResync')!;
          state = rs.state;
          break;
        }
        state = pv;
      }
      if (end === null && state.ended !== null) {
        await waitFor(() => {
          const m = nextOfBattle();
          if (m?.type === 'battleEnd') end = m;
          return end !== null;
        }, 8000);
      }
    }
    if (end === null) throw new Error('walker: battle did not end');
    const endIdx = this.msgs.indexOf(end);
    await sleep(120); // progressionDelta / storyBeat complete follow in the same send burst
    this.stats.battles += 1;
    this.stats.battleMs += Date.now() - t0;
    return { start, end, after: this.msgs.slice(endIdx + 1) };
  }

  /**
   * Phase D6 — the doubles policy for side 0: a replacement brings in, per required position, the bench creature that
   * fares best against the foe on the field (distinct picks); otherwise core's doubles policy (expected damage per
   * move × target). Doubles happen only in trainer / league battles, so the train / catch modes never reach here.
   */
  private chooseDoubles(state: BattleState): [Action | null, Action | null] {
    const me = state.sides[0];
    if (!me.mustSwitch) return chooseNpcDoubles(state, 0, content, this.rng);
    const foe = state.sides[1];
    const fa = foe.actives!;
    const opp = foe.party[fa[0]]!.creature.hp > 0 ? foe.party[fa[0]]! : foe.party[fa[1]]!;
    const out: [Action | null, Action | null] = [null, null];
    const taken: number[] = [];
    for (const pos of requiredPositions(state, 0)) {
      let best = -1;
      let bestV = -Infinity;
      for (let i = 0; i < me.party.length; i++) {
        const b = me.party[i]!;
        if (me.actives!.includes(i) || b.creature.hp <= 0 || taken.includes(i)) continue;
        const v = battlerMatchup(b, opp);
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      }
      taken.push(best);
      out[pos] = { kind: 'switch', to: best };
    }
    return out;
  }

  private choose(state: BattleState, mode: Mode): Action {
    const me = state.sides[0];
    const foe = state.sides[1];
    const opp = foe.party[foe.active]!;
    if (me.mustSwitch) {
      let best = -1;
      let bestV = -Infinity;
      for (let i = 0; i < me.party.length; i++) {
        const b = me.party[i]!;
        if (i === me.active || b.creature.hp <= 0) continue;
        const v = battlerMatchup(b, opp);
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      }
      return { kind: 'switch', to: best };
    }
    const active = me.party[me.active]!;
    if (mode.kind === 'train') {
      // exp goes to every battler that was active and stands at the end: bring each healthy one in once, then let
      // the strongest standing member finish (the newcomers take one hit each, not the whole fight)
      if (active.volatile.trappedTurns === 0) {
        const next = me.party.findIndex((b, i) => i !== me.active && !b.participated && b.creature.hp > b.maxHp * 0.5);
        if (next !== -1) return { kind: 'switch', to: next };
        // the finisher: the standing member that fares best against this wild (not simply the highest level: a
        // Normal-type lead against a Ghost would stall the battle and drain PP)
        let finisher = me.active;
        let bestV = battlerMatchup(active, opp);
        for (let i = 0; i < me.party.length; i++) {
          const b = me.party[i]!;
          if (i === me.active || b.creature.hp <= b.maxHp * 0.3) continue;
          const v = battlerMatchup(b, opp);
          if (v > bestV * 1.5) {
            bestV = v;
            finisher = i;
          }
        }
        if (finisher !== me.active) return { kind: 'switch', to: finisher };
      }
    }
    if (mode.kind === 'catch') {
      const hpPct = opp.creature.hp / opp.maxHp;
      if (hpPct <= 0.3) return { kind: 'catch', orb: mode.orb };
      // the gentlest damaging move that cannot finish it; the orb otherwise
      let pick: string | null = null;
      let pickDmg = Infinity;
      for (const m of active.creature.moves) {
        if (m.pp <= 0) continue;
        const md = content.move(m.id);
        if (md.power <= 0) continue;
        const dmg = roughDamage(active, opp, md.id);
        if (dmg < opp.creature.hp * 0.8 && dmg < pickDmg && dmg > 0) {
          pick = m.id;
          pickDmg = dmg;
        }
      }
      return pick === null ? { kind: 'catch', orb: mode.orb } : { kind: 'move', move: pick };
    }
    return chooseNpcAction(state, 0, content, this.rng);
  }

  // ─── spawns, training, catching ─────────────────────────────────────────────

  /**
   * A spawn from this zone's own table beside the player (test-only: the roll is forced; see the file header).
   * `species` picks that slot; otherwise the richest-yield eligible land slot. Level = the slot's levelMax.
   */
  forceSpawn(species?: string, level?: number, lead?: CreatureInstance): SpawnRecord {
    const room = this.serverRoom;
    const table = encounterTableFor(this.zoneId);
    if (table === null || room.spawns === null) throw new Error(`walker: ${this.zoneId} has no spawn table`);
    const day = isDay(room.state.timeOfDay);
    const slots = table.slots.filter((s) => (s.medium ?? 'land') === 'land' && (s.timeOfDay === 'any' || s.timeOfDay === (day ? 'day' : 'night')));
    // training: the richest slot the lead handles (a player grinds on what it beats), else the one it handles best
    const fair = (x: (typeof slots)[number]): number =>
      lead === undefined ? 1 : matchup(lead.speciesId, lead.level, lead.moves.map((m) => m.id), x.species, Math.min(x.levelMax, Math.max(x.levelMin, level ?? x.levelMax)));
    const rich = (x: (typeof slots)[number]): number => content.species(x.species).expYield * x.levelMax;
    const favourable = slots.filter((x) => fair(x) >= 1.3);
    const slot =
      species !== undefined
        ? slots.find((x) => x.species === species)
        : favourable.length > 0
          ? [...favourable].sort((a, b) => rich(b) - rich(a))[0]
          : [...slots].sort((a, b) => fair(b) - fair(a))[0];
    if (slot === undefined) throw new Error(`walker: no eligible ${species ?? 'land'} slot in ${this.zoneId} (${day ? 'day' : 'night'})`);
    const p = this.me();
    this.spawnCounter += 1;
    const lv = Math.min(slot.levelMax, Math.max(slot.levelMin, level ?? slot.levelMax));
    const rec: SpawnRecord = {
      id: `${this.zoneId}:walk${this.spawnCounter}`,
      speciesId: slot.species,
      level: lv,
      variantKey: 'normal',
      isAlpha: false,
      ability: content.species(slot.species).abilities[0]!,
      medium: 'land',
      x: p.x,
      z: p.z,
      bornAt: this.s.time.clock(),
      engagedBy: null,
      engagedAt: null,
      despawnAt: this.s.time.clock() + 3_600_000,
    };
    const director = room.spawns as unknown as { records: Map<string, SpawnRecord> };
    director.records.set(rec.id, rec);
    (room as unknown as { addSpawn(r: SpawnRecord, now: number): void }).addSpawn(rec, this.s.time.clock());
    return rec;
  }

  /** engageSpawn on a spawn next to the player, then plays the wild battle. */
  async engage(rec: SpawnRecord, mode: Mode): Promise<FightResult> {
    await waitFor(() => this.room.state.spawns?.get(rec.id) !== undefined, 3000);
    this.s.time.advance(LIMITER_ADVANCE_MS);
    const n = this.msgs.length;
    this.room.send('engageSpawn', { spawnId: rec.id });
    await waitFor(() => this.msgs.slice(n).some((m) => m.type === 'battleStart' || m.type === 'error'), 5000);
    const err = this.msgs.slice(n).find((m) => m.type === 'error');
    if (err !== undefined) throw new Error(`walker: engageSpawn ${JSON.stringify(err)}`);
    return this.fight(mode);
  }

  /**
   * True when the party needs a healer: a core member (the four highest levels) fainted, under 40 % HP or low on
   * damaging PP — or every other member is down, so none of them is earning exp any more.
   */
  worn(party: readonly CreatureInstance[]): boolean {
    const byLevel = [...party].sort((a, b) => b.level - a.level);
    const core = byLevel.slice(0, 4);
    const rest = byLevel.slice(4);
    const maxOf = (c: CreatureInstance): number => calcMaxHp(content.species(c.speciesId).baseHp, c.level);
    for (const c of core) {
      if (c.hp < maxOf(c) * 0.4) return true;
      if (c.moves.filter((m) => content.move(m.id).power > 0).reduce((a, m) => a + m.pp, 0) < 6) return true;
    }
    return rest.length > 0 && rest.every((c) => c.hp < maxOf(c) * 0.5);
  }

  /**
   * Trains on forced spawns of this zone (each healthy member switched in once per battle, so each gets the KO's
   * exp) until the four strongest members reach `level` (newcomers catch up on the way). `healVia`: this zone heals
   * (a healer town) or the link side of an adjacent healer town, crossed there and back whenever the party is worn.
   */
  async train(level: number, healVia: LinkDir | 'here', maxBattles = 800): Promise<number> {
    let n = 0;
    let party = await this.party();
    for (; n < maxBattles; n++) {
      const levels = party.map((c) => c.level).sort((a, b) => b - a);
      if (levels[Math.min(3, levels.length - 1)]! >= level) break;
      if (this.worn(party)) {
        await this.healTrip(healVia);
        party = await this.party();
      }
      const low = Math.min(...party.map((c) => c.level));
      const lead = [...party].sort((a, b) => b.level - a.level)[0]!;
      // a spawn a little above the weakest member when the table allows it (the table's band caps it)
      const rec = this.forceSpawn(undefined, low + 2, lead);
      const r = await this.engage(rec, { kind: 'train' });
      if (r.end.outcome.winner !== 0) this.note(`training battle ${n} ended ${JSON.stringify(r.end.outcome)}`);
      if (n % 4 === 3) await this.tend();
      party = await this.party();
    }
    await this.tend();
    this.note(`trained to L${level} (top four) in ${n} battles`);
    return n;
  }

  async healTrip(via: LinkDir | 'here'): Promise<void> {
    if (via === 'here') return this.heal();
    const back = OPPOSITE[via];
    await this.cross(via);
    await this.heal();
    await this.settle();
    await this.cross(back);
  }

  /**
   * Catches `species` from this zone's table (weaken, then orbs from the bag — nothing is bought here). null when the
   * bag runs out of `orb` first.
   */
  async catchOne(species: string, orb: string, maxTries = 16): Promise<CreatureInstance | null> {
    for (let i = 0; i < maxTries; i++) {
      if ((await this.itemCount(orb)) === 0) {
        this.note(`out of ${orb} before catching ${species}`);
        return null;
      }
      if (this.worn(await this.party())) await this.healTrip(this.healDir());
      const table = encounterTableFor(this.zoneId);
      const slot = table?.slots.find((x) => x.species === species);
      const rec = this.forceSpawn(species, slot?.levelMax);
      const before = new Set((await this.party()).map((c) => c.id));
      const r = await this.engage(rec, { kind: 'catch', orb });
      if (r.end.outcome.winner === 'caught') {
        this.note(`caught ${species} (battle ${i + 1})`);
        const got = (await this.party()).find((c) => !before.has(c.id));
        if (got === undefined) throw new Error(`walker: caught ${species} went to the box (party full?)`);
        return got;
      }
      this.note(`catch battle ${i + 1} for ${species}: ${JSON.stringify(r.end.outcome)}`);
    }
    throw new Error(`walker: could not catch ${species} in ${maxTries} battles`);
  }

  /** The link side of an adjacent healer town this player may enter (for heal trips); 'here' in a healer zone. */
  healDir(): LinkDir | 'here' {
    if (this.zone.healer) return 'here';
    for (const d of ['w', 's', 'n', 'e'] as const) {
      const to = this.zone.links[d];
      if (to !== undefined && zoneById(to).healer) return d;
    }
    throw new Error(`walker: no healer next to ${this.zoneId}`);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const OPPOSITE: Readonly<Record<LinkDir, LinkDir>> = { n: 's', s: 'n', e: 'w', w: 'e' };

export function ofTypeIn<T extends Msg['type']>(msgs: readonly Msg[], type: T): Extract<Msg, { type: T }>[] {
  return msgs.filter((m): m is Extract<Msg, { type: T }> => m.type === type);
}

/** The four best damaging moves the creature's species can know at its level (power × STAB × accuracy), distinct types first. */
export function bestMoves(c: CreatureInstance): string[] {
  const sp = content.species(c.speciesId);
  const known = new Set<string>();
  for (const e of sp.learnableMoves) if (e.level <= c.level) known.add(e.move);
  const scored = [...known]
    .map((id) => {
      const m = content.move(id);
      return { id, type: m.type, v: m.power <= 0 ? 0 : m.power * (sp.types.includes(m.type) ? 1.5 : 1) * ((m.accuracy ?? 100) / 100) };
    })
    .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  const out: string[] = [];
  const types = new Set<string>();
  for (const m of scored) if (m.v > 0 && !types.has(m.type) && out.length < 4) {
    out.push(m.id);
    types.add(m.type);
  }
  for (const m of scored) if (out.length < 4 && !out.includes(m.id)) out.push(m.id);
  return out.slice(0, 4);
}

function statsOf(species: string, level: number): { hp: number; atk: number; def: number } {
  const sp = content.species(species);
  return { hp: calcMaxHp(sp.baseHp, level), atk: calcStat(sp.baseAtk, level), def: calcStat(sp.baseDef, level) };
}

function bestPressure(attacker: string, level: number, moves: readonly string[], defender: string, defLevel: number): number {
  const a = content.species(attacker);
  const d = content.species(defender);
  const as = statsOf(attacker, level);
  const ds = statsOf(defender, defLevel);
  let best = 0;
  for (const id of moves) {
    const m = content.move(id);
    if (m.power <= 0) continue;
    const eff = typeMultiplier(content.typeChart, m.type, d.types);
    const v = (m.power * (a.types.includes(m.type) ? 1.5 : 1) * eff * as.atk) / Math.max(1, ds.def) / ds.hp;
    if (v > best) best = v;
  }
  return best;
}

/** How well `species` at `level` with `moves` fares against `foe`: its pressure over the foe's (both as HP fractions). */
export function matchup(species: string, level: number, moves: readonly string[], foe: string, foeLevel: number): number {
  const foeMoves = content.species(foe).learnableMoves.filter((e) => e.level <= foeLevel).map((e) => e.move);
  return bestPressure(species, level, moves, foe, foeLevel) / Math.max(0.01, bestPressure(foe, foeLevel, foeMoves, species, level));
}

function battlerMatchup(b: Battler, opp: Battler): number {
  const mine = b.creature.moves.filter((m) => m.pp > 0).map((m) => m.id);
  return matchup(b.creature.speciesId, b.creature.level, mine, opp.creature.speciesId, opp.creature.level) * (b.creature.hp / b.maxHp);
}

function roughDamage(att: Battler, def: Battler, moveId: string): number {
  const m = content.move(moveId);
  const eff = typeMultiplier(content.typeChart, m.type, content.species(def.creature.speciesId).types);
  const stab = content.species(att.creature.speciesId).types.includes(m.type) ? 1.5 : 1;
  // §2.14 shape: ((2L/5 + 2) · P · A/D) / 50 + 2, at the max random factor, no crit
  return ((((2 * att.creature.level) / 5 + 2) * m.power * (att.atk / Math.max(1, def.def))) / 50 + 2) * stab * eff;
}

export type { BattleOutcome, RewardsSummary, BadgeId };
export { pathLength };
