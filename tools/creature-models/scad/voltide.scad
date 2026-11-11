// Voltide: Glimfin grown into a sleek electric anglerfish, drawn side-on facing the viewer's left.
//
// Checklist (front sheet, 85.1 x 40 units; sheet x, z):
//   body plan  a long fish: snout at x -25 (z 10..22), deepest at x -11 (z 5.5..28.5), tapering to the tail root at
//              x 22 (z 12..19). The art is side-on, so the whole fish turns YAW = -35 (as Abysspark) and is built in its
//              own frame F(): u across (+u its left, towards the viewer), v along (+v to the tail).
//   colours    a bright cyan head and front, a teal rear flank, dark blue fins, sail, stalk and jaw, a light-blue
//              belly band, yellow lightning patches
//   face       one big slanted almond eye at (-12.4, 15.2): gold with a pale yellow centre and a dark slit, sunk in a
//              navy socket band slanting up to the back (-18, 12) .. (-7.5, 21); a dark blue diagonal stripe from the
//              snout top (-19, 19) up to the stalk root (-12, 28.5)
//   jaw        a dark blue underbite jutting up in front of the snout (-27..-21, z 8..22), small pale teeth on the snout
//   lure       a thick dark blue stalk from the head top (-13.5, 27.5) arching up to z 34 at x -21 and down into a big
//              glowing yellow ball at (-35, 22.7) r 5.5 with a pale core, sparks all round it
//   sail       a big swept-back dorsal spike, tip (4.6, 39.8), a smaller second point at (5.6, 32.1)
//   pectoral   a long fin swept up and back across the flank from the gill (-4, 14.5) to two points (20.6, 33.2) and
//              (20.5, 26.6): dark blue with a light-blue leading edge, a cyan tip, a pale yellow patch and a yellow
//              lightning band
//   lower fins dark blue throat fins sweeping forward-down to (-22, 0); pelvic fins (cyan front, blue back) swept down
//              and back to (6.5, 1.5) and (13.3, 0.4); a ragged navy fringe under the rear body (x 9..21)
//   tail       three-pointed: the long upper lobe to (42.7, 34.4) with a white leading edge and cyan inside, a middle
//              point (38, 18.9), the lower lobe to (33.8, 6.2) in light cyan
//   markings   yellow bolts on the gill (-8..-2, 7..15) and the rear flank (11..18, 13..17)
//   back       (a different drawing) the round blue back with the pectorals spread like wings: the hinged pectorals
//              stand out from the body so they read as wings from behind
include <lib.scad>

YAW = -35;

cyan = [0.11, 0.82, 0.82, NOGLOW];
teal = [0.05, 0.45, 0.6];
cheek = [0.06, 0.52, 0.64];
belly = [0.3, 0.62, 0.86];
blue = [0.03, 0.27, 0.62];
blueHi = [0.1, 0.46, 0.84];
navy = [0.02, 0.13, 0.38];
socket = [0.02, 0.1, 0.3];
finCyan = [0.3, 0.8, 0.91, NOGLOW];
white = [0.94, 0.99, 0.96];
yellow = [0.99, 0.86, 0.08, NOGLOW];
paleY = [0.99, 0.98, 0.72, NOGLOW];
gold = [0.93, 0.68, 0.12, NOGLOW];
tooth = [0.92, 0.97, 0.95];
bulb = [1, 0.87, 0.1, GLOW];
core = [1, 0.99, 0.88, GLOW];
spark = [1, 0.88, 0.12, GLOW];

