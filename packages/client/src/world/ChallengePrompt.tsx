/**
 * The PvP challenge prompt (SPEC §20.3.1 `ui.challenge`, §30.4.5 handshake): `challengeReceived` → "X challenges you"
 * with Accept / Decline → `challengeReply { fromId, accept }`. It expires with the server's window; Settings › Social
 * `allowChallenges: false` declines automatically; Accept is disabled while the whole party has fainted.
 */
import { useEffect, useState } from 'react';
import { getWorldSession } from '../net/WorldSession';
import { partyCanBattle, useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import s from './WorldModals.module.css';

function reply(accept: boolean): void {
  const c = useUiStore.getState().challenge;
  if (c === null) return;
  getWorldSession().send('challengeReply', { fromId: c.fromId, accept });
  useUiStore.getState().setChallenge(null);
}

export function ChallengePrompt() {
  const c = useUiStore((st) => st.challenge);
  const inBattle = useUiStore((st) => st.battle !== null);
  const allow = useSettingsStore((st) => st.social.allowChallenges);
  // the server answers an accept with a fainted party as 'unavailable' (noUsableParty) — say why up front
  const canBattle = useSessionStore((st) => partyCanBattle(st.inventory));
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (c === null) return;
    if (!allow || inBattle) {
      reply(false);
      return;
    }
    const tick = (): void => {
      const ms = c.expiresAt - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) useUiStore.getState().setChallenge(null);
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [c, allow, inBattle]);

  if (c === null || !allow || inBattle) return null;
  return (
    <Modal
      open
      size="sm"
      title="A challenge!"
      onClose={() => reply(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => reply(false)}>
            Decline
          </Button>
          <Button variant="primary" icon="sword" disabled={!canBattle} onClick={() => reply(true)}>
            Accept
          </Button>
        </>
      }
    >
      <p className={s.text} data-testid="challengeprompt">
        <strong className={s.name}>{c.fromName}</strong> wants to battle you.
      </p>
      {!canBattle && <p className={s.caption}>Your party needs healing before you can accept.</p>}
      <p className={s.caption}>Expires in {left} s</p>
    </Modal>
  );
}
