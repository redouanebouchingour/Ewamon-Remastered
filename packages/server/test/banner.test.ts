/**
 * Trainer banners (content `data/banners.ts`, game/banner.ts, routes/banner.ts): GET /banner gives the default and the
 * server's counts; POST /banner refuses a locked frame, backdrop or pin and a creature that is not the trainer's, and
 * saves the rest (audit row); GET /players/:username carries the banner as shown, the featured creature falling back to
 * the party lead; the zone room's `PlayerState.flair` follows the frame's rarity, on join and after a save; a partner
 * shown in its Majin / Tenjin form needs that band in the bag and is shown so only while it stays the partner.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BANNER, MAJIN_BAND, bannerForms } from '@ewa/content';
import { BannerRes, PublicProfileSchema } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { CHAMPION_FLAG } from '../src/rooms/battleSession';
import { api, content, enter, rawQuery, register, startServer, waitFor } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
let a: Account;
let b: Account;

beforeAll(async () => {
  s = await startServer();
  a = await register(s);
  b = await register(s, 'glimfin');
});

afterAll(async () => {
  await s?.stop();
});

const choice = (over: Partial<typeof DEFAULT_BANNER> = {}) => ({ ...DEFAULT_BANNER, pins: [...DEFAULT_BANNER.pins], trackers: [...DEFAULT_BANNER.trackers], ...over });

describe('GET /banner', () => {
  it('is the default banner with the server counts for a new trainer', async () => {
    const r = await api(s, 'GET', '/banner', a.access);
    expect(r.status).toBe(200);
    const body = BannerRes.parse(r.body);
    expect(body.choice).toEqual(choice());
    expect(body.stats).toMatchObject({ badges: 0, champion: false, seasonBest: 0, shinies: 0, pvpWins: 0, legendaries: 0, towerBest: 0 });
    expect(body.stats.dexCaught).toBeGreaterThanOrEqual(1);
    expect(body.stats.typeCaught.Grass).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /banner', () => {
  it('refuses what the trainer has not unlocked', async () => {
    const frame = await api(s, 'POST', '/banner', a.access, choice({ frame: 'laurel' }));
    expect(frame.status).toBe(403);
    expect(frame.body).toMatchObject({ code: 'bannerLocked', reason: 'frameLocked' });
    const backdrop = await api(s, 'POST', '/banner', a.access, choice({ backdrop: 'throne' }));
    expect(backdrop.body).toMatchObject({ code: 'bannerLocked', reason: 'backdropLocked' });
    const pin = await api(s, 'POST', '/banner', a.access, choice({ pins: ['champion'] }));
    expect(pin.body).toMatchObject({ code: 'bannerLocked', reason: 'pinLocked' });
    const unknown = await api(s, 'POST', '/banner', a.access, choice({ trackers: ['nope'] }));
    expect(unknown.body).toMatchObject({ code: 'bannerLocked', reason: 'unknownTracker' });
  });

  it('refuses another trainer’s creature as the featured one', async () => {
    const theirs = (await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, b.id)))[0]!.id;
    const r = await api(s, 'POST', '/banner', a.access, choice({ featuredId: theirs }));
    expect(r.status).toBe(404);
  });

  it('saves an unlocked banner and shows it on the public profile', async () => {
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, a.id, [CHAMPION_FLAG], new Date()));
    const mine = (await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, a.id)))[0]!.id;
    const pick = choice({ frame: 'laurel', backdrop: 'eclipse', pins: ['champion'], trackers: ['badges', 'trainerLevel'], featuredId: mine });
    const r = await api(s, 'POST', '/banner', a.access, pick);
    expect(r.status).toBe(200);
    expect(BannerRes.parse(r.body).choice).toEqual(pick);
    expect(await rawQuery(s.db, `select action from audit_log where actor_id = $1 and action = 'banner.save'`, [a.id])).toHaveLength(1);

    const pub = PublicProfileSchema.parse((await api(s, 'GET', `/players/${a.username}`, b.access)).body);
    expect(pub.banner).toMatchObject({ frame: 'laurel', backdrop: 'eclipse', pins: [{ id: 'champion', tier: 1 }], trackers: [{ id: 'badges', value: 0 }, { id: 'trainerLevel' }] });
    expect(pub.banner?.featured?.id).toBe(mine);
    expect(pub.banner?.featured?.ownerId).toBeNull();
  });

  it('falls back to the party lead and the default frame once the pick no longer stands', async () => {
    await s.repos.db.transaction((tx) => s.repos.progress.clearFlags(tx, a.id, [CHAMPION_FLAG]));
    const pub = PublicProfileSchema.parse((await api(s, 'GET', `/players/${a.username}`, b.access)).body);
    expect(pub.banner).toMatchObject({ frame: DEFAULT_BANNER.frame, backdrop: DEFAULT_BANNER.backdrop, pins: [] });
    const other = PublicProfileSchema.parse((await api(s, 'GET', `/players/${b.username}`, a.access)).body);
    expect(other.banner?.featured?.speciesId).toBe('glimfin');
  });
});

describe('a partner in its Majin / Tenjin form', () => {
  it('needs the band, a band form of the partner own species, and shows while the partner stands', async () => {
    const c = await register(s);
    const form = bannerForms('infernomorel')[0]!.id;
    const partner = await s.repos.db.transaction(async (tx) => (await s.repos.creatures.insert(tx, newCreature(content, 'infernomorel', 30, { ownerId: c.id }), { kind: 'party', index: 1 })).id);
    const lead = (await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, c.id)))[0]!.id;
    expect(BannerRes.parse((await api(s, 'GET', '/banner', c.access)).body).stats.bands).toEqual([]);
    const locked = await api(s, 'POST', '/banner', c.access, choice({ featuredId: partner, featuredForm: form }));
    expect(locked).toMatchObject({ status: 403, body: { code: 'bannerLocked', reason: 'formLocked' } });
    await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, c.id, MAJIN_BAND, 1));
    expect(BannerRes.parse((await api(s, 'GET', '/banner', c.access)).body).stats.bands).toEqual(['majin']);
    // another species' form, and a form without a chosen partner, are refused
    expect((await api(s, 'POST', '/banner', c.access, choice({ featuredId: lead, featuredForm: form }))).body).toMatchObject({ code: 'bannerLocked', reason: 'unknownForm' });
    expect((await api(s, 'POST', '/banner', c.access, choice({ featuredForm: form }))).body).toMatchObject({ code: 'bannerLocked', reason: 'formNeedsPartner' });
    const ok = await api(s, 'POST', '/banner', c.access, choice({ featuredId: partner, featuredForm: form }));
    expect(ok.status).toBe(200);
    expect(BannerRes.parse(ok.body).choice.featuredForm).toBe(form);
    let pub = PublicProfileSchema.parse((await api(s, 'GET', `/players/${c.username}`, b.access)).body);
    expect(pub.banner).toMatchObject({ featured: { id: partner }, featuredForm: form });
    // the band leaves the bag: the partner shows its own look
    await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, c.id, MAJIN_BAND, -1));
    pub = PublicProfileSchema.parse((await api(s, 'GET', `/players/${c.username}`, b.access)).body);
    expect(pub.banner).toMatchObject({ featured: { id: partner }, featuredForm: null });
    // an older client's save (no featuredForm) is its own look
    const { featuredForm: _drop, ...old } = choice({ featuredId: partner });
    expect(BannerRes.parse((await api(s, 'POST', '/banner', c.access, old)).body).choice.featuredForm).toBeNull();
  });
});

describe('the nameplate flair', () => {
  it('carries the frame rarity on join and follows a save', async () => {
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, a.id, [CHAMPION_FLAG], new Date()));
    await api(s, 'POST', '/banner', a.access, choice({ frame: 'laurel' }));
    const j = await enter(s, a, 'mirevale');
    try {
      await waitFor(() => j.room.state.players.get(a.id) !== undefined);
      expect(j.room.state.players.get(a.id)!.flair).toBe('legendary');
      await api(s, 'POST', '/banner', a.access, choice({ frame: 'paperline' }));
      await waitFor(() => j.room.state.players.get(a.id)!.flair === '');
    } finally {
      await j.room.leave();
    }
  });
});
