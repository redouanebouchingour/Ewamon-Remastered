import { describe, expect, it } from 'vitest';
import { blocksPanelNavigation } from '../src/app/navigation';

const nav = (from: string, to: string): boolean => blocksPanelNavigation({ currentLocation: { pathname: from }, nextLocation: { pathname: to } });

describe('the battle / trade blockers (§20.1.3)', () => {
  it('always let a panel close', () => {
    expect(nav('/play/social', '/play')).toBe(false);
    expect(nav('/play/social/someone', '/play/')).toBe(false);
    expect(nav('/play/settings', '/play')).toBe(false);
  });

  it('hold opening or switching a panel, and leaving /play', () => {
    expect(nav('/play', '/play/party')).toBe(true);
    expect(nav('/play/social', '/play/party')).toBe(true);
    expect(nav('/play/party', '/login')).toBe(true);
  });

  it('let a search-param change on the same panel through', () => {
    expect(nav('/play/social', '/play/social')).toBe(false);
  });
});
