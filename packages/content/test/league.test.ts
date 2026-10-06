/**
 * §50.4.2 `league.test.ts` — `LEAGUE` (spine §3.3): 8 gyms with the 8 badges in `BADGE_ORDER`, ids `verdant_gym …
 * draco_gym`, each in its town (the gated zone's town order follows the badges); the elite `veil`, `aurelia`, `kirei`
 * and exactly one champion `zeon`, all in `solenne`; gym team levels non-decreasing across `order` (each gym's lowest
 * and highest level ≥ the previous gym's); every team species / ability / held item resolves — for the rematch teams
 * too — and `BADGES` maps each badge to its gym.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, BADGES, BADGE_ORDER, ITEMS, LEAGUE, LEAGUE_REMATCH, SPECIES, ZONE_ORDER, zone } from '../src/index';
import type { LeagueTeamMember } from '../src/index';

const GYM_IDS = ['verdant_gym', 'blaze_gym', 'tidal_gym', 'volt_gym', 'stone_gym', 'phantom_gym', 'iron_gym', 'draco_gym'];

const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
const speciesById = new Map(SPECIES.map((s) => [s.id, s]));
const abilityIds = new Set(ABILITIES.map((a) => a.id));
const itemIds = new Set(ITEMS.map((i) => i.id));

function checkTeam(who: string, team: readonly LeagueTeamMember[]): void {
  expect(team.length, `${who} team size`).toBeGreaterThanOrEqual(1);
  expect(team.length, `${who} team size`).toBeLessThanOrEqual(6);
  for (const m of team) {
    const sp = speciesById.get(m.species);
    expect(sp, `${who}: species ${m.species}`).toBeDefined();
    expect(Number.isInteger(m.level) && m.level >= 1 && m.level <= 100, `${who}: ${m.species} L${m.level}`).toBe(true);
    if (m.ability !== null) {
      expect(abilityIds.has(m.ability), `${who}: ability ${m.ability}`).toBe(true);
      expect(sp!.abilities, `${who}: ${m.species} cannot have ${m.ability}`).toContain(m.ability);
    }
    if (m.heldItem !== null) expect(itemIds.has(m.heldItem), `${who}: held item ${m.heldItem}`).toBe(true);
  }
}

describe('LEAGUE (§3.3)', () => {
  it('12 rows: 8 gyms (orders 1..8), 3 elite (veil, aurelia, kirei), exactly one champion zeon', () => {
    expect(LEAGUE).toHaveLength(12);
    expect(new Set(LEAGUE.map((l) => l.id)).size).toBe(12);
    expect(gyms.map((g) => g.id)).toEqual(GYM_IDS);
    expect(gyms.map((g) => g.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const elite = LEAGUE.filter((l) => l.stage === 'elite').sort((a, b) => a.order - b.order);
    expect(elite.map((e) => e.id)).toEqual(['veil', 'aurelia', 'kirei']);
    expect(elite.map((e) => e.order)).toEqual([1, 2, 3]);
    const champs = LEAGUE.filter((l) => l.stage === 'champion');
    expect(champs.map((c) => c.id)).toEqual(['zeon']);
    for (const l of [...elite, ...champs]) {
      expect(l.badge, l.id).toBeNull();
      expect(l.zoneId, l.id).toBe('solenne');
    }
  });

  it('the 8 gyms award the 8 badges in BADGE_ORDER; BADGES agrees; each gym stands in a town, towns in ZONE_ORDER order', () => {
    expect(gyms.map((g) => g.badge)).toEqual([...BADGE_ORDER]);
    for (const g of gyms) {
      const b = BADGES.find((x) => x.id === g.badge)!;
      expect(b.gym, g.id).toBe(g.id);
      expect(b.type, g.id).toBe(g.type);
      expect(zone(g.zoneId).kind, `${g.id} in ${g.zoneId}`).toBe('town');
    }
    expect(new Set(gyms.map((g) => g.zoneId)).size).toBe(8);
    const pos = gyms.map((g) => ZONE_ORDER.indexOf(g.zoneId));
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('gym team levels are non-decreasing across order (lowest and highest level each)', () => {
    let prevMin = 0;
    let prevMax = 0;
    for (const g of gyms) {
      const lv = g.team.map((m) => m.level);
      const lo = Math.min(...lv);
      const hi = Math.max(...lv);
      expect(lo, `${g.id} lowest L${lo} < previous gym's L${prevMin}`).toBeGreaterThanOrEqual(prevMin);
      expect(hi, `${g.id} highest L${hi} < previous gym's L${prevMax}`).toBeGreaterThanOrEqual(prevMax);
      prevMin = lo;
      prevMax = hi;
    }
    // the elite and the champion sit above the last gym
    for (const l of LEAGUE.filter((x) => x.stage !== 'gym')) expect(Math.max(...l.team.map((m) => m.level)), l.id).toBeGreaterThanOrEqual(prevMax);
  });

  it('every team species / ability / held item resolves (league and rematch teams); rewards are positive', () => {
    for (const l of LEAGUE) {
      checkTeam(l.id, l.team);
      expect(l.reward, l.id).toBeGreaterThan(0);
      expect(l.pre.length + l.post.length, l.id).toBeGreaterThan(0);
    }
    expect(LEAGUE_REMATCH.map((r) => r.leagueId).sort()).toEqual(LEAGUE.map((l) => l.id).sort());
    for (const r of LEAGUE_REMATCH) checkTeam(`${r.leagueId} rematch`, r.team);
  });
});
