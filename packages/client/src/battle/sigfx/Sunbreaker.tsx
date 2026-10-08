/**
 * Sunbreaker Barrage (sunjaw): a blazing sun disc rises behind the attacker, its rays turning; six flaming gauntlet
 * fists rocket along the line one after another (alternating above / below it), each bursting on the target; the last
 * lands as a blinding solar disc that cracks like glass and breaks, heat rings, shards and embers. Clock:
 * sunbreaker.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './sunbreaker.module.css';

export function SunbreakerFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-sun-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-sun-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
        <radialGradient id="ewa-sig-sun-disc">
          <stop offset="0" stopColor="#fff6d0" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#ffb020" stopOpacity="0.22" />
          <stop offset="0.82" stopColor="#ff8a10" stopOpacity="0.55" />
          <stop offset="0.93" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ff6a10" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-sun-burst">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor="#fff6d0" />
          <stop offset="0.62" stopColor="#ffe08a" />
          <stop offset="0.84" stopColor="#ffb020" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff6a10" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-sun-corona">
          <stop offset="0.6" stopColor="#ffb020" stopOpacity="0" />
          <stop offset="0.68" stopColor="#ffb020" stopOpacity="0.45" />
          <stop offset="1" stopColor="#4a1606" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-sun-trail" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset="0.25" stopColor="#ffb020" />
          <stop offset="0.7" stopColor="#ff5a10" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff3a10" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-sun-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd88a" />
          <stop offset="0.35" stopColor="#e0a040" />
          <stop offset="0.75" stopColor="#a8601e" />
          <stop offset="1" stopColor="#5a2a0c" />
        </linearGradient>
        <path id="ewa-sig-sun-ray" d="M -14 0 L 0 -70 L 14 0 Z" />
        <path id="ewa-sig-sun-star" d="M 0 -60 L 10 -10 L 60 0 L 10 10 L 0 60 L -10 10 L -60 0 L -10 -10 Z" />
        {/* a gauntlet fist punching +x, its flame trail behind it */}
        <g id="ewa-sig-sun-fist">
          <path d="M -10 -40 C -80 -44 -160 -22 -240 0 C -160 22 -80 44 -10 40 Z" fill="url(#ewa-sig-sun-trail)" />
          <path d="M -10 -22 C -60 -24 -110 -10 -160 0 C -110 10 -60 24 -10 22 Z" fill="#fff6d0" opacity="0.8" />
          <rect x="-56" y="-42" width="22" height="84" rx="6" fill="#8a4a18" stroke="#4a1606" strokeWidth="5" />
          <rect x="-38" y="-38" width="74" height="76" rx="20" fill="url(#ewa-sig-sun-bronze)" stroke="#4a1606" strokeWidth="5" />
          <g fill="#f0b860" stroke="#4a1606" strokeWidth="4">
            <circle cx="36" cy="-27" r="11" />
            <circle cx="38" cy="-9" r="11" />
            <circle cx="38" cy="9" r="11" />
            <circle cx="36" cy="27" r="11" />
          </g>
          <path d="M 4 -18 H 30 M 4 0 H 30 M 4 18 H 30 M -26 30 C -6 40 14 40 24 30" fill="none" stroke="#4a1606" strokeWidth="4" strokeLinecap="round" />
          <path d="M -28 -30 C -10 -36 14 -36 30 -32" fill="none" stroke="#fff6d0" strokeWidth="4" strokeLinecap="round" />
        </g>
      </defs>

      {/* the sun rising behind the attacker, its rays turning */}
      <g className={k.atA}>
        <g transform="translate(0 -170)">
          <g className={x.sun}>
            <circle r="300" fill="url(#ewa-sig-sun-corona)" />
            <g className={x.rays} fill="#ffb020">
              {RAYS.map((a, i) => (
                <g key={i} className={k.vb} transform={`rotate(${a}) translate(0 -${i % 2 === 0 ? 230 : 214})`}>
                  <use href="#ewa-sig-sun-ray" fill={i % 2 === 0 ? '#ffe08a' : '#ff8a10'} transform={i % 2 === 0 ? undefined : 'scale(0.7)'} className={k.vb} />
                </g>
              ))}
            </g>
            <circle r="205" fill="url(#ewa-sig-sun-disc)" />
            <circle className={x.rim} r="200" fill="none" stroke="#fff6d0" strokeWidth="5" />
          </g>
        </g>
        {SPARKS.map((p, i) => (
          <circle key={i} className={x.rise} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={i % 2 === 0 ? '#ffe08a' : '#ff8a10'} />
        ))}
      </g>

      {/* six fists rocket along the line, alternating above and below it */}
      <g className={k.line}>
        {FISTS.map((y, i) => (
          <g key={i} transform={`translate(0 ${y})`}>
            <g transform="translate(110 0)">
              <use className={`${x.launch} ${x[`l${i}`]}`} href="#ewa-sig-sun-star" fill="#fff0b0" filter="url(#ewa-sig-sun-glow)" />
            </g>
            <g className={`${k.vb} ${x.fist} ${x[`f${i}`]}`}>
              <use className={k.vb} href="#ewa-sig-sun-fist" transform="scale(1.3)" filter="url(#ewa-sig-sun-glow)" />
              <path d="M -60 -56 H -220 M -40 54 H -190 M -90 -6 H -300" stroke="#ffe08a" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
            </g>
          </g>
        ))}
      </g>

      {/* on the target: a burst per fist, then the sun breaks */}
      <g className={k.atD}>
        {HITS.map((p, i) => (
          <g key={i} transform={`translate(${p[0]} ${p[1]})`}>
            <circle className={`${x.hitRing} ${x[`h${i}`]}`} r="50" fill="none" stroke="#ffb020" strokeWidth="8" />
            <circle className={`${x.hitRing} ${x[`h${i}`]}`} r="34" fill="#ff8a10" fillOpacity="0.5" />
            <use className={`${x.hit} ${x[`h${i}`]}`} href="#ewa-sig-sun-star" fill="#fff6d0" filter="url(#ewa-sig-sun-glow)" />
          </g>
        ))}
        {HEAT.map((r, i) => (
          <circle key={i} className={`${x.heat} ${x[`q${i}`]}`} r={r} fill="none" stroke="#ffe08a" strokeWidth="4" />
        ))}
        <g className={x.burstRays} fill="#ffb020">
          {BURST.map((a, i) => (
            <g key={i} className={k.vb} transform={`rotate(${a}) translate(0 -${i % 2 === 0 ? 250 : 230})`}>
              <use href="#ewa-sig-sun-ray" className={k.vb} transform={i % 2 === 0 ? 'scale(1.4 1.8)' : 'scale(1 1.2)'} fill={i % 2 === 0 ? '#ffe08a' : '#ff8a10'} />
            </g>
          ))}
        </g>
        <circle className={x.burstGlow} r="260" fill="#ffb020" filter="url(#ewa-sig-sun-soft)" />
        <circle className={x.burst} r="210" fill="url(#ewa-sig-sun-burst)" />
        <g className={x.cracks} fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
          {CRACKS.map((d, i) => (
            <path key={i} className={x.crack} d={d} pathLength={1} strokeDasharray="1" strokeWidth={i % 2 === 0 ? 7 : 4} />
          ))}
          <g stroke="#4a1606" strokeWidth="2.5" opacity="0.8">
            {CRACKS.map((d, i) => (i % 2 === 0 ? <path key={i} className={x.crack} d={d} pathLength={1} strokeDasharray="1" /> : null))}
          </g>
        </g>
        {SHARDS.map((p, i) => (
          <polygon key={i} className={x.shard} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={p.fill} />
        ))}
        {EMBERS.map((p, i) => (
          <circle key={i} className={x.ember} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={i % 3 === 0 ? '#ffe08a' : '#ff6a10'} />
        ))}
      </g>
    </svg>
  );
}

