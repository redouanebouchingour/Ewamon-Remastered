/**
 * Phase D12 — Prof. Wynn's step card over the live world (left edge, under the party strip). Never modal, never
 * blocks play: it hides while a battle, a dialogue or a /play/* panel is up and takes no keys. "Skip tutorial" ends it
 * for this account for good (state/tutorial.ts). Steps advance on real events, watched here:
 *  - moved:       the player's authoritative PlayerState walked TUTORIAL_MOVE_M (WorldSession state patches)
 *  - metWynn:     `met_wynn` in the session flags (the first_witness beat)
 *  - openedParty: the location reached /play/party
 *  - wildBattle:  `ui.battle.format === 'wild'`
 *  - caught / won: the battle result (`caught`, or the player's side won)
 *  - healed:      `noteTutorialEvent('healed')` from the two heal paths (party screen, healer NPC)
 * Under reduced motion the card appears without its slide.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { getWorldSession } from '../net/WorldSession';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import type { Keybinds } from '../state/settings';
import { MoveMeter, TUTORIAL_MOVE_M, TUTORIAL_STEPS, accountOf, currentStep, derivedEvents, pastOpening, useTutorialStore } from '../state/tutorial';
import type { TutorialStep } from '../state/tutorial';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import s from './TutorialCard.module.css';

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** A KeyboardEvent.code as a short glyph: KeyW → W, Digit1 → 1, ShiftLeft → Shift. */
export function keyGlyph(code: string | undefined): string {
  if (code === undefined) return '?';
  return NAMED_KEYS[code] ?? code.replace(/^Key|^Digit|^Numpad/, '');
}

function stepKeys(step: TutorialStep, binds: Keybinds): { readonly glyphs: readonly string[]; readonly label: string }[] {
  return step.keys.map((k) => ({ glyphs: k.actions.map((a) => keyGlyph(binds[a][0])), label: k.label }));
}

/** Latches the events of the steps (see the file header) for `accountId` while the tutorial runs. */
function useTutorialTracker(accountId: string | null, active: boolean): void {
  const note = useTutorialStore((st) => st.note);
  const location = useLocation();
  const flags = useSessionStore((st) => st.progression?.flags);
  const dexCaught = useSessionStore((st) => st.progression?.dexCaught);
  const battle = useUiStore((st) => st.battle);
  const meter = useRef(new MoveMeter());

  // flags / dex the session already holds
  useEffect(() => {
    if (!active || accountId === null || flags === undefined || dexCaught === undefined) return;
    for (const e of derivedEvents({ flags, dexCaught })) note(accountId, e);
  }, [active, accountId, flags, dexCaught, note]);

  useEffect(() => {
    if (active && accountId !== null && location.pathname.startsWith('/play/party')) note(accountId, 'openedParty');
  }, [active, accountId, location.pathname, note]);

  useEffect(() => {
    if (!active || accountId === null || battle === null) return;
    if (battle.format === 'wild') note(accountId, 'wildBattle');
    const w = battle.result?.outcome.winner;
    if (w === 'caught') note(accountId, 'caught');
    if (w === 'caught' || w === battle.seat) note(accountId, 'won');
  }, [active, accountId, battle, note]);

  // walked distance from the authoritative avatar (state patches), restarted on every room change
  useEffect(() => {
    if (!active || accountId === null) return;
    const ws = getWorldSession();
    const m = meter.current;
    const read = (): void => {
      const me = ws.room?.state?.players?.get(ws.selfId);
      if (me === undefined) return;
      if (m.feed(me.x, me.z) >= TUTORIAL_MOVE_M) note(accountId, 'moved');
    };
    const offRoom = ws.onRoom(() => m.reset());
    const offState = ws.subscribeState(read);
    read(); // the current position is the origin
    return () => {
      offRoom();
      offState();
    };
  }, [active, accountId, note]);
}

export function TutorialCard() {
  const location = useLocation();
  const accountId = useSessionStore((st) => st.profile?.id ?? null);
  const progression = useSessionStore((st) => st.progression);
  const account = useTutorialStore((st) => accountOf(st, accountId));
  const finish = useTutorialStore((st) => st.finish);
  const binds = useSettingsStore((st) => st.keybinds);
  const covered = useUiStore((st) => st.battle !== null || st.dialogue !== null || !st.hudVisible);
  const past = progression !== null && pastOpening(progression);
  const running = accountId !== null && progression !== null && !account.done && !past;
  useTutorialTracker(accountId, running);

  // an account already past the opening never sees it (and is remembered as done)
  useEffect(() => {
    if (accountId !== null && past && !account.done) finish(accountId);
  }, [accountId, past, account.done, finish]);

  // the last step done: one closing line, then nothing more
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) wasRunning.current = true;
    else if (wasRunning.current && account.done && account.seen.length >= TUTORIAL_STEPS.length) {
      wasRunning.current = false;
      toast('success', "Prof. Wynn: That's the basics. The rest you learn by walking.");
    }
  }, [running, account.done, account.seen.length]);

  const step = currentStep(account.seen);
  const hasPanel = location.pathname !== '/play' && location.pathname !== '/play/';
  if (!running || step === null || covered || hasPanel) return null;
  const index = TUTORIAL_STEPS.indexOf(step);
  return (
    <aside className={s.card} aria-label="Tutorial" data-step={step.id}>
      <p className={s.eyebrow}>
        <span>Prof. Wynn</span>
        <span className={s.count}>
          {index + 1} of {TUTORIAL_STEPS.length}
        </span>
      </p>
      <div aria-live="polite">
        <h2 className={s.title}>{step.title}</h2>
        <p className={s.line}>{step.line}</p>
      </div>
      {step.keys.length > 0 && (
        <ul className={s.keys}>
          {stepKeys(step, binds).map((k) => (
            <li key={k.label} className={s.keyRow}>
              <span className={s.glyphs}>
                {k.glyphs.map((g, i) => (
                  <kbd key={`${g}${i}`}>{g}</kbd>
                ))}
              </span>
              <span>{k.label}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={s.actions}>
        <Button size="sm" variant="ghost" onClick={() => accountId !== null && finish(accountId)}>
          Skip tutorial
        </Button>
      </div>
    </aside>
  );
}
