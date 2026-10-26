/**
 * Demon Lord's Descent (astaroth): the attacker dissolves into black smoke, its red eyes burn once and the smoke streams
 * up and away; the screen darkens round the target; a five-leaf clover sigil of black anti-magic flares on the ground
 * under the target with a pillar of crimson light; the demon lord drops from above through the pillar, both blades
 * raised; an X of two cuts (a heavy stone greatsword arc, a thin crimson katana arc), a crack of red light, a black
 * shockwave with red sparks and smoke, then black feathers and ash drift down. Clock: descent.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import d from './descent.module.css';

export function DescentFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-descent-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-descent-red" x="-40%" y="-200%" width="180%" height="500%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-descent-billow" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="56" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="5" />
        </filter>
        <filter id="ewa-sig-descent-smear" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="1.2 9" /></filter>
        <radialGradient id="ewa-sig-descent-dark">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.035" stopColor="#000" stopOpacity="0" />
          <stop offset="0.09" stopColor="#030102" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#030102" stopOpacity="0.78" />
          <stop offset="1" stopColor="#030102" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id="ewa-sig-descent-smoke">
          <stop offset="0" stopColor="#030102" stopOpacity="1" />
          <stop offset="0.62" stopColor="#050103" stopOpacity="1" />
          <stop offset="0.85" stopColor="#0c0206" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1a0306" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-descent-halo">
          <stop offset="0" stopColor="#ff3b4f" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#e0142c" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1a0306" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-descent-core">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffd0d6" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ff3b4f" stopOpacity="0.7" />
          <stop offset="1" stopColor="#5a0414" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-descent-column" cy="0.85" r="0.6">
          <stop offset="0" stopColor="#050205" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#14030a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#14030a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-descent-pillar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e0142c" stopOpacity="0" />
          <stop offset="0.3" stopColor="#e0142c" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#ff3b4f" stopOpacity="0.8" />
          <stop offset="0.7" stopColor="#e0142c" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e0142c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-descent-pillar-core" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#050205" stopOpacity="0" />
          <stop offset="0.5" stopColor="#050205" stopOpacity="0.75" />
          <stop offset="1" stopColor="#050205" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-descent-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="ewa-sig-descent-pillar-fade" maskUnits="userSpaceOnUse" x="-400" y="-760" width="800" height="920">
          <rect x="-400" y="-760" width="800" height="920" fill="url(#ewa-sig-descent-fade)" />
        </mask>
        <linearGradient id="ewa-sig-descent-trail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#050205" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#1a0306" stopOpacity="0.5" />
          <stop offset="1" stopColor="#1a0306" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-descent-redline" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff3b4f" />
          <stop offset="1" stopColor="#ff3b4f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-descent-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5e68" />
          <stop offset="0.4" stopColor="#2a2a30" />
          <stop offset="1" stopColor="#050205" />
        </linearGradient>
        <path id="ewa-sig-descent-leaf" d={LEAF} />
        <path id="ewa-sig-descent-feather" d={FEATHER} />
        <path id="ewa-sig-descent-star" d="M 0 -70 L 8 -8 L 70 0 L 8 8 L 0 70 L -8 8 L -70 0 L -8 -8 Z" />
        {/* the demon lord falling, both blades raised: bat wings, horns, the stone greatsword and the red katana */}
        <g id="ewa-sig-descent-lord">
          <g fill="#050205" stroke="#e0142c" strokeWidth="3" strokeLinejoin="round">
            <path d={WING} />
            <g className={k.vb} transform="scale(-1 1)"><path d={WING} /></g>
            <path d={LORD} />
          </g>
          <g fill="none" stroke="#050205" strokeWidth="24" strokeLinecap="round">
            <path d="M -54 -86 L -84 -140 L -92 -192" />
            <path d="M 54 -86 L 84 -140 L 92 -192" />
          </g>
          <polygon points="-70,-200 -114,-178 -232,-412 -214,-452 -186,-440" fill="url(#ewa-sig-descent-stone)" stroke="#9aa0aa" strokeWidth="3" strokeLinejoin="round" />
          <polyline points="-96,-206 -122,-258 -140,-276 -152,-330 -178,-374" fill="none" stroke="#ff3b4f" strokeWidth="3" />
          <line x1="-56" y1="-208" x2="-128" y2="-172" stroke="#3a3a42" strokeWidth="10" strokeLinecap="round" />
          <g filter="url(#ewa-sig-descent-red)">
            <line x1="92" y1="-192" x2="176" y2="-446" stroke="#ff3b4f" strokeWidth="6" strokeLinecap="round" />
          </g>
          <line x1="92" y1="-192" x2="176" y2="-446" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <g fill="none" stroke="#ff3b4f" strokeWidth="3" strokeLinecap="round">
            <path d="M -20 -96 L -6 -60 L -18 -20 L -4 20" />
            <path d="M 24 -90 L 12 -50 L 28 -10" />
          </g>
          <path d="M -18 -132 L -4 -126 L -18 -122 Z M 18 -132 L 4 -126 L 18 -122 Z" fill="#ff3b4f" filter="url(#ewa-sig-descent-glow)" />
        </g>
        {/* the two cuts, 760 long, bowing up, drawn from their left end */}
        <g id="ewa-sig-descent-sword-arc">
          <path d={arc(-210, -60)} fill="#e0142c" filter="url(#ewa-sig-descent-red)" opacity="0.55" />
          <path d={arc(-210, -60)} fill="url(#ewa-sig-descent-stone)" />
          <path d="M -380 0 Q 0 -210 380 0" fill="none" stroke="#d8dce4" strokeWidth="5" />
        </g>
        <g id="ewa-sig-descent-katana-arc">
          <path d={arc(-116, -84)} fill="#e0142c" filter="url(#ewa-sig-descent-red)" />
          <path d={arc(-108, -92)} fill="#fff" />
        </g>
      </defs>

      {/* the screen darkens round the target */}
      <g className={k.atD}>
        <circle className={d.dark} r="6000" fill="url(#ewa-sig-descent-dark)" />
      </g>

      {/* the attacker dissolves into black smoke, its eyes burn once, the smoke streams up and away */}
      <g className={k.atA}>
        <ellipse className={d.column} cx="0" cy="-760" rx="170" ry="700" fill="url(#ewa-sig-descent-column)" />
        <g className={d.smoke} filter="url(#ewa-sig-descent-billow)">
          <ellipse className={d.puff} style={cssVars({ '--kd': '40ms' })} cx="0" cy="0" rx="300" ry="380" fill="url(#ewa-sig-descent-halo)" opacity="0.5" />
          {PUFFS.map((p, i) => (
            <circle key={i} className={d.puff} style={cssVars({ '--kd': `${p.d}ms` })} cx={p.x} cy={p.y} r={p.r} fill="url(#ewa-sig-descent-smoke)" />
          ))}
        </g>
        <g className={d.embers} fill="#ff3b4f">
          {EMBERS_A.map((p, i) => (
            <circle key={i} className={d.ember} cx={p.x} cy={p.y} r={p.r} />
          ))}
        </g>
        <g className={d.eyes}>
          <ellipse cx="0" cy="-150" rx="120" ry="40" fill="url(#ewa-sig-descent-halo)" />
          <path d="M -78 -166 L -14 -148 L -18 -138 L -74 -152 Z M 78 -166 L 14 -148 L 18 -138 L 74 -152 Z" fill="#ff3b4f" filter="url(#ewa-sig-descent-red)" />
          <path d="M -66 -160 L -22 -148 L -24 -144 L -64 -154 Z M 66 -160 L 22 -148 L 24 -144 L 64 -154 Z" fill="#ffe0e4" />
        </g>
      </g>

      {/* the target: the sigil, the pillar, the drop and the impact */}
      <g className={k.atD}>
        {/* the five-leaf clover sigil of black anti-magic on the ground under the target */}
        <g className={k.vb} transform="translate(0 150) scale(1 0.4)">
          <g className={`${k.vb} ${d.sigil}`}>
            <circle className={d.halo} r="340" fill="url(#ewa-sig-descent-halo)" />
            <g className={`${k.vb} ${d.spin}`}>
              <circle className={d.ringDraw} r="285" pathLength={1} fill="none" stroke="#ff3b4f" strokeWidth="7" filter="url(#ewa-sig-descent-glow)" />
              <circle className={d.runes} r="252" fill="none" stroke="#e0142c" strokeWidth="9" strokeDasharray="18 9 5 9" />
              {LEAVES.map((a, i) => (
                <g key={i} className={k.vb} transform={`rotate(${a}) translate(0 -24)`}>
                  <g className={d.leaf} style={cssVars({ '--kd': `${40 + i * 40}ms` })}>
                    <use href="#ewa-sig-descent-leaf" fill="#050205" fillOpacity="0.88" stroke="#ff3b4f" strokeWidth="5" filter="url(#ewa-sig-descent-glow)" />
                    <path d="M 0 -8 L 0 -130" stroke="#ff3b4f" strokeWidth="4" strokeLinecap="round" />
                  </g>
                </g>
              ))}
              <circle r="30" fill="#050205" stroke="#ff3b4f" strokeWidth="5" />
            </g>
          </g>
        </g>
        <g className={d.pillar}>
          <g mask="url(#ewa-sig-descent-pillar-fade)">
            <rect x="-200" y="-760" width="400" height="910" fill="url(#ewa-sig-descent-pillar)" />
            <rect x="-60" y="-760" width="120" height="910" fill="url(#ewa-sig-descent-pillar-core)" />
          </g>
          {/* streaks rushing down the pillar: something is coming */}
          <g fill="#ff3b4f">
            {RUSH.map((x, i) => (
              <rect key={i} className={d.rush} x={x} y="-700" width="4" height="150" rx="2" />
            ))}
          </g>
        </g>

        {/* the drop: the demon lord falls from above with a smoke trail */}
        <g className={`${k.vb} ${d.fall}`}>
          <rect x="-80" y="-1150" width="160" height="1130" fill="url(#ewa-sig-descent-trail)" />
          <rect x="-150" y="-900" width="5" height="760" fill="url(#ewa-sig-descent-redline)" />
          <rect x="140" y="-1000" width="5" height="840" fill="url(#ewa-sig-descent-redline)" />
          <rect x="-230" y="-760" width="3" height="560" fill="url(#ewa-sig-descent-redline)" opacity="0.7" />
          <rect x="220" y="-820" width="3" height="620" fill="url(#ewa-sig-descent-redline)" opacity="0.7" />
          <g className={k.vb} transform="scale(0.62)">
            <use href="#ewa-sig-descent-lord" filter="url(#ewa-sig-descent-smear)" />
          </g>
        </g>

        {/* the impact: the X of two cuts, the crack of red light, the shockwave, sparks, smoke */}
        <circle className={d.core} cy="-10" r="220" fill="url(#ewa-sig-descent-core)" />
        <g className={k.vb} transform="translate(0 150) scale(1 0.3)">
          <circle className={d.ground} r="200" fill="none" stroke="#050205" strokeWidth="30" />
          <circle className={d.ground} r="200" fill="none" stroke="#ff3b4f" strokeWidth="6" />
        </g>
        {BURST.map((p, i) => (
          <circle key={i} className={d.burst} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} cx={p.x} cy={p.y} r={p.r} fill="url(#ewa-sig-descent-smoke)" />
        ))}
        <circle className={d.shock} cy="-10" r="150" fill="none" stroke="#050205" strokeWidth="30" />
        <circle className={d.shock} cy="-10" r="150" fill="none" stroke="#e0142c" strokeWidth="4" />
        <g className={k.vb} transform="rotate(36) translate(0 68)">
          <use className={`${d.cut} ${d.sword}`} href="#ewa-sig-descent-sword-arc" />
        </g>
        <g className={k.vb} transform="rotate(144) scale(1 -1) translate(0 50)">
          <use className={`${d.cut} ${d.katana}`} href="#ewa-sig-descent-katana-arc" />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {CRACKS.map((c, i) => (
            <g key={i} className={d.crack} style={cssVars({ '--kd': `${c.d}ms` })}>
              <path className={d.crackLine} d={c.path} pathLength={1} stroke="#ff3b4f" strokeWidth="7" filter="url(#ewa-sig-descent-red)" />
              <path className={d.crackLine} d={c.path} pathLength={1} stroke="#ffe0e4" strokeWidth="2" />
            </g>
          ))}
        </g>
        <g className={k.vb} transform="translate(0 -10)">
          <use className={d.star} href="#ewa-sig-descent-star" fill="#fff" filter="url(#ewa-sig-descent-red)" />
        </g>
        {SPARKS.map((p, i) => (
          <g key={i} className={k.vb} transform={`translate(0 -10) rotate(${p.a})`}>
            <rect className={d.spark} style={cssVars({ '--d': `${p.d}px` })} x="50" y="-2" width={p.len} height="4" rx="2" fill={i % 3 === 0 ? '#fff' : '#ff3b4f'} />
          </g>
        ))}
        {FEATHERS.map((p, i) => (
          <g key={i} className={k.vb} transform={`translate(${p.x} ${p.y}) rotate(${p.r0})`}>
            <g className={d.feather} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--kd': `${p.d}ms` })}>
              <g className={d.sway}>
                <g className={k.vb} transform={`scale(${p.s})`}>
                  <use href="#ewa-sig-descent-feather" fill="#000" stroke="#a01428" strokeWidth="1.5" />
                  <path d="M 0 -34 L 0 40" stroke="#5a0a14" strokeWidth="2" />
                </g>
              </g>
            </g>
          </g>
        ))}
        {ASH.map((p, i) => (
          <rect key={i} className={d.ash} style={cssVars({ '--tx': `${p.tx}px`, '--kd': `${p.d}ms` })} x={p.x} y={p.y} width="8" height="5" rx="1" fill={i % 3 === 0 ? '#ff3b4f' : '#1a1418'} />
        ))}
      </g>
    </svg>
  );
}

