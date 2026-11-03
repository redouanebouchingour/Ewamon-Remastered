// Fennorange: a chibi fennec kit in a maroon fez with a green star, huge hooked ears (orange inside with an olive
// band, orange backs), big red sly eyes and a little smile, a green-and-red plaid scarf, hugging a big orange on its
// right side, an orange belly, and a bushy tail curling up behind it with an orange tip.
//
// Checklist (front sheet x, z; the art's midline sits at sheet x -1.5, so scad x = 0 maps there: OX below):
// - head: wide round fox head x -9.6..5.6, z 17.5..28.8, cream lower face z 18..22, cheek tufts at x -10.8 / 6.7, z 21.
// - eyes: near eye x -2.7..1.7, z 20.9..24 (wider than tall, flat dark upper lid = sly), far eye x -8.7..-6.4.
//   Red iris, dark pupil, white highlight up right, white sclera at the lower corners, dark ink rim.
// - muzzle: small, nose at (-6, 20.4), smile from under the nose to x -3.3, z 19.6 (a tick up at the end).
// - ears: near x 2.7..15, z 22.7..39.6 broad leaf, tip hooks inward at (10.8, 38.6); far x -13.1..-6, z 25..39.9.
//   Front: orange inner, olive band along the inner edge, tan rim. Back art: ears all orange.
// - fez: maroon x -5.8..3.1, z 27.4..35.3, green star at (-3.4, 30.5), dark tassel down its right side.
// - scarf: dark green plaid with red checks, z 15..18.5, one end flying off the near shoulder (x 3.5..7, z 14..17),
//   a long end down the back (back art x -1.5..1, z 11..17).
// - body: small, torso x -6..3.5, z 4..17; orange belly x -6.8..0.2, z 5.5..11.5.
// - arms: near arm across the chest z 12.5..16 to the fruit; far arm behind the fruit (back art x 6..10, z 10..14).
// - fruit: orange x -14.1..-5.5, z 9.6..19, green star calyx at (-12.5, 15), leaves on top pointing left.
// - legs: splayed, near thigh x 0..4.5, z 4..11, far x -8..-5; feet x -7.5..-4.8 and 2.4..5.1.
// - tail: plume x 5..15, z 5.9..20, tan below, orange top half with a flame edge, tip curling right at (15, 19).
include <lib.scad>

OX = 1.5;   // sheet x of the scad midline is -OX

fur = [0.84, 0.70, 0.40];
cream = [0.96, 0.86, 0.62];
orange = [0.96, 0.51, 0.07, NOGLOW];
orangeB = [0.90, 0.52, 0.20, NOGLOW];
orangeHi = [1, 0.62, 0.16, NOGLOW];
olive = [0.51, 0.52, 0.23];
green = [0.26, 0.38, 0.19];
leafC = [0.34, 0.5, 0.22];
maroon = [0.50, 0.10, 0.14];
maroonDk = [0.36, 0.05, 0.09];
ink = [0.12, 0.03, 0.01];
nose = [0.22, 0.09, 0.06];
iris = [0.72, 0.12, 0.12, NOGLOW];
scarfR = [0.62, 0.14, 0.12];

// Sheet outline -> pp() with the midline offset.
module ppS(d = 0) { pp(d) translate([OX, 0, 0]) children(); }
module prismS(pts) { ppS(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) polygon(pts); }

// ---- Head
ell([8, 6.4, 5.8], [0, -1, 23], fur);
// cream lower face and cheeks (shows where it pokes out of the head: below the eyes)
ell([7.5, 6.1, 3.6], [0, -1.4, 20.6], cream);
// cheek tufts
mirror_x() {
  spike([7.2, -1.8, 21.8], [1.8, -0.2, -0.5], 1.1, 0.1, fur);
  spike([7, -1.4, 20.6], [1.3, 0, -1.1], 0.9, 0.1, fur);
}
// small muzzle and nose
blob([[[2.6, 2.2, 2], [0, -5.6, 20.4]], [[1.5, 1.3, 1.2], [0, -8.1, 20.5]]], cream);
ell([0.8, 0.6, 0.55], [0, -9.35, 20.9], nose);
// sly smile: a short philtrum, a curve towards the near cheek with a tick up at the end
color(ink) {
  limb([0, -9.25, 20.3], [0, -9.05, 19.5], 0.16);
  limb([0, -9.05, 19.5], [1.3, -8.55, 19.2], 0.16);
  limb([1.3, -8.55, 19.2], [2.5, -7.75, 19.6], 0.16);
  limb([0, -9.05, 19.5], [-1, -8.75, 19.3], 0.16);
}
// eyes: wide, red, flat dark upper lid (the sly look), white highlight
EYE = [4.55, -6.0, 22.6]; ES = 1.6; EW = 1.3; EH = 0.95; EYAW = 16;
module kitEye() {
  translate(EYE) rotate([0, 0, EYAW]) scale([EW, 1, EH]) {
    color(ink) scale([1.12, 0.4, 1.22]) sphere(ES, $fn = 20);
    eye([0, 0, 0], ES, iris = iris, sclera = "white", pupil = ink, lid = 0.26, lid_tilt = 8, lid_c = ink,
        squint = 0, slit = 0.85, shine = true, flat = 0.5);
  }
}
mirror_x() kitEye();
// light brow marks over the eyes
mirror_x() petal([1, 0.3, 0.28], [4.2, -5.2, 25.3], [0, 18, 24], cream);

