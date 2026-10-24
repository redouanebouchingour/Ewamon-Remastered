/**
 * The battle commentator's eyes (LLM feature 3): one timeline's core `BattleEvent[]` → the moments worth a line (a
 * crit, a super-effective hit, a knockout, a comeback from very low HP, a status landing, a Majin / Tenjin transform,
 * a side's last creature coming out, a catch or a break-out, the win or the loss), each with who it is about. Pure:
 * the events, the state the timeline starts from and two lookups; no store, no clock. Presentation only: nothing here
 * feeds back into the battle.
 *
 * HP is tracked through the events from the starting state (`damage.hpAfter` / `heal.hpAfter`), so a comeback (the
 * attacker at or under COMEBACK_FRAC of its max HP lands the knockout) and a last creature (every other party member
 * at 0) are read the way the timeline shows them.
 */
import type { BandKind, BattleEvent, BattleState, Ref, StatusId } from '@ewa/core';

export type MomentKind = 'opening' | 'crit' | 'super' | 'knockout' | 'comeback' | 'status' | 'transform' | 'lastOne' | 'catch' | 'escape' | 'win' | 'loss';

/** whose moment it is: the viewer's side or the other one */
export type MomentSide = 'own' | 'foe';

export interface Moment {
  readonly kind: MomentKind;
  /** the side of the creature the moment is about (the attacker of a hit, the one that fainted, the one sent out) */
  readonly side: MomentSide;
  /** that creature's plain name (nickname or species name) */
  readonly name: string;
  /** the other creature in it (the one hit, the one knocked out), else null */
  readonly other: string | null;
  /** `status`: the status that landed */
  readonly status?: StatusId;
  /** `transform`: the band */
  readonly band?: BandKind;
}

/** a comeback: the attacker landed the knockout at or under this fraction of its max HP */
export const COMEBACK_FRAC = 0.2;

/** How much a moment matters; the commentator calls the highest of a timeline. */
export const MOMENT_PRIORITY: Readonly<Record<MomentKind, number>> = {
  win: 100,
  loss: 100,
  catch: 95,
  transform: 85,
  comeback: 80,
  lastOne: 70,
  opening: 60,
  knockout: 55,
  escape: 45,
  crit: 40,
  super: 35,
  status: 25,
};

/** The moments the commentator always calls (the throttle never holds them back). */
export const MAJOR_MOMENTS: ReadonlySet<MomentKind> = new Set<MomentKind>(['opening', 'win', 'loss', 'catch', 'transform', 'comeback', 'lastOne']);

export interface MomentLookups {
  /** the viewer's seat */
  readonly seat: 0 | 1;
  /** a battler's plain name */
  readonly nameOf: (r: Ref) => string;
  /** the band behind a battler's form change (bond.ts), null for a wild or raid form */
  readonly bandOf: (r: Ref) => BandKind | null;
}

const key = (r: Ref): string => `${r.side}:${r.slot}`;

/** The moments of one timeline's events, in the order they happen. */
export function momentsOf(events: readonly BattleEvent[], from: BattleState, look: MomentLookups): Moment[] {
  const hp = new Map<string, number>();
  const max = new Map<string, number>();
  for (const side of [0, 1] as const) {
    from.sides[side].party.forEach((b, slot) => {
      hp.set(`${side}:${slot}`, b.creature.hp);
      max.set(`${side}:${slot}`, b.maxHp);
    });
  }
  const sideOf = (r: Ref): MomentSide => (r.side === look.seat ? 'own' : 'foe');
  /** the last move hit on each battler: who dealt it and the attacker's HP then (a comeback is read at the faint) */
  const lastHit = new Map<string, { readonly by: Ref; readonly byHp: number }>();
  const out: Moment[] = [];
  for (const e of events) {
    switch (e.t) {
      case 'damage': {
        hp.set(key(e.target), e.hpAfter);
        if (!max.has(key(e.target))) max.set(key(e.target), e.maxHp);
        if (e.cause !== 'move' || e.source === null) break;
        lastHit.set(key(e.target), { by: e.source, byHp: hp.get(key(e.source)) ?? 0 });
        if (e.source.side === e.target.side) break; // a doubles ally hit is nobody's highlight
        const m = { side: sideOf(e.source), name: look.nameOf(e.source), other: look.nameOf(e.target) };
        if (e.crit) out.push({ kind: 'crit', ...m });
        if (e.effectiveness >= 2) out.push({ kind: 'super', ...m });
        break;
      }
      case 'heal':
        hp.set(key(e.target), e.hpAfter);
        break;
      case 'faint': {
        hp.set(key(e.who), 0);
        const hit = lastHit.get(key(e.who));
        out.push({ kind: 'knockout', side: sideOf(e.who), name: look.nameOf(e.who), other: hit === undefined ? null : look.nameOf(hit.by) });
        if (hit !== undefined && hit.by.side !== e.who.side) {
          const m = max.get(key(hit.by)) ?? 0;
          if (m > 0 && hit.byHp > 0 && hit.byHp <= m * COMEBACK_FRAC) out.push({ kind: 'comeback', side: sideOf(hit.by), name: look.nameOf(hit.by), other: look.nameOf(e.who) });
        }
        break;
      }
      case 'statusApplied':
        out.push({ kind: 'status', side: sideOf(e.target), name: look.nameOf(e.target), other: e.source === null ? null : look.nameOf(e.source), status: e.status });
        break;
      case 'formChange': {
        const band = look.bandOf(e.who);
        if (band !== null) out.push({ kind: 'transform', side: sideOf(e.who), name: look.nameOf(e.who), other: null, band });
        break;
      }
      case 'switchIn': {
        const party = from.sides[e.who.side].party;
        if (party.length < 2) break;
        let last = true;
        for (let i = 0; i < party.length && last; i++) if (i !== e.who.slot && (hp.get(`${e.who.side}:${i}`) ?? 0) > 0) last = false;
        if (last && (hp.get(key(e.who)) ?? 0) > 0) out.push({ kind: 'lastOne', side: sideOf(e.who), name: look.nameOf(e.who), other: null });
        break;
      }
      case 'catchResult':
        out.push({ kind: e.caught ? 'catch' : 'escape', side: 'foe', name: look.nameOf(e.target), other: null });
        break;
      case 'battleEnd': {
        const w = e.outcome.winner;
        if (typeof w === 'number') out.push({ kind: w === look.seat ? 'win' : 'loss', side: w === look.seat ? 'own' : 'foe', name: '', other: null });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** The moment a timeline is remembered for: the highest priority, the first of equals. Null for none. */
export function highlightOf(moments: readonly Moment[]): Moment | null {
  let best: Moment | null = null;
  for (const m of moments) if (best === null || MOMENT_PRIORITY[m.kind] > MOMENT_PRIORITY[best.kind]) best = m;
  return best;
}
