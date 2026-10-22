/**
 * `/play/camp` (camp bases, content camps.ts, SPEC §20.9.9s), opened at a route's campfire (or from anywhere to manage
 * your own): the camp here, free to claim or someone else's to raid while they are away (their banner, trophies and
 * guard, what a win would take and what it costs), your own camp's banner name and trophies (picked from what you
 * earned, up to three) and abandoning it, the camp log and every camp held in the world. GET /camps, POST /camps/edit,
 * POST /camps/abandon; claiming and raiding go to the zone room (`camp { action }`), which re-checks the fire's range.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CAMP_NAME_MAX, CAMP_RAID_HONOR, CAMP_REFUSAL_TEXT, CAMP_TROPHY_SLOTS, TROPHY_KIND_LABEL } from '@ewa/content';
import type { CampTrophyView, CampView, CampsView } from '@ewa/protocol';
import { primaryType, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { describeError } from '../net/errors';
import { getWorldSession } from '../net/WorldSession';
import { useCampStore } from '../state/camp';
import { toast } from '../state/notifications';
import { applyInventoryDelta, toInventoryDelta } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TextField } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import l from './layout.module.css';
import s from './CampScreen.module.css';
import { relativeTime, useClosePanel } from './shared';

const money = (n: number): string => n.toLocaleString('en-US');

/** Why a raid on `c` cannot go ahead now (null: it can). */
export function raidBlock(c: CampView, inRun: boolean): string | null {
  if (inRun) return CAMP_REFUSAL_TEXT.inRun;
  if (c.ownerOnline) return CAMP_REFUSAL_TEXT.ownerHome;
  if (c.ownerInRun) return CAMP_REFUSAL_TEXT.ownerInRun;
  if (c.raidedToday) return CAMP_REFUSAL_TEXT.raidedToday;
  return null;
}

/** What a raid on `c` puts at stake, in words. */
export function raidStakes(c: CampView): string {
  const take = c.cut > 0 ? `A win takes ${money(c.cut)} from ${c.owner}` : `${c.owner} has nothing to take`;
  const over = c.inactive ? ` and, since they have been away so long, the camp itself` : '';
  return `${take}${over}. A loss takes nothing. Raiding costs your lead ${Math.abs(CAMP_RAID_HONOR)} honor and darkens the route.`;
}

function Trophies({ list }: { readonly list: readonly CampTrophyView[] }) {
  if (list.length === 0) return <p className={l.caption}>No trophies by the fire yet.</p>;
  return (
    <ul className={s.trophies} aria-label="Trophies">
      {list.map((t) => (
        <li key={t.id} className={s.trophy} data-kind={t.kind}>
          <span className={s.trophyKind}>{TROPHY_KIND_LABEL[t.kind]}</span>
          <span className={s.trophyLabel}>{t.label}</span>
        </li>
      ))}
    </ul>
  );
}

function CampCard({ c, children }: { readonly c: CampView; readonly children?: ReactNode }) {
  return (
    <article className={s.card} data-testid="camp-card">
      <span className={s.banner}>{c.mine ? 'Held by you' : `Held by ${c.owner}`}</span>
      <span className={s.name}>{c.name}</span>
      <span className={l.caption}>
        {zoneName(c.zoneId)} · claimed {relativeTime(c.claimedAt)}
      </span>
      <Trophies list={c.trophies} />
      <div className={s.guard} aria-label="Guard">
        <span className={l.sectionTitle}>Guard</span>
        <ul className={s.guardList}>
          {c.guard.map((g, i) => (
            <li key={`${g.speciesId}:${i}`} className={s.guardOne} data-type={primaryType(g.speciesId)}>
              <CreatureSprite speciesId={g.speciesId} size="sm" />
              <span className={s.level}>Lv {g.level}</span>
            </li>
          ))}
        </ul>
      </div>
      {children}
    </article>
  );
}

