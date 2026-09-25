/**
 * SPEC §20.4.7 — NPC dialogue is content, not wire. On `interact { kind: 'npc' }` the client opens the DialogueBox
 * with the lines it computes from content and its own flags:
 *   nextStoryBeat(zone, flags)?.speaker === npcId ? beat.lines
 *   : (the first `react` whose `when` flag is held, else NpcDef.lines)
 * Badges read as `badge:<id>` flags (the server materialises them the same way for nextStoryBeat). Pure.
 */
import { badgeFlag, nextStoryBeat, storyBeat } from '@ewa/content';
import type { BadgeId, NpcDef, StoryBeat, ZoneId } from '@ewa/content';

export interface DialogueLines {
  readonly speaker: string;
  readonly lines: readonly string[];
  /** the story beat the lines belong to (null for plain NPC talk) */
  readonly beatId: string | null;
}

/** The flag set story functions read: the player's flags + `badge:<id>` for every badge held. */
export function storyFlagSet(flags: readonly string[], badges: readonly BadgeId[]): ReadonlySet<string> {
  const s = new Set(flags);
  for (const b of badges) s.add(badgeFlag(b));
  return s;
}

/** Whether an NPC is present for these flags (`when` held or null, `until` not held). */
export function npcVisible(npc: Pick<NpcDef, 'when' | 'until'>, flags: ReadonlySet<string>): boolean {
  if (npc.when !== null && !flags.has(npc.when)) return false;
  if (npc.until !== null && flags.has(npc.until)) return false;
  return true;
}

export function npcDialogue(zoneId: ZoneId, npc: NpcDef, flags: ReadonlySet<string>): DialogueLines {
  const beat = nextStoryBeat(zoneId, flags);
  if (beat !== null && beat.speaker === npc.id && beat.lines.length > 0) return { speaker: npc.name, lines: beat.lines, beatId: beat.id };
  for (const r of npc.react) if (flags.has(r.when)) return { speaker: npc.name, lines: r.lines, beatId: null };
  return { speaker: npc.name, lines: npc.lines, beatId: null };
}

/** The lines a `storyBeat` message opens: `start` → the beat's lines, `complete` → its `after` lines. */
export function beatDialogue(beatId: string, phase: 'start' | 'complete', speakerName: (id: string) => string): DialogueLines | null {
  let beat: StoryBeat;
  try {
    beat = storyBeat(beatId);
  } catch (_e) {
    return null;
  }
  const lines = phase === 'start' ? beat.lines : beat.after;
  if (lines.length === 0) return null;
  return { speaker: speakerName(beat.speaker), lines, beatId: beat.id };
}
