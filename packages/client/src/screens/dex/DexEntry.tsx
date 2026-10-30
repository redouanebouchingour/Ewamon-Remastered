/**
 * One Dex entry (2026-10-26 redesign): a hero with the creature on its type slab, a view switcher (base, its battle
 * forms, the variants, shiny, alpha) and tabs bound to `?tab=`: Overview, Moves, Matchups, Habitat, Evolution and
 * Forms. What a tab shows follows `dexAccess`: a seen species shows its types, flavour, habitats and line; recording it
 * opens stats, abilities and forms; research opens moves, matchups and the evolution conditions.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { RELICS, RESEARCH_LEVEL_POINTS, RESEARCH_MAX_LEVEL, isOg2022, researchProgressOf } from '@ewa/content';
import { VARIANT_KEYS } from '@ewa/protocol';
import type { BattleFormDef, SpeciesDef, TypeName, VariantKey } from '@ewa/core';
import { hushEntry, playCry, readEntry } from '../../audio/dexVoice';
import { ability, move, speciesName, zoneName } from '../../data/content';
import {
  MAX_BASE_STAT,
  RESEARCH_GATE,
  baseStats,
  defensiveMatchups,
  dexAccess,
  evoLabel,
  evoSentence,
  evolutionTree,
  formsOfSpecies,
  habitatsOf,
  levelUpMoves,
  multLabel,
  originsOf,
  statTotal,
  strongAgainst,
  tmMoves,
  tutorMoves,
  unlockHint,
} from '../../data/dexInfo';
import type { DexState, EvoNode, Habitat, Origin } from '../../data/dexInfo';
import { useDexPrefs } from '../../state/dexPrefs';
import { useSessionStore } from '../../state/session';
import { Button } from '../../ui/Button';
import { CreatureSprite } from '../../ui/CreatureSprite';
import { FORM_KIND_NAME, FormSigil, formMarkLabel } from '../../ui/FormSigil';
import { Icon } from '../../ui/Icon';
import { MoveButton } from '../../ui/MoveButton';
import { Tabs } from '../../ui/Tabs';
import { TypeBadge } from '../../ui/TypeBadge';
import { cssVars } from '../../ui/cssVars';
import { cx } from '../../ui/cx';
import { RoamerNote } from '../RoamerNote';
import l from '../layout.module.css';
import s from './DexEntry.module.css';

export type EntryTab = 'overview' | 'research' | 'moves' | 'matchups' | 'habitat' | 'evolution' | 'forms';
const EMPTY: readonly string[] = [];

/** Majin / Tenjin: the form's rule in one line */
const FORM_RULE: Readonly<Record<'majin' | 'tenjin', string>> = {
  majin: `With the ${FORM_KIND_NAME.majin} Band, it breaks open below half HP. Once a battle.`,
  tenjin: `With the ${FORM_KIND_NAME.tenjin} Band, it ascends at or above half HP. Once a battle.`,
};

function relicName(id: string | undefined): string {
  return RELICS.find((r) => r.id === id)?.name ?? 'right relic';
}

/** How a form opens, in one line. */
function formRule(f: BattleFormDef): string {
  if (f.heldItem !== undefined) return `Holding the ${relicName(f.heldItem)}${f.hpBelowPct !== undefined ? `, below ${f.hpBelowPct}% HP` : ', as it enters the field'}.`;
  if (f.kind !== undefined) return FORM_RULE[f.kind];
  return `It changes on its own below ${f.hpBelowPct ?? 50}% HP.`;
}

const STAT_WORD: Readonly<Record<string, string>> = { atk: 'Attack', def: 'Defense', spd: 'Speed', acc: 'Accuracy', eva: 'Evasion' };

/** What happens the moment a form opens, as short sentences. */
function formEffects(f: BattleFormDef): string[] {
  const out: string[] = [];
  if (f.onEnter.clearNegativeStages) out.push('Its lowered stats return to normal.');
  if (f.onEnter.lowerFoes !== null) {
    const n = f.onEnter.lowerFoes.stages;
    out.push(`Every foe loses ${n} ${STAT_WORD[f.onEnter.lowerFoes.stat] ?? f.onEnter.lowerFoes.stat} stage${n === 1 ? '' : 's'}.`);
  }
  if (f.onEnter.cureStatus === true) out.push('Its status is cured.');
  if (f.onEnter.healFraction !== undefined) out.push(`It heals ${Math.round(f.onEnter.healFraction * 100)}% of its HP.`);
  return out;
}

