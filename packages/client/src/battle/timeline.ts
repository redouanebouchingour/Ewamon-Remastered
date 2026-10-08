/**
 * SPEC §20.5.1 — `buildTimeline(events, ctx)`: authoritative `BattleEvent[]` → a sorted keyframe list the
 * TimelinePlayer plays inside World3D.tick. Pure (content + registry lookups; no DOM, no clock, no store).
 *
 * Model (IMPLEMENTATION-NOTES part 2, B1–B4):
 * - `at` is TIMELINE time. `time` frames never move the cursor: a hitstop (`scale 0`) freezes the player's cursor
 *   for 3 real steps and crit slow-mo advances it at 0.35×, so `durationMs` = last `at` + the real-time those two add
 *   (50 per hitstop, 400 × (1 − 0.35) per crit). Under reduced effects the `at` of every other frame is identical.
 * - A move: attacker pose + sfx at `t`, the move VFX at `t + windup`, the impact at `t + windup + travel`; the
 *   consequences (damage, status, stages …) land from the impact on; `recoverMs` is spent when the next top-level
 *   event (move, switch, orb, turn end) begins.
 * - HP never comes from the client: `hp.to` is `damage.hpAfter` / `heal.hpAfter`; `hp.max` is the event's `maxHp`
 *   (heal events carry none — `ctx.maxHpOf`, the battler's maxHp from the authoritative state).
 * - Log lines are spaced ≥ LOG_DWELL_MIN (0 with `instant` text speed); a faint waits for its HP bar to drain.
 * - Compression (§20.5.3): above TURN_BUDGET the recover / status / stage / log-dwell segments are scaled (floor
 *   0.5×) so the result fits; if that alone cannot, the remaining unprotected segments (windup, travel, switch,
 *   weather) are scaled the same way. Hitstop, KO_HOLD and ORB_* never compress.
 * - Phase D6 doubles (`ctx.activesOf` given for both sides): frame refs stay core refs (party indices); the timeline
 *   tracks the party index on each field position (updated on `switchIn { pos }`, whose `enter` pose frame carries
 *   that `pos` so the player can move its party → position map), turn-start / turn-end idles and the winner's
 *   celebrate address every standing position, a drain VFX points at the battler the drainer last hit, a spread
 *   move draws its VFX to each target, a per-target `moveFailed` names the target. Singles output is unchanged.
 */
import type { BattleEvent, ContentIndex, HonorReason, MoveDef, Ref, StatKey, StatusId, TypeName, WeatherKind } from '@ewa/core';
import {
  CHROMA_SUPER, COMPRESS_FLOOR, CRIT_SLOWMO, FORM_MS, HITSTOP_MS, HP_DRAIN, KO_HOLD, LOG_DWELL_MIN, ORB_GAP, ORB_RESULT, ORB_SHAKE, ORB_THROW, SHAKE_AMP,
  SHAKE_MS, SHINY_MS, STAGE_MS, STATUS_MS, SWITCH_IN_MS, SWITCH_OUT_MS, TURN_BUDGET, WEATHER_MS,
} from './constants';
import type { MoveAnimDef, MoveAnimRegistry } from './moveAnims';
import { leadMs as sigLead, signatureOf } from './signatures';

export type KeyPose = 'idle' | 'windup' | 'lunge' | 'recoil' | 'hurt' | 'faint' | 'enter' | 'exit' | 'celebrate';
export type CameraShot = 'wide' | 'attacker' | 'defender' | 'impact' | 'ko' | 'throw';
export type LogTone = 'neutral' | 'good' | 'bad';

export type Keyframe =
  // `pos` (Phase D6 doubles only): on a switch-in's `enter`, the field position the battler takes
  | { readonly at: number; readonly k: 'pose'; readonly who: Ref; readonly pose: KeyPose; readonly pos?: 0 | 1 }
  | { readonly at: number; readonly k: 'flash'; readonly who: Ref; readonly color: string; readonly ms: number }
  | { readonly at: number; readonly k: 'vfx'; readonly id: string; readonly from: Ref | null; readonly to: Ref | null; readonly ms: number; readonly type: TypeName }
  | { readonly at: number; readonly k: 'camera'; readonly shot: CameraShot; readonly ms: number }
  | { readonly at: number; readonly k: 'shake'; readonly amp: number; readonly ms: number }
  | { readonly at: number; readonly k: 'time'; readonly scale: number; readonly ms: number }
  | { readonly at: number; readonly k: 'chroma'; readonly amount: number; readonly ms: number }
  | { readonly at: number; readonly k: 'hp'; readonly who: Ref; readonly to: number; readonly max: number; readonly ms: number }
  | { readonly at: number; readonly k: 'status'; readonly who: Ref; readonly status: string | null }
  | { readonly at: number; readonly k: 'stage'; readonly who: Ref; readonly stat: string; readonly delta: number }
  // a battle form: the battler's sprite becomes the form's (`<species>_<form>` in the creature manifest)
  | { readonly at: number; readonly k: 'form'; readonly who: Ref; readonly form: string }
  | { readonly at: number; readonly k: 'log'; readonly text: string; readonly tone: LogTone }
  | { readonly at: number; readonly k: 'sfx'; readonly id: string; readonly at3d: Ref | null }
  | { readonly at: number; readonly k: 'weather'; readonly kind: string }
  | { readonly at: number; readonly k: 'orb'; readonly phase: 'throw' | 'shake' | 'catch' | 'break'; readonly n: number }
  | { readonly at: number; readonly k: 'inputLock'; readonly locked: boolean }
  // a signature move's cinematic overlay (signatures.ts): 'start' with the cut-in, 'aim' as the charge begins (the
  // camera has settled: the overlay re-reads the battlers' screen positions)
  | { readonly at: number; readonly k: 'cinematic'; readonly phase: 'start' | 'aim'; readonly move: string; readonly who: Ref; readonly target: Ref | null; readonly mode: 'full' | 'short' }
  | { readonly at: number; readonly k: 'end' };

