// Solpyre Tenjin: Solpyre ascended. Its plumage burns down to amber and bronze with pale-gold feather tips, golden
// light veins its body, a thin halo hangs behind the white-hot crest and sparks of light float around it.
include <lib.scad>

body = [0.72, 0.32, 0.12];
bodyHi = [0.88, 0.5, 0.2];
crimson = [0.6, 0.27, 0.1];
crimsonDk = [0.45, 0.18, 0.08];
pale = [1, 0.93, 0.7];
gold = [0.98, 0.68, 0.12];
goldHi = [1, 0.84, 0.35];
flameRed = [1, 0.5, 0.12];
flameOrange = [1, 0.72, 0.3];
flameCore = [1, 0.95, 0.75];
talon = [0.42, 0.28, 0.18];
beakC = [0.85, 0.55, 0.15];
beakDk = [0.55, 0.3, 0.08];
socket = [0.22, 0.03, 0.04];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): a hulled wedge in the skin colour, high at the
// temple and slanting down towards the nose, overhanging the eye so the face itself scowls.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.25]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.25, s * (1.25 - drop)]) scale([s * 0.5, s * 0.62, s * 0.32]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}
// Flat scales / plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th = 0.35, c) {
  for (t = list) let(az = t[0], el = t[1], sz = t[2])
    color(c) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = 8);
}

// Teardrop flame tongue: a round base swelling up and narrowing to a point.
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r, $fn = 12);
    translate(p + d * 0.45 + [d[0] * 0.2, 0, 0]) sphere(r * 0.7, $fn = 12);
    translate(p + d) sphere(0.2);
  }
}
module flame(p, s = 1, lean = [0, 0, 0]) {
  tongue(p, [0, 0, 7.5 * s] + lean, 3 * s, flameRed);
  for (y = [-1, 1]) {
    tongue(p + [0, y * 1.2 * s, -0.2 * s], [0.4 * s, 0, 5.5 * s] + lean * 0.8, 2.2 * s, flameOrange);
    tongue(p + [0, y * 2 * s, -0.5 * s], [0, 0, 3.2 * s] + lean * 0.6, 1.3 * s, flameCore);
  }
}
// Long feather: a flat blade from p along d, width w (lies in the XZ plane; the wing is flattened in Y afterwards).
module feather(p, d, w, c) {
  color(c) hull() {
    translate(p) sphere(w, $fn = 8);
    translate(p + d * 0.6) sphere(w * 0.8, $fn = 8);
    translate(p + d) sphere(0.2, $fn = 6);
  }
}
// One wing, raised up and out to +X from its root at the origin.
module wing() {
  rotate([0, 8, 0]) scale([1, 0.32, 1]) {
    // Primaries: long crimson blades fanning from out-sideways to straight up, each with a gold band.
    for (i = [0 : 7]) {
      a = 0 + i * 9;
      l = 12 + i * 1.3;
      base = [4 + i * 0.7, 0, 1 + i * 1.6];
      d = [cos(a) * l, 0, sin(a) * l];
      feather(base, d, 1.7, i % 2 == 0 ? crimson : crimsonDk);
      feather(base + d * 0.55, d * 0.45, 1.3, pale);
      for (y = [-1, 1]) {
        feather(base + d * 0.12 + [0, y * 2, 0], d * 0.4, 0.9, gold);
        feather(base + [0, y * 3.2, 0], d * 0.22, 1, flameOrange);
      }
    }
    // Coverts over the arm.
    for (i = [0 : 5]) {
      a = 15 + i * 12;
      feather([1 + i * 0.6, -3, i * 0.9], [cos(a) * 7, 0, sin(a) * 7], 1.5, i % 2 == 0 ? body : crimson);
    }
    // Leading-edge arm.
    color(body) hull() { sphere(2.2, $fn = 14); translate([8, -1, 9]) sphere(1.6, $fn = 12); }
  }
}

// Legs and talons.
mirror_x() {
  limb([2.6, 0, 12], [3.2, -0.5, 6.5], 1.6, 1, body);
  limb([3.2, -0.5, 6.5], [3.4, -0.6, 2.6], 0.8, 0.7, talon);
  for (a = [-35, 0, 35]) limb([3.4, -0.6, 2.6], [3.4 + sin(a) * 2.2, -0.6 - cos(a) * 2.2, 2], 0.5, 0.25, talon);
  limb([3.4, -0.6, 2.6], [3.4, 1.4, 2], 0.45, 0.25, talon);
}

// Body: an upright teardrop with a feathered breast.
blob([[[5.2, 4.6, 7], [0, 0.5, 17]], [[3.4, 3.4, 4], [0, -0.5, 24]]], body);
ell([3.6, 1.6, 5], [0, -3.4, 14.5], bodyHi);
// Golden sun medallion on the chest.
translate([0, -4.6, 20]) rotate([80, 0, 0]) {
  color(gold) cylinder(h = 0.9, r = 3.4, $fn = 28);
  color(goldHi) translate([0, 0, 0.6]) cylinder(h = 0.6, r = 2.2, $fn = 24);
  color(gold) translate([0, 0, 1]) cylinder(h = 0.5, r = 1.1, $fn = 16);
  for (a = [0 : 45 : 315]) color(goldHi) rotate([0, 0, a]) translate([2.8, 0, 0.7]) sphere(0.4, $fn = 8);
}

