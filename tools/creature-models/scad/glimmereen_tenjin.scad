// Glimmereen Tenjin: Glimmereen ascended. Eyes closed in a serene smile, gold kintsugi seams across its pearly body,
// a lilac bow under a floating golden halo, two gold ribbon streamers and an antenna crowned with a radiant sun-bead,
// and long pointed wings rimmed in gold that shimmer from pale gold through mint to sky blue.
include <lib.scad>

pearl = [0.94, 0.95, 1];
peri = [0.78, 0.82, 1];
lilac = [0.88, 0.84, 1];
shine = [1, 1, 1];
blush = [1, 0.72, 0.78];
bow = [0.88, 0.75, 0.98];
bowDk = [0.74, 0.6, 0.9];
antenna = [0.95, 0.82, 0.4];
gold = [0.98, 0.8, 0.2];
goldLine = [0.93, 0.72, 0.25];
wing = [0.86, 1, 0.88];
wingGold = [1, 0.95, 0.72];
wingBlue = [0.84, 0.94, 1];
wingEdge = [0.95, 0.78, 0.35];
sparkle = [1, 1, 1];
eyeC = [0.3, 0.22, 0.55];

module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, 18]) scale([9.5 + d, 9 + d, 9 + d]) sphere(1, $fn = 40);
    children();
  }
}

// Body.
ell([9.5, 9, 9], [0, 0, 18], pearl);
tint(peri) translate([0, 0, 2]) scale([14, 14, 11]) sphere(1, $fn = 24);
tint(lilac, 0.12) translate([10, 4, 18]) scale([5, 6, 6]) sphere(1, $fn = 18);
tint(shine, 0.2) translate([-4.4, -6.6, 23.6]) scale([2, 2, 1.3]) sphere(1, $fn = 14);

// Gold kintsugi seams wandering over the body surface.
function onBody(az, el) = [9.55 * cos(el) * sin(az), -9.05 * cos(el) * cos(az), 18 + 9.05 * sin(el)];
for (seam = [[[60, 50], [75, 30], [70, 10], [85, -10], [80, -35]], [[-70, 40], [-85, 20], [-75, 0], [-95, -20]],
             [[150, 45], [165, 20], [150, 0], [170, -25], [160, -45]], [[210, 30], [195, 10], [215, -15]],
             [[20, -30], [35, -45], [25, -60]]])
  chain([for (q = seam) onBody(q[0], q[1])], [for (q = seam) 0.22], goldLine, $fn = 6);

// Face: big violet eyes, pink cheeks and a small smile.
mirror_x() {
  // Closed eyes: lashed downward arcs.
  translate([3.2, -8.55, 18.6]) rotate([0, 0, -20]) rotate([90, 0, 0]) color(eyeC) difference() {
    cylinder(h = 0.5, r = 1.5, center = true, $fn = 20);
    cylinder(h = 1, r = 1.1, center = true, $fn = 20);
    translate([0, 1.5, 0]) cube([4, 3, 2], center = true);
  }
  tint(blush, 0.12) translate([5.2, -8, 16.4]) scale([1.6, 2, 1]) sphere(1, $fn = 14);
}
color(eyeC) translate([0, -8.95, 15.8]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.5, r = 1.2, center = true, $fn = 20);
  cylinder(h = 1, r = 0.8, center = true, $fn = 20);
  translate([0, 1.2, 0]) cube([3, 2.4, 2], center = true);
}