export function CampScreen() {
  const close = useClosePanel();
  const [view, setView] = useState<CampsView | null>(null);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  // the zone room's camp (a claim, an edit, a takeover) brings a fresh read
  const owner = useCampStore((st) => st.owner);
  const banner = useCampStore((st) => st.name);
  const zoneCamp = useCampStore((st) => st.zoneId);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('camps', { signal: ctl.signal })
      .then((v) => {
        setView(v);
        setName(v.mine?.name ?? '');
        setPicked(null);
        applyInventoryDelta(toInventoryDelta({ money: v.you.money }));
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [owner, banner, zoneCamp]);

  const edit = (body: { name?: string; trophies?: string[] }, done: string): void => {
    setBusy(true);
    setError(null);
    apiFetch('campEdit', { body })
      .then((v) => {
        setView(v);
        setPicked(null);
        toast('success', done);
      })
      .catch((e: unknown) => setError(describeError(e)))
      .finally(() => setBusy(false));
  };
  const abandon = (): void => {
    if (!sure) return setSure(true);
    setBusy(true);
    apiFetch('campAbandon', { body: {} })
      .then((v) => {
        setView(v);
        toast('info', 'You broke camp. It stands free for the next trainer.');
      })
      .catch((e: unknown) => toast('warn', describeError(e)))
      .finally(() => {
        setBusy(false);
        setSure(false);
      });
  };
  const claim = (): void => getWorldSession().send('camp', { action: 'claim' });
  const raid = (): void => {
    getWorldSession().send('camp', { action: 'raid' });
    close();
  };

  const here = view?.here ?? null;
  const mine = view?.mine ?? null;
  const chosen = picked ?? mine?.trophies.map((t) => t.id) ?? [];
  const toggle = (id: string): void => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length < CAMP_TROPHY_SLOTS ? [...chosen, id] : chosen;
    setPicked(next);
  };

  return (
    <Panel
      title="Camp"
      eyebrow={here !== null ? `${zoneName(here.zoneId)} · Travellers' camp` : "Travellers' camps"}
      subtitle="Claim a route's camp, set your trophies by the fire, and your party guards it while you are away."
      onClose={close}
    >
      {view === null ? (
        <Skeleton shape="rows" count={3} label="Loading the camp" />
      ) : !view.enabled ? (
        <p className={l.body}>{CAMP_REFUSAL_TEXT.campsOff}</p>
      ) : (
        <div className={s.screen} data-testid="camp-screen">
          {here !== null && (
            <section className={l.section} aria-label="This camp">
              <h4 className={l.sectionTitle}>This camp</h4>
              {here.camp === null ? (
                <div className={s.free}>
                  <p className={s.note}>Nobody holds this camp. Claim it and your party keeps it while you are away.</p>
                  <Button variant="primary" disabled={mine !== null || view.you.inRun} onClick={claim}>
                    Claim this camp
                  </Button>
                  <span className={l.caption}>{mine !== null ? CAMP_REFUSAL_TEXT.haveCamp : view.you.inRun ? CAMP_REFUSAL_TEXT.inRun : 'One camp per trainer. Stand by the fire.'}</span>
                </div>
              ) : here.camp.mine ? (
                <p className={s.note}>This is your camp. Set its banner and trophies below.</p>
              ) : (
                <CampCard c={here.camp}>
                  <p className={s.stakes}>{raidStakes(here.camp)}</p>
                  {raidBlock(here.camp, view.you.inRun) !== null ? (
                    <p className={s.note}>{raidBlock(here.camp, view.you.inRun)}</p>
                  ) : (
                    <Button variant="primary" onClick={raid}>
                      Raid the camp
                    </Button>
                  )}
                </CampCard>
              )}
            </section>
          )}

          <section className={l.section} aria-label="Your camp">
            <h4 className={l.sectionTitle}>Your camp</h4>
            {mine === null ? (
              <p className={l.caption}>You hold no camp. Every route has a travellers' camp: claim a free one at its fire.</p>
            ) : (
              <CampCard c={mine}>
                <div className={s.editRow}>
                  <TextField label="Banner" value={name} onChange={setName} maxLength={CAMP_NAME_MAX} error={error} hint={`Up to ${CAMP_NAME_MAX} characters, shown to everyone on the route.`} />
                  <Button disabled={busy || name.trim().length === 0 || name.trim() === mine.name} busy={busy} onClick={() => edit({ name }, 'The new banner flies.')}>
                    Raise banner
                  </Button>
                </div>
                <div className={s.pick}>
                  <span className={l.sectionTitle}>
                    Trophies by the fire ({chosen.length} of {CAMP_TROPHY_SLOTS})
                  </span>
                  {view.earned.length === 0 ? (
                    <p className={l.caption}>Nothing earned yet. Bring down a nemesis, catch a legendary, climb the ranks, claim an achievement or bring in a bounty.</p>
                  ) : (
                    <ul className={s.earned}>
                      {view.earned.map((t) => (
                        <li key={t.id}>
                          <button type="button" className={s.earnedOne} data-kind={t.kind} aria-pressed={chosen.includes(t.id)} onClick={() => toggle(t.id)}>
                            <span className={s.trophyKind}>{TROPHY_KIND_LABEL[t.kind]}</span>
                            <span className={s.trophyLabel}>{t.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button variant="primary" disabled={busy || picked === null} busy={busy} onClick={() => edit({ trophies: chosen }, 'Your trophies stand by the fire.')}>
                    Set trophies
                  </Button>
                </div>
                <Button variant="danger" size="sm" className={s.abandon} disabled={busy} onClick={abandon}>
                  {sure ? 'Break camp for good' : 'Abandon camp'}
                </Button>
              </CampCard>
            )}
          </section>

          {view.log.length > 0 && (
            <section className={l.section} aria-label="Camp log">
              <h4 className={l.sectionTitle}>Camp log</h4>
              <ul className={s.rows}>
                {view.log.map((e, i) => (
                  <li key={`${e.at}:${i}`} className={s.row} data-won={e.won || undefined}>
                    <span className={l.body}>{e.line}</span>
                    <time className={l.caption} dateTime={e.at}>
                      {relativeTime(e.at)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.camps.length > 0 && (
            <section className={l.section} aria-label="Camps held">
              <h4 className={l.sectionTitle}>Camps held</h4>
              <ul className={s.rows}>
                {view.camps.map((c) => (
                  <li key={c.zoneId} className={s.row}>
                    <span className={s.rowName}>{c.name}</span>
                    <span className={l.caption}>
                      {zoneName(c.zoneId)} · {c.owner}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
