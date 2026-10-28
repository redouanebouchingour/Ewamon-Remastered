// Chrysotox: a hulking golem of grey-green bark and leaf shards, its small head sunk between spiked shoulders, glowing
// violet eyes over a fanged maw, huge clawed arms hanging to the ground, a toxic green glow in its chest.
include <lib.scad>

dk = [0.3, 0.32, 0.26];
mid = [0.46, 0.48, 0.38];
green = [0.48, 0.6, 0.4];
pale = [0.66, 0.68, 0.56];
glow = [0.62, 0.78, 0.5];
eyeC = [0.82, 0.35, 1];
eyeCore = [1, 0.8, 1];
fang = [0.8, 0.8, 0.68];
mist = [0.72, 0.76, 0.62];

// Pointed leaf shards lying on an ellipsoid surface: centre c, radii r, list of [azimuth, elevation, length];
// `up` makes them point upward (shoulder spikes), otherwise they hang down like shingles.
module shards(c, r, list, w = 1.6, up = false) {
  for (i = [0 : len(list) - 1]) {
    t = list[i];
    az = t[0]; el = t[1]; l = t[2];
    n = [cos(el) * cos(az), cos(el) * sin(az), sin(el)];
    p = [c[0] + r[0] * n[0], c[1] + r[1] * n[1], c[2] + r[2] * n[2]];
    col = i % 3 == 0 ? pale : (i % 3 == 1 ? mid : green);
    color(col) translate(p) rotate([0, 0, az]) rotate([0, up ? -el + 28 : 180 - el - 8, 0])
      hull() {
        translate([0.3, 0, 0]) scale([0.35, w * 0.7, 0.6]) sphere(1, $fn = 6);
        translate([0.6, 0, l * 0.35]) scale([0.4, w, 1]) sphere(1, $fn = 6);
        translate([1.2, 0, l]) sphere(0.12, $fn = 4);
      }
  }
}

// Torso: a massive barrel, broad at the chest, sloping into the hips.
blob([[[12, 9, 7], [0, 0, 25]], [[7.5, 6.5, 5], [0, 0.5, 15]]], mid);
// Chest plates and the toxic glow seeping between them.
ell([5, 2.6, 4], [0, -6.8, 21.5], glow);
shards([0, 0, 25], [12, 9, 7],
  [for (el = [-15, 25, 55], k = [0 : 10]) let(az = k * 360 / 11 + el * 0.5)
     if (el > 40 || abs(((az - 270 + 720) % 360) - 180) < 140) [az, el, 7.5]], 2.8);
shards([0, 0.5, 15], [7.5, 6.5, 5], [for (el = [-15, 20], k = [0 : 8]) [k * 40 + 10 + el, el, 6]], 2.4);
// A V of pale shards framing the glowing chest.
mirror_x() for (i = [0 : 2]) color(i % 2 == 0 ? pale : green)
  translate([2.5 + i * 2.2, -8.2 + i * 0.4, 26 - i * 0.5]) rotate([0, 155 - i * 10, -10])
    hull() { scale([0.4, 1.4, 1]) sphere(1, $fn = 8); translate([0, 0, 7]) sphere(0.12, $fn = 6); }

// Head: low between the shoulders, a shaggy shard brow, violet eyes and a ragged fanged jaw with a shard beard.
blob([[[5.4, 4.8, 4.4], [0, -6, 32]], [[4.6, 4, 3], [0, -8, 29.5]]], dk);
// Brow shards swept back into a crown.
for (i = [-3 : 3]) spike([i * 1.5, -8.5, 34], [i * 1.6, 5, 5.5 - abs(i) * 0.6], 1.3, 0.1, i % 2 == 0 ? pale : mid);
color(mid) translate([0, -10, 33]) rotate([12, 0, 0]) scale([5.8, 1.8, 1.3]) sphere(1, $fn = 16);
mirror_x() {
  color(eyeC) translate([2.3, -10.8, 31.6]) rotate([0, -18, -15]) scale([1.5, 0.6, 0.9]) sphere(1, $fn = 14);
  color(eyeCore) translate([2.3, -11.3, 31.7]) scale([0.65, 0.3, 0.45]) sphere(1, $fn = 10);
  // Cheek shards flaring sideways.
  spike([4.5, -8, 31], [3.5, 1, 1.5], 1.2, 0.1, mid);
}
// Maw: dark mouth with hanging fangs and a beard of shards.
color([0.12, 0.13, 0.1]) translate([0, -10.8, 28.8]) scale([3.4, 1, 1.3]) sphere(1, $fn = 16);
for (x = [-2.4 : 1.2 : 2.4]) spike([x, -11.2, 29.7], [0, -0.2, -1.8], 0.4, 0.05, fang);
for (x = [-3 : 1.5 : 3]) spike([x, -10, 27.4], [x * 0.3, -1.2, -4], 0.9, 0.1, x == 0 ? pale : mid);

// Shoulders: huge pauldrons of shards swept up and outward.
mirror_x() {
  ell([7, 6.5, 5.5], [12.5, 0.5, 28.5], mid);
  shards([12.5, 0.5, 28.5], [7, 6.5, 5.5], [for (el = [10, 50], k = [0 : 6]) [k * 360 / 7 + el, el, el > 40 ? 8 : 6]], 2.2, up = true);
  for (i = [0 : 2]) spike([12 + i * 2, 1 + i, 32], [3 + i * 2, 1.5, 6 - i], 1.4, 0.1, i == 1 ? pale : green);
}

// Arms: thick bark upper arms, massive shard-covered forearms hanging low, big hands with long curved claws.
mirror_x() {
  limb([13, 0, 27], [18.5, -1, 18], 3.8, 3.4, dk);
  shards([16, -0.5, 22.5], [3.6, 3.6, 4], [for (k = [0 : 5]) [k * 60, 20, 5]], 1.8);
  blob([[[4.6, 4.6, 4], [19, -1.5, 15]], [[4.2, 4.2, 3.5], [20, -3, 8]]], mid);
  ell([2.4, 2.6, 4], [18.6, -4.6, 11], green);
  shards([19.5, -2.2, 11.5], [4.6, 4.6, 5], [for (el = [-20, 25], k = [0 : 6]) [k * 360 / 7 + el, el, 6.5]], 2.2);
  ell([3.8, 3.6, 3], [20.2, -3.8, 4.8], dk);
  for (a = [-35, 0, 35]) chain([[20.2 + sin(a) * 2.6, -6, 4.4], [20.2 + sin(a) * 3, -8, 2.4], [20.2 + sin(a) * 3.2, -7.8, 0.6]],
                              [0.9, 0.6, 0.1], fang);
}

// Legs: short, massive pillars with shard skirts and three-clawed feet.
mirror_x() {
  limb([6, 0, 13], [7, -0.5, 3], 4.6, 4.2, dk);
  shards([6.5, -0.3, 9], [4.6, 4.6, 3], [for (k = [0 : 6]) [k * 360 / 7, 10, 5.5]], 2);
  blob([[[4.6, 5.2, 2.2], [7, -1.5, 2.2]], [[3.6, 3, 2], [7, 1.5, 2]]], mid);
  for (a = [-30, 0, 30]) spike([7 + sin(a) * 2.6, -6.2, 1.4], [sin(a) * 0.8, -1.6, -0.6], 0.8, 0.05, fang);
}

// Back: a ridge of tall shards along the spine.
for (i = [0 : 4]) spike([0, 7.5 - i * 0.4, 17 + i * 3.4], [0, 4.5, 3], 1.8, 0.1, i % 2 == 0 ? pale : mid);

