/**
 * Weather from real life (game/realWeather.ts): find a city (Open-Meteo geocoding through the server, rate limited),
 * pick one or turn it off (the room holding the player hears it on `weatherTopic`), read the player's city and weather.
 */
import { RealWeatherRes, WeatherCitiesQuery, WeatherCitiesRes, WeatherCityReq } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { round1, weatherTopic } from '../../game/realWeather';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

export function registerWeatherRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/weather/cities', { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'weather') }, async (req) => {
    const { q } = WeatherCitiesQuery.parse(req.query);
    const cities = await deps.realWeather.search(q).catch(() => {
      throw new HttpError(503, 'weatherUnavailable');
    });
    return out(deps, WeatherCitiesRes, { cities });
  });

  app.post('/weather/city', bearer, async (req) => {
    const { city } = WeatherCityReq.parse(req.body);
    const id = req.user.sub;
    const stored =
      city === null ? null : { name: city.name, ...(city.region !== undefined && city.region !== '' ? { region: city.region } : {}), country: city.country, lat: round1(city.lat), lon: round1(city.lon) };
    await repos.db.transaction((tx) => repos.players.setWeatherCity(tx, id, stored));
    deps.bus.publish(weatherTopic(id), stored);
    const kind = stored === null ? null : await deps.realWeather.lookup(stored).catch(() => null);
    return out(deps, RealWeatherRes, { city: stored, kind });
  });

  app.get('/weather', bearer, async (req) => {
    const row = await repos.db.transaction((tx) => repos.players.byId(tx, req.user.sub));
    if (row === null) throw new HttpError(404, 'NotFound');
    const city = row.weatherCity ?? null;
    return out(deps, RealWeatherRes, { city, kind: city === null ? null : deps.realWeather.peek(city) });
  });
}