// The fish's own frame: sheet point (sx, zs) at depth u (across the fish) -> [u, v, z] in F().
function L(sx, zs, u = 0) = let(v = (sx - 0.42262 * u) / 0.90631) [u, v, zs + 0.1574 * u - 0.0734 * v];
module F() rotate([0, 0, YAW]) children();
// Inside F(): children authored in sheet coordinates (x = sheet x, z = sheet z, y = thickness) stood in the plane
// u = u0 (parallel to the fish's midplane), so traced outlines land 1:1 on the sheet.
module side(u0 = 0) multmatrix([[0, -1, 0, u0], [1.10338, 0, 0, -0.46631 * u0], [-0.08099, 0, 1, 0.19163 * u0], [0, 0, 0, 1]]) children();
// Inside F(): a part on the near flank and its mirror on the far one.
module both() { children(); mirror([1, 0, 0]) children(); }

// ---- body: sections [sheet x, sheet z, half-width, half-length, half-height], hulled pairwise
BODY = [[-23.6, 15.4, 2.6, 1.4, 5], [-19, 16.5, 5.6, 3, 8.8], [-11, 17, 7.6, 4.5, 11.4], [-2, 16.5, 7.4, 4, 10.4],
        [6, 16, 6, 3.5, 8.4], [13, 15.5, 4.2, 3, 6], [19, 15.5, 2.4, 2, 3.5], [22.5, 15.5, 1.5, 1.2, 2.3]];
module sec(s, g = 0) translate(L(s[0], s[1])) scale([s[2] + g, s[3] + g, s[4] + g]) sphere(1, $fn = 28);
module bodyShape(g = 0) for (i = [0 : len(BODY) - 2]) hull() { sec(BODY[i], g); sec(BODY[i + 1], g); }
color(cyan) F() bodyShape();

// ---- painted markings: the near-side patch cut out of the grown body by the sheet outline, then mirrored
module nearHalf() intersection() { children(); translate([0, -60, -10]) cube([30, 120, 70]); }
module paint(pts, c, g = 0.22) {
  color(c) intersection() { F() nearHalf() bodyShape(g); prism(pts); }
  color(c) F() mirror([1, 0, 0]) rotate([0, 0, -YAW]) intersection() { F() nearHalf() bodyShape(g); prism(pts); }
}
// teal rear flank (under the pectoral, back to the tail root)
paint([[-1, 12], [2, 14.5], [7, 16], [12, 17.5], [17, 19.8], [21, 19.4], [24, 17], [24, 12.5], [20, 11.5], [16, 10.2],
       [11, 9.2], [6, 8.8], [2, 9.6]], teal);
// darker cheek under the eye and the light-blue belly band
paint([[-21.5, 9.6], [-17, 11.2], [-13.5, 12.2], [-10, 14], [-7, 15.6], [-3.5, 16.6], [-2, 13], [-3, 8.2], [-8, 7.4],
       [-14, 7.9], [-19.5, 8.5]], cheek);
paint([[-21, 8.9], [-14, 7.8], [-8, 7.2], [-3, 7.6], [0, 6.4], [-4, 4.4], [-9, 4.6], [-14, 5.6], [-19.5, 6.8]], belly);
// the dark blue stripe from the snout top up to the stalk root, and the eye socket band
paint([[-19, 18.6], [-17, 18.6], [-14.5, 22.8], [-11.2, 27], [-11, 29], [-14.6, 29.2], [-17.6, 25.2], [-19.2, 21.6]], blue);
paint([[-18.2, 12.2], [-16, 11.3], [-13, 10.9], [-10.4, 12.3], [-8.7, 15], [-7.2, 18.5], [-7, 21.2], [-9, 20.9],
       [-11.2, 19.3], [-13.6, 18.1], [-15.6, 15.7], [-17.2, 13.9]], socket);
// yellow lightning on the gill and the rear flank
paint([[-2.6, 14.7], [-1.8, 13.5], [-2.9, 13.5], [-4.1, 12], [-5.3, 11.6], [-3.3, 10.8], [-2.6, 9.7], [-4.9, 8.5],
       [-6.4, 7.7], [-7.6, 7.3], [-8.4, 7.3], [-7.6, 9.3], [-5.7, 10.4], [-7.2, 11.6], [-4.5, 12.8], [-3.7, 14.3]], yellow);
