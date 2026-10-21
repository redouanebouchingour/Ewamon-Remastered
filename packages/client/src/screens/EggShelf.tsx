/**
 * Breeding: the trainer's eggs (`useDaycareStore`), as a row of cards: the egg, its parents, the steps it still needs
 * and the one move that fits where it is. `place` 'party' = the carried eggs (the Party screen: they count the steps
 * walked), 'box' = the waiting ones (the Box), 'all' = both (the Daycare). Nothing renders without eggs to show.
 */
import { useEffect, useState } from 'react';
import type { EggView } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { toast } from '../state/notifications';
import { applyInventoryDelta, toInventoryDelta } from '../state/session';
import { stepsLeftText, useDaycareStore } from '../state/daycare';
import { Button } from '../ui/Button';
import { Egg } from '../ui/Egg';
import { ProgressBar } from '../ui/ProgressBar';
import l from './layout.module.css';
import s from './EggShelf.module.css';

export function EggCard({ egg, carryFull }: { readonly egg: EggView; readonly carryFull: boolean }) {
  const [busy, setBusy] = useState(false);
  const carried = egg.place === 'party';
  const move = (): void => {
    setBusy(true);
    apiFetch('eggMove', { params: { id: egg.id }, body: { place: carried ? 'box' : 'party' } })
      .then((res) => {
        useDaycareStore.getState().set(res.daycare);
        applyInventoryDelta(toInventoryDelta({ party: res.party, box: res.box }));
      })
      .catch((e: unknown) => toast('warn', describeError(e)))
      .finally(() => setBusy(false));
  };
  const frac = egg.stepsTotal > 0 ? egg.stepsWalked / egg.stepsTotal : 0;
  return (
    <li className={s.card} data-testid="egg-card" data-place={egg.place}>
      <Egg bandborn={egg.bandborn} size="md" className={s.egg} />
      <span className={s.info}>
        <span className={s.title}>
          Egg{egg.bandborn && <span className={s.bandborn}>Bandborn</span>}
        </span>
        <span className={s.parents}>
          {egg.parents[0]} × {egg.parents[1]}
        </span>
        <ProgressBar value={frac} size="sm" label="Steps walked" valueText={stepsLeftText(egg)} />
        <span className={l.caption}>{carried ? stepsLeftText(egg) : 'Waiting in the box. Carry it to count your steps.'}</span>
      </span>
      <Button size="sm" variant="ghost" busy={busy} disabled={!carried && carryFull} onClick={move} title={!carried && carryFull ? 'You carry as many eggs as you can' : undefined}>
        {carried ? 'To box' : 'Carry'}
      </Button>
    </li>
  );
}

export function EggShelf({ place, title }: { readonly place: 'party' | 'box' | 'all'; readonly title: string }) {
  const view = useDaycareStore((st) => st.view);
  useEffect(() => {
    void useDaycareStore.getState().refresh();
  }, []);
  if (view === null) return null;
  const eggs = view.eggs.filter((e) => place === 'all' || e.place === place);
  if (eggs.length === 0) return null;
  const carried = view.eggs.filter((e) => e.place === 'party').length;
  return (
    <section className={l.section} aria-label={title} data-testid={`eggs-${place}`}>
      <h4 className={l.sectionTitle}>
        {title}
        {place !== 'box' && (
          <span className={s.count}>
            {carried} / {view.carryMax} carried
          </span>
        )}
      </h4>
      <ol className={s.shelf}>
        {eggs.map((e) => (
          <EggCard key={e.id} egg={e} carryFull={carried >= view.carryMax} />
        ))}
      </ol>
    </section>
  );
}
