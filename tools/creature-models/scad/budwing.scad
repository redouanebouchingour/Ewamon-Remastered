// Budwing: the hatchling of Bloomdrake. A caterpillar-dragon drawn side-on: a huge round dragon head with a broad
// blunt snout, slanted orange eyes and a wide mouth, short branching antlers, an upright neck of stacked green rings,
// a low body of segments armoured with brown cobblestone plates marked with glowing square spirals, four pairs of
// thick stubby legs with red claws, two small leaf wings with red tips swept up and back, and a brown stalk with an
// orange flower bud on the tail end.
//
// Checklist (front sheet; the art stands on a sand patch, its near claws on sheet z 1.5 = scad z 0, --ground 1.5):
//   head      sheet x -17.6..1.7, z 17.5..32.6: wide round skull, broad blunt snout, jaw z 17.5..20.4
//   eyes      two, orange to red, all iris with a black slit, slanted angry top edge: near x -9.1..-4.5 z 21.6..25.8,
//             far one an edge-on sliver at x -17.4..-16.3
//   mouth     a long ink line at z 20.4 across the snout, a small pale fang at (-10.9, 19.2); nostrils (-14.4 / -12.2, 21.5)
//   plates    brown bark plates on the head: forehead (-11.8, 28.4), crown (-12..-8, 30..32.5), near back (-3..0, 28..32),
//             then a double column down the back of the head and neck (x -1..1.5, z 9..27)
//   runes     glowing square spirals: two on the near temple (-1.6, 25.2) (-2.0, 22.8), on the neck plates (-0.6, 18.7)
//             (-1.2, 14.3) (0, 11.5), on the pod flanks (2.9, 10) (5.6, 9.8) (9.7, 10.1)
//   antlers   brown, short: near beam (-4.5, 31) -> (-3, 39.5) with a branch out to (1.3, 35.7) and two tines; far
//             beam (-12.5, 31.7) -> (-12, 39.9) with a tine out to (-14.6, 37)
//   neck      upright stack of five green rings, x -10.5..-1, z 5..20, ink lines between them, widest at z 10..13
//   body      plated pods from x -1 to 16, top z 15 -> 13.5, bottom z 8; green belly under them
//   legs      four pairs, thick green stumps (3.3 wide) z 2..8.5 with two or three red claws; near ones at x 1.2, 5.9, 10.3,
//             the front pair under the neck (far one at x -7)
//   wings     near: root (1, 17), five leaf feathers fanning to tips (13, 29.8) (12.8, 27.5) (12.5, 24.5) (11, 21) red;
//             far: peeks out behind the head at x 0.5..4.5, z 22..30
//   tail      brown stalk (15.5, 12.7) -> (14.8, 16.5), two small leaves (13.3, 15.8) (16.5, 15.3), orange bud (15, 17.5)
//   back      plates cover the head top, the neck back and the whole body top; mossy green flecks on them; wings
//             spread either side; the bud on its stalk at the left (creature's +X)
// The neck faces -Y, the body curls back and towards +X (Bloomdrake's curve) so it reads at its drawn length.
include <lib.scad>

skin = [0.45, 0.56, 0.32];
skinLt = [0.52, 0.65, 0.37];
ringInk = [0.24, 0.3, 0.18];
feathG = [0.42, 0.54, 0.31];
feathG2 = [0.56, 0.69, 0.4];
red = [0.8, 0.36, 0.22, NOGLOW];
bark = [0.62, 0.45, 0.32];
barkDk = [0.5, 0.35, 0.25];
moss = [0.47, 0.6, 0.32];
antlerC = [0.6, 0.45, 0.33];
rune = [0.62, 0.92, 0.5, NOGLOW];
ink = [0.13, 0.14, 0.08];
claw = [0.82, 0.36, 0.22, NOGLOW];
eyeO = [0.98, 0.56, 0.16, NOGLOW];
eyeI = [0.86, 0.26, 0.12, NOGLOW];
eyeY = [1, 0.84, 0.4, NOGLOW];
fang = [0.9, 0.9, 0.74];
stalkC = [0.45, 0.32, 0.24];
budO = [0.96, 0.52, 0.16, NOGLOW];
budR = [0.82, 0.3, 0.14, NOGLOW];
budY = [1, 0.8, 0.35, NOGLOW];
leafC = [0.5, 0.66, 0.36];

