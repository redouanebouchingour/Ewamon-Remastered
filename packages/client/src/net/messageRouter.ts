/**
 * The DOM-side fan-out of ServerMessages (SPEC §20.3.2). Progression and inventory go ONLY through the
 * session writers; everything a scene owns (battle*, chat, storyBeat, raidEvents) is left for part 2's
 * World3D / BattleController, which subscribe to the same `WorldSession.onMessage`.
 */
import { FAST_TRAVEL_REFUSALS } from '@ewa/protocol';
import type { ServerMessage } from '@ewa/protocol';
import { installArenaFlow, routeArenaMessage } from '../app/arena';
import type { ArenaSession } from '../app/arena';
import { queueTradeEvolutions } from '../app/itemUseFeedback';
import { toast, useNotificationsStore } from '../state/notifications';
import { rankedStatusText, useRankedStore } from '../state/ranked';
import { useRealWeatherStore } from '../state/realWeather';
import { applyInventoryDelta, applyProgressionDelta } from '../state/session';
import { useUiStore } from '../state/ui';
import type { WorldSession } from './WorldSession';

/** refusals the server already explained with its own toast (e.g. a league gate: toast + error leagueLocked; Phase C3 fast travel) */
const EXPLAINED_DETAILS: ReadonlySet<string> = new Set(['leagueLocked', ...FAST_TRAVEL_REFUSALS]);

const ERROR_TEXT: Readonly<Record<string, string>> = {
  notAllowed: 'That is not allowed right now.',
  notFound: 'That is no longer there.',
  busy: 'Busy — try again in a moment.',
  invalidPayload: 'The server rejected that request.',
  internal: 'The server hit a problem. Try again.',
};

/** Phase C1: refusal details with their own copy (the raid flow's raidJoin / raidCatch answers among them) */
const DETAIL_TEXT: Readonly<Record<string, string>> = {
  tooFar: 'You are too far away — walk closer.',
  badges: 'You need more badges for that.',
  full: 'That raid is full.',
  started: 'That raid has already started.',
  noParty: 'Your party needs healing first.',
  noWindow: 'The catch window has closed.',
  noOrb: 'You have no orb of that kind.',
};

/**
 * The server completes a trade with `tradeUpdate complete` then that trade's `inventoryDelta` (tradeSession
 * `complete`), whose received creatures sit in the box. A current server says so in `placement`; for a delta without
 * it (an older server) the router marks the next one.
 */
let tradeReceiptPending = false;

/** challengeResult copy; `reason` (additive) names the problem and whose side it is. */
export function challengeResultText(m: Extract<ServerMessage, { type: 'challengeResult' }>, selfId: string): string {
  if (m.result === 'declined') return 'Challenge declined.';
  if (m.result === 'expired') return 'Challenge expired.';
  const r = m.reason;
  if (r === undefined) return 'That trainer is unavailable.';
  const mine = r.playerId === selfId;
  switch (r.code) {
    case 'noUsableParty':
      return mine ? 'Your party needs healing before a battle.' : "The other trainer's party needs healing first.";
    case 'inBattle':
      return mine ? 'You are already in a battle.' : 'That trainer is already in a battle.';
    case 'trading':
      return mine ? 'Finish your trade first.' : 'That trainer is busy trading.';
    case 'tooFar':
      return 'You are too far apart to battle.';
    case 'left':
      return mine ? 'The challenge was lost when you left.' : 'That trainer has left.';
    case 'expired':
      return 'That challenge has expired.';
  }
  return 'That trainer is unavailable.';
}

export function routeServerMessage(m: ServerMessage, ws: Pick<WorldSession, 'handover' | 'selfId'> & Partial<ArenaSession>): void {
  // arena PvP (app/arena.ts): the queue, invites, the arena room's phase; battleEnd is observed there and played here
  if (ws.enterArena !== undefined && ws.returnToWorld !== undefined && routeArenaMessage(m, ws as ArenaSession)) return;
  switch (m.type) {
    case 'inventoryDelta':
      if (tradeReceiptPending) {
        tradeReceiptPending = false;
        applyInventoryDelta(m.placement !== undefined ? m : { ...m, addedTo: 'box' });
        queueTradeEvolutions(m.creaturesUpdated);
        return;
      }
      applyInventoryDelta(m);
      queueTradeEvolutions(m.creaturesUpdated);
      return;
    case 'progressionDelta':
      applyProgressionDelta(m);
      return;
    case 'toast':
      toast(m.level, m.text);
      return;
    case 'error':
      if (m.code === 'rateLimited') return; // one per window; the UI already disables repeat actions
      if (m.detail !== null && EXPLAINED_DETAILS.has(m.detail)) return; // found live: two toasts for one gym refusal
      if (m.detail !== null && m.code !== 'internal' && DETAIL_TEXT[m.detail] !== undefined) {
        toast('warn', DETAIL_TEXT[m.detail]!);
        return;
      }
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
      toast(m.reason?.code === 'noUsableParty' ? 'warn' : 'info', challengeResultText(m, ws.selfId));
      return;
    case 'tradeUpdate':
      if (m.phase === 'complete' || m.phase === 'cancelled') {
        tradeReceiptPending = m.phase === 'complete';
        useUiStore.getState().setTrade(null);
        toast(m.phase === 'complete' ? 'success' : 'info', m.phase === 'complete' ? 'Trade complete.' : 'Trade cancelled.');
      } else {
        useUiStore.getState().setTrade({ tradeId: m.tradeId, phase: m.phase, offers: m.offers, offerHash: m.offerHash });
      }
      return;
    case 'handover':
      void ws.handover(m);
      return;
    case 'towerState': {
      // Phase D14: a fight starting closes the tower modal (the battle covers it); a win / loss / retirement opens it
      // (it waits under the battle until the result card is dismissed: TowerModal renders only with no battle open)
      const { type: _t, ...tower } = m;
      const ui = useUiStore.getState();
      ui.setTower(tower);
      if (m.phase === 'fighting') {
        if (ui.modal === 'tower') ui.closeModal();
      } else ui.openModal('tower');
      return;
    }
    case 'realWeather':
      // weather from real life: the player's city's weather (the world shows it; null: back to the zone's)
      useRealWeatherStore.getState().set(m.kind);
      return;
    case 'rankedStatus': {
      // Phase D13: the queue panel's state + one toast per change worth telling (match found, refusals, cancelled)
      useRankedStore.getState().apply(m);
      const t = rankedStatusText(m);
      if (t !== null) toast(t.level, t.text);
      return;
    }
    default:
      // battleStart / battleEvents / battleResync / battleEnd / raidEvents / chat / storyBeat: part 2 (scene)
      return;
  }
}

export function installMessageRouter(ws: WorldSession): () => void {
  const offMessages = ws.onMessage((m) => routeServerMessage(m, ws));
  // Phase D13: the server drops a queue entry when the connection really ends; so does the panel
  const offRoom = ws.onRoom((room) => {
    if (room === null) {
      useRankedStore.getState().reset();
      useRealWeatherStore.getState().reset();
    }
  });
  // arena PvP: the arena store follows the session; an arena closed mid-battle sends the player back
  const offArena = installArenaFlow(ws);
  return () => {
    offMessages();
    offRoom();
    offArena();
  };
}
