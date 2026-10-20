/**
 * `/login` and `/register` (SPEC §20.9.1): full-bleed key art with the form card centred-right. Register adds email
 * and the starter picker — three showcase cards for bramblecub / glimfin / cindercap, the largest element on the
 * form. Errors render under the field they concern; network errors as one danger line above the button. No
 * password rules beyond 8..128 are shown until violated.
 */
import { useState } from 'react';
import { Form, Link, useActionData, useNavigation, useSearchParams } from 'react-router';
import { STARTERS } from '@ewa/protocol';
import type { StarterId } from '@ewa/protocol';
import type { AuthActionData } from '../app/actions';
import { species } from '../data/content';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { FormError, TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { KeyArt } from '../ui/KeyArt';
import { NotificationHost } from '../app/NotificationHost';
import s from './AuthScreen.module.css';
import { previewCreature } from './shared';
import { CHALLENGE_LABELS, CHALLENGE_MODES } from '@ewa/content';
import type { ChallengeMode } from '@ewa/content';
import { Segmented } from '../ui/Field';

export interface AuthScreenProps {
  readonly mode: 'login' | 'register';
}

function firstSentences(text: string, max = 110): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return dot > 40 ? cut.slice(0, dot + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function StarterPicker({ value, onChange, error }: { readonly value: StarterId | null; readonly onChange: (s: StarterId) => void; readonly error?: string }) {
  return (
    <fieldset className={s.starters}>
      <legend className={s.legend}>Choose your first companion</legend>
      <div className={s.starterRow} role="radiogroup" aria-label="Starter">
        {STARTERS.map((id) => (
          <CreatureCard
            key={id}
            creature={previewCreature(id)}
            variant="showcase"
            selected={value === id}
            onClick={() => onChange(id)}
            caption={firstSentences(species(id)?.flavor ?? '')}
          />
        ))}
      </div>
      {error !== undefined && <p className={s.fieldError}>{error}</p>}
    </fieldset>
  );
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const result = useActionData() as AuthActionData | undefined;
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const [starter, setStarter] = useState<StarterId | null>(null);
  const [challenge, setChallenge] = useState<'normal' | ChallengeMode>('normal');
  const submitting = navigation.state === 'submitting';
  const errors = result?.fieldErrors ?? {};
  const register = mode === 'register';
  const next = params.get('next');
  const switchTo = register ? `/login${next !== null ? `?next=${encodeURIComponent(next)}` : ''}` : '/register';

  return (
    <div className={s.page} data-testid={register ? 'register' : 'login'}>
      <KeyArt />
      <Link to="/" className={s.logo}>
        <span className={s.mark} aria-hidden>
          <Icon name="leaf" size="sm" />
        </span>
        Ewamon
      </Link>
      <aside className={s.story}>
        <p className={s.eyebrow}>{register ? 'New trainer' : 'Welcome back'}</p>
        <h1 className={s.headline}>{register ? 'Every record begins with one companion.' : 'The grove kept your place.'}</h1>
        <p className={s.lede}>
          {register
            ? 'Pick the creature that walks beside you from Mirevale onward. You can meet the other two in the wild.'
            : 'Log in to return to the world exactly where you left it — party, badges and all.'}
        </p>
      </aside>
      <main className={register ? s.cardWide : s.card}>
        <h2 className={s.title}>{register ? 'Create your trainer' : 'Log in'}</h2>
        <Form method="post" className={s.form} noValidate>
          {register && <StarterPicker value={starter} onChange={setStarter} error={errors.starter} />}
          {register && <input type="hidden" name="starter" value={starter ?? ''} />}
          {register && (
            <fieldset className={s.challenge}>
              <legend className={s.legend}>Challenge run</legend>
              <Segmented<'normal' | ChallengeMode>
                label="Challenge run"
                value={challenge}
                options={[{ value: 'normal', label: 'Normal' }, ...CHALLENGE_MODES.map((m) => ({ value: m, label: CHALLENGE_LABELS[m].name }))]}
                onChange={setChallenge}
              />
              <p className={s.challengeRules}>{challenge === 'normal' ? 'No extra rules. You can start a run later, until your first badge.' : CHALLENGE_LABELS[challenge].rules}</p>
              <input type="hidden" name="challenge" value={challenge === 'normal' ? '' : challenge} />
            </fieldset>
          )}
          <div className={register ? s.fieldGrid : s.fields}>
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus={!register}
              required
              maxLength={20}
              error={errors.username ?? null}
              icon="party"
            />
            {register && <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} error={errors.email ?? null} />}
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              maxLength={128}
              error={errors.password ?? null}
              icon="lock"
            />
          </div>
          {!register && (
            <Link to="/forgot" className={s.forgot}>
              Forgot your password?
            </Link>
          )}
          {result?.formError !== undefined && <FormError>{result.formError}</FormError>}
          <Button type="submit" variant="primary" size="lg" busy={submitting} className={s.submit}>
            {register ? 'Create trainer and play' : 'Log in'}
          </Button>
        </Form>
        <p className={s.switch}>
          {register ? 'Already a trainer?' : 'New here?'}{' '}
          <Link to={switchTo} className={s.switchLink}>
            {register ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </main>
      <NotificationHost />
    </div>
  );
}
