/**
 * Phase C6 — outgoing mail (password reset, email verification). One small `Mailer` interface with three
 * transports:
 *
 * - `smtp`   — nodemailer SMTP from `SMTP_URL`, or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE`.
 * - `file`   — the dev transport when SMTP is unset: nodemailer composes the real MIME message and it is written
 *              as an `.eml` file under `DATA_DIR/mail` (open it in any mail client, or read the link out of it).
 * - `memory` — tests: messages are kept in an array (`NODE_ENV=test` without SMTP picks it by default).
 *
 * Mail is optional by design: nothing in the game waits for delivery, a send failure is logged and swallowed by
 * the caller, and verification never gates play.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import type { Env } from '../env';
import { smtpConfigured } from '../env';
import type { Logger } from '../log';

export type MailTag = 'reset' | 'verify';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** what the message is for (file names, test lookups); never sent as a header */
  readonly tag: MailTag;
}

export interface Mailer {
  readonly transport: 'smtp' | 'file' | 'memory';
  send(msg: MailMessage): Promise<void>;
}

export interface MemoryMailer extends Mailer {
  readonly transport: 'memory';
  readonly sent: MailMessage[];
}

export function memoryMailer(): MemoryMailer {
  const sent: MailMessage[] = [];
  return {
    transport: 'memory',
    sent,
    async send(msg) {
      sent.push(msg);
    },
  };
}

export function isMemoryMailer(m: Mailer): m is MemoryMailer {
  return m.transport === 'memory';
}

/** Dev transport: nodemailer's stream transport composes the MIME message; it lands in `dir` as an .eml file. */
export function fileMailer(dir: string, from: string, clock: () => number = Date.now): Mailer {
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  let n = 0;
  return {
    transport: 'file',
    async send(msg) {
      const info = await composer.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      mkdirSync(dir, { recursive: true });
      n += 1;
      const stamp = new Date(clock()).toISOString().replace(/[:.]/g, '-');
      writeFileSync(join(dir, `${stamp}-${String(n).padStart(3, '0')}-${msg.tag}.eml`), info.message as Buffer);
    },
  };
}

export function smtpMailer(env: Pick<Env, 'SMTP_URL' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_SECURE' | 'MAIL_FROM'>): Mailer {
  const transporter =
    env.SMTP_URL !== undefined
      ? nodemailer.createTransport(env.SMTP_URL)
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE === 'true',
          ...(env.SMTP_USER !== undefined ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } } : {}),
        });
  return {
    transport: 'smtp',
    async send(msg) {
      await transporter.sendMail({ from: env.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    },
  };
}

/** SMTP when configured; otherwise memory under NODE_ENV=test and the `.eml` file transport elsewhere. */
export function createMailer(env: Env, log: Logger): Mailer {
  if (smtpConfigured(env)) return smtpMailer(env);
  if (env.NODE_ENV === 'test') return memoryMailer();
  const dir = resolve(env.DATA_DIR, 'mail');
  log.info({ dir }, 'SMTP unset — emails are written as .eml files');
  return fileMailer(dir, env.MAIL_FROM);
}

/**
 * Fire-and-forget delivery for request handlers: the HTTP answer never waits on SMTP (and so never reveals by
 * its timing whether a message went out). Failures are logged without the address (pino redacts `email`).
 */
export function deliver(mailer: Mailer, log: { warn(obj: object, msg: string): void }, msg: MailMessage): void {
  mailer.send(msg).catch((err: unknown) => log.warn({ err, tag: msg.tag }, 'mail delivery failed'));
}

// ---- templates ---------------------------------------------------------------------------------------------------

/** Password-reset link lifetime. */
export const RESET_TTL_MS = 30 * 60_000;
/** Email-verification link lifetime. */
export const VERIFY_TTL_MS = 48 * 3_600_000;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function mailLink(env: Pick<Env, 'PUBLIC_WEB_URL'>, path: '/reset' | '/verify', token: string): string {
  return `${env.PUBLIC_WEB_URL.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
}

function layout(title: string, lines: readonly string[], link: string, cta: string): string {
  const body = lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ea;font-family:system-ui,sans-serif;color:#1d2321"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}<p style="margin:20px 0"><a href="${esc(link)}" style="display:inline-block;background:#2f6f5e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(cta)}</a></p><p style="margin:0;font-size:12px;color:#5b6461">Or paste this link into your browser: ${esc(link)}</p></div></body></html>`;
}

export function resetEmail(env: Pick<Env, 'PUBLIC_WEB_URL'>, to: string, username: string, token: string): MailMessage {
  const link = mailLink(env, '/reset', token);
  const lines = [`Hi ${username},`, 'Someone (hopefully you) asked to reset the password of your Ewamon account. The link below works once, for 30 minutes.', 'If you did not ask for this, ignore this email: your password stays as it is.'];
  return { tag: 'reset', to, subject: 'Reset your Ewamon password', text: `${lines.join('\n\n')}\n\nReset your password: ${link}\n`, html: layout('Reset your password', lines, link, 'Choose a new password') };
}

export function verifyEmail(env: Pick<Env, 'PUBLIC_WEB_URL'>, to: string, username: string, token: string): MailMessage {
  const link = mailLink(env, '/verify', token);
  const lines = [`Welcome to Ewamon, ${username}!`, 'Confirm this is your email address so you can recover your account if you ever forget your password. The link works for 48 hours.'];
  return { tag: 'verify', to, subject: 'Confirm your Ewamon email', text: `${lines.join('\n\n')}\n\nConfirm your email: ${link}\n`, html: layout('Confirm your email', lines, link, 'Confirm email') };
}

/** Pulls the token back out of a message's link (tests, and the dev .eml reader in IMPLEMENTATION-NOTES). */
export function tokenOf(msg: Pick<MailMessage, 'text'>): string | null {
  const m = /[?&]token=([A-Za-z0-9_%-]+)/.exec(msg.text);
  return m === null ? null : decodeURIComponent(m[1]!);
}
