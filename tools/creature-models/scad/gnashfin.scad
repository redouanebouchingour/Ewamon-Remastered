// Gnashfin: a stubby blue shark pup standing upright, a huge toothy grin, a purple X scar, dorsal fin and tail fin.
include <lib.scad>

navy = [0.13, 0.22, 0.45];
navyHi = [0.18, 0.3, 0.56];
blue = [0.24, 0.5, 0.85];
cream = [0.97, 0.93, 0.72];
mouthDark = [0.12, 0.08, 0.15];
scar = [0.55, 0.22, 0.5];
navyBody = [0.1, 0.17, 0.37];
navyDk = [0.07, 0.11, 0.25];
gill = [0.04, 0.05, 0.12];

// Torso: a shade darker than the head so the head's back reads apart from the body, blue belly.
blob([[[8, 7, 7], [0, 0, 9]], [[7.5, 6.8, 6], [0, 0, 15]]], navyBody);
blob([[[6, 3.5, 6], [0, -4.2, 10]], [[5.5, 3, 4], [0, -4, 15]]], blue);

// Head: a shark's wedge, not a ball. A navy cranium hulled into a long snout that overhangs the mouth, a pale blue
// lower jaw under it; the grin runs along the jaw line (rim_pt), so the teeth sit under the snout like a real shark's.
module upper_head(c) {
  color(c) hull() {
    translate([0, 2, 28]) scale([10.5, 9, 7.5]) sphere(1, $fn = 28);
    translate([0, -6, 28.5]) scale([9, 6.5, 5]) sphere(1, $fn = 24);
    translate([0, -14, 27.4]) scale([4, 2.4, 2.8]) sphere(1, $fn = 16);
  }
}
upper_head(navy);
// Back of the head runs straight down into the shoulders: the mouth only opens at the front.
blob([[[10.4, 8.6, 7.4], [0, 2, 28]], [[8.6, 6.4, 4], [0, 2.6, 18.5]]], navy);
// Lower jaw: wide, pale, dropped open.
color(blue) hull() {
  translate([0, -1.5, 19]) scale([9.6, 7, 4]) sphere(1, $fn = 24);
  translate([0, -6, 18.8]) scale([8.4, 5.4, 2.6]) sphere(1, $fn = 20);
  translate([0, -11, 19.4]) scale([4, 1.6, 1.4]) sphere(1, $fn = 14);
}
// Jaw rim: a U from cheek to cheek under the snout, t in [-1, 1].
function rim_pt(t, z) = [10 * sin(t * 80), -2.6 - 9.4 * cos(t * 80) * (1 - 0.15 * t * t), z];
// Dark mouth inside, between the jaws.
color(mouthDark) hull() for (t = [-1 : 0.125 : 1]) translate(rim_pt(t, 22.4) + [0, 1.1, 0]) scale([1, 1, 2.4]) sphere(1.3, $fn = 8);
// Gums and big triangular teeth along the rim, the upper row hanging from the snout, the lower row rising.
module teeth(z0, dz, n, w) {
  for (i = [0 : n - 1]) let(t = -0.94 + 1.88 * i / (n - 1), p = rim_pt(t, z0), a = t * 80)
    color(cream) translate(p) rotate([0, 0, -a]) hull() {
      translate([-w / 2, 0.2, 0]) sphere(0.7, $fn = 8);
      translate([w / 2, 0.2, 0]) sphere(0.7, $fn = 8);
      translate([0, -0.1, dz]) sphere(0.22, $fn = 6);
    }
}
color(cream) for (z = [25.4, 19.6]) hull() for (t = [-1 : 0.125 : 1]) translate(rim_pt(t, z)) sphere(0.7, $fn = 8);
teeth(25.2, -3.4, 9, 2.6);
teeth(19.8, 3.0, 8, 2.6);
// Pale blue cheeks wrapping up the side of the face to the eyes, like the sprite's lighter muzzle.
mirror_x() color(blue) hull() {
  translate([9.6, -1, 24]) scale([1.4, 4, 2]) sphere(1, $fn = 12);
  translate([7.6, -6.4, 25.6]) scale([1, 2.5, 1.2]) sphere(1, $fn = 10);
}

