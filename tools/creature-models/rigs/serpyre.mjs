// Serpyre's rig: a sea serpent rearing up out of its coil, a frost ruff, a snouted head with a separate lower jaw,
// small clawed arms and a finned tail tip. Numbers are scad/serpyre.scad's; the head is the scad's
// translate([-1.5, -1.5, 26]) rotate([0, 0, -10]) scale(1.35) block (H).
import { rigDef } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const GREENS = [[0.18, 0.5, 0.36], [0.1, 0.34, 0.25], [0.3, 0.64, 0.45]];
const BELLY = [[0.82, 0.86, 0.6], [0.66, 0.72, 0.45]];
const HEAD_ONLY = [[0.16, 0.28, 0.6], [0.28, 0.42, 0.78], [0.92, 0.6, 0.18]];   // mane, mane highlight, horn
const RUFF = [[0.9, 0.95, 1], [0.62, 0.75, 0.86]];
const CLAW = [0.9, 0.95, 0.97];

const H = subFrame([-1.5, -1.5, 26], [0, 0, -10], 1.35);
const COIL = [];
for (let a = -100; a <= 230; a += 30) COIL.push([7.5 * Math.cos((a * Math.PI) / 180) + 1.5, 6 * Math.sin((a * Math.PI) / 180) + 2.5, 3.2 + 0.01 * (a + 100)]);
const COIL_R = COIL.map((_, i) => 3.8 - i * 0.12);
const TAIL = [COIL[COIL.length - 1], [10, 6, 6], [11.5, 7, 11], [11.8, 7, 16]];
const TAIL_R = [2.4, 1.8, 1.3, 0.9];
const BODY = [[-2, -3, 4], [-3, -3.5, 10], [-2.5, -2.5, 15], [-1, -1, 20]];
const BODY_R = [4.6, 4, 3.3, 2.8];
const ARM = [[2.5, -4.5, 16], [5.5, -6.5, 15], [7, -7.5, 17]];
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2', 'tail3'];

const eyeL = { side: 'L', at: [2.1, -3.7, 0.9], size: 1.5, yaw: 26, squash: 0.6, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREENS[0] });

const joints = [
  { name: 'root', at: [1.5, 2.5, 0] },
  { name: 'spine1', parent: 'root', at: BODY[1] },
  { name: 'spine2', parent: 'spine1', at: BODY[2] },
  { name: 'neck', parent: 'spine2', at: BODY[3] },
  { name: 'head', parent: 'neck', at: H.world([0, 1, -2.4]), rot: [0, 0, -10] },
  { name: 'jaw', parent: 'head', at: H.world([0, 0.8, -1.9]), rot: [0, 0, -10] },
  { name: 'armL', parent: 'spine2', at: ARM[0] },
  { name: 'foreL', parent: 'armL', at: ARM[1] },
  { name: 'armR', parent: 'spine2', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'foreR', parent: 'armR', at: [-ARM[1][0], ARM[1][1], ARM[1][2]] },
  { name: 'tail1', parent: 'root', at: TAIL[1] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[3] },
  ...face.joints,
];

function assign(c, rgb) {
  const S = side(c);
  const h = H.local(c);
  const headD = blobD(h, [[[3.8, 4.2, 3.6], [0, 0.5, 0]], [[2.6, 3, 2.2], [0, -4.2, -1]]]);
  const jawD = blobD(h, [[[2.6, 3, 1.2], [0, -1, -2.6]], [[1.8, 2.2, 0.9], [0, -4.2, -2.6]]]);
  if (isAny(rgb, HEAD_ONLY)) return 'head';
  if (isAny(rgb, RUFF)) return 'neck';
  if (near(rgb, CLAW)) return h[2] > -4.5 && headD < 1.8 ? 'head' : `fore${S}`;   // the fangs ride the upper jaw
  if (!isAny(rgb, [...GREENS, ...BELLY])) return 'head';                         // eyes and their sockets
  if (isAny(rgb, BELLY) && jawD < 1.15) return 'jaw';
  const coil = Math.min(chainHit(c, COIL, COIL_R).d, ellD(c, [4, 4, 3.6], COIL[COIL.length - 1]));
  const tl = chainHit(c, TAIL, TAIL_R);
  const bd = chainHit(c, BODY, BODY_R);
  const fin = Math.min(ellD(c, [0.9, 0.5, 3], [11.9, 7, 18.5]), ellD(c, [1.2, 1.2, 2.6], [11.9, 7, 17]));
  // the belly plates run up the front of the body: by height
  const bellyAt = c[2] < 10 ? 'root' : c[2] < 15 ? 'spine1' : 'spine2';
  return closest([
    ['root', coil],
    [tl.i === 0 ? 'root' : `tail${tl.i}`, tl.d],
    ['tail3', fin],
    [bd.i === 0 ? 'root' : spine[bd.i - 1], bd.d],
    [bellyAt, isAny(rgb, BELLY) ? blobD(c, [[[3.4, 2, 4], [-2.8, -6, 6.5]], [[2.4, 1.8, 3.5], [-2.2, -4.4, 15]]]) * 0.97 : 9],
    ['head', headD],
    ['jaw', jawD],
    [`arm${S}`, chainHit(fold(c), ARM.slice(0, 2), [1.2, 1]).d],
    [`fore${S}`, chainHit(fold(c), ARM.slice(1), [1, 0.9]).d],
  ]);
}

const clips = serpentClips({ face, spine, tail });

export default rigDef({ joints, assign, extras: face.extras, clips });
