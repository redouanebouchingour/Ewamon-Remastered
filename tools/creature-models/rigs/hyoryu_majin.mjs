// Hyoryu Majin's rig: Hyoryu's body (hyoryu.mjs) in its corrupted colours. The crimson icicles under the wings share
// the feathers' crimson and ride the wings; the red spines and chest crystals go with the body link they sit on; the
// open jaw, fangs and red mouth are inside the head blob's reach. Numbers are scad/hyoryu_majin.scad's.
import { hyoryuRig } from './hyoryu.mjs';

export default hyoryuRig({
  body: [0.22, 0.43, 0.6],
  wing: [[0.17, 0.28, 0.48], [0.45, 0.57, 0.73], [0.62, 0.11, 0.24], [0.8, 0.24, 0.37], [0.22, 0.07, 0.22]],
  mane: [[0.78, 0.76, 0.95], [0.5, 0.42, 0.72]],
  head: [[0.46, 0.31, 0.51], [0.36, 0.07, 0.22], [0.06, 0.05, 0.21], [0.73, 0.84, 0.92], [1, 0.18, 0.12],
    [0.55, 0.05, 0.12], [0.5, 0.06, 0.15], [0.9, 0.92, 0.98]],
});
