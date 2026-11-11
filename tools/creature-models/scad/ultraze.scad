// Ultraze: a hunched gunmetal battle robot in a wide combat stance. Checklist (front sheet, x = sheet x):
//   head: skull helm at x -10..-0.4, z 25.5..36.5, thrust forward left of the chest, face to the viewer. Pale bone
//         face, two angry slanted glowing red eyes (inner corners low), red streaks running up from them, a dark
//         triangle nose, an open glowing orange maw with jagged pale teeth, a pale chin; a curved silver horn blade
//         rising on each side of the helm.
//   torso: polished chrome. A chest plate holding the red glowing core (-1, 23), silver pec plates, ribbed abs with
//         red lines in the seams, a pelvis with a silver belt, a big plated hump on the upper back behind the head.
//   +X shoulder: a huge layered pauldron (7.7, 28.8) r 4.2 (dome, band, rim, red trim); the -X one as big, lower,
//         behind the head. Every limb is 2 or 3 overlapping chrome bands with red cable rings in the seams.
//   +X arm hanging: a huge armoured gauntlet: elbow (11.5, 21.5), a massive banded forearm with tall pointed outer
//         plates (13..18.6, 12..26.5) edged red, a big clawed hand (13, 14) hanging low, claws to z 8.5.
//   -X arm raised: short upper arm, elbow ring (-8, 18), forearm up-out to the wrist (-15, 22.5) with plates and a dark
//         underside fin (red edge) spurring back past the elbow to (-7.5, 14.3); open hand (-16, 24.5), four claws up.
//   legs: wide stance, armoured thighs, silver knee caps, dark shins, three-toed silver-clawed feet splayed outwards;
//         the +X leg forward (foot 9..15.5, z 0..5), the -X leg stepped back (knee pad (-6.5, 10.8), foot -10.4..-1).
//   back: exhaust stacks on the hump (1.2, 36.7) and (8, 36.2) puffing dark red smoke up and right to z 40; layered
//         back plates; red cables down the spine.
include <lib.scad>
$fs = 0.85;

dark = [0.2, 0.18, 0.21];
metal = [0.46, 0.45, 0.5];
chrome = [0.56, 0.57, 0.61];
chromeHi = [0.74, 0.76, 0.79, NOGLOW];
bone = [0.86, 0.88, 0.9, NOGLOW];
cable = [0.86, 0.24, 0.18, NOGLOW];
trim = [0.55, 0.14, 0.13, NOGLOW];
coreC = [1, 0.12, 0.2, GLOW];
coreHot = [1, 0.62, 0.66, GLOW];
eyeC = [1, 0.18, 0.08, GLOW];
eyeHot = [1, 0.52, 0.1, GLOW];
mawC = [1, 0.3, 0.08, GLOW];
mawHot = [1, 0.66, 0.16, GLOW];
smoke = [0.6, 0.13, 0.1, NOGLOW];
smokeHot = [0.92, 0.3, 0.12, NOGLOW];
steel = chromeHi;

