// Smellduck: a round lime-green duckling (head and body one egg), a pink scalloped shell crest on the crown, a big
// bulbous salmon-pink bill with a drool drip, sleepy half-lidded eyes, a thick teal leaf tail held at its left side,
// flat webbed feet.
//
// Checklist (sheet frame: height 40, feet z = 0, x = art centre; sheet x ~ 0.866 x + 0.5 y at the 30 deg camera):
//   body plan   one egg, belly + head merged (no neck), M0 green [0.60, 0.87, 0.31], sheet x -17..7.2, z 2.5..29.5;
//               flat bottom at z 2.5, belly widest z 8..12 (x -16..6.5), waist z 16.5 (x -14.6), cheeks z 22..25
//               (x -17..5.7), folded-wing bulge on the right flank z 17..20 (x 7.2)
//   tufts       two small green points on the crown: left x -13..-11.3 z 28.1..30.6, right x 1.7..5.7 z 26.7..29
//   crest       M1 pink [0.76, 0.17, 0.43] scallop fan, base on the crown z 27.6..28.8 (x -11.3..1.4), rim to z 39.9,
//               x -13..5.2; ~6 ribs radiating from the base centre, dark grooves [0.52, 0.15, 0.30]; tipped back
//   bill        lighter pink [0.91, 0.35, 0.45] bulb, sheet x -14.8..-5, z 15..24.7, flat tip; darker lower lip
//   drool       M4 mint [0.76, 0.93, 0.83] drip under the bill, x -12.1..-10.1, z 8.7..15.9 (bulb at the bottom)
//   eyes        sleepy slits: white slivers 4.5 wide 1.4 tall at z ~25.3, far eye sheet x -4.4..0.1, near x -13..-9;
//               tiny dark-red pupils, a dark lid line above; the face is turned ~10 deg towards the camera
//   tail        M2 teal [0.17, 0.51, 0.40] thick leaf at the creature's LEFT (+X), sheet x 3.5..17, z 1.6..17,
//               dark rim [0.18, 0.21, 0.18] on its far edge (x 14.5..17); back view: same leaf at scad x 3.5..13.9
//   feet        flat webbed, green with a mint web, left sheet x -17..-9 z 0..4.7, right x -1.2..6.5 z 0..2.5
//   markings    folded-wing crease lines (dark green) on the right flank z 14..27; nothing on the back
//   not made    the ground shadow under the feet; the back sprite's sideways-lying crest (a different drawing)
include <lib.scad>

green = [0.60, 0.87, 0.31];
greenDk = [0.28, 0.51, 0.04];
pink = [0.76, 0.17, 0.43];
pinkDk = [0.52, 0.15, 0.30];
bill = [0.91, 0.35, 0.45];
billDk = [0.65, 0.17, 0.37];
teal = [0.17, 0.51, 0.40];
rim = [0.18, 0.21, 0.18];
mint = [0.76, 0.93, 0.83];
pupil = [0.40, 0.08, 0.16];

// Picture plane: a part drawn at its sheet [x, z] sits in the plane the front camera sees face-on; `t` moves it away
// from the camera along the view direction, which keeps its sheet position.
module pp(t = 0) { translate([-0.5 * t, 0.866 * t, 0]) rotate([0, 0, 30]) children(); }

// ---- body: one egg turned from the art's own radius-per-height profile ([z, r]; the sheet's left edge measured from
// the body's centre line at sheet x -5.2): flat bottom, fat belly, the slight waist, the wide cheeks.
bx = -5.7;                     // body axis at the feet (sheet x -4.9); the egg leans 0.03/unit towards the bill
lean = -0.03;                  // so the cheeks (z 23) sit at sheet x -5.5 like the art
function ax(z) = bx + lean * z;   // the axis at height z
prof = [[1.8, 0], [2.2, 6.5], [2.6, 8.4], [3.5, 9.6], [5, 10.4], [7, 10.8], [10, 10.9], [12, 10.8], [14, 10.3],
        [16, 9.7], [17.5, 9.7], [19, 10.1], [21, 10.9], [23, 11.3], [25, 11.2], [26.5, 10.6], [27.5, 9.6],
        [28.5, 8], [29.3, 5.5], [29.8, 2.5], [30, 0]];
color(green) multmatrix([[1, 0, lean, bx], [0, 1, 0, 0], [0, 0, 1, 0]]) rotate_extrude($fn = 44) polygon([for (p = prof) [p[1], p[0]]]);

// A point on the body's surface that the front camera sees at sheet [u, z], pushed `out` units off the surface.
function surf(u, z, out = 0.25) =
  let(R = lookup(z, prof) + out,
      du = min(u - 0.866 * ax(z), R - 0.05),
      v = -sqrt(max(0, R * R - du * du)))
  [ax(z) + 0.866 * du - 0.5 * v, 0.5 * du + 0.866 * v, z];

// folded wing on the right flank: the bulge at the silhouette (art x 7.2 at z 17..20) and the dark crease lines
translate(surf(5.0, 18.5, 0)) rotate([0, 0, 30]) color(green) scale([2.0, 3.6, 5.4]) sphere(1, $fn = 16);
chain([surf(2.9, 26.8), surf(3.9, 23), surf(4.4, 19), surf(4.4, 16.3), surf(3.6, 14.5), surf(1.2, 14.2)],
      [0.3, 0.34, 0.36, 0.36, 0.34, 0.3], greenDk);
