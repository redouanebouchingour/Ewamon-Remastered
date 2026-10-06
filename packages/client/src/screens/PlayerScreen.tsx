/**
 * Phase C4 `/play/players/:username` — another trainer's public card (GET /players/:username, the §5.3 allow-list:
 * identity, rating / tier, trainer level, badges, dex count, guild tag, the first three party slots). A 404 (unknown or
 * banned) or a malformed name renders "No trainer by that name" inside the panel. Back returns to wherever the link was.
 */
import { useLoaderData, useNavigate } from 'react-router';
import type { playerLoader } from '../app/loaders';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import l from './layout.module.css';
import { useClosePanel } from './shared';
import { BadgeStrip, Showcase, TrainerIdentity, TrainerStats } from './TrainerCard';

export function PlayerScreen() {
  const close = useClosePanel();
  const navigate = useNavigate();
  const { username, pub } = useLoaderData<typeof playerLoader>();
  const myId = useSessionStore((st) => st.profile?.id ?? null);
  // a direct load has nothing to go back to inside the app: Rankings instead
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const back = (
    <Button variant="ghost" icon="chevronLeft" onClick={() => void (canGoBack ? navigate(-1) : navigate('/play/rankings'))}>
      Back
    </Button>
  );

  if (pub === null) {
    return (
      <Panel title="Trainer" eyebrow="Public profile" onClose={close} actions={back}>
        <EmptyState icon="user" title="No trainer by that name" hint={`Nobody plays as “${username}” — check the spelling, or they may have left.`} action={<Button onClick={() => void navigate('/play/rankings')}>Open rankings</Button>} />
      </Panel>
    );
  }

  return (
    <Panel title={pub.username} eyebrow="Public profile" onClose={close} actions={back}>
      <div className={l.stackLg}>
        <TrainerIdentity username={pub.username} title={pub.title} motto={pub.motto} body={pub.body} guildTag={pub.guildTag} tier={pub.tier} you={pub.id === myId} />
        <section className={l.section} aria-label="Stats">
          <h3 className={l.sectionTitle}>Stats</h3>
          <TrainerStats pub={pub} />
        </section>
        <section className={l.section} aria-label="Badges">
          <h3 className={l.sectionTitle}>Badges</h3>
          <BadgeStrip earned={pub.badges} />
        </section>
        <section className={l.section} aria-label="Showcase">
          <h3 className={l.sectionTitle}>Showcase</h3>
          <Showcase pub={pub} />
        </section>
      </div>
    </Panel>
  );
}
