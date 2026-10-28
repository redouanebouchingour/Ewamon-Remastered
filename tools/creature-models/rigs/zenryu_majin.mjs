// Zenryu Majin's rig: Zenryu's body with both fists clenched low, a towering golden mane (the low back locks sway as
// mane1) and cyan sparks that flicker instead of the wind rings. Numbers are scad/zenryu_majin.scad's.
import { rigDef } from './lib/anim.mjs';
import { clipsFor, zen } from './zenryu.mjs';

const Z = zen({ majin: true });
// the low right fist swings up into a straight punch
const clips = clipsFor({ face: Z.face, majin: true, punch: { arm: [-80, 0, 12], fore: [-15, 0, 0] } });

export default rigDef({ joints: Z.joints, assign: Z.assign, extras: Z.face.extras, clips });
