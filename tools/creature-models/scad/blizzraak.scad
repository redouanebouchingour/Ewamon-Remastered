// Blizzraak: Glacifang grown into a bulky sky-blue ice dragon, hunched on all fours, its neck and back armoured in
// deep-blue crystal clusters, a crowned wedge head held low and snarling, huge frosted wings and a bladed tail.
include <lib.scad>

skin = [0.5, 0.72, 0.93];
shade = [0.33, 0.56, 0.86];
belly = [0.84, 0.93, 1.0];
crystal = [0.18, 0.4, 0.84];
crystalHi = [0.6, 0.84, 1.0];
membrane = [0.7, 0.87, 1.0];
membrane2 = [0.58, 0.79, 0.98];
membraneDk = [0.42, 0.66, 0.93];
bone = [0.36, 0.6, 0.9];
mouth = [0.32, 0.1, 0.18];
fang = [0.97, 0.98, 1.0];
eyeRed = [1.0, 0.22, 0.12, GLOW];
socket = [0.12, 0.2, 0.42];
plate = [0.68, 0.84, 0.98];
claw = [0.93, 0.97, 1.0];

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

// Six-sided crystal shard from p along d.
module shard(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    cylinder(h = l * 0.55, r = r, $fn = 6);
    translate([0, 0, l]) sphere(r * 0.12, $fn = 6);
  }
}
// A clump of shards fanning out from p around direction up.
module cluster(p, s, up = [0, 0, 1]) {
  for (i = [0 : 5]) let(a = i * 60 + p[1] * 17, t = 30 + (i % 2) * 15)
    shard(p, (up * cos(t) + [cos(a), sin(a), 0] * sin(t)) * s * (0.8 + (i % 3) * 0.2), s * 0.45, i % 2 == 0 ? crystal : crystalHi);
  shard(p, up * s * 1.3, s * 0.55, crystal);
  color(crystal) translate(p) scale([1, 1, 0.7]) sphere(s * 0.7, $fn = 8);
}

// Bat wing: a thick bone arm (shoulder S, elbow E, wrist W) and finger spars fanning from the wrist; the membrane is a
// slab between neighbouring fingers, notched halfway so the trailing edge scallops, plus an inner panel to the flank.
module panel(base, b, c, depth, col, th) {
  ctr = base[0];
  m = ctr + ((b + c) / 2 - ctr) * depth;
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(b) sphere(th, $fn = 8); translate(m) sphere(th, $fn = 8); }
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(m) sphere(th, $fn = 8); translate(c) sphere(th, $fn = 8); }
}
module batwing(S, E, W, tips, root, r = 1, th = 0.4) {
  chain([S, E, W], [r * 1.7, r * 1.25, r], bone);
  // Deep-blue rim along the leading edge, a hooked white thumb claw at the wrist and claws at the finger tips.
  chain([S + [0, -0.5, 0.6], E + [0, -0.5, 0.7], W + [0, -0.4, 0.6], tips[0] + [0, 0, 0.3]], [r * 1.2, r * 0.9, r * 0.75, r * 0.3], crystal);
  chain([W, W + [-1.2, -1.6, 0.6], W + [-2, -2.4, -0.6]], [r * 0.5, r * 0.32, r * 0.06], claw);
  for (f = tips) spike(f, (f - W) * 0.12, r * 0.28, 0.03, claw);
  for (f = tips) limb(W, f, r * 0.62, r * 0.22, bone);
  shard(W, (W - E) * 0.25 + [0, -1, 1.5], r * 0.6, crystalHi);
  color(membrane) hull() for (q = [E, W, tips[0]]) translate(q) sphere(th, $fn = 8);
  for (k = [0 : len(tips) - 2]) panel([W], tips[k], tips[k + 1], 0.82, k % 2 == 0 ? membrane2 : membrane, th);
  // Frost-shaded strips along each finger, just proud of the membrane (front and back faces).
  for (f = tips) for (sd = [-1, 1]) color(membraneDk) hull() {
    translate(W + [0, sd * th * 1.2, 0]) sphere(th * 2.2, $fn = 6);
    translate(W + (f - W) * 0.85 + [0, sd * th * 1.2, 0]) sphere(th * 1.2, $fn = 6);
  }
  panel([W, E, S], tips[len(tips) - 1], root, 0.75, membrane2, th);
}

// Torso: a big hunched barrel, chest low in front, belly pale.
blob([[[7.8, 7, 7.6], [0, -4, 14]], [[7.2, 6, 6.6], [0, 4, 13]], [[6, 5.5, 4], [0, -2, 19.5]]], skin);
blob([[[5.2, 4, 4.2], [0, -8.5, 11]], [[5, 6, 2.6], [0, 1, 7.6]]], belly);

