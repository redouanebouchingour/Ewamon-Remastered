/**
 * NPC talk (client `src/talk`): the local model talking as an NPC picks tools after each reply; the ones that
 * touch the save come here. The NPC must stand in the player's zone (a ZoneDef npc or an interior resident).
 *
 * - giveMoney / takeMoney: up to NPC_MONEY_MAX. Each NPC has a wallet per player (seeded 300–2 000 from the world seed
 *   and its id): giving draws from it (409 npcPurseEmpty when it is empty), taking adds to it; taking is capped by the
 *   player's money (409 playerBroke at 0).
 * - giveCreature: a creature from the zone's encounter table (any table's common slots in a zone without one) at a
 *   level of its slot, into the party (the box when full); once per NPC per NPC_GIFT_COOLDOWN_MS (409 npcNoCreature).
 * - takeCreature: the player's lowest-level unlocked party creature, released for good — never the last one in the
 *   party, never a locked one (409 npcCannotTake). Lock a creature to keep it safe.
 * - battle: the zone room holding the player opens a battle with the NPC (`NPC_BATTLE_TOPIC`, rooms/ZoneRoom.ts); the
 *   reply moves nothing, and a refusal there (no usable party) reaches the player as a room error.
 *
 * Wallets and gift cooldowns live in memory (a restart refills them). `NPC_TOOLS` (env) turns it off; unset, it is
 * off in production.
 */
import { interiorNpcs } from '@ewa/content';
import { createRng } from '@ewa/core';
import { NPC_MONEY_MAX, NpcActReq, NpcActRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { newCreature } from '../../game/creatures';
import { pickSlot, zoneSlots } from '../../game/villagers';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

export const NPC_GIFT_COOLDOWN_MS = 10 * 60_000;
const WALLET_MIN = 300;
const WALLET_MAX = 2000;
/** `{ playerId, npcId }`: the zone room holding the player opens the battle (rooms/ZoneRoom.ts) */
export const NPC_BATTLE_TOPIC = 'ewa:npcBattle';

export function registerNpcRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock, content } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const on = (deps.env.NPC_TOOLS ?? (deps.env.NODE_ENV === 'production' ? 'off' : 'on')) === 'on';
  /** `${playerId}:${npcId}` → the NPC's wallet for that player */
  const wallets = new Map<string, number>();
  /** `${playerId}:${npcId}` → when the NPC has a creature to give again */
  const giftAt = new Map<string, number>();
  const walletOf = (key: string, npcId: string): number => {
    const w = wallets.get(key);
    if (w !== undefined) return w;
    const seeded = WALLET_MIN + Math.floor((createRng(`${deps.worldSeed}:npc-wallet:${npcId}`).next() * (WALLET_MAX - WALLET_MIN)) / 10) * 10;
    wallets.set(key, seeded);
    return seeded;
  };

  app.post('/npc/act', bearer, async (req) => {
    const body = NpcActReq.parse(req.body);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    const npc = zone === null ? undefined : (zone.npcs.find((n) => n.id === body.npcId) ?? interiorNpcs(zone.id).find((n) => n.id === body.npcId));
    if (zone === null || npc === undefined) throw new HttpError(409, 'npcNotHere');
    const key = `${id}:${body.npcId}`;
    const t = clock();
    const now = new Date(t);
    const asked = body.amount ?? NPC_MONEY_MAX;

    if (body.action === 'battle') {
      const row = await repos.db.transaction((tx) => repos.players.byId(tx, id));
      deps.bus.publish(NPC_BATTLE_TOPIC, { playerId: id, npcId: body.npcId });
      return out(deps, NpcActRes, { money: row?.money ?? 0, amount: 0, wallet: walletOf(key, body.npcId), creaturesAdded: [], creaturesRemoved: [] });
    }

    const res = await repos.db.transaction(async (tx) => {
      const row = await repos.players.lock(tx, id);
      const audit = (detail: Record<string, unknown>) => repos.audit.write(tx, { actorId: id, action: `npc.${body.action}`, subject: body.npcId, detail: { ...detail, zone: zone.id } }, now);
      switch (body.action) {
        case 'giveMoney': {
          const wallet = walletOf(key, body.npcId);
          if (wallet <= 0) throw new HttpError(409, 'npcPurseEmpty');
          const amount = Math.min(asked, wallet);
          const money = await repos.players.addMoney(tx, id, amount);
          await audit({ amount });
          return { money, amount, wallet: wallet - amount, creaturesAdded: [], creaturesRemoved: [], commit: (): void => void wallets.set(key, wallet - amount) };
        }
        case 'takeMoney': {
          const amount = Math.min(asked, row.money);
          if (amount <= 0) throw new HttpError(409, 'playerBroke');
          const money = await repos.players.addMoney(tx, id, -amount);
          const wallet = walletOf(key, body.npcId) + amount;
          await audit({ amount });
          return { money, amount, wallet, creaturesAdded: [], creaturesRemoved: [], commit: (): void => void wallets.set(key, wallet) };
        }
        case 'giveCreature': {
          if ((giftAt.get(key) ?? 0) > t) throw new HttpError(409, 'npcNoCreature');
          const rng = createRng(`${deps.worldSeed}:npc-gift:${key}:${t}`);
          const slot = pickSlot(zoneSlots(zone.id), rng);
          const level = slot.levelMin + Math.floor(rng.next() * (slot.levelMax - slot.levelMin + 1));
          const c = newCreature(content, slot.species, level, { ownerId: id, moves: 'level' });
          const used = new Set((await repos.creatures.byOwner(tx, id)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
          let idx = 0;
          while (used.has(idx)) idx++;
          const added = await repos.creatures.insert(tx, c, used.size >= 6 ? { kind: 'box', index: 'nextBox' } : { kind: 'party', index: idx });
          await repos.progress.markCaught(tx, id, slot.species, 'normal', false, now, false);
          await audit({ species: slot.species, level });
          return { money: row.money, amount: 0, wallet: walletOf(key, body.npcId), creaturesAdded: [added], creaturesRemoved: [], commit: (): void => void giftAt.set(key, t + NPC_GIFT_COOLDOWN_MS) };
        }
        case 'takeCreature': {
          const party = await repos.creatures.party(tx, id);
          const pick = party.length <= 1 ? undefined : [...party].filter((c) => !c.locked).sort((a, b) => a.level - b.level)[0];
          if (pick === undefined) throw new HttpError(409, 'npcCannotTake');
          await repos.creatures.release(tx, pick.id, id);
          await audit({ creature: pick.id, species: pick.speciesId, level: pick.level });
          return { money: row.money, amount: 0, wallet: walletOf(key, body.npcId), creaturesAdded: [], creaturesRemoved: [pick.id], commit: (): void => undefined };
        }
        case 'battle':
          throw new HttpError(500, 'internal'); // answered above
      }
    });
    // in-memory state moves only once the transaction committed
    res.commit();
    const { commit: _commit, ...reply } = res;
    return out(deps, NpcActRes, reply);
  });
}