export type KeyframeKind = Keyframe['k'];

/** frames sorted by `at`, stable */
export interface Timeline {
  readonly frames: readonly Keyframe[];
  readonly durationMs: number;
}

export interface TimelineCtx {
  readonly content: ContentIndex;
  readonly registry: MoveAnimRegistry;
  readonly reduced: boolean;
  readonly speciesOf: (r: Ref) => string;
  // ---- optional extras (IMPLEMENTATION-NOTES part 2, B2) ----
  /** Display name inside a sentence ("the wild Mossling", "Bramble"); default: the species name. */
  readonly nameOf?: (r: Ref) => string;
  /** maxHp of a battler (heal events carry none); default: the last damage event's maxHp for that ref, else 1. */
  readonly maxHpOf?: (r: Ref) => number;
  /** Active party slot per side at the start of the events (drain VFX, turn poses); default 0. */
  readonly activeOf?: (side: 0 | 1) => number;
  /** The viewer's seat: tones are relative to it. Default 0. */
  readonly seat?: 0 | 1;
  /** Settings › battle text speed 'instant' (§20.8.6): LOG_DWELL_MIN = 0 and HP_DRAIN = 0, nothing else changes. */
  readonly instantText?: boolean;
  /** Phase D4: the battler is a shiny — its switch-in adds the `shiny_sparkle` burst and a line. Default: never. */
  readonly shinyOf?: (r: Ref) => boolean;
  /** Phase D6: the party index on field position 0 / 1 per side at the start of the events (doubles only). */
  readonly activesOf?: (side: 0 | 1) => readonly [number, number] | undefined;
  /** Phase D6: whether a battler stands at the start of the events (doubles idles skip a fainted-in-place one). Default: yes. */
  readonly standing?: (r: Ref) => boolean;
  /** Whether this battler already used signature move `move` earlier in the battle (its cinematic plays short). Default: never. */
  readonly signatureSeen?: (r: Ref, move: string) => boolean;
}

/** Real time a crit slow-mo adds over its timeline span. */
export const CRIT_EXTRA_MS = CRIT_SLOWMO.ms * (1 - CRIT_SLOWMO.scale);

/** SFX ids the timeline can emit (the audio boot validation checks them against the manifest). */
export const TIMELINE_SFX: readonly string[] = [
  'hit_normal', 'hit_super', 'hit_weak', 'hit_crit', 'faint', 'switch', 'orb_throw', 'orb_shake', 'orb_catch', 'orb_break',
  'status_burn', 'status_poison', 'status_paralyze', 'status_sleep', 'status_freeze', 'status_confuse', 'status_heal',
  'stage_up', 'stage_down', 'weather_sun', 'weather_rain', 'weather_sand', 'weather_hail', 'ui_levelup',
];

const STATUS_WORD: Readonly<Record<StatusId, { applied: string; tick: string; cured: string; vfx: string; color: string; glyph: string }>> = {
  burn: { applied: 'was burned!', tick: 'is hurt by its burn!', cured: 'was healed of its burn.', vfx: 'status_burn', color: '#ee6f4a', glyph: 'brn' },
  poison: { applied: 'was poisoned!', tick: 'is hurt by poison!', cured: 'was cured of its poison.', vfx: 'status_poison', color: '#9a5bb0', glyph: 'psn' },
  paralyze: { applied: 'is paralyzed! It may be unable to move!', tick: 'is paralyzed! It can’t move!', cured: 'was cured of paralysis.', vfx: 'status_paralyze', color: '#f4cf3f', glyph: 'par' },
  sleep: { applied: 'fell asleep!', tick: 'is fast asleep.', cured: 'woke up!', vfx: 'status_sleep', color: '#8aa6e0', glyph: 'slp' },
  freeze: { applied: 'was frozen solid!', tick: 'is frozen solid!', cured: 'thawed out!', vfx: 'status_freeze', color: '#8fd6e8', glyph: 'frz' },
  confuse: { applied: 'became confused!', tick: 'is confused!', cured: 'snapped out of its confusion!', vfx: 'status_confuse', color: '#e06fa0', glyph: 'cnf' },
};

/** The HUD status glyph for a major status (confusion is not shown on the bar). */
export function statusGlyph(s: StatusId | null): string | null {
  if (s === null || s === 'confuse') return null;
  return STATUS_WORD[s].glyph;
}

const STAT_WORD: Readonly<Record<StatKey, string>> = { atk: 'Attack', def: 'Defense', spd: 'Speed', acc: 'accuracy', eva: 'evasiveness' };
export const STAT_SHORT: Readonly<Record<StatKey, string>> = { atk: 'Atk', def: 'Def', spd: 'Spe', acc: 'Acc', eva: 'Eva' };

