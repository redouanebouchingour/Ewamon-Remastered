// Ignispectre: a skeletal ghost in a ragged blue flame robe. A big bone skull with blue fire burning in its eye
// sockets, wreathed in a halo of blue flame; an open ribcage glowing orange inside with a hot yellow heart; long bony
// arms with big hooked claws (the near one raised and reaching, the far one hanging low); a mantle of tatters on the
// shoulders; a robe that flows down into curling blue flame and smoke; blue and orange flames floating round it.
//
// Checklist (front sheet, x = sheet x, z):
// - skull: cranium x -6.2..-0.5, z 30.5..36.1, jaw down to 28.7, face nearly towards the viewer (yaw +18).
//   Sockets at (-2.5, 32.6) near and (-5.1, 32.6) far, ~1.1 wide x 1.5 tall, dark rim, blue fire with a pale core,
//   a blue flame licking up the brow from the near socket. Nose hole (-3.8, 31.3). Upper teeth z 30.3..31, a dark gap,
//   lower jaw with teeth z 28.7..29.9: an open grin.
// - flame halo: blue tongues x -8.2..6.9, z 29..40 round the back and top of the skull, pale cyan inner tongues.
// - ribcage: x -5.5..3.1, z 21.4..28.3, bone bands over an orange glow, a yellow hot core at (-1.6, 23.5).
// - pelvis: x -4..2.7, z 18.1..21.2 (brown shaded bone).
// - mantle: a cowl round the neck and shoulders, open at the chest; lapels down both sides of the ribs to z 19;
//   tatters hanging over the far upper arm; long tatters streaming from the near shoulder to (13.6, 22.8).
// - near arm (+X): shoulder hidden, elbow (6.8, 25.2), wrist (10.8, 28.4), a big raised claw x 10.5..16.3,
//   z 25..31.7: fingers reaching up and right then hooking down.
// - far arm (-X): elbow (-9, 23.8), wrist (-14.2, 20.8), claws hanging x -19..-13, z 16.1..21.2; blue flames rising
//   off the forearm.
// - robe: from the waist (z 20.5) flaring to x -11.4..11.4 at the bottom, long tatters streaming right at z 10..15,
//   the hem breaking into curling pale blue flame. Smoke puffs at both sides of the base, embers in them.
// - floating: blue wisp (-12.3, 30.6..35.4), orange flame (10.8, 31.8..35.5), blue-orange flame (-10.5, 15..19.5),
//   small orange flame (4.9, 19.5..22.5), bone shards round it.
// - back: the hood behind the skull with the skull top and flames above, the mantle down the back to z ~22, the spine
//   and pelvis showing under it, the robe.
include <lib.scad>

bone = [0.8, 0.72, 0.57];
boneLight = [0.88, 0.82, 0.68];
boneDark = [0.55, 0.45, 0.35];
socket = [0.06, 0.08, 0.13];
robe = [0.22, 0.4, 0.6];
robeDark = [0.12, 0.25, 0.42];
robeLight = [0.31, 0.55, 0.72];
fireMid = [0.16, 0.33, 0.56, NOGLOW];
fireBlue = [0.4, 0.7, 0.88, NOGLOW];
fireCyan = [0.54, 0.88, 0.97, NOGLOW];
firePale = [0.74, 0.97, 0.98, GLOW];
ember = [0.94, 0.5, 0.18, GLOW];
emberCore = [1, 0.82, 0.38, GLOW];
smoke = [0.78, 0.74, 0.69];
smokeDark = [0.66, 0.62, 0.58];

// A low-poly ellipsoid (knobs, pelvis, the glow inside the ribs).
module lo(r, p, c, fn = 14) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
// Sheet point -> scad point at depth y.
function sh(p, y) = fromSheet(p[0], p[1], y);
function shs(pts, y) = [for (p = pts) sh(p, y)];