paint([[14.8, 17], [15.2, 15.5], [18.3, 15.5], [16, 13.5], [12.9, 13.9], [12.1, 13.1], [11.4, 13.9], [12.5, 15.5],
       [13.7, 15.5]], yellow);

// ---- face: a big slanted almond eye, gold with a pale centre and a slit, hooded by the socket colour
F() both() eye(L(-12.4, 15.2, 6.5), 2.6, iris = paleY, sclera = gold, pupil = socket, yaw = 70, lid = 0.22,
               lid_tilt = 28, lid_c = socket, squint = 0.2, slit = 0.4, shine = true);
// small pale teeth along the snout's front, over the jaw
F() both() for (t = [[-21.8, 19.2, 1.6], [-23.4, 16.8, 1.4], [-23.9, 14.2, 1.3]])
  spike(L(t[0], t[1], t[2]), [0, -1.2, -0.7], 0.5, 0.05, tooth);

// ---- the jaw: a dark blue underbite rising in front of the snout
JAW = [[-20.5, 8.2, 3, 1.6], [-24, 9.6, 2.6, 1.5], [-25.9, 12.6, 2.1, 1.3], [-26.3, 16.5, 1.7, 1.1], [-26.2, 20, 1.3, 0.9],
       [-25.7, 21.6, 0.9, 0.6]];
color(blue) F() for (i = [0 : len(JAW) - 2]) hull() for (j = [i, i + 1])
  translate(L(JAW[j][0], JAW[j][1])) scale([JAW[j][2], JAW[j][3], JAW[j][3]]) sphere(1, $fn = 16);

// ---- the sail: a big swept-back dorsal spike with a second smaller point, a pillow in the midplane
SAIL = [[-14, 26], [-12, 28.6], [-8, 31.6], [-5.3, 35.6], [-1, 37.6], [3.2, 39.4], [4.8, 39.8], [0.3, 32.5], [-1, 27],
        [-8, 25]];
SAIL2 = [[-1, 29], [0.3, 32.5], [5.6, 32.1], [2.9, 27.4], [0, 25.5]];
F() side(0) {
  slab(SAIL, 3, blue, inset = 1.1);
  slab(SAIL2, 2.4, blue, inset = 0.8);
  color(blueHi) intersection() { slab(SAIL, 3.3, inset = 1.1, grow = 0.3);
    plate([[-6, 33.5], [-1, 36.2], [3.4, 38.6], [0.6, 35], [-4, 33]], 10, 0.1); }
}

// ---- the rear fringe under the body
VENT = [[[8, 9.6], [9.5, 7.2], [13, 7.6], [13, 11.5]], [[12, 11.5], [13, 7.6], [14.4, 6.6], [15.5, 11.8]],
        [[14, 11.6], [13.9, 8.6], [17.5, 8.1], [18, 12.5]], [[17, 12.5], [17.2, 10.6], [19.5, 11.5], [21.4, 12.8], [19, 14]]];
F() side(0) for (v = VENT) slab(v, 1.6, navy, inset = 0.4);

// ---- the tail: three points, a pillow with the cyan inside, the white leading edge and the light cyan lower lobe
TAIL = [[[18.5, 18.8], [24, 23.5], [29.5, 29.4], [36, 32.5], [42.7, 34.4], [41, 33], [37.5, 27.5], [32.6, 18.6], [28, 15],
         [21, 14.5]],
        [[27, 17], [32.6, 18.6], [38, 18.9], [34.5, 14.3], [29.1, 12], [25, 13.5]],
        [[20, 12.4], [24.5, 7.3], [28.7, 5.8], [33.8, 6.2], [30.3, 8.5], [29.1, 12], [24, 14.5]]];
