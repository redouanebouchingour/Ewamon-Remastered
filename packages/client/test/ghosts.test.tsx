// @vitest-environment jsdom
/**
 * Ghost trainers on the client: a ghost foe is named after its owner; the Profile's ghost section says where it
 * haunts with its party, the record and the latest fights; nothing shows before the player ever left the world.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { foeIdentity } from '../src/battle/foe';
import { GhostSection } from '../src/screens/GhostSection';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const at = new Date(Date.now() - 3_600_000).toISOString();

beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);

describe('ghost trainers on the client', () => {
  it("a ghost foe is its owner's ghost", () => {
    expect(foeIdentity('ghost:ash')).toMatchObject({ name: "ash's ghost", title: 'Ghost trainer', league: null });
  });

  it('the Profile says where it haunts, its record and its fights', async () => {
    api.mockResolvedValue({ haunting: { zoneId: 'mire_route', leftAt: at, party: [{ speciesId: 'bramblecub', level: 12 }] }, won: 2, lost: 1, fights: [{ challenger: 'gary', zoneId: 'mire_route', won: true, at }] });
    render(<GhostSection />);
    const sec = await screen.findByTestId('ghost-section');
    expect(sec.textContent).toContain('It haunts Mire Route');
    expect(sec.textContent).toContain('Record: 2 won, 1 lost.');
    expect(sec.textContent).toContain('against gary on Mire Route');
    expect(api).toHaveBeenCalledWith('ghost', expect.anything());
  });

  it('nothing before the player ever left the world', async () => {
    api.mockResolvedValue({ haunting: null, won: 0, lost: 0, fights: [] });
    render(<GhostSection />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(screen.queryByTestId('ghost-section')).toBeNull();
  });
});
