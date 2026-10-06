/**
 * §50.4.2 gates-reachable.test.ts (M3 box "gates-reachable.test.ts 0..8 badges") and the M3 progression audit:
 *
 * 1. A simulated player holding badges `[]`, `[bloom]`, `[bloom, ember]`, … can reach the town of gym `n + 1` with
 *    `n` badges (n = 0..7) and `solenne` with all 8 — BFS over `links` honouring `gate` — and can NOT reach anything
 *    gated by a badge it does not hold.
 * 2. The whole world in play order: a player model that only ever does what the server allows (a beat by
 *    `nextStoryBeat` in a zone it can enter; a league fight by §30.4.4's order rules + `LEAGUE_STORY_GATES`; a
 *    static once its `when` holds) finishes all 33 beats and all 12 league rows — whether it prefers fights or beats —
 *    and every gated leader's preamble beat plays before the fight.
 */
import { describe, expect, it } from 'vitest';
import type { BadgeId, LeagueTrainer, LinkDir, StoryBeat, ZoneId } from '../src/index';
import { BADGE_ORDER, LEAGUE, LEGENDARY_STATICS, STORY, ZONES, badgeFlag, beatDoneFlag, flagsAfterBeat, leagueStoryGate, nextStoryBeat } from '../src/index';

const byId = new Map(ZONES.map((z) => [z.id, z]));
const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
const CHAMPION_FLAG = 'champion:zeon:beaten';

function reachable(badges: readonly BadgeId[]): Set<ZoneId> {
  const have = new Set<string>(badges);
  const seen = new Set<ZoneId>();
  const q: ZoneId[] = ['mirevale'];
  while (q.length > 0) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    const z = byId.get(id)!;
    if (z.gate !== null && !have.has(z.gate)) continue;
    seen.add(id);
    for (const d of Object.keys(z.links).sort() as LinkDir[]) q.push(z.links[d]!);
  }
  return seen;
}

describe('gates-reachable (§50.4.2, 0..8 badges)', () => {
  for (let n = 0; n <= 8; n++) {
    it(`${n} badge${n === 1 ? '' : 's'}: ${n < 8 ? `the town of gym ${n + 1} (${gyms[n]!.zoneId})` : 'solenne'} is reachable, nothing gated by a missing badge is`, () => {
      const held = BADGE_ORDER.slice(0, n);
      const seen = reachable(held);
      if (n < 8) expect(seen.has(gyms[n]!.zoneId), `gym ${n + 1} with ${n} badges`).toBe(true);
      else expect(seen.has('solenne')).toBe(true);
      if (n < 7) expect(seen.has(gyms[n + 1]!.zoneId), `gym ${n + 2} must wait for badge ${n + 1}`).toBe(false);
      for (const z of ZONES) {
        const open = z.gate === null || held.includes(z.gate);
        expect(seen.has(z.id), `${z.id} (gate ${z.gate}) with [${held.join(',')}]`).toBe(open);
      }
    });
  }
  it('with all 8 badges every one of the 21 zones is reachable', () => {
    expect(reachable(BADGE_ORDER).size).toBe(21);
  });
});

// ─── the player model ──────────────────────────────────────────────────────────

interface World {
  readonly flags: Set<string>;
  readonly badges: BadgeId[];
  readonly beaten: Set<string>;
  readonly log: string[];
}

/** The server's league refusal (§30.4.4 + LEAGUE_STORY_GATES; ZoneRoom.leagueRefusal), as a predicate. */
function mayChallenge(w: World, lt: LeagueTrainer): boolean {
  if (w.beaten.has(lt.id)) return false;
  const gate = leagueStoryGate(lt.id);
  if (gate !== null && !w.flags.has(gate)) return false;
  if (lt.stage === 'gym') {
    const prev = gyms.find((g) => g.order === lt.order - 1);
    return prev?.badge == null || w.badges.includes(prev.badge);
  }
  if (lt.stage === 'elite') {
    if (w.badges.length < 8) return false;
    const prev = LEAGUE.find((l) => l.stage === 'elite' && l.order === lt.order - 1);
    return prev === undefined || prev.setsFlags.every((f) => w.flags.has(f));
  }
  return LEAGUE.filter((l) => l.stage === 'elite').every((e) => e.setsFlags.every((f) => w.flags.has(f)));
}

function win(w: World, lt: LeagueTrainer): void {
  w.beaten.add(lt.id);
  if (lt.badge !== null) {
    w.badges.push(lt.badge);
    w.flags.add(badgeFlag(lt.badge));
  }
  for (const f of lt.setsFlags) w.flags.add(f);
  if (lt.id === 'zeon') w.flags.add(CHAMPION_FLAG);
  w.log.push(`league:${lt.id}`);
}

function play(w: World, beat: StoryBeat): void {
  for (const f of flagsAfterBeat(beat)) w.flags.add(f);
  w.log.push(`beat:${beat.id}`);
}