// Belly scutes: pale bands across the chest and under the neck; scale rows on the haunches and shoulders.
plates([0, -8.5, 11], [5.2, 4, 4.2], [for (el = [-35 : 17 : 40]) [-90, el, 2.2]], 0.3, plate);
plates([0, -12.5, 12.6], [3, 2.6, 2.4], [for (el = [-40 : 22 : 10]) [-90, el, 1.6]], 0.3, plate);
mirror_x() {
  plates([6.2, 5, 10.5], [4.8, 6, 6.4], [for (az = [-30 : 26 : 70]) for (el = [-15 : 18 : 40]) [az + el * 0.4, el, 1.15]], 0.35, shade);
  plates([6.4, -6.5, 12], [4, 4.6, 5.2], [for (az = [-40 : 30 : 40]) for (el = [0 : 20 : 40]) [az, el, 0.95]], 0.35, shade);
}

// Neck: thick, dropping forward from the shoulders so the head hangs lower than the back.
blob([[[5, 5, 5], [0, -8, 16]], [[3.8, 3.8, 3.6], [0, -14, 14.4]]], skin);
color(belly) hull() { translate([0, -10, 12.4]) scale([3.4, 3, 2.6]) sphere(1, $fn = 20); translate([0, -15, 12]) scale([2.6, 2, 2]) sphere(1, $fn = 16); }

// Head: a long wedge with a jutting brow, the jaw dropped open on rows of fangs; crystal crown and swept horns.
module head() {
  // Upper skull and snout.
  color(skin) hull() {
    translate([0, 0, 0.5]) scale([3.9, 3.6, 3.2]) sphere(1, $fn = 24);
    translate([0, -5.6, 0]) scale([2.9, 2.2, 2]) sphere(1, $fn = 20);
    translate([0, -8.8, -0.7]) scale([2.2, 1.2, 1.3]) sphere(1, $fn = 16);
  }
  // Snout ridge plates.
  color(shade) hull() { translate([0, -3, 2.6]) scale([1.6, 2, 0.8]) sphere(1, $fn = 12); translate([0, -8.6, 0.8]) scale([0.9, 1, 0.6]) sphere(1, $fn = 10); }
  // Lower jaw, pale, dropped open.
  color(belly) hull() {
    translate([0, -0.6, -3]) scale([3.2, 2.6, 1.5]) sphere(1, $fn = 18);
    translate([0, -7.6, -4.6]) scale([1.6, 1.2, 0.8]) sphere(1, $fn = 12);
  }
  color(mouth) hull() {
    translate([0, -1.4, -1.8]) scale([2.7, 2, 0.9]) sphere(1, $fn = 14);
    translate([0, -7.6, -2.8]) scale([1.4, 0.8, 0.7]) sphere(1, $fn = 10);
  }
  // Fangs: upper row hanging from the snout edge, a few lower ones rising.
  mirror_x() {
    for (i = [0 : 3]) let(y = -8.4 + i * 1.9, x = 1.6 + i * 0.45) spike([x, y, -1.6 + i * 0.05], [0, 0, -1.5 + i * 0.15], 0.38, 0.04, fang);
    for (i = [0 : 2]) let(y = -7.2 + i * 2.2, x = 1.3 + i * 0.5) spike([x, y, -4.2 + i * 0.3], [0, 0, 1.3], 0.32, 0.04, fang);
    color(shade) translate([0.8, -9.6, 0.6]) scale([0.5, 0.3, 0.25]) sphere(1, $fn = 8);
  }
  // Glowing red eyes sunk in dark sockets under a hard brow ridge.
  mirror_x() {
    color(socket) translate([2.45, -3.7, 1.1]) rotate([0, 0, 38]) scale([1.5, 0.6, 1.25]) sphere(1.3, $fn = 14);
    eye([2.4, -3.6, 1.1], 1.55, iris = eyeRed, pupil = [0.2, 0.02, 0.02], sclera = [1.0, 0.75, 0.3], yaw = 38, flat = 0.5,
        lid = 0.42, lid_tilt = 30, lid_c = socket);
    brow([2.4, -3.6, 1.1], 1.55, 38, 0.7, skin);
  }
  // Cheek frill of crystal spikes and long horns sweeping back.
  mirror_x() {
    shard([3.4, -1, -0.6], [3, 2.6, -0.4], 0.6, crystalHi);
    shard([3.6, 0.4, 0.6], [3.2, 2.8, 0.8], 0.6, crystal);
    chain([[2.2, -0.6, 2.8], [3.4, 2.8, 4.6], [4, 6.8, 5.4]], [0.9, 0.6, 0.14], crystal);
  }
  // Crown: a fan of shards standing up from the brow.
  for (k = [[0, -2.6, 0, 4.4], [1.5, -1.6, 22, 3.8], [-1.5, -1.6, -22, 3.8], [0, -0.4, 0, 5.2], [2.6, -0.2, 40, 3.4],
            [-2.6, -0.2, -40, 3.4], [1.3, 1, 15, 4.4], [-1.3, 1, -15, 4.4]])
    shard([k[0], k[1], 2.4], [sin(k[2]) * 2, 1.4, k[3]], 0.8, k[1] < -1 ? crystalHi : crystal);
}
translate([0, -15.5, 15]) rotate([-8, 0, 0]) scale(1.22) head();

