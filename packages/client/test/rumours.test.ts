// @vitest-environment jsdom
/**
 * The rumour board's words (talk/rumours.ts) and store (state/rumours.ts): the prompt (neutral system prompt, the fact
 * and the crier in the user turn, no em-dashes), the checks against the fact (names, numbers, number words, the time,
 * the turn of the fact, feature 5's checks), the tidying, the templates, the day's cache in localStorage, one model call
 * with the model injected, and the store: the facts at once, the words one by one, the day's words not written twice,
 * the board off with NPC_TOOLS=off, the default town and the towns a player may read.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RumoursView } from '@ewa/protocol';
import type { ChatOnceOptions, ChatOnceResult } from '../src/talk/llm';
import { RUMOUR_SYSTEM, RumourCache, anchorsOf, checkRumour, rumourMessages, strangeNames, strangeNumbers, templateRumour, tidyRumour, turnsLost, writeRumour } from '../src/talk/rumours';
import { closeRumours, defaultTown, openRumours, reachableTowns, townName, useRumoursStore } from '../src/state/rumours';
import { ApiFailure } from '../src/net/api';

const DASH = String.fromCharCode(0x2014);
const fact = (id: string, kind: string, text: string) => ({ id, kind, text });
const RAID = fact('raid:raid_mire_thornback', 'raid', 'A level 18 Thornback raid opens on Mire Route at 17:00 UTC for 30 minutes.');
const MARKET = fact('market:mossling', 'market', 'Mossling sells for about 1,500 at the market now, up from about 1,000 the week before.');
const BADGE = fact('badge:ember', 'badge', '2 trainers won badges yesterday, and bram won the Ember Badge.');
const ROBBED = fact('gossip:mirevale.archivist:robbed', 'gossip', 'redwolf robbed Hessa Dunmore.');
const CAMP = fact('camp:mire_route', 'camp', 'The camp on Mire Route changed hands yesterday, and dunst holds it now.');

const answer = (content: string) => async (_o: ChatOnceOptions): Promise<ChatOnceResult> => ({ content, toolCalls: [] });

describe('the prompt', () => {
  it('keeps the system prompt neutral and puts the fact, the town and the crier in the user turn', () => {
    const m = rumourMessages(RAID, 'Mirevale');
    expect(m.map((x) => x.role)).toEqual(['system', 'user']);
    expect(m[0]!.content).toBe(RUMOUR_SYSTEM);
    expect(m[0]!.content).not.toMatch(/crier/i);
    expect(m[1]!.content).toContain(`"${RAID.text}"`);
    expect(m[1]!.content).toContain('town crier of Mirevale');
    for (const x of m) {
      expect(x.content).toContain('Never use em-dashes.');
      expect(x.content.includes(DASH)).toBe(false);
    }
  });
});

describe('the checks', () => {
  it('keeps a rumour that holds to its fact, numbers with or without a comma', () => {
    expect(checkRumour('Hear ye! A level 18 Thornback raid opens on Mire Route at 17:00 UTC, for 30 minutes only.', RAID, 'Mirevale')).toBe('Hear ye! A level 18 Thornback raid opens on Mire Route at 17:00 UTC, for 30 minutes only.');
    expect(checkRumour('Mossling sells for about 1500 now, up from 1000 the week before.', MARKET, 'Mirevale')).not.toBeNull();
    expect(checkRumour('Two trainers won badges yesterday. Bram won the Ember Badge!', BADGE, 'Mirevale')).not.toBeNull();
    expect(checkRumour('Redwolf robbed Hessa Dunmore. The town is buzzing with the tale.', ROBBED, 'Mirevale')).not.toBeNull();
  });

  it('drops a wrong number, an invented name or place, a wrong number word, a lost name', () => {
    expect(checkRumour('A level 20 Thornback raid opens on Mire Route at 17:00 UTC.', RAID, 'Mirevale')).toBeNull();
    expect(checkRumour('A level 18 Thornback raid opens on Ash Route at 17:00 UTC.', RAID, 'Mirevale')).toBeNull();
    expect(checkRumour('Old Tom says a level 18 Thornback raid opens on Mire Route at 17:00 UTC.', RAID, 'Mirevale')).toBeNull();
    expect(checkRumour('Three trainers won badges yesterday, and bram won the Ember Badge.', BADGE, 'Mirevale')).toBeNull();
    expect(checkRumour('Something big is happening on the roads today, folks.', RAID, 'Mirevale')).toBeNull();
    expect(strangeNames('Old Tom heard it from Bram.', BADGE.text, 'Mirevale')).toEqual(['Old', 'Tom']);
    expect(strangeNames('Hear ye! Bram won the Ember Badge at 17:00 UTC.', `${BADGE.text} 17:00 UTC`, 'Mirevale')).toEqual([]);
    expect(strangeNumbers('Three trainers won.', BADGE.text)).toEqual(['three']);
    expect(anchorsOf(ROBBED.text)).toEqual(expect.arrayContaining(['Hessa', 'Dunmore', 'redwolf']));
  });

  it('drops a rumour that turns the fact around or moves it in time', () => {
    expect(checkRumour('Mossling sells for about 1,500 now, down from about 1,000.', MARKET, 'Mirevale')).toBeNull();
    expect(checkRumour('Redwolf helped Hessa Dunmore.', ROBBED, 'Mirevale')).toBeNull();
    expect(checkRumour('The camp on Mire Route changes hands today, and dunst holds it now.', CAMP, 'Mirevale')).toBeNull();
    expect(turnsLost('Redwolf helped Hessa Dunmore.', ROBBED.text)).not.toEqual([]);
    expect(turnsLost('Redwolf robbed Hessa Dunmore!', ROBBED.text)).toEqual([]);
  });

  it('runs feature 5 checks: a type claim the chart contradicts goes', () => {
    const f = fact('swarm:x', 'swarm', 'Mire Route is swarming with Mossling today, and Fire moves are super effective on Grass.');
    expect(checkRumour('Mire Route is swarming with Mossling today. Grass moves are super effective on Fire.', f, 'Mirevale')).toBeNull();
  });

  it('tidies: dashes, a label, quotes, a repeated sentence, a call moved first, at most two sentences', () => {
    expect(tidyRumour(`Town Crier: "Mire Route sees rain ${DASH} often. Mire Route sees rain often! Hear ye, hear ye!"`)).toBe('Hear ye, hear ye! Mire Route sees rain, often.');
    expect(tidyRumour('Ghost of Wren is wanted on Mire Route. Hear ye, hear ye!')).toBe('Hear ye, hear ye! Ghost of Wren is wanted on Mire Route.');
    expect(tidyRumour('One. Two. Three.')).toBe('One. Two.');
  });
});

describe('the template', () => {
  it('a lead-in picked by the fact and the fact itself, without an em-dash', () => {
    const t = templateRumour(RAID, 'Mirevale');
    expect(t.endsWith(RAID.text)).toBe(true);
    expect(templateRumour(RAID, 'Mirevale')).toBe(t);
    expect(t.includes(DASH)).toBe(false);
    expect(templateRumour(fact('x', 'cup', `A ${DASH} B.`), 'Mirevale').includes(DASH)).toBe(false);
  });
});

describe('the day cache', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the words per day and town, in localStorage, and drops them when the fact changed or the day turned', () => {
    const c = new RumourCache();
    c.set('2026-10-24', 'mirevale', RAID, 'Raid on Mire Route at 17:00 UTC, level 18 Thornback.');
    expect(c.get('2026-10-24', 'mirevale', RAID)).toBe('Raid on Mire Route at 17:00 UTC, level 18 Thornback.');
    expect(new RumourCache().get('2026-10-24', 'mirevale', RAID)).toBe('Raid on Mire Route at 17:00 UTC, level 18 Thornback.');
    expect(c.get('2026-10-24', 'mirevale', { ...RAID, text: 'A level 19 Thornback raid.' })).toBeNull();
    expect(c.get('2026-10-24', 'cinderhold', RAID)).toBeNull();
    c.set('2026-10-25', 'mirevale', RAID, 'Tomorrow.');
    expect(localStorage.getItem('ewa:rumours:2026-10-24:mirevale')).toBeNull();
    expect(localStorage.getItem('ewa:rumours:2026-10-25:mirevale')).not.toBeNull();
  });

  it('keeps working when the store throws', () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('full');
    };
    try {
      const c = new RumourCache();
      c.set('2026-10-24', 'mirevale', RAID, 'Kept in memory.');
      expect(c.get('2026-10-24', 'mirevale', RAID)).toBe('Kept in memory.');
    } finally {
      Storage.prototype.setItem = real;
    }
  });
});

describe('one model call', () => {
  it('returns the checked words, or null when the model strays, is down or slow', async () => {
    expect(await writeRumour(RAID, 'Mirevale', { chat: answer('A level 18 Thornback raid opens on Mire Route at 17:00 UTC for 30 minutes!') })).not.toBeNull();
    expect(await writeRumour(RAID, 'Mirevale', { chat: answer('A level 99 Thornback raid!') })).toBeNull();
    expect(await writeRumour(RAID, 'Mirevale', { chat: () => Promise.reject(new Error('down')) })).toBeNull();
    let asked: ChatOnceOptions | null = null;
    await writeRumour(RAID, 'Mirevale', { chat: async (o) => ((asked = o), { content: '', toolCalls: [] }), timeoutMs: 1234 });
    expect(asked!.timeoutMs).toBe(1234);
    expect(asked!.temperature).toBeGreaterThan(0);
  });
});

describe('the store', () => {
  const VIEW: RumoursView = {
    zoneId: 'mirevale',
    town: 'Mirevale',
    day: '2026-10-24',
    facts: [
      { ...RAID, zoneId: 'mire_route', speciesId: 'thornback', type: 'Grass' },
      { ...CAMP, kind: 'camp', zoneId: 'mire_route', speciesId: null, type: null },
      { ...ROBBED, kind: 'gossip', zoneId: 'mirevale', speciesId: null, type: null },
    ] as RumoursView['facts'],
  };
  beforeEach(() => {
    localStorage.clear();
    useRumoursStore.setState({ town: null, lastTown: null, status: 'idle', view: null, words: {}, writing: false });
  });
  afterEach(() => closeRumours());

  it('shows the facts at once and the words one by one; a second open writes nothing again', async () => {
    const calls: string[] = [];
    const chat = async (o: ChatOnceOptions): Promise<ChatOnceResult> => {
      const said = o.messages[1]!.content;
      calls.push(said);
      if (said.includes('Thornback')) return { content: 'Hear ye! A level 18 Thornback raid opens on Mire Route at 17:00 UTC for 30 minutes.', toolCalls: [] };
      if (said.includes('camp')) return { content: 'A camp changed hands somewhere far away today.', toolCalls: [] };
      return { content: 'Redwolf robbed Hessa Dunmore, the whole town says so.', toolCalls: [] };
    };
    await openRumours('mirevale', { fetchView: async () => VIEW, chat, model: true });
    const st = useRumoursStore.getState();
    expect(st.status).toBe('ready');
    expect(st.view).toBe(VIEW);
    expect(Object.keys(st.words).sort()).toEqual([RAID.id, ROBBED.id].sort());
    expect(st.writing).toBe(false);
    expect(calls).toHaveLength(3);
    await openRumours('mirevale', { fetchView: async () => VIEW, chat, model: true });
    // the camp's words were dropped, so only it is asked again
    expect(calls).toHaveLength(4);
    expect(Object.keys(useRumoursStore.getState().words).sort()).toEqual([RAID.id, ROBBED.id].sort());
  });

  it('with the model off: the facts only; with NPC_TOOLS=off: the board is off; a failed read is an error', async () => {
    await openRumours('mirevale', { fetchView: async () => VIEW, model: false });
    expect(useRumoursStore.getState()).toMatchObject({ status: 'ready', words: {} });
    await openRumours('mirevale', { fetchView: () => Promise.reject(new ApiFailure({ status: 409, code: 'npcToolsOff', detail: null })) });
    expect(useRumoursStore.getState().status).toBe('off');
    await openRumours('mirevale', { fetchView: () => Promise.reject(new Error('net')) });
    expect(useRumoursStore.getState().status).toBe('error');
  });

  it('opens the asked town, else the one stood in, else the last one, else the town by the route', () => {
    expect(defaultTown('cinderhold', 'mirevale', null)).toBe('cinderhold');
    expect(defaultTown(null, 'saltmourn', 'mirevale')).toBe('saltmourn');
    expect(defaultTown(null, 'mire_route', 'cinderhold')).toBe('cinderhold');
    expect(['mirevale', 'cinderhold']).toContain(defaultTown(null, 'mire_route', null));
    expect(defaultTown('nowhere', null, null)).toBe('mirevale');
    expect(townName('solenne')).toBe('Solenne');
  });

  it('lists the towns a player may read: those their badges open', () => {
    const none = reachableTowns([]);
    expect(none[0]).toBe('mirevale');
    expect(none.length).toBeLessThan(reachableTowns(['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend']).length);
  });
});
