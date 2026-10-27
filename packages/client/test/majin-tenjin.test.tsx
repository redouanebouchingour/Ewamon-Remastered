// @vitest-environment jsdom
/**
 * Majin / Tenjin in the client (`.design/majin-tenjin.md`): the battle menu's transform toggle (shown only with the
 * band of the battler's form kind and before the side has transformed; enabled only when core's `transformError` is
 * null; the reason as a caption; armed, the next move goes out with `transform: true`, singles and doubles; key T; it
 * resets after the submit), the one-time coach mark, the band card's steps, and the form sigil on party / box / Dex.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createContentIndex } from '@ewa/content';
import { createBattle, digestBattleState, projectBattler } from '@ewa/core';
import type { Action, BandKind, BattleEvent, BattleState, CreatureInstance } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController, patchFromEvents } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { BattleMenu, moveAction } from '../src/battle/BattleMenu';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { ACTION_ERROR_LABEL } from '../src/battle/labels';
import { ALREADY_TRANSFORMED, LINE_REASON, OTHER_ARMED, transformOffer } from '../src/battle/transform';
import {
  BAND_STEPS, COACH_LINE, bandAccountOf, bandsHeld, currentBandStep, fieldKinds, noteBand, transformedKind, useBandTutorialStore,
} from '../src/state/bandTutorial';
import { useArenaStore } from '../src/state/arena';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import type { BattleUi } from '../src/state/ui';
import { DexScreen } from '../src/screens/DexScreen';
import { CreatureCard } from '../src/ui/CreatureCard';
import { FormMark, formKindOf, formMarkLabel } from '../src/ui/FormSigil';
import { BandTutorialCard } from '../src/world/BandTutorialCard';
import { creature, meFixture } from './fixtures';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-00000000a7e1';

beforeAll(() => {
  // jsdom's Request rejects the router's AbortSignal (the same patch as the other router tests)
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

beforeEach(() => {
  localStorage.clear();
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
  useBandTutorialStore.setState({ accounts: {} });
});
afterEach(() => {
  cleanup();
  setBattleActions(null);
  useSessionStore.getState().clearSession();
});

// ---- a live controller behind the menu -------------------------------------------------------------------------

function controller() {
  const sent: { type: string; payload: unknown }[] = [];
  const noop = (): undefined => undefined;
  const view: BattleView = {
    enterBattle: noop, exitBattle: noop, setBattler: noop, setPose: noop, hurt: noop, vfx: noop, prewarm: noop, syncFrom: noop,
    setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => false, slowmoEnabled: () => false,
    playSfx: noop, setBattleHud: noop, setThreat: noop,
  };
  const c = createBattleController({
    content, send: (type, payload) => sent.push({ type, payload }), reduced: () => false, instantText: () => true,
    selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult(), undoPick: () => c.undoPick() });
  const playOut = (): void => {
    for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  return { c, sent, playOut };
}

function withSide0(st: BattleState, patch: Partial<BattleState['sides'][0]>): BattleState {
  return { ...st, sides: [{ ...st.sides[0], ...patch }, st.sides[1]] };
}

/** A singles wild battle: our `speciesId` at `hpFrac` of max, the side holding `bands`. */
function singles(speciesId: string, hpFrac: number, bands: readonly BandKind[] | undefined, extra: Partial<BattleState['sides'][0]> = {}) {
  const t = controller();
  const base = makeCreature(content, content.species(speciesId), 40, 'mine-1', 'p0');
  const me = { ...base, hp: Math.max(1, Math.floor(base.hp * hpFrac)) };
  const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
  const r = startBattle(content, 11, 'wild', [me], [foe]);
  const state = withSide0(r.state, { ...(bands !== undefined ? { bands } : {}), ...extra });
  const msg: ServerMessageOf<'battleStart'> = { type: 'battleStart', battleId: BID, format: 'wild', seat: 0, state, events: [...r.events] as BattleEvent[], stateDigest: digestBattleState(state) };
  t.c.onBattleStart(msg);
  t.playOut();
  render(<BattleMenu />);
  return { ...t, state };
}

