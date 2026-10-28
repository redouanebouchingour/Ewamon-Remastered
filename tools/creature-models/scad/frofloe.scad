// Frofloe: Slushpup grown into a powerful ice wolf prowling low and forward, a huge starburst mane of ice shards
// around its scowling face and over the shoulders, deep chest, tucked waist, thick clawed legs, a bushy curled tail.
include <lib.scad>

fur = [0.74, 0.87, 0.98];
furHi = [0.9, 0.95, 1.0];
furDark = [0.4, 0.58, 0.84];
furDeep = [0.26, 0.38, 0.62];
ice = [0.66, 0.85, 1.0];
iceHi = [0.86, 0.95, 1.0];
iceDark = [0.42, 0.64, 0.93, NOGLOW];
dark = [0.1, 0.13, 0.22];
claw = [0.26, 0.34, 0.52];
fang = [0.95, 0.97, 1.0];

// Low-poly ellipsoid for small details (toes, markings) to keep the budget for the big shapes.
module bead(r, p, rot = [0, 0, 0], c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// Orthonormal frame: local z along d, local x along w (made perpendicular), local y their cross.
function _n(v) = v / norm(v);
function _cr(a, b) = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
module frame(p, d, w) {
  u = _n(d);
  v = _n(w - (w * u) * u);
  t = _cr(u, v);
  multmatrix([[v[0], t[0], u[0], p[0]], [v[1], t[1], u[1], p[1]], [v[2], t[2], u[2], p[2]], [0, 0, 0, 1]]) children();
}

// A faceted two-tone crystal shard from p along d, width r across direction w: a flat diamond section widening to
// 45 % of its length, then a point. One half light, the other its darker core colour.
module shard(p, d, r, w = [1, 0, 0], c1 = ice, c2 = iceDark, th = 0.55) {
  L = norm(d);
  module pt(q) translate(q) cube(0.02, center = true);
  frame(p, d, w) {
    color(c1) hull() { pt([r, 0, 0]); pt([0, r * th, 0]); pt([0, -r * th, 0]); pt([r * 1.25, 0, L * 0.42]);
      pt([0, r * th * 1.2, L * 0.42]); pt([0, -r * th * 1.2, L * 0.42]); pt([0, 0, L]); }
    color(c2) hull() { pt([-r, 0, 0]); pt([0, r * th, 0]); pt([0, -r * th, 0]); pt([-r * 1.25, 0, L * 0.42]);
      pt([0, r * th * 1.2, L * 0.42]); pt([0, -r * th * 1.2, L * 0.42]); pt([0, 0, L]); }
  }
}

// ---- Body: deep heavy chest and shoulders, tucked waist, strong haunches; the back slopes down to the rump.
blob([[[5.6, 6.2, 6], [0, -6, 15.6]], [[4.6, 4.4, 5], [0, -9.5, 13]], [[4.2, 4, 4], [0, -2, 16.6]]], fur);
blob([[[3.9, 3, 3.6], [0, 2.5, 16.6]], [[4.2, 4, 4], [0, -2, 16.6]]], fur);
blob([[[5, 4.6, 4.9], [0, 8, 16]], [[3.9, 3, 3.6], [0, 3.5, 16.8]]], fur);
// Pale chest and belly fur.
blob([[[4.2, 4.6, 3.2], [0, -8, 10.6]], [[2.6, 3, 2], [0, -2, 12.4]]], furHi);
// Shoulder blades and haunch muscles.
mirror_x() {
  ell([2.8, 4.4, 4.8], [4.4, -6, 16.4], fur);
  ell([3, 4.4, 4.8], [3.8, 8.6, 15.2], fur);
}
// Darker fur streaks over the back, flanks and haunches (the back view's markings).
mirror_x() {
  for (s = [[4.1, 1, 17.6, 25], [4.3, 4.5, 17, 15], [6, 7.5, 16.6, 30], [6.1, 10, 15, 40], [5.6, 6.5, 13, 20]])
    bead([0.45, 2.6, 0.5], [s[0], s[1], s[2]], [s[3], 0, 0], furDark, 12);
  for (s = [[1.4, 4, 20.2], [2, 8.5, 20.2], [1.2, 11.5, 19]])
    bead([0.45, 2, 0.45], [s[0], s[1], s[2]], [0, 0, 20], furDark, 12);
}

// ---- Legs.
// Big paw at p (sole on z = 0) turned by yaw: a pad, four toe beads and dark claws.
module paw(p, yaw = 0, s = 1) {
  translate(p) rotate([0, 0, yaw]) scale(s) {
    blob([[[2.1, 2.5, 1.2], [0, 0, 1.1]], [[1.7, 1.6, 1.4], [0, 1.2, 1.6]]], fur);
    for (x = [-1.4, -0.47, 0.47, 1.4]) {
      bead([0.68, 0.85, 0.7], [x, -2.1, 0.75], c = furHi);
      color(claw) translate([x, -2.7, 0.7]) rotate(_dir_rot([0, -1.1, -0.6])) cylinder(h = 1.25, r1 = 0.32, r2 = 0.04, $fn = 6);
    }
  }
}
mirror_x() {
  // Forelegs: thick, splayed wide in the crouch.
  blob([[[3, 3.4, 4], [4.8, -7.4, 13]], [[2.4, 2.4, 2.4], [7, -9.6, 7.6]]], fur);
  limb([7, -9.6, 7.6], [8.2, -11.6, 2], 2.5, 2, fur);
  shard([7.8, -8, 8.2], [1.6, 2.8, 1.6], 0.8, [0, 0, 1], ice, iceDark);
  shard([8.6, -9.4, 5.6], [1.8, 2.4, 0.6], 0.6, [0, 0, 1], iceHi, ice);
  paw([8.6, -12.6, 0], -18, 1.3);
  // Hind legs: big thigh, stifle forward, hock back, foot down.
  blob([[[2.9, 3.9, 4.4], [4.3, 8.6, 14]], [[2.2, 2.3, 2.2], [5, 6.6, 8.8]]], fur);
  limb([5, 6.4, 8.6], [5.3, 11.4, 4.8], 2.3, 1.6, fur);
  limb([5.3, 11.4, 4.8], [5.4, 10.2, 1.4], 1.6, 1.7, fur);
  shard([5.4, 12.2, 5.4], [0.4, 2.6, 1.4], 0.6, [1, 0, 0], ice, iceDark);
  bead([0.5, 2.4, 0.6], [6.4, 8.8, 9.8], [-35, 0, 0], furDark, 12);
  paw([5.4, 9.2, 0], -6, 1.12);
}

// ---- Head: low and thrust forward, a wedge skull, white face mask, long muzzle, separate lower jaw.
// Built at the original scale, then enlarged about its centre so the face carries at game size.
HC = [0, -15, 16.5];
HS = 1.8;
translate(HC + [0, 1.4, -1.6]) scale(HS) translate(-HC) head();
module head() {
  // Wedge skull: cranium, the stop between the eyes, the muzzle tapering to the nose.
  blob([[[3.5, 3.2, 3], [0, -13.6, 17.4]], [[2.9, 1.8, 2.1], [0, -15.8, 16.9]], [[0.9, 1, 0.8], [0, -19.6, 16.7]]], fur);
  // White mask: the muzzle, cheek ruffs flaring out and down like the sprite's white fur spikes.
  blob([[[2.4, 1.6, 1.6], [0, -16.2, 15.9]], [[1.3, 1.1, 1], [0, -20.4, 16.15]]], furHi);
  mirror_x() {
    shard([2.2, -15.2, 15.6], [2.4, 1.2, -1.2], 0.9, [0, 0, 1], furHi, fur, 0.5);
    shard([2.4, -14.2, 14.8], [1.8, 1.6, -2.2], 0.9, [0, 0, 1], furHi, fur, 0.5);
    shard([3, -13.2, 16.6], [2.4, 1.4, 0], 0.8, [0, 0, 1], furHi, fur, 0.5);
  }
  // Darker blue markings: a V over the brow.
    mirror_x() bead([0.45, 2, 0.35], [1.1, -14.6, 19.9], [-18, 0, -24], furDark, 12);
  // Nose.
  ell([0.8, 0.65, 0.6], [0, -21.3, 16.6], dark);
  // Lower jaw, the mouth line and fangs: a snarl.
  blob([[[1.7, 1.6, 0.9], [0, -15.4, 14.3]], [[0.95, 1.1, 0.65], [0, -19.4, 14.5]]], furHi);
  color(dark) hull() { translate([0, -15.6, 15.15]) scale([1.9, 1, 0.3]) sphere(1, $fn = 12);
    translate([0, -19.8, 15.2]) scale([0.9, 0.6, 0.25]) sphere(1, $fn = 12); }
  mirror_x() {
    spike([0.8, -19.7, 15.5], [0, -0.1, -1.1], 0.3, 0.04, fang);
    spike([0.65, -19.1, 14.6], [0, 0, 0.8], 0.24, 0.04, fang);
  }
  // Eyes: sunk into the skull at the stop under a hard scowling brow ridge that slants down to the nose.
  mirror_x() {
    ell([1.55, 0.6, 1.25], [1.9, -16.8, 17.6], furDeep);
    eye([1.9, -17.1, 17.6], 1.38, iris = [0.4, 0.95, 1.0, GLOW], pupil = dark, sclera = [0.8, 0.95, 1.0], yaw = 26,
        flat = 0.5, lid = 0.48, lid_tilt = 30, lid_c = fur, slit = 0.35);
    color(fur) hull() {
      translate([0.45, -17.3, 18.55]) scale([0.55, 0.9, 0.45]) sphere(1, $fn = 10);
      translate([2.8, -16.2, 19.4]) scale([0.9, 1.2, 0.55]) sphere(1, $fn = 10);
    }
  }
  // Ears: tall, pointed, swept back.
  mirror_x() {
    shard([2.1, -14.2, 18.6], [1.5, 0.6, 4.6], 1.4, [1, -0.3, 0], fur, furDark, 0.45);
    shard([2.25, -14.75, 19.4], [1.2, 0.45, 3.1], 0.7, [1, -0.3, 0], furDeep, furDeep, 0.3);
  }
}

// ---- Mane: a collar of few, big, broad shards: a starburst framing the face, a second ring over the shoulders.
C = [0, -12.2, 16.4];
cols = [[iceHi, ice], [ice, iceDark], [furHi, ice]];
// [y, base radius, length, count, angle offset, lean back, width, lowest sin(angle) kept]
for (ring = [[-11.6, 7.6, 9, 10, 0, 0.2, 3, -0.75], [-8.6, 7.6, 11, 8, 22.5, 0.5, 3.4, -0.2]]) {
  for (i = [0 : ring[3] - 1]) let(a = i * 360 / ring[3] + ring[4], ca = cos(a), sa = sin(a),
      // The lower shards shorten; the top ones stand tallest.
      l = ring[2] * (sa < -0.3 ? 0.7 : 1) * (1 + 0.1 * ((i * 7) % 3 - 1)),
      k = cols[i % 3])
    if (sa >= ring[7])
      shard([C[0] + ca * ring[1], ring[0], C[2] + sa * ring[1] * 0.92],
            [ca, ring[5], sa * 1.05 + 0.15] * l, ring[6], [-sa, 0, ca], k[0], k[1], 0.5);
}
// Bib under the jaw, pointing down and forward.
for (x = [-2.6, 0, 2.6]) shard([x, -13, 10.2], [x * 0.4, -1.4, -4 + abs(x) * 0.3], 1.8, [1, 0, 0], iceHi, ice, 0.5);

// ---- Tail: a soft bushy plume rising from the rump and curling up and forward over the back: a fat fur core with
// long flame-like locks lying along the curl and flicking out at their tips (the sprite's layered tail), white tips.
tail = [[0, 11.4, 18], [0, 15.6, 19.8], [0, 19.2, 22.8], [0, 20.4, 27], [0, 18.4, 30.6], [0, 14.4, 32], [0, 11, 30.6]];
trs = [2.8, 4.2, 5.2, 5.4, 4.9, 3.8, 2.4];
for (i = [0 : len(tail) - 2]) color(fur) hull() {
  translate(tail[i]) scale([1.25, 1, 1]) sphere(trs[i], $fn = 16);
  translate(tail[i + 1]) scale([1.25, 1, 1]) sphere(trs[i + 1], $fn = 16);
}
TC = [0, 15, 25.6];
// A lock from p running along tg and flicking out along n at its tip: a flattened flame tongue, its last third white.
module lock(p, tg, n, len, r, c) {
  tip = p + tg * len + n * len * 0.22;
  mid = p + tg * len * 0.55 + n * len * 0.08;
  color(c) hull() { translate(p) scale([0.75, 1, 1]) sphere(r, $fn = 10); translate(mid) scale([0.6, 1, 1]) sphere(r * 0.7, $fn = 10); }
  color(furHi) hull() { translate(mid) scale([0.6, 1, 1]) sphere(r * 0.68, $fn = 10); translate(tip) scale([0.6, 1, 1]) sphere(r * 0.4, $fn = 8); }
}
// Three fans of locks along the curl (middle and both flanks), alternating blues, each lying back along the flow.
for (i = [1 : len(tail) - 2], k = [-1, 0, 1]) let(t = tail[i], r = trs[i], n = _n(t - TC),
    tg = _n(tail[i + 1] - tail[i - 1]), side = [k * 0.75, 0, 0])
  lock(t + n * r * 0.4 + [k * r * 0.75, 0, 0], tg, _n(n + side), 6 + r * 0.4 - abs(k), 2 + r * 0.22,
       (i + k + 3) % 2 == 0 ? ice : furDark);
// The curl's tip sweeping forward into a white flame.
lock([0, 12.4, 31.2], _n([0, -1, -0.4]), _n([0, -0.2, 1]), 5.5, 2, ice);

// A few loose ice crystals hanging in the air near the body.
for (c = [[-10, -9, 12], [10.5, -6, 17], [-8.5, 4, 22], [9, 13, 10]])
  shard(c, [0.2, 0, 1.4], 0.45, [1, 0, 0], iceHi, ice);