const poly = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

/** a crescent cut along x −380–380 bowing up: outer and inner control heights (the bow peaks at half of each) */
const arc = (outer: number, inner: number) => `M -380 0 Q 0 ${outer} 380 0 Q 0 ${inner} -380 0 Z`;

/** one clover leaf, a heart with its point at the origin and its lobes out at y −150 */
const LEAF = 'M 0 0 C -10 -40 -66 -74 -64 -124 C -62 -162 -18 -174 0 -136 C 18 -174 62 -162 64 -124 C 66 -74 10 -40 0 0 Z';
/** a black feather, about 78 long, tip at the top, two notches in its vane and the quill along its spine */
const FEATHER =
  'M 0 -38 C 7 -32 12 -20 12 -10 L 5 -6 L 12 0 C 12 12 8 24 2 32 L 0 40 L -2 32 C -10 22 -14 10 -13 -2 L -6 2 ' +
  'L -13 -10 C -12 -22 -7 -32 0 -38 Z';

/** the demon lord's silhouette (local units, about 620 tall with its blades): horned head, armoured body, legs */
const LORD =
  'M -16 -128 L -34 -172 L -22 -134 L 0 -144 L 22 -134 L 34 -172 L 16 -128 L 30 -104 L 60 -92 L 52 -40 L 40 20 ' +
  'L 52 100 L 36 170 L 14 168 L 12 70 L -12 70 L -14 168 L -36 170 L -52 100 L -40 20 L -52 -40 L -60 -92 L -30 -104 Z';
