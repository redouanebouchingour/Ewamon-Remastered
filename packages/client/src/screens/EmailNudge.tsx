/**
 * Phase C6 — the small, non-blocking "confirm your email" line the settings panel shows while the profile says the
 * email is unverified. "Resend link" posts `POST /auth/resend` (3/h per player); `alreadyVerified` hides it.
 */
import { useState } from 'react';
import { ApiFailure, apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import s from './EmailNudge.module.css';

type NudgeState = { readonly kind: 'idle' | 'sending' | 'sent' } | { readonly kind: 'error'; readonly message: string };

/** Non-blocking: renders only while the profile says the email is unverified. */
export function EmailNudge() {
  const verified = useSessionStore((st) => st.profile?.emailVerified);
  const [state, setState] = useState<NudgeState>({ kind: 'idle' });
  if (verified !== false) return null;
  const resend = async (): Promise<void> => {
    setState({ kind: 'sending' });
    try {
      await apiFetch('authResend');
      setState({ kind: 'sent' });
    } catch (e) {
      if (e instanceof ApiFailure && e.error.code === 'alreadyVerified') {
        useSessionStore.getState().markEmailVerified();
        return;
      }
      setState({ kind: 'error', message: describeError(e) });
    }
  };
  return (
    <div className={s.nudge} data-testid="email-nudge">
      <span className={s.nudgeIcon} aria-hidden>
        <Icon name="info" />
      </span>
      <p className={s.nudgeText} role="status">
        {state.kind === 'sent' ? (
          <>
            <strong>Link sent.</strong> Open it from your inbox to confirm your email.
          </>
        ) : state.kind === 'error' ? (
          state.message
        ) : (
          <>
            <strong>Confirm your email</strong> so you can recover your account if you forget the password. Play is not affected.
          </>
        )}
      </p>
      {state.kind !== 'sent' && (
        <Button size="sm" busy={state.kind === 'sending'} onClick={() => void resend()}>
          Resend link
        </Button>
      )}
    </div>
  );
}
