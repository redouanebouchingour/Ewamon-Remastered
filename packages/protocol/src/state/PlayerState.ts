/**
 * §4.1 PlayerState — one row per PLAYER uuid (never sessionId: a second tab collapses onto the
 * same avatar, 30-server-netcode.md §30.2.2). AOI-scoped through ZoneState.players (§4.2).
 */
import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  /** player uuid — NOT sessionId; multi-tab collapses to one avatar */
  @type('string') id = '';
  @type('string') name = '';
  @type('float32') x = 0;
  @type('float32') z = 0;
  /** radians, heading */
  @type('float32') angle = 0;
  @type('boolean') moving = false;
  @type('boolean') running = false;
  /** appearance id (remote appearance descriptor key) */
  @type('string') body = '';
  /** 0 none; 1..6 = wave happy sad alert heart cool; server clears after 2 s */
  @type('uint8') emote = 0;
  @type('boolean') inBattle = false;
  /** '' = none (persist's guildTag is `string | null`; the wire cannot carry null); 3..4 chars (§4.7 /guilds regex) */
  @type('string') guildTag = '';
  /** last input seq the server applied — the client reconciles against it */
  @type('uint32') seq = 0;
}
