// Murmink: a lanky charcoal imp crouched to pounce, a big white shield mask for a face with angry red eyes in black
// sockets, big pointed ears (blue inside), a blue flame of hair rising off the forehead and a flame mane streaming
// down its back, long clawed hands held out wide trailing fans of iridescent threads, and a hooked tail.
//
// Checklist (front sheet, 40 units tall):
//   head    mask x -8.7..-1, z 21.4..30.8 (centre x -4.8): a shield with two points at the top, a dip where the
//           flame hair sits, the chin a sharp point. Head hunched forward and turned to the camera.
//   eyes    two red almond eyes in black sockets, outer corners high (an angry V), close set, slit pupils
//   ears    big dark triangles, tips (-11, 34.6) and (3.9, 34.5), blue inside
//   hair    a blue flame (indigo edge, light blue body, cyan core) from the mask's dip up and to the right, tip (1.2, 39.8)
//   ruff    dark jagged cheek tufts and collar under the mask
//   torso   z 13..24, narrow chest, round belly and hips
//   arms    out wide, hands at (-14.5, 23) and (9.5, 22) with long hooked claws drooping
//   threads fans of white / pink / cyan strands from the claws down to (-18, 8) and (18, 13)
//   legs    crouched, knees out, thin digitigrade shins, clawed feet
//   tail    from the near hip out right, a hook curling down: (12, 13) (15, 8.5) (10, 5.6)
//   back    the flame mane down the whole back to the hips, flaring at the waist to the creature's +X side
include <lib.scad>

skin = [0.22, 0.2, 0.28];
claw = [0.16, 0.13, 0.19];
mask = [0.93, 0.92, 0.94];
ink = [0.06, 0.05, 0.09];
red = [0.86, 0.14, 0.14, NOGLOW];
flameDk = [0.27, 0.36, 0.7];
flame = [0.29, 0.54, 0.82, NOGLOW];
cyan = [0.29, 0.81, 0.9, NOGLOW];
threads = [[0.93, 0.94, 0.92], [0.83, 0.77, 0.81], [0.73, 0.9, 0.87, NOGLOW], [0.67, 0.66, 0.69], [0.88, 0.85, 0.88]];

// A flame: a chain of ellipsoids flattened along y (broad from the front and the back), hulled pairwise.
module flame(pts, rs, flat, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) scale([rs[i], rs[i] * flat, rs[i]]) sphere(1, $fn = 16);
    translate(pts[i + 1]) scale([rs[i + 1], rs[i + 1] * flat, rs[i + 1]]) sphere(1, $fn = 16);
  }
}
// A thread: a flat ribbon through three points.
module strand(a, b, c, w, col) {
  color(col) for (s = [[a, b], [b, c]]) hull() for (p = s) translate(p) scale([w, 0.12, w]) sphere(1, $fn = 8);
}

// ---- Head frame: hunched forward, turned 15 degrees to the camera. Everything in it is head-local.
HEAD_T = [-1.5, -4, 27];
HEAD_R = [0, 0, 15];
HEAD_S = 1.06;
module headFrame() { translate(HEAD_T) rotate(HEAD_R) scale(HEAD_S) children(); }

// The skull with its chin point (the mask's shape follows it).
module skull(g = 0) {
  hull() {
    scale([4.2 + g, 4 + g, 4.4 + g]) sphere(1, $fn = 32);
    translate([0, -2.6, -4.4]) scale([1.2 + g, 1.3 + g, 1.3 + g]) sphere(1, $fn = 16);
  }
}
// The prism of a head-local [x, z] outline, through the front of the head only.
module front(pts) { translate([0, -0.5, 0]) rotate([90, 0, 0]) linear_extrude(height = 12) polygon(pts); }

MASK = [[0, 1.4], [1.5, 2.1], [2.9, 3.9], [3.7, 3.7], [4.2, 1.2], [4.0, -1.0], [3.1, -3.0], [1.5, -4.6], [0, -5.9],
        [-1.5, -4.6], [-3.1, -3.0], [-4.0, -1.0], [-4.2, 1.2], [-3.7, 3.7], [-2.9, 3.9], [-1.5, 2.1]];
SOCKET = [[0.3, -1.65], [1.9, -1.75], [3.4, -0.7], [3.8, 1.3], [2.0, 0.65], [0.4, -0.5]];
EYE = [[0.8, -1.3], [2.0, -1.35], [3.1, -0.4], [3.3, 0.8], [2.1, 0.25], [0.9, -0.6]];
PUPIL = [[1.85, -1.05], [2.3, -1.0], [2.35, 0.15], [1.95, 0.05]];