chain([surf(1.9, 20.4), surf(3.6, 19.8)], [0.3, 0.3], greenDk);

// ---- tufts on the crown
spike([ax(27.4) - 8.3, -1, 27.4], [-1.1, 0, 3], 1.4, 0.15, green);
spike([ax(26.9) + 10.3, -1.5, 26.9], [1.1, 0, 2.8], 1.3, 0.15, green);

// ---- face (turned 10 deg towards the camera about the head's axis)
hx = ax(22);
translate([hx, 0, 0]) rotate([0, 0, 10]) translate([-hx, 0, 0]) {
  // bill: a bulb from inside the head to a flat-ish tip
  color(bill) hull() {
    translate([hx, -7.5, 20.8]) scale([5.2, 4.5, 4.7]) sphere(1, $fn = 24);
    translate([hx, -14.2, 19.8]) scale([5.0, 3.6, 4.5]) sphere(1, $fn = 24);
  }
  // darker lower lip at the tip
  color(billDk) translate([hx, -15.1, 17.3]) scale([4.4, 2.4, 1.9]) sphere(1, $fn = 20);
  // drool drip hanging from the bill's underside, on the creature's right
  limb([hx - 1.9, -14.6, 16], [hx - 1.9, -14.6, 11.2], 0.5, 0.7, mint);
  ell([1.05, 1.0, 1.6], [hx - 1.9, -14.6, 10.2], mint);
  // sleepy eyes: a white sliver under a straight dark lid line, a small pupil near its outer end
  for (s = [-1, 1]) {
    a = 28 * s;
    R = lookup(25.3, prof) - 0.4;
    p = [ax(25.3) + R * sin(a), -R * cos(a), 25.3];
    translate(p) rotate([0, 0, a]) {
      color(mint) scale([2.3, 0.9, 0.8]) sphere(1, $fn = 16);
      color(greenDk) translate([0, -0.2, 0.75]) scale([2.5, 0.8, 0.32]) sphere(1, $fn = 12);
      color(pupil) translate([s * 1.1, -0.75, -0.05]) scale([0.5, 0.45, 0.5]) sphere(1, $fn = 10);
    }
  }
}

// ---- crest: a scallop shell standing on the crown in the picture plane, tipped back a little
crestPts = [[-7.5, 39.9], [-2.6, 39.9], [-0.4, 39.2], [0.8, 38.3], [1.9, 38.3], [4.1, 35.9], [3.6, 35], [4.7, 34.8],
            [4.7, 33.9], [5.2, 33], [4.7, 31], [3.6, 30.6], [2.7, 30.5], [1.4, 28.8], [-0.2, 28.3], [-0.4, 27.7],
            [-6.6, 27.6], [-7, 28.3], [-11.3, 28.3], [-11.3, 29.4], [-12.1, 29.6], [-12.4, 31], [-13, 32.3],
            [-13, 34.8], [-12.4, 35], [-12.1, 36.5], [-10.4, 37], [-9.7, 38.3], [-8.6, 39.2], [-7.7, 39.2]];
pp(3.7) translate([0, 0, 28]) rotate([-12, 0, 0]) translate([0, 0, -28]) {
  slab(crestPts, 4, pinkDk, 1.2);
  // ribs radiating from the base centre, their rounded tips scalloping the rim
  for (a = [22, 49, 76, 104, 131, 158]) {
    tip = [-4.2 + 6.6 * cos(a), -0.4, 28.5 + 8.4 * sin(a)];
    limb([-4.2, -0.4, 28.8], tip, 1.1, 2.6, pink);
  }
}

// ---- tail: a thick teal leaf held out at the creature's left, in the picture plane, rooted in the flank
tailPts = [[3.5, 5.6], [4.3, 9], [5, 13.4], [8.5, 14.7], [9, 16.1], [12.5, 17], [14.3, 16.5], [16.6, 13.2],
           [17, 11.2], [15.2, 5], [14.5, 5.4], [11.7, 2.5], [9, 1.6], [6.1, 3.4]];
pp(3) {
  slab(tailPts, 5, teal, 1.5);
  // the dark rim the art draws along its far edge: the outline shifted outwards, clipped to the outline
  color(rim) rotate([90, 0, 0]) linear_extrude(height = 1.2, center = true) intersection() {
    polygon(tailPts);
    translate([1.4, -0.3]) polygon(tailPts);
  }
}

// ---- feet: flat webbed triangles pointing forward (heel under the body, three toe tips), green with a mint web
module foot(c, z) {
  color(c) hull() {
    translate([0, 1.5, z]) scale([2.4, 2.2, z]) sphere(1, $fn = 14);
    for (a = [-34, 0, 34]) translate([sin(a) * 3.4, -1 - cos(a) * 4.6, z * 0.8]) scale([1.0, 1.0, z * 0.8]) sphere(1, $fn = 10);
  }
}
for (x = [bx + 8.9, bx - 8.5]) translate([x, -1.5, 0]) {
  foot(green, 1.0);
  translate([0, -0.4, 0.75]) scale([0.86, 0.82, 1]) foot(mint, 0.95);
}