X0 = -4.5;   // the art's sheet x of scad x = 0, y = 0
G = 1.5;     // the art's foot line
// Children authored in art sheet coordinates [x, z], extruded through the model along the view (for decals). The
// prism runs down 10 degrees with depth like the camera's ray, so a decal lands where the art draws it.
module artPrism() {
  pp(0) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.176, 1, 0]]) translate([-X0, 0, -G]) rotate([90, 0, 0])
    linear_extrude(height = 120, center = true) children();
}

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
// A glowing square spiral glyph facing +X (on a plate), half size r.
module glyph(r, t = 0.2) {
  color(rune) {
    difference() {
      cube([t, 2 * r, 2 * r], center = true);
      cube([t + 1, 1.3 * r, 1.3 * r], center = true);
      translate([0, -r * 0.55, r * 0.3]) cube([t + 1, r * 0.5, r * 0.5], center = true);
    }
    cube([t, r * 0.42, r * 0.42], center = true);
  }
}
// A glowing ring with a dot facing +X (a rune on a pod's plate), radius r.
module ring(r, t = 0.2) {
  color(rune) rotate([0, 90, 0]) {
    difference() {
      cylinder(h = t, r = r, center = true, $fn = 12);
      cylinder(h = t + 1, r = r * 0.62, center = true, $fn = 10);
    }
    cylinder(h = t, r = r * 0.24, center = true, $fn = 6);
  }
}
// A bark plate: a flattened ellipsoid at p, its thin axis along the outward normal n.
module plateOn(p, r, n, c = bark, fn = 12) {
  color(c) translate(p) rotate(_dir_rot(n)) scale(r) sphere(1, $fn = fn);
}

// ---- Neck: five stacked green rings, the middle ones bulging forward, with ink lines between them.
CH = [0, -2];
CHS = [[5.6, [4.3, 4.0, 2.5], 0], [8.7, [5.1, 4.6, 2.5], -0.6], [11.8, [5.3, 4.7, 2.5], -0.8], [14.8, [4.7, 4.2, 2.4], -0.5],
       [17.6, [4.1, 3.8, 2.3], -0.5]];
for (s = CHS) color(skinLt) translate([CH[0], CH[1] + s[2], s[0]]) scale(s[1]) sphere(1, $fn = 20);
for (k = [0 : len(CHS) - 2]) let(a = CHS[k], b = CHS[k + 1], r = (a[1] + b[1]) / 2)
  color(ringInk) translate([CH[0], CH[1] + (a[2] + b[2]) / 2, (a[0] + b[0]) / 2]) scale([r[0] * 0.84, r[1] * 0.84, 0.45]) sphere(1, $fn = 20);
// a short neck under the back of the head
color(skinLt) translate([0, -3.6, 20.4]) scale([4.0, 3.7, 3.0]) sphere(1, $fn = 18);

// Bark plates down the back of the neck: a back column and two side columns per side, the outer ones on the flanks
// carrying the runes. [z, the ring's half width, half depth, its forward shift]
NP = [[18.2, 4.1, 3.8, -0.5], [15.0, 4.7, 4.2, -0.5], [12.0, 5.3, 4.7, -0.8], [9.0, 5.1, 4.6, -0.6]];
for (q = NP) {
  plateOn([0, CH[1] + q[3] + q[2] * 0.98, q[0] + 0.6], [2.0, 1.8, 1.15], [0, 1, 0.15], barkDk);
  mirror_x() {
    plateOn([q[1] * 0.62, CH[1] + q[3] + q[2] * 0.76, q[0]], [1.9, 2.0, 1.15], [0.65, 0.75, 0.1]);
    plateOn([q[1] * 0.92, CH[1] + q[3] + q[2] * 0.12, q[0] - 0.2], [1.6, 2.1, 1.15], [1, 0.09, 0.05]);
    // the rune turned half towards the front, so the sprite camera reads it as the art draws it
    translate([q[1] * 0.92 + 0.95, CH[1] + q[3] + q[2] * 0.12 + 0.09, q[0] - 0.2]) rotate([0, 0, -25]) glyph(0.95);
  }
}

