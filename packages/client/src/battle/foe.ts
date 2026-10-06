/**
 * Phase B7 — who the player is fighting, for presentation only (the VS intro card, the foe actor, the result card's
 * concession line and the mid-battle banners). Resolved from the NPC side's `trainerId` over @ewa/content: a league
 * trainer (gym leader, Warden, Champion), else a zone trainer (route trainers and the story trainers a beat fights,
 * e.g. Sable), else a gym-hall trainer. Nothing here decides game truth.
 */
import { LEAGUE, TOWER, allZones, interiorTrainers } from '@ewa/content';
import type { LeagueTrainer } from '@ewa/content';
import type { BattleState, TypeName } from '@ewa/core';
import { species } from '../data/content';

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
let trainers: Map<string, TrainerRow> | null = null;

/** Every zone trainer and gym-hall trainer by id (built once, on first use). */
function trainerRows(): Map<string, TrainerRow> {
  if (trainers !== null) return trainers;
  const m = new Map<string, TrainerRow>();
  for (const z of allZones()) {
    for (const t of z.trainers) if (!m.has(t.id)) m.set(t.id, { name: t.name, look: t.look });
    for (const t of interiorTrainers(z.id)) if (!m.has(t.id)) m.set(t.id, { name: t.name, look: t.look });
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