/** 16 rays round the sun disc (local units: the attacker's sprite is 500 tall) */
const RAYS: readonly number[] = Array.from({ length: 16 }, (_, i) => i * 22.5);

/** the six fists' lateral offsets on the line */
const FISTS: readonly number[] = [-46, 40, -30, 50, -52, 28];

/** where each fist bursts on the target (local units: the sprite is 300 tall) */
const HITS: readonly (readonly [number, number])[] = [[-20, -50], [30, 30], [-40, 20], [40, -40], [-10, 60], [0, 0]];

const HEAT: readonly number[] = [170, 200, 230];

const BURST: readonly number[] = Array.from({ length: 12 }, (_, i) => i * 30 + 15);

/** jagged cracks radiating from the solar disc's centre, like shattered glass */
const CRACKS: readonly string[] = [
  'M 0 0 L 40 -18 L 72 -10 L 120 -42 L 170 -40 L 230 -70',
  'M 0 0 L 22 36 L 60 52 L 78 98 L 130 130 L 150 190',
  'M 0 0 L -30 22 L -70 18 L -104 56 L -160 64 L -220 100',
  'M 0 0 L -14 -40 L -50 -64 L -60 -120 L -104 -150 L -120 -210',
  'M 0 0 L 30 -50 L 26 -100 L 58 -150 L 52 -220',
  'M 0 0 L -44 -6 L -90 -30 L -140 -22 L -200 -50 L -250 -40',
  'M 0 0 L 6 50 L -20 92 L -14 150 L -40 210',
  'M 0 0 L 52 10 L 100 40 L 160 38 L 240 66',
];

