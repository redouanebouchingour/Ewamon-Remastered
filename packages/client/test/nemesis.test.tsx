// @vitest-environment jsdom
/**
 * Nemeses on the client: the `nemesisAmbush` taunt as a lower third over its own battle (never another), the
 * `nemesisNews` toasts, the Profile's list (name, title, rank, scar, gained move, memory, last seen), the scar a caught
 * nemesis keeps in the creature detail, and the history lines.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nemesisScarRibbon } from '@ewa/content';
import type { NemesisView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { NemesisTaunt } from '../src/battle/NemesisTaunt';
import { routeServerMessage } from '../src/net/messageRouter';
import { ScarNote } from '../src/screens/CreatureDetail';
import { eventLine } from '../src/screens/CreatureHistory';
import { NemesesSection, memoryLine } from '../src/screens/NemesesSection';
import { useNemesisStore } from '../src/state/nemesis';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';
import { creature } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const ISO = new Date(Date.now() - 5 * 60_000).toISOString();
const ws = { handover: async () => undefined, selfId: 'me' } as unknown as Parameters<typeof routeServerMessage>[1];
const ambush = {
  battleId: 'b1',
  nemesisId: 'n1',
  name: 'Scarjaw',
  title: 'the Unbroken',
  speciesId: 'dustcub',
  scar: 'burn' as const,
  rank: 2,
  taunt: 'Scarjaw remembers your Pyrekit falling on Mire Route to Ember. It wants more.',
};
const view: NemesisView = {
  id: 'n1',
  name: 'Scarjaw',
  title: 'the Unbroken',
  speciesId: 'dustcub',
  level: 14,
  isShiny: false,
  scar: 'burn',
  move: 'Crunch',
  rank: 2,
  bornZone: 'mire_route',
  lastZone: 'ash_route',
  lastSeenAt: ISO,
  memory: { how: 'ko', zoneId: 'ash_route', foeSpecies: 'cindercap', foeName: null, move: 'Ember', orb: null },
};

const battle = (battleId: string) => useUiStore.setState({ battle: { battleId } as never });

beforeEach(() => {
  api.mockReset();
  useUiStore.getState().reset();
  useNemesisStore.setState({ ambush: null, pending: [], version: 0 });
  useNotificationsStore.setState({ toasts: [] });
});
afterEach(cleanup);

describe('the ambush taunt', () => {
  it('shows as a lower third over the battle the ambush opened', () => {
    routeServerMessage({ type: 'nemesisAmbush', ...ambush }, ws);
    battle('b1');
    render(<NemesisTaunt />);
    const third = screen.getByTestId('nemesis-taunt');
    expect(third.textContent).toContain('Scarjaw');
    expect(third.textContent).toContain('the Unbroken');
    expect(third.textContent).toContain('Rank 2');
    expect(third.textContent).toContain('Burn scar');
    expect(third.textContent).toContain('It wants more.');
    expect(screen.getByRole('status').getAttribute('aria-label')).toContain('rank 2');
  });

  it('never over another battle (and then it is dropped)', async () => {
    useNemesisStore.getState().setAmbush(ambush);
    battle('b2');
    render(<NemesisTaunt />);
    expect(screen.queryByTestId('nemesis-taunt')).toBeNull();
    await waitFor(() => expect(useNemesisStore.getState().ambush).toBeNull());
  });
});

describe('nemesis news', () => {
  it('a rise, a rank up, a knockout, a catch and a fade each say so; the list reloads', () => {
    const base = { nemesisId: 'n1', name: 'Scarjaw', title: 'the Unbroken', speciesId: 'dustcub', scar: 'torn_ear' as const, rank: 1, level: 9 };
    const said = (m: Parameters<typeof routeServerMessage>[0]): string => {
      routeServerMessage(m, ws);
      return useNotificationsStore.getState().toasts.at(-1)!.text;
    };
    expect(said({ type: 'nemesisNews', event: 'rose', ...base })).toBe('The Dustcub got away. It will remember you: Scarjaw the Unbroken.');
    expect(said({ type: 'nemesisNews', event: 'rankUp', ...base, rank: 3 })).toBe('Scarjaw the Unbroken got away again. It is rank 3 now.');
    expect(said({ type: 'nemesisNews', event: 'beaten', ...base })).toBe('Scarjaw the Unbroken is beaten. Your creature keeps the trophy.');
    expect(said({ type: 'nemesisNews', event: 'caught', ...base })).toBe('You caught Scarjaw the Unbroken. It keeps its name and its scar.');
    expect(said({ type: 'nemesisNews', event: 'faded', ...base })).toBe('Scarjaw the Unbroken has faded. A newer nemesis took its place.');
    expect(useNemesisStore.getState().version).toBe(5);
  });
  it('waits while the battle UI is open and is told once the player is back in the world', () => {
    battle('b1');
    routeServerMessage({ type: 'nemesisNews', event: 'beaten', nemesisId: 'n1', name: 'Scarjaw', title: 'the Unbroken', speciesId: 'dustcub', scar: 'burn', rank: 1, level: 9 }, ws);
    expect(useNotificationsStore.getState().toasts).toEqual([]);
    expect(useNemesisStore.getState().version).toBe(1);
    useUiStore.setState({ battle: null });
    expect(useNotificationsStore.getState().toasts.map((t) => t.text)).toEqual(['Scarjaw the Unbroken is beaten. Your creature keeps the trophy.']);
    expect(useNemesisStore.getState().pending).toEqual([]);
  });
});

describe('the Profile list', () => {
  it('lists each active nemesis with its rank, scar, gained move, memory and where it was last seen', async () => {
    api.mockResolvedValue({ nemeses: [view], max: 3 });
    render(<NemesesSection />);
    const section = await screen.findByTestId('nemeses-section');
    expect(api).toHaveBeenCalledWith('nemeses', expect.anything());
    const text = section.textContent ?? '';
    for (const s of ['Scarjaw', 'the Unbroken', 'Rank 2', 'Burn scar', 'knows Crunch', 'Knocked out your Cindercap with Ember on Ash Route.', 'Last seen on Ash Route', 'rose on Mire Route']) {
      expect(text).toContain(s);
    }
  });

  it('says how one rises when there is none', async () => {
    api.mockResolvedValue({ nemeses: [], max: 3 });
    render(<NemesesSection />);
    expect((await screen.findByTestId('nemeses-section')).textContent).toContain('None yet');
  });

  it('a breakout memory names the orb', () => {
    expect(memoryLine({ memory: { how: 'breakout', zoneId: 'mire_route', foeSpecies: 'bramblecub', foeName: 'Pip', move: null, orb: 'spark_orb' } })).toMatch(/^Broke out of your .+ in front of Pip on Mire Route\.$/);
  });
});

describe('a caught nemesis', () => {
  it('shows its scar in the creature detail; other creatures show none', () => {
    const { container, rerender } = render(<ScarNote creature={creature('dustcub', { nickname: 'Scarjaw', ribbons: [nemesisScarRibbon('cracked_horn')] })} />);
    expect(screen.getByTestId('nemesis-scar').textContent).toContain('Cracked horn');
    rerender(<ScarNote creature={creature('dustcub')} />);
    expect(container.textContent).toBe('');
  });

  it('the history says what it was, and who struck one down', () => {
    expect(eventLine({ kind: 'nemesis', at: ISO, how: 'caught', name: 'Scarjaw the Unbroken', speciesId: 'dustcub', rank: 2, zoneId: 'ash_route' })).toBe('Once Scarjaw the Unbroken, a rank 2 nemesis, caught on Ash Route.');
    expect(eventLine({ kind: 'nemesis', at: ISO, how: 'beaten', name: 'Scarjaw the Unbroken', speciesId: 'dustcub', rank: 1, zoneId: 'ash_route' })).toBe(
      'Struck down Scarjaw the Unbroken, a rank 1 nemesis Dustcub, on Ash Route. A trophy.',
    );
  });
});
