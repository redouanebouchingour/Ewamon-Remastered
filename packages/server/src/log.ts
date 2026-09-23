/**
 * §30.10.1 — pino root logger. `pino-pretty` only in development. Never logged: passwords, tokens, refresh
 * tokens, emails, chat text (see the redact list).
 */
import pino from 'pino';
import type { Logger } from 'pino';
import type { Env } from './env';

export type { Logger };

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>, base: Record<string, unknown> = {}): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { pid: process.pid, ...base },
    redact: {
      paths: ['password', 'passwordHash', 'refresh', 'access', 'token', 'email', 'text', '*.password', '*.refresh', '*.access', '*.email', 'req.headers.authorization'],
      censor: '[redacted]',
    },
    ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}

/** A logger that discards everything (tests that do not care). */
export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}