const SHARDS: readonly { readonly tx: number; readonly ty: number; readonly points: string; readonly fill: string }[] = [
  { tx: -280, ty: -150, points: '0,-22 14,6 -12,10', fill: '#ffe08a' },
  { tx: 260, ty: -200, points: '0,-18 16,8 -10,12', fill: '#fff6d0' },
  { tx: 320, ty: 60, points: '0,-20 12,10 -14,6', fill: '#ffb020' },
  { tx: -300, ty: 80, points: '0,-16 14,8 -12,10', fill: '#ffb020' },
  { tx: 40, ty: -300, points: '0,-22 12,8 -12,10', fill: '#fff6d0' },
  { tx: -100, ty: 240, points: '0,-18 12,10 -12,6', fill: '#ff8a10' },
  { tx: 180, ty: 220, points: '0,-16 14,6 -10,12', fill: '#ffe08a' },
  { tx: -160, ty: -260, points: '0,-20 12,8 -14,10', fill: '#ff8a10' },
  { tx: 300, ty: -60, points: '0,-14 10,8 -10,8', fill: '#fff6d0' },
  { tx: -330, ty: -20, points: '0,-14 10,8 -10,8', fill: '#ffe08a' },
];

const EMBERS: readonly { readonly tx: number; readonly cx: number; readonly cy: number; readonly r: number }[] = [
  { tx: -70, cx: -80, cy: 60, r: 6 }, { tx: 50, cx: 40, cy: 90, r: 5 }, { tx: -30, cx: 110, cy: 20, r: 7 },
  { tx: 80, cx: -40, cy: 110, r: 4 }, { tx: -50, cx: 70, cy: -30, r: 5 }, { tx: 40, cx: -120, cy: 10, r: 4 },
  { tx: 20, cx: 0, cy: 70, r: 6 }, { tx: -90, cx: 130, cy: 80, r: 4 }, { tx: 60, cx: -10, cy: -60, r: 5 },
];

/** heat sparks rising round the attacker during the charge */
const SPARKS: readonly { readonly tx: number; readonly cx: number; readonly cy: number; readonly r: number }[] = [
  { tx: -40, cx: -180, cy: 200, r: 7 }, { tx: 30, cx: -90, cy: 230, r: 5 }, { tx: -20, cx: 20, cy: 220, r: 8 },
  { tx: 50, cx: 120, cy: 210, r: 6 }, { tx: -30, cx: 200, cy: 190, r: 5 }, { tx: 20, cx: -140, cy: 120, r: 4 },
  { tx: -60, cx: 160, cy: 100, r: 5 }, { tx: 40, cx: 60, cy: 160, r: 4 },
];
