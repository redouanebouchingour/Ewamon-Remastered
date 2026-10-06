/**
 * Phase D7 — `CreateBattleOpts.weather`: the zone's overworld weather as ambient battle weather.
 * Absent / 'none' leaves createBattle byte-identical (the 1,000-battle fuzz digests do not move).
 */
import { describe, expect, it } from 'vitest';
import { createBattle, digestBattleState } from '../src/index';
import type { CreateBattleOpts, TurnResult, WeatherKind } from '../src/index';
import { content, customMove, eventsOf, makeSide, move, turn } from './helpers';

const GROWL = customMove('Growl', 'D7:growl', { accuracy: 100 });
const SUNNY = customMove('Sandstorm', 'D7:sunny', { type: 'Fire', accuracy: 100 });

const SIDES: CreateBattleOpts['sides'] = [
  makeSide({ party: [{ species: 'bramblecub', level: 50, ability: 'Chlorophyll' }] }, 'player', 'wild', content),
  makeSide({ party: [{ species: 'mufflo', level: 50, ability: 'Natural Cure' }] }, 'foe', 'wild', content),
];

function opts(weather?: WeatherKind): CreateBattleOpts {
  return {
    id: 'd7',
    format: 'wild',
    zoneId: 'mire_route',
    terrain: 'grove',
    seed: 'd7-weather',
    sides: SIDES,
    ...(weather === undefined ? {} : { weather }),
  };
}

describe('Phase D7 ambient weather', () => {
  it("absent and 'none' produce the identical state, digest and events", () => {
    const a = createBattle(opts(), content);
    const b = createBattle(opts('none'), content);
    expect(digestBattleState(b.state)).toBe(digestBattleState(a.state));
    expect(b.events).toEqual(a.events);
    expect(a.state.field.weather).toEqual({ kind: 'none', turns: 0 });
    expect(eventsOf(a.events, 'weatherSet')).toEqual([]);
  });

  it('starts with the ambient weather and announces it before the switch-in hooks', () => {
    const r = createBattle(opts('rain'), content);
    expect(r.state.field.weather).toEqual({ kind: 'rain', turns: 0 });
    expect(r.events[0]).toEqual({ t: 'weatherSet', kind: 'rain', turns: 0, source: null });
  });

  it('ambient weather never counts down, never ticks, and keeps chipping (sand)', () => {
    let r: TurnResult = createBattle(opts('sand'), content);
    for (let i = 0; i < 8 && r.state.ended === null; i++) {
      r = turn(r.state, move(GROWL.id), move(GROWL.id));
      expect(r.state.field.weather).toEqual({ kind: 'sand', turns: 0 });
      expect(eventsOf(r.events, 'weatherTick')).toEqual([]);
      expect(eventsOf(r.events, 'weatherEnd')).toEqual([]);
      expect(eventsOf(r.events, 'damage').some((e) => e.cause === 'sand')).toBe(true);
    }
  });

  it("a move's weather replaces the ambient weather for its usual 5 turns", () => {
    let r: TurnResult = createBattle(opts('rain'), content);
    r = turn(r.state, move(SUNNY.id), move(GROWL.id));
    expect(r.state.field.weather).toEqual({ kind: 'sun', turns: 4 });
    for (let i = 0; i < 4; i++) r = turn(r.state, move(GROWL.id), move(GROWL.id));
    expect(r.state.field.weather).toEqual({ kind: 'none', turns: 0 });
    expect(eventsOf(r.events, 'weatherEnd')).toEqual([{ t: 'weatherEnd', kind: 'sun' }]);
  });
});
