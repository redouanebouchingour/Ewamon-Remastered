// Raidori, rebuilt from the measurement sheet (front height 40, feet z = 0).
//
// Checklist (front sheet x, z; the art sits about 1.75 to the right of the scad's sheet x):
// - Body plan: a thunder lion on four legs drawn side-on (the face to the viewer's left), long and low: chest
//   x -9, rump x 14, back line z 24.5, belly z 13. Lion proportions: the torso is long along Y (chest y -9, rump
//   y 11), which the 30 degree view halves; the head sits forward and a little to the creature's right.
// - Head: x -15.5..-4.5, z 20..34, looking at the viewer, muzzle to the left: a squarish dark slate head.
// - Eyes: fierce narrow red eyes with a white glint, near (-10.3, 27.2), the far one hidden under the mask edge at
//   about (-14, 28); both full eyes, lidded with a lilac brow slanting down to the nose.
// - Mask: lilac (#a0a1d3) points at the two top corners of the head (-15..-12, 30.5..33.5) and (-7..-5, 30.5..33).
// - Moustache: a yellow bar across the upper lip, z 25..27, x -16..-5, flaring out to points on both sides.
// - Mouth: open, white chin / lower teeth between two long white sabre fangs (-15, 21..25) and (-10, 20.5..25).
// - Mane: a huge ring of jagged yellow lightning bolts round the head, x -22..1.6, z 16..39.3: tips at (-12.3, 39.3)
//   (-6.9, 38.2) (-1.2, 35.4) (1.6, 31.8) (-21.6, 35.9) (-22, 29.9) (-15.9, 36.5) (-21.6, 17.8) (-18.6, 23.9)
//   (-9.5, 16) (-14.6, 18.8) (-5.5, 20); the back of the mane is dark (the back art: black with gold bolts).
// - Body: dark slate (#4a4a62), pale grey zigzag lightning scars on the flanks, white patches on the upper legs
//   (shoulder (-7, 13..20), the near elbow (3.8, 12..16); the back art has them on a shoulder and a thigh).
// - Legs: a strong stride. Far front reaching forward (foot -8, 0), near front stepping back (foot 2, 4), far rear
//   stretched back (8, 5), near rear under the hip (11, 2). White paws with claws; a lilac cuff above the front paws.
// - Back: a crest of dark spiky fur blades over the hips (6..15, 24..28; tall in the back art).
// - Tail: thin, dark, rising from the rump (12, 23), arcing up to (17.5, 28.5) and hanging down to a yellow
//   four-point star (20, 16).
// - Glow: the sheet lists the mane yellow as glowing; it would be 16 % of the surface and washes out to lemon in game,
//   so NOGLOW on the mane and the star; only the red eyes glow.
include <lib.scad>

body    = [0.29, 0.29, 0.38];
bodyDk  = [0.19, 0.19, 0.25];
scar    = [0.53, 0.53, 0.57];
white   = [0.86, 0.86, 0.87, NOGLOW];
paw     = [0.95, 0.95, 0.96, NOGLOW];
lilac   = [0.63, 0.63, 0.83, NOGLOW];
mane    = [0.98, 0.80, 0.18, NOGLOW];
maneDk  = [0.85, 0.66, 0.04, NOGLOW];
maneBk  = [0.30, 0.24, 0.07];
maneOld = [0.60, 0.47, 0.08];
star    = [0.99, 0.87, 0.30, NOGLOW];
fang    = [1, 1, 1, NOGLOW];
mouthC  = [0.30, 0.07, 0.10];
nose    = [0.10, 0.09, 0.14];
socket  = [0.10, 0.08, 0.14];
red     = [0.95, 0.08, 0.06, GLOW];

