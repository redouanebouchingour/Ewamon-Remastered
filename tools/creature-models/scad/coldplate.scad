// Coldplate: a squat golem of bronze plating set with faceted ice panels, a round steel helmet with a T visor,
// heavy ice-clad shoulders and stone fists; its back is bare bronze with a riveted spine ridge.
include <lib.scad>

ice = [0.45, 0.68, 0.92];
iceLight = [0.7, 0.86, 1];
iceDark = [0.3, 0.5, 0.78];
bronze = [0.66, 0.55, 0.38];
bronzeDark = [0.48, 0.38, 0.25];
steel = [0.48, 0.55, 0.66];
steelDark = [0.3, 0.35, 0.44];
stone = [0.45, 0.47, 0.52];
slit = [0.08, 0.1, 0.16];
glow = [0.75, 0.95, 1];

// Ice panel on a sphere surface: azimuth (0 = front, -Y), elevation, size, centre, radii.
module panel(az, el, s, ctr, R, c = ice) {
  n = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)];
  p = ctr + [R[0] * n[0], R[1] * n[1], R[2] * n[2]];
  color(c) translate(p) rotate([0, 0, az]) rotate([90 - el, 0, 0]) rotate([0, 0, 30]) scale([s, s, s * 0.22]) sphere(1, $fn = 6);
}

// Torso: a big round bronze barrel.
T = [0, 0, 20];
TR = [13.5, 11, 12];
ell(TR, T, bronze);
// Ice panels over the front and sides (the front is mostly ice, the back bronze).
for (p = [[-12, 30, 5.4], [14, 32, 5], [-30, 8, 5.4], [0, 8, 5.4], [30, 6, 5.2], [-15, -16, 5.4], [16, -18, 5.2],
          [-45, -22, 4.8], [44, -24, 4.8], [-58, 22, 5], [58, 20, 5], [-72, -8, 4.6], [72, -6, 4.6], [0, -38, 4.8]])
  panel(p[0], p[1], p[2], T, TR + [0.2, 0.2, 0.2], [ice, iceLight, bronze, ice, [0.55, 0.58, 0.62]][(abs(p[0]) + abs(p[1])) % 5]);
// Bronze belt around the hips.
color(bronzeDark) translate([0, 0, 10.5]) scale([12, 9.8, 2.2]) sphere(1, $fn = 32);
// Back spine ridge: stacked riveted bronze segments.
for (i = [0 : 5]) ell([2.6 - i * 0.15, 1.6, 1.5], [0, TR[1] + 0.4 - abs(i - 2.5) * 0.25, 13.5 + i * 2.6], bronzeDark);
for (s = [-1, 1]) for (i = [0 : 3]) ell([4, 1, 0.8], [s * 4, TR[1] - 1.4, 15 + i * 3], bronzeDark);

// Helmet: a steel dome sitting low in the shoulders, bronze rim, dark T-shaped visor slit with faint eye glints.
H = [0, -4.5, 31];
ell([6.4, 6.2, 6.6], H, steel);
ell([6.9, 6.8, 1.5], H + [0, 0.3, -3.6], bronzeDark);
// Visor: carve the T into the dome front.
color(slit) translate(H + [0, -5.4, 0.8]) rotate([8, 0, 0]) cube([8, 2.4, 1.6], center = true);
color(slit) translate(H + [0, -5.8, -1.6]) rotate([8, 0, 0]) cube([1.6, 2, 4.6], center = true);
mirror_x() color(glow) translate(H + [2.2, -6.3, 0.8]) sphere(0.6, $fn = 8);
ell([1, 5.4, 1], H + [0, 0.3, 5.9], steelDark);

// Shoulders: big rounded ice pads with bronze rims, arms of ice and bronze, stone fists hanging low.
mirror_x() {
  ell([6.6, 6.6, 6], [12.5, 0, 27.5], bronze);
  ell([6.2, 6.4, 5.8], [12.8, -0.4, 28.2], ice);
  panel(90, 40, 3.2, [12.8, -0.4, 28.2], [6.2, 6.4, 5.8], iceLight);
  panel(20, 15, 3, [12.8, -0.4, 28.2], [6.2, 6.4, 5.8], iceLight);
  limb([15, 0, 24], [17.5, -0.5, 18], 3.8, 3.4, ice);
  ell([3.8, 3.8, 2.2], [17.5, -0.6, 17.4], bronze);
  blob([[[4.4, 4.2, 4], [18, -1.6, 14]], [[3.6, 3.6, 3], [18, -2.6, 10.5]]], iceDark);
  blob([[[4.6, 4.6, 3.8], [18, -3, 7.5]], [[3.8, 3.8, 2.6], [18, -3.4, 5.2]]], stone);
  for (k = [-1.6, 0, 1.6]) ell([1.1, 1.4, 1.2], [18 + k, -7.2, 6.4], steelDark);
}

// Legs: short and wide, round bronze knees, ice shins, bronze feet.
mirror_x() {
  limb([6, 0, 10], [7.5, -1, 6.5], 4.2, 4, ice);
  ell([2.8, 2, 2.6], [7.6, -4.6, 6.8], bronze);
  limb([7.5, -1, 6.5], [7.8, -1, 2.5], 4, 4, ice);
  panel(0, 0, 2.4, [7.8, -1, 4], [3.4, 3.4, 3.4], iceLight);
  blob([[[4.6, 5.8, 1.8], [7.8, -1.8, 1.8]]], bronze);
}

// Loose ice shards and grit around the feet.
for (p = [[-23, -3, 10, 20], [-24, -1, 5, -15], [-22, -4, 2, 10], [23, -3, 4, -20], [24, -2, 9, 15], [22, -4, 14, 0]])
  color(iceLight) translate([p[0], p[1], p[2]]) rotate([0, p[3], 0]) scale([0.8, 0.5, 1.8]) sphere(1, $fn = 6);
for (p = [[-17, -2, 25], [18, -2, 26]]) color(bronze) translate(p) rotate([0, 20, 0]) scale([0.5, 0.4, 1.2]) sphere(1, $fn = 6);
