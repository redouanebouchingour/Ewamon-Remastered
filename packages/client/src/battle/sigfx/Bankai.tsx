/**
 * Bankai Sever (bankaiser): black spiritual pressure rises round the attacker like a flame pillar with steel edges, the
 * red line on its armour ignites, a glint runs up the blade; one flash-step leaves afterimages and a white speed line
 * to the target; a beat of stillness, then a cross of razor-thin white-and-red blade light cuts the foe, flares and
 * splits open red, black spirit fragments scatter and ash drifts. Clock: bankai.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './bankai.module.css';

export function BankaiFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-bankai-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-bankai-red" x="-30%" y="-200%" width="160%" height="500%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ewa-sig-bankai-aura">
          <stop offset="0" stopColor="#0c0f16" stopOpacity="0.25" />
          <stop offset="0.72" stopColor="#0c0f16" stopOpacity="0.6" />
          <stop offset="0.9" stopColor="#05070c" stopOpacity="0.85" />
          <stop offset="1" stopColor="#05070c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-bankai-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8d4e0" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e8eef6" stopOpacity="0.9" />
          <stop offset="0.96" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-bankai-wound" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff2a3a" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ff2a3a" />
          <stop offset="0.5" stopColor="#ffd0d4" />
          <stop offset="0.7" stopColor="#ff2a3a" />
          <stop offset="1" stopColor="#ff2a3a" stopOpacity="0" />
        </linearGradient>
        <path id="ewa-sig-bankai-glint" d="M 0 -70 L 7 -7 L 70 0 L 7 7 L 0 70 L -7 7 L -70 0 L -7 -7 Z" />
        {/* the attacker's silhouette for the flash-step afterimages: armoured, a crest, its pale blade */}
        <filter id="ewa-sig-bankai-smear" x="-40%" y="-10%" width="180%" height="120%"><feGaussianBlur stdDeviation="9 1.5" /></filter>
        <g id="ewa-sig-bankai-ghost">
          <path d="M -70 -40 C -200 -100 -232 -230 -172 -332 C -192 -222 -160 -122 -58 -22 Z" fill="#c8d4e0" opacity="0.75" />
          <path d={GHOST} fill="#0c0f16" stroke="#c8d4e0" strokeWidth="3" strokeLinejoin="round" />
          <path d="M -56 -70 L 50 4" stroke="#ff2a3a" strokeWidth="5" strokeLinecap="round" />
        </g>
        {/* a razor-thin blade cut, 900 long, drawn from its left end */}
        <g id="ewa-sig-bankai-cut">
          <polygon points="-450,0 0,-9 450,0 0,9" fill="#ff2a3a" filter="url(#ewa-sig-bankai-red)" />
          <polygon points="-450,0 0,-4 450,0 0,4" fill="#fff" />
        </g>
      </defs>

      {/* black spiritual pressure rising round the attacker; the red line ignites; a glint runs up the blade */}
      <g className={k.atA}>
        <ellipse className={x.press} cx="0" cy="250" rx="200" ry="44" fill="none" stroke="#c8d4e0" strokeWidth="6" />
        <ellipse className={`${x.press} ${x.p2}`} cx="0" cy="250" rx="200" ry="44" fill="none" stroke="#c8d4e0" strokeWidth="4" />
        <g className={x.pillar}>
          <ellipse cx="0" cy="-230" rx="290" ry="560" fill="url(#ewa-sig-bankai-aura)" />
          <g strokeLinecap="round">
            {STREAKS.map((p, i) => (
              <line key={i} className={x.rush} x1={p.x} y1="0" x2={p.x} y2={-p.len} stroke={i % 2 === 0 ? '#05070c' : '#c8d4e0'} strokeWidth={i % 2 === 0 ? 12 : 3} />
            ))}
          </g>
          <g fill="none" strokeLinecap="round">
            {WISPS.map((d, i) => (
              <g key={i} className={x.wisp}>
                <path d={d} stroke="#05070c" strokeWidth="18" />
                <path d={d} stroke="#c8d4e0" strokeWidth="3" />
              </g>
            ))}
          </g>
        </g>
        <g filter="url(#ewa-sig-bankai-red)">
          <path className={x.redLine} d="M -190 70 L -60 20 L 60 -10 L 200 -70" pathLength={1} strokeDasharray="1" fill="none" stroke="#ff2a3a" strokeWidth="7" strokeLinecap="round" />
        </g>
        <g transform="translate(160 -240)">
          <use className={x.glint} href="#ewa-sig-bankai-glint" fill="#fff" filter="url(#ewa-sig-bankai-glow)" />
        </g>
      </g>

      {/* the flash-step: afterimages along the line (kept upright) and a white speed line to the target */}
      <g className={k.line}>
        <g className={x.speed}>
          <rect className={`${k.vb} ${x.streak}`} x="0" y="-5" width="1000" height="10" fill="url(#ewa-sig-bankai-streak)" filter="url(#ewa-sig-bankai-glow)" />
          <rect className={`${k.vb} ${x.streak} ${x.s2}`} x="0" y="-38" width="1000" height="3" fill="url(#ewa-sig-bankai-streak)" />
          <rect className={`${k.vb} ${x.streak} ${x.s3}`} x="0" y="34" width="1000" height="3" fill="url(#ewa-sig-bankai-streak)" />
          <rect className={`${k.vb} ${x.streak} ${x.s2}`} x="0" y="-80" width="1000" height="2" fill="url(#ewa-sig-bankai-streak)" />
          <rect className={`${k.vb} ${x.streak} ${x.s3}`} x="0" y="72" width="1000" height="2" fill="url(#ewa-sig-bankai-streak)" />
        </g>
        <g className={`${k.vb} ${x.at1}`}><use className={`${x.ghost} ${x.g1}`} href="#ewa-sig-bankai-ghost" filter="url(#ewa-sig-bankai-smear)" /></g>
        <g className={`${k.vb} ${x.at2}`}><use className={`${x.ghost} ${x.g2}`} href="#ewa-sig-bankai-ghost" filter="url(#ewa-sig-bankai-smear)" /></g>
        <g className={`${k.vb} ${x.at3}`}><use className={`${x.ghost} ${x.g3}`} href="#ewa-sig-bankai-ghost" filter="url(#ewa-sig-bankai-smear)" /></g>
      </g>

      {/* the cross of blade light on the target; it splits open red; spirit fragments, ash */}
      <g className={k.atD}>
        <circle className={x.ring} r="150" fill="none" stroke="#0c0f16" strokeWidth="18" />
        <circle className={`${x.ring} ${x.ringEdge}`} r="150" fill="none" stroke="#c8d4e0" strokeWidth="3" />
        <g className={k.vb} transform="rotate(-38)">
          <polygon className={`${x.wound} ${x.w1}`} points="-380,0 0,-26 380,0 0,26" fill="url(#ewa-sig-bankai-wound)" filter="url(#ewa-sig-bankai-red)" />
          <use className={`${x.cut} ${x.c1}`} href="#ewa-sig-bankai-cut" />
        </g>
        <g className={k.vb} transform="rotate(38)">
          <polygon className={`${x.wound} ${x.w2}`} points="-380,0 0,-26 380,0 0,26" fill="url(#ewa-sig-bankai-wound)" filter="url(#ewa-sig-bankai-red)" />
          <use className={`${x.cut} ${x.c2}`} href="#ewa-sig-bankai-cut" />
        </g>
        <use className={x.cross} href="#ewa-sig-bankai-glint" fill="#fff" filter="url(#ewa-sig-bankai-glow)" />
        {FRAGMENTS.map((p, i) => (
          <polygon key={i} className={x.frag} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={p.fill} stroke="#8a96a6" strokeWidth="2" />
        ))}
        {ASH.map((p, i) => (
          <rect key={i} className={x.ash} style={cssVars({ '--tx': `${p.tx}px` })} x={p.x} y={p.y} width="13" height="6" rx="1" fill={i % 3 === 0 ? '#ff2a3a' : '#c8d4e0'} />
        ))}
      </g>
    </svg>
  );
}

