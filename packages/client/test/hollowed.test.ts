/**
 * Honor shapes the world on the client (scene/dialogue.ts): in the hollowed town at the highest shadow (the client adds
 * HOLLOWED_FLAG to its flag set) its people say HOLLOWED_LINES; without the flag, or in another town, they say their
 * own lines; a story beat still comes first.
 */
import { describe, expect, it } from 'vitest';
import { HOLLOWED_FLAG, HOLLOWED_LINES, HOLLOWED_TOWN, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { npcDialogue } from '../src/scene/dialogue';
import { shadowTitle } from '../src/screens/MapScreen';

describe('the hollowed town', () => {
  it("its people speak of the Hollowing at the highest shadow, and their own lines otherwise", () => {
    const town = zone(HOLLOWED_TOWN as ZoneId);
    const keeper = town.npcs.find((n) => n.id === 'vesperveil.gravetender')!;
    expect(npcDialogue(town.id, keeper, new Set([HOLLOWED_FLAG])).lines).toEqual(HOLLOWED_LINES[keeper.id]);
    expect(npcDialogue(town.id, keeper, new Set()).lines).toEqual(keeper.lines);
    // another town's people never take the lines, flag or not
    const elsewhere = zone('mirevale');
    const npc = elsewhere.npcs[0]!;
    expect(npcDialogue(elsewhere.id, npc, new Set([HOLLOWED_FLAG])).lines).not.toEqual(HOLLOWED_LINES[keeper.id]);
  });

  it('the map tag explains itself', () => {
    expect(shadowTitle(2)).toMatch(/level 2 of 4/);
    expect(shadowTitle(4)).toMatch(/^Hollowed/);
  });
});
