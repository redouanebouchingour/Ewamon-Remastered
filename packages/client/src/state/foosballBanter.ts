/**
 * The Mire Route foosball club's banter (content `FOOSBALL_CLUB.banter`): while the player stands near the table the
 * club argues, one speech bubble at a time over the speaker's head, then rests and starts over. World3D steps the clock
 * per rendered frame (`createBanterClock`), writes the line here when it changes and the speaker's head on screen
 * every frame it shows (`setBanterAnchor`); `FoosballBanter` draws it. Walking away resets the argument; a dialogue or
 * a panel freezes it, hidden.
 *
 * Team Ewamon HQ (content `DEV_TEAM.banter`) uses the same clock, store and bubble: inside the house the four chat over
 * their desk, with a shorter rest (`DEV_TEAM_BANTER_REST_MS`). Only one group is ever in reach.
 */
import { create } from 'zustand';

/** how close (m) to the table the player hears the club */
export const BANTER_NEAR_M = 14;
/** before the first line once the player walks up, between two lines, and after the last before it starts over (ms) */
export const BANTER_LEAD_MS = 800;
export const BANTER_GAP_MS = 350;
export const BANTER_REST_MS = 30_000;
/** Team Ewamon HQ rests less: the player stands right by the desk and came for them */
export const DEV_TEAM_BANTER_REST_MS = 12_000;

/** How long a line shows: 1.8 s plus a little per word, at most 4.5 s. */
export function banterLineMs(text: string): number {
  return Math.min(4500, 1800 + text.split(/\s+/).length * 220);
}

export interface BanterClock {
  /**
   * Advances `dtMs`; returns the index of the line showing, or null (between lines, resting, away, busy). Away resets
   * the argument to its first line; busy freezes it.
   */
  step(dtMs: number, near: boolean, busy: boolean, lines: readonly { readonly text: string }[]): number | null;
}

export function createBanterClock(restMs: number = BANTER_REST_MS): BanterClock {
  let i = 0;
  let showing = false;
  let left = BANTER_LEAD_MS;
  return {
    step(dtMs, near, busy, lines) {
      if (!near || lines.length === 0) {
        i = 0;
        showing = false;
        left = BANTER_LEAD_MS;
        return null;
      }
      if (busy) return null;
      left -= dtMs;
      while (left <= 0) {
        if (!showing) {
          showing = true;
          left += banterLineMs(lines[i]!.text);
        } else {
          showing = false;
          i++;
          if (i >= lines.length) {
            i = 0;
            left += restMs;
          } else {
            left += BANTER_GAP_MS;
          }
        }
      }
      return showing ? i : null;
    },
  };
}

export interface BanterLine {
  readonly seq: number;
  /** the speaker's id (a foosball trainer, a dev-team NPC) */
  readonly by: string;
  readonly text: string;
}

interface BanterState {
  readonly line: BanterLine | null;
  /** the speaker's head on screen (px, the page's coordinates); null: not on screen (no bubble) */
  readonly anchor: { readonly x: number; readonly y: number } | null;
}

export const useFoosballBanterStore = create<BanterState>()(() => ({ line: null, anchor: null }));

let seq = 0;

export function showBanterLine(by: string, text: string): void {
  useFoosballBanterStore.setState({ line: { seq: ++seq, by, text } });
}

export function clearBanterLine(): void {
  if (useFoosballBanterStore.getState().line !== null) useFoosballBanterStore.setState({ line: null, anchor: null });
}

/** World3D, per frame while a line shows: where the speaker's head is (written only when it moved a pixel). */
export function setBanterAnchor(at: { readonly x: number; readonly y: number } | null): void {
  const cur = useFoosballBanterStore.getState().anchor;
  if (at === null) {
    if (cur !== null) useFoosballBanterStore.setState({ anchor: null });
    return;
  }
  if (cur !== null && Math.abs(cur.x - at.x) < 1 && Math.abs(cur.y - at.y) < 1) return;
  useFoosballBanterStore.setState({ anchor: { x: Math.round(at.x), y: Math.round(at.y) } });
}
