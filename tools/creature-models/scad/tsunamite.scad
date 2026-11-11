// Tsunamite: Tidespine grown into a teal crocodile-dragon standing side-on in a stride, remodelled to its sprite
// (2026-11-06). Same build as Tidespine (the head turned 50 deg in headFrame / S(), the half-space cream belly with
// plates, the tail curling up into a fin in the picture plane), heavier.
// Checklist (front sheet, 40 units tall, 41.1 wide; the puddle under it is not modelled):
//   head  a long croc snout to the viewer's left (sheet x -21..-6.5, z 24.5..34.4), slightly open: the teal upper jaw
//         with white teeth pointing down, a cream lower jaw (z 24.5..27) with teeth up, dark inside. A fierce green eye
//         (-11.5, 31.2), r ~0.8, under a hard brow. Two pairs of dark horns in a row on the skull (tips (-12.2, 36.6)
//         and (-7.6, 36.6)), small dark spikes behind the skull and dark studs at the cheek and the jaw hinge.
//   neck  thick, cream throat down its front into the cream chest, the plates drawn as a grid.
//   arms  far arm reaching forward with a purple crystal gauntlet (-16..-10, 14..22) and a teal hand with long dark
//         claws (-17..-12, 9..15); near arm hanging in front of the belly (-6..-2, 9..18) under a big purple crystal
//         on the shoulder (-4..3, 15..21).
//   body  big, teal, a row of grey-teal round studs on the near flank (2..7, 8..18); a blue gem on the back (back art).
//   legs  thick; near foot (3..10, 0..4), far foot striding forward (-12..-7, 2..5); dark claws.
//   sail  a huge purple sail on the back (x -3.5..10, z 11..40), dark ribs, a teal sheen in its upper middle.
//   tail  thick, back and right along z 7..13 with a cream underside, curling up into a grey-green paddle
//         (13..20.5, 18.5..30.5) with dark purple spots and a darker rim.
//   bubbles round it.
include <lib.scad>

teal = [0.27, 0.55, 0.64];
tealHi = [0.31, 0.68, 0.71];
tealDk = [0.14, 0.35, 0.48];
cream = [0.94, 0.89, 0.64];
creamDk = [0.73, 0.68, 0.47];
purple = [0.55, 0.45, 0.7];
purpleHi = [0.56, 0.45, 0.72];
purpleDk = [0.25, 0.21, 0.36];
hide = [0.37, 0.7, 0.76];
sheen = [0.3, 0.55, 0.56];
horn = [0.2, 0.22, 0.24];
claw = [0.22, 0.24, 0.27];
stud = [0.44, 0.55, 0.55];
studDk = [0.4, 0.5, 0.56];
paddle = [0.56, 0.67, 0.67];
gem = [0.35, 0.8, 1, GLOW];
bubble = [0.75, 0.93, 0.97];
tooth = [0.98, 0.97, 0.9];
mouth = [0.16, 0.08, 0.12];
eyeGreen = [0.2, 0.82, 0.3, NOGLOW];

// halfSpace(n, p, k): the points whose offset from p along the unit normal n is more than k (the belly technique).
module halfSpace(n, p, k) { translate(p + n * k) rotate(_dir_rot(n)) translate([-60, -60, 0]) cube([120, 120, 120]); }
module shard(p, q, r, c) {
  d = q - p; l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.72, r1 = r * 0.8, r2 = r, $fn = 6);
    translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// ---------- head (its own frame: x = side, -y = snout, z = up). Sheet x = HS + 0.174 x + 0.985 y.
HC = [-6.5, -11.5, 0];
HS = 0.866 * HC[0] + 0.5 * HC[1];
function S(sx, z, x = 0) = [x, (sx - HS - 0.174 * x) / 0.985, z];
module headFrame() { translate(HC) rotate([0, 0, -50]) children(); }

