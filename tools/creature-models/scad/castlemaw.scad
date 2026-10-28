// Castlemaw: a hulking honey badger in a shaggy dark fur cloak, a bone skull on its chest, a belt of bone teeth,
// steel-banded arms ending in cannon barrels, bone-spiked steel pauldrons and bone spikes along the cloak's back.
//
// Checklist (sheet frame: height 40, feet z = 0, sheet x = 0.866 x + 0.5 y; the creature's +X side is the viewer's
// right and nearest the camera):
//   head      badger head seen almost in profile, turned ~30 deg to its right: sheet x -9.8..3, z 27..37.5; the
//             snout tip at (-9.8, 30.5) with a black nose; a cream blaze along the top of the head from the crown
//             (-7.5..-2.5, 37) to the nose bridge; a black band through the eye to the snout; cream cheek below it
//             (-6.9..-0.2, 29.6..33.2); open black mouth with small cream fangs (-8..-3, 28..29.5); dark chin to z 27;
//             one red eye at (-4, 32.4) ~1.7 wide, slanted, with a glint; a small dark ear tuft at (-8, 36.8); a dark
//             fur crest rising behind the head to (-3.1, 39.7)..(2.7, 39.9)
//   torso     dark fur chest between the cloak lapels, sheet x -8..6, z 8..28; the cream skull on the chest:
//             cranium (-7.1..1.5, 22.5..25.7) with two dark sockets below its V-shaped brow, the maxilla with a
//             nose hole and four hanging teeth (-6.9..1.5, 16.1..21.9); bone belt of ~11 teeth (-6.3..5.1, 11.4..15.4)
//   cloak     M0 [0.23, 0.24, 0.25] shag: a mantle dome behind the head to z 40, the +X drape down the viewer's right
//             to a ragged hem at z 3 (right edge 17..19.8 at z 8..22, crest ridge (6.4, 39)..(13.3, 34.1)..(16.9, 29.4));
//             the -X flap only at the shoulder (-15..-8, 18..30) in front of the -X upper arm; from the back a huge
//             shaggy mound with six bone spikes, the -X hip and leg left bare below a diagonal hem
//   pauldrons steel [0.46, 0.46, 0.47] domes with a rivet: +X at (6.4..12.2, 26.7..32.3) with three bone spikes up and
//             out; -X at (-13.6..-9.8, 25.9..32) with spikes up-left
//   arms      +X: banded upper arm down-right from the pauldron to a bone elbow cap at (15.5, 18.5), the cannon
//             (11.3..17.3, 11.4..17) pointing down and at the camera, muzzle ring at (15.5, 12.5), three cream claws
//             under it (10..13, 6..9). -X: upper arm hidden by the flap, elbow cap at (-14, 18.5), the cannon
//             pointing forward-down to the muzzle at (-18.3, 11) (-19.8..-13, 8..17), three claws under it
//   legs      thick bowed legs: -X leg sheet -11.6..-3, foot z 0..5 with three cream claws pointing forward;
//             +X leg 4..12.4, foot with claws at the bottom; open gap between the legs below z 5
//   glow      nothing glows on the sheet: the red eye is NOGLOW
include <lib.scad>

fur = [0.17, 0.18, 0.19];        // body, legs, head
cloak = [0.23, 0.24, 0.25];      // M0 mid shade: the shaggy cloak
cloakHi = [0.30, 0.32, 0.33];    // lighter streaks in the shag
cream = [0.88, 0.86, 0.80];      // M2: face blaze, chest skull, teeth, claws
bone = [0.66, 0.63, 0.57];       // belt, spikes, elbow caps
steel = [0.46, 0.46, 0.47];      // M1: pauldrons, arm bands, cannons
steelDk = [0.29, 0.29, 0.31];
ink = [0.05, 0.05, 0.06];        // nose, mouth, bores, rivets
red = [0.85, 0.08, 0.08, NOGLOW];
redDk = [0.45, 0.03, 0.03];

