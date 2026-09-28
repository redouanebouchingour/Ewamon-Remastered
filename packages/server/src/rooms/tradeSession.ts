/**
 * §30.8.3 Trades — a room sub-state with atomic completion.
 *
 * - `TradeSession` is pure (no I/O, injected `now`): phases, offers, the offer hash, confirmations.
 * - `TradeCoordinator` owns the sessions of one room: request/reply/offer/confirm/cancel validation, the 120 s
 *   inactivity cancel, and the ONE completion transaction (players locked ascending, escrow, `completeTrade`, dex,
 *   `tradeComplete` exp). Nothing moves before that transaction, so a cancellation writes nothing. No Colyseus
 *   import: the room is a `TradeHost`.
 *
 * The offer hash is protocol's `tradeOfferHash` (fnv1a32 of the canonical `{ playerId, creatureIds, money }` pair,
 * sorted by playerId, `confirmed` excluded) — the one function both client and server call.
 */
import { randomUUID } from 'node:crypto';
import { TRAINER_EXP } from '@ewa/core';
import type { CreatureInstance } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import { tradeOfferHash } from '@ewa/protocol';
import type { QuestProgressEntry, ServerMessage, TradeOffer, TradePhase } from '@ewa/protocol';
import { advanceQuests } from '../game/quests';
import type { QuestEvent } from '../game/quests';
import type { Logger } from '../log';
import { toInstance } from './battleSession';

export const TRADE_IDLE_MS = 120_000;
export const TRADE_MAX_CREATURES = 6;

export type { TradePhase };

function emptyOffer(playerId: string): TradeOffer {
  return { playerId, creatureIds: [], money: 0, confirmed: false };
}

export class TradeSession {
  phase: TradePhase = 'requested';
  offers: [TradeOffer, TradeOffer];
  lastActivity: number;

  constructor(
    readonly id: string,
    /** the requester */
    readonly a: string,
    /** the target */
    readonly b: string,
    now: number,
  ) {
    this.offers = [emptyOffer(a), emptyOffer(b)];
    this.lastActivity = now;
  }

  has(playerId: string): boolean {
    return playerId === this.a || playerId === this.b;
  }

  other(playerId: string): string {
    return playerId === this.a ? this.b : this.a;
  }

  private idx(playerId: string): 0 | 1 | -1 {
    return playerId === this.a ? 0 : playerId === this.b ? 1 : -1;
  }

  /** fnv1a32 of both offers without `confirmed`, canonical (protocol `tradeOfferHash`), 8 hex chars. */
  offerHash(): string {
    return tradeOfferHash(this.offers);
  }

  /** B accepts the request. */
  open(now: number): 'ok' | 'badPhase' {
    if (this.phase !== 'requested') return 'badPhase';
    this.phase = 'open';
    this.lastActivity = now;
    return 'ok';
  }

  /** Replaces the sender's offer and clears BOTH confirmed flags (any change re-opens the negotiation). */
  setOffer(playerId: string, creatureIds: readonly string[], money: number, now: number): 'ok' | 'notParty' | 'badPhase' {
    const i = this.idx(playerId);
    if (i === -1) return 'notParty';
    if (this.phase !== 'open' && this.phase !== 'confirming') return 'badPhase';
    const next: [TradeOffer, TradeOffer] = [
      { ...this.offers[0], confirmed: false },
      { ...this.offers[1], confirmed: false },
    ];
    next[i] = { playerId, creatureIds: [...creatureIds], money, confirmed: false };
    this.offers = next;
    this.phase = 'open';
    this.lastActivity = now;
    return 'ok';
  }

  /** Confirms the CURRENT offers; a hash computed over any other pair is `staleOffer`. */
  confirm(playerId: string, hash: string, now: number): 'ok' | 'staleOffer' | 'badPhase' | 'notParty' {
    const i = this.idx(playerId);
    if (i === -1) return 'notParty';
    if (this.phase !== 'open' && this.phase !== 'confirming') return 'badPhase';
    if (hash !== this.offerHash()) return 'staleOffer';
    const next: [TradeOffer, TradeOffer] = [{ ...this.offers[0] }, { ...this.offers[1] }];
    next[i] = { ...next[i], confirmed: true };
    this.offers = next;
    this.phase = 'confirming';
    this.lastActivity = now;
    return 'ok';
  }

