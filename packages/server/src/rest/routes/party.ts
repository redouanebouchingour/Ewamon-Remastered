/**
 * §4.7 rows: /party/*, /creature/:id/*, /item/use, /heal. All refused with 409 `inBattle` while the player
 * is projected in a live battle (§30.6.3). Every effect is computed with @ewa/core (applyExp, evolve,
 * calcMaxHp) — the client never sends a result, only an intent.
 */
import { MOVE_TUTOR_PRICE, TRADE_EVOLVE_RIBBON, TM_MOVES, canLearnMachineMove, tmItemId } from '@ewa/content';
import { applyExp, calcMaxHp, evolutionChildren, evolutionTarget, evolve, expToLevel, itemEvolutionTarget, majorStatus, removeStatus, tracksHonor, tradeEvolutionTarget } from '@ewa/core';
import type { ConsumableDef, CreatureInstance, ItemDef, StatusId } from '@ewa/core';
import type { CreatureRecord, Tx } from '@ewa/persist';
import {
  CreatureFlagsReq,
  CreatureHistoryRes,
  CreatureIdReq,
  CreatureInstanceSchema,
  CreatureParams,
  CreatureEvolveRes,
  CreatureSetupRes,
  EvolveReq,
  ItemUseReq,
  ItemUseRes,
  MovesReq,
  NicknameReq,
  PartyBoxRes,
  PartyReorderReq,
  PartyRes,
  PartySwapReq,
  SetupReq,
  TutorReq,
} from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { sanitizeChat } from '../../chat/filter';
import { healed } from '../../game/creatures';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, inventoryDeltaBody, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

function isConsumable(def: ItemDef | ConsumableDef): def is ConsumableDef {
  return 'effect' in def;
}

