/**
 * `/play`'s errorElement (SPEC §20.1.1). It replaces PanelHost only — CanvasHost (the pathless parent) keeps the
 * canvas mounted underneath. Offers Retry (re-runs the /play loader) and Log out.
 */
import { useNavigate, useRevalidator, useRouteError } from 'react-router';
import { endSession } from '../net/sessionEnd';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import s from './PlayError.module.css';
import { errorCopy } from './RouteError';

export function PlayError() {
  const err = useRouteError();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { title, detail } = errorCopy(err);
  return (
    <div className={s.wrap} data-testid="playerror">
      <div className={s.card} role="alert">
        <span className={s.icon} aria-hidden>
          <Icon name="warn" size="lg" />
        </span>
        <p className={s.eyebrow}>Could not enter the world</p>
        <h1 className={s.title}>{title}</h1>
        <p className={s.detail}>{detail}</p>
        <div className={s.actions}>
          <Button variant="primary" size="lg" icon="refresh" busy={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
            Retry
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              endSession();
              void navigate('/login', { replace: true });
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
