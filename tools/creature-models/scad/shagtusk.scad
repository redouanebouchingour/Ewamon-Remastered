// Shagtusk: a heavy woolly mammoth, a rounded bean of shaggy brown fur clumps highest over the shoulders and sloping
// to a round rump. Irregular snow sheets lie on its back and head and drip over the fur, a ridge of ice spikes runs
// along the spine; a big low head merged into the body under a shaggy forelock, fierce blue eyes, a short thick
// trunk, chunky crystal-ice tusks, thick legs with pale icy toenails and an ice-tipped tail.
include <lib.scad>

fur = [0.55, 0.33, 0.17];
furDk = [0.4, 0.23, 0.11];
furDeep = [0.3, 0.17, 0.08];
snow = [0.78, 0.9, 0.97];
ice = [0.6, 0.82, 0.97];
iceDk = [0.4, 0.62, 0.88];
nail = [0.8, 0.9, 0.96];

// Deterministic jitter in [0, 1).
function rnd(i) = let(x = sin(i * 127.1 + 31.7) * 4375.85) x - floor(x);
function eP(c, r, az, el) = c + [r[0] * cos(el) * sin(az), -r[1] * cos(el) * cos(az), r[2] * sin(el)];
function eN(r, az, el) = let(n = [cos(el) * sin(az) / r[0], -cos(el) * cos(az) / r[1], sin(el) / r[2]]) n / norm(n);
function inE(p, c, r, f = 1) = pow((p[0] - c[0]) / r[0], 2) + pow((p[1] - c[1]) / r[1], 2) + pow((p[2] - c[2]) / r[2], 2) < f * f;

// Body: an egg / bean, highest over the shoulders, sloping down to a rounded rump, longer than tall.
shC = [0, -2, 17]; shR = [11, 9, 10];
ruC = [0, 9, 13.5]; ruR = [10, 8.5, 8.5];
beC = [0, 3, 10]; beR = [10.5, 11, 5];
module bodyShape(g = 0) hull() {
  translate(shC) scale(shR + [g, g, g]) sphere(1, $fn = 28);
  translate(ruC) scale(ruR + [g, g, g]) sphere(1, $fn = 26);
  translate(beC) scale(beR + [g, g, g]) sphere(1, $fn = 24);
}
color(furDk) bodyShape();

// A shaggy fur clump hanging down from surface point p (normal n): a round root, a fuller middle swinging out, a
// soft tip, nudged sideways by tw so the rows don't line up.
module clump(p, n, len, w, c, tw) color(c) hull() {
  translate(p - n * 0.4) scale([1, 1, 0.8]) sphere(w, $fn = 8);
  translate(p + n * w * 0.55 - [0, 0, len * 0.5] + tw) sphere(w * 0.85, $fn = 8);
  translate(p + n * w * 0.35 - [0, 0, len] + tw * 1.6) sphere(w * 0.38, $fn = 8);
}
// Snow sheets: regions of the fur where the clumps are snow instead (the jittered clumps give the sheets ragged
// edges, and the fringe clumps hang lower as drip tongues), [centre, radii].
snowR = [[[0, -4, 28], [12, 9.5, 9.5]], [[0, 11.5, 23], [10, 8, 7.4]], [[12, 4, 13.5], [3.6, 5.4, 3]],
         [[-12, 2, 14], [3.6, 5, 3]], [[0, -12.5, 25], [9.5, 7, 5.6]]];
function inAny(p, regs, f) = len([for (s = regs) if (inE(p, s[0], s[1], f)) 1]) > 0;
// Clumps over an ellipsoid's surface, skipping the parts buried in the other body masses (or the face, azimuths
// within `face` of the front below elevation 40); sizes, spacing and sway jittered.
module furOver(c, r, els, seed, skip, col2 = furDk, face = 0) {
  for (ei = [0 : len(els) - 1]) let(el0 = els[ei], m = max(5, round(20 * cos(el0))))
    for (k = [0 : m - 1]) let(id = seed + ei * 37 + k, az = k * 360 / m + ei * 11 + rnd(id) * 9,
                              el = el0 + (rnd(id + 5) - 0.5) * 6, p = eP(c, r, az, el), n = eN(r, az, el),
                              azf = abs(((az + 180) % 360) - 180),
                              core = inAny(p, snowR, 1), fringe = !core && inAny(p, snowR, 1.3) && rnd(id + 17) < 0.5)
      if (len([for (s = skip) if (inE(p, s[0], s[1], s[2] == undef ? 0.97 : s[2])) 1]) == 0 && !(azf < face && el < 40))
        clump(p, n, (3.4 + rnd(id + 9) * 2.2) * (el > 45 ? 0.6 : 1) * (fringe ? 1.35 : 1), 2 + rnd(id + 3) * 1,
              core || fringe ? snow : (rnd(id + 7) < 0.55 ? fur : col2), [rnd(id + 11) - 0.5, rnd(id + 13) - 0.5, 0] * 1.2);
}
furOver(shC, shR, [-38, -22, -6, 10, 26, 42, 58], 0, [[ruC, ruR], [hC, hR, 1.2]]);
furOver(ruC, ruR, [-34, -18, -2, 14, 30, 46], 500, [[shC, shR]]);

