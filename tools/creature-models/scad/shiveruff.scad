// Shiveruff, rebuilt from the measurement sheet (front height 40, feet z = 0).
//
// Checklist (front sheet x, z):
// - Body plan: a chibi arctic fox pup on four short stubby legs in a wide playful stance, a HUGE head (x -20..9,
//   z 16..40 with the ears), a small white body, a big fluffy cyan ruff round the neck and chest, a big round snowball
//   tail swung out to its left (+X) behind the rump. Drawn a little side-on: the head turned 15 degrees to its right.
// - Face: two big round all-iris blue eyes (near at (-5.5, 24.7), 5 x 4.6; far at (-15.3, 25.2), seen narrower), a
//   thick navy outline heavier along the top, a navy oval pupil, a big white glint upper left, a pale cyan crescent
//   low in the iris. A navy oval nose (-13, 22). A wide open happy mouth below it (x -13.5..-7.4, z 16.6..21.2): a
//   D shape with a straight upper lip, dark red inside, a lighter tongue, two small upper fangs at the corners and two
//   lower fangs. Cyan slanted brow marks over each eye.
// - Ears: tall pointed fox ears splayed wide: the far one a white point (tip (-18.4, 40)) lined with a cyan crystal
//   and a second crystal at its inner base; the near one (to (9, 35)) sheathed in crystal plates on the outside, their
//   points stepping down its outer edge (tips (6.6, 39.4), (9, 34.7), (7, 31.5)). Two small crystals on the crown between the ears (x -8..-1, z 30..37).
// - Cheeks: white fluffy lobes flaring out on both sides of the face, down to the ruff.
// - Ruff: cyan (#90e8f6) feathers with mid-blue shading, a big collar (x -19.6..6.6, z 9.6..22), longest on the chest.
// - Body: white with lavender shading underneath; the legs white to z 6, then navy socks with a jagged white top edge
//   and big navy paws: near front (0, 0..6), far front (-14, 2..8), near back (12.5, 3..9), far back hidden.
// - Tail: a big ball (centre (14, 22), r 6.5): white on top, blue-cyan on its lower half with a feathered edge.
// - Back art: the same ball tail on the creature's left, four navy socks, the ruff round the neck.
// - Glow: none in the sprite: every bright colour NOGLOW.
include <lib.scad>

fur      = [0.92, 0.97, 0.99];
furShade = [0.74, 0.83, 0.95];
ruffC    = [0.57, 0.91, 0.97, NOGLOW];
ruffMid  = [0.38, 0.72, 0.86, NOGLOW];
ruffPale = [0.76, 0.93, 0.99, NOGLOW];
iceC     = [0.57, 0.91, 0.97, NOGLOW];
iceDeep  = [0.40, 0.72, 0.90, NOGLOW];
tailBlue = [0.47, 0.77, 0.90, NOGLOW];
paw      = [0.13, 0.26, 0.48];
pawHi    = [0.26, 0.46, 0.66];
navy     = [0.06, 0.10, 0.31];
iris     = [0.30, 0.60, 0.86, NOGLOW];
irisLo   = [0.62, 0.92, 0.98, NOGLOW];
mouthC   = [0.62, 0.12, 0.16, NOGLOW];
tongue   = [0.86, 0.36, 0.36, NOGLOW];

// A soft lock of fur: a leaf from its base `p` along `d` (its length), `w` wide, `th` as thick, a rounded tip.
module tuft(p, d, w, c, th = 0.4, fn = 10) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    translate([0, 0, l * 0.4]) scale([w * th, w, l * 0.4]) sphere(1, $fn = fn);
    translate([0, 0, l * 0.84]) scale([w * th * 0.6, w * 0.45, l * 0.16]) sphere(1, $fn = 8);
  }
}