const toggle = (): HTMLElement | null => screen.queryByTestId('transform-toggle');
const firstMove = (): HTMLElement => screen.getAllByTestId('movebutton')[0]!;
const lastAction = (sent: readonly { type: string; payload: unknown }[]): Action => (sent.filter((m) => m.type === 'battleAction').at(-1)!.payload as { action: Action }).action;
const press = (key: string): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
};

describe('the transform toggle (singles)', () => {
  it('is not shown without the band, with the other kind’s band, or after the side has transformed', () => {
    singles('toxshade', 0.3, undefined);
    expect(toggle()).toBeNull();
    cleanup();
    singles('toxshade', 0.3, ['tenjin']);
    expect(toggle()).toBeNull();
    cleanup();
    singles('toxshade', 0.3, ['majin'], { transformed: true });
    expect(toggle()).toBeNull();
    cleanup();
    singles('mossling', 0.3, ['majin', 'tenjin']);   // no form at all
    expect(toggle()).toBeNull();
  });

  it('Majin above the line: shown, disabled, its reason as a caption', () => {
    singles('toxshade', 1, ['majin']);
    const t = toggle()!;
    expect(t.getAttribute('data-kind')).toBe('majin');
    expect((t as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(LINE_REASON.majin)).toBeTruthy();
    expect(t.getAttribute('aria-describedby')).toBe(screen.getByText(LINE_REASON.majin).id);
  });

  it('Majin below half: enabled; armed, the next move goes out with transform: true and the toggle resets', () => {
    const { sent } = singles('toxshade', 0.3, ['majin']);
    const t = toggle()! as HTMLButtonElement;
    expect(t.disabled).toBe(false);
    expect(t.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('battle-ticker').textContent).toContain('Majin');   // the T key hint
    fireEvent.click(t);
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(firstMove());
    const a = lastAction(sent);
    expect(a).toMatchObject({ kind: 'move', transform: true });
    expect(useUiStore.getState().battle!.phase).toBe('submitted');
    expect(toggle()).toBeNull();
  });

  it('key T arms and disarms it; an unarmed pick carries no transform', () => {
    const { sent } = singles('toxshade', 0.3, ['majin']);
    press('t');
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true');
    press('T');
    expect(toggle()!.getAttribute('aria-pressed')).toBe('false');
    press('1');
    expect(lastAction(sent)).not.toHaveProperty('transform');
  });

  it('Tenjin: enabled at or above half, disabled below it', () => {
    singles('gemknight', 1, ['tenjin']);
    expect((toggle() as HTMLButtonElement).disabled).toBe(false);
    expect(toggle()!.getAttribute('data-kind')).toBe('tenjin');
    cleanup();
    singles('gemknight', 0.3, ['tenjin']);
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(LINE_REASON.tenjin)).toBeTruthy();
  });

  it('the coach mark shows the first time the toggle is enabled, once per kind per account', () => {
    singles('toxshade', 0.3, ['majin']);
    expect(screen.getByTestId('transform-coach').textContent).toContain(COACH_LINE.majin);
    expect(bandAccountOf(useBandTutorialStore.getState(), '').coached).toEqual(['majin']);
    cleanup();
    useUiStore.getState().reset();
    singles('toxshade', 0.3, ['majin']);
    expect(screen.queryByTestId('transform-coach')).toBeNull();
    cleanup();
    useUiStore.getState().reset();
    singles('gemknight', 1, ['tenjin']);
    expect(screen.getByTestId('transform-coach').textContent).toContain(COACH_LINE.tenjin);
  });
});

