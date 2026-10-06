// @vitest-environment jsdom
/**
 * Phase C6 — /forgot, /reset?token=, /verify?token= and the settings "confirm your email" nudge, under the real route
 * table with a stubbed fetch.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { routes } from '../src/app/router';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { hasRefreshToken } from '../src/net/tokens';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { inOneHour, json, makeJwt, meFixture } from './fixtures';

// jsdom's AbortSignal and FormData are not the ones Node's Request accepts; React Router builds a Request per
// navigation and per <Form> submission. Strip the foreign signal and re-encode a jsdom FormData body as urlencoded.
beforeAll(() => {
  const Native = globalThis.Request;
  class PatchedRequest extends Native {
    constructor(input: RequestInfo | URL, init: RequestInit = {}) {
      const { signal, body, headers, ...rest } = init;
      // a <Form> post arrives as jsdom's URLSearchParams (or FormData): send it as an urlencoded string
      const foreign = body !== null && body !== undefined && typeof body === 'object' && typeof (body as { entries?: unknown }).entries === 'function';
      const encoded = foreign
        ? [...(body as unknown as Iterable<[string, unknown]>)].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
        : body;
      const h = new Headers(headers);
      if (foreign) h.set('content-type', 'application/x-www-form-urlencoded');
      super(input, { ...rest, headers: h, ...(encoded !== undefined ? { body: encoded } : {}) });
      Object.defineProperty(this, 'signal', { value: signal ?? new AbortController().signal });
    }
  }
  globalThis.Request = PatchedRequest as typeof Request;
});

const fakeWorld: WorldSession = {
  room: null,
  selfId: '',
  zoneId: null,
  enter: vi.fn(async () => undefined),
  send: vi.fn(),
  onMessage: () => () => undefined,
  handover: async () => undefined,
  leave: vi.fn(async () => undefined),
  onRoom: () => () => undefined,
  onReconnected: () => () => undefined,
  subscribeState: () => () => undefined,
};

/** the lazy screen chunks transform on first use: > 1 s when the whole client suite runs in parallel */
const SLOW = { timeout: 10_000 };
vi.setConfig({ testTimeout: 30_000 });

let overrides: Record<string, () => Response> = {};
const calls: { path: string; body: unknown }[] = [];

function respond(url: string, init?: RequestInit): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  calls.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
  const o = overrides[path];
  if (o !== undefined) return o();
  if (path === '/me') return json(meFixture());
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path.startsWith('/auth/')) return json(null, 204);
  return json({ code: 'NotFound' }, 404);
}

function mount(entries: string[]) {
  const router = createMemoryRouter(routes as RouteObject[], { initialEntries: entries });
  render(<RouterProvider router={router} />);
  return router;
}

const bodyOf = (path: string): unknown => calls.find((c) => c.path === path)?.body;

beforeEach(() => {
  overrides = {};
  calls.length = 0;
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('/forgot', () => {
  it('the login card links to it; submitting an email always shows the same "if an account uses it" confirmation', async () => {
    const router = mount(['/login']);
    fireEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }, SLOW));
    await screen.findByTestId('forgot', {}, SLOW);
    expect(router.state.location.pathname).toBe('/forgot');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await screen.findByText(/a reset link is on its way/, {}, SLOW);
    expect(screen.getByText('qa@example.com')).toBeTruthy();
    expect(bodyOf('/auth/forgot')).toEqual({ email: 'qa@example.com' });
  });

  it('an invalid address is refused locally; a 429 is shown as a form error', async () => {
    mount(['/forgot']);
    await screen.findByTestId('forgot', {}, SLOW);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await screen.findByText('Enter the email address you registered with.', {}, SLOW);
    expect(bodyOf('/auth/forgot')).toBeUndefined();
    overrides['/auth/forgot'] = () => json({ code: 'rateLimited' }, 429, { 'retry-after': '3600' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await screen.findByText(/Too many requests/, {}, SLOW);
  });
});

describe('/reset?token=', () => {
  it('without a token: the "not valid" state with a link to ask again', async () => {
    mount(['/reset']);
    await screen.findByTestId('reset', {}, SLOW);
    expect(screen.getByText(/This reset link is not valid/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toBeTruthy();
  });

  it('mismatched passwords are caught locally; success posts the token, ends this browser session and says so', async () => {
    storeTokens(makeJwt(inOneHour()), 'refresh-1');
    mount(['/reset?token=tok_abcdefghijklmnop']);
    await screen.findByTestId('reset', {}, SLOW);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a brand new passphrase' } });
    fireEvent.change(screen.getByLabelText('Repeat the new password'), { target: { value: 'something else entirely' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await screen.findByText('The two passwords differ.', {}, SLOW);
    expect(bodyOf('/auth/reset')).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Repeat the new password'), { target: { value: 'a brand new passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await screen.findByText(/Your password is changed/, {}, SLOW);
    expect(bodyOf('/auth/reset')).toEqual({ token: 'tok_abcdefghijklmnop', password: 'a brand new passphrase' });
    expect(hasRefreshToken()).toBe(false);
  });

  it('an expired link → the expired copy and a way to ask again', async () => {
    overrides['/auth/reset'] = () => json({ code: 'badToken', reason: 'expired' }, 400);
    mount(['/reset?token=tok_abcdefghijklmnop']);
    await screen.findByTestId('reset', {}, SLOW);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a brand new passphrase' } });
    fireEvent.change(screen.getByLabelText('Repeat the new password'), { target: { value: 'a brand new passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await screen.findByText(/This reset link has expired/, {}, SLOW);
  });
});

describe('/verify?token=', () => {
  it('confirms once through the loader', async () => {
    mount(['/verify?token=tok_abcdefghijklmnop']);
    await screen.findByText('Thanks — your email is confirmed.', {}, SLOW);
    expect(calls.filter((c) => c.path === '/auth/verify')).toHaveLength(1);
    expect(bodyOf('/auth/verify')).toEqual({ token: 'tok_abcdefghijklmnop' });
  });

  it('a used link says so', async () => {
    overrides['/auth/verify'] = () => json({ code: 'badToken', reason: 'used' }, 400);
    mount(['/verify?token=tok_abcdefghijklmnop']);
    await screen.findByText(/was already used/, {}, SLOW);
    expect(screen.getByRole('heading', { name: 'Could not confirm' })).toBeTruthy();
  });
});

describe('settings nudge (non-blocking)', () => {
  it('shows while unverified, resends on demand, and is absent once verified', async () => {
    storeTokens(makeJwt(inOneHour()), 'refresh-1');
    overrides['/me'] = () => json({ ...meFixture(), emailVerified: false });
    mount(['/play/settings']);
    const nudge = await screen.findByTestId('email-nudge', {}, { timeout: 15000 });
    expect(within(nudge).getByText('Confirm your email')).toBeTruthy();
    fireEvent.click(within(nudge).getByRole('button', { name: 'Resend link' }));
    await within(nudge).findByText('Link sent.', {}, SLOW);
    expect(calls.some((c) => c.path === '/auth/resend')).toBe(true);
    cleanup();
    useSessionStore.getState().clearSession();
    overrides['/me'] = () => json({ ...meFixture(), emailVerified: true });
    mount(['/play/settings']);
    await screen.findByTestId('panel', {}, { timeout: 15000 });
    await waitFor(() => expect(useSessionStore.getState().profile?.emailVerified).toBe(true));
    expect(screen.queryByTestId('email-nudge')).toBeNull();
  }, 30_000);
});
