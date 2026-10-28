// Murkrat: a hunched charcoal rat with acid-green eyes and drool, a plume of dark smoke rolling off its back.
include <lib.scad>

fur = [0.24, 0.26, 0.29];
furHi = [0.36, 0.38, 0.42];
furDk = [0.15, 0.16, 0.19];
skin = [0.42, 0.42, 0.45];
ear = [0.5, 0.42, 0.46];
smoke = [0.17, 0.18, 0.22];
smokeHi = [0.3, 0.32, 0.36];
acid = [0.6, 0.92, 0.15];
nose = [0.08, 0.08, 0.1];

// Body: a hunched pear, rump high behind, chest low and forward.
blob([[[8, 9, 8], [0, 3, 11]], [[6, 6, 5.5], [0, -4, 9]], [[5, 4, 4], [0, 8, 6]]], fur);
ell([6.5, 7, 4], [0, 3, 16], furHi);
// Belly underside, slightly lighter.
ell([5, 6, 3], [0, 0, 5.5], furHi);

// Head: wedge pointing forward and down.
blob([[[5, 5, 4.6], [0, -9, 10.5]], [[2.6, 3, 2.4], [0, -15, 8.5]], [[1.4, 1.5, 1.4], [0, -17.6, 8]]], fur);
ell([1, 0.9, 0.9], [0, -18.6, 8.2], nose);
// Whiskers.
mirror_x() for (a = [-12, 4]) color(skin) translate([1.6, -17, 8]) rotate([a, 0, -25]) rotate([0, 90, 0]) cylinder(h = 4, r = 0.12, $fn = 6);
// Open mouth with green drool.
color([0.35, 0.08, 0.1]) translate([0, -15.2, 6.7]) scale([1.8, 1.8, 0.7]) sphere(1, $fn = 14);
mirror_x() spike([0.6, -16.8, 7.3], [0, 0, -1], 0.35, 0.05, [0.95, 0.93, 0.85]);
limb([0.8, -15, 6.3], [1.1, -15.3, 3.6], 0.7, 0.45, acid);
limb([-0.9, -14.5, 6.3], [-1, -14.6, 4.6], 0.55, 0.4, acid);
ell([0.7, 0.7, 0.9], [1.1, -15.3, 3.3], acid);
// Glowing acid-green eyes sunk in dark sockets under a hard brow slanting down to the snout.
mirror_x() {
  color(furDk) translate([2.6, -12.2, 11.1]) rotate([0, 0, 18]) scale([1.9, 0.9, 1.6]) sphere(1, $fn = 14);
  eye([2.6, -12.7, 11.2], 1.8, iris = [0.8, 1, 0.3, GLOW], sclera = [0.55, 0.9, 0.1, GLOW], pupil = [0.05, 0.1, 0],
      yaw = 18, flat = 0.5, lid = 0.34, lid_tilt = 24, lid_c = furDk, slit = 0.3, squint = 0.1);
  color(fur) hull() {
    translate([4.1, -11, 13.3]) scale([1.1, 1.3, 0.6]) sphere(1, $fn = 10);
    translate([1.4, -13.9, 12.6]) scale([0.7, 1, 0.45]) sphere(1, $fn = 8);
  }
}
// Scruffy fur: ragged locks lying back over the haunches, a lighter streak among them.
mirror_x() for (k = [0 : 2]) color(k == 1 ? furHi : furDk) hull() {
  translate([8.2, 0 + k * 3, 12 - k * 1.5]) scale([0.6, 1.6, 1.2]) sphere(1, $fn = 8);
  translate([8.7, 3 + k * 3, 8.5 - k * 1.5]) sphere(0.15, $fn = 4);
}
// Round ears.
mirror_x() {
  petal([2.6, 0.8, 2.8], [4, -7, 14.5], [10, 0, -30], fur);
  petal([1.8, 0.4, 2], [3.9, -7.5, 14.5], [10, 0, -30], ear);
}

// Front legs: thin arms with long clawed fingers reaching forward.
mirror_x() {
  chain([[4, -6, 8], [4.6, -10, 4.5], [4.8, -12.5, 1.2]], [1.8, 1.1, 0.8], fur);
  for (a = [-25, 0, 25]) spike([4.8 + sin(a), -13, 0.9], [sin(a) * 1.2, -2.2, -0.6], 0.35, 0.05, skin);
}
// Hind legs: big haunches, long feet.
mirror_x() {
  ell([3.5, 5, 5], [5.5, 4, 7.5], fur);
  blob([[[1.8, 4.5, 1.1], [6, 0.5, 1.1]], [[1.5, 1.5, 1.2], [6, 4, 1.5]]], fur);
  for (a = [-20, 0, 20]) spike([6 + sin(a), -3.6, 0.8], [sin(a), -1.8, -0.4], 0.4, 0.05, skin);
}

// Long bare tail curling out behind, then forward along the ground to the viewer's right.
chain([[0, 11, 6], [2, 16, 3], [7, 18, 1.2], [12, 14, 1], [14, 8, 1.4], [13, 3, 2.5]], [1.6, 1.2, 1, 0.8, 0.6, 0.4], skin);
// Scaly rings banding the tail.
tl = [[0, 11, 6], [2, 16, 3], [7, 18, 1.2], [12, 14, 1], [14, 8, 1.4]];
tr = [1.6, 1.2, 1, 0.8, 0.6];
for (i = [0 : 3]) for (t = [0.33, 0.67]) let(d = tl[i + 1] - tl[i])
  color(skin * 0.75) translate(tl[i] + d * t) rotate(_dir_rot(d)) cylinder(h = 0.3, r = tr[i] + (tr[i + 1] - tr[i]) * t + 0.1, center = true, $fn = 10);

// Smoke plume rolling up off the back: puffs and wisps.
puffs = [[[7, 6, 6], [0, 8, 21]], [[6, 5, 6], [-6, 9, 25]], [[6, 5, 6], [6, 9, 25]], [[6, 5, 5.5], [0, 11, 29]],
         [[4.5, 4, 5], [-5, 12, 33]], [[4.5, 4, 5], [4, 12, 34]], [[3.5, 3.5, 3.5], [-1, 13, 38]],
         [[4, 4, 4], [-9, 6, 19]], [[4, 4, 4], [9, 6, 19]], [[3.5, 3.5, 3.5], [-10, 10, 28]], [[3.5, 3.5, 3.5], [10, 10, 29]]];
for (p = puffs) ell(p[0] * 0.8, [p[1][0] * 0.9, p[1][1] + 1, p[1][2] * 0.85 + 2], smoke);
// Lighter swirls on the smoke surface.
swirls = [[[2.5, 1, 2], [-3, 3, 24]], [[2, 1, 1.8], [4, 4, 27]], [[2.2, 1, 1.6], [0, 6, 31]], [[1.8, 1, 1.4], [-6, 7.5, 31]],
          [[2, 1, 1.6], [3, 13, 23]], [[2.2, 1, 1.8], [-4, 15, 28]], [[1.8, 1, 1.5], [2, 16, 32]]];
for (s = swirls) ell(s[0] * 1.2, [s[1][0] * 0.9, s[1][1] + 1, s[1][2] * 0.85 + 2], smokeHi);
// Detached wisps.
for (w = [[-12, 8, 35, 1.4], [11, 9, 37, 1.2], [3, 10, 42, 1.3], [-13, 4, 22, 1.2], [13, 6, 24, 1]])
  ell([w[3], w[3], w[3] * 1.6] * 0.8, [w[0] * 0.9, w[1], w[2] * 0.85 + 2], smoke);
