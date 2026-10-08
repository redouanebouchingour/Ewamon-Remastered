/**
 * Stellar Devour (noxmyth): a black hole forms in front of the attacker — a black core, a thin photon ring and a tilted
 * accretion disc turning round it — and swallows the starlight spiralling in; it drifts along the line onto the
 * target, growing; there it engulfs the foe (the disc spins up, light is sucked inward, the region darkens), then
 * collapses to a point and pops in a violet ring, leaving dark motes sinking away (the Attack drop).
 * Clock: devour.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './devour.module.css';

/** the black hole's art at unit size (core radius 50); the disc's back half is drawn behind the core, its front half over */
function Hole({ vb, fast }: { readonly vb: string; readonly fast?: boolean }) {
  const spin = fast === true ? x.spinFast : x.spin;
  return (
    <>
      <circle r="150" fill="url(#ewa-sig-devour-halo)" />
      <g className={vb} transform="rotate(-16)">
        <path d={BACK_OUT} fill="none" stroke="#9a4aff" strokeWidth="34" opacity="0.3" filter="url(#ewa-sig-devour-soft)" />
        <path d={BACK} fill="none" stroke="#9a4aff" strokeWidth="24" opacity="0.6" filter="url(#ewa-sig-devour-soft)" />
        <path d={BACK} fill="none" stroke="#8a3cf0" strokeWidth="9" />
        <path className={spin} d={BACK} fill="none" stroke="#e2ccff" strokeWidth="5" strokeDasharray="58 8 18 6" strokeLinecap="round" />
        <path className={`${spin} ${x.spinB}`} d={BACK} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="34 30 10 34" strokeLinecap="round" />
      </g>
      <circle r="62" fill="#9a4aff" opacity="0.6" filter="url(#ewa-sig-devour-soft)" />
      <circle r="52" fill="#000" />
      <circle r="53" fill="none" stroke="#fff" strokeWidth="3" filter="url(#ewa-sig-devour-glow)" />
      <circle r="58" fill="none" stroke="#d0a8ff" strokeWidth="1.5" opacity="0.7" />
      <path d="M -74 8 C -76 -122 76 -122 74 8" fill="none" stroke="#9a4aff" strokeWidth="12" opacity="0.75" filter="url(#ewa-sig-devour-soft)" />
      <path d="M -70 6 C -72 -114 72 -114 70 6" fill="none" stroke="#e2ccff" strokeWidth="3" opacity="0.9" />
      <g className={vb} transform="rotate(-16)">
        <path d={FRONT_OUT} fill="none" stroke="#9a4aff" strokeWidth="34" opacity="0.3" filter="url(#ewa-sig-devour-soft)" />
        <path d={FRONT} fill="none" stroke="#9a4aff" strokeWidth="24" opacity="0.6" filter="url(#ewa-sig-devour-soft)" />
        <path d={FRONT} fill="none" stroke="#8a3cf0" strokeWidth="9" />
        <path className={spin} d={FRONT} fill="none" stroke="#e2ccff" strokeWidth="5" strokeDasharray="58 8 18 6" strokeLinecap="round" />
        <path className={`${spin} ${x.spinB}`} d={FRONT} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="34 30 10 34" strokeLinecap="round" />
      </g>
    </>
  );
}

