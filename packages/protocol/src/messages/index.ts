/**
 * Message-name constants + re-exports. `CLIENT_MSG.input === 'input'` etc. so neither side ever
 * spells a wire name as a bare string literal.
 */
import { CLIENT_MESSAGE_TYPES } from './client';
import type { ClientMessageType } from './client';
import { SERVER_MESSAGE_TYPES } from './server';
import type { ServerMessageType } from './server';

function nameMap<T extends string>(names: readonly T[]): Readonly<{ [K in T]: K }> {
  const out = {} as { [K in T]: K };
  for (const n of names) out[n] = n;
  return Object.freeze(out);
}

/** The 21 client → server message names (§4.3), as `{ input: 'input', … }`. */
export const CLIENT_MSG: Readonly<{ [K in ClientMessageType]: K }> = nameMap(CLIENT_MESSAGE_TYPES);
/** The 16 server → client message names (§4.4). */
export const SERVER_MSG: Readonly<{ [K in ServerMessageType]: K }> = nameMap(SERVER_MESSAGE_TYPES);

/**
 * Colyseus close codes the spine fixes (30-server-netcode.md §30.2.2, §30.2.4, §30.2.7).
 *
 * `replaced` is 4101, not the spec's 4001: 4001 is Colyseus' own `CloseCode.SERVER_SHUTDOWN`
 * (@colyseus/shared-types 0.18.2), so a server restart was indistinguishable from "a newer tab took over".
 * 4100–4199 is unused by Colyseus (reserved: 4000 consented, 4001 shutdown, 4002 with error,
 * 4003 failed to reconnect, 4010 may try reconnect); the SDK auto-reconnects only on 1001/1005/1006/4010.
 * (server IMPLEMENTATION-NOTES part 2, P4)
 */
export const CLOSE_CODES = {
  /** consented leave */
  consented: 4000,
  /** a newer socket of the same player took over the avatar */
  replaced: 4101,
  /** handover complete — the source room is left */
  handoverComplete: 4002,
  /** kicked: 5 unknown message types in 10 s, or 30 movement rejections in 10 s */
  kicked: 4003,
} as const;

export * from './client';
export * from './server';
export * from './common';
