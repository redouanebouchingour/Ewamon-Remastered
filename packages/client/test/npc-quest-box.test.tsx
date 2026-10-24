// @vitest-environment jsdom
/**
 * NPC side quests in the DialogueBox: asking for work makes the talk pass ask the server's favour; the NPC's words ask,
 * so the offer is stored (the tool pass called nothing: the words decide) and the card shows Accept / Decline; Accept
 * answers it and the NPC hears the yes; an accepted favour that is ready is handed in with Hand in (the reward lands in
 * the session, the NPC hears it was paid). Nothing about favours is fetched signed out.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NpcMemoryView, NpcQuestPlan, NpcQuestState, NpcQuestView } from '@ewa/protocol';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { endTalk, useNpcTalkStore } from '../src/state/npcTalk';
import { askNote } from '../src/talk/npcQuest';
import { DialogueBox } from '../src/world/DialogueBox';

const AT = '2026-10-24T12:00:00.000Z';
const NPC = 'mirevale.gardener';
const plan: NpcQuestPlan = { objective: { kind: 'catch', species: 'mossling', zoneId: 'mire_route' }, reward: { money: 300, item: { id: 'potion', qty: 1 } }, target: 1 };
const view = (status: NpcQuestView['status'], ready = false): NpcQuestView => ({ ...plan, id: '00000000-0000-4000-8000-000000000001', npcId: NPC, npcName: 'the berry-gardener', zoneId: 'mirevale', status, progress: ready ? 1 : 0, ready, offeredAt: AT, closedAt: null });
const memory: NpcMemoryView = { npcId: NPC, known: false, summary: '', standing: 0, feeling: 'neutral', deeds: [], town: { zoneId: 'mirevale', name: 'Mirevale', score: 0, standing: 'neutral', known: 0 }, gossip: [] };

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: Record<string, unknown> | null;
}

const ASK = 'Catch me a Mossling on Mire Route, would you? I will give you 300 coins when it is done.';

function mockFetch(calls: Call[], state: NpcQuestState): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      const method = init.method ?? 'GET';
      calls.push({ url, method, body });
      if (url.includes('/npc/memory')) return Response.json(memory);
      if (url.endsWith('/npc/quests/offer')) return Response.json({ npcId: NPC, quest: view('offered'), next: null, why: 'open' });
      if (url.endsWith('/npc/quests/answer')) return Response.json(view(body?.['answer'] === 'accept' ? 'active' : 'declined'));
      if (url.endsWith('/npc/quests/claim')) return Response.json({ quest: { ...view('claimed', true), closedAt: AT }, money: 3300, items: { potion: 4 }, standing: 2 });
      if (url.includes('/npc/quests/')) return Response.json(state);
      if (body?.['stream'] === true) {
        const last = (body['messages'] as { content: string }[]).at(-1)!.content;
        const reply = last.includes('You need help') ? ASK : 'Thank you, traveller!';
        return new Response(`data: {"choices":[{"delta":{"content":${JSON.stringify(reply)}}}]}\n\ndata: [DONE]\n\n`, { status: 200 });
      }
      if (body?.['tools'] !== undefined) return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'do_nothing' } }] } }] });
      return Response.json({ choices: [{ message: { content: 'The traveller agreed to help me.' } }] });
    }),
  );
}

const flush = async (ms = 40): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

async function say(text: string): Promise<void> {
  act(() => {
    fireEvent.keyDown(window, { code: 'KeyC' });
  });
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input.closest('form')!);
    await new Promise((r) => setTimeout(r, 60));
  });
}

const streamed = (calls: Call[]): string[] => calls.filter((c) => c.body?.['stream'] === true).map((c) => (c.body!['messages'] as { content: string }[]).at(-1)!.content);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  useUiStore.getState().reset();
  endTalk();
  useSessionStore.setState({ accessToken: null });
  useNotificationsStore.setState({ toasts: [] } as never);
});

describe('DialogueBox NPC side quests', () => {
  it('asks the favour when the player asks for work, stores the offer and accepts it from the card', async () => {
    const calls: Call[] = [];
    mockFetch(calls, { npcId: NPC, quest: null, next: plan, why: null });
    useSessionStore.setState({ accessToken: 'token', accessExp: Date.now() + 3_600_000 });
    act(() => useUiStore.getState().setDialogue({ speaker: 'the berry-gardener', lines: ['Pick the partner that suits you.'], index: 0, targetId: NPC }));
    render(<DialogueBox />);
    await flush();
    expect(calls.filter((c) => c.url.endsWith(`/npc/quests/${NPC}`))).toHaveLength(1);
    expect(screen.queryByTestId('npc-quest')).toBeNull();

    await say('Do you need any help?');
    expect(streamed(calls)[0]).toBe(`Do you need any help? [${askNote(plan)}]`);
    await flush(60);
    // the tool pass said do_nothing, the words asked: the offer is stored
    expect(calls.filter((c) => c.url.endsWith('/npc/quests/offer')).map((c) => c.body)).toEqual([{ npcId: NPC }]);
    const card = screen.getByTestId('npc-quest');
    expect(card.getAttribute('data-status')).toBe('offered');
    expect(card.textContent).toContain('Catch a Mossling (Mire Route)');
    expect(card.textContent).toContain('300 coins and a Potion');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(calls.find((c) => c.url.endsWith('/npc/quests/answer'))?.body).toEqual({ questId: view('offered').id, answer: 'accept' });
    // the offer stored after the last reply is told first, as every tool event is
    expect(streamed(calls).at(-1)).toBe('[You asked the traveller for a favour and wait for their answer.] Yes, I will do it. [The traveller agrees to do it. Thank them and tell them to come back to you when it is done.]');
    expect(screen.getByTestId('npc-quest').getAttribute('data-status')).toBe('active');
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    // the ask is told once per conversation
    await say('Nice weather.');
    expect(streamed(calls).at(-1)).toBe('Nice weather.');
  });

  it('hands a ready favour in: the reward lands and the NPC hears it was paid', async () => {
    const calls: Call[] = [];
    mockFetch(calls, { npcId: NPC, quest: view('active', true), next: null, why: 'open' });
    useSessionStore.setState({ accessToken: 'token', accessExp: Date.now() + 3_600_000 });
    act(() => useUiStore.getState().setDialogue({ speaker: 'the berry-gardener', lines: ['Pick the partner that suits you.'], index: 0, targetId: NPC }));
    render(<DialogueBox />);
    await flush();
    expect(screen.getByTestId('npc-quest').getAttribute('data-ready')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hand in' }));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(calls.find((c) => c.url.endsWith('/npc/quests/claim'))?.body).toEqual({ npcId: NPC });
    expect(streamed(calls).at(-1)).toBe('I did what you asked. [The traveller did what you asked (catch a mossling (mire route)). You pay them three hundred coins and a Potion. Thank them warmly.]');
    expect(screen.queryByTestId('npc-quest')).toBeNull();
    expect(useNpcTalkStore.getState().quest).toMatchObject({ quest: null, why: 'cooldown' });
    expect(JSON.stringify(useNotificationsStore.getState())).toContain('Favour done for the berry-gardener: 300 coins and a Potion.');
  });

  it('signed out: no favour is fetched or shown', async () => {
    const calls: Call[] = [];
    mockFetch(calls, { npcId: NPC, quest: view('offered'), next: null, why: 'open' });
    act(() => useUiStore.getState().setDialogue({ speaker: 'the berry-gardener', lines: ['Pick the partner that suits you.'], index: 0, targetId: NPC }));
    render(<DialogueBox />);
    await flush();
    expect(calls.filter((c) => c.url.includes('/npc/quests'))).toEqual([]);
    expect(screen.queryByTestId('npc-quest')).toBeNull();
  });
});
