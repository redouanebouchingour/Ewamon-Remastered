// Glacifang: a pale frost drake prowling on all fours, a snarling wedge head with swept horns and green eyes, a ridge
// of ice crystals down its back, frosted bat wings with a lavender sheen and a long spiked tail curling up behind.
include <lib.scad>

skin = [0.87, 0.93, 0.99];
shade = [0.7, 0.8, 0.93];
belly = [0.76, 0.86, 0.92];
crystal = [0.68, 0.86, 1.0];
crystalHi = [0.92, 0.98, 1.0];
membrane = [0.92, 0.95, 1.0];
membrane2 = [0.84, 0.8, 0.97];
bone = [0.62, 0.75, 0.92];
eyeGreen = [0.45, 1.0, 0.25, GLOW];
mouth = [0.32, 0.12, 0.2];
fang = [0.97, 0.98, 1.0];
socket = [0.36, 0.48, 0.7];
scaleC = [0.68, 0.8, 0.96];
membraneDk = [0.74, 0.72, 0.93];

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

// Six-sided ice shard from p along d.
module shard(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    cylinder(h = l * 0.5, r = r, $fn = 6);
    translate([0, 0, l]) sphere(r * 0.12, $fn = 6);
  }
}

// Bat wing: a thick bone arm (shoulder S, elbow E, wrist W) and finger spars fanning from the wrist; the membrane is a
// slab between neighbouring fingers, notched halfway so the trailing edge scallops, plus an inner panel to the flank.
module panel(base, b, c, depth, col, th) {
  ctr = base[0];
  m = ctr + ((b + c) / 2 - ctr) * depth;
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(b) sphere(th, $fn = 8); translate(m) sphere(th, $fn = 8); }
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(m) sphere(th, $fn = 8); translate(c) sphere(th, $fn = 8); }
}
module batwing(S, E, W, tips, root, r = 1, th = 0.35) {
  chain([S, E, W], [r * 1.6, r * 1.2, r], bone);
  for (f = tips) limb(W, f, r * 0.6, r * 0.22, bone);
  spike(W, [0.4, -0.6, 2.4], r * 0.6, 0.05, bone);
  // Ice-blue rim along the leading edge, a hooked thumb claw and claws at the finger tips.
  chain([S + [0, -0.5, 0.6], E + [0, -0.5, 0.7], W + [0, -0.4, 0.6], tips[0] + [0, 0, 0.3]], [r * 1.15, r * 0.85, r * 0.7, r * 0.28], crystal);
  chain([W, W + [-1.1, -1.5, 0.5], W + [-1.8, -2.2, -0.6]], [r * 0.5, r * 0.32, r * 0.06], fang);
  for (f = tips) spike(f, (f - W) * 0.12, r * 0.28, 0.03, fang);
  // Lavender shading strips along each finger, on both faces of the membrane.
  for (f = tips) for (sd = [-1, 1]) color(membraneDk) hull() {
    translate(W + [0, sd * th * 1.2, 0]) sphere(th * 2.2, $fn = 6);
    translate(W + (f - W) * 0.85 + [0, sd * th * 1.2, 0]) sphere(th * 1.2, $fn = 6);
  }
  color(membrane) hull() for (q = [E, W, tips[0]]) translate(q) sphere(th, $fn = 8);
  for (k = [0 : len(tips) - 2]) panel([W], tips[k], tips[k + 1], 0.8, k % 2 == 0 ? membrane2 : membrane, th);
  panel([W, E, S], tips[len(tips) - 1], root, 0.74, membrane2, th);
}

// Torso: deep chest, tucked waist, rounded haunches.
blob([[[6.4, 6, 6.6], [0, -4, 13.5]], [[5.2, 5, 5.2], [0, 2.5, 13]], [[5.8, 4, 5.6], [0, 5.5, 12.5]]], skin);
blob([[[4.4, 3.6, 4], [0, -7.6, 11.4]], [[3.8, 5, 2.4], [0, 0, 8.8]]], belly);