export function DevourFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-devour-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-devour-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
        <radialGradient id="ewa-sig-devour-halo">
          <stop offset="0" stopColor="#9a4aff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#5a1aa8" stopOpacity="0.25" />
          <stop offset="1" stopColor="#120620" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-devour-dark">
          <stop offset="0" stopColor="#000" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#0a0312" stopOpacity="0.75" />
          <stop offset="0.75" stopColor="#120620" stopOpacity="0.4" />
          <stop offset="1" stopColor="#120620" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-devour-wake" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a4aff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#9a4aff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#d0a8ff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ewa-sig-devour-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor="#d0a8ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#9a4aff" stopOpacity="0" />
        </linearGradient>
        <path id="ewa-sig-devour-star" d="M 0 -14 L 2.5 -2.5 L 14 0 L 2.5 2.5 L 0 14 L -2.5 2.5 L -14 0 L -2.5 -2.5 Z" />
      </defs>

      {/* the hole: formed in front of the attacker, swallowing starlight, then carried along the line onto the target */}
      <g className={k.line}>
        <rect className={`${k.vb} ${x.wake}`} x="-1" y="-40" width="1" height="80" fill="url(#ewa-sig-devour-wake)" />
        <rect className={`${k.vb} ${x.wake}`} x="-1" y="-4" width="1" height="8" fill="url(#ewa-sig-devour-wake)" />
        <g className={`${k.vb} ${x.carrier}`}>
          <g className={`${k.vb} ${x.upright}`}>
            <g className={`${k.vb} ${x.grow}`}>
              <Hole vb={k.vb} />
              {INFALL.map((f, i) => (
                <g key={i} className={k.vb} transform={`rotate(${f.a})`}>
                  <g className={`${k.vb} ${x.swirl}`} style={cssVars({ '--d': `${f.d}ms` })}>
                    <use className={`${k.vb} ${x.infall}`} style={cssVars({ '--d': `${f.d}ms`, '--r0': `${f.r}px` })} href="#ewa-sig-devour-star" fill={i % 3 === 0 ? '#fff' : '#d0a8ff'} />
                  </g>
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>

      {/* the target: the region darkens, the hole engulfs it with its disc spun up, light sucked inward; collapse, pop */}
      <g className={k.atD}>
        <circle className={x.dark} r="300" fill="url(#ewa-sig-devour-dark)" />
        {STREAKS.map((s, i) => (
          <g key={i} className={k.vb} transform={`rotate(${s.a})`}>
            <rect className={`${k.vb} ${x.streak}`} style={cssVars({ '--d': `${s.d}ms` })} x="0" y={-s.w / 2} width="200" height={s.w} rx={s.w / 2} fill="url(#ewa-sig-devour-streak)" />
          </g>
        ))}
        <g className={x.engulf}>
          <g className={k.vb} transform="scale(2.1)">
            <Hole vb={k.vb} fast />
          </g>
        </g>
        <circle className={x.point} r="16" fill="#fff" filter="url(#ewa-sig-devour-glow)" />
        <circle className={x.pop} r="110" fill="none" stroke="#9a4aff" strokeWidth="10" />
        <circle className={`${x.pop} ${x.pop2}`} r="90" fill="none" stroke="#d0a8ff" strokeWidth="3" />
        <ellipse className={x.popFlat} rx="260" ry="6" fill="#d0a8ff" filter="url(#ewa-sig-devour-glow)" />
        {MOTES.map((m, i) => (
          <circle key={i} className={x.mote} style={cssVars({ '--tx': `${m.tx}px`, '--ty': `${m.ty}px` })} cx={m.cx} cy={m.cy} r={m.r} fill="#1a0830" stroke="#9a4aff" strokeWidth="2.5" />
        ))}
      </g>
    </svg>
  );
}

/** the accretion disc (rx 150, ry 34) as its back (upper) half drawn left → right and its front (lower) half right → left */
const BACK = 'M -150 0 A 150 34 0 0 1 150 0';
const FRONT = 'M 150 0 A 150 34 0 0 1 -150 0';
const BACK_OUT = 'M -195 0 A 195 46 0 0 1 195 0';
const FRONT_OUT = 'M 195 0 A 195 46 0 0 1 -195 0';

/** stars spiralling into the hole during the charge: start angle (deg), start radius, launch (ms) */
const INFALL: readonly { readonly a: number; readonly r: number; readonly d: number }[] = [
  { a: 0, r: 230, d: 1120 }, { a: 140, r: 260, d: 1150 }, { a: 250, r: 210, d: 1180 }, { a: 60, r: 280, d: 1210 },
  { a: 200, r: 240, d: 1240 }, { a: 320, r: 260, d: 1270 }, { a: 100, r: 220, d: 1300 }, { a: 280, r: 270, d: 1330 },
  { a: 20, r: 250, d: 1360 }, { a: 170, r: 230, d: 1390 },
];

/** light sucked into the engulfing hole: angle (deg), launch (ms), thickness */
const STREAKS: readonly { readonly a: number; readonly d: number; readonly w: number }[] = [
  { a: 10, d: 1945, w: 8 }, { a: 75, d: 1957, w: 5 }, { a: 140, d: 1969, w: 7 }, { a: 200, d: 1981, w: 6 },
  { a: 255, d: 1993, w: 8 }, { a: 310, d: 2005, w: 5 }, { a: 40, d: 2017, w: 6 }, { a: 110, d: 2029, w: 8 },
  { a: 170, d: 2041, w: 5 }, { a: 230, d: 2053, w: 7 }, { a: 285, d: 2065, w: 6 }, { a: 340, d: 2077, w: 7 },
  { a: 60, d: 2089, w: 5 }, { a: 190, d: 2101, w: 6 },
];

/** dark motes left behind, sinking away after the pop (local units: the target's sprite is 300 tall) */
const MOTES: readonly { readonly cx: number; readonly cy: number; readonly r: number; readonly tx: number; readonly ty: number }[] = [
  { cx: -80, cy: -40, r: 9, tx: -60, ty: 110 }, { cx: 60, cy: -70, r: 7, tx: 50, ty: 140 }, { cx: -20, cy: 30, r: 10, tx: -20, ty: 120 },
  { cx: 100, cy: 20, r: 8, tx: 80, ty: 90 }, { cx: -120, cy: 40, r: 6, tx: -90, ty: 100 }, { cx: 30, cy: -120, r: 8, tx: 20, ty: 160 },
  { cx: -50, cy: 90, r: 7, tx: -30, ty: 70 }, { cx: 130, cy: -40, r: 6, tx: 100, ty: 130 },
];
