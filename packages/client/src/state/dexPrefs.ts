/**
 * Per-device Dex choices (2026-10-26): the research stamp's look. A convenience, so it lives in localStorage and falls
 * back to 'paper' when storage is blocked; which looks are open is the server's (claimed rewards).
 */
import { create } from 'zustand';
import type { DexStamp } from '@ewa/content';

const KEY = 'ewa.dex.stamp.v1';
const LOOKS: readonly DexStamp[] = ['paper', 'bronze', 'silver', 'gold', 'holo'];

function read(): DexStamp {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return v !== null && (LOOKS as readonly string[]).includes(v) ? (v as DexStamp) : 'paper';
  } catch (_e) {
    return 'paper';
  }
}

export const useDexPrefs = create<{ readonly stamp: DexStamp }>()(() => ({ stamp: read() }));

export function setDexStamp(stamp: DexStamp): void {
  useDexPrefs.setState({ stamp });
  try {
    localStorage.setItem(KEY, stamp);
  } catch (_e) {
    // storage blocked: the choice lasts this session
  }
}