  bothConfirmed(): boolean {
    return this.offers[0].confirmed && this.offers[1].confirmed;
  }

  /** Nothing to trade (both offers empty) — the completion would be refused by persist. */
  isEmpty(): boolean {
    return this.offers.every((o) => o.creatureIds.length === 0 && o.money === 0);
  }

  idle(now: number): boolean {
    return now - this.lastActivity >= TRADE_IDLE_MS;
  }

  toMessage(): ServerMessage {
    return { type: 'tradeUpdate', tradeId: this.id, phase: this.phase, offers: this.offers, offerHash: this.offerHash() };
  }
}

export interface TradeHost {
  send(playerId: string, msg: ServerMessage): void;
  /** userData.tradeId + presence tradeId */
  setTrade(playerId: string, tradeId: string | null): void;
  /** §30.4.5 step-1 conditions (both present, AOI + 12 m, not in battle, not self), trades excluded */
  eligible(fromId: string, toId: string): boolean;
  /** the player's current open trade id (userData.tradeId) */
  tradeOf(playerId: string): string | null;
}

export interface TradeDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly clock: () => number;
  readonly log: Logger;
  readonly host: TradeHost;
}

export type TradeError = { readonly code: 'notFound' | 'notAllowed' | 'busy'; readonly detail: string | null };

export class TradeCoordinator {
  private readonly sessions = new Map<string, TradeSession>();
  /** trades whose completion transaction is in flight (no cancel/offer may interleave) */
  private readonly completing = new Set<string>();

  constructor(private readonly deps: TradeDeps) {}

  get size(): number {
    return this.sessions.size;
  }

  get(id: string): TradeSession | null {
    return this.sessions.get(id) ?? null;
  }

  private broadcast(t: TradeSession): void {
    const msg = t.toMessage();
    this.deps.host.send(t.a, msg);
    this.deps.host.send(t.b, msg);
  }

  private end(t: TradeSession, phase: 'complete' | 'cancelled'): void {
    t.phase = phase;
    this.sessions.delete(t.id);
    for (const p of [t.a, t.b]) if (this.deps.host.tradeOf(p) === t.id) this.deps.host.setTrade(p, null);
    this.broadcast(t);
  }

  /** `tradeRequest { targetId }`: same presence/AOI/12 m/not-busy checks as challenges. The requester is busy until it resolves. */
  request(fromId: string, toId: string): TradeError | null {
    const host = this.deps.host;
    if (host.tradeOf(fromId) !== null) return { code: 'busy', detail: 'inTrade' };
    if (host.tradeOf(toId) !== null) return { code: 'busy', detail: 'targetBusy' };
    if (!host.eligible(fromId, toId)) return { code: 'notAllowed', detail: 'unavailable' };
    for (const t of this.sessions.values()) if (t.a === fromId && t.b === toId) return { code: 'busy', detail: 'duplicate' };
    const t = new TradeSession(randomUUID(), fromId, toId, this.deps.clock());
    this.sessions.set(t.id, t);
    host.setTrade(fromId, t.id);
    this.broadcast(t);
    return null;
  }

  /** `tradeReply`: only the target, only while requested; accept re-checks every request condition. */
  reply(playerId: string, tradeId: string, accept: boolean): TradeError | null {
    const t = this.sessions.get(tradeId);
    if (t === undefined || t.b !== playerId) return { code: 'notFound', detail: null };
    if (t.phase !== 'requested') return { code: 'notAllowed', detail: 'badPhase' };
    if (!accept) {
      this.end(t, 'cancelled');
      return null;
    }
    const host = this.deps.host;
    if (host.tradeOf(playerId) !== null || !host.eligible(t.a, t.b)) {
      this.end(t, 'cancelled');
      return { code: 'notAllowed', detail: 'unavailable' };
    }
    t.open(this.deps.clock());
    host.setTrade(playerId, t.id);
    // the target's other pending requests are void now that it is trading
    for (const other of [...this.sessions.values()]) if (other !== t && other.phase === 'requested' && other.has(playerId)) this.end(other, 'cancelled');
    this.broadcast(t);
    return null;
  }

