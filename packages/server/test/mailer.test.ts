/**
 * Phase C6 — the mail env (optional in production: warn, never refuse) and the transports: the dev `.eml` file
 * transport composes a real MIME message under DATA_DIR/mail; the memory transport is the NODE_ENV=test default.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envWarnings, parseEnv, smtpConfigured, testEnv } from '../src/env';
import { silentLogger } from '../src/log';
import { createMailer, fileMailer, mailLink, resetEmail, tokenOf, verifyEmail } from '../src/mail/mailer';

const secret = 'x'.repeat(40);
const prod = { NODE_ENV: 'production', JWT_SECRET: secret, DATABASE_URL: 'postgres://u:p@h/db' };

describe('mail env', () => {
  it('production without SMTP boots (warnings only); SMTP_URL or SMTP_HOST counts as configured', () => {
    const env = parseEnv(prod);
    expect(smtpConfigured(env)).toBe(false);
    expect(envWarnings(env).join(' ')).toMatch(/SMTP is not configured/);
    expect(envWarnings(env).join(' ')).toMatch(/PUBLIC_WEB_URL/);
    const configured = parseEnv({ ...prod, SMTP_URL: 'smtps://u:p@mail.example.com:465', MAIL_FROM: 'Ewamon <hi@example.com>', PUBLIC_WEB_URL: 'https://play.example.com' });
    expect(smtpConfigured(configured)).toBe(true);
    expect(envWarnings(configured)).toEqual([]);
    expect(smtpConfigured(parseEnv({ ...prod, SMTP_HOST: 'mail.example.com' }))).toBe(true);
    expect(envWarnings(parseEnv({ NODE_ENV: 'development', JWT_SECRET: secret }))).toEqual([]);
    expect(() => parseEnv({ ...prod, PUBLIC_WEB_URL: 'not a url' })).toThrow();
  });

  it('createMailer: memory under NODE_ENV=test, the .eml file transport in development, SMTP when configured', () => {
    expect(createMailer(testEnv(), silentLogger()).transport).toBe('memory');
    expect(createMailer(testEnv({ NODE_ENV: 'development' }), silentLogger()).transport).toBe('file');
    expect(createMailer(testEnv({ SMTP_HOST: 'localhost', SMTP_PORT: 2525 }), silentLogger()).transport).toBe('smtp');
  });
});

describe('templates + file transport', () => {
  it('links carry the token under PUBLIC_WEB_URL (trailing slash tolerated) and round-trip through tokenOf', () => {
    const env = { PUBLIC_WEB_URL: 'https://play.example.com/' };
    expect(mailLink(env, '/reset', 'abc_DEF-123')).toBe('https://play.example.com/reset?token=abc_DEF-123');
    const r = resetEmail(env, 'a@b.test', 'ash_k', 'tok_123-abc');
    expect(r).toMatchObject({ tag: 'reset', to: 'a@b.test' });
    expect(tokenOf(r)).toBe('tok_123-abc');
    const v = verifyEmail(env, 'a@b.test', 'ash_k', 'tok_456');
    expect(v.text).toContain('https://play.example.com/verify?token=tok_456');
    expect(v.html).toContain('ash_k');
  });

  it('the dev transport writes one MIME .eml per message under the mail dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ewa-mail-'));
    try {
      const m = fileMailer(join(dir, 'mail'), 'Ewamon <no-reply@localhost>', () => Date.UTC(2026, 9, 6, 12));
      await m.send(resetEmail({ PUBLIC_WEB_URL: 'http://localhost:5173' }, 'ash@example.test', 'ash_k', 'tok_789'));
      const files = readdirSync(join(dir, 'mail'));
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^2026-10-06T12-00-00-000Z-001-reset\.eml$/);
      const eml = readFileSync(join(dir, 'mail', files[0]!), 'utf8');
      expect(eml).toMatch(/^From: Ewamon <no-reply@localhost>$/m);
      expect(eml).toMatch(/^To: ash@example.test$/m);
      expect(eml).toMatch(/^Subject: Reset your Ewamon password$/m);
      expect(eml).toContain('multipart/alternative');
      expect(eml).toContain('/reset?token=3Dtok_789'); // quoted-printable "="
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
