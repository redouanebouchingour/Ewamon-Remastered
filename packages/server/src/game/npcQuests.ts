/**
 * NPC side quests (LLM feature 2): a villager asks the traveller for a favour. The server decides everything that is
 * game truth here; the local model only words the request in character and decides whether the villager asks
 * (client `talk/npcQuest.ts`).
 *
 * - The objective (`planNpcQuest`) is drawn deterministically from content and the world seed (`createRng` over the
 *   seed, the player, the NPC and how many quests that NPC has given them), among what the player can do now: the
 *   NPC's own zone and the zones linked to it that the player's badges open. Five kinds: catch a species that lives
 *   there (a common or uncommon land slot that shows day and night), beat 2..4 wild creatures in one of those zones,
 *   show a creature of a type that lives there at that slot's top level, bring 1..3 of a cheap item a shop there
 *   sells, or go to a linked zone. Never a story gate, a story item or a flag: progress lives in its own table.
 * - Rewards scale with the level of what is asked (or the item's price) and are capped (`NPC_QUEST_MONEY_MAX`, one
 *   item from `NPC_QUEST_REWARD_ITEMS`, at most two of it).
 * - Progress comes from real events (`advanceNpcQuests`, called by `advanceQuests`): a catch, a wild win in the zone,
 *   a crossing into the zone. A creature to show and items to bring are checked when the quest is handed in.
 */
