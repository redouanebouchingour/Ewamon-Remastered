/**
 * Crimson Lotus Prison (hyoryu): a flower of ice opens in the sky over the field one petal at a time while frozen
 * petals drift down and frost gathers round the attacker; an ice dragon coils along the line onto the target; a lotus
 * of ice blooms from the target's feet and closes round it, its heart burns crimson, and it shatters into petals.
 * Clock: lotus.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import l from './lotus.module.css';

export function LotusFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-lotus-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="ewa-sig-lotus-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#3ab8d8" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#bff4ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="ewa-sig-lotus-sky-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#7ad8f0" stopOpacity="0.15" />
          <stop offset="0.6" stopColor="#d8f8ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="ewa-sig-lotus-frost">
          <stop offset="0" stopColor="#e8fbff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#5ad0f0" stopOpacity="0.18" />
          <stop offset="1" stopColor="#061a2e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-lotus-heart">
          <stop offset="0" stopColor="#ffd0d8" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ff2a4a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#5a0618" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-lotus-powder">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#e8fbff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#bff4ff" stopOpacity="0" />
        </radialGradient>
        <path id="ewa-sig-lotus-petal-shape" d={PETAL} />
        <path id="ewa-sig-lotus-flake" d={FLAKE} />
      </defs>

      {/* the sky, in screen space (1600 × 1000 covering the viewport): the ice flower opens, frozen petals drift down */}
      <svg x="0" y="0" width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" overflow="visible">
        <g className={l.sky}>
          <g className={k.vb} transform="translate(800 210)">
            <circle className={l.skyHalo} r="200" fill="url(#ewa-sig-lotus-frost)" />
            {SKY_PETALS.map((a, i) => (
              <g key={i} className={k.vb} transform={`rotate(${a})`}>
                <g className={l.skyPetal} style={cssVars({ '--kd': `${i * 30}ms` })}>
                  <use href="#ewa-sig-lotus-petal-shape" fill="url(#ewa-sig-lotus-sky-petal)" stroke="#e8fbff" strokeWidth="2" transform="scale(0.48)" />
                </g>
              </g>
            ))}
            <circle r="18" fill="#fff" opacity="0.8" filter="url(#ewa-sig-lotus-glow)" />
          </g>
        </g>
        <g className={l.drift} fill="#f4fdff">
          {DRIFT.map((f, i) => (
            <use
              key={i}
              className={l.flake}
              style={cssVars({ '--kd': `${f.d}ms`, '--tx': `${f.tx}px`, '--r': `${f.r}deg` })}
              href="#ewa-sig-lotus-flake"
              x={f.x}
              y={f.y}
              opacity="0.85"
            />
          ))}
        </g>
      </svg>

      {/* frost gathering round the attacker during the charge */}
      <g className={k.atA}>
        <ellipse className={l.frost} cx="0" cy="0" rx="320" ry="340" fill="url(#ewa-sig-lotus-frost)" />
      </g>

      {/* the ice dragon coiling along the line (path x 0–1000 stretched to the target) */}
      <g className={k.line}>
        <g className={`${k.vb} ${l.stretch}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className={l.body} d={COIL} pathLength={1} vectorEffect="non-scaling-stroke" stroke="#5ad0f0" strokeWidth="34" strokeOpacity="0.3" filter="url(#ewa-sig-lotus-glow)" />
          <path className={l.body} d={COIL} pathLength={1} vectorEffect="non-scaling-stroke" stroke="#9aeaff" strokeWidth="14" />
          <path className={l.body} d={COIL} pathLength={1} vectorEffect="non-scaling-stroke" stroke="#fff" strokeWidth="4" />
          <path className={l.head} d={COIL} pathLength={1} vectorEffect="non-scaling-stroke" stroke="#fff" strokeWidth="22" filter="url(#ewa-sig-lotus-glow)" />
        </g>
      </g>

      {/* the prison on the target: the lotus blooms, closes, burns crimson and shatters */}
      <g className={k.atD}>
        <g className={k.vb} transform="translate(0 150) scale(1 0.3)">
          <circle className={l.ring} r="190" fill="none" stroke="#e8fbff" strokeWidth="10" />
        </g>
        <circle className={l.flash} cy="-40" r="210" fill="url(#ewa-sig-lotus-powder)" />
        <g className={l.lotus}>
          {LOTUS.map((p, i) => (
            <g key={i} className={k.vb} transform={`translate(${p.x} 150) rotate(${p.a})`}>
              <g className={l.petal} style={cssVars({ '--kd': `${p.d}ms` })}>
                <use href="#ewa-sig-lotus-petal-shape" fill="url(#ewa-sig-lotus-petal)" stroke="#e8fbff" strokeWidth="3" transform={`scale(${p.s})`} />
              </g>
            </g>
          ))}
          <circle className={l.heart} cy="-30" r="170" fill="url(#ewa-sig-lotus-heart)" />
          <g fill="none" stroke="#ff4a62" strokeWidth="4" strokeLinecap="round" filter="url(#ewa-sig-lotus-glow)">
            {VEINS.map((d, i) => (
              <path key={i} className={l.vein} d={d} pathLength={1} />
            ))}
          </g>
        </g>
        {POWDER.map((p, i) => (
          <circle key={i} className={l.powder} style={cssVars({ '--kd': `${p.d}ms` })} cx={p.x} cy={p.y} r={p.r} fill="url(#ewa-sig-lotus-powder)" />
        ))}
        {SHARDS.map((s, i) => (
          <g key={i} className={k.vb} transform={`translate(${s.x} ${s.y})`}>
            <g className={l.shard} style={cssVars({ '--tx': `${s.tx}px`, '--ty': `${s.ty}px`, '--r': `${s.r}deg` })}>
              <use href="#ewa-sig-lotus-petal-shape" fill={s.fill} stroke="#fff" strokeWidth="2" transform="scale(0.28)" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

const poly = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

/** one petal, base at the origin, tip at y −260 */
const PETAL = 'M 0 0 C -62 -70 -52 -190 0 -260 C 52 -190 62 -70 0 0 Z';
/** a six-armed frozen petal-flake, about 18 units across */
const FLAKE = 'M 0 -9 L 2 -2 L 8 -4 L 3 1 L 6 7 L 0 3 L -6 7 L -3 1 L -8 -4 L -2 -2 Z';

/** the sky flower: twelve petals round its heart, opening clockwise */
const SKY_PETALS = Array.from({ length: 12 }, (_, i) => i * 30);

const DRIFT = Array.from({ length: 22 }, (_, i) => ({
  x: Math.round(60 + ((i * 709) % 1480)),
  y: Math.round(((i * 353) % 560) - 30),
  tx: ((i * 17) % 7) * 10 - 30,
  r: ((i * 47) % 5) * 60 - 120,
  d: -((i * 293) % 2600),
}));

/** the dragon's coil: two long waves along x 40–1000, back on the line at both ends */
const COIL_AT = (t: number): readonly [number, number] => [Math.round(40 + 960 * t), Math.round(-110 * Math.sin(2 * Math.PI * 2 * t) * Math.sin(Math.PI * t))];
const COIL = poly(Array.from({ length: 121 }, (_, i) => COIL_AT(i / 120)));

/** the lotus: an outer ring of wide petals leaning out, an inner ring standing up (rotation about each petal's base) */
const LOTUS: readonly { readonly x: number; readonly a: number; readonly s: number; readonly d: number }[] = [
  { x: -60, a: -46, s: 0.95, d: 0 },
  { x: 60, a: 46, s: 0.95, d: 0 },
  { x: -42, a: -28, s: 1.05, d: 20 },
  { x: 42, a: 28, s: 1.05, d: 20 },
  { x: -22, a: -12, s: 1.15, d: 40 },
  { x: 22, a: 12, s: 1.15, d: 40 },
  { x: 0, a: 0, s: 1.25, d: 60 },
];

const VEINS = [
  'M 0 140 L -12 40 L -40 -60 L -70 -140',
  'M 0 140 L 10 30 L 38 -70 L 66 -150',
  'M 0 140 L 0 -40 L -6 -170 L 0 -250',
  'M 0 140 L -40 80 L -100 30',
  'M 0 140 L 40 80 L 100 30',
];

const POWDER: readonly { readonly x: number; readonly y: number; readonly r: number; readonly d: number }[] = [
  { x: 0, y: -60, r: 180, d: 0 },
  { x: -100, y: 40, r: 110, d: 40 },
  { x: 100, y: -10, r: 120, d: 70 },
  { x: -40, y: -190, r: 100, d: 100 },
  { x: 60, y: 110, r: 90, d: 130 },
];

/** the shatter: small petals flung out from the lotus, white, ice and crimson */
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * 2 * Math.PI + 0.3;
  const reach = 260 + (i % 3) * 60;
  return {
    x: Math.round(Math.cos(a) * 40),
    y: Math.round(-40 + Math.sin(a) * 60),
    tx: Math.round(Math.cos(a) * reach),
    ty: Math.round(Math.sin(a) * reach * 0.8 - 60),
    r: (i % 2 ? 1 : -1) * (180 + i * 12),
    fill: ['#e8fbff', '#9aeaff', '#ff4a62', '#bff4ff'][i % 4]!,
  };
});
