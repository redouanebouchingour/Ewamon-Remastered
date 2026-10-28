// Auroracle: Blizzhowl's final form, a regal fox carved from blue ice. Leaf-like crystal fur over a slender body,
// a great mane, nine curling crystal tails and ice shards floating around it.
include <lib.scad>

body = [0.55, 0.72, 0.95];
bodyLight = [0.72, 0.85, 1];
bodyDeep = [0.33, 0.52, 0.88];
tailA = [0.5, 0.68, 0.95];
tailB = [0.65, 0.8, 0.99];
vein = [0.88, 0.95, 1];
shard = [0.75, 0.9, 1];
paw = [0.3, 0.45, 0.85];
eyeC = [0.15, 0.2, 0.4];

// Leaf-shaped crystal scale, pointing along d from p.
module leaf(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    scale([w, w * 0.45, 0.1]) sphere(1, $fn = 12);
    translate([0, 0, l * 0.45]) scale([w * 1.1, w * 0.4, l * 0.3]) sphere(1, $fn = 12);
    translate([0, 0, l]) sphere(0.1, $fn = 6);
  }
}

// Faceted floating ice shard.
module iceShard(p, s, tilt) {
  color(shard) translate(p) rotate(tilt) scale([s, s, s * 1.8]) {
    cylinder(h = 0.6, r1 = 0.6, r2 = 0.6, $fn = 6, center = true);
    translate([0, 0, 0.3]) cylinder(h = 0.6, r1 = 0.6, r2 = 0.05, $fn = 6);
    mirror([0, 0, 1]) translate([0, 0, 0.3]) cylinder(h = 0.6, r1 = 0.6, r2 = 0.05, $fn = 6);
  }
}

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

// Body: slender and long-legged.
blob([[[5.2, 6, 5.6], [0, -3, 13]], [[4.8, 6, 5], [0, 6, 12.5]]], body);
ell([4.4, 8, 3], [0, 1, 8.5], bodyLight);

// Legs, tapering into darker paws.
module leg(x, y) {
  limb([x, y, 12], [x, y - 0.4, 5], 2.2, 1.6, body);
  limb([x, y - 0.4, 5.4], [x, y - 0.8, 3], 1.7, 1.7, body); limb([x, y - 0.8, 3], [x, y - 1, 1], 1.7, 1.8, paw);
  ell([2, 2.8, 1.1], [x, y - 1.7, 1.1], paw);
  leaf([x, y + 0.4, 10.5], [0.6, 1, -4], 1.2, bodyLight);
}
mirror_x() { leg(3.2, -5.5); leg(3.2, 9.5); }

module tail(yaw, pitch, len, c) {
  translate([0, 11, 17]) rotate([0, 0, yaw]) rotate([pitch, 0, 0]) {
    color(c) hull() {
      translate([0, 3, 0]) scale([2, 2.6, 1.8]) sphere(1, $fn = 16);
      translate([0, len * 0.55, 0]) scale([5.6, 5.6, 2.8]) sphere(1, $fn = 18);
      translate([0, len * 0.9, 1.5]) sphere(1.2, $fn = 10);
    }
    color(vein) hull() {
      translate([0, len * 0.9, 1.5]) sphere(1.2, $fn = 10);
      translate([0, len * 1.08, 5]) sphere(0.25, $fn = 6);
    }
    color(vein) translate([0, len * 0.55, 2.5]) scale([0.35, len * 0.4, 0.35]) sphere(1, $fn = 8);
  }
}

// Everything above the legs sits 3 lower (shorter legs).
translate([0, 0, -3]) {

// Great mane: layered crystal leaves around the neck and chest.
ell([7.2, 6.4, 6.8], [0, -6.5, 20.5], body);
for (a = [0 : 22.5 : 359]) {
  d = [cos(a), sin(a) * 0.85, 0];
  leaf([0, -6.5, 22] + d * 5, d * 3.4 + [0, 0, -4], 2.3, (a / 22.5) % 2 == 0 ? bodyLight : body);
  leaf([0, -6.5, 18.5] + d * 4.6, d * 2.8 + [0, 0, -4.6], 2.2, (a / 22.5) % 2 == 0 ? body : bodyDeep);
}
for (x = [-4 : 2 : 4]) leaf([x, -11, 19], [x * 0.2, -1, -5.5], 1.4, round(x / 2) % 2 == 0 ? bodyLight : body);
// Shoulder / back leaves.
for (y = [-2 : 3 : 7]) leaf([0, y, 20.5], [0, 2.5, 1.6], 1.6, bodyLight);

// Head: a narrow fox head with a pointed muzzle.
ell([6, 5.8, 5.6], [0, -9, 28.5], body);
blob([[[3, 2.6, 2.4], [0, -13, 27]], [[1.3, 1.4, 1.2], [0, -17.4, 26.6]]], body);
ell([2.6, 3.6, 1.6], [0, -13, 25.8], bodyLight);
ell([0.8, 0.6, 0.7], [0, -18.7, 27.1], eyeC);
// Calm, narrowed eyes sunk under a crystal brow: regal and cold rather than cruel.
mirror_x() {
  eye([2.8, -13.2, 29.2], 1.75, iris = [0.32, 0.36, 0.62], pupil = [0.04, 0.04, 0.1], sclera = [0.85, 0.92, 1], yaw = 4, flat = 0.4, lid = 0.48, lid_tilt = 18, lid_c = bodyDeep, slit = 0.4);
  brow([2.8, -13.2, 29.2], 1.75, 0.38, bodyLight, 4);
}
// Crystal forehead mark and cheek fins.
leaf([0, -13.2, 31], [0, -0.8, 2.6], 0.8, vein);
mirror_x() for (z = [25.5, 28]) leaf([5, -9.5, z], [3.4, 1, -0.6], 1.2, bodyLight);

// Tall crystal ears with a pale inner facet.
mirror_x() {
  color(body) hull() {
    translate([3.4, -8, 32.5]) scale([1.2, 0.7, 1]) sphere(2.5);
    translate([4.6, -8, 41.5]) sphere(0.4);
  }
  color(bodyLight) hull() {
    translate([3.5, -9.5, 33]) scale([0.7, 0.3, 0.8]) sphere(1.7);
    translate([4.5, -8.6, 39.5]) sphere(0.3);
  }
  leaf([5.2, -7.5, 32], [3, 1, 2.4], 1, bodyLight);
}
leaf([0, -10.5, 33.5], [0, 0.5, 4], 1.2, body);

// Nine curling crystal tails, each a plume with a pale vein and an upturned tip.
tail(0, 66, 22, tailA);
tail(-24, 55, 21, tailB);
tail(24, 55, 21, tailB);
tail(-46, 38, 20, tailA);
tail(46, 38, 20, tailA);
tail(-66, 18, 19, tailB);
tail(66, 18, 19, tailB);
tail(-84, 0, 17, tailA);
tail(84, 0, 17, tailA);
ell([3, 3, 3], [0, 11.5, 17], body);

// Ice shards drifting around it.
iceShard([-10, -4, 34], 2.2, [10, 20, 0]);
iceShard([12, 2, 37], 1.8, [-15, 10, 30]);
iceShard([15, 14, 27], 2.0, [20, -10, 0]);
iceShard([-16, 12, 30], 1.8, [0, 25, 40]);
iceShard([-12, -10, 16], 1.4, [30, 0, 10]);
iceShard([13, -8, 14], 1.6, [-20, 15, 0]);
}
