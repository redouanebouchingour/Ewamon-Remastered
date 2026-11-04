// Glaciarm: a steel-blue armoured ice knight standing square, a tall egg helm with a gold crest and a dark T visor
// with two angry cyan eyes, heavy layered plate with gold trim, big ice-crystal clusters bursting from the
// pauldrons and the knees, and two huge closed fists of solid ice: the far one raised beside the helm, the near one
// held forward across the waist. Pale ice shards float round it.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the art is drawn square-on, the grey ground spray is not modelled):
//   - helm: x -3.8..3, z 29.3..40, a tall egg, widest at z 35, narrowing to a chin; a gold crest strip from the top
//     down to the brow and down the back; a gold V brow over a dark eye band (z 33.3..35.3) holding two slanted cyan
//     eyes with white cores (inner ends low); a dark slot under it down to the chin framed by two gold bars; a gold
//     rim round the lower edge and a gold gorget under the chin (z 27..30). The head is turned a little to the viewer.
//   - pauldrons: x -12.2..-4.2 and 3.8..13.8, z 24..32, a dome over a wider lamé, gold rims and a stud; big chunky
//     hex ice crystals fanning up and out of each to z 39.5 (x -12.7..-6 / 5.3..12)
//   - chest: x -6..6, z 22..30: two pectoral plates, gold V collar, gold centre seam, gold ^ lower edge (apex z 24);
//     abdomen lamés z 18..22 (darker), belt z 17..18.4 with studs
//   - tassets: a gold-edged shield plate in the middle (x -2.2..1.6, z 11.6..18) and gold-edged plates over each thigh
//   - far fist (creature's right, -X): raised beside the body, x -19.7..-8.2, z 16.4..29: the closed fist on top with
//     its knuckles up and out, the faceted ice gauntlet below down to the elbow
//   - near fist (+X): held forward across the waist, x 4..18, z 15.4..26.4: curled fingers towards the viewer, the
//     flared ice gauntlet out to the right; a pale frost swirl round each gauntlet
//   - legs: steel thighs, knee cops with ice clusters (x -11.3..-6.4 / 5.3..10, z 8.2..14.5), greaves with gold bands
//     under the knee and at the ankle, sabatons z 0..3.6 (x -11.6..-4.5 / 5.5..11.8) with a gold line
//   - shards: long ones at (-18, 31..36) and (16.8, 28..34), small ones at (-19.8, 30), (18.3, 26.5), knee ones at
//     (-15.5, 9.5..13.5), (-11.3, 13.5), (13.8, 9..13.5), (16.3, 13.3)
//   - back: a gold T, a yoke across the shoulders and a strap down the spine to the belt; a broad back plate; the
//     crest down the back of the helm; the crystal clusters seen from behind
// Colours: steel M0 [0.33, 0.45, 0.56] with darker under-layers [0.25, 0.35, 0.46] / [0.16, 0.28, 0.41] and lighter
// front plates [0.45, 0.58, 0.68]; ice M1 [0.71, 0.90, 0.97] (light [0.88, 0.99, 0.99], dark [0.59, 0.82, 0.92],
// shadow blue [0.45, 0.73, 0.89]); gold trim M2 light [0.71, 0.55, 0.40]; dark visor M4 [0.13, 0.17, 0.22]. The
// sheet lists nothing as GLOWS: the cyan eyes and the ice get NOGLOW.
include <lib.scad>

steel = [0.33, 0.45, 0.56];
steelLight = [0.45, 0.58, 0.68];
steelMid = [0.25, 0.35, 0.46];
steelDark = [0.16, 0.28, 0.41];
ice = [0.71, 0.90, 0.97, NOGLOW];
iceLight = [0.88, 0.99, 0.99, NOGLOW];
iceDark = [0.59, 0.82, 0.92, NOGLOW];
iceBlue = [0.45, 0.73, 0.89, NOGLOW];
frost = [0.73, 0.88, 0.92, NOGLOW];
trim = [0.71, 0.55, 0.40];
dark = [0.13, 0.17, 0.22];
cyan = [0.45, 0.80, 0.95, NOGLOW];
white = [0.88, 0.99, 0.99, NOGLOW];

