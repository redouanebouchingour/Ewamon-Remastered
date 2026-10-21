/**
 * `/play/daycare` (breeding, content daycare.ts), opened by talking to the keeper in Mirevale's Daycare: the two
 * creatures left here, whether they get along (and what would hatch, bandborn or not), the next egg (take it when the
 * keeper has it), every egg the trainer has, and the party and box to leave one from. Every action answers with the
 * Daycare and the party and box after it.
 */
import { useEffect, useState } from 'react';
import { BREED_REFUSAL_TEXT, DAYCARE, challengeActive, isFallen } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { DaycareView } from '@ewa/protocol';
import { displayName, speciesName } from '../data/content';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { useDaycareStore } from '../state/daycare';
import { toast } from '../state/notifications';
import { applyInventoryDelta, toInventoryDelta, useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { Egg } from '../ui/Egg';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import { EggShelf } from './EggShelf';
import l from './layout.module.css';
import s from './DaycareScreen.module.css';
import { useClosePanel } from './shared';

const EMPTY: readonly CreatureInstance[] = [];

/** "in about 7 min" / "in under a minute" */
export function eggEta(eggAt: string, nowMs: number): string {
  const ms = Date.parse(eggAt) - nowMs;
  if (ms <= 60_000) return 'in under a minute';
  return `in about ${Math.ceil(ms / 60_000)} min`;
}

/** The keeper's verdict on the pair, as one line. */
export function verdictLine(v: DaycareView): string {
  if (v.pair.length < 2) return v.pair.length === 0 ? 'Leave two with the keeper to see if they get along.' : 'One is here. Leave a second one with it.';
  if (v.refusal !== null) return BREED_REFUSAL_TEXT[v.refusal];
  return `They get along. Their eggs hatch into ${speciesName(v.hatches ?? '')}.`;
}

type Act = 'leave' | 'take' | 'collect';

export function DaycareScreen() {
  const close = useClosePanel();
  const view = useDaycareStore((st) => st.view);
  const inv = useSessionStore((st) => st.inventory);
  const flags = useSessionStore((st) => st.progression?.flags);
  const party = inv?.party ?? EMPTY;
  const box = inv?.box ?? EMPTY;
  const run = challengeActive(flags ?? []) !== null;
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void useDaycareStore.getState().refresh();
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const act = (kind: Act, id: string | null): void => {
    setBusy(`${kind}:${id ?? ''}`);
    const call =
      kind === 'collect' ? apiFetch('daycareCollect', { body: {} }) : apiFetch(kind === 'leave' ? 'daycareLeave' : 'daycareTake', { body: { id: id ?? '' } });
    call
      .then((res) => {
        useDaycareStore.getState().set(res.daycare);
        applyInventoryDelta(toInventoryDelta({ party: res.party, box: res.box }));
        if (kind === 'collect') toast('success', 'You received an egg. Walk with it and it will hatch.');
      })
      .catch((e: unknown) => toast('warn', describeError(e)))
      .finally(() => setBusy(null));
  };

  const full = (view?.pair.length ?? 0) >= 2;
  const candidates = [...party.map((c) => ({ c, where: 'Party' as const })), ...box.map((c) => ({ c, where: 'Box' as const }))].filter(({ c }) => !isFallen(c));

  return (
    <Panel
      title="Daycare"
      eyebrow={`Mirevale · ${DAYCARE.keeper}`}
      subtitle="Two of one family, or two that share a type, now and then leave an egg. Carry it and walk: it hatches."
      onClose={close}
    >
      {view === null ? (
        <Skeleton shape="rows" count={3} label="Loading the Daycare" />
      ) : (
        <div className={s.screen} data-testid="daycare">
          <section className={l.section} aria-label="Left with the keeper">
            <h4 className={l.sectionTitle}>Left with the keeper</h4>
            <ol className={s.pair}>
              {[0, 1].map((i) => {
                const c = view.pair[i];
                return c === undefined ? (
                  <li key={`empty-${i}`} className={s.empty}>
                    <span className={s.slotNo}>{String(i + 1).padStart(2, '0')}</span>
                    <span>Empty</span>
                  </li>
                ) : (
                  <li key={c.id} className={s.parent}>
                    <span className={s.slotNo}>{String(i + 1).padStart(2, '0')}</span>
                    <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="lg" />
                    <span className={s.who}>
                      <span className={s.name}>{displayName(c)}</span>
                      <span className={l.caption}>
                        Lv {c.level}
                        {i === 0 ? ' · its family hatches' : ''}
                      </span>
                    </span>
                    <Button size="sm" busy={busy === `take:${c.id}`} onClick={() => act('take', c.id)}>
                      Take back
                    </Button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className={s.verdict} data-ready={view.eggReady || undefined} aria-live="polite" data-testid="daycare-verdict">
            <span className={s.verdictEgg}>{view.hatches !== null ? <Egg size="md" bandborn={view.bandborn} /> : null}</span>
            <span className={s.verdictText}>
              <span className={s.line}>{verdictLine(view)}</span>
              {view.bandborn && <span className={s.bandborn}>Bandborn: a Majin parent and a Tenjin parent. Its form answers either band.</span>}
              {run && <span className={l.caption}>Your challenge run keeps to what you meet on the road: the keeper gives no eggs while it lasts.</span>}
              {!run && view.hatches !== null && !view.eggReady && view.eggAt !== null && <span className={l.caption}>The next egg {eggEta(view.eggAt, now)}.</span>}
              {!run && view.eggReady && <span className={l.caption}>The keeper has an egg for you.</span>}
            </span>
            {view.eggReady && !run && (
              <Button variant="primary" icon="plus" busy={busy === 'collect:'} onClick={() => act('collect', null)}>
                Take the egg
              </Button>
            )}
          </section>

          <EggShelf place="all" title="Your eggs" />

          <section className={l.section} aria-label="Leave one">
            <h4 className={l.sectionTitle}>Leave one</h4>
            {full ? (
              <p className={l.caption}>The keeper minds two at a time. Take one back to leave another.</p>
            ) : run ? (
              <p className={l.caption}>Not during a challenge run.</p>
            ) : (
              <ul className={s.pick}>
                {candidates.map(({ c, where }) => (
                  <li key={c.id} className={s.option}>
                    <CreatureSprite speciesId={c.speciesId} variantKey={c.variantKey} size="sm" />
                    <span className={s.who}>
                      <span className={s.name}>{displayName(c)}</span>
                      <span className={l.caption}>
                        Lv {c.level} · {where}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `leave:${c.id}`}
                      disabled={where === 'Party' && party.length <= 1}
                      onClick={() => act('leave', c.id)}
                    >
                      Leave
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Panel>
  );
}