// Cracked-ice scale cells over the shoulders, flanks and haunches; pale bands down the chest.
mirror_x() {
  plates([0, -4, 13.5], [6.4, 6, 6.6], [for (az = [-60 : 24 : 40]) for (el = [5 : 18 : 60]) [az + el * 0.3, el, 1.25]], 0.35, scaleC);
  plates([5, 5, 11.4], [4.2, 5.2, 5.8], [for (az = [-30 : 25 : 75]) for (el = [-15 : 18 : 45]) [az + el * 0.4, el, 1.05]], 0.35, scaleC);
  plates([4.8, -6, 13], [3.4, 4, 4.6], [for (az = [-40 : 30 : 40]) for (el = [-10 : 20 : 30]) [az, el, 0.9]], 0.35, scaleC);
}
plates([0, -7.6, 11.4], [4.4, 3.6, 4], [for (el = [-35 : 17 : 40]) [-90, el, 2]], 0.3, shade);

// Neck reaching forward and down to a head held level with the shoulders.
blob([[[4.4, 4.4, 4.6], [0, -7.5, 16]], [[3.2, 3.4, 3.2], [0, -13, 15.4]]], skin);
color(belly) hull() { translate([0, -10, 13.2]) scale([2.8, 2.8, 2.2]) sphere(1, $fn = 18); translate([0, -14, 13]) scale([2.2, 1.8, 1.8]) sphere(1, $fn = 14); }

// Head: a wedge skull with a heavy brow and a jaw open in a snarl; two horns and cheek spikes swept back.
module head() {
  color(skin) hull() {
    translate([0, 0, 0.4]) scale([3.5, 3.3, 3]) sphere(1, $fn = 24);
    translate([0, -5.2, -0.1]) scale([2.6, 2.1, 1.9]) sphere(1, $fn = 20);
    translate([0, -8.2, -0.6]) scale([2, 1.1, 1.3]) sphere(1, $fn = 16);
  }
  color(shade) hull() { translate([0, -3, 2.4]) scale([1.4, 1.8, 0.7]) sphere(1, $fn = 12); translate([0, -7.8, 0.6]) scale([0.8, 0.9, 0.5]) sphere(1, $fn = 10); }
  // Lower jaw dropped open.
  color(belly) hull() {
    translate([0, -0.6, -2.7]) scale([2.9, 2.4, 1.4]) sphere(1, $fn = 18);
    translate([0, -7, -4]) scale([1.5, 1.1, 0.7]) sphere(1, $fn = 12);
  }
  color(mouth) hull() {
    translate([0, -1.4, -1.6]) scale([2.4, 1.8, 0.8]) sphere(1, $fn = 14);
    translate([0, -7, -2.5]) scale([1.3, 0.8, 0.6]) sphere(1, $fn = 10);
  }
  mirror_x() {
    for (i = [0 : 3]) let(y = -7.6 + i * 1.7, x = 1.5 + i * 0.4) spike([x, y, -1.5], [0, 0, -1.3 + i * 0.12], 0.34, 0.04, fang);
    for (i = [0 : 1]) spike([1.3 + i * 0.6, -6.4 + i * 2.2, -3.6], [0, 0, 1.2], 0.3, 0.04, fang);
    color(shade) translate([0.75, -8.8, 0.5]) scale([0.45, 0.3, 0.22]) sphere(1, $fn = 8);
  }
  // Green glaring eyes.
  mirror_x() {
    color(socket) translate([2.3, -3.4, 1.0]) rotate([0, 0, 38]) scale([1.5, 0.6, 1.25]) sphere(1.3, $fn = 14);
    eye([2.25, -3.35, 1.0], 1.5, iris = eyeGreen, pupil = [0.02, 0.15, 0.02], yaw = 38, flat = 0.5, lid = 0.42, lid_tilt = 30, lid_c = socket);
    brow([2.25, -3.35, 1.0], 1.5, 38, 0.7, skin);
  }
  // Horns sweeping back and up, cheek spikes, a crest of shards between the horns.
  mirror_x() {
    chain([[1.8, -0.8, 2.6], [2.8, 2.4, 5], [3.2, 5.6, 7.4]], [1, 0.65, 0.12], crystal);
    spike([3, -1, -0.8], [2.8, 3, -0.4], 0.7, 0.05, crystalHi);
    spike([3.2, 0.6, 0.6], [2.8, 3, 1], 0.6, 0.05, skin);
  }
  for (k = [[0, -1.6, 3.4], [0, 0.6, 4]]) shard([0, k[1], 2.4], [0, 1, k[2]], 0.6, crystalHi);
}
translate([0, -13.6, 16]) rotate([-6, 0, 0]) scale(1.38) head();

