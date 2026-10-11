/**
 * Where the local player stands in a just-joined zone room, for the zone load's first-view compile (render T4: phase 1
 * compiles what the predicted first view draws; everything else is gated — invisible — until the background phase
 * reaches it, nearest the predicted focus first).
 *
 * A room joined while the renderer is already up (back from the arena, a reconnect) calls `enterZone` before the
 * room's first state patch: `players` does not hold the local player yet. Loading with no arrival point predicted the
 * zone's spawn (mire_route: x −92) while the player stood 100 m away, so the real view stayed gated for the whole
 * background phase and the frame showed the sky through it — white by day, a blue haze by night. The load therefore
 * waits (bounded) for the first patch that carries the local player.
 */

export interface ArrivalPoint { readonly x: number; readonly z: number }

/** The part of a zone room's state read here (a Colyseus `MapSchema` of players). */
export interface ArrivalRoom {
  readonly state?: { readonly players?: { get(id: string): { readonly x: number; readonly z: number } | undefined } | null } | null;
}

export interface ArrivalOptions {
  /** Give up after this long (ms) and load with no arrival point (the zone's spawn). */
  readonly timeoutMs?: number;
  /** Poll interval (ms). */
  readonly stepMs?: number;
  /** False once the room was replaced or the world disposed: stop waiting. */
  readonly stillCurrent?: () => boolean;
  /** Test seam: waits `ms`. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Test seam: the clock (ms). */
  readonly now?: () => number;
}

export const ARRIVAL_TIMEOUT_MS = 3000;
export const ARRIVAL_STEP_MS = 30;

/** The local player's position in `room`, if the state already holds it (finite coordinates only). */
export function arrivalOf(room: ArrivalRoom, selfId: string): ArrivalPoint | null {
  const me = room.state?.players?.get(selfId);
  if (me === undefined || !Number.isFinite(me.x) || !Number.isFinite(me.z)) return null;
  return { x: me.x, z: me.z };
}

/** Resolves with the local player's position once the room's state carries it; null on timeout or when no longer current. */
export async function awaitArrival(room: ArrivalRoom, selfId: string, o: ArrivalOptions = {}): Promise<ArrivalPoint | null> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
  const now = o.now ?? (() => performance.now());
  const limit = now() + (o.timeoutMs ?? ARRIVAL_TIMEOUT_MS);
  for (;;) {
    if (o.stillCurrent !== undefined && !o.stillCurrent()) return null;
    const a = arrivalOf(room, selfId);
    if (a !== null) return a;
    if (now() >= limit) return null;
    await sleep(o.stepMs ?? ARRIVAL_STEP_MS);
  }
}
