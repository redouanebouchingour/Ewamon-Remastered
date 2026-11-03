// Astaroth: a hunched black demon warrior. Sprite-matched 2026-11-03.
// Checklist (front sheet, 40 units tall; the body's centre line reads at sheet x SX = 3.25, so S() shifts by it):
//  - pose: crouched, wide digitigrade stance, torso leaning forward, head low and well in front of the chest
//  - head: a dark grey wolf-dragon muzzle pointing forward-down (snout tip sheet -3.9, 27.8), glowing red-orange slit
//    eyes at sheet (-3.6, 30) and (-0.7, 30), red rune marks on the brow (an ankh between the eyes, brow strokes,
//    a hook under the near eye), two black horns curving up out of the mane to z 40
//  - mane: a wild black mane round the head and neck, sheet x -7..9, z 23..37, ragged on its silhouette
//  - torso: maroon bare chest (sheet -3..7, z 15..26) with a red star sigil at (0, 23) and red rib runes; black fur back
//  - big round two-tier steel pauldrons (near one sheet 5.8..12, z 24..29), steel bracers, maroon clawed gauntlets
//  - a tattered dark grey loincloth over the hips and thighs (z 7..15) with red lightning runes on both thighs
//  - legs: digitigrade, steel knee plates, maroon clawed feet; near foot sheet 9.5..15, far foot -7.8..-2.5
//  - greatsword (creature's right hand, far): a huge chipped rusty blade 4.6 wide from the guard (-8.6, 14.8) to the
//    tip (-24.8, 2.9), a long grip up to (-2, 19.7), a thin dark-red glow along its edge
//  - katana (creature's left hand, near): black blade with a glowing red edge from the hand (13, 14.8) to the tip
//    (-3.8, 2.7), red-wrapped hilt up to (17.5, 18.9)
//  - bat wings folded up behind (charcoal bones, dark membrane, dull red inside): the near one sheet 9..23.3, z 25.4..36; the far one peeks
//    out left of the head (to sheet -9.5)
//  - a thin black devil tail looping out right and up to a barbed spade (sheet 21..25, z 15..18.6)
//  - back: spine runes, wings spread, tail to the viewer's left
include <lib.scad>

FUR = [0.13, 0.10, 0.12];
HEAD = [0.22, 0.19, 0.22];
JAW = [0.16, 0.13, 0.15];
SKIN = [0.29, 0.15, 0.17];
ARMOR = [0.33, 0.30, 0.32];
ARMOR_HI = [0.46, 0.43, 0.45];
CLOTH = [0.23, 0.20, 0.22];
GLOVE = [0.40, 0.12, 0.14];
CLAW = [0.20, 0.18, 0.20];
HORN = [0.10, 0.09, 0.10];
NOSE = [0.06, 0.05, 0.06];
FANG = [0.82, 0.78, 0.72];
RUNE = [0.78, 0.05, 0.04, GLOW];
EYE_RED = [0.95, 0.1, 0.05, GLOW];
EYE_CORE = [1, 0.36, 0.12, GLOW];
MEMB = [0.36, 0.12, 0.13];
MEMB_DARK = [0.17, 0.08, 0.09];
BONE = [0.18, 0.15, 0.17];
BLADE = [0.47, 0.41, 0.39];
RUST = [0.31, 0.25, 0.25];
BLADE_DARK = [0.25, 0.18, 0.17];
GUARD = [0.37, 0.29, 0.24];
GRIP = [0.25, 0.19, 0.17];
AURA_RIM = [0.5, 0.04, 0.04, GLOW];
KBLADE = [0.08, 0.07, 0.10];
KEDGE = [0.85, 0.07, 0.05, GLOW];
KHILT = [0.34, 0.07, 0.08];

