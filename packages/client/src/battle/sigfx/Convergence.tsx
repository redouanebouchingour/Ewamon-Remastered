/**
 * Cosmic Convergence (ravatar): the energy of every past life drawn in at once. Four orbs, water, earth, fire and air,
 * wheel round the attacker and spiral into it while a halo gathers; they fuse into one white-blue sphere that crosses
 * the line on a trail of light; it bursts on the target in a flash and four rings of the four elements, throwing sparks.
 * One cinematic for every form: the move's type follows the relic, the four elements are always there.
 * Clock: convergence.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import c from './convergence.module.css';

const ELEMENTS = [
  { id: 'water', a: 0, hot: '#bfe8ff', base: '#2a8ee8' },
  { id: 'earth', a: 90, hot: '#d8ffc8', base: '#4aa83a' },
  { id: 'fire', a: 180, hot: '#ffe0a8', base: '#ff5a1e' },
  { id: 'air', a: 270, hot: '#ffffff', base: '#b8c8e0' },
] as const;

/** Sparks thrown from the burst: direction (deg), reach (units), size, colour index, delay (ms). */
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const a = (i * 360) / 16 + (i % 2 === 0 ? 7 : -5);
  const reach = 190 + ((i * 37) % 80);
  return {
    tx: Math.round(Math.cos((a * Math.PI) / 180) * reach),
    ty: Math.round(Math.sin((a * Math.PI) / 180) * reach * 0.8),
    r: 7 + (i % 3) * 3,
    e: i % 4,
    d: (i % 4) * 25,
  };
});

export function ConvergenceFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-conv-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="ewa-sig-conv-halo">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#9ad8ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0a1430" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-conv-core">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.4" stopColor="#d8f2ff" stopOpacity="0.95" />
          <stop offset="0.75" stopColor="#6ac8ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2a6aff" stopOpacity="0" />
        </radialGradient>
        {ELEMENTS.map((e) => (
          <radialGradient key={e.id} id={`ewa-sig-conv-${e.id}`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="0.35" stopColor={e.hot} stopOpacity="0.95" />
            <stop offset="0.8" stopColor={e.base} stopOpacity="0.7" />
            <stop offset="1" stopColor={e.base} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* the gathering: the halo swells, the four orbs wheel in and fuse into the core */}
      <g className={k.atA}>
        <circle className={c.halo} r="330" fill="url(#ewa-sig-conv-halo)" />
        <g className={`${k.vb} ${c.orbit}`}>
          {ELEMENTS.map((e) => (
            <g key={e.id} className={k.vb} transform={`rotate(${e.a})`}>
              <circle className={c.orb} cx="290" cy="0" r="52" fill={`url(#ewa-sig-conv-${e.id})`} filter="url(#ewa-sig-conv-glow)" />
            </g>
          ))}
        </g>
        <circle className={c.core} r="130" fill="url(#ewa-sig-conv-core)" filter="url(#ewa-sig-conv-glow)" />
      </g>

      {/* the release: the sphere crosses the line on its trail (path x 0–1000 stretched to the target) */}
      <g className={k.line}>
        <g className={`${k.vb} ${c.stretch}`} fill="none" strokeLinecap="round">
          <path className={c.trail} d="M 0 0 L 1000 0" pathLength={1} vectorEffect="non-scaling-stroke" stroke="#6ac8ff" strokeWidth="40" strokeOpacity="0.35" filter="url(#ewa-sig-conv-glow)" />
          <path className={c.trail} d="M 0 0 L 1000 0" pathLength={1} vectorEffect="non-scaling-stroke" stroke="#ffffff" strokeWidth="10" />
        </g>
        <g className={`${k.vb} ${c.bolt}`}>
          <circle r="95" fill="url(#ewa-sig-conv-core)" filter="url(#ewa-sig-conv-glow)" />
        </g>
      </g>

      {/* the burst on the target: a flash, four rings of the four elements, sparks */}
      <g className={k.atD}>
        <circle className={c.flash} cy="-20" r="230" fill="url(#ewa-sig-conv-core)" />
        {ELEMENTS.map((e, i) => (
          <circle
            key={e.id}
            className={c.ring}
            style={cssVars({ '--kd': `${i * 70}ms` })}
            cy="-20"
            r="120"
            fill="none"
            stroke={e.base}
            strokeWidth="12"
            filter="url(#ewa-sig-conv-glow)"
          />
        ))}
        {SPARKS.map((s, i) => (
          <circle
            key={i}
            className={c.spark}
            style={cssVars({ '--kd': `${s.d}ms`, '--tx': `${s.tx}px`, '--ty': `${s.ty}px` })}
            cy="-20"
            r={s.r}
            fill={ELEMENTS[s.e]!.hot}
            filter="url(#ewa-sig-conv-glow)"
          />
        ))}
      </g>
    </svg>
  );
}
