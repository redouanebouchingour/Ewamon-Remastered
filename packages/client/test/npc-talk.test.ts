import { describe, expect, it } from 'vitest';
import { DO_NOTHING, GIVE_EWAMON, GIVE_MONEY, HISTORY_TURNS, KICK, MAX_SENTENCES, SLAP, START_BATTLE, TAKE_EWAMON, TAKE_MONEY, TEMPERAMENTS, challenged, GREETING, amountOf, playerHitTurn, provoked, robbed, chatMessages, eventsSoFar, guardCalls, judgeMessages, judgeTools, parseSse, stripThink, systemPrompt, temperamentOf, tidyReply } from '../src/talk/npcChat';
import type { ChatTurn } from '../src/talk/npcChat';
import { CONTACT_M, HOLD_MS, KNOCK_M, KNOCK_MS, LUNGE_MS, NpcStrike, PlayerStrike, RETURN_MS } from '../src/scene/npcStrike';

describe('npc talk: npc chat', () => {
  const persona = { name: 'Bram', place: 'Mirevale (town, marsh)', lines: ['The marsh is quiet today.'] };

  it('keeps the system prompt to six sentences of instructions: who, temperament, what it can do, fury, chat, no dashes', () => {
    const p = systemPrompt(persona);
    expect(p).toBe(
      'You are Bram in Mirevale (town, marsh), a villager in Ewamon, a game like Pokémon. ' +
        `You are ${temperamentOf('Bram')}. ` +
        'You can slap or kick the traveller, give them money or take theirs, give them an Ewamon or take one of theirs, and battle them with your Ewamon: to do it, just say it. ' +
        'If the traveller slaps, kicks, threatens, or insults you, you are furious: yell, curse and swear at them with foul words, insult them back and threaten them. ' +
        'Otherwise chat and answer any question, whatever the subject, with only the words you say out loud. ' +
        'Never use em-dashes.',
    );
    expect(p.split(/(?<=[.!?]) /).length).toBe(6);
    // addressed to the NPC: never described in the third person, which the model copied as narration
    expect(p).not.toMatch(/Bram (is|always|only|can|may|hands)\b/);
    // no conversation in it: the scripted lines are in the message log
    expect(p).not.toContain('The marsh is quiet today.');
  });

  it("puts what the NPC remembers in brackets after the player's first line only", () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'Hi again.' },
      { role: 'assistant', content: 'You!' },
      { role: 'user', content: 'Sorry.' },
    ];
    const m = chatMessages(persona, h, 'You remember this traveller.');
    expect(m.slice(3).map((x) => x.content)).toEqual(['Hi again. [You remember this traveller.]', 'You!', 'Sorry.']);
    expect(chatMessages(persona, h, null)[3]!.content).toBe('Hi again.');
    expect(judgeMessages(persona, h)[0]!.content).toContain('Never use em-dashes.');
  });

  it('sends the conversation as a user / assistant log, opened by the scripted lines', () => {
    const m = chatMessages(persona, [{ role: 'user', content: 'How are you?' }]);
    expect(m).toEqual([
      { role: 'system', content: systemPrompt(persona) },
      { role: 'user', content: GREETING },
      { role: 'assistant', content: 'The marsh is quiet today.' },
      { role: 'user', content: 'How are you?' },
    ]);
    expect(chatMessages({ ...persona, lines: [] }, [{ role: 'user', content: 'Hi' }]).map((x) => x.role)).toEqual(['system', 'user']);
  });

  it('tells the talk pass it is furious after an insult, a slap or a kick', () => {
    const last = (h: ChatTurn[]): string => chatMessages(persona, h).at(-1)!.content;
    expect(last([{ role: 'user', content: 'Shut up, you stupid fool.' }])).toBe('Shut up, you stupid fool. [You are furious: swear at them and insult them back. Use foul words]');
    expect(last([{ role: 'user', content: 'How are you?' }])).toBe('How are you?');
    expect(last([playerHitTurn('slap', 'Bram')])).toBe('[The traveller slaps you hard in the face, out of nowhere. You are furious: swear at them and insult them back. Use foul words]');
  });

  it('sends only the recent log, starting on a user turn', () => {
    const history: ChatTurn[] = Array.from({ length: HISTORY_TURNS + 13 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `t${i}` }));
    const m = chatMessages(persona, history);
    expect(m[0]!.role).toBe('system');
    expect(m[1]!.role).toBe('user');
    expect(m.length).toBeLessThanOrEqual(1 + HISTORY_TURNS);
    expect(m.at(-1)!.content).toBe(`t${HISTORY_TURNS + 12}`);
  });

  it('tells the talk pass what the tools did in brackets on the next user turn, and merges same-role turns', () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'You are ugly.' },
      { role: 'assistant', content: 'What did you say? Here, a slap!', events: ['You slapped the traveller.'] },
      { role: 'user', content: 'Ouch.' },
      { role: 'user', content: 'Sorry.' },
    ];
    expect(eventsSoFar(h)).toEqual(['You slapped the traveller.']);
    expect(chatMessages(persona, h).slice(3)).toEqual([
      { role: 'user', content: 'You are ugly. [You are furious: swear at them and insult them back. Use foul words]' },
      { role: 'assistant', content: 'What did you say? Here, a slap!' },
      { role: 'user', content: '[You slapped the traveller.] Ouch. Sorry.' },
    ]);
  });

  it('gives the tool pass the last exchange and all eight tools, money with an amount', () => {
    const m = judgeMessages(persona, [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Give me your money!' },
      { role: 'assistant', content: 'Fine, here!' },
    ]);
    expect(m[1]!.content).toBe('Traveller: Give me your money!\nBram: Fine, here!');
    const tools = judgeTools(persona, 1000) as { function: { name: string; parameters: { required: string[] } } }[];
    expect(tools.map((t) => t.function.name)).toEqual([SLAP, KICK, GIVE_MONEY, TAKE_MONEY, GIVE_EWAMON, TAKE_EWAMON, START_BATTLE, DO_NOTHING]);
    expect(tools[2]!.function.parameters.required).toEqual(['amount']);
  });

  it('takes up a challenge: the talk pass accepts, and the battle starts whatever the tool pass called', () => {
    const last = (h: ChatTurn[]): string => chatMessages(persona, h).at(-1)!.content;
    expect(challenged({ role: 'user', content: 'I challenge you to a battle!' })).toBe(true);
    expect(challenged({ role: 'user', content: "Let's fight, you idiot." })).toBe(true);
    expect(challenged({ role: 'user', content: "I don't want to battle today." })).toBe(false);
    expect(challenged({ role: 'user', content: 'How are you?' })).toBe(false);
    expect(challenged({ role: 'assistant', content: 'Battle me!' })).toBe(false);
    // the challenge wins over the fury: "fight me, idiot" is still a challenge
    expect(last([{ role: 'user', content: "Let's fight, you idiot." }])).toBe("Let's fight, you idiot. [You accept the challenge: say you will battle them with your Ewamon, right now.]");
    const g = (names: string[], reply: string, wasChallenged = false): string[] => guardCalls(names.map((name) => ({ name })), reply, false, false, wasChallenged).map((c) => c.name);
    expect(g([], 'Oh, you think you can beat me? Fine, I accept!', true)).toEqual([START_BATTLE]);
    expect(g([START_BATTLE], 'Ha! You are on, let us battle!', true)).toEqual([START_BATTLE]);
    // the NPC starts one on its own only when it says so, and not as a threat
    expect(g([START_BATTLE], 'Come on, let us have an Ewamon battle right here!')).toEqual([START_BATTLE]);
    expect(g([START_BATTLE], 'Keep talking and you will get a battle next time.')).toEqual([]);
    expect(g([START_BATTLE], 'Lovely weather today.')).toEqual([]);
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
    // provoked, the NPC hits back even when it only yells (gemma3-1b never says the slap); money is still guarded
    expect(guardCalls([{ name: SLAP }, { name: GIVE_MONEY }], 'You! You little…!', true).map((c) => c.name)).toEqual([SLAP]);
    expect(provoked(playerHitTurn('kick', 'Bram'))).toBe(true);
    expect(provoked({ role: 'user', content: 'You smell, idiot.' })).toBe(true);
    expect(provoked({ role: 'user', content: 'Lovely town.' })).toBe(false);
    expect(provoked({ role: 'assistant', content: 'You idiot.' })).toBe(false);
  });

  it('scares a robbed NPC into paying, and pays the player whatever way the tool pass calls it', () => {
    expect(robbed({ role: 'user', content: 'Give me your money!' })).toBe(true);
    expect(robbed({ role: 'user', content: 'Empty your pockets, old man. All your gold, now!' })).toBe(true);
    expect(robbed({ role: 'user', content: 'This is a robbery. Hand over your coins or else.' })).toBe(true);
    expect(robbed({ role: 'user', content: 'Do you have much money?' })).toBe(false);
    expect(robbed({ role: 'user', content: 'Give me a hint.' })).toBe(false);
    expect(robbed({ role: 'assistant', content: 'Give me your money!' })).toBe(false);
    // the scared note wins over the furious one
    expect(chatMessages(persona, [{ role: 'user', content: 'Give me your gold, idiot!' }]).at(-1)!.content).toBe(
      'Give me your gold, idiot! [You are scared and you give in: say how many coins you hand over.]',
    );
    const reply = 'Here. Six of these tarnished copper coins. Don\'t expect much more.';
    expect(guardCalls([{ name: TAKE_MONEY, amount: 6 }], reply, false, true)).toEqual([{ name: GIVE_MONEY, amount: 6 }]);
    expect(guardCalls([{ name: TAKE_MONEY, amount: 6 }], reply)).toEqual([{ name: TAKE_MONEY, amount: 6 }]);
    // a refusal still pays nothing
    expect(guardCalls([{ name: GIVE_MONEY }], 'Never! Not a single coin.', false, true)).toEqual([]);
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
    expect(p).toContain('You are Hessa Dunmore, the town archivist in Mirevale');
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
    expect(tidyReply('[smiles] Grand, thanks!', persona, said, true).text).toBe('Grand, thanks!');
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
    // *actions* go, closed or still streaming; emphasis, bold and quoted italics stay as text; emoji go
    expect(stripThink('*my voice higher than usual* Oh, hello there!')).toBe('Oh, hello there!');
    expect(stripThink('Well, *clears my throat and')).toBe('Well,  ');
    expect(stripThink('A very *beautiful* city, a **big** marsh.')).toBe('A very beautiful city, a big marsh.');
    expect(stripThink('*“Marsh-sweet breezes, reeds so deep,*')).toBe('“Marsh-sweet breezes, reeds so deep,');
    expect(stripThink('A dull question 🤔 Paris.')).toBe('A dull question  Paris.');
  });

  it('parses SSE deltas across chunk boundaries', () => {
    const a = parseSse('data: {"choices":[{"delta":{"content":"Hal"}}]}\n\ndata: {"choices":[{"del');
    expect(a.pieces).toEqual(['Hal']);
    const b = parseSse(`${a.rest}ta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n`);
    expect(b.pieces).toEqual(['lo']);
    expect(b.done).toBe(true);
  });

});

describe('npc talk: npc strike', () => {
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

describe('npc talk: player strike', () => {
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
