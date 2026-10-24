// @vitest-environment jsdom
/**
 * LLM feature 10 on screen: the mic button in the DialogueBox and the buddy talk (hidden with the setting off or in a
 * browser without recognition; holding it or the push-to-talk key fills the field and sends on release; a blocked mic
 * explains itself; closing the box stops the mic), and Settings › Audio's voice section (all off by default, the
 * Google notice on the speech input toggle, disabled where the browser cannot do it).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { closeBuddyTalk, useBuddyTalkStore } from '../src/state/buddy';
import { endTalk, useNpcTalkStore } from '../src/state/npcTalk';
import { useSessionStore } from '../src/state/session';
import { DEFAULT_KEYBINDS, DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { setRecognizerFactory, usePttStore } from '../src/voice/listen';
import { BuddyTalk } from '../src/world/BuddyTalk';
import { DialogueBox } from '../src/world/DialogueBox';
import { createContentIndex } from '@ewa/content';
import { makeCreature } from './battleFuzz';
import { fakeRecognizer } from './voiceFakes';
import type { FakeRecognizer } from './voiceFakes';

let recs: FakeRecognizer[] = [];
const rec = (): FakeRecognizer => recs.at(-1)!;

function supportRecognition(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w['webkitSpeechRecognition'] = class {};
  else delete w['webkitSpeechRecognition'];
}

function openDialogue(): void {
  act(() => useUiStore.getState().setDialogue({ speaker: 'Bram, fisherman', lines: ['Fine day.'], index: 0, targetId: 'mirevale.bram' }));
}

const speechOn = (): void => useSettingsStore.getState().set('audio', { speechInput: true });

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  useUiStore.getState().reset();
  endTalk();
  recs = [];
  setRecognizerFactory(() => {
    const r = fakeRecognizer();
    recs.push(r);
    return r;
  });
  supportRecognition(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) =>
      (JSON.parse(String(init.body)) as { stream?: boolean }).stream === true
        ? new Response('data: {"choices":[{"delta":{"content":"The inn is north."}}]}\n\ndata: [DONE]\n\n', { status: 200 })
        : Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing' } }] } }] }),
    ),
  );
});
afterEach(() => {
  cleanup();
  setRecognizerFactory(null);
  supportRecognition(false);
  vi.unstubAllGlobals();
});

describe('the mic button', () => {
  it('is not there with the setting off (the default), and the key types as before', () => {
    openDialogue();
    render(<DialogueBox />);
    expect(screen.queryByTestId('mic-button')).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyC' });
    const input = screen.getByRole('textbox');
    expect(fireEvent.keyDown(input, { code: 'Backquote', key: '`' })).toBe(true);
    expect(recs).toHaveLength(0);
  });

  it('is not there in a browser without speech recognition', () => {
    supportRecognition(false);
    speechOn();
    openDialogue();
    render(<DialogueBox />);
    expect(screen.queryByTestId('mic-button')).toBeNull();
    expect(screen.getByRole('button', { name: /Type to chat/ })).toBeTruthy();
  });

  it('is not offered over a sign', () => {
    speechOn();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Old Sign', lines: ['Mirevale'], index: 0, targetId: 'sign', noTalk: true }));
    render(<DialogueBox />);
    expect(screen.queryByTestId('mic-button')).toBeNull();
  });

  it('held, it listens and fills the field; released, the words go as the typed line', async () => {
    speechOn();
    openDialogue();
    render(<DialogueBox />);
    const mic = screen.getByTestId('mic-button');
    expect(mic.dataset['state']).toBe('idle');
    expect(mic.textContent).toContain('`');
    expect(recs).toHaveLength(0);
    fireEvent.pointerDown(mic, { button: 0, pointerId: 1 });
    expect(screen.getByTestId('mic-button').dataset['state']).toBe('listening');
    expect(screen.getByTestId('mic-button').getAttribute('aria-pressed')).toBe('true');
    act(() => rec().hear('where is the inn'));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('where is the inn');
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.pointerUp(screen.getByTestId('mic-button'), { pointerId: 1 });
    expect(usePttStore.getState().state).toBe('stopping');
    await act(async () => {
      rec().end();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(useNpcTalkStore.getState().turns[0]).toMatchObject({ role: 'user', content: 'where is the inn' });
    await waitFor(() => expect(screen.getByText('The inn is north.')).toBeTruthy());
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('the push-to-talk key works from inside the field and types nothing', async () => {
    speechOn();
    openDialogue();
    render(<DialogueBox />);
    fireEvent.keyDown(window, { code: 'KeyC' });
    const input = screen.getByRole('textbox');
    expect(fireEvent.keyDown(input, { code: DEFAULT_KEYBINDS.pushToTalk[0], key: '`' })).toBe(false);
    expect(usePttStore.getState().state).toBe('listening');
    // a held key repeats: still one recognizer
    fireEvent.keyDown(input, { code: 'Backquote', key: '`', repeat: true });
    expect(recs).toHaveLength(1);
    act(() => rec().hear('hello there'));
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.keyUp(input, { code: 'Backquote', key: '`' });
    expect(rec().stopped).toBe(1);
    await act(async () => {
      rec().end();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(useNpcTalkStore.getState().turns[0]).toMatchObject({ role: 'user', content: 'hello there' });
  });

  it('a blocked mic says how to allow it; typing still works', () => {
    speechOn();
    openDialogue();
    render(<DialogueBox />);
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { button: 0, pointerId: 1 });
    act(() => rec().fail('not-allowed'));
    expect(screen.getByTestId('mic-button').dataset['state']).toBe('denied');
    expect(screen.getByTestId('mic-button').textContent).toContain('Mic blocked');
    expect(screen.getByTestId('mic-note').textContent).toMatch(/Allow it in the browser/);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('closing the dialogue stops the mic and sends nothing', () => {
    speechOn();
    openDialogue();
    render(<DialogueBox />);
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { button: 0, pointerId: 1 });
    act(() => rec().hear('wait'));
    act(() => useUiStore.getState().setDialogue(null));
    expect(rec().aborted).toBe(1);
    expect(usePttStore.getState().state).toBe('idle');
    expect(useNpcTalkStore.getState().turns).toHaveLength(0);
  });

  it('in the buddy talk the words go to the creature', async () => {
    speechOn();
    const content = createContentIndex();
    const c = makeCreature(content, content.species('bramblecub'), 5, 'c1', 'p0');
    useSessionStore.setState({ inventory: { party: [c], box: [] } as never });
    act(() =>
      useBuddyTalkStore.setState({
        creatureId: 'c1',
        profile: { id: 'c1', name: 'Bramblecub', speciesId: 'bramblecub', types: ['Grass'], voice: { style: 'calm', sounds: ['Bram bram', 'rustle'] } } as never,
        turns: [{ role: 'buddy', text: 'Bram!' }],
        phase: 'idle',
      }),
    );
    render(<BuddyTalk />);
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { button: 0, pointerId: 1 });
    act(() => rec().hear('good job today'));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('good job today');
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.pointerUp(screen.getByTestId('mic-button'), { pointerId: 1 });
    act(() => rec().end());
    expect(useBuddyTalkStore.getState().turns.at(-1)).toMatchObject({ role: 'trainer', text: 'good job today' });
    act(() => closeBuddyTalk());
  });
});

describe('Settings › Audio voices', () => {
  const mount = (): void => {
    const router = createMemoryRouter([{ path: '/play/settings', element: <SettingsScreen /> }], { initialEntries: ['/play/settings?tab=audio'] });
    render(<RouterProvider router={router} />);
  };
  const toggle = (label: RegExp): HTMLElement => screen.getByRole('switch', { name: label });

  it('every voice setting is off by default; speech input says plainly that the voice goes to Google', () => {
    mount();
    expect(toggle(/^NPC voices/).getAttribute('aria-checked')).toBe('false');
    expect(toggle(/^Voice the battle/).getAttribute('aria-checked')).toBe('false');
    const speech = toggle(/Speak to NPCs \(sends your voice to Google for recognition\)/);
    expect(speech.getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById(speech.getAttribute('aria-describedby')!)!.textContent).toMatch(/sends the microphone audio to Google's servers/);
    fireEvent.click(speech);
    expect(useSettingsStore.getState().audio.speechInput).toBe(true);
    expect(screen.getByText('Voice volume')).toBeTruthy();
  });

  it('without speech synthesis or recognition the toggles explain and stay off', () => {
    supportRecognition(false);
    useSettingsStore.getState().set('audio', { speechInput: true });
    mount();
    const speech = toggle(/Speak to NPCs/);
    expect(speech.hasAttribute('disabled')).toBe(true);
    expect(speech.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/This browser has no speech recognition/)).toBeTruthy();
    // jsdom has no speechSynthesis either
    expect(toggle(/^NPC voices/).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/This browser has no speech synthesis/)).toBeTruthy();
  });

  it('the push-to-talk key is a remappable binding', () => {
    expect(DEFAULT_KEYBINDS.pushToTalk).toEqual(['Backquote']);
    const all = Object.entries(DEFAULT_KEYBINDS).filter(([a]) => a !== 'pushToTalk').flatMap(([, k]) => k);
    expect(all).not.toContain('Backquote');
  });
});