// A flame tongue from base b to tip t: a flattened S-curved teardrop w wide, its flat side facing away from the
// vertical axis through ax (so it reads from every side), bending `bend` units sideways. Blunt, wavy, not a spike.
module tongue(b, t, w, c, ax = [0, 0], bend = 0.5, flat = 0.55) {
  d = t - b;
  a = atan2(-(b[0] - ax[0]), b[1] - ax[1]);
  side = [cos(a), sin(a), 0];
  P = [b, b + d * 0.3 + side * bend, b + d * 0.62 - side * bend * 0.8, b + d * 0.86 + side * bend * 0.3, t];
  W = [w, w * 0.9, w * 0.66, w * 0.4, w * 0.16];
  color(c) for (i = [0 : 3]) hull() for (j = [i, i + 1])
    translate(P[j]) rotate([0, 0, a]) scale([W[j], max(0.14, W[j] * flat), W[j] * 1.05]) sphere(1, $fn = 8);
}
// A cloth tatter through pts with half-widths ws, t thick, its flat side turned by yaw (0 = facing -Y).
module rag(pts, ws, t, yaw, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() for (j = [i, i + 1])
    translate(pts[j]) rotate([0, 0, yaw]) scale([ws[j], t, max(0.3, ws[j] * 0.6)]) sphere(1, $fn = 8);
}
// A floating teardrop flame: body radius r at p, tip h above.
module drop(p, r, h, c, core = undef) {
  color(c) hull() { translate(p) scale([r, r * 0.8, r]) sphere(1, $fn = 14); translate(p + [r * 0.25, 0, h]) sphere(r * 0.18, $fn = 6); }
  if (core != undef) color(core) translate(p + [0, -r * 0.45, -r * 0.1]) scale([r * 0.55, r * 0.45, r * 0.6]) sphere(1, $fn = 10);
}

// ---------------------------------------------------------------- robe
// A bell from the waist to the ground, cut to the art's ragged front outline (traced, smoke left out), so the hem
// frays into the art's tatters and flame curls; lighter folds painted down it, long tatters streaming right.
SK = [[-4, 20.6], [3.1, 20.3], [3.4, 17.7], [3.5, 19.6], [5, 17.4], [3.5, 16.4], [5.1, 13.8], [7.6, 14.8], [10.5, 13.8],
      [6.9, 12.6], [9.5, 12.8], [11.2, 11.6], [11.2, 10], [9.6, 11.6], [4.7, 10.9], [8.3, 9.9], [9.2, 7.7], [6.7, 9],
      [5.4, 8], [2.8, 9], [1.8, 8], [2.5, 6.7], [5.7, 7.7], [5, 6.7], [7.3, 5.8], [6.4, 7.7], [8, 6.4], [8.9, 7.3],
      [9.6, 4.5], [10.5, 5.1], [10.2, 4.2], [11.4, 3.7], [10.5, 1.9], [1.2, 1.2], [4.1, 3.4], [-0.1, 4.5], [-1.1, 6.4],
      [-4.4, 3.2], [-3.4, 3.8], [-2.4, 2.2], [-8.1, 2.8], [-7.3, 1.9], [-9.2, 1.9], [-11.4, 4.1], [-8.8, 2.7],
      [-10.1, 5.7], [-8.2, 8.3], [-7.9, 4.5], [-5.9, 6.7], [-3.4, 6.1], [-5.6, 10.9], [-6.9, 6.7], [-6.6, 8.6],
      [-7.9, 10], [-4, 20.5]];
