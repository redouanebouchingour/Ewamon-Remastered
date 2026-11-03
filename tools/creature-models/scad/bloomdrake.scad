// Bloomdrake: Budwing grown up. A caterpillar-dragon drawn side-on: an upright front (four stacked chest segments
// with glowing square-spiral runes, brown bark plates down the back of the neck), a broad scowling dragon head with
// orange slanted eyes, a bark crown and big branching antlers, a long segmented body curling back and to its left
// on four pairs of stubby legs with red claws, two big feathered leaf wings spread up in a V (green, the feathers'
// tips and lower edges red), and an orange flower on the tail end.
//
// Checklist (front sheet; the art sits on a sand patch, its near claws on sheet z 1.8 = scad z 0, --ground 1.8):
//   head      sheet x -12..0, z 18.5..29: wide skull, short muzzle (nostrils x -9.9 / -7.6, z 21.9), mouth line z 20.5
//   eyes      two, orange, slanted almond with a slit pupil, angry lids; near x -5.5..-2.8 z 23.4..25.2, far a sliver
//   crown     brown bark plate over the brow (x -9..-4, z 25..29), plates on down the back of the neck (back view)
//   antlers   brown, base x -3.3 / -10, z 28; the near one spreads to x 8.5, z 39.6, six tines; the far one to -16
//   frills    green spikes with red tips at the sides of the head (x 0.6, z 27 / 25)
//   chest     upright, x -10..-2.5, z 7..20, four segments, three columns of glowing runes on each
//   body      pods from x -1 to 16.5 (z 7.8..13.5), each a green ring with brown scales: a big brown flank scale with
//             a glowing ring, small scales on top with glowing dashes
//   legs      four pairs, short and thick, red three-toed claws; near ones at x -8 (front right), 0.5, 5, 9.3
//   wings     near: root ~(1, 16.5), seven feathers fanning to tips (21.3, 36.3) (21.8, 32.2) (19.3, 25.6) ...
//             far: tips (-21.3, 35.3) (-22, 32) (-20.5, 26) ...; red tips and lower edges
//   flower    centre (17.4, 16.6), radius 5: eight orange petals, a darker inner ring, a brown seed disc; also seen
//             face-on from the back, so it faces sideways and has a face on both sides
//   back      the column of brown plates up the neck, the pods' brown scales with glowing spots, the flower at left
// The art is side-on: the chest faces -Y, the body curls back and towards +X (the creature's left) so it reads at its
// drawn length in the three-quarter view. S(sx, sz, y) turns an art point (sheet x, sheet z, chosen depth y) into scad.
include <lib.scad>

skin = [0.45, 0.56, 0.32];
skinLt = [0.5, 0.63, 0.37];
feathG = [0.41, 0.52, 0.3];
feathG2 = [0.48, 0.6, 0.35];
red = [0.8, 0.36, 0.22, NOGLOW];
bark = [0.6, 0.42, 0.3];
barkDk = [0.47, 0.32, 0.23];
antlerC = [0.62, 0.47, 0.33];
rune = [0.62, 0.92, 0.5, NOGLOW];
ink = [0.13, 0.14, 0.08];
claw = [0.82, 0.38, 0.22, NOGLOW];
petalO = [0.95, 0.6, 0.24, NOGLOW];
petalR = [0.8, 0.34, 0.14, NOGLOW];
seedC = [0.52, 0.34, 0.15];
seedDot = [0.92, 0.74, 0.42, NOGLOW];
eyeO = [1, 0.62, 0.2, NOGLOW];
eyeI = [0.93, 0.42, 0.12, NOGLOW];

X0 = -5.2;   // the art's sheet x of scad x = 0, y = 0
G = 1.8;     // the art's foot line
function S(sx, sz, y) = let(x = (sx - X0 - 0.5 * y) / 0.866) [x, y, sz - G - 0.17 * (-0.5 * x + 0.866 * y)];
// Children authored in art sheet coordinates [x, z], extruded through the model along the view (for decals).
module artPrism() { pp(0) translate([-X0, 0, -G]) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) children(); }

// A square-spiral rune (2D, art units) centred at c.
module rune2d(c, w = 1.6, h = 2, t = 0.42) {
  translate([c[0] - w / 2, c[1] - h / 2]) {
    square([t, h]);
    square([w, t]);
    translate([w - t, 0]) square([t, h * 0.78]);
    translate([0, h - t]) square([w * 0.72, t]);
    translate([w * 0.36, h * 0.3]) square([t, h * 0.42]);
    translate([w * 0.36, h * 0.3]) square([w * 0.4, t]);
  }
}
// A glowing ring facing +X (a rune on a scale), radius r.
module ring(r, t = 0.3) {
  color(rune) rotate([0, 90, 0]) difference() {
    cylinder(h = t, r = r, center = true, $fn = 10);
    cylinder(h = t + 1, r = r * 0.55, center = true, $fn = 8);
  }
}

