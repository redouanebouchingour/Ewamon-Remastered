// Abysspark: the deep-sea apex of the Glimfin line, drawn side-on as a long, low navy anglerfish-shark.
//
// Checklist (front sheet, 60.7 x 40 units; sheet x, z):
//   body plan  a long shark body, snout at x -20.5 (z 21), deepest at x -8..0 (z 11..32), tapering to the tail root
//              at x 17 (z 16..19); the art is side-on, so the whole fish turns YAW = -35 (head to its right) and is
//              built in its own frame F(): u across (+u its left, towards the viewer), v along (+v to the tail).
//   head       a shark snout overhanging a wide open gape (x -18..-11, z 15..20): white teeth down from the snout,
//              white teeth up from the lower jaw, a long white lower-jaw band back to x -4.5, red gums, a dark throat
//   eye        small and fierce, white with a yellow fleck, at (-13.4, 25), under a light-blue brow ridge running
//              from the snout (-20, 21) up to the crest (-7, 31)
//   crest      three big swept-back dorsal spikes (tips (7.2, 39.6), (13.3, 34), (16.1, 28.8)) and a small fourth,
//              a teal streak on the first
//   lure       a thin stalk from the head top (-8, 31) arching up to z 40 and down to a pale glowing bulb at
//              (-23.8, 30.2) r 2, wrapped in a spray of yellow lightning (x -30..-17, z 23.5..36.5)
//   fins       the near pectoral hangs down and back from the flank to ragged tips (22.7, 3.8), (15.5, 0), (8, 1.3),
//              (3.9, 3.3) with a big yellow lightning bolt; throat fins sweep forward-down to (-25.5, 5.8); a ragged
//              belly fringe (-8.6, 6.6) .. (1.7, 8.5); a forked shark tail, upper lobe to (30.2, 26), lower to
//              (26.1, 11), each with a yellow stripe
//   markings   jagged yellow lightning stripes and teal streaks on the flanks and fins
//   back       the pectorals spread like wings with cyan spots on the trailing edge, gold spikes in two rows down the
//              back and on the tail, the bulb glowing
include <lib.scad>

YAW = -35;

navy = [0.07, 0.16, 0.39];
navyHi = [0.14, 0.29, 0.58];
yellow = [0.95, 0.85, 0.16, NOGLOW];
teal = [0.35, 0.84, 0.72, NOGLOW];
cyan = [0.28, 0.92, 0.97, NOGLOW];
pearl = [0.86, 0.9, 0.9];
gum = [0.62, 0.07, 0.11];
throat = [0.03, 0.03, 0.09];
iris = [0.95, 0.85, 0.16, NOGLOW];
bulb = [0.99, 0.98, 0.86, GLOW];
spark = [0.98, 0.95, 0.32, GLOW];

// The fish's own frame: sheet point (sx, zs) at depth u (across the fish) -> [u, v, z] in F().
function L(sx, zs, u = 0) = let(v = (sx - 0.42262 * u) / 0.90631) [u, v, zs + 0.1574 * u - 0.0734 * v];
module F() rotate([0, 0, YAW]) children();
// Inside F(): children authored in sheet coordinates (x = sheet x, z = sheet z, y = thickness) stood in the plane
// u = u0 (parallel to the fish's midplane), so traced outlines land 1:1 on the sheet.
module side(u0 = 0) multmatrix([[0, -1, 0, u0], [1.10338, 0, 0, -0.46631 * u0], [-0.08099, 0, 1, 0.19163 * u0], [0, 0, 0, 1]]) children();
// Inside F(): a part on the near flank and its mirror on the far one.
module both() { children(); mirror([1, 0, 0]) children(); }

// ---- body: sections [sheet x, sheet z, half-width, half-length, half-height], hulled pairwise
BODY = [[-19.8, 20.9, 2.2, 1.2, 1.7], [-15, 24.1, 4.3, 3, 4.7], [-8, 22.4, 6, 4, 9], [0, 20, 6.4, 4, 9],
        [6, 18.4, 5.4, 3, 7.2], [11, 17.6, 3.3, 2, 4], [15, 17.4, 2, 1.5, 2.3], [17.6, 17.8, 1.3, 1, 1.6]];