module head() {
  // Skull and long upper jaw.
  color(teal) hull() {
    translate(S(-11.2, 31.4)) scale([3.3, 3.6, 2.9]) sphere(1, $fn = 22);
    translate(S(-7.8, 30.8)) scale([3.3, 2.6, 3.2]) sphere(1, $fn = 18);
    translate(S(-15.4, 28.6)) scale([2.4, 2.6, 1.7]) sphere(1, $fn = 16);
    translate(S(-19.6, 27.4)) scale([1.8, 1.6, 1.1]) sphere(1, $fn = 14);
  }
  // Cream lower jaw, the mouth a little open with a dark inside.
  color(cream) hull() {
    translate(S(-19.4, 25.2)) scale([1.6, 1.6, 0.75]) sphere(1, $fn = 12);
    translate(S(-10.6, 26.4)) scale([2.9, 3.2, 1.6]) sphere(1, $fn = 16);
  }
  color(mouth) hull() {
    translate(S(-18.6, 26.2)) scale([1.25, 1.4, 0.45]) sphere(1, $fn = 10);
    translate(S(-10.6, 27.2)) scale([2.4, 2.4, 0.9]) sphere(1, $fn = 12);
  }
  // Teeth: down from the upper jaw, up from the lower.
  mirror_x() {
    for (t = [[-18.2, 1.25], [-16.5, 1.6], [-14.7, 1.95], [-12.9, 2.2]]) spike(S(t[0], 26.7, t[1]), [0, 0, -1], 0.36, 0.04, tooth);
    for (t = [[-17.4, 1.3], [-15.6, 1.65], [-13.8, 1.95]]) spike(S(t[0], 25.6, t[1]), [0, 0, 0.9], 0.32, 0.04, tooth);
  }
  // Nostrils.
  mirror_x() ell([0.3, 0.3, 0.22], S(-20.2, 28.2, 1), [0.06, 0.08, 0.1]);
  // Fierce green eye under a hard brow ridge that slopes down to the snout.
  mirror_x() {
    eye(S(-11.5, 31.2, 2.6), 1.05, iris = eyeGreen, sclera = [0.05, 0.08, 0.1], pupil = [0.02, 0.05, 0.03], yaw = 64,
        flat = 0.55, lid = 0.32, lid_tilt = 24, lid_c = teal, slit = 0.5, shine = true);
    color(teal) translate(S(-11.5, 31.2, 2.4)) rotate([0, 0, 64]) hull() {
      translate([1.2, 0.2, 1.15]) scale([0.5, 0.6, 0.32]) sphere(1, $fn = 10);
      translate([-1.3, -0.3, 0.6]) scale([0.5, 0.5, 0.28]) sphere(1, $fn = 10);
      translate([0, 1, 0.9]) scale([1.2, 0.6, 0.5]) sphere(1, $fn = 10);
    }
  }
  // Two pairs of dark horns in a row, dark spikes behind the skull, dark studs at the cheek and the jaw hinge.
  mirror_x() {
    chain([S(-13.4, 33.2, 1.4), S(-12.9, 35, 1.6), S(-12.2, 36.8, 1.8)], [0.9, 0.55, 0.08], horn);
    chain([S(-9.8, 33.6, 1.5), S(-8.8, 35.2, 1.7), S(-7.6, 36.8, 1.9)], [1.05, 0.65, 0.08], horn);
    spike(S(-7, 33.2, 1.2), [0, 1.4, 1], 0.6, 0.05, horn);
    spike(S(-5.6, 31.4, 1.6), [0.3, 1.5, 0.3], 0.55, 0.05, horn);
    for (p = [[-8.6, 31.5, 2.75], [-7.6, 28.4, 2.7], [-8.2, 27.2, 2.6]]) ell([0.45, 0.7, 0.7], S(p[0], p[1], p[2]), horn);
  }
}
headFrame() head();

// ---------- neck and torso
neck = [[-1.6, -5, 22], [-3.2, -8, 26.5], [-4.6, -10, 29.6], [-5.8, -11.4, 31.2]];
neckR = [6, 5.2, 4.2, 3.4];
chain(neck, neckR, teal);
module torso(g = 0) {
  hull() {
    translate([-1.6, -5, 19]) scale([5.6 + g, 5.6 + g, 6.8 + g]) sphere(1, $fn = 30);
    translate([0.4, 2.6, 13.5]) scale([7 + g, 7 + g, 7.4 + g]) sphere(1, $fn = 30);
  }
}
color(teal) torso();

