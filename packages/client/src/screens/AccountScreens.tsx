/**
 * Phase C6 — account recovery and email verification, in the `/login` layout (key art, story column, glass card):
 *
 * - `/forgot`          — email → `POST /auth/forgot`. The server answers 204 whether or not the address has an
 *                        account, so the screen always says "if an account uses it, a link is on its way".
 * - `/reset?token=`    — new password (twice) → `POST /auth/reset`. Every device is signed out by the server, so
 *                        this browser's session is ended too and the player logs in again.
 * - `/verify?token=`   — the loader posts `POST /auth/verify` once; the screen reports the result. Verification never
 *                        gates play.
 *
 * The non-blocking "confirm your email" line of the settings panel is `EmailNudge.tsx` (kept out of this chunk).
 */
import type { ReactNode } from 'react';
import { Form, Link, data, useActionData, useLoaderData, useNavigation, useSearchParams } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { ForgotReq, Password } from '@ewa/protocol';
import { ApiFailure, apiFetch, endSession } from '../net/api';
import { describeError, statusOf } from '../net/errors';
import { hasRefreshToken } from '../net/tokens';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { FormError, TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { KeyArt } from '../ui/KeyArt';
import { cx } from '../ui/cx';
import { NotificationHost } from '../app/NotificationHost';
import a from './AuthScreen.module.css';
import s from './AccountScreens.module.css';

type TokenRefusal = 'unknown' | 'expired' | 'used';

/** The reason of a 400 `badToken` (protocol `BadTokenErr`), or null for any other failure. */
function refusalOf(e: unknown): TokenRefusal | null {
  if (!(e instanceof ApiFailure) || e.error.code !== 'badToken') return null;
  const r = e.error.extra?.['reason'];
  return r === 'expired' || r === 'used' ? r : 'unknown';
}

const REFUSAL_COPY: Readonly<Record<'reset' | 'verify', Readonly<Record<TokenRefusal, string>>>> = {
  reset: {
    expired: 'This reset link has expired — links work for 30 minutes. Ask for a new one below.',
    used: 'This reset link was already used. If you still need to change your password, ask for a new one.',
    unknown: 'This reset link is not valid. Copy the whole link from the email, or ask for a new one.',
  },
  verify: {
    expired: 'This confirmation link has expired. Send yourself a new one from Settings.',
    used: 'This confirmation link was already used — or a newer one replaced it.',
    unknown: 'This confirmation link is not valid. Copy the whole link from the email.',
  },
};

/** Shared page frame: the `/login` layout with this screen's story column and card. */
function AccountPage({ testId, eyebrow, headline, lede, title, children }: { readonly testId: string; readonly eyebrow: string; readonly headline: string; readonly lede: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className={a.page} data-testid={testId}>
      <KeyArt scene="campfire" />
      <Link to="/" className={a.logo}>
        <img className={a.mark} src="/icons/emblem.png" alt="" />
        Ewamon
      </Link>
      <aside className={a.story}>
        <p className={a.eyebrow}>{eyebrow}</p>
        <h1 className={a.headline}>{headline}</h1>
        <p className={a.lede}>{lede}</p>
      </aside>
      <main className={a.card}>
        <h2 className={a.title}>{title}</h2>
        {children}
      </main>
      <NotificationHost />
    </div>
  );
}

function Status({ icon, tone = 'ok', children }: { readonly icon: IconName; readonly tone?: 'ok' | 'warn'; readonly children: ReactNode }) {
  return (
    <div className={s.status} role="status">
      <span className={cx(s.statusMark, tone === 'warn' && s.statusMarkWarn)} aria-hidden>
        <Icon name={icon} />
      </span>
      <div className={s.statusText}>{children}</div>
    </div>
  );
}

// ---- /forgot -------------------------------------------------------------------------------------------------

export type ForgotActionData = { readonly sent: true; readonly email: string } | { readonly sent?: false; readonly fieldError?: string; readonly formError?: string };

export async function forgotAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const parsed = ForgotReq.safeParse({ email });
  if (!parsed.success) return data<ForgotActionData>({ fieldError: 'Enter the email address you registered with.' }, { status: 400 });
  try {
    await apiFetch('authForgot', { body: parsed.data });
  } catch (e) {
    return data<ForgotActionData>({ formError: describeError(e) }, { status: statusOf(e) });
  }
  return data<ForgotActionData>({ sent: true, email: parsed.data.email });
}

export function ForgotScreen() {
  const result = useActionData() as ForgotActionData | undefined;
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  return (
    <AccountPage testId="forgot" eyebrow="Account recovery" headline="Lost the trail? We will mark it again." lede="Enter the email you registered with and we will send a link to choose a new password." title="Reset your password">
      {result?.sent === true ? (
        <>
          <Status icon="send">
            <p className={s.body}>
              If an account uses <strong>{result.email}</strong>, a reset link is on its way. It works once, for 30 minutes.
            </p>
            <p className={s.note}>Nothing arriving? Check the spam folder, or ask again in a minute.</p>
          </Status>
          <div className={s.actions}>
            <Link to="/login" className={a.switchLink}>
              Back to log in
            </Link>
          </div>
        </>
      ) : (
        <>
          <Form method="post" className={a.form} noValidate>
            <div className={a.fields}>
              <TextField label="Email" name="email" type="email" autoComplete="email" autoFocus required maxLength={254} error={result?.fieldError ?? null} />
            </div>
            {result?.formError !== undefined && <FormError>{result.formError}</FormError>}
            <Button type="submit" variant="primary" size="lg" busy={submitting} className={a.submit}>
              Send reset link
            </Button>
          </Form>
          <p className={a.switch}>
            Remembered it?{' '}
            <Link to="/login" className={a.switchLink}>
              Log in
            </Link>
          </p>
        </>
      )}
    </AccountPage>
  );
}

