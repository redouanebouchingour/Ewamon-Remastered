// @vitest-environment jsdom
/**
 * Trainer sight, the client half (2026-10-20): `TrainerApproach` raises the "!" (actor emote 4), turns the trainer to the
 * player, waits ALERT_MS, walks it up to STOP_M and only then hands over to the lines; the lines of a trainer who saw
 * the player cannot be walked away from (Escape runs `onFinish`, the fight).
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALERT_MS, EXCLAIM_EMOTE, STOP_M, TrainerApproach, WALK_SPEED_MPS } from '../src/scene/trainerApproach';
import type { ApproachActors } from '../src/scene/trainerApproach';
import { useUiStore } from '../src/state/ui';
import { DialogueBox } from '../src/world/DialogueBox';

function fakeActors(): ApproachActors & { poses: { x: number; z: number; angle: number; moving: boolean }[]; emotes: number[] } {
  const poses: { x: number; z: number; angle: number; moving: boolean }[] = [];
  const emotes: number[] = [];
  return {
    poses,
    emotes,
    setTransform: (_id, x, z, angle, moving) => void poses.push({ x, z, angle, moving }),
    setEmote: (_id, n) => void emotes.push(n),
  };
}

afterEach(() => cleanup());
beforeEach(() => useUiStore.getState().reset());

describe('TrainerApproach', () => {
  it('"!" and a turn at once, a beat standing, then a walk that stops STOP_M short of the player', () => {
    const actors = fakeActors();
    const a = new TrainerApproach(actors);
    const arrive = vi.fn();
    a.start('t1', { x: 0, z: 0 }, 0, 6, arrive);
    expect(a.active).toBe(true);
    expect(actors.emotes).toEqual([EXCLAIM_EMOTE]);
    expect(actors.poses[0]).toEqual({ x: 0, z: 0, angle: 0, moving: false }); // facing +z, toward the player
    a.update(ALERT_MS - 1);
    expect(actors.poses).toHaveLength(1); // still standing under the "!"
    a.update(1);
    a.update(100);
    const walking = actors.poses.at(-1)!;
    expect(walking.moving).toBe(true);
    expect(walking.z).toBeCloseTo((WALK_SPEED_MPS * 101) / 1000, 6); // the 1 ms that ended the beat walks too
    for (let i = 0; i < 100 && arrive.mock.calls.length === 0; i++) a.update(16);
    expect(arrive).toHaveBeenCalledTimes(1);
    const end = actors.poses.at(-1)!;
    expect(end.moving).toBe(false);
    expect(end.z).toBeCloseTo(6 - STOP_M, 6);
    // the player turns to face the trainer (heading back along −z)
    expect(Math.abs(a.facePlayer(0, 6))).toBeCloseTo(Math.PI, 6);
    a.update(500);
    expect(arrive).toHaveBeenCalledTimes(1);
  });

  it('a trainer already beside the player only turns; end(restore) puts it back and clears the "!"', () => {
    const actors = fakeActors();
    const a = new TrainerApproach(actors);
    const arrive = vi.fn();
    a.start('t1', { x: 1, z: 1 }, 2, 1, arrive);
    a.update(ALERT_MS);
    a.update(16);
    expect(arrive).toHaveBeenCalledTimes(1);
    expect(actors.poses.at(-1)).toMatchObject({ x: 1, z: 1, moving: false });
    a.end({ x: 1, z: 1, angle: 0.5 });
    expect(a.active).toBe(false);
    expect(actors.emotes.at(-1)).toBe(0);
    expect(actors.poses.at(-1)).toEqual({ x: 1, z: 1, angle: 0.5, moving: false });
  });
});

describe('an obligatory dialogue', () => {
  it('Escape skips to the fight instead of walking away', () => {
    const onFinish = vi.fn();
    render(<DialogueBox />);
    act(() => useUiStore.getState().setDialogue({ speaker: 'Bug Catcher', lines: ['You there!', 'Battle me!'], index: 0, targetId: 't1', obligatory: true, onFinish }));
    act(() => void fireEvent.keyDown(window, { code: 'Escape' }));
    expect(useUiStore.getState().dialogue).toBeNull();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
