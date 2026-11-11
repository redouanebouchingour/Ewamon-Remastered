// Toxshade: a huge hunched black rat-beast of shaggy shadow. Matted black fur hanging in soft locks, violet toxin
// shards glowing over the hump and haunch, a wedge rat head thrust forward and low with small glowing violet eyes
// under a heavy scowl, a dropped jaw drooling violet, clawed hands dripping, a long bare tail rising in a hook
// behind, and wavy smoke tendrils streaming up off its back and behind its head.
//
// Checklist (front sheet; the art stands on a pool of shadow, not modelled: the feet line is sheet z 3 = scad z 0):
//   body    : one huge hunched mound x -9..16.5, z 4..36.5; the hump's top (2..6, 36.5); the back falls to the rump
//             (14.5, 21) and the big near haunch (3..16.5, 4..20). Fur mid [0.21, 0.22, 0.26], lighter streaks,
//             near-black locks; the outline ragged with locks all round.
//   head    : a big wedge rat head low in front of the shoulders, cranium (-9.5, 25.5), snout down-left to the nose
//             (-16, 20); face about three-quarter like the body. Ears: near (-5, 29) r 2.5 round, far (-14, 29.8)
//             r 1.8, dark with a mauve inside.
//   face    : small glowing violet almond eyes, near (-9.4, 24.8) about 2 x 1.3 slanting up towards the back, far
//             (-14.5, 24.5) smaller; pale lilac centres; a heavy brow scowl. Nose mauve-grey at the tip. Mouth open,
//             jaw dropped, small fangs; violet drool from the near corner (-11.7, 19 -> 14) and (-10.6, 19.5 -> 17).
//             Whiskers ink black out to x -19, z 18..24.
//   arms    : near (+X) hanging in front of the chest, hand (-4..0, 10..16), long mauve fingers, violet claws
//             dripping; far (-X) reaching forward, hand (-18..-14, 11..17), claws hooked down, drops to z 8.
//   hind    : near foot long, claws forward at (5..9, 3..5); far foot (-9..-5, 3.5..6).
//   tail    : thin, bare, mauve-grey, ringed; out behind the rump, low, then rising (14.5..15.5, 10..26) to a hook
//             curling over to the right, the tip down at (18, 24).
//   marks   : violet shards: (0, 31.8) wide, (5.5, 28.5) tall, (2.3, 25) big, (9.3, 21), (2.7, 19), haunch (7.8, 14).
//   smoke   : wavy near-black tendrils rising off the spine to z 40 (-6..12), off the rump (11..13, 24..34), and
//             behind the head on the far side (-17..-15, 20..32).
//   back    : the -X flank: many violet shards spread over hump and haunch, the far ear's mauve inside, the tail.
include <lib.scad>

G = 3;   // the sheet's foot line: everything is authored in sheet z and dropped by G

fur = [0.28, 0.29, 0.33];
furLt = [0.44, 0.46, 0.49];
furDk = [0.16, 0.16, 0.2];
skin = [0.36, 0.3, 0.36];
earIn = [0.32, 0.25, 0.31];
nose = [0.45, 0.37, 0.44];
mouthC = [0.2, 0.07, 0.17];
fang = [0.78, 0.72, 0.78];
claw = [0.36, 0.22, 0.46];
ink = [0.05, 0.05, 0.07];
ring = [0.25, 0.22, 0.27];
tox = [0.45, 0.22, 0.7, GLOW];
toxHi = [0.62, 0.4, 0.86, GLOW];
eyeV = [0.45, 0.18, 0.75, GLOW];
eyeHi = [0.64, 0.34, 0.92, GLOW];

// ---- the head's frame: cranium centre, pitched down, turned a little to its right
HC = [-2.7, -14.5, 26.5];
HROT = [16, 0, 6];
function rx(a, p) = [p[0], p[1] * cos(a) - p[2] * sin(a), p[1] * sin(a) + p[2] * cos(a)];
function rz(a, p) = [p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a), p[2]];
HS = 1.42;   // the head block is scaled up about the cranium centre
function hw(p) = HC + rz(HROT[2], rx(HROT[0], p * HS));

