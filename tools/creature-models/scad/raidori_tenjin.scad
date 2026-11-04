// Raidori Tenjin, rebuilt from the measurement sheet (front height 40, feet z = 0): Raidori's body and pose
// (scad/raidori.scad), turned porcelain and gold.
//
// Checklist (front sheet x, z), what the form changes:
// - Body: pale porcelain grey (#d9d9da) all over, cracked with thin gold kintsugi lines over the torso and the legs;
//   cream patches on the shoulders and the near elbow; cream paws with gold claws.
// - Face: the same squarish head in grey; serene glowing eyes (a white-cream oval rimmed in gold, no pupil) at
//   (-13.5, 28); a gold moustache bar; white sabre fangs (-14.5, 19..23) and (-10, 19..23) round a grey chin.
// - Horns: two gold horn-locks rising from the top corners of the head to (-14, 35.5) and (-10, 36) instead of the
//   lilac mask points; a gold lock over the crown sweeping back to (2, 33) and hooking up to (2, 35.5).
// - Mane: smooth flowing golden locks, not bolts: curls at (-19.5, 27) and (-19, 20.5), a long lock to (-21, 15.5),
//   a curl hooking down at (-1.5, 25), locks flowing down over the chest (-9, 14) (-4, 15); more locks behind.
// - Halo: a thin gold ring behind the head, centre (-11, 31.3), radius about 8.8, top at z 40, with a small ring and a
//   vertical line ornament at its crown.
// - Back crest: pale-gold flame blades over the hips (4..13, 18..26). Tail: porcelain grey, ending in a big cream
//   five-point star rimmed in gold (17..22, 12..20). Floating gold sparkles round it.
// - Glow: the halo, the sparkles and the eyes glow; the mane is NOGLOW (it washes out to lemon in game).
include <lib.scad>

body    = [0.85, 0.85, 0.86];
bodyDk  = [0.74, 0.74, 0.76];
crack   = [0.84, 0.66, 0.13, NOGLOW];
white   = [0.99, 0.97, 0.84, NOGLOW];
paw     = [0.99, 0.96, 0.80, NOGLOW];
gold    = [0.86, 0.66, 0.14, NOGLOW];
mane    = [0.97, 0.86, 0.42, NOGLOW];
maneDk  = [0.90, 0.70, 0.22, NOGLOW];
bladeC  = [0.98, 0.93, 0.66, NOGLOW];
star    = [0.99, 0.95, 0.75, NOGLOW];
halo    = [0.98, 0.80, 0.30, GLOW];
fang    = [1, 1, 1, NOGLOW];
chin    = [0.72, 0.72, 0.74];
mouthC  = [0.30, 0.20, 0.14];
nose    = [0.30, 0.26, 0.22];
eyeW    = [1, 0.97, 0.84, GLOW];

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
// A flowing lock of mane in the face plane (u = x, v = z), from radius 3.5 along angle `a`, bending `bend` degrees,
// `L` long, swept back `sw` per unit; `curl` = +1 / -1 rolls its tip into a hook that way, 0 leaves it pointed.
module lock(a, L, bend, curl, w, sw, c) {
  $fn = 9;
  n = 3;
  P = [for (k = [0 : n]) let(t = k / n, an = a + bend * t, r = 3.5 + L * t) [r * cos(an), r * sin(an), an]];
  E = P[n];
  T = [cos(E[2] + bend * 0.3), sin(E[2] + bend * 0.3)];
  N = [-T[1] * curl, T[0] * curl];
  C = curl == 0 ? [] : [[E[0] + T[0] * 1.6 + N[0] * 1.3, E[1] + T[1] * 1.6 + N[1] * 1.3],
                         [E[0] + T[0] * 0.8 + N[0] * 3.2, E[1] + T[1] * 0.8 + N[1] * 3.2],
                         [E[0] - T[0] * 0.8 + N[0] * 2.9, E[1] - T[1] * 0.8 + N[1] * 2.9]];
  Q = concat([for (p = P) [p[0], p[1]]], C);
  pts = [for (i = [0 : len(Q) - 1]) [Q[i][0], 1.5 + sw * norm(Q[i]), Q[i][1]]];
  rs = [for (i = [0 : len(Q) - 1]) let(t = i / (len(Q) - 1)) w * (1 - 0.6 * t)];
  chain(pts, rs, c);
}
// 2D zigzag stroke (diamond hulls) through pts with half-widths rs, for painted scars.
module zig2(pts, rs) {
  for (i = [0 : len(pts) - 2]) hull() for (j = [i, i + 1]) translate(pts[j]) circle(rs[j], $fn = 4);
}
// A flat blade of fur from p along d, w wide (along Y after the turn), t thick.
module furBlade(p, d, w, t, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    scale([t, w, 0.6]) sphere(1, $fn = 12);
    translate([0, 0, l]) sphere(0.12, $fn = 6);
  }
}