// Crystal armour: big clusters up the neck, over the shoulders and along the back.
for (c = [[[0, -12, 18.4], 3.2], [[2.4, -9, 20], 3.4], [[-2.4, -9, 20], 3.4], [[0, -5, 22.6], 4], [[4.4, -4, 20.6], 3.4],
          [[-4.4, -4, 20.6], 3.4], [[1.6, 0, 23.4], 3.8], [[-2.4, 1, 23], 3.4], [[5.4, 2, 19.6], 3], [[-5.4, 2, 19.6], 3],
          [[0, 5, 21.6], 3.4], [[3, 8.4, 18.6], 2.6], [[-3, 8.4, 18.6], 2.6], [[0, 11.4, 16.6], 2.2]])
  cluster(c[0], c[1]);
// Smaller shards on the flanks.
for (p = [[6.6, -5, 14], [-6.6, -5, 14], [7, 2, 15], [-7, 2, 15]]) cluster(p, 1.5, [p[0] > 0 ? 0.6 : -0.6, 0, 0.8]);

// Legs: thick crouched forelegs, heavy haunches, white-clawed paws.
module foot(p) {
  color(skin) hull() { translate(p) scale([2.3, 2.6, 1.2]) sphere(1, $fn = 16); translate(p + [0, 1.4, 0.4]) scale([1.8, 1.4, 1.1]) sphere(1, $fn = 12); }
  for (a = [-32, 0, 32]) spike(p + [sin(a) * 1.6, -2.3, -0.2], [sin(a) * 0.5, -1.4, -0.6], 0.45, 0.05, fang);
}
mirror_x() {
  ell([4, 4.6, 5.2], [6.4, -6.5, 12], skin);
  limb([6.6, -7, 10], [8.2, -6.4, 5.4], 3.4, 2.6, skin);
  limb([8.2, -6.4, 5.4], [7.8, -10, 1.8], 2.6, 2.2, skin);
  shard([8.6, -5.6, 6], [1.2, 2, 0.6], 0.6, crystalHi);
  foot([7.6, -11, 1.3]);
  ell([4.8, 6, 6.4], [6.2, 5, 10.5], skin);
  limb([6.8, 6.4, 6.5], [7.2, 4.2, 1.8], 3.2, 2.4, skin);
  foot([7.2, 3.4, 1.3]);
}

// Tail: thick at the root, curling round on the ground to the creature's right and rising beside its head in an ice blade.
mirror([1, 0, 0]) {
tailPts = [[0, 10, 12], [2, 16, 7], [8, 18.5, 3.6], [14, 15, 2.8], [16.5, 8, 3.4], [16.5, 1, 6.5], [16, -4, 13], [15, -6, 20]];
tailRs = [5, 3.8, 3, 2.5, 2.1, 1.7, 1.3, 0.9];
chain(tailPts, tailRs, skin);
// Segment rings: darker scale bands across the tail so it doesn't read as a plain tube.
for (i = [0 : len(tailPts) - 2]) for (u = [0.35, 0.8]) let(d = tailPts[i + 1] - tailPts[i], r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(shade) translate(tailPts[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.28]) sphere(1, $fn = 10);
for (i = [1 : 6]) shard(tailPts[i] + [0, 0, tailRs[i] * 0.7], [0, 0, 2.6 - i * 0.2], 0.7, i % 2 == 0 ? crystal : crystalHi);
color(crystalHi) hull() { translate([15, -6, 19]) scale([0.8, 1.8, 1]) sphere(1.2, $fn = 8); translate([14.6, -8.4, 33]) sphere(0.2, $fn = 6); translate([15, -3.6, 26]) sphere(0.4, $fn = 6); }
color(crystal) hull() { translate([15, -5.4, 20]) sphere(0.8, $fn = 8); translate([15.4, -1.4, 25]) sphere(0.2, $fn = 6); }
color(crystal) hull() { translate([15, -6.6, 21]) sphere(0.7, $fn = 8); translate([15, -10, 24]) sphere(0.2, $fn = 6); }
}

// Wings: raised high off the shoulders and swept back, four fingers with scalloped frosted membrane.
mirror_x() batwing([5, -3, 19], [11, -1, 27], [13, 3, 38],
  [[24, 6, 36], [25, 10, 26], [21, 11, 17], [14, 11, 14.5]], [6.5, 7, 17], r = 1.15);