RL = [[8.4, 0.6], [8.8, 2.4], [8.0, 4.5], [6.8, 8.5], [5.6, 12.5], [4.6, 16.5], [4.0, 19], [3.6, 20.8]];
module robeBell(g = 0) { translate([0.6, 0.4, 0]) scale([1, 0.8, 1]) lathe([for (p = RL) [p[0] + g, p[1]]], robe, 24); }
module skPrism() { pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) offset(r = 0.4) polygon(SK); }
color(robe) intersection() { robeBell(); skPrism(); }
// Lighter folds and dark gaps painted down the front.
for (f = [[[-0.6, 19.6], [-2.4, 13.4], [-4.6, 8.0], [-7.6, 3.6]], [[1.4, 18.6], [2.0, 13.2], [3.6, 9.4], [7.2, 6.8]],
          [[-2.6, 18.8], [-4.4, 13.6], [-6.4, 9.2]], [[0.4, 13.2], [0.2, 8.2], [-1.2, 5.4]]])
  color(robeLight) intersection() {
    robeBell(0.18);
    skPrism();
    prism([for (i = [0 : len(f) - 1]) f[i] + [-0.5 + 0.12 * i, 0], for (i = [len(f) - 1 : -1 : 0]) f[i] + [0.5 - 0.12 * i, 0]]);
  }
// Long tatters streaming right off the robe at the front.
module strip(pts, y, ws, c, t = 0.7) { rag(shs(pts, y), ws, t, 30, c); }
strip([[3.4, 17.6], [5.6, 14.6], [8.0, 13.8], [10.2, 13.4]], -4.4, [1.4, 1.5, 1.2, 0.7], robeLight);
strip([[3.6, 13.6], [6.4, 11.6], [9.0, 11.0], [10.8, 10.8]], -5.4, [1.4, 1.5, 1.2, 0.7], robe);
strip([[4.4, 9.6], [6.6, 8.2], [8.6, 7.2]], -6.0, [1.2, 1.2, 0.7], robeDark);
// Back tatters hanging close round the bell, frayed at the hem.
for (i = [0 : 5]) {
  a = 115 + i * 26;
  top = [0.6 + 4.0 * sin(a), 0.4 - 3.3 * cos(a), 18.5];
  mid = [0.6 + 6.0 * sin(a - 5), 0.4 - 4.9 * cos(a - 5), 9.5];
  bot = [0.6 + 8.3 * sin(a + 6), 0.4 - 6.7 * cos(a + 6), 1.6 + (i % 3) * 1.1];
  rag([top, mid, bot], [1.3, 1.6, 0.6], 0.5, a, i % 2 == 0 ? robeDark : robeLight);
}

// Hem: pale blue flames curling out along the ground.
tongue([-5.5, -4, 1.2], [-11.6, -3.6, 4.6], 1.6, fireBlue, [0, 0], 1.0);
tongue([-3, -5.2, 1.0], [-6.5, -5.4, 5.0], 1.1, fireCyan, [0, 0], -0.6);
tongue([4.5, -5.0, 1.0], [12.6, -3.6, 6.6], 1.6, fireBlue, [0, 0], -1.0);
tongue([3.6, -5.8, 0.9], [8.4, -5.8, 3.0], 1.1, firePale, [0, 0], 0.5);
tongue([-5, 4.4, 1.0], [-9, 6.2, 4.8], 1.3, fireBlue, [0, 0], 0.6);
tongue([5.2, 4.2, 1.0], [9.2, 5.8, 4.4], 1.3, fireCyan, [0, 0], -0.6);

// Smoke curling off both sides of the base, a few round puffs over it, embers glowing in it.
tongue([-8.4, -2.4, 1.6], [-15.0, -1.2, 4.4], 2.0, smoke, [0, 0], 0.9, 0.85);
tongue([9.2, -1.6, 1.6], [15.4, -0.4, 5.2], 1.9, smoke, [0, 0], -0.9, 0.85);
for (p = [[[-11.6, -2.6, 2.6], 1.5], [[-12.2, -2.0, 5.2], 1.1], [[-9.8, -2.6, 6.4], 0.8], [[-14.6, -0.8, 5.4], 0.7],
          [[12.8, -1.4, 2.8], 1.4], [[13.4, -1.4, 5.4], 1.0], [[11.2, -2.0, 6.8], 0.75], [[-11.4, 2.4, 2.2], 1.3], [[12.4, 2.6, 2.2], 1.3]])
  color(p[0][2] > 4 ? smoke : smokeDark) translate(p[0]) sphere(p[1], $fn = 12);