// ---- Ears: broad leaves facing the camera side, traced from the near ear (front sheet), mirrored for the far one
EAR = [[2.2, 27.5], [2.7, 30.4], [4.5, 32.2], [6.5, 33.5], [9, 34.8], [11.2, 35.6], [12, 37], [11, 38.3], [11.4, 39.2],
       [13.5, 38.9], [14.6, 37.5], [15, 35.5], [14.8, 33], [13.8, 30], [12.1, 26.6], [9.5, 24.6], [7, 23.2],
       [5.2, 23.5], [3.5, 25]];
EAR_IN = [[5.6, 26.5], [7.6, 29.5], [9.8, 32.2], [11.8, 34.6], [12.6, 36.8], [11.6, 38.4], [13.3, 38.4], [14.2, 37],
          [14.4, 34.5], [13.8, 31.5], [12.4, 28.5], [10.5, 26.5], [8, 25.4]];
EAR_BAND = [[4.4, 25.6], [5.2, 25.3], [6.5, 27.5], [8.5, 30.2], [10.8, 32.6], [12.3, 34.2], [12.2, 35.3],
            [10.5, 33.9], [8, 31.5], [5.8, 29.5], [4.3, 27.5]];
EA = [4.6, 0.6]; EA_SX = 2.78; EYAW_EAR = 22;
function earL(pts) = [for (p = pts) [p[0] - EA_SX, p[1]]];
module ear() {
  translate([EA[0], EA[1], 0]) rotate([0, 0, EYAW_EAR]) {
    plate(earL(EAR), 1.4, 0.4, fur, grow = 0);
    translate([0, 0.45, 0]) plate(earL(EAR), 0.8, 0.4, orangeB, grow = 0);
    translate([0, -0.75, 0]) plate(earL(EAR_BAND), 0.3, 0.3, olive, grow = 0.1);
    translate([0, -0.8, 0]) plate(earL(EAR_IN), 0.3, 0.4, orange, grow = 0);
  }
}
mirror_x() ear();

// ---- Fez, tipped a little, a green star on the front, a dark tassel down the near side
translate([0.2, 0.4, 27.2]) rotate([0, 6, 0]) {
  color(maroon) cylinder(h = 6.7, r1 = 4.8, r2 = 4.45, $fn = 32);
  color(maroonDk) translate([0, 0, 6.7]) scale([1, 1, 0.22]) sphere(4.4, $fn = 32);
  color(green) translate([0, -4.62, 3.4]) rotate([90 - 2, 0, 0]) linear_extrude(0.5, center = true)
    polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.35 : 0.55, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
}
color(ink) {
  limb([0.9, 0.4, 34.5], [4.4, 1.4, 33.6], 0.28);
  limb([4.4, 1.4, 33.6], [5.1, 1.8, 30.8], 0.3, 0.6);
}

// ---- Scarf: dark green plaid ring with red checks, an end off the near shoulder, a long end down the back
SC = [0, -0.2, 16.9]; SCR = [4.3, 4, 1.75];
ell(SCR, SC, green);
color(scarfR) intersection() {
  ell(SCR + [0.06, 0.06, 0.06], SC);
  union() {
    for (a = [0 : 30 : 330]) translate(SC) rotate([0, 0, a]) translate([-0.28, 0, -3]) cube([0.56, 6, 6]);
    translate(SC + [-6, -6, -0.22]) cube([12, 12, 0.44]);
  }
}
translate([5.3, -0.4, 15.4]) rotate([0, -30, 10]) {
  petal([1.25, 0.45, 2.3], [0, 0, 0], [0, 0, 0], green);
  petal([0.32, 0.5, 2.2], [0, 0, 0], [0, 0, 0], scarfR);
  petal([1.2, 0.5, 0.25], [0, 0, -0.9], [0, 0, 0], scarfR);
}
translate([0, 3.75, 13.6]) rotate([10, 0, 0]) {
  petal([1.25, 0.42, 3.4], [0, 0, 0], [0, 0, 0], green);
  petal([0.3, 0.48, 3.3], [0, 0, 0], [0, 0, 0], scarfR);
  for (dz = [-1.4, 0.6]) petal([1.2, 0.48, 0.25], [0, 0, dz], [0, 0, 0], scarfR);
}

