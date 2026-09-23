/**
 * Screen helpers: closing a panel, and the one mutation path — `useFetcher().submit(json, { method: 'post',
 * encType: 'application/json' })` to the route's action (SPEC §20.1.2). `fetcher.state === 'submitting'`
 * renders as the pressed/busy button, never a spinner overlay.
 */
import { useCallback } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import type { CreatureInstance } from '@ewa/core';
import type { ActionResult } from '../app/actions';

export function useClosePanel(): () => void {
  const navigate = useNavigate();
  return useCallback(() => void navigate('/play'), [navigate]);
}

export type IntentPayload = { readonly intent: string } & Readonly<Record<string, string | number | boolean | null | readonly string[]>>;

export interface IntentFetcher {
  submit(payload: IntentPayload): void;
  /** true while a submission matching `pred` (or any, when omitted) is in flight */
  busy(pred?: (p: IntentPayload) => boolean): boolean;
  readonly result: ActionResult | undefined;
  readonly idle: boolean;
}

export function useIntent(action?: string): IntentFetcher {
  const fetcher = useFetcher<ActionResult>();
  const pending = fetcher.state !== 'idle' ? (fetcher.json as IntentPayload | undefined) : undefined;
  return {
    submit(payload) {
      void fetcher.submit(payload as never, { method: 'post', encType: 'application/json', ...(action !== undefined ? { action } : {}) });
    },
    busy(pred) {
      if (pending === undefined) return false;
      return pred === undefined ? true : pred(pending);
    },
    result: fetcher.data,
    idle: fetcher.state === 'idle',
  };
}

/** A display-only instance for a species with no owned creature (starter picker, mythical choice). */
export function previewCreature(speciesId: string, level = 5): CreatureInstance {
  return {
    id: `preview-${speciesId}`,
    ownerId: null,
    speciesId,
    nickname: null,
    level,
    exp: 0,
    hp: 1,
    moves: [{ id: 'Tackle', pp: 35, ppMax: 35 }],
    status: [],
    ability: '',
    heldItem: null,
    variantKey: 'normal',
    isAlpha: false,
    caughtAt: null,
    ribbons: [],
    favorite: false,
    locked: false,
  };
}

export function relativeTime(iso: string | number, now: number = Date.now()): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  const unit = abs < 60 ? ['second', 1] : abs < 3600 ? ['minute', 60] : abs < 86400 ? ['hour', 3600] : ['day', 86400];
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return fmt.format(Math.round(diff / (unit[1] as number)), unit[0] as Intl.RelativeTimeFormatUnit);
}

/** "5h 12m" / "42m" / "Ended" for auction countdowns (mono in the UI). */
export function timeLeft(iso: string, now: number = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'Ended';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}
