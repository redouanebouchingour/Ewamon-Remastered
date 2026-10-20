// @vitest-environment jsdom
/**
 * Phase C3 — the world map (`/play/map`) and the HUD minimap: the map lays every zone out at its content cell with the
 * player's visited state from the server's `visited:<zone>` flags, offers Travel only on visited towns other than the
 * current one (sending `fastTravel`), the nav and the `M` key reach it; the minimap renders without a 2D context
 * (jsdom) and its drawing runs against a recording context.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { ZONES, interiorWarps, interiorsFor, visitedFlag } from '@ewa/content';
import { routes } from '../src/app/router';
import { NAV } from '../src/app/TopBar';
import { MAP_LINKS, MAP_NODES, canTravelTo, visitedSet } from '../src/data/worldMap';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { DEFAULT_KEYBINDS, bindingConflict } from '../src/state/settings';
import { useSessionStore } from '../src/state/session';
import { Minimap } from '../src/world/Minimap';
import { drawBase, drawFrame, hallView, minimapIcons, project, viewAt, zoneView } from '../src/world/minimapDraw';
import type { Ctx2D } from '../src/world/minimapDraw';
import { inOneHour, json, makeJwt, meFixture } from './fixtures';

beforeAll(() => {
  try {
    new Request('http://localhost/', { signal: new AbortController().signal });
  } catch (_e) {
    const Native = globalThis.Request;
    class PatchedRequest extends Native {
      constructor(input: RequestInfo | URL, init: RequestInit = {}) {
        const { signal, ...rest } = init;
        super(input, rest);
        Object.defineProperty(this, 'signal', { value: signal ?? new AbortController().signal });
      }
    }
    globalThis.Request = PatchedRequest as typeof Request;
  }
});

const sent: { type: string; payload: unknown }[] = [];
const fakeWorld: WorldSession = {
  room: null,
  selfId: '',
  zoneId: null,
  enter: vi.fn(async () => undefined),
  send: vi.fn((type: string, payload: unknown) => void sent.push({ type, payload })) as WorldSession['send'],
  onMessage: () => () => undefined,
  handover: async () => undefined,
  leave: vi.fn(async () => undefined),
  onRoom: () => () => undefined,
  onReconnected: () => () => undefined,
  // arena PvP seams (unused here)
  arenaRoom: null,
  kind: 'zone',
  homeZone: null,
  enterArena: async () => undefined,
  returnToWorld: async () => undefined,
  onArena: () => () => undefined,
  subscribeState: () => () => undefined,
};

const FLAGS = [visitedFlag('mirevale'), visitedFlag('mire_route'), visitedFlag('cinderhold'), 'met_wynn'];

function respond(url: string): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  if (path === '/me') return json(meFixture({ flags: FLAGS, badges: ['bloom'] }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  // honor shapes the world: this season's shadowed zones
  if (path === '/world/shadow') return json({ season: 1, zones: [{ zoneId: 'mire_route', level: 2, light: 10, shadow: 40 }, { zoneId: 'vesperveil', level: 4, light: 0, shadow: 90 }] });
  return json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
}

beforeEach(() => {
  sent.length = 0;
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(url)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('world map model', () => {
  it('every zone has a node; links join neighbours', () => {
    expect(MAP_NODES.map((n) => n.id).sort()).toEqual(ZONES.map((z) => z.id).sort());
    for (const k of MAP_LINKS) {
      const a = MAP_NODES.find((n) => n.id === k.from)!;
      const b = MAP_NODES.find((n) => n.id === k.to)!;
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row), `${k.from}-${k.to}`).toBe(1);
    }
  });

  it('visited = the visited: flags plus the current zone; travel = a visited town that is not the current one', () => {
    const v = visitedSet([visitedFlag('cinderhold'), 'visited:nowhere', 'met_wynn'], 'mire_route');
    expect([...v].sort()).toEqual(['cinderhold', 'mire_route']);
    const node = (id: string) => MAP_NODES.find((n) => n.id === id)!;
    expect(canTravelTo(node('cinderhold'), v, 'mire_route')).toBe(true);
    expect(canTravelTo(node('mire_route'), v, 'mire_route')).toBe(false); // a route, and current
    expect(canTravelTo(node('saltmourn'), v, 'mire_route')).toBe(false); // never visited
    expect(canTravelTo(node('cinderhold'), v, 'cinderhold')).toBe(false); // you are here
  });

  it('the nav lists the map; M opens it and is bound to nothing else', () => {
    expect(NAV.map((n) => n.to)).toContain('/play/map');
    expect(DEFAULT_KEYBINDS.map).toEqual(['KeyM']);
    expect(bindingConflict(DEFAULT_KEYBINDS, 'map', 'KeyM')).toBeNull();
  });
});

describe('/play/map', () => {
  it('renders every zone with its visited state; Travel only on visited towns; Travel sends fastTravel', async () => {
    const router = createMemoryRouter(routes as RouteObject[], { initialEntries: ['/play/map'] });
    render(<RouterProvider router={router} />);
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    expect(within(panel).getByText('World map')).toBeTruthy();
    expect(within(panel).getByText(`3 of ${ZONES.length} explored`)).toBeTruthy();
    const zones = within(panel).getByRole('list', { name: 'Zones' });
    expect(within(zones).getAllByRole('listitem')).toHaveLength(ZONES.length);
    expect(within(zones).getByRole('listitem', { name: 'Mirevale, town, you are here' })).toBeTruthy();
    expect(within(zones).getByRole('listitem', { name: 'Mire Route, route, visited' })).toBeTruthy();
    expect(within(zones).getByRole('listitem', { name: 'Cinderhold, town, visited' })).toBeTruthy();
    expect(within(zones).getByRole('listitem', { name: 'Saltmourn, town, unexplored' })).toBeTruthy();

    // honor shapes the world: shadowed zones carry their tag (the deepest reads Hollowed); clear zones none
    await waitFor(() => expect(within(zones).getByRole('listitem', { name: 'Mire Route, route, visited' }).textContent).toContain('Shadow 2'));
    expect(within(zones).getByRole('listitem', { name: 'Vesperveil, town, unexplored' }).textContent).toContain('Hollowed');
    expect(within(zones).getByRole('listitem', { name: 'Cinderhold, town, visited' }).textContent).not.toContain('Shadow');

    const buttons = within(zones).getAllByRole('button', { name: /^Travel to / });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Travel to Cinderhold']);

    fireEvent.click(buttons[0]!);
    expect(sent).toEqual([{ type: 'fastTravel', payload: { zoneId: 'cinderhold' } }]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
  }, 30_000);

  it('the M key opens the map from the world', async () => {
    const router = createMemoryRouter(routes as RouteObject[], { initialEntries: ['/play'] });
    render(<RouterProvider router={router} />);
    await screen.findByTestId('playshell', {}, { timeout: 15000 });
    fireEvent.keyDown(window, { code: 'KeyM', key: 'm' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/map'));
  }, 30_000);
});

describe('HUD minimap', () => {
  it('renders without a 2D context (jsdom) and draws nothing', () => {
    render(<Minimap />);
    const el = screen.getByTestId('minimap');
    expect(el.querySelector('canvas')).not.toBeNull();
  });

  function recordingCtx(): Ctx2D & { calls: string[] } {
    const calls: string[] = [];
    const rec =
      (name: string) =>
      (..._a: unknown[]): void =>
        void calls.push(name);
    return {
      calls,
      createImageData: ((w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })) as unknown as Ctx2D['createImageData'],
      putImageData: rec('putImageData'),
      drawImage: rec('drawImage'),
      clearRect: rec('clearRect'),
      beginPath: rec('beginPath'),
      arc: rec('arc'),
      fill: rec('fill'),
      stroke: rec('stroke'),
      moveTo: rec('moveTo'),
      lineTo: rec('lineTo'),
      closePath: rec('closePath'),
      fillRect: rec('fillRect'),
      strokeRect: rec('strokeRect'),
      fillText: rec('fillText'),
      save: rec('save'),
      restore: rec('restore'),
      translate: rec('translate'),
      rotate: rec('rotate'),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
    } as Ctx2D & { calls: string[] };
  }

  it('the base rasterises the heightfield once with putImageData and marks exits + gym / shop / healer doors', () => {
    const v = zoneView('mirevale');
    const icons = minimapIcons('mirevale');
    expect(icons.filter((i) => i.kind === 'exit').map((i) => i.dir)).toEqual(['e']); // Mirevale links east only
    expect(icons.some((i) => i.kind === 'gym')).toBe(true);
    expect(icons.some((i) => i.kind === 'healer')).toBe(true);
    for (const i of icons) {
      const [x, y] = project(v, 168, i.x, i.z);
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(169);
      expect(y).toBeLessThanOrEqual(169);
    }
    const ctx = recordingCtx();
    drawBase(ctx, v, 168);
    expect(ctx.calls.filter((c) => c === 'putImageData')).toHaveLength(1);
    expect(ctx.calls.filter((c) => c === 'fillText').length).toBe(icons.filter((i) => i.kind !== 'exit').length);
    const frame = recordingCtx();
    drawFrame(frame, null, v, 168, { x: 0, z: 6, angle: 0 }, [{ x: 4, z: 6, angle: 0 }], 1);
    expect(frame.calls[0]).toBe('clearRect');
    expect(frame.calls.filter((c) => c === 'arc')).toHaveLength(2); // one other player + the player
  }, 60_000);

  it('inside a hall the view is the hall, in its own frame: the way out sits bottom-centre', () => {
    const healer = interiorsFor('mirevale').find((p) => p.def.id === 'mirevale.healer')!;
    const out = interiorWarps('mirevale').find((w) => w.id === 'mirevale.healer.out')!;
    const v = viewAt('mirevale', healer.footprint.x, healer.footprint.z);
    expect(v.hall).toBe(healer.def.label);
    expect(v).toEqual(hallView('mirevale', healer));
    const [cx, cy] = project(v, 168, healer.footprint.x, healer.footprint.z);
    expect(cx).toBeCloseTo(84, 5);
    expect(cy).toBeCloseTo(84, 5);
    const [ox, oy] = project(v, 168, out.x, out.z);
    expect(ox).toBeCloseTo(84, 3);
    expect(oy).toBeGreaterThan(100);
    const ctx = recordingCtx();
    drawBase(ctx, v, 168);
    expect(ctx.calls).toEqual(['putImageData']); // a hall draws its floor only
    expect(viewAt('mirevale', 0, 6).hall).toBeNull();
  }, 60_000);
});
