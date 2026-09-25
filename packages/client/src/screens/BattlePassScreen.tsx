/**
 * `/play/pass` (SPEC §20.9.10). Header: trainer level in the display face and a bar to the next 1 000 exp with the
 * exact `exp / 1000` in mono. A horizontal track of the 100 reward tiles (virtualised: only the tiles in view are in
 * the DOM, absolutely placed with a `--i` custom property), each claimable · claimed · locked; claimable tiles pulse
 * once on entry. Level 50 offers the mythical choice (lumyth / noxmyth, "Choose once").
 * Claim → `POST /battle-pass/claim` → applyInventoryDelta.
 */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLoaderData } from 'react-router';
import { MYTHICAL_CHOICES } from '@ewa/protocol';
import type { battlePassLoader } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { itemInfo, species, speciesName } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { CreatureSprite } from '../ui/CreatureSprite';
import { cssVars } from '../ui/cssVars';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { cx } from '../ui/cx';
import s from './BattlePassScreen.module.css';
import l from './layout.module.css';
import { previewCreature, useClosePanel, useIntent } from './shared';

/** tile pitch in px (tile 136 + gap 12) — BattlePassScreen.module.css uses the same number via --pitch */
export const TILE_PITCH = 148;
const BUFFER = 3;

type Reward = Awaited<ReturnType<typeof battlePassLoader>>['rewards'][number];
type TileState = 'claimable' | 'claimed' | 'locked';

export function visibleWindow(scrollLeft: number, viewport: number, count: number): readonly [number, number] {
  const first = Math.max(0, Math.floor(scrollLeft / TILE_PITCH) - BUFFER);
  const last = Math.min(count, Math.ceil((scrollLeft + viewport) / TILE_PITCH) + BUFFER);
  return [first, last];
}

function rewardSummary(r: Reward): string {
  const parts: string[] = [];
  if (r.money > 0) parts.push(formatMoney(r.money));
  for (const [id, n] of Object.entries(r.items)) parts.push(`${itemInfo(id).name} ×${n}`);
  if (r.creature !== null) parts.push(`${speciesName(r.creature.species)} Lv ${r.creature.level}`);
  if (r.mythicalChoice !== null) parts.push('Mythical choice');
  return parts.join(' · ');
}