// A smooth ellipsoid (the big round parts, finer than lib's ell).
module sell(r, p, c, fn = 40) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// An ice crystal shard: a flattened hexagonal prism from p along d with a pointed tip, `r` wide, `f` as thick.
module shard(p, d, r, c, f = 0.55) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) scale([f, 1, 1]) hull() {
    cylinder(h = l * 0.62, r1 = r * 0.75, r2 = r, $fn = 6);
    translate([0, 0, l]) sphere(0.08, $fn = 4);
  }
}

// ---- Head, in its own frame: centre HC, turned HEAD_YAW (towards the creature's right, the face to the viewer's left)
HC = [-1.7, -10.5, 25];
HEAD_YAW = -15;
HEAD = [11, 8.5, 8.3];
// big round shiny pup eye, looking along -Y, turned `yaw`; the pupil a little towards +X (the viewer in game)
EYE = [6.5, -6.5, 0.3];
EYE_SIZE = 2.7;
EYE_YAW = 12;
module pupEye(p, s, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(navy) scale([1, 0.42, 1.08] * s) sphere(1, $fn = 24);
    color(iris) translate([0.04 * s, -0.1 * s, -0.06 * s]) scale([0.87, 0.38, 0.92] * s) sphere(1, $fn = 22);
    color(irisLo) translate([0.06 * s, -0.22 * s, -0.52 * s]) scale([0.62, 0.22, 0.34] * s) sphere(1, $fn = 14);
    color(navy) translate([0.16 * s, -0.3 * s, 0]) scale([0.42, 0.2, 0.54] * s) sphere(1, $fn = 14);
    color("white") translate([-0.3 * s, -0.42 * s, 0.34 * s]) scale([0.34, 0.12, 0.34] * s) sphere(1, $fn = 12);
    color("white") translate([0.42 * s, -0.4 * s, -0.4 * s]) scale([0.14, 0.1, 0.14] * s) sphere(1, $fn = 8);
  }
}
module headAt() { translate(HC) rotate([0, 0, HEAD_YAW]) children(); }

// the mouth: a crescent smile cut into the muzzle front, seen along -Y; MOUTH is its centre
MOUTH = [1, -8.9, -4.6];
MOUTH_YAW = 18;
module smile2d() {
  difference() {
    scale([3.5, 2.5]) circle(1, $fn = 32);
    translate([0, 1.95]) scale([4.6, 2.05]) circle(1, $fn = 32);
  }
}

// ears: base and tilt in the head frame (the near one, +X; mirrored); in the ear's frame Z runs up the ear, -Y is
// its front face, +X its outer edge
EAR_B = [6.2, 0.4, 5.6];
EAR_TILT = 37;
EAR_L = 12.4;
module earAt() { translate(EAR_B) rotate([0, EAR_TILT, 0]) children(); }

