// Dreadmaw: Gnashfin grown into a hulking black pirate shark: a huge grin, a torn purple bandana with a bone charm,
// ragged navy fins and a rusty chain with an anchor wound round its tail.
include <lib.scad>

black = [0.12, 0.12, 0.16];
blackHi = [0.22, 0.22, 0.28];
navy = [0.2, 0.28, 0.52];
cream = [0.95, 0.9, 0.74];
mouthDark = [0.08, 0.05, 0.1];
bandana = [0.32, 0.22, 0.52];
bandanaHi = [0.42, 0.3, 0.64];
bone = [0.92, 0.88, 0.78];
rust = [0.78, 0.35, 0.15];
irisC = [0.82, 0.32, 0.95];
gill = [0.03, 0.03, 0.06];

// Torso: a big hunched pear, wider at the hips, the shoulders running straight up into the head.
blob([[[12, 9.5, 8], [0, 0.5, 11]], [[11, 9, 7], [0, 1, 18]], [[9.5, 8, 5], [0, 1.5, 23]]], black);
// Navy belly: a broad panel down the front, its top edge torn into flame-like points.
blob([[[10, 6, 6.5], [0, -3.4, 10]], [[7.5, 4, 4], [0, -5.4, 14]]], navy);
color(navy) for (x = [-7 : 3.5 : 7]) let(y = -9.2 + 0.06 * x * x) hull() {
  translate([x - 1.6, y, 14]) scale([1, 0.5, 1]) sphere(1, $fn = 8);
  translate([x + 1.6, y, 14]) scale([1, 0.5, 1]) sphere(1, $fn = 8);
  translate([x + 0.4, y - 0.2 + 0.02 * x * x, 18.5 + (abs(x) < 2 ? 0.6 : -0.6)]) sphere(0.3, $fn = 6);
}

