/**
 * Full-bleed key art for Landing / Auth / Boot (§20.9.1): a painted `public/keyart/` JPEG (gpt-image, 2026-10-28)
 * over an SVG of Mirevale at night (layered hills, the veins of the grove, mist and fireflies). The SVG is coloured
 * only through tokens and costs no request, so it shows at once and stays if the JPEG fails; the JPEG fades in
 * over it once loaded. Star and firefly positions come from a fixed LCG: identical on every load, no Math.random.
 */
import { useId, useState } from 'react';
import s from './KeyArt.module.css';
import { cx } from './cx';

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const rand = lcg(0x5f7e44);
const STARS = Array.from({ length: 90 }, () => ({ x: rand() * 1600, y: rand() * 420, r: 0.6 + rand() * 1.4, o: 0.25 + rand() * 0.6 }));
const FLIES = Array.from({ length: 22 }, (_, i) => ({ x: 120 + rand() * 1360, y: 560 + rand() * 260, r: 1.4 + rand() * 2, d: i % 4 }));

/** `mirevale`: the three starters on a ridge above the valley (subject right). `campfire`: a trainer and Bramblecub by a fire (subject centre). */
export type KeyArtScene = 'mirevale' | 'campfire';

export interface KeyArtProps {
  readonly className?: string;
  /** dim the scene further behind dense UI */
  readonly dim?: boolean;
  readonly scene?: KeyArtScene;
}

export function KeyArt({ className, dim = false, scene = 'mirevale' }: KeyArtProps) {
  // unique per instance: Boot + backdrop can both be mounted, and url(#id) must not cross-reference
  const uid = `ka${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ref = (name: string): string => `url(#${uid}-${name})`;
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div className={cx(s.root, dim && s.dim, className)} aria-hidden data-testid="keyart">
      <svg className={s.svg} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={s.skyTop} />
            <stop offset="0.55" className={s.skyMid} />
            <stop offset="1" className={s.skyLow} />
          </linearGradient>
          <radialGradient id={`${uid}-moon`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" className={s.moonCore} />
            <stop offset="0.35" className={s.moonHalo} />
            <stop offset="1" className={s.moonFade} />
          </radialGradient>
          <linearGradient id={`${uid}-vein`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className={s.veinFade} />
            <stop offset="0.5" className={s.veinCore} />
            <stop offset="1" className={s.veinFade} />
          </linearGradient>
          <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <mask id={`${uid}-crescent`}>
            <rect width="1600" height="900" fill="white" />
            <circle cx="1202" cy="196" r="44" fill="black" />
          </mask>
        </defs>

        <rect width="1600" height="900" fill={ref('sky')} />
        <g className={s.stars}>
          {STARS.map((st, i) => (
            <circle key={i} cx={st.x} cy={st.y} r={st.r} opacity={st.o} />
          ))}
        </g>
        <circle cx="1180" cy="210" r="260" fill={ref('moon')} />
        <circle cx="1180" cy="210" r="46" className={s.moonShadow} />
        <circle cx="1180" cy="210" r="46" className={s.moon} mask={ref('crescent')} />

        <path className={s.hillFar} d="M0 560 C 180 470 320 500 470 455 C 640 405 760 470 900 440 C 1080 400 1210 455 1360 420 C 1470 395 1540 420 1600 410 L1600 900 L0 900 Z" />
        <ellipse cx="800" cy="560" rx="900" ry="70" className={s.mist} filter={ref('soft')} />
        <path className={s.hillMid} d="M0 640 C 140 590 300 610 430 575 C 600 530 700 600 860 585 C 1010 570 1100 520 1260 540 C 1400 558 1500 600 1600 580 L1600 900 L0 900 Z" />
        <path className={s.vein} stroke={ref('vein')} d="M140 700 C 360 650 520 690 700 655 S 1040 610 1220 640 S 1480 690 1600 660" filter={ref('blur')} />
        <path className={s.veinLine} stroke={ref('vein')} d="M140 700 C 360 650 520 690 700 655 S 1040 610 1220 640 S 1480 690 1600 660" />
        <path className={s.hillNear} d="M0 730 C 200 690 330 720 520 700 C 720 678 860 730 1040 715 C 1220 700 1380 660 1600 690 L1600 900 L0 900 Z" />
        <path className={s.veinSmall} d="M380 820 C 520 790 640 810 760 780 S 980 760 1120 790" />
        <path
          className={s.trees}
          d="M60 735 l18 -70 l18 70 z M96 732 l14 -52 l14 52 z M1400 700 l20 -84 l20 84 z M1444 705 l15 -60 l15 60 z M1488 700 l12 -44 l12 44 z M250 715 l12 -40 l12 40 z"
        />
        <ellipse cx="800" cy="860" rx="1000" ry="90" className={s.mistLow} filter={ref('soft')} />
        <g className={s.flies}>
          {FLIES.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r={f.r} className={s[`fly${f.d}`]} />
          ))}
        </g>
      </svg>
      <img
        key={scene}
        className={cx(s.photo, s[scene], loaded === scene && s.shown)}
        src={`/keyart/${scene}.jpg`}
        alt=""
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(scene)}
      />
      <div className={s.vignette} />
    </div>
  );
}
