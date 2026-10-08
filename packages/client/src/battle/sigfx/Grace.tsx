/**
 * Sparking Grace (voltaura): a ribbon of pink-gold lightning pirouettes up round the attacker, scattering sparkle
 * stars, then unwinds into two braided ribbons that dance along the line to the target and bloom there into a flower
 * of lightning — two rings of jagged petals — with a crit-star glint and fairy sparkles drifting down.
 * Clock: grace.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import g from './grace.module.css';

export function GraceFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-grace-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ewa-sig-grace-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="ewa-sig-grace-core">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor="#fff3b0" />
          <stop offset="0.6" stopColor="#ffd23a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff8ad8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-grace-aura">
          <stop offset="0" stopColor="#ff8ad8" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#ff8ad8" stopOpacity="0.12" />
          <stop offset="1" stopColor="#3a1840" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-grace-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#ff8ad8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff8ad8" stopOpacity="0.05" />
        </linearGradient>
        <path
          id="ewa-sig-grace-star"
          d="M 0 -50 C 4 -12 12 -4 50 0 C 12 4 4 12 0 50 C -4 12 -12 4 -50 0 C -12 -4 -4 -12 0 -50 Z"
        />
        <path
          id="ewa-sig-grace-glint"
          d="M 0 -170 L 7 -7 L 120 0 L 7 7 L 0 170 L -7 7 L -120 0 L -7 -7 Z"
        />
        <g id="ewa-sig-grace-petal-art">
          <path
            d={PETAL}
            fill="url(#ewa-sig-grace-petal)"
            stroke="#ffd23a"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d={VEIN} fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        </g>
      </defs>

      {/* the pirouette: a lightning ribbon spiralling up round the attacker */}
      <g className={k.atA}>
        <ellipse
          className={g.aura}
          cx="0"
          cy="40"
          rx="300"
          ry="320"
          fill="url(#ewa-sig-grace-aura)"
        />
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path
            className={g.helix}
            d={HELIX}
            pathLength={1}
            stroke="#ff8ad8"
            strokeWidth="22"
            strokeOpacity="0.6"
            filter="url(#ewa-sig-grace-soft)"
          />
          <path className={g.helix} d={HELIX} pathLength={1} stroke="#ffd23a" strokeWidth="8" />
          <path className={g.helix} d={HELIX_JAG} pathLength={1} stroke="#fff" strokeWidth="3" />
        </g>
        {HELIX_STARS.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <g className={g.pop} style={cssVars({ '--kd': `${s.d}ms` })}>
              <use
                className={k.vb}
                href="#ewa-sig-grace-star"
                fill={i % 2 ? '#fff3b0' : '#fff'}
                transform={`scale(${s.s})`}
                filter="url(#ewa-sig-grace-glow)"
              />
            </g>
          </g>
        ))}
      </g>

      {/* the dance: two braided ribbons, drawn head-first along the line (path x 0–1000 stretched to the target) */}
      <g className={k.line}>
        <g
          className={`${k.vb} ${g.stretch}`}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path
            className={g.ribbon}
            d={BOLT_B}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#ff8ad8"
            strokeWidth="4"
          />
          <path
            className={g.ribbon}
            d={BOLT_A}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#ff8ad8"
            strokeWidth="16"
            strokeOpacity="0.55"
            filter="url(#ewa-sig-grace-soft)"
          />
          <path
            className={g.ribbon}
            d={BOLT_A}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#ffd23a"
            strokeWidth="6"
          />
          <path
            className={g.ribbon}
            d={BOLT_A_JAG}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#fff"
            strokeWidth="2.5"
          />
        </g>
        {BOLT_STARS.map((s, i) => (
          <g key={i} transform={`translate(0 ${s.y})`}>
            <g
              className={`${k.vb} ${g.along}`}
              style={cssVars({ '--f': `${s.f}`, '--kd': `${s.d}ms` })}
            >
              <use
                className={k.vb}
                href="#ewa-sig-grace-star"
                fill="#fff3b0"
                transform="scale(0.32)"
              />
            </g>
          </g>
        ))}
      </g>

      {/* the bloom on the target */}
      <g className={k.atD}>
        <circle className={g.ring} r="150" fill="none" stroke="#ff8ad8" strokeWidth="5" />
        <g className={k.vb} transform="scale(0.78)">
          <g className={`${k.vb} ${g.flower}`}>
            {OUTER.map((p, i) => (
              <g key={i} className={k.vb} transform={`rotate(${p.a})`}>
                <g className={`${k.vb} ${g.petal}`} style={cssVars({ '--kd': `${p.d}ms` })}>
                  <use href="#ewa-sig-grace-petal-art" filter="url(#ewa-sig-grace-glow)" />
                </g>
              </g>
            ))}
            {INNER.map((p, i) => (
              <g key={i} className={k.vb} transform={`rotate(${p.a}) scale(0.55)`}>
                <g
                  className={`${k.vb} ${g.petal} ${g.inner}`}
                  style={cssVars({ '--kd': `${p.d}ms` })}
                >
                  <use href="#ewa-sig-grace-petal-art" />
                </g>
              </g>
            ))}
          </g>
        </g>
        <circle className={g.core} r="85" fill="url(#ewa-sig-grace-core)" />
        <g transform="translate(70 -95)">
          <g className={g.glint}>
            <use href="#ewa-sig-grace-glint" fill="#fff" filter="url(#ewa-sig-grace-glow)" />
          </g>
        </g>
        <g className={k.vb} transform="translate(-95 -40) scale(0.45)">
          <g className={`${g.glint} ${g.glint2}`}>
            <use href="#ewa-sig-grace-glint" fill="#fff3b0" />
          </g>
        </g>
        {FAIRY.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <g className={g.fairy} style={cssVars({ '--tx': `${s.tx}px`, '--kd': `${s.d}ms` })}>
              <use
                className={k.vb}
                href="#ewa-sig-grace-star"
                fill={s.c}
                transform={`scale(${s.s})`}
              />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

const path = (pts: readonly (readonly [number, number])[]) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

/** 2.5 turns from the feet (y 250) to over the head; a small alternating jag makes it lightning */
const HELIX_AT = (t: number, jag: number): readonly [number, number] => {
  const th = t * 5 * Math.PI;
  return [
    Math.round(225 * Math.sin(th) * (1 - 0.2 * t)),
    Math.round(225 - 500 * t + 70 * Math.cos(th) + jag),
  ];
};
/** the smooth ribbon and its jagged white core */
const HELIX = path(Array.from({ length: 71 }, (_, i) => HELIX_AT(i / 70, 0)));
const HELIX_JAG = path(Array.from({ length: 71 }, (_, i) => HELIX_AT(i / 70, i % 2 ? 11 : -11)));
const HELIX_STARS = [0.12, 0.27, 0.42, 0.58, 0.73, 0.9].map((t, i) => {
  const [x, y] = HELIX_AT(t, 0);
  return { x, y, d: Math.round(t * 350), s: i % 2 ? 0.45 : 0.62 };
});

/** a graceful wave along x 0–1000 that starts and ends on the line, with a fine lightning jag */
const BOLT = (amp: number, phase: number, jag: number) =>
  path(
    Array.from({ length: 81 }, (_, i) => {
      const t = i / 80;
      return [
        Math.round(30 + 970 * t),
        Math.round(
          amp * Math.sin(6 * Math.PI * t + phase) * Math.sin(Math.PI * t) + (i % 2 ? jag : -jag),
        ),
      ] as const;
    }),
  );
const BOLT_A = BOLT(80, 0, 0);
const BOLT_A_JAG = BOLT(80, 0, 9);
const BOLT_B = BOLT(-52, 0.9, 7);
const BOLT_STARS = [0.2, 0.36, 0.52, 0.68, 0.84].map((f) => ({
  f,
  y: Math.round(80 * Math.sin(6 * Math.PI * f) * Math.sin(Math.PI * f)),
  d: Math.round(f * 240),
}));

/** a jagged petal from the flower's centre (0, 0) out along −y */
const PETAL =
  'M 0 -14 L 15 -44 L 5 -74 L 25 -112 L 11 -144 L 19 -170 L 0 -220 L -19 -170 L -11 -144 L -25 -112 L -5 -74 L -15 -44 Z';
const VEIN = 'M 0 -20 L 7 -56 L -6 -92 L 7 -130 L -4 -168 L 0 -200';
const OUTER = Array.from({ length: 8 }, (_, i) => ({ a: i * 45, d: i * 16 }));
const INNER = Array.from({ length: 8 }, (_, i) => ({ a: 22.5 + i * 45, d: 40 + i * 12 }));

const FAIRY: readonly {
  readonly x: number;
  readonly y: number;
  readonly tx: number;
  readonly s: number;
  readonly c: string;
  readonly d: number;
}[] = [
  { x: -170, y: -230, tx: 30, s: 0.3, c: '#fff', d: 0 },
  { x: -80, y: -290, tx: -24, s: 0.22, c: '#ff8ad8', d: 90 },
  { x: 30, y: -260, tx: 26, s: 0.34, c: '#fff3b0', d: 40 },
  { x: 140, y: -300, tx: -30, s: 0.24, c: '#fff', d: 150 },
  { x: 210, y: -200, tx: 20, s: 0.28, c: '#ff8ad8', d: 70 },
  { x: -220, y: -120, tx: -18, s: 0.22, c: '#fff3b0', d: 200 },
  { x: 180, y: -100, tx: 24, s: 0.2, c: '#fff', d: 240 },
  { x: -120, y: -170, tx: 20, s: 0.26, c: '#fff', d: 120 },
  { x: 90, y: -190, tx: -20, s: 0.22, c: '#ff8ad8', d: 260 },
  { x: -10, y: -330, tx: 16, s: 0.3, c: '#fff3b0', d: 180 },
];
