// Bloomsprite: a little flower fairy girl, remodelled from her sprite (2026-11-03).
// Checklist (front sheet, sheet units; the cream sticker halo round the art is not a part):
//   head   big chibi head, face x -3.8..2 z 22.8..28.3, chin pointed a little; dark purple-grey bob round it, bangs in
//          strands over the brow, side locks down to the chin; pointed elf ears (near one x 3.4..4.9 z 25.5..28.5)
//   face   two wide almond eyes (x -3.8..-2.4 and -0.4..1.4, z 25.5..26.8): thick black upper lash, purple iris, white
//          glints; a small sly smile (x -1.75..-0.75 z 23.9) with a dimple, faint rosy cheeks
//   hat    a big open rose worn as a hat, x -4.8..5.4 z 30.2..37: crimson outer petals, pink cup, swirl on top;
//          green sepals spread under it (x -5.8..6.6 z 28..31)
//   dress  leaf bodice (three leaves on the chest, leaf cap sleeves out to x -5.4 / 6.3 at z 20.5), purple belt z 16.3,
//          a flared skirt of big pointed leaves with dark veins (tips x -8.3 / 8.9 at z 11, front tip z 7.5), dark
//          teal and purple underskirt between them
//   limbs  bare thin legs splayed wide, feet (sheet z 2.1) pointing outwards; right arm (viewer's left) holds a rose
//          wand (twig from x -6.2 z 13.7 up to a pink rose at x -13.5 z 26.5), left arm hangs out to a hand at x 8.3 z 14
//   wings  two pairs of pale pink wings behind, made of long pointed lobes with crimson rims and veins: upper ones
//          to x 17.6 z 39 / x 19.8 z 32.5, lower ones down-out to x 15 z 13
//   back   the bob ends at z 23, the leaf bodice and skirt, the wing roots meet at the spine
// Authored in sheet height (feet at z 2.1) and lowered by G so the feet stand on z = 0.
include <lib.scad>

G = 2.1;
function n(c) = [c[0], c[1], c[2], NOGLOW];

skin = n([0.94, 0.74, 0.6]);
blush = n([0.95, 0.64, 0.62]);
hair = [0.36, 0.31, 0.42];
ink = [0.07, 0.05, 0.07];
irisC = [0.48, 0.18, 0.44];
pupilC = [0.26, 0.08, 0.22];
lipC = [0.72, 0.36, 0.38];
leafC = [0.46, 0.61, 0.38];
leafLt = [0.56, 0.71, 0.42];
rib = [0.25, 0.39, 0.31];
teal = [0.2, 0.3, 0.28];
belt = [0.42, 0.32, 0.46];
twig = [0.5, 0.33, 0.2];
roseDk = [0.58, 0.18, 0.27];
roseMd = n([0.8, 0.42, 0.48]);
rosePk = n([0.92, 0.56, 0.6]);
roseLt = n([0.97, 0.7, 0.72]);
wingC = n([0.97, 0.73, 0.75]);
wingRim = [0.54, 0.22, 0.33];

// A pointed leaf: base at the origin, pointing along local +Z, `w` wide along Y, `t` thick along X; the upper face
// (local -X) carries a darker midrib. `phi` turns it round Z (0 = towards +X), `droop` tips it down from level.
module leaf(p, phi, droop, L, w, t, c, rc = undef) {
  translate(p) rotate([0, 0, phi]) rotate([0, 90 + droop, 0]) {
    color(c) hull() {
      translate([0, 0, L * 0.42]) scale([t, w, L * 0.42]) sphere(1, $fn = 12);
      translate([0, 0, L]) sphere(0.08, $fn = 6);
    }
    if (rc != undef) color(rc) hull() {
      translate([-t * 0.72, 0, L * 0.12]) sphere(0.12, $fn = 6);
      translate([-t * 0.42, 0, L * 0.74]) sphere(0.1, $fn = 6);
    }
  }
}

