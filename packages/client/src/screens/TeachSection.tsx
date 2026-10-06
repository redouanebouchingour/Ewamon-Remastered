/**
 * Phase D2 "Teach" (inside the creature detail of /play/party and /play/box): the TMs the player owns, and — when the
 * party screen was opened from a move tutor (`?tutor=<npcId>`, World3D after the tutor's lines) and that tutor stands
 * in the player's zone — the tutor's moves at `MOVE_TUTOR_PRICE`. A TM teaches through `POST /creature/:id/moves`
 * (the TM is kept); a tutor lesson through `POST /creature/:id/tutor { move, forget }`. With four moves known a modal
 * asks which one to forget. The compatibility shown here mirrors the server (`teachRefusal`); the server decides.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { MOVE_TUTOR_PRICE, zone as zoneDef } from '@ewa/content';
import type { NpcDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { formatMoney } from '../app/TopBar';
import { displayName, move as moveDef, ownedTmMoves, teachRefusal } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MoveButton } from '../ui/MoveButton';
import { TypeBadge } from '../ui/TypeBadge';
import l from './layout.module.css';
import s from './TeachSection.module.css';
import type { IntentFetcher } from './shared';

type Via = 'tm' | 'tutor';
type Picked = { readonly move: string; readonly via: Via } | null;

/** The tutor NPC `npcId` when it stands in `zoneId`, else null. */
export function tutorIn(zoneId: ZoneId | null, npcId: string | null): NpcDef | null {
  if (zoneId === null || npcId === null) return null;
  try {
    return zoneDef(zoneId).npcs.find((n) => n.id === npcId && n.tutor !== undefined) ?? null;
  } catch (_e) {
    return null;
  }
}

interface MoveRowProps {
  readonly c: CreatureInstance;
  readonly moveId: string;
  readonly via: Via;
  readonly price: number | null;
  readonly cantAfford: boolean;
  readonly busy: boolean;
  readonly onTeach: () => void;
}

function MoveRow({ c, moveId, via, price, cantAfford, busy, onTeach }: MoveRowProps) {
  const def = moveDef(moveId);
  const refusal = teachRefusal(c, moveId) ?? (cantAfford ? 'Not enough money' : null);
  const stats = def === undefined ? '' : def.power > 0 ? `Power ${def.power} · ${def.accuracy}% · ${def.pp} PP` : `Status · ${def.pp} PP`;
  return (
    <li className={s.move}>
      {def !== undefined ? <TypeBadge type={def.type} size="sm" compact /> : <span />}
      <span className={s.moveText}>
        <span className={s.moveName}>{moveId}</span>
        <span className={l.caption}>
          {stats}
          {price !== null ? ` · ${formatMoney(price)}` : ''}
          {refusal !== null ? ` · ${refusal}` : ''}
        </span>
      </span>
      <Button size="sm" disabled={refusal !== null} busy={busy} onClick={onTeach} ariaLabel={`Teach ${moveId} to ${displayName(c)}${via === 'tutor' ? ' (tutor)' : ''}`}>
        Teach
      </Button>
    </li>
  );
}

export function TeachSection({ creature: c, fetcher }: { readonly creature: CreatureInstance; readonly fetcher: IntentFetcher }) {
  const items = useSessionStore((st) => st.inventory?.items);
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const zoneId = useSessionStore((st) => st.zoneId);
  const [params] = useSearchParams();
  const tutor = tutorIn(zoneId, params.get('tutor'));
  const tms = ownedTmMoves(items);
  const [picked, setPicked] = useState<Picked>(null);

  const busyFor = (move: string): boolean => fetcher.busy((p) => (p.intent === 'teach' || p.intent === 'tutor') && p['id'] === c.id && p['move'] === move);
  const send = (move: string, via: Via, forget: string | null): void => {
    if (via === 'tutor') {
      fetcher.submit({ intent: 'tutor', id: c.id, move, forget: forget ?? '', name: displayName(c) });
      return;
    }
    const ids = c.moves.map((m) => m.id);
    const moves = forget === null ? [...ids, move] : ids.map((m) => (m === forget ? move : m));
    fetcher.submit({ intent: 'teach', id: c.id, move, moves, name: displayName(c) });
  };
  const teach = (move: string, via: Via): void => {
    if (c.moves.length >= 4) setPicked({ move, via });
    else send(move, via, null);
  };

  if (tms.length === 0 && tutor === null) {
    return (
      <section className={l.section} aria-label="Teach">
        <h4 className={l.sectionTitle}>Teach</h4>
        <p className={l.caption}>No TMs yet. Town shops from Saltmourn on sell them, and they are never used up. Move tutors in Vesperveil and Skyrend teach for a fee.</p>
      </section>
    );
  }

  return (
    <section className={l.section} aria-label="Teach">
      <h4 className={l.sectionTitle}>Teach</h4>
      <p className={l.caption}>A move can be taught when it is Normal-type or shares a type with the creature. TMs are kept after use.</p>
      {tutor !== null && (
        <>
          <p className={l.caption}>
            {tutor.name} teaches for {formatMoney(MOVE_TUTOR_PRICE)} a lesson.
          </p>
          <ul className={s.moves} aria-label={`Moves ${tutor.name} teaches`}>
            {(tutor.tutor ?? []).map((m) => (
              <MoveRow key={`t:${m}`} c={c} moveId={m} via="tutor" price={MOVE_TUTOR_PRICE} cantAfford={money < MOVE_TUTOR_PRICE} busy={busyFor(m)} onTeach={() => teach(m, 'tutor')} />
            ))}
          </ul>
        </>
      )}
      {tms.length > 0 && (
        <ul className={s.moves} aria-label="Your TMs">
          {tms.map((m) => (
            <MoveRow key={`m:${m}`} c={c} moveId={m} via="tm" price={null} cantAfford={false} busy={busyFor(m)} onTeach={() => teach(m, 'tm')} />
          ))}
        </ul>
      )}
      <Modal
        open={picked !== null}
        size="md"
        title={picked === null ? '' : `Teach ${picked.move}`}
        description={picked === null ? undefined : `${displayName(c)} knows four moves. Choose one to forget.`}
        onClose={() => setPicked(null)}
        footer={
          <Button variant="ghost" onClick={() => setPicked(null)}>
            Cancel
          </Button>
        }
      >
        <div className={s.forget}>
          {c.moves.map((m) => {
            const md = moveDef(m.id);
            return md === undefined ? null : (
              <MoveButton
                key={m.id}
                move={md}
                pp={m.pp}
                ppMax={m.ppMax}
                onClick={() => {
                  if (picked !== null) send(picked.move, picked.via, m.id);
                  setPicked(null);
                }}
              />
            );
          })}
        </div>
      </Modal>
    </section>
  );
}
