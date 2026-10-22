import { describe, expect, it } from 'vitest';
import { DO_NOTHING, GIVE_EWAMON, GIVE_MONEY, HISTORY_TURNS, KICK, MAX_SENTENCES, SLAP, TAKE_EWAMON, TAKE_MONEY, TEMPERAMENTS, amountOf, chatMessages, eventsSoFar, guardCalls, judgeMessages, judgeTools, parseSse, stripThink, systemPrompt, temperamentOf, tidyReply } from '../src/voice/npcChat';
import type { ChatTurn } from '../src/voice/npcChat';
import { CONTACT_M, HOLD_MS, KNOCK_M, KNOCK_MS, LUNGE_MS, NpcStrike, PlayerStrike, RETURN_MS } from '../src/scene/npcStrike';

describe('voice talk: npc chat', () => {
  const persona = { name: 'Bram', place: 'Mirevale (town, marsh)', lines: ['The marsh is quiet today.'] };

  it('keeps the system prompt short: who the NPC is, then engage and answer anything', () => {
    const p = systemPrompt(persona);
    expect(p).toBe(
      'You are an NPC in the game Ewamon. Act accordingly.\n\n' +
      'Ewamon is a game similar to pokemon, but instead of pokemons contains ewamons\n\n' +
        'The character you play is:\n' +
        `You are Bram, who lives in Mirevale (town, marsh). You are ${temperamentOf('Bram')}. ` +
        'Earlier you said to the traveller: "The marsh is quiet today."\n\n' +
        'Engage, and answer any question the user asks you. No matter the subject.',
    );
    // addressed to the NPC: never described in the third person, which the model copied as narration
    expect(p).not.toMatch(/Bram (is|always|only|can|may|hands)\b/);
    // no refusal, stay-in-world or brevity rules
    expect(p).not.toMatch(/only know|sentences|stand up for yourself/);
  });

  it('sends the persona and only the recent history, no example turns', () => {
    const history: ChatTurn[] = Array.from({ length: HISTORY_TURNS + 12 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `t${i}` }));
    const m = chatMessages(persona, history);
    expect(m[0]!.role).toBe('system');
    expect(m.length).toBe(1 + HISTORY_TURNS);
    expect(m.at(-1)!.content).toBe(`t${HISTORY_TURNS + 11}`);
  });

  it('tells the talk pass what the tools did so far, in one short sentence', () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'You are ugly.' },
      { role: 'assistant', content: 'What did you say? Here, a slap!', events: ['You slapped the traveller.'] },
    ];
    expect(eventsSoFar(h)).toEqual(['You slapped the traveller.']);
    const m = chatMessages(persona, h);
    expect(m[0]!.content).toContain('So far in this conversation: You slapped the traveller.\n\nEngage,');
    expect(m.slice(-2)).toEqual([
      { role: 'user', content: 'You are ugly.' },
      { role: 'assistant', content: 'What did you say? Here, a slap!' },
    ]);
    expect(systemPrompt(persona)).not.toContain('So far');
  });

  it('gives the tool pass the last exchange and all seven tools, money with an amount', () => {
    const m = judgeMessages(persona, [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Give me your money!' },
      { role: 'assistant', content: 'Fine, here!' },
    ]);
    expect(m[1]!.content).toBe('Traveller: Give me your money!\nBram: Fine, here!');
    const tools = judgeTools(persona, 1000) as { function: { name: string; parameters: { required: string[] } } }[];
    expect(tools.map((t) => t.function.name)).toEqual([SLAP, KICK, GIVE_MONEY, TAKE_MONEY, GIVE_EWAMON, TAKE_EWAMON, DO_NOTHING]);
    expect(tools[2]!.function.parameters.required).toEqual(['amount']);
  });

  it('guards the tool calls with the NPC\'s words: threats drop, give / take follow the wording', () => {
    const g = (names: string[], reply: string): string[] => guardCalls(names.map((name) => ({ name })), reply).map((c) => c.name);
    expect(g([SLAP], 'What did you say? Here, a slap in your face!')).toEqual([SLAP]);
    expect(g([SLAP], 'Watch your mouth or I will slap you next time.')).toEqual([]);
    expect(g([KICK], 'Get out! *kicks you out the door*')).toEqual([KICK]);
    expect(g([SLAP], 'Fine, thanks! Busy day.')).toEqual([]);
    expect(g([TAKE_MONEY], 'Alright, alright! Take it, here are 200 coins, just leave me alone!')).toEqual([GIVE_MONEY]);
    expect(g([GIVE_MONEY, SLAP], 'You dare? I am taking 500 coins from you as payment, and a slap too!')).toEqual([TAKE_MONEY, SLAP]);
    expect(g([GIVE_MONEY], 'Never! You will get nothing from me.')).toEqual([]);
    expect(g([GIVE_EWAMON], 'Then I will just take that Ewamon of yours off your hands!')).toEqual([TAKE_EWAMON]);
    expect(g([TAKE_EWAMON], 'Do not worry, take my old Ewamon, it will protect you.')).toEqual([GIVE_EWAMON]);
    expect(g([GIVE_EWAMON], 'Maybe if you are nicer to me someday.')).toEqual([]);
    expect(guardCalls([{ name: GIVE_MONEY, amount: 50 }, { name: GIVE_MONEY, amount: 50 }], 'Here, have 50 coins.')).toEqual([{ name: GIVE_MONEY, amount: 50 }]);
  });

  it('reads a money amount and clamps it', () => {
    expect(amountOf('{"amount": 250}', 1000)).toEqual({ amount: 250 });
    expect(amountOf('{"amount": "5000"}', 1000)).toEqual({ amount: 1000 });
    expect(amountOf('{}', 1000)).toEqual({});
    expect(amountOf('nonsense', 1000)).toEqual({});
  });

  it('gives each NPC one temperament, the same on every visit, and its title', () => {
    expect(temperamentOf('Bram')).toBe(temperamentOf('Bram'));
    expect(TEMPERAMENTS).toContain(temperamentOf('Hessa Dunmore'));
    expect(new Set(['Bram', 'Hessa Dunmore', 'Old Hester', 'Pip', 'Wynn', 'Sable'].map(temperamentOf)).size).toBeGreaterThan(2);
    const p = systemPrompt({ ...persona, name: 'Hessa Dunmore', role: 'Town Archivist' });
    expect(p).toContain('You are Hessa Dunmore, the town archivist, who lives in Mirevale');
    expect(p).toContain(temperamentOf('Hessa Dunmore'));
  });

  it('tidies the reply: no stage directions or quotes, no echoed lines, at most six sentences', () => {
    const said = 'How are you today?';
    // brackets and quotes go; the scripted line and the echoed question are dropped
    expect(tidyReply('(I squint at you) "How are you today? The marsh is quiet today. Grand, thanks!"', persona, said, true).text).toBe('Grand, thanks!');
    // capped, and full once the cap is reached (the stream stops there)
    const long = 'One. Two! Three? Four. Five. Six. Seven.';
    expect(tidyReply(long, persona, said, true)).toEqual({ text: 'One. Two! Three? Four. Five. Six.', full: true });
    expect(MAX_SENTENCES).toBe(6);
    // a bracket right after a word is code, not a stage direction
    expect(tidyReply('Sure! Try this: for e in ewamon: print(e)', persona, said, true).text).toBe('Sure! Try this: for e in ewamon: print(e)');
    // while streaming the unfinished sentence shows but does not count; a mid-sentence ellipsis goes on
    expect(tidyReply('It is a bit… restless. And the reeds', persona, said, false)).toEqual({ text: 'It is a bit… restless. And the reeds', full: false });
    // a reply that is only an echo is kept rather than shown empty
    expect(tidyReply('The marsh is quiet today.', persona, said, true).text).toBe('The marsh is quiet today.');
  });

  it('drops think blocks (closed or still streaming) and markdown', () => {
    expect(stripThink('<think>hmm</think>Hello **traveller**!')).toBe('Hello traveller!');
    expect(stripThink('Hello <think>still going')).toBe('Hello ');
    // a closing tag without its opening one: what came before it goes, the reply after it stays
    expect(stripThink('I am Bram.\n</think>\n\nI am Bram.')).toBe('I am Bram.');
    expect(stripThink('the user greets me</think>Hi there!')).toBe('Hi there!');
  });

  it('parses SSE deltas across chunk boundaries', () => {
    const a = parseSse('data: {"choices":[{"delta":{"content":"Hal"}}]}\n\ndata: {"choices":[{"del');
    expect(a.pieces).toEqual(['Hal']);
    const b = parseSse(`${a.rest}ta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n`);
    expect(b.pieces).toEqual(['lo']);
    expect(b.done).toBe(true);
  });

});