/** bankaiser's silhouette: horned helm, spiked pauldrons, a tattered skirt (its pale crescent blade drawn apart) */
const GHOST =
  'M -14 -150 L -40 -204 L -20 -160 L 0 -174 L 20 -160 L 40 -204 L 14 -150 L 40 -128 L 112 -122 L 86 -98 L 122 -80 ' +
  'L 70 -60 L 64 0 L 94 60 L 66 52 L 82 142 L 40 100 L 26 150 L 6 92 L -6 92 L -26 150 L -40 100 L -82 142 L -66 52 ' +
  'L -94 60 L -64 0 L -70 -60 L -122 -80 L -86 -98 L -112 -122 L -40 -128 Z';

/** the pressure rushing up the pillar (local units: the sprite is 500 tall, its feet at y 250) */
const STREAKS: readonly { readonly x: number; readonly len: number }[] = [
  -262, -236, -214, -188, -160, -128, -96, -60, -24, 18, 52, 90, 124, 158, 186, 214, 240, 266,
].map((px, i) => ({ x: px, len: 140 + ((i * 67) % 180) }));

/** black wisps with steel cores curling up the pillar's edges */
const WISPS: readonly string[] = [-250, -210, -170, 170, 210, 250].map((px, i) => {
  const h = 240 + ((i * 59) % 120);
  const c = i % 2 === 0 ? 26 : -26;
  return `M ${px} 250 c ${c} -${Math.round(h / 3)} ${-c} -${Math.round((2 * h) / 3)} ${c / 2} -${h}`;
});

