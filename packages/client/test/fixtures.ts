/** Shared fixtures for the client tests: schema-valid REST bodies and a fake JWT. */
import { BATTLE_PASS } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { MeResponse, PublicProfile } from '@ewa/protocol';

export const PLAYER_ID = '11111111-1111-4111-8111-111111111111';

export function makeJwt(expSeconds: number, sub = PLAYER_ID): string {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp: expSeconds })}.signature`;
}

export const inOneHour = (): number => Math.floor(Date.now() / 1000) + 3600;

let n = 0;
export function creature(speciesId: string, over: Partial<CreatureInstance> = {}): CreatureInstance {
  n += 1;
  const hex = n.toString(16).padStart(12, '0');
  return {
    id: `22222222-2222-4222-8222-${hex}`,
    ownerId: PLAYER_ID,
    speciesId,
    nickname: null,
    level: 5,
    exp: 125,
    hp: 20,
    moves: [{ id: 'Tackle', pp: 35, ppMax: 35 }],
    status: [],
    ability: 'Overgrow',
    heldItem: null,
    variantKey: 'normal',
    isAlpha: false,
    caughtAt: null,
    ribbons: [],
    favorite: false,
    locked: false,
    ...over,
  };
}

export function meFixture(over: Partial<MeResponse> = {}): MeResponse {
  return {
    id: PLAYER_ID,
    username: 'qa_tester',
    email: 'qa@example.com',
    title: 'Rookie Trainer',
    motto: '',
    body: 'ranger_m',
    money: 3000,
    rating: 1000,
    peakRating: 1000,
    rankedMatches: 0,
    tier: 'bronze',
    trainerExp: 250,
    trainerLevel: 1,
    isAdmin: false,
    zoneId: 'mirevale',
    createdAt: '2026-09-20T10:00:00.000Z',
    party: [creature('bramblecub')],
    box: [],
    inventory: { potion: 5, spark_orb: 10 },
    badges: [],
    flags: [],
    quests: [],
    battlePass: { trainerExp: 250, trainerLevel: 1, claimed: [], mythicalChoice: null, rewards: [...BATTLE_PASS].map((r) => ({ ...r, items: { ...r.items }, mythicalChoice: r.mythicalChoice === null ? null : [...r.mythicalChoice] })) },
    presence: { roomId: null, zoneId: 'mirevale', shard: 0 },
    unreadDm: {},
    friendRequests: 0,
    liveOps: { dayKey: '2026-09-24', weekKey: '2026-W39', weekdayVariant: null, loginStreak: 0 },
    ...over,
  } as MeResponse;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** Phase C4: a GET /players/:username body (the §5.3 allow-list) for the fixture player unless overridden. */
export function publicProfileFixture(over: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: PLAYER_ID,
    username: 'qa_tester',
    title: 'Rookie Trainer',
    motto: '',
    body: 'ranger_m',
    rating: 1000,
    peakRating: 1000,
    tier: 'bronze',
    trainerLevel: 1,
    badges: [],
    guildTag: null,
    dexCaughtCount: 1,
    showcase: [{ ...creature('bramblecub'), ownerId: null }] as unknown as PublicProfile['showcase'],
    createdAt: '2026-09-20T10:00:00.000Z',
    ...over,
  };
}