  /**
   * `tradeOffer`: every creature owned by the sender, in party or box, not locked; the sender keeps ≥ 1 party member;
   * money ≤ current money. Any change clears both confirmations and re-sends the new hash.
   */
  async offer(playerId: string, tradeId: string, creatureIds: readonly string[], money: number): Promise<TradeError | null> {
    const t = this.sessions.get(tradeId);
    if (t === undefined || !t.has(playerId)) return { code: 'notFound', detail: null };
    if (this.completing.has(t.id)) return { code: 'busy', detail: 'completing' };
    if (t.phase !== 'open' && t.phase !== 'confirming') return { code: 'notAllowed', detail: 'badPhase' };
    if (creatureIds.length > TRADE_MAX_CREATURES) return { code: 'notAllowed', detail: 'tooMany' };
    if (new Set(creatureIds).size !== creatureIds.length) return { code: 'notAllowed', detail: 'duplicate' };
    const { repos } = this.deps;
    const verdict = await repos.db.transaction(async (tx) => {
      const player = await repos.players.byId(tx, playerId);
      if (player === null) return 'notFound';
      if (money > player.money) return 'insufficientFunds';
      const owned = await repos.creatures.byOwner(tx, playerId);
      const byId = new Map(owned.map((c) => [c.id, c]));
      let partyGiven = 0;
      for (const id of creatureIds) {
        const c = byId.get(id);
        if (c === undefined) return 'notOwner';
        if (c.slotKind !== 'party' && c.slotKind !== 'box') return 'notTradable';
        if (c.locked) return 'locked';
        if (c.slotKind === 'party') partyGiven++;
      }
      const partySize = owned.filter((c) => c.slotKind === 'party').length;
      if (partySize - partyGiven < 1) return 'partyMinimum';
      return 'ok';
    });
    if (verdict !== 'ok') return { code: 'notAllowed', detail: verdict };
    // the session may have ended while the read was in flight
    if (this.sessions.get(tradeId) !== t) return { code: 'notFound', detail: null };
    const r = t.setOffer(playerId, creatureIds, money, this.deps.clock());
    if (r !== 'ok') return { code: 'notAllowed', detail: r };
    this.broadcast(t);
    return null;
  }

  /** `tradeConfirm { offerHash }`: must match the current hash (§30.5.1 #21); both confirmed → the completion tx. */
  async confirm(playerId: string, tradeId: string, hash: string): Promise<TradeError | null> {
    const t = this.sessions.get(tradeId);
    if (t === undefined || !t.has(playerId)) return { code: 'notFound', detail: null };
    if (this.completing.has(t.id)) return { code: 'busy', detail: 'completing' };
    if (t.isEmpty()) return { code: 'notAllowed', detail: 'emptyTrade' };
    const r = t.confirm(playerId, hash, this.deps.clock());
    if (r !== 'ok') return { code: 'notAllowed', detail: r };
    this.broadcast(t);
    if (t.bothConfirmed()) await this.complete(t);
    return null;
  }

  /** `tradeCancel` — either party, any phase before completion. */
  cancel(playerId: string, tradeId: string): TradeError | null {
    const t = this.sessions.get(tradeId);
    if (t === undefined || !t.has(playerId)) return { code: 'notFound', detail: null };
    if (this.completing.has(t.id)) return { code: 'busy', detail: 'completing' };
    this.end(t, 'cancelled');
    return null;
  }

  /** onLeave / entering a battle: every trade (pending or open) involving the player is cancelled. */
  cancelFor(playerId: string): void {
    for (const t of [...this.sessions.values()]) if (t.has(playerId) && !this.completing.has(t.id)) this.end(t, 'cancelled');
  }

  /** §30.2.8 step 8 — 120 s without activity → cancelled. */
  tick(now: number): void {
    for (const t of [...this.sessions.values()]) if (t.idle(now) && !this.completing.has(t.id)) this.end(t, 'cancelled');
  }