// Whole front silhouette from the sheet: the cloak mass is cut to it along the view.
silPts = [[0.7, 39.9], [2.7, 39.9], [2.6, 39], [6.4, 39], [6, 37.9], [10.4, 36.5], [9.8, 35.4], [13.3, 34.1],
          [12.4, 32.8], [16.9, 29.4], [15.5, 28.3], [19.3, 21.9], [18, 21.7], [19.8, 11], [18.5, 11.8], [19.3, 7.9],
          [17.8, 8.3], [17.8, 5.6], [17.1, 6.1], [15.5, 3], [14, 5.2], [13.6, 3.8], [11.5, 5.4], [12.4, 0.3],
          [10.9, 1], [10.2, 0], [8.9, 0.9], [7.5, 0], [6.6, 3.6], [4.2, 5.2], [4.2, 4], [0.9, 5.8], [0.4, 4.9],
          [-2, 7.6], [-3.2, 6.9], [-2.7, 4.7], [-3.4, 5], [-3.6, 2.7], [-11.6, 2.3], [-8.5, 4.7], [-10.1, 6.7],
          [-11.2, 5.2], [-11.6, 8.3], [-8.3, 17.6], [-13.1, 8.7], [-13.8, 10.5], [-13.8, 7.9], [-15.8, 7.8],
          [-19.8, 12.8], [-15.1, 20.8], [-13.6, 21.4], [-13.6, 29.2], [-12.3, 28.8], [-11.8, 32.1], [-11.4, 31],
          [-8.5, 34.3], [-8.5, 37], [-6.9, 36.6], [-3.1, 39.7], [0.6, 39.7]];
// Chest skull outlines from the sheet (cream on the dark chest; the sockets, nose hole and tooth gaps are the fur).
craniumPts = [[-0.2, 25.9], [0.6, 25.7], [1.5, 25.0], [1.0, 23.6], [0.2, 22.3], [-1.6, 21.9], [-3.2, 22.6],
              [-4.8, 21.9], [-6.6, 22.3], [-7.2, 23.8], [-6.6, 25.2], [-5.0, 25.9], [-2.8, 26.2]];
facePts = [[1.5, 21.9], [1.1, 21], [-0.2, 20.5], [-1.0, 19.2], [-1.1, 17], [-1.2, 18.7], [-2, 18.7], [-2, 16.1],
           [-2.5, 18.5], [-3.2, 18.7], [-3.2, 16.1], [-3.4, 18.3], [-4.2, 18.7], [-3.8, 17.2], [-4.4, 16.8],
           [-4.9, 19.6], [-6.9, 21.4], [-6.9, 21.7], [-4.3, 20.7], [-3.4, 21.7], [-1.8, 20.8], [0.6, 21], [1.5, 21.7]];

// Keeps only what is in front of the picture plane through the origin (the near face of a body).
module front() { pp(0) translate([-60, -120, -60]) cube([120, 120, 120]); }
// The prism of a front-sheet outline along the camera's actual rays: the camera looks 10 deg down, so a cut d units
// behind the picture plane must sit 0.176 d lower to land on the sheet where the art has it.
module viewPrism(pts, len = 120) {
  pp(0) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.176, 1, 0], [0, 0, 0, 1]])
    rotate([90, 0, 0]) linear_extrude(height = len, center = true) polygon(pts);
}
// A flat lock of fur rooted at p, lying along the surface whose outward normal is at azimuth `az` about Z (local +Y
// is outward, local +X tangential), tapering along d (local).
module lock(p, az, d, w, c) {
  color(c) translate(p) rotate([0, 0, az]) hull() {
    scale([w, w * 0.35, w * 0.6]) sphere(1, $fn = 8);
    translate(d) sphere(0.15, $fn = 4);
  }
}

// ---- legs: thick and bowed, the +X leg stepped a little wider; bear feet with three cream claws
module leg(x, xf, yf, fd) {
  limb([x * 0.85, 0, 15], [x, -1, 8], 4.6, 4.0, fur);
  limb([x, -1, 8], [xf, 0, 3], 4.0, 3.2, fur);
  t = [xf, yf, 0] + [fd[0], fd[1], 0] * 5.5;
  blob([[[3.6, 4.2, 2.2], [xf + fd[0] * 2, yf + fd[1] * 2, 2.2]], [[2.6, 2.6, 1.8], [t[0], t[1], 1.8]]], fur);
  for (a = [-28, 0, 28]) spike([t[0] + sin(a) * 1.9 * fd[1] * -1 + fd[0] * 0.3, t[1] + sin(a) * 1.9 * fd[0] + fd[1] * 1.4, 1.6],
                                [fd[0] * 2.4 + sin(a) * 0.5 * -fd[1], fd[1] * 2.4 + sin(a) * 0.5 * fd[0], -1.2], 0.55, 0.05, cream);
}
leg(-8, -8.5, 0, [0, -1]);
leg(9.5, 11.5, -1.5, [0.6, -0.8]);