// ---- torso: long along Y, chest a little higher than the tucked waist, then the rump.
TORSO = [[[6.0, 6.2, 6.2], [0, -9, 18.8]], [[5.4, 7, 5.4], [0, 1, 18.6]], [[5.8, 6.2, 6.0], [0, 11, 19]]];
blob(TORSO, body);
// Gold kintsugi cracks over the torso, painted flush on it: down the flanks and along the spine.
color(crack) intersection() {
  hull() for (e = TORSO) translate(e[1]) scale(e[0] + [0.18, 0.18, 0.18]) sphere(1, $fn = 18);
  mirror_x() translate([3.2, -30, 0]) cube([10, 60, 40]);
  rotate([90, 0, 90]) linear_extrude(height = 30, center = true) {
    zig2([[-9, 24.5], [-7.4, 21], [-8.2, 18.5], [-6.6, 14.5]], [0.3, 0.3, 0.3, 0.2]);
    zig2([[-3.5, 25], [-2.2, 21.5], [-3.4, 19], [-1.2, 15.5], [-2, 13]], [0.3, 0.3, 0.3, 0.3, 0.2]);
    zig2([[2, 24.8], [3.4, 21], [2.6, 18.6], [4.4, 14]], [0.3, 0.3, 0.3, 0.2]);
    zig2([[8, 25], [9.2, 21.4], [8.4, 18.8], [10.2, 15]], [0.3, 0.3, 0.3, 0.2]);
    zig2([[13.5, 24], [14.2, 20.5], [13.4, 17]], [0.3, 0.3, 0.2]);
    zig2([[-3.4, 19], [0, 19.6], [2.6, 18.6]], [0.25, 0.25, 0.2]);
    zig2([[8.4, 18.8], [11, 19.8], [13.4, 17]], [0.25, 0.25, 0.2]);
  }
}
color(crack) intersection() {
  hull() for (e = TORSO) translate(e[1]) scale(e[0] + [0.18, 0.18, 0.18]) sphere(1, $fn = 18);
  linear_extrude(height = 40)
    zig2([[0, -14], [1.5, -9], [-1, -4], [1, 2], [-0.8, 8], [1.2, 14], [0, 17]], [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2]);
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
  for (a = [-1, 0, 1]) color(gold) translate(foot + [a * 1.1, -3.4, -0.6]) rotate([90, 0, 0]) cylinder(h = 0.9, r1 = 0.55, r2 = 0.1, $fn = 8);
  // a thin gold band where the paw meets the leg
  color(gold) translate(foot + [0, -0.2, 1.3]) scale([2.45, 2.75, 0.35]) sphere(1, $fn = 20);
  // gold cracks down the leg, on both its sides
  color(crack) intersection() {
    union() {
      hull() { translate(hip) sphere(front ? 3.86 : 4.36); translate(knee) sphere(2.86); }
      hull() { translate(knee) sphere(2.86); translate(foot + [0, 0, 0.6]) sphere(2.46); }
    }
    translate([s > 0 ? hip[0] + 1.6 : hip[0] - 11.6, -30, 0]) cube([10, 60, 40]);
    translate([0, knee[1], 0]) rotate([90, 0, 90]) linear_extrude(height = 30, center = true)
      zig2([[-1.2, 15], [0.6, 12], [-0.8, 9], [0.8, 6], [-0.4, 3.2]], [0.26, 0.26, 0.26, 0.26, 0.18]);
  }
  // white patch on the front of the upper leg
  mid = (hip + knee) / 2;
  s = sign(hip[0]);
  color(white) translate(mid + [s * 1.4, front ? -2.2 : -2.8, front ? 0.2 : 0.8])
    rotate([front ? 10 : -12, 0, s * 24]) scale([2.2, 0.9, 3.2]) sphere(1, $fn = 16);
}
for (l = LEGS) leg(l);

// ---- back crest: pale-gold flame blades over the hips, sweeping up and back.
for (b = [[0, 5, 23.6, [0, 2.4, 3.2], 1.5], [1.2, 8, 23.6, [0.5, 3, 3.8], 1.7], [-1.2, 8.5, 23.6, [-0.5, 3, 3.6], 1.6],
          [0, 11.5, 23.6, [0, 3.6, 4.2], 1.7], [0, 14.5, 22.6, [0, 3.6, 3.0], 1.4]])
  furBlade([b[0], b[1], b[2]], b[3] * 1.25, b[4] * 1.15, 0.8, bladeC);

// ---- tail: rises from the rump, arcs back and out to the near side, hangs down to the star.
TAIL = [[0.6, 17.5, 22], [1.8, 20.5, 25.2], [3.8, 22.5, 27.2], [5.9, 23.6, 27.4], [7.4, 24.2, 25.8], [7.9, 24.2, 23],
        [7.8, 24, 20.2], [8.0, 24, 18.0]];