describe('voice talk: npc strike', () => {
  it('lunges in, fires the hit at contact, walks home and lets go', () => {
    const calls: [string, number, number, boolean][] = [];
    const actors = { setTransform: (id: string, x: number, z: number, _a: number, moving: boolean) => void calls.push([id, x, z, moving]), setEmote: () => undefined };
    const s = new NpcStrike(actors);
    let hits = 0;
    s.start('bram', { x: 0, z: 0, angle: 0 }, 0, 3, () => hits++);
    expect(s.active).toBe(true);
    s.update(LUNGE_MS);
    expect(hits).toBe(1);
    expect(calls.at(-1)![2]).toBeCloseTo(3 - CONTACT_M);
    s.update(HOLD_MS);
    s.update(HOLD_MS);
    s.update(RETURN_MS);
    expect(s.active).toBe(false);
    expect(calls.at(-1)).toEqual(['bram', 0, 0, false]);
  });
});

describe('voice talk: player strike', () => {
  it('runs the player at the NPC and back; a kick throws the NPC and it walks home', () => {
    const npc: [number, number][] = [];
    const actors = { setTransform: (_id: string, x: number, z: number) => void npc.push([x, z]), setEmote: () => undefined };
    const s = new PlayerStrike(actors);
    let hits = 0;
    s.start('kick', 'bram', { x: 0, z: 3, angle: 0 }, 0, 0, () => hits++);
    s.update(LUNGE_MS);
    expect(hits).toBe(1);
    expect(s.z).toBeCloseTo(3 - CONTACT_M);
    s.update(KNOCK_MS);
    expect(npc.at(-1)![1]).toBeCloseTo(3 + KNOCK_M);
    s.update(1);
    s.update(RETURN_MS);
    expect(s.active).toBe(false);
    expect(s.z).toBeCloseTo(0);
    expect(npc.at(-1)).toEqual([0, 3]);
  });
});