// An ellipsoid with a modest facet count (keeps the triangle budget).
module el(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
// lib.scad blob() with fewer facets.
module bl(parts, c, fn = 20) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
// A raised red cable along points.
module cab(pts, r = 0.24) { chain(pts, [for (p = pts) r], cable); }
// A limb from a to b as n overlapping chrome armour bands round a dark core: each band flares at its top and tucks
// in at its foot, and a red cable ring shows in each seam.
module bands(a, b, ra, rb, n, gap = 0.08) {
  d = b - a;
  L = norm(d);
  limb(a, b, ra * 0.8, rb * 0.8, dark, $fs = 1.3);
  for (i = [0 : n - 1]) {
    t0 = i / n;
    t1 = (i + 1) / n - (i < n - 1 ? gap : 0);
    r0 = ra + (rb - ra) * t0;
    r1 = ra + (rb - ra) * t1;
    color(i % 2 == 0 ? chromeHi : chrome) translate(a + d * t0) rotate(_dir_rot(d))
      cylinder(h = L * (t1 - t0), r1 = r0 * 1.06, r2 = r1 * 0.92, $fn = 20);
    if (i < n - 1) color(cable) translate(a + d * (t1 + gap / 2)) rotate(_dir_rot(d))
      cylinder(h = L * gap * 0.7, r = r1 * 0.88, center = true, $fn = 16);
  }
}
// A layered pauldron: a chrome shell under a bright cap, a dark seam line and a red trim ring low down.
module pauldron(c, k = 1) {
  el([4.2, 4.2, 3.7] * k, c, chrome, 22);
  el([3.6, 3.6, 3] * k, c + [0.3, -0.4, 1.1] * k, chromeHi, 20);
  color(dark) translate(c + [0, 0, -1.2] * k) cylinder(h = 0.45 * k, r = 4.05 * k, center = true, $fn = 24);
  color(trim) translate(c + [0, 0, -2.4] * k) cylinder(h = 0.5 * k, r = 3.3 * k, center = true, $fn = 24);
  el([1, 0.5, 1] * k, c + [-1.4, -3.7, -1] * k, chromeHi, 12);
}
// An exhaust stack from a to b: a grey pipe, a bright rim and a dark mouth.
module stack(a, b, r) {
  d = b - a;
  color(metal) translate(a) rotate(_dir_rot(d)) cylinder(h = norm(d), r = r, $fn = 14);
  color(chromeHi) translate(b) rotate(_dir_rot(d)) cylinder(h = 0.4, r = r * 1.2, $fn = 14);
  color(dark) translate(b) rotate(_dir_rot(d)) cylinder(h = 0.45, r = r * 0.65, $fn = 12);
}
// A claw / finger from base through mid to tip.
module claw(pts, r = 0.55, c = chromeHi) { chain(pts, [r, r * 0.8, 0.08], c); }

// ---- torso (pivot at the hips) ----
// Pelvis with a chrome belt and a bright groin plate.
el([4.4, 3.4, 2.4], [1.5, 1, 15], dark);
el([4.7, 3.7, 0.9], [1.5, 1, 16.6], chrome);
petal([1.6, 0.8, 1.8], [1.4, -2.3, 14.4], [10, 0, 0], chromeHi);
// Ribbed waist: side bands, two columns of ab plates, red lines in the seams.
el([3.2, 2.7, 3.2], [1.2, 0.6, 19.5], dark);
for (z = [18, 19.6, 21.2]) {
  el([3, 2.4, 0.6], [1.2, 0.4, z], metal, 12);
  for (x = [0, 2.4]) el([1.1, 0.8, 0.68], [x, -1.9, z], chrome, 10);
}
cab([[1.2, -2.5, 22], [1.2, -2.6, 19.8], [1.3, -2.4, 17.4]]);
cab([[-1.4, -1.9, 22.2], [-1.6, -1.8, 20], [-1.4, -1.3, 17.6]]);
cab([[3.8, -1.8, 21.8], [4, -1.7, 19.6], [3.8, -1.2, 17.6]]);
// Chest and the hump of the upper back.
bl([[[5.4, 4, 3.4], [1.5, 0, 24]], [[6.4, 4.6, 3.2], [1.8, 1, 27]]], metal);
bl([[[6.2, 4.6, 4.2], [2, 3, 29.5]], [[4.4, 3.4, 2.4], [1.6, 2.4, 32.2]]], chrome);
// Collar plates between the helm and the big pauldron.
petal([2.8, 1, 1.7], [2.6, -1.6, 31.4], [-30, 0, -20], chromeHi);
petal([2.4, 1, 1.4], [4.4, 0.4, 33], [-40, 0, -20], chrome);
// The -X flank under the raised arm.
el([3, 3, 3.4], [-2.2, -0.2, 21.8], metal);
cab([[-3.6, -2.2, 23.6], [-4.6, -1.6, 21.4], [-4.2, -1.2, 19]]);
// Pec plates, and the chest plate holding the core low between them.
translate([1.5, 0, 0]) mirror_x() {
  petal([3, 1.3, 2.3], [2.6, -3.2, 25.6], [0, 14, -16], chrome);
  petal([2.4, 0.8, 0.7], [2.5, -3.9, 27.4], [0, 10, -16], chromeHi);
}
el([3.3, 1.1, 2.6], [1.4, -3.2, 23.4], chrome, 20);
el([1.8, 0.6, 1.8], [1.4, -4.25, 23.2], trim);
el([1.25, 0.75, 1.25], [1.4, -4.5, 23.2], coreC);
el([0.55, 0.4, 0.55], [1.25, -5.15, 23.4], coreHot);
// Neck under the helm, cables running down from it into the chest.
el([2.6, 2.6, 2.4], [-2.5, -3, 28.6], dark);
cab([[-3.6, -4.6, 29.6], [-1.8, -4.4, 27.6], [-0.6, -3.6, 25.8]]);
cab([[-2.4, -4.9, 30.6], [-0.6, -4.5, 28.6], [0.6, -3.9, 27.2]]);
// Layered back plates and the spine cables.
for (b = [[32.4, 5.4, 4], [30.2, 6.6, 5], [27.8, 7, 5.4], [25.3, 6.6, 5]])
  color(chromeHi) translate([2, b[1] - 0.3, b[0]]) rotate([-25, 0, 0]) scale([b[2] * 0.85, 1, 1.5]) sphere(1, $fn = 14);
cab([[0.8, 4.2, 23.6], [0.6, 3.5, 20], [0.8, 4, 16.8]], 0.28);
cab([[3.2, 4.2, 23.6], [3.4, 3.5, 20], [3.2, 4, 16.8]], 0.28);
// Pauldrons: the +X one big and high, the -X one as big, lower, behind the head.
pauldron([9.2, 1.4, 28.8], 1.1);
pauldron([-9.2, 0.6, 27], 1.05);
spike([12, 3.6, 30.6], [1.4, 1.6, 2.2], 0.7, 0.05, chromeHi);
spike([-11.4, 3, 29], [-1.3, 1.6, 2], 0.6, 0.05, chromeHi);
// Exhaust stacks on the hump.
stack([-0.3, 3, 31.5], [-0.4, 3.2, 36.2], 0.95);
stack([3.8, 4.2, 32], [6.2, 5.8, 35.6], 1.15);
stack([6.6, 4.8, 31.5], [8.2, 6.2, 34.2], 0.8);
stack([1.8, 6, 31.5], [2, 6.8, 35.2], 0.85);
// Red smoke curling up and away to the right.
chain([[-0.4, 3.2, 36.9], [-0.3, 3, 38], [1, 3, 38.6], [2.3, 3, 38.3], [3.2, 3, 38.9]], [0.75, 0.7, 0.6, 0.45, 0.25], smoke);
el([0.7, 0.6, 0.6], [-0.4, 3.2, 37], smokeHot);
chain([[6.5, 6, 36.4], [7.7, 6.2, 37.4], [9.2, 6.2, 37.8], [10.8, 6.2, 38.3], [12.4, 6.2, 38.8], [13.8, 6.2, 39.2]], [1, 0.85, 0.7, 0.55, 0.45, 0.25], smoke);
el([0.95, 0.8, 0.8], [6.6, 6, 36.5], smokeHot);
chain([[8.6, 6.4, 34.8], [9.6, 6.4, 35.6], [10.8, 6.4, 36], [11.8, 6.4, 36.6]], [0.6, 0.5, 0.4, 0.2], smoke);
for (s = [[0.4, 3, 39.6, 0.35], [4.8, 4, 39.2, 0.3], [13.6, 6.2, 39.3, 0.35], [11.5, 6, 39.6, 0.25], [13.8, 6.4, 37.2, 0.3]])
  color(smoke) translate([s[0], s[1], s[2]]) sphere(s[3], $fn = 8);

// ---- +X arm: a huge armoured gauntlet hanging low ----
bands([9.6, 0.8, 26.2], [14.4, 1.4, 23], 2.3, 2.1, 2);
el([2.2, 2.2, 2.2], [14.6, 1.4, 22.8], chrome);
bands([14.6, 1.4, 22.8], [16.4, -0.6, 15.4], 3.1, 2.6, 3);
// Tall pointed outer plates, the upper one overlapping the lower, edged red.
color(chromeHi) hull() {
  translate([17, 1.9, 26.8]) sphere(0.5, $fn = 8);
  for (q = [[19.4, 1.6, 23.6], [20.2, 0.9, 19.8], [17.6, 0.3, 19.6], [16.2, 1.6, 23.8]]) translate(q) sphere(0.75, $fn = 10);
}
color(chrome) hull() {
  for (q = [[20.4, 1, 20.6], [20.2, -0.2, 15.4], [18.6, -1, 13.6], [17, -0.8, 15.2], [17.4, 0.6, 20.4]]) translate(q) sphere(0.8, $fn = 10);
}
cab([[19.9, 1.7, 24.2], [20.9, 1, 20.4], [20.8, -0.1, 15.6], [19.2, -1, 13.3]], 0.32);
// The big clawed hand under it.
el([1.8, 1.8, 1.6], [16.4, -0.6, 15.2], dark);
el([2.4, 2, 2], [16.2, -1.6, 13], metal);
el([2.3, 1.4, 1.1], [16.3, -2.6, 14], chrome);
translate([16.2, -1.6, 13]) rotate([0, 0, 30]) {
  claw([[-1.6, -0.6, -0.6], [-2.8, -1.6, -1.6], [-3.9, -1.2, -2.6]], 0.62);
  claw([[-0.8, -0.8, -1.2], [-1.3, -1.9, -3.2], [-1.9, -1.4, -4.6]], 0.62);
  claw([[0.4, -0.8, -1.3], [0.6, -1.9, -3.4], [0.5, -1.4, -5]], 0.62);
  claw([[1.5, -0.8, -1.1], [2.6, -1.8, -2.8], [3.6, -1.3, -4.2]], 0.62);
}

// ---- -X arm: raised, the claw open ----
el([2.3, 2.3, 2.3], [-8.6, -1.6, 22.3], metal);
bands([-8.8, -0.5, 24.5], [-7.6, -3, 18.3], 2.2, 1.8, 2);
el([1.6, 1.6, 1.6], [-7.6, -3, 18.3], chrome);
bands([-7.6, -3, 18.3], [-14.4, -5, 22.5], 2.2, 1.9, 3);
// Underside fin spurring back past the elbow, red along its edge.
color(metal) hull() {
  translate([-7, -2.4, 14.4]) sphere(0.4, $fn = 8);
  translate([-7.8, -3, 17.6]) sphere(0.7, $fn = 10);
  translate([-11, -4, 16.6]) scale([1.4, 0.6, 1.2]) sphere(1, $fn = 12);
  translate([-14.6, -5, 18.6]) scale([1.2, 0.6, 1]) sphere(1, $fn = 12);
  translate([-14.4, -5, 21.6]) sphere(0.7, $fn = 10);
  translate([-16.6, -5.2, 20.4]) sphere(0.45, $fn = 8);
}
cab([[-7, -2.5, 14.2], [-11, -4.1, 15.5], [-14.6, -5.1, 17.7], [-16.6, -5.2, 20.1]], 0.3);
// Open hand, the palm to the viewer, four claws curling up.
translate([-15.3, -5.5, 24.6]) rotate([0, 0, 30]) {
  el([2, 0.9, 2.1], [0, 0, 0], metal);
  el([1.7, 0.6, 1.6], [0, 0.5, 0.1], chrome);
  for (f = [[-1.6, -1.9, 3.6, -1.6, 5.6], [-0.5, -0.3, 4, 0.7, 6], [0.6, 1.3, 3.6, 2.6, 4.8], [1.7, 2.8, 2.4, 4.3, 2.6]]) {
    limb([f[0], -0.2, 1.6], [f[1], -0.4, f[2]], 0.6, 0.5, metal);
    claw([[f[1], -0.4, f[2]], [(f[1] + f[3]) / 2, -1, (f[2] + f[4]) / 2 + 0.3], [f[3], -1.4, f[4]]], 0.5);
  }
}

// ---- +X leg: forward ----
bands([4, 0.6, 15.5], [12.2, -3, 10], 3.1, 2.4, 3);
cab([[3.4, -2.4, 14.6], [6.4, -4.1, 12.6], [8.8, -5, 10.6]]);
el([2.1, 2.1, 2.1], [12.2, -3, 10], dark);
el([2.1, 1.5, 2.2], [12.4, -4.5, 10], chromeHi);
bands([12.2, -3, 10], [15.4, -2.6, 4.6], 2.5, 2.1, 2);
translate([16.2, -3.2, 0]) rotate([0, 0, 30]) {
  bl([[[2.3, 2.2, 1.3], [0, 0, 1.6]], [[1.6, 1.6, 1.4], [-0.2, 0.9, 3]]], metal);
  el([1.8, 1.6, 0.9], [0, -0.5, 2.6], chrome);
  for (x = [-1, 0, 1]) claw([[1.6 * x, -1.7, 1.3], [2.1 * x, -3, 1], [2.8 * x, -4, 0.1]], 0.7);
  spike([0, 1.8, 1.2], [0, 1.4, -1], 0.55, 0.05, chromeHi);
}

// ---- -X leg: stepped back ----
bands([-1.2, 1, 15.5], [-5, -1, 10.8], 3, 2.3, 3);
cab([[-2.6, -2.1, 14.6], [-4.4, -3.2, 12.2]]);
el([1.9, 1.9, 1.9], [-5, -1, 10.8], dark);
el([2, 1.5, 2.1], [-6, -2.7, 10.8], chromeHi);
// The shin folds back to a calf joint, then down to the ankle.
bands([-5, -1, 10.8], [-3, 2.2, 8.6], 2.1, 1.8, 1);
el([1.8, 1.8, 1.8], [-3, 2.2, 8.6], chrome);
bands([-3, 2.2, 8.6], [-5.6, 3.6, 3.6], 1.9, 1.6, 2);
translate([-7, 1.4, 0]) rotate([0, 0, -30]) {
  bl([[[2.2, 2.4, 1.3], [0, 0, 1.5]], [[1.5, 1.5, 1.4], [0, 2.2, 3]]], metal);
  el([1.7, 1.7, 0.9], [0, -0.6, 2.5], chrome);
  for (x = [-1, 0, 1]) claw([[1.4 * x, -1.8, 1.3], [1.8 * x, -3.2, 1], [2 * x, -4.6, 0.1]], 0.7);
  spike([0, 2.6, 1.2], [0, 1.6, -1], 0.55, 0.05, chromeHi);
}

// ---- head: a skull helm, turned a little to the viewer ----
translate([-4.4, -5, 31.8]) rotate([0, 0, 20]) {
  // Helm and the pale skull face.
  bl([[[3.8, 3.6, 3.6], [0, 0.6, 1.6]], [[3.2, 3.2, 2.6], [0, 0.4, -1.2]]], metal);
  bl([[[2.9, 2, 2.8], [0, -1.8, 1.6]], [[2.3, 1.7, 1.6], [0, -2.2, -1.4]]], bone);
  el([1.3, 3, 1], [0, 0.8, 4.6], steel);
  // Angry slanted eyes in dark sockets, red streaks running up from them.
  mirror_x() {
    color(dark) translate([1.5, -3.2, 0.95]) rotate([0, -22, 0]) scale([1.3, 0.5, 0.75]) sphere(1, $fn = 14);
    color(eyeC) translate([1.55, -3.45, 0.9]) rotate([0, -22, 0]) scale([0.95, 0.42, 0.42]) sphere(1, $fn = 14);
    color(eyeHot) translate([1.4, -3.8, 0.85]) rotate([0, -22, 0]) scale([0.5, 0.2, 0.22]) sphere(1, $fn = 10);
    limb([0.8, -3.78, 1.8], [1.8, -2.92, 3.2], 0.16, 0.14, cable);
  }
  // Triangle nose.
  color(dark) hull() {
    translate([-0.4, -3.6, -0.1]) sphere(0.3, $fn = 8);
    translate([0.4, -3.6, -0.1]) sphere(0.3, $fn = 8);
    translate([0, -3.55, -0.85]) sphere(0.2, $fn = 8);
  }
  // The glowing maw and the upper fangs.
  el([1.9, 0.9, 1.5], [0, -3.3, -2.2], mawC);
  el([1.2, 0.55, 0.8], [0, -3.7, -2.4], mawHot);
  for (x = [-1.3, -0.45, 0.45, 1.3]) spike([x, -3.95, -0.75], [0, -0.1, -1.2], 0.36, 0.05, bone);
  // Lower jaw: pale chin, dark hinges, fangs up.
  el([1.8, 1.4, 0.95], [0, -2.7, -4.4], bone);
  mirror_x() limb([2, -1, -3], [1.4, -2.4, -4.3], 0.7, 0.6, dark);
  for (x = [-1.4, -0.5, 0.5, 1.4]) spike([x, -3.85, -3.7], [0, -0.1, 1.1], 0.33, 0.05, bone);
  // Curved horn blades rising on both sides of the helm.
  mirror_x() chain([[3.5, 0.3, -1.2], [4.1, 0.6, 1.4], [4.2, 0.8, 3.8], [3.6, 0.7, 5.8]], [0.75, 0.6, 0.4, 0.08], steel);
}
