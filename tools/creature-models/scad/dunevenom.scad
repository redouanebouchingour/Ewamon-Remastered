// Dunevenom: Scorpit grown up. A banded sand-gold scorpion on tall legs, heavy pincers glowing purple inside, a
// segmented tail arching high over its back into a pale venom bulb with a lime cap and a purple drip.
include <lib.scad>

gold = [0.85, 0.62, 0.25];
band = [0.6, 0.4, 0.15];
goldHi = [0.94, 0.75, 0.38];
purple = [0.5, 0.22, 0.55];
purpleGlow = [0.78, 0.55, 0.85];
bulb = [0.96, 0.94, 0.96];
venom = [0.75, 0.88, 0.2];
ink = [0.2, 0.1, 0.18];

// Banded segment: gold body with a darker band ring.
module seg(r, p, rot = [0, 0, 0]) {
  translate(p) rotate(rot) {
    color(gold) scale(r) sphere(1, $fn = 22);
    color(band) translate([0, 0, -r[2] * 0.15]) scale([r[0] * 1.04, r[1] * 1.04, r[2] * 0.35]) sphere(1, $fn = 22);
  }
}

// Body: head-thorax then abdomen segments, carried up on the legs.
blob([[[8.5, 7.5, 6], [0, -6, 13]], [[7.5, 6, 5.5], [0, 0, 13]]], gold);
ell([6, 4.5, 2.6], [0, -5, 17.6], goldHi);
for (i = [0 : 3]) {
  color(i % 2 == 0 ? band : gold) translate([0, 4 + i * 3.2, 13 - i * 0.3]) scale([7 - i * 0.6, 2.2, 5.2 - i * 0.4]) sphere(1, $fn = 24);
}
// Head crest: a short horn above the eyes.
spike([0, -8, 17.5], [0, -1.5, 4.5], 2.2, 0.2, gold);
mirror_x() spike([4.6, -9, 16.5], [1.5, -1, 2.5], 1.2, 0.1, band);

// Face: narrowed pale eyes with purple pupils, mandibles under them.
mirror_x() {
  eye([3.4, -13, 13.6], 2.1, iris = purple, sclera = [0.97, 0.94, 1], yaw = -20, pupil = [0.2, 0.05, 0.22], flat = 0.4);
  color(band) translate([3.4, -13.4, 15.6]) rotate([0, -20, -20]) scale([2.6, 0.8, 0.7]) sphere(1, $fn = 14);
  limb([2.2, -12.5, 10.4], [1.4, -15, 8.6], 1, 0.35, goldHi);
}
color(ink) translate([0, -13.6, 10.4]) scale([1.4, 0.4, 0.5]) sphere(1, $fn = 12);

// Pincers: banded arm, a heavy claw with a purple glowing gap and dripping purple.
module pincer() translate([14, -15, 10]) scale(1.25) translate([-14, 15, -10]) {
  chain([[6, -7, 12], [12, -10, 13], [14, -15, 10]], [2.2, 2.1, 2.3], gold);
  seg([2.4, 2.4, 2.4], [12, -10, 13]);
  // Claw: a bulky palm and two fingers that open forward.
  blob([[[3.2, 3.4, 3], [14, -16, 9]], [[2.6, 2.4, 2.4], [14.2, -19, 8]]], gold);
  chain([[13, -19.5, 9.5], [12.6, -23, 9], [11.6, -25, 7]], [1.8, 1.3, 0.5], gold);
  chain([[15.2, -19.5, 6.4], [15, -23, 5], [13.8, -25, 4.2]], [1.6, 1.1, 0.4], gold);
  ell([1.4, 2.8, 1.4], [13.6, -22.6, 7.2], purpleGlow);
  for (dx = [-0.6, 0.8]) limb([13.6 + dx, -23, 6.4], [13.6 + dx, -23.2, 3.4], 0.4, 0.3, purple);
}
mirror_x() pincer();

// Legs: four per side, tall banded arches down to pointed feet.
mirror_x() for (i = [0 : 3]) {
  y = -3 + i * 3.6;
  yo = (i - 1.5) * 3;
  chain([[6, y, 11], [12, y + yo * 0.6, 14], [16, y + yo, 6], [17.5, y + yo * 1.3, 0.5]], [1.6, 1.5, 1.2, 0.3], gold);
  color(band) translate([12, y + yo * 0.6, 14]) sphere(1.8, $fn = 14);
}

// Tail: banded segments arching high and forward over the back.
tailPts = [[0, 14, 12], [0, 19, 16], [0, 21, 22], [0, 20.5, 28], [0, 18, 33.5], [0, 13.5, 37], [0, 8, 37.5], [0, 4.5, 35]];
tailR = [3.6, 3.8, 3.8, 3.7, 3.5, 3.3, 3.0, 2.8];
chain(tailPts, tailR, gold);
for (i = [1 : len(tailPts) - 1]) color(band) translate(tailPts[i]) sphere(tailR[i] + 0.25, $fn = 16);
for (i = [0 : len(tailPts) - 2]) color(gold) translate((tailPts[i] + tailPts[i + 1]) / 2) sphere((tailR[i] + tailR[i + 1]) / 2 + 0.35, $fn = 16);

// Venom bulb hanging off the tail tip: pale with a purple blush, lime venom cupping its base, a purple drip.
ell([4.6, 4.4, 4.6], [0, 2.5, 30], bulb);
ell([2.6, 2.6, 3], [0, 4.5, 31.5], purpleGlow);
color(venom) intersection() {
  translate([0, 2.5, 30]) scale([4.8, 4.6, 4.8]) sphere(1, $fn = 24);
  translate([-6, -4, 22]) cube([12, 12, 6]);
}
for (a = [0 : 60 : 300]) color(venom) translate([0, 2.5, 30]) rotate([0, 0, a]) translate([3.6, 0, -1]) rotate([0, -30, 0]) scale([0.9, 0.9, 2.2]) sphere(1, $fn = 10);
spike([0, 2.5, 25.6], [0, -0.5, -2.4], 1.1, 0.1, venom);
limb([0, 2.3, 23.2], [0, 2.3, 21.6], 0.45, 0.4, purple);
ell([0.8, 0.8, 1], [0, 2.3, 20.8], purple);