// ---- Chest: four upright segments in front, the neck rising into the head.
CH = [0, -2];
CHS = [[6.0, [4.3, 3.9, 2.6]], [9.4, [4.5, 4.1, 2.6]], [12.8, [4.2, 3.8, 2.5]], [16.0, [3.6, 3.3, 2.4]]];
for (s = CHS) color(skinLt) translate([CH[0], CH[1], s[0]]) scale(s[1]) sphere(1, $fn = 20);
// Glowing runes over the chest front, three columns, three rows.
color(rune) intersection() {
  union() for (s = CHS) translate([CH[0], CH[1], s[0]]) scale(s[1] + [0.15, 0.15, 0.15]) sphere(1, $fn = 20);
  artPrism() for (z = [14.6, 11.2, 7.9]) for (x = [-8.6, -6.4, -4.2]) rune2d([x, z], 1.8, 2.3, 0.5);
  translate([-20, -30, 0]) cube([40, 28, 40]);
}
// Bark plates down the back of the neck, and a brown scale with a glowing ring on each side of the upper neck.
for (s = CHS) translate([CH[0], CH[1] + s[1][1] * 0.8, s[0] + 0.3]) color(bark) scale([2.2, 1.4, 1.6]) sphere(1, $fn = 14);
mirror_x() for (k = [[12.6, 1.9], [15.8, 1.7]]) translate([CH[0] + 3.0, CH[1] + 1.2, k[0]]) rotate([0, 0, 25]) {
  color(bark) scale([1.0, k[1] * 1.05, k[1]]) sphere(1, $fn = 14);
  translate([0.85, 0, 0]) ring(k[1] * 0.6);
}

// ---- Body: pods curling back and towards +X. [x, y, z, heading (deg from +Y towards +X), [half width, half length, half height]]
PODS = [
  [1, 1.5, 6.1, 19, [4.0, 3.2, 3.4]],
  [2.25, 4.5, 5.9, 34, [3.8, 3.0, 3.3]],
  [4.73, 7, 5.7, 48, [3.7, 3.0, 3.25]],
  [7.5, 9.2, 5.5, 54, [3.6, 2.9, 3.15]],
  [10.3, 11, 5.2, 61, [3.4, 2.8, 3.0]],
  [13.2, 12.3, 4.8, 69, [3.0, 2.6, 2.7]],
  [15.9, 13.2, 4.2, 72, [2.3, 2.3, 2.2]],
];
module podFrame(p) translate([p[0], p[1], p[2]]) rotate([0, 0, -p[3]]) children();
for (i = [0 : len(PODS) - 1]) {
  p = PODS[i];
  r = p[4];
  podFrame(p) {
    color(skin) scale(r) sphere(1, $fn = 16);
    // top plate
    color(i % 2 == 0 ? bark : barkDk) translate([0, 0, r[2] * 0.66]) scale([r[0] * 0.66, r[1] * 0.82, r[2] * 0.48]) sphere(1, $fn = 10);
    mirror_x() {
      // big flank scale with a glowing ring
      color(bark) translate([r[0] * 0.78, 0, -r[2] * 0.1]) scale([1.3, r[1] * 0.68, r[2] * 0.58]) sphere(1, $fn = 10);
      translate([r[0] * 0.78 + 1.12, 0, -r[2] * 0.1]) ring(min(0.95, r[2] * 0.32));
      // small upper scale with a glowing dash
      color(i % 2 == 0 ? barkDk : bark) translate([r[0] * 0.6, 0, r[2] * 0.5]) rotate([0, 40, 0]) scale([0.8, r[1] * 0.6, 0.9]) sphere(1, $fn = 8);
      color(rune) translate([r[0] * 0.6 + 0.55, 0, r[2] * 0.5 + 0.45]) rotate([0, 40, 0]) scale([0.18, r[1] * 0.32, 0.22]) sphere(1, $fn = 6);
    }
  }
}

