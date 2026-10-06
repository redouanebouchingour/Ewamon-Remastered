/**
 * The selected creature's detail column (SPEC §20.9.3, reused by Box §20.9.4): stats "at level" (core calcStat —
 * display only), four MoveButtons with PP, ability + held item (`POST /creature/:id/setup`), nickname
 * (`/nickname`), favourite/lock (`/flags`), release (danger, confirm modal, refused when locked).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CreatureInstance } from '@ewa/core';
import { CREATURE_ITEMS, HELD_ITEMS, MULTI_USE_ITEMS, STONE_IDS, ability as abilityDef, displayName, itemInfo, maxHpOf, move as moveDef, species, statsOf, stoneTarget } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { badgesOf } from '../ui/CreatureCard';
import { CreatureSprite } from '../ui/CreatureSprite';
import { cssVars } from '../ui/cssVars';
import { Select, TextField } from '../ui/Field';
import { HpBar } from '../ui/HpBar';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { MoveButton } from '../ui/MoveButton';
import { Pill } from '../ui/Pill';
import { Toggle } from '../ui/Toggle';
import { TypeBadge } from '../ui/TypeBadge';
import l from './layout.module.css';
import s from './CreatureDetail.module.css';
import type { IntentFetcher } from './shared';
import { TeachSection } from './TeachSection';

export interface CreatureDetailProps {
  readonly creature: CreatureInstance;
  readonly fetcher: IntentFetcher;
  /** screen-specific actions (Withdraw / Deposit) */
  readonly extraActions?: ReactNode;
  /** the last party member cannot be released or deposited */
  readonly isLastInParty?: boolean;
}

const MAX_BASE = 150;

