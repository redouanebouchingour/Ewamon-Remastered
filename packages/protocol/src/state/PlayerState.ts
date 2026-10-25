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
  /** Phase D8: standing on a water-only sample (HM Surf) — remote avatars ride at water level (last fields: earlier indexes unchanged) */
  @type('boolean') surfing = false;
  /** Phase D11: the last accepted input was ridden on the bicycle */
  @type('boolean') biking = false;
  /**
   * Followers (SPEC §3.18): the species of the party lead walking behind this player ('' = none: every creature fainted).
   * Written only when the lead changes, so it costs nothing per tick.
   */
  @type('string') lead = '';
  /** Followers: the lead's look, packed (`encodeLeadFlags`: bit 0 shiny, bit 1 alpha, bits 2..4 the variant, bits 5..7 the held form). */
  @type('uint8') leadFlags = 0;
}

/** The variant keys in their `leadFlags` order (core `VariantKey`). */
export const LEAD_VARIANTS = ['normal', 'dawn', 'dusk', 'verdant', 'ember'] as const;
export type LeadVariant = (typeof LEAD_VARIANTS)[number];

/**
 * Followers: packs a lead's look into `PlayerState.leadFlags` (unknown variant = normal). `form` is the 1-based slot in
 * core `formsOf(species)` of the form its held item opens (core `heldForm`, ravatar's relic forms), 0 or absent = none;
 * three bits, so slots 1..7.
 */
export function encodeLeadFlags(look: { readonly isShiny?: boolean; readonly isAlpha?: boolean; readonly variantKey?: string; readonly form?: number }): number {
  const v = Math.max(0, LEAD_VARIANTS.indexOf((look.variantKey ?? 'normal') as LeadVariant));
  const f = look.form ?? 0;
  return (look.isShiny === true ? 1 : 0) | (look.isAlpha === true ? 2 : 0) | (v << 2) | ((f >= 1 && f <= 7 ? f : 0) << 5);
}

/** Followers: unpacks `PlayerState.leadFlags` (`form` 0 = the species' own look). */
export function decodeLeadFlags(flags: number): { readonly isShiny: boolean; readonly isAlpha: boolean; readonly variantKey: LeadVariant; readonly form: number } {
  const v = (flags >> 2) & 7;
  return { isShiny: (flags & 1) === 1, isAlpha: (flags & 2) === 2, variantKey: LEAD_VARIANTS[v] ?? 'normal', form: (flags >> 5) & 7 };
}
