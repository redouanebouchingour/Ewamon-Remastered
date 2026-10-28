/**
 * §4.1 / §4.2 — the schema classes round-trip through the real @colyseus/schema Encoder/Decoder,
 * `players` and `spawns` are the ONLY @view()-tagged fields (read from the class metadata), and a
 * StateView delivers exactly what was added to it and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { Decoder, Encoder, StateView } from '@colyseus/schema';
import type { Iterator } from '@colyseus/schema';
import { AOI_VIEW_FIELDS, BattleSummary, LEAD_VARIANTS, PlayerState, RaidState, SpawnState, ZoneState, decodeLeadFlags, encodeLeadFlags } from '../src/index';

// Metadata keys (build/types/symbols.d.ts): plain string constants, read here so the test proves
// the tags from the library's own bookkeeping rather than from our AOI_VIEW_FIELDS constant.
const NUM_FIELDS = '~__numFields';
const VIEW_FIELD_INDEXES = '~__viewFieldIndexes';

interface FieldMeta {
  readonly name: string;
  readonly tag?: number;
}
type ClassMetadata = Record<string, unknown> & Record<number, FieldMeta>;

function metadataOf(ctor: unknown): ClassMetadata {
  return (ctor as { [Symbol.metadata]: ClassMetadata })[Symbol.metadata];
}

function fieldNames(ctor: unknown): string[] {
  const md = metadataOf(ctor);
  // `~__numFields` holds the LAST field index (the library iterates `i <= numFields`).
  const last = md[NUM_FIELDS] as number;
  const out: string[] = [];
  for (let i = 0; i <= last; i++) out.push(md[i]!.name);
  return out;
}

function viewFieldNames(ctor: unknown): string[] {
  const md = metadataOf(ctor);
  const idx = (md[VIEW_FIELD_INDEXES] as number[] | undefined) ?? [];
  return idx.map((i) => md[i]!.name);
}

function player(id: string, x: number, z: number): PlayerState {
  const p = new PlayerState();
  p.id = id;
  p.name = `n_${id}`;
  p.x = x;
  p.z = z;
  p.angle = 1.5;
  p.moving = true;
  p.running = x > 0;
  p.body = 'ranger_m';
  p.emote = 3;
  p.inBattle = false;
  p.guildTag = 'EWA';
  p.seq = 42;
  return p;
}

function spawn(id: string, x: number, z: number): SpawnState {
  const s = new SpawnState();
  s.id = id;
  s.speciesId = 'bramblecub';
  s.level = 7;
  s.x = x;
  s.z = z;
  s.variantKey = 'dawn';
  s.isAlpha = true;
  s.engagedBy = '';
  s.despawnAtTick = 1200;
  return s;
}

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('§4.1 field layout', () => {
  it('declares exactly the spine fields, in order', () => {
    expect(fieldNames(PlayerState)).toEqual([
      'id', 'name', 'x', 'z', 'angle', 'moving', 'running', 'body', 'emote', 'inBattle', 'guildTag', 'seq', 'surfing', 'biking', 'lead', 'leadFlags',
    ]);
    expect(fieldNames(SpawnState)).toEqual([
      'id', 'speciesId', 'level', 'x', 'z', 'variantKey', 'isAlpha', 'engagedBy', 'despawnAtTick', 'isShiny',
    ]);
    expect(fieldNames(BattleSummary)).toEqual(['id', 'participants', 'format', 'turn', 'x', 'z', 'field', 'trainers', 'angle']);
    expect(fieldNames(RaidState)).toEqual([
      'id', 'bossSpecies', 'bossLevel', 'hpPct', 'phase', 'roundEndsInMs', 'damageBoard', 'x', 'z',
    ]);
    expect(fieldNames(ZoneState)).toEqual([
      'tick', 'timeOfDay', 'weather', 'harvestState', 'shadow', 'players', 'spawns', 'battles', 'raid', 'fieldPowers', 'campOwner', 'campName', 'campTrophies',
    ]);
  });

  it('§4.2: players and spawns are the ONLY @view()-tagged fields anywhere', () => {
    expect(viewFieldNames(ZoneState).sort()).toEqual([...AOI_VIEW_FIELDS].sort());
    for (const ctor of [PlayerState, SpawnState, BattleSummary, RaidState]) {
      expect(viewFieldNames(ctor)).toEqual([]);
    }
  });
});

describe('followers: the lead look packed into PlayerState.leadFlags', () => {
  it('round-trips shiny, alpha and every variant', () => {
    for (const variantKey of LEAD_VARIANTS) {
      for (const isShiny of [false, true]) {
        for (const isAlpha of [false, true]) {
          for (const form of [0, 1, 7]) {
            const f = encodeLeadFlags({ isShiny, isAlpha, variantKey, form });
            expect(f).toBeGreaterThanOrEqual(0);
            expect(f).toBeLessThan(256);
            expect(decodeLeadFlags(f)).toEqual({ isShiny, isAlpha, variantKey, form });
          }
        }
      }
    }
    expect(decodeLeadFlags(encodeLeadFlags({ variantKey: 'unknown' }))).toEqual({ isShiny: false, isAlpha: false, variantKey: 'normal', form: 0 });
    // a form slot outside 1..7 packs as none rather than spilling into the other bits
    expect(decodeLeadFlags(encodeLeadFlags({ form: 8 })).form).toBe(0);
    // flags without the form bits (a lead packed before held forms) still read as the species' own look
    expect(decodeLeadFlags(encodeLeadFlags({ isShiny: true, variantKey: 'ember' })).form).toBe(0);
  });
});

describe('§4.1 encode/decode round-trip (broadcast fields)', () => {
  it('carries tick/timeOfDay/weather/harvestState/battles/raid to a client with no view', () => {
    const state = new ZoneState();
    state.tick = 123456;
    state.timeOfDay = 0.25;
    state.weather = 'rain';
    state.harvestState = 'thinning';
    const b = new BattleSummary();
    b.id = 'battle-1';
    b.participants.push(UUID_A, UUID_B);
    b.format = 'pvp';
    b.turn = 9;
    b.x = 12.5;
    b.z = -3;
    state.battles.set(b.id, b);
    const raid = new RaidState();
    raid.id = 'raid-1';
    raid.bossSpecies = 'noxmyth';
    raid.bossLevel = 60;
    raid.hpPct = 0.5;
    raid.phase = 2;
    raid.roundEndsInMs = 17000;
    raid.damageBoard.set(UUID_A, 4321);
    raid.x = 40;
    raid.z = 41;
    state.raid = raid;
    // AOI-scoped rows exist but no view was given them:
    state.players.set(UUID_A, player(UUID_A, 1, 2));
    state.spawns.set('s1', spawn('s1', 3, 4));

    const client = new ZoneState();
    const decoder = new Decoder(client);
    decoder.decode(new Encoder(state).encodeAll());

    expect(client.tick).toBe(123456);
    expect(client.timeOfDay).toBeCloseTo(0.25, 6);
    expect(client.weather).toBe('rain');
    expect(client.harvestState).toBe('thinning');
    expect(client.battles.get('battle-1')?.toJSON()).toEqual({
      id: 'battle-1', participants: [UUID_A, UUID_B], format: 'pvp', turn: 9, x: 12.5, z: -3, field: [], trainers: [], angle: 0,
    });
    expect(client.raid?.toJSON()).toEqual({
      id: 'raid-1', bossSpecies: 'noxmyth', bossLevel: 60, hpPct: 0.5, phase: 2, roundEndsInMs: 17000,
      damageBoard: { [UUID_A]: 4321 }, x: 40, z: 41,
    });
    // @view()-tagged collections do not leak to a viewless client
    expect(client.players.size).toBe(0);
    expect(client.spawns.size).toBe(0);
  });

  it('float32 fields quantise but stay within 0.02 m (the server speed check slack)', () => {
    const state = new ZoneState();
    const encoder = new Encoder(state);
    const p = player(UUID_A, 103.123456789, -77.98765);
    state.players.set(UUID_A, p);
    const view = new StateView();
    view.add(p);
    const client = decodeFullForView(encoder, view);
    const got = client.players.get(UUID_A)!;
    expect(Math.abs(got.x - 103.123456789)).toBeLessThan(0.02);
    expect(Math.abs(got.z + 77.98765)).toBeLessThan(0.02);
  });
});

/**
 * README "Encoding with views": one shared full encode + one encodeAllView per view. The Encoder
 * must exist BEFORE `view.add()` — a StateView binds lazily to the encoder's Root on its first add
 * (StateView.d.ts `_bindRoot`), exactly as a Colyseus room creates its serializer before any client
 * joins.
 */
