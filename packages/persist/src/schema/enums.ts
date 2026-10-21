import { pgEnum } from 'drizzle-orm/pg-core';

/** 'daycare' (migration 0016): left at the Daycare (breeding); out of play like a listing until withdrawn */
export const slotKind = pgEnum('slot_kind', ['party', 'box', 'listing', 'trade_escrow', 'daycare']);
export const listingStatus = pgEnum('listing_status', ['active', 'sold', 'expired', 'cancelled']);
export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted']);
export const guildRole = pgEnum('guild_role', ['leader', 'officer', 'member']);
export const battleFormat = pgEnum('battle_format', ['wild', 'trainer', 'league', 'pvp', 'raid']);
