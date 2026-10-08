/**
 * Cosmic Pyre (galaxion): five star-fires kindle one by one round the attacker and a violet constellation joins them
 * over a magic circle; they fuse at its chest into a violet-and-orange comet that lobs over the arena onto the target,
 * which goes up in a tall pillar of cosmic flame (orange core, violet edges) with star sparks, rising embers and a
 * lingering sigil on the ground. Clock: pyre.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import p from './pyre.module.css';

export function PyreFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-pyre-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ewa-sig-pyre-soft" x="-50%" y="-30%" width="200%" height="160%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <radialGradient id="ewa-sig-pyre-orb">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.28" stopColor="#ffe2a0" />
          <stop offset="0.55" stopColor="#ff7a1a" />
          <stop offset="0.8" stopColor="#8a3cff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#2a0a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-pyre-halo">
          <stop offset="0" stopColor="#c9a0ff" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#8a3cff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#2a0a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-pyre-ember">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.5" stopColor="#ff7a1a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-pyre-body" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff2c8" />
          <stop offset="0.25" stopColor="#ffb347" />
          <stop offset="0.6" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#8a3cff" />
        </linearGradient>
        <linearGradient id="ewa-sig-pyre-edge" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8a3cff" />
          <stop offset="0.7" stopColor="#5a1ab0" />
          <stop offset="1" stopColor="#2a0a4a" stopOpacity="0" />
        </linearGradient>
        <path
          id="ewa-sig-pyre-star"
          d="M 0 -50 C 4 -12 12 -4 50 0 C 12 4 4 12 0 50 C -4 12 -12 4 -50 0 C -12 -4 -4 -12 0 -50 Z"
        />
        <g id="ewa-sig-pyre-sigil" fill="none">
          <circle r="200" stroke="#a46cff" strokeWidth="6" />
          <circle r="184" stroke="#c9a0ff" strokeWidth="12" strokeDasharray="3 15" />
          <circle r="166" stroke="#ff7a1a" strokeWidth="3" />
          <path d={PENTAGRAM} stroke="#c9a0ff" strokeWidth="4" strokeLinejoin="round" />
          <circle r="62" stroke="#ff9a3a" strokeWidth="3" />
        </g>
      </defs>

      {/* the charge round the attacker: a magic circle, five star-fires and their constellation, fused at the chest */}
      <g className={k.atA}>
        <g className={k.vb} transform="translate(0 250) scale(1 0.3)">
          <g className={p.footSigil}>
            <use className={k.vb} href="#ewa-sig-pyre-sigil" transform="scale(1.35)" />
          </g>
        </g>
        <path
          className={p.constellation}
          d={CONSTELLATION}
          pathLength={1}
          fill="none"
          stroke="#b48cff"
          strokeWidth="4"
          strokeLinejoin="round"
          filter="url(#ewa-sig-pyre-glow)"
        />
        {STARS.map((s, i) => (
          <g
            key={i}
            className={`${k.vb} ${p.starPos}`}
            style={cssVars({ '--sx': `${s.x}px`, '--sy': `${s.y}px` })}
          >
            <g className={`${k.vb} ${p.kindle}`} style={cssVars({ '--kd': `${i * 70}ms` })}>
              <circle r="78" fill="url(#ewa-sig-pyre-halo)" />
              <circle r="30" fill="url(#ewa-sig-pyre-orb)" />
              <g className={p.twinkle}>
                <use
                  className={k.vb}
                  href="#ewa-sig-pyre-star"
                  fill="#fff"
                  transform="scale(1.1)"
                  filter="url(#ewa-sig-pyre-glow)"
                />
              </g>
            </g>
          </g>
        ))}
        <circle
          className={p.core}
          cy="-20"
          r="80"
          fill="url(#ewa-sig-pyre-orb)"
          filter="url(#ewa-sig-pyre-glow)"
        />
        <circle
          className={p.coreRing}
          cy="-20"
          r="120"
          fill="none"
          stroke="#c9a0ff"
          strokeWidth="6"
        />
      </g>

      {/* the comet: travels along the line while lifting in the world's vertical (un-rotated), a lob over the arena */}
      <g className={k.line}>
        {COMET.map((c, i) => (
          <g key={i} className={`${k.vb} ${p.travel}`} style={cssVars({ '--gd': `${c.d}ms` })}>
            <g className={`${k.vb} ${p.unrot}`}>
              <g className={`${k.vb} ${p.lift}`}>
                {i === 0 ? (
                  <g className={p.head}>
                    <circle r="78" fill="url(#ewa-sig-pyre-halo)" />
                    <circle r="34" fill="url(#ewa-sig-pyre-orb)" filter="url(#ewa-sig-pyre-glow)" />
                    <g className={p.headStar}>
                      <use
                        className={k.vb}
                        href="#ewa-sig-pyre-star"
                        fill="#fff"
                        transform="scale(1.4)"
                      />
                    </g>
                  </g>
                ) : (
                  <circle
                    r={c.r}
                    fill={c.violet ? 'url(#ewa-sig-pyre-halo)' : 'url(#ewa-sig-pyre-ember)'}
                    opacity={c.o}
                  />
                )}
              </g>
            </g>
          </g>
        ))}
      </g>

      {/* the pyre on the target: sigil, burst, the pillar of cosmic flame, star sparks and embers */}
      <g className={k.atD}>
        <g className={k.vb} transform="translate(0 150) scale(1 0.3)">
          <g className={p.sigil}>
            <use href="#ewa-sig-pyre-sigil" />
          </g>
          <circle className={p.shock} r="200" fill="none" stroke="#ffb347" strokeWidth="10" />
        </g>
        <circle className={p.burst} r="150" fill="url(#ewa-sig-pyre-orb)" />
        <g className={p.pillar}>
          <g className={p.flicker}>
            <path d={PILLAR_EDGE} fill="#8a3cff" filter="url(#ewa-sig-pyre-soft)" opacity="0.8" />
            <path d={PILLAR_EDGE} fill="url(#ewa-sig-pyre-edge)" stroke="#c9a0ff" strokeWidth="3" />
            <path d={PILLAR_BODY} fill="url(#ewa-sig-pyre-body)" opacity="0.8" />
            <path d={PILLAR_CORE} fill="#fff6dc" opacity="0.65" />
            {SPECKS.map((s, i) => (
              <circle key={i} className={p.speck} cx={s[0]} cy={s[1]} r={s[2]} fill="#fff" />
            ))}
            <g fill="none" strokeLinecap="round">
              {TONGUES.map((t, i) => (
                <path key={i} className={p.tongue} d={t.d} stroke={t.c} strokeWidth={t.w} />
              ))}
            </g>
          </g>
        </g>
        {SPARKS.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <g className={p.spark} style={cssVars({ '--kd': `${s.d}ms` })}>
              <use
                className={k.vb}
                href="#ewa-sig-pyre-star"
                fill={s.c}
                transform={`scale(${s.s})`}
              />
            </g>
          </g>
        ))}
        {EMBERS.map((e, i) => (
          <circle
            key={i}
            className={p.ember}
            style={cssVars({ '--tx': `${e.tx}px`, '--kd': `${e.d}ms` })}
            cx={e.x}
            cy={e.y}
            r={e.r}
            fill={e.c}
          />
        ))}
      </g>
    </svg>
  );
}

