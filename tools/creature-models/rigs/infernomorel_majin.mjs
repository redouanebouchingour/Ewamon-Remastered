// Infernomorel Majin's rig: Infernomorel's skeleton and clips with the Majin form's darker blaze, plus the black smoke
// curling off the top of the fire (the `smoke` joint), drifting in every clip. Numbers are scad/infernomorel_majin.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { isAny } from './lib/geo.mjs';
import { CAP, baseClips, fidgets, fire, joints as baseJoints, parts } from './infernomorel.mjs';

const FLAMES = [[0.62, 0.07, 0.04], [0.92, 0.28, 0.06], [1, 0.58, 0.15]];
const SMOKE = [0.16, 0.1, 0.1];

const joints = [...baseJoints, { name: 'smoke', parent: 'flame', at: [0, 5, 46] }];

function assign(c, rgb) {
  if (c[2] > 42 && isAny(rgb, [SMOKE], 0.035)) return 'smoke';
  if (isAny(rgb, FLAMES) && CAP.local(c)[2] > 2) return 'flame';
  return pick(c, parts);
}

const clips = {
  ...baseClips(),
  ...fidgets,

  // fidget: a sullen glare down, then it belches a great gout of smoke off the blaze
  idle_smoulder: {
    seconds: 2.6,
    pose: (t, u) => {
      const glare = K(u, [[0, 0], [0.15, 1], [0.45, 1], [0.55, 0]]);
      const puff = win(u, 0.5, 0.9, 0.1);
      return {
        body: { r: [4 * glare - 4 * puff, 0, 0] },
        head: { r: [12 * glare - 10 * puff, 0, -10 * glare] },
        cap: { r: [-4 * puff, 0, 0] },
        ...fire(u, 1 + 5 * puff, [4, 9, 13]),
        smoke: { r: [-14 * puff, 0, 10 * puff], s: 1 + 0.35 * puff },
      };
    },
  },
};
// the smoke drifts in every clip: whole cycles per clip so the loops close
for (const [name, c] of Object.entries(clips)) {
  const pose = c.pose;
  const n = Math.max(1, Math.round(c.seconds / 2));
  clips[name] = { ...c, pose: (t, u) => merge(pose(t, u), { smoke: { r: [4 * osc(u, n, 0.1), 3 * osc(u, n, 0.4), 6 * osc(u, n)] } }, name === 'lunge' ? { smoke: { r: [12 * Math.sin(TAU * Math.min(u, 0.5)), 0, 0] } } : null) };
}

export default rigDef({ joints, assign, clips });