import { CONSUMABLES, ORBS, SPECIES, encounterTableFor, zone as zoneById } from '@ewa/content';
import type { BadgeId, EncounterSlot, ZoneDef, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { NpcQuest, Repos, Tx } from '@ewa/persist';
import {
  NPC_QUEST_COOLDOWN_MS,
  NPC_QUEST_DECLINE_COOLDOWN_MS,
  NPC_QUEST_DELIVER_ITEMS,
  NPC_QUEST_MIN_STANDING,
  NPC_QUEST_MONEY_MAX,
  NPC_QUEST_OPEN_MAX,
  NPC_QUEST_REWARD_ITEMS,
  npcQuestKey,
} from '@ewa/protocol';
import type { CreatureInstance } from '@ewa/core';
import type { NpcQuestObjective, NpcQuestPlan, NpcQuestReward, NpcQuestState, NpcQuestView, QuestProgressEntry } from '@ewa/protocol';
import type { QuestEvent } from './quests';

/** The stored objective and reward as the protocol types (the server wrote them from `planNpcQuest`). */
export function objectiveOf(q: Pick<NpcQuest, 'objective'>): NpcQuestObjective {
  return q.objective as unknown as NpcQuestObjective;
}
export function rewardOf(q: Pick<NpcQuest, 'reward'>): NpcQuestReward {
  return q.reward as unknown as NpcQuestReward;
}

export interface NpcQuestInput {
  readonly worldSeed: string;
  readonly playerId: string;
  readonly npcId: string;
  /** the zone the NPC stands in */
  readonly zoneId: ZoneId;
  /** how many favours this NPC has offered the player before (each draws a new one) */
  readonly seq: number;
  readonly badges: readonly BadgeId[];
}

/** The NPC's zone, then the zones linked to it that the player's badges open. */
export function reachableZones(zoneId: ZoneId, badges: readonly BadgeId[]): ZoneDef[] {
  const home = zoneById(zoneId);
  const open = (z: ZoneDef): boolean => z.gate === null || badges.includes(z.gate);
  return [home, ...Object.values(home.links).map((id) => zoneById(id!)).filter(open)];
}

/** Slots a favour may ask about: land, common or uncommon, out day and night (else any land slot below rare). */
export function questSlots(zoneId: ZoneId): readonly EncounterSlot[] {
  const land = encounterTableFor(zoneId)?.slots.filter((s) => (s.medium ?? 'land') === 'land') ?? [];
  const easy = land.filter((s) => (s.tier === 'common' || s.tier === 'uncommon') && s.timeOfDay === 'any');
  return easy.length > 0 ? easy : land.filter((s) => s.tier === 'common' || s.tier === 'uncommon');
}

const PRICE: ReadonlyMap<string, number> = new Map([...CONSUMABLES, ...ORBS].map((i) => [i.id, i.price ?? 0]));

/** money rounded to tens, at least 50, at most the cap */
function money(n: number): number {
  return Math.max(50, Math.min(NPC_QUEST_MONEY_MAX, Math.round(n / 10) * 10));
}

/**
 * The favour an NPC asks (deterministic: the same inputs give the same favour). Null when nothing fits (no zone
 * around has anything to ask about; never happens in today's content, see the test).
 */
export function planNpcQuest(input: NpcQuestInput): NpcQuestPlan | null {
  const rng = createRng(`${input.worldSeed}:npc-quest:${input.playerId}:${input.npcId}:${input.seq}`);
  const zones = reachableZones(input.zoneId, input.badges);
  const wild = zones.flatMap((z) => questSlots(z.id).map((slot) => ({ zone: z, slot })));
  const shops = zones.flatMap((z) => (z.shop ?? []).filter((i): i is (typeof NPC_QUEST_DELIVER_ITEMS)[number] => (NPC_QUEST_DELIVER_ITEMS as readonly string[]).includes(i) && (PRICE.get(i) ?? 0) > 0).map((item) => ({ zone: z, item })));
  const away = zones.slice(1);
  const kinds = [...(wild.length > 0 ? (['catch', 'defeat', 'show'] as const) : []), ...(shops.length > 0 ? (['deliver'] as const) : []), ...(away.length > 0 ? (['visit'] as const) : [])];
  if (kinds.length === 0) return null;
  const kind = kinds[rng.int(kinds.length)]!;
  let objective: NpcQuestObjective;
  let pay: number;
  let target = 1;
  switch (kind) {
    case 'catch': {
      const { zone, slot } = wild[rng.int(wild.length)]!;
      objective = { kind, species: slot.species, zoneId: zone.id };
      pay = 120 + 12 * slot.levelMax;
      break;
    }
    case 'defeat': {
      const zone = [...new Set(wild.map((w) => w.zone))][rng.int(new Set(wild.map((w) => w.zone)).size)]!;
      const count = 2 + rng.int(3);
      const top = Math.max(...questSlots(zone.id).map((s) => s.levelMax));
      objective = { kind, zoneId: zone.id, count };
      pay = count * (40 + 4 * top);
      target = count;
      break;
    }
    case 'show': {
      const { zone, slot } = wild[rng.int(wild.length)]!;
      const sp = SPECIES.find((s) => s.id === slot.species)!;
      objective = { kind, type: sp.types[0], level: slot.levelMax, zoneId: zone.id };
      pay = 100 + 10 * slot.levelMax;
      break;
    }
    case 'deliver': {
      const { zone, item } = shops[rng.int(shops.length)]!;
      const price = PRICE.get(item)!;
      const qty = 1 + rng.int(price <= 200 ? 3 : 2);
      objective = { kind, item, qty, zoneId: zone.id };
      pay = price * qty + 80;
      break;
    }
    case 'visit': {
      const zone = away[rng.int(away.length)]!;
      const slots = questSlots(zone.id);
      objective = { kind, zoneId: zone.id };
      pay = 100 + 5 * (slots.length > 0 ? Math.max(...slots.map((s) => s.levelMax)) : 5);
      break;
    }
  }
  // half the favours pay an item too (not a delivery: that one pays the items back in money)
  const withItem = kind !== 'deliver' && rng.next() < 0.5;
  const item: NpcQuestReward['item'] = withItem ? { id: NPC_QUEST_REWARD_ITEMS[rng.int(NPC_QUEST_REWARD_ITEMS.length)]!, qty: pay >= 400 ? 2 : 1 } : null;
  return { objective, reward: { money: money(pay), item }, target };
}

/** Why an NPC asks nothing now (null: it may ask). `history` is that NPC's favours for the player, newest first. */
export function whyNoQuest(p: { readonly open: readonly NpcQuest[]; readonly history: readonly NpcQuest[]; readonly standing: number; readonly nowMs: number }): NpcQuestState['why'] {
  if (p.history.some((q) => q.status === 'offered' || q.status === 'active')) return 'open';
  if (p.open.length >= NPC_QUEST_OPEN_MAX) return 'tooMany';
  if (p.standing < NPC_QUEST_MIN_STANDING) return 'standing';
  const last = p.history.find((q) => q.closedAt !== null);
  if (last !== undefined && last.closedAt !== null) {
    const wait = last.status === 'claimed' ? NPC_QUEST_COOLDOWN_MS : NPC_QUEST_DECLINE_COOLDOWN_MS;
    if (p.nowMs - last.closedAt.getTime() < wait) return 'cooldown';
  }
  return null;
}

/** Party creatures of `type` at `level` or more. */
export function showable(party: readonly CreatureInstance[], type: string, level: number): CreatureInstance[] {
  return party.filter((c) => c.level >= level && (SPECIES.find((s) => s.id === c.speciesId)?.types as readonly string[] | undefined)?.includes(type) === true);
}

/** An active favour can be handed in: its count is reached, or the creature / the items are there now. */
export function isReady(q: NpcQuest, party: readonly CreatureInstance[], items: Readonly<Record<string, number>>): boolean {
  if (q.status !== 'active') return false;
  const o = objectiveOf(q);
  if (o.kind === 'show') return showable(party, o.type, o.level).length > 0;
  if (o.kind === 'deliver') return (items[o.item] ?? 0) >= o.qty;
  return q.progress >= q.target;
}

export function questView(q: NpcQuest, npcName: string, ready: boolean): NpcQuestView {
  return {
    id: q.id,
    npcId: q.npcId,
    npcName,
    zoneId: q.zoneId as ZoneId,
    status: q.status,
    objective: objectiveOf(q),
    reward: rewardOf(q),
    target: q.target,
    progress: Math.min(q.progress, q.target),
    ready,
    offeredAt: q.createdAt.toISOString(),
    closedAt: q.closedAt === null ? null : q.closedAt.toISOString(),
  };
}

/** How many times an event advances a favour's objective. */
export function hitsOf(o: NpcQuestObjective, events: readonly QuestEvent[]): number {
  let n = 0;
  for (const e of events) {
    if (o.kind === 'catch' && e.kind === 'catch' && e.species === o.species) n++;
    else if (o.kind === 'defeat' && e.kind === 'win' && e.format === 'wild' && e.zoneId === o.zoneId) n++;
    else if (o.kind === 'visit' && e.kind === 'reachZone' && e.zoneId === o.zoneId) n++;
  }
  return n;
}

/**
 * The favours a batch of events advances (inside the caller's transaction, from `advanceQuests`): their new counts as
 * `questProgress` entries (`npc:<id>` / `main`), so the client hears of a finished one like any quest.
 */
export async function advanceNpcQuests(tx: Tx, repos: Pick<Repos, 'npcQuests'>, playerId: string, events: readonly QuestEvent[]): Promise<QuestProgressEntry[]> {
  if (!events.some((e) => e.kind === 'catch' || (e.kind === 'win' && e.format === 'wild') || e.kind === 'reachZone')) return [];
  const out: QuestProgressEntry[] = [];
  for (const q of await repos.npcQuests.open(tx, playerId)) {
    if (q.status !== 'active' || q.progress >= q.target) continue;
    const hits = hitsOf(objectiveOf(q), events);
    if (hits === 0) continue;
    const progress = Math.min(q.target, q.progress + hits);
    await repos.npcQuests.setProgress(tx, q.id, progress);
    out.push({ questId: npcQuestKey(q.id), objectiveId: 'main', count: progress, done: progress >= q.target });
  }
  return out;
}