JAW = [[-17.6, 15.8, 2.4, 1.3, 1.5], [-10, 14.6, 4.6, 2.5, 2.6]];
module sec(s, g = 0) translate(L(s[0], s[1])) scale([s[2] + g, s[3] + g, s[4] + g]) sphere(1, $fn = 28);
module bodyShape(g = 0) {
  for (i = [0 : len(BODY) - 2]) hull() { sec(BODY[i], g); sec(BODY[i + 1], g); }
  hull() { sec(JAW[0], g); sec(JAW[1], g); }
  hull() { sec(JAW[1], g); sec(BODY[2], g); }
}
color(navy) F() bodyShape();

// ---- painted markings on the flanks: the near-side patch cut out of the grown body by the sheet outline, then
// mirrored onto the far flank
module nearHalf() intersection() { children(); translate([0, -60, -10]) cube([30, 120, 70]); }
module paint(pts, c) {
  color(c) intersection() { F() nearHalf() bodyShape(0.22); prism(pts); }
  color(c) F() mirror([1, 0, 0]) rotate([0, 0, -YAW]) intersection() { F() nearHalf() bodyShape(0.22); prism(pts); }
}
// the long white lower-jaw band (teeth line) back to the cheek
paint([[-17.4, 16.4], [-16.6, 18.9], [-15.2, 17.6], [-13, 18.3], [-11, 18.9], [-9, 18.5], [-6.5, 19], [-4.2, 18],
       [-6, 16.6], [-9, 15.6], [-12.5, 14.7], [-15.6, 14.6]], pearl);
// yellow lightning on the flanks
paint([[-3.3, 25.7], [-3.3, 24.1], [-2.5, 23.8], [-5.8, 21.6], [-6.1, 22.1], [-5.3, 22.7], [-5.5, 23.2], [-4.2, 25.2]], yellow);
paint([[6.9, 23.5], [7.8, 22.9], [7.8, 21.8], [8.6, 21.3], [9.2, 19.9], [7.8, 20.5], [6.1, 22.1], [5.3, 21.8], [5.3, 22.7], [6.7, 22.1]], yellow);
paint([[5, 30.7], [5, 29.6], [4.2, 29], [6.7, 27.7], [5.3, 27.4], [4.7, 26.6], [3.6, 27.7], [2.2, 27.9], [3.3, 28.5], [4.7, 30.4]], yellow);
paint([[-0.8, 31.8], [-0.3, 31.5], [-1.4, 30.2], [-3.6, 29.3], [-4.2, 29.6], [-2.2, 31], [-2.5, 31.3]], yellow);
paint([[-13.6, 22.9], [-12.2, 22.7], [-12.6, 21.5], [-13.4, 21.6]], yellow);
paint([[11.5, 16.5], [13.5, 18.2], [14.6, 17.8], [12.5, 15.8]], yellow);
// teal streaks
paint([[3.6, 23.2], [5, 25.6], [6.4, 25.2], [5, 22.8]], teal);
paint([[10.6, 19.2], [11.6, 21.3], [12.6, 20.8], [11.6, 18.8]], teal);
paint([[-2.4, 13.2], [-0.2, 14.8], [0.4, 14], [-1.8, 12.6]], teal);
paint([[-9, 27.6], [-7.4, 29.8], [-6.6, 29.2], [-8.2, 27.2]], teal);

// ---- face
// brow ridge: a light-blue band from the snout up to the crest, and a short ledge hooding the eye
paint([[-20.8, 20.4], [-20.2, 22.6], [-13.8, 27.8], [-7.6, 32.2], [-5.4, 31.4], [-12.2, 25.9], [-19.2, 20.4]], navyHi);
F() both() color(navyHi) hull() {
  translate(L(-15.6, 26.2, 3.2)) scale([0.6, 1, 0.45]) sphere(1, $fn = 12);
  translate(L(-11.8, 28, 3.4)) scale([0.7, 1.2, 0.5]) sphere(1, $fn = 12);
}
// small fierce eyes: pale with a yellow iris and a slit, hooded by the ridge
F() both() eye(L(-13.4, 25.3, 3.8), 1.5, iris = iris, sclera = pearl, pupil = throat, yaw = 58, lid = 0.38,
                lid_tilt = 22, lid_c = navy, slit = 0.4, shine = true);
