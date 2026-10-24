/**
 * NPC side quests in the talk (talk/npcQuest.ts, talk/npcChat.ts): the favour worded for the talk pass and the card,
 * when a line carries the ask, the player's yes / no / "done", the `offer_quest` tool only on an exchange that carried
 * the ask, and its guard (the NPC's words must ask; the coins it names there are a promise, not a payment).
 */
import { describe, expect, it } from 'vitest';
import type { NpcQuestPlan } from '@ewa/protocol';
import { GIVE_MONEY, START_BATTLE, TAKE_MONEY, chatMessages, guardCalls, judgeMessages, judgeTools } from '../src/talk/npcChat';
import type { ChatTurn } from '../src/talk/npcChat';
import { OFFER_QUEST, numberWords, answerOf, askNote, asksForWork, claimedNote, guardOffer, objectiveText, rewardText, saysDone, shouldAsk } from '../src/talk/npcQuest';

const persona = { name: 'Bram', place: 'Mirevale (town, marsh)', lines: ['The marsh is quiet today.'] };
const catchPlan: NpcQuestPlan = { objective: { kind: 'catch', species: 'mossling', zoneId: 'mire_route' }, reward: { money: 300, item: { id: 'potion', qty: 1 } }, target: 1 };
const D = String.fromCharCode(0x2014);

describe('npc quest wording', () => {
  it('words every objective and reward for the card and the talk pass', () => {
    expect(objectiveText(catchPlan.objective)).toBe('Catch a Mossling (Mire Route)');
    expect(objectiveText({ kind: 'defeat', zoneId: 'mire_route', count: 3 })).toBe('Beat 3 wild Ewamon on Mire Route');
    expect(objectiveText({ kind: 'show', type: 'Water', level: 12, zoneId: 'mire_route' })).toBe('Show a Water-type Ewamon of level 12 or more');
    expect(objectiveText({ kind: 'deliver', item: 'potion', qty: 2, zoneId: 'mirevale' })).toBe('Bring 2 Potions');
    expect(objectiveText({ kind: 'visit', zoneId: 'mire_route' })).toBe('Go to Mire Route');
    expect(rewardText(catchPlan.reward)).toBe('300 coins and a Potion');
    expect(rewardText({ money: 120, item: { id: 'spark_orb', qty: 2 } })).toBe('120 coins and 2 Spark Orbs');
    expect(rewardText({ money: 90, item: null })).toBe('90 coins');
    expect(askNote(catchPlan)).toBe('You need help: ask the traveller to catch a Mossling for you, it lives on Mire Route. Promise them three hundred coins and a Potion when it is done.');
    expect(askNote({ ...catchPlan, objective: { kind: 'deliver', item: 'antidote', qty: 1, zoneId: 'mirevale' } })).toContain('bring you 1 Antidote, the shop in Mirevale sells them');
    expect(claimedNote(catchPlan.objective, catchPlan.reward)).toBe('The traveller did what you asked (catch a mossling (mire route)). You pay them three hundred coins and a Potion. Thank them warmly.');
    expect([0, 7, 15, 20, 45, 100, 120, 340, 800, 999].map(numberWords)).toEqual(['zero', 'seven', 'fifteen', 'twenty', 'forty-five', 'one hundred', 'one hundred and twenty', 'three hundred and forty', 'eight hundred', 'nine hundred and ninety-nine']);
    expect(rewardText({ money: 250, item: { id: 'potion', qty: 2 } }, true)).toBe('two hundred and fifty coins and two Potions');
    for (const s of [askNote(catchPlan), objectiveText(catchPlan.objective), rewardText(catchPlan.reward)]) expect(s).not.toContain(D);
  });

  it('asks on a request for work or the second line, once, never when provoked or disliked', () => {
    const base = { hasNext: true, asked: false, feeling: 'neutral' as const, calm: true, said: 'Nice day.', userLine: 1 };
    expect(shouldAsk(base)).toBe(false);
    expect(shouldAsk({ ...base, userLine: 2 })).toBe(true);
    expect(shouldAsk({ ...base, said: 'Do you need any help?' })).toBe(true);
    expect(shouldAsk({ ...base, said: 'Got any errands for me?' })).toBe(true);
    expect(shouldAsk({ ...base, userLine: 2, asked: true })).toBe(false);
    expect(shouldAsk({ ...base, userLine: 2, hasNext: false })).toBe(false);
    expect(shouldAsk({ ...base, userLine: 2, calm: false })).toBe(false);
    expect(shouldAsk({ ...base, said: 'Need help?', feeling: 'wary' })).toBe(false);
    expect(shouldAsk({ ...base, said: 'Need help?', feeling: null })).toBe(true);
    for (const w of ['Can I help you with anything?', 'Is there anything I can do?', 'Any work for me?', 'I am looking for a quest.']) expect(asksForWork(w)).toBe(true);
    for (const w of ['Hello there.', 'What do you grow here?', 'Help me find the gym.']) expect(asksForWork(w)).toBe(false);
  });

  it("reads the player's answer and a hand-in", () => {
    for (const y of ['Yes, I will do it.', 'sure', 'Okay!', "I'll do it", 'Of course.', 'Deal.']) expect(answerOf(y)).toBe('accept');
    for (const n of ['No.', 'Sorry, not now.', 'nah', 'Maybe later', "I can't"]) expect(answerOf(n)).toBe('decline');
    for (const x of ['What is a Mossling?', 'Tell me more.', 'Not sure yet, what is in it for me?']) expect(answerOf(x)).toBeNull();
    for (const d of ['I did what you asked.', 'Done!', "Here it is, I've caught it.", "I've been to Mire Route."]) expect(saysDone(d)).toBe(true);
    expect(saysDone('Where is Mire Route?')).toBe(false);
  });
});