// Pink bow on top, a bit off to the viewer's left.
translate([-1.6, -1, 26.6]) rotate([0, -10, 0]) {
  mirror_x() color(bow) hull() {
    sphere(0.8, $fn = 10);
    translate([2.8, 0, 0.6]) scale([1.2, 0.9, 1.8]) sphere(1, $fn = 14);
  }
  ell([1, 1, 1], [0, 0, 0], bowDk);
  mirror_x() limb([0.5, 0, -0.4], [1.5, -0.4, -2], 0.5, 0.4, bowDk);
}
// Antenna with a radiant sun-bead.
chain([[0, 0, 26.4], [-1.4, -0.2, 30], [-3.6, -0.4, 33]], [0.4, 0.38, 0.35], antenna);
ell([1.6, 1.6, 1.6], [-4, -0.4, 34.4], gold);
for (a = [0 : 45 : 315]) spike([-4, -0.4, 34.4] + [cos(a), 0, sin(a)] * 1.5, [cos(a), 0, sin(a)] * 1.3, 0.35, 0.05, [1, 0.95, 0.4]);
// Two ribbon streamers curling up.
mirror_x() chain([[0.8, 0.6, 26.4], [1.6, 0.8, 30], [3.6, 1, 33.5], [5.2, 1.4, 35], [6.4, 1.2, 34.6]], [0.45, 0.4, 0.4, 0.35, 0.3], antenna);
// Floating golden halo, tilted, with a small ring on its back edge.
translate([0.6, 1, 29.2]) rotate([-14, 8, 0]) color(gold) rotate_extrude($fn = 40) translate([6.4, 0]) circle(0.38, $fn = 8);
translate([0.6, 3.6, 36.4]) rotate([90, 0, 0]) color(gold) rotate_extrude($fn = 20) translate([1.1, 0]) circle(0.3, $fn = 6);
limb([0.6, 3.6, 35.1], [0.6, 4.4, 32.4], 0.2, 0.2, gold);

// Wings: long pointed petals rimmed in gold, shading from pale gold at the root through mint to sky blue.
module wingPair(rot, len, wid, z) {
  mirror_x() translate([2, 6, z]) rotate([-30, 0, 0]) rotate([0, rot, 15]) {
    color(wingEdge) hull() {
      scale([wid * 0.5, 0.25, 1]) sphere(1, $fn = 16);
      translate([0, 0, len * 0.8]) scale([wid + 0.4, 0.25, len * 0.5]) sphere(1, $fn = 20);
      translate([wid * 0.3, 0, len * 2.1]) sphere(0.3, $fn = 6);
    }
    for (side = [-1, 1]) {
      color(wingGold) hull() {
        translate([0, side * 0.1, 0.4]) scale([wid * 0.4, 0.25, 0.8]) sphere(1, $fn = 14);
        translate([0, side * 0.1, len * 0.55]) scale([wid * 0.85, 0.25, len * 0.22]) sphere(1, $fn = 16);
      }
      color(wing) hull() {
        translate([0, side * 0.12, len * 0.6]) scale([wid * 0.85, 0.25, len * 0.2]) sphere(1, $fn = 16);
        translate([0, side * 0.12, len * 1.15]) scale([wid * 0.75, 0.25, len * 0.2]) sphere(1, $fn = 16);
      }
      color(wingBlue) hull() {
        translate([0, side * 0.14, len * 1.2]) scale([wid * 0.7, 0.25, len * 0.2]) sphere(1, $fn = 14);
        translate([wid * 0.28, side * 0.14, len * 1.95]) sphere(0.3, $fn = 6);
      }
      for (sp = [[0.3, 0.7], [-0.3, 1.2], [0.25, 1.6]])
        color(sparkle) translate([sp[0] * wid, side * 0.42, sp[1] * len]) scale([0.45, 0.2, 0.45]) sphere(1, $fn = 6);
    }
  }
}
wingPair(42, 9.5, 6.2, 21);
wingPair(124, 6.5, 4.4, 15);
// Floating sparkles around it.
for (p = [[-14, -2, 30], [13, -3, 8], [-12, -1, 6], [15, 2, 24], [-16, 3, 18]]) ell([0.5, 0.5, 0.5], p, [1, 0.95, 0.55]);

// Stubby arms.
mirror_x() {
  limb([7.6, -1, 16.6], [10.6, -2.6, 15.2], 1.8, 1.5, pearl);
}
// Legs.
mirror_x() {
  limb([3.4, 0, 10], [3.6, -0.4, 2.2], 2.8, 2.5, peri);
  ell([2.7, 3.2, 1.8], [3.6, -0.8, 1.8], peri);
}