color(ember) translate([-9.6, -3.8, 1.2]) scale([0.9, 0.6, 0.5]) sphere(1, $fn = 10);
color(ember) translate([11.0, -3.2, 1.2]) scale([0.9, 0.6, 0.5]) sphere(1, $fn = 10);

// ---------------------------------------------------------------- skeleton
// Spine and pelvis.
limb([-0.3, 0.6, 19.4], [-0.5, 0.2, 28.4], 0.8, 0.8, bone);
lo([3.4, 2.3, 1.5], [-0.3, -0.8, 20.2], boneDark, 18);
mirror_x() lo([1.7, 1.2, 1.3], [2.0, -1.2, 20.7], bone);
lo([0.9, 0.6, 0.7], [-0.3, -2.9, 19.9], boneDark);

// Ribcage: an orange glow inside bone bands, a yellow-hot heart low at the front.
C = [-0.4, -1.6, 24.9];
lo([3.8, 2.7, 3.1], C, ember, 18);
color(emberCore) translate([0.1, -3.9, 23.4]) scale([1.4, 1.0, 1.9]) sphere(1, $fn = 16);
RW = [4.2, 4.5, 4.8, 4.9, 4.8, 4.4];
for (k = [0 : 5]) {
  z = 22.2 + k * 1.1;
  color(bone) translate([C[0], C[1], z]) rotate([12, 0, 0]) scale([RW[k], RW[k] * 0.7, 0.52]) difference() {
    sphere(1, $fn = 14);
    scale([0.85, 0.85, 2.2]) sphere(1, $fn = 14);
    translate([0, -1, 0]) cube([0.28, 0.6, 4], center = true);
  }
}
limb([-0.4, -4.8, 27.9], [-0.3, -4.9, 25.2], 0.5, 0.42, bone);   // sternum
// Collarbones and shoulder balls (mostly under the mantle).
limb([-4.8, 0.3, 27.4], [4.8, 0.3, 27.4], 0.6, 0.6, bone);
mirror_x() lo([1.05, 1.05, 1.05], [4.8, 0.3, 27.4], bone);
// Neck vertebrae up to the skull.
limb([-0.5, -1.2, 28.2], [-1.1, -3.2, 30.6], 0.65, 0.55, boneDark);

// ---------------------------------------------------------------- skull
S = [-1.2, -4.5, 33.4];
SY = 18;
module skull() { translate(S) rotate([0, 0, SY]) children(); }
skull() {
  color(bone) difference() {
    union() {
      translate([0, 0.3, 0.2]) scale([2.9, 3.2, 2.9]) sphere(1, $fn = 30);     // cranium
      translate([0, -1.4, -1.95]) scale([2.2, 1.7, 1.25]) sphere(1, $fn = 22);  // upper face
      for (s = [-1, 1]) translate([s * 1.85, -1.7, -1.4]) scale([0.9, 1.0, 0.75]) sphere(1, $fn = 12);   // cheekbones
    }
    color(socket) for (s = [-1, 1]) translate([s * 1.35, -2.6, -0.75]) scale([0.85, 0.9, 0.95]) sphere(1, $fn = 16);
    color(socket) translate([0, -3.0, -2.0]) scale([0.42, 0.6, 0.48]) sphere(1, $fn = 10);   // nose hole
  }
  color(socket) translate([0, -1.9, -3.3]) scale([1.75, 1.0, 0.5]) sphere(1, $fn = 14);    // the mouth's dark gap
  for (x = [-1.25 : 0.5 : 1.25]) color(boneLight) translate([x, -2.62 + 0.13 * x * x, -2.95]) scale([0.23, 0.26, 0.4]) sphere(1, $fn = 8);
  // lower jaw, open in a grin, with its teeth and the rami up to the cranium
  color(bone) translate([0, -1.5, -4.05]) scale([1.85, 1.5, 0.72]) sphere(1, $fn = 18);
  for (x = [-1.0 : 0.5 : 1.0]) color(boneLight) translate([x, -2.62 + 0.15 * x * x, -3.5]) scale([0.22, 0.24, 0.32]) sphere(1, $fn = 8);
  for (s = [-1, 1]) limb([s * 1.7, -0.8, -3.9], [s * 2.15, -0.1, -2.2], 0.45, 0.4, bone);
  // the burning eyes: blue fire in each socket with a pale white-hot core, a flame licking up the brow
  for (s = [-1, 1]) {
    color(fireBlue) translate([s * 1.35, -2.05, -0.8]) scale([0.62, 0.42, 0.78]) sphere(1, $fn = 14);
    color(firePale) translate([s * 1.35, -2.32, -0.85]) scale([0.38, 0.28, 0.48]) sphere(1, $fn = 12);
  }
  tongue([1.45, -2.45, 0.1], [1.15, -1.9, 2.0], 0.5, fireBlue, [1.4, 0.2], 0.15, 0.4);
  tongue([-1.6, -2.4, 0.1], [-2.3, -1.6, 1.7], 0.45, fireBlue, [-1.2, 0.2], -0.15, 0.4);
}

