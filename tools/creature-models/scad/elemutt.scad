// Elemutt: a cream puppy with floppy ears, a grey top-knot bun, a grey arrow marking from brow down the spine,
// arms flung wide, rocky brown greaves on its legs and a curled tail.
include <lib.scad>

fur = [0.96, 0.82, 0.6];
furHi = [1, 0.9, 0.72];
furDark = [0.85, 0.66, 0.45];
ear = [0.92, 0.74, 0.52];
mark = [0.58, 0.62, 0.68];
bun = [0.42, 0.38, 0.35];
band = [0.55, 0.32, 0.12];
rock = [0.68, 0.48, 0.18];
rockDark = [0.48, 0.32, 0.12];
boot = [0.45, 0.3, 0.22];
claw = [0.98, 0.95, 0.85];
nose = [0.2, 0.12, 0.1];

// Arrow / band marking: a flat capsule chain lying on the surface.
module stroke(pts, r, c = mark) { chain(pts, [for (p = pts) r], c); }

// Legs with rocky greaves.
mirror_x() {
  limb([3.2, 0, 10], [4, -0.5, 4], 2.4, 2.2, fur);
  // Rocky plates.
  ell([2.5, 2.4, 3.2], [4, -0.5, 6.5], rockDark);
  for (r = [[0, 4.4, 1.6, rock], [70, 5.5, 1.5, rock], [140, 4.2, 1.4, rockDark], [210, 6, 1.6, rock], [280, 4.8, 1.5, rock],
            [330, 8.2, 1.4, rock], [30, 8, 1.3, rockDark], [110, 8.6, 1.3, rock], [190, 8.4, 1.4, rock], [260, 8.8, 1.2, rockDark]])
    color(r[3]) translate([4 + 2.2 * sin(r[0]), -0.5 - 2.2 * cos(r[0]), r[1]]) rotate([r[0] / 3, 20, r[0]]) scale([1.3, 0.9, 1]) sphere(r[2], $fn = 7);
  blob([[[2.4, 3.2, 1.4], [4.2, -1.4, 1.4]], [[2, 2, 1.4], [4.2, 0.8, 1.6]]], boot);
  for (a = [-28, 0, 28]) spike([4.2 + sin(a) * 1.3, -4.4, 0.9], [sin(a) * 0.4, -1, -0.3], 0.45, 0.05, claw);
}

// Body: small pear torso.
blob([[[5, 4, 4.2], [0, 0, 12]], [[4, 3.4, 3.4], [0, 0, 16.5]]], fur);
ell([3, 1.4, 3.2], [0, -3.2, 13.5], furHi);
// Chest tuft.
for (x = [-1, 0, 1]) spike([x * 0.9, -3.4, 17], [x * 0.3, -0.6, -1.6], 0.6, 0.05, furHi);
// Spine stripe on the back.
stroke([[0, 3.2, 18], [0.7, 3.5, 15], [-0.6, 3.9, 12.5], [0, 3.7, 10]], 0.5);

// Arms flung wide, paws open.
mirror_x() {
  limb([3.6, 0, 17], [8, -0.8, 18], 1.6, 1.4, fur);
  limb([8, -0.8, 18], [11.6, -1.4, 19.6], 1.4, 1.2, fur);
  ell([1.6, 1.3, 1.5], [12.4, -1.6, 20], fur);
  for (a = [-30, 0, 30]) ell([0.5, 0.5, 0.6], [13.6, -1.6 + sin(a) * 0.4, 20 + sin(a) * 1.2 + 0.4], furHi);
  // Faint grey arm bands (seen from the back).
  stroke([[7.5, 0.3, 18.6], [9.5, 0.1, 19.2]], 0.35);
}

// Tail curling up behind to the viewer's right.
chain([[2, 3.4, 10], [4.5, 5.6, 9.5], [7, 6.5, 11], [8.4, 6, 14], [8, 5, 16.5]], [1.4, 1.4, 1.3, 1.1, 0.6], fur);

// Head: big round puppy head with muzzle.
blob([[[6.8, 6, 6], [0, 0, 25]], [[5.5, 5, 4.6], [0, -0.5, 22.5]]], fur);
ell([3.2, 2.2, 2.2], [0, -5.4, 22.2], furHi);
ell([0.9, 0.6, 0.7], [0, -7.5, 23.2], nose);
// Smile.
mirror_x() color(nose) translate([0.7, -7.1, 21.6]) rotate([0, 30, 0]) scale([0.8, 0.25, 0.22]) sphere(1, $fn = 10);
// Eyes: big grey-blue.
mirror_x() eye([2.7, -5.2, 24.6], 1.5, iris = [0.42, 0.52, 0.62], pupil = [0.12, 0.14, 0.2], yaw = -20);
// Cheek blush.
mirror_x() ell([0.9, 0.3, 0.6], [4.3, -4.6, 22.4], [1, 0.7, 0.62]);
// Arrow marking as a decal on the head shell: point on the brow, shaft over the crown and down the back.
module headShape(k) { hull() { translate([0, 0, 25]) scale([6.8, 6, 6] * k) sphere(1, $fn = 36); translate([0, -0.5, 22.5]) scale([5.5, 5, 4.6] * k) sphere(1, $fn = 28); } }
color(mark) intersection() {
  difference() { headShape(1.025); headShape(0.98); }
  union() {
    // Arrow head seen from the front.
    translate([0, -3, 0]) rotate([90, 0, 0]) linear_extrude(6) polygon([[0, 25.6], [-2.6, 28.6], [-1, 28.6], [-1, 32], [1, 32], [1, 28.6], [2.6, 28.6]]);
    // Shaft over the top and down the back.
    translate([-1, -3.2, 18]) cube([2, 12, 16]);
    // Side flicks above the eyes.
    mirror_x() translate([0, -3, 0]) rotate([90, 0, 0]) linear_extrude(6) polygon([[2.6, 27], [4.6, 27.8], [4.4, 28.4], [2.6, 27.7]]);
  }
}
// The stripe continues down the neck.
stroke([[0, 4.8, 20.5], [0.4, 4, 19]], 0.5);

// Floppy ears hanging down beside the head.
mirror_x() {
  color(ear) hull() { translate([5.2, -0.5, 28.5]) scale([1, 1.8, 1]) sphere(1.2, $fn = 16); translate([7.4, -1.2, 23]) scale([0.8, 1.4, 1.2]) sphere(1.8, $fn = 16); }
  color([0.98, 0.76, 0.66]) hull() { translate([5.6, -1.6, 27.6]) sphere(0.5, $fn = 10); translate([7, -2.3, 23.6]) scale([0.7, 0.6, 1]) sphere(1.1, $fn = 12); }
}

// Top-knot bun with a brown band.
color(band) translate([0, 0.5, 30.4]) cylinder(h = 1.2, r1 = 2.4, r2 = 2.1, $fn = 20);
ell([3.2, 3, 2.4], [0, 0.6, 32.8], bun);
ell([2, 2, 1.4], [0.6, 0.4, 34.6], [0.5, 0.46, 0.42]);