const FRAGMENTS: readonly { readonly tx: number; readonly ty: number; readonly points: string; readonly fill: string }[] = [
  { tx: -300, ty: -160, points: '0,-20 10,0 0,20 -8,0', fill: '#0c0f16' },
  { tx: 280, ty: -210, points: '0,-16 9,0 0,16 -7,0', fill: '#0c0f16' },
  { tx: 320, ty: 90, points: '0,-22 11,0 0,22 -8,0', fill: '#0c0f16' },
  { tx: -260, ty: 130, points: '0,-14 8,0 0,14 -6,0', fill: '#ff2a3a' },
  { tx: 70, ty: -310, points: '0,-18 9,0 0,18 -7,0', fill: '#0c0f16' },
  { tx: -120, ty: -280, points: '0,-12 7,0 0,12 -5,0', fill: '#c8d4e0' },
  { tx: 170, ty: 220, points: '0,-16 9,0 0,16 -7,0', fill: '#0c0f16' },
  { tx: -60, ty: 260, points: '0,-14 8,0 0,14 -6,0', fill: '#0c0f16' },
  { tx: -340, ty: -20, points: '0,-18 9,0 0,18 -7,0', fill: '#0c0f16' },
  { tx: 220, ty: -60, points: '0,-12 7,0 0,12 -5,0', fill: '#ff2a3a' },
];

const ASH: readonly { readonly tx: number; readonly x: number; readonly y: number }[] = [
  { tx: -60, x: -120, y: -90 }, { tx: 40, x: -40, y: -140 }, { tx: -30, x: 60, y: -110 }, { tx: 70, x: 130, y: -60 },
  { tx: -50, x: -160, y: 10 }, { tx: 30, x: 20, y: -30 }, { tx: -80, x: 100, y: 30 }, { tx: 50, x: -70, y: 60 },
  { tx: 20, x: 160, y: -150 }, { tx: -40, x: -20, y: 90 },
];
