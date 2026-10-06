/**
 * Phase C1 — the raid lobby (`ui.modal === 'raidLobby'`, payload `{ raidId, ready? }`; opened from the den's `raid`
 * interactable). Everything shown is `room.state.raid` read in place (useRoomState): the boss, the phase, the
 * countdown (`roundEndsInMs`: the lobby's 90 s, a round's 20 s, the catch window's 60 s), the shared HP and the
 * participants (the damage board's keys — every participant has a row from the moment they join).
 *
 * Join → `raidJoin` (the server checks 8 m, badges, a fit party, ≤ 8, lobby only and toasts "You joined the raid");
 * Ready → `raidReady` (the schema carries no ready flags, so the modal remembers this player's own Ready in its
 * payload); Leave → `raidLeave`. The fight starts when everyone present is ready (or the lobby time runs out with one
 * ready); the server's `battleResync { battleId: raidId }` then opens the battle and this modal yields to it.
 */
import { speciesName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useRoomState } from '../net/useRoomState';
import type { Primitive } from '../net/useRoomState';
import { boardFlat, countdownLine, phaseLabel, RAID_MAX_PLAYERS, raidMinBadges, unflattenBoard } from '../battle/raid';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { HpBar } from '../ui/HpBar';
import { Modal } from '../ui/Modal';
import { Pill } from '../ui/Pill';
import { cx } from '../ui/cx';
import s from './RaidLobby.module.css';

export interface RaidLobbyPayload {
  readonly raidId: string;
  readonly ready?: boolean;
}

export function isRaidLobbyPayload(p: unknown): p is RaidLobbyPayload {
  return typeof p === 'object' && p !== null && typeof (p as { raidId?: unknown }).raidId === 'string' && ((p as { ready?: unknown }).ready === undefined || typeof (p as { ready?: unknown }).ready === 'boolean');
}

const NONE = null;
const NO_BOARD: readonly Primitive[] = [];

export function RaidLobby() {
  const open = useUiStore((st) => st.modal === 'raidLobby' && st.battle === null);
  const payload = useUiStore((st) => (st.modal === 'raidLobby' && isRaidLobbyPayload(st.modalPayload) ? st.modalPayload : null));
  const raidId = payload?.raidId ?? '';
  const badges = useSessionStore((st) => st.progression?.badges.length ?? 0);
  const view = useRoomState(
    (st, me) => {
      const r = st.raid;
      if (r === null || r === undefined || r.id !== raidId) return NONE;
      return { species: r.bossSpecies, level: r.bossLevel, hpPct: r.hpPct, phase: r.phase, ends: r.roundEndsInMs, joined: r.damageBoard.has(me), x: r.x, z: r.z };
    },
    NONE,
  );
  const flat = useRoomState((st, me) => (raidId === '' ? NO_BOARD : boardFlat(st, me, raidId)), NO_BOARD);

  if (!open || payload === null) return null;
  const ws = getWorldSession();
  const close = (): void => useUiStore.getState().closeModal();

  if (view === null) {
    return (
      <Modal open size="sm" title="Raid" onClose={close} footer={<Button variant="primary" onClick={close}>Close</Button>}>
        <p className={s.text} data-testid="raidlobby" data-state="gone">
          The raid has ended.
        </p>
      </Modal>
    );
  }

  const board = unflattenBoard(flat);
  const minBadges = raidMinBadges(view.species, view.x, view.z);
  const boss = speciesName(view.species);
  const lobby = view.phase === 0;
  const full = board.length >= RAID_MAX_PLAYERS;
  const ready = payload.ready === true;
  const join = (): void => ws.send('raidJoin', { raidId });
  const markReady = (): void => {
    ws.send('raidReady', { raidId });
    useUiStore.getState().openModal('raidLobby', { raidId, ready: true } satisfies RaidLobbyPayload);
  };
  const leave = (): void => {
    ws.send('raidLeave', { raidId });
    close();
  };
  const blocker = !lobby ? null : !view.joined && badges < minBadges ? `Needs ${minBadges} badge${minBadges === 1 ? '' : 's'} (you have ${badges})` : !view.joined && full ? 'The raid is full' : null;

  let footer;
  if (lobby && view.joined) {
    footer = (
      <>
        <Button variant="ghost" onClick={leave}>
          Leave
        </Button>
        <Button variant="primary" icon="check" disabled={ready} onClick={markReady}>
          {ready ? 'Ready' : 'Ready up'}
        </Button>
      </>
    );
  } else if (lobby) {
    footer = (
      <>
        <Button variant="ghost" onClick={close}>
          Not now
        </Button>
        <Button variant="primary" disabled={blocker !== null} title={blocker ?? undefined} onClick={join}>
          Join raid
        </Button>
      </>
    );
  } else {
    footer = (
      <Button variant="primary" onClick={close}>
        Close
      </Button>
    );
  }

  return (
    <Modal open size="md" title={`Raid · ${boss}`} description={`Lv ${view.level} · up to ${RAID_MAX_PLAYERS} trainers · 20 s rounds`} onClose={close} footer={footer}>
      <div className={s.body} data-testid="raidlobby" data-phase={view.phase} data-joined={view.joined || undefined}>
        <div className={s.status}>
          <Pill tone={view.phase === 2 ? 'danger' : view.phase === 3 ? 'accent' : lobby ? 'info' : 'neutral'}>{phaseLabel(view.phase)}</Pill>
          <span className={s.countdown} data-testid="raidlobby-countdown">
            {countdownLine(view.phase, view.ends)}
          </span>
        </div>
        <div className={s.hp}>
          <span className={s.label}>Boss HP</span>
          <HpBar hp={Math.round(view.hpPct * 1000)} maxHp={1000} size="sm" />
          <span className={s.pct}>{Math.round(view.hpPct * 100)}%</span>
        </div>
        <section className={s.roster} aria-label="Trainers">
          <h3 className={s.heading}>
            Trainers <span className={s.count}>{board.length} / {RAID_MAX_PLAYERS}</span>
          </h3>
          {board.length === 0 ? (
            <p className={s.caption}>Nobody has joined yet. Be the first.</p>
          ) : (
            <ol className={s.list} data-testid="raidlobby-roster">
              {board.map((r) => (
                <li key={r.playerId} className={cx(s.row, r.self && s.self)}>
                  <span className={s.name}>{r.self ? `${r.name} (you)` : r.name}</span>
                  {lobby ? (
                    r.self && ready ? (
                      <span className={s.tag}>Ready</span>
                    ) : null
                  ) : (
                    <span className={s.damage}>{r.damage.toLocaleString()}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
        {lobby && (
          <p className={s.caption}>
            {view.joined
              ? ready
                ? 'Waiting for the others — the fight starts when everyone is ready.'
                : 'Ready up when your party is set. Trainers who are not ready when the fight starts are left out.'
              : blocker ?? 'Every trainer fights the same boss. Deal damage to earn the reward and a catch try.'}
          </p>
        )}
        {!lobby && !view.joined && <p className={s.caption}>The fight is under way.</p>}
      </div>
    </Modal>
  );
}
