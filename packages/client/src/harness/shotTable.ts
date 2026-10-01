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
  /** §50.6.1 heading = the rig's heading index (§10.7.1; amended 2026-09-30); `null` = the battle camera. */
  readonly heading: Heading | null;
  readonly timeOfDay: number;
  /** rig zoom stop (1 = the default distance, 0 = one step in = 26 / 20 = 1.3× magnification) */
  readonly zoomStop: 0 | 1 | 2;
  readonly state: string;
}

/**
 * §50.6.1 table, verbatim numbers. Headings are rig indices (amended 2026-09-30: 0 looks toward −z, 1 −x, 2 +z, 3 +x);
 * shots 2, 3, 4 and 6 keep the views they had under the old words reading (words h = rig (h + 2) & 3), shot 1 is the
 * rig's heading 0 (the player in front of the heart tree).
 */
export const AUDIT_SHOTS: readonly ShotDef[] = [
  { n: 1, id: 'spawn-noon', zone: 'mirevale', heading: 0, timeOfDay: 0.5, zoomStop: 1, state: 'overworld, player idle' },
  { n: 2, id: 'gym-dusk', zone: 'mirevale', heading: 0, timeOfDay: 0.8, zoomStop: 1, state: 'overworld, gym beacon lit' },
  { n: 3, id: 'sprite-edge', zone: 'mire_route', heading: 3, timeOfDay: 0.5, zoomStop: 0, state: 'wild creature in frame at 1.3x magnification (camera zoomed one step in)' },
  { n: 4, id: 'lamps-night', zone: 'mirevale', heading: 1, timeOfDay: 0.05, zoomStop: 1, state: 'overworld, night light set, >= 3 lamps in frame' },
  { n: 5, id: 'battle', zone: 'mire_route', heading: null, timeOfDay: 0.5, zoomStop: 1, state: 'turn 2 of a scripted wild battle, HUD live, a damage cue mid-flight' },
  { n: 6, id: 'link-east', zone: 'mirevale', heading: 3, timeOfDay: 0.5, zoomStop: 1, state: 'overworld; the neighbouring zone streaming in must be visible' },
];

export function shotDef(id: ShotId): ShotDef {
  const s = AUDIT_SHOTS.find((x) => x.id === id);
  if (s === undefined) throw new RangeError(`unknown audit shot ${id}`);
  return s;
}

/** The shots of the §50.6.1 table that belong to `zone`. */
export function shotsForZone(zone: string): readonly ShotDef[] {
  return AUDIT_SHOTS.filter((s) => s.zone === zone);
}

/**
 * How a §50.6.1 heading becomes a rig heading. 'rig' (default, §50.6.1 as amended 2026-09-30) is the identity: the
 * number goes straight to `CameraRig.setHeading` (§10.7.1's yaw −35° + 90°·h). 'words' is the superseded reading
 * (0 = +z forward, rig `(h + 2) & 3`), kept only to reproduce shots taken before the amendment (`?headings=words`).
 */
export type HeadingConvention = 'words' | 'rig';
let convention: HeadingConvention = 'rig';
export function setHeadingConvention(c: HeadingConvention): void {
  convention = c;
}
export function headingConvention(): HeadingConvention {
  return convention;
}

/** §50.6.1 heading → rig heading index under the current convention. */
export function rigHeading(specHeading: Heading): Heading {
  return (convention === 'words' ? (specHeading + 2) & 3 : specHeading) as Heading;
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

