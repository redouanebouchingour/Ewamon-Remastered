// @vitest-environment jsdom
/**
 * Breeding on the client: the Daycare screen (the pair, the keeper's verdict, the ready egg taken, the creatures to
 * leave), the egg shelf (carried / box, moving one), the hatch reveal (egg, crack, the hatchling's line, Continue),
 * the `eggHatched` message queueing a reveal, the hatched history line, and a bandborn's transform toggle answering
 * the other band at its own hp line.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { createBattle, projectBattler } from '@ewa/core';
import type { BandKind, CreatureInstance } from '@ewa/core';
import type { DaycareView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { transformOffer } from '../src/battle/transform';
import { routeServerMessage } from '../src/net/messageRouter';
import { eventLine } from '../src/screens/CreatureHistory';
import { DaycareScreen, eggEta, verdictLine } from '../src/screens/DaycareScreen';
import { EggShelf } from '../src/screens/EggShelf';
import { useDaycareStore } from '../src/state/daycare';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { HatchReveal } from '../src/world/HatchReveal';
import { creature, meFixture } from './fixtures';
import { makeCreature } from './battleFuzz';

vi.mock('react-router', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, useNavigate: () => () => undefined };
});

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const content = createContentIndex();
const ISO = new Date(Date.now() + 7 * 60_000).toISOString();
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const rex = creature('badlander', { id: 'c-rex', nickname: 'Rex', level: 35 });
const law = creature('lawlander', { id: 'c-law', level: 35 });
const egg = { id: U1, place: 'party' as const, stepsTotal: 900, stepsWalked: 300, bandborn: true, parents: ['Rex', 'Lawlander'] as [string, string], zoneId: 'mirevale', laidAt: ISO };
const view = (over: Partial<DaycareView> = {}): DaycareView => ({
  zoneId: 'mirevale',
  pair: [rex, law] as DaycareView['pair'],
  refusal: null,
  hatches: 'dustcub',
  bandborn: true,
  eggAt: ISO,
  eggReady: false,
  eggs: [egg],
  carryMax: 3,
  eggMax: 12,
  ...over,
});

beforeEach(() => {
  api.mockReset();
  useDaycareStore.getState().reset();
  useUiStore.getState().reset();
  useSessionStore.getState().hydrateFromMe(meFixture({ party: [creature('bramblecub', { id: 'c-lead' }), creature('dustcub', { id: 'c-cub' })] }));
});
afterEach(cleanup);

describe('the Daycare screen', () => {
  it('the keeper\'s verdict reads as one line', () => {
    expect(verdictLine(view({ pair: [] }))).toContain('Leave two');
    expect(verdictLine(view({ pair: [rex] as DaycareView['pair'] }))).toContain('One is here');
    expect(verdictLine(view({ refusal: 'unrelated', hatches: null }))).toContain('share a type');
    expect(verdictLine(view({ refusal: 'legendary', hatches: null }))).toContain('Legends');
    expect(verdictLine(view())).toBe('They get along. Their eggs hatch into Dustcub.');
    expect(eggEta(new Date(Date.now() + 30_000).toISOString(), Date.now())).toBe('in under a minute');
    expect(eggEta(new Date(Date.now() + 6.5 * 60_000).toISOString(), Date.now())).toBe('in about 7 min');
  });

  it('shows the pair, the bandborn verdict and the eggs; a ready egg is taken', async () => {
    api.mockResolvedValue(view({ eggReady: true }));
    render(<DaycareScreen />);
    const d = await screen.findByTestId('daycare');
    expect(d.textContent).toContain('Rex');
    expect(d.textContent).toContain('Lawlander');
    expect(screen.getByTestId('daycare-verdict').textContent).toContain('Bandborn');
    expect(screen.getAllByTestId('egg-card')).toHaveLength(1);
    // two are left: nothing more can be left
    expect(d.textContent).toContain('The keeper minds two at a time');
    api.mockResolvedValue({ daycare: view({ eggs: [egg, { ...egg, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] }), party: [creature('bramblecub', { id: 'c-lead' })], box: [] });
    fireEvent.click(screen.getByRole('button', { name: /take the egg/i }));
    await waitFor(() => expect(screen.getAllByTestId('egg-card')).toHaveLength(2));
    expect(api).toHaveBeenCalledWith('daycareCollect', { body: {} });
    expect(useSessionStore.getState().inventory?.party.map((c) => c.id)).toEqual(['c-lead']);
  });

  it('leaves a creature from the party or the box (the last party member stays)', async () => {
    api.mockResolvedValue(view({ pair: [], hatches: null, bandborn: false, eggAt: null, eggs: [] }));
    render(<DaycareScreen />);
    await screen.findByTestId('daycare');
    const leave = screen.getAllByRole('button', { name: 'Leave' });
    expect(leave).toHaveLength(2);
    api.mockResolvedValue({ daycare: view({ pair: [creature('dustcub', { id: 'c-cub' })] as DaycareView['pair'], hatches: null, bandborn: false, eggAt: null, eggs: [] }), party: [creature('bramblecub', { id: 'c-lead' })], box: [] });
    fireEvent.click(leave[1]!);
    await waitFor(() => expect(api).toHaveBeenCalledWith('daycareLeave', { body: { id: 'c-cub' } }));
    await waitFor(() => expect(screen.getByTestId('daycare-verdict').textContent).toContain('One is here'));
  });
});

describe('the egg shelf', () => {
  it('lists the carried eggs with their steps; one goes to the box', async () => {
    api.mockResolvedValue(view());
    render(<EggShelf place="party" title="Eggs you carry" />);
    const sec = await screen.findByTestId('eggs-party');
    expect(sec.textContent).toContain('1 / 3 carried');
    expect(sec.textContent).toContain('600 steps to go');
    expect(sec.textContent).toContain('Rex × Lawlander');
    api.mockResolvedValue({ daycare: view({ eggs: [{ ...egg, place: 'box' }] }), party: [creature('bramblecub', { id: 'c-lead' })], box: [] });
    fireEvent.click(screen.getByRole('button', { name: 'To box' }));
    await waitFor(() => expect(screen.queryByTestId('eggs-party')).toBeNull());
    expect(api).toHaveBeenCalledWith('eggMove', { params: { id: U1 }, body: { place: 'box' } });
  });
});

describe('the hatch', () => {
  it('eggHatched queues the reveal: the egg, then the hatchling and its line; Continue closes it', async () => {
    vi.useFakeTimers();
    try {
      api.mockResolvedValue(view({ eggs: [] }));
      const born = creature('dustcub', { id: 'c-born', level: 1, bandborn: true, isShiny: true });
      routeServerMessage({ type: 'eggHatched', eggId: U1, creature: born, placement: 'party', parents: ['Rex', 'Lawlander'], zoneId: 'mirevale' }, { handover: async () => undefined, selfId: 'p' });
      expect(useDaycareStore.getState().hatches).toHaveLength(1);
      render(<HatchReveal />);
      expect(screen.getByTestId('hatch-reveal').getAttribute('data-phase')).toBe('wobble');
      expect(screen.getByTestId('egg').getAttribute('data-bandborn')).toBe('true');
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      const layer = screen.getByTestId('hatch-reveal');
      expect(layer.getAttribute('data-phase')).toBe('reveal');
      expect(layer.textContent).toContain('Dustcub hatched!');
      expect(layer.textContent).toContain('From Rex and Lawlander');
      expect(layer.textContent).toContain('Shiny');
      expect(layer.textContent).toContain('Bandborn');
      expect(layer.textContent).toContain('joined your party');
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.queryByTestId('hatch-reveal')).toBeNull();
      expect(useDaycareStore.getState().hatches).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a click skips to the reveal', () => {
    useDaycareStore.getState().pushHatch({ eggId: U1, creature: creature('dustcub', { id: 'c-b', level: 1 }), placement: 'box', parents: ['A', 'B'], zoneId: 'mirevale' });
    render(<HatchReveal />);
    fireEvent.click(screen.getByTestId('hatch-reveal'));
    expect(screen.getByTestId('hatch-reveal').textContent).toContain('went to your box');
  });

  it('the history says where it hatched and from whom', () => {
    expect(eventLine({ kind: 'hatched', at: ISO, speciesId: 'dustcub', zoneId: 'mirevale', parents: ['Rex', 'Lawlander'], trainer: 'ash' })).toBe('Hatched by ash at Mirevale from Rex and Lawlander.');
  });
});

describe('a bandborn in battle', () => {
  function state(c: CreatureInstance, bands: readonly BandKind[]) {
    const foe = makeCreature(content, content.species('mossling'), 40, 'f-0', null);
    const side = (party: CreatureInstance[], kind: 'player' | 'npc', id: string) => ({ kind, party: party.map((x) => projectBattler(x, content)), active: 0, trainerId: id, canFlee: false, canCatch: false });
    return createBattle({ id: 'bb', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 7, sides: [{ ...side([c], 'player', 'p0'), bands }, side([foe], 'npc', 'n')] }, content).state;
  }

  it('its Majin form answers the Tenjin Band while healthy; a plain one does not', () => {
    const base = makeCreature(content, content.species('badlander'), 40, 'm-0', 'p0');
    const healthy = { ...base, bandborn: true as const };
    const st = state(healthy, ['tenjin']);
    expect(transformOffer(st, 0, st.sides[0].party[0])).toEqual({ kind: 'tenjin', enabled: true, reason: null });
    const plain = state(base, ['tenjin']);
    expect(transformOffer(plain, 0, plain.sides[0].party[0])).toBeNull();
  });
});