// Head with a hooked beak, fierce eyes and a crest of fire.
ell([3.2, 3.2, 3.4], [0, -1.6, 28], body);
color(beakC) hull() {
  translate([0, -4.4, 27.6]) sphere(1.1, $fn = 12);
  translate([0, -6.6, 26.6]) sphere(0.25, $fn = 8);
}
// Hooked lower mandible and a dark beak line; the cere ridge runs back over the eyes as a hard brow.
color(beakDk) hull() { translate([0, -4.2, 26.6]) sphere(0.8, $fn = 10); translate([0, -5.6, 26.2]) sphere(0.2, $fn = 6); }
mirror_x() {
  color(socket) translate([1.6, -3.7, 28.6]) rotate([0, 0, 24]) scale([1.5, 0.6, 1.25]) sphere(1.0, $fn = 14);
  eye([1.6, -3.7, 28.6], 1.25, iris = [1, 0.92, 0.5, GLOW], sclera = [1, 0.55, 0.1], pupil = [0.2, 0.03, 0], yaw = 24, flat = 0.5,
      lid = 0.45, lid_tilt = 32, lid_c = socket);
  brow([1.6, -3.7, 28.6], 1.25, 24, 0.75, crimson);
}
// Layered breast and back feathers: rows of overlapping scale feathers so the body isn't a smooth egg.
mirror_x() {
  plates([0, 0.5, 17], [5.2, 4.6, 7], [for (az = [-80 : 30 : 100]) for (el = [-35 : 20 : 30]) [az + el * 0.5, el, 1.5]], 0.32, bodyHi);
  plates([0, -0.5, 24], [3.4, 3.4, 4], [for (az = [-60 : 40 : 100]) for (el = [-10 : 25 : 30]) [az, el, 1.2]], 0.32, crimsonDk);
}
// Feathered thighs over the talons.
mirror_x() for (k = [0 : 2]) petal([1.3, 0.9, 2.2], [3 + k * 0.1, -0.4 + (k - 1) * 0.9, 9.6 - abs(k - 1) * 0.6], [0, -10, 0], k == 1 ? bodyHi : crimson);
flame([0, -0.4, 29.5], 1.2, [0, 1.5, 0]);
flame([2.4, 0.2, 29.2], 0.75, [2, 1, 0]);
flame([-2.4, 0.2, 29.2], 0.75, [-2, 1, 0]);

// Wings, raised from the shoulders.
translate([3.4, 1.5, 22]) wing();
translate([-3.4, 1.5, 22]) mirror([1, 0, 0]) wing();

// Tail: crimson tail feathers and flame streamers curling out to the viewer's right behind.
for (i = [-1 : 1]) feather([i * 1.2, 3.5, 12], [i * 2, 5, -7], 1.4, crimson);
// Streamers: flame tongues trailing out low to +X, the last ones curling up.
tongue([1, 4.5, 9], [8, 3, -3], 2, flameRed);
tongue([5, 7, 6.5], [7, 0, -1], 1.8, flameOrange);
tongue([9, 8, 6], [5, -1, 2], 1.6, flameRed);
tongue([12, 7, 7], [3, -2, 5], 1.4, flameOrange);
tongue([13.5, 5.5, 10], [-1, -1, 5], 1.1, flameCore);
tongue([-1, 4.5, 9], [-6, 3, -1], 1.6, flameRed);
tongue([-5, 7, 8], [-3, -1, 4], 1.2, flameOrange);

// Halo behind the crest.
color(goldHi) translate([0, 1.5, 31]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.6, r = 6.8, center = true, $fn = 40);
  cylinder(h = 1, r = 6.0, center = true, $fn = 40);
}
// Golden light veins over the body.
module vein(pts) chain(pts, [for (q = pts) 0.22], goldHi);
vein([[1.5, -3.8, 23], [2.5, -3.6, 18], [1.5, -4, 14], [2.8, -3.2, 10]]);
vein([[-1.6, -4, 17], [-2.6, -3.6, 13], [-1.8, -3.2, 10]]);
vein([[0, 4.6, 22], [1, 5, 18], [-0.5, 5, 14], [0.8, 4, 11]]);
vein([[-2.5, 4, 20], [-3.8, 3, 16]]);
// Floating sparks of light.
for (p = [[-16, -3, 30], [15, -2, 33], [-18, 0, 18], [18, 1, 20], [-10, -4, 36], [9, -3, 6], [-12, 2, 8], [6, 3, 37]])
  color(goldHi) translate(p) for (r = [[0, 0, 0], [0, 90, 0], [90, 0, 0]]) rotate(r) scale([0.25, 0.25, 1]) sphere(0.9, $fn = 8);
