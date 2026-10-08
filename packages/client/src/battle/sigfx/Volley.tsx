/**
 * Vendetta Volley (castlemaw's Rage Form): both cannons charge while a crosshair locks on the target, eight alternating
 * tracers with muzzle flashes and shell casings, a fireball, a ring, the skull mark and embers. Clock: volley.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import v from './volley.module.css';

export function VolleyFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
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
      <g className={k.line}>
        <g transform="translate(70 -42)">
          <circle className={v.muzzleCharge} r="34" fill="url(#ewa-sig-muzzle)" />
          <use className={`${v.muzzle} ${v.mL}`} href="#ewa-sig-star" fill="#fff4d0" filter="url(#ewa-sig-vglow)" />
        </g>
        <g transform="translate(70 42)">
          <circle className={v.muzzleCharge} r="34" fill="url(#ewa-sig-muzzle)" />
          <use className={`${v.muzzle} ${v.mR}`} href="#ewa-sig-star" fill="#fff4d0" filter="url(#ewa-sig-vglow)" />
        </g>
        {TRACERS.map((y, i) => (
          <g key={i} transform={`translate(0 ${y})`}>
            <rect className={`${v.tracer} ${v[`t${i}`]}`} x="-110" y="-4" width="110" height="8" rx="4" fill="url(#ewa-sig-tracer)" filter="url(#ewa-sig-vglow)" />
          </g>
        ))}
        {CASINGS.map((c, i) => (
          <rect key={i} className={`${v.casing} ${v[`c${i}`]}`} style={cssVars({ '--tx': `${c.tx}px`, '--ty': `${c.ty}px` })} x={c.x} y={c.y} width="7" height="16" rx="2" fill="#d9a441" />
        ))}
      </g>

      {/* the crosshair locking on, a spark per round, the fireball and the skull mark */}
      <g className={k.atD}>
        <g className={v.reticle} fill="none" strokeWidth="5">
          <circle r="120" />
          <circle r="34" strokeWidth="3" />
          <path d="M 0 -160 V -80 M 0 80 V 160 M -160 0 H -80 M 80 0 H 160" strokeLinecap="round" />
        </g>
        {SPARKS.map((p, i) => (
          <g key={i} transform={`translate(${p[0]} ${p[1]})`}>
            <use className={`${v.spark} ${v[`k${i}`]}`} href="#ewa-sig-star" fill="#ffe6a8" />
          </g>
        ))}
        <circle className={v.smoke} r="170" fill="url(#ewa-sig-smoke)" />
        <circle className={v.fireball} r="150" fill="url(#ewa-sig-fire)" />
        <circle className={`${v.fireball} ${v.f2}`} r="90" fill="url(#ewa-sig-fire)" />
        <circle className={v.vring} r="130" fill="none" stroke="#ffb347" strokeWidth="6" />
        <g className={v.skull}>
          <path d="M -70 -20 C -70 -95 70 -95 70 -20 C 70 15 55 30 45 38 L 45 70 L -45 70 L -45 38 C -55 30 -70 15 -70 -20 Z" fill="#f4efe6" stroke="#c0181c" strokeWidth="6" />
          <path d="M -40 -22 C -40 -46 -10 -46 -10 -22 C -10 -6 -40 -6 -40 -22 Z M 10 -22 C 10 -46 40 -46 40 -22 C 40 -6 10 -6 10 -22 Z M 0 2 L 9 22 L -9 22 Z" fill="#14080a" />
          <path d="M -30 42 V 66 M -15 42 V 66 M 0 42 V 66 M 15 42 V 66 M 30 42 V 66" stroke="#14080a" strokeWidth="5" />
        </g>
        {EMBERS.map((p, i) => (
          <circle key={i} className={v.ember} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={i % 2 === 0 ? '#ffb347' : '#ff5a14'} />
        ))}
      </g>
    </svg>
  );
}

/** eight rounds, alternating left / right cannon (the line's lateral offset) */
const TRACERS: readonly number[] = [-42, 42, -42, 42, -42, 42, -42, 42];
const CASINGS: readonly { readonly x: number; readonly y: number; readonly tx: number; readonly ty: number }[] = [
  { x: 40, y: -70, tx: -90, ty: -140 }, { x: 40, y: 60, tx: -110, ty: 120 }, { x: 40, y: -70, tx: -130, ty: -110 }, { x: 40, y: 60, tx: -80, ty: 150 },
  { x: 40, y: -70, tx: -70, ty: -160 }, { x: 40, y: 60, tx: -140, ty: 100 }, { x: 40, y: -70, tx: -120, ty: -130 }, { x: 40, y: 60, tx: -100, ty: 130 },
];
/** where each round sparks on the target (local units: the sprite is 300 tall) */
const SPARKS: readonly (readonly [number, number])[] = [[-30, -40], [40, 10], [-10, 50], [30, -70], [-50, 0], [20, 60], [50, -20], [-20, -10]];

const EMBERS: readonly { readonly tx: number; readonly cx: number; readonly cy: number; readonly r: number; readonly fill: string }[] = [
  { tx: -80, cx: -60, cy: 40, r: 5, fill: '#ff4a62' },
  { tx: 40, cx: 30, cy: 70, r: 4, fill: '#ff2e4d' },
  { tx: -20, cx: 80, cy: 20, r: 6, fill: '#e0193a' },
  { tx: 70, cx: -20, cy: 90, r: 3, fill: '#fff' },
  { tx: -50, cx: 50, cy: -10, r: 4, fill: '#ff4a62' },
  { tx: 30, cx: -90, cy: 0, r: 3, fill: '#ff2e4d' },
];
