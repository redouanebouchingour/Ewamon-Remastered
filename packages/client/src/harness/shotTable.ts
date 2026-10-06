/**
 * SPEC §50.6.1 — the six audit shots as data (no imports: the Node runners read it without loading three or content).
 * Anchor resolution lives in `anchors.ts`; the heading convention is explained there.
 */
export type ShotId = 'spawn-noon' | 'gym-dusk' | 'sprite-edge' | 'lamps-night' | 'battle' | 'link-east';
export type Heading = 0 | 1 | 2 | 3;
export type Variant = 'full' | 'reduced' | 'mask';
export const VARIANTS: readonly Variant[] = ['full', 'reduced', 'mask'];

export interface ShotDef {
  readonly n: number;
  readonly id: ShotId;
  readonly zone: string;
  /** §50.6.1 heading (words: 0 = +z forward …); `null` = the battle camera. */
  readonly heading: Heading | null;
  readonly timeOfDay: number;
  /** rig zoom stop (1 = the default distance, 0 = one step in = 26 / 20 = 1.3× magnification) */
  readonly zoomStop: 0 | 1 | 2;
  readonly state: string;
}

/** §50.6.1 table, verbatim numbers. */
export const AUDIT_SHOTS: readonly ShotDef[] = [
  { n: 1, id: 'spawn-noon', zone: 'mirevale', heading: 0, timeOfDay: 0.5, zoomStop: 1, state: 'overworld, player idle' },
  { n: 2, id: 'gym-dusk', zone: 'mirevale', heading: 2, timeOfDay: 0.8, zoomStop: 1, state: 'overworld, gym beacon lit' },
  { n: 3, id: 'sprite-edge', zone: 'mire_route', heading: 1, timeOfDay: 0.5, zoomStop: 0, state: 'wild creature in frame at 1.3x magnification (camera zoomed one step in)' },
  { n: 4, id: 'lamps-night', zone: 'mirevale', heading: 3, timeOfDay: 0.05, zoomStop: 1, state: 'overworld, night light set, >= 3 lamps in frame' },
  { n: 5, id: 'battle', zone: 'mire_route', heading: null, timeOfDay: 0.5, zoomStop: 1, state: 'turn 2 of a scripted wild battle, HUD live, a damage cue mid-flight' },
  { n: 6, id: 'link-east', zone: 'mirevale', heading: 1, timeOfDay: 0.5, zoomStop: 1, state: 'overworld; the neighbouring zone streaming in must be visible' },
];

export function shotDef(id: ShotId): ShotDef {
  const s = AUDIT_SHOTS.find((x) => x.id === id);
  if (s === undefined) throw new RangeError(`unknown audit shot ${id}`);
  return s;
}

/**
 * The shots of `zone` in audit set `set`. M2 (and any set named in `TABLE_SETS`) uses the §50.6.1 table as written:
 * only the rows whose zone is `zone`. M3 onward (§50.5 M3: "6 shots each, 126 files") takes all six rows for every
 * zone; `anchors.ts` resolves each row's rule in that zone, with a recorded fallback where the zone lacks the table's
 * subject (no gym, no shop, no encounter table, no east link).
 */
export const TABLE_SETS: readonly string[] = ['M2'];
export function shotsForZone(zone: string, set = 'M2'): readonly ShotDef[] {
  if (TABLE_SETS.includes(set)) return AUDIT_SHOTS.filter((s) => s.zone === zone);
  return AUDIT_SHOTS.map((s) => ({ ...s, zone }));
}

/**
 * How a §50.6.1 heading becomes a rig heading: 'words' (default) follows the table's words (0 = +z forward, the camera
 * LOOKS that way) = rig `(h + 2) & 3`; 'rig' passes the number straight to `CameraRig.setHeading` (§10.7.1's yaw
 * −35° + 90°·h). The two differ by 180° — see anchors.ts.
 */
export type HeadingConvention = 'words' | 'rig';
let convention: HeadingConvention = 'words';
export function setHeadingConvention(c: HeadingConvention): void {
  convention = c;
}
export function headingConvention(): HeadingConvention {
  return convention;
}

/** §50.6.1 heading → rig heading index under the current convention. */
export function rigHeading(specHeading: Heading): Heading {
  return (convention === 'rig' ? specHeading : (specHeading + 2) & 3) as Heading;
}

/** Position rounding used in file names and sidecars (cm). */
export function round2(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}

/** `x_z` for a file name: centimetre precision, trailing zeros dropped. */
export function coordTag(x: number, z: number): string {
  return `${round2(x)}_${round2(z)}`;
}

export function shotFileStem(id: ShotId, x: number, z: number): string {
  return `${id}-${coordTag(x, z)}`;
}

