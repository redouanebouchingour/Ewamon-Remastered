/**
 * Dex completion rewards (`/play/dex?view=rewards`, 2026-10-26): ready ones first with Claim, then the ones in
 * progress with a bar, then the claimed ones. Each names what it pays: money, items, a trainer title, a stamp look.
 * The stamp look the player wears is picked here (a per-device choice, `state/dexPrefs.ts`).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DEX_REWARDS, dexRewardProgress, dexStampsOf } from '@ewa/content';
import type { DexRewardDef, DexStamp } from '@ewa/content';
import { itemInfo } from '../../data/content';
import { setDexStamp, useDexPrefs } from '../../state/dexPrefs';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { ProgressBar } from '../../ui/ProgressBar';
import { cx } from '../../ui/cx';
import l from '../layout.module.css';
import { ResearchStamp } from './DexEntry';
import s from './RewardsView.module.css';

const KIND_LABEL: Readonly<Record<DexRewardDef['kind'], string>> = { zone: 'Habitat', type: 'Type set', research: 'Research', recorded: 'The record' };
const STAMP_LABEL: Readonly<Record<DexStamp, string>> = { paper: 'Paper', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', holo: 'Holo' };

export function RewardsView({ caught, research, claimed, onClaim }: {
  readonly caught: ReadonlySet<string>;
  readonly research: Readonly<Record<string, number>>;
  readonly claimed: readonly string[];
  /** POST the claim; resolves once the session holds the result */
  readonly onClaim: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stamp = useDexPrefs((st) => st.stamp);
  const ctx = { caught, research };
  const rows = DEX_REWARDS.map((r) => ({ r, p: dexRewardProgress(r, ctx), done: claimed.includes(r.id) }));
  const ready = rows.filter((x) => !x.done && x.p.have >= x.p.need);
  const open = rows.filter((x) => !x.done && x.p.have < x.p.need).sort((a, b) => b.p.have / b.p.need - a.p.have / a.p.need);
  const done = rows.filter((x) => x.done);
  const stamps = dexStampsOf(claimed);
  const claim = (id: string): void => {
    setBusy(id);
    setError(null);
    onClaim(id)
      .catch(() => setError('The claim did not go through. Try again.'))
      .finally(() => setBusy(null));
  };
  return (
    <div className={s.rewards} data-testid="dex-rewards">
      <section className={s.stampRow} aria-label="Stamp style">
        <ResearchStamp level={5} />
        <Segmented<DexStamp>
          label="Stamp style"
          value={stamps.includes(stamp) ? stamp : 'paper'}
          options={stamps.map((st) => ({ value: st, label: STAMP_LABEL[st] }))}
          onChange={(v) => setDexStamp(v)}
        />
        <span className={l.caption}>More styles come with research milestones.</span>
      </section>
      {error !== null && <p className={s.error}>{error}</p>}
      <Group title="Ready to claim" rows={ready} render={(x) => <Row key={x.r.id} {...x} action={<Button variant="primary" size="sm" busy={busy === x.r.id} onClick={() => claim(x.r.id)}>Claim</Button>} />} />
      <Group title="In progress" rows={open} render={(x) => <Row key={x.r.id} {...x} />} />
      <Group title="Claimed" rows={done} render={(x) => <Row key={x.r.id} {...x} />} />
    </div>
  );
}

type RowData = { readonly r: DexRewardDef; readonly p: { readonly have: number; readonly need: number }; readonly done: boolean };

function Group({ title, rows, render }: { readonly title: string; readonly rows: readonly RowData[]; readonly render: (x: RowData) => ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <section className={l.section} aria-label={title}>
      <h4 className={l.sectionTitle}>
        {title} · {rows.length}
      </h4>
      <ul className={s.list}>{rows.map(render)}</ul>
    </section>
  );
}

function Row({ r, p, done, action }: RowData & { readonly action?: ReactNode }) {
  const pays = [
    ...(r.money > 0 ? [`${r.money.toLocaleString()} money`] : []),
    ...Object.entries(r.items).map(([id, n]) => `${itemInfo(id).name} x${n}`),
  ];
  return (
    <li className={cx(s.row, done && s.claimed, action !== undefined && s.ready)} aria-label={`${r.title}, ${done ? 'claimed' : `${p.have} of ${p.need}`}`}>
      <span className={s.kind}>{KIND_LABEL[r.kind]}</span>
      <div className={s.main}>
        <b className={s.title}>{r.title}</b>
        <span className={l.body}>{r.summary}</span>
        {!done && <ProgressBar value={p.have / Math.max(1, p.need)} label={r.title} valueText={`${p.have} of ${p.need}`} />}
      </div>
      <div className={s.pays}>
        {pays.map((x) => (
          <span key={x} className={s.pay}>
            {x}
          </span>
        ))}
        {r.trainerTitle !== undefined && (
          <span className={cx(s.pay, s.titlePay)}>
            <Icon name="user" size="sm" /> Title: {r.trainerTitle}
          </span>
        )}
        {r.stamp !== undefined && (
          <span className={cx(s.pay, s.titlePay)}>
            <Icon name="star" size="sm" /> {STAMP_LABEL[r.stamp]} stamp
          </span>
        )}
      </div>
      <span className={s.count}>
        {done ? <Icon name="check" size="sm" label="Claimed" /> : `${p.have} / ${p.need}`}
        {action}
      </span>
    </li>
  );
}