// Raw ellipsoid (no colour) for intersections.
module E(r, p = [0, 0, 0]) translate(p) scale(r) sphere(1, $fn = 28);
// A band of the ellipsoid (r, p) grown by g between heights z0 and z1: a trim ring flush on that plate.
module rim(r, p, z0, z1, g = 0.2, c = trim) color(c) intersection() { E(r + [g, g, g], p); translate([-60, -60, z0]) cube([120, 120, z1 - z0]); }

// Hexagonal ice crystal from p along d, radius r, a pyramid tip a third of its length.
module crystal(p, d, r, c = ice) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    translate([0, 0, -r * 0.8]) cylinder(h = l * 0.66 + r * 0.8, r = r, $fn = 6);
    translate([0, 0, l * 0.66]) cylinder(h = l * 0.34, r1 = r, r2 = 0.1, $fn = 6);
  }
}
// A floating shard: a hex bipyramid centred at p, long axis d.
module shard(p, d, r, c = iceLight) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.3, r1 = r, r2 = 0.08, $fn = 6);
    rotate([180, 0, 0]) cylinder(h = l * 0.7, r1 = r, r2 = 0.08, $fn = 6);
  }
}

// ---- Fist: a frame at F whose +Z is the punch direction a (knuckles), -Y the side the curled fingers face (f).
function nrm(v) = v / norm(v);
module orient(F, a, f) {
  z = nrm(a);
  y = nrm(-(f - (f * z) * z));
  x = cross(y, z);
  multmatrix([[x[0], y[0], z[0], F[0]], [x[1], y[1], z[1], F[1]], [x[2], y[2], z[2], F[2]], [0, 0, 0, 1]]) children();
}
// The closed ice fist in its own frame (centre at the origin), its gauntlet back to the elbow at z = -L.
module fist(L = 8.5, ts = 1, k = 1.25) scale(k) fist0(L / k, ts);
module fist0(L, ts) {
  // the hand: a chunky faceted block
  color(ice) hull() {
    translate([0, 0.6, 0.8]) scale([3.9, 3.3, 3.0]) sphere(1, $fn = 10);
    translate([0, 0.7, -1.8]) scale([3.6, 3.1, 2.4]) sphere(1, $fn = 10);
  }
  // four curled fingers on the front, knuckles over the top
  for (i = [0 : 3]) let(x = -2.85 + 1.9 * i) {
    color(i % 2 == 0 ? iceLight : ice) hull() { translate([x, -2.4, -1.9]) sphere(1.08, $fn = 8); translate([x, -2.4, 2.0]) sphere(1.08, $fn = 8); }
    color(iceLight) translate([x, -1.0, 3.25]) scale([1.0, 1.45, 1.05]) sphere(1, $fn = 8);
  }
  // thumb across the bottom of the fingers
  color(iceDark) hull() { translate([-3.9 * ts, -0.6, -2.6]) sphere(1.25, $fn = 8); translate([0.6 * ts, -3.4, -1.3]) sphere(1.1, $fn = 8); }
  // the gauntlet: a faceted flared cuff, a ridge at the wrist and one at the elbow, blue facets on its sides
  color(ice) translate([0, 0.6, -2.6]) rotate([180, 0, 0]) cylinder(h = L - 2.6, r1 = 4.5, r2 = 3.2, $fn = 8);
  color(iceLight) translate([0, 0.6, -3.0]) scale([4.85, 4.85, 0.75]) sphere(1, $fn = 8);
  color(iceDark) translate([0, 0.6, -L + 0.6]) scale([3.55, 3.55, 0.7]) sphere(1, $fn = 8);
  for (k = [0 : 2]) color(iceBlue) rotate([0, 0, 60 + k * 105]) translate([0, 0.6 + 3.9, -5.4]) scale([0.9, 0.5, 2.0]) sphere(1, $fn = 6);
  // jagged ice flaring off the cuff's outer side
  crystal([3.6, 1.6, -4.2], [2.2, 0.8, 2.2], 0.8, iceLight);
  crystal([3.2, 3.2, -6.4], [2.4, 1.6, 0.6], 0.7, ice);
  // the frost swirl round the gauntlet
  color(frost) for (i = [0 : 6]) let(a0 = -40 + i * 34, a1 = a0 + 34, r = 6.4)
    hull() { translate([r * cos(a0), 0.6 + r * sin(a0), -5.6 + i * 0.5]) sphere(0.38, $fn = 6); translate([r * cos(a1), 0.6 + r * sin(a1), -5.1 + i * 0.5]) sphere(0.38, $fn = 6); }
}

