/**
 * Challenge modes on the Profile screen (content challenge.ts): the run (Normal, Nuzlocke, Hardcore) with its rules and
 * where it stands, and the switch (`POST /challenge`, then GET /me refreshes the session) while there is no badge and
 * nothing has fallen; after that the run is locked and the card says why.
 */
import { useState } from 'react';
import { CHALLENGE_LABELS, CHALLENGE_MODES, FALLEN_MEMORIAL_RIBBON, FALLEN_RIBBON, challengeOf } from '@ewa/content';
import type { ChallengeMode } from '@ewa/content';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { Segmented } from '../ui/Field';
import l from './layout.module.css';

const NO_FLAGS: readonly string[] = [];
type Choice = 'normal' | ChallengeMode;
const OPTIONS: readonly { readonly value: Choice; readonly label: string }[] = [
  { value: 'normal', label: 'Normal' },
  ...CHALLENGE_MODES.map((m) => ({ value: m, label: CHALLENGE_LABELS[m].name })),
];
const STATE_LABEL = { active: 'Run in progress', cleared: 'Cleared: the Champion fell to this run', failed: 'Failed: nothing was left standing' } as const;

/** Why the run can no longer change, or null while it can. */
export function challengeLock(badges: number, anyFallen: boolean): string | null {
  if (badges > 0) return 'Your first badge locked the run.';
  if (anyFallen) return 'A creature has fallen: the run is locked.';
  return null;
}

export function ChallengeSection() {
  const flags = useSessionStore((st) => st.progression?.flags ?? NO_FLAGS);
  const badges = useSessionStore((st) => st.progression?.badges.length ?? 0);
  const anyFallen = useSessionStore((st) => [...(st.inventory?.party ?? []), ...(st.inventory?.box ?? [])].some((c) => c.ribbons.includes(FALLEN_RIBBON) || c.ribbons.includes(FALLEN_MEMORIAL_RIBBON)));
  const [busy, setBusy] = useState(false);
  const run = challengeOf(flags);
  const current: Choice = run?.mode ?? 'normal';
  const lock = challengeLock(badges, anyFallen);

  const change = async (mode: Choice): Promise<void> => {
    if (mode === current || lock !== null || busy) return;
    setBusy(true);
    try {
      await apiFetch('challenge', { body: { mode } });
      useSessionStore.getState().hydrateFromMe(await apiFetch('me'));
      toast('info', mode === 'normal' ? 'Back to a normal game.' : `${CHALLENGE_LABELS[mode].name} run started.`);
    } catch (e) {
      toast('warn', describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={l.section} aria-label="Challenge run" data-testid="challenge-section">
      <h4 className={l.sectionTitle}>Challenge run</h4>
      {lock === null ? (
        <Segmented<Choice> label="Challenge run" value={current} options={OPTIONS} onChange={(m) => void change(m)} />
      ) : (
        <p className={l.body}>
          <b>{run === null ? 'Normal' : CHALLENGE_LABELS[run.mode].name}</b>
          {run !== null && <> · {STATE_LABEL[run.state]}</>}
        </p>
      )}
      <p className={l.caption}>{current === 'normal' ? 'No extra rules. A Nuzlocke or Hardcore run can start until your first badge.' : CHALLENGE_LABELS[current].rules}</p>
      {lock !== null && <p className={l.caption}>{lock}</p>}
    </section>
  );
}
