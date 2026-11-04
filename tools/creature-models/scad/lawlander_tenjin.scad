// Lawlander Tenjin: the sheriff ascended. Lawlander's body, pose and face (scad/lawlander.scad, copied; keep the
// shared numbers in step) recoloured from the tenjin sprite 2026-11-04:
// - a pale cream hat with a gold band, glowing pale gold eyes, no grass stalk.
// - a thick cream cowl round the neck instead of the bandana triangle; a dark red bandana knot at the back of the neck.
// - a cream shirt and sleeves, a beige vest, a cream poncho and cape with gold zigzag trim.
// - dark brown trousers, bracers and boots with gold veins, a glowing gold star, a glowing golden lasso.
// - a gold halo ring standing behind the head with a jade stone at its crown, peach motes drifting round him.
include <lib.scad>

// coarser defaults than lib.scad's: this model has many parts
$fa = 12;
$fs = 0.9;
// a low-poly ellipsoid (small parts) and a low-poly blob
module lo(r, p, rot = [0, 0, 0], c, fn = 12) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module loBlob(parts, c, fn = 18) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }

hatC = [0.84, 0.77, 0.58];
hatDk = [0.9, 0.72, 0.3, NOGLOW];
furGrey = [0.52, 0.45, 0.39];
cream = [0.88, 0.82, 0.68];
ruffC = [0.74, 0.68, 0.6];
mask = [0.34, 0.26, 0.22];
jawC = [0.46, 0.38, 0.32];
noseC = [0.28, 0.22, 0.21];
eyeCol = [1, 0.95, 0.75, GLOW];
pupilC = [0.12, 0.07, 0.05];
bandana = [0.55, 0.25, 0.17];
scarf = [0.95, 0.91, 0.78];
poncho = [0.93, 0.87, 0.7];
trim = [0.86, 0.68, 0.32, NOGLOW];
shirt = [0.9, 0.84, 0.62];
vest = [0.8, 0.7, 0.5];
leather = [0.4, 0.28, 0.2];
bracer = [0.46, 0.33, 0.23];
bullet = [0.95, 0.8, 0.4, NOGLOW];
buckle = [0.78, 0.78, 0.76];
pants = [0.37, 0.27, 0.2];
boot = [0.26, 0.19, 0.16];
steel = [0.62, 0.65, 0.68];
gunDk = [0.25, 0.23, 0.24];
holsterC = [0.5, 0.35, 0.24];
rope = [1, 0.82, 0.5, GLOW];
gold = [0.98, 0.82, 0.35, GLOW];
halo = [0.92, 0.74, 0.32, NOGLOW];
jade = [0.5, 0.55, 0.38];
vein = [0.95, 0.78, 0.35, NOGLOW];
mote = [0.93, 0.72, 0.64];
paw = [0.68, 0.6, 0.49];
claw = [0.9, 0.85, 0.74];

// ---------- frames ----------
HEAD_T = [-1.2, -4.4, 32.4];
HEAD_S = 1.15;
HEAD_R = [0, 0, -35];
module headFrame() { translate(HEAD_T) rotate(HEAD_R) scale(HEAD_S) children(); }

// torso volume grown by g (for the flush layers: vest, belt, bandoliers, bandana)
module torsoVol(g = 0) {
  hull() {
    translate([0, 0, 21]) scale([8.5 + g, 7 + g, 7 + g]) sphere(1, $fn = 28);
    translate([0, 0.5, 15.5]) scale([7.8 + g, 6.4 + g, 3 + g]) sphere(1, $fn = 28);
  }
}
// the long back cape's volume (a hull from the shoulders to a hem flaring towards +X), grown by g
module capeVol(g = 0) {
  hull() {
    translate([0, 1, 27.5]) scale([8.9 + g, 7 + g, 1.8]) sphere(1, $fn = 30);
    translate([3.5, 3, 9]) scale([21 + g, 9 + g, 1]) sphere(1, $fn = 32);
  }
}
// keeps the back half (and the +X side, where the cape flies forward)
module capeKeep() { rotate([0, 0, -25]) translate([-40, 0.5, -1]) cube([80, 60, 50]); }
// the cape's outline from the back sheet (back screen x -> model front sheet x = -(x + 1)), its +X flap pushed out
// to where the front art has it
capePts = [for (p = [[-4.4, 31.5], [-7.4, 30], [-9.4, 27.5], [-9.8, 24.5], [-10.2, 20.5], [-14.5, 20.6], [-19, 19.8],
  [-21.5, 18.2], [-21.5, 16.2], [-21, 12.6], [-17.5, 14.8], [-13.5, 14.3], [-8, 12.2], [-6.4, 11.5], [-4.4, 11],
  [-1.4, 10.5], [0.6, 12], [1.6, 14], [3.6, 15.5], [5.3, 19], [7, 22], [8, 23], [10.3, 24.5], [12, 25.7], [11.6, 27],
  [9, 28.7], [6, 29.5], [4, 30], [0.6, 32]]) [-(p[0] + 1), p[1]]];