// Head: a heavy shark wedge. A black cranium hulled into a long, blunt snout that overhangs the grin, a navy lower
// jaw under it; the grin follows the U of the jaw rim (rim_pt) so the teeth sit under the snout.
color(black) hull() {
  translate([0, 2.5, 30.5]) scale([12.5, 9.5, 7.5]) sphere(1, $fn = 28);
  translate([0, -7, 31]) scale([11, 7, 5]) sphere(1, $fn = 24);
  translate([0, -16, 29.6]) scale([5, 2.8, 3]) sphere(1, $fn = 16);
}
// Back of the head flows straight down into the hunched shoulders.
blob([[[12.4, 9.4, 7.4], [0, 2.5, 30.5]], [[10, 8, 4], [0, 2.4, 21.5]]], black);
// Lower jaw: wide, navy, the grin barely open.
color(navy) hull() {
  translate([0, -1.5, 22]) scale([11.4, 8, 4.4]) sphere(1, $fn = 24);
  translate([0, -8, 21.8]) scale([10.8, 6.6, 3.2]) sphere(1, $fn = 20);
  translate([0, -14.4, 22.8]) scale([5.4, 1.8, 1.6]) sphere(1, $fn = 14);
}
// Jaw rim: a U from cheek to cheek under the snout, t in [-1, 1].
function rim_pt(t, z) = [12 * sin(t * 80), -3.2 - 11 * cos(t * 80) * (1 - 0.15 * t * t), z];
color(mouthDark) hull() for (t = [-1 : 0.125 : 1]) translate(rim_pt(t, 25.8) + [0, 1.1, 0]) scale([1, 1, 1.8]) sphere(1.3, $fn = 8);
// Gums and interlocking triangular teeth, upper row hanging from the snout, lower row rising.
module teeth(z0, dz, n, w, t0) {
  for (i = [0 : n - 1]) let(t = -t0 + 2 * t0 * i / (n - 1), p = rim_pt(t, z0), a = t * 80)
    color(cream) translate(p) rotate([0, 0, -a]) hull() {
      translate([-w / 2, 0.2, 0]) sphere(0.7, $fn = 8);
      translate([w / 2, 0.2, 0]) sphere(0.7, $fn = 8);
      translate([0, -0.1, dz]) sphere(0.22, $fn = 6);
    }
}
color(cream) for (z = [28.2, 23.6]) hull() for (t = [-1 : 0.125 : 1]) translate(rim_pt(t, z)) sphere(0.75, $fn = 8);
teeth(28.0, -3.6, 11, 2.5, 0.96);
teeth(23.8, 3.3, 10, 2.5, 0.88);
// Navy cheeks sweeping up the sides of the face from the jaw, like the sprite's dark blue underside.
mirror_x() color(navy) hull() {
  translate([11.6, 0, 26.4]) scale([1.3, 4.4, 2.2]) sphere(1, $fn = 12);
  translate([9, -7.6, 27.6]) scale([1, 2.6, 1.1]) sphere(1, $fn = 10);
}
// Swept-back fin points flaring off the back corners of the head.
mirror_x() color(black) hull() {
  translate([10, 2, 31]) scale([1.4, 4, 3]) sphere(1, $fn = 12);
  translate([15.5, 8, 33.5]) sphere(0.5, $fn = 8);
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
// Big violet eyes on pale lilac, sunk under a heavy black brow slanting down to the snout: a glare, not a stare.
mirror_x() socket_eye([6.2, -12, 33], 4.4, 22, irisC, [0.9, 0.82, 0.95], [0.12, 0.02, 0.16], black, mouthDark,
                      lid = 0.45, tilt = 30);
// Scar slash lying flat across the viewer's left brow.
color(blackHi) translate([-6.4, -11.2, 37]) rotate([-45, 0, -28]) rotate([0, 60, 0]) scale([0.45, 0.3, 3.6])
  sphere(1, $fn = 8);

// Tall jagged dorsal fin on the crown, swept back, its trailing edge torn into notches.
color(black) hull() {
  translate([0, -1, 36.5]) scale([1.8, 7, 1]) sphere(1, $fn = 14);
  translate([0, 7, 50]) sphere(0.6, $fn = 8);
}
color(black) for (i = [0 : 2]) hull() {
  translate([0, 2.4 + i * 1.6, 39 + i * 3]) scale([0.7, 1, 1]) sphere(1, $fn = 8);
  translate([0, 7 + i * 1.6, 40.4 + i * 3]) sphere(0.35, $fn = 8);
}

// Torn purple bandana: a collar round the neck, a point hanging down the chest with the bone charm, another draped
// over the upper back, and a knot with trailing ends at the back corner.
color(bandana) translate([0, 0.6, 20.4]) scale([11.6, 9.8, 2]) sphere(1, $fn = 32);
color(bandana) hull() {
  translate([-7.5, -8.4, 20.2]) sphere(0.9, $fn = 8);
  translate([7.5, -8.4, 20.2]) sphere(0.9, $fn = 8);
  translate([0, -9.2, 12.6]) sphere(0.6, $fn = 8);
}
color(bandanaHi) hull() {
  translate([-4, -9.4, 19.6]) sphere(0.4, $fn = 8);
  translate([4, -9.4, 19.6]) sphere(0.4, $fn = 8);
  translate([0, -9.8, 15]) sphere(0.3, $fn = 8);
}
// The back drape: strips laid over the shoulders (y follows the torso's back), each ending in a torn point at its
// own height so the hem reads ragged from behind; the middle one hangs longest.
function back_y(x, z) = 1.4 + 9.6 * sqrt(max(0.05, 1 - pow(x / 12, 2))) - 0.08 * (z - 18) * (z < 18 ? 1 : 0);
color(bandana) for (k = [[-8, 15.6], [-4, 12.8], [0, 10.6], [4, 13.4], [8, 15]]) hull() {
  for (dx = [-2.4, 2.4]) translate([k[0] + dx, back_y(k[0] + dx, 21.6) + 0.2, 21.6]) sphere(0.8, $fn = 8);
  translate([k[0] + 0.6, back_y(k[0], k[1]) + 0.4, k[1]]) sphere(0.4, $fn = 6);
}
// Darker folds down the drape.
color(bandanaHi) for (x = [-6, 2]) hull() {
  translate([x, back_y(x, 21) + 0.9, 21]) sphere(0.35, $fn = 6);
  translate([x + 0.6, back_y(x, 15.6) + 0.9, 15.6]) sphere(0.25, $fn = 6);
}
color(bone) translate([0, -10, 16.4]) {
  scale([0.6, 0.5, 1.8]) sphere(1, $fn = 10);
  mirror_x() translate([0.8, 0, 1.6]) sphere(0.75, $fn = 10);
  mirror_x() translate([0.8, 0, -1.6]) sphere(0.75, $fn = 10);
}
ell([2, 1.6, 1.8], [-8, 7.6, 22.6], bandanaHi);
color(bandana) for (d = [[-12, 10, 18], [-10.5, 11, 16.6]]) hull() {
  translate([-8, 8, 22]) sphere(0.9, $fn = 8);
  translate(d) sphere(0.4, $fn = 8);
}

// Arms: thick fin-arms hanging from the shoulders, black above, widening into ragged navy fin blades below.
mirror_x() {
  color(black) hull() {
    translate([10.5, 0, 21]) sphere(3.8, $fn = 14);
    translate([14.5, -0.8, 12]) scale([2, 3, 1.6]) sphere(1, $fn = 12);
  }
  color(navy) hull() {
    translate([14.5, -0.8, 12.5]) scale([2, 3, 1.6]) sphere(1, $fn = 12);
    translate([17, -3.4, 4]) sphere(0.5, $fn = 8);
    translate([15.6, 2.4, 5]) sphere(0.5, $fn = 8);
  }
  // Torn points along the blade's edge.
  for (k = [[-2.2, 6.2], [0, 5], [2, 6.4]]) color(navy) hull() {
    translate([15.4, -0.4 + k[0] * 0.6, 9]) scale([0.6, 1, 1]) sphere(1, $fn = 8);
    translate([16.4, -0.4 + k[0], k[1] - 3]) sphere(0.3, $fn = 6);
  }
}

// Short thick legs with pale claws.
mirror_x() {
  ell([4.4, 4.4, 4.2], [6, 0, 4.4], black);
  ell([4, 5.2, 1.8], [6.2, -1.6, 1.8], black);
  for (a = [-25, 0, 25]) spike([6.2 + sin(a) * 2, -6.4, 1.2], [sin(a) * 0.5, -1.3, -0.4], 0.55, 0.05, bone);
}

// Tail: from the rump, swept out to the creature's left (viewer's right) and up, with a tall ragged shark fin.
chain([[2, 6, 8], [9, 9, 6.5], [15, 9, 8], [19, 8, 11.5]], [6, 4.4, 3.2, 2.2], black);
color(navy) hull() {
  translate([8, 8.4, 4.8]) sphere(3, $fn = 10);
  translate([15, 8.6, 6.4]) sphere(2, $fn = 10);
}
color(black) hull() {
  translate([19, 8, 11.5]) scale([0.8, 1.6, 2]) sphere(1.8, $fn = 10);
  translate([23, 11, 29]) sphere(0.7, $fn = 8);
  translate([22.5, 8, 20]) sphere(0.6, $fn = 8);
}
color(black) for (i = [0 : 1]) hull() {
  translate([21, 9.6, 17 + i * 5]) sphere(0.9, $fn = 8);
  translate([24.6, 11, 15.6 + i * 5]) sphere(0.3, $fn = 6);
}
color(black) hull() {
  translate([19, 8, 10.5]) sphere(1.5, $fn = 10);
  translate([25, 9, 5]) sphere(0.6, $fn = 8);
}

// Rusty chain wound round the tail, an anchor dangling from it.
module link(p, rot) {
  color(rust) translate(p) rotate(rot) scale([1, 0.6, 1]) rotate_extrude($fn = 12) translate([1.2, 0]) circle(0.45, $fn = 6);
}
for (i = [0 : 9]) {
  t = i / 9;
  a = t * 540;
  let(r = 4.7 - t * 1.6) link([9 + t * 9, 9 - t * 0.5 + r * sin(a), 7 + r * cos(a) + t * 3], [i * 90, 0, 30]);
}
for (i = [0 : 3]) link([18.5, 5.5, 7 - i * 1.7], [0, i % 2 * 90, 0]);
// Anchor: shank, stock and curved arms.
color(rust) {
  translate([18.5, 5.3, 1]) cylinder(h = 5, r = 0.45, $fn = 8);
  translate([18.5, 5.3, 5]) rotate([0, 90, 0]) cylinder(h = 3, r = 0.35, center = true, $fn = 8);
  translate([18.5, 5.3, 3]) rotate([-90, 0, 0]) rotate_extrude(angle = 180, $fn = 16) translate([2, 0]) circle(0.4, $fn = 6);
  for (x = [16.5, 20.5]) translate([x, 5.3, 3]) cylinder(h = 1.2, r1 = 0.6, r2 = 0.05, $fn = 8);
}

// Gill slits: three dark slashes down each side of the head's back (x follows the head-back hull at z 27).
mirror_x() for (i = [0 : 2]) let(y = 3.4 + i * 2.4, x = 11.5 * sqrt(1 - pow((y - 2.5) / 9.4, 2)) + 0.1)
  chain([[x - 0.7, y - 1, 31.4], [x + 0.1, y, 27.6], [x - 0.5, y + 0.8, 24.2]], [0.4, 0.62, 0.4], gill);
// Navy underside round the hips and the tail root, its top edge torn into points like the belly, so the black back
// gets the sprite's ragged countershading line.
color(navy) intersection() {
  blob([[[12.3, 9.8, 8.2], [0, 0.5, 11]], [[11.3, 9.3, 7.2], [0, 1, 18]]]);
  union() {
    translate([-14, -12, 0]) cube([28, 24, 9]);
    for (a = [-80 : 20 : 80]) translate([12 * sin(a), 1 + 10 * cos(a), 8.6]) rotate([0, 0, -a])
      hull() { translate([-1.6, 0, 0]) sphere(0.6, $fn = 6); translate([1.6, 0, 0]) sphere(0.6, $fn = 6);
               translate([0.4, 0, 4.6 + (abs(a) % 40) / 10]) sphere(0.3, $fn = 6); }
  }
}
