// Ravatar (avatar relic): all four relics at once. A pale, glowing Ravatar with a shining arrow, ringed by a water
// wave on one side, a blazing fire fist on the other, a smoky starry cloud over its head and as its tail, rocky
// greaves and floating boulders.
include <lib.scad>

fur = [0.96, 0.92, 0.84];
furHi = [1, 0.98, 0.94];
furDark = [0.8, 0.74, 0.64];
mane = [0.5, 0.48, 0.62];
maneHi = [0.66, 0.64, 0.78];
mark = [0.75, 0.97, 1];
tattoo = [0.8, 0.86, 0.92];
antler = [0.5, 0.36, 0.22];
rock = [0.46, 0.36, 0.22];
rockDark = [0.32, 0.25, 0.16];
tailGrey = [0.5, 0.48, 0.64];
tailCream = [0.72, 0.7, 0.84];
claw = [0.95, 0.92, 0.82];
nose = [0.18, 0.12, 0.1];
eyeIris = [0.85, 1, 1];
water = [0.35, 0.62, 0.86];
waterHi = [0.75, 0.9, 1];
flameRed = [0.92, 0.22, 0.06];
flameOrange = [1, 0.55, 0.1];
flameCore = [1, 0.9, 0.45];
starDot = [1, 0.8, 0.4];

module stroke(pts, r, c = mark) { chain(pts, [for (p = pts) r], c); }
// Swirl tattoo facing direction yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = tattoo) {
  n = 14;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 540, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) 0.3], c, $fn = 6);
}
// Rough rock chunk.
module chunk(p, r, rot = [0, 0, 0], c = rock) { color(c) translate(p) rotate(rot) scale([1.2, 0.9, 1]) sphere(r, $fn = 7); }

// ---- Legs: thick thighs, rocky greaves, clawed feet.
mirror_x() {
  limb([3.6, 0, 16], [5, -0.6, 9], 3, 2.6, fur);
  limb([5, -0.6, 9], [5.4, 0.4, 3], 2.4, 2, fur);
  ell([3, 3, 3.6], [5.3, -0.2, 6], rockDark);
  for (r = [[0, 4, 1.7], [72, 5, 1.6], [144, 4, 1.5], [216, 5.5, 1.6], [288, 4.2, 1.6],
            [20, 8.2, 1.6], [110, 8.6, 1.4], [200, 8, 1.5], [300, 8.4, 1.4]])
    chunk([5.3 + 2.8 * sin(r[0]), -0.2 - 2.8 * cos(r[0]), r[1]], r[2], [r[0] / 3, 20, r[0]], (r[0] % 120 == 0) ? rockDark : rock);
  spike([5.8, -2.6, 9.5], [0.6, -1.2, 2.4], 1, 0.05, rock);
  blob([[[2.6, 3.4, 1.4], [5.6, -1.6, 1.4]], [[2.2, 2, 1.4], [5.6, 0.8, 1.6]]], furDark);
  for (a = [-28, 0, 28]) spike([5.6 + sin(a) * 1.5, -4.8, 1], [sin(a) * 0.5, -1.4, -0.4], 0.55, 0.05, claw);
}

// ---- Hips and the plated rocky loincloth.
ell([6, 4.2, 3.4], [0, 0, 16.5], furDark);
for (x = [-4, -1.4, 1.4, 4]) spike([x, -3.6, 17.5], [x * 0.15, -0.6, -5.5], 1.6, 0.1, (abs(x) < 2) ? rockDark : rock);
for (x = [-3, 0, 3]) spike([x, 3.6, 17.5], [x * 0.15, 0.6, -4.5], 1.5, 0.1, rock);
color(rockDark) translate([0, 0, 17.6]) scale([6.3, 4.5, 1]) cylinder(h = 1.2, r = 1, $fn = 24);

// ---- Torso: V-shaped, muscled chest.
blob([[[4.8, 3.6, 3.6], [0, 0, 20]], [[7.4, 4.6, 4.4], [0, 0, 27]]], fur);
mirror_x() color(furHi) translate([2.4, -3.95, 28.2]) scale([3.2, 0.6, 1.4]) sphere(1, $fn = 14);
for (z = [20.5, 22.5]) mirror_x() color(furHi) translate([1.3, -3.4, z]) scale([1.3, 0.7, 0.8]) sphere(1, $fn = 10);
// Swirl tattoos: chest, shoulders, back.
mirror_x() {
  tswirl([3, -5.1, 27.2], 1.2);
  tswirl([6.4, 3.6, 28], 1.2, 180);
  tswirl([3, 4.6, 25], 1.4, 180);
}
// Shaggy ruff on the chest and shoulders.
for (a = [-70 : 20 : 70]) spike([sin(a) * 5.2, -3 + abs(sin(a)) * 1.2, 30.5], [sin(a) * 1.4, -1.2, -4], 1.3, 0.05, furHi);
for (a = [0 : 30 : 359]) spike([cos(a) * 5, sin(a) * 3.8, 31], [cos(a) * 2.2, sin(a) * 2.2, -2], 1.6, 0.05, fur);
// Spine marking.
stroke([[0, 4.8, 30], [0.8, 4.9, 26.5], [-0.6, 4.5, 23], [0.2, 3.8, 19.5]], 0.75);