// Legs: thick shaggy pillars below the fur skirt, pale blue-white toenails.
for (p = [[6.6, -4], [-6.6, -4], [6.4, 10.5], [-6.4, 10.5]]) {
  limb([p[0], p[1], 9], [p[0], p[1], 2.2], 3.9, 3.7, fur);
  for (a = [20 : 72 : 359]) let(id = 900 + a + p[1])
    clump([p[0] + 3 * sin(a), p[1] - 3 * cos(a), 6.4], [sin(a), -cos(a), 0], 2.6, 1.4, rnd(id) < 0.5 ? fur : furDk, [0, 0, 0]);
  for (t = [-1, 0, 1]) ell([1.05, 0.9, 1], [p[0] + t * 1.8, p[1] - 3.3, 1], nail);
}
// Tail with an ice tip, sticking out behind.
limb([0, 16, 15], [0, 20.5, 11.5], 1.1, 0.8, fur);
spike([0, 20.5, 11.5], [0, 2.6, -1.6], 1.2, 0.1, ice);

// Head: big and low, merged into the front of the body; a dark brown face under a shaggy crown and forelock.
hC = [0, -11.5, 15.5]; hR = [8.6, 7, 8];
color(fur) translate(hC) scale(hR) sphere(1, $fn = 26);
fC = [0, -14.9, 13]; fR = [6.4, 4.2, 6.4];
color(furDk) translate(fC) scale(fR) sphere(1, $fn = 24);
// Shaggy fur over the top and sides of the head.
furOver(hC, hR, [12, 30, 48], 1200, [[shC, shR]], fur, 55);
translate([0, -1.5, 0]) {
// Forelock: clumps hanging from the crown forward over the scowling brow, between the eyes.
for (f = [[-2.4, 0], [0, 1], [2.4, 2], [-1.2, 3], [1.3, 4]]) let(id = 1500 + f[1])
  clump([f[0], -15.6 + abs(f[0]) * 0.2, 21.4 - f[1] % 2 * 0.6], [0, -0.9, 0.4], 3.6 + rnd(id) * 1.2, 1.7, f[1] % 2 == 0 ? fur : furDk,
        [0, -0.5, 0]);
// Fierce blue eyes sunk into the face under a heavy shaggy brow slanting down to the trunk.
mirror_x() {
  eye([4, -16, 15], 2, iris = [0.2, 0.6, 1], pupil = [0.03, 0.1, 0.35], sclera = [0.72, 0.88, 1], yaw = 10,
      flat = 0.55, lid = 0.46, lid_tilt = 32, lid_c = furDeep, slit = 0.45);
  color(furDeep) hull() {
    translate([6.2, -15, 17.7]) scale([1.8, 1.5, 1]) sphere(1, $fn = 12);
    translate([1.6, -17.5, 16.7]) scale([1, 1.1, 0.7]) sphere(1, $fn = 10);
  }
}
// Trunk: short and thick, ridged, curling slightly forward at the tip.
trunk = [[0, -16.6, 11.5], [0, -18.6, 7.6], [0, -19.4, 4.6], [0, -20.4, 2.6], [0, -21.8, 3]];
trunkR = [3.5, 3.1, 2.6, 2.1, 1.6];
chain(trunk, trunkR, furDk);
for (i = [0 : 2]) for (f = [0.35, 0.8]) let(p = trunk[i] + (trunk[i + 1] - trunk[i]) * f, r = trunkR[i] + (trunkR[i + 1] - trunkR[i]) * f)
  color(furDeep) translate(p) rotate([-14, 0, 0]) scale([r * 1.04, r * 1.04, 0.32]) sphere(1, $fn = 14);
// Tusks: short, chunky faceted ice crystals from under the cheeks, forward and down, then tipping up.
mirror_x() {
  color(ice) hull() {
    translate([4.4, -16.8, 9.4]) rotate([0, 0, 15]) sphere(1.7, $fn = 6);
    translate([5.4, -20.6, 7.2]) rotate([0, 0, 15]) sphere(1.3, $fn = 6);
  }
  color(ice) hull() {
    translate([5.4, -20.6, 7.2]) rotate([0, 0, 15]) sphere(1.3, $fn = 6);
    translate([5.9, -23.6, 8.4]) sphere(0.15, $fn = 6);
  }
  color(iceDk) hull() {
    translate([5.1, -19.6, 7.4]) rotate([0, 0, 45]) sphere(1.05, $fn = 4);
    translate([5.8, -23, 8.2]) sphere(0.15, $fn = 4);
  }
}

}

// Snow under the snow clumps, so the sheets read solid between them.
color(snow) intersection() {
  bodyShape(1.6);
  union() for (r = [for (i = [0 : 3]) snowR[i]]) translate(r[0]) scale(r[1] * 0.95) sphere(1, $fn = 14);
}
color(snow) intersection() {
  translate(hC) scale(hR + [1.6, 1.6, 1.6]) sphere(1, $fn = 20);
  translate(snowR[4][0]) scale(snowR[4][1] * 0.95) sphere(1, $fn = 14);
}
// Ice spikes along the spine.
for (s = [[-6, 30.4, 4.2], [-2, 30.9, 5.2], [2, 30.4, 4.8], [6, 28.8, 4], [10, 26.6, 3.2]])
  color(ice) translate([0, s[0], s[1] - 0.4]) cylinder(h = s[2], r1 = 1.6, r2 = 0.1, $fn = 5);