/** its left bat wing, scalloped (the right one is the mirror) */
const WING = 'M -46 -92 C -110 -150 -190 -170 -262 -138 L -236 -104 L -262 -64 L -210 -66 L -214 -18 L -162 -34 L -150 12 L -104 -24 L -52 -40 Z';

/** five leaves round the sigil's heart */
const LEAVES = Array.from({ length: 5 }, (_, i) => i * 72);

/** the smoke the attacker dissolves into (local units: the sprite is 500 tall, its feet at y 250) */
const PUFFS = Array.from({ length: 20 }, (_, i) => {
  const a = i * 2.39996;
  const f = Math.sqrt((i + 0.5) / 20);
  return {
    x: Math.round(Math.cos(a) * 170 * f),
    y: Math.round(Math.sin(a) * 250 * f),
    r: 150 - Math.round(f * 40),
    d: Math.round(f * 110),
  };
});

const EMBERS_A: readonly { readonly x: number; readonly y: number; readonly r: number }[] = [
  { x: -150, y: 200, r: 5 }, { x: -90, y: 120, r: 4 }, { x: -30, y: 220, r: 6 }, { x: 40, y: 160, r: 4 }, { x: 100, y: 230, r: 5 },
  { x: 160, y: 140, r: 4 }, { x: -120, y: 30, r: 3 }, { x: 70, y: 40, r: 4 }, { x: -10, y: 90, r: 3 }, { x: 130, y: 60, r: 3 },
];