// the gape: a dark throat and red gums between the jaws
color(throat) F() translate(L(-12.5, 18.2)) scale([3.1, 4, 1.5]) sphere(1, $fn = 20);
color(gum) F() translate(L(-14.4, 17.6)) scale([2.6, 3.2, 1.2]) sphere(1, $fn = 16);
// teeth: a row down from the snout, a row up from the lower jaw
F() both() for (t = [0 : 0.25 : 1]) {
  spike(L(-19.2 + 7 * t, 19.5 + 0.2 * t, 1.1 + 2.6 * t), [0, 0, -1.6 + 0.4 * t], 0.5, 0.05, pearl);
  spike(L(-17.6 + 7.4 * t, 16.9 + 0.3 * t, 1.6 + 2.5 * t), [0, 0, 1.5 - 0.3 * t], 0.48, 0.05, pearl);
}

// ---- dorsal crest: four swept-back spikes in the midplane, pillows a couple of units thick
CREST = [[[-8.5, 29.5], [-6.4, 32.6], [-1, 36.4], [7.2, 39.6], [2.6, 34.2], [3.4, 30.5], [-2, 28.6]],
         [[2.2, 30.6], [4.2, 32.2], [9, 33.4], [13.3, 34], [8.6, 29.6], [6.4, 26.8]],
         [[6.4, 26.2], [8.6, 29.3], [12.4, 29.2], [16.1, 28.8], [10.6, 24.4], [8.6, 23.6]],
         [[9.8, 21.4], [11, 22.8], [13, 22.2], [12.8, 20.6]]];
CREST_D = [2.6, 2.2, 2, 1.4];
F() side(0) {
  for (i = [0 : 3]) slab(CREST[i], CREST_D[i], navy, inset = 1);
  color(teal) intersection() { slab(CREST[0], CREST_D[0] + 0.3, inset = 1, grow = 0.3);
    plate([[1.7, 36.8], [-0.8, 32.1], [-1.7, 31.8], [-1.1, 33.8], [1.4, 36.5]], 10, 0.1); }
}
// gold spikes in two rows down the back (the back art's big yellow spines) and on the tail root
F() both() {
  for (s = [[-4, 29.8, 2.4, 4.4], [1.5, 27.6, 2.6, 4.2], [6.5, 24.6, 2.4, 3.8], [10.8, 21.3, 1.8, 3.2]])
    spike(L(s[0], s[1], s[2]), [1.4, 3, 1.9] * s[3] / 3.8, 1.15, 0.08, yellow);
  for (s = [[13.2, 18.6, 1.4], [15.8, 18.4, 0.9]]) spike(L(s[0], s[1], s[2]), [1.3, 2.8, 1.2], 0.75, 0.06, yellow);
}

// ---- tail: a forked shark tail, both lobes pillows with a yellow stripe painted through on both faces
TAIL_UP = [[14.6, 19.2], [20, 21.8], [30.2, 26.4], [26.4, 21], [22.8, 15.6], [15.6, 15.4]];
TAIL_LO = [[15.6, 16.2], [21.6, 15.6], [26.1, 10.8], [21, 11.8], [16.4, 13]];
F() side(0) {
  slab(TAIL_UP, 2.4, navy, inset = 1.2);
  slab(TAIL_LO, 2, navy, inset = 1);
  color(yellow) intersection() { slab(TAIL_UP, 2.7, inset = 1.2, grow = 0.6);
    plate([[28.8, 26.6], [29.7, 26.3], [28.8, 25.2], [26.9, 24.3], [25.2, 22.4], [21.9, 20.2], [21.9, 19.3], [23, 19.3],
           [22.2, 18.5], [20.8, 19.1], [19.7, 18], [20.8, 20.5], [23.3, 23.2]], 10, 0.1); }
  color(yellow) intersection() { slab(TAIL_LO, 2.3, inset = 1, grow = 0.6);
    plate([[20.2, 13.2], [23, 12.7], [23.6, 11.9], [26.1, 11], [22.7, 11], [21.6, 12.4]], 10, 0.1); }
}

// ---- fins: outlines traced on the sheet, hung off a hinge line along the flank and swung out by `a` degrees
module hinged(u0, zh, a) F() both() translate([u0, 0, zh]) rotate([0, a, 0]) translate([-u0, 0, -zh]) side(u0) children();
PEC = [[-1.2, 17.6], [4, 18.6], [10, 17.2], [16, 12.7], [19.4, 9.9], [16.9, 8.2], [22.7, 3.8], [13.6, 4.9],
       [15.5, -0.1], [8, 4.6], [8, 1.3], [4.7, 4.6], [3.9, 3.3], [1.7, 8.5], [-1.4, 11.4]];
