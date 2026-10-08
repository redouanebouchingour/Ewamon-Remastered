/**
 * Aurora Requiem (glacinid): a calm winter sky — aurora curtains fade in across the top of the screen and snow falls
 * slowly while the attacker glitters with frost — then an icy trail coils from it onto the target and seals it in a
 * faceted ice crystal, which cracks and shatters into shards and snow powder as the aurora fades.
 * Clock: aurora.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import a from './aurora.module.css';

export function AuroraFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-aurora-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="ewa-sig-aurora-curtain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#b49cff" stopOpacity="0" />
          <stop offset="0.65" stopColor="#9a8cff" stopOpacity="0.07" />
          <stop offset="0.8" stopColor="#5ad8ff" stopOpacity="0.2" />
          <stop offset="0.93" stopColor="#7af0d0" stopOpacity="0.6" />
          <stop offset="1" stopColor="#d8fff4" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ewa-sig-aurora-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask id="ewa-sig-aurora-mask" maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill="url(#ewa-sig-aurora-fade)" />
        </mask>
        <pattern id="ewa-sig-aurora-rays" width="22" height="40" patternUnits="userSpaceOnUse">
          <rect width="6" height="40" fill="#e8fbff" />
        </pattern>
        <radialGradient id="ewa-sig-aurora-frost">
          <stop offset="0" stopColor="#e8fbff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#7af0d0" stopOpacity="0.18" />
          <stop offset="1" stopColor="#06182a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-aurora-powder">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#e8fbff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#bff4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-aurora-face-l" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bff8ec" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3ab8d8" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="ewa-sig-aurora-face-f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#e8fbff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#9aeaff" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="ewa-sig-aurora-face-r" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ab0e0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1a5a8a" stopOpacity="0.55" />
        </linearGradient>
        <clipPath id="ewa-sig-aurora-clip">
          <polygon points={OUTLINE} />
        </clipPath>
        <path
          id="ewa-sig-aurora-star"
          d="M 0 -50 C 4 -12 12 -4 50 0 C 12 4 4 12 0 50 C -4 12 -12 4 -50 0 C -12 -4 -4 -12 0 -50 Z"
        />
      </defs>

      {/* the winter sky, in screen space (1600 × 1000 covering the viewport): aurora curtains and slow snow */}
      <svg
        x="0"
        y="0"
        width="100%"
        height="100%"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        overflow="visible"
      >
        <g className={a.sky}>
          {CURTAINS.map((d, i) => (
            <g key={i} className={`${a.curtain} ${a[`c${i}`]}`}>
              <path d={d} fill="url(#ewa-sig-aurora-curtain)" />
              <path
                d={d}
                fill="url(#ewa-sig-aurora-rays)"
                opacity="0.2"
                mask="url(#ewa-sig-aurora-mask)"
              />
            </g>
          ))}
        </g>
        <g className={a.snow} fill="#f4fdff">
          {FLAKES.map((f, i) => (
            <circle
              key={i}
              className={a.flake}
              style={cssVars({ '--kd': `${f.d}ms`, '--tx': `${f.tx}px` })}
              cx={f.x}
              cy={f.y}
              r={f.r}
            />
          ))}
        </g>
      </svg>

      {/* frost glittering round the attacker during the charge */}
      <g className={k.atA}>
        <ellipse
          className={a.frost}
          cx="0"
          cy="0"
          rx="320"
          ry="340"
          fill="url(#ewa-sig-aurora-frost)"
        />
        {GLITTER.map((g, i) => (
          <g key={i} transform={`translate(${g[0]} ${g[1]})`}>
            <g className={a.glitter} style={cssVars({ '--kd': `${i * 60}ms` })}>
              <use
                className={k.vb}
                href="#ewa-sig-aurora-star"
                fill="#e8fbff"
                transform={`scale(${g[2]})`}
              />
            </g>
          </g>
        ))}
      </g>

      {/* the icy trail coiling along the line (path x 0–1000 stretched to the target), glittering as it is drawn */}
      <g className={k.line}>
        <g
          className={`${k.vb} ${a.stretch}`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className={a.trail}
            d={COIL}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#7af0d0"
            strokeWidth="18"
            strokeOpacity="0.35"
            filter="url(#ewa-sig-aurora-glow)"
          />
          <path
            className={a.trail}
            d={COIL}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#9aeaff"
            strokeWidth="6"
          />
          <path
            className={a.trail}
            d={COIL}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#fff"
            strokeWidth="2"
          />
          <path
            className={a.head}
            d={COIL}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            stroke="#fff"
            strokeWidth="9"
            filter="url(#ewa-sig-aurora-glow)"
          />
        </g>
        {TRAIL_GLINTS.map((g, i) => (
          <g key={i} transform={`translate(0 ${g.y})`}>
            <g
              className={`${k.vb} ${a.glint}`}
              style={cssVars({ '--f': `${g.f}`, '--kd': `${g.d}ms` })}
            >
              <use
                className={k.vb}
                href="#ewa-sig-aurora-star"
                fill={i % 2 ? '#bff8ec' : '#fff'}
                transform={`scale(${g.s})`}
              />
            </g>
          </g>
        ))}
      </g>

      {/* the requiem on the target: the crystal seals, cracks and shatters */}
      <g className={k.atD}>
        <g className={k.vb} transform="translate(0 150) scale(1 0.3)">
          <circle className={a.ring} r="190" fill="none" stroke="#e8fbff" strokeWidth="10" />
        </g>
        <g className={a.crystal}>
          <g stroke="#e8fbff" strokeWidth="3" strokeLinejoin="round">
            <polygon
              points="-135,120 -62,155 -62,-205 -135,-175"
              fill="url(#ewa-sig-aurora-face-l)"
            />
            <polygon points="-62,155 62,155 62,-205 -62,-205" fill="url(#ewa-sig-aurora-face-f)" />
            <polygon points="62,155 135,120 135,-175 62,-205" fill="url(#ewa-sig-aurora-face-r)" />
            <polygon points="-135,-175 -62,-205 0,-305" fill="#d8fff4" fillOpacity="0.55" />
            <polygon points="-62,-205 62,-205 0,-305" fill="#ffffff" fillOpacity="0.5" />
            <polygon points="62,-205 135,-175 0,-305" fill="#7ac8f0" fillOpacity="0.55" />
          </g>
          <path
            d="M -100 60 L -70 -40 M 20 120 L 45 10 L 30 -90 M 95 40 L 110 -80 M -30 -140 L -10 -190"
            stroke="#fff"
            strokeWidth="2"
            strokeOpacity="0.55"
            fill="none"
          />
          <g clipPath="url(#ewa-sig-aurora-clip)">
            <g className={k.vb} transform="rotate(18)">
              <rect
                className={a.sheen}
                x="-40"
                y="-340"
                width="56"
                height="540"
                fill="#fff"
                fillOpacity="0.55"
              />
            </g>
          </g>
          <g
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#ewa-sig-aurora-glow)"
          >
            {CRACKS.map((d, i) => (
              <path key={i} className={a.crack} d={d} pathLength={1} />
            ))}
          </g>
        </g>
        <circle className={a.flash} cy="-60" r="200" fill="url(#ewa-sig-aurora-powder)" />
        {POWDER.map((p, i) => (
          <circle
            key={i}
            className={a.powder}
            style={cssVars({ '--kd': `${p.d}ms` })}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="url(#ewa-sig-aurora-powder)"
          />
        ))}
        {SHARDS.map((s, i) => (
          <polygon
            key={i}
            className={a.shard}
            style={cssVars({ '--tx': `${s.tx}px`, '--ty': `${s.ty}px`, '--r': `${s.r}deg` })}
            points={s.points}
            fill={s.fill}
            stroke="#fff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}

const poly = (pts: readonly (readonly [number, number])[]) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

/** three curtains: a wavy lower edge (bright) and a taller, softer upper edge, from x −200 to 1800 */
const CURTAINS = [0, 1, 2].map((c) => {
  const base = 215 + c * 70;
  const height = 210 - c * 40;
  const ph = c * 1.9;
  const xs = Array.from({ length: 51 }, (_, i) => -200 + i * 40);
  const low = xs.map(
    (x) =>
      [
        x,
        Math.round(
          base +
            48 * Math.sin((x / 1600) * 2 * Math.PI * 1.25 + ph) +
            14 * Math.sin((x / 1600) * 2 * Math.PI * 3.4 + ph),
        ),
      ] as const,
  );
  const high = xs
    .map(
      (x, i) =>
        [
          x,
          Math.round(low[i]![1] - height - 40 * Math.sin((x / 1600) * 2 * Math.PI * 0.9 + ph + 1)),
        ] as const,
    )
    .reverse();
  return `${poly(low)} ${poly(high).replace('M', 'L')} Z`;
});

const FLAKES = Array.from({ length: 24 }, (_, i) => ({
  x: Math.round(40 + ((i * 677) % 1520)),
  y: Math.round(((i * 389) % 640) - 40),
  r: 2 + (i % 3) * 1.4,
  tx: ((i * 13) % 5) * 8 - 16,
  d: -((i * 271) % 2400),
}));

/** frost glints round the attacker (local units: its sprite is 500 tall) */
const GLITTER: readonly (readonly [number, number, number])[] = [
  [-200, -180, 0.35],
  [180, -230, 0.45],
  [230, 60, 0.3],
  [-230, 90, 0.4],
  [40, -300, 0.3],
  [-90, 200, 0.28],
];

/** the coil: a prolate cycloid along x 40–1000 (three loops), back on the line at both ends */
const COIL_AT = (t: number): readonly [number, number] => [
  Math.round(40 + 960 * t - 150 * Math.sin(2 * Math.PI * 3 * t)),
  Math.round(-75 * (1 - Math.cos(2 * Math.PI * 3 * t))),
];
const COIL = poly(Array.from({ length: 121 }, (_, i) => COIL_AT(i / 120)));
const TRAIL_GLINTS = [0.1, 0.22, 0.36, 0.47, 0.6, 0.72, 0.85, 0.95].map((t, i) => {
  const [x, y] = COIL_AT(t);
  return { f: (x / 1000).toFixed(3), y, d: Math.round(t * 340), s: i % 2 ? 0.26 : 0.36 };
});

const OUTLINE = '-135,120 -62,155 62,155 135,120 135,-175 0,-305 -135,-175';
const CRACKS = [
  'M 15 -60 L -20 -95 L -35 -150 L -75 -180 L -90 -230',
  'M 15 -60 L 60 -40 L 80 -95 L 120 -120',
  'M 15 -60 L -10 0 L -55 25 L -70 90 L -110 120',
  'M 15 -60 L 40 10 L 30 70 L 70 130',
  'M 15 -60 L 30 -130 L 5 -200 L 15 -260',
];

const POWDER: readonly {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly d: number;
}[] = [
  { x: 0, y: -60, r: 170, d: 0 },
  { x: -90, y: 40, r: 110, d: 40 },
  { x: 100, y: -10, r: 120, d: 70 },
  { x: -40, y: -180, r: 100, d: 100 },
  { x: 60, y: 110, r: 90, d: 130 },
];

const SHARDS: readonly {
  readonly tx: number;
  readonly ty: number;
  readonly r: number;
  readonly points: string;
  readonly fill: string;
}[] = [
  { tx: -280, ty: -170, r: -220, points: '-60,-120 -20,-200 0,-110', fill: '#d8fff4' },
  { tx: 260, ty: -220, r: 260, points: '20,-200 70,-150 30,-110', fill: '#9aeaff' },
  { tx: -320, ty: 20, r: 180, points: '-130,-40 -80,-80 -90,20', fill: '#7af0d0' },
  { tx: 330, ty: 40, r: -200, points: '90,-60 135,-20 100,40', fill: '#e8fbff' },
  { tx: -220, ty: 200, r: 240, points: '-110,60 -60,90 -100,130', fill: '#9aeaff' },
  { tx: 240, ty: 220, r: -260, points: '60,70 120,90 80,140', fill: '#7af0d0' },
  { tx: -60, ty: -320, r: 300, points: '-30,-250 0,-300 20,-240', fill: '#ffffff' },
  { tx: 90, ty: -300, r: -280, points: '10,-180 50,-200 40,-150', fill: '#d8fff4' },
  { tx: -150, ty: -60, r: 200, points: '-40,-40 0,-70 -10,0', fill: '#e8fbff' },
  { tx: 170, ty: -90, r: -160, points: '20,-30 70,-10 40,30', fill: '#9aeaff' },
  { tx: -40, ty: 260, r: 220, points: '-20,80 20,90 0,140', fill: '#7af0d0' },
  { tx: 40, ty: 120, r: -240, points: '0,20 40,40 10,70', fill: '#ffffff' },
  { tx: -360, ty: -110, r: 160, points: '-135,-150 -100,-170 -110,-110', fill: '#bff8ec' },
  { tx: 370, ty: -130, r: -180, points: '100,-150 135,-130 110,-90', fill: '#e8fbff' },
];