describe('transformOffer (pure) and the doubles rule', () => {
  const MOVES = ['Tackle', 'Rock Slide', 'Growl', 'Bulk Up'];
  function mon(species: string, id: string, owner: string | null, hpFrac = 1): CreatureInstance {
    const c = makeCreature(content, content.species(species), 40, id, owner);
    return { ...c, hp: Math.max(1, Math.floor(c.hp * hpFrac)), moves: MOVES.map((m) => ({ id: m, pp: content.move(m).pp, ppMax: content.move(m).pp })) };
  }
  function doubles(bands: readonly BandKind[]): { state: BattleState; events: readonly BattleEvent[] } {
    const p0 = [mon('toxshade', 'm-0', 'p0', 0.3), mon('badlander', 'm-1', 'p0', 0.3), mon('mossling', 'm-2', 'p0')];
    const p1 = [mon('mossling', 'f-0', null), mon('bramblecub', 'f-1', null), mon('mufflo', 'f-2', null)];
    const side = (party: CreatureInstance[], kind: 'player' | 'npc', id: string) => ({
      kind, party: party.map((c) => projectBattler(c, content)), active: 0, actives: [0, 1] as [number, number], trainerId: id, canFlee: false, canCatch: false,
    });
    const r = createBattle({ id: 'mt', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 404, slots: 2, sides: [{ ...side(p0, 'player', 'p0'), bands }, side(p1, 'npc', 'npc_t')] }, content);
    return { state: r.state, events: r.events };
  }

  it('words the reasons; the other doubles position armed takes the side’s one transformation', () => {
    const { state } = doubles(['majin']);
    const b0 = state.sides[0].party[0]!;
    expect(transformOffer(state, 0, b0)).toEqual({ kind: 'majin', enabled: true, reason: null });
    expect(transformOffer(state, 0, b0, moveAction('Tackle', undefined, true))).toEqual({ kind: 'majin', enabled: false, reason: OTHER_ARMED });
    expect(transformOffer(state, 0, b0, moveAction('Tackle'))?.enabled).toBe(true);
    expect(transformOffer(state, 0, { ...b0, form: 'majin' })).toEqual({ kind: 'majin', enabled: false, reason: ALREADY_TRANSFORMED });
    expect(transformOffer(state, 0, { ...b0, creature: { ...b0.creature, hp: 0 } })?.reason).toBe(ACTION_ERROR_LABEL.cannotTransform);
    expect(transformOffer(withSide0(state, { transformed: true }), 0, b0)).toBeNull();
    expect(transformOffer(state, 0, state.sides[0].party[2])).toBeNull();
    expect(moveAction('Tackle', { side: 1, pos: 0 }, true)).toEqual({ kind: 'move', move: 'Tackle', target: { side: 1, pos: 0 }, transform: true });
    expect(moveAction('Tackle')).toEqual({ kind: 'move', move: 'Tackle' });
  });

  it('doubles: position 0 arms and picks; position 1’s toggle is disabled; both actions go out, only one transforms', () => {
    const t = controller();
    const { state, events } = doubles(['majin']);
    t.c.onBattleStart({ type: 'battleStart', battleId: BID, format: 'trainer', seat: 0, state, events: [...events], stateDigest: digestBattleState(state) });
    t.playOut();
    render(<BattleMenu />);
    fireEvent.click(toggle()!);
    const growl = (): HTMLElement => screen.getAllByTestId('movebutton').find((b) => b.textContent?.includes('Growl'))!;
    fireEvent.click(growl());
    expect(useUiStore.getState().battle!.pick?.picks[0]).toEqual({ kind: 'move', move: 'Growl', transform: true });
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    expect(toggle()!.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(OTHER_ARMED)).toBeTruthy();
    fireEvent.click(growl());
    const actions = t.sent.filter((m) => m.type === 'battleAction').map((m) => (m.payload as { action: Action }).action);
    expect(actions).toEqual([{ kind: 'move', move: 'Growl', transform: true }, { kind: 'move', move: 'Growl' }]);
  });

  it('patchFromEvents (pvp, no preview): a formChange sets the form and marks a trainer side transformed', () => {
    const { state } = doubles(['majin']);
    const next = patchFromEvents(state, [{ t: 'formChange', who: { side: 0, slot: 0 }, form: 'majin', atk: 1, def: 1, spd: 1 }], 2, state.rng);
    expect(next.sides[0].party[0]!.form).toBe('majin');
    expect(next.sides[0].transformed).toBe(true);
    expect(next.sides[1].transformed).toBeUndefined();
    expect(transformedKind(next, 0)).toBe('majin');
    expect(transformedKind(state, 0)).toBeNull();
    expect(fieldKinds(state, 0)).toEqual(['majin']);
  });
});

