// Raidori Tenjin's rig: Raidori's body and joints (rigs/raidori.mjs), porcelain and gold. The flowing mane and the
// halo ride on the head, the gold back spikes and the neck locks on the body, the floating sparkles on the body.
// Numbers are scad/raidori_tenjin.scad's (the pre-sprite-pass model).
import { rigDef } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, ellD, isAny, near } from './lib/geo.mjs';
import { TAIL, clips as base, joints as baseJoints, parts, tail } from './raidori.mjs';

const BODY = [0.8, 0.8, 0.82];
const MANE = [[0.98, 0.84, 0.35], [0.88, 0.66, 0.15]];
const PAW = [0.98, 0.88, 0.5];
const STAR = [1, 0.88, 0.45];
const HALO = [0.95, 0.75, 0.3];
const TAIL_R = [1.5, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8];

const eyeL = { side: 'L', at: [2.6, -19.2, 28.6], size: 1.2, yaw: -20 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

const joints = [...baseJoints.filter((j) => !/^(lid|happy|dizzy|squeeze)/.test(j.name)), ...face.joints];

function assign(c, rgb) {
  if (near(rgb, STAR, 0.03) && !near(rgb, PAW, 0.03)) return ellD(c, [5, 5, 5], [13.5, 18, 17.5]) < 1 ? 'tail4' : 'body';
  if (near(rgb, HALO, 0.03)) return 'head';
  if (near(rgb, PAW, 0.03)) return pick(c, parts.slice(0, 2));
  if (isAny(rgb, MANE, 0.03)) return c[1] > -6.5 ? 'body' : 'head';
  const t = chainHit(c, TAIL, TAIL_R);
  if (t.d < 1.15 && c[1] > 12.5) return tail[[0, 1, 1, 2, 2, 3][t.i]];
  return pick(c, parts);
}

// the base clips carry Raidori's face; this one's eyes sit elsewhere, so the lids come from its own kit by name
export default rigDef({ joints, assign, extras: face.extras, clips: base });
