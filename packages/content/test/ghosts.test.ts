/**
 * Ghost trainers (ghosts.ts): a ghost's trainer id names its owner and is told apart from content trainers; a win
 * pays like a route trainer of its level; the report on coming back reads as a sentence for every record.
 */
import { describe, expect, it } from 'vitest';
import { ghostOwner, ghostReport, ghostReward, ghostTrainerId, isGhostTrainer } from '../src/index';

describe('ghost trainers', () => {
  it('ids name the owner; content trainers are no ghosts', () => {
    expect(ghostTrainerId('ash')).toBe('ghost:ash');
    expect(ghostOwner('ghost:ash')).toBe('ash');
    expect(isGhostTrainer('ghost:ash')).toBe(true);
    expect(isGhostTrainer('mire_route.youngster')).toBe(false);
    expect(ghostOwner('mire_route.youngster')).toBeNull();
    expect(isGhostTrainer(null)).toBe(false);
  });

  it('a win pays by level, at least 100', () => {
    expect(ghostReward(1)).toBe(100);
    expect(ghostReward(30)).toBe(1200);
  });

  it('the report reads as a sentence', () => {
    expect(ghostReport(0, 0)).toBeNull();
    expect(ghostReport(1, 0)).toBe('While you were away, your ghost fought a trainer and won.');
    expect(ghostReport(0, 1)).toBe('While you were away, your ghost fought a trainer and lost.');
    expect(ghostReport(3, 0)).toBe('While you were away, your ghost fought 3 trainers and won every time.');
    expect(ghostReport(0, 2)).toBe('While you were away, your ghost fought 2 trainers and lost every time.');
    expect(ghostReport(2, 1)).toBe('While you were away, your ghost fought 3 trainers: 2 won, 1 lost.');
  });
});
