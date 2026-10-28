/**
 * Talking to other players: the player card (`ui.modal === 'player'`, payload `PlayerCardPayload`), opened by E beside
 * another trainer the way an NPC opens its lines. Who they are (GET /players/:username), how the two stand
 * (GET /social/relation/:username) and what can be done right here:
 *
 * - a quick message (POST /messages/:username) when they take one from the player, and the full conversation;
 * - Challenge and Trade (the room's walk-up handshakes), Watch while they battle (the spectator ring);
 * - add / accept a friend, wave, the public profile, block / unblock (a block stops DMs, friend requests,
 *   challenges, trades and world chat between the two, both ways).
 *
 * Live facts (in battle, their battle, how far it is) come from the room state; the card closes itself when they leave.
 * Their trainer banner (`PublicProfile.banner`) stands beside the card once the profile has loaded.
 */
import { useEffect, useState } from 'react';
import { SPECTATE_RANGE_M } from '@ewa/protocol';
import type { PublicProfile, Relation } from '@ewa/protocol';
import { navigateTo } from '../app/navigation';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { getWorldSession } from '../net/WorldSession';
import { useRoomState } from '../net/useRoomState';
import { TrainerAvatar } from '../screens/TrainerCard';
import { TrainerBanner, bannerModelOf } from '../screens/TrainerBanner';
import { cx } from '../ui/cx';
import { tierLabel } from '../data/trainer';
import { toast } from '../state/notifications';
import { partyCanBattle, useSessionStore } from '../state/session';
import { isPlayerCardPayload, useUiStore } from '../state/ui';
import { useWatchStore } from '../state/watch';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/Pill';
import { Skeleton } from '../ui/Skeleton';
import s from './PlayerCard.module.css';

// a type alias, not an interface: useRoomState takes a record of primitives
type Live = {
  readonly here: boolean;
  readonly body: string;
  readonly guildTag: string;
  readonly inBattle: boolean;
  /** the battle they fight in ('' none) */
  readonly battleId: string;
  /** whether the player stands close enough to that battle to watch it */
  readonly watchable: boolean;
};

/** `PlayerState.emote` 1: the wave (1..6 are the original emotes) */
const WAVE = 1;

const GONE: Live = { here: false, body: '', guildTag: '', inBattle: false, battleId: '', watchable: false };

function useLive(id: string): Live {
  return useRoomState((state, me): Live => {
    const p = state.players.get(id);
    if (p === undefined) return GONE;
    const self = state.players.get(me);
    let battleId = '';
    let watchable = false;
    state.battles.forEach((b) => {
      if (battleId !== '' || ![...b.participants].includes(id)) return;
      battleId = b.id;
      watchable = self !== undefined && Math.hypot(b.x - self.x, b.z - self.z) <= SPECTATE_RANGE_M;
    });
    return { here: true, body: p.body, guildTag: p.guildTag, inBattle: p.inBattle, battleId, watchable };
  }, GONE);
}

function send(kind: 'challenge' | 'tradeRequest', targetId: string): boolean {
  try {
    getWorldSession().send(kind, { targetId });
    return true;
  } catch (e) {
    toast('danger', e instanceof Error ? e.message : 'Could not send.');
    return false;
  }
}

export function PlayerCard() {
  const payload = useUiStore((st) => (st.modal === 'player' && isPlayerCardPayload(st.modalPayload) ? st.modalPayload : null));
  const inBattle = useUiStore((st) => st.battle !== null);
  if (payload === null || inBattle) return null;
  return <PlayerCardBody key={payload.id} id={payload.id} name={payload.name} />;
}