PEC_BOLT = [[3.9, 18], [8.6, 16.8], [7.5, 17.1], [5.5, 17.1], [6.9, 15.7], [8.3, 14.6], [9.7, 13.5], [8.3, 13.8], [7.8, 12.4],
            [9.7, 11.3], [10.3, 10.2], [12.2, 9.4], [12.2, 8.2], [6.9, 11.9], [6.7, 8.5], [4.2, 12.7], [4.2, 13.8], [6.4, 12.7],
            [6.9, 14.1], [5.3, 14.6], [3.6, 16.3]];
// pectorals: hung from the flank and swung out, the near one hanging down and back as drawn
hinged(4.6, 16.6, -36) {
  plate(PEC, 1.4, 0.3, navy, grow = 0.35);
  color(yellow) intersection() { plate(PEC, 1.7, 0.5); plate(PEC_BOLT, 10, 0.1); }
  color(teal) intersection() { plate(PEC, 1.7, 0.5); plate([[17.4, 10.4], [19.6, 11.6], [20.2, 10.8], [18, 9.8]], 10, 0.1); }
  for (p = [[21.4, 4.4], [14.8, 1.2], [8, 2.4], [4.4, 4.2]])
    color(cyan) intersection() { plate(PEC, 1.7, 0.5); translate([p[0], 0, p[1]]) rotate([90, 0, 0]) cylinder(h = 10, r = 1, center = true, $fn = 10); }
}
// throat fins: forward and down under the jaw
hinged(2.2, 14.4, -16) {
  plate([[-18.4, 15.6], [-25.5, 5.8], [-17.2, 10.5], [-15, 7.4], [-12.8, 11], [-11.1, 9.9], [-10.6, 13.6], [-14, 15]], 1.2, 0.4, navy);
  color(yellow) intersection() { plate([[-18.4, 15.6], [-25.5, 5.8], [-17.2, 10.5], [-15, 7.4], [-12.8, 11], [-11.1, 9.9], [-10.6, 13.6], [-14, 15]], 1.5, 0.4);
    plate([[-21.6, 10.4], [-19.2, 13.2], [-18.2, 12.6], [-20.6, 10]], 10, 0.1); }
}
// ---- the lure: a thin stalk arching up from the head top and down to a pale glowing bulb in a spray of lightning
STALK = [[-7.5, 30.5], [-8, 34.5], [-9.5, 37.8], [-12, 39.4], [-15, 39.5], [-18, 38.3], [-20.8, 36], [-22.8, 33.6], [-23.6, 32.2]];
F() chain([for (p = STALK) L(p[0], p[1])], [for (i = [0 : len(STALK) - 1]) 0.62 - i * 0.022], navy);
LURE = L(-23.8, 30.1);
F() {
  color(bulb) translate(LURE) sphere(1.95, $fn = 24);
  color(navy) translate(LURE + [0, 0.5, 1.6]) scale([0.9, 0.9, 0.6]) sphere(1, $fn = 12);
  // lightning bolts: zigzags radiating from the bulb, most in the sheet's plane, a few out to the sides
  for (b = [[0, 0, 160], [0, 0, 205], [0, 0, 120], [0, 0, 245], [0, 0, 320], [0, 0, 20], [0, 0, 75],
            [55, 0, 180], [-55, 0, 180], [60, 0, 60], [-60, 0, 290], [70, 0, 250]])
    translate(LURE) rotate([0, 0, 90 + b[0]]) rotate([0, -b[2], 0]) {
      // local +X is the bolt's direction: b[2] round the fish's v-z plane (0 = to the tail, 90 = up), b[0] out of it
      pts = [[1.6, 0, 0], [3.2, 0, 0.9], [4.4, 0, -0.5], [5.9, 0, 0.6], [7, 0, 0]];
      color(spark) for (i = [0 : 3]) hull() { translate(pts[i]) sphere(0.5 - i * 0.08, $fn = 8); translate(pts[i + 1]) sphere(0.42 - i * 0.09, $fn = 8); }
    }
}