// Wings: the outlines are traced on the near (+X) wings of the front sheet; the wing plane stands at y = WY, flat in
// x and z, so a sheet x maps to scad x = (sx - WY / 2) / 0.866. The far wings are the mirror.
// the head's scale and centre, and how far the rose hat rises to sit on the bigger head
HK = 1.28;
HL = 0.4;
HC = [0, -0.5, 26.2];
RZ = 1.6;
WY = 2.2;
function wpts(pts) = [for (p = pts) [(p[0] - WY * 0.5) / 0.866, p[1]]];
upperW = [[2.5, 21.8], [2.5, 25.3], [5.9, 28.6], [12.3, 34.0], [17.4, 39.0], [18.6, 38.5], [18.5, 35.0], [17.6, 32.1],
  [19.8, 32.6], [19.7, 31.6], [18.5, 28.4], [16.9, 26.5], [18.5, 26.4], [18.2, 25.0], [15.4, 22.3], [13.9, 21.3],
  [10.9, 20.6], [8, 20.4], [5.5, 20.8]];
lowerW = [[2.5, 20.5], [6, 20.3], [10.0, 19.9], [11.5, 17.5], [14.2, 13.7], [15.1, 13.3], [14.5, 12.7], [10.0, 12.6],
  [6.9, 13.2], [4.5, 14.5], [2.5, 16.5]];
// the lighter midline of each lobe
mids = [[[4.5, 23.0], [10.5, 31.6]], [[6, 25.5], [17.8, 38.2]], [[7, 25.0], [19.0, 32.2]], [[7, 23.8], [17.9, 26.1]],
  [[5, 17.5], [14.4, 13.5]]];
wingMid = n([0.88, 0.55, 0.59]);
veins = [[[4.5, 23.6], [12.3, 33.9]], [[5, 23.2], [17.6, 32.1]], [[5, 22.6], [16.9, 26.5]], [[4.0, 18.0], [12.6, 15.0]]];
module vein(a, b, w = 0.32, c = wingRim) {
  d = [b[0] - a[0], b[1] - a[1]];
  l = norm(d);
  q = [-d[1] / l * w / 2, d[0] / l * w / 2];
  plate([a + q, b + q, b - q, a - q], t = 1.3, r = 0, c = c, grow = 0);
}
module wingPair() {
  translate([0, WY, 0]) {
    // the crimson rim: a thin plate a little wider than the pink pillow, which thins to nothing at its edge
    plate(wpts(upperW), t = 0.45, r = 0.3, c = wingRim, grow = 0.2);
    slab(wpts(upperW), 1.1, wingC, inset = 1.1, grow = -0.15);
  }
  translate([0, WY + 0.5, 0]) {
    plate(wpts(lowerW), t = 0.45, r = 0.3, c = wingRim, grow = 0.2);
    slab(wpts(lowerW), 1.1, wingC, inset = 1.0, grow = -0.15);
  }
  translate([0, WY, 0]) for (v = [0 : 2]) vein(wpts([veins[v][0]])[0], wpts([veins[v][1]])[0]);
  translate([0, WY + 0.5, 0]) vein(wpts([veins[3][0]])[0], wpts([veins[3][1]])[0]);
  translate([0, WY, 0]) for (v = [0 : 3]) vein(wpts([mids[v][0]])[0], wpts([mids[v][1]])[0], 0.22, wingMid);
  translate([0, WY + 0.5, 0]) vein(wpts([mids[4][0]])[0], wpts([mids[4][1]])[0], 0.22, wingMid);
}

module model() {
  // ---- Legs: bare, soft and child-like, splayed wide; small round feet point outwards.
  mirror_x() {
    limb([1.8, 0.2, 13.2], [6.5, -0.2, 3.7], 1.75, 1.12, skin);
    petal([1.85, 1.1, 0.82], [7.3, -0.7, 2.92], [0, 0, -20], skin);
  }

