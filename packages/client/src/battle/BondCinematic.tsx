/**
 * The bond cinematic (bond.ts, "Heartsync") over the arena: the trainer's band and the creature come in on two slanted
 * bands with their own heartbeats, a light thread joins the band's lens to the creature as the SYNC readout climbs,
 * the beats land together, and the bands answer — Majin: the ledger's "UNSAID" is struck through, the strike cracks,
 * crimson cracks run across the screen, the cracked ring breaks, REFUSED; Tenjin: the screen cracks and gold seams
 * mend every crack, the whole ring closes, HELD. Then everything breaks away over the 3D burst.
 *
 * CSS animation on one clock, like SignatureCinematic: mounting a cue (keyed by its id) starts it; in battle the cue
 * carries the timeline's clock and every animation is held at it each frame. Non-interactive and hidden from
 * assistive tech (the log says what happened).
 */
import { useEffect, useId, useRef } from 'react';
import type { BandKind } from '@ewa/core';
import { cssVars } from '../ui/cssVars';
import type { CssVarMap, CssVarName } from '../ui/cssVars';
import { BOND_BEATS, BOND_BURST_MS, BOND_LOCK_MS, BOND_STYLE, BOND_SYNC_MS, BOND_TOTAL_MS, bondPortraits, useBondStore } from './bond';
import type { BondCue } from './bond';
import s from './BondCinematic.module.css';

/** A battle clock that has not moved for this long (wall ms) ends the overlay. */
const STALL_MS = 5000;

/** The two anchors the bands stand at (vw, vh): the low band comes in from the left, the high one from the right. */
const LOW = [22, 76] as const;
const HIGH = [76, 22] as const;

/** A small deterministic generator (xorshift32): the cracks are the same every time. */
function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** Jagged cracks running out from the screen's centre (viewBox 1600 × 900), with a few branches. */
function crackPaths(): readonly string[] {
  const r = rng(0x6b0d);
  const out: string[] = [];
  const cx = 800;
  const cy = 430;
  const n = 11;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    let x = cx + Math.cos(a) * 70;
    let y = cy + Math.sin(a) * 70;
    let d = `M ${x.toFixed(0)} ${y.toFixed(0)}`;
    const steps = 7 + Math.floor(r() * 3);
    for (let k = 0; k < steps; k++) {
      a += (r() - 0.5) * 0.75;
      const step = 60 + r() * 80;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      d += ` L ${x.toFixed(0)} ${y.toFixed(0)}`;
      if (k === 2 && r() < 0.7) {
        // a branch off the third joint
        const b = a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.4);
        let bx = x;
        let by = y;
        let bd = `M ${bx.toFixed(0)} ${by.toFixed(0)}`;
        for (let j = 0; j < 3; j++) {
          bx += Math.cos(b + (r() - 0.5) * 0.6) * (40 + r() * 50);
          by += Math.sin(b + (r() - 0.5) * 0.6) * (40 + r() * 50);
          bd += ` L ${bx.toFixed(0)} ${by.toFixed(0)}`;
        }
        out.push(bd);
      }
    }
    out.push(d);
  }
  return out;
}
const CRACKS = crackPaths();

/** The Majin sigil: a jagged ring broken by a crack, as two halves that fly apart at the lock. */
function brokenRing(): { readonly left: string; readonly right: string } {
  const r = rng(0x51a7);
  const pts: [number, number][] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const rad = 80 + (i % 2 === 0 ? 6 : -6) * (0.4 + r() * 0.6);
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  const path = (from: number, to: number): string =>
    pts.slice(from, to + 1).map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  // the crack runs top to bottom: the right half (0..18) and the left half (18..36), each a step short of the seam
  return { right: path(1, 17), left: path(19, 35) };
}
const RING = brokenRing();
const TICKS = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);

/** The overlay's custom properties: the beats, the clock marks and the band's palette. */
export function bondVars(cue: BondCue): CssVarMap {
  const st = BOND_STYLE[cue.kind];
  const vars: Record<CssVarName, string> = {
    '--sync': `${BOND_SYNC_MS}ms`,
    '--lock': `${BOND_LOCK_MS}ms`,
    '--burst': `${BOND_BURST_MS}ms`,
    '--total': `${BOND_TOTAL_MS}ms`,
    '--accent': st.palette.accent,
    '--deep': st.palette.deep,
    '--hot': st.palette.hot,
  };
  BOND_BEATS.trainer.forEach((ms, i) => (vars[`--tb${i + 1}`] = `${ms}ms`));
  BOND_BEATS.creature.forEach((ms, i) => (vars[`--cb${i + 1}`] = `${ms}ms`));
  return vars;
}