// ---- helpers
module octa() polyhedron([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]);
// A jagged lightning bolt along +X in the XZ plane, `L` long, `w` wide at the root, `t` thick (a crystal: thickest on
// its spine, sharp on the edges), the zigzag mirrored with `k` = +1 / -1.
module bolt(L, w, t, k = 1) {
  pts = [[0, 0], [0.45 * L, 0.17 * L * k], [0.52 * L, -0.08 * L * k], [L, 0.05 * L * k]];
  rs = [w / 2, w * 0.48, w * 0.4, 0.05];
  for (i = [0 : 2]) hull() for (j = [i, i + 1])
    translate([pts[j][0], 0, pts[j][1]]) scale([max(rs[j], 0.3), t / 2 * (rs[j] / (w / 2) * 0.7 + 0.3), max(rs[j], 0.3)]) octa();
}
// 2D zigzag stroke (diamond hulls) through pts with half-widths rs, for painted scars.
module zig2(pts, rs) {
  for (i = [0 : len(pts) - 2]) hull() for (j = [i, i + 1]) translate(pts[j]) circle(rs[j], $fn = 4);
}
// A flat blade of fur from p along d, w wide (along Y after the turn), t thick.
module blade(p, d, w, t, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    scale([t, w, 0.6]) sphere(1, $fn = 12);
    translate([0, 0, l]) sphere(0.12, $fn = 6);
  }
}

// ---- torso: long along Y, chest a little higher than the tucked waist, then the rump.
TORSO = [[[6.0, 6.2, 6.2], [0, -9, 18.8]], [[5.4, 7, 5.4], [0, 1, 18.6]], [[5.8, 6.2, 6.0], [0, 11, 19]]];
blob(TORSO, body);
// Pale zigzag lightning scars on both flanks, painted flush on the torso.
color(scar) intersection() {
  blob([for (e = TORSO) [e[0] + [0.22, 0.22, 0.22], e[1]]]);
  rotate([90, 0, 90]) linear_extrude(height = 30, center = true) {
    zig2([[-8, 23], [-6, 19.5], [-4.4, 20.4], [-2.6, 16.5]], [0.85, 0.75, 0.65, 0.25]);
    zig2([[0, 24], [1.8, 20.8], [3.2, 21.6], [5, 17.5]], [0.9, 0.75, 0.65, 0.25]);
    zig2([[7.5, 23.5], [9, 20.5], [10.4, 21.2], [12.2, 17.4]], [0.85, 0.75, 0.65, 0.25]);
    zig2([[-3, 15.5], [-0.5, 14.6], [0.6, 15.3]], [0.6, 0.55, 0.2]);
  }
}
// Neck under the mane, from the chest up to the head.
blob([[[4.6, 4.4, 4.8], [0, -11, 22.5]], [[4, 4, 4.2], [-2, -15, 27]]], body);

// ---- legs [shoulder / hip, knee / hock, foot], the creature's +X = near side.
LEGS = [
  [[3.7, -8.5, 16.5], [4.0, -8.2, 8.5], [4.1, -5.6, 1.5], true],     // near front, stepping back
  [[-3.7, -9.5, 16.5], [-3.9, -11.8, 8.8], [-4.0, -14, 1.5], true],  // far front, reaching forward
  [[3.8, 12, 17], [4.1, 16.4, 7.5], [4.1, 15.4, 1.5], false],      // near rear, under the hip
  [[-3.8, 12.5, 17], [-4.1, 19.4, 8], [-4.1, 21, 1.5], false],       // far rear, stretched back
];
module leg(l) {
  hip = l[0]; knee = l[1]; foot = l[2]; front = l[3];
  limb(hip, knee, front ? 3.7 : 4.2, 2.7, body);
  limb(knee, foot + [0, 0, 0.6], 2.7, 2.3, body);
  // white paw with three claws
  color(paw) translate(foot + [0, -0.9, -0.1]) scale([2.6, 3.1, 1.4]) sphere(1, $fn = 20);
  for (a = [-1, 0, 1]) color(paw) translate(foot + [a * 1.1, -3.4, -0.6]) rotate([90, 0, 0]) cylinder(h = 0.9, r1 = 0.55, r2 = 0.1, $fn = 8);
  // lilac cuff above the front paws
  if (front) color(lilac) translate(foot + [0, 0, 2.4]) scale([2.75, 2.75, 0.9]) sphere(1, $fn = 20);
  // white patch on the front of the upper leg
  mid = (hip + knee) / 2;
  s = sign(hip[0]);
  color(white) translate(mid + [s * 1.4, front ? -2.2 : -2.8, front ? 0.2 : 0.8])
    rotate([front ? 10 : -12, 0, s * 24]) scale([2.2, 0.9, 3.2]) sphere(1, $fn = 16);
}
for (l = LEGS) leg(l);