/** Daily missions + weekly goals (server part 2 Q11): progress from `quests[questId][missionId]`, one claim each. */
function Missions({ fetcher }: { readonly fetcher: ReturnType<typeof useIntent> }) {
  const missions = useSessionStore(useShallow((st) => st.progression?.missions ?? NO_MISSIONS));
  const quests = useSessionStore((st) => st.progression?.quests ?? null);
  if (missions.length === 0) return null;
  return (
    <section className={s.missions} aria-label="Missions">
      <h3 className={l.h3}>Daily missions and weekly goals</h3>
      <ul className={s.missionList}>
        {missions.map((m) => {
          const prog = quests?.[m.questId]?.[m.id];
          const count = Math.min(m.target, prog?.count ?? 0);
          const done = prog?.done ?? false;
          const reward = [m.reward.money > 0 ? formatMoney(m.reward.money) : null, ...Object.entries(m.reward.items).map(([id, n]) => `${itemInfo(id).name} ×${n}`)].filter((x) => x !== null).join(' · ');
          return (
            <li key={`${m.questId}:${m.id}`} className={s.mission}>
              <div className={l.stack}>
                <span className={s.missionTitle}>{m.title}</span>
                <span className={l.caption}>
                  {m.questId.startsWith('weekly:') ? 'Weekly' : 'Daily'} · {reward}
                </span>
              </div>
              <span className={l.mono}>
                {count} / {m.target}
              </span>
              {m.claimed ? (
                <span className={s.stateTag}>
                  <Icon name="check" size="sm" /> Claimed
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!done}
                  busy={fetcher.busy((p) => p.intent === 'claimMission' && p['missionId'] === m.id && p['questId'] === m.questId)}
                  onClick={() => fetcher.submit({ intent: 'claimMission', questId: m.questId, missionId: m.id })}
                >
                  {done ? 'Claim' : 'In progress'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const NO_MISSIONS: readonly never[] = [];

function Tile({ r, index, state, busy, onClaim }: { readonly r: Reward; readonly index: number; readonly state: TileState; readonly busy: boolean; readonly onClaim: () => void }) {
  return (
    <li className={cx(s.tile, s[state], s[`rarity_${r.rarity}`])} style={cssVars({ '--i': index })} aria-label={`Level ${r.level}: ${r.label}, ${state}`}>
      <span className={s.level}>Lv {r.level}</span>
      <span className={s.art} aria-hidden>
        {r.creature !== null ? (
          <CreatureSprite speciesId={r.creature.species} size="md" />
        ) : r.mythicalChoice !== null ? (
          <Icon name="alpha" size="lg" />
        ) : Object.keys(r.items).length > 0 ? (
          <Icon name="bag" size="lg" />
        ) : (
          <Icon name="coin" size="lg" />
        )}
      </span>
      <span className={s.label}>{r.label}</span>
      <span className={s.summary}>{rewardSummary(r)}</span>
      <span className={s.foot}>
        {state === 'claimable' && r.mythicalChoice === null && (
          <Button size="sm" variant="primary" busy={busy} onClick={onClaim}>
            Claim
          </Button>
        )}
        {state === 'claimable' && r.mythicalChoice !== null && <span className={s.stateTag}>Choose below</span>}
        {state === 'claimed' && (
          <span className={s.stateTag}>
            <Icon name="check" size="sm" /> Claimed
          </span>
        )}
        {state === 'locked' && (
          <span className={s.stateTag}>
            <Icon name="lock" size="sm" /> Locked
          </span>
        )}
      </span>
    </li>
  );
}

export function BattlePassScreen() {
  const close = useClosePanel();
  const bp = useLoaderData<typeof battlePassLoader>();
  const exp = useSessionStore((st) => st.progression?.trainerExp ?? bp.trainerExp);
  const level = useSessionStore((st) => st.progression?.trainerLevel ?? bp.trainerLevel);
  const fetcher = useIntent('/play/pass');
  const trackRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [viewport, setViewport] = useState(1000);

  const claimed = new Set(bp.claimed);
  const stateOf = (r: Reward): TileState => (claimed.has(r.level) ? 'claimed' : r.level <= level ? 'claimable' : 'locked');
  const rewards = [...bp.rewards].sort((a, b) => a.level - b.level);
  const claimable = rewards.filter((r) => stateOf(r) === 'claimable').length;
  const mythical = rewards.find((r) => r.mythicalChoice !== null) ?? null;
  const firstOpen = rewards.findIndex((r) => stateOf(r) !== 'claimed');

  // mount only: start the track at the first unclaimed tile; later claims must not yank it
  const startAt = useRef(firstOpen);
  useEffect(() => {
    const el = trackRef.current;
    if (el === null) return;
    setViewport(el.clientWidth);
    el.scrollLeft = Math.max(0, startAt.current - 1) * TILE_PITCH;
    setScroll(el.scrollLeft);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => setViewport(el.clientWidth));
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const [first, last] = visibleWindow(scroll, viewport, rewards.length);
  const into = level >= 100 ? 1000 : exp % 1000;

  return (
    <Panel title="Battle Pass" eyebrow={claimable > 0 ? `${claimable} reward${claimable === 1 ? '' : 's'} to claim` : 'Season'} onClose={close}>
      <header className={s.hero}>
        <div className={s.levelBlock}>
          <span className={s.levelLabel}>Trainer level</span>
          <span className={s.levelValue}>{level}</span>
        </div>
        <div className={s.expBlock}>
          <div className={l.rowBetween}>
            <span className={l.muted}>{level >= 100 ? 'Max level reached' : `Next: level ${level + 1}`}</span>
            <span className={l.mono}>{into} / 1000</span>
          </div>
          <ProgressBar value={into / 1000} size="lg" label="Progress to next trainer level" valueText={`${into} of 1000 exp`} />
          <p className={l.caption}>Trainer exp comes from battles, catches, quests and restoring zones — granted by the server.</p>
        </div>
      </header>

      <div ref={trackRef} className={s.trackWrap} onScroll={(e) => setScroll(e.currentTarget.scrollLeft)} tabIndex={0} aria-label="Reward track">
        <ol className={s.track} style={cssVars({ '--n': rewards.length })}>
          {rewards.slice(first, last).map((r, k) => (
            <Tile
              key={r.level}
              r={r}
              index={first + k}
              state={stateOf(r)}
              busy={fetcher.busy((p) => p.intent === 'claim' && p['level'] === r.level)}
              onClaim={() => fetcher.submit({ intent: 'claim', level: r.level })}
            />
          ))}
        </ol>
      </div>

      <Missions fetcher={fetcher} />

      {mythical !== null && (
        <section className={s.mythical}>
          <div className={l.stack}>
            <h3 className={l.h3}>Level {mythical.level}: the mythical choice</h3>
            <p className={l.muted}>
              {bp.mythicalChoice !== null
                ? `You chose ${speciesName(bp.mythicalChoice)}. The other waits for another trainer.`
                : level >= mythical.level
                  ? 'Choose once. This cannot be undone.'
                  : `Unlocks at trainer level ${mythical.level}. Choose once.`}
            </p>
          </div>
          <div className={s.mythChoices}>
            {MYTHICAL_CHOICES.map((id) => (
              <div key={id} className={s.mythChoice}>
                <CreatureCard creature={previewCreature(id, 50)} variant="showcase" selected={bp.mythicalChoice === id} caption={species(id)?.flavor.slice(0, 90)} />
                <Button
                  variant="primary"
                  disabled={bp.mythicalChoice !== null || level < mythical.level}
                  busy={fetcher.busy((p) => p.intent === 'mythical' && p['species'] === id)}
                  onClick={() => fetcher.submit({ intent: 'mythical', species: id })}
                >
                  Choose {speciesName(id)}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Panel>
  );
}
