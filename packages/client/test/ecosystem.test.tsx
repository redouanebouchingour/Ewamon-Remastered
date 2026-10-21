// @vitest-environment jsdom
/**
 * A living ecosystem on the Dex: the panel's words (a signed percentage, what was taken, the honor tilt, whether the
 * week is judged yet), which zones it can show (visited, with wild creatures; where you stand first), and the board
 * itself: surging hunters and what they hunt, the scarce prey, the migrants, the tilt, ??? for an unseen creature,
 * a pick opening the Dex entry, nothing at all while the server runs without it.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EcosystemView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { defaultEcoZone, ecoZones, factorLabel, takenLine, takesLine, tiltLine } from '../src/data/ecosystem';
import { zoneName } from '../src/data/content';
import { EcosystemPanel } from '../src/screens/EcosystemPanel';
import { useSessionStore } from '../src/state/session';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const sp = (speciesId: string, factor: number, cause: EcosystemView['surging'][number]['cause'], o: Partial<EcosystemView['surging'][number]> = {}) => ({
  speciesId,
  factor,
  cause,
  caught: 0,
  ko: 0,
  preyOn: [],
  huntedBy: [],
  ...o,
});
const VIEW: EcosystemView = {
  zoneId: 'deepcut_route',
  enabled: true,
  season: 1,
  week: 3,
  endsAt: '2026-10-26T00:00:00.000Z',
  takes: 40,
  judged: true,
  surging: [sp('pebfist', 2, 'feeding', { preyOn: ['pebblit'] })],
  scarce: [sp('pebblit', 0.5, 'hunted', { caught: 30, ko: 10, huntedBy: ['pebfist'] }), sp('wooltug', 0.5, 'away')],
  tilted: [],
  migrantsIn: [{ speciesId: 'tidespine', from: 'tide_route' }],
  migrantsOut: [{ speciesId: 'wooltug', to: 'umbral_observatory' }],
  shadow: 0,
  light: 0,
};

function progression(seen: string[]) {
  return { flags: ['visited:mire_route', 'visited:deepcut_route'], badges: [], dexSeen: seen, dexCaught: [], dexVariants: {}, dexAlpha: [], dexShiny: [] } as never;
}

beforeEach(() => {
  api.mockReset();
  useSessionStore.setState({ zoneId: 'deepcut_route', progression: progression(['pebfist', 'pebblit', 'wooltug']) });
});
afterEach(cleanup);

describe('the words', () => {
  it('a signed percentage, what was taken, the tilt, the week', () => {
    expect(factorLabel(2)).toBe('+100%');
    expect(factorLabel(0.5)).toBe('-50%');
    expect(factorLabel(1.004)).toBe('as usual');
    expect(takenLine({ caught: 30, ko: 10 })).toBe('30 caught · 10 knocked out this week');
    expect(takenLine({ caught: 0, ko: 0 })).toBe('Left alone this week');
    expect(tiltLine({ shadow: 2, light: 0 })).toContain('Dark and Ghost');
    expect(tiltLine({ shadow: 0, light: 3 })).toContain('rare');
    expect(tiltLine({ shadow: 0, light: 0 })).toContain('Clear');
    expect(takesLine({ takes: 1, judged: false })).toContain('1 catch or knockout this week');
    expect(takesLine({ takes: 40, judged: true })).toContain('hunters move in');
  });

  it('the zones: visited ones with wild creatures in map order; where you stand first, else the last one', () => {
    const zones = ecoZones(new Set(['mirevale', 'deepcut_route', 'mire_route']));
    expect(zones).toEqual(['mire_route', 'deepcut_route']);
    expect(defaultEcoZone('mire_route', zones)).toBe('mire_route');
    expect(defaultEcoZone('mirevale', zones)).toBe('deepcut_route');
    expect(defaultEcoZone(null, [])).toBeNull();
  });
});

describe('this week on a zone', () => {
  it('shows the zone where you stand: surging, scarce, migrants, the tilt; a pick opens the Dex entry', async () => {
    api.mockResolvedValue(VIEW);
    const pick = vi.fn();
    render(<EcosystemPanel onPick={pick} />);
    const panel = await screen.findByTestId('ecosystem-panel');
    expect(api).toHaveBeenCalledWith('worldEcosystem', expect.objectContaining({ params: { zoneId: 'deepcut_route' } }));
    expect(panel.textContent).toContain('This week on');
    expect(panel.textContent).toContain(zoneName('deepcut_route'));
    expect(panel.textContent).toContain('week 3 of 4');
    const surging = screen.getByTestId('eco-surging');
    expect(surging.textContent).toContain('Pebfist');
    expect(surging.textContent).toContain('+100%');
    expect(surging.textContent).toContain('Hunts Pebblit');
    const scarce = screen.getByTestId('eco-scarce');
    expect(scarce.textContent).toContain('30 caught · 10 knocked out this week');
    expect(scarce.textContent).toContain(`Gone to ${zoneName('umbral_observatory')} for the season`);
    // tidespine was never seen: a silhouette and ???, and it cannot be picked
    const migrants = screen.getByTestId('eco-migrants');
    expect(migrants.textContent).toContain('???');
    expect(migrants.textContent).toContain(`From ${zoneName('tide_route')}`);
    expect(migrants.querySelector('button')!.disabled).toBe(true);
    expect(screen.getByTestId('eco-tilt').textContent).toContain('Clear');
    fireEvent.click(screen.getByRole('button', { name: /^Pebblit/ }));
    expect(pick).toHaveBeenCalledWith('pebblit');
  });

  it('lists a darkened zone tilt with its creatures', async () => {
    api.mockResolvedValue({ ...VIEW, shadow: 3, tilted: [sp('rimeidol', 2.5, 'shadow')] });
    useSessionStore.setState({ progression: progression(['rimeidol']) });
    render(<EcosystemPanel onPick={() => undefined} />);
    const tilt = await screen.findByTestId('eco-tilt');
    expect(tilt.textContent).toContain('Shadow 3 of 4');
    expect(tilt.textContent).toContain('Rimeidol');
    expect(tilt.textContent).toContain('Drawn by the shadow');
  });

  it('shows nothing while the server runs without it, or where you have no wild zone yet', async () => {
    api.mockResolvedValue({ ...VIEW, enabled: false });
    const { container } = render(<EcosystemPanel onPick={() => undefined} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    cleanup();
    api.mockReset();
    useSessionStore.setState({ zoneId: 'mirevale', progression: { ...progression([]), flags: [] } });
    const again = render(<EcosystemPanel onPick={() => undefined} />);
    expect(again.container.textContent).toBe('');
    expect(api).not.toHaveBeenCalled();
  });
});