/** a five-pointed star inside r 166 */
const PENTAGRAM = [0, 2, 4, 1, 3, 0]
  .map((i, n) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return `${n === 0 ? 'M' : 'L'} ${Math.round(166 * Math.cos(a))} ${Math.round(166 * Math.sin(a))}`;
  })
  .join(' ');

/** the star-fires round the attacker (local units: the sprite is 500 tall, its feet at y 250) */
const STARS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 10, y: -300 },
  { x: 255, y: -125 },
  { x: 170, y: 165 },
  { x: -160, y: 180 },
  { x: -250, y: -95 },
];
/** drawn as a pentagram through them: 0 → 2 → 4 → 1 → 3 → 0 */
const CONSTELLATION = [0, 2, 4, 1, 3, 0]
  .map((i, n) => `${n === 0 ? 'M' : 'L'} ${STARS[i]!.x} ${STARS[i]!.y}`)
  .join(' ');

/** the comet's head (d 0) and its trail: the same flight, later, smaller */
const COMET: readonly {
  readonly d: number;
  readonly r: number;
  readonly o: number;
  readonly violet: boolean;
}[] = [
  { d: 0, r: 0, o: 1, violet: false },
  ...[50, 58, 44, 54, 40, 46, 32, 38, 24, 28].map((r, i) => ({
    d: 12 * (i + 1),
    r,
    o: 0.95 - i * 0.07,
    violet: i % 2 === 1,
  })),
];