// ---- Torso: chest and waist, a broad back plate, darker abdomen lamés, belt, hips.
blob([[[7.0, 5.0, 5.0], [0, 0.2, 25.6]], [[5.4, 4.4, 3.4], [0, 0.2, 19.8]]], steel);
ell([6.6, 2.6, 5.0], [0, 3.0, 25.0], steel);                                                     // back plate
ell([6.2, 2.6, 4.4], [0, -3.2, 25.8], steel);                                                    // breastplate
mirror_x() ell([3.0, 1.5, 2.7], [2.9, -4.7, 26.6], steelLight);                                  // pectoral plates
// gold trim on the chest: the V collar, the centre seam, the ^ lower edge
color(trim) intersection() {
  union() { E([6.4, 2.8, 4.6], [0, -3.2, 25.8]); mirror_x() E([3.25, 1.75, 2.95], [2.9, -4.7, 26.6]); }
  union() {
    mirror_x() translate([0, -10, 27.4]) rotate([0, -28, 0]) translate([0, 0, -0.35]) cube([7, 8, 0.7]);
    translate([-0.38, -10, 22.6]) cube([0.76, 8, 5.2]);
    mirror_x() translate([0, -10, 24.0]) rotate([0, 17, 0]) translate([0, 0, -0.6]) cube([7.5, 8, 0.6]);
  }
}
// abdomen lamés and the belt
ell([5.9, 4.8, 1.25], [0, 0.0, 21.0], steelMid);
ell([5.6, 4.6, 1.2], [0, 0.0, 19.3], steel);
rim([5.6, 4.6, 1.2], [0, 0.0, 19.3], 18.15, 18.55, 0.15);
ell([6.5, 5.3, 1.0], [0, 0.1, 17.6], steelDark);
for (a = [-50, -25, 0, 25, 50]) color(trim) translate([6.5 * sin(a), 0.1 - 5.3 * cos(a), 17.6]) sphere(0.45, $fn = 8);
ell([6.0, 4.6, 2.8], [0, 0.3, 15.4], steelMid);                                                  // hips
// gorget under the chin and the gold yoke + spine strap of the back's T
rim([4.6, 4.4, 1.6], [0, -0.4, 29.2], 28.6, 30.2, 0.0);
color(trim) intersection() {
  union() { E([6.9, 2.9, 5.3], [0, 3.0, 25.0]); E([7.2, 5.2, 5.2], [0, 0.2, 25.6]); }
  union() { translate([-0.75, 2.5, 17.0]) cube([1.5, 10, 13]); translate([-6, 2.5, 28.6]) cube([12, 10, 0.9]); }
}
for (z = [19.5, 22.5, 25.5]) color(trim) translate([0, 5.35, z]) sphere(0.4, $fn = 8);