// Cream throat and belly, with the plates drawn as a grid.
NN = [-0.7, -0.44, -0.56];
NB = [-0.12, -0.9, -0.42];
module throat(g) { intersection() { chain(neck, [for (r = neckR) r + g]); halfSpace(NN, neck[0], 1.6); translate([-30, -40, 17]) cube([60, 60, 30]); } }
module belly(g) { intersection() { torso(g); halfSpace(NB, [0, -1, 14], 2.2); translate([-30, -40, 6]) cube([60, 60, 20]); } }
color(cream) { throat(0.25); belly(0.25); }
NA = (neck[3] - neck[0]) / norm(neck[3] - neck[0]);
for (t = [2.4 : 2.4 : 10]) color(creamDk) intersection() { throat(0.36); translate(neck[0] + NA * t) rotate(_dir_rot(NA)) translate([-30, -30, 0]) cube([60, 60, 0.4]); }
for (z = [9.4, 11.9, 14.4, 16.9, 19.4, 21.9]) color(creamDk) intersection() { belly(0.36); translate([-30, -40, z]) rotate([8, 0, 0]) cube([60, 60, 0.4]); }
// The grid's vertical lines down the middle of the chest and throat.
color(creamDk) intersection() { union() { belly(0.36); throat(0.36); } translate([-1.9, -40, 0]) rotate([0, 0, -32]) cube([0.4, 60, 40]); }

// ---------- arms
// Far arm (-X): reaching forward, a purple crystal gauntlet, a teal hand with long hooked dark claws.
chain([[-3.4, -6.6, 21], [-6, -10.4, 17.6], [-7.4, -14.2, 14.6]], [2.6, 2.3, 2], teal);
color(purple) translate([-6.8, -12.4, 16]) rotate(_dir_rot([-1.4, -3.8, -3])) cylinder(h = 6, r1 = 3.5, r2 = 2.8, $fn = 6, center = true);
shard([-7.6, -11.6, 17.4], [-10, -11.8, 21.4], 1.4, purpleHi);
shard([-8.4, -13.2, 15.6], [-11.4, -14.6, 17.4], 1.2, purpleHi);
shard([-6, -11.2, 18.2], [-6.2, -12.2, 21.4], 0.9, purpleDk);
ell([2.3, 2.1, 1.9], [-7.8, -15.6, 13.4], teal);
for (k = [-1, 0, 1]) chain([[-7.8 + k * 1.2, -16.8, 13], [-7.9 + k * 1.4, -17.8, 11.4], [-7.8 + k * 1.4, -17.2, 9.6]], [0.6, 0.45, 0.08], claw);
// Near arm (+X): hanging in front of the belly, a big purple crystal on the shoulder.
chain([[3.4, -6.8, 21], [3.6, -9.8, 16.6], [2.6, -11.6, 13.2]], [2.5, 2.1, 1.9], teal);
ell([2.2, 2, 1.8], [2.2, -12.6, 11.8], teal);
for (k = [-1, 0, 1]) chain([[2.2 + k * 1.1, -13.8, 11.2], [2.2 + k * 1.3, -14.6, 9.8], [2.2 + k * 1.3, -14, 8.4]], [0.55, 0.42, 0.08], claw);
// a big faceted crystal: a hexagonal bipyramid lying across the shoulder
color(purple) translate([5, -10.2, 18.2]) rotate([0, 0, -30]) rotate([0, 70, 0]) scale([1.3, 1, 1.3]) {
  cylinder(h = 3.6, r1 = 3.2, r2 = 0.3, $fn = 6);
  mirror([0, 0, 1]) cylinder(h = 3.2, r1 = 3.2, r2 = 0.3, $fn = 6);
}
shard([5.4, -10.6, 20.2], [4.2, -13.4, 23.6], 1.4, purpleHi);
shard([5.4, -8, 19], [7.6, -9, 21.6], 1, purple);