// ---- /reset?token= -------------------------------------------------------------------------------------------

export type ResetActionData =
  | { readonly done: true }
  | { readonly done?: false; readonly fieldErrors?: Readonly<Partial<Record<'password' | 'confirm', string>>>; readonly formError?: string; readonly refusal?: TokenRefusal };

export async function resetAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (!Password.safeParse(password).success) return data<ResetActionData>({ fieldErrors: { password: 'Use 8 to 128 characters.' } }, { status: 400 });
  if (confirm !== password) return data<ResetActionData>({ fieldErrors: { confirm: 'The two passwords differ.' } }, { status: 400 });
  try {
    await apiFetch('authReset', { body: { token, password } });
  } catch (e) {
    const refusal = refusalOf(e);
    if (refusal !== null) return data<ResetActionData>({ refusal }, { status: 400 });
    return data<ResetActionData>({ formError: describeError(e) }, { status: statusOf(e) });
  }
  // the server revoked every refresh token of the account: this browser's session is over too
  endSession();
  return data<ResetActionData>({ done: true });
}

export function ResetScreen() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const result = useActionData() as ResetActionData | undefined;
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const errors = result?.done === true ? {} : (result?.fieldErrors ?? {});
  const refusal = result?.done === true ? undefined : (result?.refusal ?? (token.length === 0 ? 'unknown' : undefined));

  let content: ReactNode;
  if (result?.done === true) {
    content = (
      <>
        <Status icon="check">
          <p className={s.body}>Your password is changed. Every device was signed out — log in again with the new password.</p>
        </Status>
        <Link to="/login" className={a.switchLink}>
          Log in
        </Link>
      </>
    );
  } else if (refusal !== undefined) {
    content = (
      <>
        <Status icon="warn" tone="warn">
          <p className={s.body}>{REFUSAL_COPY.reset[refusal]}</p>
        </Status>
        <div className={s.actions}>
          <Link to="/forgot" className={a.switchLink}>
            Ask for a new link
          </Link>
        </div>
      </>
    );
  } else {
    content = (
      <Form method="post" className={a.form} noValidate>
        <input type="hidden" name="token" value={token} />
        <div className={a.fields}>
          <TextField label="New password" name="password" type="password" autoComplete="new-password" autoFocus required maxLength={128} error={errors.password ?? null} icon="lock" />
          <TextField label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" required maxLength={128} error={errors.confirm ?? null} icon="lock" />
        </div>
        {result?.formError !== undefined && <FormError>{result.formError}</FormError>}
        <Button type="submit" variant="primary" size="lg" busy={submitting} className={a.submit}>
          Set new password
        </Button>
        <p className={s.note}>Changing it signs you out everywhere.</p>
      </Form>
    );
  }
  return (
    <AccountPage testId="reset" eyebrow="Account recovery" headline="A fresh key for the same grove." lede="Choose a new password. Your party, badges and progress are untouched." title="Choose a new password">
      {content}
    </AccountPage>
  );
}

// ---- /verify?token= ------------------------------------------------------------------------------------------

export type VerifyLoaderData = { readonly ok: true } | { readonly ok: false; readonly refusal: TokenRefusal | null; readonly message: string };

/** Posts the token once per navigation (a loader, so StrictMode double effects cannot consume it twice). */
export async function verifyLoader({ request }: LoaderFunctionArgs): Promise<VerifyLoaderData> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (token.length === 0) return { ok: false, refusal: 'unknown', message: REFUSAL_COPY.verify.unknown };
  try {
    await apiFetch('authVerify', { body: { token }, signal: request.signal });
  } catch (e) {
    if (request.signal.aborted) throw e;
    const refusal = refusalOf(e);
    return { ok: false, refusal, message: refusal !== null ? REFUSAL_COPY.verify[refusal] : describeError(e) };
  }
  useSessionStore.getState().markEmailVerified();
  return { ok: true };
}

export function VerifyScreen() {
  const result = useLoaderData() as VerifyLoaderData;
  const signedIn = hasRefreshToken();
  return (
    <AccountPage testId="verify" eyebrow="Email" headline="One more mark on your trainer card." lede="A confirmed email lets you recover your account if you ever forget the password." title={result.ok ? 'Email confirmed' : 'Could not confirm'}>
      {result.ok ? (
        <Status icon="check">
          <p className={s.body}>Thanks — your email is confirmed.</p>
        </Status>
      ) : (
        <Status icon="warn" tone="warn">
          <p className={s.body}>{result.message}</p>
        </Status>
      )}
      <Link to={signedIn ? '/play' : '/login'} className={a.switchLink}>
        {signedIn ? 'Continue to the world' : 'Log in'}
      </Link>
    </AccountPage>
  );
}
