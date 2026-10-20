/**
 * Weather from real life (Settings, World tab): find a city (`GET /weather/cities`, through the server), pick it
 * (`POST /weather/city`) or turn it off. The server keeps the city and looks its weather up; the room sends
 * `realWeather` and the world shows it. What the player sees here is read from `GET /weather`.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { WeatherCityView } from '@ewa/protocol';
import type { WeatherKind } from '@ewa/core';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { WEATHER_WORDS } from '../state/realWeather';
import { Button } from '../ui/Button';
import { FormError, TextField } from '../ui/Field';
import l from './layout.module.css';
import s from './WeatherSection.module.css';

/** "Rotterdam, South Holland, The Netherlands": the name, then the province or state and the country when known. */
export const cityLabel = (c: WeatherCityView): string => [c.name, c.region ?? '', c.country].filter((x) => x !== '').join(', ');

/** The line under the picked city: its weather now, or that the first report has not come in. */
export function weatherLine(kind: WeatherKind | null): string {
  return kind === null ? 'Waiting for the first weather report.' : `${WEATHER_WORDS[kind]} there right now.`;
}

export function WeatherSection() {
  const [city, setCity] = useState<WeatherCityView | null>(null);
  const [kind, setKind] = useState<WeatherKind | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<readonly WeatherCityView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('weather', { signal: ctl.signal })
      .then((r) => {
        setCity(r.city);
        setKind(r.kind);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!ctl.signal.aborted) setError(describeError(e));
      });
    return () => ctl.abort();
  }, []);

  const search = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (q.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      setFound((await apiFetch('weatherCities', { query: { q: q.trim() } })).cities);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (c: WeatherCityView | null): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch('weatherCity', { body: { city: c } });
      setCity(r.city);
      setKind(r.kind);
      setFound(null);
      setQ('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={l.section} aria-label="Weather from real life" data-testid="weather-section">
      <h4 className={l.sectionTitle}>Weather from real life</h4>
      <p className={l.caption}>
        Play in the weather of a city you choose. In the world and in your battles you get its weather instead of the zone&apos;s, and the
        types that like it turn up more often in tall grass. The server asks Open-Meteo for the weather at that place, to about 10 km, and
        sends nothing about you.
      </p>
      {loaded && city !== null && (
        <div className={s.current} data-testid="weather-current">
          <div className={s.city}>
            <span className={s.cityName}>{cityLabel(city)}</span>
            <span className={l.caption}>{weatherLine(kind)}</span>
          </div>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void pick(null)}>
            Turn off
          </Button>
        </div>
      )}
      {loaded && city === null && <p className={l.caption}>Off: the world follows each zone&apos;s own weather.</p>}
      <form className={s.search} onSubmit={(e) => void search(e)} role="search">
        <div className={s.field}>
          <TextField label={city === null ? 'Find your city' : 'Pick another city'} type="search" value={q} onChange={setQ} maxLength={60} autoComplete="off" />
        </div>
        <Button type="submit" busy={busy} disabled={q.trim().length < 2}>
          Search
        </Button>
      </form>
      {found !== null && found.length === 0 && <p className={l.caption}>No place by that name.</p>}
      {found !== null && found.length > 0 && (
        <ul className={s.results} aria-label="Places found">
          {found.map((c) => (
            <li key={`${c.name}|${c.country}|${c.lat}|${c.lon}`}>
              <Button size="sm" disabled={busy} onClick={() => void pick(c)}>
                {cityLabel(c)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error !== null && <FormError>{error}</FormError>}
    </section>
  );
}