// body ellipsoids (shared with the locks and the shards that lie on them)
HUMP = [[9.5, 8.5, 11], [0, 3, 25.5]];
SHOULDER = [[8.5, 7, 8], [0, -4, 29]];
RUMP = [[9.5, 9, 9], [0, 6, 13]];
CHEST = [[7.5, 6, 9], [0, -5, 18]];
BELLY = [[8.5, 8, 4.5], [0, 2, 8.5]];
BODY = [HUMP, SHOULDER, RUMP, CHEST, BELLY];
HAUNCH = [[6.5, 7.5, 8.5], [7, 7, 13]];
function onEll(e, az, el, k = 1) = e[1] + [e[0][0] * k * cos(el) * sin(az), -e[0][1] * k * cos(el) * cos(az), e[0][2] * k * sin(el)];
function nEll(e, az, el) = [cos(el) * sin(az) / e[0][0], -cos(el) * cos(az) / e[0][1], sin(el) / e[0][2]];
function unit(v) = v / norm(v);

// The body's surface along a ray from LC (the union of the body ellipsoids): fur locks and
// shards are placed on it.
LC = [0, 1, 20];
function rayT(o, d, e) = let(q = [for (i = [0 : 2]) (o[i] - e[1][i]) / e[0][i]], v = [for (i = [0 : 2]) d[i] / e[0][i]],
                             a = v * v, b = 2 * (q * v), c = q * q - 1, D = b * b - 4 * a * c) D < 0 ? -1 : (-b + sqrt(D)) / (2 * a);
function surfT(d) = max([for (e = BODY) rayT(LC, d, e)]);
function dirOf(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
function onBody(az, el, out = 0) = let(d = dirOf(az, el)) LC + d * (surfT(d) + out);
// A soft lock of fur lying on the hide like a shingle: a wide flat root, hanging down the surface to a blunt tip
// that lifts just off it, so the hide is streaked and the outline ragged where the locks cross it.
module lock(az, el, len, w, c) {
  p = onBody(az, el, -0.3);
  el2 = el - len / norm(p - LC) * 57.3;
  q = onBody(az, el2, 1);
  color(c) hull() {
    translate(p) rotate(_dir_rot(dirOf(az, el))) rotate([0, 0, az]) scale([w, w * 0.7, 0.4]) sphere(1, $fn = 6);
    translate(q) rotate(_dir_rot(dirOf(az, el2))) rotate([0, 0, az]) scale([w * 0.42, w * 0.3, 0.3]) sphere(1, $fn = 4);
  }
  // the lighter grey tip
  color(furLt) translate(q + unit(dirOf(az, el2)) * 0.15) rotate(_dir_rot(dirOf(az, el2))) rotate([0, 0, az]) scale([w * 0.4, w * 0.28, 0.3]) sphere(1, $fn = 4);
}
// A soft lock on one ellipsoid (the haunches).
module hlock(e, az, el, len, w, c) {
  el2 = max(-80, el - len / e[0][2] * 57.3);
  p = onEll(e, az, el, 0.97);
  q = onEll(e, az, el2, 1.06);
  color(c) hull() {
    translate(p) rotate(_dir_rot(nEll(e, az, el))) rotate([0, 0, az]) scale([w, w * 0.7, 0.4]) sphere(1, $fn = 6);
    translate(q) rotate(_dir_rot(nEll(e, az, el2))) rotate([0, 0, az]) scale([w * 0.42, w * 0.3, 0.3]) sphere(1, $fn = 4);
  }
  color(furLt) translate(q + unit(nEll(e, az, el2)) * 0.15) rotate(_dir_rot(nEll(e, az, el2))) rotate([0, 0, az]) scale([w * 0.4, w * 0.28, 0.3]) sphere(1, $fn = 4);
}
// A glowing toxin shard lying flush on the hide at p (outward n): an angular flat patch with a pale streak.
module shard(p, n, s, ang) {
  color(tox) translate(p) rotate(_dir_rot(n)) rotate([0, 0, ang]) hull() {
    translate([s, 0, 0]) scale([0.5, 0.35, 0.3]) sphere(s, $fn = 6);
    translate([-s * 0.9, s * 0.25, 0]) scale([0.4, 0.3, 0.3]) sphere(s, $fn = 6);
    translate([-s * 0.2, -s * 0.45, 0]) scale([0.45, 0.35, 0.3]) sphere(s, $fn = 6);
  }
  color(toxHi) translate(p + unit(n) * 0.2) rotate(_dir_rot(n)) rotate([0, 0, ang]) hull() {
    translate([s * 0.5, 0.05 * s, 0]) scale([0.22, 0.14, 0.2]) sphere(s, $fn = 6);
    translate([-s * 0.45, 0.2 * s, 0]) scale([0.18, 0.12, 0.2]) sphere(s, $fn = 6);
  }
}
// A wavy smoke tendril: a flat flame-like tongue (broad in the plane of its lean, thin across it), tapering
// capsules through the points.
module tendril(pts, rs, c = furDk) {
  lean = pts[len(pts) - 1] - pts[0];
  a = atan2(lean[1], lean[0]);
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) rotate([0, 0, a]) scale([1, 0.5, 1]) sphere(rs[i], $fn = 6);
    translate(pts[i + 1]) rotate([0, 0, a]) scale([1, 0.5, 1]) sphere(rs[i + 1], $fn = 6);
  }
}