// ---- Body: pods curling back and towards +X. [x, y, z, heading (deg from +Y towards +X), [half width, half length, half height]]
PODS = [
  [1, 1.5, 8.7, 19, [4.0, 3.2, 3.6]],
  [2.5, 4.5, 8.5, 34, [3.9, 3.1, 3.5]],
  [5.0, 7.0, 8.3, 48, [3.8, 3.0, 3.4]],
  [7.8, 9.2, 8.1, 54, [3.7, 3.0, 3.3]],
  [10.6, 11.0, 7.8, 61, [3.5, 2.9, 3.1]],
  [12.7, 11.9, 7.4, 69, [3.1, 2.6, 2.8]],
  [13.7, 12.3, 6.9, 72, [2.4, 2.2, 2.3]],
];
module podFrame(p) translate([p[0], p[1], p[2]]) rotate([0, 0, -p[3]]) children();
for (i = [0 : len(PODS) - 1]) {
  p = PODS[i];
  r = p[4];
  podFrame(p) {
    color(skin) scale(r) sphere(1, $fn = 16);
    // cobblestone plates: one on top, an upper and a big flank plate per side
    color(i % 2 == 0 ? bark : barkDk) translate([0, 0, r[2] * 0.62]) scale([r[0] * 0.62, r[1] * 0.86, r[2] * 0.5]) sphere(1, $fn = 12);
    if (i % 2 == 1) color(moss) translate([0.6, 0.3, r[2] * 1.08]) scale([0.5, 0.5, 0.18]) sphere(1, $fn = 6);
    mirror_x() {
      color(i % 2 == 0 ? barkDk : bark) translate([r[0] * 0.56, 0, r[2] * 0.5]) rotate([0, 42, 0]) scale([1.3, r[1] * 0.78, 1.1]) sphere(1, $fn = 10);
      color(bark) translate([r[0] * 0.74, 0, -r[2] * 0.2]) scale([1.45, r[1] * 0.8, r[2] * 0.68]) sphere(1, $fn = 12);
      if (i < 5) translate([r[0] * 0.74 + 1.42, 0, -r[2] * 0.2]) if (i % 2 == 0) ring(min(0.95, r[2] * 0.3)); else glyph(min(0.95, r[2] * 0.28));
    }
  }
}

// ---- Legs: four pairs of thick stumps. [hip x, y, heading, outward offset, top z]; the pair stands either side.
LEGS = [[0, -2.3, 0, 2.6, 4.8], [2.5, 4.5, 40, 2.6, 5.9], [6.1, 8.1, 48, 2.6, 5.7], [10.3, 11, 62, 2.4, 5.3]];
module legPair(l) {
  for (sgn = [1, -1]) {
    n = [cos(l[2]), -sin(l[2])] * sgn;     // outward
    f = [-sin(l[2]), -cos(l[2])];          // forward
    h = [l[0] + n[0] * l[3], l[1] + n[1] * l[3]];
    top = [h[0], h[1], l[4]];
    foot = [h[0] + n[0] * 0.3, h[1] + n[1] * 0.3, 1.55];
    color(skin) hull() { translate(top) sphere(2.1, $fn = 14); translate(foot) scale([1, 1, 0.8]) sphere(1.95, $fn = 14); }
    for (d = [-0.8, 0, 0.8]) let(b = [foot[0] + f[0] * 1.3 + n[0] * d, foot[1] + f[1] * 1.3 + n[1] * d, 0.5])
      color(claw) hull() { translate(b) sphere(0.45, $fn = 6); translate(b + [f[0] * 1.0 + n[0] * d * 0.4, f[1] * 1.0 + n[1] * d * 0.4, -0.4]) sphere(0.08, $fn = 4); }
  }
}
for (l = LEGS) legPair(l);

// ---- Tail: a brown stalk rising from the last pod, two small leaves, an orange flower bud.
STALK = [[13.4, 12.4, 8.8], [13.1, 12.6, 11.2], [12.6, 12.9, 13.3]];
chain(STALK, [0.75, 0.6, 0.5], stalkC);
for (s = [1, -1]) translate([12.8, 12.8, 12.8]) rotate([0, 0, 30 + (s > 0 ? 0 : 180)]) rotate([0, -22, 0])
  petal([1.6, 0.34, 0.75], [1.6, 0, 0], [0, 0, 0], leafC);
translate([12.55, 12.95, 14.9]) scale(1.25) {
  color(budR) translate([0, 0, -0.7]) scale([1.05, 1.05, 0.75]) sphere(1, $fn = 12);
  color(budO) scale([1.2, 1.2, 1.45]) sphere(1, $fn = 14);
  color(budO) translate([0, 0, 1.1]) cylinder(h = 1.1, r1 = 0.8, r2 = 0.05, $fn = 10);
  color(budY) translate([0.45, -0.75, 0.1]) scale([0.5, 0.4, 0.75]) sphere(1, $fn = 8);
  for (a = [0 : 90 : 359]) color(budR) rotate([0, 0, a + 45]) translate([0.85, 0, 0.2]) rotate([0, -12, 0]) scale([0.4, 0.55, 1.15]) sphere(1, $fn = 8);
}

