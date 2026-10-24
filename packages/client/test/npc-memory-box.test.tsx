// @vitest-environment jsdom
/**
 * NPC memory in the DialogueBox: opening a person's dialogue fetches what they remember and shows the town's standing
 * beside the speaker ("Mirevale · Wary"); the first reply hears the memory; closing the dialogue after a reply sends the
 * NPC's summary and the talk deeds. Signed out, nothing is fetched or sent.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NpcMemoryView } from '@ewa/protocol';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { endTalk, useNpcTalkStore } from '../src/state/npcTalk';
import { DialogueBox } from '../src/world/DialogueBox';

const AT = '2026-10-24T12:00:00.000Z';
const memory: NpcMemoryView = {
  npcId: 'mirevale.archivist',
  known: true,
  summary: 'The traveller slapped me.',
  standing: -3,
  feeling: 'wary',
  deeds: [{ deed: 'hit', at: AT }],
  town: { zoneId: 'mirevale', name: 'Mirevale', score: -3, standing: 'wary', known: 1 },
  gossip: [],
};

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: Record<string, unknown> | null;
}

function mockFetch(calls: Call[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, method: init.method ?? 'GET', body });
      if (url.includes('/npc/memory/')) return Response.json(memory);
      if (url.endsWith('/npc/memory')) return Response.json({ ...memory, summary: 'The traveller slapped me. They came back and said sorry.' });
      if (body?.['stream'] === true) return new Response('data: {"choices":[{"delta":{"content":"You again."}}]}\n\ndata: [DONE]\n\n', { status: 200 });
      if (body?.['tools'] !== undefined) return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing' } }] } }] });
      return Response.json({ choices: [{ message: { content: 'The traveller came back and said sorry.' } }] });
    }),
  );
}

const flush = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  useUiStore.getState().reset();
  endTalk();
  useSessionStore.setState({ accessToken: null });
});

describe('DialogueBox NPC memory', () => {
  it('shows the town standing, lets the first reply remember, and keeps the conversation when it closes', async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    useSessionStore.setState({ accessToken: 'token', accessExp: Date.now() + 3_600_000 });
    act(() => useUiStore.getState().setDialogue({ speaker: 'Hessa Dunmore, town archivist', lines: ['Three witnessed.'], index: 0, targetId: 'mirevale.archivist' }));
    render(<DialogueBox />);
    await flush();
    const tag = screen.getByTestId('town-standing');
    expect(tag.textContent).toBe('Mirevale · Wary');
    expect(tag.getAttribute('data-standing')).toBe('wary');
    expect(calls.filter((c) => c.url.includes('/npc/memory/mirevale.archivist'))).toHaveLength(1);

    act(() => {
      fireEvent.keyDown(window, { code: 'KeyC' });
    });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sorry about last time.' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.getByText('You again.')).toBeTruthy();
    const talk = calls.find((c) => c.body?.['stream'] === true)!;
    const lines = (talk.body!['messages'] as { content: string }[]).map((m) => m.content);
    expect(lines.at(-1)).toBe('Sorry about last time. [You know this traveller and you do not trust them. Tell them why, coldly. What you remember of them: The traveller slapped me.]');

    // closing the dialogue: the NPC keeps a summary and the deeds (kind words) in the background
    act(() => useUiStore.getState().setDialogue(null));
    await flush(50);
    const write = calls.find((c) => c.url.endsWith('/npc/memory') && c.method === 'POST');
    expect(write?.body).toEqual({ npcId: 'mirevale.archivist', summary: 'The traveller came back and said sorry.', deeds: ['kindWords'] });
    expect(useNpcTalkStore.getState().targetId).toBeNull();
  });

  it('signed out: no memory, no tag, nothing sent', async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Hessa Dunmore', lines: ['Three witnessed.'], index: 0, targetId: 'mirevale.archivist' }));
    render(<DialogueBox />);
    await flush();
    expect(screen.queryByTestId('town-standing')).toBeNull();
    act(() => useUiStore.getState().setDialogue(null));
    await flush();
    expect(calls.filter((c) => c.url.includes('/npc/memory'))).toEqual([]);
  });
});