headFrame() {
  color(skin) skull();
  // the mask, a shell on the front of the skull
  color(mask) intersection() { skull(0.22); front(MASK); }
  // painted face: black sockets, red eyes, slit pupils, both sides
  mirror_x() {
    color(ink) intersection() { skull(0.34); front(SOCKET); }
    color(red) intersection() { skull(0.44); front(EYE); }
    color(ink) intersection() { skull(0.52); front(PUPIL); }
  }
  // ears: big thin triangles up and out, blue inside
  mirror_x() {
    color(skin) hull() {
      translate([3.1, 0.6, 2.2]) scale([2.7, 0.75, 2.3]) sphere(1, $fn = 18);
      translate([7.4, 1.4, 7.8]) sphere(0.25, $fn = 8);
    }
    color(flameDk) hull() {
      translate([3.6, 0.05, 2.7]) scale([1.8, 0.4, 1.5]) sphere(1, $fn = 14);
      translate([6.3, 0.9, 6.6]) sphere(0.15, $fn = 8);
    }
  }
  // cheek tufts below the ears
  mirror_x() for (t = [[[3.4, 0.4, -1.6], [2.3, 0.6, -1.3]], [[3.0, 0.2, -3.2], [1.6, 0.4, -1.9]]])
    color(skin) hull() {
      translate(t[0]) scale([1.3, 0.7, 1.1]) sphere(1, $fn = 12);
      translate(t[0] + t[1]) sphere(0.12, $fn = 6);
    }
  // flame hair: indigo outer, light blue body, cyan core, rising from the mask's dip up and to the right
  flame([[0.4, -1.4, 3.8], [1.0, -0.6, 7.0], [2.6, 0.2, 9.6], [4.4, 0.8, 11.8], [6.1, 1.2, 13.1]], [3.1, 2.4, 1.7, 1.0, 0.25], 0.62, flameDk);
  flame([[0.4, -1.2, 4.2], [-1.6, -0.6, 5.8], [-1.9, -0.2, 7.2]], [2.4, 1.3, 0.3], 0.6, flameDk);
  flame([[0.3, -2.3, 3.7], [1.0, -1.5, 6.6], [2.4, -0.8, 8.9], [3.2, -0.3, 10.2]], [2.7, 1.9, 1.1, 0.3], 0.55, flame);
  flame([[0.0, -3.3, 3.6], [0.8, -2.5, 6.2], [1.6, -1.9, 7.8]], [2.1, 1.3, 0.35], 0.45, cyan);
}

// ---- Torso: narrow chest leaning forward, round belly and hips, a neck up into the head.
blob([[[4.0, 3.3, 3.4], [0, -0.6, 21.3]], [[3.9, 3.3, 2.8], [0, -0.2, 17.5]], [[4.6, 3.6, 3.3], [0, 0.3, 14]]], skin);
limb([0, -0.8, 22.5], [-0.8, -3, 25.5], 2.3, 2.0, skin);
// collar ruff: jagged dark points round the neck under the mask
for (a = [-70, -35, 0, 35, 70]) color(skin) hull() {
  translate([2.6 * sin(a) - 0.5, -2.2 * cos(a) - 1.2, 23.6]) scale([1.1, 0.8, 0.9]) sphere(1, $fn = 10);
  translate([3.8 * sin(a) - 0.5, -3.2 * cos(a) - 1.2, 21.6]) sphere(0.12, $fn = 6);
}

// ---- Back mane: a thick flame from the back of the head down the spine to the hips, flaring at the waist to +X.
flame([[0.5, 2.8, 31], [2.2, 4.8, 27], [0.6, 5.2, 23], [2.4, 5.2, 19.5], [4.6, 4.8, 15], [7.5, 3.6, 12.5], [8.6, 2.6, 10.4]],
      [4.2, 4.2, 3.0, 2.8, 3.6, 1.8, 0.35], 0.4, flameDk);
// ragged flame tips off the mane's edges
flame([[1.0, 4.8, 27.5], [-2.6, 4.8, 26.2], [-3.8, 4.4, 24.0]], [2.0, 1.2, 0.3], 0.5, flameDk);
flame([[2.0, 5.2, 21.5], [5.2, 4.8, 20.2], [6.4, 4.2, 18.4]], [1.6, 0.9, 0.25], 0.5, flameDk);
flame([[3.0, 5.0, 14.0], [0.4, 5.0, 12.2], [-0.4, 4.6, 10.4]], [1.8, 1.0, 0.3], 0.5, flameDk);
flame([[0.5, 3.6, 30], [2.2, 5.6, 26.5], [0.9, 6.2, 23], [2.6, 6.1, 19.5], [4.6, 5.7, 15]],
      [3.3, 3.3, 2.2, 2.1, 2.7], 0.4, flame);
