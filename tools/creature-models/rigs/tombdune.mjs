// Tombdune's rig: a sandstone sarcophagus that stays put on its feet (root) with its open lid creaking behind, and the
// purple ooze spirit welling out of it on the floater template: the ooze body bobs, the masked head turns, the
// dripping arms reach over the rim. Numbers are scad/tombdune.scad's; the head is its translate([0, -1, 29]) scale(1.3)
// translate([0, 1, -29]) block (HF).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';

const STONE = [[0.8, 0.66, 0.42], [0.62, 0.48, 0.3], [0.88, 0.76, 0.52], [0.95, 0.75, 0.2], [0.12, 0.08, 0.14]];
const OOZE_DK = [0.3, 0.12, 0.45];
const EYE = [1, 0.75, 0.95];
const HF = subFrame([0, 0.3, -8.7], [0, 0, 0], 1.3);
const ARM = [[5, -1, 25], [10, -2, 25], [14, -2.4, 23.4]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'lid', parent: 'root', at: [1.5, 9.5, 21] },
  { name: 'body', parent: 'root', at: [0, 0, 18] },
  { name: 'head', parent: 'body', at: [0, -0.5, 27] },
  { name: 'eyes', parent: 'head', at: HF.world([0, -5.8, 31.2]) },
  { name: 'armL', parent: 'body', at: ARM[0] },
  { name: 'handL', parent: 'armL', at: ARM[1] },
  { name: 'armR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'handR', parent: 'armR', at: [-ARM[1][0], ARM[1][1], ARM[1][2]] },
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  const h = HF.local(c);
  if (near(rgb, EYE)) return 'eyes';
  if (isAny(rgb, STONE)) {
    if (c[2] > 27 && Math.abs(c[0]) < 7 && c[1] < 0) return 'head';   // the gold mask and its brow jewel
    return c[1] > 6.5 && c[2] > 18.5 ? 'lid' : 'root';
  }
  if (near(rgb, OOZE_DK)) return 'head';                             // the tendril behind the head
  const head = Math.min(ellD(h, [5.2, 4.8, 5], [0, -0.5, 30]),
    ...[-1.6, 0.4, 2].map((x) => capD(c, [x, -4.4, 28.4], [x, -4.6, 26.4 - Math.abs(x) * 0.4], 0.7, 0.5)));
  const body = blobD(c, [[[7, 6.4, 3], [0, 0, 19]], [[6, 5.6, 3.5], [0, 0.2, 22.5]], [[5, 4.8, 4], [0, 0.5, 26]]]);
  const arm = Math.min(capD(f, ARM[0], ARM[1], 2.6, 2.2), ellD(f, [1.6, 0.6, 0.8], [10, -3.4, 26]) * 1.1);
  const hand = Math.min(chainHit(f, ARM.slice(1), [2.2, 1.8]).d, ...[[-1, 0], [0.4, 0.6], [1.6, -0.6]].map(([dy, dx]) =>
    capD(f, [14, -2.4, 23], [14.8 + dx, -2.8 + dy, 19.6], 0.9, 0.6)), ellD(f, [0.6, 0.6, 0.8], [15.4, -2.4, 16.8]),
  capD(f, [9, -1.6, 23.4], [9, -1.8, 21], 0.6, 0.4) * 1.05);
  return closest([['head', head], ['body', body], [`arm${S}`, arm], [`hand${S}`, hand]]);
}

// the lid creaks on its hinge now and then
const creak = (u, amp, cycles = 1) => ({ lid: { r: [amp * osc(u, cycles, 0.3), 0, 0] } });

const base = floaterClips({
  bob: 0.7,
  add: {
    idle: (t, u) => creak(u, 1.5),
    walk: (t, u) => creak(u, 3, 2),
    hurt: (t, u) => ({ lid: { r: [-8 * K(u, [[0, 0], [0.2, 1], [1, 0.3]]), 0, 0] } }),
    faint: (t, u) => ({ lid: { r: [12 * K(u, [[0.3, 0], [0.9, 1]]), 0, 0] } }),
    celebrate: (t, u) => creak(u, 6, 2),
  },
});

const clips = {
  ...base,

  // fidget: sinks back into the coffin to peek over the rim, then oozes up again with a little wave
  idle_peek: {
    seconds: 2.8,
    pose: (t, u) => {
      const down = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.8, 0]]);
      const look = K(u, [[0.2, 0], [0.32, 18], [0.45, 18], [0.55, -18], [0.62, 0]]);
      const wave = Math.sin(Math.PI * 2 * 3 * u) * win(u, 0.78, 0.98, 0.04);
      return merge({
        body: { p: [0, 0, -3.5 * down], s: [1 + 0.06 * down, 1 + 0.06 * down, 1 - 0.12 * down] },
        head: { r: [0, 0, look] },
        armL: { r: [0, 20 * down - 40 * win(u, 0.78, 0.98, 0.06), 0] },
        armR: { r: [0, -20 * down, 0] },
        handL: { r: [0, 0, 20 * wave] },
        eyes: { s: [1, 1, 1 - 0.2 * down] },
      }, creak(u, 2));
    },
  },
};

export default rigDef({ joints, assign, clips });
