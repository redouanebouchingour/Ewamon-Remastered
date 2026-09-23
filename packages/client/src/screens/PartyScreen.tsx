/**
 * `/play/party` (SPEC §20.9.3). Left 60 %: the six party slots as row cards in slot order, keyboard-reorderable
 * (Alt+↑/↓) and pointer-draggable; a reorder commits `POST /party/reorder` on drop (optimistic order, reverted
 * on error). Right 40 %: the selected creature's detail (`?c=<id>` keeps the selection across reloads).
 * Empty: impossible (party ≥ 1). Loading: none (store). Error: toast.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { zone as zoneDef } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { cx } from '../ui/cx';
import { CreatureDetail } from './CreatureDetail';
import l from './layout.module.css';
import s from './PartyScreen.module.css';
import { useClosePanel, useIntent } from './shared';

const EMPTY: readonly CreatureInstance[] = [];

export function moveInOrder(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export function PartyScreen() {
  const close = useClosePanel();
  const party = useSessionStore((st) => st.inventory?.party ?? EMPTY);
  const zoneId = useSessionStore((st) => st.zoneId);
  const [params, setParams] = useSearchParams();
  const fetcher = useIntent();
  const [optimistic, setOptimistic] = useState<readonly string[] | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // the store is the truth: drop the optimistic order once the action settled (success re-orders the store,
  // failure leaves it unchanged — i.e. the order reverts)
  useEffect(() => {
    if (fetcher.idle) setOptimistic(null);
  }, [fetcher.idle]);

  const ordered = useMemo(() => {
    if (optimistic === null) return party;
    const byId = new Map(party.map((c) => [c.id, c]));
    return optimistic.map((id) => byId.get(id)).filter((c): c is CreatureInstance => c !== undefined);
  }, [party, optimistic]);

  const selectedId = params.get('c') ?? ordered[0]?.id ?? null;
  const selected = ordered.find((c) => c.id === selectedId) ?? ordered[0] ?? null;
  const select = (id: string): void => setParams((p) => {
    p.set('c', id);
    return p;
  }, { replace: true });

  const commit = (order: string[]): void => {
    setOptimistic(order);
    fetcher.submit({ intent: 'reorder', order });
  };

  const onKey = (e: KeyboardEvent<HTMLLIElement>, i: number): void => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (to < 0 || to >= ordered.length) return;
    commit(moveInOrder(ordered.map((c) => c.id), i, to));
  };

  const onDrop = (e: DragEvent<HTMLLIElement>, i: number): void => {
    e.preventDefault();
    if (dragFrom !== null && dragFrom !== i) commit(moveInOrder(ordered.map((c) => c.id), dragFrom, i));
    setDragFrom(null);
    setDragOver(null);
  };

  let healer = false;
  try {
    healer = zoneId !== null && zoneDef(zoneId).healer;
  } catch (_e) {
    healer = false;
  }

  return (
    <Panel
      title="Party"
      eyebrow={`${ordered.length} / 6 slots`}
      subtitle="Drag to reorder, or Alt + ↑/↓. The first creature leads every battle."
      onClose={close}
      actions={
        healer ? (
          <Button icon="heart" onClick={() => fetcher.submit({ intent: 'heal' })} busy={fetcher.busy((p) => p.intent === 'heal')}>
            Heal party
          </Button>
        ) : undefined
      }
    >
      {ordered.length === 0 ? (
        <EmptyState icon="party" title="No party yet" hint="Your party loads with your profile." />
      ) : (
        <div className={l.split}>
          <ol className={s.slots} aria-label="Party order">
            {ordered.map((c, i) => (
              <li
                key={c.id}
                className={cx(s.slot, dragOver === i && dragFrom !== i && s.dropTarget)}
                draggable
                onDragStart={(e) => {
                  setDragFrom(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', c.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDrop={(e) => onDrop(e, i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className={s.index} aria-hidden>
                  {i + 1}
                </span>
                <CreatureCard
                  creature={c}
                  variant="row"
                  draggable
                  selected={selected?.id === c.id}
                  onClick={() => select(c.id)}
                  className={s.card}
                  trailing={<Icon name="grid" size="sm" className={s.grip} />}
                />
              </li>
            ))}
            {Array.from({ length: Math.max(0, 6 - ordered.length) }, (_, k) => (
              <li key={`empty-${k}`} className={cx(s.slot, s.emptySlot)}>
                <span className={s.index} aria-hidden>
                  {ordered.length + k + 1}
                </span>
                <div className={s.emptyCard}>Empty slot — withdraw from your box</div>
              </li>
            ))}
          </ol>
          {selected !== null && <CreatureDetail creature={selected} fetcher={fetcher} isLastInParty={ordered.length <= 1} />}
        </div>
      )}
    </Panel>
  );
}