// ---- Arms: long, hanging, a little out from the body, clawed hands; stripe tattoos on the forearms.
mirror_x() {
  ell([3, 3, 2.8], [7.2, 0, 28.5], fur);
  limb([7.6, 0, 28], [9.4, -0.6, 21], 2.5, 2.1, fur);
  limb([9.4, -0.6, 21], [10.4, -1.6, 14.5], 2.1, 1.7, fur);
  for (z = [16.5, 18.5]) stroke([[11.3, -1.3, z], [10.6, -2.6, z + 0.6]], 0.3, tattoo);
  ell([1.9, 1.7, 2], [10.6, -1.8, 13], fur);
  for (a = [-30, 0, 30]) spike([10.6 + sin(a) * 1.2, -3, 11.6], [sin(a) * 0.4, -0.8, -1.4], 0.45, 0.05, claw);
}

// ---- Bushy tail: sweeps back and out to the viewer's right, then up; grey over a cream underside.
// A tapering chain of hulled ellipsoids: [radius, point] pairs.
module tailpath(pts, rs, c) { for (i = [0 : len(pts) - 2]) blob([[rs[i], pts[i]], [rs[i + 1], pts[i + 1]]], c); }
tailpath([[2, 4, 15], [7, 6, 9], [12.5, 4.5, 7], [16.5, 2, 10], [18, 0.5, 15], [17.6, 0, 20.5]],
         [[1.8, 1.8, 1.8], [3, 3, 3], [3.6, 3.4, 3.4], [3.4, 3.2, 3.4], [2.6, 2.4, 3], [0.8, 0.8, 1.4]], tailGrey);
tailpath([[7, 4.4, 7.8], [12.5, 2.4, 5.6], [16, -0.2, 8.6], [17, -1.2, 13.5]],
         [[2.6, 2.2, 2.2], [3, 2.4, 2.4], [2.8, 2.2, 2.6], [1.6, 1.4, 2]], tailCream);
for (t = [[10, 7.6, 8.5], [14.5, 5.8, 9], [18.4, 3, 15]]) spike(t, [1.4, 1, 1], 1.2, 0.05, tailGrey);
for (t = [[10, 3.4, 4.6], [14.5, 0.8, 5.2], [18.5, -1.4, 10]]) spike(t, [1.2, -0.6, -1.4], 1.1, 0.05, tailCream);

// ---- Elements.
// Water wave arcing round the viewer's left side from the ground to over the head, curling into a breaker.
translate([0, 3, 20]) rotate([90, 0, 0]) {
  color(water) rotate([0, 0, 95]) rotate_extrude(angle = 150, $fn = 40) translate([17, 0]) scale([1.3, 1.6]) circle(1.8, $fn = 8);
  color(waterHi) rotate([0, 0, 100]) rotate_extrude(angle = 135, $fn = 36) translate([18.2, 0]) circle(0.5, $fn = 6);
}
module curl(p, R, c, w) {
  n = 14;
  chain([for (i = [0 : n]) let(t = i / n, a = 200 - t * 520, rr = R * (1 - 0.8 * t)) p + [rr * cos(a), 0, rr * sin(a)]],
        [for (i = [0 : n]) w * (1 - 0.6 * i / n)], c, $fn = 8);
}
curl([-13.5, 1, 16], 4.5, water, 1.4);
curl([-13.5, 0.2, 16], 2.6, waterHi, 0.5);
// Fire engulfing the fist on the viewer's right.
module tongue(p, d, r, c) { color(c) hull() { translate(p) sphere(r, $fn = 10); translate(p + d) sphere(0.15, $fn = 6); } }
for (t = [[[10.6, -2, 13], [3, -0.5, 6], 2.6, flameRed], [[11, -1, 15], [4.5, 0.5, 4], 2.2, flameRed],
          [[10, -2, 17], [2, -1, 6.5], 1.8, flameOrange], [[11.5, -2.4, 13.5], [3.5, -1, 3], 1.6, flameOrange],
          [[10.5, -1.2, 12], [5, 0, 1], 1.6, flameRed], [[9.6, -1, 19], [1.5, 0, 4], 1.4, flameOrange]])
  tongue(t[0], t[1] * 1.5, t[2] * 1.3, t[3]);
