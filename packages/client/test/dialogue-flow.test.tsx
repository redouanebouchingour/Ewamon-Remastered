// @vitest-environment jsdom
/**
 * §20.4.7 dialogue flow for the Act I slice (content lines + the player's flags, never the wire):
 * - the interact plans: Wynn's starter beat opens and sends at once; Sable's beat (a battle) and a gym leader's `pre`
 *   lines send their interact only when the player pages past the last line (the battle would cover them); the gym
 *   door runs Mira's beats first and is sent straight to the server when it will refuse (story gate, badge held);
 * - the DialogueBox runs `onFinish` on the last page only (Escape walks away without sending);
 * - post-battle prompts wait until the beat's `after` / the leader's `post` lines are read;
 * - the HUD's story hint walks the chain (Wynn → Sable → Mira's stone → the gym → Mira's badge talk).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAGUE, STORY, beatDoneFlag, zone } from '@ewa/content';
import type { BadgeId } from '@ewa/content';
import { gymPlan, leaguePostDialogue, leagueSpeaker, npcPlan, storyFlagSet, storyHint, trainerPlan } from '../src/scene/dialogue';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { DialogueBox } from '../src/world/DialogueBox';
import { PostBattlePrompts } from '../src/world/PostBattlePrompts';
import { creature, meFixture } from './fixtures';

const beat = (id: string) => STORY.find((b) => b.id === id)!;
const done = (...ids: string[]): string[] => ids.flatMap((id) => [...beat(id).set, beatDoneFlag(id)]);
const flags = (f: readonly string[], badges: readonly BadgeId[] = []) => storyFlagSet(f, badges);
const npc = (zoneId: 'mirevale' | 'mire_route', id: string) => zone(zoneId).npcs.find((n) => n.id === id)!;
const mira = LEAGUE.find((l) => l.id === 'verdant_gym')!;

afterEach(() => cleanup());
beforeEach(() => {
  useUiStore.getState().reset();
  useSessionStore.getState().clearSession();
});

describe('interact plans (§20.4.7, §30.4.8 mirrored on the client)', () => {
  it('Wynn: the starter beat for a fresh account, sent at once (no battle); his plain lines afterwards', () => {
    const p = npcPlan('mirevale', npc('mirevale', 'mirevale.wynn'), flags([]));
    expect(p.dialogue).toEqual({ speaker: 'Prof. Wynn', lines: beat('first_witness').lines, beatId: 'first_witness' });
    expect(p.sendOnFinish).toBe(false);
    const after = npcPlan('mirevale', npc('mirevale', 'mirevale.wynn'), flags(done('first_witness')));
    expect(after.dialogue).toMatchObject({ beatId: null, lines: npc('mirevale', 'mirevale.wynn').lines });
  });

  it('Sable (NPC or the story trainer beside him): mire_rival lines first, the challenge only on finish', () => {
    const f = flags(done('first_witness'));
    const viaNpc = npcPlan('mire_route', npc('mire_route', 'mire_route.sable'), f);
    expect(viaNpc).toEqual({ dialogue: { speaker: 'Sable', lines: beat('mire_rival').lines, beatId: 'mire_rival' }, sendOnFinish: true });
    expect(trainerPlan('mire_route', 'sable_mire', f)).toEqual(viaNpc);
    // before Wynn / after the beat: a plain interact (the server answers nothing for a story trainer)
    expect(trainerPlan('mire_route', 'sable_mire', flags([])).dialogue).toBeNull();
    expect(trainerPlan('mire_route', 'sable_mire', flags(done('first_witness', 'mire_rival'))).dialogue).toBeNull();
    // an ordinary route trainer challenges at once
    expect(trainerPlan('mire_route', 'mire_route.bug_catcher', f)).toEqual({ dialogue: null, sendOnFinish: false });
  });

  it('the gym door: gated → straight to the server; grove_stone; Mira\'s pre lines → challenge on finish; bloom_after; then nothing', () => {
    // story gate (bible §6.1): no lines, the server's toast explains
    expect(gymPlan('mirevale', 'verdant_gym', flags(done('first_witness')), [])).toEqual({ dialogue: null, sendOnFinish: false });
    // grove_stone: Mira speaks, no battle → shown and sent together
    const stone = gymPlan('mirevale', 'verdant_gym', flags(done('first_witness', 'mire_rival')), []);
    expect(stone).toEqual({ dialogue: { speaker: 'Mira Thornwell, Grove-Keeper of Mirevale', lines: beat('grove_stone').lines, beatId: 'grove_stone' }, sendOnFinish: false });
    // the fight: her pre lines, the interact after the last page
    const fight = gymPlan('mirevale', 'verdant_gym', flags(done('first_witness', 'mire_rival', 'grove_stone')), []);
    expect(fight).toEqual({ dialogue: { speaker: 'Mira Thornwell, Grove-Keeper of Mirevale', lines: mira.pre, beatId: null }, sendOnFinish: true });
    // badge held: her badge talk (bloom_after) first, then the server's "already hold this badge"
    const f4 = done('first_witness', 'mire_rival', 'grove_stone');
    expect(gymPlan('mirevale', 'verdant_gym', flags(f4, ['bloom']), ['bloom']).dialogue?.beatId).toBe('bloom_after');
    expect(gymPlan('mirevale', 'verdant_gym', flags([...f4, ...done('bloom_after')], ['bloom']), ['bloom'])).toEqual({ dialogue: null, sendOnFinish: false });
    // her post lines after a win carry the concession line
    expect(leaguePostDialogue('verdant_gym')?.lines).toEqual(mira.post);
    expect(leaguePostDialogue(null)).toBeNull();
  });

  it("Solenne's chambers (Phase A): a Warden's / the Champion's pre lines only when the server will accept the fight", () => {
    const SEND = { dialogue: null, sendOnFinish: false };
    const eight = LEAGUE.filter((l) => l.stage === 'gym').map((l) => l.badge!) as BadgeId[];
    const pre = (id: string) => ({ dialogue: { speaker: leagueSpeaker(id), lines: LEAGUE.find((l) => l.id === id)!.pre, beatId: null }, sendOnFinish: true });
    const beaten = (...ids: string[]) => ['wardens_met', ...ids.flatMap((id) => LEAGUE.find((l) => l.id === id)!.setsFlags)];
    // fewer than eight badges: the server's toast
    expect(gymPlan('solenne', 'veil', flags([], eight.slice(0, 7)), eight.slice(0, 7))).toEqual(SEND);
    // eight badges: Veil's pre lines, the challenge on finish
    expect(gymPlan('solenne', 'veil', flags([], eight), eight)).toEqual(SEND);   // the Wardens wait for `wardens_met`
    expect(gymPlan('solenne', 'veil', flags(beaten(), eight), eight)).toEqual(pre('veil'));
    // the next Warden waits for the previous one; a beaten Warden is no fight
    expect(gymPlan('solenne', 'aurelia', flags(beaten(), eight), eight)).toEqual(SEND);
    expect(gymPlan('solenne', 'aurelia', flags(beaten('veil'), eight), eight)).toEqual(pre('aurelia'));
    expect(gymPlan('solenne', 'veil', flags(beaten('veil'), eight), eight)).toEqual(SEND);
    // the Champion: every Warden first
    expect(gymPlan('solenne', 'zeon', flags(beaten('veil', 'aurelia'), eight), eight)).toEqual(SEND);
    expect(gymPlan('solenne', 'zeon', flags(beaten('veil', 'aurelia', 'kirei'), eight), eight)).toEqual(pre('zeon'));
    expect(gymPlan('solenne', 'zeon', flags(beaten('veil', 'aurelia', 'kirei', 'zeon'), eight), eight)).toEqual(SEND);
  });

  it('the story hint walks the Act I chain', () => {
    expect(storyHint(flags([]), [])).toBe('Talk to Prof. Wynn (Mirevale)');
    expect(storyHint(flags(done('first_witness')), [])).toBe('Talk to Sable (Mire Route)');
    expect(storyHint(flags(done('first_witness', 'mire_rival')), [])).toBe('Talk to Mira Thornwell (Mirevale)');
    expect(storyHint(flags(done('first_witness', 'mire_rival', 'grove_stone')), [])).toBe('Challenge Mira Thornwell (Mirevale)');
    expect(storyHint(flags(done('first_witness', 'mire_rival', 'grove_stone'), ['bloom']), ['bloom'])).toBe('Talk to Mira Thornwell (Mirevale)');
  });
});

describe('DialogueBox paging', () => {
  it('onFinish runs once, on the last page only; Escape closes without it', () => {
    const onFinish = vi.fn();
    render(<DialogueBox />);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Sable', lines: beat('mire_rival').lines, index: 0, targetId: 'beat:mire_rival', onFinish }));
    expect(screen.getByTestId('dialoguebox').textContent).toContain('1 more');
    act(() => void fireEvent.keyDown(window, { code: 'Enter' }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByTestId('dialoguebox').textContent).toContain('Race you to the first badge');
    act(() => void fireEvent.keyDown(window, { code: 'Enter' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().dialogue).toBeNull();
    const escaped = vi.fn();
    act(() => useUiStore.getState().setDialogue({ speaker: 'Mira', lines: mira.pre, index: 0, targetId: 'verdant_gym', onFinish: escaped }));
    act(() => void fireEvent.keyDown(window, { code: 'Escape' }));
    expect(useUiStore.getState().dialogue).toBeNull();
    expect(escaped).not.toHaveBeenCalled();
  });
});

describe('post-battle prompts wait for the after-battle lines', () => {
  it('the learn-move modal opens only once the dialogue is closed', () => {
    const c = creature('cindercap', { level: 15, moves: [{ id: 'Flame Dash', pp: 25, ppMax: 25 }, { id: 'Tackle', pp: 35, ppMax: 35 }, { id: 'Will-O-Wisp', pp: 15, ppMax: 15 }, { id: 'Growl', pp: 40, ppMax: 40 }] });
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [c] }));
    render(<PostBattlePrompts />);
    act(() => {
      useUiStore.getState().setDialogue({ speaker: 'Mira', lines: mira.post, index: 0, targetId: 'league:x:post' });
      useUiStore.getState().enqueuePrompt({ kind: 'learnMove', creatureId: c.id, move: 'Fire Fang' });
    });
    expect(screen.queryByTestId('learnmoveprompt')).toBeNull();
    act(() => useUiStore.getState().setDialogue(null));
    const modal = screen.getByTestId('learnmoveprompt');
    expect(modal.textContent).toContain('wants to learn Fire Fang');
    expect(modal.textContent).toContain('Choose a move to forget'); // the 5th move: four known already
  });
});
