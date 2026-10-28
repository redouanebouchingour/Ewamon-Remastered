// Malice: a plum ghost with a curling wisp on its head, glowing yellow grin and eyes and a burning core in its chest.
include <lib.scad>

body = [0.27, 0.17, 0.3];
bodyHi = [0.36, 0.24, 0.4];
hand = [0.45, 0.3, 0.5];
glow = [1, 0.92, 0.6];
core = [1, 0.95, 0.75];
coreRing = [0.95, 0.4, 0.7];
coreOut = [0.6, 0.22, 0.5];
mouthIn = [0.95, 0.8, 0.45];

// Flat shape (2D children) laid on the face: extruded thinly along Y at p, tilted by yaw / pitch.
module decal(p, yaw = 0, pitch = 0, t = 0.8) {
  translate(p) rotate([0, 0, yaw]) rotate([90 + pitch, 0, 0]) linear_extrude(t, center = true) children();
}
// Shape (2D children, drawn in x/z around (0,0) at offset o) projected along -Y onto an ellipsoid of radii r at c:
// a thin shell of the ellipsoid cut by the extruded shape, so it hugs the curved face.
module paint(r, c, o, grow = 0.05) {
  intersection() {
    translate(c) difference() { scale(r * (1 + grow)) sphere(1, $fn = 40); scale(r * 0.97) sphere(1, $fn = 40); }
    translate([o[0], 0, o[1]]) rotate([90, 0, 0]) linear_extrude(r[1] * 2) children();
  }
}
// Crescent: a disc minus an offset disc.
module crescent(r, off, ri = undef) {
  difference() { circle(r, $fn = 24); translate(off) circle(ri == undef ? r * 1.02 : ri, $fn = 24); }
}

// Wispy lower body: a tapering, twisting tail touching the ground.
chain([[0, 0, 15], [-0.5, 0.5, 10], [1, 1, 6], [3, 1.5, 3], [4.5, 1, 1.2], [6, 0.5, 1.4], [6.4, 0, 2.6]],
      [6.5, 5, 3.4, 2.2, 1.4, 0.8, 0.5], body);
// Torso.
blob([[[7.2, 6, 7], [0, 0, 18]], [[5.5, 5, 4], [0, 0, 23]]], body);
// Glowing core: rings of magenta to yellow on the chest.
ell([5.2, 2, 5.2], [0, -4.8, 17.5], coreOut);
ell([3.9, 1.6, 3.9], [0, -5.7, 17.5], coreRing);
ell([2.5, 1.2, 2.5], [0, -6.5, 17.5], core);

// Stubby arms reaching out sideways with lighter hands.
mirror_x() {
  limb([5.5, 0, 21], [10, -0.5, 20], 2.4, 1.8, body);
  blob([[[2.2, 1.6, 1.6], [11.5, -0.5, 20.2]], [[1, 1, 1], [13, -0.5, 21]]], hand);
}

// Big round head.
ell([10, 9, 9.5], [0, 0, 32], body);
ell([6, 4, 5], [-2, -4.5, 36.5], bodyHi);
// Curling wisp on top of the head, sweeping to the viewer's right.
chain([[1, 1, 39], [2.5, 1.5, 43], [5, 2, 44.5], [7.5, 2, 43.5], [9.5, 2, 45], [11, 1.5, 47.5], [13, 1, 48.5]],
      [4, 2.6, 1.8, 1.4, 1.1, 0.8, 0.4], body);

// Closed, gleeful crescent eyes.
color(glow) mirror_x() paint([10, 9, 9.5], [0, 0, 32], [4, 34]) scale([1.15, 1]) crescent(2.5, [0, -1.5], 2.3);
// Wide grin: a crescent mouth.
color(glow) paint([10, 9, 9.5], [0, 0, 32], [0, 29.2]) scale([1.5, 1.1]) crescent(3.6, [0, 1.6], 3.4);