module capeShell(gOut = 0, gIn = -0.9) {
  intersection() {
    difference() { capeVol(gOut); capeVol(gIn); }
    capeKeep();
    prism(capePts);
  }
}
// the shoulder capelet: a dome shell over the shoulders, open in a V at the front for the bandana
module mantleShell(gOut = 0, gIn = -0.9) {
  difference() {
    translate([0, 0.5, 24]) scale([12 + gOut, 9 + gOut, 8.8 + gOut]) sphere(1, $fn = 32);
    translate([0, 0.5, 24]) scale([12 + gIn, 9 + gIn, 8.8 + gIn]) sphere(1, $fn = 32);
    translate([0, 0, 24 - 30 - 0.6]) cube(60, center = true);
    translate([0, -12, 0]) rotate([90, 0, 0]) linear_extrude(20, center = true) polygon([[-7.6, 33], [7.6, 33], [6.8, 28], [0.5, 21], [-6.8, 28]]);
  }
}
// a horizontal zigzag strip (front sheet x, z) for the poncho's trim
function zig(z0, a = 0.55, w = 0.45, x0 = -24, x1 = 24, step = 1.6) =
  concat([for (x = [x0 : step : x1]) [x, z0 + ((round((x - x0) / step) % 2) * 2 - 1) * a + w]],
         [for (x = [x1 : -step : x0]) [x, z0 + ((round((x - x0) / step) % 2) * 2 - 1) * a - w]]);