/** The honor ledger's deeds (core honor.ts), as the battle log tells them. */
export const HONOR_REASON: Readonly<Record<HonorReason, string>> = {
  dirtyTrick: 'a dirty trick.',
  wildKo: 'it put down a wild creature.',
  spared: 'it spared a wild creature.',
  duelWon: 'a duel fairly won.',
};

const WEATHER_TEXT: Readonly<Record<Exclude<WeatherKind, 'none'>, { set: string; tick: string; end: string }>> = {
  sun: { set: 'The sunlight turned harsh!', tick: 'The sunlight is strong.', end: 'The sunlight faded.' },
  rain: { set: 'It started to rain!', tick: 'Rain continues to fall.', end: 'The rain stopped.' },
  sand: { set: 'A sandstorm kicked up!', tick: 'The sandstorm rages.', end: 'The sandstorm subsided.' },
  hail: { set: 'It started to hail!', tick: 'Hail continues to fall.', end: 'The hail stopped.' },
};

const CHIP_TEXT: Readonly<Record<string, string>> = {
  burn: 'is hurt by its burn!',
  poison: 'is hurt by poison!',
  trap: 'is squeezed by the trap!',
  sand: 'is buffeted by the sandstorm!',
  hail: 'is pelted by hail!',
  recoil: 'is damaged by the recoil!',
  confusion: 'hurt itself in its confusion!',
  contact: 'was hurt on contact!',
};
const CHIP_VFX: Readonly<Record<string, string>> = {
  burn: 'status_burn', poison: 'status_poison', trap: 'trap', sand: 'weather_sand', hail: 'weather_hail', recoil: 'recoil', confusion: 'status_confuse', contact: 'impact_normal',
};

/** `formChange`: the burst and the line per battle form id (an unknown form gets the switch-in burst and a plain line). */
const FORM_VFX: Readonly<Record<string, string>> = { rage: 'form_rage' };
const FORM_TEXT: Readonly<Record<string, (name: string) => string>> = {
  rage: (n) => `${n}’s mask cracks — it flies into a rage!`,
};

const FAIL_TEXT: Readonly<Record<string, string>> = {
  fullHp: 'But its HP is already full!',
  noTarget: 'But there was no target…',
  trapped: 'It can’t escape!',
  noEffect: 'But it failed!',
  immune: 'It doesn’t affect the target…',
  wonderGuard: 'Wonder Guard protects it!',
};

function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

type Cat = 'recover' | 'status' | 'stage' | 'dwell' | 'other' | 'fixed';

interface Pending {
  readonly who: Ref;
  readonly def: MoveAnimDef;
}

/** Sum of real time `time` frames add over their timeline span (for `durationMs`). */
function realExtra(frames: readonly Keyframe[]): number {
  let x = 0;
  for (const f of frames) {
    if (f.k !== 'time') continue;
    x += f.scale === 0 ? f.ms : f.ms * (1 - f.scale);
  }
  return x;
}

