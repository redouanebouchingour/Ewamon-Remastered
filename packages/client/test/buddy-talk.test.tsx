// @vitest-environment jsdom
/**
 * LLM feature 6 on screen: the talk panel (the DialogueBox lower-third with the creature's sprite, type icons and level;
 * its greeting, a typed line and the answer; Escape and a battle close it), the ambient speech bubble (its text, the
 * follower's anchor, gone after its time), the field power chip's Talk key, the party card's Talk, the key binding.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createContentIndex } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { PartyScreen } from '../src/screens/PartyScreen';
import { ACTION_LABEL } from '../src/screens/SettingsScreen';
import { clearBubble, closeBuddyTalk, openBuddyTalk, setBubbleAnchor, showBubble, useBuddyBubbleStore, useBuddyTalkStore } from '../src/state/buddy';
import { useFieldPowerStore } from '../src/state/fieldPowers';
import { useSessionStore } from '../src/state/session';
import { DEFAULT_KEYBINDS, DEFAULT_SETTINGS } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { BuddyBubble } from '../src/world/BuddyBubble';
import { BuddyTalk } from '../src/world/BuddyTalk';
import { FieldPowerChip } from '../src/world/FieldPowerChip';
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
const D = String.fromCharCode(0x2014);

function creature(speciesId: string, level: number, id: string, extra: Partial<CreatureInstance> = {}): CreatureInstance {
  return { ...makeCreature(content, content.species(speciesId), level, id, 'p0'), ...extra };
}

let answers: (string | null)[] = [];
function model(...a: (string | null)[]): void {
  answers = a;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!String(url).includes('/chat/completions')) return new Response('{}', { status: 404 });
      const next = answers.length > 1 ? answers.shift()! : answers[0]!;
      if (next === null) return new Response('down', { status: 503 });
      return Response.json({ choices: [{ message: { content: next } }] });
    }),
  );
}

const lead = creature('glimfin', 12, 'lead-1', { isShiny: true });
const second = creature('mossling', 8, 'm-2', { nickname: 'Sprout' });

beforeEach(() => {
  useSessionStore.setState({ accessToken: null, zoneId: 'mirevale', inventory: { items: {}, money: 0, party: [lead, second], box: [] } } as never);
  useUiStore.setState({ battle: null, dialogue: null, evolution: null });
});

afterEach(() => {
  cleanup();
  closeBuddyTalk();
  clearBubble();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the talk panel', () => {
  it('shows the creature’s name, level, sprite and type icons, its greeting, then answers a typed line', async () => {
    model(`Glim glim! I am happy ${D} you are here.`, 'I liked the water today.');
    render(<BuddyTalk />);
    await act(async () => {
      await openBuddyTalk();
    });
    const box = screen.getByTestId('buddy-talk');
    expect(box.getAttribute('aria-label')).toBe('Talking with Glimfin');
    expect(box.textContent).toMatch(/Glimfin/);
    expect(screen.getByTestId('buddy-level').textContent).toBe('Lv 12');
    expect(screen.getAllByTestId('typebadge').map((b) => b.getAttribute('data-type'))).toEqual(['Water', 'Electric']);
    // the creature's sprite (CreatureSprite: the pipeline thumbnail, its primary type on the slab)
    expect(box.querySelector('figure > [data-type="Water"]')).not.toBeNull();
    const first = screen.getByTestId('buddy-line').textContent!;
    expect(first).toBe('Glim glim! I am happy, you are here.');
    expect(first).not.toContain(D);
    const input = screen.getByLabelText('Type to Glimfin');
    fireEvent.change(input, { target: { value: 'Did you like the water?' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Did you like the water?')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('buddy-line')).toHaveLength(2));
    expect(screen.getAllByTestId('buddy-line')[1]!.textContent).toMatch(/I liked the water today\./);
  });

  it('a thinking line in the creature’s sound while the model works; Escape closes', async () => {
    let release: (v: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (release = r))));
    render(<BuddyTalk />);
    let opened: Promise<void> = Promise.resolve();
    act(() => {
      opened = openBuddyTalk('m-2', { timeoutMs: 60_000 });
    });
    await waitFor(() => expect(screen.getByTestId('buddy-thinking').textContent).toBe('Moss moss…'));
    expect(screen.getByTestId('buddy-talk').getAttribute('aria-label')).toBe('Talking with Sprout');
    await act(async () => {
      release(Response.json({ choices: [{ message: { content: 'Hello. Moss moss.' } }] }));
      await opened;
    });
    expect(screen.getByTestId('buddy-line').textContent).toBe('Hello. Moss moss.');
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(useBuddyTalkStore.getState().creatureId).toBeNull();
    expect(screen.queryByTestId('buddy-talk')).toBeNull();
  });

  it('a battle taking the screen ends the talk; the model down still greets with a template', async () => {
    model(null);
    render(<BuddyTalk />);
    await act(async () => {
      await openBuddyTalk();
    });
    expect(screen.getByTestId('buddy-line').textContent).toMatch(/^(Glim glim|Blub)/);
    act(() => {
      useUiStore.setState({ battle: { id: 'b' } as never });
    });
    expect(useBuddyTalkStore.getState().creatureId).toBeNull();
    expect(screen.queryByTestId('buddy-talk')).toBeNull();
  });
});

describe('the speech bubble', () => {
  it('shows the line over the follower, then clears itself', () => {
    vi.useFakeTimers();
    render(<BuddyBubble />);
    act(() => showBubble(`Night now ${D} stay close.`, 'glimfin'));
    const b = screen.getByTestId('buddy-bubble');
    expect(b.textContent).toBe('Night now, stay close.');
    expect(b.hasAttribute('data-anchored')).toBe(false);
    act(() => setBubbleAnchor(320, 240, true));
    expect(screen.getByTestId('buddy-bubble').getAttribute('data-anchored')).toBe('true');
    expect(screen.getByTestId('buddy-bubble').getAttribute('style')).toContain('--bx: 320px');
    act(() => {
      vi.advanceTimersByTime(useBuddyBubbleStore.getState().line!.ms + 10);
    });
    expect(screen.queryByTestId('buddy-bubble')).toBeNull();
  });
});

describe('the ways in', () => {
  it('the field power chip names the talk key', () => {
    useFieldPowerStore.getState().setChip({ lead: { speciesId: 'glimfin', name: 'Glimfin', types: ['Water', 'Electric'], variantKey: 'normal' }, enabled: true, hints: [] });
    render(<FieldPowerChip />);
    const t = screen.getByTestId('field-power-talk');
    expect(t.textContent).toBe('YTalk with Glimfin');
  });

  it('the party card’s Talk opens the talk with that creature and closes the panel', async () => {
    model('Hello.');
    const router = createMemoryRouter(
      [
        { path: '/play/party', element: <PartyScreen /> },
        { path: '/play', element: <p>world</p> },
      ],
      { initialEntries: ['/play/party?c=m-2'] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Sprout' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
    await waitFor(() => expect(useBuddyTalkStore.getState().creatureId).toBe('m-2'));
  });

  it('Y by default, labelled in the controls; the chatter setting defaults on', () => {
    expect(DEFAULT_KEYBINDS.buddyTalk).toEqual(['KeyY']);
    expect(ACTION_LABEL.buddyTalk).toMatch(/talk/i);
    expect(DEFAULT_SETTINGS.accessibility.followerChatter).toBe(true);
  });
});
