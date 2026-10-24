/**
 * "Why did I lose?" (LLM feature 5): the facts of a lost battle, read off its core events. Pure: the battle's starting
 * state, every event the timelines played (in order), the player's seat and save; no store, no clock. Who hit whom with
 * what and how effective it was, the knockouts, the level gap and the types that would have hit the other side hard,
 * with the player's own creatures of those types (box first) or the nearest wild ones. talk/professor.ts words it as a
 * coach; the facts alone are the fallback.
 *
 * HP and names come from the starting state (`side`, `slot` refs index its parties), so a creature that only came out
 * later is still known; the other side's creatures count only once they were on the field (no spoilers of a bench the
 * player never saw).
 */
import type { BattleEvent, BattleState, Ref, TypeName } from '@ewa/core';
import { listText, findTypeFacts, superEffectiveOn } from '../talk/professorFacts';
import type { ProfSave } from '../talk/professorFacts';
import { SPECIES } from '@ewa/content';

export interface BattleLog {
  readonly battleId: string;
  readonly seat: 0 | 1;
  readonly start: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface LossReport {
  /** short true sentences, the most telling first */
  readonly facts: readonly string[];
  /** the types to bring next time */
  readonly bring: readonly TypeName[];
  /** species to show for them: the player's own of those types, else wild ones nearby */
  readonly bringSpecies: readonly string[];
  /** the other side's creatures that took part */
  readonly foes: readonly string[];
}

const speciesById = new Map(SPECIES.map((sp) => [sp.id, sp]));
const key = (r: Ref): string => `${r.side}:${r.slot}`;

/** the facts shown without the model (and their order) */
export const FALLBACK_LINES = 3;

/** The report of a battle the player lost, or null when the log holds nothing to say (no hit landed). */
export function lossReport(log: BattleLog, save: ProfSave): LossReport | null {
  const own = log.seat;
  const other = (own === 0 ? 1 : 0) as 0 | 1;
  const wild = log.start.sides[other].kind === 'wild';
  const creature = (r: Ref) => log.start.sides[r.side]?.party[r.slot]?.creature;
  const nameOf = (r: Ref): string => {
    const c = creature(r);
    if (c === undefined) return 'It';
    return c.nickname ?? speciesById.get(c.speciesId)?.name ?? c.speciesId;
  };
  const typesOf = (r: Ref): readonly TypeName[] => speciesById.get(creature(r)?.speciesId ?? '')?.types ?? [];
  // "the opponent's", not "their": told "Their Caldermole's Earthquake did the most damage", the model coaching "you"
  // wrote "Your Caldermole's Earthquake" in 8 of 8 replies (see talk/professor.ts)
  const theirs = (r: Ref): string => (wild ? `the wild ${nameOf(r)}` : `the opponent's ${nameOf(r)}`);
  const Theirs = (r: Ref): string => (wild ? `The wild ${nameOf(r)}` : `The opponent's ${nameOf(r)}`);

  const seen = new Map<string, Ref>();
  const used = new Map<string, Ref>();
  for (const side of [0, 1] as const) {
    const s = log.start.sides[side];
    const actives = s.actives ?? [s.active];
    for (const slot of actives) (side === own ? used : seen).set(`${side}:${slot}`, { side, slot });
  }

  /** the other side's damage to the player's creatures, per attacker and move */
  const dealt = new Map<string, { by: Ref; move: string; amount: number; best: number; targets: Set<string> }>();
  let superTaken = 0;
  let superGiven = 0;
  const resisted = new Map<string, { by: Ref; move: string; target: Ref; mult: number; n: number }>();
  let theirFaints = 0;
  let ownFaints = 0;
  let hits = 0;
  for (const e of log.events) {
    switch (e.t) {
      case 'switchIn':
        (e.who.side === own ? used : seen).set(key(e.who), e.who);
        break;
      case 'damage': {
        if (e.cause !== 'move' || e.source === null || e.move === null || e.source.side === e.target.side) break;
        hits++;
        if (e.source.side === other) {
          seen.set(key(e.source), e.source);
          const k = `${key(e.source)}:${e.move}`;
          const cur = dealt.get(k) ?? { by: e.source, move: e.move, amount: 0, best: 0, targets: new Set<string>() };
          cur.amount += e.amount;
          cur.best = Math.max(cur.best, e.effectiveness);
          if (e.effectiveness >= 2) cur.targets.add(nameOf(e.target));
          dealt.set(k, cur);
          if (e.effectiveness >= 2) superTaken++;
        } else {
          if (e.effectiveness >= 2) superGiven++;
          if (e.effectiveness < 1) {
            const k = `${key(e.source)}:${e.move}:${key(e.target)}`;
            const cur = resisted.get(k) ?? { by: e.source, move: e.move, target: e.target, mult: e.effectiveness, n: 0 };
            cur.n++;
            resisted.set(k, cur);
          }
        }
        break;
      }
      case 'moveFailed':
        if (e.reason === 'immune' && e.who.side === own && e.move !== null) {
          const k = `${key(e.who)}:${e.move}:immune`;
          const cur = resisted.get(k) ?? { by: e.who, move: e.move, target: e.target ?? { side: other, slot: log.start.sides[other].active }, mult: 0, n: 0 };
          cur.n++;
          resisted.set(k, cur);
        }
        break;
      case 'faint':
        if (e.who.side === own) ownFaints++;
        else theirFaints++;
        break;
      default:
        break;
    }
  }
  if (hits === 0) return null;

  const facts: string[] = [];
  // the move that hurt most
  const top = [...dealt.values()].sort((a, b) => b.amount - a.amount)[0];
  if (top !== undefined) {
    const se = top.best >= 2 && top.targets.size > 0 ? `, super effective on your ${listText([...top.targets].slice(0, 2))}` : '';
    facts.push(`${Theirs(top.by)} hurt you most, with ${top.move}: ${top.amount} HP in all${se}.`);
  }
  if (superTaken > 0 || superGiven > 0) facts.push(`You took ${superTaken} super-effective ${superTaken === 1 ? 'hit' : 'hits'} and landed ${superGiven}.`);
  const res = [...resisted.values()].sort((a, b) => a.mult - b.mult || b.n - a.n)[0];
  if (res !== undefined) {
    const how = res.mult === 0 ? 'had no effect on' : 'was not very effective on';
    facts.push(`Your ${nameOf(res.by)}'s ${res.move} ${how} ${theirs(res.target)}${res.n > 1 ? ` (${res.n} times)` : ''}.`);
  }
  // levels: the creatures that fought
  const lv = (refs: Iterable<Ref>): number[] => [...refs].map((r) => creature(r)?.level ?? 0).filter((l) => l > 0);
  const theirLv = lv(seen.values());
  const ownLv = lv(used.values());
  if (theirLv.length > 0 && ownLv.length > 0) {
    const t = Math.max(...theirLv);
    const o = Math.max(...ownLv);
    if (t - o >= 3) facts.push(`Their strongest was level ${t}; yours was level ${o}. Train about ${t - o} more levels.`);
    else if (o - t >= 3) facts.push(`Your level was higher (${o} against ${t}): the types decided it.`);
  }
  const foeCount = seen.size;
  if (!wild && foeCount > 0) facts.push(`You knocked out ${theirFaints} of the ${foeCount} they sent out${ownFaints > 0 ? `, and lost ${ownFaints}` : ''}.`);

  // what to bring: the attacking types that hit most of the creatures they used
  const votes = new Map<TypeName, number>();
  const foeSpecies: string[] = [];
  for (const r of seen.values()) {
    const c = creature(r);
    if (c !== undefined && !foeSpecies.includes(c.speciesId)) foeSpecies.push(c.speciesId);
    for (const t of superEffectiveOn(typesOf(r))) votes.set(t, (votes.get(t) ?? 0) + 1);
  }
  const bring = [...votes].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
  let bringSpecies: string[] = [];
  if (bring.length > 0) {
    const mine = [...save.box, ...save.party].filter((m) => (speciesById.get(m.speciesId)?.types ?? []).some((t) => bring.includes(t))).sort((a, b) => b.level - a.level);
    if (mine.length > 0) {
      const where = save.box.includes(mine[0]!) ? 'in your box' : 'in your party';
      facts.push(`Next time bring ${listText(bring)} moves: ${mine[0]!.name} (level ${mine[0]!.level}) ${where} has the type.`);
      bringSpecies = mine.slice(0, 3).map((m) => m.speciesId);
    } else {
      const wildSheet = findTypeFacts(bring[0]!, save);
      facts.push(`Next time bring ${listText(bring)} moves.${wildSheet.species.length > 0 ? ` ${wildSheet.facts[0]!}` : ''}`);
      bringSpecies = [...wildSheet.species].slice(0, 2);
    }
  }
  return { facts, bring, bringSpecies, foes: foeSpecies.slice(0, 6) };
}

/** The lines shown without the model: the most telling three (the damage, the levels or the knockouts, the advice). */
export function fallbackLines(r: LossReport): string[] {
  if (r.facts.length <= FALLBACK_LINES) return [...r.facts];
  const advice = r.facts[r.facts.length - 1]!;
  return [...r.facts.slice(0, FALLBACK_LINES - 1), advice];
}
