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

/** The 20 client → server message names (§4.3), as `{ input: 'input', … }`. */
export const CLIENT_MSG: Readonly<{ [K in ClientMessageType]: K }> = nameMap(CLIENT_MESSAGE_TYPES);
/** The 16 server → client message names (§4.4). */
export const SERVER_MSG: Readonly<{ [K in ServerMessageType]: K }> = nameMap(SERVER_MESSAGE_TYPES);

/** Colyseus close codes the spine fixes (30-server-netcode.md §30.2.2, §30.2.4, §30.2.7). */
export const CLOSE_CODES = {
  /** consented leave */
  consented: 4000,
  /** a newer socket of the same player took over the avatar */
  replaced: 4001,
  /** handover complete — the source room is left */
  handoverComplete: 4002,
  /** kicked: 5 unknown message types in 10 s, or 30 movement rejections in 10 s */
  kicked: 4003,
} as const;

export * from './client';
export * from './server';
export * from './common';
