// Kelvyre: a lean, upright lab-made feline split exactly down the middle. Its right half (scad -X, the viewer's left
// in the front art) is living fire: dark charcoal-red skin with glowing molten cracks, a curved horn under a crown of
// flames, flame tufts on the shoulder and elbow, the arm raised with a small flame floating over the open hand. Its
// left half (+X) is glacial ice: pale blue crystal with white facet lines, a crest of ice spikes on the head, ice
// spikes on the shoulder and the hanging forearm. A glowing white-gold seam runs down the middle, front and back. A
// broken containment ring sits at the neck (molten and dripping on the fire side, frosted with icicles on the ice
// side). A long ice tail curls out behind it to the +X side and turns to fire at its end, a flame at the tip.
//
// Checklist (front sheet: height 40, feet z = 0, sheet x ~ 0.866 x + 0.5 y):
//   torso     narrow waist z 15..18, chest sx -6..4 z 20..27, the seam at sx ~ -2 on the front
//   head      sx -6..2 z 29..36, short snout forward; fire eye (orange) at sx -3.5 z 32.5, ice eye (white, blue
//             pupil) at sx 0 z 32
//   fire horn curved dark-red horn from the head's -X top up to z 38.5, flames over it to z 39.5
//   ice crest four ice spikes from the head's +X top, the longest to sx 4.5 z 39.5
//   collar    ring at z 27..29, molten drips on the fire side, grey and frosted with icicles on the ice side
//   fire arm  shoulder (-5, 26), elbow (-10.5, 20), hand raised at (-13, 25.5), three fingers up, a flame floating
//             at (-13, 29); flame tufts on the shoulder (-8, 27) and the elbow (-11, 19)
//   ice arm   hanging: shoulder (4, 25), elbow (6.5, 18), hand (5, 12.5), three fingers down; ice spikes on the
//             shoulder up to (8, 29) and along the forearm out to sx 9.5
//   legs      digitigrade; fire leg: knee out to sx -7.5 z 10, foot toes left at sx -11; ice leg nearly straight
//             down at sx 1..4, toes forward
//   tail      from the back at z 13, low round to the +X side (sx 9 z 3), up to the tip at sx 13.5 z 9; ice along
//             its length, dark-red fire from sx 12, a flame on the tip up to z 17
//   back      the same split seen from behind (fire on the viewer's right), the seam down the spine, the tail root
//   glow      flames, cracks, the seam and the fire eye glow; the ice never does
include <lib.scad>

fireC = [0.50, 0.19, 0.16];
fireDk = [0.36, 0.15, 0.14];
crack = [0.96, 0.49, 0.05, GLOW];
flameC = [0.96, 0.49, 0.05, GLOW];
flameHi = [0.98, 0.75, 0.26, GLOW];
flameCore = [0.95, 0.91, 0.64, GLOW];
iceC = [0.42, 0.70, 0.91, NOGLOW];
iceHi = [0.70, 0.87, 0.96, NOGLOW];
iceLine = [0.89, 0.96, 0.99, NOGLOW];
iceDk = [0.15, 0.37, 0.60];
seamC = [0.95, 0.91, 0.64, GLOW];
metal = [0.42, 0.44, 0.50];
molten = [0.79, 0.26, 0.07];
emberEye = [0.98, 0.61, 0.14, GLOW];
iceIris = [0.10, 0.49, 0.82, NOGLOW];
ink = [0.03, 0.05, 0.18];

// ---- the joints (scad frame)
hipF = [-2.8, 0.2, 15.2];
kneeF = [-7.4, -2.0, 10.0];
ankleF = [-8.0, 1.2, 4.2];
toeF = [-11.2, -2.8, 1.2];
hipI = [2.8, 0.2, 15.2];
kneeI = [4.6, -2.6, 9.2];
ankleI = [3.8, 0.8, 4.0];
toeI = [2.8, -3.6, 1.2];
shF = [-5.4, 0.2, 25.2];
elF = [-12.2, -1.0, 20.0];
haF = [-14.4, -3.0, 25.4];
shI = [5.4, 0.2, 25.0];
elI = [6.6, 0.4, 18.2];
haI = [5.6, -2.0, 12.8];
TAIL = [[0.8, 3.4, 13.2], [2.6, 5.2, 8.6], [5.0, 5.4, 4.6], [8.2, 4.2, 3.0], [11.6, 2.2, 4.0], [13.9, 0.4, 7.0], [14.8, -0.8, 10.4]];
TAILR = [1.9, 1.75, 1.6, 1.5, 1.4, 1.3, 1.1];

