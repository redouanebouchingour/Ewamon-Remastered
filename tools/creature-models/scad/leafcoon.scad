// Leafcoon: a green leaf cocoon bound in criss-crossing twine, hanging from a twig by a twine knot; two glowing yellow
// eyes peer out of a dark slit between the wrappings and pointed leaves stick out from the sides.
include <lib.scad>

green = [0.45, 0.66, 0.17];
greenDk = [0.32, 0.5, 0.12];
greenHi = [0.58, 0.76, 0.24];
twine = [0.88, 0.82, 0.55];
bark = [0.42, 0.24, 0.12];
leaf = [0.5, 0.72, 0.2];
eyeGlow = [1, 0.85, 0.15];
slit = [0.08, 0.14, 0.04];

cz = 17;      // cocoon centre height
R = [9, 8, 14];   // cocoon radii

// Cocoon body: an egg, a little fuller at the top.
blob([[[9, 8, 9], [0, 0, cz + 3]], [[7, 6.5, 8], [0, 0, cz - 5]], [[3.5, 3.5, 3], [0, 0, 5]]], green);
// Leaf wrappings: tilted bands slightly proud of the body, alternating shades.
bands = [[cz + 9.5, 14, greenHi], [cz - 0.5, 16, greenHi], [cz - 5.5, -14, greenDk], [cz - 10, 12, green]];
for (b = bands) {
  z = b[0];
  // radius of the egg at this height (approx.)
  k = sqrt(max(0.05, 1 - pow((z - cz) / 15, 2)));
  color(b[2]) translate([0, 0, z]) rotate([b[1] * 0.3, b[1], 0]) scale([9.0 * k, 8.0 * k, 1]) cylinder(h = 3.2, r = 1, center = true, $fn = 32);
}

// Dark slit with glowing eyes, near the top front.
color(slit) translate([0, -6.9, cz + 4]) rotate([8, 0, 0]) scale([6, 1.8, 2.4]) sphere(1, $fn = 20);
mirror_x() color(eyeGlow) translate([2.2, -8.3, cz + 4.1]) rotate([8, 0, -15]) scale([1.4, 0.6, 1.8]) sphere(1, $fn = 14);
mirror_x() color([1, 1, 0.75]) translate([1.9, -8.8, cz + 4.8]) sphere(0.35, $fn = 8);

// Twine: criss-crossing cords spiralling round the cocoon, with little knots.
module cord(phase, dir) {
  for (i = [0 : 23]) {
    t1 = i / 24; t2 = (i + 1) / 24;
    z1 = cz - 11 + 22 * t1; z2 = cz - 11 + 22 * t2;
    k1 = sqrt(max(0.1, 1 - pow((z1 - cz) / 14.5, 2)));
    k2 = sqrt(max(0.1, 1 - pow((z2 - cz) / 14.5, 2)));
    a1 = phase + dir * 540 * t1; a2 = phase + dir * 540 * t2;
    limb([9.3 * k1 * cos(a1), 8.3 * k1 * sin(a1), z1], [9.3 * k2 * cos(a2), 8.3 * k2 * sin(a2), z2], 0.38, 0.38, twine);
  }
}
cord(-60, 1);
cord(-120, -1);
for (p = [[3, -7.6, cz - 3], [-4, -7, cz - 7], [5.5, -6, cz + 7]]) color(twine) translate(p) sphere(0.7, $fn = 10);

// Leaves sticking out of the wrappings.
module pleaf(p, d, w, c = leaf) {
  color(c) hull() {
    translate(p) scale([1, 0.5, 1]) sphere(w * 0.6, $fn = 12);
    translate(p + d * 0.4) scale([1, 0.4, 1]) sphere(w * 1.5, $fn = 16);
    translate(p + d) sphere(0.15, $fn = 6);
  }
}
mirror_x() {
  pleaf([8, -0.5, cz + 4], [6, -1, 1.5], 1.4);
  pleaf([7, -1, cz - 6], [6, -1.5, -2], 1.3);
}
pleaf([0, 7, cz + 1], [0, 5, -1.5], 1.2);
// Leaf tips at the bottom.
mirror_x() pleaf([1.2, -1, 7], [1.5, -0.5, -6.5], 1.4, greenDk);
pleaf([0, -0.5, 7.5], [0, -0.8, -7.4], 1.6, leaf);

// Twine knot at the top, and the twig it hangs from.
color(twine) translate([0, 0, cz + 10.5]) cylinder(h = 3.5, r1 = 3, r2 = 1.3, $fn = 16);
color(twine) translate([0, 0, cz + 11]) scale([3.4, 3.2, 0.9]) sphere(1, $fn = 16);
mirror_x() limb([0.5, 0, cz + 13.5], [1.6, 0, cz + 16.5], 0.5, 0.45, twine);
limb([-11, 0, cz + 18], [11, 0, cz + 15.2], 1.3, 1.0, bark);
limb([-6, 0, cz + 17.3], [-9, 0, cz + 20.5], 0.7, 0.5, bark);
limb([7, 0, cz + 15.7], [10, 0, cz + 12.8], 0.7, 0.5, bark);
pleaf([-10, 0, cz + 17.5], [-2.5, -0.5, -3.5], 1.1);
pleaf([10.5, 0, cz + 15], [1.5, -0.5, -3.5], 1.0);
