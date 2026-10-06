/**
 * Phase C4 read routes the client's rankings / history / profile screens use: GET /history/trades names the partner
 * (`partnerUsername`, one lookup per page), GET /history/battles pages the caller's own rows, GET /leaderboard sorts
 * per mode, POST /profile accepts only content TITLES / BODIES.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TradeHistoryRes } from '@ewa/protocol';
import { api, rawQuery, register, startServer } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

describe('history / leaderboard / profile read routes', () => {
  it('GET /history/trades carries the partner username; another player sees none of it', async () => {
    const a = await register(s);
    const b = await register(s);
    const c = await register(s);
    const tradeId = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';
    const sent = JSON.stringify([{ id: '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', speciesId: 'glimfin', level: 7 }]);
    await rawQuery(s.db, `insert into trade_history (trade_id, player_id, partner_id, sent, received, money_sent, money_received) values ($1, $2, $3, $4::jsonb, '[]'::jsonb, 0, 250)`, [tradeId, a.id, b.id, sent]);
    const r = await api(s, 'GET', '/history/trades?page=1', a.access);
    expect(r.status).toBe(200);
    expect(TradeHistoryRes.safeParse(r.body).success).toBe(true);
    expect(r.body.rows).toHaveLength(1);
    expect(r.body.rows[0]).toMatchObject({ tradeId, partnerId: b.id, partnerUsername: b.username, moneyReceived: 250 });
    expect(r.body.rows[0].sent[0]).toMatchObject({ speciesId: 'glimfin', level: 7 });
    expect((await api(s, 'GET', '/history/trades', c.access)).body.rows).toEqual([]);
  }, 60_000);

  it('GET /history/battles returns the caller rows (empty for a fresh account) and rejects a bad page', async () => {
    const a = await register(s);
    const r = await api(s, 'GET', '/history/battles?page=1', a.access);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ rows: [] });
    expect((await api(s, 'GET', '/history/battles?page=0', a.access)).status).toBe(400);
  }, 60_000);

  it('GET /leaderboard answers every mode with ranked rows; an unknown mode is 400', async () => {
    const a = await register(s);
    for (const mode of ['rating', 'dex', 'trainerLevel']) {
      const r = await api(s, 'GET', `/leaderboard?mode=${mode}`, a.access);
      expect(r.status).toBe(200);
      expect(r.body.rows.length).toBeGreaterThan(0);
      expect(r.body.rows[0].rank).toBe(1);
    }
    expect((await api(s, 'GET', '/leaderboard?mode=wins', a.access)).status).toBe(400);
  }, 60_000);

  it('POST /profile: title / body from content, motto free text; anything else 400', async () => {
    const a = await register(s);
    const ok = await api(s, 'POST', '/profile', a.access, { title: 'Witness', body: 'fisher_f', motto: 'Count the morning.' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ title: 'Witness', body: 'fisher_f', motto: 'Count the morning.' });
    expect((await api(s, 'POST', '/profile', a.access, { title: 'Overlord' })).status).toBe(400);
    expect((await api(s, 'POST', '/profile', a.access, { body: 'robot' })).status).toBe(400);
    const pub = await api(s, 'GET', `/players/${a.username}`, a.access);
    expect(pub.body).toMatchObject({ title: 'Witness', body: 'fisher_f', motto: 'Count the morning.' });
  }, 60_000);
});