export interface DexEntryProps {
  readonly sp: SpeciesDef;
  readonly state: DexState;
  /** the research level, once the server reports one */
  readonly research?: number;
  /** the entry's research counters (GET /dex `entries`) */
  readonly counters?: Readonly<Record<string, number>>;
  readonly variants: readonly VariantKey[];
  readonly alpha: boolean;
  readonly shiny: boolean;
  readonly recordedIn: readonly string[];
  /** open another species' entry */
  readonly onOpen: (id: string) => void;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  /** extra actions in the hero (compare, voice) */
  readonly actions?: ReactNode;
  /** play the reveal: the first opening since it was seen or recorded */
  readonly reveal?: 'seen' | 'recorded' | null;
}

/** The hero's view: the base form or one of its battle forms, a variant, shiny, alpha. */
interface View {
  readonly form: string | null;
  readonly variant: VariantKey;
  readonly shiny: boolean;
  readonly alpha: boolean;
}

export function DexEntry({ sp, state, research, counters, variants, alpha, shiny, recordedIn, onOpen, onPrev, onNext, actions, reveal = null }: DexEntryProps) {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>({ form: null, variant: 'normal', shiny: false, alpha: false });
  useEffect(() => hushEntry, []);
  const listen = (): void => {
    void playCry(sp).then((played) => {
      const read = (): void => void readEntry(sp);
      if (played) setTimeout(read, 650);
      else read();
    });
  };
  const access = dexAccess(state, research);
  const forms = formsOfSpecies(sp);
  const form = forms.find((f) => f.id === view.form) ?? null;
  const types: readonly TypeName[] = form?.types ?? sp.types;
  const num = `#${String(sp.dexNumber).padStart(3, '0')}`;

  if (state === 'unknown') {
    return (
      <aside className={cx(s.entry, s.unknownEntry)} data-testid="dex-entry" aria-label={`Unknown entry ${sp.dexNumber}`}>
        <header className={s.hero}>
          <div className={s.stage}>
            <CreatureSprite speciesId={sp.id} size="xxl" silhouette />
          </div>
          <div className={s.title}>
            <EntryNav num={num} caption="Unknown" onPrev={onPrev} onNext={onNext} />
            <h3 className={s.name}>Unknown</h3>
            <p className={l.muted}>Not yet witnessed. Somewhere out there, it is waiting.</p>
          </div>
        </header>
      </aside>
    );
  }

  const tabs: { key: EntryTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...(research !== undefined ? [{ key: 'research' as const, label: 'Research' }] : []),
    { key: 'moves', label: 'Moves' },
    { key: 'matchups', label: 'Matchups' },
    { key: 'habitat', label: 'Habitat' },
    { key: 'evolution', label: 'Evolution' },
    ...(forms.length > 0 ? [{ key: 'forms' as const, label: 'Forms' }] : []),
  ];
  const asked = params.get('tab') as EntryTab | null;
  const tab: EntryTab = tabs.some((t) => t.key === asked) ? asked! : 'overview';
  const setTab = (t: EntryTab): void =>
    setParams(
      (p) => {
        if (t === 'overview') p.delete('tab');
        else p.set('tab', t);
        return p;
      },
      { replace: true },
    );

  return (
    <aside className={cx(s.entry, access.goldFrame && s.gold)} data-type={types[0]} data-testid="dex-entry" aria-label={`${sp.name} entry`}>
      <header className={s.hero}>
        <div className={cx(s.stage, view.alpha && s.alphaStage, reveal !== null && s.revealing)} data-testid={reveal !== null ? 'dex-reveal' : undefined}>
          {reveal !== null && (
            <span className={s.revealStamp} aria-live="polite">
              {reveal === 'recorded' ? 'Recorded' : 'Seen'}
            </span>
          )}
          <CreatureSprite
            speciesId={sp.id}
            form={access.forms ? view.form : null}
            variantKey={access.forms ? view.variant : 'normal'}
            shiny={access.forms && view.shiny}
            size="xxl"
            desaturate={state === 'seen'}
            animated
            className={cx(view.alpha && s.alphaSprite)}
          />
          {view.alpha && (
            <span className={s.alphaTag}>
              <Icon name="alpha" size="sm" /> Alpha
            </span>
          )}
        </div>
        <div className={s.title}>
          <EntryNav num={num} caption={sp.role} onPrev={onPrev} onNext={onNext} />
          <h3 className={s.name}>{sp.name}</h3>
          {form !== null && <p className={s.formLabel}>{form.name}</p>}
          <div className={l.row}>
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <span className={cx(s.rarity, s[`r_${sp.rarity}`])}>{sp.rarity}</span>
            {isOg2022(sp.id) && (
              <span className={s.og} title="One of the twelve originals, drawn for the very first Ewamon (HvA EWA project, 2022)" data-testid="dex-og">
                OG 2022
              </span>
            )}
            <span className={s.height} title="How tall it stands, as it is drawn in the world" data-testid="dex-height">
              {formatHeight(creatureHeightM(sp, form, view.alpha))}
            </span>
            {research !== undefined && state === 'caught' && <ResearchStamp level={research} />}
          </div>
          <p className={cx(s.verdict, state === 'caught' ? s.recorded : s.seenOnly)}>
            <Icon name={state === 'caught' ? 'shield' : 'eye'} size="sm" />
            {state === 'caught' ? 'Recorded, this one cannot be quietly lost.' : 'Seen, not yet recorded.'}
          </p>
          <div className={s.actions}>
            <Button variant="secondary" size="sm" icon="play" onClick={listen} title="Its cry, then its entry read aloud">
              Listen
            </Button>
            {actions}
          </div>
        </div>
        {access.forms && (forms.length > 0 || state === 'caught') && (
          <ViewSwitcher forms={forms} view={view} setView={setView} recordedVariants={variants} alphaRecorded={alpha} shinyRecorded={shiny} />
        )}
      </header>

      <Tabs<EntryTab> tabs={tabs} value={tab} onChange={setTab} label="Entry" className={s.tabs} />
      <div className={s.panel} role="tabpanel" aria-label={tabs.find((t) => t.key === tab)?.label}>
        {tab === 'overview' && <Overview sp={sp} form={form} state={state} access={access} variants={variants} alpha={alpha} shiny={shiny} recordedIn={recordedIn} />}
        {tab === 'research' && research !== undefined && <ResearchTab sp={sp} level={research} counters={counters ?? {}} />}
        {tab === 'moves' && (access.moves ? <Moves sp={sp} /> : <Locked text={unlockHint(state, RESEARCH_GATE.moves)} />)}
        {tab === 'matchups' && (access.matchups ? <Matchups types={types} formName={form?.name ?? null} /> : <Locked text={unlockHint(state, RESEARCH_GATE.matchups)} />)}
        {tab === 'habitat' && <HabitatTab sp={sp} />}
        {tab === 'evolution' && <Evolution sp={sp} conditions={access.evoConditions} state={state} onOpen={onOpen} />}
        {tab === 'forms' && (access.forms ? <Forms sp={sp} forms={forms} /> : <Locked text={unlockHint(state, null)} />)}
      </div>
    </aside>
  );
}