// ---------------------------------------------------------------- flame halo round the skull
// A mass of blue fire behind and round the skull, cut to the art's flame outline (traced), with paler tongues painted
// on it and two tongues licking up at the back for the side views.
HF = [[-1.1, 39.7], [0.5, 39.7], [-0.5, 38.8], [0.6, 37.1], [1.5, 37.5], [1.5, 38.3], [2.1, 36.8], [1.5, 35.8], [3.1, 36.4],
      [2.8, 35.2], [0.9, 33.2], [2, 32.8], [3.5, 33.9], [3.5, 34.8], [4.1, 33.6], [3.4, 32.9], [5, 33.3], [4.7, 35.1],
      [6.3, 35.8], [5.4, 34.8], [6, 32.9], [5, 31.9], [6.9, 31.9], [5.7, 30.6], [6, 30], [5.4, 29.5], [-8.5, 29.7],
      [-8.2, 31.3], [-7.5, 30.3], [-6.9, 31.5], [-7.5, 31.9], [-6.9, 33.5], [-7.2, 32.6], [-5.9, 31.3], [-6.2, 35.8],
      [-5.6, 36.4], [-5, 36.1], [-3.4, 37.8], [-4, 38.1], [-3.4, 39.3], [-2.7, 39.3], [-3.3, 38], [-1.5, 37.8],
      [-1.7, 39], [-1.1, 39.6]];
module haloVol(g = 0) {
  hull() {
    translate([-0.6, -0.4, 31.4]) scale([8.6 + g, 3.4 + g, 2.4 + g]) sphere(1, $fn = 22);
    translate([-0.8, -0.9, 35.0]) scale([5.8 + g, 3.0 + g, 2.6 + g]) sphere(1, $fn = 18);
    translate([-1.0, -1.2, 38.2]) scale([3.2 + g, 2.4 + g, 1.8 + g]) sphere(1, $fn = 14);
  }
}
module hfPrism(o = 0.3) { pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) offset(r = o) polygon(HF); }
// a dark rim round every tongue (the art's navy edge), the lighter fire inside it
color(fireMid) intersection() { haloVol(); hfPrism(); }
color(fireBlue) intersection() { haloVol(0.18); hfPrism(-0.45); }
for (t = [[[-4.4, 35.6], [-3.6, 37.6], [-2.9, 38.9], [-2.4, 37.4], [-1.6, 38.3], [-1.0, 36.6], [-0.4, 35.6]],
          [[-0.6, 31.6], [0.1, 34.4], [0.5, 37.2], [1.3, 35.4], [2.0, 33.2], [1.2, 31.0]],
          [[-6.6, 30.6], [-6.8, 33.4], [-6.0, 35.6], [-5.2, 33.6], [-5.4, 31.0]],
          [[3.2, 30.0], [4.4, 32.6], [5.4, 33.8], [5.2, 31.6], [4.6, 30.0]]])
  color(fireCyan) intersection() { haloVol(0.34); hfPrism(-0.45); prism(t); }
