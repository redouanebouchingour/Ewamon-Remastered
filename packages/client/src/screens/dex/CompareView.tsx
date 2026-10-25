/**
 * Compare two species (`/play/dex?cmp=a,b`, 2026-10-26): stats on mirrored bars with the higher side lit, types and
 * weak spots side by side, the moves both can learn and the ones only one can, and where each lives. Only species the
 * player may compare (`dexAccess(...).compare`) can be picked.
 */
import type { SpeciesDef } from '@ewa/core';
import { species, zoneName } from '../../data/content';
import { MAX_BASE_STAT, baseStats, defensiveMatchups, habitatsOf, levelUpMoves, multLabel, statTotal, tmMoves } from '../../data/dexInfo';
import { Button } from '../../ui/Button';
import { CreatureSprite } from '../../ui/CreatureSprite';
import { Select } from '../../ui/Field';
import { TypeBadge } from '../../ui/TypeBadge';
import { cssVars } from '../../ui/cssVars';
import { cx } from '../../ui/cx';
import l from '../layout.module.css';
import s from './CompareView.module.css';

const STAT_ROWS = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'spd', label: 'SPD' },
] as const;

function learnable(sp: SpeciesDef): Set<string> {
  return new Set([...levelUpMoves(sp).map((r) => r.move.id), ...tmMoves(sp).map((m) => m.id)]);
}

export function CompareView({ ids, choices, onChange, onOpen, onClose }: {
  /** one or two species ids */
  readonly ids: readonly string[];
  /** the species that may be picked, in dex order */
  readonly choices: readonly SpeciesDef[];
  readonly onChange: (ids: readonly string[]) => void;
  readonly onOpen: (id: string) => void;
  readonly onClose: () => void;
}) {
  const a = species(ids[0] ?? '');
  const b = species(ids[1] ?? '');
  const options = [{ value: '', label: 'Pick a species' }, ...choices.map((c) => ({ value: c.id, label: `#${String(c.dexNumber).padStart(3, '0')} ${c.name}` }))];
  const side = (i: 0 | 1, sp: SpeciesDef | undefined) => (
    <div className={s.side}>
      <Select
        label={i === 0 ? 'First species' : 'Second species'}
        hideLabel
        value={sp?.id ?? ''}
        options={options}
        onChange={(v) => onChange(i === 0 ? [v, ids[1] ?? ''] : [ids[0] ?? '', v])}
      />
      {sp !== undefined && (
        <button type="button" className={s.card} data-type={sp.types[0]} onClick={() => onOpen(sp.id)} aria-label={`Open ${sp.name}`}>
          <CreatureSprite speciesId={sp.id} size="xl" />
          <span className={s.name}>{sp.name}</span>
          <span className={l.row}>
            {sp.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className={s.compare} data-testid="dex-compare">
      <div className={s.top}>
        {side(0, a)}
        <span className={s.vs}>VS</span>
        {side(1, b)}
      </div>
      <div className={s.closeRow}>
        <Button variant="ghost" size="sm" icon="close" onClick={onClose}>
          Close compare
        </Button>
      </div>
      {a !== undefined && b !== undefined ? <Sheets a={a} b={b} /> : <p className={l.muted}>Pick a second species to set beside it.</p>}
    </div>
  );
}

function Sheets({ a, b }: { readonly a: SpeciesDef; readonly b: SpeciesDef }) {
  const sa = baseStats(a);
  const sb = baseStats(b);
  const la = learnable(a);
  const lb = learnable(b);
  const shared = [...la].filter((m) => lb.has(m)).sort();
  const onlyA = [...la].filter((m) => !lb.has(m)).sort();
  const onlyB = [...lb].filter((m) => !la.has(m)).sort();
  const rows = [...STAT_ROWS.map((r) => ({ label: r.label, va: sa[r.key], vb: sb[r.key], max: MAX_BASE_STAT })), { label: 'Total', va: statTotal(a), vb: statTotal(b), max: MAX_BASE_STAT * 4 }];
  return (
    <>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Base stats</h4>
        <div className={s.stats}>
          {rows.map((r) => (
            <div key={r.label} className={s.statRow}>
              <span className={cx(s.val, s.left, r.va > r.vb && s.win)}>{r.va}</span>
              <span className={cx(s.bar, s.barLeft)}>
                <span className={cx(s.fill, r.va > r.vb && s.fillWin)} style={cssVars({ '--p': Math.min(1, r.va / r.max) })} />
              </span>
              <span className={s.label}>{r.label}</span>
              <span className={s.bar}>
                <span className={cx(s.fill, r.vb > r.va && s.fillWin)} style={cssVars({ '--p': Math.min(1, r.vb / r.max) })} />
              </span>
              <span className={cx(s.val, r.vb > r.va && s.win)}>{r.vb}</span>
            </div>
          ))}
        </div>
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Weak to</h4>
        <div className={s.two}>
          {[a, b].map((sp) => (
            <div key={sp.id} className={s.matchCol}>
              {defensiveMatchups(sp.types)
                .filter((m) => m.mult > 1)
                .map((m) => (
                  <p key={m.mult} className={s.matchLine}>
                    <b className={s.mult}>{multLabel(m.mult)}</b>
                    {m.types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" compact />
                    ))}
                  </p>
                ))}
            </div>
          ))}
        </div>
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Moves · {shared.length} shared</h4>
        <div className={s.three}>
          <MoveCol title={`Only ${a.name}`} moves={onlyA} />
          <MoveCol title="Both" moves={shared} />
          <MoveCol title={`Only ${b.name}`} moves={onlyB} />
        </div>
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Lives in</h4>
        <div className={s.two}>
          {[a, b].map((sp) => {
            const hs = habitatsOf(sp.id);
            return (
              <p key={sp.id} className={l.body}>
                {hs.length === 0 ? 'Not found in the wild.' : hs.map((h) => zoneName(h.zoneId)).join(' · ')}
              </p>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MoveCol({ title, moves }: { readonly title: string; readonly moves: readonly string[] }) {
  return (
    <div className={s.moveCol}>
      <span className={s.moveTitle}>
        {title} · {moves.length}
      </span>
      <ul className={s.moves}>
        {moves.map((m) => (
          <li key={m} className={s.move}>
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
