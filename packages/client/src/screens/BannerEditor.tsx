/**
 * Trainer banners on `/play/profile`: the banner live as it will look, and the pieces to dress it with. Frames,
 * backdrops and pins show what unlocks them and how far along the trainer is (content `bannerUnlockHint` /
 * `bannerProgress` over the server's counts from `GET /banner`); trackers pick up to three of the trainer's numbers; the
 * partner is one of the party (the lead by default). `POST /banner` saves; the server re-checks every unlock.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BANNER_BACKDROPS,
  BANNER_FRAMES,
  BANNER_PINS,
  BANNER_PIN_SLOTS,
  BANNER_TRACKERS,
  BANNER_TRACKER_SLOTS,
  bannerPin,
  bannerProgress,
  bannerForms,
  bannerUnlockHint,
  bannerUnlocked,
  pinTier,
} from '@ewa/content';
import type { BannerChoice, BannerCount, BannerRarity, BannerStats, BannerUnlock } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { RouteResponse } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { FormSigil } from '../ui/FormSigil';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { Skeleton } from '../ui/Skeleton';
import { Tabs } from '../ui/Tabs';
import { cx } from '../ui/cx';
import s from './BannerEditor.module.css';
import l from './layout.module.css';
import { BannerPin, TrainerBanner, pinLabel } from './TrainerBanner';
import type { BannerModel } from './TrainerBanner';

type Tab = 'frame' | 'backdrop' | 'pins' | 'trackers' | 'partner';

const RARITY_LABEL: Readonly<Record<BannerRarity, string>> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };

const same = (a: BannerChoice, b: BannerChoice): boolean =>
  a.frame === b.frame && a.backdrop === b.backdrop && a.featuredId === b.featuredId && a.featuredForm === b.featuredForm && a.pins.join() === b.pins.join() && a.trackers.join() === b.trackers.join();

/** Adds or removes `id`, keeping the order picked; a full list takes nothing more. */
function toggle(list: readonly string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= max ? [...list] : [...list, id];
}

const BAND_NAME = { majin: 'Majin Band', tenjin: 'Tenjin Band' } as const;

/**
 * The chosen partner's Majin / Tenjin forms (content `bannerForms`): its own look or a form, each form open while the
 * trainer holds that band. Nothing when the partner is the party lead or its species has no such form.
 */