/** the pillar: violet edge, orange body, white core (feet at y 150, the sprite 300 tall) */
const PILLAR_EDGE =
  'M -115 150 C -128 60 -84 -40 -100 -140 C -112 -230 -64 -300 -44 -380 C -28 -430 -12 -470 0 -530 C 12 -470 28 -430 44 -380 C 64 -300 112 -230 100 -140 C 84 -40 128 60 115 150 Z';
const PILLAR_BODY =
  'M -80 150 C -88 60 -56 -40 -68 -140 C -76 -220 -42 -290 -28 -360 C -18 -410 -8 -440 0 -490 C 8 -440 18 -410 28 -360 C 42 -290 76 -220 68 -140 C 56 -40 88 60 80 150 Z';
const PILLAR_CORE =
  'M -36 150 C -42 60 -24 -60 -30 -160 C -32 -240 -12 -300 0 -390 C 12 -300 32 -240 30 -160 C 24 -60 42 60 36 150 Z';

/** stars inside the pillar */
const SPECKS: readonly (readonly [number, number, number])[] = [
  [-40, -60, 4],
  [30, -150, 3],
  [-20, -260, 5],
  [50, 20, 3],
  [-60, 60, 3],
  [10, -340, 4],
  [-45, -190, 3],
  [40, -280, 3],
  [0, -100, 4],
];

/** flame tongues licking up the pillar */
const TONGUES: readonly { readonly d: string; readonly c: string; readonly w: number }[] = [
  -70, -40, -12, 18, 46, 72, -55, 30,
].map((x, i) => ({
  d: `M ${x} 120 c ${i % 2 ? 16 : -16} -50 ${i % 2 ? -16 : 16} -100 0 -${150 + ((i * 41) % 90)}`,
  c: i % 3 === 0 ? '#fff2c8' : i % 3 === 1 ? '#ffb347' : '#c9a0ff',
  w: i % 3 === 0 ? 5 : 9,
}));

const SPARKS: readonly {
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly c: string;
  readonly d: number;
}[] = [
  { x: -150, y: -60, s: 0.5, c: '#fff', d: 0 },
  { x: 140, y: -170, s: 0.42, c: '#c9a0ff', d: 60 },
  { x: -110, y: -300, s: 0.36, c: '#ffd27a', d: 130 },
  { x: 120, y: 40, s: 0.4, c: '#fff', d: 180 },
  { x: 60, y: -420, s: 0.5, c: '#c9a0ff', d: 240 },
  { x: -170, y: 90, s: 0.32, c: '#ffd27a', d: 300 },
  { x: 170, y: -330, s: 0.3, c: '#fff', d: 360 },
];

const EMBERS: readonly {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly tx: number;
  readonly c: string;
  readonly d: number;
}[] = [
  { x: -60, y: 60, r: 6, tx: -70, c: '#ffb347', d: 0 },
  { x: 40, y: 20, r: 5, tx: 50, c: '#c9a0ff', d: 80 },
  { x: -20, y: -40, r: 7, tx: -30, c: '#ff7a1a', d: 40 },
  { x: 80, y: 80, r: 4, tx: 90, c: '#fff2c8', d: 150 },
  { x: -90, y: -10, r: 5, tx: -110, c: '#c9a0ff', d: 210 },
  { x: 20, y: 100, r: 6, tx: 20, c: '#ffb347', d: 120 },
  { x: -40, y: -120, r: 4, tx: -60, c: '#fff2c8', d: 260 },
  { x: 60, y: -80, r: 5, tx: 80, c: '#ff7a1a', d: 300 },
  { x: 0, y: 40, r: 4, tx: -10, c: '#c9a0ff', d: 340 },
  { x: 100, y: -20, r: 5, tx: 120, c: '#ffb347', d: 30 },
];