flame([[0.6, 4.6, 28.5], [2.0, 6.7, 26], [1.2, 7.1, 23.2]], [1.6, 1.5, 0.4], 0.4, cyan);
flame([[3.6, 6.6, 15.5], [5.8, 5.6, 13.2]], [1.1, 0.4], 0.4, cyan);
// the flame tongue curling out over the near shoulder (front sheet x 4..10, z 26..31), cyan tip
flame([[2.0, 4.2, 27], [5.5, 4.0, 27.6], [8.0, 3.4, 29.6], [8.6, 2.8, 31.4]], [2.1, 1.5, 0.9, 0.3], 0.55, flameDk);
flame([[6.4, 3.2, 28.4], [8.1, 2.7, 30.0], [8.5, 2.4, 31.3]], [0.9, 0.6, 0.2], 0.5, cyan);

// ---- Arms: out wide, elbows low, the hands held up with long claws drooping.
mirror_x() {
  limb([3.6, -0.4, 22.5], [8.5, -1.5, 19.5], 1.75, 1.3, skin);
  limb([8.5, -1.5, 19.5], [12, -4, 22], 1.3, 1.15, skin);
  ell([2.0, 1.8, 1.8], [13, -5, 22.6], skin);
  for (d = [-1.5, -0.5, 0.5, 1.5])
    chain([[13 + d, -6.0, 23.3], [13 + d * 1.25, -7.5, 23.7], [13 + d * 1.4, -8.4, 21.6], [13 + d * 1.45, -8.0, 19.8]],
          [0.58, 0.48, 0.32, 0.08], claw);
}

// ---- Threads: fans of iridescent strands from the claw tips, hanging down and out (front sheet outlines).
// near (+X) fan: bottoms at sheet (6.8, 6.6) .. (18.4, 13.2), at depth y = -6
NEAR = [[11.3, 6.6], [13.2, 8.0], [15.0, 9.6], [16.9, 11.2], [18.9, 12.6], [21.0, 13.4], [22.9, 13.6], [24.7, 13.2]];
for (i = [0 : len(NEAR) - 1]) {
  top = [11.0 + i * 0.6, -7.9, 20.0];
  bot = [NEAR[i][0], -6, NEAR[i][1]];
  strand(top, (top + bot) / 2 + [0.7, -0.4, 0.4], bot, 0.3, threads[i % 5]);
}
strand([12.6, -7.2, 14.0], [17.5, -6.6, 13.6], [24.5, -6, 13.4], 0.22, threads[2]);
// far (-X) fan: bottoms at sheet (-18.3, 7.8) .. (-12, 12.6)
FAR = [[-17.7, 7.8], [-16.6, 8.8], [-15.5, 9.8], [-14.2, 10.6], [-12.9, 10.6], [-11.7, 11.2], [-10.4, 12.6]];
for (i = [0 : len(FAR) - 1]) {
  top = [-15.0 + i * 0.6, -7.9, 20.0];
  bot = [FAR[i][0], -6, FAR[i][1]];
  strand(top, (top + bot) / 2 + [-0.7, -0.4, 0.4], bot, 0.3, threads[(i + 2) % 5]);
}
strand([-17.2, -6.6, 10.0], [-14.5, -6.8, 13.0], [-11.4, -7.0, 15.4], 0.22, threads[0]);

// ---- Legs: crouched, knees out, thin digitigrade shins, long clawed feet.
mirror_x() {
  limb([3.0, 0.3, 13.2], [7.4, -2.0, 9.4], 3.2, 2.0, skin);
  limb([7.4, -2.0, 9.4], [7.6, 0.8, 3.4], 1.6, 1.05, skin);
  limb([7.6, 0.8, 3.4], [8.0, -1.2, 0.9], 1.0, 0.95, skin);
  ell([1.5, 2.4, 0.9], [8.0, -2.2, 0.9], skin);
  for (a = [-30, 0, 30]) spike([8.0 + 1.0 * sin(a), -3.8, 0.8], [1.0 * sin(a), -1.5, -0.6], 0.42, 0.06, claw);
}

// ---- Tail: from the near hip out to the right, hooking down and back in.
chain([[2.0, 3.0, 13], [8, 5, 12.5], [12, 4.5, 13], [15, 3, 10.5], [14.5, 1.5, 7], [11.5, 0.5, 5.5]],
      [1.6, 1.55, 1.6, 1.5, 1.1, 0.3], skin);