  // ---- Dress: underskirt, the skirt of leaves, belt, bodice and leaf sleeves.
  translate([0, 0.1, 0]) lathe([[0.1, 9.8], [3.3, 10.6], [3.2, 13.2], [2.3, 16.3]], belt, fn = 24);
  for (k = [0 : 7]) leaf([2.1 * cos(-67.5 + 45 * k), 0.1 + 2.1 * sin(-67.5 + 45 * k), 15.8], -67.5 + 45 * k, 56, 7.2, 1.7, 0.4, teal);
  for (k = [0 : 7]) {
    phi = -90 + 45 * k;
    f = pow(max(0, -sin(phi)), 2);   // the front leaves hang steeper and longer
    leaf([2.1 * cos(phi), 0.1 + 2.1 * sin(phi), 16.4], phi, 40 + 26 * f, 8.4 + 1.3 * f, 2.5, 0.45, k % 2 ? leafC : leafLt, rib);
  }
  ell([2.35, 1.95, 0.6], [0, 0.1, 16.4], belt);
  ell([2.2, 1.75, 2.8], [0, 0.1, 18.9], leafC);
  for (a = [-130, -90, -50]) leaf([0.9 * cos(a), 0.1 + 1.0 * sin(a), 21.4], a, 72, 5.0, 1.25, 0.35, a == -90 ? leafLt : leafC, rib);
  mirror_x() leaf([1.4, -0.2, 21.3], -6, 16, 5.0, 1.45, 0.4, leafC, rib);
  mirror_x() leaf([1.2, 0.9, 21.2], 40, 30, 3.6, 1.2, 0.35, leafLt);

  // ---- Arms. Her left (+X) hangs out to an open hand; her right holds the wand.
  limb([2.9, 0.2, 20.3], [8.8, 0.5, 14.9], 1.05, 0.82, skin);
  ell([1.1, 0.95, 1.15], [9.3, 0.4, 14.2], skin);
  limb([-2.9, 0.2, 20.3], [-7.8, -1.4, 17.0], 1.05, 0.82, skin);
  ell([1.12, 1.0, 1.15], [-8.3, -1.6, 16.6], skin);

  // ---- Wand: a twig with two leaves and a pink rose turned to the viewer.
  limb([-6.24, -1.6, 13.7], [-14.0, -1.6, 25.6], 0.32, 0.3, twig);
  translate([-14.67, -1.6, 26.6]) rotate([0, 0, 30]) {
    color(rosePk) scale([2.6, 1.7, 2.4]) sphere(1, $fn = 20);
    for (a = [0 : 60 : 359]) rotate([0, a, 0]) translate([0, -0.5, 1.8]) color(a % 120 ? roseMd : roseDk) scale([1.4, 0.9, 0.9]) sphere(1, $fn = 12);
    for (a = [30 : 120 : 359]) rotate([0, a, 0]) translate([0, -1.35, 0.8]) color(roseDk) scale([0.9, 0.35, 0.25]) sphere(1, $fn = 10);
    color(roseLt) translate([0.1, -1.25, 0.05]) scale([1.0, 0.6, 0.9]) sphere(1, $fn = 12);
    color(roseDk) translate([0.1, -1.6, 0.1]) scale([0.45, 0.3, 0.4]) sphere(1, $fn = 10);
  }
  leaf([-12.3, -1.6, 22.9], 190, 10, 3.0, 0.9, 0.3, leafC, rib);
  leaf([-12.6, -1.6, 23.4], 120, -20, 2.6, 0.8, 0.3, leafLt);