function build(events: readonly BattleEvent[], ctx: TimelineCtx, fSpec: number, fOther: number): Timeline {
  const frames: Keyframe[] = [];
  const seat = ctx.seat ?? 0;
  const reduced = ctx.reduced;
  const instant = ctx.instantText === true;
  const dwell = instant ? 0 : LOG_DWELL_MIN;
  const active: [number, number] = [ctx.activeOf?.(0) ?? 0, ctx.activeOf?.(1) ?? 0];
  // Phase D6: the party index on each field position (null in singles), who is down, and who each drainer last hit
  const a0 = ctx.activesOf?.(0);
  const a1 = ctx.activesOf?.(1);
  const field: [[number, number], [number, number]] | null = a0 !== undefined && a1 !== undefined ? [[a0[0], a0[1]], [a1[0], a1[1]]] : null;
  const down = new Set<string>();
  const lastHit = new Map<string, Ref>();
  const maxSeen = new Map<string, number>();
  const hpEnd = new Map<string, number>();
  let t = 0;
  let lastLog = Number.NEGATIVE_INFINITY;
  let pending: Pending | null = null;
  let catchTarget: Ref | null = null;
  let shakesSeen = 0;
  /** `side:slot:move` of the signature moves already used in these events (a second use plays short) */
  const sigSeen = new Set<string>();

  const key = (r: Ref): string => `${r.side}:${r.slot}`;
  const scaleOf = (c: Cat): number => (c === 'fixed' ? 1 : c === 'other' ? fOther : fSpec);
  const advance = (ms: number, c: Cat): void => {
    t += ms * scaleOf(c);
  };
  const push = (f: Keyframe): void => {
    frames.push(f);
  };
  const species = (r: Ref): string => ctx.speciesOf(r);
  const name = (r: Ref): string => {
    if (ctx.nameOf !== undefined) return ctx.nameOf(r);
    try {
      return ctx.content.species(species(r)).name;
    } catch (_e) {
      return species(r);
    }
  };
  const typeOf = (r: Ref | null): TypeName => {
    if (r === null) return 'Normal';
    try {
      return ctx.content.species(species(r)).types[0];
    } catch (_e) {
      return 'Normal';
    }
  };
  const tone = (r: Ref, goodForOwner: boolean): LogTone => ((r.side === seat) === goodForOwner ? 'good' : 'bad');
  const log = (text: string, tn: LogTone = 'neutral'): void => {
    const next = lastLog + dwell * scaleOf('dwell');
    if (t < next) t = next;
    push({ at: t, k: 'log', text, tone: tn });
    lastLog = t;
  };
  const maxHp = (r: Ref): number => {
    const seen = maxSeen.get(key(r));
    if (seen !== undefined) return seen;
    const m = ctx.maxHpOf?.(r);
    return m !== undefined && m > 0 ? m : 1;
  };
  const itemName = (id: string): string => {
    try {
      return ctx.content.item(id).name;
    } catch (_e) {
      try {
        return ctx.content.orb(id).name;
      } catch (_e2) {
        return id;
      }
    }
  };
  const moveDef = (id: string | null): MoveDef | null => {
    if (id === null) return null;
    try {
      return ctx.content.move(id);
    } catch (_e) {
      return null;
    }
  };
  /** The recover tail of the last move, spent when the next top-level event starts. */
  const flush = (): void => {
    if (pending === null) return;
    advance(pending.def.recoverMs, 'recover');
    push({ at: t, k: 'pose', who: pending.who, pose: 'idle' });
    pending = null;
  };
  const hpFrame = (who: Ref, to: number, max: number, frac: number): void => {
    const ms = reduced || instant ? 0 : HP_DRAIN(frac);
    push({ at: t, k: 'hp', who, to, max, ms });
    // a faint waits for the nominal drain in both effect modes, so reduced changes no other frame's `at`
    hpEnd.set(key(who), t + (instant ? 0 : HP_DRAIN(frac)));
  };

  if (field !== null) {
    for (const side of [0, 1] as const) for (const slot of field[side]) if (ctx.standing?.({ side, slot }) === false) down.add(key({ side, slot }));
  }
  /** Phase D6: a pose on every standing field battler of `side` (doubles). */
  const posesOf = (side: 0 | 1, pose: KeyPose): void => {
    for (const slot of field![side]) if (!down.has(key({ side, slot }))) push({ at: t, k: 'pose', who: { side, slot }, pose });
  };

  push({ at: 0, k: 'inputLock', locked: true });

  for (const e of events) {
    switch (e.t) {
      case 'turnStart':
        flush();
        if (field !== null) {
          posesOf(0, 'idle');
          posesOf(1, 'idle');
          break;
        }
        push({ at: t, k: 'pose', who: { side: 0, slot: active[0] }, pose: 'idle' });
        push({ at: t, k: 'pose', who: { side: 1, slot: active[1] }, pose: 'idle' });
        break;
      case 'switchOut':
        flush();
        if (e.reason === 'action') log(e.who.side === seat ? `${cap(name(e.who))}, come back!` : `${cap(name(e.who))} was withdrawn.`);
        push({ at: t, k: 'pose', who: e.who, pose: 'exit' });
        push({ at: t, k: 'vfx', id: 'switch_out', from: e.who, to: e.who, ms: SWITCH_OUT_MS, type: typeOf(e.who) });
        push({ at: t, k: 'sfx', id: 'switch', at3d: e.who });
        if (e.reason === 'action') advance(SWITCH_OUT_MS, 'other');
        break;
      case 'switchIn':
        flush();
        active[e.who.side] = e.who.slot;
        log(e.who.side === seat ? `Go, ${name(e.who)}!` : `${cap(name(e.who))} appeared!`);
        if (field !== null && e.pos !== undefined) {
          field[e.who.side][e.pos] = e.who.slot;
          down.delete(key(e.who));
          push({ at: t, k: 'pose', who: e.who, pose: 'enter', pos: e.pos });
        } else push({ at: t, k: 'pose', who: e.who, pose: 'enter' });
        push({ at: t, k: 'vfx', id: 'switch_in', from: e.who, to: e.who, ms: SWITCH_IN_MS, type: typeOf(e.who) });
        push({ at: t, k: 'sfx', id: 'switch', at3d: e.who });
        advance(SWITCH_IN_MS, 'other');
        if (ctx.shinyOf?.(e.who) === true) {
          push({ at: t, k: 'vfx', id: 'shiny_sparkle', from: e.who, to: e.who, ms: SHINY_MS, type: typeOf(e.who) });
          log(`${cap(name(e.who))} sparkles — it’s a shiny!`, 'neutral');
          advance(SHINY_MS, 'other');
        }
        break;
      case 'abilityTrigger':
        log(`${cap(name(e.who))}’s ${e.ability}${e.detail.length > 0 && e.detail !== e.ability ? ` — ${e.detail}` : '!'}`);
        push({ at: t, k: 'flash', who: e.who, color: '#ffffff', ms: 180 });
        advance(STATUS_MS * 0.6, 'status');
        break;
      case 'moveUsed': {
        flush();
        const mv = moveDef(e.move);
        const def = mv !== null ? ctx.registry.get(e.move, mv) : null;
        const type: TypeName = mv?.type ?? 'Normal';
        log(`${cap(name(e.who))} used ${e.move}!`, 'neutral');
        if (def === null) break;
        const selfish = mv!.target === 'self' || mv!.target === 'field';
        // a signature move: its cinematic's cut-in, then lead / windup / travel uncompressed so its impact beat lands on
        // the damage frame (signatures.ts)
        const sig = selfish ? undefined : signatureOf(e.move);
        if (sig !== undefined) {
          const sk = `${key(e.who)}:${e.move}`;
          const mode = (ctx.signatureSeen?.(e.who, e.move) ?? false) || sigSeen.has(sk) ? 'short' : 'full';
          sigSeen.add(sk);
          const target = e.targets !== undefined && e.targets.length > 0 ? e.targets[0]! : e.target;
          push({ at: t, k: 'cinematic', phase: 'start', move: e.move, who: e.who, target, mode });
          push({ at: t, k: 'camera', shot: 'wide', ms: Math.round(sigLead(sig, mode) + def.windupMs + def.travelMs + def.recoverMs) });
          for (const id of sig.sfx) push({ at: t, k: 'sfx', id, at3d: e.who });
          advance(sigLead(sig, mode), 'fixed');
          push({ at: t, k: 'cinematic', phase: 'aim', move: e.move, who: e.who, target, mode });
        }
        const mf = sig !== undefined ? 1 : fOther;
        if (def.attackerPose !== 'idle') push({ at: t, k: 'pose', who: e.who, pose: def.attackerPose });
        push({ at: t, k: 'sfx', id: def.sfx, at3d: e.who });
        if (def.camera !== 'impact') push({ at: t, k: 'camera', shot: def.camera, ms: Math.round(def.windupMs + def.travelMs + def.recoverMs) });
        const vfxAt = t + def.windupMs * mf;
        if (e.targets !== undefined && e.targets.length > 0 && !selfish) {
          // Phase D6: a doubles spread move travels to every target
          for (const to of e.targets) push({ at: vfxAt, k: 'vfx', id: def.vfx, from: e.who, to, ms: def.travelMs > 0 ? def.travelMs : 500, type });
        } else push({ at: vfxAt, k: 'vfx', id: def.vfx, from: e.who, to: selfish ? e.who : e.target, ms: def.travelMs > 0 ? def.travelMs : 500, type });
        advance(def.windupMs + def.travelMs, sig !== undefined ? 'fixed' : 'other');
        if (def.camera === 'impact') push({ at: t, k: 'camera', shot: 'impact', ms: Math.round(def.recoverMs + 200) });
        pending = { who: e.who, def };
        break;
      }
      case 'moveMissed':
        log(`${cap(name(e.who))}’s attack missed!`, tone(e.who, false));
        push({ at: t, k: 'camera', shot: 'defender', ms: 400 });
        advance(200, 'status');
        break;
      case 'moveFailed':
        // Phase D6: a spread move's per-target failure names the target
        if (e.target !== undefined && e.reason === 'immune') log(`It doesn’t affect ${name(e.target)}…`, tone(e.who, false));
        else log(FAIL_TEXT[e.reason] ?? 'But it failed!', tone(e.who, false));
        break;
      case 'damage': {
        maxSeen.set(key(e.target), e.maxHp);
        if (field !== null && e.cause === 'move' && e.source !== null) lastHit.set(key(e.source), e.target);
        const frac = e.maxHp > 0 ? e.amount / e.maxHp : 0;
        if (e.cause === 'move') {
          if (e.amount > 0) {
            const impact = e.crit ? 'impact_crit' : e.effectiveness >= 2 ? 'impact_super' : e.effectiveness < 1 ? 'impact_resist' : 'impact_normal';
            push({ at: t, k: 'vfx', id: impact, from: e.source, to: e.target, ms: 300, type: moveDef(e.move)?.type ?? typeOf(e.source) });
            push({ at: t, k: 'pose', who: e.target, pose: 'hurt' });
            if (e.crit) push({ at: t, k: 'flash', who: e.target, color: '#ffffff', ms: 90 });
            if (!reduced) {
              push({ at: t, k: 'time', scale: 0, ms: HITSTOP_MS });
              push({ at: t, k: 'shake', amp: SHAKE_AMP(frac), ms: SHAKE_MS });
              if (e.effectiveness >= 2) push({ at: t, k: 'chroma', amount: CHROMA_SUPER.amount, ms: CHROMA_SUPER.ms });
              if (e.crit) push({ at: t, k: 'time', scale: CRIT_SLOWMO.scale, ms: CRIT_SLOWMO.ms });
            }
            push({ at: t, k: 'sfx', id: e.crit ? 'hit_crit' : e.effectiveness >= 2 ? 'hit_super' : e.effectiveness < 1 ? 'hit_weak' : 'hit_normal', at3d: e.target });
            hpFrame(e.target, e.hpAfter, e.maxHp, frac);
            const parts: string[] = [];
            if (e.crit) parts.push('A critical hit!');
            if (e.effectiveness >= 2) parts.push('It’s super effective!');
            else if (e.effectiveness > 0 && e.effectiveness < 1) parts.push('It’s not very effective…');
            if (parts.length > 0) log(parts.join(' '), tone(e.target, false));
          } else {
            hpFrame(e.target, e.hpAfter, e.maxHp, 0);
            log(`It doesn’t affect ${name(e.target)}…`, tone(e.target, true));
          }
        } else {
          push({ at: t, k: 'vfx', id: CHIP_VFX[e.cause] ?? 'impact_normal', from: e.source, to: e.target, ms: 400, type: typeOf(e.target) });
          push({ at: t, k: 'pose', who: e.target, pose: 'hurt' });
          push({ at: t, k: 'sfx', id: 'hit_normal', at3d: e.target });
          hpFrame(e.target, e.hpAfter, e.maxHp, frac);
          log(`${cap(name(e.target))} ${CHIP_TEXT[e.cause] ?? 'was hurt!'}`, tone(e.target, false));
          advance(STATUS_MS, 'status');
        }
        break;
      }
      case 'heal': {
        const max = maxHp(e.target);
        const foe: Ref = field !== null ? (lastHit.get(key(e.target)) ?? { side: e.target.side === 0 ? 1 : 0, slot: field[e.target.side === 0 ? 1 : 0][0] }) : { side: e.target.side === 0 ? 1 : 0, slot: active[e.target.side === 0 ? 1 : 0] };
        push({ at: t, k: 'vfx', id: e.cause === 'drain' || e.cause === 'absorb' ? 'drain' : 'heal', from: e.target, to: e.cause === 'drain' ? foe : e.target, ms: 500, type: typeOf(e.target) });
        push({ at: t, k: 'sfx', id: 'status_heal', at3d: e.target });
        hpFrame(e.target, e.hpAfter, max, max > 0 ? e.amount / max : 0);
        const why = e.cause === 'drain' ? 'had its energy drained!' : e.cause === 'berry' || e.cause === 'item' ? `restored HP${e.item !== null ? ` with its ${itemName(e.item)}` : ''}.` : 'restored its HP.';
        log(e.cause === 'drain' ? `${cap(name(foe))} ${why}` : `${cap(name(e.target))} ${why}`, tone(e.target, true));
        advance(STATUS_MS, 'status');
        break;
      }
      case 'statusApplied': {
        const w = STATUS_WORD[e.status];
        push({ at: t, k: 'vfx', id: w.vfx, from: e.source, to: e.target, ms: STATUS_MS, type: typeOf(e.target) });
        push({ at: t, k: 'flash', who: e.target, color: w.color, ms: 200 });
        if (e.status !== 'confuse') push({ at: t, k: 'status', who: e.target, status: w.glyph });
        push({ at: t, k: 'sfx', id: w.vfx, at3d: e.target });
        log(`${cap(name(e.target))} ${w.applied}`, tone(e.target, false));
        advance(STATUS_MS, 'status');
        break;
      }
      case 'statusBlocked':
        log(e.reason === 'alreadyStatused' ? `${cap(name(e.target))} is already affected.` : `${cap(name(e.target))} is unaffected!`, tone(e.target, true));
        break;
      case 'statusTick': {
        const w = STATUS_WORD[e.status];
        push({ at: t, k: 'vfx', id: w.vfx, from: e.target, to: e.target, ms: STATUS_MS, type: typeOf(e.target) });
        push({ at: t, k: 'sfx', id: w.vfx, at3d: e.target });
        log(`${cap(name(e.target))} ${w.tick}`, tone(e.target, false));
        advance(STATUS_MS, 'status');
        break;
      }
      case 'statusCured': {
        const w = STATUS_WORD[e.status];
        if (e.status !== 'confuse') push({ at: t, k: 'status', who: e.target, status: null });
        log(`${cap(name(e.target))} ${w.cured}`, tone(e.target, true));
        advance(STATUS_MS * 0.6, 'status');
        break;
      }
      case 'formChange': {
        // a battle form (hollowmane's rage): the hit finishes draining, then the burst and the roar; the sprite swaps
        // at the burst's peak, then the line
        flush();
        const drained = hpEnd.get(key(e.who));
        if (drained !== undefined && t < drained) t = drained;
        push({ at: t, k: 'flash', who: e.who, color: '#ff2a44', ms: 300 });
        push({ at: t, k: 'vfx', id: FORM_VFX[e.form] ?? 'switch_in', from: e.who, to: e.who, ms: FORM_MS, type: typeOf(e.who) });
        push({ at: t, k: 'sfx', id: 'raid_roar', at3d: e.who });
        if (!reduced) push({ at: t, k: 'shake', amp: SHAKE_AMP(1), ms: SHAKE_MS * 3 });
        advance(FORM_MS * 0.4, 'other');
        push({ at: t, k: 'form', who: e.who, form: e.form });
        log(FORM_TEXT[e.form]?.(cap(name(e.who))) ?? `${cap(name(e.who))} changed form!`, tone(e.who, true));
        advance(FORM_MS * 0.6, 'other');
        break;
      }
      case 'flinch':
        push({ at: t, k: 'vfx', id: 'flinch', from: e.who, to: e.who, ms: 400, type: typeOf(e.who) });
        log(`${cap(name(e.who))} flinched and couldn’t move!`, tone(e.who, false));
        advance(STATUS_MS * 0.6, 'status');
        break;
      case 'statStage': {
        const up = e.delta > 0;
        if (!e.clamped) {
          push({ at: t, k: 'vfx', id: up ? 'stat_up' : 'stat_down', from: e.target, to: e.target, ms: STAGE_MS, type: typeOf(e.target) });
          push({ at: t, k: 'stage', who: e.target, stat: e.stat, delta: e.delta });
          push({ at: t, k: 'sfx', id: up ? 'stage_up' : 'stage_down', at3d: e.target });
        }
        const how = e.clamped ? (up ? 'won’t go any higher!' : 'won’t go any lower!') : Math.abs(e.delta) >= 2 ? (up ? 'rose sharply!' : 'harshly fell!') : up ? 'rose!' : 'fell!';
        log(`${cap(name(e.target))}’s ${STAT_WORD[e.stat]} ${how}`, tone(e.target, up));
        advance(STAGE_MS, 'stage');
        break;
      }
      case 'weatherSet':
        push({ at: t, k: 'weather', kind: e.kind });
        if (e.kind !== 'none') {
          push({ at: t, k: 'vfx', id: `weather_${e.kind}`, from: null, to: null, ms: WEATHER_MS, type: 'Normal' });
          push({ at: t, k: 'sfx', id: `weather_${e.kind}`, at3d: null });
          // Phase D7: the zone's ambient weather (source null, turns 0) is already there, not newly set
          log(e.source === null && e.turns === 0 ? WEATHER_TEXT[e.kind].tick : WEATHER_TEXT[e.kind].set);
        } else {
          log('The weather cleared.');
        }
        advance(WEATHER_MS, 'other');
        break;
      case 'weatherTick':
        if (e.kind !== 'none') {
          push({ at: t, k: 'vfx', id: `weather_${e.kind}`, from: null, to: null, ms: WEATHER_MS, type: 'Normal' });
          log(WEATHER_TEXT[e.kind].tick);
        } else {
          log('The weather is calm.');
        }
        advance(STATUS_MS * 0.6, 'status');
        break;
      case 'weatherEnd':
        push({ at: t, k: 'weather', kind: 'none' });
        log(e.kind !== 'none' ? WEATHER_TEXT[e.kind].end : 'The weather cleared.');
        advance(WEATHER_MS * 0.5, 'other');
        break;
      case 'trapped':
        push({ at: t, k: 'vfx', id: 'trap', from: e.source, to: e.target, ms: STATUS_MS, type: typeOf(e.source) });
        log(`${cap(name(e.target))} was trapped!`, tone(e.target, false));
        advance(STATUS_MS, 'status');
        break;
      case 'trapEnd':
        log(`${cap(name(e.target))} was freed from the trap!`, tone(e.target, true));
        advance(STATUS_MS * 0.4, 'status');
        break;
      case 'itemUsed':
        flush();
        log(e.who.side === seat ? `You used a ${itemName(e.item)}.` : `${cap(name(e.who))}’s trainer used a ${itemName(e.item)}.`);
        push({ at: t, k: 'pose', who: e.who, pose: 'windup' });
        advance(300, 'status');
        break;
      case 'heldItemTrigger':
        push({ at: t, k: 'flash', who: e.who, color: '#fff3b0', ms: 180 });
        log(`${cap(name(e.who))}’s ${itemName(e.item)} activated!`);
        advance(STATUS_MS * 0.6, 'status');
        break;
      case 'faint': {
        flush();
        const drained = hpEnd.get(key(e.who)) ?? t;
        if (drained > t) t = drained;
        push({ at: t, k: 'pose', who: e.who, pose: 'faint' });
        down.add(key(e.who));
        push({ at: t, k: 'vfx', id: 'faint', from: e.who, to: e.who, ms: KO_HOLD, type: typeOf(e.who) });
        push({ at: t, k: 'camera', shot: 'ko', ms: KO_HOLD });
        push({ at: t, k: 'sfx', id: 'faint', at3d: e.who });
        push({ at: t, k: 'log', text: `${cap(name(e.who))} fainted!`, tone: tone(e.who, false) });
        lastLog = t;
        advance(KO_HOLD, 'fixed');
        break;
      }
      case 'switchRequired':
        log(e.side === seat ? 'Choose your next creature.' : 'The opponent is choosing…');
        break;
      case 'catchThrow': {
        flush();
        catchTarget = e.target;
        shakesSeen = 0;
        log(`You threw a ${itemName(e.orb)}!`);
        const thrower: Ref = { side: e.target.side === 0 ? 1 : 0, slot: active[e.target.side === 0 ? 1 : 0] };
        push({ at: t, k: 'orb', phase: 'throw', n: 0 });
        push({ at: t, k: 'vfx', id: 'orb_throw', from: thrower, to: e.target, ms: ORB_THROW, type: 'Normal' });
        push({ at: t, k: 'camera', shot: 'throw', ms: ORB_THROW + ORB_SHAKE });
        push({ at: t, k: 'sfx', id: 'orb_throw', at3d: e.target });
        advance(ORB_THROW, 'fixed');
        push({ at: t, k: 'pose', who: e.target, pose: 'exit' });
        break;
      }
      case 'catchShake':
        if (shakesSeen > 0) advance(ORB_GAP, 'fixed');
        shakesSeen += 1;
        push({ at: t, k: 'orb', phase: 'shake', n: e.n });
        push({ at: t, k: 'vfx', id: 'orb_shake', from: catchTarget, to: catchTarget, ms: ORB_SHAKE, type: 'Normal' });
        push({ at: t, k: 'sfx', id: 'orb_shake', at3d: catchTarget });
        advance(ORB_SHAKE, 'fixed');
        break;
      case 'catchResult':
        advance(ORB_GAP, 'fixed');
        push({ at: t, k: 'orb', phase: e.caught ? 'catch' : 'break', n: e.shakes });
        push({ at: t, k: 'vfx', id: e.caught ? 'orb_catch' : 'orb_break', from: e.target, to: e.target, ms: ORB_RESULT, type: 'Normal' });
        push({ at: t, k: 'sfx', id: e.caught ? 'orb_catch' : 'orb_break', at3d: e.target });
        if (!e.caught) push({ at: t, k: 'pose', who: e.target, pose: 'enter' });
        push({ at: t, k: 'log', text: e.caught ? `Gotcha! ${cap(name(e.target))} was caught!` : 'Oh no! It broke free!', tone: e.caught ? 'good' : 'bad' });
        lastLog = t;
        advance(ORB_RESULT, 'fixed');
        break;
      case 'fled': {
        flush();
        const who: Ref = { side: e.side, slot: active[e.side] };
        push({ at: t, k: 'pose', who, pose: 'exit' });
        log(e.side === seat ? 'Got away safely!' : `${cap(name(who))} fled!`);
        advance(SWITCH_OUT_MS, 'other');
        break;
      }
      case 'forfeit':
        flush();
        log(e.side === seat ? 'You forfeited the battle.' : 'The opponent forfeited.', e.side === seat ? 'bad' : 'good');
        break;
      case 'expGain':
        log(`${cap(name(e.who))} gained ${e.amount} EXP.`, 'good');
        break;
      case 'levelUp':
        push({ at: t, k: 'vfx', id: 'stat_up', from: e.who, to: e.who, ms: STAGE_MS, type: typeOf(e.who) });
        push({ at: t, k: 'pose', who: e.who, pose: 'celebrate' });
        push({ at: t, k: 'sfx', id: 'ui_levelup', at3d: null });
        log(`${cap(name(e.who))} grew to level ${e.level}!`, 'good');
        advance(STAGE_MS, 'stage');
        break;
      case 'learnMove':
        log(`${cap(name(e.who))} wants to learn ${e.move}.`, 'good');
        break;
      case 'evolveReady':
        log(`${cap(name(e.who))} is ready to evolve!`, 'good');
        break;
      case 'honor':
        // the honor ledger (dustcub's line): one line, no time of its own
        log(`${cap(name(e.who))}'s honor ${e.delta > 0 ? 'rose' : 'fell'} (${e.honorAfter > 0 ? '+' : ''}${e.honorAfter}): ${HONOR_REASON[e.reason]}`, tone(e.who, e.delta > 0));
        break;
      case 'turnEnd':
        flush();
        if (field !== null) {
          posesOf(0, 'idle');
          posesOf(1, 'idle');
          break;
        }
        push({ at: t, k: 'pose', who: { side: 0, slot: active[0] }, pose: 'idle' });
        push({ at: t, k: 'pose', who: { side: 1, slot: active[1] }, pose: 'idle' });
        break;
      case 'battleEnd': {
        flush();
        const o = e.outcome;
        if (o.winner === 'caught') {
          push({ at: t, k: 'pose', who: { side: seat, slot: active[seat] }, pose: 'celebrate' });
        } else if (o.winner === 'fled') {
          push({ at: t, k: 'camera', shot: 'wide', ms: 600 });
        } else if (o.winner === 'draw') {
          log('The battle ended in a draw.');
        } else {
          if (field !== null) posesOf(o.winner, 'celebrate');
          else push({ at: t, k: 'pose', who: { side: o.winner, slot: active[o.winner] }, pose: 'celebrate' });
          log(o.winner === seat ? 'You won the battle!' : 'You lost the battle…', o.winner === seat ? 'good' : 'bad');
        }
        break;
      }
      default: {
        const never: never = e;
        void never;
      }
    }
  }
  flush();
  // the last log line keeps its dwell before the timeline releases input
  const tail = lastLog + dwell * scaleOf('dwell');
  if (t < tail) t = tail;
  push({ at: t, k: 'inputLock', locked: false });
  push({ at: t, k: 'end' });
  // stable sort by `at`
  const indexed = frames.map((f, i) => ({ f, i }));
  indexed.sort((a, b) => a.f.at - b.f.at || a.i - b.i);
  const sorted = indexed.map((x) => x.f);
  return { frames: sorted, durationMs: t + realExtra(sorted) };
}