// Grey-teal round studs on the near thigh, set on its surface facing the viewer.
TH = [5.2, 2.2, 12]; THR = [4.2, 5.2, 6.4];
for (d = [[0.5, -0.7, 0.45, 1.25], [0.62, -0.72, 0.05, 1.45], [0.45, -0.82, -0.35, 1.1], [0.78, -0.42, 0.4, 1.1], [0.82, -0.5, -0.2, 1.3],
          [0.3, -0.9, 0.2, 1]]) let(u = [d[0], d[1], d[2]] / norm([d[0], d[1], d[2]]))
  color(d[3] > 1.2 ? stud : studDk) translate(TH + [THR[0] * u[0], THR[1] * u[1], THR[2] * u[2]] * 0.97) rotate(_dir_rot(u)) scale([1, 1, 0.55] * d[3]) sphere(1, $fn = 12);
// Scaled hide: lighter flush hexagonal patches over the back and flanks of the torso (the art's crackled back): rods
// out from the torso's axis, cut to the torso's surface grown a hair, so each leaves a hexagon on the skin.
color(hide) intersection() {
  torso(0.08);
  union() for (z = [8.6 : 2.2 : 24]) for (a = [-120 : 20 : 120]) let(b = a + ((z - 8.6) % 4.4 < 2.2 ? 10 : 0),
      t = min(max((z - 13.5) / 7.4, 0), 1), c = [0.4 - 2 * t, 2.6 - 7.6 * t, z])
    translate(c) rotate(_dir_rot([sin(b), cos(b), 0])) rotate([0, 0, 30]) cylinder(h = 12, r = 0.85, $fn = 6);
  halfSpace([0, 1, 0], [0, -2, 0], 0);
}
// Blue gem on the back (the back art) in a dark setting.
color(tealDk) translate([-2.2, 8.2, 15.6]) rotate([0, 0, -20]) scale([1.6, 0.8, 1.9]) sphere(1, $fn = 14);
color(gem) translate([-2.4, 8.7, 15.6]) rotate([0, 0, -20]) scale([1.1, 0.55, 1.35]) sphere(1, $fn = 12);

// ---------- legs: thick thighs, digitigrade shins, three-toed feet with dark claws
module leg(thigh, tr, knee, ankle, foot) {
  ell(tr, thigh, teal);
  chain([thigh + [0.2, 0.6, -3], knee, ankle], [3.4, 2.6, 2.2], teal);
  color(teal) hull() { translate(ankle) sphere(2.2, $fn = 14); translate(foot) scale([2.6, 2.8, 1.3]) sphere(1, $fn = 14); }
  for (k = [-1, 0, 1]) let(tip = foot + [k * 2, -1.8 - abs(k) * 0.3, -0.2]) {
    limb(foot + [k * 0.8, 0, 0], tip, 1, 0.8, teal);
    spike(tip + [0, -0.5, 0.1], [k * 0.4, -1.5, -0.8], 0.65, 0.05, claw);
  }
}
leg([5.2, 2.2, 12], [4.2, 5.2, 6.4], [5.8, 4.6, 6.4], [6, 5, 2.4], [6, 2.6, 1.3]);
leg([-5, -1, 12], [3.8, 4.8, 5.8], [-5.6, -4.8, 7.2], [-5.8, -7.4, 2.6], [-6, -9.6, 1.3]);

// ---------- tail: back and out to the +X side, curling up into the paddle
tail = [[0, 5.5, 11], [2.8, 10, 9.6], [6.4, 13, 9], [10.2, 14, 10.4], [11, 13.8, 13.6], [11.4, 13.6, 17.8], [11.8, 13.6, 21.6], [12.4, 13.6, 25.4]];
tailR = [5, 4.2, 3.6, 3, 2.4, 1.9, 1.5, 1.1];
chain(tail, tailR, teal);
for (i = [0 : 3]) color(cream) hull() for (j = [i, i + 1]) translate(tail[j] + [0.3, -0.6, -tailR[j] * 0.55]) scale([tailR[j] * 0.75, tailR[j] * 0.75, tailR[j] * 0.5]) sphere(1, $fn = 12);
// Darker scutes along the top of the tail.
for (i = [1 : 3]) for (u = [0, 0.5]) let(p = tail[i] + (tail[i + 1] - tail[i]) * u, r = tailR[i] + (tailR[i + 1] - tailR[i]) * u)
  color(tealDk) translate(p + [0, 0, r * 0.92]) scale([0.9, 1.3, 0.4]) sphere(1, $fn = 8);
