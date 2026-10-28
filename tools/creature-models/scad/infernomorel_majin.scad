// Infernomorel Majin: the corrupted Infernomorel. Cracked obsidian skin webbed with red magma, a rocky cap under a
// dark blood-red blaze trailing black smoke, red eyes and a sigil burning in its chest.
include <lib.scad>

coal = [0.17, 0.16, 0.17];
coalHi = [0.32, 0.31, 0.32];
capDk = [0.2, 0.12, 0.11];
capRed = [0.28, 0.17, 0.15];
smoke = [0.16, 0.1, 0.1];
lava = [0.9, 0.16, 0.05];
glow = [0.92, 0.25, 0.08];
glowCore = [1, 0.55, 0.15];
flameRed = [0.62, 0.07, 0.04];
flameOrange = [0.92, 0.28, 0.06];
flameCore = [1, 0.58, 0.15];
dark = [0.05, 0.03, 0.03];

// Flame tongue: a fat teardrop that bends at the tip.
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r, $fn = 12);
    translate(p + d * 0.4 + [0, 0, 0]) sphere(r * 0.75, $fn = 10);
  }
  color(c) hull() {
    translate(p + d * 0.4) sphere(r * 0.75, $fn = 10);
    translate(p + d + [d[2] * 0.15, 0, 0]) sphere(0.2, $fn = 6);
  }
}
// Glowing grin: a dark mouth with rows of glowing block teeth.
module grin(p, w, h, n) {
  translate(p) {
    color(dark) scale([w, 0.9, h]) sphere(1, $fn = 20);
    for (i = [0 : n - 1]) {
      x = -w * 0.7 + i * (1.4 * w) / (n - 1);
      k = 1 - pow(abs(x) / w, 2) * 0.5;
      color(glow) translate([x, -0.6, h * 0.42 * k]) cube([w * 1.2 / n, 0.8, h * 0.7 * k], center = true);
      color(glowCore) translate([x, -0.6, -h * 0.42 * k]) cube([w * 1.2 / n, 0.8, h * 0.7 * k], center = true);
    }
  }
}

// Torso: hunched, broad shoulders, slimmer waist.
blob([[[8, 7, 6], [0, 0, 10]], [[11.5, 8, 7], [0, 0.5, 19]]], coal);
// Chest maw.
// Chest sigil: a burning red disc with a dark split swirl.
ell([4, 1.4, 4], [0, -7, 16], coal);
ell([3.2, 1.4, 3.2], [0, -7.6, 16], lava);
color(dark) translate([0, -8.7, 16]) rotate([90, 0, 0]) linear_extrude(0.6, center = true) {
  difference() { circle(2.3, $fn = 24); circle(1.6, $fn = 24); translate([0, -2.5]) square([1.2, 2.5]); translate([-1.2, 0]) square([1.2, 2.5]); }
  translate([-0.15, -1.2]) square([0.3, 2.4]);
}
// Lava veins on the torso.
module vein(pts) { chain(pts, [for (p = pts) 0.3], lava); }
mirror_x() {
  vein([[4.5, -7, 21], [6.5, -6.5, 18], [6, -6.6, 13]]);
  vein([[3, 7.6, 22], [5, 7.4, 17], [3.5, 7.2, 12]]);
}
vein([[0, 8, 23], [0.5, 7.8, 17], [-1, 7.4, 11]]);

// Head: a squat dark dome tucked under the cap, carved jack-o'-lantern face.
blob([[[7.5, 6.5, 5.5], [0, -3.5, 25.5]], [[6.5, 6, 4], [0, -1, 28]]], coal);
mirror_x() {
  color([0.95, 0.1, 0.05]) translate([3.2, -9.3, 27]) rotate([0, -28, -15]) scale([2.6, 0.8, 1.3]) sphere(1, $fn = 14);
  color([1, 0.5, 0.4]) translate([3, -9.9, 27]) rotate([0, -28, -15]) scale([1.2, 0.4, 0.6]) sphere(1, $fn = 10);
}
grin([0, -9.2, 23.4], 3.8, 1.4, 6);