/** The trainer's wrist and band: an iron mount with a cracked crimson lens (Majin), a gold band with a whole lens (Tenjin). */
/** `reach`: the fist points up-right (the trainer on the low slab) or down-left (the high slab), towards the creature. */
function BandArt({ kind, reach }: { kind: BandKind; reach: 'up' | 'down' }) {
  const uid = useId().replace(/:/g, '');
  const lens = `lens${uid}`;
  const metal = `metal${uid}`;
  const skin = `skin${uid}`;
  const majin = kind === 'majin';
  return (
    <svg className={s.bandArt} viewBox="-120 -120 240 240">
      <defs>
        <radialGradient id={lens} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={majin ? '#ffd2c8' : '#ffffff'} />
          <stop offset="0.35" stopColor={majin ? '#ff3a4a' : '#fff1c2'} />
          <stop offset="1" stopColor={majin ? '#3a0309' : '#b7862a'} />
        </radialGradient>
        <linearGradient id={skin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a333f" />
          <stop offset="0.45" stopColor="#1d1921" />
          <stop offset="1" stopColor="#0c0a0e" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={majin ? '#6b6870' : '#fff0b8'} />
          <stop offset="0.5" stopColor={majin ? '#2b2930' : '#d9a536'} />
          <stop offset="1" stopColor={majin ? '#151318' : '#7a5414'} />
        </linearGradient>
      </defs>
      {/* the forearm, the fist and the band on the wrist, drawn along +x and turned up-right; the lens sits at 0,0 */}
      <g transform={`rotate(${reach === 'up' ? -38 : 142}) translate(30 0)`}>
        <path d="M -330 -40 L -40 -34 L 34 -40 L 34 40 L -40 34 L -330 40 Z" fill={`url(#${skin})`} className={s.arm} />
        <rect x="26" y="-48" width="92" height="96" rx="26" fill={`url(#${skin})`} className={s.arm} />
        <path d="M 70 -46 L 70 -18 M 92 -42 L 92 -16 M 70 18 L 70 46 M 48 -46 L 48 -20" className={s.knuckles} />
        <rect x="-62" y="-50" width="52" height="100" rx="9" fill={`url(#${metal})`} className={s.cuff} />
        {majin ? (
          [-36, 36].map((y) => <circle key={y} cx="-36" cy={y} r="4" className={s.rivet} />)
        ) : (
          <path d="M -58 -40 L -14 -40 M -58 40 L -14 40" className={s.engrave} />
        )}
      </g>
      {/* the lens on the band's face, its heartbeat */}
      <g>
        <circle r="36" fill={`url(#${metal})`} className={s.housing} />
        <circle r="25" fill={`url(#${lens})`} className={s.lens} />
        {majin ? (
          <path d="M -15 -8 A 17 17 0 1 0 -6 -16 M -6 -16 L -2 -6 L -9 -2 L -4 9" className={s.lensSigil} />
        ) : (
          <g className={s.lensSigil}>
            <circle r="16" />
            {TICKS.map((a) => (
              <line key={a} x1="0" y1="-29" x2="0" y2="-33" transform={`rotate(${a})`} />
            ))}
          </g>
        )}
        <circle r="25" className={s.lensGlow} />
        {BOND_BEATS.trainer.map((ms) => (
          <circle key={ms} r="25" className={s.ripple} style={cssVars({ '--at': `${ms}ms` })} />
        ))}
      </g>
    </svg>
  );
}

export function BondCinematic() {
  const cue = useBondStore((st) => st.cue);
  const cueId = cue?.id ?? null;
  const clock = cue?.clock;
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (cueId === null) return;
    const done = (): void => useBondStore.getState().clear(cueId);
    if (clock === undefined) {
      const t = setTimeout(done, BOND_TOTAL_MS);
      return () => clearTimeout(t);
    }
    // the battle timeline's clock: each animation is held at it every frame (a slow world, hitstop); it ends when the
    // clock passes BOND_TOTAL_MS, or when the clock has not moved for STALL_MS of wall time (however slowly the world
    // steps, a moving clock keeps it)
    let raf = 0;
    let last = -1;
    let movedAt = performance.now();
    const tick = (): void => {
      const t = clock();
      const now = performance.now();
      if (t !== last) {
        last = t;
        movedAt = now;
      }
      const root = rootRef.current;
      if (root !== null && typeof root.getAnimations === 'function') {
        for (const a of root.getAnimations({ subtree: true })) {
          if (a.playState !== 'paused') a.pause();
          a.currentTime = t;
        }
      }
      if (t >= BOND_TOTAL_MS || now - movedAt > STALL_MS) done();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cueId, clock]);
  if (cue === null) return null;
  const st = BOND_STYLE[cue.kind];
  const pics = bondPortraits(cue.speciesId, cue.form);
  const [trainerAt, creatureAt] = cue.near ? [LOW, HIGH] : [HIGH, LOW];
  const slot = (at: readonly [number, number]): string => (at === LOW ? s.low! : s.high!);
  const classes = [s.root, cue.kind === 'majin' ? s.majin : s.tenjin, cue.reduced ? s.reduced : ''].join(' ');
  const verdict = cue.kind === 'majin' ? st.verdict : `${st.verdict} by ${cue.trainer}`;
  return (
    <div key={cue.id} ref={rootRef} className={classes} style={cssVars(bondVars(cue))} data-testid="bondcinematic" data-kind={cue.kind} data-side={cue.near ? 'near' : 'far'} aria-hidden="true">
      <div className={s.dim} />
      <div className={s.pulse} />
      {!cue.reduced && (
        <svg className={s.thread} viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1={trainerAt[0]} y1={trainerAt[1]} x2={creatureAt[0]} y2={creatureAt[1]} className={s.threadGlow} />
          <line x1={trainerAt[0]} y1={trainerAt[1]} x2={creatureAt[0]} y2={creatureAt[1]} className={s.threadCore} />
          {BOND_BEATS.trainer.map((ms) => (
            <line key={ms} x1={trainerAt[0]} y1={trainerAt[1]} x2={creatureAt[0]} y2={creatureAt[1]} pathLength={1} className={s.spark} style={cssVars({ '--at': `${ms}ms` })} />
          ))}
        </svg>
      )}
      <div className={`${s.panel} ${s.trainer} ${slot(trainerAt)}`}>
        <div className={s.slab}>
          <div className={s.speed} />
        </div>
        <div className={s.art}>
          <BandArt kind={cue.kind} reach={trainerAt === LOW ? 'up' : 'down'} />
        </div>
        <div className={s.label}>
          <span className={s.kicker}>{st.kicker}</span>
          <span className={s.who}>{cue.trainer}</span>
        </div>
      </div>
      <div className={`${s.panel} ${s.creature} ${slot(creatureAt)}`}>
        <div className={s.slab}>
          <div className={s.speed} />
        </div>
        <div className={s.art}>
          {BOND_BEATS.creature.map((ms) => (
            <span key={ms} className={s.thump} style={cssVars({ '--at': `${ms}ms` })} />
          ))}
          <div className={s.portrait}>
            <img className={s.before} src={pics.before} alt="" draggable={false} />
            <img className={s.after} src={pics.after} alt="" draggable={false} />
          </div>
        </div>
        <div className={s.label}>
          <span className={s.kicker}>Bond</span>
          <span className={s.who}>{cue.name}</span>
        </div>
      </div>
      <div className={s.center}>
        <svg className={s.ring} viewBox="-120 -120 240 240">
          {cue.kind === 'majin' ? (
            <>
              <path d={RING.left} pathLength={1} className={`${s.ringPath} ${s.ringLeft}`} />
              <path d={RING.right} pathLength={1} className={`${s.ringPath} ${s.ringRight}`} />
            </>
          ) : (
            <>
              <circle r="84" pathLength={1} className={`${s.ringPath} ${s.ringWhole}`} />
              <circle r="62" className={`${s.ringPath} ${s.ringInner}`} />
              <g className={s.ticks}>
                {TICKS.map((a) => (
                  <line key={a} x1="0" y1="-92" x2="0" y2="-104" transform={`rotate(${a})`} />
                ))}
              </g>
            </>
          )}
        </svg>
        <div className={s.sync}>
          <span className={s.syncLabel}>Sync</span>
          <span className={s.syncNum} />
        </div>
        <div className={s.ledger}>
          <span className={s.entry}>{cue.name}</span>
          <span className={s.dash}>·</span>
          <span className={s.verdict}>{verdict}</span>
          {cue.kind === 'majin' && <span className={s.strike} />}
        </div>
        <div className={s.stamp}>
          <span>{st.stamp}</span>
        </div>
      </div>
      {!cue.reduced && (
        <svg className={s.cracks} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          {CRACKS.map((d, i) => (
            <path key={i} d={d} pathLength={1} className={s.crack} style={cssVars({ '--i': String(i % 6) })} />
          ))}
          {cue.kind === 'tenjin' &&
            CRACKS.map((d, i) => <path key={`g${i}`} d={d} pathLength={1} className={s.seam} style={cssVars({ '--i': String(i % 6) })} />)}
        </svg>
      )}
      <div className={`${s.bar} ${s.top}`} />
      <div className={`${s.bar} ${s.bot}`} />
      {!cue.reduced && <div className={s.flash} />}
    </div>
  );
}