module sph(p, r) translate(p) scale(r) sphere(1, $fn = 24);
module cap(a, b, r1, r2) hull() { translate(a) sphere(r1, $fn = 16); translate(b) sphere(r2, $fn = 16); }
module chainG(pts, rs, g) for (i = [0 : len(pts) - 2]) cap(pts[i], pts[i + 1], rs[i] + g, rs[i + 1] + g);

// The core: torso, neck and head, grown by g (for the markings laid on it)
module core(g = 0) {
  // pelvis, waist and a chest that widens to the shoulders
  hull() {
    sph([0, 0.2, 15.6], [4.0 + g, 3.2 + g, 2.6 + g]);
    sph([0, 0.1, 18.4], [3.2 + g, 2.7 + g, 2.4 + g]);
  }
  hull() {
    sph([0, 0.1, 18.4], [3.2 + g, 2.7 + g, 2.4 + g]);
    sph([0, -0.3, 23.2], [4.8 + g, 3.4 + g, 3.4 + g]);
    sph([0, 0.2, 25.4], [6.0 + g, 3.0 + g, 1.9 + g]);
  }
  // neck
  cap([0, 0.3, 25.5], [0, -0.4, 29.6], 1.9 + g, 1.7 + g);
  // head: a rounded skull and a short snout
  hull() {
    sph([0, -0.2, 32.8], [3.8 + g, 3.7 + g, 3.7 + g]);
    sph([0, -3.1, 31.3], [2.2 + g, 2.4 + g, 1.9 + g]);
  }
  // cheeks
  for (s = [-1, 1]) sph([s * 2.8, -1.7, 31.4], [1.5 + g, 1.7 + g, 1.5 + g]);
}

// The fire limbs (the creature's right, -X): the raised arm and the bent leg, and the end of the tail
module fireLimbs(g = 0) {
  cap(shF, elF, 2.0 + g, 1.75 + g);
  cap(elF, haF, 1.75 + g, 1.35 + g);
  sph(haF, [1.6 + g, 1.25 + g, 1.45 + g]);
  // three fingers curled up round the floating flame
  for (k = [-1 : 1]) cap(haF + [k * 0.9, -0.2, 0.6], haF + [k * 1.3 - 0.3, -0.5, 2.6 - abs(k) * 0.3], 0.45 + g, 0.32 + g);
  sph(shF, [2.0 + g, 2.0 + g, 2.0 + g]);
  // the leg: a thick thigh, a digitigrade shin, a long foot with three toes
  cap(hipF, kneeF, 2.8 + g, 2.1 + g);
  cap(kneeF, ankleF, 1.9 + g, 1.35 + g);
  cap(ankleF, ankleF + [-0.6, -0.6, -2.5], 1.25 + g, 1.2 + g);
  hull() { sph(ankleF + [-0.6, -0.6, -2.6], [1.5 + g, 1.5 + g, 1.1 + g]); sph(toeF, [1.3 + g, 1.3 + g, 0.9 + g]); }
  for (k = [-1 : 1]) cap(toeF, toeF + [-1.6 + abs(k) * 0.3, -1.0 + k * 1.1, -0.5], 0.6 + g, 0.4 + g);
  // the tail turns to fire past its fifth joint
  chainG([TAIL[4], TAIL[5], TAIL[6]], [TAILR[4], TAILR[5], TAILR[6]], g);
}

