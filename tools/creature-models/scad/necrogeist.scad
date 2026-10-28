// Necrogeist: the last of the Malice line, a flame-crowned indigo wraith with neon-veined butterfly wings, a
// blazing pink star in its chest, a pale halo and a burst of pink light behind it.
include <lib.scad>

body = [0.22, 0.13, 0.36];
bodyHi = [0.34, 0.2, 0.5];
wingDk = [0.18, 0.1, 0.3];
wingMid = [0.4, 0.2, 0.55];
vPink = [1, 0.45, 0.85];
vCyan = [0.45, 0.85, 1];
glow = [1, 0.9, 0.45];
star = [1, 0.6, 0.95];
starCore = [1, 0.92, 1];
aura = [1, 0.7, 0.95];
halo = [1, 0.85, 0.95];

module paint(r, c, o, grow = 0.05, back = false) {
  intersection() {
    translate(c) difference() { scale(r * (1 + grow)) sphere(1, $fn = 40); scale(r * 0.97) sphere(1, $fn = 40); }
    translate([o[0], c[1], o[1]]) rotate([back ? -90 : 90, 0, 0]) linear_extrude(r[1] * 2) children();
  }
}
module crescent(r, off, ri) {
  difference() { circle(r, $fn = 24); translate(off) circle(ri, $fn = 24); }
}
// A 2D star with n sharp points.
module star2(n, ro, ri) {
  polygon([for (i = [0 : 2 * n - 1]) let(a = 90 + i * 180 / n, r = i % 2 == 0 ? ro : ri) [r * cos(a), r * sin(a)]]);
}

// Wispy lower body curling to the ground.
chain([[0, 0, 15], [0.5, 0.5, 10], [2, 1, 6], [4, 1.5, 3], [6, 1, 1.2], [7.5, 0.5, 1.4], [8, 0, 3]],
      [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5], body);
// Torso.
torso = [8, 7, 9];
torsoC = [0, 0, 21];
ell(torso, torsoC, body);
// Chest star: a glowing pink core with long sharp rays.
color(star) paint(torso, torsoC, [0, 22]) star2(4, 7.5, 1.4);
color(star) paint(torso, torsoC, [0, 22]) rotate(45) star2(4, 4, 1.2);
color(star) paint(torso, torsoC, [0, 22], grow = 0.08) circle(2.6, $fn = 20);
color(starCore) paint(torso, torsoC, [0, 22], grow = 0.11) circle(1.4, $fn = 16);
// Neon veins on the belly.
color(vPink) mirror_x() paint(torso, torsoC, [3.5, 15]) rotate(-30) square([0.6, 6], center = true);

// Clawed arms reaching forward and down.
mirror_x() {
  chain([[6, -1, 26], [10, -2, 22], [12, -3.5, 17], [12.5, -4.5, 13.5]], [2.6, 2.2, 2.2, 2], body);
  for (a = [-35, -10, 15, 40]) chain([[12.5, -4.5, 13.5], [12.5 + sin(a) * 1.8, -6, 12], [12.5 + sin(a) * 2.6, -6.6, 9.6]],
                                     [1, 0.6, 0.15], body);
}

// Head: a dome topped by flame-like horn tongues.
head = [8, 7, 7.5];
headC = [0, 0, 35];
ell(head, headC, body);
ell([4, 3, 3], [-2.5, -1, 40.5], bodyHi);
for (h = [[-5.5, 6, -25], [-2.5, 8.5, -8], [0, 9.5, 0], [2.5, 8.5, 8], [5.5, 6, 25]])
  limb([h[0], 0.5, 39], [h[0] + h[2] * 0.15, 0.5, 39 + h[1]], 2.2, 0.2, body);
// Slanted glowing eyes and a jagged grin.
color(glow) mirror_x() paint(head, headC, [3.2, 36.4]) rotate(18) scale([1.3, 0.85])
  difference() { circle(2.3, $fn = 24); translate([0, 2.3]) square(4.6, center = true); }
color(glow) paint(head, headC, [0, 31.5]) difference() {
  scale([1.45, 1]) crescent(3.4, [0, 1.8], 3.2);
  for (x = [-3.2 : 1.6 : 3.2]) translate([x, -1.2]) rotate(45) square(0.9, center = true);
}

// Halo: a pale ring floating above the head.
color(halo) translate([0, 1, 50]) rotate([12, 0, 0]) rotate_extrude($fn = 40) translate([4.6, 0]) scale([1, 0.6]) circle(0.6, $fn = 8);

// Butterfly wings: a big upper lobe and a smaller lower lobe each side, dark with pink and cyan neon edges.
module lobe(len, wid, ang) {
  rotate([0, -ang, 0]) translate([len / 2 + 1.5, 0, 0]) {
    color(vCyan) scale([len / 2 + 1.2, 0.4, wid + 1.2]) sphere(1, $fn = 28);
    color(vPink) scale([len / 2 + 0.4, 0.55, wid + 0.4]) sphere(1, $fn = 28);
    color(wingMid) translate([-0.6, 0, 0]) scale([len / 2 - 0.5, 0.7, wid - 0.4]) sphere(1, $fn = 28);
    color(wingDk) translate([-1.6, 0, 0]) scale([len / 3, 0.85, wid * 0.55]) sphere(1, $fn = 20);
    // Vein stripes along the lobe, both faces.
    for (y = [-0.75, 0.75]) color(vPink) translate([1, y, 0]) scale([len / 2.6, 0.3, 0.35]) sphere(1, $fn = 12);
  }
}
mirror_x() translate([5, 4, 30]) rotate([0, 0, 12]) {
  lobe(19, 5, 42);
  lobe(13, 3.6, -22);
  // Jagged spikes along the top edge of the upper wing.
  for (i = [0 : 2]) rotate([0, -42, 0]) spike([7 + i * 4, 0, 4.5 - i * 0.6], [1.5, 0, 2.6], 0.9, 0.1, wingDk);
}

// Burst of pink light behind the body: thin rays fanned in the back plane.
for (a = [0 : 20 : 340]) let(l = (a / 20) % 2 == 0 ? 25 : 20)
  color(aura) translate([0, 6.5, 27]) rotate([0, -a, 0]) translate([15, 0, 0]) rotate([0, 90, 0])
    cylinder(h = l - 13, r1 = 0.7, r2 = 0.05, $fn = 6);
