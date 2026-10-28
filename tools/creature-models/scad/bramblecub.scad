// Bramblecub: a mossy green bear cub with leaf ears, a crown of twigs and a curling vine tail tipped with a leaf.
include <lib.scad>

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

// Flat colour patch lying on the ellipsoid (radii r, centre c) at azimuth az (0 = straight back, +Y) and elevation el.
module patchOn(r, c, az, el, s, col) {
  color(col) translate(c + [r[0] * sin(az) * cos(el), r[1] * cos(az) * cos(el), r[2] * sin(el)])
    rotate([0, 0, -az]) rotate([el, 0, 0]) scale([s, s * 0.3, s * 0.8]) sphere(1, $fn = 14);
}

green = [0.36, 0.66, 0.16];
greenHi = [0.55, 0.8, 0.24];
greenDk = [0.2, 0.45, 0.1];
cream = [0.97, 0.94, 0.8];
bark = [0.45, 0.28, 0.14];
barkDk = [0.32, 0.19, 0.09];
dark = [0.08, 0.07, 0.05];

// Body: a squat round torso.
blob([[[9, 8, 7.5], [0, 1, 9]], [[7.5, 7, 6], [0, 0, 14]]], green);
// Cream belly.
ell([5.5, 3, 5.5], [0, -5.5, 9.5], cream);
// Back: brown bark band at the shoulders and a cream rump.
ell([7.6, 5, 3.2], [0, 3.5, 15.5], barkDk);
ell([7, 4.5, 4.5], [0, 5, 7.5], cream);

// Head: big and round.
blob([[[10.5, 9, 8.5], [0, -1, 24]], [[8.5, 8, 7], [0, 0, 27]]], green);
// Mossy highlights on the crown.
ell([7.5, 6.8, 5], [-1, -2.2, 28.6], greenHi);
// Cream muzzle and cheeks.
blob([[[6.5, 3.5, 3.4], [0, -8.2, 20.5]], [[4, 3, 2.5], [0, -9.3, 22]]], cream);
// Nose and mouth.
ell([1.3, 0.9, 0.9], [0, -11.5, 22.3], bark);
color(dark) translate([0, -11.4, 20]) rotate([90, 0, 0]) scale([1.8, 0.4, 0.4]) cylinder(h = 0.6, r = 1, center = true, $fn = 12);
// Determined eyes in dark green sockets.
mirror_x() {
  ell([3.2, 1.4, 2.6], [4, -8.2, 24.3], greenDk);
  eye([4, -8.5, 24.3], 2.4, iris = [0.12, 0.1, 0.08], pupil = dark, sclera = [0.12, 0.1, 0.08], yaw = 4, shine = true, lid = 0.42, lid_tilt = 24, lid_c = greenDk);
  brow([4, -8.5, 24.3], 2.4, 0.4, green, 4);
}

// Mossy mottling over the back of the head and body (the sprite's lighter and darker tufts).
for (m = [[-35, 12, 3.2, 0], [5, 30, 3.6, 1], [40, 8, 2.8, 0], [-10, -8, 2.6, 2], [30, 45, 2.4, 2], [-45, 40, 2.6, 1]])
  patchOn([10.5, 9, 8.5], [0, -1, 24], m[0], m[1], m[2], m[3] == 1 ? greenHi : m[3] == 2 ? greenDk : [0.45, 0.72, 0.2]);
for (m = [[-30, 10, 2.6, 2], [25, 25, 2.4, 1], [50, -5, 2.2, 2]])
  patchOn([9, 8, 7.5], [0, 1, 9], m[0], m[1], m[2], m[3] == 1 ? greenHi : greenDk);

// Leaf ears with brown inner.
mirror_x() {
  color(green) translate([8.5, 0, 30]) rotate([0, -35, 0]) hull() {
    scale([4.2, 1.3, 4]) sphere(1, $fn = 20);
    translate([0, 0, 6]) sphere(0.3);
  }
  color(bark) translate([8.3, -1, 30]) rotate([0, -35, 0]) hull() {
    scale([2.4, 0.6, 2.4]) sphere(1, $fn = 16);
    translate([0, 0, 3.4]) sphere(0.2);
  }
}

// Twig crown: two little forked antlers.
mirror_x() {
  limb([2.2, -1, 31.5], [3.2, -1.5, 36], 0.75, 0.5, bark);
  limb([3.2, -1.5, 35], [5.2, -1.5, 37], 0.5, 0.3, bark);
  limb([3, -1.3, 34], [1.5, -1.5, 36.8], 0.45, 0.3, bark);
}

// Arms: stubby, with cream paws and brown pads.
mirror_x() {
  limb([7.5, -2, 14], [9.5, -5.5, 9], 2.6, 2.3, green);
  ell([2.6, 2.4, 2], [9.6, -6, 7.8], cream);
  ell([1.4, 0.8, 1.2], [9.6, -8.2, 7.8], bark);
}

// Legs: chunky with cream feet.
mirror_x() {
  ell([3.8, 4, 4], [5.5, -0.5, 4.5], green);
  ell([3, 4, 1.8], [5.6, -2.5, 1.6], cream);
}

// Vine tail: a curl rising from the back, ending in a leaf.
chain([[3, 7, 6], [9, 9, 6], [14, 8, 9], [16, 6, 14], [15, 5, 18], [13, 5, 17]], [1.4, 1.2, 1.1, 1, 0.9, 0.8], greenDk);
// Brown bark wraps on the vine.
for (p = [[9, 9, 6], [16, 6, 14]]) ell([1.5, 1.5, 1.5], p, bark);
petal([1.6, 0.6, 4], [16.5, 5, 21.5], [0, 25, 0], greenHi);
petal([1.4, 0.6, 3], [13.5, 5, 20.5], [0, -30, 0], green);