/** An alpha stands this much taller (render `BILLBOARD.alphaScale`; the dex does not load the renderer). */
const ALPHA_SCALE = 1.12;

/** How tall the creature on show stands (m): the form's own height when it names one, an alpha's ALPHA_SCALE ×. */
export function creatureHeightM(sp: SpeciesDef, form: BattleFormDef | null, alpha: boolean): number {
  return (form?.heightM ?? sp.heightM) * (alpha ? ALPHA_SCALE : 1);
}

/** 0.45 m, 1.2 m, 2.0 m: two decimals under a metre, one above. */
export function formatHeight(m: number): string {
  return m < 1 ? `${Number(m.toFixed(2))} m` : `${m.toFixed(1)} m`;
}

function EntryNav({ num, caption, onPrev, onNext }: { readonly num: string; readonly caption: string; readonly onPrev?: () => void; readonly onNext?: () => void }) {
  return (
    <div className={s.nav}>
      <p className={l.caption}>
        {num} · {caption}
      </p>
      <span className={s.navButtons}>
        <Button variant="ghost" size="sm" icon="chevronLeft" ariaLabel="Previous entry" title="Previous entry ( [ )" onClick={onPrev} disabled={onPrev === undefined}>
          Prev
        </Button>
        <Button variant="ghost" size="sm" icon="chevronRight" ariaLabel="Next entry" title="Next entry ( ] )" onClick={onNext} disabled={onNext === undefined}>
          Next
        </Button>
      </span>
    </div>
  );
}

export function ResearchStamp({ level }: { readonly level: number }) {
  const look = useDexPrefs((st) => st.stamp);
  return (
    <span className={cx(s.stamp, level >= RESEARCH_GATE.goldFrame && s.stampGold, s[`look_${look}`])} title={`Research level ${level} of 5`}>
      <span className={s.stampLabel}>Research</span>
      <b className={s.stampValue}>{level}</b>
    </span>
  );
}

