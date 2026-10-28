// Abyssrake: Tidalfang sunk into the deep as a coiled abyssal sea serpent: a navy body ringed in coils on the ground,
// dotted with glowing cyan spots, a slate banded throat, an S-neck rising to a horned head with gaping red jaws and
// fangs, a green eye, and great dark fins veined in cyan fanning behind the head and down the neck.
include <lib.scad>

navy = [0.1, 0.2, 0.36];
navyHi = [0.16, 0.3, 0.48];
navyDark = [0.06, 0.12, 0.22];
slate = [0.45, 0.52, 0.62];
slateLine = [0.32, 0.38, 0.48];
glow = [0.35, 0.88, 1];
finCol = [0.1, 0.34, 0.56];
mouth = [0.6, 0.12, 0.15];
fang = [0.95, 0.9, 0.7];
eyeGreen = [0.5, 1, 0.3];
rock = [0.22, 0.24, 0.3];

// Coils: a spiral of body on the ground, winding in and up.
coil = [for (t = [0 : 30 : 540]) let(r = 14 - t * 0.011) [r * cos(t + 200), 3 + r * 0.8 * sin(t + 200), 3.4 + t * 0.006]];
coilR = [for (i = [0 : len(coil) - 1]) 2.2 + i * 0.12];
chain(coil, coilR, navy);
H = [-3, -6, 36];
// Neck: rises from the inner end of the coil in an S up to the head.
neck = [coil[len(coil) - 1], [-1, -3, 8], [3, -5, 13], [4.4, -4, 19], [1.6, -1.5, 25], [-2.4, -2, 30], [-3, -5, 34]];
neckR = [coilR[len(coilR) - 1], 4.6, 4.4, 4, 3.6, 3.2, 3];
chain(neck, neckR, navy);
// Slate banded throat down the front of the neck.
chain([for (i = [1 : len(neck) - 1]) neck[i] + [0, -neckR[i] * 0.42, 0]], [for (i = [1 : len(neck) - 1]) neckR[i] * 0.66], slate);
for (i = [1 : len(neck) - 2]) for (f = [0, 0.5]) {
  p = neck[i] + (neck[i + 1] - neck[i]) * f;
  r = neckR[i] + (neckR[i + 1] - neckR[i]) * f;
  color(slateLine) translate(p + [0, -r * 0.42, 0]) scale([r * 0.67, r * 0.67, 0.3]) sphere(1, $fn = 16);
}
// Glowing spots along the top and sides of the coils and neck.
for (i = [0 : len(coil) - 2]) for (s = [-1, 1]) {
  p = (coil[i] + coil[i + 1]) / 2;
  d = coil[i + 1] - coil[i];
  side = [-d[1], d[0], 0] / norm([d[0], d[1]]);
  color(glow) translate(p + side * s * coilR[i] * 0.8 + [0, 0, coilR[i] * 0.55]) sphere(0.55, $fn = 8);
  color(glow) translate(p + [0, 0, coilR[i] * 0.98]) sphere(0.45, $fn = 8);
}
for (i = [1 : len(neck) - 2]) for (f = [0, 0.33, 0.66]) for (s = [-1, 1]) {
  p = neck[i] + (neck[i + 1] - neck[i]) * f;
  r = neckR[i] + (neckR[i + 1] - neckR[i]) * f;
  color(glow) translate(p + [s * r * 0.82, r * 0.5, 0]) sphere(0.55, $fn = 8);
}

translate(H) scale(1.3) translate(-H) {
// Head: a long horned skull with jaws gaping open.
blob([[[3.6, 4, 3.2], H], [[2.4, 4, 1.6], H + [0, -5.5, 0.4]]], navy);
// Upper snout ridge and brow spikes.
ell([1.2, 3.2, 0.8], H + [0, -5, 1.8], navyHi);
// Lower jaw, dropped open.
color(navy) translate(H + [0, -1, -2.4]) rotate([-28, 0, 0]) scale([2.4, 5.6, 1.1]) translate([0, -0.8, 0]) sphere(1, $fn = 18);
// Red mouth inside.
color(mouth) translate(H + [0, -5, -2.6]) rotate([-14, 0, 0]) scale([1.9, 3.6, 1.3]) sphere(1, $fn = 16);
// Fangs: upper row hanging down, lower row pointing up.
for (k = [[-1.6, -6.5], [1.6, -6.5], [-1.9, -4.6], [1.9, -4.6], [-1.8, -8.4], [1.8, -8.4]])
  spike(H + [k[0], k[1], -1.2], [0, 0, -1.8], 0.45, 0.05, fang);
for (k = [[-1.4, -6.2], [1.4, -6.2], [-1.6, -4]]) spike(H + [k[0], k[1] - 0.6, -4.8 - (k[1] + 4) * 0.5], [0, 0, 1.5], 0.4, 0.05, fang);
// Green eyes under a heavy brow.
mirror_x_at(H[0]) {
  color(eyeGreen) translate(H + [2.6, -3, 1.2]) rotate([0, 0, -35]) scale([1, 0.5, 0.6]) sphere(1, $fn = 12);
  color(navyDark) translate(H + [2.6, -3.2, 2.2]) rotate([0, -14, -35]) scale([1.6, 0.6, 0.5]) sphere(1, $fn = 12);
  // Swept-back horns.
  limb(H + [1.8, -1, 2.4], H + [3.6, 4.4, 5], 0.9, 0.1, navyHi);
  limb(H + [2.8, 0, 1], H + [5.6, 3.6, 2.4], 0.7, 0.1, navyHi);
}
}
module mirror_x_at(x) { children(); translate([x, 0, 0]) mirror([1, 0, 0]) translate([-x, 0, 0]) children(); }

// Fins: dark membranes with glowing veins, fanned behind the head and down the back of the neck.
module fin(base, rays, col) {
  for (k = [0 : len(rays) - 2]) color(col) hull() {
    translate(base) sphere(0.3, $fn = 6);
    translate(base + rays[k]) sphere(0.3, $fn = 6);
    translate(base + rays[k + 1]) sphere(0.3, $fn = 6);
  }
  for (r = rays) limb(base, base + r * 1.2, 0.5, 0.12, glow);
}
translate(H) scale(1.3) translate(-H) {
mirror_x_at(H[0]) fin(H + [2.6, 1.8, 0.4], [[1, 3, 7], [4, 4, 5], [6, 4, 2], [7, 3, -1.5], [5.6, 2, -4]], finCol);
fin(H + [0, 2.4, 2.4], [[0, 1, 6], [0, 5, 6.4], [0, 8, 4], [0, 9, 0]], finCol);
}
for (i = [2 : len(neck) - 2]) {
  p = neck[i] + [0, neckR[i] * 0.9, 0];
  fin(p, [[0, 1, 2.4], [0, 4.4, 2], [0, 5, -1.2], [0, 3, -3]], finCol);
}
// Ridge spines along the coils.
for (i = [2 : 3 : len(coil) - 2]) spike(coil[i] + [0, 0, coilR[i] * 0.85], [0, 0, 2.2], 0.8, 0.1, finCol);

// A few dark rocks scattered at its base and floating chips around it.
for (r = [[-4, -9, 0.6, 2], [5, -10, 0.6, 1.6], [12, 2, 0.6, 1.4], [-12, 5, 0.6, 1.6]])
  color(rock) translate([r[0], r[1], r[2]]) scale([1.2, 1, 0.6]) sphere(r[3], $fn = 7);
for (r = [[-11, -5, 22], [9, -6, 24], [-12, -2, 18], [11, -2, 18]]) color(navyHi) translate(r) rotate([30, 20, 10]) cube(1.2, center = true);