// ---- the band card --------------------------------------------------------------------------------------------

describe('band tutorial (pure)', () => {
  it('three steps per band; the first unseen is current; a transformation completes the card', () => {
    expect(BAND_STEPS.majin.map((s) => s.event)).toEqual(['openedParty', 'formOnField', 'transformed']);
    expect(BAND_STEPS.tenjin).toHaveLength(3);
    expect(currentBandStep('majin', [])?.id).toBe('majin_party');
    expect(currentBandStep('tenjin', ['openedParty'])?.id).toBe('tenjin_field');
    expect(currentBandStep('majin', ['formOnField'])?.id).toBe('majin_party');
    expect(noteBand({ seen: [], done: false }, 'majin', 'openedParty')).toEqual({ seen: ['openedParty'], done: false });
    expect(noteBand({ seen: [], done: false }, 'majin', 'transformed')).toEqual({ seen: ['transformed'], done: true });
    const done = { seen: ['openedParty' as const], done: true };
    expect(noteBand(done, 'majin', 'formOnField')).toBe(done);
    expect(bandsHeld({ tenjin_band: 1, majin_band: 1, potion: 3 })).toEqual(['majin', 'tenjin']);
    expect(bandsHeld({ majin_band: 0 })).toEqual([]);
  });

  it('the store keeps each band’s card and the coach marks per account', () => {
    const st = useBandTutorialStore.getState();
    expect(st.note('a1', 'majin', 'openedParty')).toBe(true);
    expect(st.note('a1', 'majin', 'openedParty')).toBe(false);
    useBandTutorialStore.getState().finish('a1', 'tenjin');
    expect(useBandTutorialStore.getState().coach('a1', 'majin')).toBe(true);
    expect(useBandTutorialStore.getState().coach('a1', 'majin')).toBe(false);
    const acc = bandAccountOf(useBandTutorialStore.getState(), 'a1');
    expect(acc).toEqual({ majin: { seen: ['openedParty'], done: false }, tenjin: { seen: [], done: true }, coached: ['majin'] });
    expect(bandAccountOf(useBandTutorialStore.getState(), 'a2')).toEqual({ majin: { seen: [], done: false }, tenjin: { seen: [], done: false }, coached: [] });
    expect(JSON.parse(localStorage.getItem('ewa.bandTutorial') ?? '{}').state.accounts.a1.coached).toEqual(['majin']);
  });
});