/**
 * §20.5.1. Builds at full timing; above TURN_BUDGET solves the compression factors (spec group first, floor 0.5×,
 * then the unprotected rest) so the result fits whenever the protected time allows.
 */
export function buildTimeline(events: readonly BattleEvent[], ctx: TimelineCtx): Timeline {
  let tl = build(events, ctx, 1, 1);
  if (tl.durationMs <= TURN_BUDGET) return tl;
  let fSpec = 1;
  for (let i = 0; i < 6 && tl.durationMs > TURN_BUDGET && fSpec > COMPRESS_FLOOR; i++) {
    fSpec = Math.max(COMPRESS_FLOOR, fSpec * (TURN_BUDGET / tl.durationMs) - 0.01);
    tl = build(events, ctx, fSpec, 1);
  }
  let fOther = 1;
  for (let i = 0; i < 6 && tl.durationMs > TURN_BUDGET && fOther > COMPRESS_FLOOR; i++) {
    fOther = Math.max(COMPRESS_FLOOR, fOther * (TURN_BUDGET / tl.durationMs) - 0.01);
    tl = build(events, ctx, COMPRESS_FLOOR, fOther);
  }
  return tl;
}

/** VFX ids a timeline (or a preview's events) uses — `stage.prewarm` input (§20.5.5 preview rule 1). */
export function vfxIdsIn(tl: Timeline): string[] {
  const out: string[] = [];
  for (const f of tl.frames) if (f.k === 'vfx' && !out.includes(f.id)) out.push(f.id);
  return out;
}
