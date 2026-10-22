// @vitest-environment jsdom
/**
 * NPC voice talk in the DialogueBox: a person's lines offer "Hold to talk"; a sign's do not; a conversation replaces
 * the scripted page (the whole exchange as a log) and Enter returns to the lines without running `onFinish`, keeping the
 * conversation for the next line; closing the dialogue ends it.
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

  it('shows the exchange over the lines; Enter goes back to them without finishing the dialogue or dropping it', () => {
    const onFinish = vi.fn();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn', onFinish }));
    render(<DialogueBox />);
    act(() =>
      useVoiceTalkStore.setState({
        targetId: 'mirevale.wynn',
        turns: [
          { role: 'user', content: 'Which Ewamon should I pick?' },
          { role: 'assistant', content: 'Pick the one that suits you, traveller.' },
        ],
      }),
    );
    expect(screen.getByText('Which Ewamon should I pick?')).toBeTruthy();
    expect(screen.getByText('Pick the one that suits you, traveller.')).toBeTruthy();
    expect(screen.queryByText('Hello.')).toBeNull();
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(screen.getByText('Hello.')).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    expect(useUiStore.getState().dialogue).not.toBeNull();
    expect(useVoiceTalkStore.getState()).toMatchObject({ targetId: 'mirevale.wynn', hidden: true });
    expect(useVoiceTalkStore.getState().turns).toHaveLength(2);
  });

  it('every line while the dialogue stays open adds to one conversation, shown and sent in full', async () => {
    let n = 0;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      (JSON.parse(String(init.body)) as { stream?: boolean }).stream === true
        ? new Response(`data: {"choices":[{"delta":{"content":"Reply ${++n}."}}]}\n\ndata: [DONE]\n\n`, { status: 200 })
        : Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing' } }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn' }));
    render(<DialogueBox />);
    const say = async (text: string): Promise<void> => {
      act(() => {
        fireEvent.keyDown(window, { code: 'KeyC' });
      });
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: text } });
      await act(async () => {
        fireEvent.submit(input.closest('form')!);
        await new Promise((r) => setTimeout(r, 20));
      });
    };
    await say('First question');
    // back to the scripted lines (Enter), then talk again: the conversation resumes
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(screen.getByText('Hello.')).toBeTruthy();
    await say('Second question');
    for (const t of ['First question', 'Reply 1.', 'Second question', 'Reply 2.']) expect(screen.getByText(t)).toBeTruthy();
    const talkCalls = fetchMock.mock.calls.filter((c) => (JSON.parse(String(c[1].body)) as { stream?: boolean }).stream === true);
    const sent = (JSON.parse(String(talkCalls.at(-1)![1].body)) as { messages: { content: string }[] }).messages.map((m) => m.content);
    expect(sent.slice(-3)).toEqual(['First question', 'Reply 1.', 'Second question']);
    vi.unstubAllGlobals();
  });

  it('C opens a text field; typing V there is text, Enter sends it and the streamed reply shows', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Hello traveller!"}}]}\n\ndata: [DONE]\n\n';
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
    fireEvent.change(input, { target: { value: 'Hi Wynn' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useVoiceTalkStore.getState()).toMatchObject({ phase: 'idle', error: null });
    expect(screen.getByText('Hi Wynn')).toBeTruthy();
    expect(screen.getByText('Hello traveller!')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a slap the tool pass called shows the burst and is remembered for the talk pass', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"How rude! Here, a slap!"}}]}\n\ndata: [DONE]\n\n';
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
    fireEvent.change(input, { target: { value: 'You are ugly' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByTestId('npc-strike').textContent).toContain('SMACK!');
    expect(useVoiceTalkStore.getState().turns.at(-1)).toMatchObject({ role: 'assistant', events: ['You slapped the traveller.'] });
    vi.unstubAllGlobals();
  });

  it('H slaps the NPC: the burst plays, the dialogue shows the action and the NPC answers it', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Ow! Why did you do that?"}}]}\n\ndata: [DONE]\n\n';
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
    expect(screen.getByTestId('npc-strike').textContent).toContain('SMACK!');
    expect(screen.getByText('You slap Bram.')).toBeTruthy();
    expect(screen.getByText('Ow! Why did you do that?')).toBeTruthy();
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1].body)) as { messages: { content: string }[] };
    expect(sent.messages.at(-1)!.content).toContain('slaps');
    vi.unstubAllGlobals();
  });

  it('the next line can go while the tool pass still runs; what it did lands on its own reply', async () => {
    let n = 0;
    let release: (() => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        if ((JSON.parse(String(init.body)) as { stream?: boolean }).stream === true)
          return new Response(`data: {"choices":[{"delta":{"content":"Reply ${++n}, here a slap!"}}]}\n\ndata: [DONE]\n\n`, { status: 200 });
        // the first tool pass hangs until released; the second answers at once
        if (release === null) await new Promise<void>((r) => (release = r));
        return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'slap_user', arguments: '{}' } }] } }] });
      }),
    );
    act(() => useUiStore.getState().setDialogue({ speaker: 'Bram', lines: ['Hello.'], index: 0, targetId: 'mirevale.bram' }));
    render(<DialogueBox />);
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyC' });
    });
    const send = async (text: string): Promise<void> => {
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: text } });
      await act(async () => {
        fireEvent.submit(input.closest('form')!);
        await new Promise((r) => setTimeout(r, 20));
      });
    };
    await send('You are ugly');
    expect(useVoiceTalkStore.getState().phase).toBe('idle');
    await send('And you smell');
    expect(screen.getByText('Reply 2, here a slap!')).toBeTruthy();
    expect(useVoiceTalkStore.getState().turns.every((t) => t.events === undefined)).toBe(true);
    await act(async () => {
      release!();
      await new Promise((r) => setTimeout(r, 1200));
    });
    const replies = useVoiceTalkStore.getState().turns.filter((t) => t.role === 'assistant');
    expect(replies.map((t) => t.events)).toEqual([['You slapped the traveller.'], ['You slapped the traveller.']]);
    vi.unstubAllGlobals();
  });

  it('closing the dialogue ends the conversation', () => {
    act(() => useUiStore.getState().setDialogue({ speaker: 'Prof. Wynn', lines: ['Hello.'], index: 0, targetId: 'mirevale.wynn' }));
    render(<DialogueBox />);
    act(() => useVoiceTalkStore.setState({ targetId: 'mirevale.wynn', turns: [{ role: 'user', content: 'Hi' }] }));
    act(() => useUiStore.getState().setDialogue(null));
    expect(useVoiceTalkStore.getState().targetId).toBeNull();
  });
});