// ---- Head: a big round skull swelling into a broad blunt snout (one smooth hull), and a jaw. Local frame at HC.
HC = [0, -7.8, 24.6];
CR = [[0, -0.8, 0.5], [8.6, 8.0, 6.6]];     // skull [centre, radii]
SN = [[0, -4.5, -0.6], [8.0, 5.0, 5.0]]; // snout: broad and shallow, a wide flat face
JW = [[0, -2.6, -4.3], [7.6, 5.4, 2.8]]; // jaw
module headEll(e, g = 0, fn = 30) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = fn);
translate(HC) {
  color(skinLt) {
    hull() { headEll(CR); headEll(SN, 0, 26); }
    headEll(JW, 0, 22);
  }
  // mouth line round the snout front and along the cheeks
  color(ink) intersection() {
    union() { hull() { headEll(CR, 0.12); headEll(SN, 0.12, 26); } headEll(JW, 0.12, 22); }
    translate([-9, -13, -3.9]) cube([18, 9.6, 0.42]);
  }
  mirror_x() {
    // nostril
    color(ink) translate([1.7, -9.25, -1.6]) scale([0.5, 0.32, 0.36]) sphere(1, $fn = 8);
  }
  // bark plates: forehead, crown and on down the back of the head, chunky cobbles standing proud of the skull
  plateOn([0, -5.6, 5.0], [2.2, 2.0, 1.2], [0, -0.6, 1]);
  plateOn([0, -1.2, 6.7], [2.6, 2.3, 1.3], [0, -0.1, 1], barkDk);
  plateOn([0, 3.0, 6.0], [2.4, 2.2, 1.3], [0, 0.55, 1]);
  plateOn([0, 6.0, 3.3], [2.2, 2.0, 1.3], [0, 1, 0.7], barkDk);
  plateOn([0, 7.3, -0.6], [2.0, 1.9, 1.2], [0, 1, 0.1]);
  mirror_x() {
    plateOn([5.6, 4.6, 0.4], [1.8, 1.7, 1.2], [0.8, 0.5, 0.1]);
    plateOn([6.0, 3.6, -2.4], [1.9, 1.8, 1.2], [0.75, 0.6, -0.1], barkDk);
    plateOn([5.2, 5.2, 2.6], [1.8, 1.7, 1.2], [0.65, 0.6, 0.4], barkDk);
    plateOn([3.6, 0.8, 5.8], [2.0, 1.8, 1.2], [0.45, 0.1, 1], barkDk);
    plateOn([5.0, 4.0, 3.4], [1.9, 1.8, 1.2], [0.6, 0.6, 0.6]);
    plateOn([3.8, 6.4, -0.2], [1.8, 1.7, 1.1], [0.5, 0.9, 0.1], barkDk);
    plateOn([3.0, 6.0, -3.8], [1.7, 1.6, 1.1], [0.4, 0.9, -0.2]);
  }
}
// fangs hang from the mouth line
mirror_x() color(fang) translate(HC + [2.2, -7.95, -3.7]) rotate([180, 0, 0]) cylinder(h = 1.1, r1 = 0.36, r2 = 0.05, $fn = 6);
// Eyes: painted on the face like the art's, an angry slanted almond (high at the back, low at the snout), orange
// with a red top, a yellow lower rim and a black slit, in an ink rim under a raised brow. Traced off the near eye;
// the far one is its mirror (a whole eye on the model, the art's edge-on sliver from the sprite camera).
EYE = [[-8.9, 22.6], [-8.6, 22.1], [-5.6, 22.0], [-4.8, 22.7], [-4.7, 25.6], [-6.3, 25.7]];
EYEC = [5.6, -6.6, -0.2];   // the eye's centre on the head, in the head's frame
module eyeShell(g) translate(HC) hull() { headEll(CR, g); headEll(SN, g, 26); }
module onEye(g) intersection() { eyeShell(g); artPrism() children(); translate(HC + EYEC) sphere(3.8, $fn = 12); }
mirror_x() {
  color(skinLt) onEye(0.45) polygon([[-9.7, 23.0], [-6.6, 26.1], [-4.0, 26.3], [-4.0, 27.1], [-6.8, 27.0], [-10.0, 23.8]]);
  color(ink) onEye(0.12) offset(r = 0.45) polygon(EYE);
  color(eyeO) onEye(0.2) polygon(EYE);
  color(eyeI) onEye(0.26) intersection() { polygon(EYE); translate([-8, 24.3]) square([4, 2]); }
  color(eyeY) onEye(0.26) intersection() { polygon(EYE); translate([-8.6, 21.5]) square([3.4, 1.15]); }
  color(ink) onEye(0.32) translate([-7.35, 22.5]) square([0.5, 2.6]);
}