ell([2.4, 2.2, 3], [11.4, -3, 15], flameCore);
ell([3, 2.8, 3.6], [11, -1.8, 15], flameOrange);
// Smoky starry cloud over the head.
for (c = [[0, 3, 44, 3.6], [4, 4, 44.5, 3], [7.5, 4, 43, 2.6], [-3, 3.5, 43.5, 2.6], [10.5, 3.5, 41, 2]])
  ell([c[3] * 1.2, c[3], c[3] * 0.8], [c[0], c[1], c[2]], maneHi);
for (p = [[2, 0, 45.5], [6, 1, 45], [9, 0.8, 43], [-2, 1, 45]]) color(starDot) translate(p) sphere(0.35, $fn = 6);
// Floating boulders.
for (b = [[-15, -2, 30, 1.4], [-11, -3, 5, 1.6], [13, -3, 4, 1.4], [-16, -1, 2, 1.2], [15, 0, 26, 1], [-8, -4, 34, 1]])
  chunk([b[0], b[1], b[2]], b[3], [b[0] * 10, b[2] * 7, 0], rock);
// Glowing feet.
mirror_x() ell([2.8, 3.6, 0.6], [5.6, -1.2, 0.4], waterHi);

// ---- Head: lion-hound with a short muzzle.
blob([[[4.6, 4.2, 4.2], [0, -0.8, 35]], [[3.6, 3.4, 3], [0, -1.6, 32.6]]], fur);
ell([2.6, 2, 1.8], [0, -4.6, 32.6], furHi);
ell([0.9, 0.6, 0.6], [0, -6.4, 33.4], nose);
color(nose) translate([0, -6, 31.6]) scale([1.2, 0.3, 0.3]) sphere(1, $fn = 10);
// Cheek ruff.
mirror_x() for (z = [31, 33]) spike([3.4, -2.6, z], [2, 0.4, -1], 1.2, 0.05, furHi);
// Eyes: narrow and fierce under heavy brows.
mirror_x() {
  eye([2, -4.4, 35], 1, iris = eyeIris, pupil = [0.1, 0.12, 0.16], yaw = -20);
  color(furDark) translate([2.1, -4.9, 36.2]) rotate([0, -18, -20]) scale([1.6, 0.5, 0.45]) sphere(1, $fn = 12);
}
// Arrow marking: point on the brow, band over the crown into the mane.
color(mark) translate([0, -4.95, 36.6]) rotate([-60, 0, 0]) linear_extrude(0.8, center = true)
  polygon([[0, -1.6], [-1.6, 0.6], [-0.8, 0.6], [-0.8, 1.2], [0.8, 1.2], [0.8, 0.6], [1.6, 0.6]]);
stroke([[0, -4, 38], [0, -2.2, 39.2]], 0.8);
// Ears.
mirror_x() spike([3.6, -0.6, 37.6], [1.8, 0.4, 2.2], 1.2, 0.1, fur);
// Short antlers.
mirror_x() {
  chain([[2, -1.2, 38.6], [3, -1, 41], [4.2, -0.8, 43], [5.4, -0.6, 44]], [0.7, 0.6, 0.45, 0.2], antler);
  limb([3.1, -1, 41], [1.8, -1.4, 42.6], 0.45, 0.15, antler);
}
// Wild mane: a big swept mass of spikes behind and above the head, streaming back.
blob([[[5, 4.6, 4], [0, 2, 37.5]], [[4, 3.6, 3], [0, 4.6, 33]]], mane);
for (s = [[-4, 0, 41, -2, 1.4, 3], [-1.5, 0.5, 42, -0.6, 1.6, 4], [1.5, 0.6, 42, 1, 2, 3.8], [4, 0.4, 40.5, 2.6, 2, 2.4],
          [-5, 2, 38, -3.4, 2.4, 1], [5, 2, 38, 3.4, 2.4, 1.2], [0, 3, 40.5, 0, 5, 2.6], [-3, 4, 38, -1.4, 5, 0.6],
          [3, 4, 38, 1.6, 5, 0.6], [0, 5.5, 35, 0, 4, -2], [-3, 5, 33, -1.4, 3, -3], [3, 5, 33, 1.4, 3, -3]])
  spike([s[0], s[1], s[2]], [s[3], s[4], s[5]], 2.1, 0.1, ((s[0] + s[2]) % 2 == 0) ? maneHi : mane);
// Mane-crossing marking down the back of the head.
stroke([[0, 1.5, 42.2], [0, 5, 39.8], [0, 7.4, 35.5], [0, 6.8, 31.5]], 0.75);
