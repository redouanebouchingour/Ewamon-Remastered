/**
 * Cosmic Miracle (lumyth): a golden halo opens over the attacker and a constellation lights up round it; its stars are
 * thrown into the sky and fall back as a shower of shooting stars onto the target; a soft-gold nova; then motes of
 * warm light drift from the target back to the attacker and gather into a green-gold healing glow (the user recovers
 * half its HP). Clock: miracle.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './miracle.module.css';

export function MiracleFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-miracle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-miracle-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        <path id="ewa-sig-miracle-star" d="M 0 -30 C 3 -7 7 -3 30 0 C 7 3 3 7 0 30 C -3 7 -7 3 -30 0 C -7 -3 -3 -7 0 -30 Z" />
        <radialGradient id="ewa-sig-miracle-aura">
          <stop offset="0" stopColor="#fff6d8" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#f4d27a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#6a4ab8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-miracle-nova">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.22" stopColor="#fff6d8" />
          <stop offset="0.55" stopColor="#f4d27a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#c89aff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-miracle-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="380">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor="#ffe6a0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f4d27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-miracle-mote">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.35" stopColor="#f4d27a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#b8f08a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-miracle-heal">
          <stop offset="0" stopColor="#fff6d8" stopOpacity="0.6" />
          <stop offset="0.4" stopColor="#c8f09a" stopOpacity="0.38" />
          <stop offset="0.75" stopColor="#f4d27a" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f4d27a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-miracle-tail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.18" stopColor="#f4d27a" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#b48cff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#b48cff" stopOpacity="0" />
        </linearGradient>
        <g id="ewa-sig-miracle-faller">
          <polygon points="-10,0 10,0 0,-420" fill="url(#ewa-sig-miracle-tail)" />
          <use href="#ewa-sig-miracle-star" fill="#f4d27a" filter="url(#ewa-sig-miracle-soft)" transform="scale(1.5)" />
          <use href="#ewa-sig-miracle-star" fill="#fff" />
        </g>
      </defs>

      {/* the attacker: a golden aura, the halo, the constellation; later the healing glow and its sparkles */}
      <g className={k.atA}>
        <ellipse className={x.aura} cx="0" cy="-200" rx="380" ry="330" fill="url(#ewa-sig-miracle-aura)" />
        <g transform="translate(0 -330)">
          <g className={x.halo}>
            <ellipse rx="160" ry="44" fill="none" stroke="#f4d27a" strokeWidth="14" opacity="0.55" filter="url(#ewa-sig-miracle-soft)" />
            <ellipse rx="160" ry="44" fill="none" stroke="#f4d27a" strokeWidth="9" />
            <ellipse rx="160" ry="44" fill="none" stroke="#fff6d8" strokeWidth="3" />
            <ellipse className={x.haloDash} rx="210" ry="58" fill="none" stroke="#fff6d8" strokeWidth="3" strokeDasharray="6 22" strokeLinecap="round" />
          </g>
        </g>
        <path className={x.web} d={WEB} pathLength={1} fill="none" stroke="#fff6d8" strokeWidth="3" strokeLinecap="round" strokeDasharray="1" opacity="0.8" />
        {NODES.map(([nx, ny], i) => (
          <g key={i} transform={`translate(${nx} ${ny})`}>
            <g className={x.node} style={cssVars({ '--d': `${i * 22}ms` })}>
              <circle r="22" fill="url(#ewa-sig-miracle-mote)" />
              <use href="#ewa-sig-miracle-star" fill="#fff" transform={`scale(${i === 6 ? 0.85 : 0.6})`} />
            </g>
          </g>
        ))}
        <ellipse className={x.heal} cx="0" cy="20" rx="300" ry="320" fill="url(#ewa-sig-miracle-heal)" />
        <ellipse className={x.healRing} cx="0" cy="240" rx="230" ry="52" fill="none" stroke="#c8f09a" strokeWidth="6" />
        {SPARKLES.map(([sx, sy, d, s], i) => (
          <g key={i} className={k.vb} transform={`translate(${sx} ${sy}) scale(${s})`}>
            <use className={x.sparkle} style={cssVars({ '--d': `${d}ms` })} href="#ewa-sig-miracle-star" fill={i % 2 === 0 ? '#fff6d8' : '#c8f09a'} />
          </g>
        ))}
      </g>

      {/* the shower of falling stars onto the target, a pop where each lands, then the nova */}
      <g className={k.atD}>
        <circle className={x.nova} r="190" fill="url(#ewa-sig-miracle-nova)" />
        <path className={x.rays} d={RAYS} fill="url(#ewa-sig-miracle-rays)" />
        <g className={x.flare} filter="url(#ewa-sig-miracle-glow)">
          <ellipse rx="430" ry="9" fill="#fff6d8" />
          <ellipse rx="8" ry="280" fill="#fff6d8" />
        </g>
        <circle className={x.ring} r="120" fill="none" stroke="#f4d27a" strokeWidth="8" />
        <circle className={`${x.ring} ${x.ring2}`} r="100" fill="none" stroke="#fff" strokeWidth="3" />
        {FALLERS.map((f, i) => (
          <g key={i} className={k.vb} transform={`translate(${f.x} ${f.y}) rotate(${f.tilt}) scale(${f.s})`}>
            <use className={x.fall} style={cssVars({ '--d': `${f.d}ms` })} href="#ewa-sig-miracle-faller" />
            <use className={x.pop} style={cssVars({ '--d': `${f.d + 300}ms` })} href="#ewa-sig-miracle-star" fill="#fff6d8" filter="url(#ewa-sig-miracle-glow)" />
          </g>
        ))}
      </g>

      {/* motes of warm light drifting from the target back to the attacker */}
      <g className={k.line}>
        {MOTES.map((m, i) => (
          <g key={i} className={`${k.vb} ${x.mote}`} style={cssVars({ '--d': `${m.d}ms`, '--arc': `${m.arc}px`, '--y0': `${m.y0}px` })}>
            <circle r={m.r * 3.2} fill="url(#ewa-sig-miracle-mote)" />
            <circle r={m.r} fill="#fff" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** the constellation round the halo (local units: the attacker's sprite is 500 tall, its centre at 0) */
const NODES: readonly (readonly [number, number])[] = [
  [-290, -170], [-230, -340], [-100, -430], [90, -450], [240, -350], [300, -170], [0, -545],
];
const WEB = 'M -290 -170 L -230 -340 L -100 -430 L 90 -450 L 240 -350 L 300 -170 M -100 -430 L 0 -545 L 90 -450';

/** twelve slender rays round the nova (one path) */
const RAYS: string = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6 + 0.12;
  const len = i % 2 === 0 ? 380 : 250;
  const w = i % 2 === 0 ? 0.075 : 0.06;
  const p = (r: number, da: number): string => `${Math.round(Math.cos(a + da) * r)} ${Math.round(Math.sin(a + da) * r)}`;
  return `M ${p(30, -w * 3)} L ${p(len, 0)} L ${p(30, w * 3)} Z`;
}).join(' ');

/** where each falling star lands on the target (sprite 300 tall), its tilt, scale and launch (ms); the last is the impact */
const FALLERS: readonly { readonly x: number; readonly y: number; readonly tilt: number; readonly s: number; readonly d: number }[] = [
  { x: -150, y: -90, tilt: -20, s: 0.85, d: 1520 },
  { x: 120, y: -150, tilt: -16, s: 0.75, d: 1532 },
  { x: 30, y: 70, tilt: -22, s: 1, d: 1545 },
  { x: -200, y: 60, tilt: -18, s: 0.7, d: 1558 },
  { x: 180, y: 20, tilt: -14, s: 0.9, d: 1570 },
  { x: -60, y: -170, tilt: -20, s: 0.8, d: 1583 },
  { x: 80, y: 120, tilt: -17, s: 0.75, d: 1596 },
  { x: -110, y: 130, tilt: -19, s: 0.95, d: 1608 },
  { x: 220, y: -90, tilt: -15, s: 0.7, d: 1620 },
  { x: -230, y: -40, tilt: -21, s: 0.8, d: 1633 },
  { x: 60, y: -60, tilt: -18, s: 1, d: 1646 },
  { x: -40, y: 40, tilt: -16, s: 0.85, d: 1658 },
  { x: 140, y: -10, tilt: -20, s: 0.9, d: 1670 },
  { x: -90, y: -50, tilt: -18, s: 0.8, d: 1684 },
  { x: 0, y: 0, tilt: -18, s: 1.7, d: 1700 },
];

/** motes from the target to the attacker: launch (ms), arc and start offset across the line (local units), radius */
const MOTES: readonly { readonly d: number; readonly arc: number; readonly y0: number; readonly r: number }[] = [
  { d: 2070, arc: -150, y0: -30, r: 6 },
  { d: 2090, arc: 110, y0: 20, r: 5 },
  { d: 2115, arc: -70, y0: -10, r: 7 },
  { d: 2140, arc: 170, y0: 40, r: 4 },
  { d: 2160, arc: -190, y0: -50, r: 5 },
  { d: 2180, arc: 60, y0: 10, r: 6 },
  { d: 2200, arc: -120, y0: 30, r: 4 },
  { d: 2220, arc: 140, y0: -20, r: 5 },
  { d: 2240, arc: -40, y0: 0, r: 6 },
  { d: 2260, arc: 90, y0: -40, r: 4 },
];

/** healing sparkles rising round the attacker: x, y, launch (ms), scale */
const SPARKLES: readonly (readonly [number, number, number, number])[] = [
  [-190, 200, 2310, 0.45], [150, 170, 2330, 0.55], [-60, 230, 2350, 0.4], [230, 120, 2365, 0.35],
  [70, 210, 2380, 0.5], [-250, 110, 2395, 0.35], [10, 150, 2410, 0.45], [-120, 60, 2420, 0.3],
];