/** the streaks rushing down the pillar */
const RUSH = [-150, -96, -40, 14, 70, 124];

/** the crack of red light: seven jagged lines out from the impact */
const CRACKS = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * 2 * Math.PI + 0.4;
  const reach = 230 + (i % 3) * 50;
  const pts = Array.from({ length: 6 }, (_, j): readonly [number, number] => {
    const r = (reach * j) / 5;
    const off = j === 0 ? 0 : (((i * 7 + j * 13) % 5) - 2) * 14;
    return [Math.round(Math.cos(a) * r - Math.sin(a) * off), Math.round(-10 + Math.sin(a) * r + Math.cos(a) * off)];
  });
  return { path: poly(pts), d: (i % 3) * 15 };
});

/** black smoke thrown out from the target's feet */
const BURST = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * 2 * Math.PI;
  return {
    x: Math.round(Math.cos(a) * 60),
    y: Math.round(110 + Math.sin(a) * 20),
    r: 90 + (i % 3) * 20,
    tx: Math.round(Math.cos(a) * 280),
    ty: Math.round(Math.sin(a) * 70 - 60),
  };
});

const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  a: Math.round((i / 16) * 360 + ((i * 37) % 17)),
  d: 220 + ((i * 53) % 160),
  len: 26 + ((i * 29) % 30),
}));