function FormPicker({ draft, party, stats, onPick }: { readonly draft: BannerChoice; readonly party: readonly CreatureInstance[]; readonly stats: BannerStats; onPick(form: string | null): void }) {
  const partner = party.find((c) => c.id === draft.featuredId);
  const forms = partner === undefined ? [] : bannerForms(partner.speciesId);
  if (partner === undefined || forms.length === 0) return null;
  const bands = stats.bands ?? [];
  return (
    <section className={s.formPick} aria-label="Partner form">
      <h4 className={s.formTitle}>Form</h4>
      <ul className={s.grid}>
        <li>
          <button type="button" className={cx(s.option, draft.featuredForm === null && s.on)} aria-pressed={draft.featuredForm === null} onClick={() => onPick(null)}>
            <CreatureSprite speciesId={partner.speciesId} variantKey={partner.variantKey} shiny={partner.isShiny === true} size="sm" />
            <span className={s.optText}>
              <span className={s.optName}>Own look</span>
              <span className={l.caption}>{speciesName(partner.speciesId)}</span>
            </span>
          </button>
        </li>
        {forms.map((f) => {
          const open = f.kind !== undefined && bands.includes(f.kind);
          return (
            <li key={f.id}>
              <button type="button" className={cx(s.option, draft.featuredForm === f.id && s.on)} data-band={f.kind} aria-pressed={draft.featuredForm === f.id} disabled={!open} onClick={() => onPick(f.id)}>
                <CreatureSprite speciesId={partner.speciesId} form={f.id} variantKey={partner.variantKey} shiny={partner.isShiny === true} size="sm" />
                <span className={s.optText}>
                  <span className={s.optName}>{f.name}</span>
                  <span className={s.band} data-band={f.kind}>
                    {f.kind !== undefined && <FormSigil kind={f.kind} size="sm" />}
                    {f.kind === 'majin' ? 'Majin' : 'Tenjin'}
                  </span>
                  {!open && f.kind !== undefined && (
                    <span className={s.lock}>
                      <span className={s.hint}>
                        <Icon name="lock" size="sm" /> Needs the {BAND_NAME[f.kind]}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Lock({ unlock, stats }: { readonly unlock: BannerUnlock; readonly stats: BannerStats }) {
  const p = bannerProgress(unlock, stats);
  return (
    <span className={s.lock}>
      <span className={s.hint}>
        <Icon name="lock" size="sm" /> {bannerUnlockHint(unlock)}
      </span>
      {p > 0 && <ProgressBar size="sm" value={p} label={bannerUnlockHint(unlock)} valueText={`${Math.round(p * 100)}%`} />}
    </span>
  );
}

export interface BannerEditorProps {
  readonly username: string;
  readonly title: string;
  readonly guildTag: string | null;
  readonly tier: string;
}

export function BannerEditor({ username, title, guildTag, tier }: BannerEditorProps) {
  const party = useSessionStore((st) => st.inventory?.party ?? null);
  const [saved, setSaved] = useState<RouteResponse<'banner'> | null>(null);
  const [draft, setDraft] = useState<BannerChoice | null>(null);
  const [tab, setTab] = useState<Tab>('frame');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('banner', { signal: ctl.signal })
      .then((r) => {
        setSaved(r);
        setDraft(r.choice);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setFailed(true);
      });
    return () => ctl.abort();
  }, []);

  const stats = saved?.stats as BannerStats | undefined;
  const model = useMemo<BannerModel | null>(() => {
    if (draft === null || stats === undefined) return null;
    const members = party ?? [];
    return {
      username,
      title,
      guildTag,
      tier,
      frame: draft.frame,
      backdrop: draft.backdrop,
      pins: draft.pins.map((id) => ({ id, tier: Math.max(1, pinTier(bannerPin(id)!, stats)) })),
      trackers: draft.trackers.map((id) => ({ id, value: stats[id as BannerCount] })),
      featured: members.find((c) => c.id === draft.featuredId) ?? members[0] ?? null,
      featuredForm: members.some((c) => c.id === draft.featuredId) ? draft.featuredForm : null,
    };
  }, [draft, stats, party, username, title, guildTag, tier]);

  if (failed) return <EmptyState icon="info" title="Your banner did not load" hint="Close and reopen the panel to try again." />;
  if (saved === null || draft === null || stats === undefined || model === null) return <Skeleton shape="block" />;

  const dirty = !same(draft, saved.choice);
  const set = (patch: Partial<BannerChoice>): void => setDraft({ ...draft, ...patch });
  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await apiFetch('bannerSave', { body: { ...draft, pins: [...draft.pins], trackers: [...draft.trackers] } });
      setSaved(r);
      setDraft(r.choice);
      toast('info', 'Banner saved. Other trainers see it now.');
    } catch (e) {
      toast('warn', describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const unlockedFrames = BANNER_FRAMES.filter((f) => bannerUnlocked(f.unlock, stats)).length;
  const unlockedBackdrops = BANNER_BACKDROPS.filter((b) => bannerUnlocked(b.unlock, stats)).length;
  const earnedPins = BANNER_PINS.filter((p) => pinTier(p, stats) > 0).length;

  return (
    <div className={s.editor}>
      <div className={s.preview}>
        <TrainerBanner model={model} />
        <p className={l.caption}>What trainers see when they inspect you in the world.</p>
      </div>
      <div className={s.controls}>
        <Tabs<Tab>
          label="Banner pieces"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'frame', label: 'Frame', count: unlockedFrames },
            { key: 'backdrop', label: 'Backdrop', count: unlockedBackdrops },
            { key: 'pins', label: 'Pins', count: earnedPins },
            { key: 'trackers', label: 'Trackers' },
            { key: 'partner', label: 'Partner' },
          ]}
        />
        <div className={s.pane} role="tabpanel" aria-label={tab}>
          {tab === 'frame' && (
            <ul className={s.grid}>
              {BANNER_FRAMES.map((f) => {
                const open = bannerUnlocked(f.unlock, stats);
                return (
                  <li key={f.id}>
                    <button type="button" className={cx(s.option, draft.frame === f.id && s.on)} data-rarity={f.rarity} aria-pressed={draft.frame === f.id} disabled={!open} onClick={() => set({ frame: f.id })}>
                      <span className={s.swatch} data-rarity={f.rarity} aria-hidden />
                      <span className={s.optText}>
                        <span className={s.optName}>{f.name}</span>
                        <span className={s.rarity} data-rarity={f.rarity}>
                          {RARITY_LABEL[f.rarity]}
                        </span>
                        {!open && <Lock unlock={f.unlock} stats={stats} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {tab === 'backdrop' && (
            <ul className={s.grid}>
              {BANNER_BACKDROPS.map((b) => {
                const open = bannerUnlocked(b.unlock, stats);
                return (
                  <li key={b.id}>
                    <button type="button" className={cx(s.option, draft.backdrop === b.id && s.on)} data-rarity={b.rarity} aria-pressed={draft.backdrop === b.id} disabled={!open} onClick={() => set({ backdrop: b.id })}>
                      <span className={s.swatch} data-backdrop={b.id} data-type={b.type ?? undefined} aria-hidden />
                      <span className={s.optText}>
                        <span className={s.optName}>{b.name}</span>
                        <span className={s.rarity} data-rarity={b.rarity}>
                          {b.type !== null ? `${b.type} · ` : ''}
                          {RARITY_LABEL[b.rarity]}
                        </span>
                        {!open && <Lock unlock={b.unlock} stats={stats} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {tab === 'pins' && (
            <>
              <p className={l.caption}>
                Pick up to {BANNER_PIN_SLOTS}. A pin climbs to its next tier on its own. {draft.pins.length} of {BANNER_PIN_SLOTS} picked.
              </p>
              <ul className={s.grid}>
                {BANNER_PINS.map((p) => {
                  const t = pinTier(p, stats);
                  const on = draft.pins.includes(p.id);
                  const next = p.tiers[t];
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={cx(s.option, on && s.on, t === 0 && s.dim)}
                        aria-pressed={on}
                        disabled={t === 0 || (!on && draft.pins.length >= BANNER_PIN_SLOTS)}
                        onClick={() => set({ pins: toggle(draft.pins, p.id, BANNER_PIN_SLOTS) })}
                      >
                        <BannerPin id={p.id} tier={Math.max(1, t)} size="sm" />
                        <span className={s.optText}>
                          <span className={s.optName}>{t > 0 ? pinLabel(p.id, t) : p.name}</span>
                          <span className={l.caption}>{p.blurb}</span>
                          {next !== undefined && <Lock unlock={next} stats={stats} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {tab === 'trackers' && (
            <>
              <p className={l.caption}>
                Up to {BANNER_TRACKER_SLOTS} numbers along the bottom of your banner, in the order you pick them.
              </p>
              <ul className={s.grid}>
                {BANNER_TRACKERS.map((t) => {
                  const on = draft.trackers.includes(t.id);
                  const at = draft.trackers.indexOf(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={cx(s.option, on && s.on)}
                        aria-pressed={on}
                        disabled={!on && draft.trackers.length >= BANNER_TRACKER_SLOTS}
                        onClick={() => set({ trackers: toggle(draft.trackers, t.id, BANNER_TRACKER_SLOTS) })}
                      >
                        <span className={s.slot} aria-hidden>
                          {on ? at + 1 : ''}
                        </span>
                        <span className={s.optText}>
                          <span className={s.optName}>{t.label}</span>
                          <span className={s.value}>{stats[t.id].toLocaleString('en-US')}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {tab === 'partner' &&
            (party === null || party.length === 0 ? (
              <EmptyState icon="party" title="No party yet" hint="Your partner comes from your party." />
            ) : (
              <ul className={s.grid}>
                <li>
                  <button type="button" className={cx(s.option, draft.featuredId === null && s.on)} aria-pressed={draft.featuredId === null} onClick={() => set({ featuredId: null, featuredForm: null })}>
                    <span className={s.slot} aria-hidden>
                      <Icon name="party" size="sm" />
                    </span>
                    <span className={s.optText}>
                      <span className={s.optName}>Party lead</span>
                      <span className={l.caption}>Whoever leads your party</span>
                    </span>
                  </button>
                </li>
                {party.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={cx(s.option, draft.featuredId === c.id && s.on)} aria-pressed={draft.featuredId === c.id} onClick={() => set({ featuredId: c.id, featuredForm: draft.featuredId === c.id ? draft.featuredForm : null })}>
                      <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} shiny={c.isShiny === true} size="sm" />
                      <span className={s.optText}>
                        <span className={s.optName}>{c.nickname ?? speciesName(c.speciesId)}</span>
                        <span className={l.caption}>Lv {c.level}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {tab === 'partner' && <FormPicker draft={draft} party={party ?? []} stats={stats} onPick={(featuredForm) => set({ featuredForm })} />}
        </div>
        <div className={s.foot}>
          <span className={l.caption}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
          <span className={l.row}>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(saved.choice)}>
                Reset
              </Button>
            )}
            <Button variant="primary" disabled={!dirty} busy={busy} onClick={() => void save()}>
              Save banner
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
