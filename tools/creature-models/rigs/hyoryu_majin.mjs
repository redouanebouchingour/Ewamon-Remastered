// Hyoryu Majin's rig: Hyoryu's body (hyoryu.mjs) in its corrupted colours; the crimson icicles under the wings ride
// the wings. Numbers are scad/hyoryu_majin.scad's.
import { hyoryuRig } from './hyoryu.mjs';

export default hyoryuRig({
  body: [0.22, 0.5, 0.65],
  wing: [[0.3, 0.45, 0.85], [0.85, 0.15, 0.22], [0.6, 0.08, 0.18]],
  mane: [[0.72, 0.68, 0.95], [0.55, 0.48, 0.85]],
  horn: [0.5, 0.1, 0.25],
  shard: [0.85, 0.15, 0.28],
});