// ---- back crest: dark fur blades over the hips, sweeping up and back.
for (b = [[0, 5, 23.6, [0, 2.4, 3.2], 1.5], [1.2, 8, 23.6, [0.5, 3, 3.8], 1.7], [-1.2, 8.5, 23.6, [-0.5, 3, 3.6], 1.6],
          [0, 11.5, 23.6, [0, 3.6, 4.2], 1.7], [0, 14.5, 22.6, [0, 3.6, 3.0], 1.4]])
  blade([b[0], b[1], b[2]], b[3], b[4], 0.75, bodyDk);

// ---- tail: rises from the rump, arcs back and out to the near side, hangs down to the star.
TAIL = [[0.6, 17.5, 22], [1.8, 20.5, 25.2], [3.8, 22.5, 27.2], [5.9, 23.6, 27.4], [7.4, 24.2, 25.8], [7.9, 24.2, 23],
        [7.8, 24, 20.2], [8.0, 24, 18.0]];
TAIL_R = [1.5, 1.25, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85];
chain(TAIL, TAIL_R, bodyDk);
// A four-point star, thick, facing the camera.
STAR = [8.3, 24, 14.8];
module star4(r, t) {
  for (a = [0 : 90 : 270]) rotate([0, a, 0]) hull() {
    scale([r * 0.36, t, r * 0.36]) sphere(1, $fn = 12);
    translate([r, 0, 0]) scale([0.15, t * 0.3, 0.15]) sphere(1, $fn = 6);
  }
}
color(star) translate(STAR) rotate([0, 0, 30]) rotate([0, 12, 0]) star4(3.6, 0.9);

