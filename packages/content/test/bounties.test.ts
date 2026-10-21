/**
 * The bounty board (bounties.ts): the game's reward by trainers beaten (125 a head, 5,000 at most, nothing under five);
 * the board's cut and the Lawlander bonus are one quarter, so a Lawlander claim of a player's post pays back exactly
 * the escrow; nemesis bounties by rank; the posting schedule; a post's expiry; the refusals in order; the lines (no
 * em-dash); every town's Healer hall, and nothing else, holds the Marshal and the board, the hall otherwise unchanged.
 */
import { describe, expect, it } from 'vitest';
import {
  BOUNTY_CLAIMS_PER_DAY,
  BOUNTY_MARSHAL_LINES,
  BOUNTY_OFFICES,
  BOUNTY_PERIOD_MS,
  BOUNTY_POST_HOURS,
  BOUNTY_REFUSAL_TEXT,
  GAME_BOUNTY_MAX,
  PLAYER_BOUNTY_MAX,
  PLAYER_BOUNTY_MIN,
  ZONES,
  bountyFee,
  bountyMarshalId,
  bountyPayout,
  bountyPeriod,
  gameBountyReward,
  hasBountyBoard,
  holdsLine,
  interiorsFor,
  lawlanderBonus,
  nemesisBounty,
  postExpiry,
  postRefusal,
  withBountyBoard,
  BADLANDER_LINE,
  LAWLANDER_LINE,
} from '../src/index';
import { healerHall, shopHall } from '../src/data/interiors';

describe('bounty board', () => {
  it("pays 125 a head for a ghost that beat five or more, 5,000 at most (the pitch: 40 people, 5,000)", () => {
    expect(gameBountyReward(4)).toBe(0);
    expect(gameBountyReward(5)).toBe(625);
    expect(gameBountyReward(40)).toBe(5_000);
    expect(gameBountyReward(400)).toBe(GAME_BOUNTY_MAX);
  });

  it('takes a quarter as the cut and gives a quarter to a Lawlander: a claim never pays more than the escrow', () => {
    for (const r of [PLAYER_BOUNTY_MIN, 777, 1_000, PLAYER_BOUNTY_MAX]) {
      expect(lawlanderBonus(r)).toBe(bountyFee(r));
      expect(bountyPayout(r, true)).toBe(r + bountyFee(r));
      expect(bountyPayout(r, false)).toBe(r);
    }
    expect(bountyFee(800)).toBe(200);
  });

  it('a nemesis has a poster from rank 2', () => {
    expect(nemesisBounty(1)).toBe(0);
    expect(nemesisBounty(2)).toBe(800);
    expect(nemesisBounty(5)).toBe(2_000);
  });

  it('posts on a six-hour schedule; a post stays three days unless its ghost fades first', () => {
    const t = Date.UTC(2026, 9, 21, 7, 30);
    const p = bountyPeriod(t);
    expect(new Date(p.startsAt).toISOString()).toBe('2026-10-21T06:00:00.000Z');
    expect(p.endsAt - p.startsAt).toBe(BOUNTY_PERIOD_MS);
    expect(bountyPeriod(p.endsAt).index).toBe(p.index + 1);
    expect(postExpiry(t, t + 10 * 86_400_000)).toBe(t + BOUNTY_POST_HOURS * 3_600_000);
    expect(postExpiry(t, t + 3_600_000)).toBe(t + 3_600_000);
  });

  it('only a Badlander party posts; never on your own ghost; within the limits', () => {
    const base = { partySpecies: ['dustcub', 'badlander'], reward: 1_000, ownGhost: false, ghostAlive: true, openPosts: 0, postedOnTarget: false };
    expect(postRefusal(base)).toBeNull();
    expect(postRefusal({ ...base, partySpecies: ['dustcub', 'lawlander'] })).toBe('noBadlander');
    expect(postRefusal({ ...base, ownGhost: true })).toBe('ownGhost');
    expect(postRefusal({ ...base, ghostAlive: false })).toBe('noGhost');
    expect(postRefusal({ ...base, reward: PLAYER_BOUNTY_MIN - 1 })).toBe('tooLow');
    expect(postRefusal({ ...base, reward: 750.5 })).toBe('tooLow');
    expect(postRefusal({ ...base, reward: PLAYER_BOUNTY_MAX + 1 })).toBe('tooHigh');
    expect(postRefusal({ ...base, postedOnTarget: true })).toBe('alreadyPosted');
    expect(postRefusal({ ...base, openPosts: 3 })).toBe('tooMany');
    expect(holdsLine(['lawlander'], LAWLANDER_LINE)).toBe(true);
    expect(holdsLine(['dustcub'], LAWLANDER_LINE) || holdsLine(['dustcub'], BADLANDER_LINE)).toBe(false);
    expect(BOUNTY_CLAIMS_PER_DAY).toBeGreaterThan(0);
  });

  it('speaks without an em-dash', () => {
    for (const line of [...BOUNTY_MARSHAL_LINES, ...Object.values(BOUNTY_REFUSAL_TEXT)]) expect(line).not.toMatch(/—/);
  });

  it("every town keeps one board (its Healer, else its Mart, else its first house); nothing else does; the hall is otherwise unchanged", () => {
    const towns = ZONES.filter((z) => z.kind === 'town');
    expect(towns.map((z) => z.id).sort()).toEqual(Object.keys(BOUNTY_OFFICES).sort());
    for (const z of ZONES) {
      const marshals = interiorsFor(z.id).flatMap((p) => p.def.npcs.filter((n) => n.role === 'bounty').map((n) => ({ n, p })));
      expect(hasBountyBoard(z)).toBe(z.kind === 'town');
      if (z.kind !== 'town') {
        expect(marshals).toEqual([]);
        continue;
      }
      expect(marshals).toHaveLength(1);
      const { n, p } = marshals[0]!;
      expect(p.def.id).toBe(BOUNTY_OFFICES[z.id]);
      const all = interiorsFor(z.id);
      const fallback = all.some((q) => q.def.template === 'healer') ? 'healer' : all.some((q) => q.def.template === 'shop') ? 'shop' : 'house';
      expect(p.def.template.startsWith(fallback)).toBe(true);
      expect(n.id).toBe(bountyMarshalId(p.def.id));
      expect(p.def.props.filter((q) => q.kind === 'banner')).toHaveLength(1);
    }
    const plain = healerHall('mirevale', 'mirevale.healer', 'Mirevale Healer');
    const board = withBountyBoard(plain);
    expect(board.walls).toEqual(plain.walls);
    expect([board.w, board.d, board.entry, board.exit]).toEqual([plain.w, plain.d, plain.entry, plain.exit]);
    expect(board.npcs.slice(0, plain.npcs.length)).toEqual(plain.npcs);
    // a Mart where the town has a Healer is untouched
    expect(withBountyBoard(shopHall('mirevale', 'mirevale.shop', 'Mirevale Mart'))).toEqual(shopHall('mirevale', 'mirevale.shop', 'Mirevale Mart'));
    const office = interiorsFor('skyrend').find((p) => p.def.id === 'skyrend.house0')!.def;
    expect(office.label).toBe("the Marshal's Office");
    expect(office.npcs.filter((x) => x.role === 'resident')).toEqual([]);
  });
});
