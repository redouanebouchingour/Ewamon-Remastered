/**
 * Majin / Tenjin (`.design/majin-tenjin.md` §6.3): the band card — the same black-slab card as Prof. Wynn's opening
 * steps (it reuses `TutorialCard.module.css`), headed by the band's name and its sigil. It runs once the band is in
 * the inventory (Majin first when both are held) until its 3 steps are done or the player skips it; state per account
 * in `state/bandTutorial.ts`, separate from the opening tutorial. Steps tick on events watched here:
 *  - openedParty: the location reached /play/party
 *  - formOnField: a battle with a creature of the band's form kind on the player's field (`ui.battle.authoritative`)
 *  - transformed: the player's side transformed a creature of that kind (`sides[seat].transformed` + its form); this
 *    completes the card, so an account that has already transformed is done on sight
 * Like the opening card it never blocks play: it hides while a battle, a dialogue or a /play/* panel is up (the
 * tracker keeps running) and takes no keys.
 */
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import type { BandKind } from '@ewa/core';
import { BAND_NAME, BAND_STEPS, bandAccountOf, bandsHeld, currentBandStep, fieldKinds, transformedKind, useBandTutorialStore } from '../state/bandTutorial';
import type { BandStep } from '../state/bandTutorial';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import type { Keybinds } from '../state/settings';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { FormSigil } from '../ui/FormSigil';
import { keyGlyph } from './TutorialCard';
import s from './TutorialCard.module.css';

const NO_ITEMS: Readonly<Record<string, number>> = {};

function stepKeys(step: BandStep, binds: Keybinds): { readonly glyph: string; readonly label: string }[] {
  return step.keys.map((k) => ({ glyph: k.glyph ?? (k.action !== undefined ? keyGlyph(binds[k.action][0]) : '?'), label: k.label }));
}

/** Latches the steps' events (see the file header) for every band the account holds. */
function useBandTracker(accountId: string | null, held: readonly BandKind[]): void {
  const note = useBandTutorialStore((st) => st.note);
  const location = useLocation();
  const battle = useUiStore((st) => st.battle);

  useEffect(() => {
    if (accountId === null || !location.pathname.startsWith('/play/party')) return;
    for (const k of held) note(accountId, k, 'openedParty');
  }, [accountId, held, location.pathname, note]);

  useEffect(() => {
    if (accountId === null || battle === null || held.length === 0) return;
    const st = battle.authoritative;
    for (const k of fieldKinds(st, battle.seat)) if (held.includes(k)) note(accountId, k, 'formOnField');
    const t = transformedKind(st, battle.seat);
    if (t !== null && held.includes(t)) note(accountId, t, 'transformed');
  }, [accountId, held, battle, note]);
}

export function BandTutorialCard() {
  const location = useLocation();
  const accountId = useSessionStore((st) => st.profile?.id ?? null);
  const items = useSessionStore(useShallow((st) => st.inventory?.items ?? NO_ITEMS));
  const held = useMemo(() => bandsHeld(items), [items]);
  const account = useBandTutorialStore((st) => bandAccountOf(st, accountId));
  const finish = useBandTutorialStore((st) => st.finish);
  const binds = useSettingsStore((st) => st.keybinds);
  const covered = useUiStore((st) => st.battle !== null || st.dialogue !== null || !st.hudVisible);
  useBandTracker(accountId, held);

  const kind = held.find((k) => !account[k].done) ?? null;
  const step = kind === null ? null : currentBandStep(kind, account[kind].seen);
  const hasPanel = location.pathname !== '/play' && location.pathname !== '/play/';
  if (accountId === null || kind === null || step === null || covered || hasPanel) return null;
  const steps = BAND_STEPS[kind];
  const index = steps.indexOf(step);
  return (
    <aside className={s.card} aria-label={`${BAND_NAME[kind]} tutorial`} data-band={kind} data-step={step.id}>
      <p className={s.eyebrow}>
        <span>{BAND_NAME[kind]}</span>
        <span className={s.count}>
          {index + 1} of {steps.length}
        </span>
      </p>
      <div className={s.body}>
        <div aria-live="polite">
          <h2 className={s.title}>
            <FormSigil kind={kind} size="md" /> {step.title}
          </h2>
          <p className={s.line}>{step.line}</p>
        </div>
        {step.keys.length > 0 && (
          <ul className={s.keys}>
            {stepKeys(step, binds).map((k) => (
              <li key={k.label} className={s.keyRow}>
                <span className={s.glyphs}>
                  <kbd>{k.glyph}</kbd>
                </span>
                <span>{k.label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={s.actions}>
          <Button size="sm" variant="ghost" onClick={() => finish(accountId, kind)}>
            Skip
          </Button>
        </div>
      </div>
    </aside>
  );
}
