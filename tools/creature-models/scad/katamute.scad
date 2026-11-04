// Katamute: Elemutt grown into a shaggy tan brawler, wide-legged in a double-biceps flex, grinning.
// Checklist (front sheet, art x; the body axis sits at art x -2.3, so scad-sheet x = art x + 2.3 = OX):
//   - stance: feet wide apart (far foot art x -14..-8, near foot 3.5..10, z 0..3.5), toes turned out, cream claws.
//   - legs: furry thighs, heavy stone greaves of olive-brown angular plates from the foot up the outer thigh
//     (far greave art x -12.5..-6.5, near 0..8, z 2..15), orange-brown paws.
//   - torso: broad fluffy chest (art x -9..5, z 14..21) over a slimmer waist and pelvis (z 9..13); a pale V-shaped
//     ruff on the chest, its point at art (-2.5, 13.5).
//   - arms flexed: upper arms out and down to the elbows (art (-13.5, 16.5) / (10, 16.5)), forearms up to big fists
//     beside the head (art x -17.5..-12.5 / 7..12.3, z 19.5..24.5); fur hanging in blunt lobes under the elbows.
//   - head: round dog head turned to the viewer's left (art x -9.5..1.5, z 20..30.5), floppy folded ears (far one
//     shows its pink inside), short pale muzzle, wide dark nose, a lopsided gritted grin with white teeth on the near
//     side, narrow angry grey eyes under dark lids, a grey-brown arrow pointing down the forehead, tiger stripes on
//     the cheeks and temples.
//   - topknot: brown band on the crown, a big billowing grey-brown hair plume (art x -6.7..10, z 30..40) streaming to
//     the viewer's right in curled locks.
//   - tail: big bushy cream tail sweeping out behind the near hip to the right and up (art x 4..18, z 6..20), a grey
//     streak along its middle and a grey upturned tip.
//   - back: the arrow on the back of the head pointing down, a dark stripe down the spine to the tail root.
include <lib.scad>

OX = 2.3;

fur = [0.92, 0.78, 0.57];
furHi = [0.99, 0.9, 0.72];
furLo = [0.86, 0.69, 0.5];
mark = [0.45, 0.39, 0.33];
hair = [0.49, 0.42, 0.36];
hairHi = [0.6, 0.53, 0.46];
hairDark = [0.36, 0.3, 0.26];
band = [0.55, 0.36, 0.18];
rockDark = [0.33, 0.27, 0.22];
rock = [0.45, 0.37, 0.29];
rockHi = [0.62, 0.47, 0.32];
paw = [0.6, 0.4, 0.22];
claw = [0.97, 0.92, 0.74, NOGLOW];
ink = [0.13, 0.09, 0.09];
pink = [0.86, 0.56, 0.56];
iris = [0.5, 0.55, 0.62];
tailGrey = [0.47, 0.42, 0.38];

// A FRONT-sheet outline in art x, moved onto the body axis and `dz` up (front parts sit lower on the sheet).
module prismS(pts, dz = 0) { prism([for (p = pts) [p[0] + OX, p[1] + dz]]); }
// Front half only (markings cut by a prism must not show through on the back).
module frontHalf(y0 = 0) { translate([-40, -40 + y0, -5]) cube([80, 40, 60]); }
module backHalf(y0 = 0) { translate([-40, y0, -5]) cube([80, 40, 60]); }

// The dark line along an eye() lid's edge (the same numbers as the eye() call), so a skin lid reads as a narrow glare.
module lash(p, size, yaw, lid, lid_tilt) {
  tilt = (p[0] < 0 ? 1 : -1) * lid_tilt * 1.25;
  color(ink) translate(p) rotate([0, 0, yaw]) intersection() {
    scale([1.14, 0.92, 1.16]) sphere(size, $fn = 20);
    rotate([12, tilt, 0]) translate([-3 * size, -3 * size, size * (1.15 - 2.3 * lid) - 0.22]) cube([6 * size, 6 * size, 0.42]);
    translate([-3 * size, -6 * size, -3 * size]) cube([6 * size, 6 * size, 6 * size]);
  }
}

// Soft fur fringe: a flattened tuft from a base buried in the part at p, tapering to a point at p + d.
module tuft(p, d, w, t, c = fur, rz = 0) {
  color(c) hull() {
    translate(p) rotate([0, 0, rz]) scale([w, t, w]) sphere(1, $fn = 12);
    translate(p + d) rotate([0, 0, rz]) scale([w * 0.3, t * 0.6, w * 0.3]) sphere(1, $fn = 8);
  }
}