TAIL_D = [2.6, 2.2, 2.2];
module tailShape(g = 0, c) for (i = [0 : 2]) slab(TAIL[i], TAIL_D[i] + 2 * g, c, inset = 1, grow = 0.45 + g);
F() side(0) {
  tailShape(0, finCyan);
  color(blueHi) intersection() { tailShape(0.2);
    plate([[18.5, 19], [24, 23.6], [29.5, 28.5], [33, 29], [30, 24], [29, 19], [27.5, 15], [29, 12], [24, 12.5], [20, 12.4]],
          10, 0.1); }
  color(blue) intersection() { tailShape(0.3);
    plate([[18.5, 19], [22, 21.5], [24.5, 18], [24, 13], [20, 12.4]], 10, 0.1); }
  color(finCyan) intersection() { tailShape(0.2);
    plate([[36.1, 30.1], [38, 30.1], [36.5, 27.4], [36.5, 25.1], [34.5, 22.4], [33, 21.3], [31.8, 19.7], [34.5, 17],
           [36.1, 17.8], [36.1, 16.6], [32.6, 13.9], [27.6, 12.8], [28.7, 15.5], [27.2, 17], [30.3, 21.3], [31.8, 24],
           [32.2, 26.7], [35.7, 29.8]], 10, 0.1);
    plate([[26.4, 12], [28, 11.2], [29.5, 10.4], [29.9, 8.5], [31.8, 7.3], [31.4, 6.2], [27.2, 6.6], [24.5, 7.7],
           [21.8, 9.7], [22.6, 10.8], [24.9, 9.3], [26, 9.7]], 10, 0.1); }
  color(white) intersection() { tailShape(0.2);
    plate([[38, 33.6], [40, 33.2], [42.7, 34.6], [38.4, 30.9], [36.9, 30.1], [33, 27.4], [29.5, 26.3], [26.4, 24],
           [24.9, 24.3], [27.6, 26.7], [29.9, 29.4], [33, 29.8], [35.7, 32.5], [37.6, 33.2]], 10, 0.1); }
}

// ---- fins: outlines traced on the sheet, hung off a hinge line along the flank and swung out by `a` degrees
module hinged(u0, zh, a) F() both() translate([u0, 0, zh]) rotate([0, a, 0]) translate([-u0, 0, -zh]) side(u0) children();
PEC = [[-4.6, 14.6], [-3.5, 16], [2, 21], [7.5, 26], [11, 29], [16, 31], [19.9, 33.4], [20.8, 33.4], [20.2, 30.1],
       [17.4, 27.2], [20.6, 26.8], [16.4, 21], [13, 17.4], [8, 14], [3, 12.8], [-2, 13.2]];
PEC_CYAN = [[7.5, 27.4], [9, 27.1], [11, 29], [14.4, 30.9], [16, 30.9], [17.9, 32.5], [19.9, 33.2], [20.6, 33.2],
            [20.2, 30.1], [16.8, 26.7], [15.6, 27.1], [14.4, 24.7], [11, 23.6], [12.9, 27.1], [11.7, 28.2], [10.2, 27.8],
            [8.6, 25.9]];
PEC_EDGE = [[-3.8, 15.6], [2, 20.6], [7.5, 25.6], [8.6, 25.2], [3, 19.6], [-2.6, 14.6]];
PEC_PALE = [[16.4, 25.9], [17.5, 25.5], [18.3, 24.3], [16.4, 22.4], [16, 20.9], [14.1, 19.7], [12.9, 18.6], [12.9, 20.1],
            [11, 19.7], [9, 21.6], [10.6, 22.4], [12.1, 24], [14.1, 24.7], [16, 25.5]];
PEC_BOLT = [[9.8, 17.4], [11.7, 17], [12.9, 19.7], [12.5, 18.6], [11.4, 18.2], [9.4, 19.7], [9, 18.6], [8.3, 17.4],
            [7.5, 18.2], [5.9, 17.4], [4.4, 17], [4.4, 15.1], [3.2, 13.9], [4.4, 13.1], [6.7, 13.5], [9, 14.3], [10.6, 15.8]];