export function registerPartyRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, content, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  /** The caller's own creature (404 for anyone else's — a foreign id leaks nothing). */
  async function own(tx: Tx, owner: string, id: string): Promise<CreatureRecord> {
    const rec = await repos.creatures.recordById(tx, id);
    if (rec === null || rec.ownerId !== owner) throw new HttpError(404, 'NotFound');
    return rec;
  }

  async function partyBox(tx: Tx, id: string) {
    return { party: (await repos.creatures.party(tx, id)).map(toInstance), box: (await repos.creatures.box(tx, id, 0, 500)).map(toInstance) };
  }

  async function freePartyIndex(tx: Tx, owner: string): Promise<number> {
    const used = new Set((await repos.creatures.byOwner(tx, owner)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
    for (let i = 0; i < 6; i++) if (!used.has(i)) return i;
    throw new HttpError(409, 'PartyFull');
  }

  // ---- party --------------------------------------------------------------------------------------------

  app.post('/party/reorder', bearer, async (req) => {
    const body = PartyReorderReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const party = await repos.db.transaction(async (tx) => {
      await repos.creatures.reorderParty(tx, id, body.order);
      return (await repos.creatures.party(tx, id)).map(toInstance);
    });
    return out(deps, PartyRes, { party });
  });

  app.post('/party/swap', bearer, async (req) => {
    const body = PartySwapReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const res = await repos.db.transaction(async (tx) => {
      await own(tx, id, body.partyId);
      await own(tx, id, body.boxId);
      await repos.creatures.swap(tx, id, body.partyId, body.boxId);
      return partyBox(tx, id);
    });
    return out(deps, PartyBoxRes, res);
  });

  app.post('/party/withdraw', bearer, async (req) => {
    const body = CreatureIdReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const res = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, body.id);
      if (rec.slotKind !== 'box') throw new HttpError(409, 'InvalidSlot');
      await repos.creatures.moveToSlot(tx, body.id, 'party', await freePartyIndex(tx, id));
      return partyBox(tx, id);
    });
    return out(deps, PartyBoxRes, res);
  });

  app.post('/party/deposit', bearer, async (req) => {
    const body = CreatureIdReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const res = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, body.id);
      if (rec.slotKind !== 'party') throw new HttpError(409, 'InvalidSlot');
      await repos.creatures.moveToSlot(tx, body.id, 'box', 'nextBox');
      return partyBox(tx, id);
    });
    return out(deps, PartyBoxRes, res);
  });

  // ---- creature -----------------------------------------------------------------------------------------

  app.post('/creature/:id/nickname', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = NicknameReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const nickname = body.nickname === null ? null : sanitizeChat(body.nickname, 16);
    if (body.nickname !== null && nickname === null) throw new HttpError(400, 'invalidPayload');
    const c = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, cid);
      const next: CreatureInstance = { ...toInstance(rec), nickname };
      await repos.creatures.update(tx, next);
      return next;
    });
    return out(deps, CreatureInstanceSchema, c);
  });

  /**
   * 1..4 unique ids; kept slots keep pp, new ones get ppMax. Each id is one the creature already knows (a TM or tutor
   * move stays once taught), one its species learns at or below its level, or — Phase D2 — a `TM_MOVES` move whose TM
   * (`tm:<move>`) the player owns and the species can be taught (`canLearnMachineMove`). TMs are never used up.
   */
  app.post('/creature/:id/moves', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = MovesReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const c = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, cid);
      const sp = content.species(rec.speciesId);
      for (const m of body.moves) {
        if (rec.moves.some((s) => s.id === m)) continue;
        if (sp.learnableMoves.some((e) => e.move === m && e.level <= rec.level)) continue;
        if (TM_MOVES.includes(m) && (await repos.inventory.qty(tx, id, tmItemId(m))) > 0 && canLearnMachineMove(sp, content.move(m))) continue;
        throw new HttpError(409, 'notLearnable', { move: m });
      }
      const moves = body.moves.map((m) => rec.moves.find((s) => s.id === m) ?? { id: m, pp: content.move(m).pp, ppMax: content.move(m).pp });
      const next: CreatureInstance = { ...toInstance(rec), moves };
      await repos.creatures.update(tx, next);
      return next;
    });
    return out(deps, CreatureInstanceSchema, c);
  });

  /**
   * ability ∈ species.abilities; heldItem null or a held ItemDef the player owns. Equipping takes one from the
   * inventory and returns the previously held item (IMPLEMENTATION-NOTES S6 — the spec leaves this open).
   * The response is the CreatureInstance plus `inventoryDelta` (absolute counts of the touched items, the
   * creature in creaturesUpdated) — part 2 P1.
   */
  app.post('/creature/:id/setup', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = SetupReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const items: Record<string, number> = {};
    const c = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rec = await own(tx, id, cid);
      const sp = content.species(rec.speciesId);
      if (!sp.abilities.includes(body.ability)) throw new HttpError(409, 'badAbility');
      if (body.heldItem !== null && body.heldItem !== rec.heldItem) {
        let def: ItemDef | ConsumableDef;
        try {
          def = content.item(body.heldItem);
        } catch (_e) {
          throw new HttpError(409, 'unknownItem');
        }
        if (isConsumable(def) || def.slot !== 'held') throw new HttpError(409, 'notHoldable');
        items[body.heldItem] = await repos.inventory.add(tx, id, body.heldItem, -1);
      }
      if (rec.heldItem !== null && rec.heldItem !== body.heldItem) items[rec.heldItem] = await repos.inventory.add(tx, id, rec.heldItem, 1);
      const next: CreatureInstance = { ...toInstance(rec), ability: body.ability, heldItem: body.heldItem };
      await repos.creatures.update(tx, next);
      return next;
    });
    return out(deps, CreatureSetupRes, { ...c, inventoryDelta: inventoryDeltaBody({ items, creaturesUpdated: [c] }) });
  });

  /**
   * `into` must be what the creature can evolve into right now:
   *   - a level / split evolution: core's evolveReady at the current level and ability (split branch by ability);
   *   - an honor split (dustcub): either branch may be named — the honor ledger can still move after the battle event
   *     that queued the prompt — and the creature evolves into the branch its persisted ledger picks now;
   *   - Phase D3 stone: the species' `{ kind: 'item', item }` target while the player owns the stone — ONE is spent,
   *     and the response carries the stone count in `inventoryDelta`;
   *   - Phase D3 trade: the species' `{ kind: 'trade' }` target while the creature carries the trade marker
   *     (`TRADE_EVOLVE_RIBBON`, written by the trade that delivered it); the marker is removed.
   */
  app.post('/creature/:id/evolve', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = EvolveReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rec = await own(tx, id, cid);
      const cur = toInstance(rec);
      const evo = content.species(rec.speciesId).evolution;
      const items: Record<string, number> = {};
      let via: 'level' | 'item' | 'trade' = 'level';
      let next: CreatureInstance;
      const honorSplit = evo !== null && evo.kind === 'split' && tracksHonor(content.species(rec.speciesId)) && cur.level >= evo.atLevel && evolutionChildren(evo).includes(body.into);
      if (applyExp(cur, 0, content).evolveReady === body.into) {
        next = evolve(cur, body.into, content);
      } else if (honorSplit) {
        const into = evolutionTarget(evo, cur.ability, cur.honor ?? 0);
        if (into === null) throw new HttpError(409, 'notReady');
        next = evolve(cur, into, content);
      } else if (evo !== null && evo.kind === 'item' && itemEvolutionTarget(evo, evo.item) === body.into) {
        if ((await repos.inventory.qty(tx, id, evo.item)) < 1) throw new HttpError(409, 'notReady', { needs: evo.item });
        items[evo.item] = await repos.inventory.add(tx, id, evo.item, -1);
        via = 'item';
        next = evolve(cur, body.into, content);
      } else if (tradeEvolutionTarget(evo) === body.into && cur.ribbons.includes(TRADE_EVOLVE_RIBBON)) {
        via = 'trade';
        next = { ...evolve(cur, body.into, content), ribbons: cur.ribbons.filter((r) => r !== TRADE_EVOLVE_RIBBON) };
      } else {
        throw new HttpError(409, 'notReady');
      }
      await repos.creatures.update(tx, next);
      await repos.progress.markSeen(tx, id, next.speciesId, now);
      await repos.progress.markCaught(tx, id, next.speciesId, next.variantKey, next.isAlpha, now, next.isShiny === true);
      await repos.audit.write(tx, { actorId: id, action: 'creature.evolve', subject: cid, detail: { from: rec.speciesId, into: next.speciesId, via } }, now);
      await repos.creatures.addEvent(tx, [cid], { kind: 'evolved', from: rec.speciesId, into: next.speciesId }, now);
      return { next, items };
    });
    const c = res.next;
    return out(deps, CreatureEvolveRes, Object.keys(res.items).length > 0 ? { ...c, inventoryDelta: inventoryDeltaBody({ items: res.items, creaturesUpdated: [c] }) } : c);
  });

  /**
   * Phase D2 move tutor: `move` must be taught by a tutor NPC (`NpcDef.tutor`) of the zone the player is in, the
   * species must be able to learn it (`canLearnMachineMove`) and the creature must not know it yet. Costs
   * `MOVE_TUTOR_PRICE`; with four moves known, `forget` names the one replaced (its slot takes the new move at full pp).
   */
  app.post('/creature/:id/tutor', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = TutorReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    if (zone === null || !zone.npcs.some((n) => n.tutor?.includes(body.move) ?? false)) throw new HttpError(409, 'noTutorHere');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rec = await own(tx, id, cid);
      const sp = content.species(rec.speciesId);
      const mv = content.move(body.move);
      if (rec.moves.some((m) => m.id === body.move)) throw new HttpError(409, 'alreadyKnown');
      if (!canLearnMachineMove(sp, mv)) throw new HttpError(409, 'notLearnable', { move: body.move });
      const slot = { id: mv.id, pp: mv.pp, ppMax: mv.pp };
      let moves;
      if (body.forget === null) {
        if (rec.moves.length >= 4) throw new HttpError(409, 'movesFull');
        moves = [...rec.moves, slot];
      } else {
        if (!rec.moves.some((m) => m.id === body.forget)) throw new HttpError(409, 'notKnown', { move: body.forget });
        moves = rec.moves.map((m) => (m.id === body.forget ? slot : m));
      }
      // the balance check is the repo's: going negative throws (409)
      const money = await repos.players.addMoney(tx, id, -MOVE_TUTOR_PRICE);
      const next: CreatureInstance = { ...toInstance(rec), moves };
      await repos.creatures.update(tx, next);
      await repos.audit.write(tx, { actorId: id, action: 'creature.tutor', subject: cid, detail: { move: body.move, forget: body.forget, price: MOVE_TUTOR_PRICE, zoneId: zone.id } }, now);
      return { next, money };
    });
    return out(deps, CreatureSetupRes, { ...res.next, inventoryDelta: inventoryDeltaBody({ money: res.money, creaturesUpdated: [res.next] }) });
  });

  app.post('/creature/:id/release', bearer, async (req, reply) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    await repos.db.transaction(async (tx) => {
      await own(tx, id, cid);
      await repos.creatures.release(tx, cid, id);
    });
    return reply.status(204).send();
  });

  /**
   * Creature history: its original trainer and events, oldest first. Any signed-in player may read any creature's
   * history (a listed creature's past is part of what is offered; names in it are public usernames).
   */
  app.get('/creature/:id/history', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const h = await repos.db.transaction((tx) => repos.creatures.history(tx, cid));
    if (h === null) throw new HttpError(404, 'notFound');
    return out(deps, CreatureHistoryRes, { originalTrainer: h.originalTrainer, events: h.events.map((e) => ({ ...e.detail, at: e.at.toISOString() })) } as never);
  });

  app.post('/creature/:id/flags', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = CreatureFlagsReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const c = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, cid);
      const next: CreatureInstance = { ...toInstance(rec), favorite: body.favorite ?? rec.favorite, locked: body.locked ?? rec.locked };
      await repos.creatures.update(tx, next);
      return next;
    });
    return out(deps, CreatureInstanceSchema, c);
  });

  // ---- items / heal ---------------------------------------------------------------------------------------

  /**
   * Server-validated consumable effects out of battle. repel / lure publish `ewa:repel` (the room holding the player
   * keeps the step counter); escapeRope publishes `ewa:teleport` (route zones only) — IMPLEMENTATION-NOTES Q18.
   */
  app.post('/item/use', bearer, async (req) => {
    const body = ItemUseReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    let def: ItemDef | ConsumableDef;
    try {
      def = content.item(body.item);
    } catch (_e) {
      throw new HttpError(409, 'unknownItem');
    }
    if (!isConsumable(def)) throw new HttpError(409, 'notUsable');
    const effect = def.effect;
    // §30.6.3 field items: repel / lure (step counters the room consults) and escape rope (route zones only)
    if (effect.kind === 'repel' || effect.kind === 'lure' || effect.kind === 'escapeRope') {
      if (body.qty !== 1) throw new HttpError(409, 'oneAtATime');
      const zone = presenceZone(deps, id);
      if (zone === null) throw new HttpError(409, 'notUsableHere');
      if (effect.kind === 'escapeRope' && zone.kind !== 'route') throw new HttpError(409, 'notUsableHere');
      const now = new Date(clock());
      const inventory = await repos.db.transaction(async (tx) => {
        await repos.players.lock(tx, id);
        await repos.inventory.add(tx, id, body.item, -1);
        await repos.audit.write(tx, { actorId: id, action: 'item.use', subject: body.item, detail: { zoneId: zone.id } }, now);
        return repos.inventory.all(tx, id);
      });
      if (effect.kind === 'escapeRope') deps.bus.publish('ewa:teleport', { playerId: id, to: 'spawn' });
      else deps.bus.publish('ewa:repel', { playerId: id, kind: effect.kind, steps: effect.steps });
      return out(deps, ItemUseRes, { inventory, creaturesUpdated: [], events: [{ t: 'itemUsed', item: body.item, target: null, qty: 1 }] });
    }
    // Phase D3 evolution stone: checks that the target evolves with it and answers `evolveReady { into, item }`; nothing
    // is spent here — the stone is consumed by the confirmed `POST /creature/:id/evolve` (evolution is never automatic)
    if (effect.kind === 'evolutionStone') {
      if (body.target === null) throw new HttpError(409, 'needsTarget');
      if (body.qty !== 1) throw new HttpError(409, 'oneAtATime');
      const target = body.target;
      const r = await repos.db.transaction(async (tx) => {
        if ((await repos.inventory.qty(tx, id, body.item)) < 1) throw new HttpError(409, 'InsufficientItems');
        const c = toInstance(await own(tx, id, target));
        return { c, inventory: await repos.inventory.all(tx, id) };
      });
      const into = itemEvolutionTarget(content.species(r.c.speciesId).evolution, body.item);
      if (into === null) throw new HttpError(409, 'noEffect');
      return out(deps, ItemUseRes, { inventory: r.inventory, creaturesUpdated: [r.c], events: [{ t: 'evolveReady', into, item: body.item }] });
    }
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      // the balance check is the repo's: going negative throws InsufficientItems (409)
      await repos.inventory.add(tx, id, body.item, -body.qty);
      if (body.target === null) throw new HttpError(409, 'needsTarget');
      const rec = await own(tx, id, body.target);
      let c = toInstance(rec);
      const maxHp = (x: CreatureInstance): number => calcMaxHp(content.species(x.speciesId).baseHp, x.level);
      const events: { t: string; [k: string]: unknown }[] = [];
      const cure = (statuses: readonly StatusId[] | 'all'): void => {
        const list = statuses === 'all' ? c.status : statuses;
        let status = c.status;
        for (const s of list) status = removeStatus(status, s);
        c = { ...c, status };
      };
      for (let i = 0; i < body.qty; i++) {
        const before = c;
        switch (effect.kind) {
          case 'healHp':
            if (c.hp <= 0 || c.hp >= maxHp(c)) throw new HttpError(409, 'noEffect');
            c = { ...c, hp: effect.amount === 'full' ? maxHp(c) : Math.min(maxHp(c), c.hp + effect.amount) };
            break;
          case 'revive':
            if (c.hp > 0) throw new HttpError(409, 'noEffect');
            c = { ...c, hp: Math.max(1, Math.floor(maxHp(c) * effect.fraction)), status: [] };
            break;
          case 'cureStatus':
            if (majorStatus(c.status) === null && !c.status.includes('confuse')) throw new HttpError(409, 'noEffect');
            cure(effect.statuses);
            break;
          case 'fullRestore':
            if (c.hp <= 0) throw new HttpError(409, 'noEffect');
            c = { ...c, hp: maxHp(c), status: [] };
            break;
          case 'restorePp':
            c = { ...c, moves: c.moves.map((m) => ({ ...m, pp: effect.amount === 'full' ? m.ppMax : Math.min(m.ppMax, m.pp + effect.amount) })) };
            break;
          case 'rareCandy': {
            if (c.level >= 100) throw new HttpError(409, 'noEffect');
            const r = applyExp(c, expToLevel(c.level + 1) - c.exp, content);
            c = r.creature;
            for (const l of r.levelsGained) events.push({ t: 'levelUp', level: l });
            for (const m of r.learnable) events.push({ t: 'learnMove', move: m.move, level: m.level });
            if (r.evolveReady !== null) events.push({ t: 'evolveReady', into: r.evolveReady });
            break;
          }
          default:
            throw new HttpError(409, 'notUsableHere');
        }
        if (JSON.stringify(before) === JSON.stringify(c)) throw new HttpError(409, 'noEffect');
      }
      await repos.creatures.update(tx, c);
      events.unshift({ t: 'itemUsed', item: body.item, target: c.id, qty: body.qty });
      return { inventory: await repos.inventory.all(tx, id), creaturesUpdated: [c], events };
    });
    return out(deps, ItemUseRes, res);
  });

  /** Must currently be in a `healer: true` zone (presence); hp = maxHp, status = [], pp = ppMax; free. */
  app.post('/heal', bearer, async (req) => {
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    if (zone === null || !zone.healer) throw new HttpError(409, 'notAtHealer');
    const party = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const current = await repos.creatures.party(tx, id);
      const healedParty: CreatureInstance[] = [];
      for (const c of current) {
        const h = healed(content, toInstance(c));
        await repos.creatures.update(tx, h);
        healedParty.push(h);
      }
      return healedParty;
    });
    return out(deps, PartyRes, { party });
  });
}
