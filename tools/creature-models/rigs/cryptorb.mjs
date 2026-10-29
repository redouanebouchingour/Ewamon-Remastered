// Cryptorb's rig: a glowing red eye in a dark vortex (the core: it pulses), a ring of slate shards orbiting it (ring)
// and red sentinel orbs and data bits drifting the other way (bits). It floats; the lowest shard is its "feet".
// Numbers are scad/cryptorb.scad's (the old model; re-rig when the sprite-matched one lands). The shards orbit in
// the X / Z plane, so the ring turns with ry.
import { K, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';

const C = [0, 0, 21];
const CORE = [0.08, 0.08, 0.1];
const RED = [[0.9, 0.08, 0.18], [1, 0.45, 0.5], [1, 1, 1]];
const EDGE = [0.45, 0.12, 0.12];
const SHARD = [[0.24, 0.23, 0.28], [0.38, 0.37, 0.43], [0.85, 0.6, 0.45]];
const BITS = [[0.75, 0.15, 0.1], [0.9, 0.45, 0.2]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: C },
  { name: 'core', parent: 'body', at: [0, -7, 21] },
  { name: 'ring', parent: 'body', at: C },
  { name: 'bits', parent: 'body', at: C },
];

function assign(c, rgb) {
  const far = ellD(c, [9.5, 9.5, 9.5], C) > 1;   // outside the vortex: sentinels, bits, shards
  if (isAny(rgb, BITS)) return 'bits';
  if ((near(rgb, CORE) || isAny(rgb, RED)) && far) return 'bits';
  if (isAny(rgb, RED)) return c[1] < 0 ? 'core' : 'body';
  if (near(rgb, EDGE) && !far) return c[1] < 0 ? 'core' : 'body';
  if (isAny(rgb, SHARD) || near(rgb, EDGE)) return 'ring';
  return 'body';
}

// the shards orbit one way, the bits drift the other, a little faster when it is excited
const orbit = (ring, bits = -ring) => ({ ring: { r: [0, ring, 0] }, bits: { r: [0, bits, 0] } });
const add = {
  idle: (t, u) => orbit(12 * osc(u, 1), -10 * osc(u, 1, 0.3)),
  walk: (t, u) => orbit(-10 + 4 * osc(u, 1), 8 * osc(u, 1)),
  idle_spin: (t, u) => orbit(K(u, [[0.1, 0], [0.85, 360]]), K(u, [[0.1, 0], [0.85, -360]])),
  idle_cackle: (t, u) => orbit(8 * osc(u, 8) * win(u, 0.08, 0.85, 0.08)),
  windup: (t, u) => orbit(-30 * smooth(u / 0.8)),
  lunge: (t, u) => orbit(-30 + 90 * K(u, [[0.1, 0], [0.45, 1]])),
  hurt: (t, u) => merge(orbit(20 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])), { ring: { s: 1 + 0.08 * K(u, [[0, 0], [0.2, 1], [1, 0]]) } }),
  faint: (t, u) => { const d = smooth((u - 0.2) / 0.6); return { ring: { r: [20 * d, 40 * d, 0], p: [0, 0, -3 * d] }, bits: { r: [-15 * d, -30 * d, 0], p: [0, 0, -4 * d] } }; },
  celebrate: (t, u) => orbit(K(u, [[0, 0], [1, 180]]), K(u, [[0, 0], [1, -180]])),
  enter: (t, u) => merge(orbit(90 * (1 - smooth(u))), { ring: { s: 0.4 + 0.6 * smooth(u / 0.7) }, bits: { s: 0.4 + 0.6 * smooth(u / 0.8) } }),
  exit: (t, u) => orbit(-120 * smooth(u)),
};

const base = floaterClips({ bob: 0.8, add });

const clips = {
  ...base,
  // fidget: a scan. The eye looks left and right in steps, the ring locks still, then a full orbit as it resets
  idle_scan: {
    seconds: 3,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.1, 18], [0.22, 18], [0.3, -18], [0.44, -18], [0.52, 0]]);
      const reset = K(u, [[0.55, 0], [0.95, 360]]);
      return merge({
        body: { r: [0, 0, look] },
        core: { s: 1 + 0.15 * win(u, 0.55, 0.95, 0.1) },
      }, orbit(reset, -reset));
    },
  },
};

export default rigDef({ joints, assign, clips });
