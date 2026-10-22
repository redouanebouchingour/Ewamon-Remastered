import { describe, expect, it } from 'vitest';
import { DO_NOTHING, GIVE_EWAMON, GIVE_MONEY, HISTORY_TURNS, KICK, SLAP, TAKE_EWAMON, TAKE_MONEY, amountOf, chatMessages, eventsSoFar, guardCalls, judgeMessages, judgeTools, parseSse, stripThink, systemPrompt } from '../src/voice/npcChat';
import type { ChatTurn } from '../src/voice/npcChat';
import { encodeWav, rms } from '../src/voice/wav';
import { CONTACT_M, HOLD_MS, KNOCK_M, KNOCK_MS, LUNGE_MS, NpcStrike, PlayerStrike, RETURN_MS } from '../src/scene/npcStrike';

describe('voice talk: wav', () => {
  it('writes a 16 kHz mono 16-bit PCM header and clamped samples', () => {
    const buf = encodeWav(new Float32Array([0, 1, -1, 2]));
    const v = new DataView(buf);
    const tag = (at: number): string => String.fromCharCode(...new Uint8Array(buf, at, 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 0x7fff, -0x8000, 0x7fff]);
  });

  it('measures silence as silence', () => {
    expect(rms(new Float32Array(100))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});

describe('voice talk: npc chat', () => {
  const persona = { name: 'Bram', place: 'Mirevale (town, marsh)', lines: ['The marsh is quiet today.'] };

  it('puts the persona, place and the scripted lines in the system prompt, in English, asking for the first person', () => {
    const p = systemPrompt(persona);
    expect(p).toContain('You are Bram');
    expect(p).toContain('Mirevale (town, marsh)');
    expect(p).toContain('The marsh is quiet today.');
    expect(p).toContain('in English');
    expect(p).toContain('in the first person');
    // addressed to the NPC: never described in the third person, which the model copied as narration
    expect(p).not.toMatch(/Bram (is|always|only|can|may|hands)\b/);
  });

  it('sends only the recent history after the example turn', () => {
    const history: ChatTurn[] = Array.from({ length: HISTORY_TURNS + 12 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `t${i}` }));
    const m = chatMessages(persona, history);
    expect(m[0]!.role).toBe('system');
    expect(m.length).toBe(7 + HISTORY_TURNS);
    expect(m.at(-1)!.content).toBe(`t${HISTORY_TURNS + 11}`);
  });

  it('tells the talk pass what the tools did so far, and writes the NPC as hot-headed', () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'You are ugly.' },
      { role: 'assistant', content: 'What did you say? Here, a slap!', events: ['You slapped the traveller.'] },
    ];
    expect(eventsSoFar(h)).toEqual(['You slapped the traveller.']);
    const m = chatMessages(persona, h);
    expect(m[0]!.content).toContain('What has happened in this conversation so far: You slapped the traveller.');
    expect(m.slice(-2)).toEqual([
      { role: 'user', content: 'You are ugly.' },
      { role: 'assistant', content: 'What did you say? Here, a slap!' },
    ]);
    expect(systemPrompt(persona)).toContain('hot-headed');
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

  it('drops think blocks (closed or still streaming) and markdown', () => {
    expect(stripThink('<think>hmm</think>Hello **traveller**!')).toBe('Hello traveller!');
    expect(stripThink('Hello <think>still going')).toBe('Hello ');
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
