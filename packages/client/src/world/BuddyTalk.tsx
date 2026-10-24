/**
 * Talk to your own Ewamon (LLM feature 6): the conversation with a party creature, in the DialogueBox's lower-third
 * (the same orange speaker strip over a black slab, the log, the typed field and the paper key chips), with the
 * creature's real sprite and its type icons beside its name, its level and a shiny / alpha mark. Opened by the
 * `buddyTalk` key (Y) near the follower or the party card's Talk; the creature greets the player first. Enter sends a
 * typed line, Escape (or Close) ends the talk. Words only: nothing said here changes the save.
 *
 * Voice talk (2026-10-24, LLM feature 10): with "Speak to NPCs" on, the mic button (`MicButton`) beside Close; held, the
 * live words fill the field and go on release. The creature's spoken lines are voice/bindVoices.ts's.
 */
import { useEffect, useRef, useState } from 'react';
import type { TypeName, VariantKey } from '@ewa/core';
import { closeBuddyTalk, sayToBuddy, useBuddyTalkStore } from '../state/buddy';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { noDashes } from '../talk/llm';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Icon } from '../ui/Icon';
import { TypeBadge } from '../ui/TypeBadge';
import { MicButton } from './MicButton';
import d from './DialogueBox.module.css';
import s from './BuddyTalk.module.css';

export function BuddyTalk() {
  const creatureId = useBuddyTalkStore((st) => st.creatureId);
  const profile = useBuddyTalkStore((st) => st.profile);
  const turns = useBuddyTalkStore((st) => st.turns);
  const phase = useBuddyTalkStore((st) => st.phase);
  const creature = useSessionStore((st) => st.inventory?.party.find((c) => c.id === creatureId) ?? null);
  const blocked = useUiStore((st) => st.battle !== null || st.dialogue !== null || st.evolution !== null);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const open = creatureId !== null && profile !== null;

  // a battle, a dialogue or an evolution takes the screen: the talk ends; so does the creature leaving the party
  useEffect(() => {
    if (open && (blocked || creature === null)) closeBuddyTalk();
  }, [open, blocked, creature]);
  useEffect(() => {
    setDraft('');
  }, [creatureId]);
  useEffect(() => {
    const el = logRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [turns, phase]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeBuddyTalk();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open || creature === null) return null;
  const thinking = phase === 'thinking';
  return (
    <div className={d.box} role="dialog" aria-label={`Talking with ${profile.name}`} data-testid="buddy-talk">
      <div className={d.head}>
        <p className={d.speaker}>{profile.name}</p>
        <span className={s.tag} data-testid="buddy-level">
          Lv {creature.level}
        </span>
      </div>
      <div className={`${d.slab} ${s.slab}`}>
        <figure className={s.portrait} aria-hidden="true">
          <CreatureSprite speciesId={creature.speciesId} variantKey={creature.variantKey as VariantKey} size="lg" className={s.sprite} />
          <span className={s.types}>
            {profile.types.map((t) => (
              <TypeBadge key={t} type={t as TypeName} size="sm" compact />
            ))}
          </span>
          {(creature.isShiny === true || creature.isAlpha) && (
            <span className={s.marks}>
              {creature.isShiny === true && <Icon name="sparkle" size="sm" />}
              {creature.isAlpha && <Icon name="alpha" size="sm" />}
            </span>
          )}
        </figure>
        <div className={s.body}>
          <div ref={logRef} className={d.log} aria-live="polite">
            {turns.map((t, i) =>
              t.role === 'trainer' ? (
                <p key={i} className={d.heard}>
                  <span className={d.you}>You</span> {noDashes(t.text)}
                </p>
              ) : (
                <p key={i} className={d.line} data-testid="buddy-line">
                  {noDashes(t.text)}
                </p>
              ),
            )}
          </div>
          {thinking ? (
            <p className={d.status} data-testid="buddy-thinking">
              {`${profile.voice.sounds[0]}…`}
            </p>
          ) : null}
          <form
            className={d.typed}
            onSubmit={(e) => {
              e.preventDefault();
              if (sayToBuddy(draft)) setDraft('');
            }}
          >
            <input
              className={d.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Say something to ${profile.name}…`}
              aria-label={`Type to ${profile.name}`}
              autoFocus
              maxLength={200}
            />
            <kbd className={d.key}>Enter</kbd>
          </form>
          <div className={d.actions}>
            <MicButton
              to={profile.name}
              target={{
                onLive: (t) => setDraft(t),
                onSend: (t) => {
                  if (sayToBuddy(t)) setDraft('');
                },
              }}
            />
            <button type="button" className={d.more} onClick={closeBuddyTalk} aria-label="Close, Escape">
              <span>Close</span>
              <kbd className={d.key}>Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
