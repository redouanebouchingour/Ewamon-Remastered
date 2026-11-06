// Shardling: a stocky little golem of pale prism crystal: a big round head and a barrel of a body made of neat
// hexagonal panels (a soccer-ball layout, darker seams between them, a few panels tinted pastel), flecked with rainbow
// glints. Determined glowing pale-cyan eyes painted flush on a smooth face plate, a slanted dark brow over each, a
// small confident smile. A big pauldron on each shoulder, the near (+X) arm hanging with a heavy gauntlet fist, the
// far (-X) fist raised in front holding a clear prism sword angled up and out; short thick legs, block feet.
//
// Checklist (front sheet, feet at sheet z 3.8 -> scad z 0, so scad z = sheet z - 3.8):
//   head      sheet x -8..8.3, z 20.7..34.1 (centre 0.15, 27.4): smooth round, hex panels, a smooth face plate
//   eyes      near (0.6, 25.5) 2.7 x 2.6, far (-5.9, 25.3): pale cyan, white centre and glint, darker blue rim, the
//             top cut by a thick slanted brow line (inner corner lower): an intense, cute glare
//   mouth     a small smile (-3.7..-1.5, z 23.1), hooked up at the near end
//   torso     x -8.6..9.6, z 9..24 (back), a rounded shell of hexagonal panels with dark seams
//   shoulders near (9.9, 22.2) r 3.4, far (-9.5, 21.7)
//   near arm  forearm (9.7..16, z 15..20), fist (10.5..15, z 10.5..15), knuckles at the bottom
//   far arm   fist (-15.5..-9, z 13..19.5) in front, holding the sword
//   sword     pommel (-11.5, 12.8), guard (-18..-14.5, z 17..19), tip (-18.6, 28.2), blade ~3 wide, clear with a
//             rainbow band along it (red at the top to violet at the guard)
//   legs      far x -9..-2.4, near 2.4..10.9, z 5..13; feet z 3.8..6.1, about 6.5 wide
//   colours   crystal M0 pale silver-blue, darker seams; rainbow flecks; the aura, the sparkles and the ground
//             shadow are not modelled
include <lib.scad>

crystal = [0.74, 0.83, 0.92];
crystalLight = [0.84, 0.91, 0.97];
crystalDark = [0.6, 0.69, 0.81];
seam = [0.4, 0.48, 0.62];
ink = [0.1, 0.13, 0.2];
eyeRim = [0.18, 0.42, 0.72, NOGLOW];
eyeCyan = [0.5, 0.9, 1, NOGLOW];
eyeCore = [0.74, 0.97, 1, NOGLOW];
blade = [0.9, 0.97, 1, NOGLOW];
pastel = [[0.9, 0.82, 0.9], [0.83, 0.83, 0.97], [0.79, 0.92, 0.9], [0.92, 0.92, 0.82], [0.79, 0.88, 0.99]];
rainbow = [[0.95, 0.4, 0.4, NOGLOW], [0.98, 0.66, 0.3, NOGLOW], [0.96, 0.9, 0.38, NOGLOW], [0.42, 0.84, 0.5, NOGLOW],
           [0.38, 0.6, 0.96, NOGLOW], [0.72, 0.44, 0.92, NOGLOW]];
SFN = 44;   // the head and torso spheres