// ---- torso: a barrel chest over the belly, the hips between the legs
module chest(g = 0) { translate([0, -1, 21]) scale([9.5 + g, 7.5 + g, 7.5 + g]) sphere(1, $fn = 32); }
color(fur) chest();
blob([[[8.5, 7.5, 5], [0, 0, 14]], [[7.5, 6.5, 4], [0, 0, 10.5]], [[6, 6, 3.5], [1, -1, 8.2]]], fur);
// neck ruff under the head
ell([5, 4.5, 3], [1, -5, 28], fur);
// chest skull: cream patches flush on the chest; the dark sockets, nose hole and tooth gaps are the fur showing
color(cream) intersection() { chest(0.5); prism(craniumPts); front(); }
color(cream) intersection() { chest(0.5); prism(facePts); front(); }
// bone belt: a ring of bone teeth round the waist, open at the back
for (a = [-150 : 15 : 150]) let(x = 8.9 * sin(a), y = -7.8 * cos(a))
  color(bone) hull() {
    translate([x, y, 11.9]) sphere(0.62, $fn = 8);
    translate([x, y, 14.6]) sphere(0.5, $fn = 8);
  }

// ---- head: a blunt badger head, 13 long, turned 32 deg to its right so the camera sees it nearly in profile
hc = [1, -6.5, 32.5];
module headShape(g = 0) {
  hull() {
    translate([0, 1.5, 0.5]) scale([4.8 + g, 4.5 + g, 5.2 + g]) sphere(1, $fn = 24);     // skull
    translate([0, -3.5, 1.5]) scale([3.3 + g, 3 + g, 3.8 + g]) sphere(1, $fn = 20);     // forehead block
    translate([0, -4, -1.8]) scale([2.9 + g, 3 + g, 2.3 + g]) sphere(1, $fn = 20);      // snout
  }
}
module headAt(g = 0) { translate(hc) rotate([0, 0, -32]) headShape(g); }
color(fur) headAt();
translate(hc) rotate([0, 0, -32]) {
  // the cream face: the whole front and top of the head, from the crown to the muzzle
  color(cream) intersection() {
    headShape(0.3);
    hull() {
      translate([0, -4.5, 2]) scale([4.8, 4.5, 3.5]) sphere(1, $fn = 16);
      translate([0, -3, -2]) scale([4.3, 5.2, 2.3]) sphere(1, $fn = 16);
    }
  }
  // the black band from the snout through the eye to the back of the head, on each side
  mirror_x() color(fur) intersection() {
    headShape(0.5);
    hull() {
      translate([3.2, -6.6, -0.3]) scale([1.4, 1.5, 0.9]) sphere(1, $fn = 12);
      translate([3.9, -2.6, 0.4]) scale([1.8, 2.4, 1.15]) sphere(1, $fn = 12);
      translate([3.4, 2.5, 1.2]) scale([2.2, 2.6, 2.0]) sphere(1, $fn = 12);
    }
  }
  // black snout tip with the nose
  color(fur) hull() {
    translate([0, -6.2, -1.4]) scale([2.4, 1.6, 2.0]) sphere(1, $fn = 14);
    translate([0, -7.6, -1.4]) scale([1.6, 1, 1.5]) sphere(1, $fn = 12);
  }
  ell([1.5, 1.2, 1.1], [0, -7.3, -1.2], ink);
  // open mouth: a black gape under the muzzle, small cream fangs, the dark chin below
  mirror_x() color(ink) translate([3.0, -3.8, -3.6]) scale([2.0, 3.4, 0.9]) sphere(1, $fn = 14);
  mirror_x() for (y = [-6.4, -5.1, -3.8, -2.5, -1.2]) spike([4.3, y, -3.1], [0.15, 0, -1.2], 0.32, 0.05, cream);
  ell([3.0, 4, 1.4], [0, -2.5, -4.4], fur);
  // red eyes, slanted into a scowl, the +X one facing the camera
  mirror_x() eye([3.9, -2.8, 0.3], 1.2, iris = redDk, sclera = red, pupil = ink, yaw = 50, lid = 0.3, lid_tilt = 30,
                 lid_c = fur, slit = 0.4, squint = 0.1, shine = true);
  // small ear tufts at the top front corners (the crest behind the head is the cloak's dome)
  mirror_x() petal([1, 0.7, 1.4], [1.7, -5.2, 3.9], [0, 15, 0], fur);
}

