// Ignispectre: a skeletal wraith in a tattered blue hooded robe, a skull wreathed in blue ghost fire with glowing blue
// eye sockets, an ember-lit ribcage, long bony clawed arms reaching out, and a robe that trails into flame and smoke.
include <lib.scad>

bone = [0.82, 0.74, 0.6];
boneDark = [0.6, 0.52, 0.4];
socket = [0.12, 0.1, 0.12];
robe = [0.18, 0.36, 0.6];
robeDark = [0.14, 0.27, 0.48];
robeLight = [0.3, 0.52, 0.78];
fireBlue = [0.45, 0.78, 1];
fireCyan = [0.55, 0.88, 1];
ember = [1, 0.55, 0.12];
emberCore = [1, 0.85, 0.35];
smoke = [0.72, 0.7, 0.68];

module curl(pts, r0, c) { chain(pts, [for (i = [0 : len(pts) - 1]) r0 * (1 - i / len(pts)) + 0.12], c); }

// Robe skirt: flowing tatters from the waist, flaring and waving down to the ground.
for (i = [0 : 15]) {
  a = i * 360 / 16;
  len = 13 + (i % 3) * 2.5;
  top = [3.4 * sin(a), 0.4 - 2.8 * cos(a), 18.5];
  mid = [6 * sin(a + 10), 0.4 - 5 * cos(a + 10), 18.5 - len * 0.55];
  bot = [10 * sin(a - 6), 0.4 - 8 * cos(a - 6), max(0.6, 18.5 - len)];
  c = i % 3 == 0 ? robeLight : (i % 3 == 1 ? robe : robeDark);
  color(c) hull() { translate(top) scale([1.8, 1.4, 1]) sphere(1, $fn = 10); translate(mid) scale([2, 1.2, 1]) sphere(1, $fn = 10); }
  color(c) hull() { translate(mid) scale([2, 1.2, 1]) sphere(1, $fn = 10); translate(bot) scale([1.2, 0.8, 0.5]) sphere(1, $fn = 8); }
}
ell([4.6, 3.8, 3], [0, 0, 17], robeDark);
// Torn ends drifting to the sides along the ground.
curl([[6, -3, 3], [10, -4, 1.5], [14, -3, 1.2]], 1.8, robe);
curl([[-6, -2, 3], [-10, -3, 1.5], [-13, -1, 1.5]], 1.6, robeLight);
// Blue flame licks and smoke puffs at the hem.
for (p = [[3, -7, 0.5], [-4, -6.5, 0.5], [8, -3, 0.5], [-8, -1, 0.5], [1, 6, 0.5]]) curl([p, p + [0.5, 0, 3], p + [-0.4, 0, 6]], 1.5, fireBlue);
for (p = [[11, 0, 1.8], [13, 2, 1.5], [-11, 1, 1.8], [-13, -1, 1.4], [9, 4, 1.5], [-9, 4, 1.5]]) color(smoke) translate(p) scale([2.4, 2.2, 1.6]) sphere(1, $fn = 12);

// Spine and pelvis, ember ribcage.
limb([0, 1, 18], [0, 1.4, 27], 0.9, 1, bone);
ell([3.4, 2.2, 1.6], [0, 0.6, 18.4], bone);
ell([3.4, 2.4, 4.2], [0, 0, 25], ember);
ell([2, 1.6, 2.4], [0, -1.2, 23.2], emberCore);
for (k = [0 : 4]) {
  z = 22 + k * 1.6;
  w = 4.8 - abs(k - 2.5) * 0.45;
  color(bone) translate([0, -0.2, z]) rotate([10, 0, 0]) scale([w, 3.6, 0.6]) difference() {
    sphere(1, $fn = 20);
    scale([0.8, 0.8, 2]) sphere(1, $fn = 20);
    translate([0, -1.2, 0]) cube([0.5, 1, 4], center = true);
  }
}
color(bone) translate([0, -3.3, 25]) scale([0.6, 0.4, 3.4]) sphere(1, $fn = 10);
// Shoulder girdle.
limb([-5, 0.2, 29], [5, 0.2, 29], 0.9, 0.9, bone);

