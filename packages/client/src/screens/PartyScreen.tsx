/**
 * `/play/party` (SPEC §20.9.3), Broadcast layout (2026-10-11): a lineup of the six slots as cards across the top
 * (type-colour slab with the sprite and slot number, name, level, skewed HP bar), keyboard-reorderable (Alt+↑/↓,
 * and Alt+←/→ along the row) and pointer-draggable; a reorder commits `POST /party/reorder` on drop (optimistic
 * order, reverted on error). Below: the selected creature's detail band (`?c=<id>` keeps the selection across
 * reloads). Empty: impossible (party ≥ 1). Loading: none (store). Error: toast.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { zone as zoneDef } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { displayName, itemInfo, maxHpOf, species } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { badgesOf } from '../ui/CreatureCard';
import type { CreatureBadge } from '../ui/CreatureCard';
import { CreatureSprite } from '../ui/CreatureSprite';
import { cssVars } from '../ui/cssVars';
import { cx } from '../ui/cx';
import { EmptyState } from '../ui/EmptyState';
import { StatusChip, hpTone } from '../ui/HpBar';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { CreatureDetail } from './CreatureDetail';
import s from './PartyScreen.module.css';
import { useClosePanel, useIntent } from './shared';

const EMPTY: readonly CreatureInstance[] = [];

export function moveInOrder(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

const MARK: Readonly<Record<CreatureBadge, { readonly icon: IconName; readonly label: string }>> = {
  favorite: { icon: 'star', label: 'Favourite' },
  locked: { icon: 'lock', label: 'Locked' },
  alpha: { icon: 'alpha', label: 'Alpha' },
  shiny: { icon: 'sparkle', label: 'Shiny' },
  listed: { icon: 'tag', label: 'Listed' },
};

/** One lineup card: the type slab with the sprite and the slot number, then name · level · skewed HP bar. */
function LineupCard({ creature: c, slot, selected, onSelect }: { readonly creature: CreatureInstance; readonly slot: number; readonly selected: boolean; readonly onSelect: () => void }) {
  const sp = species(c.speciesId);
  const name = displayName(c);
  const max = maxHpOf(c);
  const frac = max > 0 ? Math.max(0, Math.min(1, c.hp / max)) : 0;
  const fainted = c.hp <= 0;
  const marks = badgesOf(c);
  return (
    <button
      type="button"
      className={cx(s.card, selected && s.selected, fainted && s.fainted)}
      data-type={sp?.types[0] ?? 'Normal'}
      aria-pressed={selected}
      aria-label={`${name}, level ${c.level}, ${c.hp} of ${max} HP${fainted ? ', fainted' : ''}`}
      onClick={onSelect}
    >
      <span className={s.art}>
        <span className={s.slotNo} aria-hidden>
          {String(slot).padStart(2, '0')}
        </span>
        <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="xl" className={s.sprite} />
        {marks.length > 0 && (
          <span className={s.marks} aria-hidden>
            {marks.map((b) => (
              <span key={b} className={s.mark} title={MARK[b].label}>
                <Icon name={MARK[b].icon} size="sm" />
              </span>
            ))}
          </span>
        )}
        {c.heldItem !== null && (
          <span className={s.held} title={`Holding ${itemInfo(c.heldItem).name}`} aria-hidden>
            <Icon name="bag" size="sm" />
          </span>
        )}
      </span>
      <span className={s.info}>
        <span className={s.nameRow}>
          <span className={s.name}>{name}</span>
          <span className={s.level}>
            Lv <b className={s.levelNum}>{c.level}</b>
          </span>
        </span>
        <span className={s.hpRow}>
          <span className={s.hpTrack}>
            <span className={cx(s.hpFill, s[hpTone(frac)])} style={cssVars({ '--p': frac })} />
          </span>
          <span className={s.hpNum}>
            {c.hp}
            <span className={s.hpMax}>/{max}</span>
          </span>
        </span>
        <span className={s.statusRow}>
          {fainted ? <span className={s.faintedTag}>Fainted</span> : c.status.map((st) => <StatusChip key={st} status={st} />)}
        </span>
      </span>
      <span className={s.bar} aria-hidden />
    </button>
  );
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
  const selectedIndex = selected === null ? -1 : ordered.indexOf(selected);
  const select = (id: string): void => setParams((p) => {
    p.set('c', id);
    return p;
  }, { replace: true });

  const commit = (order: string[]): void => {
    setOptimistic(order);
    fetcher.submit({ intent: 'reorder', order });
  };

  const onKey = (e: KeyboardEvent<HTMLLIElement>, i: number): void => {
    if (!e.altKey) return;
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    if (!back && !fwd) return;
    e.preventDefault();
    const to = back ? i - 1 : i + 1;
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

  const avgLevel = ordered.length === 0 ? 0 : Math.round(ordered.reduce((sum, c) => sum + c.level, 0) / ordered.length);
  const typeCount = new Set(ordered.flatMap((c) => species(c.speciesId)?.types ?? [])).size;
  const fainted = ordered.filter((c) => c.hp <= 0).length;

  return (
    <Panel
      title="Party"
      eyebrow={`${ordered.length} / 6 slots`}
      subtitle="Drag to reorder, or Alt + ↑/↓. The first creature leads every battle."
      onClose={close}
      actions={
        <>
          <dl className={s.summary}>
            <div>
              <dt>Avg lv</dt>
              <dd>{avgLevel}</dd>
            </div>
            <div>
              <dt>Types</dt>
              <dd>{typeCount}</dd>
            </div>
            <div>
              <dt>Fainted</dt>
              <dd className={cx(fainted > 0 && s.summaryWarn)}>{fainted}</dd>
            </div>
          </dl>
          {healer && (
            <Button icon="heart" onClick={() => fetcher.submit({ intent: 'heal' })} busy={fetcher.busy((p) => p.intent === 'heal')}>
              Heal party
            </Button>
          )}
        </>
      }
    >
      {ordered.length === 0 ? (
        <EmptyState icon="party" title="No party yet" hint="Your party loads with your profile." />
      ) : (
        <div className={s.screen}>
          <ol className={s.lineup} aria-label="Party order">
            {ordered.map((c, i) => (
              <li
                key={c.id}
                className={cx(s.slot, dragFrom === i && s.dragging, dragOver === i && dragFrom !== i && s.dropTarget)}
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
                <LineupCard creature={c} slot={i + 1} selected={selected?.id === c.id} onSelect={() => select(c.id)} />
              </li>
            ))}
            {Array.from({ length: Math.max(0, 6 - ordered.length) }, (_, k) => (
              <li key={`empty-${k}`} className={cx(s.slot, s.emptySlot)}>
                <span className={s.emptyNo} aria-hidden>
                  {String(ordered.length + k + 1).padStart(2, '0')}
                </span>
                <span className={s.emptyText}>Empty slot — withdraw from your box</span>
              </li>
            ))}
          </ol>
          {selected !== null && (
            <CreatureDetail
              creature={selected}
              fetcher={fetcher}
              isLastInParty={ordered.length <= 1}
              layout="band"
              slot={selectedIndex + 1}
              extraActions={
                selectedIndex > 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    busy={fetcher.busy((p) => p.intent === 'reorder')}
                    onClick={() => commit(moveInOrder(ordered.map((c) => c.id), selectedIndex, 0))}
                  >
                    Set lead
                  </Button>
                ) : (
                  <span className={s.leadTag}>Leads every battle</span>
                )
              }
            />
          )}
        </div>
      )}
    </Panel>
  );
}