/** Runs the model to a fixed point; `prefer` decides whether an open fight or an open beat goes first. */
function run(prefer: 'fights' | 'beats'): World {
  const w: World = { flags: new Set(), badges: [], beaten: new Set(), log: [] };
  for (let guard = 0; guard < 200; guard++) {
    const zones = [...reachable(w.badges)];
    const beats = zones.map((z) => nextStoryBeat(z, w.flags)).filter((b): b is StoryBeat => b !== null);
    const fights = LEAGUE.filter((lt) => zones.includes(lt.zoneId) && mayChallenge(w, lt));
    if (beats.length === 0 && fights.length === 0) break;
    // STORY order / league order: the earliest open item of the preferred kind
    beats.sort((a, b) => STORY.indexOf(a) - STORY.indexOf(b));
    if ((prefer === 'fights' && fights.length > 0) || beats.length === 0) win(w, fights[0]!);
    else play(w, beats[0]!);
  }
  return w;
}

describe('the world in play order (M3 progression audit)', () => {
  for (const prefer of ['fights', 'beats'] as const) {
    it(`a player who prefers ${prefer} finishes all 33 beats, 8 badges in order, the 3 Wardens and the Champion`, () => {
      const w = run(prefer);
      const beats = w.log.filter((e) => e.startsWith('beat:')).map((e) => e.slice(5));
      expect(beats.length).toBe(STORY.length);
      expect(new Set(beats).size).toBe(STORY.length);
      expect(w.badges).toEqual([...BADGE_ORDER]);
      expect(w.log.filter((e) => e.startsWith('league:')).map((e) => e.slice(7))).toEqual([...gyms.map((g) => g.id), 'veil', 'aurelia', 'kirei', 'zeon']);
      expect(w.flags.has(CHAMPION_FLAG)).toBe(true);
      for (const b of STORY) expect(w.flags.has(beatDoneFlag(b.id)), b.id).toBe(true);
    });

    it(`(${prefer}) every story-gated fight comes after the beat that sets its gate, and that beat is in the leader's town`, () => {
      const w = run(prefer);
      for (const lt of LEAGUE) {
        const gate = leagueStoryGate(lt.id);
        expect(gate, `${lt.id} carries a story gate`).not.toBeNull();
        const setter = STORY.find((b) => b.set.includes(gate!))!;
        expect(setter.zoneId, `${lt.id}: ${setter.id}`).toBe(lt.zoneId);
        expect(w.log.indexOf(`beat:${setter.id}`), `${lt.id} after ${setter.id}`).toBeLessThan(w.log.indexOf(`league:${lt.id}`));
      }
    });
  }

  it('the bible play order holds for the preambles it writes: b6 before Karn, b10 before Zia, b21 before Rell, b24 before Sylvane, b28–b30 before the Wardens', () => {
    const w = run('fights');
    const at = (e: string): number => w.log.indexOf(e);
    expect(at('beat:first_harvest')).toBeLessThan(at('beat:forge_gratitude'));
    expect(at('beat:forge_gratitude')).toBeLessThan(at('league:blaze_gym'));
    expect(at('beat:drowned_harbour')).toBeLessThan(at('league:tidal_gym'));
    expect(at('beat:grid_numbers')).toBeLessThan(at('league:volt_gym'));
    expect(at('beat:grove_gone')).toBeLessThan(at('league:phantom_gym'));
    expect(at('beat:escorted_out')).toBeLessThan(at('league:iron_gym'));
    expect(at('beat:the_requisition')).toBeLessThan(at('league:iron_gym'));
    expect(at('beat:sable_beside')).toBeLessThan(at('league:draco_gym'));
    expect(at('beat:star_counts')).toBeLessThan(at('league:draco_gym'));
    expect(at('beat:spire_withdrawal')).toBeLessThan(at('league:veil'));
    expect(at('beat:wardens_charge')).toBeLessThan(at('league:veil'));
    expect(at('league:zeon')).toBeLessThan(at('beat:name_restored'));
  });

  it('every legendary static opens (its `when` holds while its zone is enterable), each after the flag its gate names', () => {
    const w = run('beats');
    for (const st of LEGENDARY_STATICS) {
      const gate = st.when.startsWith('badge:') ? st.when : st.when.slice('flag:'.length);
      expect(w.flags.has(gate), `${st.species}: ${st.when}`).toBe(true);
      expect(reachable(w.badges).has(st.zoneId), st.species).toBe(true);
    }
    // bible §7.2: galaxion opens with ledger_read (beat 18) — before the Anvil Badge; the post-title five need the Champion
    expect(w.log.indexOf('beat:the_ledger')).toBeLessThan(w.log.indexOf('league:iron_gym'));
    expect(LEGENDARY_STATICS.filter((s) => s.when === `flag:${CHAMPION_FLAG}`).map((s) => s.species).sort()).toEqual(['glacinid', 'sunjaw', 'voidraxis', 'voltaura', 'zenryu']);
  });

  it('no zone ever has two eligible beats along either run (bible §5.4)', () => {
    for (const prefer of ['fights', 'beats'] as const) {
      const w: World = { flags: new Set(), badges: [], beaten: new Set(), log: [] };
      const full = run(prefer).log;
      for (const e of full) {
        for (const z of ZONES) {
          const open = STORY.filter((b) => b.zoneId === z.id && !w.flags.has(beatDoneFlag(b.id)) && b.need.every((f) => w.flags.has(f)));
          expect(open.length, `${z.id} before ${e}: ${open.map((b) => b.id).join(',')}`).toBeLessThanOrEqual(1);
        }
        if (e.startsWith('beat:')) play(w, STORY.find((b) => b.id === e.slice(5))!);
        else win(w, LEAGUE.find((l) => l.id === e.slice(7))!);
      }
    }
  });
});
