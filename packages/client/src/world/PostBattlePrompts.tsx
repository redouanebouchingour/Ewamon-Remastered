/**
 * SPEC §20.5.6 — the evolve / learn-move modals queued after the BattleResultCard (or by an item's `evolveReady` /
 * `learnMove` events, e.g. Rare Candy on the Party screen), one at a time, in order; each an explicit REST call
 * (`POST /creature/:id/evolve { into }`, `POST /creature/:id/moves { moves }`) — never automatic. The returned
 * CreatureInstance goes through the one inventory writer. Evolve: only after the server confirmed it, the evolution
 * sequence plays (`app/evolution.ts`); the next prompt waits until it ended.
 */
import { useEffect, useState } from 'react';
import { evolutionChildren, evolutionTarget, tracksHonor } from '@ewa/core';
import type { CreatureInstance } from '@ewa/core';
import { evolveCreature, preloadEvolution } from '../app/evolution';
import { displayName, itemInfo, move as moveDef, species, speciesName } from '../data/content';
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

/**
 * The species this prompt evolves the creature into: its own `into`, except on an honor split (dustcub), where the
 * ledger can move after the battle event that queued the prompt — the branch the creature's ledger picks now (the
 * server resolves the same branch). Null when the creature can no longer evolve into it (an earlier prompt evolved it).
 */
export function promptTarget(p: Extract<QueuedPrompt, { kind: 'evolve' }>, c: CreatureInstance): string | null {
  const sp = species(c.speciesId);
  if (sp === undefined || !evolutionChildren(sp.evolution).includes(p.into)) return null;
  const evo = sp.evolution;
  if (evo === null || evo.kind !== 'split' || !tracksHonor(sp) || c.level < evo.atLevel) return p.into;
  return evolutionTarget(evo, c.ability, c.honor ?? 0) ?? p.into;
}

function Evolve({ p: queued, c }: { readonly p: Extract<QueuedPrompt, { kind: 'evolve' }>; readonly c: CreatureInstance }) {
  const [busy, setBusy] = useState(false);
  const p = { ...queued, into: promptTarget(queued, c) ?? queued.into };
  const own = species(c.speciesId);
  const honor = own !== undefined && tracksHonor(own) ? (c.honor ?? 0) : null;
  // the new form's sprite atlas binds while the player reads the prompt (the sequence must not wait for it)
  useEffect(() => preloadEvolution(p.into), [p.into]);
  const go = async (): Promise<void> => {
    setBusy(true);
    try {
      // REST first: the sequence (and its "evolved into" banner) plays only for the creature the server returned
      await evolveCreature(c, p.into);
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
        {p.item !== undefined ? ` Evolving uses one ${itemInfo(p.item).name}.` : ''}
        {p.trade === true ? ' The trade woke something in it.' : ''}
        {honor !== null ? ` Its honor stands at ${honor > 0 ? `+${honor}` : honor}: ${honor >= 0 ? 'it walks the lawman\'s road.' : 'it rides with the outlaws.'}` : ''}
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
  // a beat's `after` lines / a leader's `post` lines are read first, then the prompts
  const talking = useUiStore((st) => st.dialogue !== null);
  // the evolution sequence plays: the next prompt waits for it
  const evolving = useUiStore((st) => st.evolution !== null);
  // re-render when the creature changes (an evolve answered, a party move)
  useSessionStore((st) => st.inventory);
  if (head === null || inBattle || talking || evolving) return null;
  const c = findCreature(head.creatureId);
  if (c === null || (head.kind === 'evolve' && promptTarget(head, c) === null)) {
    queueMicrotask(next);
    return null;
  }
  return head.kind === 'evolve' ? <Evolve key={`${head.creatureId}:${head.into}`} p={head} c={c} /> : <LearnMove key={`${head.creatureId}:${head.move}`} p={head} c={c} />;
}