// Angular stone plate on a greave: a low-poly flattened chip facing outwards at angle a (0 = front, 90 = +X).
module chip(p, a, w, h, c, tilt = -14) {
  color(c) translate(p) rotate([0, 0, a]) rotate([tilt, 0, 0]) scale([w, 0.8, h]) sphere(1, $fn = 5);
}

// ---- Torso ----
TORSO = [[[4.6, 3.8, 3.2], [0, 0.8, 11]], [[4.0, 3.6, 2.2], [0, 0.4, 14]], [[7.2, 4.6, 3.4], [0, 0, 18.4]], [[5.6, 4.2, 2.5], [0, 0.4, 20.2]]];
module torsoShape(g = 0) { hull() for (e = TORSO) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }
color(fur) torsoShape();
// Pale V ruff on the chest, its fur edge zigzagging to a point.
color(furHi) intersection() {
  torsoShape(0.22);
  prismS([[-8.6, 22.5], [-8.6, 20.2], [-7.2, 18.2], [-6.3, 18.8], [-5.1, 16.3], [-4.2, 17], [-2.6, 13.6], [-1.3, 16.6], [-0.4, 15.9], [0.9, 18.2], [1.7, 17.6], [4.2, 20.5], [4.2, 22.5]], 0.6);
  frontHalf(0);
}
// Shaggy fringe on the chest: pale tufts along the V's point, fur tufts at the chest's sides.
tuft([0, -3.2, 15.2], [0, -0.4, -1.6], 1.5, 0.4, furHi);
mirror_x() {
  tuft([1.4, -3.4, 15.9], [0.1, -0.4, -1.5], 1.4, 0.4, furHi);
  tuft([2.8, -3.6, 16.8], [0.2, -0.4, -1.5], 1.4, 0.4, furHi);
  tuft([4.2, -3.4, 17.8], [0.3, -0.3, -1.5], 1.4, 0.4, furHi);
  tuft([6.2, -1.6, 16.6], [0.6, -0.2, -2.0], 1.6, 0.6, fur);
  tuft([6.0, 1.2, 16.4], [0.6, 0.2, -2.0], 1.6, 0.6, fur);
}
// Dark stripe down the spine, wavering, to the tail root.
color(mark) intersection() {
  torsoShape(0.2);
  backHalf(1.2);
  rotate([90, 0, 0]) linear_extrude(height = 30, center = true)
    polygon([[-1.2, 23], [1.2, 23], [1.4, 18], [0.5, 14], [1.0, 9], [-1.0, 9], [-1.5, 14], [-0.6, 18]]);
}

// ---- Legs: furry thighs, stone greaves, paws ----
HIP = [4.4, 1, 11];
KNEE = [8.2, -0.5, 7];
ANKLE = [9.8, -0.6, 3];
mirror_x() {
  limb(HIP, KNEE, 3.5, 3.1, fur);
  limb(KNEE, ANKLE, 2.6, 2.2, fur);
  // Greave core: faceted stone round the knee and shin.
  color(rockDark) hull() {
    translate(KNEE + [0.3, -0.3, 0.8]) scale([3.7, 3.4, 3.2]) sphere(1, $fn = 7);
    translate(ANKLE + [0.1, -0.2, 0.6]) scale([3.2, 3.1, 1.9]) sphere(1, $fn = 7);
  }
  // Shingled plates over the front and outer side, light faces on the dark core.
  for (r = [[-30, 9.6, 1.6, 1.9, rockHi], [15, 9.4, 1.7, 2.0, rock], [60, 9.2, 1.6, 2.0, rockHi], [105, 9.0, 1.5, 1.8, rock],
            [-10, 6.4, 1.6, 1.8, rock], [35, 6.2, 1.7, 1.9, rockHi], [80, 6.0, 1.6, 1.9, rock], [125, 5.8, 1.4, 1.7, rockHi],
            [-35, 3.6, 1.5, 1.5, rockHi], [10, 3.4, 1.6, 1.6, rock], [55, 3.3, 1.6, 1.6, rockHi], [100, 3.2, 1.4, 1.5, rock]])
    let(k = (KNEE[2] + 1.5 - r[1]) / (KNEE[2] + 1.5 - ANKLE[2]), c = KNEE + (ANKLE - KNEE) * max(0, min(1, k)), R = 3.2 - 0.3 * k)
      chip([c[0] + R * sin(r[0]), c[1] - R * cos(r[0]), r[1]], r[0], r[2], r[3], r[4]);
  // Plate up the outer thigh, its top a jagged point.
  color(rock) hull() {
    translate([7.8, -1.6, 9.8]) scale([1.8, 1.0, 1.5]) sphere(1, $fn = 6);
    translate([6.6, -1.3, 13.8]) scale([0.9, 0.7, 1.0]) sphere(1, $fn = 5);
  }
  color(rockDark) hull() {
    translate([9.0, 0.6, 9.6]) scale([1.6, 1.4, 1.4]) sphere(1, $fn = 6);
    translate([7.4, 1.0, 12.4]) scale([0.8, 0.8, 1.0]) sphere(1, $fn = 5);
  }
  // Paw, toes turned out, three cream claws.
  translate([10.4, -1.6, 0]) rotate([0, 0, 22]) {
    color(paw) hull() {
      translate([0, 0.6, 1.7]) scale([2.5, 2.6, 1.7]) sphere(1, $fn = 16);
      translate([0, -2.0, 1.2]) scale([2.6, 1.8, 1.2]) sphere(1, $fn = 16);
    }
    for (a = [-1, 0, 1]) spike([a * 1.5, -3.4, 1.1], [a * 0.4, -1.5, -1.0], 0.55, 0.06, claw);
  }
}

