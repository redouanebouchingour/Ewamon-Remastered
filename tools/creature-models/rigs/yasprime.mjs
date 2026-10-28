// Yasprime's rig: Yaschamp's (its body() scaled [1.08, 1.08, 1]) plus the champion's cape: one shell drawn as a cone
// from the shoulders to the hem, so it is one joint (cape1) that trails and sways. The red headband, the arm bands,
// the gold belt and chain and the boots follow their parts. Numbers are scad/yasprime.scad's.
import { rigDef } from './lib/anim.mjs';
import { isAny } from './lib/geo.mjs';
import { clipsFor, H, yas } from './yaschamp.mjs';

const CAPE = [0.72, 0.1, 0.08];
const CAPE_DK = [0.48, 0.05, 0.05];
const GOLD = [0.88, 0.66, 0.2];
const GOLD_DK = [0.6, 0.42, 0.1];
const SX = 1.08;

const Y = yas({ sx: SX });
const joints = [...Y.joints, { name: 'cape1', parent: 'body', at: [0, 2.5 * SX, 30] }];

// the cone shell (r 18 at z 4 to r 10.5 at z 30 about [0, 2.5], back half only), in body() numbers
function onCape(c) {
  const x = c[0] / SX; const y = c[1] / SX;
  if (c[2] > 30.5 || y < -0.5) return false;
  const r = Math.hypot(x, y - 2.5);
  const rc = 18 - ((Math.max(4, c[2]) - 4) * 7.5) / 26;
  return Math.abs(r - rc) < 1.6 || (c[2] < 8 && r > 15.5);
}

function pre(c, rgb, S) {
  const capey = isAny(rgb, [CAPE, CAPE_DK, GOLD, GOLD_DK]);
  if (capey && c[2] > 33) return H.local(c)[1] > 3.6 ? 'band' : 'head';
  if (capey && onCape(c)) return 'cape1';
  if (isAny(rgb, [CAPE, GOLD]) && c[2] > 21 && c[2] < 27.5 && Math.abs(c[0]) > 11) return `arm${S}`;
  if (isAny(rgb, [CAPE, GOLD, GOLD_DK]) && c[2] < 7) return `leg${S}`;
  if (isAny(rgb, [GOLD]) && c[2] > 15 && c[2] < 18.5 && Math.abs(c[0]) > 9) return `hand${S}`;
  if (capey) return 'body';
  return null;
}

const clips = clipsFor({ face: Y.face, cape: ['cape1'] });

export default rigDef({ joints, assign: (c, rgb) => Y.assign(c, rgb, pre), extras: Y.face.extras, clips });