function decodeFullForView(encoder: Encoder<ZoneState>, view: StateView): ZoneState {
  const it: Iterator = { offset: 0 };
  encoder.encodeAll(it);
  const sharedOffset = it.offset;
  const bytes = encoder.encodeAllView(view, sharedOffset, it);
  const client = new ZoneState();
  new Decoder(client).decode(bytes);
  return client;
}

describe('§4.2 StateView AOI filtering with the real library', () => {
  it('a view that adds one player and one spawn yields exactly those to its decoder — none of the others', () => {
    const state = new ZoneState();
    const encoder = new Encoder(state);
    state.tick = 5;
    const own = player(UUID_A, 10, 10); // own avatar (always in view)
    const near = player(UUID_B, 20, 12);
    const far = player('33333333-3333-4333-8333-333333333333', 400, 400);
    state.players.set(own.id, own);
    state.players.set(near.id, near);
    state.players.set(far.id, far);
    const s1 = spawn('s1', 15, 15);
    const s2 = spawn('s2', 500, 500);
    const s3 = spawn('s3', -500, 12);
    state.spawns.set('s1', s1);
    state.spawns.set('s2', s2);
    state.spawns.set('s3', s3);

    const view = new StateView();
    view.add(own);
    view.add(near);
    view.add(s1);

    const client = decodeFullForView(encoder, view);

    expect([...client.players.keys()].sort()).toEqual([UUID_A, UUID_B].sort());
    expect([...client.spawns.keys()]).toEqual(['s1']);
    expect(client.players.get(UUID_B)?.toJSON()).toEqual(near.toJSON());
    expect(client.spawns.get('s1')?.toJSON()).toEqual(s1.toJSON());
    // broadcast fields still arrive
    expect(client.tick).toBe(5);

    // a second client with a different view sees a different, disjoint slice
    const view2 = new StateView();
    view2.add(far);
    view2.add(s2);
    const client2 = decodeFullForView(encoder, view2);
    expect([...client2.players.keys()]).toEqual([far.id]);
    expect([...client2.spawns.keys()]).toEqual(['s2']);
    view.dispose();
    view2.dispose();
  });

  it('view.add on a later tick delivers the entity as a patch; view.remove deletes it client-side', () => {
    const state = new ZoneState();
    const own = player(UUID_A, 0, 0);
    const other = player(UUID_B, 100, 100);
    const s1 = spawn('s1', 1, 1);
    state.players.set(own.id, own);
    state.players.set(other.id, other);
    state.spawns.set('s1', s1);

    const encoder = new Encoder(state);
    const view = new StateView();
    view.add(own);
    const client = new ZoneState();
    const decoder = new Decoder(client);

    // full sync
    let it: Iterator = { offset: 0 };
    encoder.encodeAll(it);
    decoder.decode(encoder.encodeAllView(view, it.offset, it));
    encoder.discardChanges();
    expect([...client.players.keys()]).toEqual([UUID_A]);
    expect(client.spawns.size).toBe(0);

    // tick: the viewer walked into range of `other` and `s1`
    state.tick = 1;
    other.x = 3;
    view.add(other);
    view.add(s1);
    it = { offset: 0 };
    encoder.encode(it);
    decoder.decode(encoder.encodeView(view, it.offset, it));
    encoder.discardChanges();
    expect([...client.players.keys()].sort()).toEqual([UUID_A, UUID_B].sort());
    expect(client.players.get(UUID_B)?.x).toBe(3);
    expect([...client.spawns.keys()]).toEqual(['s1']);

    // tick: walked back out
    state.tick = 2;
    view.remove(other);
    view.remove(s1);
    it = { offset: 0 };
    encoder.encode(it);
    decoder.decode(encoder.encodeView(view, it.offset, it));
    encoder.discardChanges();
    expect([...client.players.keys()]).toEqual([UUID_A]);
    expect(client.spawns.size).toBe(0);
    expect(client.tick).toBe(2);
    view.dispose();
  });

  it('a mutation on an entity outside the view is not delivered', () => {
    const state = new ZoneState();
    const own = player(UUID_A, 0, 0);
    const other = player(UUID_B, 300, 300);
    state.players.set(own.id, own);
    state.players.set(other.id, other);
    const encoder = new Encoder(state);
    const view = new StateView();
    view.add(own);
    const client = new ZoneState();
    const decoder = new Decoder(client);
    let it: Iterator = { offset: 0 };
    encoder.encodeAll(it);
    decoder.decode(encoder.encodeAllView(view, it.offset, it));
    encoder.discardChanges();

    other.x = 301;
    other.emote = 4;
    own.seq = 7;
    it = { offset: 0 };
    encoder.encode(it);
    decoder.decode(encoder.encodeView(view, it.offset, it));
    encoder.discardChanges();
    expect(client.players.has(UUID_B)).toBe(false);
    expect(client.players.get(UUID_A)?.seq).toBe(7);
    view.dispose();
  });
});

describe('§4.1 players are keyed by player uuid, not sessionId', () => {
  it('two sessions of one uuid collapse onto one PlayerState entry', () => {
    const state = new ZoneState();
    const encoder = new Encoder(state);
    const sessions = ['sess-1', 'sess-2'];
    for (const session of sessions) {
      const existing = state.players.get(UUID_A);
      if (existing) {
        // second tab: the new socket takes over the existing avatar (position kept)
        existing.seq += 1;
      } else {
        state.players.set(UUID_A, player(UUID_A, 5, 6));
      }
      expect(session).toBeTypeOf('string');
    }
    const view = new StateView();
    view.add(state.players.get(UUID_A)!);
    const client = decodeFullForView(encoder, view);
    expect(client.players.size).toBe(1);
    expect([...client.players.keys()]).toEqual([UUID_A]);
    expect(client.players.get(UUID_A)?.x).toBe(5);
    view.dispose();
  });
});
