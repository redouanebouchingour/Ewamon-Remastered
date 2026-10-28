/**
 * Phase B7 — who the player is fighting, for presentation only (the VS intro card, the foe actor, the result card's
 * concession line and the mid-battle banners). Resolved from the NPC side's `trainerId` over @ewa/content: a league
 * trainer (gym leader, Warden, Champion), else a zone trainer (route trainers and the story trainers a beat fights,
 * e.g. Sable), else a gym-hall trainer. Nothing here decides game truth.
 */
import { ARENA_DAILY, ARENA_TRAINING, LEAGUE, TOWER, allZones, campGuardOwner, foosballTrainers, ghostOwner, interiorNpcs, interiorTrainers, rivalNameOf } from '@ewa/content';
import { villagerNpcId } from '@ewa/protocol';
import type { LeagueTrainer } from '@ewa/content';
import type { BattleState, TypeName } from '@ewa/core';
import { species } from '../data/content';
import { rivalViewFor } from '../state/rival';

/** The rival's look when its view is not in hand (a reload mid battle): a young trainer's. */
export const RIVAL_FALLBACK_LOOK = 'casual2_male';

export interface FoeIdentity {
  /** the battle side's `trainerId` (a content id) */
  readonly id: string;
  readonly name: string;
  /** league trainers only ("Grove-Keeper of Mirevale") */
  readonly title: string | null;
  /** the league trainer's type, else the lead creature's primary type, else null */
  readonly type: TypeName | null;
  /** the render look id (TrainerDef.look / LeagueTrainer.look), null when unknown */
  readonly look: string | null;
  readonly league: LeagueTrainer | null;
}

interface TrainerRow { readonly name: string; readonly look: string }

/** Arena training: the partner's look per difficulty (render looks the player bodies use). */
const TRAINING_LOOKS: Readonly<Record<keyof typeof ARENA_TRAINING, string>> = { easy: 'casual3_male', normal: 'casual_female', hard: 'suit_male' };
let trainers: Map<string, TrainerRow> | null = null;
let villagers: Map<string, TrainerRow> | null = null;

/** Every zone and interior NPC by id, for a villager's battle (NPC talk; built once, on first use). */
function villagerRows(): Map<string, TrainerRow> {
  if (villagers !== null) return villagers;
  const m = new Map<string, TrainerRow>();
  for (const z of allZones()) for (const n of [...z.npcs, ...interiorNpcs(z.id)]) if (!m.has(n.id)) m.set(n.id, { name: n.name, look: n.look });
  villagers = m;
  return m;
}

/** Every zone trainer, gym-hall trainer and foosball-club member by id (built once, on first use). */
function trainerRows(): Map<string, TrainerRow> {
  if (trainers !== null) return trainers;
  const m = new Map<string, TrainerRow>();
  for (const z of allZones()) {
    for (const t of z.trainers) if (!m.has(t.id)) m.set(t.id, { name: t.name, look: t.look });
    for (const t of interiorTrainers(z.id)) if (!m.has(t.id)) m.set(t.id, { name: t.name, look: t.look });
    for (const t of foosballTrainers(z.id)) if (!m.has(t.id)) m.set(t.id, { name: t.name, look: t.look });
  }
  trainers = m;
  return m;
}

export function leagueById(id: string | null): LeagueTrainer | null {
  if (id === null) return null;
  return LEAGUE.find((l) => l.id === id) ?? null;
}

/** The content identity of an NPC trainer id; an unknown id keeps a readable name and no look. */
export function foeIdentity(trainerId: string, leadSpecies: string | null = null): FoeIdentity {
  const lead = leadSpecies === null ? null : (species(leadSpecies)?.types[0] ?? null);
  const lt = leagueById(trainerId);
  if (lt !== null) return { id: trainerId, name: lt.name, title: lt.title, type: lt.type, look: lt.look, league: lt };
  // Phase D14: the battle tower's generated opponent
  if (trainerId === TOWER.trainerId) return { id: trainerId, name: TOWER.trainerName, title: null, type: lead, look: null, league: null };
  // arena PvP: the AI training partner (a stand-in look per difficulty; content gives the name)
  for (const [difficulty, t] of Object.entries(ARENA_TRAINING) as [keyof typeof ARENA_TRAINING, (typeof ARENA_TRAINING)[keyof typeof ARENA_TRAINING]][]) {
    if (t.trainerId === trainerId) return { id: trainerId, name: t.name, title: 'Arena training', type: lead, look: TRAINING_LOOKS[difficulty], league: null };
  }
  // the daily challenge's AI side
  if (trainerId === ARENA_DAILY.trainerId) return { id: trainerId, name: ARENA_DAILY.name, title: 'Daily challenge', type: lead, look: 'suit_male', league: null };
  // ghost trainers: another trainer's party, left behind when they went offline
  const owner = ghostOwner(trainerId);
  if (owner !== null) return { id: trainerId, name: `${owner}'s ghost`, title: 'Ghost trainer', type: lead, look: null, league: null };
  // NPC talk: a villager who took up the player's challenge
  const npcId = villagerNpcId(trainerId);
  const villager = npcId === null ? undefined : villagerRows().get(npcId);
  if (villager !== undefined) return { id: trainerId, name: villager.name, title: 'Villager', type: lead, look: villager.look, league: null };
  // camp bases: a camp's guard, the owner's party fighting while they are away
  const holder = campGuardOwner(trainerId);
  if (holder !== null) return { id: trainerId, name: `${holder}'s guard`, title: 'Camp guard', type: lead, look: null, league: null };
  // a recurring rival: its name rides the id, its look the view the server sent on the route
  const rival = rivalNameOf(trainerId);
  if (rival !== null) return { id: trainerId, name: rival, title: 'Rival', type: lead, look: rivalViewFor(trainerId)?.look ?? RIVAL_FALLBACK_LOOK, league: null };
  const row = trainerRows().get(trainerId);
  if (row !== undefined) return { id: trainerId, name: row.name, title: null, type: lead, look: row.look, league: null };
  const tail = trainerId.slice(trainerId.lastIndexOf('.') + 1).replace(/_/g, ' ');
  return { id: trainerId, name: tail.length === 0 ? 'Trainer' : tail[0]!.toUpperCase() + tail.slice(1), title: null, type: lead, look: null, league: null };
}

/** The other side's identity when it is an NPC trainer (trainer / league formats), else null (wild, pvp, raid). */
export function foeOfState(state: BattleState, seat: 0 | 1): FoeIdentity | null {
  const other = state.sides[seat === 0 ? 1 : 0];
  if (other.kind !== 'npc' || other.trainerId === null) return null;
  return foeIdentity(other.trainerId, other.party[other.active]?.creature.speciesId ?? null);
}

/**
 * The line a beaten league trainer concedes with, for the result card: a gym leader's `post[1]` (the "recollection"
 * line, story-bible §4.4 — content's league.ts says so); the Wardens and the Champion concede in `post[0]` (their
 * `post[1]` already sends the player on: "Aurelia keeps the count…", "Lean in…").
 */
export function concessionLine(lt: LeagueTrainer | null): string | null {
  if (lt === null) return null;
  const line = lt.stage === 'gym' ? lt.post[1] : lt.post[0];
  return line ?? lt.post[0] ?? null;
}
