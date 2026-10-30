/**
 * Thermal Shock (kelvyre): the white-gold seam down its body splits open while a core of fire and a core of ice circle
 * each other at its side, embers rising on one side and frost shards turning on the other; released, the two cores
 * twist into one helix of flame and ice round a white line that races to the target; the impact splits down the
 * middle, one half a fire blast and the other an ice blast, with a white seam of light through the target, shards and
 * embers flying apart. Clock: thermal.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './thermal.module.css';

export function ThermalFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-therm-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ewa-sig-therm-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
        <radialGradient id="ewa-sig-therm-fire">
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset="0.3" stopColor="#ffc24a" />
          <stop offset="0.6" stopColor="#ff7a2a" />
          <stop offset="0.85" stopColor="#c2361c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3a1a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-therm-ice">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#d8f2ff" />
          <stop offset="0.6" stopColor="#7cc3ee" />
          <stop offset="0.85" stopColor="#2f6fa8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0a2040" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-therm-seam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff7a2a" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ffc24a" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#fff3c4" />
          <stop offset="0.7" stopColor="#7cc3ee" stopOpacity="0.8" />
          <stop offset="1" stopColor="#7cc3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-therm-core" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff3c4" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="0.65" stopColor="#fff3c4" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ewa-sig-therm-left"><rect x="-600" y="-600" width="600" height="1200" /></clipPath>
        <clipPath id="ewa-sig-therm-right"><rect x="0" y="-600" width="600" height="1200" /></clipPath>
      </defs>

      {/* the seam down the attacker's body splits open: a white-gold line, embers up its fire half (the side facing the
          target, in the front and the back sprite alike), frost round its ice half */}
      <g className={k.atA}>
        <g className={x.seam}>
          <rect x="-60" y="-260" width="120" height="520" fill="url(#ewa-sig-therm-seam)" filter="url(#ewa-sig-therm-soft)" />
          <rect className={x.seamCore} x="-7" y="-250" width="14" height="500" rx="7" fill="#fff" filter="url(#ewa-sig-therm-glow)" />
        </g>
        <g className={`${k.vb} ${x.sides}`}>
          {EMBERS.map((p, i) => (
            <circle key={i} className={x.ember} cx={p.cx} cy={p.cy} r={p.r} fill={i % 2 === 0 ? '#ffc24a' : '#ff7a2a'} />
          ))}
          {FROST.map((p, i) => (
            <g key={i} className={k.vb} transform={`translate(${p.cx} ${p.cy})`}>
              <polygon className={x.frost} points={p.points} fill={i % 2 === 0 ? '#d8f2ff' : '#7cc3ee'} />
            </g>
          ))}
        </g>
      </g>

      <g className={k.line}>
        <g transform="translate(120 0)">
          {/* the two cores circle each other through the charge, then merge into the helix's root */}
          <g className={x.cores}>
            <circle r="160" fill="#fff3c4" opacity="0.35" filter="url(#ewa-sig-therm-soft)" />
            <g className={x.orbit}>
              <g className={k.vb} transform="translate(-62 0)">
                <circle className={x.pulse} r="70" fill="url(#ewa-sig-therm-fire)" />
                <circle r="24" fill="#fff6d0" filter="url(#ewa-sig-therm-glow)" />
              </g>
              <g className={k.vb} transform="translate(62 0)">
                <circle className={x.pulse} r="70" fill="url(#ewa-sig-therm-ice)" />
                <circle r="24" fill="#fff" filter="url(#ewa-sig-therm-glow)" />
              </g>
            </g>
            <g className={x.haloGate}>
              <circle className={x.halo} r="110" fill="none" stroke="#fff3c4" strokeWidth="4" />
            </g>
          </g>

          {/* the helix: a white line with a ribbon of flame and a ribbon of ice twisting round it */}
          <g className={`${k.vb} ${x.beam}`}>
            <g className={x.beamPulse}>
              <rect x="0" y="-90" width="1000" height="180" fill="url(#ewa-sig-therm-core)" opacity="0.35" />
              <rect x="0" y="-14" width="1000" height="28" fill="url(#ewa-sig-therm-core)" />
              <g fill="none" strokeLinecap="round" filter="url(#ewa-sig-therm-glow)">
                <path className={x.strand} d={HELIX_A} stroke="#ff7a2a" strokeWidth="26" />
                <path className={x.strand} d={HELIX_B} stroke="#7cc3ee" strokeWidth="26" />
                <path className={`${x.strand} ${x.s2}`} d={HELIX_A} stroke="#ffc24a" strokeWidth="9" strokeDasharray="50 30" />
                <path className={`${x.strand} ${x.s2}`} d={HELIX_B} stroke="#fff" strokeWidth="9" strokeDasharray="40 40" />
              </g>
            </g>
          </g>

          {/* the head racing ahead: half fire, half ice */}
          <g className={`${k.vb} ${x.head}`}>
            <circle r="90" fill="url(#ewa-sig-therm-fire)" clipPath="url(#ewa-sig-therm-left)" />
            <circle r="90" fill="url(#ewa-sig-therm-ice)" clipPath="url(#ewa-sig-therm-right)" />
            <circle r="34" fill="#fff" filter="url(#ewa-sig-therm-glow)" />
          </g>
        </g>
      </g>

      {/* the impact splits down the middle: a fire blast and an ice blast, a white seam through the target */}
      <g className={k.atD}>
        <ellipse className={x.ground} cx="0" cy="150" rx="250" ry="56" fill="none" stroke="#fff3c4" strokeWidth="8" />
        <g className={x.blast}>
          <circle r="220" fill="url(#ewa-sig-therm-fire)" clipPath="url(#ewa-sig-therm-left)" />
          <circle r="220" fill="url(#ewa-sig-therm-ice)" clipPath="url(#ewa-sig-therm-right)" />
        </g>
        <circle className={`${x.shock}`} r="150" fill="none" stroke="#ff7a2a" strokeWidth="9" clipPath="url(#ewa-sig-therm-left)" />
        <circle className={`${x.shock}`} r="150" fill="none" stroke="#7cc3ee" strokeWidth="9" clipPath="url(#ewa-sig-therm-right)" />
        <g className={x.split}>
          <rect x="-12" y="-340" width="24" height="560" rx="12" fill="#fff" filter="url(#ewa-sig-therm-glow)" />
        </g>
        {SHARDS.map((p, i) => (
          <polygon key={i} className={x.shard} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} points={p.points} fill={i % 2 === 0 ? '#d8f2ff' : '#7cc3ee'} />
        ))}
        {SPARKS.map((p, i) => (
          <circle key={i} className={x.spark} style={cssVars({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` })} r={p.r} fill={i % 2 === 0 ? '#ffc24a' : '#ff7a2a'} />
        ))}
      </g>
    </svg>
  );
}

/**
 * embers rising on the fire side (+x: thermal.module.css turns +x toward the target) of the attacker (local units: the
 * sprite is 500 tall, its feet at y 250)
 */
const EMBERS: readonly { readonly cx: number; readonly cy: number; readonly r: number }[] = [
  { cx: 90, cy: 200, r: 9 }, { cx: 150, cy: 120, r: 7 }, { cx: 60, cy: 60, r: 8 }, { cx: 190, cy: 20, r: 6 },
  { cx: 110, cy: -40, r: 9 }, { cx: 170, cy: -120, r: 6 }, { cx: 80, cy: -170, r: 7 },
];

/** frost shards turning on the ice side (-x, away from the target) */
const FROST: readonly { readonly cx: number; readonly cy: number; readonly points: string }[] = [
  { cx: -90, cy: -180, points: '0,-16 6,0 0,16 -6,0' }, { cx: -160, cy: -110, points: '0,-12 5,0 0,12 -5,0' },
  { cx: -70, cy: -50, points: '0,-14 5,0 0,14 -5,0' }, { cx: -190, cy: 0, points: '0,-10 4,0 0,10 -4,0' },
  { cx: -120, cy: 70, points: '0,-16 6,0 0,16 -6,0' }, { cx: -170, cy: 150, points: '0,-12 5,0 0,12 -5,0' },
  { cx: -80, cy: 200, points: '0,-10 4,0 0,10 -4,0' },
];

/** the two helix strands (1000 long before the beam's stretch), half a turn apart */
const helix = (phase: number): string =>
  `M 0 ${Math.round(Math.sin(phase) * 46)} ${Array.from({ length: 40 }, (_, i) => {
    const xEnd = (i + 1) * 25;
    return `L ${xEnd} ${Math.round(Math.sin(phase + (xEnd / 1000) * Math.PI * 12) * 46)}`;
  }).join(' ')}`;
const HELIX_A = helix(0);
const HELIX_B = helix(Math.PI);

/** ice shards flung from the ice half of the blast */
const SHARDS: readonly { readonly tx: number; readonly ty: number; readonly points: string }[] = [
  { tx: 300, ty: -200, points: '0,-22 7,0 0,22 -7,0' }, { tx: 340, ty: 30, points: '0,-16 6,0 0,16 -6,0' },
  { tx: 200, ty: -310, points: '0,-18 6,0 0,18 -6,0' }, { tx: 240, ty: 140, points: '0,-14 5,0 0,14 -5,0' },
  { tx: 120, ty: -280, points: '0,-20 7,0 0,20 -7,0' }, { tx: 380, ty: -90, points: '0,-12 5,0 0,12 -5,0' },
];

/** embers flung from the fire half */
const SPARKS: readonly { readonly tx: number; readonly ty: number; readonly r: number }[] = [
  { tx: -300, ty: -220, r: 9 }, { tx: -350, ty: 20, r: 7 }, { tx: -200, ty: -320, r: 8 },
  { tx: -250, ty: 130, r: 6 }, { tx: -120, ty: -290, r: 7 }, { tx: -380, ty: -100, r: 6 },
];