// ---- Legs: four pairs of short stubby nubs under the chest and the pods (the segments sit nearly on the ground). [hip x, y, heading]; the pair stands either side.
LEGS = [[0, -2.3, 0, 2.6], [2.25, 4.5, 40, 2.6], [6.1, 8.1, 48, 2.6], [10.3, 11, 62, 2.4]];
module legPair(l) {
  for (sgn = [1, -1]) {
    n = [cos(l[2]), -sin(l[2])] * sgn;     // outward
    f = [-sin(l[2]), -cos(l[2])];          // forward
    h = [l[0] + n[0] * l[3], l[1] + n[1] * l[3]];
    top = [h[0], h[1], 3.4];
    foot = [h[0] + n[0] * 0.4, h[1] + n[1] * 0.4, 1.1];
    color(skin) hull() { translate(top) sphere(2.1, $fn = 14); translate(foot) scale([1, 1, 0.75]) sphere(1.8, $fn = 12); }
    // a glowing ring on the outer side of the middle legs
    if (l[2] > 30 && l[2] < 55) translate([foot[0] + n[0] * 1.85, foot[1] + n[1] * 1.85, 2.3]) rotate([0, 0, atan2(n[1], n[0])]) ring(0.6, 0.25);
    for (d = [-0.9, 0, 0.9]) let(b = [foot[0] + f[0] * 0.9 + n[0] * d, foot[1] + f[1] * 0.9 + n[1] * d, 0.55])
      color(claw) hull() { translate(b) sphere(0.45, $fn = 6); translate(b + [f[0] * 1.2 + n[0] * d * 0.5, f[1] * 1.2 + n[1] * d * 0.5, -0.45]) sphere(0.08, $fn = 4); }
  }
}

for (l = LEGS) legPair(l);

// ---- Tail stem rising into the flower.
FC = [18.6, 13, 14.5];
chain([[15.9, 13.2, 4.1], [17.5, 13.6, 6.0], [18.0, 13.6, 9.8], [17.9, 13.4, 13.6]], [2.0, 1.5, 1.15, 0.9], skin);
// Flower: a disc facing sideways (+X and a little forward), petals and seed disc on both faces.
translate(FC) rotate([0, 0, 45]) rotate([90, 0, 0]) {
  for (i = [0 : 7]) rotate([0, 0, 90 + i * 45]) color(petalO) hull() {
    translate([2.0, 0, 0]) scale([1.5, 1.65, 0.5]) sphere(1, $fn = 8);
    translate([5.7, 0, 0]) sphere(0.3, $fn = 6);
  }
  for (i = [0 : 7]) rotate([0, 0, 112.5 + i * 45]) color(petalR) hull() {
    translate([1.7, 0, 0]) scale([1.2, 1.2, 0.66]) sphere(1, $fn = 8);
    translate([4.3, 0, 0]) sphere(0.3, $fn = 6);
  }
  color(seedC) scale([2.1, 2.1, 1.0]) sphere(1, $fn = 16);
  for (zs = [1, -1]) for (a = [0 : 72 : 359]) color(seedDot) rotate([0, 0, a]) translate([1.1, 0, zs * 0.82]) scale([0.36, 0.36, 0.2]) sphere(1, $fn = 6);
}

// ---- Head: a broad skull, heavy jowls and a short muzzle. Local frame at HC (no rotation).
HC = [0, 0.2, 21.8];
translate(HC) {
  color(skin) {
    translate([0, 0.3, 0.6]) scale([5.6, 4.8, 4.5]) sphere(1, $fn = 24);
    translate([0, -0.6, -1.6]) scale([6.0, 4.2, 3.0]) sphere(1, $fn = 20);
    translate([0, -4.0, -1.4]) scale([3.8, 3.3, 2.6]) sphere(1, $fn = 18);
  }
  // mouth line round the muzzle front
  color(ink) intersection() {
    union() {
      translate([0, -4.0, -1.4]) scale([3.95, 3.45, 2.75]) sphere(1, $fn = 18);
      translate([0, -0.6, -1.6]) scale([6.12, 4.32, 3.12]) sphere(1, $fn = 20);
    }
    translate([-6, -12, -2.75]) cube([12, 8.2, 0.38]);
  }
  mirror_x() {
    // nostril
    color(ink) translate([1.3, -6.95, -0.8]) scale([0.45, 0.3, 0.32]) sphere(1, $fn = 8);
    // eye: orange, slanted, slit pupil, an angry lid
    eye([3.4, -3.4, 1.2], 1.75, iris = eyeI, pupil = ink, sclera = eyeO, yaw = 28, flat = 0.45,
        lid = 0.34, lid_tilt = 24, lid_c = skin, slit = 0.3);
    // frills: green spikes with red tips at the sides of the head
    for (k = [[[5.0, 1.0, 2.6], [1, 0.3, 1.1]], [[5.6, 0.6, 0.2], [1, 0.4, 0.25]]]) {
      spike(k[0], k[1] * 2.0, 0.75, 0.25, skin);
      spike(k[0] + k[1] * 1.9, k[1] * 0.5, 0.3, 0.05, red);
    }
  }
  // crown: brown bark plates over the brow, on down the back of the head
  color(bark) translate([0, -2.0, 4.25]) rotate([-18, 0, 0]) scale([2.9, 2.6, 1.3]) sphere(1, $fn = 16);
  color(barkDk) translate([0, 1.0, 4.7]) scale([2.5, 2.3, 1.3]) sphere(1, $fn = 14);
  color(bark) translate([0, 3.6, 3.0]) rotate([30, 0, 0]) scale([2.3, 2.0, 1.3]) sphere(1, $fn = 14);
  color(barkDk) translate([0, 4.9, 0.3]) rotate([55, 0, 0]) scale([2.2, 1.8, 1.2]) sphere(1, $fn = 14);
}
// Glowing rune on each cheek.
color(rune) mirror_x() intersection() {
  translate(HC + [0, 0.3, 0.6]) scale([5.75, 4.95, 4.65]) sphere(1, $fn = 24);
  artPrism() rune2d([-1.5, 24.2], 1.3, 2.6, 0.4);
  translate([3, -20, 0]) cube([20, 40, 40]);
}