  /**
   * The ONE transaction: lock both players (ascending uuid), move every offered creature into `trade_escrow`
   * (creature rows in ascending uuid; owner + not locked + party/box re-asserted), `completeTrade` (money both ways
   * — an insufficient balance now rolls everything back —, transfers, two trade_history rows, audit), dex marks for
   * received species and `tradeComplete` exp ×2. Then `tradeUpdate complete` + `inventoryDelta` +
   * `progressionDelta` to both; on any failure `tradeUpdate cancelled` and nothing persisted.
   */
  private async complete(t: TradeSession): Promise<void> {
    const { repos, clock, log, host } = this.deps;
    this.completing.add(t.id);
    const now = new Date(clock());
    const [oa, ob] = t.offers;
    type Outcome = { money: number; added: CreatureInstance[]; removed: string[]; trainerExp: number; trainerLevel: number; dex: string[]; questProgress: QuestProgressEntry[] };
    let result: Map<string, Outcome>;
    try {
      result = await repos.db.transaction(async (tx) => {
        await repos.players.lockMany(tx, [t.a, t.b]);
        const offered = [...oa.creatureIds.map((id) => ({ id, owner: t.a })), ...ob.creatureIds.map((id) => ({ id, owner: t.b }))].sort((x, y) => (x.id < y.id ? -1 : 1));
        for (const { id, owner } of offered) {
          const rec = await repos.creatures.recordById(tx, id);
          if (rec === null || rec.ownerId !== owner) throw new Error(`trade ${t.id}: ${id} not owned by ${owner}`);
          if (rec.locked) throw new Error(`trade ${t.id}: ${id} locked`);
          if (rec.slotKind !== 'party' && rec.slotKind !== 'box') throw new Error(`trade ${t.id}: ${id} is ${rec.slotKind}`);
          await repos.creatures.moveToSlot(tx, id, 'trade_escrow', 'nextBox');
        }
        await repos.history.completeTrade(tx, t.id, { playerId: t.a, creatureIds: oa.creatureIds, money: oa.money }, { playerId: t.b, creatureIds: ob.creatureIds, money: ob.money }, now);
        const out = new Map<string, Outcome>();
        for (const [me, give, get] of [
          [t.a, oa, ob],
          [t.b, ob, oa],
        ] as const) {
          const added: CreatureInstance[] = [];
          const dex: string[] = [];
          const events: QuestEvent[] = [{ kind: 'trade' }];
          for (const id of get.creatureIds) {
            const c = toInstance((await repos.creatures.byId(tx, id))!);
            added.push(c);
            if (await repos.progress.markSeen(tx, me, c.speciesId, now)) events.push({ kind: 'seen', species: c.speciesId });
            await repos.progress.markCaught(tx, me, c.speciesId, c.variantKey, c.isAlpha, now);
            if (!dex.includes(c.speciesId)) dex.push(c.speciesId);
          }
          const exp = await repos.players.addTrainerExp(tx, me, TRAINER_EXP.tradeComplete);
          const questProgress = await advanceQuests(tx, repos, me, events, now.getTime());
          out.set(me, { money: (await repos.players.byId(tx, me))!.money, added, removed: [...give.creatureIds], trainerExp: exp.trainerExp, trainerLevel: exp.trainerLevel, dex, questProgress });
        }
        return out;
      });
    } catch (e) {
      log.info({ err: e, tradeId: t.id }, 'trade completion rolled back');
      this.completing.delete(t.id);
      this.end(t, 'cancelled');
      return;
    }
    this.completing.delete(t.id);
    this.end(t, 'complete');
    for (const [pid, r] of result) {
      // received creatures are transferred into the receiver's box (persist completeTrade → transferCreature)
      host.send(pid, { type: 'inventoryDelta', items: {}, money: r.money, creaturesAdded: r.added, creaturesRemoved: r.removed, creaturesUpdated: [], ...(r.added.length > 0 ? { placement: Object.fromEntries(r.added.map((c) => [c.id, 'box' as const])) } : {}) });
      host.send(pid, {
        type: 'progressionDelta',
        badges: null,
        trainerExp: r.trainerExp,
        trainerLevel: r.trainerLevel,
        rating: null,
        dexSeen: r.dex.length > 0 ? r.dex : null,
        dexCaught: r.dex.length > 0 ? r.dex : null,
        flags: null,
        questProgress: r.questProgress.length > 0 ? r.questProgress : null,
      });
    }
  }

  dispose(): void {
    this.sessions.clear();
    this.completing.clear();
  }
}
