// Malice's rig: a plum ghost with a curling wisp on its head, stubby arms, a glowing core and painted glowing eyes and
// grin (decals: scaled a little, never shrunk far, or the head shows its hole). Numbers are scad/malice.scad's.
import { rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, near, side } from './lib/geo.mjs';

const HAND = [0.45, 0.3, 0.5];
const GLOW = [1, 0.92, 0.6];
const CORE = [1, 0.95, 0.75];

const TAIL = [[0, 0, 15], [-0.5, 0.5, 10], [1, 1, 6], [3, 1.5, 3], [4.5, 1, 1.2], [6, 0.5, 1.4], [6.4, 0, 2.6]];
const TAIL_R = [6.5, 5, 3.4, 2.2, 1.4, 0.8, 0.5];
const WISP = [[1, 1, 39], [2.5, 1.5, 43], [5, 2, 44.5], [7.5, 2, 43.5], [9.5, 2, 45], [11, 1.5, 47.5], [13, 1, 48.5]];
const WISP_R = [4, 2.6, 1.8, 1.4, 1.1, 0.8, 0.4];
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);
const wisp = WISP.slice(0, -1).map((_, i) => `wisp${i + 1}`);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 15] },
  { name: 'core', parent: 'body', at: [0, -6.5, 17.5] },
  { name: 'head', parent: 'body', at: [0, 0, 24] },
  { name: 'eyes', parent: 'head', at: [0, -8, 34] },
  { name: 'mouth', parent: 'head', at: [0, -8.6, 29.2] },
  { name: 'armL', parent: 'body', at: [5.5, 0, 21] },
  { name: 'handL', parent: 'armL', at: [10, -0.5, 20] },
  { name: 'armR', parent: 'body', at: [-5.5, 0, 21] },
  { name: 'handR', parent: 'armR', at: [-10, -0.5, 20] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: WISP[i] })),
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, GLOW)) return c[2] > 31.5 ? 'eyes' : 'mouth';
  if (near(rgb, CORE)) return 'core';
  if (near(rgb, HAND)) return `hand${S}`;
  const t = chainHit(c, TAIL, TAIL_R);
  const w = chainHit(c, WISP, WISP_R);
  return closest([
    ['head', Math.min(ellD(c, [10, 9, 9.5], [0, 0, 32]), ellD(c, [6, 4, 5], [-2, -4.5, 36.5]))],
    ['body', Math.min(blobD(c, [[[7.2, 6, 7], [0, 0, 18]], [[5.5, 5, 4], [0, 0, 23]]]), ellD(c, [5.2, 2, 5.2], [0, -4.8, 17.5]))],
    [`arm${S}`, capD(fold(c), [5.5, 0, 21], [10, -0.5, 20], 2.4, 1.8)],
    [tail[t.i], t.d],
    [wisp[w.i], w.d],
  ]);
}

const clips = floaterClips({ tail, wisp, bob: 1 });

export default rigDef({ joints, assign, clips });