// ---- Arms: flexed, fists beside the head ----
SH = [7.2, 1.5, 19.8];
EL = [13.4, 1.5, 16.6];
WR = [14.2, -0.2, 20.4];
FIST = [14.4, -0.4, 22.2];
mirror_x() {
  ell([3.4, 3.4, 3.2], SH, fur);
  limb(SH, EL, 3.3, 3.0, fur);
  // Biceps bunched on top of the upper arm.
  ell([2.8, 2.5, 2.1], [10.4, 0.8, 19.3], fur);
  limb(EL, WR, 2.9, 2.6, fur);
  // Fist: the fingers curled towards the head, knuckle bumps in front.
  ell([2.6, 2.5, 2.5], FIST, fur);
  for (i = [0 : 3]) color(furHi) translate([12.6 + 0.15 * i, -2.0 + 0.95 * i, 23.1 - 0.15 * i]) scale([0.85, 0.75, 0.8]) sphere(1, $fn = 10);
  color(furHi) translate([13.4, -2.5, 21.2]) scale([0.8, 0.9, 1.1]) sphere(1, $fn = 10);
  // Shaggy fringe hanging under the upper arm and elbow, and off the outside of the forearm.
  for (q = [[8.6, 16.9, -0.5], [9.8, 16.2, -0.3], [11.0, 15.5, -0.1], [12.2, 14.9, 0.1], [13.4, 14.3, 0.5], [14.4, 14.4, 1.0]])
    tuft([q[0], 1.5, q[1]], [q[2], 0, -2.4], 1.6, 0.6);
  for (q = [[15.4, 0.9, 16.8], [15.8, 0.4, 18.2], [16.0, -0.1, 19.6]]) tuft(q, [1.6, 0, -1.2], 1.3, 0.6);
}

// ---- Bushy tail: one soft brush sweeping out behind the near hip, down and out, its grey tip flicking up ----
// Flattened ellipsoids along the curve, turned into the tail's plane (TAILZ about Z), hulled pairwise.
TAILZ = 20;
TAIL = [[[2.4, 2.0, 2.6], [1.5, 4.4, 13.5]], [[3.6, 2.4, 4.4], [6.8, 6.6, 11.8]], [[4.2, 2.6, 5.4], [12.2, 7.8, 12.2]],
        [[3.0, 2.2, 4.2], [15.6, 8.0, 14.6]], [[1.2, 1.0, 1.8], [16.6, 7.8, 18.2]]];