SX = 3.25;
function S(sx, z, y = 0) = fromSheet(sx - SX, z, y);
SHIFT = -SX * [cos(VIEW), sin(VIEW), 0];
module ppS(d = 0) { translate(SHIFT) pp(d) children(); }
// Everything nearer the viewer than picture depth dc (for marks laid on the front of a part).
module frontOf(dc) { ppS(0) translate([-100, dc - 200, -100]) cube([200, 200, 300]); }
module strokes2d(list, w) {
  for (s = list) for (i = [0 : len(s) - 2]) hull() { translate(s[i]) circle(w, $fn = 8); translate(s[i + 1]) circle(w, $fn = 8); }
}
module markPrism(list, w) { ppS(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) strokes2d(list, w); }
// A rune painted flush on the front of the children (the part grown a little), traced from the front sheet.
module rune(list, w, dc) { color(RUNE) intersection() { children(); markPrism(list, w); frontOf(dc); } }
module E(r, p) { translate(p) scale(r) sphere(1, $fn = 20); }
module el(r, p, c) { color(c) E(r, p); }

// Local frame at p: x along d, y towards n (a face normal), z = x cross y.
module along(p, d, n) {
  X = d / norm(d);
  Y0 = n - (n * X) * X;
  Y = Y0 / norm(Y0);
  Z = cross(X, Y);
  multmatrix([[X[0], Y[0], Z[0], p[0]], [X[1], Y[1], Z[1], p[1]], [X[2], Y[2], Z[2], p[2]], [0, 0, 0, 1]]) children();
}
module flat(pts, t, c) { color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) polygon(pts); }
VIEWN = [-sin(VIEW), cos(VIEW), 0];   // the view axis (into the picture)

// ---------------- torso ----------------
module torsoShape(g = 0) {
  hull() { E([6, 4.8, 4] + [g, g, g], [0, -1, 16]); E([7.2, 4.6, 4.6] + [g, g, g], [0, -2.5, 22]); }
}
color(FUR) torsoShape();
el([6.5, 5, 4], [0, 0.5, 12.5], FUR);            // pelvis
el([7, 5.5, 4.5], [0, 0.5, 25], FUR);            // hunched upper back
// Bare maroon chest and abs.
color(SKIN) intersection() {
  torsoShape(0.2);
  ppS(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true)
    polygon([[-3, 25.5], [1.5, 26], [5.5, 25], [7, 22.5], [6, 19], [5, 16], [3.5, 14.8], [0.5, 14.8], [-1, 17], [-2.5, 20], [-3.5, 23]]);
  frontOf(-2.5);
}
// Chest star and rib runes.
rune([[[0, 21.3], [0, 25]], [[-1.6, 23.1], [1.6, 23.1]], [[-0.8, 22.3], [0.8, 23.9]], [[-0.8, 23.9], [0.8, 22.3]],
      [[-2, 21], [-1, 19], [-0.2, 17.5], [0.6, 16]], [[3.8, 21.2], [5.8, 20.4]], [[3.8, 19.4], [5.6, 18.4]],
      [[1.2, 17.8], [3, 16.6], [5.2, 15.8]]], 0.2, -2.5) torsoShape(0.4);
// Back runes: the spine and three chevrons.
color(RUNE) intersection() {
  union() { torsoShape(0.25); E([7.25, 5.75, 4.75], [0, 0.5, 25]); }
  union() {
    translate([-0.22, 0, 14]) cube([0.44, 12, 14]);
    for (z = [17, 20.5, 24]) for (s = [-1, 1]) translate([0, 0, z]) rotate([0, s * 55, 0]) translate([-0.2, 0, 0]) cube([0.4, 12, 4]);
  }
  translate([-20, 1.5, 0]) cube([40, 20, 40]);
}

// ---------------- loincloth: tattered panels round the hips ----------------
CLOTHA = [0, 35, -35, 75, -75, 125, -125, 180];
module panel(a, g = 0) {
  translate([6.7 * sin(a), 0.5 - 5.4 * cos(a), 11.4]) rotate([-14, 0, a]) scale([2.9 + g, 0.5 + g, 3.9 + g]) sphere(1, $fn = 12);
}
color(CLOTH) for (a = CLOTHA) panel(a);
// Lightning runes on the thighs (far and near).
rune([[[-3, 15.3], [-2.8, 13.8], [-2, 14], [-2.3, 12.5], [-1.4, 12.5], [-1.2, 11.3]],
      [[6.4, 11.4], [6.5, 14], [7.3, 12.8], [7.5, 15], [8.3, 13.5], [8.5, 15.3]]], 0.24, -1)
  union() { for (a = [35, -35, 75, -75]) panel(a, 0.2); }