// ---------- legs: baggy trousers, dark boots with spurs ----------
// right leg (-X), splayed out, toe forward
limb([-4.2, 0.5, 12.5], [-7.5, -1, 7], 4.2, 3.4, pants);
limb([-7.5, -1, 7], [-8, -1.5, 4.6], 3.4, 3.1, pants);
limb([-8, -1.5, 5.4], [-8, -1.3, 2], 2.4, 2.3, boot);
loBlob([[[2.3, 2.5, 1.6], [-8, -1, 1.6]], [[1.7, 2, 1.35], [-9.8, -6.2, 1.35]]], boot);
// left leg (+X)
limb([4.2, 0.5, 12.5], [8.2, 0.5, 7], 4.2, 3.4, pants);
limb([8.2, 0.5, 7], [8.4, 0.5, 4.6], 3.4, 3.1, pants);
// the baggy seat of the trousers sagging between the legs
color(pants) translate([0, 0, 10.8]) scale([4.4, 4.6, 3]) sphere(1, $fn = 20);
limb([8.4, 0.5, 5.4], [8.4, 0.7, 2], 2.4, 2.3, boot);
loBlob([[[2.3, 2.5, 1.6], [8.4, 1, 1.6]], [[1.7, 2, 1.35], [8.9, -3.6, 1.35]]], boot);
// spurs: an ankle strap and a star wheel at each heel
for (p = [[-8, -1.3, 2.6], [8.4, 0.7, 2.6]]) {
  color(steel) translate(p) scale([2.5, 2.6, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 20);
  color(steel) translate(p + [0, 2.8, 0]) rotate([0, 90, 0]) cylinder(h = 0.35, r = 1.05, center = true, $fn = 8);
}
// hips
color(pants) translate([0, 0.5, 13.5]) scale([7.6, 6.2, 4]) sphere(1, $fn = 32);

// ---------- torso ----------
color(shirt) torsoVol(0);
// the dark vest, open in a V over the belly
color(vest) difference() {
  intersection() { torsoVol(0.25); translate([0, 0, 15 + 6.5]) cube([30, 30, 13], center = true); }
  translate([0, -12, 0]) rotate([90, 0, 0]) linear_extrude(20, center = true) polygon([[-2.6, 14.5], [3.2, 14.5], [0.4, 20.6]]);
}
// belt and buckle
color(leather) intersection() { torsoVol(0.45); translate([0, 0, 14.7]) cube([30, 30, 1.8], center = true); }
color(buckle) translate([0.3, -6.9, 14.7]) rotate([0, 0, 4]) difference() {
  cube([2.3, 0.7, 1.9], center = true);
  cube([1.3, 2, 0.9], center = true);
}
// sheriff's star on the left chest
module star5(r) { polygon([for (i = [0 : 9]) let(a = 90 + i * 36, q = i % 2 == 0 ? r : r * 0.45) [q * cos(a), q * sin(a)]]); }
color(gold) translate([4.5, -6.05, 22.5]) rotate([0, 0, 27]) rotate([90, 0, 0]) linear_extrude(0.9, center = true) star5(2.3);
// two crossed bandoliers (each a band round the torso) with gold cartridges on the front
for (a = [43, -40]) {
  color(leather) intersection() { torsoVol(0.55); translate([0, 0, 21.5]) rotate([0, a, 0]) cube([40, 40, 1.9], center = true); }
  color(bullet) intersection() {
    torsoVol(1.05);
    translate([0, -40, 0]) cube([80, 77, 80], center = true);
    translate([0, 0, 21.5]) rotate([0, a, 0]) for (i = [-6 : 6]) translate([i * 1.35, 0, 0]) cube([0.6, 40, 1.4], center = true);
  }
}

// ---------- poncho ----------
color(poncho) mantleShell();
color(trim) intersection() { mantleShell(0.12, -0.5); prism(zig(25.6, 0.5, 0.35)); }
color(poncho) capeShell();
for (z0 = [13.6, 21]) color(trim) intersection() { capeShell(0.12, -0.5); prism(zig(z0, 0.6, 0.38)); }
// the bandolier strap across the back of the cape, with cartridges
color(leather) intersection() {
  capeShell(0.4, -0.5);
  translate([0, 0, 21.5]) rotate([0, 43, 0]) cube([40, 40, 2.2], center = true);
  translate([0, 22, 0]) cube([80, 40, 80], center = true);
}
color(bullet) intersection() {
  capeShell(0.75, -0.5);
  translate([0, 22, 0]) cube([80, 40, 80], center = true);
  translate([0, 0, 21.5]) rotate([0, 43, 0]) for (i = [-5 : 5]) translate([i * 1.4, 0, 0]) cube([0.6, 40, 1.4], center = true);
}

// ---------- cowl and the bandana knot ----------
// a thick cream cowl round the neck, draping over the chest
color(scarf) hull() {
  translate([0, -0.8, 28.4]) scale([7.2, 6.8, 1.7]) sphere(1, $fn = 30);
  translate([-0.6, -5.6, 25]) scale([5.2, 2.6, 1.7]) sphere(1, $fn = 20);
}
// the dark red bandana's knot at the back of the neck, its tails flying up
lo([1.2, 1.1, 1.1], [0.5, 6.4, 30], c = bandana);
lo([1, 0.4, 2.6], [1.8, 7, 32.4], [-20, 30, 0], bandana);
lo([0.9, 0.4, 2.2], [-0.8, 7, 32], [-20, -35, 0], bandana);

// ---------- arms ----------
// right arm (-X): hanging at the side
lo([3.1, 3.1, 3.1], [-9.8, -1, 26], c = shirt, fn = 18);
limb([-9.8, -1, 26], [-13.2, -2, 19.6], 2.9, 2.6, shirt);
lo([2.6, 2.6, 2.6], [-13.2, -2, 19.6], c = bracer, fn = 18);
limb([-13.2, -2, 19.6], [-14.6, -3, 15.6], 2.6, 2.3, bracer);
color(leather) translate([-13.8, -2.4, 18.2]) rotate([12, -18, 0]) cylinder(h = 0.9, r = 2.85, center = true, $fn = 16);
lo([2.7, 2.5, 2.8], [-15.4, -3.5, 13.2], c = paw, fn = 18);
for (a = [-50, -18, 14, 46]) spike([-15.4 - sin(a) * 0.5, -3.5 - cos(a) * 1.9, 11.7], [-sin(a) * 0.5 - 0.6, -cos(a) * 0.8 - 0.6, -4], 0.58, 0.06, claw);
// left arm (+X): bent forward, paw resting over the holster
lo([3.4, 3.4, 3.2], [9.2, 0, 26], c = shirt, fn = 18);
limb([9.2, 0, 26], [12.8, 1.5, 21.5], 3.3, 2.7, shirt);
lo([2.6, 2.6, 2.6], [12.8, 1.5, 21.5], c = bracer, fn = 18);
limb([12.8, 1.5, 21.5], [10.7, -4.5, 18.6], 2.6, 2.2, bracer);
color(leather) translate([11.3, -2.6, 19.4]) rotate([-68, 0, -20]) cylinder(h = 0.9, r = 2.7, center = true, $fn = 16);
lo([2.2, 2.3, 2], [9.2, -6.2, 17.9], c = paw, fn = 18);
for (a = [-45, -15, 15, 45]) spike([9.2 + sin(a) * 1.5, -7.4 - abs(sin(a)) * -0.4, 16.9], [sin(a) * 0.3, -0.6, -3], 0.48, 0.06, claw);

// ---------- holster, gun and lasso on the left hip ----------
blob([[[1.5, 1.3, 2.6], [9.6, -1.4, 11.2]], [[1.1, 1.0, 1.2], [9.9, -1.6, 7.8]]], holsterC);
limb([9.4, -1.5, 13.4], [9.0, -2.6, 15.2], 0.75, 0.7, gunDk);
color(steel) translate([9.4, -1.5, 13.5]) scale([1, 1, 0.6]) sphere(0.95, $fn = 12);
color(rope) translate([10.8, 2.6, 10.4]) rotate([0, 0, -35]) rotate([0, 90, 0]) for (k = [0 : 2])
  translate([k * 0.4 - 0.4, 0, k * 0.3]) scale([1.7, 1, 1]) rotate_extrude($fn = 22) translate([1.7 + k * 0.25, 0]) circle(0.28, $fn = 6);
limb([11, 1.6, 6.8], [11.6, 0.6, 3.8], 0.3, 0.25, rope);

// ---------- head ----------
// One wedge: the skull, the two cheeks and the muzzle tip hulled, cream; the grey crown, the dark mask bands, the
// cream stripe and the dark under-jaw are laid flush on it.
module headSkin(g = 0) {
  hull() {
    translate([0, 0.5, 0.5]) scale([3.9 + g, 4.1 + g, 3.7 + g]) sphere(1, $fn = 26);
    for (s = [-1, 1]) translate([s * 2, -1.6, -1]) scale([2.9 + g, 2.8 + g, 2.6 + g]) sphere(1, $fn = 18);
    translate([0, -7.8, -0.75]) scale([1.6 + g, 1.4 + g, 1.4 + g]) sphere(1, $fn = 16);
  }
}
headFrame() {
  // neck
  color(furGrey) translate([0, 2.2, -2.8]) scale([3.4, 3.2, 2.8]) sphere(1, $fn = 18);
  color(cream) headSkin();
  // grizzled grey crown and back of the head
  color(furGrey) intersection() { headSkin(0.1); translate([0, 3.4, 3.2]) scale([6, 5.4, 4]) sphere(1, $fn = 20); }
  // the dark grey-brown under-jaw
  color(jawC) intersection() { headSkin(0.1); translate([0, -4.4, -3.7]) rotate([-8, 0, 0]) scale([3.6, 5.4, 2]) sphere(1, $fn = 20); }
  ell([1.45, 1, 1.05], [0, -8.95, -0.35], noseC);
  // soft ruff lobes at the back of the cheeks
  mirror_x() {
    lo([0.8, 1.7, 1.6], [3.7, 0.5, -1.3], [0, -10, 30], ruffC, 16);
    lo([0.6, 1.3, 0.8], [3.9, 1.9, -2.5], [0, 30, 40], ruffC, 12);
    lo([0.6, 1.3, 0.8], [3.4, 2.4, -0.4], [0, 20, 30], ruffC, 12);
  }
  // badger mask: a dark band from the nose over each eye back to the ear
  color(mask) intersection() {
    headSkin(0.14);
    mirror_x() hull() {
      translate([0.95, -7.6, 0.25]) sphere(0.55, $fn = 10);
      translate([2.2, -4.2, 1.3]) sphere(0.95, $fn = 12);
      translate([3.1, 0.4, 2.5]) sphere(1.1, $fn = 12);
    }
  }
  // the cream stripe down the middle of the face, over the crown
  color(cream) intersection() {
    headSkin(0.16);
    hull() {
      translate([0, -7.4, 0.8]) sphere(0.55, $fn = 10);
      translate([0, -3.4, 2.5]) sphere(0.95, $fn = 10);
      translate([0, 1.5, 4.2]) sphere(1.2, $fn = 10);
    }
  }
  // small amber eyes, narrowed under a heavy dark lid
  mirror_x() eye([2.3, -4.3, 1.25], 0.82, iris = eyeCol, sclera = eyeCol, pupil = eyeCol, yaw = 55, shine = false, lid = 0.22, lid_tilt = 12, lid_c = mask);
  // ears: cream rims with dark centres
  mirror_x() {
    lo([0.95, 0.55, 1.0], [3.2, 1.4, 3.3], [0, 0, 25], cream, 14);
    lo([0.52, 0.32, 0.58], [3.17, 1.0, 3.25], [0, 0, 25], mask, 14);
  }
  // the hat, tipped forward over the eyes
  translate([0, -4, 3.1]) rotate([14, 0, 0]) {
    color(hatC) mirror_x() intersection() {
      translate([0, -12, -2]) cube([14, 24, 8]);
      translate([3.6, 0, 0]) rotate([0, -16, 0]) translate([-3.6, 0, 0]) difference() {
        scale([9.4, 7.6, 1]) cylinder(h = 0.8, r = 1, $fn = 40);
        translate([0, 0, -0.1]) scale([4.8, 4.4, 1]) cylinder(h = 1, r = 1, $fn = 30);
      }
    }
    color(hatC) intersection() { translate([-3.6, -9, 0]) cube([7.2, 18, 0.8]); scale([9.4, 7.6, 1]) cylinder(h = 0.8, r = 1, $fn = 40); }
    color(hatC) hull() {
      translate([0, 0, 0.4]) scale([4.8, 4.4, 1]) cylinder(h = 1, r = 1, $fn = 30);
      translate([0, 0, 4.2]) scale([3.9, 4, 1.4]) sphere(1, $fn = 24);
    }
    color([0.72, 0.65, 0.48]) translate([0, 0, 5.4]) scale([1.2, 3, 0.6]) sphere(1, $fn = 14);
    color(hatDk) translate([0, 0, 1.2]) scale([4.95, 4.55, 1]) cylinder(h = 1.1, r = 1, $fn = 30);
  }
}

// ---------- tenjin ----------
// gold veins through the trousers and the bracers: lightning lines laid flush on them
module legVol(g) {
  limb([-4.2, 0.5, 12.5], [-7.5, -1, 7], 4.2 + g, 3.4 + g, vein);
  limb([-7.5, -1, 7], [-8, -1.5, 4.6], 3.4 + g, 3.1 + g, vein);
  limb([4.2, 0.5, 12.5], [8.2, 0.5, 7], 4.2 + g, 3.4 + g, vein);
  limb([8.2, 0.5, 7], [8.4, 0.5, 4.6], 3.4 + g, 3.1 + g, vein);
  limb([-13.2, -2, 19.6], [-14.6, -3, 15.6], 2.6 + g, 2.3 + g, vein);
  limb([12.8, 1.5, 21.5], [10.7, -4.5, 18.6], 2.6 + g, 2.2 + g, vein);
}
// a thin zigzag line through sheet points
module zline(pts, w = 0.22) { for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w, $fn = 6); translate(pts[i + 1]) circle(w, $fn = 6); } }
color(vein) intersection() {
  legVol(0.12);
  pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) {
    zline([[-9.5, 4.5], [-8.6, 7], [-9.6, 9], [-8.4, 12]]);
    zline([[-5.5, 5.5], [-6.4, 8], [-5.2, 10.5], [-5.8, 13]]);
    zline([[5.4, 4], [6.4, 6.5], [5.6, 9], [6.6, 11.5]]);
    zline([[9.4, 3.8], [8.6, 6.4], [9.6, 8.6]]);
    zline([[-12.5, 16], [-11.6, 17.4], [-12.4, 19]]);
    zline([[9.6, 18.2], [10.6, 19.4], [10, 20.6]]);
  }
}
// halo: a gold ring standing behind the head, a jade stone at its crown
translate([-2.3, 5, 35]) rotate([90, 0, 30]) {
  color(halo) rotate_extrude($fn = 40) translate([4.4, 0]) circle(0.36, $fn = 8);
  translate([0, 4.4, 0]) {
    color(jade) scale([0.8, 0.8, 0.5]) sphere(1, $fn = 14);
    color(halo) rotate_extrude($fn = 16) translate([0.95, 0]) circle(0.25, $fn = 6);
  }
}
// peach motes drifting round him
for (p = [[-14.8, -4, 25.5], [-16.7, 2, 23.3], [6.1, 4, 33], [19.6, -2, 22.3], [15.8, 2, 7]])
  lo([0.55, 0.3, 0.75], p, [0, 20, 30], mote, 8);
