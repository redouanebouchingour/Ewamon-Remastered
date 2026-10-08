/**
 * Hollow Crescent (hollowmane's Rage Form): a crimson aura and a black crescent with a crimson edge, charged in front of
 * the attacker and released along the line; a hairline cut, the crescent's wound, rings, shards and embers on the
 * target. Clock: crescent.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import c from './crescent.module.css';

export function CrescentFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
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
      <g className={k.atA}>
        <g className={c.aura} filter="url(#ewa-sig-wisp)">
          <ellipse cx="0" cy="110" rx="300" ry="260" fill="url(#ewa-sig-aura)" />
          <g fill="none" stroke="#ff2e4d" strokeWidth="9" strokeLinecap="round">
            {WISPS.map((d, i) => <path key={i} className={c.wisp} d={d} />)}
          </g>
        </g>
      </g>

      {/* the wave: charged in front of the attacker, released along the line to the target */}
      <g className={k.line}>
        <g transform="translate(60 0)">
          <circle className={c.chargeRing} r="170" fill="none" stroke="#ff4a62" strokeWidth="5" />
          <use className={`${k.vb} ${c.ghost} ${c.g3}`} href="#ewa-sig-blade-art" />
          <use className={`${k.vb} ${c.ghost} ${c.g2}`} href="#ewa-sig-blade-art" />
          <use className={`${k.vb} ${c.ghost} ${c.g1}`} href="#ewa-sig-blade-art" />
          <use className={`${k.vb} ${c.blade}`} href="#ewa-sig-blade-art" filter="url(#ewa-sig-glow)" />
        </g>
      </g>

      {/* the impact on the target */}
      <g className={k.atD}>
        <g className={k.rot}>
          <rect className={c.slash} x="-760" y="-5" width="1520" height="10" fill="#fff" filter="url(#ewa-sig-glow)" />
          <g className={c.wound}>
            <use href="#ewa-sig-crescent" fill="#000" stroke="#e0193a" strokeWidth="8" transform="scale(1.05)" />
            <path className={c.woundEdge} pathLength={1} strokeDasharray="1" d="M -40 -200 C 130 -150 150 130 -40 200" transform="scale(1.05)" fill="none" stroke="#fff" strokeWidth="4" />
          </g>
          <circle className={c.ring} r="120" fill="none" stroke="#ff4a62" strokeWidth="6" />
          <circle className={`${c.ring} ${c.r2}`} r="90" fill="none" stroke="#fff" strokeWidth="3" />
        </g>
        {SHARDS.map((p, i) => (
          <polygon key={i} className={c.shard} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={p.fill} />
        ))}
        {EMBERS.map((p, i) => (
          <circle key={i} className={c.ember} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
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
