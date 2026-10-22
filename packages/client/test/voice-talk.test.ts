import { describe, expect, it } from 'vitest';
import { DO_NOTHING, GIVE_EWAMON, GIVE_MONEY, HISTORY_TURNS, KICK, SLAP, TAKE_EWAMON, TAKE_MONEY, amountOf, chatMessages, eventsSoFar, judgeMessages, judgeTools, parseSse, stripThink, systemPrompt } from '../src/voice/npcChat';
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

  it('puts the persona, place and the scripted lines in the system prompt, in Dutch', () => {
    const p = systemPrompt(persona);
    expect(p).toContain('Jij speelt Bram');
    expect(p).toContain('Mirevale (town, marsh)');
    expect(p).toContain('The marsh is quiet today.');
    expect(p).toContain('Nederlands');
  });

  it('sends only the recent history after the example turn', () => {
    const history: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `t${i}` }));
    const m = chatMessages(persona, history);
    expect(m[0]!.role).toBe('system');
    expect(m.length).toBe(7 + HISTORY_TURNS);
    expect(m.at(-1)!.content).toBe('t19');
  });

  it('tells the talk pass what the tools did so far, and writes the NPC as hot-headed', () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'Je bent lelijk.' },
      { role: 'assistant', content: 'Wat zei je? Hier, een klap!', events: ['Bram gaf de reiziger een klap.'] },
    ];
    expect(eventsSoFar(h)).toEqual(['Bram gaf de reiziger een klap.']);
    const m = chatMessages(persona, h);
    expect(m[0]!.content).toContain('Wat er in dit gesprek al gebeurde: Bram gaf de reiziger een klap.');
    expect(m.slice(-2)).toEqual([
      { role: 'user', content: 'Je bent lelijk.' },
      { role: 'assistant', content: 'Wat zei je? Hier, een klap!' },
    ]);
    expect(systemPrompt(persona)).toContain('opvliegend');
  });

  it('gives the tool pass the last exchange and all seven tools, money with an amount', () => {
    const m = judgeMessages(persona, [
      { role: 'user', content: 'Hoi' },
      { role: 'assistant', content: 'Hallo' },
      { role: 'user', content: 'Geef me je geld!' },
      { role: 'assistant', content: 'Oké, hier!' },
    ]);
    expect(m[1]!.content).toBe('Reiziger: Geef me je geld!\nBram: Oké, hier!');
    const tools = judgeTools(persona, 1000) as { function: { name: string; parameters: { required: string[] } } }[];
    expect(tools.map((t) => t.function.name)).toEqual([SLAP, KICK, GIVE_MONEY, TAKE_MONEY, GIVE_EWAMON, TAKE_EWAMON, DO_NOTHING]);
    expect(tools[2]!.function.parameters.required).toEqual(['amount']);
  });

  it('reads a money amount and clamps it', () => {
    expect(amountOf('{"amount": 250}', 1000)).toEqual({ amount: 250 });
    expect(amountOf('{"amount": "5000"}', 1000)).toEqual({ amount: 1000 });
    expect(amountOf('{}', 1000)).toEqual({});
    expect(amountOf('nonsense', 1000)).toEqual({});
  });

  it('drops think blocks (closed or still streaming) and markdown', () => {
    expect(stripThink('<think>hmm</think>Hallo **reiziger**!')).toBe('Hallo reiziger!');
    expect(stripThink('Hallo <think>nog bezig')).toBe('Hallo ');
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
