// @vitest-environment jsdom
/**
 * Camp bases on the client: the stakes and block lines; the Camp screen (a free camp to claim at the fire, someone
 * else's camp with its banner, trophies, guard and what a raid takes, your own camp's banner and trophy pick saved
 * through POST /camps/edit, a refused edit's words, the camp log); the world's camp views (the fire's target, the
 * render handle shown as the zone room says, the camp store); the guard's identity in battle; the zone spec's camp.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMP_REFUSAL_TEXT, campGuardTrainerId, campOf, zone } from '@ewa/content';
import type { CampView, CampsView } from '@ewa/protocol';

const sent: { type: string; payload: unknown }[] = [];
vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});
vi.mock('../src/net/WorldSession', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, getWorldSession: () => ({ send: (type: string, payload: unknown) => void sent.push({ type, payload }) }) };
});
vi.mock('react-router', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, useNavigate: () => () => undefined };
});

import { apiFetch } from '../src/net/api';
import { ApiFailure } from '../src/net/apiError';
import { foeIdentity } from '../src/battle/foe';
import { CAMP_TARGET_ID, CampViews, campPromptTarget, parseTrophies } from '../src/scene/CampViews';
import { InteractionTargets } from '../src/scene/interaction';
import { zoneSpecFor } from '../src/scene/zoneSpecFor';
import { CampScreen, raidBlock, raidStakes } from '../src/screens/CampScreen';
import { useCampStore } from '../src/state/camp';
import { useSessionStore } from '../src/state/session';
import { creature, meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const AGO = new Date(Date.now() - 3_600_000).toISOString();

const camp = (over: Partial<CampView> = {}): CampView => ({
  zoneId: 'mire_route',
  owner: 'bh_outlaw',
  name: 'Ironhold',
  trophies: [
    { id: 'legend:raikitsune', kind: 'legend', label: 'Raikitsune caught' },
    { id: 'medal:gold', kind: 'medal', label: 'Gold ranked medal' },
  ],
  guard: [{ speciesId: 'dustcub', level: 30, isShiny: false }],
  claimedAt: AGO,
  mine: false,
  ownerOnline: false,
  ownerInRun: false,
  inactive: false,
  raidedToday: false,
  cut: 120,
  ...over,
});
const view = (over: Partial<CampsView> = {}): CampsView => ({
  enabled: true,
  here: { zoneId: 'mire_route', camp: camp() },
  mine: camp({ zoneId: 'ash_route', owner: 'me', name: "me's camp", mine: true, cut: 0, trophies: [] }),
  earned: [
    { id: 'legend:raikitsune', kind: 'legend', label: 'Raikitsune caught' },
    { id: 'achievement:ach_dex_10', kind: 'achievement', label: 'Ten on the Page' },
    { id: 'bounty:b1', kind: 'bounty', label: 'Brought in kestrel' },
    { id: 'scar:n1', kind: 'scar', label: "Murkjaw the Drowned's scar" },
  ],
  log: [{ zoneId: 'ash_route', raider: 'kestrel', won: true, cut: 80, tookOver: false, line: 'kestrel raided your camp and took 80.', at: AGO }],
  camps: [
    { zoneId: 'mire_route', owner: 'bh_outlaw', name: 'Ironhold' },
    { zoneId: 'ash_route', owner: 'me', name: "me's camp" },
  ],
  you: { inRun: false, money: 4_000 },
  ...over,
});

beforeEach(() => {
  api.mockReset();
  sent.length = 0;
  useSessionStore.getState().hydrateFromMe(meFixture({ party: [creature('dustcub', { id: 'c1' })] }));
});
afterEach(cleanup);

describe('camp lines', () => {
  it('words the stakes and the blocks', () => {
    expect(raidStakes(camp())).toBe('A win takes 120 from bh_outlaw. A loss takes nothing. Raiding costs your lead 1 honor and darkens the route.');
    expect(raidStakes(camp({ cut: 0, inactive: true }))).toContain('nothing to take and, since they have been away so long, the camp itself');
    expect(raidBlock(camp(), false)).toBeNull();
    expect(raidBlock(camp({ ownerOnline: true }), false)).toBe(CAMP_REFUSAL_TEXT.ownerHome);
    expect(raidBlock(camp({ raidedToday: true }), false)).toBe(CAMP_REFUSAL_TEXT.raidedToday);
    expect(raidBlock(camp(), true)).toBe(CAMP_REFUSAL_TEXT.inRun);
    expect(parseTrophies('legend,medal,bogus')).toEqual(['legend', 'medal']);
    expect(parseTrophies('')).toEqual([]);
    expect(campPromptTarget('', '')).toBe("the travellers' camp");
    expect(campPromptTarget('bh_outlaw', 'Ironhold')).toBe('Ironhold');
    expect(foeIdentity(campGuardTrainerId('bh_outlaw'))).toMatchObject({ name: "bh_outlaw's guard", title: 'Camp guard' });
  });
});

describe('the Camp screen', () => {
  it("shows someone else's camp with its stakes, and raids it from the fire", async () => {
    api.mockResolvedValueOnce(view());
    render(<CampScreen />);
    await screen.findByTestId('camp-screen');
    expect(screen.getByText('Held by bh_outlaw')).toBeTruthy();
    expect(screen.getAllByText('Ironhold').length).toBe(2);
    expect(screen.getAllByText('Raikitsune caught').length).toBeGreaterThan(0);
    expect(screen.getByText(/A win takes 120 from bh_outlaw/)).toBeTruthy();
    expect(screen.getByText('kestrel raided your camp and took 80.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Raid the camp' }));
    expect(sent).toEqual([{ type: 'camp', payload: { action: 'raid' } }]);
  });

  it('a free camp is claimed at the fire; an owner at home has no raid button', async () => {
    api.mockResolvedValueOnce(view({ here: { zoneId: 'mire_route', camp: null }, mine: null }));
    render(<CampScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Claim this camp' }));
    expect(sent).toEqual([{ type: 'camp', payload: { action: 'claim' } }]);
    cleanup();
    api.mockResolvedValueOnce(view({ here: { zoneId: 'mire_route', camp: camp({ ownerOnline: true }) } }));
    render(<CampScreen />);
    await screen.findByText(CAMP_REFUSAL_TEXT.ownerHome);
    expect(screen.queryByRole('button', { name: 'Raid the camp' })).toBeNull();
  });

  it('the owner picks up to three trophies and raises a banner; a refused edit says why', async () => {
    api.mockResolvedValueOnce(view());
    render(<CampScreen />);
    await screen.findByTestId('camp-screen');
    const pick = (label: string) => fireEvent.click(screen.getAllByRole('button', { pressed: false }).find((b) => b.textContent?.includes(label))!);
    pick('Ten on the Page');
    pick('Brought in kestrel');
    pick("Murkjaw the Drowned's scar");
    // a fourth is not taken
    fireEvent.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Raikitsune'))!);
    expect(screen.getByText(/3 of 3/)).toBeTruthy();
    api.mockResolvedValueOnce(view({ mine: camp({ zoneId: 'ash_route', owner: 'me', mine: true, cut: 0, name: "me's camp" }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Set trophies' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('campEdit', { body: { trophies: ['achievement:ach_dex_10', 'bounty:b1', 'scar:n1'] } }));

    api.mockRejectedValueOnce(new ApiFailure({ status: 400, code: 'blockedWord', detail: null }));
    fireEvent.change(screen.getByLabelText('Banner'), { target: { value: 'bad words' } });
    fireEvent.click(screen.getByRole('button', { name: 'Raise banner' }));
    await screen.findByText('That word is not allowed.');
  });

  it('with camps off the screen says so', async () => {
    api.mockResolvedValueOnce(view({ enabled: false, here: null, mine: null, earned: [], log: [], camps: [] }));
    render(<CampScreen />);
    await screen.findByText(CAMP_REFUSAL_TEXT.campsOff);
  });
});

describe('the camp in the world', () => {
  it("puts the fire's target in the route, shows the room's camp on the render handle and in the store", () => {
    const shown: unknown[] = [];
    const targets = new InteractionTargets(() => undefined);
    const v = new CampViews({ targets, interactKey: () => 'E', camps: () => ({ ids: ['mire_route'], set: (_id, held) => void shown.push(held), shown: () => null }) });
    v.onZone(zone('mire_route'));
    const fire = campOf('mire_route')!.fire;
    expect(targets.dynamicEntry(CAMP_TARGET_ID)).toMatchObject({ kind: 'camp', x: fire.x, z: fire.z, prompt: { verb: 'Visit', target: "the travellers' camp" } });
    expect(shown.at(-1)).toBeNull();
    v.setState('mire_route', 'bh_outlaw', 'Ironhold', 'legend,medal');
    expect(shown.at(-1)).toEqual({ trophies: ['legend', 'medal'] });
    expect(targets.dynamicEntry(CAMP_TARGET_ID)?.prompt.target).toBe('Ironhold');
    expect(useCampStore.getState()).toMatchObject({ zoneId: 'mire_route', owner: 'bh_outlaw', name: 'Ironhold', trophies: ['legend', 'medal'] });
    // a state for another zone waits; a town has no camp
    v.setState('ash_route', 'x', 'y', 'scar');
    expect(shown.at(-1)).toBeNull();
    v.onZone(zone('mirevale'));
    expect(targets.dynamicEntry(CAMP_TARGET_ID)).toBeUndefined();
    expect(useCampStore.getState().zoneId).toBeNull();
    v.dispose();
  });

  it("a route's zone spec carries its camp; a town's none", () => {
    const spec = zoneSpecFor(zone('mire_route'), 'intact');
    const c = campOf('mire_route')!;
    expect(spec.camps).toEqual([{ id: 'mire_route', banner: c.banner, slots: c.slots }]);
    expect(zoneSpecFor(zone('mirevale'), 'intact').camps).toBeUndefined();
  });
});