// ---- Tassets: a gold-edged shield plate in the middle, gold-edged plates over the thighs.
tasset = [[-2.3, 18.0], [2.3, 18.0], [2.2, 13.8], [0, 11.9], [-2.2, 13.8]];
color(trim) translate([0, -4.7, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.8, center = true) offset(r = 0.6) polygon(tasset);
translate([0, -5.2, 0]) plate(tasset, 0.7, 0.3, steel, grow = 0);
side = [[-2.7, 2.2], [2.7, 2.2], [3.0, -1.4], [2.0, -3.0], [-2.0, -3.0], [-3.0, -1.4]];
mirror_x() translate([5.2, -3.3, 13.6]) rotate([0, -10, 30]) {
  color(trim) rotate([90, 0, 0]) linear_extrude(height = 0.7, center = true) offset(r = 0.55) polygon(side);
  translate([0, -0.45, 0]) plate(side, 0.6, 0.3, steel, grow = 0);
  color(trim) translate([-2.6, -0.85, -0.6]) cube([5.2, 0.3, 0.4]);
}

// ---- Helm: a tall egg turned a little to the viewer; gold crest, brow, slot bars and lower rim; dark T visor.
HC = [0, -1.0, 35.0];
module helm(g = 0) hull() {
  scale([3.4 + g, 3.7 + g, 4.6 + g]) sphere(1, $fn = 32);
  translate([0, 0.1, -3.4]) scale([2.7 + g, 3.0 + g, 2.2 + g]) sphere(1, $fn = 24);
}
// the eye band surface (the helm grown 0.12) at local (x, z): its y, for the floating eyes
function helmY(x, z) = -(3.7 + 0.12) * sqrt(1 - pow(x / 3.52, 2) - pow(z / 4.72, 2));
visor = [[-3.0, 0.35], [0, -0.25], [3.0, 0.35], [2.7, -1.5], [1.05, -2.1], [1.0, -5.3], [-1.0, -5.3], [-1.05, -2.1], [-2.7, -1.5]];
brow = [[-3.3, 0.35], [0, -0.25], [3.3, 0.35], [3.3, 1.1], [0, 0.45], [-3.3, 1.1]];
bars = [[1.05, -2.1], [1.75, -2.0], [1.65, -5.2], [1.0, -5.3], [-1.0, -5.3], [-1.65, -5.2], [-1.75, -2.0], [-1.05, -2.1], [-0.6, -1.9], [0.6, -1.9]];
module frontY(pts) translate([0, -2, 0]) rotate([90, 0, 0]) linear_extrude(height = 10) polygon(pts);
translate(HC) rotate([0, 0, 20]) {
  color(steel) helm();
  color(steel) translate([0, 0.3, 3.6]) cylinder(h = 1.5, r1 = 1.5, r2 = 0.35, $fn = 12);           // peak
  color(dark) intersection() { helm(0.12); frontY(visor); }
  color(trim) intersection() { helm(0.22); union() { frontY(brow); frontY(bars); } }
  // crest: front from the brow up, over the top and down the back
  color(trim) intersection() { helm(0.22); union() { translate([-0.62, -10, 0.3]) cube([1.24, 20, 6]); translate([-0.62, 0.5, -6]) cube([1.24, 10, 7]); } }
  color(trim) translate([0, 0.3, 5.0]) sphere(0.45, $fn = 8);
  color(trim) intersection() { helm(0.2); translate([-6, -6, -5.65]) cube([12, 12, 0.7]); }          // lower rim
  // eyes: slanted cyan slits with white cores floating just proud of the band (inner ends low)
  for (s = [-1, 1]) let(x = 1.3 * s, z = -0.75, y = helmY(x, z), a = atan2(x / 12.4, -y / 14.6))
    translate([x + 0.38 * sin(a), y - 0.38 * cos(a), z]) rotate([0, 0, a]) rotate([0, -s * 27, 0]) {
      color(cyan) scale([1.1, 0.24, 0.4]) sphere(1, $fn = 14);
      color(white) translate([-0.1 * s, -0.12, 0.03]) scale([0.5, 0.16, 0.16]) sphere(1, $fn = 10);
    }
}

// ---- Pauldrons: a steel dome over a wider lamé, both sloping down and out, gold rims and a stud, a burst of big ice
// crystals on top.
module rimP(r, p, rot, z0, z1, g = 0.22) color(trim) translate(p) rotate(rot) intersection() { scale(r + [g, g, g]) sphere(1, $fn = 28); translate([-60, -60, z0]) cube([120, 120, z1 - z0]); }
mirror_x() {
  P = [10.4, 0.4, 28.4];
  petal([4.7, 4.6, 3.3], P, [0, 14, 0], steel);
  petal([5.4, 5.1, 2.2], P + [1.0, 0, -1.9], [0, 18, 0], steel);
  rimP([4.7, 4.6, 3.3], P, [0, 14, 0], -1.7, -1.1);
  rimP([5.4, 5.1, 2.2], P + [1.0, 0, -1.9], [0, 18, 0], -1.6, -1.0);
  color(trim) translate(P + [-1.6, -4.5, -1.3]) sphere(0.75, $fn = 10);
  C = P + [0.3, 0.4, 2.0];
  crystal(C, [0.3, 0.2, 9.2], 1.85, iceLight);
  crystal(C + [1.4, 0.2, 0], [2.8, 0.3, 7.0], 1.6, ice);
  crystal(C + [-1.2, -0.6, 0], [-1.7, -0.8, 7.4], 1.5, iceDark);
  crystal(C + [2.4, -0.6, -0.8], [4.4, -0.6, 4.2], 1.4, iceBlue);
  crystal(C + [0.6, -1.6, 0], [1.0, -3.0, 5.8], 1.4, iceLight);
  crystal(C + [-0.4, 1.8, 0], [-0.8, 3.2, 6.6], 1.4, ice);
  crystal(C + [1.8, 1.8, -0.2], [2.4, 2.6, 5.0], 1.3, iceDark);
}

// ---- Arms: steel upper arms with elbow balls; the far fist raised, the near one held forward across the waist.
SR = [-10.6, 0.5, 26.0]; ER = [-12.6, -1.0, 17.5]; FR = [-15.8, -5.5, 24.6];
SL = [10.6, 0.5, 26.0]; EL = [18.7, -0.6, 20.7]; FL = [13.9, -7.0, 21.5];
limb(SR, ER, 2.8, 2.6, steelMid);
ell([2.9, 2.9, 2.9], ER, steel);
limb(SL, EL, 2.8, 2.6, steelMid);
ell([2.9, 2.9, 2.9], EL, steel);
orient(FR, FR - ER, [0.5, -0.87, 0]) fist(norm(FR - ER), 1);
orient(FL, FL - EL, [0.5, -0.87, 0]) fist(norm(FL - EL), -1);

// ---- Legs: thighs, knee cops with ice clusters and a gold rim, greaves with gold bands, layered sabatons.
mirror_x() {
  K = [8.2, -0.6, 9.6]; A = [8.9, -0.4, 3.4];
  ell([3.0, 3.0, 3.0], [4.8, 0.3, 14.0], steelMid);
  limb([4.8, 0.3, 14.0], K, 3.3, 3.0, steel);
  limb(K, A, 3.0, 2.7, steel);
  ell([2.5, 1.4, 3.0], [8.7, -2.4, 6.0], steelLight);                                            // greave front plate
  ell([3.0, 2.3, 2.8], K + [0.3, -2.3, 0.4], steelLight);                                        // knee cop
  rim([3.0, 2.3, 2.8], K + [0.3, -2.3, 0.4], K[2] - 2.0, K[2] - 1.4, 0.2);
  rim([2.85, 2.85, 3.4], [8.6, -0.5, 6.6], 7.1, 7.7, 0.2);
  rim([2.75, 2.75, 3.0], [8.9, -0.4, 3.6], 3.3, 3.9, 0.2);
  blob([[[3.4, 3.6, 1.8], [9.0, -0.4, 1.8]], [[2.8, 3.0, 1.4], [9.2, -3.9, 1.4]]], steel);
  ell([2.6, 1.7, 1.2], [9.2, -5.2, 1.6], steelLight);                                            // toe plate
  rim([2.95, 3.15, 1.6], [9.2, -3.9, 1.4], 1.8, 2.3, 0.15);
  // ice cluster on the outer front of the knee
  KC = K + [1.4, -2.0, 1.4];
  crystal(KC, [1.4, -0.6, 4.6], 1.15, iceLight);
  crystal(KC + [0.8, 0.4, -0.4], [3.2, -0.2, 2.8], 1.0, ice);
  crystal(KC + [-0.6, -0.6, 0], [-0.6, -1.4, 4.0], 0.95, iceDark);
  crystal(KC + [0.4, 1.0, 0], [1.4, 1.6, 3.8], 0.95, ice);
}

// ---- Floating shards beside the shoulder clusters and the knees (sheet x / z, at depth 0).
for (s = [[-18.0, 33.8, 5.0, 0.95, -15], [-19.8, 30.0, 1.6, 0.55, 20], [16.8, 31.0, 6.0, 1.0, 18], [18.3, 26.5, 2.2, 0.6, -10],
          [-15.5, 11.5, 4.2, 0.85, -18], [-11.6, 13.5, 2.0, 0.55, 15], [13.8, 11.2, 4.6, 0.9, 16], [16.3, 13.3, 2.0, 0.55, -18]])
  shard(fromSheet(s[0], s[1], 0), [sin(s[4]), 0, cos(s[4])] * s[2], s[3], iceLight);
