// @vitest-environment jsdom
/**
 * Weather from real life on the client: the store follows the server's `realWeather`; the Settings section reads
 * the player's city, searches through the server, picks a place and turns it off.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { routeServerMessage } from '../src/net/messageRouter';
import type { WorldSession } from '../src/net/WorldSession';
import { WeatherSection, cityLabel, weatherLine } from '../src/screens/WeatherSection';
import { useRealWeatherStore } from '../src/state/realWeather';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const rotterdam = { name: 'Rotterdam', country: 'Netherlands', lat: 51.9, lon: 4.5 };

beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);

describe('weather from real life on the client', () => {
  it("the store takes the server's word and lets go of it", () => {
    routeServerMessage({ type: 'realWeather', kind: 'rain' }, {} as WorldSession);
    expect(useRealWeatherStore.getState().kind).toBe('rain');
    routeServerMessage({ type: 'realWeather', kind: null }, {} as WorldSession);
    expect(useRealWeatherStore.getState().kind).toBeNull();
    expect(weatherLine('hail')).toBe('Snow there right now.');
    expect(weatherLine(null)).toBe('Waiting for the first weather report.');
    expect(cityLabel({ ...rotterdam, country: '' })).toBe('Rotterdam');
    expect(cityLabel({ ...rotterdam, region: 'South Holland' })).toBe('Rotterdam, South Holland, Netherlands');
  });

  it('finds a city, picks it, and turns it off', async () => {
    api.mockImplementation(async (key: string, init?: { query?: { q: string }; body?: { city: unknown } }) => {
      if (key === 'weather') return { city: null, kind: null };
      if (key === 'weatherCities') return { cities: init?.query?.q === 'Rotter' ? [rotterdam] : [] };
      if (key === 'weatherCity') return init?.body?.city === null ? { city: null, kind: null } : { city: rotterdam, kind: 'rain' };
      throw new Error(key);
    });
    render(<WeatherSection />);
    await waitFor(() => expect(screen.getByText(/Off: the world follows/)).toBeTruthy());
    const field = screen.getByLabelText('Find your city');
    fireEvent.change(field, { target: { value: 'Nowhere' } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(screen.getByText('No place by that name.')).toBeTruthy());
    fireEvent.change(field, { target: { value: 'Rotter' } });
    fireEvent.submit(field.closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Rotterdam, Netherlands' }));
    await waitFor(() => expect(screen.getByTestId('weather-current').textContent).toContain('Rain there right now.'));
    expect(api).toHaveBeenCalledWith('weatherCity', { body: { city: rotterdam } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(screen.queryByTestId('weather-current')).toBeNull());
    expect(api).toHaveBeenLastCalledWith('weatherCity', { body: { city: null } });
  });
});
