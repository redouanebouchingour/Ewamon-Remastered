/**
 * Every domain failure persist can raise. Callers switch on `code`, never on message text.
 * A thrown PersistError inside `db.transaction` rolls the transaction back like any other throw.
 */
export type PersistErrorCode =
  | 'NotFound'
  | 'InsufficientFunds'
  | 'InsufficientItems'
  | 'InventoryOverflow'
  | 'NotOwner'
  | 'Locked'
  | 'PartyMinimum'
  | 'PartyFull'
  | 'InvalidSlot'
  | 'InvalidReorder'
  | 'ListingClosed'
  | 'ListingHasBids'
  | 'BidTooLow'
  | 'SelfBid'
  | 'NoBuyNow'
  | 'GuildFull'
  | 'AlreadyInGuild'
  | 'NotGuildMember'
  | 'GuildNameTaken'
  | 'Forbidden'
  | 'NotInEscrow'
  | 'InvalidArgument';

export class PersistError extends Error {
  readonly code: PersistErrorCode;
  constructor(code: PersistErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PersistError';
    this.code = code;
  }
}

export function fail(code: PersistErrorCode, message?: string): never {
  throw new PersistError(code, message);
}

export function isPersistError(e: unknown, code?: PersistErrorCode): e is PersistError {
  return e instanceof PersistError && (code === undefined || e.code === code);
}
