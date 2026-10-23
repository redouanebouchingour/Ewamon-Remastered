// @vitest-environment jsdom
/**
 * First-person view, the client half: the toggle under the minimap (and F) flips `state/view.ts`; in first person a
 * left-button drag goes to `look` (not the heading turn), in the diorama the drag orbits the camera (`orbit`).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInputCapture } from '../src/scene/input';
import type { InputCallbacks } from '../src/scene/input';
import { useViewStore } from '../src/state/view';
import { Minimap } from '../src/world/Minimap';

afterEach(() => cleanup());
beforeEach(() => act(() => useViewStore.getState().setFirstPerson(false)));

describe('first-person toggle', () => {
  it('the button and F switch the view', () => {
    render(<Minimap />);
    const b = screen.getByTestId('view-toggle');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    act(() => {
      fireEvent.click(b);
    });
    expect(useViewStore.getState().firstPerson).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyF' });
    });
    expect(useViewStore.getState().firstPerson).toBe(false);
  });
});

describe('drag to look', () => {
  const callbacks = (look: InputCallbacks['look']): InputCallbacks => ({
    interact: vi.fn(), openChat: vi.fn(), emote: vi.fn(), challenge: vi.fn(), rotate: vi.fn(), zoom: vi.fn(), jump: vi.fn(),
    toggleBike: vi.fn(), toggleDev: vi.fn(), blocked: () => false, ...(look !== undefined ? { look } : {}),
  });
  const drag = (canvas: HTMLElement, dx: number, dy: number): void => {
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 100, clientY: 100 }) as PointerEvent);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + dx, clientY: 100 + dy }) as PointerEvent);
    window.dispatchEvent(new MouseEvent('pointerup', {}) as PointerEvent);
  };

  it('first person: the drag looks around and never turns the heading', () => {
    const canvas = document.createElement('div');
    const look = vi.fn(() => true);
    const cb = callbacks(look);
    const cap = createInputCapture(window, canvas, cb);
    drag(canvas, 120, -30);
    expect(look).toHaveBeenCalledWith(120, -30);
    expect(cb.rotate).not.toHaveBeenCalled();
    cap.dispose();
  });

  it('diorama: look declines, the 80 px drag turns the heading as before', () => {
    const canvas = document.createElement('div');
    const cb = callbacks(() => false);
    const cap = createInputCapture(window, canvas, cb);
    drag(canvas, 120, 0);
    expect(cb.rotate).toHaveBeenCalledWith(-1);
    cap.dispose();
  });

  it('diorama with orbit: every move orbits by its px, no 90° heading step', () => {
    const canvas = document.createElement('div');
    const orbit = vi.fn();
    const cb = { ...callbacks(() => false), orbit };
    const cap = createInputCapture(window, canvas, cb);
    drag(canvas, 12, 0);
    expect(orbit).toHaveBeenCalledWith(12);
    expect(cb.rotate).not.toHaveBeenCalled();
    cap.dispose();
  });
});
