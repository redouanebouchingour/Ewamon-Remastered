/**
 * SPEC §20.3.3 — reads `room.state` through a selector. Subscribes to the room's onStateChange (fires once
 * per applied patch, ≤ 20 Hz) and to room changes (join / handover / leave).
 *
 * The selector MUST return a primitive, or an array/object of primitives; the hook keeps the last result
 * and returns it unchanged when shallowEqual(prev, next), so React re-renders only when the selected value
 * changed. It never returns a Schema instance: schema objects are mutated in place by the decoder and
 * cannot be React snapshots. Returns `fallback` while there is no room.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ZoneState } from '@ewa/protocol';
import { getWorldSession } from './WorldSession';

export type Primitive = string | number | boolean | null;
export type RoomSelection = Primitive | readonly Primitive[] | Readonly<Record<string, Primitive>>;

export function shallowEqual(a: RoomSelection, b: RoomSelection): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ra = a as Readonly<Record<string, Primitive>>;
  const rb = b as Readonly<Record<string, Primitive>>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  for (const k of ka) if (!Object.is(ra[k], rb[k])) return false;
  return true;
}

export function useRoomState<T extends RoomSelection>(selector: (state: ZoneState, selfId: string) => T, fallback: T): T {
  const ws = getWorldSession();
  const selectorRef = useRef(selector);
  const fallbackRef = useRef(fallback);
  selectorRef.current = selector;
  fallbackRef.current = fallback;
  const last = useRef<{ value: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const room = ws.room;
    let next: T;
    try {
      next = room !== null && room.state !== undefined ? selectorRef.current(room.state, ws.selfId) : fallbackRef.current;
    } catch (_e) {
      next = fallbackRef.current; // a half-decoded state during join
    }
    if (last.current !== null && shallowEqual(last.current.value, next)) return last.current.value;
    last.current = { value: next };
    return next;
  }, [ws]);

  const subscribe = useCallback((cb: () => void) => ws.subscribeState(cb), [ws]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
