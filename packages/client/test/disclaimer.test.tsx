// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DisclaimerGate } from '../src/app/Disclaimer';

describe('first-visit disclaimer', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('covers the app until acknowledged, then never shows again', () => {
    render(<DisclaimerGate>app</DisclaimerGate>);
    expect(screen.getByTestId('disclaimer').textContent).toMatch(/school project.*fair use/);
    expect(screen.queryByText('app')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('app')).toBeTruthy();
    cleanup();
    render(<DisclaimerGate>app</DisclaimerGate>);
    expect(screen.queryByTestId('disclaimer')).toBeNull();
  });
});
