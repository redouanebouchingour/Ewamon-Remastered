// Katamute: Elemutt grown into a shaggy brawler: flexing arms with big fists, a scowl, a dark arrow marking, a long
// grey ponytail streaming from its top-knot, heavy rocky greaves with brown clawed boots and a bushy grey-tipped tail.
include <lib.scad>

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

fur = [0.95, 0.83, 0.62];
furHi = [1, 0.9, 0.72];
furDark = [0.85, 0.66, 0.45];
ear = [0.92, 0.74, 0.52];
mark = [0.36, 0.3, 0.24];
bun = [0.36, 0.33, 0.3];
band = [0.55, 0.32, 0.12];
rock = [0.5, 0.42, 0.24];
rockDark = [0.36, 0.3, 0.16];
boot = [0.45, 0.3, 0.22];
claw = [0.98, 0.95, 0.85];
nose = [0.2, 0.12, 0.1];

// Arrow / band marking: a flat capsule chain lying on the surface.
module stroke(pts, r, c = mark) { chain(pts, [for (p = pts) r], c); }

// Legs with rocky greaves.
mirror_x() {
  limb([3.6, 0, 11], [5, -0.5, 4], 2.8, 2.6, fur);
  // Rocky plates.
  ell([3, 2.9, 3.8], [5, -0.5, 6.5], rockDark);
  for (r = [[0, 4.4, 1.6, rock], [70, 5.5, 1.5, rock], [140, 4.2, 1.4, rockDark], [210, 6, 1.6, rock], [280, 4.8, 1.5, rock],
            [330, 8.2, 1.4, rock], [30, 8, 1.3, rockDark], [110, 8.6, 1.3, rock], [190, 8.4, 1.4, rock], [260, 8.8, 1.2, rockDark]])
    color(r[3]) translate([5 + 2.7 * sin(r[0]), -0.5 - 2.7 * cos(r[0]), r[1]]) rotate([r[0] / 3, 20, r[0]]) scale([1.3, 0.9, 1]) sphere(r[2] * 1.25, $fn = 7);
  blob([[[2.8, 3.6, 1.5], [5.2, -1.6, 1.5]], [[2.3, 2.2, 1.5], [5.2, 0.8, 1.7]]], boot);
  for (a = [-28, 0, 28]) spike([5.2 + sin(a) * 1.5, -5, 1], [sin(a) * 0.5, -1.4, -0.4], 0.6, 0.05, claw);
}

// Body: broad chest over a narrower waist, a shaggy ruff.
blob([[[4.6, 3.8, 3.6], [0, 0, 12.5]], [[6.4, 4.6, 4.4], [0, 0, 18]]], fur);
ell([3.4, 1.4, 3], [0, -3.4, 14], furHi);
for (a = [-60 : 20 : 60]) spike([sin(a) * 4.5, -3.6 + abs(sin(a)) * 1.5, 21], [sin(a) * 1.2, -1, -3.4], 1.1, 0.05, furHi);
for (a = [0 : 40 : 359]) spike([cos(a) * 4.6, sin(a) * 3.6, 21.5], [cos(a) * 2, sin(a) * 2, -1.5], 1.4, 0.05, fur);
// Spine stripe on the back.
stroke([[0, 4.2, 20], [0.8, 4.6, 17], [-0.6, 4.4, 14], [0, 3.9, 11]], 0.65);

// Arms flexed: upper arms out, forearms up, big fists by the head.
mirror_x() {
  ell([2.6, 2.6, 2.4], [6.2, 0, 19.5], fur);
  limb([6.2, 0, 19.5], [10.5, -0.6, 19.5], 2.2, 2.1, fur);
  ell([2.2, 1.8, 1.6], [9, -0.4, 21], furHi);
  limb([10.5, -0.6, 19.5], [11, -1.2, 25], 2.1, 1.8, fur);
  for (z = [20.5, 22.5]) spike([12.2, -0.6, z], [1.6, 0.4, -1.2], 0.9, 0.05, furHi);
  ell([2.2, 2, 2.3], [11, -1.4, 26.5], fur);
  for (i = [0 : 3]) ell([0.6, 0.6, 0.55], [10.5 - 0.3 * i + 0.4, -3.2, 25.6 + i * 0.75], furHi);
}