headAt() {
  // a big smooth round head, full lower cheeks, a short pointed fox muzzle and the chin, the smile cut in
  difference() {
    union() {
      sell(HEAD, [0, 0, 0], fur, 44);
      sell([10.6, 7.2, 5.6], [0, -0.6, -3.4], fur, 40);
      color(fur) hull() {
        translate([0, -5.2, -3.4]) scale([4.8, 3.6, 3.4]) sphere(1, $fn = 32);
        translate([0, -9.4, -3]) scale([1.6, 1.3, 1.3]) sphere(1, $fn = 18);
      }
      color(fur) hull() {
        translate([0.3, -4.8, -5.8]) scale([4.6, 3.6, 2.6]) sphere(1, $fn = 28);
        translate([0.6, -8.4, -6]) scale([2.4, 1.4, 1.4]) sphere(1, $fn = 16);
      }
    }
    color(mouthC) translate(MOUTH) rotate([0, 0, MOUTH_YAW]) translate([0, 3, 0]) rotate([90, 0, 0]) linear_extrude(height = 8) smile2d();
  }
  // the nose on the muzzle tip
  sell([1.45, 0.95, 0.95], [0, -10.2, -2.5], navy, 18);
  // a tongue low in the smile and two small upper fangs at its corners
  color(tongue) translate(MOUTH + [0.4, 2.2, -1.4]) scale([2, 1.2, 0.7]) sphere(1, $fn = 14);
  translate(MOUTH) rotate([0, 0, MOUTH_YAW]) mirror_x() spike([2.2, 1.4, 0.5], [0, -0.1, -1], 0.42, 0.05, "white");
  // eyes (the big glint upper left on both, a small one lower right)
  pupEye(EYE, EYE_SIZE, EYE_YAW);
  pupEye([-EYE[0], EYE[1], EYE[2]], EYE_SIZE, -EYE_YAW);
  // cyan brow marks over the eyes, painted flush on the head
  mirror_x() color(ruffC) intersection() {
    scale(HEAD + [0.12, 0.12, 0.12]) sphere(1, $fn = 44);
    translate([5.2, -6, 5.4]) rotate([0, -35, 14]) scale([1.6, 3, 0.6]) sphere(1, $fn = 12);
  }
  // cheeks: soft white locks sticking out and down, and fluff along the jaw
  mirror_x() {
    tuft([8.8, -2.2, -3.2], [3.4, 0.4, -1.8], 3.6, fur, 0.5, 16);
    tuft([9.6, 0.4, -0.4], [3.4, 1, 0.4], 3.4, fur, 0.5, 16);
    tuft([9, 2.6, 2.8], [2.6, 1.2, 1.4], 3, fur, 0.5, 16);
  }
  // fluff on the crown and the back of the head
  tuft([0, -1, 7.4], [0, -0.4, 2.2], 2, fur, 0.45, 10);
  for (x = [-4, 4]) tuft([x, 5, 4.6], [x * 0.2, 2.4, 1.2], 2.4, fur, 0.45, 10);
  // ears: tall pointed fox ears, white with a cyan crystal lining, sheathed in crystal plates on the outside
  mirror_x() earAt() {
    color(fur) hull() {
      translate([0, 0, 1]) scale([4.4, 1.9, 3.2]) sphere(1, $fn = 20);
      translate([0, -0.2, EAR_L * 0.55]) scale([2.2, 1.2, 2]) sphere(1, $fn = 14);
      translate([0, -0.2, EAR_L]) sphere(0.4, $fn = 8);
    }
    // the lining, a faceted crystal down the front face
    shard([-0.2, -1.4, 0.6], [0, -0.3, EAR_L * 0.86], 2.7, iceC, 0.38);
    // crystal plates on the back and the outer edge, running up the ear, their points stepping down the outer edge
    shard([1.2, 1, 0.8], [0.7, 0.2, EAR_L * 0.92], 2.3, iceDeep, 0.42);
    shard([3, 0.6, 0.4], [2.2, 0.2, EAR_L * 0.68], 2, iceC, 0.42);
    shard([4.2, 0.2, -0.2], [3, 0, EAR_L * 0.45], 1.7, iceDeep, 0.42);
    // a crystal at the ear's inner base
    shard([-3.2, -0.5, 0.4], [-0.4, -0.2, 6.6], 2, iceDeep, 0.45);
  }
  // a small crystal on the crown
  shard([2.8, -3.8, 6.8], [0.2, -0.6, 2.8], 1.7, iceC, 0.55);
}

// ---- Ruff: a big fluffy collar of soft blue, cyan and white locks round the neck and over the chest
RC = [-1, -9.5, 15.6];
sell([9.4, 8, 6], RC, ruffC, 32);
// top ring: locks flaring out round the jaw
for (i = [0 : 11]) let(a = i * 30, d = [cos(a), sin(a), 0]) if (sin(a) > -0.8)
  tuft(RC + [d[0] * 6.6, d[1] * 5.4, 1.8], [d[0] * 5, d[1] * 4, -0.8], 3.6, i % 3 == 0 ? ruffPale : ruffC, 0.42, 10);