// ---- pauldrons: steel domes with a rivet and bone spikes
module pauldron(s) {
  p = [s * 12 - (s < 0 ? -1 : 0), -2 + (s < 0 ? 0.5 : 0), 29];
  color(steel) hull() {
    translate(p) scale([3.6, 4, 2.8]) sphere(1, $fn = 20);
    translate(p + [s * 1.2, -0.4, -2.4]) scale([3.0, 3.6, 1.2]) sphere(1, $fn = 16);
  }
  color(steelDk) translate(p + [s * 1.6, -0.6, -2.8]) scale([3.2, 3.8, 0.8]) sphere(1, $fn = 16);
  color(ink) translate(p + [s * 1.6, -5.4, -0.5]) sphere(0.45, $fn = 8);
}
pauldron(1);
pauldron(-1);
for (t = [[11.6, -2.5, 34.6], [14.2, -1.8, 34.2], [16, -1.2, 32.2]]) spike([12, -2, 30.8], t - [12, -2, 30.8], 1.1, 0.1, bone);
for (t = [[-11.6, -3, 34.2], [-13.2, -3.5, 32.8], [-14, -4, 30.4]]) spike([-11, -1.5, 30.8], t - [-11, -1.5, 30.8], 1.1, 0.1, bone);

// ---- arms: a banded dark upper arm, a bone elbow cap with a rivet, the forearm cannon with steel bands, a dark
// muzzle ring with a black bore, three cream claws hanging under the muzzle
module cannon(el, mz) {
  d = mz - el;
  l = norm(d);
  color(steel) hull() { translate(el) sphere(3.1, $fn = 18); translate(mz) sphere(3.0, $fn = 18); }
  for (k = [0.32, 0.62]) color(steelDk) translate(el + d * k) rotate(_dir_rot(d)) cylinder(h = 1.3, r = 3.35, center = true, $fn = 20);
  color(steelDk) translate(mz) rotate(_dir_rot(d)) cylinder(h = 1.8, r = 3.2, center = true, $fn = 20);
  color(ink) translate(mz + d / l * 0.9) rotate(_dir_rot(d)) cylinder(h = 0.6, r = 2.0, center = true, $fn = 16);
  // bone elbow cap with a rivet
  ell([2.6, 2.6, 2.2], el + [0, -1.2, 0.8], bone);
  color(ink) translate(el + [0, -3.6, 1.2]) sphere(0.4, $fn = 8);
}
// +X (near) arm: out and down from the shoulder, the cannon pointing down and at the camera
elR = [18, -1, 18.5];
mzR = [21.5, -6.2, 12.5];
limb([12, -2, 28.5], elR, 3.2, 3.0, steel);
for (k = [0.35, 0.7]) color(steelDk) translate([12, -2, 28.5] + (elR - [12, -2, 28.5]) * k)
  rotate(_dir_rot(elR - [12, -2, 28.5])) cylinder(h = 1.3, r = 3.5, center = true, $fn = 18);
cannon(elR, mzR);
for (a = [-30, 0, 30]) spike(mzR + [sin(a) * 1.8 - 1.5, 0.8, -1.6], [sin(a) * 0.5 - 0.3, -1.2, -3], 0.55, 0.05, cream);
// -X (far) arm: the upper arm under the cloak flap, the cannon pointing forward and down
elL = [-13.3, -5, 18.5];
mzL = [-13.6, -11.5, 11.2];
limb([-12, -2, 28.5], elL, 3.0, 3.0, fur);
cannon(elL, mzL);
for (a = [-30, 0, 30]) spike(mzL + [sin(a) * 2 + 1.1, 2.5, -2.6], [sin(a) * 0.3, -1.2, -3.2], 0.75, 0.05, cream);

