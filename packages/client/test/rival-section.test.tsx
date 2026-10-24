// @vitest-environment jsdom
/**
 * A recurring rival on the Profile (screens/RivalSection.tsx, GET /rival): the rival's card (name, arc, temperament,
 * signature types, the record as a scoreboard, the last meeting, its parting words, the team it brought), the line
 * before the first meeting, nothing with the server's RIVAL=off, and a reload after a meeting.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RivalView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { RivalSection, lastLine } from '../src/screens/RivalSection';
import { resetRivalTalk, useRivalStore } from '../src/state/rival';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const ISO = new Date(Date.now() - 2 * 3_600_000).toISOString();
const D = String.fromCharCode(0x2014);

const rival: RivalView = {
  name: 'Corin',
  look: 'cowboy_male',
  temperament: 'brash',
  signature: 'cindercap',
  arc: 'frustrated',
  record: { playerWins: 3, rivalWins: 1, draws: 1, meetings: 5 },
  last: { result: 'won', zoneId: 'ash_route', at: ISO, words: 'You win again. I will be back.' },
  team: [{ speciesId: 'pyrecap', level: 22 }, { speciesId: 'glimp', level: 20 }],
};

beforeEach(() => {
  api.mockReset();
  resetRivalTalk();
});
afterEach(() => cleanup());

describe('the rivalry section', () => {
  it("shows the rival, its arc, the record, the last meeting, its words and the team it brought", async () => {
    api.mockResolvedValue({ enabled: true, rival });
    render(<RivalSection />);
    const section = await screen.findByTestId('rival-section');
    expect(api).toHaveBeenCalledWith('rival', expect.anything());
    const text = section.textContent ?? '';
    for (const s of ['Corin', 'Your rival', 'Frustrated', 'Loud and brash.', 'Leads with Pyrecap', 'Last met on Ash Route', 'you won.', 'You win again. I will be back.', 'Lv 22', 'Lv 20']) {
      expect(text).toContain(s);
    }
    const record = screen.getByLabelText('Record');
    expect(record.textContent).toBe('You3Corin1Draws1Battles5');
    expect(screen.getAllByTestId('typebadge').map((b) => b.getAttribute('data-type'))).toEqual(['Fire']);
    expect(text.includes(D)).toBe(false);
  });

  it('says what to expect before the first meeting', async () => {
    api.mockResolvedValue({ enabled: true, rival: null });
    render(<RivalSection />);
    expect((await screen.findByTestId('rival-section')).textContent).toContain('No rival yet');
  });

  it('is not there when the server runs without rivals', async () => {
    api.mockResolvedValue({ enabled: false, rival: null });
    const { container } = render(<RivalSection />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe('');
  });

  it('reloads after a meeting', async () => {
    api.mockResolvedValue({ enabled: true, rival: null });
    render(<RivalSection />);
    await screen.findByTestId('rival-section');
    api.mockResolvedValue({ enabled: true, rival });
    useRivalStore.getState().bump();
    await waitFor(() => expect(screen.getByTestId('rival-section').textContent).toContain('Corin'));
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('words the last meeting from the player side', () => {
    expect(lastLine({ ...rival, last: { ...rival.last!, result: 'lost' } })).toMatch(/: Corin won\.$/);
    expect(lastLine({ ...rival, last: { ...rival.last!, result: 'draw' } })).toMatch(/: a draw\.$/);
    expect(lastLine({ ...rival, last: null })).toBeNull();
  });
});
