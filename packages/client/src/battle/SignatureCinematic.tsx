/**
 * A signature move's cinematic (signatures.ts) over the arena: a letterboxed dim, the cut-in band (the form's portrait,
 * an eye glint, the move's name), then the move's own SVG effect aimed from the attacker to the target at their
 * projected screen positions. Pure CSS animation on one clock: mounting a cue (keyed by its id) starts it, `--skip`
 * starts a short cue past the band; nothing is written per frame. The 3D stage plays the move underneath (poses, the
 * rage burst, the hit, the camera shake). Non-interactive and hidden from assistive tech (the log names the move).
 */
import { useEffect } from 'react';
import { cssVars } from '../ui/cssVars';
import type { CssVarMap } from '../ui/cssVars';
import { useCinematicStore } from './cinematic';
import type { CinematicCue, CinematicPoint } from './cinematic';
import s from './SignatureCinematic.module.css';
import { signatureOf, skipMs } from './signatures';
import type { SignatureCinematic as Sig } from './signatures';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The overlay's custom properties: both battlers' points, the line between them and the clock offset. */
export function cinematicVars(cue: CinematicCue, sig: Sig, vw: number, vh: number): CssVarMap {
  const near: CinematicPoint = { x: 0.28 * vw, y: 0.64 * vh, h: 0.42 * vh };
  const far: CinematicPoint = { x: 0.72 * vw, y: 0.36 * vh, h: 0.28 * vh };
  const a = cue.from ?? (cue.fromNear ? near : far);
  const d = cue.to ?? (cue.fromNear ? far : near);
  const sc = Math.max(0.2, vh / 900);
  const dx = d.x - a.x;
  const dy = d.y - a.y;
  return {
    '--ax': a.x.toFixed(1),
    '--ay': a.y.toFixed(1),
    '--dx': d.x.toFixed(1),
    '--dy': d.y.toFixed(1),
    '--ang': ((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2),
    '--dist': (Math.hypot(dx, dy) / sc).toFixed(1),
    '--sc': sc.toFixed(4),
    '--sa': clamp(a.h / 500, 0.35, 1.6).toFixed(4),
    '--sd': clamp(d.h / 300, 0.35, 1.8).toFixed(4),
    '--skip': `${skipMs(sig, cue.mode)}ms`,
    '--gx': `${sig.glint[0]}%`,
    '--gy': `${sig.glint[1]}%`,
  };
}

function CrescentFx() {
  return (
    <svg className={s.fx} aria-hidden="true">
      <defs>
        <path id="ewa-sig-crescent" d="M -40 -200 C 130 -150 150 130 -40 200 C 55 115 55 -115 -40 -200 Z" />
        <filter id="ewa-sig-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
        <filter id="ewa-sig-wisp" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ewa-sig-aura">
          <stop offset="0" stopColor="#e0193a" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#8a0a22" stopOpacity="0.18" />
          <stop offset="1" stopColor="#8a0a22" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-blade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" /><stop offset="0.75" stopColor="#14030a" /><stop offset="1" stopColor="#5a0414" />
        </linearGradient>
        <g id="ewa-sig-blade-art">
          <use href="#ewa-sig-crescent" fill="#e0193a" filter="url(#ewa-sig-soft)" opacity="0.9" />
          <use href="#ewa-sig-crescent" fill="url(#ewa-sig-blade)" stroke="#ff2e4d" strokeWidth="7" strokeLinejoin="round" />
          <path d="M -40 -200 C 130 -150 150 130 -40 200" fill="none" stroke="#fff" strokeWidth="3" opacity="0.85" />
        </g>
      </defs>

      {/* the crimson aura rising round the attacker */}
      <g className={s.atA}>
        <g className={s.aura} filter="url(#ewa-sig-wisp)">
          <ellipse cx="0" cy="110" rx="300" ry="260" fill="url(#ewa-sig-aura)" />
          <g fill="none" stroke="#ff2e4d" strokeWidth="9" strokeLinecap="round">
            {WISPS.map((d, i) => <path key={i} className={s.wisp} d={d} />)}
          </g>
        </g>
      </g>

      {/* the wave: charged in front of the attacker, released along the line to the target */}
      <g className={s.line}>
        <g transform="translate(60 0)">
          <circle className={s.chargeRing} r="170" fill="none" stroke="#ff4a62" strokeWidth="5" />
          <use className={`${s.ghost} ${s.g3}`} href="#ewa-sig-blade-art" />
          <use className={`${s.ghost} ${s.g2}`} href="#ewa-sig-blade-art" />
          <use className={`${s.ghost} ${s.g1}`} href="#ewa-sig-blade-art" />
          <use className={s.blade} href="#ewa-sig-blade-art" filter="url(#ewa-sig-glow)" />
        </g>
      </g>

      {/* the impact on the target */}
      <g className={s.atD}>
        <g className={s.rot}>
          <rect className={s.slash} x="-760" y="-5" width="1520" height="10" fill="#fff" filter="url(#ewa-sig-glow)" />
          <g className={s.wound}>
            <use href="#ewa-sig-crescent" fill="#000" stroke="#e0193a" strokeWidth="8" transform="scale(1.05)" />
            <path className={s.woundEdge} pathLength={1} strokeDasharray="1" d="M -40 -200 C 130 -150 150 130 -40 200" transform="scale(1.05)" fill="none" stroke="#fff" strokeWidth="4" />
          </g>
          <circle className={s.ring} r="120" fill="none" stroke="#ff4a62" strokeWidth="6" />
          <circle className={`${s.ring} ${s.r2}`} r="90" fill="none" stroke="#fff" strokeWidth="3" />
        </g>
        {SHARDS.map((p, i) => (
          <polygon key={i} className={s.shard} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={p.fill} />
        ))}
        {EMBERS.map((p, i) => (
          <circle key={i} className={s.ember} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
        ))}
      </g>
    </svg>
  );
}

function VolleyFx() {
  return (
    <svg className={s.fx} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-vglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ewa-sig-muzzle">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor="#ffd27a" />
          <stop offset="0.7" stopColor="#ff6a1a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff3a10" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-fire">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.3" stopColor="#ffc24a" />
          <stop offset="0.65" stopColor="#ff5a14" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7a1004" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-smoke">
          <stop offset="0" stopColor="#2a1a14" stopOpacity="0.8" />
          <stop offset="1" stopColor="#2a1a14" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-tracer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5a14" stopOpacity="0" />
          <stop offset="0.7" stopColor="#ffb347" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <path id="ewa-sig-star" d="M 0 -50 L 9 -9 L 50 0 L 9 9 L 0 50 L -9 9 L -50 0 L -9 -9 Z" />
      </defs>

      {/* both cannons, in front of the attacker on either side of the line: charge, then a flash per round */}
      <g className={s.line}>
        <g transform="translate(70 -42)">
          <circle className={s.muzzleCharge} r="34" fill="url(#ewa-sig-muzzle)" />
          <use className={`${s.muzzle} ${s.mL}`} href="#ewa-sig-star" fill="#fff4d0" filter="url(#ewa-sig-vglow)" />
        </g>
        <g transform="translate(70 42)">
          <circle className={s.muzzleCharge} r="34" fill="url(#ewa-sig-muzzle)" />
          <use className={`${s.muzzle} ${s.mR}`} href="#ewa-sig-star" fill="#fff4d0" filter="url(#ewa-sig-vglow)" />
        </g>
        {TRACERS.map((y, i) => (
          <g key={i} transform={`translate(0 ${y})`}>
            <rect className={`${s.tracer} ${s[`t${i}`]}`} x="-110" y="-4" width="110" height="8" rx="4" fill="url(#ewa-sig-tracer)" filter="url(#ewa-sig-vglow)" />
          </g>
        ))}
        {CASINGS.map((c, i) => (
          <rect key={i} className={`${s.casing} ${s[`c${i}`]}`} style={cssVars({ '--tx': `${c.tx}px`, '--ty': `${c.ty}px` })} x={c.x} y={c.y} width="7" height="16" rx="2" fill="#d9a441" />
        ))}
      </g>

      {/* the crosshair locking on, a spark per round, the fireball and the skull mark */}
      <g className={s.atD}>
        <g className={s.reticle} fill="none" strokeWidth="5">
          <circle r="120" />
          <circle r="34" strokeWidth="3" />
          <path d="M 0 -160 V -80 M 0 80 V 160 M -160 0 H -80 M 80 0 H 160" strokeLinecap="round" />
        </g>
        {SPARKS.map((p, i) => (
          <g key={i} transform={`translate(${p[0]} ${p[1]})`}>
            <use className={`${s.spark} ${s[`k${i}`]}`} href="#ewa-sig-star" fill="#ffe6a8" />
          </g>
        ))}
        <circle className={s.smoke} r="170" fill="url(#ewa-sig-smoke)" />
        <circle className={s.fireball} r="150" fill="url(#ewa-sig-fire)" />
        <circle className={`${s.fireball} ${s.f2}`} r="90" fill="url(#ewa-sig-fire)" />
        <circle className={s.vring} r="130" fill="none" stroke="#ffb347" strokeWidth="6" />
        <g className={s.skull}>
          <path d="M -70 -20 C -70 -95 70 -95 70 -20 C 70 15 55 30 45 38 L 45 70 L -45 70 L -45 38 C -55 30 -70 15 -70 -20 Z" fill="#f4efe6" stroke="#c0181c" strokeWidth="6" />
          <path d="M -40 -22 C -40 -46 -10 -46 -10 -22 C -10 -6 -40 -6 -40 -22 Z M 10 -22 C 10 -46 40 -46 40 -22 C 40 -6 10 -6 10 -22 Z M 0 2 L 9 22 L -9 22 Z" fill="#14080a" />
          <path d="M -30 42 V 66 M -15 42 V 66 M 0 42 V 66 M 15 42 V 66 M 30 42 V 66" stroke="#14080a" strokeWidth="5" />
        </g>
        {EMBERS.map((p, i) => (
          <circle key={i} className={s.ember} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={i % 2 === 0 ? '#ffb347' : '#ff5a14'} />
        ))}
      </g>
    </svg>
  );
}

/** Wisps round the attacker's feet (local units: the sprite is 500 tall, its feet at y 250). */
const WISPS: readonly string[] = [-210, -160, -120, -70, -30, 10, 50, 95, 140, 185, 225, -185, 115, -5].map((x, i) => {
  const h = 110 + ((i * 37) % 70);
  const c = i % 2 === 1 ? 18 : -18;
  return `M ${x} 250 c ${c} -${Math.round(h / 3)} ${-c} -${Math.round((2 * h) / 3)} 0 -${h}`;
});

const SHARDS: readonly { readonly tx: number; readonly ty: number; readonly points: string; readonly fill: string }[] = [
  { tx: -260, ty: -120, points: '0,-16 8,0 0,16 -5,0', fill: '#ff2e4d' },
  { tx: -180, ty: 150, points: '0,-12 6,0 0,12 -4,0', fill: '#fff' },
  { tx: 240, ty: -180, points: '0,-18 9,0 0,18 -6,0', fill: '#e0193a' },
  { tx: 300, ty: 60, points: '0,-14 7,0 0,14 -5,0', fill: '#ff4a62' },
  { tx: 90, ty: -260, points: '0,-10 5,0 0,10 -4,0', fill: '#fff' },
  { tx: -60, ty: 240, points: '0,-16 8,0 0,16 -5,0', fill: '#6e0718' },
  { tx: 200, ty: 200, points: '0,-12 6,0 0,12 -4,0', fill: '#ff2e4d' },
  { tx: -300, ty: 30, points: '0,-14 7,0 0,14 -5,0', fill: '#e0193a' },
];

const EMBERS: readonly { readonly tx: number; readonly cx: number; readonly cy: number; readonly r: number; readonly fill: string }[] = [
  { tx: -80, cx: -60, cy: 40, r: 5, fill: '#ff4a62' },
  { tx: 40, cx: 30, cy: 70, r: 4, fill: '#ff2e4d' },
  { tx: -20, cx: 80, cy: 20, r: 6, fill: '#e0193a' },
  { tx: 70, cx: -20, cy: 90, r: 3, fill: '#fff' },
  { tx: -50, cx: 50, cy: -10, r: 4, fill: '#ff4a62' },
  { tx: 30, cx: -90, cy: 0, r: 3, fill: '#ff2e4d' },
];

/** eight rounds, alternating left / right cannon (the line's lateral offset) */
const TRACERS: readonly number[] = [-42, 42, -42, 42, -42, 42, -42, 42];
const CASINGS: readonly { readonly x: number; readonly y: number; readonly tx: number; readonly ty: number }[] = [
  { x: 40, y: -70, tx: -90, ty: -140 }, { x: 40, y: 60, tx: -110, ty: 120 }, { x: 40, y: -70, tx: -130, ty: -110 }, { x: 40, y: 60, tx: -80, ty: 150 },
  { x: 40, y: -70, tx: -70, ty: -160 }, { x: 40, y: 60, tx: -140, ty: 100 }, { x: 40, y: -70, tx: -120, ty: -130 }, { x: 40, y: 60, tx: -100, ty: 130 },
];
/** where each round sparks on the target (local units: the sprite is 300 tall) */
const SPARKS: readonly (readonly [number, number])[] = [[-30, -40], [40, 10], [-10, 50], [30, -70], [-50, 0], [20, 60], [50, -20], [-20, -10]];

export function SignatureCinematic() {
  const cue = useCinematicStore((st) => st.cue);
  const sig = cue === null ? undefined : signatureOf(cue.move);
  // a cue's clock starts when it is shown: `aim` updates (same id) keep it running
  const cueId = cue?.id ?? null;
  const lifeMs = cue === null || sig === undefined ? 0 : sig.totalMs - skipMs(sig, cue.mode);
  useEffect(() => {
    if (cueId === null) return;
    const t = setTimeout(() => useCinematicStore.getState().clear(cueId), lifeMs);
    return () => clearTimeout(t);
  }, [cueId, lifeMs]);
  if (cue === null || sig === undefined) return null;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const classes = [s.root, s[sig.fx], cue.mode === 'short' ? s.short : '', cue.reduced ? s.reduced : ''].filter((c) => c !== '' && c !== undefined).join(' ');
  return (
    <div key={cue.id} className={classes} style={cssVars(cinematicVars(cue, sig, vw, vh))} data-testid="signaturecinematic" data-move={cue.move} data-mode={cue.mode} aria-hidden="true">
      <div className={s.dim} />
      <div className={s.tint} />
      {!cue.reduced && (sig.fx === 'crescent' ? <CrescentFx /> : <VolleyFx />)}
      {cue.mode === 'full' && (
        <div className={s.cutin}>
          <div className={s.band}>
            <div className={s.speed} />
            <div className={s.portrait}>
              <img src={`/signature/${sig.portrait}.webp`} alt="" draggable={false} />
              <svg className={s.glint} viewBox="-60 -60 120 120">
                <path d="M 0 -50 L 9 -9 L 50 0 L 9 9 L 0 50 L -9 9 L -50 0 L -9 -9 Z" fill="#fff" />
                <circle r="10" className={s.glintCore} />
              </svg>
            </div>
            <svg className={s.title} viewBox="0 0 300 130">
              <text className={s.kicker} x="2" y="14">{sig.kicker}</text>
              <g className={s.name}>
                <text className={s.nameShadow} x="5" y="68">{sig.lines[0]}</text>
                <text className={s.nameShadow} x="5" y="120">{sig.lines[1]}</text>
                <text className={s.nameText} x="2" y="65">{sig.lines[0]}</text>
                <text className={s.nameText} x="2" y="117">{sig.lines[1]}</text>
              </g>
            </svg>
          </div>
        </div>
      )}
      <div className={`${s.bar} ${s.top}`} />
      <div className={`${s.bar} ${s.bot}`} />
      {!cue.reduced && <div className={s.flash} />}
    </div>
  );
}
