// @vitest-environment jsdom
/**
 * NPC voice talk in the DialogueBox: a person's lines offer "Hold to talk"; a sign's do not; a conversation replaces
 * the scripted page (what the player said + the reply) and Enter returns to the lines without running `onFinish`.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../src/state/ui';
import { endTalk, useVoiceTalkStore } from '../src/state/voiceTalk';
import { DialogueBox } from '../src/world/DialogueBox';
import { NpcStrikeFx } from '../src/world/NpcStrikeFx';

afterEach(() => cleanup());
beforeEach(() => {
  useUiStore.getState().reset();
  endTalk();
});

describe('DialogueBox voice talk', () => {
  it('offers the mic over a person, not over a sign', () => {
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn' }));
    render(<DialogueBox />);
    expect(screen.getByRole('button', { name: /Hold to talk/ })).toBeTruthy();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Old Sign', lines: ['Mirevale'], index: 0, targetId: 'sign', noTalk: true }));
    expect(screen.queryByRole('button', { name: /Hold to talk/ })).toBeNull();
  });

  it('shows the exchange over the lines; Enter goes back to them without finishing the dialogue', () => {
    const onFinish = vi.fn();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn', onFinish }));
    render(<DialogueBox />);
    act(() =>
      useVoiceTalkStore.setState({
        targetId: 'mirevale.wynn',
        turns: [
          { role: 'user', content: 'Welke Ewamon moet ik kiezen?' },
          { role: 'assistant', content: 'Kies degene die bij je past, reiziger.' },
        ],
      }),
    );
    expect(screen.getByText('Welke Ewamon moet ik kiezen?')).toBeTruthy();
    expect(screen.getByText('Kies degene die bij je past, reiziger.')).toBeTruthy();
    expect(screen.queryByText('Hello.')).toBeNull();
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(screen.getByText('Hello.')).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    expect(useUiStore.getState().dialogue).not.toBeNull();
  });

  it('C opens a text field; typing V there is text, Enter sends it and the streamed reply shows', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Hallo reiziger!"}}]}\n\ndata: [DONE]\n\n';
    // the talk model streams; the tool model answers do_nothing
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      (JSON.parse(String(init.body)) as { stream?: boolean }).stream === true
        ? new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
        : Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing' } }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn' }));
    render(<DialogueBox />);
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyC' });
    });
    const input = screen.getByRole('textbox', { name: /Type to Prof. Wynn/ });
    fireEvent.keyDown(input, { code: 'KeyV', key: 'v' });
    expect(useVoiceTalkStore.getState().phase).toBe('idle');
    fireEvent.change(input, { target: { value: 'Hoi Wynn' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useVoiceTalkStore.getState()).toMatchObject({ phase: 'idle', error: null });
    expect(screen.getByText('Hoi Wynn')).toBeTruthy();
    expect(screen.getByText('Hallo reiziger!')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a slap the tool pass called shows the burst and is remembered for the talk pass', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Brutaal! Hier, een klap!"}}]}\n\ndata: [DONE]\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) =>
        (JSON.parse(String(init.body)) as { stream?: boolean }).stream === true
          ? new Response(sse, { status: 200 })
          : Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'slap_user', arguments: '{}' } }] } }] }),
      ),
    );
    act(() => useUiStore.getState().setDialogue({ speaker: 'Bram', lines: ['Hello.'], index: 0, targetId: 'mirevale.bram' }));
    render(
      <>
        <DialogueBox />
        <NpcStrikeFx />
      </>,
    );
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyC' });
    });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Je bent lelijk' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByTestId('npc-strike').textContent).toContain('PETS!');
    expect(useVoiceTalkStore.getState().turns.at(-1)).toMatchObject({ role: 'assistant', events: ['Bram gaf de reiziger een klap.'] });
    vi.unstubAllGlobals();
  });

  it('H slaps the NPC: the burst plays, the dialogue shows the action and the NPC answers it', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Au! Waarom doe je dat?"}}]}\n\ndata: [DONE]\n\n';
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      (JSON.parse(String(init.body)) as { stream?: boolean }).stream === true
        ? new Response(sse, { status: 200 })
        : Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing', arguments: '{}' } }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Bram', lines: ['Hello.'], index: 0, targetId: 'mirevale.bram' }));
    render(
      <>
        <DialogueBox />
        <NpcStrikeFx />
      </>,
    );
    await act(async () => {
      fireEvent.keyDown(window, { code: 'KeyH' });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByTestId('npc-strike').textContent).toContain('PETS!');
    expect(screen.getByText('Je geeft Bram een klap.')).toBeTruthy();
    expect(screen.getByText('Au! Waarom doe je dat?')).toBeTruthy();
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1].body)) as { messages: { content: string }[] };
    expect(sent.messages.at(-1)!.content).toContain('klap');
    vi.unstubAllGlobals();
  });

  it('closing the dialogue ends the conversation', () => {
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn' }));
    render(<DialogueBox />);
    act(() => useVoiceTalkStore.setState({ targetId: 'mirevale.wynn', turns: [{ role: 'user', content: 'Hoi' }] }));
    act(() => useUiStore.getState().setDialogue(null));
    expect(useVoiceTalkStore.getState().targetId).toBeNull();
  });
});