// ---------------- legs (digitigrade, crouched; the far / right leg a step ahead) ----------------
module talons(p, s = 1) {
  for (o = [-0.9, 0, 0.9]) spike([p[0] + o, p[1], p[2]], [o * 0.3, -1.5, -0.6], 0.42, 0.05, CLAW);
  spike([p[0], p[1] + 3.2, p[2] + 0.1], [0, 1, -0.5], 0.35, 0.05, CLAW);
}
// near (left, +X)
limb([4.5, 0.5, 12], [8, -1, 9.8], 3.6, 2.8, FUR);
el([2.6, 2.1, 2.7], [8.4, -2.9, 10], ARMOR);
limb([8, -1, 9.8], [9.8, 2, 4.5], 2.4, 1.7, FUR);
limb([9.8, 2, 4.5], [10, 1.2, 1.4], 1.4, 1.2, FUR);
blob([[[1.9, 2.6, 1.2], [10, -0.4, 1.2]], [[1.4, 1.4, 1.1], [10, 1.4, 1.3]]], GLOVE);
talons([10, -2.6, 0.9]);
// far (right, -X)
limb([-4.5, 0.5, 12], [-6.8, -4.5, 10.4], 3.6, 2.8, FUR);
el([2.6, 2.1, 2.7], [-7.1, -6.5, 10.6], ARMOR);
limb([-6.8, -4.5, 10.4], [-6, -2.5, 4.5], 2.4, 1.7, FUR);
limb([-6, -2.5, 4.5], [-6.2, -3.4, 1.4], 1.4, 1.2, FUR);
blob([[[1.9, 2.6, 1.2], [-6.3, -5.4, 1.2]], [[1.4, 1.4, 1.1], [-6.2, -3.6, 1.3]]], GLOVE);
talons([-6.3, -7.6, 0.9]);

// ---------------- shoulders and arms ----------------
mirror_x() {
  el([3.6, 3.4, 2.8], [8.7, -4, 26.6], ARMOR);           // pauldron
  el([2.6, 2.4, 1.4], [8.9, -4.2, 28.6], ARMOR_HI);      // its top tier
  el([3.3, 3.2, 1.5], [9.6, -4, 24.2], ARMOR);           // lower lame
}
// near (left) arm: hangs out to the side, katana in the hand
limb([8.7, -4, 26], [13, -3.5, 19.5], 2.6, 2.3, FUR);
limb([13, -3.5, 19.5], [14, -5.2, 15.4], 2.3, 2, FUR);
el([2.7, 2.6, 3.2], [13.5, -4.3, 17.8], ARMOR);
el([1.9, 1.9, 1.8], [14, -5.4, 14.6], GLOVE);
// far (right) arm: forward, gripping the greatsword
limb([-8.7, -4, 26], [-9.2, -6, 20], 2.6, 2.3, FUR);
limb([-9.2, -6, 20], [-7.4, -8.6, 16.4], 2.3, 2, FUR);
el([2.7, 2.6, 3.1], [-8.4, -7.3, 18.2], ARMOR);
el([1.9, 1.9, 1.8], [-7.2, -9, 16], GLOVE);
// arm runes
rune([[[8.6, 22.6], [9.6, 23.8], [10.4, 23.4]], [[-4.6, 23.6], [-4, 22.2]]], 0.2, -3) union() {
  hull() { E([2.5, 2.5, 2.5], [8.7, -4, 26]); E([2.2, 2.2, 2.2], [13, -3.5, 19.5]); }
  hull() { E([2.5, 2.5, 2.5], [-8.7, -4, 26]); E([2.2, 2.2, 2.2], [-9.2, -6, 20]); }
}

// ---------------- mane ----------------
el([7, 5.6, 5], [0, -5.2, 30.6], FUR);
TUFTS = [[[0, -6.4, 34.6], [0, 2, 3]], [[2.8, -5.4, 34.2], [1.4, 2.6, 2.6]], [[-2.8, -5.4, 34.2], [-1.4, 2.6, 2.6]],
         [[0, -1.8, 34], [0, 3.6, 2.2]], [[4, -2.2, 33], [2.4, 3.6, 1.6]], [[-4, -2.2, 33], [-2.4, 3.6, 1.6]],
         [[6, -4.2, 31.6], [3.2, 2, 1.4]], [[-6, -4.2, 31.6], [-3.2, 2, 1.4]], [[6, -6, 28.4], [2.6, -0.4, -1.6]],
         [[-6, -6, 28.4], [-2.6, -0.4, -1.6]], [[4.4, 0, 29], [2.2, 3.6, -0.6]], [[-4.4, 0, 29], [-2.2, 3.6, -0.6]],
         [[0, 0.2, 30], [0, 4.2, 0.4]], [[3.6, -9, 32.6], [1.6, -0.8, 2.2]], [[-3.6, -9, 32.6], [-1.6, -0.8, 2.2]]];