translate([0, 0, -G]) {
  // ---- body: a huge hunched rat sitting up on its haunches, chest high, the hump over the shoulders (a union of
  // ellipsoids, so the locks lie exactly on it and hide the creases)
  color(fur) for (e = BODY) translate(e[1]) scale(e[0]) sphere(1, $fn = 20);
  // neck running into the head
  ell([5.5, 6, 5.5], [-1.6, -10, 26], fur);

  // ---- head
  translate(HC) rotate(HROT) scale(HS) {
    // cranium, muzzle and the long snout
    color(fur) hull() {
      scale([5, 5, 4.5]) sphere(1, $fn = 24);
      translate([0, -5.8, -1]) scale([3.5, 3.6, 2.9]) sphere(1, $fn = 18);
      translate([0, -10.6, -1.8]) scale([1.8, 1.6, 1.5]) sphere(1, $fn = 12);
    }
    color(nose) translate([0, -12, -1.5]) scale([1.1, 0.9, 0.9]) sphere(1, $fn = 12);
    // dropped lower jaw and the open mouth between
    color(fur) hull() {
      translate([0, -4, -3.4]) scale([2.6, 2.5, 1.2]) sphere(1, $fn = 14);
      translate([0, -9.8, -3.5]) scale([1, 1.2, 0.7]) sphere(1, $fn = 10);
    }
    color(mouthC) hull() {
      translate([0, -5.5, -2.5]) scale([2, 2.6, 0.8]) sphere(1, $fn = 12);
      translate([0, -10.4, -2.7]) scale([0.8, 0.8, 0.5]) sphere(1, $fn = 8);
    }
    mirror_x() spike([0.8, -9.6, -2.8], [0, -0.2, -1.3], 0.34, 0.05, fang);
    mirror_x() {
      // small glowing violet almonds under a heavy scowling brow
      eye([3.2, -3.9, 0.9], 1.45, iris = eyeHi, sclera = eyeV, pupil = eyeHi, yaw = 40, flat = 0.5,
          lid = 0.36, lid_tilt = 24, lid_c = furDk, squint = 0.24, shine = false);
      color(fur) hull() {
        translate([3.9, -2.2, 2.3]) scale([1.3, 1.4, 0.8]) sphere(1, $fn = 10);
        translate([1.6, -6, 1.2]) scale([0.9, 1.1, 0.6]) sphere(1, $fn = 8);
      }
      // whiskers fanning out past the nose
      for (a = [-14, 0, 14]) color(ink) translate([1, -10.9, -1.1]) rotate([a, 0, -18]) rotate([0, 90, 0]) cylinder(h = 4.6, r = 0.12, $fn = 5);
      // round ears, dark rimmed, mauve inside
      translate([4.5, 1.2, 4]) rotate([0, 28, 40]) {
        color(fur) scale([2.6, 0.75, 2.8]) sphere(1, $fn = 18);
        color(earIn) translate([0, -0.4, -0.1]) scale([1.8, 0.45, 2]) sphere(1, $fn = 14);
      }
      // shaggy cheek locks hanging under the ears
      color(fur) hull() { translate([4.2, -0.5, -1.2]) scale([1.3, 1.6, 0.8]) sphere(1, $fn = 8); translate([5.2, 1.2, -3.8]) sphere(0.45, $fn = 6); }
    }
  }
  // violet drool from the near corner of the mouth (and a shorter strand on the far side)
  for (d = [[[1.5, -8.6, -3.4], 14], [[0.7, -10.4, -3.2], 17], [[-1.5, -8.6, -3.4], 16.5]]) let(p = hw(d[0])) {
    limb(p, [p[0], p[1], d[1]], 0.38, 0.28, tox);
    color(tox) translate([p[0], p[1], d[1] - 0.1]) scale([0.42, 0.42, 0.6]) sphere(1, $fn = 8);
  }

  // ---- arms
  // near (+X) arm hanging in front of the chest, the hand open, long claws hanging and dripping
  chain([[6.5, -6, 25], [7.5, -10, 18], [5, -13, 14.5]], [3.2, 2.2, 1.6], fur);
  color(skin) translate([4.8, -13.6, 13.9]) scale([1.8, 1.7, 1.5]) sphere(1, $fn = 14);
  for (k = [-1.5, -0.5, 0.5, 1.5]) let(b = [4.8 + 0.85 * k, -14.6, 13.5]) {
    chain([b, b + [0.25 * k, -0.9, -1.6], b + [0.3 * k, -1.1, -3.2]], [0.42, 0.34, 0.26], skin);
    spike(b + [0.3 * k, -1.1, -3.2], [0.1 * k, 0.2, -1.4], 0.26, 0.04, claw);
  }
  for (d = [[4.2, -15.6, 9.1], [5.9, -15.8, 9.7]]) { limb(d + [0, 0, 1], d, 0.18, 0.3, tox); }
  // far (-X) arm reaching forward, the hand hooked down, claws dripping
  chain([[-6.5, -6, 25.5], [-8.4, -12, 20.5], [-7, -18.5, 18]], [3.2, 2.2, 1.6], fur);
  color(skin) translate([-7, -19.1, 17.8]) scale([1.9, 1.8, 1.4]) sphere(1, $fn = 14);
  for (k = [-1.5, -0.5, 0.5, 1.5]) let(b = [-7 + 0.9 * k, -20.3, 17.4]) {
    chain([b, b + [0.3 * k, -1.2, -1], b + [0.35 * k, -1.4, -2.8]], [0.44, 0.36, 0.28], skin);
    spike(b + [0.35 * k, -1.4, -2.8], [0.1 * k, 0.4, -1.5], 0.28, 0.04, claw);
  }
  for (d = [[-8.2, -22.1, 12.9], [-6.4, -22.1, 11.9], [-8, -21.7, 10.7]]) color(tox) translate(d) scale([0.35, 0.35, 0.5]) sphere(1, $fn = 8);

  // ---- hind legs: heavy haunches, long rat feet flat on the ground
  mirror_x() {
    ell(HAUNCH[0], HAUNCH[1], fur);
    limb([8, 9, 9], [8.6, 6, 5], 2.2, 1.6, fur);
    color(skin) hull() { translate([9, 2, 1.4 + G]) scale([2.1, 4, 1.2]) sphere(1, $fn = 12); translate([9, 6, 1.7 + G]) scale([1.8, 1.6, 1.3]) sphere(1, $fn = 12); }
    for (k = [-1, 0, 1]) spike([9 + 0.9 * k, -1.6, 1.2 + G], [0.35 * k, -1.8, -0.7], 0.42, 0.05, claw);
  }

  // ---- tail: thin and bare, out behind the rump, low, then rising to a hook that curls over to the right
  chain(TAIL, TAIL_R, skin);
  for (i = [1 : len(TAIL) - 4]) for (t = [0.5]) let(d = TAIL[i + 1] - TAIL[i], r = TAIL_R[i] + (TAIL_R[i + 1] - TAIL_R[i]) * t)
    color(ring) translate(TAIL[i] + d * t) rotate(_dir_rot(d)) cylinder(h = 0.3, r = r + 0.1, center = true, $fn = 10);

  // ---- shaggy fur: soft locks hanging down the hump, shoulders, rump and haunches, so the hide is streaked and
  // the outline ragged
  for (l = LOCKS) lock(l[0], l[1], l[2], l[3], SHADES[l[4]]);
  // and mirrored on the near haunch
  for (l = HLOCKS) hlock(HAUNCH, l[0], l[1], l[2], l[3], SHADES[l[4]]);
  for (l = HLOCKS) hlock([HAUNCH[0], [-HAUNCH[1][0], HAUNCH[1][1], HAUNCH[1][2]]], -l[0], l[1], l[2], l[3], SHADES[l[4]]);

  // ---- violet toxin shards
  for (s = SHARDS) if (s[0] == 0) shard(onBody(s[1], s[2], -0.1), dirOf(s[1], s[2]), s[3], s[5]);
    else let(e = [HAUNCH[0], [s[4] * HAUNCH[1][0], HAUNCH[1][1], HAUNCH[1][2]]]) shard(onEll(e, s[1], s[2], 0.99), nEll(e, s[1], s[2]), s[3], s[5]);

  // ---- smoke tendrils streaming up off the spine, the rump and behind the head
  for (t = TENDRILS) tendril(t, [1.15, 0.75, 0.45, 0.2]);
}