function Locked({ text }: { readonly text: string }) {
  return (
    <p className={s.locked} data-testid="dex-locked">
      <Icon name="lock" size="sm" /> {text}
    </p>
  );
}

// ---- the view switcher ---------------------------------------------------------------------------------------------

function ViewSwitcher({ forms, view, setView, recordedVariants, alphaRecorded, shinyRecorded }: {
  readonly forms: readonly BattleFormDef[];
  readonly view: View;
  readonly setView: (v: View) => void;
  readonly recordedVariants: readonly VariantKey[];
  readonly alphaRecorded: boolean;
  readonly shinyRecorded: boolean;
}) {
  return (
    <div className={s.switcher} role="group" aria-label="View">
      {forms.length > 0 && (
        <div className={s.switchRow}>
          <span className={s.switchLabel}>Form</span>
          <ViewChip on={view.form === null} onClick={() => setView({ ...view, form: null })} label="Base" />
          {forms.map((f) => (
            <ViewChip key={f.id} on={view.form === f.id} onClick={() => setView({ ...view, form: f.id })} label={f.name} sigil={f.kind} />
          ))}
        </div>
      )}
      <div className={s.switchRow}>
        <span className={s.switchLabel}>Variant</span>
        {VARIANT_KEYS.map((v) => (
          <ViewChip key={v} on={view.variant === v} onClick={() => setView({ ...view, variant: v })} label={v} recorded={recordedVariants.includes(v)} dot={v} />
        ))}
        <ViewChip on={view.shiny} onClick={() => setView({ ...view, shiny: !view.shiny })} label="Shiny" recorded={shinyRecorded} icon="sparkle" />
        <ViewChip on={view.alpha} onClick={() => setView({ ...view, alpha: !view.alpha })} label="Alpha" recorded={alphaRecorded} icon="alpha" />
      </div>
    </div>
  );
}

function ViewChip({ on, onClick, label, recorded, sigil, dot, icon }: {
  readonly on: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly recorded?: boolean;
  readonly sigil?: 'majin' | 'tenjin';
  readonly dot?: VariantKey;
  readonly icon?: 'sparkle' | 'alpha';
}) {
  return (
    <button type="button" className={cx(s.chip, on && s.chipOn)} aria-pressed={on} onClick={onClick} title={recorded === undefined ? label : recorded ? `${label}, recorded` : `${label}, not recorded yet`}>
      {sigil !== undefined && <FormSigil kind={sigil} size="sm" label={formMarkLabel(sigil)} />}
      {dot !== undefined && <span className={cx(s.chipDot, s[`v_${dot}`])} aria-hidden />}
      {icon !== undefined && <Icon name={icon} size="sm" />}
      <span>{label}</span>
      {recorded === true && <Icon name="check" size="sm" className={s.chipCheck} label="recorded" />}
    </button>
  );
}

// ---- overview ------------------------------------------------------------------------------------------------------