// The ice limbs (the creature's left, +X): the hanging arm, the straight leg and the tail up to its fire end
module iceLimbs(g = 0) {
  sph(shI, [2.0 + g, 2.0 + g, 2.0 + g]);
  cap(shI, elI, 1.75 + g, 1.45 + g);
  cap(elI, haI, 1.45 + g, 1.2 + g);
  sph(haI, [1.35 + g, 1.15 + g, 1.45 + g]);
  for (k = [-1 : 1]) cap(haI + [k * 0.7, -0.3, -0.6], haI + [k * 1.0, -0.6, -2.8 + abs(k) * 0.3], 0.45 + g, 0.3 + g);
  cap(hipI, kneeI, 2.4 + g, 1.8 + g);
  cap(kneeI, ankleI, 1.7 + g, 1.25 + g);
  cap(ankleI, ankleI + [0, -0.4, -2.4], 1.25 + g, 1.2 + g);
  hull() { sph(ankleI + [0, -0.4, -2.6], [1.5 + g, 1.5 + g, 1.1 + g]); sph(toeI, [1.3 + g, 1.3 + g, 0.9 + g]); }
  for (k = [-1 : 1]) cap(toeI, toeI + [k * 1.1, -1.7 + abs(k) * 0.3, -0.5], 0.6 + g, 0.4 + g);
  chainG([TAIL[0], TAIL[1], TAIL[2], TAIL[3], TAIL[4]], [TAILR[0], TAILR[1], TAILR[2], TAILR[3], TAILR[4]], g);
}

module half(s) intersection() { children(); translate([s * 60, 0, 0]) cube(120, center = true); }

// Short thin blades at seeded positions and angles: where they cross a grown shell they draw a web of short, jagged
// crack lines on the surface (fire) or facet lines (ice)
module shards(n, seed, x0, x1, len, w) {
  P = rands(0, 1, n * 6, seed);
  for (i = [0 : n - 1])
    translate([x0 + (x1 - x0) * P[i * 6], -6 + 12 * P[i * 6 + 1], 1 + 37 * P[i * 6 + 2]])
      rotate([360 * P[i * 6 + 3], 360 * P[i * 6 + 4], 360 * P[i * 6 + 5]]) cube([w, len, len * 0.6], center = true);
}
module crackPlanes() shards(130, 7, -16, 0, 4.0, 0.32);
module facetPlanes() shards(110, 11, 0, 16, 4.6, 0.42);

// ---- the two halves
color(fireC) { half(-1) core(); fireLimbs(); }
color(iceC) { half(1) core(); iceLimbs(); }
// molten cracks over the fire half, white facet lines over the ice half
color(crack) intersection() { union() { half(-1) core(0.16); fireLimbs(0.16); } crackPlanes(); }
color(iceLine) intersection() { union() { half(1) core(0.14); iceLimbs(0.14); } facetPlanes(); }
// the seam: a glowing strip down the middle of the core, front and back
color(seamC) intersection() { core(0.22); cube([0.5, 40, 80], center = true); }

// ---- face
eye([-1.7, -3.45, 33.0], 1.05, iris = emberEye, sclera = [0.95, 0.91, 0.64, NOGLOW], pupil = ink, yaw = -18, lid = 0.4, lid_tilt = 22, lid_c = fireC, slit = 0.4);
eye([1.7, -3.45, 33.0], 1.05, iris = iceIris, sclera = "white", pupil = ink, yaw = 18, lid = 0.4, lid_tilt = 22, lid_c = iceC, slit = 0.4);
// a thin mouth line under the snout
color(ink) translate([0, -5.1, 30.6]) scale([1.0, 0.25, 0.18]) sphere(1, $fn = 12);

// ---- fire horn and its crown of flames (head's -X top)
color(fireDk) chainG([[-2.2, 0.2, 35.6], [-3.3, 0.6, 37.6], [-3.1, 1.4, 39.4]], [1.05, 0.75, 0.25], 0);

// A flame as the sprite draws it: a flat licking shape (orange, a yellow heart low in front), standing at p, h tall
// and w wide, turned `turn` degrees about Z (30 lies it in the art's picture plane) and leaning `lean` degrees.
FLAME = [[0, 0], [0.30, 0.06], [0.42, 0.26], [0.34, 0.5], [0.46, 0.66], [0.28, 0.64], [0.2, 0.82], [0.04, 1.0],
         [-0.04, 0.78], [-0.18, 0.7], [-0.36, 0.84], [-0.3, 0.56], [-0.42, 0.36], [-0.32, 0.1]];