// Cap: wide, dark red, smouldering, tilted slightly back.
translate([0, 1, 30]) rotate([-6, 0, 0]) {
  color(dark) translate([0, 0, -0.6]) scale([16, 14.5, 1.6]) sphere(1, $fn = 40);
  color(capDk) scale([17, 15.5, 5]) difference() {
    sphere(1, $fn = 44);
    translate([0, 0, -1.2]) cube(2.4, center = true);
  }
  color(capRed) translate([0, 0, 0.6]) scale([14, 12.8, 5]) difference() {
    sphere(1, $fn = 36);
    translate([0, 0, -1.2]) cube(2.4, center = true);
  }
  // Glowing cracks around the rim.
  for (a = [0 : 30 : 330]) color(lava) translate([15.5 * cos(a), 14 * sin(a), 1.4]) rotate([0, 0, a]) scale([2, 0.5, 0.5]) sphere(1, $fn = 8);
  // Crown of fire.
  color(flameRed) translate([0, 0, 3]) scale([14, 12.8, 6]) sphere(1, $fn = 32);
  color(flameOrange) translate([0, -0.5, 5]) scale([10.5, 9.5, 7]) sphere(1, $fn = 28);
  color(flameCore) translate([0, -1, 7]) scale([6, 5.5, 6.5]) sphere(1, $fn = 20);
  for (f = [[0, 1, 5, 13, flameRed], [-8, -3, 4, 9, flameRed], [8, -3, 4, 10, flameRed], [-11, 3, 3.4, 8, flameRed],
            [11, 3, 3.4, 8, flameRed], [-5, 8, 4, 9, flameRed], [5, 8, 4, 10, flameRed], [-4, -7, 3.6, 9, flameOrange],
            [4, -7, 3.6, 10, flameOrange], [-10, -6, 2.6, 6, flameOrange], [10, -6, 2.6, 6.5, flameOrange],
            [0, -4, 3, 8, flameCore], [-5, 1, 2.6, 7, flameCore], [5, 2, 2.6, 7.5, flameCore]])
    tongue([f[0], f[1], 4.5], [f[0] * 0.12 + 1.5, f[1] * 0.1 + 2, f[3] * 1.4], f[2], f[4]);
}

// Arms: thick, hanging forward, with huge lava-glowing claws.
mirror_x() {
  limb([10, 0, 21], [13.5, -2.5, 14], 3.4, 3, coal);
  limb([13.5, -2.5, 14], [15, -5, 9], 3, 3.4, coal);
  // Hand.
  ell([4.4, 4, 3.6], [15.5, -6, 8], coal);
  vein([[13, -8.5, 10], [15.5, -9.6, 8.5], [18, -8.5, 9.5]]);
  vein([[17.5, -3, 15], [18.5, -4, 11]]);
  for (a = [-40, -13, 13, 40]) {
    c = [15.5 + sin(a) * 3.4, -8.5, 7];
    limb(c, c + [sin(a) * 1.2, -2.5, -3], 1.1, 0.6, glow);
    spike(c + [sin(a) * 1.2, -2.5, -3], [sin(a) * 0.3, -0.8, -1.6], 0.6, 0.05, glowCore);
  }
  spike([19.5, -5, 9], [1.5, -1.6, -1.8], 0.9, 0.05, glow);
}

// Legs: short, bowed, with glowing toe claws.
mirror_x() {
  limb([5, 0, 9], [7.5, -1, 4], 3.6, 3.2, coal);
  blob([[[3.2, 4.4, 2], [7.8, -2, 2]], [[3, 3, 2], [7.8, 0.5, 2.2]]], coal);
  vein([[6, -5, 3], [8, -5.6, 2.6], [9.5, -4.8, 3.4]]);
  for (a = [-28, 0, 28]) spike([7.8 + sin(a) * 2, -6.2, 1.2], [sin(a) * 0.5, -1.4, -0.5], 0.7, 0.05, glow);
}
// Shaggy back: a few lighter tufts.
mirror_x() vein([[7, 6.5, 22], [9, 5.5, 17], [7.5, 6, 13]]);

// Rocky chunks around the cap rim with magma between them.
translate([0, 1, 30]) rotate([-6, 0, 0]) for (a = [15 : 40 : 375]) color(coal) translate([14.5 * cos(a), 13 * sin(a), 2.2]) rotate([20, 10, a]) cube([4, 3, 2], center = true);
// Black smoke curling off the top of the blaze, drifting back and to the right.
chain([[0, 5, 46], [3, 6, 51], [7, 7, 53], [10, 8, 56], [13, 8, 57]], [3.4, 3, 2.6, 2, 1.2], smoke);
chain([[-4, 5, 44], [-3, 6, 49], [-0.5, 7, 52]], [2.6, 2.2, 1.4], smoke);
// More magma veins: a crack network over the chest, back, arms and legs.
vein([[0, 8.2, 22], [-3, 8, 19], [-6, 7.4, 17]]);
vein([[0, 8.2, 22], [3, 8, 20], [7, 6.8, 19]]);
vein([[0.5, 7.8, 17], [3.5, 7.4, 14], [6, 6.6, 10]]);
mirror_x() {
  vein([[4, -8, 20], [2.5, -8.2, 23], [4.5, -7.2, 25]]);
  vein([[13, -4.5, 16], [11.5, -3.5, 19.5], [12, -4, 21]]);
  vein([[16.5, -6.5, 12], [14.5, -6, 10]]);
  vein([[8.5, -4, 6], [7, -4.2, 3]]);
  vein([[10, 4, 6], [8, 3.2, 8]]);
}