// Tail curling up behind to the viewer's right.
// Bushy tail sweeping out to the viewer's right, a grey streak and tip.
grey = [0.45, 0.42, 0.4];
blob([[[2, 2, 2], [2, 3.5, 10]], [[3.6, 3, 3.2], [7, 5.5, 9]], [[3.4, 2.6, 3.4], [11, 5, 11]]], fur);
blob([[[2.6, 2.2, 2.8], [12.5, 4.5, 13]], [[1.2, 1, 2], [14, 3.8, 17.5]]], grey);
for (t = [[7, 6, 6.2], [10, 5.4, 7.6], [13, 4.6, 9.5]]) spike(t, [1.6, -0.4, -1.6], 1.3, 0.05, fur);
chain([[5, 3, 11.6], [9, 3, 12], [12, 3, 13.5]], [0.7, 0.7, 0.5], grey);

// Head: big round puppy head with muzzle.
blob([[[6.6, 5.8, 5.6], [0, 0, 28]], [[5.5, 5, 4.6], [0, -0.5, 25.5]]], fur);
for (a = [-50 : 25 : 50]) spike([sin(a) * 6, -1 + abs(sin(a)) * 2, 25], [sin(a) * 2, 0.4, -2], 1.3, 0.05, fur);
ell([3.2, 2.4, 2.2], [0, -5.4, 25], furHi);
ell([1, 0.7, 0.75], [0, -7.6, 26], nose);
// Smile.
color(nose) translate([0, -7.1, 24.2]) scale([1.8, 0.4, 0.5]) sphere(1, $fn = 12);
mirror_x() color(claw) translate([1, -7.25, 24.3]) scale([0.4, 0.3, 0.4]) sphere(1, $fn = 8);
// Eyes: big grey-blue.
mirror_x() {
  eye([2.6, -4.85, 27.5], 1.45, iris = [0.5, 0.45, 0.72], pupil = [0.08, 0.06, 0.05], yaw = 6, lid = 0.45, lid_tilt = 26, lid_c = mark, slit = 0.55);
  brow([2.6, -4.85, 27.5], 1.45, 0.45, fur, 6);
}
// Cheek blush.
mirror_x() stroke([[3.8, -4.6, 25.8], [4.8, -4, 25.2]], 0.3);
// Arrow marking as a decal on the head shell: point on the brow, shaft over the crown and down the back.
module headShape(k) { hull() { translate([0, 0, 28]) scale([6.6, 5.8, 5.6] * k) sphere(1, $fn = 36); translate([0, -0.5, 25.5]) scale([5.5, 5, 4.6] * k) sphere(1, $fn = 28); } }
color(mark) intersection() {
  difference() { headShape(1.025); headShape(0.98); }
  union() {
    // Arrow head seen from the front.
    translate([0, -3, 0]) rotate([90, 0, 0]) linear_extrude(6) polygon([[0, 28.2], [-2.4, 31], [-1, 31], [-1, 35], [1, 35], [1, 31], [2.4, 31]]);
    // Shaft over the top and down the back.
    translate([-1, -3.2, 21]) cube([2, 12, 16]);
    // Side flicks above the eyes.
    mirror_x() translate([0, -3, 0]) rotate([90, 0, 0]) linear_extrude(6) polygon([[4.2, 26.5], [5.8, 27.4], [5.6, 28], [4.2, 27.2]]);
  }
}
// The stripe continues down the neck.
stroke([[0, 5, 23.5], [0.4, 4.4, 21]], 0.6);

// Floppy ears hanging down beside the head.
mirror_x() {
  color(ear) hull() { translate([5.2, -0.5, 31.5]) scale([1, 1.8, 1]) sphere(1.2, $fn = 16); translate([7.2, -1.2, 26.5]) scale([0.8, 1.4, 1.2]) sphere(1.8, $fn = 16); }
  color([0.98, 0.76, 0.66]) hull() { translate([5.6, -1.6, 30.6]) sphere(0.5, $fn = 10); translate([6.8, -2.3, 27]) scale([0.7, 0.6, 1]) sphere(1.1, $fn = 12); }
}

// Top-knot with a brown band and a long grey ponytail streaming back and to the viewer's right.
color(band) translate([0, 0.5, 33.2]) cylinder(h = 1.2, r1 = 2.2, r2 = 1.9, $fn = 20);
ell([2.6, 2.6, 2.4], [0, 0.6, 35.6], bun);
chain([[0, 1, 36.5], [2.5, 2, 39], [6, 2.5, 39], [9.5, 3, 37], [13, 3.5, 38]], [2.4, 2.3, 1.9, 1.3, 0.4], bun);
chain([[-0.5, 0.5, 37], [-1.5, 1.5, 40], [0.5, 2.5, 41.5], [3.5, 3, 41.5]], [1.6, 1.4, 1, 0.3], [0.46, 0.42, 0.38]);
chain([[4, 2.4, 39], [7, 3.6, 37], [9.5, 4.6, 36.6]], [1, 0.8, 0.2], [0.28, 0.26, 0.24]);
