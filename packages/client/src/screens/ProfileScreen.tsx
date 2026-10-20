/**
 * Phase C4 `/play/profile` — the player's own trainer card. The identity (title ∈ content `TITLES`, body ∈ `BODIES`,
 * a free motto ≤ 120) is edited in place and saved with `POST /profile` through `profileAction.save` (the server
 * re-validates every field; the response lands through the session's `applyProfile`). The stats, badges and showcase
 * are the player's own public profile (GET /players/:me) — what other trainers see. Achievements (Phase D5): the
 * `QuestDef kind: 'achievement'` rows — earned first, then ready, then by progress; claiming happens in the journal.
 */
import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { profileLoader } from '../app/loaders';
import { achievementProgress, achievementQuests, questStatus } from '../data/quests';
import { BODY_CHOICES, TITLES } from '../data/trainer';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Select, TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './ProfileScreen.module.css';
import { useClosePanel, useIntent } from './shared';
import { BadgeStrip, Showcase, TrainerIdentity, TrainerStats } from './TrainerCard';
import { ChallengeSection } from './ChallengeSection';
import { SpeedrunSection } from './SpeedrunSection';

export const MOTTO_MAX = 120;

function Achievements() {
  const quests = useSessionStore((st) => st.progression?.quests ?? null);
  const claimed = useSessionStore((st) => st.progression?.questsClaimed ?? null);
  const p = quests === null || claimed === null ? null : { quests, questsClaimed: claimed };
  const rank = { claimed: 0, ready: 1, active: 2, locked: 3 } as const;
  const list = achievementQuests()
    .map((q) => ({ q, status: questStatus(q, p), prog: achievementProgress(q, p) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.prog.value / b.prog.target - a.prog.value / a.prog.target);
  if (list.length === 0) return <EmptyState icon="trophy" title="No achievements yet" hint="Achievements arrive with a later update." />;
  const earnedCount = list.filter((r) => r.status === 'claimed').length;
  return (
    <div className={l.stack}>
      <p className={l.caption}>
        {earnedCount} of {list.length} earned
      </p>
      <ul className={s.achievements}>
        {list.map(({ q, status, prog }) => {
          const earned = status === 'claimed';
          const figure = `${prog.value} of ${prog.target}`;
          return (
            <li key={q.id} className={cx(s.achievement, earned && s.earned)} aria-label={`${q.title}, ${earned ? 'earned' : status === 'ready' ? 'ready to claim' : figure}`}>
              <span className={s.achievementMark} aria-hidden>
                <Icon name={earned ? 'check' : status === 'locked' ? 'lock' : 'trophy'} size="sm" />
              </span>
              <span className={s.achievementText}>
                <span className={s.achievementTitle}>{q.title}</span>
                <span className={l.caption}>{q.summary}</span>
                {!earned && <ProgressBar size="sm" value={prog.target === 0 ? 0 : prog.value / prog.target} label={`${q.title} progress`} valueText={figure} />}
              </span>
              {earned ? <Pill tone="neutral">Earned</Pill> : status === 'ready' ? <Pill tone="info">Claim in Quests</Pill> : <span className={l.mono}>{prog.value} / {prog.target}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProfileScreen() {
  const close = useClosePanel();
  const { pub } = useLoaderData<typeof profileLoader>();
  const profile = useSessionStore((st) => st.profile);
  const badges = useSessionStore((st) => st.progression?.badges ?? pub?.badges ?? []);
  const fetcher = useIntent('/play/profile');
  const [title, setTitle] = useState(profile?.title ?? TITLES[0]!);
  const [body, setBody] = useState(profile?.body ?? BODY_CHOICES[0]!.id);
  const [motto, setMotto] = useState(profile?.motto ?? '');
  // a saved profile (or a re-hydrate) resets the draft to what the server holds
  useEffect(() => {
    if (profile === null) return;
    setTitle(profile.title);
    setBody(profile.body);
    setMotto(profile.motto);
  }, [profile?.title, profile?.body, profile?.motto]);

  if (profile === null) return null;
  const dirty = title !== profile.title || body !== profile.body || motto.trim() !== profile.motto;
  const titles = TITLES.includes(profile.title) ? TITLES : [profile.title, ...TITLES];

  return (
    <Panel
      title="Profile"
      eyebrow="Your trainer card"
      onClose={close}
      actions={
        <Link to={`/play/players/${profile.username}`} className={s.publicLink}>
          <Icon name="eye" size="sm" /> View as others see it
        </Link>
      }
    >
      <div className={l.stackLg}>
        <div className={s.top}>
          <section className={s.card} aria-label="Identity">
            <TrainerIdentity username={profile.username} title={title} motto={motto.trim()} body={body} guildTag={pub?.guildTag ?? null} tier={pub?.tier ?? 'bronze'} />
            <form
              className={s.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (dirty) fetcher.submit({ intent: 'save', title, body, motto: motto.trim() });
              }}
            >
              <div className={s.formRow}>
                <Select label="Title" value={title} options={titles.map((t) => ({ value: t, label: t }))} onChange={setTitle} />
                <Select label="Look" value={body} options={BODY_CHOICES.map((b) => ({ value: b.id, label: b.label }))} onChange={setBody} />
              </div>
              <TextField label="Motto" value={motto} onChange={setMotto} maxLength={MOTTO_MAX} counterFrom={90} placeholder="A line other trainers see on your card" />
              <div className={s.formFoot}>
                <span className={l.caption}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
                <span className={l.row}>
                  {dirty && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setTitle(profile.title);
                        setBody(profile.body);
                        setMotto(profile.motto);
                      }}
                    >
                      Reset
                    </Button>
                  )}
                  <Button type="submit" variant="primary" disabled={!dirty} busy={fetcher.busy((x) => x.intent === 'save')}>
                    Save profile
                  </Button>
                </span>
              </div>
            </form>
          </section>
          <section className={l.section} aria-label="Stats">
            <h3 className={l.sectionTitle}>Stats</h3>
            {pub === null ? <EmptyState icon="info" title="Stats did not load" hint="Close and reopen the panel to try again." /> : <TrainerStats pub={pub} compact />}
          </section>
        </div>
        <section className={l.section} aria-label="Badges">
          <h3 className={l.sectionTitle}>Badges</h3>
          <BadgeStrip earned={badges} />
        </section>
        {pub !== null && (
          <section className={l.section} aria-label="Showcase">
            <h3 className={l.sectionTitle}>Showcase</h3>
            <Showcase pub={pub} />
          </section>
        )}
        <ChallengeSection />
        <SpeedrunSection />
        <section className={l.section} aria-label="Achievements">
          <h3 className={l.sectionTitle}>Achievements</h3>
          <Achievements />
        </section>
      </div>
    </Panel>
  );
}
