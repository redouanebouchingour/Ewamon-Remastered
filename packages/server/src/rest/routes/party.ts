/**
 * §4.7 rows: /party/*, /creature/:id/*, /item/use, /heal. All refused with 409 `inBattle` while the player
 * is projected in a live battle (§30.6.3). Every effect is computed with @ewa/core (applyExp, evolve,
 * calcMaxHp) — the client never sends a result, only an intent.
 */
import { applyExp, calcMaxHp, evolve, expToLevel, majorStatus, removeStatus } from '@ewa/core';
import type { ConsumableDef, CreatureInstance, ItemDef, StatusId } from '@ewa/core';
import type { CreatureRecord, Tx } from '@ewa/persist';
import {
  CreatureFlagsReq,
  CreatureIdReq,
  CreatureInstanceSchema,
  CreatureParams,
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
} from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { sanitizeChat } from '../../chat/filter';
import { healed } from '../../game/creatures';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
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

  /** 1..4 unique ids, each learnable at or below the creature's level; kept slots keep pp, new ones get ppMax. */
  app.post('/creature/:id/moves', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = MovesReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const c = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, cid);
      const sp = content.species(rec.speciesId);
      for (const m of body.moves) {
        if (!sp.learnableMoves.some((e) => e.move === m && e.level <= rec.level)) throw new HttpError(409, 'notLearnable', { move: m });
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
   */
  app.post('/creature/:id/setup', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = SetupReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
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
        await repos.inventory.add(tx, id, body.heldItem, -1);
      }
      if (rec.heldItem !== null && rec.heldItem !== body.heldItem) await repos.inventory.add(tx, id, rec.heldItem, 1);
      const next: CreatureInstance = { ...toInstance(rec), ability: body.ability, heldItem: body.heldItem };
      await repos.creatures.update(tx, next);
      return next;
    });
    return out(deps, CreatureInstanceSchema, c);
  });

  /** `into` must equal core's evolveReady at the current level and ability (split branch by ability). */
  app.post('/creature/:id/evolve', bearer, async (req) => {
    const { id: cid } = CreatureParams.parse(req.params);
    const body = EvolveReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const now = new Date(clock());
    const c = await repos.db.transaction(async (tx) => {
      const rec = await own(tx, id, cid);
      const ready = applyExp(toInstance(rec), 0, content).evolveReady;
      if (ready === null || ready !== body.into) throw new HttpError(409, 'notReady');
      const next = evolve(toInstance(rec), body.into, content);
      await repos.creatures.update(tx, next);
      await repos.progress.markSeen(tx, id, body.into, now);
      await repos.progress.markCaught(tx, id, body.into, next.variantKey, next.isAlpha, now);
      await repos.audit.write(tx, { actorId: id, action: 'creature.evolve', subject: cid, detail: { from: rec.speciesId, into: body.into } }, now);
      return next;
    });
    return out(deps, CreatureInstanceSchema, c);
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
   * Server-validated consumable effects out of battle. repel / lure / escapeRope (presence keys and room
   * teleports) are part 2 and answer 409 `notUsableHere`.
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
