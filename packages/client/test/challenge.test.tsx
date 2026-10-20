// @vitest-environment jsdom
/**
 * Challenge modes on the client: the Profile's run section switches the run (POST /challenge, then GET /me) and locks
 * after the first badge or a fallen creature, saying why; a fallen creature carries the "Fallen" mark; the lock reason.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHALLENGE_MODE_FLAG, FALLEN_RIBBON } from '@ewa/content';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { ChallengeSection, challengeLock } from '../src/screens/ChallengeSection';
import { useSessionStore } from '../src/state/session';
import { badgesOf } from '../src/ui/CreatureCard';
import { creature, meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  api.mockReset();
  useSessionStore.getState().hydrateFromMe(meFixture());
});
afterEach(() => {
  cleanup();
  useSessionStore.getState().clearSession();
});

describe('challenge modes on the client', () => {
  it('the lock: the first badge, then a fallen creature; none before', () => {
    expect(challengeLock(0, false)).toBeNull();
    expect(challengeLock(1, false)).toBe('Your first badge locked the run.');
    expect(challengeLock(0, true)).toBe('A creature has fallen: the run is locked.');
  });

  it('a fresh account switches to Nuzlocke: POST /challenge, then GET /me refreshes the session', async () => {
    const me = meFixture();
    api.mockImplementation(async (key: string) => {
      if (key === 'challenge') return { flags: [CHALLENGE_MODE_FLAG.nuzlocke] };
      if (key === 'me') return { ...me, flags: [CHALLENGE_MODE_FLAG.nuzlocke] };
      throw new Error(key);
    });
    render(<ChallengeSection />);
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Nuzlocke' })));
    expect(api).toHaveBeenCalledWith('challenge', { body: { mode: 'nuzlocke' } });
    await waitFor(() => expect(useSessionStore.getState().progression?.flags).toContain(CHALLENGE_MODE_FLAG.nuzlocke));
    expect((screen.getByRole('radio', { name: 'Nuzlocke' }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
  });

  it('after a fallen creature the run is locked and says why; the creature carries the Fallen mark', () => {
    const fallen = creature('glimfin', { hp: 0, ribbons: [FALLEN_RIBBON] });
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [creature('bramblecub'), fallen], flags: [CHALLENGE_MODE_FLAG.hardcore] }));
    render(<ChallengeSection />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByTestId('challenge-section').textContent).toContain('Hardcore');
    expect(screen.getByTestId('challenge-section').textContent).toContain('A creature has fallen: the run is locked.');
    expect(badgesOf(fallen)).toContain('fallen');
    expect(badgesOf(creature('glimfin'))).not.toContain('fallen');
  });
});
