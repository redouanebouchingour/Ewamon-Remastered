// @vitest-environment jsdom
/**
 * LLM feature 5 on screen: the Ask Prof. Wynn panel (a typed question or a suggestion shows the save's facts with the
 * sprites and type icons at once, then the professor's words; the facts alone when the model is down) and the result
 * card's "Why did I lose?" (only on a loss, not on a win, a replay or without a landed hit). The hotkey and the More
 * menu entry.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createContentIndex } from '@ewa/content';
import { createBattle, projectBattler } from '@ewa/core';
import type { BattleEvent, BattleState, Ref } from '@ewa/core';
import { NAV_MORE } from '../src/app/TopBar';
import { BattleResultCard } from '../src/battle/BattleResultCard';
import { ProfessorScreen } from '../src/screens/ProfessorScreen';
import { ACTION_LABEL } from '../src/screens/SettingsScreen';
import { clearProfessor, createBattleLogger, useLossReviewStore } from '../src/state/professor';
import { useSessionStore } from '../src/state/session';
import { DEFAULT_KEYBINDS, INPUT_ACTIONS } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { makeCreature } from './battleFuzz';

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

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-0000000000d6';
const D = '\u2014';

function model(answer: string | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!String(url).includes('/chat/completions')) return new Response('{}', { status: 404 });
      if (answer === null) return new Response('down', { status: 503 });
      return Response.json({ choices: [{ message: { content: answer } }] });
    }),
  );
}

function signIn(): void {
  useSessionStore.setState({
    zoneId: 'mirevale',
    progression: { badges: [], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], flags: ['met_wynn'], quests: {}, questsClaimed: [], missions: [] },
    inventory: {
      items: {},
      money: 0,
      party: [makeCreature(content, content.species('glimfin'), 10, 'a', 'p0')],
      box: [makeCreature(content, content.species('cindercap'), 8, 'b', 'p0')],
    },
  });
}

function renderPanel(): void {
  const router = createMemoryRouter(
    [
      { path: '/play/professor', element: <ProfessorScreen /> },
      { path: '/play', element: <p>world</p> },
    ],
    { initialEntries: ['/play/professor'] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  clearProfessor();
  signIn();
  useUiStore.getState().reset();
  useLossReviewStore.setState({ log: null, review: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Ask Prof. Wynn', () => {
  it('a typed question: the facts with sprites and type icons at once, the words when the model answers', async () => {
    model(`Bring your Cindercap ${D} Fire moves are super effective on Grass.`);
    renderPanel();
    const input = screen.getByLabelText('Your question');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "What beats Mira's team?" } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    const entry = await screen.findByTestId('prof-entry');
    expect(within(entry).getByTestId('prof-facts').textContent).toContain('Mira Thornwell');
    expect(within(entry).getAllByTestId('typebadge').map((b) => b.getAttribute('data-type'))).toContain('Grass');
    await waitFor(() => expect(within(entry).getByTestId('prof-text').textContent).toBe('Bring your Cindercap, Fire moves are super effective on Grass.'));
    expect(within(entry).queryByTestId('prof-thinking')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('a suggestion asks at once; with the model down the facts are the answer', async () => {
    model(null);
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'What should I do next?' }));
    const entry = await screen.findByTestId('prof-entry');
    await waitFor(() => expect(within(entry).queryByTestId('prof-thinking')).toBeNull());
    expect(within(entry).queryByTestId('prof-text')).toBeNull();
    expect(within(entry).getByRole('list', { name: 'Answer' }).textContent).toContain('Talk to Prof. Wynn');
  });

  it('the More menu entry and the L hotkey (bound to nothing else)', () => {
    expect(NAV_MORE.find((n) => n.to === '/play/professor')).toMatchObject({ label: 'Professor', action: 'professor' });
    expect(DEFAULT_KEYBINDS.professor).toEqual(['KeyL']);
    for (const a of INPUT_ACTIONS) if (a !== 'professor') expect(DEFAULT_KEYBINDS[a]).not.toContain('KeyL');
    expect(ACTION_LABEL.professor).toBe('Ask Prof. Wynn');
  });
});

// ---- the result card ----------------------------------------------------------------------------------------------

const R = (side: 0 | 1, slot = 0): Ref => ({ side, slot });

function startBattle(winner: 0 | 1, opts: { replay?: boolean; hits?: boolean } = {}): void {
  const start: BattleState = createBattle(
    {
      id: BID, format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 2,
      sides: [
        { kind: 'player', party: [projectBattler(makeCreature(content, content.species('glimfin'), 10, 'a', 'p0'), content)], active: 0, trainerId: 'p0', canFlee: false, canCatch: false },
        { kind: 'npc', party: [projectBattler(makeCreature(content, content.species('briarbear'), 14, 'f', null), content)], active: 0, trainerId: 'trainer.x', canFlee: false, canCatch: false },
      ],
    },
    content,
  ).state;
  const battleId = opts.replay === true ? `replay:${BID}` : BID;
  const logger = createBattleLogger();
  logger.begin({ battleId, seat: 0, format: 'trainer', state: start, foe: null, replay: opts.replay === true, spectator: false, fresh: true });
  const events: BattleEvent[] =
    opts.hits === false
      ? [{ t: 'battleEnd', outcome: { winner }, turns: 1 } as BattleEvent]
      : [
          { t: 'damage', target: R(0), source: R(1), amount: 40, hpAfter: 0, maxHp: 40, cause: 'move', move: 'Leaf Blade', crit: false, effectiveness: 2, stab: true } as BattleEvent,
          { t: 'faint', who: R(0) } as BattleEvent,
          { t: 'battleEnd', outcome: { winner }, turns: 1 } as BattleEvent,
        ];
  logger.timeline(events, start);
  useUiStore.getState().setBattle({
    battleId, format: 'trainer', seat: 0, authoritative: start, phase: 'ended', menu: 'root', turnLabel: 'Turn 1', log: [], desyncs: 0,
    result: { outcome: { winner }, rewards: { money: 0, trainerExp: 0, items: {}, badge: null, ratingDelta: null } as never, prompts: 0 },
    expectedMs: 0, deadlineAt: null,
  });
}

describe('Why did I lose?', () => {
  it('a lost battle offers it; pressed, the facts show, then the coaching, with what to bring', async () => {
    model("Their Briarbear's Leaf Blade hit your Glimfin hard. Next time bring Cindercap.");
    startBattle(1);
    render(<BattleResultCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Why did I lose?' }));
    const review = await screen.findByTestId('loss-review');
    expect(useLossReviewStore.getState().review?.lines[0]).toContain("The opponent's Briarbear hurt you most, with Leaf Blade");
    expect(within(review).getByTestId('loss-bring').querySelectorAll('[data-testid="typebadge"]').length).toBeGreaterThan(0);
    await waitFor(() => expect(within(review).getByTestId('loss-text').textContent).toBe("Their Briarbear's Leaf Blade hit your Glimfin hard. Next time bring Cindercap."));
  });

  it('the model down: the facts stay', async () => {
    model(null);
    startBattle(1);
    render(<BattleResultCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Why did I lose?' }));
    const review = await screen.findByTestId('loss-review');
    await waitFor(() => expect(useLossReviewStore.getState().review?.pending).toBe(false));
    expect(within(review).getByTestId('loss-lines').textContent).toContain('Leaf Blade');
    expect(within(review).queryByTestId('loss-text')).toBeNull();
  });

  it('not on a win, a replay, or a battle where nothing landed', () => {
    model(null);
    startBattle(0);
    const { unmount } = render(<BattleResultCard />);
    expect(screen.queryByRole('button', { name: 'Why did I lose?' })).toBeNull();
    unmount();
    act(() => startBattle(1, { replay: true }));
    const second = render(<BattleResultCard />);
    expect(screen.queryByRole('button', { name: 'Why did I lose?' })).toBeNull();
    second.unmount();
    act(() => startBattle(1, { hits: false }));
    render(<BattleResultCard />);
    expect(screen.getByTestId('battleresult')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Why did I lose?' })).toBeNull();
  });
});
