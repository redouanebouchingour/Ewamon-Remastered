/**
 * NPC memory in the talk (talk/npcMemory.ts): the note the talk pass reads (memory, gossip, how to feel), the deeds a
 * conversation reports (from what happened, never from the model), the summary call and its fallback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NpcMemoryView } from '@ewa/protocol';
import { cleanSummary, deedPhrase, deedsOf, fallbackSummary, hadExchange, memoryNote, summarize, summaryMessages } from '../src/talk/npcMemory';
import { playerHitTurn } from '../src/talk/npcChat';
import type { ChatTurn } from '../src/talk/npcChat';

afterEach(() => vi.unstubAllGlobals());

const persona = { name: 'Hessa Dunmore', role: 'town archivist', place: 'Mirevale (town, grove)', lines: ['Three witnessed.'] };
const AT = '2026-10-24T12:00:00.000Z';
const view = (over: Partial<NpcMemoryView> = {}): NpcMemoryView => ({
  npcId: 'mirevale.archivist',
  known: false,
  summary: '',
  standing: 0,
  feeling: 'neutral',
  deeds: [],
  town: { zoneId: 'mirevale', name: 'Mirevale', score: 0, standing: 'neutral', known: 0 },
  gossip: [],
  ...over,
});

describe('memoryNote', () => {
  it('says nothing for a stranger the town knows nothing about', () => {
    expect(memoryNote(null)).toBeNull();
    expect(memoryNote(view())).toBeNull();
  });

  it('remembers a slap coldly, and a friend warmly', () => {
    expect(memoryNote(view({ known: true, summary: 'The traveller slapped me.', standing: -3, feeling: 'wary' }))).toBe(
      'You know this traveller and you do not trust them. Tell them why, coldly. What you remember of them: The traveller slapped me.',
    );
    expect(memoryNote(view({ known: true, summary: 'They thanked me.', standing: 3, feeling: 'liked' }))).toBe(
      'You know this traveller and you like them. Greet them like a friend and bring up what you remember of them. What you remember of them: They thanked me.',
    );
    expect(memoryNote(view({ known: true, standing: -8, feeling: 'hostile', deeds: [{ deed: 'battleWon', at: AT }] }))).toBe(
      'You know this traveller and you hate them. Be rude and cold, and tell them why. What you remember of them: They beat you in an Ewamon battle.',
    );
    // a stranger in a town that distrusts them, nobody's deed to tell
    expect(memoryNote(view({ feeling: 'wary', town: { zoneId: 'mirevale', name: 'Mirevale', score: -4, standing: 'wary', known: 1 } }))).toBe(
      'You have not met this traveller, but Mirevale does not trust them. Be wary of them.',
    );
  });

  it('passes on the town gossip to a stranger', () => {
    const n = memoryNote(
      view({
        feeling: 'wary',
        town: { zoneId: 'mirevale', name: 'Mirevale', score: -5, standing: 'wary', known: 1 },
        gossip: [
          { npcId: 'mirevale.child', npcName: 'a child', deed: 'hit', at: AT },
          { npcId: 'mirevale.gardener', npcName: 'the berry-gardener', deed: 'insulted', at: AT },
        ],
      }),
    );
    expect(n).toBe('You have not met this traveller, but people in Mirevale say the traveller hit a child and insulted the berry-gardener. You are wary of them: say what you heard.');
    expect(deedPhrase('battleLost', 'Hessa Dunmore, town archivist')).toBe('lost an Ewamon battle to Hessa Dunmore');
  });
});

describe('deedsOf', () => {
  const u = (content: string): ChatTurn => ({ role: 'user', content });
  it('reads what the player did: hits, robbery, insults, threats; kind words only in a clean conversation', () => {
    expect(deedsOf([playerHitTurn('slap', 'Hessa'), u('you stupid fool')])).toEqual(['hit', 'insulted']);
    expect(deedsOf([u('give me your money now or else')])).toEqual(['robbed']);
    expect(deedsOf([u("watch your back, I'll hurt you")])).toEqual(['threatened']);
    expect(deedsOf([u('thank you, that is lovely')])).toEqual(['kindWords']);
    expect(deedsOf([u("you're so kind")])).toEqual(['kindWords']);
    // a nice word about the weather is no kindness to anyone
    expect(deedsOf([u('Hi there! Nice day, right?')])).toEqual([]);
    expect(deedsOf([u('thanks'), u('idiot')])).toEqual(['insulted']);
    expect(deedsOf([u('what is the best starter?'), { role: 'assistant', content: 'Thank you!' }])).toEqual([]);
  });

  it('a conversation counts once the NPC replied', () => {
    expect(hadExchange([u('hi')])).toBe(false);
    expect(hadExchange([u('hi'), { role: 'assistant', content: '…' }])).toBe(false);
    expect(hadExchange([u('hi'), { role: 'assistant', content: 'Hello.' }])).toBe(true);
  });
});

describe('the summary', () => {
  const turns: ChatTurn[] = [playerHitTurn('slap', 'Hessa'), { role: 'assistant', content: 'How dare you!', events: ['You slapped the traveller.'] }];

  it('reads the conversation as plain lines and asks for the NPC\'s own words, no dashes', () => {
    const m = summaryMessages(persona, turns);
    expect(m[0]!.content).toContain('Write as yourself (I, me)');
    expect(m[0]!.content).toContain('Never use em-dashes.');
    expect(m[1]!.content).toBe('(The traveller slapped you.)\nHessa Dunmore: How dare you! [You slapped the traveller.]');
  });

  it('keeps two sentences, no dashes or quotes; refuses junk', () => {
    expect(cleanSummary('"The traveller slapped me \u2014 hard. I am angry. I will never forget."')).toBe('The traveller slapped me, hard. I am angry.');
    expect(cleanSummary('Traveller: hi')).toBeNull();
    expect(cleanSummary('ok')).toBeNull();
  });

  it('falls back to what happened when the model fails or writes junk', async () => {
    expect(fallbackSummary(turns)).toBe('The traveller hit me. I slapped the traveller.');
    expect(fallbackSummary([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Hello.' }])).toBe('The traveller stopped to chat with me.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    expect(await summarize(persona, turns)).toBe('The traveller hit me. I slapped the traveller.');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: 'The traveller slapped me. I am still angry.' } }] })));
    expect(await summarize(persona, turns)).toBe('The traveller slapped me. I am still angry.');
    const f = vi.fn(async () => Response.json({ choices: [{ message: { content: '' } }] }));
    vi.stubGlobal('fetch', f);
    expect(await summarize(persona, turns)).toBe('The traveller hit me. I slapped the traveller.');
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ temperature: 0.2, max_tokens: 90, stream: false });
  });
});
