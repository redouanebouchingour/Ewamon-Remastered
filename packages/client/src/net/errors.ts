/**
 * Human copy for REST error codes (server §30.6 HttpError codes + persist §5.5 domain errors), and the one
 * rule for telling "this server route does not exist yet" apart from a domain 404.
 */
import { ApiFailure } from './apiError';

const MESSAGES: Readonly<Record<string, string>> = {
  network: 'Cannot reach the server. Check that it is running and try again.',
  badResponse: 'The server sent something unexpected.',
  unauthorized: 'Your session has ended. Log in again.',
  badCredentials: 'Wrong username or password.',
  banned: 'This account is banned.',
  taken: 'Already taken.',
  rateLimited: 'Too many requests.',
  invalidPayload: 'That request was not valid.',
  internal: 'The server hit a problem. Try again.',
  NotFound: 'Not found.',
  gated: 'Sealed until you earn the badge.',
  inBattle: 'Finish your battle first.',
  wrongZone: 'You are in a different zone.',
  InsufficientFunds: 'Not enough money.',
  InsufficientItems: 'You do not have enough of that item.',
  InventoryOverflow: 'That stack is full.',
  AlreadyClaimed: 'Already claimed.',
  levelLocked: 'Reach that trainer level first.',
  questIncomplete: 'Finish every objective first.',
  notInStock: 'This shop does not stock that.',
  noShopHere: 'There is no shop here.',
  notForSale: 'Not for sale.',
  notSellable: 'That cannot be sold.',
  Locked: 'That creature is locked. Unlock it first.',
  PartyMinimum: 'Your party needs at least one creature.',
  PartyFull: 'Your party is full.',
  InvalidSlot: 'That slot is not valid.',
  InvalidReorder: 'That order is not valid.',
  NotOwner: 'That is not yours.',
  notLearnable: 'It cannot learn that move yet.',
  notHoldable: 'That item cannot be held.',
  badAbility: 'It cannot have that ability.',
  notReady: 'It is not ready to evolve.',
  // Phase D2
  noTutorHere: 'No tutor here teaches that move.',
  alreadyKnown: 'It already knows that move.',
  movesFull: 'It knows four moves. Choose one to forget.',
  notKnown: 'It does not know that move.',
  alreadyOwned: 'You already have that. TMs are never used up.',
  oneAtATime: 'One at a time.',
  notAtHealer: 'Find a healer first.',
  notUsable: 'That item cannot be used here.',
  notUsableHere: 'That item cannot be used here.',
  noEffect: 'It would have no effect.',
  needsTarget: 'Choose a creature first.',
  unknownItem: 'Unknown item.',
  adminNotBannable: 'Admins cannot be banned.',
  forbidden: 'You do not have access to that.',
  Forbidden: 'You do not have access to that.',
  BidTooLow: 'Your bid is too low.',
  BidAboveBuyNow: 'Your bid is above the buy-now price — buy it instead.',
  SelfBid: 'You cannot bid on your own listing.',
  ListingClosed: 'That listing has closed.',
  ListingHasBids: 'A listing with bids cannot be cancelled.',
  NoBuyNow: 'That listing has no buy-now price.',
  GuildFull: 'That guild is full.',
  AlreadyInGuild: 'You are already in a guild.',
  NotGuildMember: 'You are not in that guild.',
  GuildNameTaken: 'That guild name is taken.',
  AlreadyFriends: 'You are already friends.',
  unavailable: 'This part of the server is not live yet.',
};

/** A 404 whose body is not the server's `{ code: 'NotFound' }`: the route itself does not exist (part-2 server routes). */
export function isRouteUnavailable(e: unknown): boolean {
  return e instanceof ApiFailure && e.error.status === 404 && e.error.code !== 'NotFound';
}

export function describeError(e: unknown): string {
  if (!(e instanceof ApiFailure)) return e instanceof Error ? e.message : 'Something went wrong.';
  if (isRouteUnavailable(e)) return MESSAGES['unavailable']!;
  const { code, extra } = e.error;
  if (code === 'rateLimited') {
    const s = extra?.['retryAfterS'];
    if (typeof s === 'number') {
      const mins = Math.ceil(s / 60);
      return s >= 90 ? `Too many requests — try again in ${mins} min.` : `Too many requests — try again in ${s} s.`;
    }
  }
  return MESSAGES[code] ?? `Refused (${code}).`;
}

/** The JSON shape every route action returns on failure (field-specific when the server names a field). */
export interface ActionError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export function toActionError(e: unknown): ActionError {
  if (e instanceof ApiFailure) {
    const field = e.error.extra?.['field'];
    return { code: isRouteUnavailable(e) ? 'unavailable' : e.error.code, message: describeError(e), ...(typeof field === 'string' ? { field } : {}) };
  }
  return { code: 'client', message: describeError(e) };
}

export function statusOf(e: unknown): number {
  return e instanceof ApiFailure && e.error.status > 0 ? e.error.status : 503;
}