export function CreatureDetail({ creature: c, fetcher, extraActions, isLastInParty = false }: CreatureDetailProps) {
  const sp = species(c.speciesId);
  const items = useSessionStore((st) => st.inventory?.items);
  const [nickname, setNickname] = useState(c.nickname ?? '');
  const [abilityId, setAbilityId] = useState(c.ability);
  const [held, setHeld] = useState(c.heldItem ?? '');
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [useId, setUseId] = useState('');

  useEffect(() => {
    setNickname(c.nickname ?? '');
    setAbilityId(c.ability);
    setHeld(c.heldItem ?? '');
  }, [c.id, c.nickname, c.ability, c.heldItem]);

  const busyFor = (intent: string): boolean => fetcher.busy((p) => p.intent === intent && p['id'] === c.id);
  const heldOptions = [
    { value: '', label: 'Nothing' },
    ...HELD_ITEMS.filter((i) => i.id === c.heldItem || (items?.[i.id] ?? 0) > 0).map((i) => ({
      value: i.id,
      label: i.id === c.heldItem ? `${i.name} (held)` : `${i.name} ×${items?.[i.id] ?? 0}`,
    })),
  ];
  const abilityOptions = (sp?.abilities ?? [c.ability]).map((a) => ({ value: a, label: abilityDef(a)?.name ?? a }));
  const setupDirty = abilityId !== c.ability || held !== (c.heldItem ?? '');
  const nickDirty = nickname.trim() !== (c.nickname ?? '');
  const currentAbility = abilityDef(abilityId);
  // field items the player owns that work on a creature (Rare Candy, potions, revives, status cures, PP)
  // Phase D3: an evolution stone is offered only to a creature that reacts to it
  const usable = CREATURE_ITEMS.filter((i) => (items?.[i.id] ?? 0) > 0 && (!STONE_IDS.has(i.id) || stoneTarget(i.id, c) !== null));
  const useItem = usable.find((i) => i.id === useId) ?? usable[0];
  const owned = useItem === undefined ? 0 : (items?.[useItem.id] ?? 0);
  const multi = useItem !== undefined && MULTI_USE_ITEMS.has(useItem.id);
  // a Rare Candy stops at level 100; other items are one use per request
  const maxTimes = multi ? Math.min(owned, Math.max(0, 100 - c.level)) : Math.min(owned, 1);
  const useBusy = fetcher.busy((p) => p.intent === 'useItem' && p['target'] === c.id);
  const submitUse = (qty: number): void => {
    if (useItem !== undefined) fetcher.submit({ intent: 'useItem', item: useItem.id, target: c.id, qty });
  };

  return (
    <aside className={l.detail} data-type={sp?.types[0] ?? 'Normal'} aria-label={`${displayName(c)} details`}>
      <div className={l.detailHead}>
        <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="xl" />
        <div className={l.detailTitle}>
          <h3 className={l.h2}>{displayName(c)}</h3>
          <p className={l.muted}>
            {c.nickname !== null ? `${sp?.name ?? c.speciesId} · ` : ''}Level {c.level}
            {sp !== undefined ? ` · #${String(sp.dexNumber).padStart(3, '0')}` : ''}
          </p>
          <div className={l.row}>
            {sp?.types.map((t) => <TypeBadge key={t} type={t} />)}
            {c.variantKey !== 'normal' && <Pill tone="info">{c.variantKey}</Pill>}
            {badgesOf(c).includes('alpha') && <Pill tone="danger">Alpha</Pill>}
          </div>
        </div>
      </div>

      <HpBar hp={c.hp} maxHp={maxHpOf(c)} showNumbers status={c.status} />

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Stats at level {c.level}</h4>
        <div className={s.stats}>
          {statsOf(c).map((st) => (
            <div key={st.key} className={s.stat}>
              <span className={l.kvLabel}>{st.label}</span>
              <div className={l.statTrack}>
                <div className={l.statFill} style={cssVars({ '--p': Math.min(1, st.base / MAX_BASE) })} />
              </div>
              <span className={l.kvValue}>{st.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Moves</h4>
        <div className={l.movesGrid}>
          {c.moves.map((m) => {
            const def = moveDef(m.id);
            return def === undefined ? null : <MoveButton key={m.id} move={def} pp={m.pp} ppMax={m.ppMax} />;
          })}
        </div>
      </section>

      <TeachSection creature={c} fetcher={fetcher} />

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Use an item</h4>
        {useItem === undefined ? (
          <p className={l.caption}>You have no items that work on a creature. Potions, revives and Rare Candy are sold in town shops.</p>
        ) : (
          <>
            <Select
              label="Item"
              value={useItem.id}
              options={usable.map((i) => ({ value: i.id, label: `${i.name} ×${items?.[i.id] ?? 0}` }))}
              onChange={setUseId}
            />
            <p className={l.caption}>{useItem.description}</p>
            <div className={l.row}>
              <Button size="sm" variant="primary" disabled={maxTimes < 1} busy={useBusy} onClick={() => submitUse(1)}>
                Use
              </Button>
              {multi && maxTimes >= 5 && (
                <Button size="sm" disabled={useBusy} onClick={() => submitUse(5)}>
                  Use ×5
                </Button>
              )}
              {multi && maxTimes >= 10 && (
                <Button size="sm" disabled={useBusy} onClick={() => submitUse(10)}>
                  Use ×10
                </Button>
              )}
              {multi && maxTimes < 1 && <span className={l.caption}>Already level 100.</span>}
            </div>
          </>
        )}
      </section>

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Setup</h4>
        <div className={s.setup}>
          <Select label="Ability" value={abilityId} options={abilityOptions} onChange={setAbilityId} />
          <Select label="Held item" value={held} options={heldOptions} onChange={setHeld} />
        </div>
        {currentAbility !== undefined && <p className={l.caption}>{currentAbility.description}</p>}
        {held !== '' && <p className={l.caption}>{itemInfo(held).description}</p>}
        <div className={l.row}>
          <Button
            size="sm"
            variant="primary"
            disabled={!setupDirty}
            busy={busyFor('setup')}
            onClick={() => fetcher.submit({ intent: 'setup', id: c.id, ability: abilityId, heldItem: held })}
          >
            Save setup
          </Button>
        </div>
      </section>

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Identity</h4>
        <div className={s.nickRow}>
          <TextField label="Nickname" value={nickname} onChange={setNickname} maxLength={16} placeholder={sp?.name ?? ''} className={l.grow} />
          <Button
            size="md"
            disabled={!nickDirty}
            busy={busyFor('nickname')}
            onClick={() => fetcher.submit({ intent: 'nickname', id: c.id, nickname: nickname.trim() })}
          >
            Rename
          </Button>
        </div>
        <Toggle
          label="Favourite"
          description="Pinned to the top of your box."
          checked={c.favorite}
          disabled={busyFor('flags')}
          onChange={(v) => fetcher.submit({ intent: 'flags', id: c.id, favorite: v })}
        />
        <Toggle
          label="Locked"
          description="Locked creatures cannot be released, traded or listed."
          checked={c.locked}
          disabled={busyFor('flags')}
          onChange={(v) => fetcher.submit({ intent: 'flags', id: c.id, locked: v })}
        />
      </section>

      <div className={s.footer}>
        {extraActions}
        <div className={s.releaseWrap}>
          <Button variant="danger" size="sm" icon="close" disabled={c.locked || isLastInParty} onClick={() => setConfirmRelease(true)}>
            Release
          </Button>
          {(c.locked || isLastInParty) && <span className={l.caption}>{c.locked ? 'Unlock to release' : 'Last party member'}</span>}
        </div>
      </div>

      <Modal
        open={confirmRelease}
        title={`Release ${displayName(c)}?`}
        size="sm"
        onClose={() => setConfirmRelease(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRelease(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              busy={busyFor('release')}
              onClick={() => {
                fetcher.submit({ intent: 'release', id: c.id });
                setConfirmRelease(false);
              }}
            >
              <Icon name="close" size="sm" /> Release for good
            </Button>
          </>
        }
      >
        <p className={l.body}>
          It returns to the wild and leaves your records. Your dex keeps the entry — this one cannot be quietly lost — but the creature itself
          will be gone.
        </p>
      </Modal>
    </aside>
  );
}