color(FUR) for (t = TUFTS) hull() {
  translate(t[0]) scale([2.2, 1, 2.2]) sphere(1, $fn = 10);
  translate(t[0] + t[1]) sphere(0.3, $fn = 6);
}

// ---------------- head: a low wolf-dragon muzzle ----------------
module headShape(g = 0) {
  E([3.4, 3.6, 2.9] + [g, g, g], [0, -9.8, 31.4]);
  hull() { E([2, 2, 1.6] + [g, g, g], [0, -12, 30]); E([1.1, 1, 0.85] + [g, g, g], [0, -14.6, 28.3]); }
}
color(HEAD) headShape();
blob([[[1.7, 1.8, 0.9], [0, -11.3, 28.3]], [[0.9, 1, 0.6], [0, -14, 27.6]]], JAW);   // lower jaw
el([0.6, 0.5, 0.45], [0, -15.45, 28.5], NOSE);
mirror_x() spike([0.7, -14.1, 27.9], [0, -0.1, -0.9], 0.25, 0.05, FANG);
// brows over the glare
mirror_x() petal([1.2, 0.7, 0.4], [1.75, -11.7, 31.05], [0, -22, 32], HEAD);
// eyes: glowing red slits with an orange core
mirror_x() eye([1.95, -12, 30.3], 0.7, iris = EYE_CORE, sclera = EYE_RED, pupil = EYE_CORE, yaw = 35, lid = 0.4,
               lid_tilt = 22, lid_c = HEAD);
// face runes: an ankh between the eyes, brow strokes, the hook under the near eye
rune([[[-2.6, 30.1], [-2.6, 31.3]], [[-2.6, 31.3], [-3, 31.8], [-2.6, 32.3], [-2.2, 31.8], [-2.6, 31.3]],
      [[-3.7, 30.3], [-3.6, 31.6]], [[-1, 30.9], [-0.3, 31.1], [0.3, 31.9]], [[-1.2, 29.3], [0, 29.6], [0.6, 30], [0.6, 29.2]]],
     0.17, -8.3) headShape(0.15);
// horns: up out of the mane, bowing outward
mirror_x() chain([[2.6, -9.8, 33.3], [4.4, -9.8, 35.5], [5, -9.2, 37.8], [4.6, -8.6, 40]], [1.1, 0.9, 0.6, 0.15], HORN);

// ---------------- greatsword (right hand): traced from the front sheet, standing in the picture plane ----------------
GS_DEPTH = -4.2;   // picture depth of the right hand
GS_BLADE = [[-24.1, 2.7], [-22.6, 5.5], [-21.2, 6.6], [-20, 8.1], [-17.6, 10.9], [-17, 10.6], [-15.1, 13.5], [-12, 16.1],
            [-10.6, 17], [-9.6, 16.4], [-8.3, 13.2], [-7.9, 11.7], [-9.9, 10.5], [-11, 9.8], [-13.6, 7.3], [-16.5, 5.3],
            [-17.2, 5.4], [-19.3, 3.3], [-22, 2.3]];
GS_BEVEL = [[-23.5, 3.3], [-20, 7.3], [-17.6, 10], [-15.1, 12.6], [-12, 15.2], [-11, 15.6], [-11.4, 14.6], [-15.3, 11.3],
            [-20.2, 6], [-23.3, 2.9]];