  // ---- Head (chibi: drawn at sheet size, then scaled up HK about its centre HC and lifted HL): face, bob, bangs, ears.
  limb([0, -0.1, 20.8], [0, -0.4, 23.2], 0.95, 0.95, skin);
  translate([0, 0, HL]) translate(HC) scale(HK) translate(-HC) {
  blob([[[3.7, 3.5, 3.7], [0, -0.5, 26.1]], [[1.6, 1.4, 0.8], [0, -1.7, 23.0]]], skin);
  color(hair) difference() {
    hull() {
      translate([0, 0.3, 26.6]) scale([4.6, 4.4, 3.4]) sphere(1, $fn = 30);
      translate([0, 0.3, 24.2]) scale([4.3, 4.1, 1.4]) sphere(1, $fn = 30);
    }
    translate([-3.0, -11.0, 17]) cube([6.0, 10, 11.4]);     // the face opening, up to the hairline
    translate([-10, -10, 13]) cube([20, 20, 10]);          // the bob's lower edge
  }
  // fringe: flat pointed strands lying over the brow, parted in the middle to show the forehead
  for (s = [[-2.45, 2.3, -100], [-1.35, 2.7, -94], [-0.25, 2.0, -90], [0.95, 2.6, -86], [2.1, 2.2, -80]])
    leaf([s[0] * 1.1, -3.3 + 0.15 * abs(s[0]), 29.3], s[2], 72, s[1], 0.85, 0.32, hair);
  // side locks down to the chin and the bob's pointed ends at the back
  color(hair) mirror_x() {
    hull() { translate([3.85, -1.5, 26.1]) scale([0.8, 1.1, 1.5]) sphere(1, $fn = 14); translate([3.6, -2.1, 22.2]) sphere(0.1, $fn = 6); }
    hull() { translate([4.1, 0.6, 25.3]) scale([0.8, 1.3, 1.4]) sphere(1, $fn = 14); translate([4.0, 0.9, 22.4]) sphere(0.1, $fn = 6); }
  }
  color(hair) for (x = [-2.6, 0, 2.6]) hull() { translate([x, 3.5 - 0.1 * abs(x), 24.4]) scale([1.1, 0.8, 1.2]) sphere(1, $fn = 14); translate([x, 3.8 - 0.1 * abs(x), 22.3]) sphere(0.1, $fn = 6); }
  // pointed elf ears
  mirror_x() color(skin) translate([3.4, -0.6, 26.2]) rotate(_dir_rot([2.1, 0.4, 1.9])) scale([1, 0.5, 1]) cylinder(h = 3.0, r1 = 0.75, r2 = 0.05, $fn = 12);

  // ---- Face: wide almond eyes under a thick black lash, a lash flick at the outer corner, a sly smile, cheeks.
  mirror_x() eye([1.85, -3.2, 25.9], 0.95, iris = irisC, sclera = n([0.98, 0.96, 0.98]), yaw = 28, pupil = pupilC,
    shine = true, lid = 0.3, lid_tilt = 4, lid_c = ink, squint = 0, slit = 1);
  // a big white glint on each iris, upper outer side
  mirror_x() translate([1.85, -3.2, 25.9]) rotate([0, 0, 28]) color(n([1, 1, 1])) translate([0.3, -0.78, 0.22]) scale([0.3, 0.12, 0.3]) sphere(1, $fn = 10);
  mirror_x() petal([0.5, 0.16, 0.16], [2.85, -2.75, 26.75], [0, -20, 36], ink);
  color(lipC) translate([0.45, -3.3, 23.95]) rotate([0, 6, 8]) scale([0.62, 0.22, 0.13]) sphere(1, $fn = 10);
  color(lipC) translate([1.08, -3.2, 24.1]) sphere(0.14, $fn = 8);
  mirror_x() ell([0.7, 0.2, 0.36], [2.15, -3.05, 24.5], blush);
  }

  // ---- The rose hat: a big closed bud on top of the head, its petals wrapped round a pink heart with dark folds on
  // top; green sepals spread under it.
  translate([0, 0.4, RZ]) {
    lathe([[0.1, 29.8], [2.4, 30.0], [3.4, 30.8], [3.6, 31.8], [0.1, 32.0]], roseDk, fn = 24);
    color(rosePk) translate([0, 0, 34.2]) scale([3.3, 3.3, 3.7]) sphere(1, $fn = 28);
    for (a = [0 : 120 : 359]) rotate([0, 0, a]) translate([0.8, 0, 37.6]) rotate([0, 0, 60]) color(roseDk) scale([1.4, 0.28, 0.4]) sphere(1, $fn = 10);
    color(roseLt) translate([-0.6, -1.2, 36.9]) rotate([0, 0, 20]) scale([1.3, 0.55, 0.8]) sphere(1, $fn = 14);
    // five outer petals wrapped round the bud, leaning in, alternating pink, rose and crimson
    for (k = [0 : 4]) let(phi = -60 + 72 * k)
      translate([3.2 * cos(phi), 3.2 * sin(phi), 33.5]) rotate([0, 0, phi + 90]) rotate([-8, 0, 0])
        color([rosePk, roseDk, roseMd, roseDk, roseMd][k]) scale([3.5, 1.1, 3.5]) sphere(1, $fn = 22);
    for (k = [0 : 5]) leaf([2.6 * cos(-30 + 60 * k), 2.6 * sin(-30 + 60 * k), 30.2], -30 + 60 * k, 24, 3.8, 1.2, 0.32, k % 2 ? leafC : leafLt, rib);
  }

  // ---- Wings.
  mirror_x() wingPair();
}

translate([0, 0, -G]) model();
