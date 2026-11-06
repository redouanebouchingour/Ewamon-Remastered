// Sunjaw: a golden lion brawler in a wide fighting stance. A huge wild golden mane swept up and back, a snarling face
// with gritted teeth and red glaring eyes, a muscular golden body, a red waist sash and loincloth, two huge round
// spiked-knuckle gauntlets (dark brown metal, tan rim bands, a ring of glowing ember studs) held out wide with flame
// and smoke wisps, a long smoke scarf round the neck billowing into a cloud above the +X shoulder, and a lion tail
// curling round the near leg to a flame-like tuft between the feet.
//
// Checklist (front sheet, 40 units tall):
// - Head: face sheet x -7..0, z 24.5..33.5, turned towards the viewer's left. Near eye x -2.9 z 30, far eye x -6 z 30:
//   narrow angry slits, red iris, a white glint, a pale brow patch over them. Muzzle cream x -6.6..-2 z 24.8..28.2,
//   gritted teeth with a dark line at z 26.7, a red-brown nose at x -6, z 28. Round ear in the mane at x 0..2, z 32.5.
// - Mane: x -10.4..11, z 23.5..40, locks streaming up and to the viewer's right; peaks at z 38..40 (x -5..6), a cheek
//   ruff down to z 23.5 left of the chin. Back: the mane covers the whole back of the head down to z 26.
// - Torso: chest x -5..5, z 18.5..25, broad shoulders at z 24.5, pale scratch scar on the chest.
// - Sash: red, z 16..19.5, flaring to a loincloth skirt down to z 12..13.5 (x -10..8), a knot at x -3, z 17.5.
// - Gauntlets: huge round fists seen nearly face-on: near one sheet x 8..19.8 z 14.2..26.8, far one x -20.3..-8.3
//   z 13.5..25.4. Knuckle plates on the face, ember studs round the outer rim, flame + smoke wisps above and below.
// - Legs: wide digitigrade stance, knees at sheet x +-7 z 9, big clawed feet (four pale claws) at x 5..14 / -12..-3.
// - Tail: from behind the near hip out to sheet x 14 z 8.5, down and round the near leg to a tuft at x 0..4, z 3.5..6.5.
// - Smoke scarf: a band behind the neck, rising off the +X shoulder into a cloud at sheet x 8.5..20.5, z 28.5..37;
//   on the -X side a wisp curling up beside the face (x -11..-9, z 24.5..35) and the band hanging down the back.
include <lib.scad>
$fs = 1.1;   // coarser round parts: the triangles go to the mane

fur = [0.93, 0.62, 0.13, NOGLOW];
furHi = [0.98, 0.78, 0.26, NOGLOW];
furSh = [0.76, 0.43, 0.07, NOGLOW];
mane = [0.97, 0.72, 0.17, NOGLOW];
maneHi = [0.99, 0.84, 0.34, NOGLOW];
maneSh = [0.82, 0.5, 0.09, NOGLOW];
cream = [0.96, 0.9, 0.78, NOGLOW];
claw = [0.9, 0.84, 0.72, NOGLOW];
ink = [0.12, 0.04, 0.03];
noseC = [0.55, 0.2, 0.1];
earIn = [0.44, 0.14, 0.07];
eyeRed = [0.86, 0.1, 0.05, NOGLOW];
red = [0.83, 0.17, 0.09, NOGLOW];
redSh = [0.57, 0.1, 0.07];
metal = [0.3, 0.2, 0.16];
metalHi = [0.57, 0.42, 0.32];
knuckle = [0.48, 0.35, 0.27];
ember = [1, 0.48, 0.08, GLOW];
flame = [1, 0.6, 0.15, GLOW];
smoke = [0.9, 0.87, 0.81, NOGLOW];
smokeSh = [0.68, 0.62, 0.56];