// ---- Antlers: branching beams spread out and swept 27 degrees back, authored in their own plane (x out, z up).
ANT = [[[0, 0], [0.8, 1.5], 0.8, 0.72], [[0.8, 1.5], [6.3, 3.0], 0.72, 0.62], [[6.3, 3.0], [8.2, 5.5], 0.62, 0.55],
       [[8.2, 5.5], [8.3, 11.3], 0.55, 0.38],
       [[0.7, 1.7], [1.0, 5.2], 0.5, 0.36], [[4.0, 2.4], [3.2, 6.7], 0.5, 0.36], [[5.2, 2.8], [4.8, 9.3], 0.52, 0.36],
       [[8.2, 7.0], [6.8, 9.3], 0.42, 0.32], [[8.6, 5.0], [11.8, 10.0], 0.5, 0.34], [[9.4, 4.4], [11.8, 6.0], 0.42, 0.32],
       [[6.5, 2.0], [10.8, 1.7], 0.5, 0.36]];
mirror_x() translate(HC + [3.1, -1.0, 3.9]) rotate([0, 0, 27]) rotate([0, -6, 0])
  for (a = ANT) limb([a[0][0], 0, a[0][1]], [a[1][0], 0, a[1][1]], a[2] * 1.3, a[3] * 1.3, antlerC);

// ---- Wings: seven leaf feathers each, fanned in the wing's plane (u out along the span, v up), swept 18 degrees back.
// [root u, v], [tip u, v], half width, bow, depth offset (towards -Y is the front)
WR = [2.2, 2.0, 14.6];
FEATH = [
  [[2.0, 0.6], [23.8, 16.6], 2.4, 0.6, 0.6],
  [[3.5, 1.2], [24.3, 12.9], 2.3, 0.6, 0.3],
  [[4.0, 0.9], [21.8, 7.4], 2.1, 0.5, 0.0],
  [[4.0, 0.8], [19.5, 5.0], 1.9, 0.4, -0.3],
  [[3.6, 0.3], [15.2, 2.6], 1.6, 0.3, -0.6],
  [[3.2, -0.3], [12.8, 0.6], 1.35, 0.2, -0.85],
  [[2.8, -0.8], [10.8, -1.6], 1.2, 0.1, -1.05],
];
function fprof(s) = pow(sin(180 * min(1, s * 1.1)), 0.65);
function fpt(f, s, k) = let(r = f[0], t = f[1], d = t - r, L = norm(d), n = [-d[1], d[0]] / L,
  c = r + d * s + n * f[3] * sin(180 * s)) c + n * f[2] * fprof(s) * (k > 0 ? 1 : 0.8) * k;
function fpoly(f) = concat([for (i = [0 : 7]) fpt(f, i / 7, 1)], [for (i = [6 : -1 : 1]) fpt(f, i / 7, -1)]);
function fred(f) = concat([for (i = [0 : 2]) fpt(f, 0.8 + i * 0.1, 1)], [for (i = [8 : -1 : 4]) fpt(f, i / 8, -1)],
  [for (i = [0 : 2]) fpt(f, 0.5 + i * 0.13, 0)]);
// the wing's inner web behind the feathers, so the fan reads as one broad wing with only the tips apart
function webPoly() = concat([[1.5, 0.2]], [for (k = [0 : len(FEATH) - 1]) fpt(FEATH[k], k == 0 ? 0.62 : 0.58, 0)], [[2.5, -1.2]]);
mirror_x() translate(WR) rotate([0, 0, 18]) translate([0, 0.8, 0]) slab(webPoly(), 1.3, feathG, inset = 0.6, grow = 0.2);
mirror_x() translate(WR) rotate([0, 0, 18]) for (k = [0 : len(FEATH) - 1]) {
  f = FEATH[k];
  translate([0, -f[4], 0]) {
    slab(fpoly(f), 1.4, k % 2 == 0 ? feathG : feathG2, inset = 0.6, grow = 0.2);
    slab(fred(f), 1.7, red, inset = 0.6, grow = 0.2);
  }
}