module tailShape(g = 0) {
  for (i = [0 : 3]) hull() for (e = [TAIL[i], TAIL[i + 1]]) translate(e[1]) rotate([0, 0, TAILZ]) scale(e[0] + [g, g, g]) sphere(1, $fn = 22);
}
color(fur) tailShape();
// Grey streak along the middle from the root, and the whole tip grey.
color(tailGrey) intersection() {
  tailShape(0.22);
  union() {
    for (i = [0 : 2]) hull() for (j = [i, i + 1]) translate(TAIL[j][1] + [0, 0, 0.6]) scale([8, 8, 0.95]) sphere(1, $fn = 12);
    translate([13.6, 0, 16.4]) rotate([0, -25, 0]) cube([10, 16, 10]);
  }
}
// Feathered tips at the end and along the lower edge (cream), flame-like grey ones on the tip.
for (q = [[[7.4, 6.6, 8.8], [-0.4, 0.2, -2.2], 1.8], [[11.2, 7.6, 8.4], [0.6, 0.2, -2.4], 2.0], [[14.8, 8.0, 10.0], [2.4, 0.4, -2.2], 1.8],
          [[16.6, 8.0, 12.4], [3.0, 0.4, -0.6], 1.6]]) tuft(q[0], q[1], q[2], 1.0, fur, TAILZ);
for (q = [[[16.2, 7.8, 17.6], [0.6, -0.2, 2.4], 1.0], [[15.4, 7.8, 17.0], [-0.9, 0, 2.0], 0.9], [[17.0, 7.8, 16.6], [1.8, 0, 1.6], 0.9]])
  tuft(q[0], q[1], q[2], 0.8, tailGrey, TAILZ);

// ---- Head: the big drawn head, built at its first size and scaled up HEADK about the chin (HEADF), sunk a little ----
HEADK = 1.18;
HEAD = [[[5.6, 4.5, 4.6], [0, -2.6, 26.3]], [[4.9, 3.8, 3.2], [0, -3.6, 23.2]]];
module headShape(g = 0) { hull() for (e = HEAD) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 30); }
EAR = [4.0, -1.8, 28.1];
HEADF = [0, 0.54, -4.09];   // = [0, -3, 20.5] * (1 - HEADK) + [0, 0, -0.4]
translate(HEADF) scale(HEADK) {
  color(fur) headShape();
  // Muzzle: short and pale; the wide dark nose on top.
  ell([2.6, 2.0, 1.4], [0, -5.7, 22.6], furHi);
  ell([1.25, 0.75, 0.65], [0, -7.5, 23.0], ink);
  color([0.5, 0.48, 0.5]) translate([-0.45, -8.05, 23.25]) scale([0.35, 0.2, 0.2]) sphere(1, $fn = 8);
  // Lopsided gritted grin: the dark mouth line curling up on the near side, white teeth above it.
  chain([[-2.0, -6.1, 21.4], [0, -6.9, 21.2], [1.6, -6.65, 21.3], [2.9, -5.85, 21.8], [3.5, -5.2, 22.5]], [0.32, 0.36, 0.36, 0.32, 0.22], ink);
  chain([[0.8, -7.0, 21.65], [2.6, -6.25, 22.05]], [0.44, 0.4], [0.98, 0.97, 0.94, NOGLOW]);
  // Cheek fluff puffing out at the jaw's sides.
  mirror_x() ell([1.6, 1.7, 1.4], [4.0, -3.4, 22.0], fur);
  // Eyes: narrow and angry, grey with a shine, dark lids slanting down to the nose; a scowling fur brow above.
  mirror_x() {
    eye([2.95, -6.2, 24.5], 1.35, iris = iris, pupil = ink, yaw = 10, lid = 0.42, lid_tilt = 26, lid_c = fur, shine = true, squint = 0.2);
    lash([2.95, -6.2, 24.5], 1.35, 10, 0.42, 26);
    color(fur) translate([2.95, -6.2, 24.5]) rotate([0, 0, 10]) hull() {
      translate([1.1, 0.25, 1.15]) scale([0.7, 0.7, 0.45]) sphere(1, $fn = 10);
      translate([-0.9, 0.0, 0.75]) scale([0.7, 0.7, 0.45]) sphere(1, $fn = 10);
    }
  }
  // Markings: forehead arrow pointing down between the eyes, tiger stripes on temple and cheeks (front), the shaft over
  // the crown and a second arrow pointing down the back of the head.
  color(mark) intersection() {
    headShape(0.2);
    union() {
      intersection() {
        frontHalf(-2.2);
        union() {
          prismS([[-6.6, 31.5], [-4.0, 31.5], [-4.3, 27.6], [-3.0, 26.7], [-5.8, 24.6], [-7.9, 26.9], [-6.3, 27.6]], 0.8);
          prismS([[-1.9, 26.5], [0.9, 28.7], [1.5, 28.2], [-1.3, 26.0]], 0.7);
          prismS([[-0.4, 24.1], [-1.5, 22.4], [-1.1, 21.0], [-0.6, 21.2], [-0.8, 22.4], [0.2, 23.9]], 0.7);
          prismS([[-9.9, 23.0], [-8.2, 22.5], [-8.3, 21.9], [-9.9, 22.1]], 0.7);
          prismS([[-9.2, 28.2], [-7.9, 27.6], [-7.8, 27.1], [-9.3, 27.6]], 0.7);
        }
      }
      translate([-0.9, -3.2, 28.6]) cube([1.8, 12, 6]);
      intersection() {
        backHalf(-1);
        rotate([90, 0, 0]) linear_extrude(height = 30, center = true)
          polygon([[0, 23.6], [-2.8, 27.0], [-1.0, 27.0], [-1.0, 31], [1.0, 31], [1.0, 27.0], [2.8, 27.0]]);
      }
    }
  }

  // ---- Floppy ears folded down beside the head; the inside pink ----
  mirror_x() {
    translate(EAR) rotate([0, 0, -40]) rotate([0, -15, 0]) scale(1.15) {
      color(fur) hull() {
        scale([0.9, 1.7, 0.8]) sphere(1, $fn = 14);
        translate([2.6, -0.1, -0.4]) scale([0.8, 2.0, 0.8]) sphere(1, $fn = 12);
        translate([3.0, -0.3, -4.0]) scale([0.7, 1.5, 1.5]) sphere(1, $fn = 14);
      }
      color(pink) hull() {
        translate([1.9, -0.3, -1.4]) scale([0.4, 1.2, 0.6]) sphere(1, $fn = 8);
        translate([2.55, -0.4, -3.7]) scale([0.4, 1.0, 1.0]) sphere(1, $fn = 8);
      }
    }
  }
  // The top-knot's brown band on the crown.
  color(band) translate([0.6, 0.4, 29.6]) cylinder(h = 1.3, r1 = 1.7, r2 = 1.5, $fn = 18);
}

