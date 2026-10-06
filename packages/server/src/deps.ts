/**
 * The dependency bundle of §30.1.1 (`ServerDeps`) plus the process-local runtime services REST and the
 * rooms share (presence store, metrics, ban cache, token verification, the join-ticket secret).
 */
import type { ContentIndex } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import type { Env } from './env';
import type { Logger } from './log';
import type { Mailer } from './mail/mailer';
import type { MetricsRegistry } from './metrics';
import type { MatchQueue } from './rooms/matchQueue';
import type { PresenceMirror } from './rooms/presenceMirror';
import type { PresenceStore } from './rooms/presenceStore';

export interface ServerDeps {
  readonly env: Env;
  readonly repos: Repos & { readonly db: Db };
  readonly content: ContentIndex;
  /** pino */
  readonly log: Logger;
  /** Date.now, injected so tests can freeze it */
  readonly clock: () => number;
  /** Phase C6 outgoing mail; absent → `createMailer(env)` at boot (SMTP, else .eml files, memory under NODE_ENV=test) */
  readonly mailer?: Mailer;
}

/** JWT access-token payload (§30.6.1): `{ sub: playerId, usr: username, adm: boolean }`. */
export interface AccessClaims {
  readonly sub: string;
  readonly usr: string;
  readonly adm: boolean;
}

/** §30.6.7 — per-process ban cache, rebuilt from `players.banned_at` every 30 s and on the admin ban route. */
export interface BanCache {
  isBanned(playerId: string): boolean;
  add(playerId: string): void;
  remove(playerId: string): void;
  refresh(): Promise<void>;
}

/** Cross-room / cross-process events (Colyseus `presence.publish`): ewa:kick, ewa:dm:<id>, ewa:profile, ewa:liveops, ewa:teleport. */
export interface EventBus {
  publish(topic: string, data: unknown): void;
}

export interface Runtime {
  readonly presenceStore: PresenceStore;
  /** the store + the `ewa:presence:<id>` mirror (§30.7.4 distributed half) */
  readonly presenceMirror: PresenceMirror;
  readonly bus: EventBus;
  readonly metrics: MetricsRegistry;
  readonly bans: BanCache;
  /** verifies an access JWT with the REST secret/iss/aud; throws on invalid/expired */
  verifyAccess(token: string): AccessClaims;
  /** server-only join-ticket secret carried in every seat reservation's options */
  readonly ticket: string;
  /** SERVER_SEED or the derived boot seed */
  readonly worldSeed: string;
  /** Phase C6: the resolved mailer (ServerDeps.mailer or the env default) */
  readonly mailer: Mailer;
  /** Phase D13: the presence-keyed ranked queue (its matcher ticks every RANKED_TICK_MS on the lease holder) */
  readonly matchQueue: MatchQueue;
}

export type RoomDeps = ServerDeps & Runtime;
