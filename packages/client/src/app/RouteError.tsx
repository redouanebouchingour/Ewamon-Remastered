/**
 * §20.9.13 route error: title from `isRouteErrorResponse(err) ? err.status : 'Something broke'`, a detail line,
 * Retry (`useRevalidator().revalidate()`) and Back to world. Rendered by each /play child's errorElement inside
 * the panel slot, so the canvas and the top bar stay.
 */
import { isRouteErrorResponse, useNavigate, useRevalidator, useRouteError } from 'react-router';
import { ApiFailure } from '../net/apiError';
import { describeError } from '../net/errors';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import s from './RouteError.module.css';

export function errorCopy(err: unknown): { readonly title: string; readonly detail: string } {
  if (isRouteErrorResponse(err)) return { title: String(err.status), detail: err.statusText || 'The page could not be loaded.' };
  if (err instanceof ApiFailure) {
    return { title: err.error.status === 0 ? 'Server unreachable' : `Error ${err.error.status}`, detail: describeError(err) };
  }
  return { title: 'Something broke', detail: err instanceof Error ? err.message : 'An unexpected error happened.' };
}

export function RouteError() {
  const err = useRouteError();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { title, detail } = errorCopy(err);
  return (
    <div className={s.slot}>
      <Panel title={title} eyebrow="Could not load" onClose={() => void navigate('/play')}>
        <EmptyState
          icon="warn"
          tone="error"
          title="This panel failed to load"
          hint={detail}
          action={
            <>
              <Button variant="primary" icon="refresh" busy={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
                Retry
              </Button>
              <Button variant="ghost" onClick={() => void navigate('/play')}>
                Back to world
              </Button>
            </>
          }
        />
      </Panel>
    </div>
  );
}