// Glowing runes on each temple.
color(rune) mirror_x() intersection() {
  translate(HC) hull() { headEll(CR, 0.15); headEll(SN, 0.15, 26); }
  artPrism() { rune2d([-2.4, 25.4], 2.3, 2.5, 0.48); rune2d([-2.8, 22.6], 2.3, 2.7, 0.48); }
  translate([3, -20, 0]) cube([20, 40, 40]);
}

// ---- Antlers: a short beam, a branch out to the side with a tine and a small top tine, authored in their own plane
// (x out, z up), swept 20 degrees back.
ANT = [[[0, 0], [0.4, 4.2], 0.8, 0.66], [[0.4, 4.2], [1.0, 8.4], 0.66, 0.48],
       [[0.3, 3.0], [3.0, 3.9], 0.6, 0.5], [[3.0, 3.9], [5.4, 4.7], 0.5, 0.4],
       [[2.8, 3.9], [3.0, 6.4], 0.46, 0.36], [[0.8, 6.6], [2.0, 7.9], 0.42, 0.32]];
mirror_x() translate(HC + [4.0, 0.2, 5.4]) rotate([0, 0, 20]) rotate([0, 6, 0])
  for (a = ANT) limb([a[0][0], 0, a[0][1]], [a[1][0], 0, a[1][1]], a[2], a[3], antlerC);

// ---- Wings: five leaf feathers each, fanned in the wing's plane (u out along the span, v up), swept 50 degrees back.
// [root u, v], [tip u, v], half width, bow, depth offset (towards -Y is the front)
WR = [2.4, 2.2, 17.2];
FEATH = [
  [[1.2, 0.8], [13.6, 8.8], 2.0, 0.4, 0.4],
  [[2.0, 0.6], [14.4, 6.4], 2.0, 0.4, 0.15],
  [[2.4, 0.2], [14.2, 3.7], 1.9, 0.35, -0.1],
  [[2.2, -0.4], [12.8, 1.0], 1.7, 0.25, -0.35],
  [[2.0, -0.9], [10.4, -0.9], 1.4, 0.15, -0.6],
];
function fprof(s) = pow(sin(180 * min(1, s * 1.1)), 0.65);
function fpt(f, s, k) = let(r = f[0], t = f[1], d = t - r, L = norm(d), n = [-d[1], d[0]] / L,
  c = r + d * s + n * f[3] * sin(180 * s)) c + n * f[2] * fprof(s) * (k > 0 ? 1 : 0.8) * k;
function fpoly(f) = concat([for (i = [0 : 7]) fpt(f, i / 7, 1)], [for (i = [6 : -1 : 1]) fpt(f, i / 7, -1)]);
function fred(f) = concat([for (i = [0 : 2]) fpt(f, 0.8 + i * 0.1, 1)], [for (i = [9 : -1 : 7]) fpt(f, i / 9, -1)],
  [for (i = [0 : 2]) fpt(f, 0.72 + i * 0.1, 0)]);
// the wing's inner web behind the feathers, so the fan reads as one wing with only the tips apart
function webPoly() = concat([[0.8, 0.4]], [for (k = [0 : len(FEATH) - 1]) fpt(FEATH[k], 0.55, 0)], [[1.6, -1.0]]);
mirror_x() translate(WR) rotate([0, 0, 50]) translate([0, 0.6, 0]) slab(webPoly(), 1.1, feathG, inset = 0.5, grow = 0.2);
mirror_x() translate(WR) rotate([0, 0, 50]) for (k = [0 : len(FEATH) - 1]) {
  f = FEATH[k];
  translate([0, -f[4], 0]) {
    slab(fpoly(f), 1.2, k % 2 == 0 ? feathG : feathG2, inset = 0.5, grow = 0.2);
    slab(fred(f), 1.5, red, inset = 0.5, grow = 0.2);
  }
}