TAIL_R = [1.5, 1.25, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85];
chain(TAIL, TAIL_R, bodyDk);
// A big five-point star, cream, rimmed in gold, thick, facing the camera.
STAR = [8.3, 24, 14.6];
module star5(r, t) {
  for (a = [0 : 72 : 288]) rotate([0, a, 0]) hull() {
    scale([r * 0.42, t, r * 0.42]) sphere(1, $fn = 10);
    translate([0, 0, r]) scale([0.2, t * 0.35, 0.2]) sphere(1, $fn = 6);
  }
}
translate(STAR) rotate([0, 0, 30]) rotate([0, 8, 0]) {
  color(star) star5(4.4, 1.0);
  color(gold) star5(4.75, 0.6);
}

// Floating gold sparkles round it (four-point twinkles).
module twinkle(r) {
  for (a = [0, 90]) rotate([0, a, 0]) scale([r, 0.25, 0.22 * r]) sphere(1, $fn = 8);
}
for (p = [[-14, -14, 25], [4, -14, 37], [6.5, -9, 30], [3.5, -4, 28.5], [-13, -6, 15], [13, 6, 22]])
  color(halo) translate(p) rotate([0, 0, 30]) twinkle(p[2] > 30 ? 1.0 : 1.3);

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
  ell([2.3, 2.5, 1.35], [0, -4.0, -6.0], chin);
  mirror_x() color(fang) hull() {
    translate([1.8, -5.1, -4.0]) scale([0.8, 0.65, 0.45]) sphere(1, $fn = 10);
    translate([1.6, -4.8, -9.6]) sphere(0.15, $fn = 6);
  }
  // serene glowing eyes rimmed in gold, under thin gold brows
  mirror_x() {
    // a cream oval set in a gold rim, no pupil, a thin gold brow over it
    translate(EYE) rotate([0, 0, EYE_YAW]) {
      color(gold) scale([1.12, 0.5, 1.3]) sphere(EYE_SIZE, $fn = 18);
      color(eyeW) translate([0, -EYE_SIZE * 0.12, 0]) scale([0.88, 0.5, 1.08]) sphere(EYE_SIZE, $fn = 18);
      color(gold) hull() {
        translate([1.2, 0.0, 1.85]) scale([0.5, 0.5, 0.22]) sphere(1, $fn = 8);
        translate([-1.1, -0.3, 1.45]) scale([0.4, 0.4, 0.18]) sphere(1, $fn = 8);
      }
    }
    // gold horn-locks rising from the top corners of the head, curving out then in
    chain([[2.8, -1.4, 2.6], [3.4, -1.2, 4.6], [3.5, -0.8, 6.6], [2.9, -0.4, 8.2]], [1.15, 0.95, 0.65, 0.25], mane);
  }
  }
  // the mane: smooth flowing golden locks round the face, curling at the tips, more behind; a gold lock over the crown
  ell([6.8, 3.2, 7.2], [-0.4, 2.2, -1.2], mane);
  // [angle in the face plane (0 = the creature's left, 90 = up), length, bend, curl, width, sweep back]
  LOCKS = [[180, 7.5, -12, -1, 1.9, 0.18], [214, 8.5, 14, 1, 1.9, 0.18], [226, 11.5, -10, 0, 2.0, 0.15],
           [266, 10.5, 10, 0, 2.2, 0.1], [298, 10.5, -14, 0, 2.0, 0.15], [-14, 7.5, -10, -1, 2.0, 0.2],
           [160, 6.5, 18, 1, 1.6, 0.2], [244, 9, -8, 1, 1.7, 0.2], [320, 8, 10, 1, 1.6, 0.25], [196, 7, 8, 0, 1.6, 0.3]];
  for (i = [0 : len(LOCKS) - 1]) let(l = LOCKS[i])
    translate([0, 0, -0.8]) lock(l[0], l[1] * (1 - 0.12 * cos(l[0])), l[2], l[3], l[4] * 1.5, l[5], i % 2 == 0 ? mane : maneDk);
  // the crown lock: over the top of the head, back along the creature's left, hooking up
  chain([[-1.5, -0.6, 4.6], [2.5, 0.2, 5.0], [6.5, 1.6, 4.4], [9.5, 2.8, 4.0], [11.4, 3.4, 5.0], [11.8, 3.6, 6.4]],
        [1.05, 1.1, 1.05, 0.9, 0.7, 0.3], mane);
  // the back locks, swept back over the neck
  for (a = [10, 160, 210, 260, 310]) translate([0, 2, -0.8]) lock(a, 6.5 + 1.5 * ((a / 10) % 2), 20, (a / 10) % 2 == 0 ? 1 : -1, 2.2, 0.7, maneDk);
  // the halo: a thin gold ring standing behind the head, a small ring and a line at its crown
  translate([-1.5, 2.6, 2.2]) rotate([90, 0, 0]) {
    color(halo) rotate_extrude($fn = 44) translate([10.4, 0]) circle(0.42, $fn = 6);
    color(halo) translate([0, 5.0, 0]) rotate_extrude($fn = 20) translate([1.2, 0]) circle(0.2, $fn = 6);
    color(halo) translate([0, 5.0, 0]) cube([0.25, 9.4, 0.25], center = true);
  }
}