// middle ring: long locks out and down
for (i = [0 : 11]) let(a = i * 30 + 15, d = [cos(a), sin(a), 0])
  tuft(RC + [d[0] * 7.4, d[1] * 6.2, 0], [d[0] * 5, d[1] * 4, -4], 3.8, i % 2 == 0 ? ruffMid : ruffC, 0.42, 10);
// lower ring: the longest locks hanging over the chest and shoulders
for (i = [0 : 11]) let(a = i * 30, d = [cos(a), sin(a), 0])
  if (sin(a) < 0.6) tuft(RC + [d[0] * 6.4, d[1] * 5.4, -3], [d[0] * 3, d[1] * 2.6, -5.6], 3.4, i % 3 == 0 ? ruffPale : ruffC, 0.42, 10);
// the bib on the chest
for (x = [-5 : 2.5 : 2.5]) tuft([x, -15.2, 13.8], [x * 0.15, -0.8, -5.6], 2.8, abs(x) == 2.5 ? ruffMid : ruffC, 0.42, 10);

// ---- Body: small, white, lavender underneath
color(fur) hull() {
  translate([0, -4.5, 12.6]) scale([7, 7, 6.6]) sphere(1, $fn = 36);
  translate([0, 6.5, 12.4]) scale([7, 6.6, 6.4]) sphere(1, $fn = 36);
}
ell([5, 8.6, 2.4], [0, 0.5, 6.8], furShade);
// fluffy flank and haunch lobes
mirror_x() {
  tuft([6.2, 1.5, 10], [1.2, 1, -3], 2.8, fur, 0.45, 10);
  sell([4.8, 5.4, 5.6], [4.6, 8, 11.2], fur, 32);
}

// ---- Legs: short and stubby, white to z 6, then a navy sock with a jagged white top and a big navy paw
module leg(hip, foot) {
  knee = [hip[0] + (foot[0] - hip[0]) * 0.45, hip[1] + (foot[1] - hip[1]) * 0.45, 5.6];
  limb(hip, knee, 3.3, 3, fur);
  limb(knee, foot + [0, 0, 1.8], 3, 3, paw);
  color(paw) translate(foot + [0, -0.8, 1.5]) scale([3.3, 3.9, 1.7]) sphere(1, $fn = 18);
  color(pawHi) translate(foot + [0, -3.1, 1.8]) scale([2.2, 1.3, 1]) sphere(1, $fn = 12);
  for (a = [0 : 60 : 300]) tuft(knee + [cos(a) * 2.6, sin(a) * 2.6, 1.6], [cos(a) * 0.4, sin(a) * 0.4, -2.4], 1.7, fur, 0.4, 8);
}
LEGS = [
  [[4.2, -5.6, 9.5], [5.2, -8.8, 0]],     // near front (+X)
  [[-4.2, -5.6, 9.5], [-8.4, -10.6, 0]],  // far front, splayed forward and out
  [[4.6, 6.6, 9.5], [7.2, 12, 0]],      // near back, splayed back
  [[-4.4, 6.6, 9.5], [-4.8, 9.6, 0]],     // far back
];
for (l = LEGS) leg(l[0], l[1]);

// ---- Tail: a big snowball on a fluffy stalk, swung out to the left; blue on its lower half with a feathered edge
TB = [8, 14, 20.5];
TR = 7.2;
TAIL_TILT = [-22, 0, 30];
limb([2, 9, 15], TB, 3.2, 3.8, fur);
sell([TR, TR, TR], TB, fur, 40);
// the blue lower half, painted flush on the ball, with a ring of feather points rising into the white
color(tailBlue) translate(TB) rotate(TAIL_TILT) intersection() {
  sphere(TR + 0.12, $fn = 40);
  union() {
    translate([-10, -10, -20 - 0.6]) cube(20);
    for (i = [0 : 15]) let(a = i * 360 / 16) translate([cos(a) * TR * 0.92, sin(a) * TR * 0.92, -1.2]) cylinder(h = 3.4 + (i % 2) * 0.9, r1 = 1.3, r2 = 0, $fn = 6);
  }
}
