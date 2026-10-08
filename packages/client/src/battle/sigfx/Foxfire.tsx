/**
 * Foxfire Voltage (raikitsune): nine foxfire wisps fan out behind the attacker like tails, crackling with arcs between
 * them; they launch one after another on curved homing paths (some high, some low) and strike the target, which a
 * cage of lightning snaps shut round in a burst of blue fire; static sparks jitter on it as it fades.
 * Clock: foxfire.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import f from './foxfire.module.css';

export function FoxfireFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-foxfire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="ewa-sig-foxfire-halo">
          <stop offset="0" stopColor="#4ad8ff" stopOpacity="0.75" />
          <stop offset="0.55" stopColor="#1a6cff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#10204a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-foxfire-burst">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor="#bff4ff" />
          <stop offset="0.6" stopColor="#4ad8ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#1a4cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-foxfire-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#bff4ff" />
          <stop offset="0.45" stopColor="#4ad8ff" />
          <stop offset="1" stopColor="#1a5cff" />
        </linearGradient>
        <g id="ewa-sig-foxfire-wisp">
          <circle cy="10" r="70" fill="url(#ewa-sig-foxfire-halo)" />
          <path d={FLAME} fill="url(#ewa-sig-foxfire-flame)" stroke="#9aeaff" strokeWidth="3" />
          <path className={k.vb} d={FLAME} fill="#e8fbff" transform="translate(0 16) scale(0.5)" />
          <circle cy="14" r="11" fill="#ffcf4a" />
          <circle cy="14" r="5" fill="#fff" />
          <path
            d="M -18 4 L -6 14 L -12 20 L 4 30"
            fill="none"
            stroke="#ffcf4a"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </defs>

      {/* the spirit glow and the arcs crackling between the tails (the same frame as the wisps' fan) */}
      <g className={k.atA}>
        <ellipse
          className={f.aura}
          cx="0"
          cy="-40"
          rx="380"
          ry="330"
          fill="url(#ewa-sig-foxfire-halo)"
        />
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {ARCS.map((d, i) => (
            <g key={i} className={f.arcs}>
              <path className={f.arc} d={d} stroke="#4ad8ff" strokeWidth="14" strokeOpacity="0.6" />
              <path className={f.arc} d={d} stroke="#fff6c8" strokeWidth="5" />
            </g>
          ))}
        </g>
      </g>

      {/* the wisps: fanned out in the attacker's frame, then homing along the line (travel × a curved offset) */}
      <g className={k.line}>
        {WISPS.map((w, i) => (
          <g key={i} className={`${k.vb} ${f.fly}`} style={cssVars({ '--d': `${i * 20}ms` })}>
            <g className={`${k.vb} ${f.unrot}`}>
              <g
                className={`${k.vb} ${f.home}`}
                style={cssVars({
                  '--fx': `${w.fx}px`,
                  '--fy': `${w.fy}px`,
                  '--mx': `${w.mx}px`,
                  '--my': `${w.my}px`,
                })}
              >
                <g className={`${k.vb} ${f.size}`}>
                  <g className={`${k.vb} ${f.aim}`} style={cssVars({ '--fr': `${w.fr}deg` })}>
                    <use className={f.flame} href="#ewa-sig-foxfire-wisp" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        ))}
      </g>

      {/* the strike: a spark per wisp, the burst of blue fire, the cage of lightning, static */}
      <g className={k.atD}>
        {HITS.map((h, i) => (
          <g key={i} transform={`translate(${h[0]} ${h[1]})`}>
            <path
              className={f.hit}
              style={cssVars({ '--kd': `${1780 + i * 20}ms` })}
              d={STAR}
              fill="#e8fbff"
              stroke="#4ad8ff"
              strokeWidth="3"
            />
          </g>
        ))}
        <g className={k.vb} transform="translate(0 150) scale(1 0.28)">
          <circle className={f.shock} r="180" fill="none" stroke="#4ad8ff" strokeWidth="12" />
        </g>
        <circle className={f.burst} cy="-20" r="190" fill="url(#ewa-sig-foxfire-burst)" />
        <g className={f.fire} fill="none" strokeLinecap="round">
          {TONGUES.map((t, i) => (
            <path key={i} className={f.tongue} d={t.d} stroke={t.c} strokeWidth={t.w} />
          ))}
        </g>
        <g className={f.cage} fill="none" strokeLinejoin="round" strokeLinecap="round">
          <ellipse
            cx="0"
            cy="-210"
            rx="165"
            ry="34"
            stroke="#4ad8ff"
            strokeWidth="6"
            filter="url(#ewa-sig-foxfire-glow)"
          />
          <ellipse
            cx="0"
            cy="150"
            rx="165"
            ry="34"
            stroke="#4ad8ff"
            strokeWidth="6"
            filter="url(#ewa-sig-foxfire-glow)"
          />
          {BARS.map((b, i) => (
            <g key={i} opacity={b.back ? 0.45 : 1}>
              <g className={f.bar}>
                <path d={b.d} stroke="#4ad8ff" strokeWidth="12" strokeOpacity="0.55" />
                <path d={b.d} stroke="#fff" strokeWidth="4" />
              </g>
            </g>
          ))}
        </g>
        {STATIC.map((s, i) => (
          <g className={k.vb} key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`}>
            <path
              className={f.static}
              style={cssVars({ '--kd': `${s.d}ms` })}
              d="M -26 0 L -10 -10 L -2 6 L 12 -8 L 26 2"
              fill="none"
              stroke="#ffcf4a"
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** a foxfire flame, tip up (local units: the attacker's sprite is 500 tall) */
const FLAME =
  'M 0 -78 C 10 -50 36 -30 34 4 C 32 30 16 42 0 42 C -16 42 -32 30 -34 4 C -36 -26 -16 -34 -6 -56 C -4 -46 6 -42 0 -78 Z';
const STAR = 'M 0 -40 L 7 -7 L 40 0 L 7 7 L 0 40 L -7 7 L -40 0 L -7 -7 Z';

/** the fan of tails behind / above the attacker: tip outward; mid-flight offsets alternate high and low */
const HIGH_LOW = [-420, 170, -300, 230, -460, 120, -340, 200, -240];
const WISPS = Array.from({ length: 9 }, (_, i) => {
  const a = -160 + i * 17.5;
  const r = (a * Math.PI) / 180;
  const fx = Math.round(345 * Math.cos(r));
  const fy = Math.round(-30 + 300 * Math.sin(r));
  return { fx, fy, fr: Math.round(a + 90), mx: Math.round(fx * 0.45), my: HIGH_LOW[i]! };
});

/** a jagged arc between two neighbouring tails */
const ARCS = WISPS.slice(1).map((w, i) => {
  const p = WISPS[i]!;
  const pts = [0.25, 0.5, 0.75].map((t, j) => {
    const x = p.fx + (w.fx - p.fx) * t;
    const y = p.fy + (w.fy - p.fy) * t;
    return `L ${Math.round(x + (j % 2 ? 18 : -14))} ${Math.round(y + (j % 2 ? -34 : 30))}`;
  });
  return `M ${p.fx} ${p.fy} ${pts.join(' ')} L ${w.fx} ${w.fy}`;
});

/** where each wisp strikes (local units: the target's sprite is 300 tall) */
const HITS: readonly (readonly [number, number])[] = [
  [-40, -60],
  [50, 10],
  [-10, 60],
  [30, -90],
  [-60, 10],
  [20, 70],
  [60, -40],
  [-30, -10],
  [0, -30],
];

/** the cage: vertical lightning bars on a cylinder (the back ones dimmer) */
const bolt = (x: number, seed: number) =>
  Array.from({ length: 12 }, (_, j) => {
    const dx = j === 0 || j === 11 ? 0 : (((j * 7 + seed * 5) % 9) - 4) * 6 + (j % 2 ? 6 : -6);
    return `${j === 0 ? 'M' : 'L'} ${x + dx} ${Math.round(-210 + (j * 360) / 11)}`;
  }).join(' ');
const BARS = [
  { x: -120, back: true },
  { x: -40, back: true },
  { x: 40, back: true },
  { x: 120, back: true },
  { x: -165, back: false },
  { x: -82, back: false },
  { x: 0, back: false },
  { x: 82, back: false },
  { x: 165, back: false },
].map((b, i) => ({ d: bolt(b.x, i), back: b.back }));

/** blue flame tongues rising through the cage */
const TONGUES = [-90, -50, -15, 20, 55, 95].map((x, i) => ({
  d: `M ${x} 130 c ${i % 2 ? 14 : -14} -50 ${i % 2 ? -14 : 14} -100 0 -${170 + ((i * 37) % 80)}`,
  c: i % 2 ? '#4ad8ff' : '#bff4ff',
  w: i % 2 ? 12 : 7,
}));

/** static sparks jittering on the target after the strike */
const STATIC: readonly {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly d: number;
}[] = [
  { x: -90, y: -100, r: 20, d: 2060 },
  { x: 80, y: -50, r: -30, d: 2120 },
  { x: -40, y: 60, r: 60, d: 2180 },
  { x: 100, y: 80, r: 10, d: 2240 },
  { x: -110, y: 20, r: -50, d: 2300 },
  { x: 30, y: -140, r: 35, d: 2360 },
  { x: 60, y: 30, r: -15, d: 2420 },
  { x: -60, y: -40, r: 80, d: 2480 },
];
