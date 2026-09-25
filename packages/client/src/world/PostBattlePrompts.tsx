/**
 * SPEC §20.5.6 — the evolve / learn-move modals queued after the BattleResultCard, one at a time, in order; each an
 * explicit REST call (`POST /creature/:id/evolve { into }`, `POST /creature/:id/moves { moves }`) — never automatic.
 * The returned CreatureInstance goes through the one inventory writer.
 */
import { useEffect, useState } from 'react';
import type { CreatureInstance } from '@ewa/core';
import { displayName, move as moveDef, speciesName } from '../data/content';
import { ApiFailure, apiFetch } from '../net/api';
import { toast } from '../state/notifications';
import { applyInventoryDelta, toInventoryDelta, useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import type { QueuedPrompt } from '../state/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MoveButton } from '../ui/MoveButton';
import s from './WorldModals.module.css';

function findCreature(id: string): CreatureInstance | null {
  const inv = useSessionStore.getState().inventory;
  return inv?.party.find((c) => c.id === id) ?? inv?.box.find((c) => c.id === id) ?? null;
}

const next = (): void => useUiStore.getState().shiftPrompt();

function failure(e: unknown): string {
  return e instanceof ApiFailure ? e.error.code : 'network';
}

function Evolve({ p, c }: { readonly p: Extract<QueuedPrompt, { kind: 'evolve' }>; readonly c: CreatureInstance }) {
  const [busy, setBusy] = useState(false);
  const go = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await apiFetch('creatureEvolve', { params: { id: c.id }, body: { into: p.into } });
      applyInventoryDelta(toInventoryDelta({ creaturesUpdated: [res] }));
      toast('success', `${displayName(c)} evolved into ${speciesName(p.into)}!`);
      next();
    } catch (e) {
      toast('danger', `Evolution failed (${failure(e)}).`);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      size="sm"
      title="Evolution"
      onClose={next}
      footer={
        <>
          <Button variant="ghost" onClick={next} disabled={busy}>
            Not now
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void go()}>
            Evolve
          </Button>
        </>
      }
    >
      <p className={s.text} data-testid="evolveprompt">
        <strong className={s.name}>{displayName(c)}</strong> is ready to evolve into <strong className={s.name}>{speciesName(p.into)}</strong>.
      </p>
    </Modal>
  );
}

function LearnMove({ p, c }: { readonly p: Extract<QueuedPrompt, { kind: 'learnMove' }>; readonly c: CreatureInstance }) {
  const [busy, setBusy] = useState(false);
  const known = c.moves.some((m) => m.id === p.move);
  const def = moveDef(p.move);
  useEffect(() => {
    if (known) next();
  }, [known]);
  const learn = async (forget: string | null): Promise<void> => {
    setBusy(true);
    const ids = c.moves.map((m) => m.id);
    const moves = forget === null ? [...ids, p.move] : ids.map((m) => (m === forget ? p.move : m));
    try {
      const res = await apiFetch('creatureMoves', { params: { id: c.id }, body: { moves } });
      applyInventoryDelta(toInventoryDelta({ creaturesUpdated: [res] }));
      toast('success', `${displayName(c)} learned ${p.move}!`);
      next();
    } catch (e) {
      toast('danger', `Could not learn ${p.move} (${failure(e)}).`);
      setBusy(false);
    }
  };
  if (known) return null;
  const full = c.moves.length >= 4;
  return (
    <Modal
      open
      size="md"
      title="A new move"
      onClose={next}
      footer={
        <>
          <Button variant="ghost" onClick={next} disabled={busy}>
            Skip
          </Button>
          {!full && (
            <Button variant="primary" busy={busy} onClick={() => void learn(null)}>
              Learn {p.move}
            </Button>
          )}
        </>
      }
    >
      <div className={s.stack} data-testid="learnmoveprompt">
        <p className={s.text}>
          <strong className={s.name}>{displayName(c)}</strong> wants to learn <strong className={s.name}>{p.move}</strong>.
          {full ? ' Choose a move to forget, or skip.' : ''}
        </p>
        {def !== undefined && <MoveButton move={def} pp={def.pp} ppMax={def.pp} />}
        {full && (
          <div className={s.moves}>
            {c.moves.map((m) => {
              const md = moveDef(m.id);
              return md === undefined ? null : <MoveButton key={m.id} move={md} pp={m.pp} ppMax={m.ppMax} disabled={busy} onClick={() => void learn(m.id)} />;
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function PostBattlePrompts() {
  const head = useUiStore((st) => st.prompts[0] ?? null);
  const inBattle = useUiStore((st) => st.battle !== null);
  // re-render when the creature changes (an evolve answered, a party move)
  useSessionStore((st) => st.inventory);
  if (head === null || inBattle) return null;
  const c = findCreature(head.creatureId);
  if (c === null) {
    queueMicrotask(next);
    return null;
  }
  return head.kind === 'evolve' ? <Evolve key={`${head.creatureId}:${head.into}`} p={head} c={c} /> : <LearnMove key={`${head.creatureId}:${head.move}`} p={head} c={c} />;
}