// ---- The panel layout: a truncated icosahedron (12 pentagons, 20 hexagons) projected onto a sphere. Each panel is
// the part of the sphere nearer its face plane than the neighbours', inset by a seam.
PHI = (1 + sqrt(5)) / 2;
function cyc(v) = [v, [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
function un(v) = v / norm(v);
ICO = [for (s1 = [-1, 1], s2 = [-1, 1], c = cyc([0, s1, s2 * PHI])) un(c)];
DOD = concat([for (a = [-1, 1], b = [-1, 1], c = [-1, 1]) un([a, b, c])],
             [for (s1 = [-1, 1], s2 = [-1, 1], c = cyc([0, s1 / PHI, s2 * PHI])) un(c)]);
// a pentagon's face plane lies a little further out than a hexagon's (4.655 vs 4.535 at edge 2)
CENT = concat([for (c = ICO) [c, 4.5346 / 4.6549]], [for (c = DOD) [c, 1]]);
// a finer layout for the torso: the icosahedron's vertices (pentagons) and edge midpoints (hexagons), 42 panels
CENT2 = concat([for (c = ICO) [c, 1]], [for (a = [0 : 11], b = [0 : 11]) if (a < b && ICO[a] * ICO[b] > 0.4) [un(ICO[a] + ICO[b]), 1]]);
function rotXZ(r, v) = let(a = r[0], b = r[2], w = [v[0], v[1] * cos(a) - v[2] * sin(a), v[1] * sin(a) + v[2] * cos(a)])
  [w[0] * cos(b) - w[1] * sin(b), w[0] * sin(b) + w[1] * cos(b), w[2]];
module halfspace(v, m) { rotate(_dir_rot(un(v))) translate([-4, -4, m]) cube([8, 8, 4]); }
module panel(C, i, g, m, near) {
  ci = C[i][0] * C[i][1];
  nb = [for (j = [0 : len(C) - 1]) if (j != i && C[i][0] * C[j][0] > cos(near)) j];
  intersection() {
    sphere(1 + g, $fn = SFN);
    intersection_for(j = nb) halfspace(ci - C[j][0] * C[j][1], m);
  }
}
// A paneled shell at p with radii r: seam-coloured core, raised panels (pastel on a few), the pattern turned by rot.
// `skip(d)` leaves out the panels whose (turned) centre direction is in a region another layer covers.
module shell(p, r, rot, seed, tints = [], C = CENT, near = 48) {
  rs = min(r);
  translate(p) scale(r) {
    color(seam) sphere(1, $fn = SFN);
    for (i = [0 : len(C) - 1]) let(c = rotXZ(rot, C[i][0]))
      color(len([for (t = tints) if (t == i) 1]) > 0 ? pastel[(i + seed) % 5] : ((i + seed) % 3 == 0 ? crystalLight : crystal))
        rotate(rot) panel(C, i, 0.1 / rs, 0.17 / rs, near);
  }
}
// A rainbow stroke laid flush on an ellipsoid (centre p, radii r) in direction d, proud by g.
module fleck(p, r, d, k, g = 0.2, spin = 0) {
  u = un(d);
  color(rainbow[k % 6]) translate(p) intersection() {
    scale(r + [g, g, g]) sphere(1, $fn = SFN);
    translate([u[0] * r[0], u[1] * r[1], u[2] * r[2]]) rotate(_dir_rot(u)) rotate([0, 0, spin]) cube([0.42, 1.3, 8], center = true);
  }
}
// A smooth crystal segment (limbs) with a few flecks.
module seg(p, r, c, flecks = 0, seed = 0, fn = 18) {
  color(c) translate(p) scale(r) sphere(1, $fn = fn);
  if (flecks > 0) for (i = [0 : flecks - 1]) let(m = rands(-1, 1, 3, seed + i))
    color(rainbow[(seed + i) % 6]) translate(p) intersection() {
      scale(r + [0.12, 0.12, 0.12]) sphere(1, $fn = fn);
      let(u = un([m[0], -abs(m[1]) - 0.4, m[2] * 0.8])) translate([u[0] * r[0], u[1] * r[1], u[2] * r[2]]) rotate(_dir_rot(u))
        rotate([0, 0, m[2] * 80]) cube([0.4, 1.1, 8], center = true);
    }
}

// ---- Head: big and round, hex panels over the crown and back, a smooth face plate in front.
H = [0, 0.3, 23.6];
HR = [8.2, 7.2, 6.7];
HROT = [-69.1, 0, 36];
shell(H, HR, HROT, 2, tints = [3, 14, 22, 29]);
module onHead(g) { translate(H) scale(HR + [g, g, g]) sphere(1, $fn = SFN); }
// face plate: the front of the head, smooth, with a seam round it
module faceCol(o) { translate([0, H[1] - 10, 22.3]) rotate([-90, 0, 0]) scale([6.9 + o, 4.7 + o, 1]) cylinder(h = 10, r = 1, $fn = 40); }
color(seam) intersection() { onHead(0.18); faceCol(0.3); }
color(crystalLight) intersection() { onHead(0.21); faceCol(0); }
for (i = [0 : 6]) let(m = rands(-1, 1, 3, 70 + i)) fleck(H, HR, [m[0], 0.3 + abs(m[1]), 0.35 + abs(m[2])], i, 0.24, m[0] * 80);

// Eyes, painted flush: pale cyan with a white core and glint, a darker blue rim, the top cut by a thick dark brow
// that slants down towards the nose. EP is the near (+X) eye's point on the head, EYAW the head's normal there.
EP = [3.7, -6.04, 22.6];
EYAW = 24;
BROW0 = 0.48;   // brow line v = BROW0 + BROWK * u (u outwards, v up, eye units)
BROWK = 0.34;
module eyeCut() { polygon([[-6, -6], [6, -6], [6, BROW0 + 6 * BROWK], [-6, BROW0 - 6 * BROWK]]); }
module eyeShape(o = 0) { offset(r = o) intersection() { scale([1.55, 1.4]) circle(1, $fn = 32); eyeCut(); } }
module paintEye(g, c) {
  color(c) intersection() {
    onHead(g);
    translate(EP) rotate([0, 0, EYAW]) rotate([90, 0, 0]) linear_extrude(height = 6, center = true) children();
  }
}
mirror_x() {
  paintEye(0.25, eyeRim) eyeShape(0.26);
  paintEye(0.28, eyeCyan) eyeShape();
  paintEye(0.31, eyeCore) intersection() { eyeShape(); translate([0.15, -0.3]) scale([0.85, 0.62]) circle(1, $fn = 24); }
  paintEye(0.34, "white") { translate([0.6, 0.12]) circle(0.32, $fn = 12); translate([-0.55, -0.55]) circle(0.15, $fn = 8); }
  paintEye(0.3, ink) offset(r = 0.16) offset(delta = -0.16)
    polygon([[-2.1, BROW0 - 2.1 * BROWK - 0.25], [1.85, BROW0 + 1.85 * BROWK - 0.2],
             [1.75, BROW0 + 1.75 * BROWK + 0.3], [-2.1, BROW0 - 2.1 * BROWK + 0.45]]);
}
// A small confident smile, hooked up at the near (+X) end.
module stroke(a, b, w) { hull() { translate(a) rotate([90, 0, 0]) cylinder(h = 6, r = w, center = true, $fn = 8);
                                  translate(b) rotate([90, 0, 0]) cylinder(h = 6, r = w, center = true, $fn = 8); } }
color(ink) intersection() {
  onHead(0.28);
  union() {
    stroke([-1.1, -6, 20.0], [0.3, -6, 19.6], 0.26);
    stroke([0.3, -6, 19.6], [1.6, -6, 19.8], 0.26);
    stroke([1.6, -6, 19.8], [2.2, -6, 20.5], 0.26);
  }
}

// ---- Torso: a rounded shell of hexagonal panels, a hexagon facing the front.
T = [0, 0.6, 13.6];
TR = [10, 8.2, 7.6];
shell(T, TR, [90, 0, 0], 0, tints = [5, 13, 19, 26, 33, 40], C = CENT2, near = 40);
for (i = [0 : 11]) let(m = rands(-1, 1, 3, 90 + i)) fleck(T, TR, [m[0], i % 3 == 2 ? m[1] : -abs(m[1]) - 0.3, m[2] * 0.8], i + 1, 0.24, m[2] * 80);

// ---- Shoulders: big rounded pauldrons.
mirror_x() seg([11, 0.3, 18.6], [3.9, 4.1, 3.6], crystalLight, 2, 31, 22);

// ---- Near arm (+X): hanging, a chunky gauntlet with knuckles at the bottom.
seg([11.8, 0.6, 14.6], [2.8, 3, 3.2], crystalDark);
seg([14.2, 0, 11.6], [3.5, 3.7, 4.8], crystal, 3, 43, 22);
for (k = [0 : 2]) seg([12.6 + k * 1.3, -2.7 + k * 0.3, 7.6], [1.05, 1.1, 1], crystalLight, fn = 10);

// ---- Far arm (-X): the forearm comes forward, the fist raised in front holding the sword.
seg([-12.4, 0.4, 15], [2.8, 3, 3.1], crystalDark);
seg([-12.6, -2, 13.2], [2.8, 3.1, 2.8], crystal, 1, 53);
seg([-11.9, -4.2, 12.4], [3.3, 3, 3.4], crystalLight, 1, 55);
for (k = [0 : 2]) seg([-11.2 + k * 0.15, -6.5, 10.9 + k * 1.3], [1.15, 0.9, 0.7], crystal, fn = 10);

// ---- Prism sword: a clear hexagonal blade with a rainbow band down its middle, a crystal guard, grip and pommel.
SW0 = [-11.2, -4.4, 8.4];
SW1 = [-18, -6, 23.8];
SWL = norm(SW1 - SW0);
g0 = SWL * 0.37;
bl = SWL - g0;
function hex(w, t, z) = [[w, 0, z], [0.5 * w, t, z], [-0.5 * w, t, z], [-w, 0, z], [-0.5 * w, -t, z], [0.5 * w, -t, z]];
bp = concat(hex(1.6, 0.6, g0), hex(2.2, 0.6, g0 + bl * 0.8), [[-1.1, 0, SWL]]);
translate(SW0) rotate(_dir_rot(SW1 - SW0)) {
  color(blade) hull() polyhedron(points = bp, faces = [for (i = [1 : len(bp) - 2]) [0, i, i + 1]]);
  // the rainbow band: red near the tip down to violet at the guard, on both faces
  for (s = [-1, 1], k = [0 : 5]) color(rainbow[k])
    translate([0, s * 0.62, g0 + bl * (0.76 - 0.12 * (k + 0.5))]) cube([1.5, 0.12, bl * 0.12], center = true);
  // guard: a short crystal bar across the blade root, longer on the outer side
  color(crystalLight) translate([-0.5, 0, g0 - 0.2]) rotate([0, 90, 0]) cylinder(h = 5.2, r = 0.7, center = true, $fn = 6);
  color(crystalDark) cylinder(h = g0, r = 0.55, $fn = 6);
  color(crystalLight) scale([1, 1, 1.2]) sphere(0.85, $fn = 6);
}

// ---- Legs: short thick rounded crystal stumps with block feet, a wide stance.
mirror_x() {
  seg([5.6, 0.4, 7.2], [3.4, 3.4, 2.8], crystalDark);
  seg([7.6, -0.1, 4.4], [3.2, 3.3, 2.7], crystal, 1, 63);
  color(crystalLight) hull() {
    translate([8.4, -2, 1.3]) scale([3, 2.2, 1.3]) sphere(1, $fn = 16);
    translate([8.4, 0.8, 1.3]) scale([3, 2.2, 1.3]) sphere(1, $fn = 16);
  }
}