function renderAt(element: React.ReactElement, path = '/play') {
  const router = createMemoryRouter(
    [
      { path: '/play', element },
      { path: '/play/party', element },
      { path: '/play/dex', element },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function battleUi(state: BattleState): BattleUi {
  return { battleId: 'b1', format: 'trainer', seat: 0, phase: 'selecting', menu: 'root', turnLabel: '', log: [], desyncs: 0, result: null, expectedMs: 0, authoritative: state } as unknown as BattleUi;
}

describe('band card', () => {
  it('shows once the band is held; party → a Majin creature on the field → its transformation; hidden in battle', () => {
    useSessionStore.getState().hydrateFromMe(meFixture({ inventory: { majin_band: 1 } }));
    const id = useSessionStore.getState().profile!.id;
    const router = renderAt(<BandTutorialCard />);
    const card = (): HTMLElement | null => screen.queryByRole('complementary', { name: 'Majin Band tutorial' });
    expect(card()!.getAttribute('data-step')).toBe('majin_party');
    expect(card()!.textContent).toContain('1 of 3');
    act(() => void router.navigate('/play/party'));
    act(() => void router.navigate('/play'));
    expect(card()!.getAttribute('data-step')).toBe('majin_field');
    // a battle with a toxshade on the player's field ticks step 2 (the card hides during it)
    const r = startBattle(content, 3, 'trainer', [makeCreature(content, content.species('toxshade'), 40, 'm', 'p0')], [makeCreature(content, content.species('mossling'), 5, 'f', null)]);
    act(() => useUiStore.getState().setBattle(battleUi(withSide0(r.state, { bands: ['majin'] }))));
    expect(card()).toBeNull();
    // the player transforms: the card is done
    const formed = withSide0(r.state, { bands: ['majin'], transformed: true, party: [{ ...r.state.sides[0].party[0]!, form: 'majin' }] });
    act(() => useUiStore.getState().setBattle(battleUi(formed)));
    act(() => useUiStore.getState().setBattle(null));
    expect(card()).toBeNull();
    expect(bandAccountOf(useBandTutorialStore.getState(), id).majin).toEqual({ seen: ['openedParty', 'formOnField', 'transformed'], done: true });
  });

  it('no band, no card; Skip ends it for good; the Tenjin card follows a finished Majin card', () => {
    useSessionStore.getState().hydrateFromMe(meFixture({ inventory: { potion: 1 } }));
    renderAt(<BandTutorialCard />);
    expect(screen.queryByRole('complementary')).toBeNull();
    cleanup();
    useSessionStore.getState().hydrateFromMe(meFixture({ inventory: { majin_band: 1, tenjin_band: 1 } }));
    renderAt(<BandTutorialCard />);
    expect(screen.getByRole('complementary', { name: 'Majin Band tutorial' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    const tenjin = screen.getByRole('complementary', { name: 'Tenjin Band tutorial' });
    expect(within(tenjin).getByText('The gold ring')).toBeTruthy();
  });
});

// ---- the sigil on party / box / Dex ---------------------------------------------------------------------------

describe('form marks', () => {
  it('species with a form carry a labelled ring; others none', () => {
    expect(formKindOf('toxshade')).toBe('majin');
    expect(formKindOf('hollowmane')).toBe('majin');    // the rage form is a Majin form
    expect(formKindOf('gemknight')).toBe('tenjin');
    expect(formKindOf('mossling')).toBeNull();
    expect(formMarkLabel('majin')).toBe('Has a Majin Form');
    render(<FormMark speciesId="gemknight" />);
    expect(screen.getByRole('img', { name: 'Has a Tenjin Form' }).getAttribute('data-kind')).toBe('tenjin');
    cleanup();
    render(<FormMark speciesId="mossling" />);
    expect(screen.queryByTestId('formsigil')).toBeNull();
  });

  it('CreatureCard (party lists, box tiles) shows the ring', () => {
    render(<CreatureCard creature={creature('toxshade')} variant="row" />);
    expect(screen.getByRole('img', { name: 'Has a Majin Form' })).toBeTruthy();
    cleanup();
    render(<CreatureCard creature={creature('gemknight')} variant="tile" onClick={() => undefined} />);
    expect(screen.getByTestId('formsigil').getAttribute('data-kind')).toBe('tenjin');
    cleanup();
    render(<CreatureCard creature={creature('mossling')} variant="row" />);
    expect(screen.queryByTestId('formsigil')).toBeNull();
  });

  it('the Dex entry of a seen species with a form names the form and its kind', () => {
    useSessionStore.getState().hydrateFromMe(meFixture());
    const p = useSessionStore.getState().progression!;
    useSessionStore.setState({ progression: { ...p, dexSeen: [...p.dexSeen, 'toxshade'], dexCaught: p.dexCaught } });
    renderAt(<DexScreen />, '/play/dex?id=toxshade');
    const form = screen.getByTestId('dex-form');
    expect(form.textContent).toContain('Majin Form');
    expect(form.textContent).toContain('below half HP');
    expect(within(form).getByRole('img', { name: 'Has a Majin Form' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Toxshade, seen, has a majin form$/ })).toBeTruthy();
  });
});

describe('the battle key hints', () => {
  it('offer the emote wheel (G) in a world battle, not in the arena', () => {
    singles('toxshade', 0.5, undefined);
    expect(screen.getByTestId('battle-ticker').textContent).toContain('GEmote');
    cleanup();
    useArenaStore.getState().setInArena(true);
    singles('toxshade', 0.5, undefined);
    expect(screen.getByTestId('battle-ticker').textContent).not.toContain('Emote');
    useArenaStore.getState().setInArena(false);
  });
});