ppS(GS_DEPTH) {
  plate(GS_BLADE, 0.8, 0.2, RUST);
  plate(GS_BEVEL, 0.95, 0.2, BLADE, grow = 0.2);
  for (r = [[-14, 9.6, 1.1], [-19.5, 5.2, 0.9], [-11.5, 12.6, 0.8]]) color(BLADE_DARK) translate([r[0], 0, r[1]]) scale([r[2] * 1.5, 0.5, r[2]]) sphere(1, $fn = 10);
  limb([-10.9, 0, 18.6], [-6.7, 0, 11.5], 0.55, 0.55, GUARD);          // crossguard
  limb([-8.8, 0, 15], [-1.9, 0, 19.6], 0.55, 0.5, GRIP);              // the long two-hand grip
  el([0.85, 0.85, 0.85], [-1.6, 0, 19.8], GUARD);                     // pommel
  plate(GS_BLADE, 0.4, 0.2, AURA_RIM, grow = 0.75);   // thin dark-red glow edge, inside the blade but for its rim
}

// ---------------- katana (left hand) ----------------
KT_H = [14, -5.4, 14.6];
KT_D = [-16.3, -4.6, -11.9];
along(KT_H, KT_D, VIEWN) {
  flat([[1, -0.5], [19.4, -0.45], [20.7, 0.45], [19, 0.6], [1, 0.6]], 0.35, KBLADE);
  flat([[1, -0.78], [19.4, -0.72], [20.6, 0.3], [20.1, 0.3], [19.2, -0.3], [1, -0.38]], 0.42, KEDGE);
  el([0.25, 1.1, 1.1], [0.8, 0, 0], ARMOR);
  limb([0.6, 0, 0], [-5.4, 0, 0], 0.42, 0.42, KHILT);
  el([0.5, 0.5, 0.5], [-5.6, 0, 0], ARMOR);
}

// ---------------- wings: bat wings folded up behind the shoulders ----------------
// Charcoal bone arm and three finger bones over a scalloped membrane: dark, dull red only towards the body.
WING_PTS = [[8.8, 28.5], [9.5, 31.5], [10.3, 34.5], [10.7, 36], [11.8, 35.2], [14, 34.7], [18.2, 32.2], [21.8, 29.3],
            [23.3, 25.4], [22.3, 26.7], [21, 27.7], [19.5, 27.6], [18.2, 26], [17.2, 27.5], [16, 28], [15, 27.4],
            [14.3, 25.6], [13.4, 27], [12.1, 27.6], [11, 27.2], [10.4, 26.5]];
WING_RED = [[9.7, 29], [10.6, 33.2], [12.8, 32.4], [15.4, 30.4], [16.8, 28.3], [16, 28], [15, 27.4], [14.3, 25.6],
            [13.4, 27], [12.1, 27.6], [11, 27.2], [10.4, 26.8]];
WING_FINGERS = [[18.2, 26], [14.3, 25.6]];
module wing() {
  limb([2.5, 1.5, 27], [5, 3.8, 30.5], 1.1, 0.7, BONE);
  translate([5, 3.8, 0]) rotate([0, 0, 15]) scale([1.035, 1, 1]) translate([0, 0, 30.5]) scale(0.85) translate([-9.5, 0, -28.5]) {
    plate(WING_PTS, 0.6, 0.15, MEMB_DARK);
    plate(WING_RED, 0.75, 0.3, MEMB, grow = 0);
    limb([9.2, 0, 28.6], [11, 0, 34.8], 0.7, 0.5, BONE);
    chain([[11, 0, 34.8], [21.8, 0, 29.3], [23.3, 0, 25.4]], [0.5, 0.36, 0.18], BONE);
    for (t = WING_FINGERS) limb([11, 0, 34.8], [t[0], 0, t[1]], 0.42, 0.16, BONE);
    spike([10.9, 0, 35.2], [-0.3, 0, 1.3], 0.42, 0.05, BONE);
  }
}
mirror_x() wing();

// ---------------- devil tail ----------------
TAIL = [[0, 5, 12.5], [7.5, 7, 9], [10.4, 8, 6.6], [14.1, 8, 7.8], [15.3, 7, 10.8], [14.8, 6, 13.6], [15.8, 6, 16.2], [17.4, 6, 16.8]];
chain(TAIL, [1.3, 1, 0.85, 0.75, 0.65, 0.55, 0.5, 0.45], FUR);
ppS(-3.5) plate([[20.4, 16.6], [20.9, 18.6], [22.6, 17.9], [25, 17.9], [22.7, 16.9], [21.6, 14.9], [21.2, 16.3]], 1, 0.2, FUR);
