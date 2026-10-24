/**
 * NPC memory and town reputation (LLM feature 1): what an NPC remembers of a player, how the player stands with it and
 * with its zone, and the gossip the zone's other NPCs pass on. Pure rules here plus the reads and writes later features
 * share (`standingWithNpc`, `townStandingOf`, `recordNpcDeed`): haggling caps a discount by the standing, rumours read
 * the deeds.
 *
 * - A deed's delta is `NPC_DEED_DELTA`; a client write's sum is capped (`writeDelta`). A deed already recorded for that
 *   NPC within `NPC_DEED_COOLDOWN_MS` is not recorded again, and a positive one then adds nothing.
 * - A zone's reputation is the clamped sum of the standings of its NPCs that remember the player (`townScore`). NPCs
 *   are the zone's own and the residents of its interiors (`interiorNpcs`), both keyed by the zone the player is in.
 */
import { interiorNpcs, zone as zoneById } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { NpcMemory, Repos, Tx } from '@ewa/persist';
import { NPC_DEED_COOLDOWN_MS, NPC_DEED_DELTA, NPC_GOSSIP_MAX, feelingScore, shopkeeperName, standingOf, townScore, writeDelta } from '@ewa/protocol';
import type { NpcDeed, NpcMemoryView, Standing, TownStanding } from '@ewa/protocol';

type Zone = ReturnType<typeof zoneById>;

/** The NPC with `npcId` in `zone` (its own or an interior resident) and the name the gossip uses, else null. */
export function npcInZone(zone: Zone, npcId: string): { readonly id: string; readonly name: string } | null {
  const own = zone.npcs.find((n) => n.id === npcId);
  if (own !== undefined) return { id: own.id, name: own.name };
  const inside = interiorNpcs(zone.id as ZoneId).find((n) => n.id === npcId);
  if (inside === undefined) return null;
  // shop haggling: content calls every keeper "Shopkeeper"; the game calls each by its own name
  if (inside.role === 'shopkeeper') return { id: inside.id, name: `${shopkeeperName(inside.id)}, shopkeeper` };
  return { id: inside.id, name: inside.role.trim() === '' ? inside.name : `${inside.name}, ${inside.role.toLowerCase()}` };
}

/**
 * The deeds to record and the standing delta: repeats within the cooldown are not recorded and, when positive, not
 * counted; `capped` (a client write) caps the sum with `writeDelta`.
 */
export function applyDeeds(deeds: readonly NpcDeed[], recent: NpcMemory['deeds'], nowMs: number, capped: boolean): { readonly record: NpcDeed[]; readonly delta: number } {
  const uniq = [...new Set(deeds)];
  const fresh = (d: NpcDeed): boolean => !recent.some((r) => r.deed === d && nowMs - Date.parse(r.at) < NPC_DEED_COOLDOWN_MS);
  const record = uniq.filter(fresh);
  const counted = uniq.filter((d) => NPC_DEED_DELTA[d] < 0 || fresh(d));
  const delta = capped ? writeDelta(counted) : counted.reduce((a, d) => a + NPC_DEED_DELTA[d], 0);
  return { record, delta };
}

/** A zone's reputation for the player. */
export function townStandingFrom(zone: Zone, memories: readonly NpcMemory[]): TownStanding {
  const score = townScore(memories.map((m) => m.standing));
  return { zoneId: zone.id, name: zone.name, score, standing: standingOf(score), known: memories.length };
}

/** Notable deeds the player did to the zone's other NPCs (kind words left out), newest first, one per NPC and deed. */
export function gossipFrom(zone: Zone, npcId: string, memories: readonly NpcMemory[]): NpcMemoryView['gossip'] {
  const all = memories
    .filter((m) => m.npcId !== npcId)
    .flatMap((m) => {
      const who = npcInZone(zone, m.npcId);
      return who === null ? [] : m.deeds.map((d) => ({ npcId: m.npcId, npcName: who.name, deed: d.deed as NpcDeed, at: d.at }));
    })
    // kind words are not news: the town talks about the rest
    .filter((g) => g.deed in NPC_DEED_DELTA && g.deed !== 'kindWords')
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.npcId.localeCompare(b.npcId)));
  const seen = new Set<string>();
  const out: NpcMemoryView['gossip'] = [];
  for (const g of all) {
    const k = `${g.npcId}:${g.deed}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
    if (out.length >= NPC_GOSSIP_MAX) break;
  }
  return out;
}

/** What `npcId` remembers of the player, the zone's reputation and its gossip. */
export async function npcMemoryView(repos: Repos, tx: Tx, playerId: string, zone: Zone, npcId: string): Promise<NpcMemoryView> {
  const memories = await repos.npcMemory.inZone(tx, playerId, zone.id);
  const mine = memories.find((m) => m.npcId === npcId) ?? (await repos.npcMemory.of(tx, playerId, npcId));
  const town = townStandingFrom(zone, memories);
  return {
    npcId,
    known: mine !== undefined && mine !== null,
    summary: mine?.summary ?? '',
    standing: mine?.standing ?? 0,
    feeling: standingOf(feelingScore(mine?.standing ?? null, town.score)),
    deeds: (mine?.deeds ?? []).map((d) => ({ deed: d.deed as NpcDeed, at: d.at })),
    town,
    gossip: gossipFrom(zone, npcId, memories),
  };
}

/** A deed the server saw happen (`/npc/act`, a villager battle's end): recorded with its delta, uncapped. */
export async function recordNpcDeed(repos: Repos, tx: Tx, playerId: string, npcId: string, zoneId: string, deed: NpcDeed, now: Date): Promise<void> {
  const cur = await repos.npcMemory.of(tx, playerId, npcId);
  const { record, delta } = applyDeeds([deed], cur?.deeds ?? [], now.getTime(), false);
  await repos.npcMemory.remember(tx, playerId, npcId, { zoneId, deeds: record, delta }, now);
}

/** The player's standing with one NPC (0 when it does not know them). */
export async function standingWithNpc(repos: Repos, tx: Tx, playerId: string, npcId: string): Promise<number> {
  return (await repos.npcMemory.of(tx, playerId, npcId))?.standing ?? 0;
}

/** How an NPC feels about the player (`feelingScore` banded): its own standing, else half the town's. */
export async function feelingOf(repos: Repos, tx: Tx, playerId: string, zoneId: ZoneId, npcId: string): Promise<Standing> {
  const mine = await repos.npcMemory.of(tx, playerId, npcId);
  const town = await townStandingOf(repos, tx, playerId, zoneId);
  return standingOf(feelingScore(mine?.standing ?? null, town.score));
}

/** The player's reputation in a zone. */
export async function townStandingOf(repos: Repos, tx: Tx, playerId: string, zoneId: ZoneId): Promise<TownStanding> {
  return townStandingFrom(zoneById(zoneId), await repos.npcMemory.inZone(tx, playerId, zoneId));
}
