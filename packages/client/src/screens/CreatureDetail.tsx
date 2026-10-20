/**
 * The selected creature's detail column (SPEC §20.9.3, reused by Box §20.9.4): stats "at level" (core calcStat —
 * display only), four MoveButtons with PP, ability + held item (`POST /creature/:id/setup`), nickname
 * (`/nickname`), favourite/lock (`/flags`), release (danger, confirm modal, refused when locked); the honor ledger of
 * a creature whose evolution it decides (dustcub, core honor.ts); its history (original trainer and events, `CreatureHistory`).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { HONOR_DELTAS, HONOR_MAX, HONOR_MIN, MAX_LEVEL, evolutionTarget, expToLevel, tracksHonor } from '@ewa/core';
import type { CreatureInstance, SpeciesDef } from '@ewa/core';
import { CREATURE_ITEMS, HELD_ITEMS, MULTI_USE_ITEMS, STONE_IDS, ability as abilityDef, displayName, itemInfo, maxHpOf, move as moveDef, species, statsOf, stoneTarget } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { badgesOf } from '../ui/CreatureCard';
import { CreatureSprite } from '../ui/CreatureSprite';
import { cssVars } from '../ui/cssVars';
import { cx } from '../ui/cx';
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
import { CreatureHistory } from './CreatureHistory';
import { TeachSection } from './TeachSection';
import { isFallen } from '@ewa/content';

export interface CreatureDetailProps {
  readonly creature: CreatureInstance;
  readonly fetcher: IntentFetcher;
  /** screen-specific actions (Withdraw / Deposit) */
  readonly extraActions?: ReactNode;
  /** the last party member cannot be released or deposited */
  readonly isLastInParty?: boolean;
  /**
   * `column` (Box, default): one scrolling column. `band` (Party, Broadcast 2026-10-11): a full-width band with
   * identity, stats and moves side by side, then the tools (teach, items, setup, identity) as label-strip cards.
   */
  readonly layout?: 'column' | 'band';
  /** the party slot (1-based), shown in the band's identity label */
  readonly slot?: number;
}

const MAX_BASE = 150;

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

const STAT_SHORT: Readonly<Record<string, string>> = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };

/** Stats at level as big tabular numbers beside a skewed bar of the species' base stat (display only, core calcStat). */
function StatRows({ creature: c }: { readonly creature: CreatureInstance }) {
  return (
    <div className={s.stats}>
      {statsOf(c).map((st) => (
        <div key={st.key} className={s.stat}>
          <abbr className={s.statLabel} title={st.label}>
            {STAT_SHORT[st.key] ?? st.label}
          </abbr>
          <span className={s.statValue}>{st.value}</span>
          <div className={l.statTrack} title={`Base ${st.base}`}>
            <div className={l.statFill} style={cssVars({ '--p': Math.min(1, st.base / MAX_BASE) })} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Progress to the next level from the total exp (core expToLevel: this level's floor and the next one's). */
function ExpRow({ creature: c }: { readonly creature: CreatureInstance }) {
  const max = c.level >= MAX_LEVEL;
  const lo = expToLevel(c.level);
  const hi = expToLevel(c.level + 1);
  const frac = max ? 1 : Math.min(1, Math.max(0, (c.exp - lo) / Math.max(1, hi - lo)));
  const left = Math.max(0, hi - c.exp);
  return (
    <div className={s.exp}>
      <span className={l.kvLabel}>Exp</span>
      <span className={s.expTrack} aria-hidden>
        <span className={s.expFill} style={cssVars({ '--p': frac })} />
      </span>
      <span className={s.expText}>{max ? 'Max level' : `${left.toLocaleString('en-US')} to Lv ${c.level + 1}`}</span>
    </div>
  );
}

/** The four moves as type-tagged rows: a type-colour edge, the name, its type, power and PP. */
function MoveRows({ creature: c }: { readonly creature: CreatureInstance }) {
  return (
    <ul className={s.moveRows} aria-label="Moves">
      {c.moves.map((m) => {
        const def = moveDef(m.id);
        if (def === undefined) return null;
        const low = m.ppMax > 0 && m.pp / m.ppMax <= 0.25;
        return (
          <li key={m.id} className={s.moveRow} data-type={def.type}>
            <span className={s.moveName}>{def.id}</span>
            <span className={s.moveMeta}>
              <span className={s.moveType}>{def.type}</span>
              <span>{def.power > 0 ? `Pow ${def.power}` : 'Status'}</span>
              <span className={cx(s.movePp, low && s.movePpLow)}>
                {m.pp}
                <span className={s.movePpMax}>/{m.ppMax} PP</span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The honor ledger (core honor.ts): where the creature stands between outlaw and lawman, and what its evolution will be. */
export function HonorLedger({ creature: c, sp }: { readonly creature: CreatureInstance; readonly sp: SpeciesDef }) {
  const evo = sp.evolution;
  if (evo === null || evo.kind !== 'split') return null;
  const honor = c.honor ?? 0;
  const into = species(evolutionTarget(evo, c.ability, honor) ?? '')?.name ?? null;
  const lawful = honor >= 0;
  return (
    <section className={l.section} aria-label="Honor">
      <h4 className={l.sectionTitle}>Honor</h4>
      <div className={s.honor}>
        <span className={l.kvLabel}>Outlaw</span>
        <div className={s.honorTrack} role="meter" aria-valuemin={HONOR_MIN} aria-valuemax={HONOR_MAX} aria-valuenow={honor} aria-label={`Honor ${signed(honor)}`}>
          <div className={s.honorMark} data-lawful={lawful} style={cssVars({ '--p': (honor - HONOR_MIN) / (HONOR_MAX - HONOR_MIN) })} />
        </div>
        <span className={l.kvLabel}>Lawman</span>
      </div>
      <p className={l.caption}>
        <strong className={l.kvValue}>{signed(honor)}</strong>{' '}
        {into !== null ? `At level ${evo.atLevel} it becomes ${into}${c.level >= evo.atLevel ? ' when it evolves' : ''}.` : ''} Dark-type hits {HONOR_DELTAS.dirtyTrick}, knocking out a wild creature {HONOR_DELTAS.wildKo},
        catching one while it stands on the field +{HONOR_DELTAS.spared}, winning a trainer duel +{HONOR_DELTAS.duelWon}.
      </p>
    </section>
  );
}

export function CreatureDetail({ creature: c, fetcher, extraActions, isLastInParty = false, layout = 'column', slot }: CreatureDetailProps) {
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
  const band = layout === 'band';
  const name = displayName(c);
  const dexNo = sp !== undefined ? String(sp.dexNumber).padStart(3, '0') : null;

  const typeRow = (
    <div className={l.row}>
      {sp?.types.map((t) => <TypeBadge key={t} type={t} />)}
      {c.variantKey !== 'normal' && <Pill tone="info">{c.variantKey}</Pill>}
      {badgesOf(c).includes('alpha') && <Pill tone="danger">Alpha</Pill>}
    </div>
  );

  const useItemSection = (
    <section className={l.section}>
      <h4 className={band ? l.labelStrip : l.sectionTitle}>Use an item</h4>
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
  );

  const setupSection = (
    <section className={l.section}>
      <h4 className={band ? l.labelStrip : l.sectionTitle}>Setup</h4>
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
  );

  // challenge modes: a fallen creature takes no item (a revive included) and never fights again
  const fallen = isFallen(c);
  const fallenNote = (
    <section className={l.section}>
      <h4 className={band ? l.labelStrip : l.sectionTitle}>Fallen</h4>
      <p className={l.caption}>It fell in your challenge run. It stays with you, but no item brings it back and it never fights again.</p>
    </section>
  );

  const identitySection = (
    <section className={l.section}>
      <h4 className={band ? l.labelStrip : l.sectionTitle}>Identity</h4>
      <div className={s.nickRow}>
        <TextField label="Nickname" value={nickname} onChange={setNickname} maxLength={16} placeholder={sp?.name ?? ''} className={l.grow} />
        <Button size="md" disabled={!nickDirty} busy={busyFor('nickname')} onClick={() => fetcher.submit({ intent: 'nickname', id: c.id, nickname: nickname.trim() })}>
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
  );

  const release = (
    <div className={s.releaseWrap}>
      <Button variant="danger" size="sm" icon="close" disabled={c.locked || isLastInParty} onClick={() => setConfirmRelease(true)}>
        Release
      </Button>
      {(c.locked || isLastInParty) && <span className={l.caption}>{c.locked ? 'Unlock to release' : 'Last party member'}</span>}
    </div>
  );

  const releaseModal = (
    <Modal
      open={confirmRelease}
      title={`Release ${name}?`}
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
        It returns to the wild and leaves your records. Your dex keeps the entry — this one cannot be quietly lost — but the creature itself will be
        gone.
      </p>
    </Modal>
  );

  if (band) {
    return (
      <aside className={s.band} data-type={sp?.types[0] ?? 'Normal'} aria-label={`${name} details`}>
        <div className={s.bandMain}>
          <div className={s.bandCol}>
            <p className={s.idLabel}>
              {dexNo !== null ? `Dex #${dexNo}` : c.speciesId}
              {slot !== undefined ? ` · Slot ${slot}` : ''}
            </p>
            <h3 className={s.bandName}>{name}</h3>
            <p className={s.bandSub}>
              {c.nickname !== null ? `${sp?.name ?? c.speciesId} · ` : ''}Level <b className={s.bandLevel}>{c.level}</b>
            </p>
            {typeRow}
            {sp !== undefined && sp.flavor !== '' && <p className={s.flavour}>{sp.flavor}</p>}
            <div className={s.bandHp}>
              <HpBar hp={c.hp} maxHp={maxHpOf(c)} showNumbers status={c.status} />
            </div>
          </div>
          <div className={s.bandCol}>
            <h4 className={l.sectionTitle}>Stats at level {c.level}</h4>
            <StatRows creature={c} />
            {sp !== undefined && tracksHonor(sp) && <HonorLedger creature={c} sp={sp} />}
            <ExpRow creature={c} />
          </div>
          <div className={s.bandCol}>
            <h4 className={l.sectionTitle}>Moves</h4>
            <MoveRows creature={c} />
            {extraActions !== undefined && <div className={s.bandActions}>{extraActions}</div>}
          </div>
        </div>
        <div className={s.tools}>
          <div className={s.tool}>
            <TeachSection creature={c} fetcher={fetcher} />
          </div>
          <div className={s.tool}>{fallen ? fallenNote : useItemSection}</div>
          <div className={s.tool}>{setupSection}</div>
          <div className={s.tool}>
            {identitySection}
            <div className={s.toolFoot}>{release}</div>
          </div>
          <div className={s.tool}>
            <CreatureHistory creatureId={c.id} strip />
          </div>
        </div>
        {releaseModal}
      </aside>
    );
  }

  return (
    <aside className={l.detail} data-type={sp?.types[0] ?? 'Normal'} aria-label={`${name} details`}>
      <div className={l.detailHead}>
        <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="xl" />
        <div className={l.detailTitle}>
          <h3 className={l.h2}>{name}</h3>
          <p className={l.muted}>
            {c.nickname !== null ? `${sp?.name ?? c.speciesId} · ` : ''}Level {c.level}
            {dexNo !== null ? ` · #${dexNo}` : ''}
          </p>
          {typeRow}
        </div>
      </div>

      <HpBar hp={c.hp} maxHp={maxHpOf(c)} showNumbers status={c.status} />

      <section className={l.section}>
        <h4 className={l.sectionTitle}>Stats at level {c.level}</h4>
        <StatRows creature={c} />
      </section>

      {sp !== undefined && tracksHonor(sp) && <HonorLedger creature={c} sp={sp} />}

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

      {fallen ? fallenNote : useItemSection}
      {setupSection}
      {identitySection}
      <CreatureHistory creatureId={c.id} />

      <div className={s.footer}>
        {extraActions}
        {release}
      </div>

      {releaseModal}
    </aside>
  );
}