// Eye sunk into the skull: turned `yaw` outward along the skin and squashed front-to-back so only its face shows, set
// in a dark socket under a hard brow ridge of the skin colour that slants down to the snout, so the face itself scowls.
module socket_eye(p, size, yaw, iris, sclera, pupil, skin, sock, lid = 0.5, tilt = 30, squash = 0.6) {
  translate(p) rotate([0, 0, yaw]) {
    color(sock) translate([0, size * 0.45, -size * 0.05]) scale([1.14, 0.55, 1.12]) sphere(size, $fn = 20);
    scale([1, squash, 1]) eye([0.01, 0, 0], size, iris = iris, sclera = sclera, pupil = pupil, lid = lid, lid_tilt = tilt,
                              lid_c = skin, slit = 0.35);
    // The ridge is a wedge rooted behind the eye, so it reads as a ledge of the skull, not a stuck-on bar.
    color(skin) hull() {
      translate([size * 0.8, size * 0.25, size * 0.78]) scale([0.32, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([-size * 0.9, -size * 0.45, size * 0.12]) scale([0.36, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([0, size * 0.9, size * 0.45]) scale([0.9, 0.5, 0.4]) sphere(size, $fn = 12);
    }
  }
}
// Eyes: big, cream with an electric-blue slit iris, set in the sides of the snout under a heavy navy brow.
mirror_x() socket_eye([5.5, -10.8, 30.2], 4.5, 22, [0.1, 0.6, 1], [1, 0.95, 0.66], [0.02, 0.05, 0.14], navy, mouthDark,
                      lid = 0.42, tilt = 30);
// Purple X scar lying flat on the viewer's left brow.
color(scar) translate([-6.4, -8.6, 34.6]) rotate([-45, 0, -30]) for (a = [40, -40]) rotate([0, a, 0])
  scale([0.5, 0.3, 3.2]) sphere(1, $fn = 10);

// Dorsal fin on the crown: broad, swept back, its trailing edge torn into notches like the sprite's.
color(navy) hull() {
  translate([0, 0, 33]) scale([1.6, 7, 1]) sphere(1, $fn = 14);
  translate([0, 7, 45]) sphere(0.6, $fn = 8);
}
color(navy) for (i = [0 : 1]) hull() {
  translate([0, 5.4 - i * 0.8, 41 - i * 3.6]) scale([0.6, 1, 1.2]) sphere(1, $fn = 8);
  translate([0, 9.4 - i * 0.6, 40 - i * 3.6]) sphere(0.3, $fn = 6);
}
// Dark leading edge so the fin reads as a blade, not a spike.
limb([0, -3.6, 33.6], [0, 6.6, 44.8], 0.75, 0.35, navyDk);
// Pectoral fins as arms, flaring out sideways and down.
mirror_x() color(navy) hull() {
  translate([6.5, -1, 16]) scale([1.2, 3, 2.4]) sphere(1, $fn = 12);
  translate([15, -2.5, 8.5]) sphere(0.6, $fn = 8);
  translate([11.5, 1.5, 7.5]) sphere(0.5, $fn = 8);
}
mirror_x() color(blue) hull() {
  translate([6.8, -2.4, 15]) sphere(1, $fn = 10);
  translate([12, -2.6, 10.5]) sphere(0.4, $fn = 8);
}

// Stubby legs with pale blue feet.
mirror_x() {
  ell([3.4, 3.4, 3.6], [4.3, 0, 4.4], navy);
  ell([3.2, 4.2, 1.8], [4.6, -1.6, 1.8], blue);
}

// Shark tail behind, sweeping to the viewer's right, with a big forked fin.
chain([[1, 5, 7], [5, 9, 5.5], [10, 11, 6], [13, 11, 8]], [4.5, 3.4, 2.4, 1.8], navy);
color(navy) hull() {
  translate([13, 11, 8]) scale([1, 1.4, 2]) sphere(1.6, $fn = 10);
  translate([16, 13, 21]) sphere(0.5, $fn = 8);
  translate([15, 10.5, 16]) sphere(0.5, $fn = 8);
}
color(navy) hull() {
  translate([13, 11, 8]) sphere(1.4, $fn = 10);
  translate([18, 12, 3]) sphere(0.5, $fn = 8);
}

// Gill slits: three dark curved slashes down each side of the head's back, raised a hair off the skin so they read
// from behind (x follows the hull of the head-back blob at z 23.5).
mirror_x() for (i = [0 : 2]) let(y = 1.4 + i * 2.3, x = 9.6 * sqrt(1 - pow((y - 2.2) / 8.4, 2)) + 0.05)
  chain([[x - 0.5, y - 0.9, 27.4], [x + 0.1, y, 23.6], [x - 0.6, y + 0.7, 20.2]], [0.36, 0.55, 0.36], gill);
// Countershading: the pale belly wraps round the hips into a wavy line along the lower back.
color(blue) intersection() {
  blob([[[8.25, 7.25, 7.2], [0, 0, 9]], [[7.7, 7.05, 6], [0, 0, 15]]]);
  union() {
    translate([-10, -10, 0]) cube([20, 20, 6.4]);
    for (x = [-6 : 3 : 6]) translate([x, 8, 6.4]) scale([1.5, 3, 1.4]) sphere(1, $fn = 10);
  }
}
// The head's pale underside wraps round the back too: a countershading line under the gills.
color(blue) intersection() {
  blob([[[10.6, 8.8, 7.5], [0, 2, 28]], [[8.8, 6.6, 4.1], [0, 2.6, 18.5]]]);
  union() {
    translate([-12, -4, 14]) cube([24, 16, 5.6]);
    for (x = [-7.5 : 3.75 : 7.5]) translate([x, 9, 19.4]) scale([1.8, 3, 1.1]) sphere(1, $fn = 8);
  }
}
// Pale underside running out along the tail (the sprite's countershading).
chain([[1, 4.4, 5.2], [5, 8.4, 3.8], [10, 10.4, 4.4], [13, 10.6, 6.6]], [3.4, 2.6, 1.8, 1.2], blue);
// Dark rim lines on the pectoral fins' back edges and on the tail fin, and torn notches in the tail fin's edge.
mirror_x() limb([7, 1, 15.6], [11.5, 1.5, 7.5], 0.5, 0.35, navyDk);
limb([13.4, 11.6, 9.5], [16, 13, 21], 0.55, 0.3, navyDk);
color(navy) for (k = [[15, 10.8, 13], [15.6, 11.6, 17.4]]) hull() {
  translate(k) scale([1, 1, 1.4]) sphere(0.8, $fn = 8);
  translate(k + [1.8, -1.2, -0.6]) sphere(0.25, $fn = 6);
}
