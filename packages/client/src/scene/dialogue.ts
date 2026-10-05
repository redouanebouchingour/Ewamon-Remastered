/**
 * SPEC §20.4.7 — NPC dialogue is content, not wire. On `interact { kind: 'npc' }` the client opens the DialogueBox
 * with the lines it computes from content and its own flags:
 *   nextStoryBeat(zone, flags)?.speaker === npcId ? beat.lines
 *   : (the first `react` whose `when` flag is held, else NpcDef.lines)
 * Badges read as `badge:<id>` flags (the server materialises them the same way for nextStoryBeat). Pure.
 */
import { LEAGUE, STORY, badgeFlag, beatDoneFlag, beatEligible, leagueStoryGate, nextStoryBeat, storyBeat, zone } from '@ewa/content';
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

/** A league trainer as a dialogue speaker ("Mira Thornwell, Grove-Keeper of Mirevale"). */
export function leagueSpeaker(leagueId: string): string {
  const lt = LEAGUE.find((l) => l.id === leagueId);
  return lt === undefined ? leagueId.replace(/_/g, ' ') : `${lt.name}, ${lt.title}`;
}

/** Who says a beat's lines: its NPC's name in the beat's zone, or the league trainer. */
export function beatSpeaker(beat: StoryBeat): string {
  const npc = zone(beat.zoneId).npcs.find((n) => n.id === beat.speaker);
  return npc !== undefined ? npc.name : leagueSpeaker(beat.speaker);
}

/**
 * What `E` does before (or instead of) sending an interact. `dialogue` = the lines to open now; `sendOnFinish` = the
 * interact waits until the player has paged through them (a beat battle / a league challenge would otherwise cover
 * the lines at once); otherwise it is sent immediately. `beatId` = the beat the lines belong to (the server's
 * `storyBeat start` for it is then already on screen).
 */
export interface InteractPlan {
  readonly dialogue: DialogueLines | null;
  readonly sendOnFinish: boolean;
}

const SEND_NOW: InteractPlan = { dialogue: null, sendOnFinish: false };

/** §20.4.7 for an NPC: the dialogue it opens; a beat with a battle (mire_rival) sends its interact on finish. */
export function npcPlan(zoneId: ZoneId, npc: NpcDef, flags: ReadonlySet<string>): InteractPlan {
  const d = npcDialogue(zoneId, npc, flags);
  const battle = d.beatId !== null && storyBeat(d.beatId).battle !== null;
  return { dialogue: d, sendOnFinish: battle };
}

/**
 * A trainer actor. A story trainer whose beat is next (§30.4.8 rule 6: facing it fires the beat) shows the beat's
 * lines first and challenges on finish; any other trainer challenges at once (its first line is a toast, B11).
 */
export function trainerPlan(zoneId: ZoneId, trainerId: string, flags: ReadonlySet<string>): InteractPlan {
  const beat = nextStoryBeat(zoneId, flags);
  if (beat === null || beat.battle?.trainerId !== trainerId || beat.lines.length === 0) return SEND_NOW;
  return { dialogue: { speaker: beatSpeaker(beat), lines: beat.lines, beatId: beat.id }, sendOnFinish: true };
}

/**
 * A league trainer, challenged where it waits in its hall (Phase A: the gym leader at its `leaderAt`, the Wardens and
 * the Champion in Solenne's league chambers). A beat the trainer speaks (grove_stone, bloom_after) runs first, exactly
 * like the server (§30.4.8 step 1). Otherwise a fight the server will accept opens the trainer's `pre` lines and
 * challenges on finish; one it will refuse is sent at once for the server's toast. The refusal rules mirror the
 * server's `leagueRefusal`: gyms — badge held, story gate, previous badge missing; Wardens — already beaten, fewer than
 * eight badges, the previous Warden not beaten; the Champion — already beaten, any Warden not beaten.
 */
export function gymPlan(zoneId: ZoneId, leagueId: string, flags: ReadonlySet<string>, badges: readonly BadgeId[]): InteractPlan {
  const beat = nextStoryBeat(zoneId, flags);
  if (beat !== null && beat.speaker === leagueId) {
    if (beat.lines.length === 0) return SEND_NOW;
    return { dialogue: { speaker: leagueSpeaker(leagueId), lines: beat.lines, beatId: beat.id }, sendOnFinish: beat.battle !== null };
  }
  const lt = LEAGUE.find((l) => l.id === leagueId);
  if (lt === undefined || lt.pre.length === 0) return SEND_NOW;
  const gate = leagueStoryGate(lt.id);
  if (gate !== null && !flags.has(gate)) return SEND_NOW;
  const beaten = (l: { readonly setsFlags: readonly string[] }): boolean => l.setsFlags.length > 0 && l.setsFlags.every((f) => flags.has(f));
  if (lt.stage === 'gym') {
    if (lt.badge === null || badges.includes(lt.badge)) return SEND_NOW;
    const prev = LEAGUE.find((l) => l.stage === 'gym' && l.order === lt.order - 1);
    if (prev?.badge != null && !badges.includes(prev.badge)) return SEND_NOW;
  } else {
    if (beaten(lt)) return SEND_NOW;
    const elites = LEAGUE.filter((l) => l.stage === 'elite');
    if (lt.stage === 'elite') {
      if (badges.length < 8) return SEND_NOW;
      const prev = elites.find((l) => l.order === lt.order - 1);
      if (prev !== undefined && !beaten(prev)) return SEND_NOW;
    } else if (elites.some((l) => !beaten(l))) return SEND_NOW;
  }
  return { dialogue: { speaker: leagueSpeaker(lt.id), lines: lt.pre, beatId: null }, sendOnFinish: true };
}

/** A won league battle: the leader's `post` lines (the concession line is post[1], bible §4.4). */
export function leaguePostDialogue(leagueId: string | null): DialogueLines | null {
  const lt = leagueId === null ? undefined : LEAGUE.find((l) => l.id === leagueId);
  if (lt === undefined || lt.post.length === 0) return null;
  return { speaker: leagueSpeaker(lt.id), lines: lt.post, beatId: null };
}

/**
 * The HUD's story line (Act I guidance): the first beat in STORY order the player can play now ("Talk to Prof. Wynn
 * (Mirevale)"), else the next gym badge ("Challenge Mira Thornwell (Mirevale)"); null when neither is left.
 */
export function storyHint(flags: ReadonlySet<string>, badges: readonly BadgeId[]): string | null {
  for (const b of STORY) {
    if (flags.has(beatDoneFlag(b.id)) || !beatEligible(b, flags)) continue;
    return `Talk to ${beatSpeaker(b).split(',')[0]} (${zone(b.zoneId).name})`;
  }
  const gyms = LEAGUE.filter((l) => l.stage === 'gym' && l.badge !== null).sort((a, b) => a.order - b.order);
  const next = gyms.find((g) => !badges.includes(g.badge!));
  return next === undefined ? null : `Challenge ${next.name} (${zone(next.zoneId).name})`;
}