describe('npc quest in the passes', () => {
  it('puts the ask in brackets after the line that carries it, and keeps it out of the tool transcript', () => {
    const h: ChatTurn[] = [
      { role: 'user', content: 'Hi.' },
      { role: 'assistant', content: 'Hello.' },
      { role: 'user', content: 'Need a hand?', nudge: askNote(catchPlan), asks: true },
    ];
    const m = chatMessages(persona, h, 'You remember them.');
    expect(m.at(-1)!.content).toBe(`Need a hand? [${askNote(catchPlan)}]`);
    expect(m[3]!.content).toBe('Hi. [You remember them.]');
    const judged = judgeMessages(persona, [...h.slice(2), { role: 'assistant', content: 'Catch me a Mossling?' }], true);
    expect(judged[1]!.content).toBe('Traveller: Need a hand?\nBram: Catch me a Mossling?');
    expect(judged[0]!.content).toContain(`call ${OFFER_QUEST}`);
    expect(judgeMessages(persona, h)[0]!.content).not.toContain(OFFER_QUEST);
  });

  it('gives the tool pass offer_quest only on an exchange that carried the ask', () => {
    const names = (offer: boolean) => (judgeTools(persona, 500, offer) as { function: { name: string } }[]).map((t) => t.function.name);
    expect(names(false)).not.toContain(OFFER_QUEST);
    expect(names(true)).toContain(OFFER_QUEST);
  });

  it('guards the offer: asked and the words ask; the coins are a promise; the words decide when the call is missing', () => {
    const ask = 'Catch a Mossling for me on Mire Route, would you? I will give you 300 coins when it is done.';
    expect(guardOffer(ask, true)).toBe(true);
    expect(guardOffer(ask, false)).toBe(false);
    expect(guardOffer('Hmph. The weather is what it is.', true)).toBe(false);
    expect(guardCalls([{ name: OFFER_QUEST }], ask, false, false, false, true)).toEqual([{ name: OFFER_QUEST }]);
    // not asked in this exchange: dropped
    expect(guardCalls([{ name: OFFER_QUEST }], ask)).toEqual([]);
    // the model paid the reward up front or took the player's money, or started a fight: not on an ask
    expect(guardCalls([{ name: GIVE_MONEY, amount: 300 }, { name: TAKE_MONEY, amount: 300 }, { name: START_BATTLE }], `Beat three wild Ewamon for me! Here, take these coins! ${ask}`, false, false, false, true)).toEqual([{ name: OFFER_QUEST }]);
    // the tool pass missed it (do_nothing), but the words asked
    expect(guardCalls([], ask, false, false, false, true)).toEqual([{ name: OFFER_QUEST }]);
    // money outside an ask is unchanged
    expect(guardCalls([{ name: GIVE_MONEY, amount: 5 }], 'Here are 5 coins for you.')).toEqual([{ name: GIVE_MONEY, amount: 5 }]);
  });
});
