/**
 * Rift Collapse (voidraxis): space cracks round the attacker like broken glass and a crack runs along the line to the
 * target; a vertical rift tears open over the foe — a jagged lens, black inside with stars, violet light pouring from
 * its edges — widening through the travel; at the impact it slams shut into a line, an implosion ring and a burst, and
 * the space round the target falls apart into drifting glass shards. Clock: rift.module.css.
 */
import { cssVars } from '../../ui/cssVars';
import type { FxProps } from './kit';
import x from './rift.module.css';

export function RiftFx({ k }: FxProps) {
  return (
    <svg className={k.svg} aria-hidden="true">
      <defs>
        <filter id="ewa-sig-rift-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="ewa-sig-rift-bloom" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="ewa-sig-rift-clip"><path d={LENS} /></clipPath>
        <radialGradient id="ewa-sig-rift-pour">
          <stop offset="0" stopColor="#d89aff" stopOpacity="0.7" />
          <stop offset="0.35" stopColor="#b04aff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#3a1070" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-rift-nebula">
          <stop offset="0" stopColor="#6a2ab8" stopOpacity="0.8" />
          <stop offset="0.6" stopColor="#1a0a3a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#04010c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-rift-void">
          <stop offset="0" stopColor="#0a0418" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#0a0418" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0a0418" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ewa-sig-rift-aura">
          <stop offset="0" stopColor="#b04aff" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#4a1a90" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0a0418" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ewa-sig-rift-ray-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e6c8ff" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#b04aff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b04aff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-rift-ray-l" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e6c8ff" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#b04aff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b04aff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ewa-sig-rift-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8fdff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#5af0ff" stopOpacity="0.18" />
          <stop offset="0.7" stopColor="#b04aff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0a0418" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* space cracks round the attacker */}
      <g className={k.atA}>
        <ellipse className={x.aura} cx="0" cy="0" rx="420" ry="380" fill="url(#ewa-sig-rift-aura)" />
        <g className={x.cracks}>
          <g filter="url(#ewa-sig-rift-glow)">
            {CRACKS_A.map((d, i) => (
              <path key={i} className={x.crack} style={cssVars({ '--d': `${CRACK_DELAY[i]}ms` })} d={d} pathLength={1} strokeDasharray="1" fill="none" stroke="#b04aff" strokeOpacity="0.7" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
          {CRACKS_A.map((d, i) => (
            <path key={i} className={x.crack} style={cssVars({ '--d': `${CRACK_DELAY[i]}ms` })} d={d} pathLength={1} strokeDasharray="1" fill="none" stroke="#5af0ff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {CRACKS_A.map((d, i) => (
            <path key={i} className={x.crack} style={cssVars({ '--d': `${CRACK_DELAY[i]}ms` })} d={d} pathLength={1} strokeDasharray="1" fill="none" stroke="#f0feff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>
      </g>

      {/* the crack running along the line to the target */}
      <g className={k.line}>
        <g className={`${k.vb} ${x.stretch}`}>
          <path className={x.runner} d={RUNNER} pathLength={1} strokeDasharray="1" fill="none" stroke="#b04aff" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" strokeLinejoin="round" />
          <path className={x.runner} d={RUNNER} pathLength={1} strokeDasharray="1" fill="none" stroke="#e8fdff" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </g>
      </g>

      {/* the rift over the target, its slam shut, the shatter */}
      <g className={k.atD}>
        <circle className={x.voidDisc} r="300" fill="url(#ewa-sig-rift-void)" />
        <ellipse className={x.pour} cx="0" cy="-20" rx="230" ry="390" fill="url(#ewa-sig-rift-pour)" />
        <g className={`${k.vb} ${x.rift}`}>
          {RAYS.map((r, i) => (
            <polygon key={i} className={x.ray} style={cssVars({ '--d': `${-i * 70}ms` })} points={r.points} fill={r.right ? 'url(#ewa-sig-rift-ray-r)' : 'url(#ewa-sig-rift-ray-l)'} />
          ))}
          <path d={LENS} fill="#b04aff" stroke="#b04aff" strokeWidth="26" opacity="0.8" filter="url(#ewa-sig-rift-glow)" />
          <path d={LENS} fill="#04010c" />
          <g clipPath="url(#ewa-sig-rift-clip)">
            <ellipse cx="0" cy="-30" rx="70" ry="200" fill="url(#ewa-sig-rift-nebula)" />
            {STARS.map(([sx, sy, sr], i) => (
              <circle key={i} className={x.star} style={cssVars({ '--d': `${-i * 110}ms` })} cx={sx} cy={sy} r={sr} fill={i % 3 === 0 ? '#5af0ff' : i % 3 === 1 ? '#fff' : '#d89aff'} />
            ))}
          </g>
          <path d={LENS} fill="none" stroke="#5af0ff" strokeWidth="4" strokeLinejoin="round" />
          <path d={LENS} fill="none" stroke="#f0feff" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
        <rect className={x.seam} x="-6" y="-310" width="12" height="590" rx="6" fill="#f0feff" filter="url(#ewa-sig-rift-bloom)" />
        <circle className={x.implode} r="150" fill="none" stroke="#b04aff" strokeWidth="7" />
        <circle className={x.burst} r="120" fill="none" stroke="#5af0ff" strokeWidth="6" />
        <circle className={`${x.burst} ${x.burst2}`} r="100" fill="none" stroke="#f0feff" strokeWidth="2.5" />
        <g className={x.shatter}>
          <path d={CRACKS_D} fill="none" stroke="#b04aff" strokeWidth="10" opacity="0.7" filter="url(#ewa-sig-rift-glow)" strokeLinejoin="round" />
          <path d={CRACKS_D} fill="none" stroke="#5af0ff" strokeWidth="4" strokeLinejoin="round" />
          <path d={CRACKS_D} fill="none" stroke="#f0feff" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
        {SHARDS.map((s, i) => (
          <polygon key={i} className={x.shard} style={cssVars({ '--tx': `${s.tx}px`, '--ty': `${s.ty}px`, '--r': `${s.r}deg` })} points={s.points} fill="url(#ewa-sig-rift-glass)" stroke="#5af0ff" strokeWidth="2.5" strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  );
}

/** a small deterministic generator: the layout is the same on every render */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Crack {
  readonly d: string;
  readonly pts: readonly (readonly [number, number])[];
}

const xy = (p: readonly [number, number]): string => `${Math.round(p[0])} ${Math.round(p[1])}`;

/** one crack from radius r0 to r1 at angle a, nearly straight like a fracture in glass, with a branch off its second vertex */
function crack(rand: () => number, a: number, r0: number, r1: number, segs: number): Crack {
  let cur = a;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const r = r0 + ((r1 - r0) * i) / segs;
    pts.push([Math.cos(cur) * r, Math.sin(cur) * r]);
    cur += (rand() - 0.5) * 0.3;
  }
  const bp = pts[2] ?? pts[0]!;
  const ba = Math.atan2(bp[1], bp[0]);
  const off = (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.3);
  const step = (r1 - r0) / segs;
  const b1: [number, number] = [bp[0] + Math.cos(ba + off) * step * 1.1, bp[1] + Math.sin(ba + off) * step * 1.1];
  const b2: [number, number] = [b1[0] + Math.cos(ba + off * 0.6) * step * 0.9, b1[1] + Math.sin(ba + off * 0.6) * step * 0.9];
  return { d: `M ${pts.map(xy).join(' L ')} M ${xy(bp)} L ${xy(b1)} L ${xy(b2)}`, pts };
}

/** the concentric strands of a glass web: vertex `ring` of each crack joined to the next one's, sagging inward, some missing */
function web(rand: () => number, cracks: readonly Crack[], ring: number): string {
  const parts: string[] = [];
  cracks.forEach((c, i) => {
    const n = cracks[(i + 1) % cracks.length]!;
    const p = c.pts[ring];
    const q = n.pts[ring];
    if (p === undefined || q === undefined || rand() < 0.25) return;
    const sag = 0.82 + rand() * 0.1;
    const m: [number, number] = [((p[0] + q[0]) / 2) * sag, ((p[1] + q[1]) / 2) * sag];
    parts.push(`M ${xy(p)} L ${xy(m)} L ${xy(q)}`);
  });
  return parts.join(' ');
}

/** nine cracks round the attacker (local units: its sprite is 500 tall) and two strands of web between them */
const CRACKS_A_RAW: readonly Crack[] = (() => {
  const rand = rng(11);
  return Array.from({ length: 9 }, (_, i) => crack(rand, (i / 9) * Math.PI * 2 + 0.2 + (rand() - 0.5) * 0.3, 150, 400 + rand() * 90, 5));
})();
const CRACKS_A: readonly string[] = (() => {
  const rand = rng(23);
  return [...CRACKS_A_RAW.map((c) => c.d), web(rand, CRACKS_A_RAW, 1), web(rand, CRACKS_A_RAW, 3)];
})();
/** each crack's stagger (ms); the web strands draw last */
const CRACK_DELAY: readonly number[] = [0, 70, 25, 110, 45, 140, 90, 20, 120, 150, 210];

/** the shatter web on the target at the impact (sprite 300 tall), one path */
const CRACKS_D: string = (() => {
  const rand = rng(29);
  const cs = Array.from({ length: 8 }, (_, i) => crack(rand, (i / 8) * Math.PI * 2 + 0.3, 25, 220 + rand() * 60, 4));
  return [...cs.map((c) => c.d), web(rand, cs, 1), web(rand, cs, 2), web(rand, cs, 3)].join(' ');
})();

/** the crack along the line, x 100 → 1000 (stretched to the target's distance) */
const RUNNER: string = (() => {
  const rand = rng(5);
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const px = 100 + (900 * i) / 16;
    const py = i === 16 ? 0 : Math.round((rand() - 0.5) * 46);
    pts.push(`${Math.round(px)} ${py}`);
  }
  return `M ${pts.join(' L ')}`;
})();

/** the rift: a jagged vertical lens, y −300 → 260, at most ~80 wide each side */
const LENS_TOP = -300;
const LENS_BOT = 260;
const halfWidth = (t: number): number => 78 * Math.pow(Math.sin(Math.PI * t), 0.85);
const LENS: string = (() => {
  const rand = rng(3);
  const n = 14;
  const right: string[] = [];
  const left: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = Math.round(LENS_TOP + (LENS_BOT - LENS_TOP) * t);
    const w = halfWidth(t);
    const jr = i === 0 || i === n ? 0 : (i % 2 === 0 ? 1 : -1) * (4 + rand() * 12) * Math.min(1, w / 30);
    const jl = i === 0 || i === n ? 0 : (i % 2 === 0 ? -1 : 1) * (4 + rand() * 12) * Math.min(1, w / 30);
    right.push(`${Math.round(w + jr)} ${y}`);
    left.unshift(`${Math.round(-(w + jl))} ${y}`);
  }
  return `M ${right.join(' L ')} L ${left.slice(1, -1).join(' L ')} Z`;
})();

/** light pouring from the rift's edges: tapered wedges, alternating sides */
const RAYS: readonly { readonly points: string; readonly right: boolean }[] = [
  [-200, 150, 6], [-110, 240, 8], [-20, 310, 9], [70, 230, 7], [160, 160, 6],
  [-160, 200, 7], [-60, 270, 8], [30, 290, 8], [120, 210, 7],
].map(([y, len, h], i) => {
  const right = i < 5;
  const t = (y! - LENS_TOP) / (LENS_BOT - LENS_TOP);
  const x0 = Math.round(halfWidth(t) * 0.7) * (right ? 1 : -1);
  const x1 = x0 + (right ? len! : -len!);
  return { points: `${x0},${y! - h!} ${x1},${y} ${x0},${y! + h!}`, right };
});

/** stars inside the rift (clipped to the lens) */
const STARS: readonly (readonly [number, number, number])[] = (() => {
  const rand = rng(17);
  return Array.from({ length: 16 }, () => [Math.round((rand() - 0.5) * 120), Math.round(LENS_TOP + 30 + rand() * (LENS_BOT - LENS_TOP - 60)), 1.5 + rand() * 3] as const);
})();

/** glass shards the space round the target breaks into: points round their own centre, drift, spin */
const SHARDS: readonly { readonly points: string; readonly tx: number; readonly ty: number; readonly r: number }[] = (() => {
  const rand = rng(41);
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const dist = 70 + rand() * 190;
    const cx = Math.cos(a) * dist;
    const cy = Math.sin(a) * dist * 0.9;
    const size = 22 + rand() * 34;
    const sides = rand() < 0.5 ? 3 : 4;
    const rot = rand() * Math.PI;
    const pts = Array.from({ length: sides }, (_, j) => {
      const pa = rot + (j / sides) * Math.PI * 2 + (rand() - 0.5) * 0.7;
      const pr = size * (0.6 + rand() * 0.5);
      return `${Math.round(cx + Math.cos(pa) * pr)},${Math.round(cy + Math.sin(pa) * pr)}`;
    }).join(' ');
    const push = 60 + rand() * 90;
    return { points: pts, tx: Math.round(Math.cos(a) * push), ty: Math.round(Math.sin(a) * push), r: Math.round((rand() - 0.5) * 240) };
  });
})();
