/**
 * The state for a screen whose server routes are not live yet (the REST 404 of a route the server has not
 * registered — social, guilds, marketplace, admin stats/players are server part 2). A proper panel, never a crash.
 */
import { useRevalidator } from 'react-router';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import type { IconName } from '../ui/Icon';

export interface UnavailableProps {
  readonly icon: IconName;
  readonly feature: string;
  readonly hint: string;
}

export function Unavailable({ icon, feature, hint }: UnavailableProps) {
  const revalidator = useRevalidator();
  return (
    <EmptyState
      icon={icon}
      tone="unavailable"
      title={`${feature} — not live yet`}
      hint={hint}
      action={
        <Button icon="refresh" busy={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
          Check again
        </Button>
      }
    />
  );
}