TAIL = [[1.5, 12, 11], [2.5, 16.5, 6], [3.2, 20.5, 4.4], [3.8, 23.5, 7], [3.8, 24.3, 12], [3.6, 24, 16.5], [3.8, 24, 20.5],
        [4.6, 24.6, 23.2], [5.5, 25.2, 23.3], [6, 25.6, 21.8], [5.8, 25.4, 20.4]];
TAIL_R = [1.3, 1.1, 0.95, 0.85, 0.75, 0.68, 0.6, 0.52, 0.45, 0.38, 0.3];

// locks: [azimuth round LC (0 = front, 90 = +X), elevation, length, width, shade]; they cover the whole body
SHADES = [fur, furDk, fur];
LOCKS = [
  for (r = [0 : 5]) for (i = [0 : 13]) [-180 + i * 360 / 14 + (r % 2) * 180 / 14, 70 - r * 18, 4.8, 2, (i * 2 + r) % 3],
];
// haunch locks: [azimuth, elevation, length, width, shade] (mirrored onto the far haunch)
HLOCKS = [for (r = [0 : 2]) for (i = [0 : 4]) [-10 + i * 40 + r * 20, 50 - r * 32, 3.6, 1.8, (i + r) % 3]];
// shards: [0 body (azimuth / elevation round LC) or 1 haunch, azimuth, elevation, size, haunch side, in-plane angle]
SHARDS = [
  [0, 24, 51, 2, 1, 10], [0, 66, 54, 1.8, 1, 80], [0, 36, 30, 2.2, 1, 60], [0, 96, 15, 1.6, 1, 75], [0, 45, 9, 1.2, 1, 30],
  [1, 22, 18, 2.1, 1, 50],
  [0, -100, 15, 2, 1, 70], [0, -135, 35, 2, 1, 30], [0, -70, 45, 1.7, 1, 120], [0, 160, 50, 1.8, 1, 20], [0, 130, 10, 1.8, 1, 60],
  [0, -160, 0, 1.8, 1, 40], [0, -115, -15, 1.7, 1, 100],
  [1, -110, 8, 2, -1, 40], [1, -150, -10, 1.8, -1, 70],
];
// tendrils: [root (inside the body), …, tip]
TENDRILS = [
  [[0, -6, 31], [-0.8, -8, 34.2], [0.6, -9.2, 36.4], [-0.2, -10.6, 38]],
  [[1, -1, 34], [0, -2.2, 37.2], [1.4, -3, 39.2], [0.6, -4.4, 40.6]],
  [[-2, 5, 35], [-0.8, 6, 38.2], [0.8, 6.8, 40], [0, 8.4, 41.2]],
  [[2, 10, 33.5], [3, 12, 36.2], [2.2, 13.6, 37.8], [3.4, 15.6, 39]],
  [[3, 13, 30], [4.4, 15, 32.8], [3.6, 16.8, 34.2], [5, 18.6, 35.6]],
  [[3, 15, 24], [4, 17.6, 26.8], [3.2, 19.4, 28.4], [4.6, 21, 30]],
  [[-7, -7, 28], [-9.6, -8.2, 30], [-10.4, -9.4, 32.2], [-12, -9.6, 34]],
  [[-8, -5, 22], [-10.8, -6.8, 23.6], [-11.8, -8, 26], [-13.4, -8.4, 28.6]],
  [[-4, -2, 33], [-5.8, -2.8, 35.8], [-5, -4, 37.8], [-6.6, -4.8, 39.4]],
  [[7.5, 2, 30], [10, 2.6, 32.6], [9.6, 3.4, 34.6], [11.2, 4.2, 36]],
  [[-7.5, 6, 30], [-10, 6.6, 32.6], [-9.6, 7.4, 34.6], [-11.2, 8.2, 36]],
  [[4, 4, 34], [5.4, 5, 37], [4.6, 6, 39.2], [6, 7.2, 40.4]],
  [[-4, 9, 32], [-5.2, 10.6, 35], [-4.4, 12, 37], [-5.8, 13.6, 38.2]],
  [[5, -6, 29], [7, -7.2, 32], [6.4, -8.4, 34], [8, -9.2, 35.4]],
  [[0, 12, 28], [0.8, 14.4, 31], [-0.4, 16.2, 33], [0.8, 18, 34.2]],
];