function Overview({ sp, form, state, access, variants, alpha, shiny, recordedIn }: {
  readonly sp: SpeciesDef;
  readonly form: BattleFormDef | null;
  readonly state: DexState;
  readonly access: ReturnType<typeof dexAccess>;
  readonly variants: readonly VariantKey[];
  readonly alpha: boolean;
  readonly shiny: boolean;
  readonly recordedIn: readonly string[];
}) {
  const stats = baseStats(sp, form);
  const rows: { key: keyof typeof stats; label: string }[] = [
    { key: 'hp', label: 'HP' },
    { key: 'atk', label: 'ATK' },
    { key: 'def', label: 'DEF' },
    { key: 'spd', label: 'SPD' },
  ];
  return (
    <div className={s.overview}>
      <div className={s.col}>
        <p className={l.bodyLg}>{sp.flavor}</p>
        {sp.battleForm?.kind !== undefined && (
          <section className={l.section} data-testid="dex-form">
            <h4 className={l.sectionTitle}>Battle form</h4>
            <p className={cx(l.body, s.formLine)}>
              <FormSigil kind={sp.battleForm.kind} size="md" label={formMarkLabel(sp.battleForm.kind)} />
              <span>
                <b className={s.formName}>{sp.battleForm.name}</b> · {FORM_RULE[sp.battleForm.kind]}
              </span>
            </p>
            {sp.battleForm.types !== undefined && (
              <p className={cx(l.body, s.formTypes)} data-testid="dex-form-types">
                <span>In this form it becomes</span>
                {sp.battleForm.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </p>
            )}
          </section>
        )}
        {sp.battleForms !== undefined && (
          <section className={l.section} data-testid="dex-relic-forms">
            <h4 className={l.sectionTitle}>Relic forms</h4>
            {sp.battleForms.map((f) => (
              <p key={f.id} className={cx(l.body, s.formTypes)}>
                <span>
                  <b className={s.formName}>{f.name}</b> · holding the {relicName(f.heldItem)}
                  {f.hpBelowPct !== undefined ? `, below ${f.hpBelowPct}% HP` : ''}
                </span>
                {(f.types ?? sp.types).map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </p>
            ))}
          </section>
        )}
        {state === 'caught' && (
          <section className={l.section}>
            <h4 className={l.sectionTitle}>Variants recorded</h4>
            <div className={l.row}>
              {VARIANT_KEYS.map((v) => (
                <span key={v} className={cx(s.variantChip, s[`v_${v}`], variants.includes(v) && s.variantOn)} title={v}>
                  {v}
                </span>
              ))}
              {alpha && (
                <span className={s.alphaText}>
                  <Icon name="alpha" size="sm" /> Alpha
                </span>
              )}
              {shiny && (
                <span className={s.shinyText}>
                  <Icon name="sparkle" size="sm" /> Shiny
                </span>
              )}
            </div>
          </section>
        )}
        {recordedIn.length > 0 && (
          <section className={l.section}>
            <h4 className={l.sectionTitle}>Recorded in</h4>
            <p className={l.body}>{recordedIn.map((z) => zoneName(z)).join(' · ')}</p>
          </section>
        )}
      </div>
      <div className={s.col}>
        <section className={l.section} data-testid="dex-stats">
          <h4 className={l.sectionTitle}>Base stats{form !== null ? ` · ${form.name}` : ''}</h4>
          {access.stats ? (
            <div className={s.stats}>
              {rows.map((r) => {
                const base = r.key === 'hp' ? sp.baseHp : r.key === 'atk' ? sp.baseAtk : r.key === 'def' ? sp.baseDef : sp.baseSpd;
                const delta = stats[r.key] - base;
                return (
                  <div key={r.key} className={s.statRow}>
                    <span className={s.statLabel}>{r.label}</span>
                    <span className={s.statValue}>
                      {stats[r.key]}
                      {delta !== 0 && <span className={cx(s.delta, delta > 0 ? s.up : s.down)}>{delta > 0 ? `+${delta}` : delta}</span>}
                    </span>
                    <div className={l.statTrack}>
                      <div className={l.statFill} style={cssVars({ '--p': Math.min(1, stats[r.key] / MAX_BASE_STAT) })} />
                    </div>
                  </div>
                );
              })}
              <div className={cx(s.statRow, s.totalRow)}>
                <span className={s.statLabel}>Total</span>
                <span className={s.statValue}>{form === null ? statTotal(sp) : stats.hp + stats.atk + stats.def + stats.spd}</span>
                <span />
              </div>
            </div>
          ) : (
            <Locked text={unlockHint(state, null)} />
          )}
        </section>
        <section className={l.section}>
          <h4 className={l.sectionTitle}>Abilities</h4>
          {access.abilities ? (
            <ul className={s.abilities}>
              {sp.abilities.map((id, i) => {
                const a = ability(id);
                return (
                  <li key={id} className={s.ability}>
                    <b className={s.abilityName}>
                      {a?.name ?? id}
                      {i === 0 && sp.abilities.length > 1 && <span className={l.caption}> · default</span>}
                    </b>
                    <span className={l.body}>{a?.description ?? ''}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Locked text={unlockHint(state, null)} />
          )}
        </section>
        <div className={l.kv}>
          <span className={l.kvLabel}>Rarity</span>
          <span />
          <span className={cx(l.kvValue, s.capital)}>{sp.rarity}</span>
          <span className={l.kvLabel}>Catch rate</span>
          <span />
          <span className={l.kvValue}>{sp.catchRate}</span>
          <span className={l.kvLabel}>Exp yield</span>
          <span />
          <span className={l.kvValue}>{sp.expYield}</span>
        </div>
      </div>
    </div>
  );
}

// ---- moves ---------------------------------------------------------------------------------------------------------

function Moves({ sp }: { readonly sp: SpeciesDef }) {
  const level = levelUpMoves(sp);
  const tms = tmMoves(sp);
  const tutors = tutorMoves(sp);
  return (
    <div className={s.moves} data-testid="dex-moves">
      <section className={l.section}>
        <h4 className={l.sectionTitle}>By level</h4>
        <ol className={s.moveList}>
          {level.map((r) => (
            <li key={r.move.id} className={s.moveItem}>
              <span className={s.moveLevel}>{r.level <= 1 ? 'Start' : `Lv ${r.level}`}</span>
              <MoveButton move={r.move} pp={r.move.pp} ppMax={r.move.pp} />
            </li>
          ))}
        </ol>
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Technical machines · {tms.length}</h4>
        {tms.length === 0 ? (
          <p className={l.muted}>No TM fits it.</p>
        ) : (
          <ul className={s.moveGrid}>
            {tms.map((m) => (
              <li key={m.id}>
                <MoveButton move={m} pp={m.pp} ppMax={m.pp} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Move tutors · {tutors.length}</h4>
        {tutors.length === 0 ? (
          <p className={l.muted}>No tutor teaches it anything.</p>
        ) : (
          <ul className={s.moveGrid}>
            {tutors.map((t) => (
              <li key={t.move.id} className={s.tutor}>
                <MoveButton move={t.move} pp={t.move.pp} ppMax={t.move.pp} />
                <span className={l.caption}>Tutor in {zoneName(t.zoneId)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- matchups ------------------------------------------------------------------------------------------------------

const MATCHUP_WORD: Readonly<Record<number, string>> = { 4: 'Very weak', 2: 'Weak', 0.5: 'Resists', 0.25: 'Resists well', 0: 'Immune' };

function Matchups({ types, formName }: { readonly types: readonly TypeName[]; readonly formName: string | null }) {
  const rows = defensiveMatchups(types);
  const offense = [...new Set(types.flatMap((t) => strongAgainst(t)))];
  return (
    <div className={s.matchups} data-testid="dex-matchups">
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Taking hits{formName !== null ? ` · ${formName}` : ''}</h4>
        <ul className={s.matchRows}>
          {rows.map((r) => (
            <li key={r.mult} className={cx(s.matchRow, r.mult > 1 ? s.weak : s.strong)}>
              <span className={s.mult}>{multLabel(r.mult)}</span>
              <span className={s.matchWord}>{MATCHUP_WORD[r.mult]}</span>
              <span className={s.matchTypes}>
                {r.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Its own types hit hard on</h4>
        <p className={s.matchTypes}>
          {offense.length === 0 ? (
            <span className={l.muted}>Nothing takes double damage from its types.</span>
          ) : (
            offense.map((t) => <TypeBadge key={t} type={t} size="sm" />)
          )}
        </p>
      </section>
    </div>
  );
}

// ---- habitat -------------------------------------------------------------------------------------------------------

function HabitatTab({ sp }: { readonly sp: SpeciesDef }) {
  const badges = useSessionStore((st) => st.progression?.badges ?? EMPTY);
  const habitats = habitatsOf(sp.id);
  const origins = originsOf(sp.id);
  return (
    <div className={s.habitat} data-testid="dex-habitat">
      <RoamerNote speciesId={sp.id} speciesName={sp.name} />
      <section className={l.section}>
        <h4 className={l.sectionTitle}>In the wild</h4>
        {habitats.length === 0 ? (
          <p className={l.muted}>Not found in the wild.</p>
        ) : (
          <ul className={s.spots}>
            {habitats.map((h) => (
              <HabitatRow key={h.zoneId} h={h} open={h.gate === null || badges.includes(h.gate)} />
            ))}
          </ul>
        )}
      </section>
      {origins.length > 0 && (
        <section className={l.section}>
          <h4 className={l.sectionTitle}>Other ways</h4>
          <ul className={s.origins}>
            {origins.map((o, i) => (
              <li key={i} className={s.origin}>
                {originText(o)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HabitatRow({ h, open }: { readonly h: Habitat; readonly open: boolean }) {
  return (
    <li className={cx(s.spot, !open && s.spotClosed)}>
      <span className={s.spotZone}>
        {!open && <Icon name="lock" size="sm" label="Needs a badge you do not hold" />}
        {zoneName(h.zoneId)}
      </span>
      <span className={s.spotLevel}>{h.levelMin === h.levelMax ? `Lv ${h.levelMin}` : `Lv ${h.levelMin} to ${h.levelMax}`}</span>
      <span className={s.spotTags}>
        {h.time !== 'any' && (
          <span className={s.tag}>
            <Icon name={h.time === 'night' ? 'moon' : 'sun'} size="sm" /> {h.time === 'night' ? 'Night' : 'Day'}
          </span>
        )}
        {h.land && <span className={s.tag}>Grass</span>}
        {h.water && <span className={s.tag}>Water</span>}
        <span className={cx(s.tag, s[`tier_${h.tier}`])}>{h.tier}</span>
        {h.alpha && (
          <span className={cx(s.tag, s.alphaTagSmall)}>
            <Icon name="alpha" size="sm" /> Alpha
          </span>
        )}
      </span>
    </li>
  );
}

function originText(o: Origin): string {
  switch (o.kind) {
    case 'static':
      return `Waits once in ${zoneName(o.zoneId)}, at level ${o.level}.`;
    case 'roamer':
      return `Roams one season in ${o.zones.length} zones; it flees and moves on.`;
    case 'quest':
      return `The reward of the quest "${o.title}", at level ${o.level}.`;
    case 'raid':
      return `The raid boss in ${zoneName(o.zoneId)}, at level ${o.level}.`;
    case 'battlePass':
      return `A battle pass reward at pass level ${o.level}.`;
    case 'evolve':
      return `${evoSentence(o.how)} From ${speciesName(o.from)}.`;
  }
}


// ---- evolution -----------------------------------------------------------------------------------------------------

function Evolution({ sp, conditions, state, onOpen }: { readonly sp: SpeciesDef; readonly conditions: boolean; readonly state: DexState; readonly onOpen: (id: string) => void }) {
  const tree = evolutionTree(sp.id);
  const seen = useSessionStore((st) => st.progression?.dexSeen ?? EMPTY);
  const caught = useSessionStore((st) => st.progression?.dexCaught ?? EMPTY);
  if (tree === null || (tree.children.length === 0 && tree.sp.id === sp.id)) {
    return <p className={l.muted}>{sp.name} does not evolve.</p>;
  }
  return (
    <div className={s.evolution} data-testid="dex-evolution">
      <EvoBranch node={tree} current={sp.id} seen={seen} caught={caught} conditions={conditions} onOpen={onOpen} />
      {!conditions && <Locked text={`${unlockHint(state, RESEARCH_GATE.evoConditions).replace(' to read this.', '')} to read how each stage evolves.`} />}
    </div>
  );
}

function EvoBranch({ node, current, seen, caught, conditions, onOpen }: {
  readonly node: EvoNode;
  readonly current: string;
  readonly seen: readonly string[];
  readonly caught: readonly string[];
  readonly conditions: boolean;
  readonly onOpen: (id: string) => void;
}) {
  const id = node.sp.id;
  const known = seen.includes(id) || caught.includes(id);
  return (
    <div className={s.evoNode}>
      <button
        type="button"
        className={cx(s.evoStage, id === current && s.evoCurrent)}
        data-type={known ? node.sp.types[0] : undefined}
        onClick={() => onOpen(id)}
        disabled={!known || id === current}
        aria-label={known ? `${node.sp.name}${id === current ? ', this entry' : ''}` : 'Unknown stage'}
      >
        <CreatureSprite speciesId={id} size="lg" silhouette={!known} desaturate={known && !caught.includes(id)} animated />
        <span className={s.evoName}>{known ? node.sp.name : '???'}</span>
        <span className={l.caption}>#{String(node.sp.dexNumber).padStart(3, '0')}</span>
      </button>
      {node.children.length > 0 && (
        <div className={cx(s.evoBranches, node.children.length > 1 && s.evoSplit)}>
          {node.children.map((c) => (
            <div key={c.sp.id} className={s.evoEdgeRow}>
              <span className={s.evoEdge} title={c.how === null || !conditions ? undefined : evoSentence(c.how)}>
                <span className={s.evoChip}>{c.how === null ? '' : conditions ? evoLabel(c.how) : '?'}</span>
                <Icon name="chevronRight" size="sm" className={s.evoArrow} />
              </span>
              <EvoBranch node={c} current={current} seen={seen} caught={caught} conditions={conditions} onOpen={onOpen} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- forms ---------------------------------------------------------------------------------------------------------

function Forms({ sp, forms }: { readonly sp: SpeciesDef; readonly forms: readonly BattleFormDef[] }) {
  return (
    <div className={s.forms} data-testid="dex-forms">
      {forms.map((f) => {
        const types = f.types ?? sp.types;
        const sig = f.signatureMove === undefined ? undefined : move(f.signatureMove.move);
        const effects = formEffects(f);
        const rows: { label: string; base: number; form: number }[] = [
          { label: 'ATK', base: sp.baseAtk, form: f.baseAtk },
          { label: 'DEF', base: sp.baseDef, form: f.baseDef },
          { label: 'SPD', base: sp.baseSpd, form: f.baseSpd },
        ];
        return (
          <article key={f.id} className={s.formCard} data-type={types[0]} aria-label={f.name}>
            <div className={s.formArt}>
              <CreatureSprite speciesId={sp.id} size="lg" animated />
              <Icon name="chevronRight" size="md" className={s.evoArrow} />
              <CreatureSprite speciesId={sp.id} form={f.id} size="xl" />
            </div>
            <div className={s.formBody}>
              <h4 className={s.formTitle}>
                {f.kind !== undefined && <FormSigil kind={f.kind} size="md" label={formMarkLabel(f.kind)} />}
                {f.name}
              </h4>
              <p className={l.body}>{formRule(f)}</p>
              <div className={l.row}>
                {types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </div>
              <div className={s.formStats}>
                {rows.map((r) => {
                  const d = r.form - r.base;
                  return (
                    <span key={r.label} className={s.formStat}>
                      <span className={s.statLabel}>{r.label}</span>
                      <b className={s.statValue}>{r.form}</b>
                      {d !== 0 && <span className={cx(s.delta, d > 0 ? s.up : s.down)}>{d > 0 ? `+${d}` : d}</span>}
                    </span>
                  );
                })}
              </div>
              {effects.length > 0 && (
                <ul className={s.effects}>
                  {effects.map((e) => (
                    <li key={e} className={l.body}>
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {sig !== undefined && f.signatureMove !== undefined && (
                <div className={s.formSig}>
                  <span className={l.caption}>Signature move, in place of {f.signatureMove.replaces}</span>
                  <MoveButton move={sig} pp={sig.pp} ppMax={sig.pp} />
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ---- research ------------------------------------------------------------------------------------------------------

/** What each research level opens (the gates in data/dexInfo.ts `RESEARCH_GATE` and the server's perks). */
const PERKS: readonly { readonly level: number; readonly text: string }[] = [
  { level: 1, text: 'Its stats, abilities and forms (once recorded)' },
  { level: RESEARCH_GATE.moves, text: 'Its moves: by level, TMs and tutors' },
  { level: RESEARCH_GATE.matchups, text: 'Matchups, how each stage evolves, compare, and a better catch rate' },
  { level: RESEARCH_GATE.goldFrame, text: 'A gold frame and better shiny odds in the wild' },
];

function ResearchTab({ sp, level, counters }: { readonly sp: SpeciesDef; readonly level: number; readonly counters: Readonly<Record<string, number>> }) {
  const prog = researchProgressOf(sp.id, counters);
  const next = level < RESEARCH_MAX_LEVEL ? (RESEARCH_LEVEL_POINTS[level] ?? null) : null;
  const prev = level === 0 ? 0 : (RESEARCH_LEVEL_POINTS[level - 1] ?? 0);
  return (
    <div className={s.research} data-testid="dex-research">
      <header className={s.researchHead}>
        <ResearchStamp level={level} />
        <div className={s.researchBar}>
          <span className={l.caption}>
            {prog.points} points{next !== null ? ` · ${next - prog.points} to level ${level + 1}` : ' · fully researched'}
          </span>
          <div className={l.statTrack}>
            <div className={l.statFill} style={cssVars({ '--p': next === null ? 1 : Math.max(0, Math.min(1, (prog.points - prev) / Math.max(1, next - prev))) })} />
          </div>
        </div>
      </header>
      <ul className={s.tasks}>
        {prog.tasks.map((t) => {
          const nextTier = t.task.tiers[t.tiersReached];
          return (
            <li key={t.task.id} className={cx(s.task, t.task.kind === 'special' && s.special, nextTier === undefined && s.taskDone)}>
              <span className={s.taskTitle}>{t.task.title}</span>
              <span className={s.pips} aria-label={`${t.tiersReached} of ${t.task.tiers.length} tiers`}>
                {t.task.tiers.map((n, i) => (
                  <span key={n} className={cx(s.pip, i < t.tiersReached && s.pipOn)} title={`${n}`} />
                ))}
              </span>
              <span className={s.taskCount}>
                {t.count}
                {nextTier !== undefined && <span className={l.caption}> / {nextTier}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <section className={l.section}>
        <h4 className={l.sectionTitle}>What research opens</h4>
        <ul className={s.perks}>
          {PERKS.map((p) => (
            <li key={p.level} className={cx(s.perk, level >= p.level && s.perkOn)}>
              <b className={s.perkLevel}>{p.level}</b>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
