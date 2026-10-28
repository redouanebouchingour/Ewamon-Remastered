// Bogmaw: Mudbub grown into a hulking, crouched bog toad: a huge grinning maw of square teeth over an orange throat sac,
// moss-streaked warty grey-brown hide, splayed clawed legs and a long crocodile tail.
include <lib.scad>

hide = [0.38, 0.36, 0.27];
hideDark = [0.28, 0.25, 0.2];
moss = [0.4, 0.55, 0.22];
throat = [0.8, 0.5, 0.3];
throatDark = [0.62, 0.36, 0.22];
tooth = [0.88, 0.83, 0.66];
gum = [0.2, 0.12, 0.1];
iris = [0.75, 0.62, 0.3];

// Body: a wide hunched mound sloping down to the tail.
blob([[[13, 11, 9], [0, 4, 13]], [[12, 9, 9], [0, -3, 16]], [[9, 8, 6], [0, 11, 9]]], hide);
// Orange underbelly showing between the front legs.
ell([9, 6, 6], [0, -5, 9], throatDark);

// Head: broad and flat, pushed forward.
blob([[[13, 8, 5], [0, -7, 22]], [[11, 6, 4], [0, -10, 23]]], hide);
// Brow ridges and eyes on top.
mirror_x() {
  ell([3.6, 3.4, 2.8], [6.5, -8, 26], hide);
  eye([6.6, -10.6, 26.4], 1.7, iris = iris, pupil = [0.05, 0.05, 0.04], sclera = [0.7, 0.66, 0.5], yaw = -20, flat = 0.6);
  color(hideDark) translate([6.4, -10.4, 27.8]) rotate([0, -10, -20]) scale([2.6, 1, 0.7]) sphere(1, $fn = 14);
}
// Dark mouth cavity.
color(gum) translate([0, -10.5, 18.8]) scale([12, 5.6, 3.6]) sphere(1, $fn = 32);
// Upper row of big square teeth along the jaw curve.
for (i = [-5 : 5]) {
  a = i * 13;
  color(tooth) translate([sin(a) * 11.4, -9.4 - cos(a) * 7, 19]) rotate([0, 0, a]) cube([2.1, 1.6, 4.6], center = true);
}
// Lower jaw: an orange throat sac bulging under the teeth.
blob([[[12.5, 7, 4.5], [0, -9, 14.5]], [[10, 5, 3], [0, -11, 15.5]]], throat);
// Moss drips over the throat and jaw corners.
for (x = [-9, -4, 3, 8]) limb([x, -15.6 + abs(x) * 0.25, 16], [x * 1.02, -15.2 + abs(x) * 0.25, 13], 0.7, 0.5, moss);

// Warts and moss patches over the back: [x, y, z, size, isMoss].
bumps = [[4, 0, 22, 1.6, 1], [-5, 2, 21.5, 1.4, 0], [8, 6, 19.5, 1.8, 0], [-9, 7, 19, 1.5, 1], [2, 9, 19.5, 2, 1],
         [-2, 14, 15, 1.6, 0], [6, 14, 14.5, 1.4, 1], [11, 0, 17, 1.5, 1], [-11, -1, 17, 1.6, 0], [0, 4, 22.2, 1.4, 0],
         [-6, 12, 16, 1.4, 1], [9, 11, 16, 1.3, 0], [12, 4, 12, 1.4, 0], [-12, 5, 12, 1.4, 1], [4, -6, 25, 1.2, 1],
         [-4, -6, 25, 1.2, 0], [9, -10, 24.4, 1.4, 1], [-9, -9, 24.6, 1.5, 1], [0, -12, 24, 1.3, 1],
         [11, -6, 22, 1.3, 1], [-12, -4, 21, 1.3, 1], [7, 2, 21.5, 1.6, 1]];
for (b = bumps) {
  if (b[4] == 1) color(moss) translate([b[0], b[1], b[2]]) scale([1.8, 1.8, 0.6]) sphere(b[3], $fn = 12);
  else color(hideDark) translate([b[0], b[1], b[2]]) sphere(b[3], $fn = 12);
}
// A mossy stripe down the spine.
chain([[0, -4, 26.4], [0, 3, 22.4], [0, 10, 18], [0, 16, 11]], [1.4, 1.8, 1.6, 1.2], moss);

// Front legs: splayed out wide, elbows up, big clawed hands.
mirror_x() {
  chain([[10, -4, 15], [14, -8, 9], [13, -11, 1.4]], [3, 2.4, 2], hide);
  ell([3, 3, 1.3], [13, -12, 1.2], hide);
  for (a = [-35, 0, 35]) spike([13 + sin(a) * 2, -13.4, 1], [sin(a) * 1.8, -2.4, -0.4], 0.7, 0.1, hideDark);
  ell([1.6, 1.6, 0.6], [14.5, -8.5, 10.2], moss);
}
// Hind legs: heavy folded haunches.
mirror_x() {
  ell([6, 7, 6], [11, 8, 7], hide);
  chain([[12, 8, 5], [15, 4, 2], [15, 0, 1.2]], [3, 2.2, 1.8], hide);
  for (a = [-35, 0, 35]) spike([15 + sin(a) * 2, -1, 1], [sin(a) * 1.8, -2.4, -0.4], 0.7, 0.1, hideDark);
  ell([2.4, 2.4, 0.8], [13, 10, 11.5], moss);
}

// Long tapering crocodile tail curling off to the creature's left, with ridges.
tailPts = [[0, 16, 8], [5, 22, 4], [12, 25, 2.5], [19, 24, 1.8], [23, 20, 1.4]];
chain(tailPts, [5, 4, 3, 2, 1], hide);
for (i = [1 : 3]) spike(tailPts[i] + [0, 0, 2.6 - i * 0.4], [0, 0, 1.6], 1, 0.1, moss);