// ---- head, in its own frame: centre H, turned HEAD_YAW towards the creature's right.
H = [-3.6, -17.5, 29.6];
HEAD_YAW = -2;
EYE = [2.35, -3.3, -1.5];
EYE_SIZE = 1.5;
EYE_YAW = 22;
HS = 1.12;   // the face is scaled up inside the mane
translate(H) rotate([0, 0, HEAD_YAW]) {
  scale(HS) {
  // a squarish skull, flat on top, and the broad lower face
  color(body) hull() {
    ell([4.0, 3.8, 3.2], [0, 0.2, 1.0]);
    mirror_x() ell([1.6, 2.6, 2.2], [2.6, -1.0, 1.4]);
  }
  ell([4.6, 3.5, 3.0], [0, -1.3, -1.9], body);
  // short broad snout and nose
  blob([[[3.1, 2.4, 2.2], [0, -3.6, -2.4]], [[2.4, 1.4, 1.6], [0, -5.0, -2.6]]], body);
  ell([0.8, 0.5, 0.5], [0, -6.35, -1.9], nose);
  // yellow moustache bar over the upper lip, flaring to points on both sides
  color(mane) intersection() {
    blob([[[3.4, 2.7, 2.5], [0, -3.6, -2.4]], [[2.7, 1.7, 1.9], [0, -5.0, -2.6]], [[4.9, 3.8, 3.3], [0, -1.3, -1.9]]]);
    translate([-10, -12, -4.4]) cube([20, 10, 2.1]);
  }
  mirror_x() color(mane) hull() {
    translate([2.6, -4.5, -3.4]) scale([1.0, 0.9, 1.0]) octa();
    translate([5.2, -3.4, -3.0]) scale([0.8, 0.7, 0.8]) octa();
    translate([7.8, -1.8, -1.8]) scale([0.2, 0.2, 0.2]) octa();
  }
  // open mouth: a dark cavity under the moustache, white chin / lower teeth (the jaw), long sabre fangs
  ell([2.4, 1.4, 1.2], [0, -4.9, -4.5], mouthC);
  ell([2.3, 2.5, 1.35], [0, -4.0, -6.0], white);
  mirror_x() color(fang) hull() {
    translate([1.8, -5.1, -4.0]) scale([0.8, 0.65, 0.45]) sphere(1, $fn = 10);
    translate([1.6, -4.8, -9.6]) sphere(0.15, $fn = 6);
  }
  // fierce red eyes under heavy dark brows slanting down to the nose
  mirror_x() {
    eye(EYE, EYE_SIZE, iris = red, pupil = [0.25, 0, 0.02], sclera = [1, 0.93, 0.8, NOGLOW], yaw = EYE_YAW, flat = 0.5,
        lid = 0.3, lid_tilt = 30, lid_c = body, shine = true);
    color(bodyDk) translate(EYE) rotate([0, 0, EYE_YAW]) hull() {
      translate([1.4, 0.4, 1.55]) scale([0.8, 0.9, 0.45]) sphere(1, $fn = 12);
      translate([-1.2, -0.1, 0.95]) scale([0.6, 0.7, 0.35]) sphere(1, $fn = 12);
      translate([0.2, 1.3, 1.7]) scale([1.2, 0.8, 0.5]) sphere(1, $fn = 12);
    }
    // lilac mask points at the top corners of the head, lying on the skull and pointing up and out
    color(lilac) translate([3.0, -1.5, 2.6]) rotate([-28, 0, 18]) rotate([0, 38, 0]) hull() {
      scale([1.7, 0.7, 1.3]) sphere(1, $fn = 12);
      translate([0.2, 0.3, 2.0]) scale([0.5, 0.25, 0.2]) sphere(1, $fn = 6);
    }
  }
  }
  // the mane: a ring of lightning bolts round the face, swept back, a dark-gold back layer and a dark core behind
  ell([5.6, 2.8, 5.6], [0, 1.8, -0.8], mane);
  // a jagged inner ring of short wide bolts framing the face
  for (a = [0 : 24 : 336]) color(mane) translate([0, 1.4, -0.8]) rotate([0, -(a + 7), 0]) translate([2.5, 0, 0])
    bolt(5.4 + 1.2 * ((a / 24) % 2), 4.2, 2.6, (a / 24) % 2 == 0 ? 1 : -1);
  ell([7.4, 4.2, 7.4], [0, 4.6, -1.0], maneBk);
  // [angle in the face plane (0 = the creature's left, 90 = up), length, root width, zigzag side]
  BOLTS = [[107, 11.5, 4.2, 1], [73, 9.8, 4.2, -1], [38, 10.4, 4.2, 1], [14, 12.4, 4.0, -1], [-20, 10.4, 3.6, 1],
           [-62, 10.4, 3.6, -1], [-90, 12.6, 4.0, 1], [-121, 11.6, 3.8, -1], [-156, 12.4, 3.8, 1], [-143, 17.2, 4.2, -1],
           [174, 14.6, 4.0, 1], [152, 15.6, 4.2, -1], [133, 11.0, 3.8, 1]];
  for (i = [0 : len(BOLTS) - 1]) let(b = BOLTS[i])
    color(i % 2 == 0 ? mane : maneDk) translate([0, 1.5, -0.6]) rotate([0, -b[0], 0]) rotate([0, 0, 12]) translate([4, 0, 0])
      bolt(b[1] * 1.3 * (1 - 0.16 * cos(b[0])) - 4, b[2] * 1.45, 3.0, b[3]);
  // the back layer, between the front bolts, swept further back over the neck
  for (a = [0 : 30 : 330]) let(L = 9 + 2 * ((a / 30) % 3))
    color(maneOld) translate([0, 3.5, -0.8]) rotate([0, -(a + 15), 0]) rotate([0, 0, 40]) translate([5, 0, 0])
      bolt(L * 1.15 * (1 - 0.12 * cos(a + 15)), 4.0, 2.8, (a / 30) % 2 == 0 ? 1 : -1);
}