tongue([0.8, 1.6, 33.0], [1.6, 4.0, 37.6], 1.9, fireBlue, [-0.4, -1.4], 0.5);
tongue([-1.8, 1.4, 33.2], [-2.8, 3.8, 37.8], 1.8, fireBlue, [-0.4, -1.4], -0.5);

// ---------------------------------------------------------------- mantle
// Cowl round the neck and shoulders, rising behind the skull as a hood; open at the chest.
color(robe) hull() {
  translate([-0.2, 1.6, 27.8]) scale([6.2, 2.9, 2.2]) sphere(1, $fn = 22);
  translate([-0.8, 1.6, 31.2]) scale([3.6, 2.6, 3.2]) sphere(1, $fn = 18);
}
// Lapels framing the ribcage at both sides.
rag([[-3.6, -2.0, 29.4], [-6.0, -1.4, 26.4], [-6.5, -1.0, 23.0], [-6.6, -0.6, 19.4]], [1.4, 1.7, 1.4, 0.6], 0.55, -45, robe);
rag([[1.6, -2.2, 29.4], [4.5, -1.6, 26.6], [5.1, -1.2, 23.6], [5.1, -0.8, 21.4]], [1.3, 1.5, 1.1, 0.5], 0.55, 45, robeLight);
// Round the back and over the shoulders, hanging in tatters.
for (i = [0 : 7]) {
  a = 80 + i * 28.5;
  top = [-0.2 + 5.6 * sin(a), 1.6 - 2.9 * cos(a), 28.0];
  bot = [-0.2 + 6.2 * sin(a + 5), 1.6 - 3.6 * cos(a + 5), 20.5 + (i % 3) * 1.6];
  mid = (top + bot) / 2 + [0.5 * cos(a), 0.5 * sin(a), 0];
  rag([top, mid, bot], [2.1, 1.9, 0.6], 0.5, a, i % 3 == 1 ? robeLight : (i % 3 == 2 ? robeDark : robe));
}
// A broad drape over the far shoulder and upper arm, hanging in tatters round the elbow.
rag([[-5.4, 0.6, 28.4], [-7.0, 0.2, 25.0], [-7.8, -0.2, 21.6], [-8.2, -0.2, 18.8]], [2.0, 2.0, 1.4, 0.55], 0.6, -60, robe);
rag([[-5.8, 0.2, 28.0], [-8.6, -0.4, 25.8], [-10.2, -0.8, 23.8], [-11.0, -0.8, 22.0]], [1.8, 1.7, 1.2, 0.5], 0.6, -45, robeLight);
rag([[-4.6, 1.6, 28.4], [-7.4, 1.6, 26.0], [-9.4, 1.0, 22.6], [-9.6, 0.8, 20.6]], [1.8, 1.8, 1.2, 0.5], 0.6, -75, robeDark);
// Long broad tatters streaming right from the near shoulder, under the raised arm.
rag([[5.6, 0.0, 27.4], [9.0, -1.0, 25.2], [12.2, -1.5, 24.2], [16.2, -1.5, 23.0]], [1.8, 1.7, 1.2, 0.5], 0.7, 30, robe);
rag([[5.4, 0.5, 26.2], [8.6, 0.0, 23.8], [11.6, -0.5, 21.8], [14.2, -0.5, 20.8]], [1.8, 1.6, 1.1, 0.5], 0.7, 30, robeDark);
rag([[5.0, -0.5, 25.8], [7.0, -1.0, 23.5], [8.6, -1.0, 21.6]], [1.6, 1.3, 0.5], 0.6, 30, robeLight);

