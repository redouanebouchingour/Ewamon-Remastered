export { PlayerState, LEAD_VARIANTS, decodeLeadFlags, encodeLeadFlags } from './PlayerState';
export type { LeadVariant } from './PlayerState';
export { SpawnState } from './SpawnState';
export { BattleSummary, WatchBattlerState } from './BattleSummary';
export { RaidState } from './RaidState';
export { ZoneState } from './ZoneState';
export { ArenaState } from './ArenaState';

/** §4.2: "Nothing else is ever @view()-tagged — AOI has exactly these two collections." Asserted by test/schema.test.ts against the class metadata. */
export const AOI_VIEW_FIELDS = ['players', 'spawns'] as const;