// Hood and mantle: a cowl draped behind the skull and over the shoulders, hanging in tatters at chest and back.
color(robe) hull() {
  translate([0, 1.2, 29.5]) scale([6.8, 4.4, 2.2]) sphere(1, $fn = 20);
  translate([0, 2.6, 33]) scale([4.6, 3, 4.6]) sphere(1, $fn = 20);
}
for (i = [0 : 8]) {
  a = 50 + i * 32.5;
  top = [6 * sin(a), 1 - 4 * cos(a), 29];
  bot = [7.6 * sin(a), 1 - 5 * cos(a), 19 + (i % 2) * 2.5];
  color(i % 2 == 0 ? robe : robeLight) hull() { translate(top) sphere(1.6, $fn = 8); translate(bot) sphere(0.5, $fn = 6); }
}

// Skull: cranium, cheekbones, glowing blue sockets, toothy jaw.
S = [0, -2.8, 34.2];
ell([4, 4, 3.8], S, bone);
ell([2.8, 2.4, 2], S + [0, -1.6, -3], bone);
mirror_x() {
  ell([1.3, 0.7, 1.4], S + [1.5, -3.4, 0.1], socket);
  color(fireCyan) translate(S + [1.5, -3.85, 0.2]) scale([0.6, 0.3, 0.75]) sphere(1, $fn = 10);
}
ell([0.5, 0.4, 0.6], S + [0, -3.9, -1.3], socket);
color(socket) translate(S + [0, -3.6, -3]) cube([3.6, 0.6, 0.4], center = true);
for (k = [-1.2 : 0.6 : 1.2]) color([0.95, 0.9, 0.8]) translate(S + [k, -3.8, -2.5]) cube([0.4, 0.5, 0.8], center = true);

// Ghost fire crown wreathing the skull.
for (t = [[0, 0.5, [0, 1, 9], 3.4], [2.6, 0.5, [3, 1, 7], 2.2], [-2.6, 0.5, [-3, 1, 7], 2.2], [1.5, 2.5, [1, 3, 7], 2.2],
          [-1.5, 2.5, [-1.5, 3, 6], 2], [3.4, -1, [4, -1, 5], 1.6], [-3.4, -1, [-4, -1, 5], 1.6]]) {
  p = S + [t[0] * 1.15, t[1] + 1.2, 1.8];
  curl([p, p + t[2] * 0.5 + [0, 0, 0.6], p + t[2]], t[3], fireBlue);
}
curl([S + [0, -0.6, 3], S + [0.4, -0.6, 6], S + [0, -0.6, 8.5]], 1.8, fireCyan);

// Arms: thin bones reaching out, the viewer's right one raised, long hooked claws.
module arm(p, e, w, fingers) {
  limb(p, e, 1, 0.85, bone);
  ell([1, 1, 1], e, boneDark);
  limb(e, w, 0.8, 0.7, bone);
  ell([1.2, 0.9, 1.2], w, bone);
  for (f = fingers) chain([w, w + f[0] * 1.3, w + f[1] * 1.3], [0.55, 0.45, 0.2], bone);
}
arm([5.5, 0.2, 29], [11, -1, 24], [17, -3, 28], [[[1.5, -0.6, 2], [1, -1.2, 4]], [[2.4, -0.6, 1], [3.4, -1.4, 2.6]], [[2.6, -0.6, -0.4], [4.2, -1.4, 0.6]], [[1.6, -0.6, -1.4], [2.6, -1.4, -2.6]]]);
arm([-5.5, 0.2, 29], [-11, -1, 23], [-16.5, -3, 19.5], [[[-1.8, -0.6, -1], [-3, -1.2, -2.6]], [[-2.4, -0.6, 0], [-4, -1.2, -1]], [[-2.2, -0.6, 1], [-3.8, -1.2, 1.4]], [[-1, -0.6, -1.8], [-1, -1.2, -3.6]]]);
// Sleeve tatters hanging off the upper arms.
for (s = [-1, 1]) for (k = [0 : 2]) {
  p = [s * (6.5 + k * 1.6), 0.2, 28.2 - k * 1.4];
  color(k == 1 ? robeLight : robe) hull() { translate(p) sphere(1.4, $fn = 8); translate(p + [s * 1.2, 0.4, -6 + k]) sphere(0.4, $fn = 6); }
}

// Wisps: small blue and ember flames floating nearby.
for (p = [[-12, -1, 34], [-13, -2, 18]]) curl([p, p + [0, 0, 2], p + [0, 0, 4]], 1.4, fireBlue);
for (p = [[13, -1, 34], [-9, -2, 12]]) curl([p, p + [0, 0, 1.5], p + [0, 0, 3]], 1, ember);