// pectorals: rooted at the gill and swung out from the flank, so they stand off the body like the back art's wings
hinged(6.4, 15, 24) {
  plate(PEC, 1.6, 0.4, blue, grow = 0.4);
  color(finCyan) intersection() { plate(PEC, 1.9, 0.4, grow = 0.4); plate(PEC_CYAN, 10, 0.1); }
  color(belly) intersection() { plate(PEC, 1.9, 0.4, grow = 0.4); plate(PEC_EDGE, 10, 0.1); }
  color(paleY) intersection() { plate(PEC, 1.9, 0.4, grow = 0.4); plate(PEC_PALE, 10, 0.1); }
  color(yellow) intersection() { plate(PEC, 1.9, 0.4, grow = 0.4); plate(PEC_BOLT, 10, 0.1); }
}
// throat fins: forward and down under the jaw
THROAT = [[-4, 6], [-9, 5.2], [-12.5, 6], [-17.2, 1.5], [-21.1, 0], [-23, 0], [-22.7, 2.3], [-20.7, 3.9], [-19.2, 6.6],
          [-21.9, 7.3], [-23.6, 8.8], [-19, 9.2], [-14, 8.6], [-8, 7.8]];
hinged(3.6, 8, -18) plate(THROAT, 1.3, 0.4, navy);
// pelvic fins: swept down and back, cyan in front, blue behind
PELV = [[-2.5, 12.5], [3, 13], [8, 11], [10.5, 8], [13.3, 0.4], [10.5, 2.5], [8.5, 3.5], [6.5, 1.5], [4, 4.5], [1, 8],
        [-2.5, 10.5]];
hinged(5, 10, -22) {
  plate(PELV, 1.4, 0.4, blueHi);
  color(finCyan) intersection() { plate(PELV, 1.7, 0.4); plate([[-3, 13], [3.5, 13.4], [5, 9], [6.6, 1.2], [4, 4.5], [1, 8],
                                                                [-3, 10.5]], 10, 0.1); }
}

// ---- the lure: a thick stalk arching from the head top down into a big glowing ball wrapped in sparks
STALK = [[-13.5, 27], [-15, 30.8], [-17.6, 33.2], [-21, 34.3], [-24.6, 33.8], [-27.8, 32], [-30, 29.6], [-31.4, 27.6]];
F() chain([for (p = STALK) L(p[0], p[1])], [for (i = [0 : len(STALK) - 1]) 1.45 - i * 0.06], blue);
LURE = L(-35, 22.7);
F() {
  color(bulb) translate(LURE) sphere(5.4, $fn = 32);
  both() color(core) translate(LURE + [2.7, -0.6, 1]) scale([0.8, 1, 1]) sphere(3.2, $fn = 20);
}
// sparks: short zigzags pointing away from the ball, a few tipped out of the sheet's plane
SPARKS = [[-37.5, 31, 0], [-33.8, 33, 0], [-29.6, 36, 0], [-25.4, 26.6, 0], [-39.6, 15.6, 0], [-35.4, 12.6, 0],
          [-30.8, 15.2, 0], [-29, 11.6, 0], [-35, 30, 3], [-35, 15, -3], [-29.5, 24, 3], [-41, 24, -3]];
module zig(a, b, w, c) {
  d = b - a;
  n = [-d[1], d[0]] / norm(d) * w;
  pts = [a, a + d * 0.35 + n, a + d * 0.6 - n, b];
  color(c) for (i = [0 : 2]) hull() { translate(pts[i]) sphere(0.45, $fn = 8); translate(pts[i + 1]) sphere(0.38, $fn = 8); }
}
F() side(0) for (s = SPARKS) {
  dir = [s[0] + 35, s[1] - 22.7];
  a = [s[0], s[1]] - dir / norm(dir) * 1.2;
  b = [s[0], s[1]] + dir / norm(dir) * 1.6;
  translate([0, s[2], 0]) rotate([90, 0, 0]) zig(a, b, 0.7, spark);
}
