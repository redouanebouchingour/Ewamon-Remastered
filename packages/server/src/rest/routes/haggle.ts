/**
 * Shop haggling (LLM feature 4, `game/haggle.ts`), behind the `NPC_TOOLS` gate of the other NPC routes.
 *
 * `POST /shop/haggle` { npcId, kind, percent }: the client's tool pass heard the keeper grant a discount
 * (`give_discount`) or raise its prices (`raise_prices`) and names the percent its words said. The keeper must be the
 * shopkeeper of the caller's zone (an interior NPC, resolved through content the way `/npc/act` does: 409
 * `npcNotHere` otherwise); the server caps the percent by how the keeper feels about the player and by the discounts
 * already won there, holds a second discount back for the cooldown (409 `haggleCooldown`), stores the deal, records a
 * deed for the NPC memory (a discount given is `giftReceived`, a markup `haggledRudely`) and leaves an audit row
 * (`shop.haggle`). The answer is the deal now in force, what this haggle applied and the keeper's new cap.
 *
 * `/shop/buy` and `/shop/sell` (rest/routes/catalog.ts) apply the deal of the zone's keeper; the client never sends a
 * price.
 */
import type { ZoneId } from '@ewa/content';
import { HaggleReq, HaggleRes } from '@ewa/protocol';
import type { HaggleDeal, HaggleKeeper, Standing } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { decideHaggle, haggleBook, zoneKeeper } from '../../game/haggle';
import { feelingOf, recordNpcDeed } from '../../game/npcMemory';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** The `NPC_TOOLS` gate as rest/routes/npc.ts reads it (unset: off in production). */
export function npcToolsOn(deps: RestDeps): boolean {
  return (deps.env.NPC_TOOLS ?? (deps.env.NODE_ENV === 'production' ? 'off' : 'on')) === 'on';
}

/** The haggle state the shop screen shows for the caller in `zoneId` (deal and keeper), or nothing when off. */
export async function shopHaggleState(deps: RestDeps, on: boolean, playerId: string, zoneId: string): Promise<{ deal?: HaggleDeal | null; keeper?: HaggleKeeper | null }> {
  if (!on) return {};
  const keeper = zoneKeeper(zoneId);
  if (keeper === null) return { deal: null, keeper: null };
  const now = deps.clock();
  const book = haggleBook(deps);
  const feeling: Standing = await deps.repos.db.transaction((tx) => feelingOf(deps.repos, tx, playerId, zoneId as ZoneId, keeper.id));
  return { deal: book.dealView(playerId, zoneId, now), keeper: book.keeperView(playerId, keeper, feeling, now) };
}

export function registerHaggleRoutes(app: FastifyInstance, deps: RestDeps, on: boolean): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const book = haggleBook(deps);

  app.post('/shop/haggle', bearer, async (req) => {
    const body = HaggleReq.parse(req.body);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    const keeper = zone === null || zone.shop === null ? null : zoneKeeper(zone.id);
    if (zone === null || keeper === null || keeper.id !== body.npcId) throw new HttpError(409, 'npcNotHere');
    const t = clock();
    const now = new Date(t);
    const res = await repos.db.transaction(async (tx) => {
      const feeling = await feelingOf(repos, tx, id, zone.id, keeper.id);
      const before = book.of(id, keeper.id);
      const d = decideHaggle(before, body.kind, body.percent, feeling, t);
      if (!d.ok) throw new HttpError(409, d.code, { readyAt: new Date(d.readyAt).toISOString() });
      if (body.kind === 'markup') await recordNpcDeed(repos, tx, id, keeper.id, zone.id, 'haggledRudely', now);
      else if (d.granted > 0) await recordNpcDeed(repos, tx, id, keeper.id, zone.id, 'giftReceived', now);
      await repos.audit.write(
        tx,
        { actorId: id, action: 'shop.haggle', subject: keeper.id, detail: { zone: zone.id, kind: body.kind, asked: body.percent, granted: d.granted, cap: d.cap, feeling, deal: d.next.deal } },
        now,
      );
      // a markup is remembered at once: the cap shown after it reads the new standing
      return { next: d.next, granted: d.granted, feeling: body.kind === 'markup' ? await feelingOf(repos, tx, id, zone.id, keeper.id) : feeling };
    });
    // the book moves only once the transaction committed
    book.set(id, keeper.id, res.next, t);
    return out(deps, HaggleRes, { deal: book.dealView(id, zone.id, t), granted: res.granted, keeper: book.keeperView(id, keeper, res.feeling, t) });
  });
}