module e(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// ---- Lock helpers (hollowolf's): a flat tapered lock through p0 -> p1 -> p2, w half-wide, its flat face to n.
function nrm(v) = v / norm(v);
module nframe(d, n) {
  z = nrm(d);
  x = nrm(n - (n * z) * z);
  y = cross(z, x);
  multmatrix([[x[0], y[0], z[0], 0], [x[1], y[1], z[1], 0], [x[2], y[2], z[2], 0], [0, 0, 0, 1]]) children();
}
module pseg(a, b, wa, wb, n, c) {
  d = b - a;
  color(c) hull() {
    translate(a) nframe(d, n) scale([wa * 0.38, wa, wa * 0.55]) sphere(1, $fn = 10);
    translate(b) nframe(d, n) scale([wb * 0.38, wb, wb * 0.55]) sphere(1, $fn = 7);
  }
}
module plock(p0, p1, p2, w, n, c) { pseg(p0, p1, w, w * 0.8, n, c); pseg(p1, p2, w * 0.8, 0.5, n, c); }

// ---- Legs: thick thighs out of the skirt, knees out wide, digitigrade shins back to the hock, big clawed feet.
mirror_x() {
  limb([3.6, 0.5, 14], [8, -1.2, 9.2], 4, 2.8, fur);                // thigh
  e([2.6, 2, 3], [5.8, -2.2, 11.6], furHi);                          // thigh muscle
  limb([8, -1.2, 9.2], [9.2, 1, 4.2], 2.7, 1.8, fur);                // shin back to the hock
  limb([9.2, 1, 4.2], [10.2, -1.5, 1.4], 1.6, 1.4, fur);             // foot
  e([2.4, 2.8, 1.35], [10.2, -1.8, 1.35], fur, 14);                  // foot pad
  for (k = [-1.5 : 1 : 1.5]) {
    e([0.75, 1, 0.7], [10.2 + k * 1.25, -4.2, 0.9], furSh, 8);      // toe
    spike([10.2 + k * 1.3, -4.9, 0.9], [k * 0.45, -1.5, -0.7], 0.42, 0.05, claw);
  }
}

// ---- Torso: broad chest and shoulders over a narrower waist.
blob([[[6, 4.3, 3.8], [0, 0, 22.5]], [[4.2, 3.5, 3], [0, 0.3, 18]]], fur);
mirror_x() e([3.2, 0.8, 1.9], [2.5, -3.7, 22.6], fur, 16);            // pecs
for (z = [17.6, 19.4]) mirror_x() e([1.3, 0.55, 0.8], [1.25, -3.35, z], furHi, 8);   // abs
// the pale scratch scar across the chest
for (i = [0 : 2]) color(cream) translate([-1.6 + i * 0.7, -4.25, 23.3 - i * 1.1]) rotate([0, 50, 0]) scale([1, 0.22, 0.16]) sphere(1, $fn = 8);
// back: lats and shoulder blades, a dark spine groove
mirror_x() e([3.2, 1.4, 3.4], [2.9, 3.3, 22], furHi, 18);
mirror_x() e([1.8, 1, 1.6], [2.4, 3.9, 25], furHi, 12);
color(furSh) hull() { translate([0, 4.4, 26]) sphere(0.35, $fn = 6); translate([0, 3.9, 17.5]) sphere(0.35, $fn = 6); }

// ---- Red sash and loincloth skirt.
color(red) hull() {
  translate([0, 0.2, 19.6]) scale([4.6, 3.9, 1]) cylinder(h = 0.4, r = 1, $fn = 28);
  translate([0, 0.5, 12.8]) scale([8.4, 7, 1]) cylinder(h = 0.4, r = 1, $fn = 28);
}
// drape folds down the skirt
for (a = [-150, -115, -70, -30, 15, 50]) color(redSh) hull() {
  translate([4.75 * cos(a), 0.2 + 4 * sin(a), 18.6]) sphere(0.3, $fn = 6);
  translate([8.55 * cos(a), 0.5 + 7.15 * sin(a), 13.1]) sphere(0.55, $fn = 6);
}
color(redSh) translate([0, 0.2, 18.4]) scale([4.85, 4.1, 1]) cylinder(h = 1.4, r = 1, $fn = 28);   // the sash band
e([1.4, 0.9, 1.15], [-1.1, -4.7, 17.6], redSh, 12);                   // the knot
color(redSh) hull() { translate([-1.1, -5, 17]) sphere(0.6, $fn = 8); translate([-0.3, -6.4, 11.2]) scale([1.4, 0.35, 0.4]) sphere(1, $fn = 8); }
color(red) hull() { translate([-1.6, -5, 17]) sphere(0.6, $fn = 8); translate([-3.4, -5.9, 12.2]) scale([1.3, 0.35, 0.4]) sphere(1, $fn = 8); }
color(red) hull() { translate([0, 4.8, 15]) scale([3, 0.5, 1]) sphere(1, $fn = 10); translate([0.6, 6.4, 10.2]) scale([2.6, 0.4, 0.4]) sphere(1, $fn = 10); }

// ---- Arms: big round shoulders and biceps, held out wide to the gauntlets.
mirror_x() {
  e([3.1, 3, 2.9], [6.6, 0.5, 24.4], fur, 20);                       // deltoid
  limb([7.3, 0.5, 23.8], [11, 1.4, 21.4], 2.5, 2.1, fur);            // upper arm
  e([2.1, 1.8, 2], [9, -0.4, 23.6], furHi, 14);                      // biceps
  limb([11, 1.4, 21.4], [14.8, 2, 20.4], 2.1, 2.3, fur);             // forearm into the gauntlet
}

// ---- Gauntlets: huge round fists facing the viewer (local: fist towards -Y, centre at the origin).
module gauntlet() {
  color(metal) translate([0, 0.6, 0]) rotate([90, 0, 0]) cylinder(h = 5.4, r = 5.2, center = true, $fn = 24);
  for (y = [1.2, 2.6]) color(metalHi) translate([0, y, 0]) rotate([90, 0, 0]) cylinder(h = 0.6, r = 5.45, center = true, $fn = 24);
  e([4.6, 1.3, 4.6], [0, 3.3, 0], metal, 14);                        // rear cap
  e([5, 2, 4.8], [0, -2.1, 0], metal, 16);                           // the fist's face
  for (i = [-1.5 : 1 : 1.5]) {
    e([1.15, 1.3, 1.5], [i * 2.2, -3.5, 1.6], knuckle, 10);          // knuckle plates
    e([1.05, 1.1, 1.15], [i * 2.2, -3.2, -1.4], metal, 8);          // curled fingers
    spike([i * 2.2, -4.5, 2.2], [0, -1.1, 0.5], 0.45, 0.06, metalHi); // knuckle spikes
  }
  e([1.3, 1.1, 1.8], [-4, -2.6, -0.4], knuckle, 12);                  // thumb
  for (a = [-105 : 27 : 30]) e([0.85, 0.7, 0.85], [5.35 * cos(a), -1.4, 5.35 * sin(a)], ember, 8);   // ember studs
  // flame tongues off the outer rim, above and below (flat, facing the front)
  plock([3.8, -0.6, 3.6], [5.2, -0.6, 5.2], [4.6, -0.6, 6.8], 1.3, [0, -1, 0], flame);
  plock([3.4, -0.6, -4.2], [4.6, -0.6, -6], [4.2, -0.6, -7.6], 1.2, [0, -1, 0], flame);
}
mirror_x() translate([16, -1.5, 20.2]) rotate([0, 0, 14]) scale(1.13) gauntlet();

// ---- Neck and head (head frame: face towards -Y, turned HEAD_YAW towards the viewer's left).
limb([0, 0.5, 23.5], [-0.7, -1.6, 28.2], 3, 2.7, fur);
HC = [-1, -2.5, 29.2];
HEAD_YAW = -12;
HS = 1.15;
EYE = [2.15, -2.95, 0.8];
EYE_SIZE = 0.85;
// The mane's locks: [angle in the face plane (0 = +X, 90 = up), reach, back (depth of the tip), half-width, colour,
// root depth, sweep (deg the tip turns)]. They stream up and to the viewer's right like the art.
MANE_C = [mane, maneHi, maneSh];
MANE = [
  // front ruff
  [95, 8.8, 2.5, 3, 1, 0.4, -12], [62, 9.2, 3.5, 3, 0, 0.4, -10], [128, 7.6, 1, 2.9, 2, 0.4, -20], [160, 6.6, -1, 2.8, 0, 0.4, -12],
  [192, 6.2, -1.5, 2.7, 1, 0.4, -4], [222, 5.2, -1, 2.6, 2, 0.4, 6], [252, 4.8, -0.5, 2.6, 0, 0.4, 8], [285, 4.8, 0.5, 2.6, 1, 0.4, 10],
  [318, 5.6, 2, 2.6, 2, 0.4, 14], [350, 7, 3, 2.8, 0, 0.4, 16], [28, 8.4, 3.5, 2.9, 1, 0.4, 12],
  // second layer, behind and longer
  [80, 9.6, 6, 3.1, 2, 2.4, -8], [45, 9.8, 6.5, 3.1, 1, 2.4, 4], [112, 8.8, 4.5, 3, 0, 2.4, -14], [142, 7.6, 3, 2.9, 1, 2.4, -14],
  [172, 7, 2, 2.8, 2, 2.4, -8], [12, 8.8, 6.5, 3, 0, 2.4, 10], [-22, 7.4, 5.5, 2.8, 2, 2.4, 14], [300, 6.2, 5, 2.7, 1, 2.4, 10],
  [240, 6, 4.5, 2.7, 0, 2.4, -4],
  // back layer: down the nape and over the shoulders
  [270, 6.4, 6, 3, 0, 4.4, 0], [215, 6, 4.5, 2.8, 2, 4.4, -8], [325, 7, 6.5, 2.9, 1, 4.4, 10], [95, 8, 7, 3, 0, 4.4, -6],
  [140, 7, 6, 2.8, 2, 4.4, -10], [40, 8.6, 7.5, 3, 1, 4.4, 4],
];
function lockPt(a, r, y) = [r * cos(a), y, r * sin(a) + 0.6];
translate(HC) rotate([0, 0, HEAD_YAW]) scale(HS) {
  e([3.4, 3.3, 3.3], [0, 0, 0.6], fur, 20);                          // cranium
  // the mane: a core behind the head and the radiating locks
  e([5.6, 4.6, 5.6], [0, 3.4, 1.8], maneSh, 16);
  for (m = MANE) let(a = m[0], R = m[1], s = m[6])
    plock(lockPt(a, 2.8, m[5]), lockPt(a + s * 0.4, 2.8 + (R - 2.8) * 0.55, m[5] + m[2] * 0.45), lockPt(a + s, R, m[5] + m[2]),
          m[3], [0, -1, 0.15], MANE_C[m[4]]);
  // snout bridge, nose, cream muzzle with gritted teeth
  limb([0, -2.9, 0.2], [0, -4.4, -0.45], 0.9, 1.15, fur);
  e([0.95, 0.6, 0.6], [0, -5.45, -0.45], noseC, 12);
  mirror_x() e([1.7, 1.4, 1.35], [1.05, -4.15, -1.95], cream, 18);    // cheeks of the muzzle
  e([1.6, 1.25, 0.95], [0, -3.85, -3.4], cream, 16);                  // chin
  // the mouth: a dark line across the muzzle with tooth gaps, curling down at the snarling corners
  color(ink) intersection() {
    union() { mirror_x() e([1.85, 1.55, 1.5], [1.05, -4.15, -1.95], ink, 18); e([1.75, 1.4, 1.1], [0, -3.85, -3.4], ink, 16); }
    union() {
      translate([-3, -9, -2.75]) cube([6, 5, 0.38]);
      for (x = [-1.2, 0, 1.2]) translate([x - 0.11, -9, -3.4]) cube([0.22, 5, 1.3]);
      mirror_x() translate([2.1, -9, -3.2]) rotate([0, -35, 0]) cube([0.35, 5.6, 1.2]);
    }
  }
  mirror_x() spike([1.45, -4.85, -2.1], [0.1, -0.2, -0.95], 0.28, 0.05, cream);   // fangs
  // eyes: red, narrowed under heavy brows
  mirror_x() {
    eye(EYE, EYE_SIZE, iris = eyeRed, sclera = cream, pupil = ink, yaw = 10, lid = 0.52, lid_tilt = 30, lid_c = fur,
        slit = 0.4, squint = 0.2, shine = true);
    color(fur) hull() {                                               // brow ridge, slanting down to the nose
      translate([0.7, -3.2, 1.55]) scale([0.5, 0.5, 0.4]) sphere(1, $fn = 10);
      translate([2.2, -2.8, 2.05]) scale([0.9, 0.55, 0.42]) sphere(1, $fn = 10);
      translate([3.2, -1.9, 2.3]) scale([0.6, 0.6, 0.45]) sphere(1, $fn = 10);
    }
    color(furHi) translate([2.1, -3, 2.4]) rotate([0, -14, 18]) scale([0.9, 0.35, 0.26]) sphere(1, $fn = 8);   // pale brow patch
    for (i = [0 : 1]) color(furSh) translate([0.5, -4.4 + i * 0.4, 0.5 + i * 0.5]) rotate([0, -20, 20]) scale([0.5, 0.2, 0.14]) sphere(1, $fn = 6);
    // round ear in the mane
    translate([2.8, 0.2, 2.6]) rotate([0, -40, 0]) { e([1.05, 0.55, 1.05], [0, 0, 0], fur, 12); e([0.6, 0.25, 0.6], [0, -0.4, -0.1], furSh, 8); }
  }
}

// ---- Smoke scarf: a band behind the neck, rising off the +X shoulder into a cloud; a wisp curling up on the -X side.
chain([[-7.6, 2.8, 23.4], [-7.4, 2.2, 24.8], [-5.6, 2.6, 26.4], [-2.5, 4, 27.6], [1, 4.2, 28.4], [4.2, 2.8, 28.8], [6.2, 0.2, 27.6],
       [6.4, -2.4, 24.6]], [1.2, 1.6, 1.8, 1.9, 1.9, 1.9, 1.8, 1.5], smoke);
chain([[6.6, -0.6, 26.4], [8.4, 0.8, 28.6], [11, 2, 30.4], [14, 3, 31.2], [17, 3, 31.8], [19.8, 3, 33.4], [20.4, 3, 35.4],
       [18.2, 3.2, 36.2], [16.2, 3, 34.8]], [1.4, 1.8, 2.1, 2.3, 2.2, 2, 1.6, 1.2, 0.8], smoke);
for (p = [[10.6, 2.4, 32.0, 2], [13.4, 3.2, 33.4, 2.3], [16.4, 3.2, 34.2, 2.1], [12.4, 3, 29.4, 1.6], [17.6, 3, 30.4, 1.5],
          [19.6, 3, 32.0, 1.4]])
  e([p[3], p[3] * 0.85, p[3] * 0.8] * 1.2, [p[0], p[1], p[2]], p[0] > 15 || p[2] < 31 ? smokeSh : smoke, 10);
chain([[-7, 0.4, 25.6], [-9.6, -0.8, 26.4], [-11.2, -1, 28.8], [-11.1, -1, 31.8], [-10, -1.2, 33.8], [-8.8, -1.2, 33.4]],
      [1.3, 1.4, 1.3, 1.1, 0.8, 0.4], smoke);

// ---- Tail: out behind the near hip, down and round behind the near leg to a flame-like tuft between the feet.
TAIL = [[1.5, 4.6, 13.2], [6, 6.6, 12], [11.4, 6.4, 8.8], [13.2, 3.6, 5], [9.4, 4.6, 3.6], [5.2, 2.6, 4.2], [3, 0.6, 5.2]];
TAIL_R = [1.7, 1.55, 1.4, 1.3, 1.2, 1.15, 1.1];
chain(TAIL, TAIL_R, fur);
for (d = [[-1.2, -1.6, 2.4], [-2.2, -0.6, 1.2], [-0.4, -2.2, 0.6], [-2.4, -1.8, -0.4], [0.6, -1.6, 2.2]])
  plock([3, 0.6, 5.2], [3, 0.6, 5.2] + d * 0.8, [3, 0.6, 5.2] + d * 1.4 + [0, 0, 0.6], 1.6, [0, -1, 0.2], d[2] > 1 ? maneHi : mane);
