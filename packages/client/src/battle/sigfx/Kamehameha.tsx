/**
 * Kamehameha (zenryu): cyan aura rings pulse round the attacker while a blue-white ki sphere grows at its side, light
 * streaks converging on it and crackling; released, a thick beam (white core, blue glow, shimmering edges, a bright
 * head) races along the line to the target; a blue-white explosion with shock rings and debris, then the beam thins
 * out. Clock: kamehameha.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './kamehameha.module.css';

export function KamehamehaFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-kame-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-kame-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" /></filter>
        <radialGradient id="ewa-sig-kame-ball">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.32" stopColor="#f2fbff" />
          <stop offset="0.55" stopColor="#8fd8ff" />
          <stop offset="0.8" stopColor="#2f8fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1a4aff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-kame-aura">
          <stop offset="0" stopColor="#4ab8ff" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#1a6aff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0a1a40" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-kame-blast">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor="#e6f8ff" />
          <stop offset="0.55" stopColor="#7cd0ff" stopOpacity="0.95" />
          <stop offset="0.8" stopColor="#2a7aff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0a1a40" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-kame-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a5aff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#2f8fff" stopOpacity="0.55" />
          <stop offset="0.36" stopColor="#4ab8ff" />
          <stop offset="0.44" stopColor="#bfeaff" />
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="0.56" stopColor="#bfeaff" />
          <stop offset="0.64" stopColor="#4ab8ff" />
          <stop offset="0.82" stopColor="#2f8fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1a5aff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-kame-root" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.04" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="ewa-sig-kame-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor="#8fd8ff" />
          <stop offset="1" stopColor="#4ab8ff" stopOpacity="0" />
        </linearGradient>
        <path id="ewa-sig-kame-bolt" d="M 0 0 L 22 -9 L 34 6 L 56 -4 L 70 10 L 92 0" />
      </defs>

      {/* cyan aura round the attacker: a glow and rings climbing its body */}
      <g className={k.atA}>
        <g className={x.aura}>
          <ellipse cx="0" cy="40" rx="290" ry="320" fill="url(#ewa-sig-kame-aura)" />
          <g fill="none" stroke="#4ab8ff" strokeWidth="7">
            {RINGS.map((d, i) => <ellipse key={i} className={x.ring} cx="0" cy={d} rx="230" ry="50" />)}
          </g>
          <g fill="none" stroke="#8fd8ff" strokeWidth="6" strokeLinecap="round" opacity="0.8">
            {FLARES.map((d, i) => <path key={i} className={x.flare} d={d} />)}
          </g>
        </g>
      </g>

      <g className={k.line}>
        <g transform="translate(120 0)">
          {/* light streaks pulled inward to the sphere */}
          <g className={x.streaks}>
            {STREAKS.map((a, i) => (
              <g key={i} className={k.vb} transform={`rotate(${a})`}>
                <rect className={x.streak} x="0" y={i % 2 === 0 ? -3 : -2} width={i % 3 === 0 ? 170 : 120} height={i % 2 === 0 ? 6 : 4} rx="2" fill="url(#ewa-sig-kame-streak)" />
              </g>
            ))}
          </g>

          {/* the beam: grows from the sphere to the target, holds, thins out */}
          <g className={`${k.vb} ${x.beam}`}>
            <g className={x.beamPulse}>
              <rect x="0" y="-135" width="1000" height="270" fill="url(#ewa-sig-kame-beam)" opacity="0.4" />
              <rect x="0" y="-62" width="1000" height="124" fill="url(#ewa-sig-kame-beam)" />
              <rect x="0" y="-20" width="1000" height="40" fill="url(#ewa-sig-kame-root)" />
              <g fill="none" strokeLinecap="round">
                <path className={x.edge} d={EDGE_TOP} stroke="#bfeaff" strokeWidth="4" strokeDasharray="60 22 18 30" />
                <path className={`${x.edge} ${x.e2}`} d={EDGE_BOT} stroke="#bfeaff" strokeWidth="4" strokeDasharray="44 28 70 16" />
                <path className={`${x.edge} ${x.e3}`} d="M 0 -32 H 1000" stroke="#fff" strokeWidth="3" strokeDasharray="90 60" opacity="0.8" />
                <path className={`${x.edge} ${x.e4}`} d="M 0 34 H 1000" stroke="#fff" strokeWidth="3" strokeDasharray="70 80" opacity="0.8" />
              </g>
            </g>
          </g>

          {/* the beam's head racing ahead */}
          <g className={`${k.vb} ${x.head}`}>
            <circle r="115" fill="url(#ewa-sig-kame-ball)" />
            <circle r="44" fill="#fff" filter="url(#ewa-sig-kame-glow)" />
          </g>

          {/* the ki sphere: charged at the attacker's side, the beam's root once released */}
          <g className={x.sphere}>
            <circle r="150" fill="#4ab8ff" opacity="0.5" filter="url(#ewa-sig-kame-soft)" />
            <circle className={x.core} r="90" fill="url(#ewa-sig-kame-ball)" />
            <circle r="34" fill="#fff" filter="url(#ewa-sig-kame-glow)" />
            <g className={x.haloGate}><circle className={x.halo} r="98" fill="none" stroke="#d8f4ff" strokeWidth="4" /></g>
          </g>
          <g className={x.crackle} fill="none" stroke="#e8f8ff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" filter="url(#ewa-sig-kame-glow)">
            {BOLTS.map((b, i) => (
              <g key={i} className={k.vb} transform={`rotate(${b.a}) translate(${b.r} 0)`}>
                <use className={x.bolt} href="#ewa-sig-kame-bolt" />
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* the impact on the target: an explosion sphere, shock rings, a ground ring, rays and debris */}
      <g className={k.atD}>
        <ellipse className={x.ground} cx="0" cy="150" rx="250" ry="56" fill="none" stroke="#8fd8ff" strokeWidth="8" />
        <circle className={x.blast} r="215" fill="url(#ewa-sig-kame-blast)" />
        <circle className={`${x.blast} ${x.blast2}`} r="130" fill="#fff" filter="url(#ewa-sig-kame-soft)" />
        <circle className={x.shock} r="150" fill="none" stroke="#d8f4ff" strokeWidth="10" />
        <circle className={`${x.shock} ${x.shock2}`} r="120" fill="none" stroke="#4ab8ff" strokeWidth="6" />
        <g className={x.rays} stroke="#fff" strokeLinecap="round">
          {RAYS.map((a, i) => (
            <line key={i} x1="0" y1="0" x2={i % 2 === 0 ? 330 : 240} y2="0" className={k.vb} strokeWidth={i % 2 === 0 ? 8 : 5} transform={`rotate(${a})`} />
          ))}
        </g>
        {DEBRIS.map((p, i) => (
          <polygon key={i} className={x.debris} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={p.fill} />
        ))}
        {MOTES.map((p, i) => (
          <circle key={i} className={x.mote} style={cssVars({ '--tx': `${p.tx}px` })} cx={p.cx} cy={p.cy} r={p.r} fill={i % 2 === 0 ? '#d8f4ff' : '#4ab8ff'} />
        ))}
      </g>
    </svg>
  );
}