// ---- Topknot (raised with the bigger head): a billowing hair plume streaming to the right in curled locks ----
translate([0, 0, 1.45]) {
limb([0.6, 0.4, 30.4], [0.2, 0.8, 32.4], 1.4, 1.8, hair);
blob([[[2.6, 2.4, 1.6], [0.4, 0.8, 32.2]], [[4.0, 3.4, 3.0], [-2.0, 1.0, 34.2]], [[3.6, 3.2, 2.8], [0.6, 1.6, 36.2]], [[2.6, 2.6, 2.0], [-3.0, 1.0, 37.2]]], hair);
// Streaming locks, tapering into curls.
// One broad swept mass, tall where it leaves the billow, thinning into an upturned curl.
PLUME = [[[3.0, 2.8, 3.0], [1.0, 1.6, 36.6]], [[2.5, 2.3, 2.5], [4.6, 2.6, 37.2]], [[1.9, 1.8, 2.0], [7.6, 3.4, 37.4]],
         [[1.2, 1.2, 1.3], [10.0, 4.0, 38.2]], [[0.45, 0.45, 0.5], [10.8, 4.0, 39.9]]];
for (i = [0 : 3]) color(hair) hull() for (e = [PLUME[i], PLUME[i + 1]]) translate(e[1]) scale(e[0]) sphere(1, $fn = 16);
// The lower lock hooking down under it.
chain([[6.0, 3.0, 36.0], [8.6, 3.8, 35.6], [10.2, 4.4, 34.6], [9.8, 4.4, 33.4]], [1.3, 1.0, 0.6, 0.2], hair);
chain([[2.0, 2.0, 33.6], [5.0, 2.8, 33.4], [7.0, 3.4, 32.6], [7.4, 3.4, 31.4], [6.6, 3.2, 31.0]], [2.0, 1.5, 1.0, 0.5, 0.15], hairDark);
// Highlight strands and loose wisps.
chain([[-4.2, -0.8, 35.4], [-1.4, -1.6, 37.0], [2.0, -0.4, 37.8], [5.0, 0.8, 38.2]], [0.7, 0.75, 0.6, 0.3], hairHi);
chain([[-4.6, 0.0, 33.0], [-1.8, -1.6, 34.4], [1.6, -1.0, 35.2]], [0.6, 0.6, 0.3], hairHi);
chain([[-4.6, 0.8, 33.2], [-6.2, 0.6, 33.2], [-6.6, 0.6, 34.4]], [0.8, 0.5, 0.15], hair);
}