function PlayerCardBody({ id, name }: { readonly id: string; readonly name: string }) {
  const close = (): void => useUiStore.getState().closeModal();
  const username = name.toLowerCase();
  const live = useLive(id);
  const canBattle = useSessionStore((st) => partyCanBattle(st.inventory));
  const [pub, setPub] = useState<PublicProfile | null>(null);
  const [rel, setRel] = useState<Relation | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([apiFetch('playerPublic', { params: { username } }), apiFetch('socialRelation', { params: { username } })])
      .then(([p, r]) => {
        if (!live) return;
        setPub(p);
        setRel(r);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [username]);

  // they walked out of view or left the zone: the card goes with them
  useEffect(() => {
    if (!live.here) {
      toast('info', `${name} is no longer nearby.`);
      close();
    }
  }, [live.here, name]);

  const run = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast('warn', describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const refreshRelation = async (): Promise<void> => {
    setRel(await apiFetch('socialRelation', { params: { username } }));
  };

  const sendMessage = (): void => {
    const text = draft.trim();
    if (text.length === 0 || text.length > 300) return;
    void run('message', async () => {
      await apiFetch('messagesSend', { params: { username }, body: { text } });
      setDraft('');
      toast('success', `Message sent to ${name}.`);
    });
  };

  const friendAction = (): void => {
    if (rel === null) return;
    void run('friend', async () => {
      if (rel.friend === 'incoming') {
        await apiFetch('friendsAccept', { body: { username } });
        toast('success', `You and ${name} are friends now.`);
      } else {
        await apiFetch('friendsRequest', { body: { username } });
        toast('info', `Friend request sent to ${name}.`);
      }
      await refreshRelation();
    });
  };

  const toggleBlock = (): void => {
    if (rel === null) return;
    if (!rel.blocked && !confirmBlock) {
      setConfirmBlock(true);
      return;
    }
    void run('block', async () => {
      await apiFetch(rel.blocked ? 'socialUnblock' : 'socialBlock', { body: { username } });
      toast('info', rel.blocked ? `${name} is unblocked.` : `${name} is blocked. You will not hear from them.`);
      setConfirmBlock(false);
      await refreshRelation();
    });
  };

  // trainer banners: their banner beside the card once the profile has loaded (the avatar head stays while it loads)
  const banner = pub?.banner !== undefined ? bannerModelOf(pub) : null;
  const blocked = rel?.blocked === true;
  const friendLabel = rel === null ? 'Add friend' : rel.friend === 'friends' ? 'Friends' : rel.friend === 'outgoing' ? 'Request sent' : rel.friend === 'incoming' ? 'Accept friend' : 'Add friend';
  const friendDisabled = rel === null || blocked || rel.friend === 'friends' || rel.friend === 'outgoing';

  return (
    <Modal open size={banner !== null ? 'md' : 'sm'} title={name} onClose={close} description="Another trainer">
      <div className={cx(s.layout, banner !== null && s.withBanner)}>
        {banner !== null && <TrainerBanner model={banner} className={s.banner} />}
        <div className={s.card} data-testid="playercard">
          <header className={s.head}>
            <TrainerAvatar username={name} {...(live.body !== '' ? { body: live.body } : {})} size="lg" />
            <div className={s.who}>
              {pub === null && !failed ? <Skeleton shape="block" count={1} className={s.titleSkeleton} label="Loading the trainer" /> : <p className={s.title}>{pub?.title ?? 'Trainer'}</p>}
              <p className={s.name}>
                {name}
                {live.guildTag !== '' && <span className={s.guild}>[{live.guildTag}]</span>}
              </p>
              <div className={s.chips}>
                {pub !== null && <Pill tone="neutral">{tierLabel(pub.tier)}</Pill>}
                {pub !== null && <Pill>Lv {pub.trainerLevel}</Pill>}
                {pub !== null && <Pill>{pub.badges.length} badges</Pill>}
                {rel?.friend === 'friends' && <Pill tone="info">Friend</Pill>}
                {live.inBattle && <Pill tone="warn">In a battle</Pill>}
                {blocked && <Pill tone="danger">Blocked</Pill>}
              </div>
              {pub !== null && pub.motto.length > 0 && <p className={s.motto}>“{pub.motto}”</p>}
            </div>
          </header>

          <section className={s.message} aria-label="Message">
            {rel === null ? (
              <Skeleton shape="block" count={1} className={s.composerSkeleton} label="Loading" />
            ) : rel.canMessage ? (
              <form
                className={s.composer}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <TextField label={`Message ${name}`} hideLabel placeholder={`Say something to ${name}`} value={draft} onChange={setDraft} maxLength={300} counterFrom={250} className={s.grow} autoFocus />
                <Button type="submit" icon="send" busy={busy === 'message'} disabled={draft.trim().length === 0}>
                  Send
                </Button>
              </form>
            ) : (
              <p className={s.caption}>{blocked ? 'You blocked this trainer.' : `${name} only takes messages from friends.`}</p>
            )}
          </section>

          <div className={s.actions}>
            <Button
              icon="sword"
              variant="primary"
              disabled={live.inBattle || blocked || !canBattle}
              title={!canBattle ? 'Your party needs healing first' : live.inBattle ? 'They are in a battle' : undefined}
              onClick={() => {
                if (send('challenge', id)) close();
              }}
            >
              Challenge
            </Button>
            <Button
              icon="trade"
              disabled={live.inBattle || blocked}
              onClick={() => {
                if (send('tradeRequest', id)) {
                  toast('info', `Trade request sent to ${name}.`);
                  close();
                }
              }}
            >
              Trade
            </Button>
            {live.inBattle && (
              <Button
                icon="eye"
                disabled={!live.watchable}
                title={live.watchable ? undefined : 'Walk closer to the battle'}
                onClick={() => {
                  useWatchStore.getState().start(live.battleId);
                  close();
                }}
              >
                Watch battle
              </Button>
            )}
            <Button icon={rel?.friend === 'friends' ? 'check' : 'plus'} disabled={friendDisabled} busy={busy === 'friend'} onClick={friendAction}>
              {friendLabel}
            </Button>
            <Button
              icon="heart"
              variant="ghost"
              onClick={() => {
                try {
                  getWorldSession().send('emote', { emote: WAVE });
                } catch (_e) {
                  // no room: nothing to wave in
                }
              }}
            >
              Wave
            </Button>
            <Button icon="user" variant="ghost" onClick={() => { close(); navigateTo(`/play/players/${encodeURIComponent(username)}`); }}>
              Profile
            </Button>
            <Button icon="social" variant="ghost" disabled={rel === null || (!rel.canMessage && rel.friend !== 'friends')} onClick={() => { close(); navigateTo(`/play/social/${encodeURIComponent(username)}`); }}>
              Conversation
            </Button>
            <Button icon="shield" variant="ghost" busy={busy === 'block'} disabled={rel === null} onClick={toggleBlock} className={confirmBlock ? s.confirm : undefined}>
              {blocked ? 'Unblock' : confirmBlock ? 'Confirm block' : 'Block'}
            </Button>
          </div>
          {confirmBlock && <p className={s.caption}>Blocking stops messages, friend requests, challenges, trades and chat between you. It ends a friendship.</p>}
          {failed && <p className={s.caption}>Could not load this trainer's card. The actions still work.</p>}
        </div>
      </div>
    </Modal>
  );
}
