/**
 * Weather from real life: the weather of the city the player picked in Settings, as the server last sent it
 * (`realWeather`, written by messageRouter; null: no city, or no answer yet). The world shows it instead of the zone's
 * weather; reset when the world connection ends.
 */
import { create } from 'zustand';
import type { WeatherKind } from '@ewa/core';

export interface RealWeatherUi {
  readonly kind: WeatherKind | null;
  set(kind: WeatherKind | null): void;
  reset(): void;
}

export const useRealWeatherStore = create<RealWeatherUi>()((set) => ({
  kind: null,
  set(kind) {
    set({ kind });
  },
  reset() {
    set({ kind: null });
  },
}));

/** How the weather reads in a sentence ("Rain in Rotterdam right now"). */
export const WEATHER_WORDS: Readonly<Record<WeatherKind, string>> = {
  none: 'Calm',
  sun: 'Sunshine',
  rain: 'Rain',
  sand: 'Strong wind',
  hail: 'Snow',
};
