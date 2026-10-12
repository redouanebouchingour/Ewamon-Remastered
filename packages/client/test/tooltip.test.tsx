// @vitest-environment jsdom
/**
 * SPEC §20.2.4 TooltipHost: a `title` attribute shows the Broadcast tip instead of the native one — the attribute is
 * moved aside while the tip shows (so the browser's box never fires) and restored when it hides.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipHost } from '../src/ui/TooltipHost';

function mount(): void {
  render(
    <>
      <TooltipHost />
      <button type="button" title="Trainer level 12">
        <span data-testid="inner">Lv 12</span>
      </button>
      <span data-testid="badge" title="Bloom Badge — not earned" />
      <span data-testid="plain">no title</span>
      <span data-testid="empty" title="" />
    </>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TooltipHost', () => {
  it('shows the title as a tip after the delay and strips the native attribute meanwhile', () => {
    mount();
    const button = screen.getByRole('button');
    fireEvent.pointerOver(screen.getByTestId('inner'));
    expect(button.hasAttribute('title')).toBe(false);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('tooltip').textContent).toBe('Trainer level 12');
  });

  it('restores the title and hides when the pointer leaves', () => {
    mount();
    const button = screen.getByRole('button');
    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerOut(button, { relatedTarget: screen.getByTestId('plain') });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('title')).toBe('Trainer level 12');
  });

  it('moves straight to the next titled element without a second delay', () => {
    mount();
    const button = screen.getByRole('button');
    const badge = screen.getByTestId('badge');
    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerOut(button, { relatedTarget: badge });
    fireEvent.pointerOver(badge);
    expect(screen.getByRole('tooltip').textContent).toBe('Bloom Badge — not earned');
    expect(button.getAttribute('title')).toBe('Trainer level 12');
    expect(badge.hasAttribute('title')).toBe(false);
  });

  it('hides on pointer down and on Escape, and ignores empty titles', () => {
    mount();
    const button = screen.getByRole('button');
    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerDown(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('title')).toBe('Trainer level 12');

    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.pointerOver(screen.getByTestId('empty'));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps a title React re-set while it was stashed', () => {
    mount();
    const button = screen.getByRole('button');
    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(400));
    button.setAttribute('title', 'Trainer level 13');
    fireEvent.pointerDown(button);
    expect(button.getAttribute('title')).toBe('Trainer level 13');
  });
});
