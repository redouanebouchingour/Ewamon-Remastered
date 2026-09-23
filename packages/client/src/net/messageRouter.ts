/**
 * The DOM-side fan-out of ServerMessages (SPEC §20.3.2). Progression and inventory go ONLY through the
 * session writers; everything a scene owns (battle*, chat, storyBeat, raidEvents) is left for part 2's
 * World3D / BattleController, which subscribe to the same `WorldSession.onMessage`.
 */
import type { ServerMessage } from '@ewa/protocol';
import { toast, useNotificationsStore } from '../state/notifications';
import { applyInventoryDelta, applyProgressionDelta } from '../state/session';
import { useUiStore } from '../state/ui';
import type { WorldSession } from './WorldSession';

const ERROR_TEXT: Readonly<Record<string, string>> = {
  notAllowed: 'That is not allowed right now.',
  notFound: 'That is no longer there.',
  busy: 'Busy — try again in a moment.',
  invalidPayload: 'The server rejected that request.',
  internal: 'The server hit a problem. Try again.',
};

export function routeServerMessage(m: ServerMessage, ws: Pick<WorldSession, 'handover'>): void {
  switch (m.type) {
    case 'inventoryDelta':
      applyInventoryDelta(m);
      return;
    case 'progressionDelta':
      applyProgressionDelta(m);
      return;
    case 'toast':
      toast(m.level, m.text);
      return;
    case 'error':
      if (m.code === 'rateLimited') return; // one per window; the UI already disables repeat actions
      toast('warn', m.detail !== null && m.detail.length > 0 && m.code !== 'internal' ? `${ERROR_TEXT[m.code] ?? 'Refused'} (${m.detail})` : (ERROR_TEXT[m.code] ?? 'Refused.'));
      return;
    case 'dm':
      useNotificationsStore.getState().bumpDm(m.fromName);
      toast('info', `${m.fromName}: ${m.text}`);
      return;
    case 'challengeReceived':
      useUiStore.getState().setChallenge({ fromId: m.fromId, fromName: m.fromName, expiresAt: Date.now() + m.expiresInMs });
      toast('info', `${m.fromName} challenges you to a battle.`, Math.min(m.expiresInMs, 15_000));
      return;
    case 'challengeResult':
      toast('info', m.result === 'declined' ? 'Challenge declined.' : m.result === 'expired' ? 'Challenge expired.' : 'That trainer is unavailable.');
      return;
    case 'tradeUpdate':
      if (m.phase === 'complete' || m.phase === 'cancelled') {
        useUiStore.getState().setTrade(null);
        toast(m.phase === 'complete' ? 'success' : 'info', m.phase === 'complete' ? 'Trade complete.' : 'Trade cancelled.');
      } else {
        useUiStore.getState().setTrade({ tradeId: m.tradeId, phase: m.phase, offers: m.offers, offerHash: m.offerHash });
      }
      return;
    case 'handover':
      void ws.handover(m);
      return;
    default:
      // battleStart / battleEvents / battleResync / battleEnd / raidEvents / chat / storyBeat: part 2 (scene)
      return;
  }
}

export function installMessageRouter(ws: WorldSession): () => void {
  return ws.onMessage((m) => routeServerMessage(m, ws));
}
