/**
 * The client's icon set: 24-unit stroke glyphs drawn with currentColor, so an icon always takes the colour of
 * the text beside it. Decorative by default (aria-hidden); pass `label` when the icon is the only content.
 */
import s from './Icon.module.css';

const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.6-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2',
  party: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16.5 11.5a3 3 0 1 0 0-6M2.5 20c.6-3.4 2.9-5.5 5.5-5.5s4.9 2.1 5.5 5.5M15 14.6c2.8-.3 5.3 1.6 6 5.4',
  box: 'M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9zM3.5 7.5L12 12l8.5-4.5M12 12v9',
  dex: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  shop: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9.5 20v-5h5v5M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 2 3s2-1.3 2-3c0 1.7 1.3 3 3 3s3-1.3 3-3',
  social: 'M4 5h16v11H9l-5 4V5zM8 9.5h8M8 12.5h5',
  guild: 'M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6L12 3zM12 8v8M8.5 11.5h7',
  market: 'M4 20V10l8-6 8 6v10M4 20h16M9 20v-6h6v6M8 10.5h.01M16 10.5h.01',
  pass: 'M5 21V4M5 4h11l-2 4 2 4H5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-2 3.4-1.8-.6a7.6 7.6 0 0 1-2.2 1.3L14.6 21h-5.2l-.4-2.4a7.6 7.6 0 0 1-2.2-1.3l-1.8.6-2-3.4 1.6-1a7.5 7.5 0 0 1 0-3l-1.6-1 2-3.4 1.8.6A7.6 7.6 0 0 1 9 5.4L9.4 3h5.2l.4 2.4c.8.3 1.5.8 2.2 1.3l1.8-.6 2 3.4-1.6 1a7.5 7.5 0 0 1 0 3z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z',
  lock: 'M6.5 11V8a5.5 5.5 0 0 1 11 0v3M5 11h14v10H5V11zM12 15v2.5',
  unlock: 'M6.5 11V8a5.5 5.5 0 0 1 10.8-1.5M5 11h14v10H5V11zM12 15v2.5',
  alpha: 'M12 3l2.2 6.3H21l-5.4 4 2 6.7L12 16l-5.6 4 2-6.7-5.4-4h6.8L12 3z',
  sparkle: 'M10 3.5l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6 1.6-5zM18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  heart: 'M12 20s-8-4.8-8-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 8 2.3C20 15.2 12 20 12 20z',
  logout: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H4',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  send: 'M4 12l16-8-6 16-2.5-6.5L4 12z',
  sword: 'M14.5 4H20v5.5L9 20.5 3.5 15 14.5 4zM6 13l5 5M4 20l2.5-2.5',
  trade: 'M4 8h13l-3-3M20 16H7l3 3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  warn: 'M12 3.5L2.5 20h19L12 3.5zM12 10v4.5M12 17.5h.01',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield: 'M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6L12 3zM9 12l2 2 4-4',
  grid: 'M4 4h6.5v6.5H4V4zM13.5 4H20v6.5h-6.5V4zM4 13.5h6.5V20H4v-6.5zM13.5 13.5H20V20h-6.5v-6.5z',
  bag: 'M5 8h14l-1 12H6L5 8zM9 8V6.5a3 3 0 0 1 6 0V8',
  orb: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h6M15 12h6M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7',
  quest: 'M7 4h11a2 2 0 0 1 2 2v1h-4M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7M9 9.5l1.5 1.5 3-3M9 15h6',
  map: 'M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2zM9 4.5v13M15 6.5v13',
  trophy: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4zM7.5 6H4.5v1.5A3 3 0 0 0 7.6 10.5M16.5 6h3v1.5a3 3 0 0 1-3.1 3M12 13.5V17M8.5 20h7M9.5 20l.5-3h4l.5 3',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6',
  play: 'M7 4.5v15L19.5 12 7 4.5z',
  pause: 'M7.5 5v14M16.5 5v14',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps {
  readonly name: IconName;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
  readonly className?: string;
}

export function Icon({ name, size = 'md', label, className }: IconProps) {
  return (
    <svg
      data-testid="icon"
      className={[s.icon, s[size], className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? undefined : 'img'}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
