// @vitest-environment jsdom
/**
 * The emote wheel (G): the pointer's direction from the centre picks a slice, a click plays it and closes the wheel;
 * hold G, aim and let go plays the lit slice, a tap leaves the wheel up; G again / Escape / a click in the hub close it.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WHEEL, setEmoteAction, useEmoteWheelStore } from '../src/state/emotes';
import { EmoteWheel, HOLD_MS, sliceAt } from '../src/world/EmoteWheel';

const played = vi.fn();
const BOX = { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) };

beforeEach(() => {
  played.mockReset();
  setEmoteAction(played);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(BOX as DOMRect);
});
afterEach(() => {
  cleanup();
  setEmoteAction(null);
  useEmoteWheelStore.getState().setOpen(false);
  vi.restoreAllMocks();
});

const open = (): void => act(() => useEmoteWheelStore.getState().setOpen(true));
/** jsdom's fireEvent.pointerMove drops clientX / clientY: a MouseEvent named pointermove carries them. */
const aim = (x: number, y: number): void => {
  act(() => {
    screen.getByTestId('emote-wheel').dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
  });
};

describe('the emote wheel', () => {
  it('eight emotes, clockwise from the top; the hub is a dead zone', () => {
    expect(WHEEL.map((e) => e.id).sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    expect(sliceAt(0, -100, 20)).toBe(0);
    expect(WHEEL[sliceAt(100, 0, 20)!]!.label).toBe('Look right');
    expect(WHEEL[sliceAt(0, 100, 20)!]!.label).toBe('Breakdance');
    expect(WHEEL[sliceAt(-100, 0, 20)!]!.label).toBe('Look left');
    expect(sliceAt(70, -70, 20)).toBe(1);
    expect(sliceAt(5, 5, 20)).toBeNull();
  });

  it('closed: nothing drawn; open: the hub names the lit slice and a click plays it', () => {
    render(<EmoteWheel />);
    expect(screen.queryByTestId('emote-wheel')).toBeNull();
    open();
    const layer = screen.getByTestId('emote-wheel');
    expect(layer.textContent).toContain('Emotes');
    aim(200, 20);
    expect(screen.getByTestId('emote-8').getAttribute('data-lit')).toBe('true');
    expect(layer.textContent).toContain('High five');
    fireEvent.click(layer, { clientX: 380, clientY: 200 });
    expect(played).toHaveBeenCalledWith(13);
    expect(useEmoteWheelStore.getState().open).toBe(false);
  });

  it('a click in the hub, Escape or G again close it without an emote', () => {
    render(<EmoteWheel />);
    open();
    fireEvent.click(screen.getByTestId('emote-wheel'), { clientX: 200, clientY: 200 });
    expect(useEmoteWheelStore.getState().open).toBe(false);
    open();
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(useEmoteWheelStore.getState().open).toBe(false);
    open();
    fireEvent.keyDown(window, { code: 'KeyG' });
    expect(useEmoteWheelStore.getState().open).toBe(false);
    expect(played).not.toHaveBeenCalled();
  });

  it('hold G, aim, let go: the lit slice plays; a quick tap leaves the wheel up', () => {
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<EmoteWheel />);
    open();
    aim(200, 380);
    now += HOLD_MS / 2;
    fireEvent.keyUp(window, { code: 'KeyG' });
    expect(useEmoteWheelStore.getState().open).toBe(true);
    expect(played).not.toHaveBeenCalled();
    act(() => useEmoteWheelStore.getState().setOpen(false));
    open();
    aim(200, 380);
    now += HOLD_MS + 50;
    fireEvent.keyUp(window, { code: 'KeyG' });
    expect(played).toHaveBeenCalledWith(7);
    expect(useEmoteWheelStore.getState().open).toBe(false);
  });

  it('arrow keys step through the slices and Enter plays the lit one', () => {
    render(<EmoteWheel />);
    open();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(played).toHaveBeenCalledWith(WHEEL[1]!.id);
  });
});
