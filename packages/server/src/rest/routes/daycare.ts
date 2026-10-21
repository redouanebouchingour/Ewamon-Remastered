/**
 * Breeding (content daycare.ts): the Daycare in Mirevale and the trainer's eggs.
 *
 * - `GET /daycare` (anywhere): the pair left there, whether they can breed and what would hatch, the next egg's time
 *   and every egg (the Party screen reads the steps from here).
 * - `POST /daycare/leave` / `POST /daycare/take` (in the Daycare's zone): a party or box creature goes in (at most two;
 *   the party keeps one), or comes back (to the party while it has room, else the box). A pair that can breed starts
 *   the egg timer (`EGG_READY_MS`); taking one back stops it.
 * - `POST /daycare/collect` (in the Daycare's zone): the ready egg, carried while fewer than `EGG_CARRY_MAX` are,
 *   else into the box; the timer starts over.
 * - `POST /eggs/:id/move`: carry an egg (it counts steps) or put it in the box (it waits).
 *
 * Challenge runs (Nuzlocke / Hardcore): while a run is active the Daycare takes no creature and gives no egg (a run's
 * creatures are the first encounter of each route), and carried eggs count no steps (the zone room); taking a
 * creature back is always allowed. Every write publishes `ewa:eggs` so the room holding the player reloads its eggs.
 */
import { DAYCARE, EGG_CARRY_MAX, EGG_MAX, EGG_READY_MS, challengeActive, isFallen } from '@ewa/content';
import type { Tx } from '@ewa/persist';
import { CreatureIdReq, DaycareActionRes, DaycareRes, EggMoveReq, EggParams } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { canBreed, daycareView, layEgg } from '../../game/breeding';
import { refuseFallen } from '../../game/challenge';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** The room channel that tells the zone holding the player to reload its carried eggs. */
export const EGGS_TOPIC = 'ewa:eggs';

export function registerDaycareRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, content, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  async function view(tx: Tx, id: string, nowMs: number) {
    const pair = await repos.breeding.pair(tx, id);
    return daycareView(content, DAYCARE.zoneId, pair, await repos.breeding.eggAt(tx, id), await repos.breeding.eggs(tx, id), nowMs);
  }

  async function action(tx: Tx, id: string, nowMs: number) {
    return {
      daycare: await view(tx, id, nowMs),
      party: (await repos.creatures.party(tx, id)).map(toInstance),
      box: (await repos.creatures.box(tx, id, 0, 500)).map(toInstance),
    };
  }

  function atDaycare(id: string): void {
    if (presenceZone(deps, id)?.id !== DAYCARE.zoneId) throw new HttpError(409, 'notAtDaycare');
  }

  async function refuseChallenge(tx: Tx, id: string): Promise<void> {
    if (challengeActive(await repos.progress.flags(tx, id)) !== null) throw new HttpError(409, 'challenge');
  }

  app.get('/daycare', bearer, async (req) => {
    const now = clock();
    return out(deps, DaycareRes, await repos.db.transaction((tx) => view(tx, req.user.sub, now)));
  });

  app.post('/daycare/leave', bearer, async (req) => {
    const body = CreatureIdReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    atDaycare(id);
    const now = clock();
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      await refuseChallenge(tx, id);
      const rec = await repos.creatures.recordById(tx, body.id);
      if (rec === null || rec.ownerId !== id) throw new HttpError(404, 'NotFound');
      refuseFallen(rec);
      if (rec.slotKind !== 'party' && rec.slotKind !== 'box') throw new HttpError(409, 'InvalidSlot');
      if ((await repos.breeding.pair(tx, id)).length >= 2) throw new HttpError(409, 'daycareFull');
      await repos.creatures.moveToSlot(tx, body.id, 'daycare', 'nextBox');
      const pair = await repos.breeding.pair(tx, id);
      await repos.breeding.setEggAt(tx, id, canBreed(content, pair) ? new Date(now + EGG_READY_MS) : null);
      return action(tx, id, now);
    });
    return out(deps, DaycareActionRes, res);
  });

  app.post('/daycare/take', bearer, async (req) => {
    const body = CreatureIdReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    atDaycare(id);
    const now = clock();
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rec = await repos.creatures.recordById(tx, body.id);
      if (rec === null || rec.ownerId !== id) throw new HttpError(404, 'NotFound');
      if (rec.slotKind !== 'daycare') throw new HttpError(409, 'InvalidSlot');
      const used = new Set((await repos.creatures.byOwner(tx, id)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
      let free = -1;
      for (let i = 0; i < 6 && free === -1; i++) if (!used.has(i)) free = i;
      // a fallen creature never rejoins the party (none can be left here, so this is only a guard)
      if (free === -1 || isFallen(rec)) await repos.creatures.moveToSlot(tx, body.id, 'box', 'nextBox');
      else await repos.creatures.moveToSlot(tx, body.id, 'party', free);
      await repos.breeding.setEggAt(tx, id, null);
      return action(tx, id, now);
    });
    return out(deps, DaycareActionRes, res);
  });

  app.post('/daycare/collect', bearer, async (req) => {
    const id = req.user.sub;
    refuseInBattle(deps, id);
    atDaycare(id);
    const now = clock();
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      await refuseChallenge(tx, id);
      const pair = await repos.breeding.pair(tx, id);
      const at = await repos.breeding.eggAt(tx, id);
      if (!canBreed(content, pair) || at === null || at.getTime() > now) throw new HttpError(409, 'noEgg');
      const eggs = await repos.breeding.eggs(tx, id);
      if (eggs.length >= EGG_MAX) throw new HttpError(409, 'eggsFull');
      const carried = eggs.filter((e) => e.place === 'party').length;
      const egg = layEgg(content, id, [pair[0]!, pair[1]!], DAYCARE.zoneId, now, deps.worldSeed);
      await repos.breeding.insertEgg(tx, { ...egg, place: carried < EGG_CARRY_MAX ? 'party' : 'box' }, new Date(now));
      await repos.breeding.setEggAt(tx, id, new Date(now + EGG_READY_MS));
      return action(tx, id, now);
    });
    deps.bus.publish(EGGS_TOPIC, { playerId: id });
    return out(deps, DaycareActionRes, res);
  });

  app.post('/eggs/:id/move', bearer, async (req) => {
    const { id: eggId } = EggParams.parse(req.params);
    const body = EggMoveReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const now = clock();
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const eggs = await repos.breeding.eggs(tx, id);
      const egg = eggs.find((e) => e.id === eggId);
      if (egg === undefined) throw new HttpError(404, 'NotFound');
      if (body.place === 'party' && egg.place !== 'party' && eggs.filter((e) => e.place === 'party').length >= EGG_CARRY_MAX) throw new HttpError(409, 'eggsCarried');
      await repos.breeding.moveEgg(tx, id, eggId, body.place);
      return action(tx, id, now);
    });
    deps.bus.publish(EGGS_TOPIC, { playerId: id });
    return out(deps, DaycareActionRes, res);
  });
}