// ---- cloak: a shaggy mantle over the back and shoulders, draped down the +X side to a ragged hem, with a flap at the
// -X shoulder in front of the upper arm; the -X hip is left bare. Cut to the sheet's silhouette along the view.
module cloakMass() {
  hull() {
    translate([1.5, 4, 33]) scale([14.5, 8, 7.2]) sphere(1, $fn = 24);     // mantle dome behind the head (top z 40)
    translate([2.5, 5, 26]) scale([19, 9.5, 9]) sphere(1, $fn = 24);       // over the shoulders
    translate([9.5, 5, 8]) scale([12.5, 8.5, 6.2]) sphere(1, $fn = 20);    // +X drape down to the hem
    translate([-12.5, -3.5, 23]) scale([6, 3.5, 5.5]) sphere(1, $fn = 16); // -X shoulder flap
  }
}
// the cloak's outline per height (half-widths and centre), for rooting the locks on its surface
rxT = [[2, 10], [8, 12.5], [14, 17], [20, 19.5], [26, 19], [33, 14.5], [38, 9]];
cxT = [[2, 9.5], [8, 9.5], [14, 6.5], [20, 3.5], [26, 2.5], [33, 1.5], [38, 1.5]];
ryT = [[2, 5], [8, 8.5], [14, 9.5], [26, 9.5], [33, 8], [38, 5]];
cyT = [[2, 5], [26, 5], [33, 4], [38, 4]];
function xmin(z) = z >= 24 ? -17 : -2 - (z - 2) * 0.68;   // the bare -X hip: no cloak left of this
intersection() {
  union() {
    color(cloak) cloakMass();
    // rows of long flat locks pointing down and a little out, lengths jittered so they do not read as rings
    for (r = [[37, 5], [32.5, 6.5], [28, 7.5], [23, 8], [18, 8.5], [13, 8], [8, 6.5], [4.5, 3.5]])
      let(z = r[0], len = r[1], rx = lookup(z, rxT), ry = lookup(z, ryT), cx = lookup(z, cxT), cy = lookup(z, cyT),
          n = max(8, round((rx + ry) * 0.72)))
      for (i = [0 : n]) let(a = -118 + 236 * i / n, j = (i * 7 + round(z)) % 4,
                            p = [cx + rx * sin(a), cy + ry * cos(a), z + (j - 1.5) * 0.5])
        if (a > 0 || p[0] > xmin(z))
          lock(p, -a, [((i % 3) - 1) * 0.7, 1.2, -(len + j * 1.1)], 2.3 + j * 0.2, (i * 3 + round(z)) % 5 == 0 ? cloakHi : cloak);
    // locks along the lapels (the cloak's front edges beside the chest)
    for (k = [0 : 4]) lock([8.5 + k * 0.2, -4.5, 27 - k * 4], 150, [0, 1, -4.5], 2.2, k % 2 ? cloakHi : cloak);
    for (k = [0 : 2]) lock([-7.5 - k * 0.3, -5, 27 - k * 3.5], -150, [0, 1, -4], 2.0, k % 2 ? cloakHi : cloak);
    // the mane's ridge behind the head
    for (k = [0 : 5]) let(x = -4 + k * 2.2)
      lock([x, 3.5, 38.5 - abs(x - 1) * 0.25], 0, [x * 0.3, 1.5, 3.5 - abs(x - 1) * 0.2], 2.2, k % 2 ? cloakHi : cloak);
  }
  color(cloak) viewPrism(silPts);
}
// bone spikes jutting out of the shag on the back (what the back view shows), kept behind the dome from the front
for (s = [[4, 11.5, 30, [0.1, 0.75, 0.65], 5.5], [3, 11.5, 25, [0, 0.7, 0.7], 4.5], [-2.3, 10, 33, [-0.2, 0.5, 0.85], 4.5],
          [-5.5, 9, 32, [-0.35, 0.45, 0.82], 4]])
  spike([s[0], s[1], s[2]], s[3] * s[4], 1.3, 0.1, bone);
// a pale sliver of bone lying in the fur at the top of the back
lock([1, 11, 37], 0, [3.5, 0.6, -1.2], 1.4, bone);