// Paddle: a grey-green oval in the picture plane, a darker rim, dark purple spots on both faces.
PD = 5.4;
PCX = 16.2;
paddlePts = [for (a = [0 : 20 : 340]) [PCX + 3.7 * cos(a), 24.5 + 6.1 * sin(a)]];
pp(PD) {
  color(studDk) slab(paddlePts, 2.2, inset = 1.4);
  color(paddle) scale([1, 1.06, 1]) translate([PCX * (1 - 0.9), 0, 24.5 * (1 - 0.9)]) scale([0.9, 1, 0.9]) slab(paddlePts, 2.2, inset = 1.4);
  for (s = [-1, 1]) for (p = [[14.8, 27.2], [17.4, 28.4], [14.2, 23.4], [17.2, 25], [15.4, 20.8], [18.2, 21.6], [16, 30.2]])
    color(purpleDk) translate([p[0], s * 1.05, p[1]]) scale([0.65, 0.3, 0.8]) sphere(1, $fn = 8);
}

// ---------- the sail: a huge purple fin on the back, in the picture plane, leaning back a little
sailPts = [[-1.2, 21.6], [-3.2, 25], [-3.6, 30], [-2.6, 34.4], [-1.4, 37.8], [0, 40], [2.2, 40], [3.4, 38.8], [4.6, 38.2],
           [5.4, 36.8], [6.4, 35.2], [7, 33.8], [7.8, 32.8], [8.4, 31], [9.2, 29.4], [9.6, 27.4], [9.8, 24], [10, 19.6],
           [9.6, 15], [9.2, 12.4], [8, 10.6], [5.6, 12.4], [2.6, 16.6]];
sheenPts = [[-1, 30], [0.6, 37.6], [3, 37.2], [6.2, 33], [7.6, 28], [4.6, 26], [1, 27]];
sailBase = [[-1.4, 24], [0.2, 22.4], [2, 20.4], [3.8, 18.4], [5.4, 16.4], [6.8, 14.4], [7.8, 12.6], [8.4, 11.6]];
sailTip = [[-3, 32], [-0.6, 39.4], [2.6, 39.8], [5, 37.6], [6.8, 34.6], [8.4, 31.4], [9.6, 26.6], [9.8, 19.4]];
SD = 3.4;
pp(SD) translate([0, 0, 16]) rotate([-24, 0, 0]) scale([1, 1, 1.09]) translate([0, 0, -16]) {
  plate(sailPts, 1.1, 0.3, purple);
  color(sheen) intersection() { plate(sailPts, 1.24, 0.3); rotate([90, 0, 0]) linear_extrude(height = 4, center = true) polygon(sheenPts); }
  for (s = [-1, 1]) for (k = [0 : len(sailBase) - 1]) color(purpleDk) hull() {
    translate([sailBase[k][0], s * 0.55, sailBase[k][1]]) scale([0.55, 0.3, 0.55]) sphere(1, $fn = 8);
    translate([sailTip[k][0], s * 0.5, sailTip[k][1]]) scale([0.25, 0.25, 0.25]) sphere(1, $fn = 6);
  }
}

// ---------- bubbles
for (b = [[15.4, 32.6, 0, 0.75], [15, 30, 0, 0.4], [14, 19.6, -2, 0.75], [14.2, 16.6, -2, 0.45], [-2.4, 3.2, -8, 0.5], [13.2, 4, -4, 0.5]])
  color(bubble) translate(fromSheet(b[0], b[1], b[2])) sphere(b[3], $fn = 10);
