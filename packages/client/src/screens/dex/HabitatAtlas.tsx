/**
 * The habitat atlas (`/play/dex?view=habitat`, 2026-10-26): every zone with a wild roster in story order, its species
 * split by when and where they turn up (day, night, any hour, water), unknown ones as silhouettes, a "recorded x / y"
 * bar per zone, plus the legend that waits there and the raid boss. A pick opens the entry.
 */
import { LEGENDARY_STATICS, RAID_HOTSPOTS } from '@ewa/content';
import type { BadgeId, ZoneId } from '@ewa/content';
import type { SpeciesDef } from '@ewa/core';
import { species, zoneName } from '../../data/content';
import { HABITAT_ZONES, zoneRoster } from '../../data/dexInfo';
import type { DexState, Habitat } from '../../data/dexInfo';
import { CreatureSprite } from '../../ui/CreatureSprite';
import { Icon } from '../../ui/Icon';
import { ProgressBar } from '../../ui/ProgressBar';
import { cx } from '../../ui/cx';
import s from './HabitatAtlas.module.css';

type Slot = 'day' | 'night' | 'any' | 'water';
const SLOT_LABEL: Readonly<Record<Slot, string>> = { any: 'Any hour', day: 'By day', night: 'At night', water: 'On the water' };
const SLOTS: readonly Slot[] = ['any', 'day', 'night', 'water'];

function slotOf(h: Habitat): Slot {
  if (h.water && !h.land) return 'water';
  return h.time;
}

export function HabitatAtlas({ stateOf, badges, onPick }: {
  readonly stateOf: (id: string) => DexState;
  readonly badges: readonly BadgeId[];
  readonly onPick: (id: string) => void;
}) {
  return (
    <div className={s.atlas} data-testid="dex-atlas">
      {HABITAT_ZONES.map((z) => (
        <ZoneCard key={z} zoneId={z} stateOf={stateOf} open={zoneOpen(z, badges)} onPick={onPick} />
      ))}
    </div>
  );
}

function zoneOpen(zoneId: ZoneId, badges: readonly BadgeId[]): boolean {
  const roster = zoneRoster(zoneId);
  const gate = roster[0]?.habitat.gate ?? null;
  return gate === null || badges.includes(gate);
}

function ZoneCard({ zoneId, stateOf, open, onPick }: { readonly zoneId: ZoneId; readonly stateOf: (id: string) => DexState; readonly open: boolean; readonly onPick: (id: string) => void }) {
  const roster = zoneRoster(zoneId);
  const legends = LEGENDARY_STATICS.filter((st) => st.zoneId === zoneId).map((st) => species(st.species)).filter((x): x is SpeciesDef => x !== undefined);
  const raids = RAID_HOTSPOTS.filter((r) => r.zoneId === zoneId).map((r) => species(r.boss.species)).filter((x): x is SpeciesDef => x !== undefined);
  const recorded = roster.filter((r) => stateOf(r.sp.id) === 'caught').length;
  const seen = roster.filter((r) => stateOf(r.sp.id) !== 'unknown').length;
  const done = recorded === roster.length;
  return (
    <section className={cx(s.zone, !open && s.closed, done && s.done)} aria-label={zoneName(zoneId)}>
      <header className={s.head}>
        <h4 className={s.name}>
          {!open && <Icon name="lock" size="sm" label="Needs a badge you do not hold" />}
          {zoneName(zoneId)}
        </h4>
        <span className={s.count}>
          {done && <Icon name="check" size="sm" />}
          {recorded} / {roster.length} recorded
        </span>
      </header>
      <ProgressBar value={recorded / Math.max(1, roster.length)} secondary={seen / Math.max(1, roster.length)} label={`${zoneName(zoneId)} completion`} valueText={`${recorded} of ${roster.length} recorded`} />
      <div className={s.slots}>
        {SLOTS.map((slot) => {
          const here = roster.filter((r) => slotOf(r.habitat) === slot);
          if (here.length === 0) return null;
          return (
            <div key={slot} className={s.slot}>
              <span className={s.slotLabel}>
                {slot === 'day' && <Icon name="sun" size="sm" />}
                {slot === 'night' && <Icon name="moon" size="sm" />}
                {SLOT_LABEL[slot]}
              </span>
              <ul className={s.mons}>
                {here.map(({ sp, habitat }) => (
                  <Mon key={sp.id} sp={sp} state={stateOf(sp.id)} onPick={onPick} note={habitat.levelMin === habitat.levelMax ? `Lv ${habitat.levelMin}` : `Lv ${habitat.levelMin} to ${habitat.levelMax}`} />
                ))}
              </ul>
            </div>
          );
        })}
        {(legends.length > 0 || raids.length > 0) && (
          <div className={s.slot}>
            <span className={s.slotLabel}>
              <Icon name="star" size="sm" /> Legends and raids
            </span>
            <ul className={s.mons}>
              {legends.map((sp) => (
                <Mon key={sp.id} sp={sp} state={stateOf(sp.id)} onPick={onPick} note="Waits here once" />
              ))}
              {raids.map((sp) => (
                <Mon key={`raid_${sp.id}`} sp={sp} state={stateOf(sp.id)} onPick={onPick} note="Raid boss" />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Mon({ sp, state, onPick, note }: { readonly sp: SpeciesDef; readonly state: DexState; readonly onPick: (id: string) => void; readonly note: string }) {
  const known = state !== 'unknown';
  return (
    <li>
      <button
        type="button"
        className={cx(s.mon, s[state])}
        data-type={known ? sp.types[0] : undefined}
        onClick={() => onPick(sp.id)}
        aria-label={known ? `${sp.name}, ${state === 'caught' ? 'recorded' : 'seen'}` : `Unknown entry ${sp.dexNumber}`}
        title={note}
      >
        <CreatureSprite speciesId={sp.id} size="md" silhouette={!known} desaturate={state === 'seen'} />
        <span className={s.monName}>{known ? sp.name : '???'}</span>
        <span className={s.monNote}>{note}</span>
      </button>
    </li>
  );
}