/** the aura rings' heights (local units: the sprite is 500 tall, its feet at y 250) */
const RINGS: readonly number[] = [230, 230, 230];

/** upward aura flares round the attacker's body */
const FLARES: readonly string[] = [-200, -130, -60, 60, 130, 200].map((px, i) => {
  const h = 150 + ((i * 53) % 90);
  const c = i % 2 === 0 ? 16 : -16;
  return `M ${px} 240 c ${c} -${Math.round(h / 3)} ${-c} -${Math.round((2 * h) / 3)} 0 -${h}`;
});

/** 14 converging streaks round the sphere */
const STREAKS: readonly number[] = [0, 26, 51, 77, 103, 128, 154, 180, 206, 231, 257, 283, 308, 334];

const BOLTS: readonly { readonly a: number; readonly r: number }[] = [
  { a: -60, r: 50 }, { a: 20, r: 60 }, { a: 110, r: 46 }, { a: 190, r: 56 }, { a: 260, r: 52 }, { a: 320, r: 58 },
];

/** the beam's turbulent edges (1000 long, before the beam's stretch) */
const EDGE_TOP = `M 0 -60 ${Array.from({ length: 20 }, (_, i) => `Q ${i * 50 + 25} ${i % 2 === 0 ? -76 : -50} ${i * 50 + 50} -60`).join(' ')}`;
const EDGE_BOT = `M 0 60 ${Array.from({ length: 20 }, (_, i) => `Q ${i * 50 + 25} ${i % 2 === 0 ? 50 : 76} ${i * 50 + 50} 60`).join(' ')}`;

const RAYS: readonly number[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => a + (i % 3) * 7);

const DEBRIS: readonly { readonly tx: number; readonly ty: number; readonly points: string; readonly fill: string }[] = [
  { tx: -300, ty: -180, points: '-12,-8 4,-14 14,2 2,12 -10,6', fill: '#3a4a66' },
  { tx: -220, ty: 90, points: '-8,-6 6,-10 10,4 -4,8', fill: '#5a6a86' },
  { tx: 280, ty: -220, points: '-14,-6 2,-14 16,-2 6,12 -8,10', fill: '#3a4a66' },
  { tx: 330, ty: 40, points: '-8,-8 8,-6 6,8 -6,6', fill: '#5a6a86' },
  { tx: 60, ty: -320, points: '-10,-6 6,-10 10,6 -6,8', fill: '#d8f4ff' },
  { tx: -90, ty: -290, points: '-6,-8 8,-4 4,8 -8,4', fill: '#4ab8ff' },
  { tx: 180, ty: 130, points: '-10,-6 6,-10 10,6 -6,8', fill: '#3a4a66' },
  { tx: -340, ty: -40, points: '-8,-8 8,-6 6,8 -6,6', fill: '#d8f4ff' },
  { tx: 150, ty: -300, points: '-6,-8 8,-4 4,8 -8,4', fill: '#5a6a86' },
  { tx: -160, ty: 160, points: '-12,-8 4,-14 14,2 2,12 -10,6', fill: '#4ab8ff' },
];

const MOTES: readonly { readonly tx: number; readonly cx: number; readonly cy: number; readonly r: number }[] = [
  { tx: -70, cx: -80, cy: 50, r: 6 }, { tx: 50, cx: 40, cy: 80, r: 5 }, { tx: -30, cx: 100, cy: 20, r: 7 },
  { tx: 80, cx: -30, cy: 100, r: 4 }, { tx: -50, cx: 60, cy: -20, r: 5 }, { tx: 40, cx: -110, cy: 10, r: 4 },
  { tx: 20, cx: 10, cy: 60, r: 6 }, { tx: -90, cx: 120, cy: 70, r: 4 },
];