// Ice crystals up the spine: tall clusters of three, tallest over the shoulders.
for (s = [[-11, 18.6, 3.4], [-8, 19.6, 4.6], [-5, 20, 6], [-2, 19.6, 5.6], [1, 18.6, 4.8], [4, 17.6, 4], [7, 16.6, 3.2]]) {
  shard([0, s[0], s[1]], [0, 1.2, s[2]], 1.1, crystal);
  shard([1.3, s[0] + 0.4, s[1] - 0.8], [1.3, 0.6, s[2] * 0.65], 0.75, crystalHi);
  shard([-1.3, s[0] + 0.4, s[1] - 0.8], [-1.3, 0.6, s[2] * 0.65], 0.75, crystalHi);
}

// Legs: crouched forelegs with a bent elbow, muscular haunches, white claws.
module foot(p) {
  color(skin) hull() { translate(p) scale([2, 2.4, 1.1]) sphere(1, $fn = 16); translate(p + [0, 1.4, 0.4]) scale([1.6, 1.3, 1]) sphere(1, $fn = 12); }
  for (a = [-32, 0, 32]) spike(p + [sin(a) * 1.4, -2.1, -0.2], [sin(a) * 0.5, -1.3, -0.6], 0.4, 0.05, fang);
}
mirror_x() {
  blob([[[3.4, 4, 4.6], [4.8, -6, 13]], [[2.8, 3, 2.6], [6.4, -5.6, 8.6]]], skin);
  limb([6.4, -5.6, 8.4], [7.2, -5.6, 5.4], 2.8, 2.4, skin);
  limb([7.2, -5.6, 5.4], [6.8, -9.4, 1.8], 2.4, 2, skin);
  foot([6.8, -10.2, 1.2]);
  ell([4.2, 5.2, 5.8], [5, 5, 11.4], skin);
  limb([5.8, 6.6, 8], [6.4, 7.8, 4], 3.2, 2.2, skin);
  limb([6.4, 7.8, 4], [6.4, 5.4, 1.5], 2.2, 1.9, skin);
  foot([6.4, 4.6, 1.2]);
}

// Tail: long, sweeping out behind and curling up on the creature's left, spiked along the top.
tailPts = [[0, 9, 12.5], [2, 15, 10], [7, 18, 8], [12, 16, 9], [14, 11, 13], [13, 8, 18], [11, 9, 21]];
tailRs = [3.6, 3, 2.5, 2, 1.6, 1.2, 0.6];
chain(tailPts, tailRs, skin);
// Scale bands across the tail so it doesn't read as a plain tube.
for (i = [0 : len(tailPts) - 2]) for (u = [0.35, 0.8]) let(d = tailPts[i + 1] - tailPts[i], r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(scaleC) translate(tailPts[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.28]) sphere(1, $fn = 10);
color(belly) for (i = [0 : 3]) hull() { translate(tailPts[i] + [0, 0, -tailRs[i] * 0.5]) sphere(tailRs[i] * 0.6, $fn = 12); translate(tailPts[i + 1] + [0, 0, -tailRs[i + 1] * 0.5]) sphere(tailRs[i + 1] * 0.6, $fn = 12); }
for (i = [1 : 5]) shard(tailPts[i] + [0, 0, tailRs[i] * 0.6], [0, 0, 2.6 - i * 0.25], 0.7, i % 2 == 0 ? crystal : crystalHi);

// Wings: raised and swept back, four fingers with scalloped frosted membrane.
mirror_x() batwing([4.4, -3, 18.6], [10, -1, 25.6], [12, 3, 35.5],
  [[21, 6, 33], [22, 9.6, 24], [18, 10.6, 17], [12, 10, 15]], [5.4, 6, 16.4], r = 0.95);

// Frost breath puffs at the mouth.
for (p = [[-3, -26.6, 13], [-4.2, -27.6, 15], [-2, -28.4, 15.4]]) ell([0.8, 0.8, 0.8], p, crystalHi);