/** black feathers flung up from the impact, drifting down */
const FEATHERS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * 2 * Math.PI + 0.2;
  const reach = 200 + ((i * 61) % 160);
  return {
    x: Math.round(Math.cos(a) * 30),
    y: Math.round(-20 + Math.sin(a) * 30),
    r0: (i * 67) % 360,
    tx: Math.round(Math.cos(a) * reach),
    ty: Math.round(Math.sin(a) * reach * 0.5 - 150),
    s: 0.85 + (i % 3) * 0.2,
    d: (i % 4) * 30,
  };
});

const ASH: readonly { readonly tx: number; readonly x: number; readonly y: number; readonly d: number }[] = [
  { tx: -60, x: -120, y: -40, d: 0 }, { tx: 40, x: -40, y: -100, d: 60 }, { tx: -30, x: 60, y: -70, d: 30 }, { tx: 70, x: 130, y: -20, d: 90 },
  { tx: -50, x: -160, y: 50, d: 120 }, { tx: 30, x: 20, y: 10, d: 40 }, { tx: -80, x: 100, y: 70, d: 150 }, { tx: 50, x: -70, y: 100, d: 80 },
  { tx: 20, x: 160, y: -110, d: 110 }, { tx: -40, x: -20, y: 130, d: 20 }, { tx: 60, x: 200, y: 60, d: 170 }, { tx: -70, x: -210, y: -60, d: 140 },
];