// ---------------------------------------------------------------- arms
// A bony arm: upper arm, elbow knob, a forearm of two bones, wrist; fingers as chains ending in hooked claws.
module arm(p, e, w, fingers) {
  limb(p, e, 1.1, 0.9, bone);
  lo([1.15, 1.15, 1.15], e, boneDark);
  o = [0, 0, 0.42];
  limb(e + o, w + o, 0.62, 0.52, bone);
  limb(e - o, w - o, 0.6, 0.5, bone);
  lo([0.95, 0.85, 0.9], w, boneDark);
  for (f = fingers) chain(f, [for (i = [0 : len(f) - 1]) 0.6 - 0.36 * i / (len(f) - 1)], bone);
}
// Near arm (+X): raised, the claw reaching up and hooking down.
WR = sh([10.8, 28.4], -4.5);
arm([4.8, 0.3, 27.4], sh([6.8, 25.2], -2), WR, [
  concat([WR], shs([[11.0, 27.4], [10.6, 26.2], [10.9, 25.3]], -5.2)),                                   // thumb
  concat([WR], shs([[11.7, 29.2], [12.5, 30.8], [13.6, 31.6], [14.5, 31.2], [14.8, 30.2]], -5.4)),   // index
  concat([WR], shs([[12.3, 29.0], [13.7, 29.8], [15.3, 29.9], [15.9, 29.0], [15.9, 27.8]], -5.4)),   // middle
  concat([WR], shs([[12.4, 28.1], [13.8, 28.0], [14.7, 27.0], [14.7, 25.3]], -5.0)),                 // ring
]);
lo([1.2, 0.7, 1.0], sh([12.0, 28.6], -5.2), bone);   // palm
// Far arm (-X): hanging low, the claw drooping.
WL = sh([-14.2, 20.8], -2.5);
arm([-4.8, 0.3, 27.4], sh([-9.0, 23.8], -1), WL, [
  concat([WL], shs([[-15.5, 21.2], [-17.0, 21.1], [-18.4, 20.6], [-18.9, 19.0], [-18.8, 18.0]], -3)),
  concat([WL], shs([[-15.6, 20.6], [-16.8, 19.8], [-17.5, 18.4], [-17.2, 16.3]], -3.3)),
  concat([WL], shs([[-15.0, 20.3], [-15.6, 18.6], [-15.4, 16.3]], -3.4)),
  concat([WL], shs([[-13.8, 20.4], [-13.2, 19.0], [-13.4, 17.5]], -3.0)),                            // thumb
]);
lo([1.1, 0.7, 0.9], sh([-15.2, 20.6], -2.8), bone);
// Blue flames rising off the far forearm.
tongue(sh([-12.6, 22.2], -2.0), sh([-14.0, 25.6], -2.0), 0.9, fireBlue, [-12, 2], 0.3);
tongue(sh([-10.4, 23.0], -1.4), sh([-10.6, 25.4], -1.4), 0.7, fireCyan, [-10, 2], -0.2);

// ---------------------------------------------------------------- floating flames and bone shards
drop(sh([-12.3, 31.6], -2), 1.0, 3.8, fireBlue, firePale);
drop(sh([10.8, 32.6], 0), 0.75, 2.9, ember, emberCore);
drop(sh([-10.5, 16.4], -2), 1.25, 3.2, fireMid, ember);
drop(sh([4.9, 20.2], -4), 0.55, 2.2, ember, emberCore);
limb(sh([8.2, 37.0], 0), sh([9.3, 35.6], 0), 0.38, 0.32, bone);
limb(sh([-15.4, 27.2], -1), sh([-14.6, 28.0], -1), 0.36, 0.3, bone);
limb(sh([7.0, 18.4], 0), sh([7.9, 17.4], 0), 0.34, 0.3, bone);
color(ember) translate(sh([-8.4, 36.8], -2)) sphere(0.3, $fn = 8);
