/**
 * SPEC §50.6.1 — the six audit shots as data (no imports: the Node runners read it without loading three or content).
 * Anchor resolution lives in `anchors.ts`.
 *
 * Headings are RIG indices (amended 2026-10-06, M3 independent review R-all-2 / M3-all-11): heading k is
 * `CameraRig.setHeading(k)`, §10.7.1's yaw −35° + 90°·k with the camera at target + (sin yaw, cos yaw)·d, so it looks
 * toward (−sin yaw, −cos yaw): 0 ≈ −z, 1 ≈ −x, 2 ≈ +z, 3 ≈ +x. The pre-amendment harness read the digits as words
 * ("0 = +z forward") and drove rig `(h + 2) & 3`; every committed M3 shot up to `c16d772` records
 * `"convention": "words"`. The rows below keep those frames (sprite-edge 3, lamps-night 1, link-east 3) except
 * `spawn-noon`, which is now the in-game arrival view (rig 0: the client keeps its default heading on arrival, and
 * content `arrivalPoint` stands on the plaza's south side facing its centre), and `gym-dusk`, which takes the rig that
 * looks most directly at the gym door (`anchors.ts` `rigFacing`; rig 0 at Mirevale, as before).
 */
export type ShotId = 'spawn-noon' | 'gym-dusk' | 'sprite-edge' | 'lamps-night' | 'battle' | 'link-east';
export type Heading = 0 | 1 | 2 | 3;
export type Variant = 'full' | 'reduced' | 'mask';
export const VARIANTS: readonly Variant[] = ['full', 'reduced', 'mask'];

export interface ShotDef {
  readonly n: number;
  readonly id: ShotId;
  readonly zone: string;
  /** §50.6.1 heading as a rig index (`CameraRig.setHeading`); `null` = the battle camera. */
  readonly heading: Heading | null;
  /** `faceSubject`: the anchor turns the rig toward its subject (the gym door; a fallback's set-piece or edge); `heading` is the table's value for the slice. */
  readonly headingRule: 'fixed' | 'faceSubject' | 'battle';
  readonly timeOfDay: number;
  /** rig zoom stop (1 = the default distance, 0 = one step in = 26 / 20 = 1.3× magnification) */
  readonly zoomStop: 0 | 1 | 2;
  readonly state: string;
}

/** §50.6.1 table, verbatim numbers (headings: rig indices). */
export const AUDIT_SHOTS: readonly ShotDef[] = [
  { n: 1, id: 'spawn-noon', zone: 'mirevale', heading: 0, headingRule: 'fixed', timeOfDay: 0.5, zoomStop: 1, state: 'overworld, player idle' },
  { n: 2, id: 'gym-dusk', zone: 'mirevale', heading: 0, headingRule: 'faceSubject', timeOfDay: 0.8, zoomStop: 1, state: 'overworld, gym beacon lit' },
  { n: 3, id: 'sprite-edge', zone: 'mire_route', heading: 3, headingRule: 'fixed', timeOfDay: 0.5, zoomStop: 0, state: 'wild creature in frame at 1.3x magnification (camera zoomed one step in)' },
  { n: 4, id: 'lamps-night', zone: 'mirevale', heading: 1, headingRule: 'fixed', timeOfDay: 0.05, zoomStop: 1, state: 'overworld, night light set, >= 3 lamps in frame' },
  { n: 5, id: 'battle', zone: 'mire_route', heading: null, headingRule: 'battle', timeOfDay: 0.5, zoomStop: 1, state: 'turn 2 of a scripted wild battle, HUD live, a damage cue mid-flight' },
  { n: 6, id: 'link-east', zone: 'mirevale', heading: 3, headingRule: 'fixed', timeOfDay: 0.5, zoomStop: 1, state: 'overworld; the neighbouring zone streaming in must be visible' },
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

/** The sidecar's `anchor.heading.convention` (always 'rig' since the 2026-10-06 amendment; 'words' marks older files). */
export type HeadingConvention = 'rig';
export const HEADING_CONVENTION: HeadingConvention = 'rig';

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