// ---- Body: small egg torso, orange belly
TORSO = [[[4.7, 4.1, 4.6], [0, 0.4, 10.5]], [[3.3, 3, 2.8], [0, 0, 15.2]], [[3.9, 3.6, 3.6], [0, -1.1, 8.6]]];
BELLY = [[-7.2, 9], [-6.6, 11], [-4.8, 12.2], [-2.5, 12.4], [-0.1, 11.6], [0.8, 9], [0.2, 6.6], [-2, 5], [-4.6, 4.9],
         [-6.6, 6.6]];
blob(TORSO, fur);
color(orange) intersection() {
  blob([for (q = TORSO) [q[0] + [0.15, 0.15, 0.15], q[1]]]);
  prismS(BELLY);
  translate([-10, -10, 0]) cube([20, 10, 20]);
}

// ---- The fruit, hugged on the creature's right (-X), a green star calyx on the front, a stem and two leaves
FR = [-7.6, -2.6, 14.3];
ell([4.3, 4.1, 4.2], FR, orange);
ell([1.2, 0.5, 0.9], FR + [-0.4, -3.75, 1.7], orangeHi);
color(green) translate(FR + [-0.45, -0.89, 0.1] * 4.15) rotate([0, 0, -27]) rotate([90, 0, 0]) linear_extrude(0.4, center = true)
  polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.1 : 0.45, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
limb(FR + [0, 0, 3.9], FR + [-0.3, 0, 5], 0.3, 0.25, green);
petal([2.5, 0.3, 1.0], FR + [-2.5, 0.2, 4.9], [0, -12, -20], leafC);
petal([1.5, 0.28, 0.7], FR + [1.4, 0.4, 4.8], [0, 18, -20], leafC);

// ---- Arms: the near arm crosses the chest to the fruit, the far arm holds it from below and behind
limb([3.4, -0.5, 15.3], [3.1, -3.6, 13], 1.55, 1.45, fur);
limb([3.1, -3.6, 13], [-2.2, -4.7, 13.6], 1.45, 1.3, fur);
ell([1.4, 1.3, 1.2], [-2.8, -4.6, 13.7], cream);
limb([-3.4, -0.4, 15.2], [-5, -0.8, 12.4], 1.4, 1.2, fur);
limb([-5, -0.8, 12.4], [-5.8, -1.6, 10.9], 1.2, 1.1, fur);
ell([1.2, 1.2, 1.05], [-6.1, -1.9, 10.6], cream);

// ---- Legs: round haunches, short shins, splayed feet
mirror_x() {
  ell([2.8, 3.1, 3.4], [3.3, 0.6, 7.2], fur);
  limb([3.9, 0.4, 5], [4.6, -0.4, 1.8], 1.8, 1.45, fur);
  ell([1.9, 2.7, 1.15], [4.8, -1.3, 1.15], fur);
  for (dx = [-0.55, 0.55]) limb([4.8 + dx, -3.55, 1.25], [4.8 + dx, -3.85, 0.7], 0.12, 0.12, ink);
}

// ---- Tail: a root from the rump into a bushy plume behind the near side (traced from the front sheet), orange top
TAIL = [[5, 8], [5.6, 6.5], [8.3, 5.9], [11, 6.8], [13.1, 8.8], [13.9, 11.5], [13.9, 13.8], [13.3, 16], [13.1, 17.7],
        [15, 18.9], [13.9, 19.8], [11.6, 19.8], [8.9, 18.5], [7.3, 17], [6.5, 15.8], [6, 13], [5.6, 10.5]];
TAIL_TIP = [[5.2, 15.3], [6.6, 17.6], [8.6, 19.2], [11.6, 20.6], [14.2, 20.6], [16, 19.2], [14.2, 17.6], [14.4, 16],
            [15, 13.8], [15, 11.6], [13, 13.2], [12, 12.3], [11, 14.2], [9.8, 13.4], [8.7, 15], [7.4, 14.4], [6.2, 15.2]];
TD = 2;
limb([1.2, 3.2, 6.5], [4.5, 5.2, 7.8], 1.4, 2.2, fur);
ppS(TD) slab(TAIL, 4.4, fur, inset = 1.6, grow = 0.2);
color(orangeB) intersection() {
  ppS(TD) slab(TAIL, 4.8, orangeB, inset = 1.6, grow = 0.35);
  prismS(TAIL_TIP);
}