HEART = [[0, 0.04], [0.2, 0.1], [0.24, 0.3], [0.12, 0.44], [0.06, 0.6], [-0.06, 0.46], [-0.2, 0.36], [-0.2, 0.12]];
module flame(p, h, w, turn = 30, lean = 0) {
  translate(p) rotate([0, 0, turn]) rotate([0, lean, 0]) {
    plate([for (q = FLAME) [q[0] * w * 2, q[1] * h]], t = w * 0.7, r = 0.15, c = flameC, grow = 0);
    for (s = [-1, 1]) translate([0, s * w * 0.32, 0]) plate([for (q = HEART) [q[0] * w * 2, q[1] * h]], t = 0.2, r = 0.1, c = flameHi, grow = 0);
  }
}
flame([-2.6, 0.4, 34.6], 5.0, 1.6, 30, 8);
flame([-5.0, 0.6, 33.6], 4.0, 1.3, 30, -22);
// the flame floating over the raised hand
flame(haF + [-0.2, 0, 2.6], 5.2, 1.9, 30, 4);
// tufts on the shoulder and the elbow
flame(shF + [-1.6, 0.2, 0.8], 4.6, 1.6, 30, -14);
flame(elF + [-0.6, 0.2, -0.4], 3.6, 1.2, 30, 200);
flame(elF + (haF - elF) * 0.45 + [-1.0, 0.2, -0.6], 2.8, 1.0, 30, 230);
// the flame on the tail tip
flame(TAIL[6] + [0, 0, 0.2], 7.4, 2.4, 30, -6);

// ---- ice crest: four spikes off the head's +X top, the longest up and out to the right
for (q = [[[1.8, 0.6, 35.4], [3.4, 0.6, 4.6], 1.0], [[2.8, 0.4, 34.4], [3.6, 0.8, 2.6], 0.85],
          [[3.4, 0.2, 33.2], [3.0, 0.8, 1.0], 0.7], [[0.6, 0.6, 36.0], [0.9, 0.4, 2.8], 0.7]])
  spike(q[0], q[1], q[2], 0.05, iceHi);
// ice spikes on the shoulder (up and out) and along the forearm (out to +X)
for (q = [[[6.0, 0.6, 26.4], [1.8, 0.4, 4.0], 0.9], [[6.8, 0.6, 25.4], [2.6, 0.4, 2.2], 0.75], [[5.0, 1.0, 26.8], [0.4, 0.6, 2.8], 0.6]])
  spike(q[0], q[1], q[2], 0.05, iceHi);
for (t = [0.15, 0.45, 0.75]) {
  p = elI + (haI - elI) * t;
  spike(p + [0.9, 0.2, 0], [1.5 - t * 0.6, 0.3, 1.0], 0.6, 0.05, iceHi);
}
for (t = [0.3, 0.7]) spike(shI + (elI - shI) * t + [1.0, 0.4, 0], [1.3, 0.6, 1.5], 0.55, 0.05, iceHi);
// small spikes down the back of the ice leg and on the tail's ridge
spike(kneeI + [0.6, 1.0, 0.4], [1.0, 1.6, 0.6], 0.55, 0.05, iceHi);
for (i = [1 : 3]) spike(TAIL[i] + [0, 0, TAILR[i] - 0.3], [0.4, 0.3, 1.4], 0.5, 0.05, iceHi);

// ---- the broken containment ring at the neck: molten and dripping on the fire side, frosted on the ice side
module ring() translate([0, -0.2, 27.9]) rotate([-12, 0, 0]) rotate_extrude($fn = 32) translate([2.55, 0]) scale([0.75, 1.2]) circle(1, $fn = 10);
color(molten) half(-1) ring();
color(metal) half(1) ring();
for (q = [[-1.6, -2.3, 1.6], [-2.5, -1.0, 2.2], [-0.8, -2.7, 1.2], [-2.4, 0.8, 1.4]])
  color(molten) hull() { translate([q[0], q[1], 27.5]) sphere(0.42, $fn = 10); translate([q[0], q[1] - 0.15, 27.5 - q[2]]) sphere(0.28, $fn = 8); }
for (q = [[1.4, -2.5, 1.2], [2.4, -1.2, 1.6], [0.6, -2.8, 0.9], [2.5, 0.6, 1.1]])
  spike([q[0], q[1], 27.4], [0, -0.1, -q[2]], 0.35, 0.03, iceLine);
color(iceLine) half(1) translate([0, -0.2, 28.9]) rotate([-12, 0, 0]) scale([1, 1, 0.25]) rotate_extrude($fn = 32) translate([2.6, 0]) circle(0.7, $fn = 8);
