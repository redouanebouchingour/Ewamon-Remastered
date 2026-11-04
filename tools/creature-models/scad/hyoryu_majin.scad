// Hyoryu Majin: the corrupted form (2026-11-04 sprite-match remodel), Hyoryu's body and pose (scad/hyoryu.scad) with:
// - the body deep blue-teal, red spines all along the coil and the tail, a mass of red crystals on the loop top;
// - the mane lavender, the horns plum and crimson, the eyes glowing red, the jaw wide open (red mouth, fangs);
// - the wings dark blue feather blades with crimson centres and red icicles hanging under them, swept back only
//   25 degrees so the far wing fans out behind the head on the viewer's left as the art draws it;
// - the crescent blade pale ice streaked with red.
include <lib.scad>

body = [0.22, 0.43, 0.6];
bodyDark = [0.16, 0.15, 0.35];
belly = [0.55, 0.8, 0.88, NOGLOW];
navy = [0.06, 0.05, 0.21];
wingA = [0.17, 0.28, 0.48];
wingB = [0.45, 0.57, 0.73];
wingC = [0.62, 0.11, 0.24, NOGLOW];
vein = [0.8, 0.24, 0.37, NOGLOW];
wingArm = [0.22, 0.07, 0.22];
mane = [0.78, 0.76, 0.95, NOGLOW];
maneShade = [0.5, 0.42, 0.72];
shardA = [0.7, 0.16, 0.3, NOGLOW];
shardB = [0.86, 0.4, 0.52, NOGLOW];
blade = [0.73, 0.84, 0.92, NOGLOW];
hornA = [0.46, 0.31, 0.51];
hornB = [0.36, 0.07, 0.22];
finC = [0.46, 0.31, 0.51];
claw = navy;
eyeC = [1, 0.18, 0.12, GLOW];
mouth = [0.5, 0.06, 0.15];
fang = [0.9, 0.92, 0.98, NOGLOW];

// Picture-plane point [sheet x, depth, z] -> scad (the same turn as pp()).
function W(p) = [p[0] * cos(VIEW) - p[1] * sin(VIEW), p[0] * sin(VIEW) + p[1] * cos(VIEW), p[2]];

// ---- Spine: neck, chest, the thick strand down into the right loop, behind the strand, the tail to the blade.
SP = [[-3.0, 0.5, 28.0], [-2.4, 0.3, 25.0], [-3.0, 0, 21.5], [-3.4, -0.3, 18.0], [-2.5, -1, 13.0],
      [-0.7, -1.5, 8.5], [2.0, -1.5, 4.6], [6.0, -1, 2.7], [10.5, -0.5, 2.8], [14.6, 0, 4.4], [16.2, 0.3, 8.0],
      [14.8, 0.6, 11.2], [10.5, 1, 11.8], [6.0, 1.8, 10.5], [2.0, 2.8, 8.0], [-1.0, 2.0, 5.0], [-4.5, 1.2, 2.7],
      [-9.0, 0.6, 1.8], [-13.0, 0.3, 3.3], [-15.4, 0.2, 6.2]];
SR = [2.1, 2.4, 3.2, 3.7, 3.7, 3.5, 3.1, 2.75, 2.65, 2.45, 2.2, 1.9, 1.7, 1.65, 1.6, 1.7, 1.75, 1.6, 1.3, 1.0];
chain([for (p = SP) W(p)], SR, body, $fn = 16);
// pale belly band down the front of the neck, chest and strand
chain([for (i = [0 : 6]) W(SP[i] + [-0.42 * SR[i], -0.5 * SR[i], 0])], [for (i = [0 : 6]) SR[i] * 0.62], belly, $fn = 16);
// belly scutes: pale plates across the band
for (i = [1 : 5]) for (t = [0.25, 0.75]) let(p = SP[i] + (SP[i + 1] - SP[i]) * t, r = SR[i] + (SR[i + 1] - SR[i]) * t)
  color(vein) translate(W(p + [-0.5 * r, -0.62 * r, 0])) rotate([0, 0, VIEW]) scale([r * 0.5, r * 0.32, 0.32]) sphere(1, $fn = 12);
// dark dorsal stripe down the back, all the way to the tail
chain([for (i = [0 : len(SP) - 1]) W(SP[i] + [0.2 * SR[i], 0.62 * SR[i], 0.15 * SR[i]])], [for (r = SR) r * 0.5], bodyDark, $fn = 12);

// ---- Crescent blade at the tail tip and its barb.
bladePts = [[-15.2, 6.6], [-17.5, 8.1], [-19.6, 10.5], [-20.7, 13.5], [-20.7, 16.5], [-19.6, 19], [-17.5, 20.9],
            [-18.3, 18.2], [-18.8, 15.5], [-18.5, 13], [-17.3, 11], [-15.6, 9.7], [-14.4, 9.0]];
// a crescent is concave, so it is two stacked extrusions (a thick core inside a thinner rim), not a hulled slab
module crescent(pts, t, c) {
  color(c) rotate([90, 0, 0]) {
    linear_extrude(height = t * 0.55, center = true) offset(r = 0.45) polygon(pts);
    linear_extrude(height = t, center = true) offset(r = -0.15) polygon(pts);
  }
}
pp(0.2) crescent(bladePts, 1.8, blade);
pp(0.2) crescent([[-19.8, 10.6], [-20.3, 13.5], [-19.9, 16.6], [-19.0, 15.8], [-18.9, 13], [-18.3, 11.2], [-17.0, 9.6], [-15.6, 8.2]], 2.1, shardA);
module crystal(p, d, r, c) {
  color(c) translate(p) rotate(_dir_rot(d)) scale([1, 0.45, 1]) cylinder(h = norm(d), r1 = r, r2 = 0.04, $fn = 6);
}
crystal(W([-14.3, 0.3, 5.6]), W([1.0, 0, 4.6]), 0.75, blade);

// ---- Crystal shards along the top of the right loop (two staggered rows), and down the back.
LS = [[5.5, 11.6, -0.5, 2.2, 0.7], [7.5, 12.4, 0.2, 3.6, 0.9], [9.5, 12.7, 0.9, 3.8, 1.0], [11.5, 12.8, 1.0, 4.2, 1.1],
      [13.3, 12.4, 1.6, 4.2, 1.1], [15.0, 11.8, 2.3, 3.2, 1.0], [16.3, 10.7, 2.5, 1.7, 0.9], [16.8, 9.2, 2.1, 0.5, 0.7]];
for (k = [0 : len(LS) - 1]) let(s = LS[k]) {
  crystal(W([s[0], 0.3, s[1]]), W([s[2] * 1.2, 0, s[3] * 1.2]), s[4] * 1.6, k % 2 == 0 ? shardA : shardB);
  crystal(W([s[0] + 0.8, 1.6, s[1] - 0.2]), W([s[2] * 0.8, 0.6, s[3] * 0.75]), s[4] * 1.2, k % 2 == 0 ? shardB : shardA);
}
for (k = [0 : 4]) let(i = 1 + k, p = SP[i] + [0.3 * SR[i], 0.85 * SR[i], 0.3 * SR[i]])
  crystal(W(p), W([0.6, 2.4 - k * 0.2, 1.6]), 0.75 - k * 0.06, k % 2 == 0 ? shardA : shardB);

// ---- Red spines all along the body, both edges of the coil and the tail, alternating size.
for (i = [3 : len(SP) - 3]) let(a = SP[i], b = SP[i + 1], t = b - a, n = [-t[2], 0, t[0]] / norm([t[0], t[2]]), r = (SR[i] + SR[i + 1]) / 2)
  for (sg = [-1, 1]) for (u = [0.3, 0.8]) let(p = a + t * u)
    crystal(W(p + n * sg * r * 0.8 + [0, 0.4, 0]), W(n * sg * (1.3 + r * 0.35) * (u > 0.5 ? 1 : 0.7) + [0, 0.5, 0] - t / norm(t) * 0.5),
            0.42 + r * 0.08, (i + (sg > 0 ? 1 : 0)) % 2 == 0 ? shardA : shardB);
// crimson crystals on the chest
for (c = [[-6.8, 21.5, -1.6, 1.8], [-6.4, 18.5, -2.2, 1.0], [-5.6, 15.5, -2.0, 0.4], [1.8, 20.5, 1.6, 2.2], [3.2, 18.5, 2.4, 1.2]])
  crystal(W([c[0], -0.6, c[1]]), W([c[2], 0, c[3]]), 0.6, shardA);

// ---- Arms. Near arm folded across the chest, far arm raised with an open claw.
AN = [[1.2, -1.2, 19.3], [3.6, -3.2, 15.2], [-2.4, -4.4, 16.4], [-3.9, -4.5, 16.7]];
chain([for (p = AN) W(p)], [1.35, 1.2, 0.95, 0.95], body, $fn = 14);
for (c = [[-5.3, -4.3, 15.0], [-4.5, -4.7, 14.3], [-3.5, -4.6, 14.4]])
  chain([W([-3.9, -4.5, 16.7]), W((c + [-3.9, -4.5, 16.7]) / 2 + [-0.3, 0, 0.2]), W(c)], [0.36, 0.26, 0.06], claw, $fn = 8);
for (d = [[2.4, 0, 0.3], [2.1, 0, 1.4], [1.4, 0, 2.2]]) crystal(W([3.7, -2.9, 15.4]), W(d), 0.75, shardB);
AF = [[-5.2, 1.0, 18.5], [-8.8, -0.5, 15.2], [-10.8, -1.0, 19.6], [-11.6, -1.0, 21.3]];
chain([for (p = AF) W(p)], [1.25, 1.1, 0.9, 0.9], body, $fn = 14);
for (c = [[-13.6, -1.2, 23.4], [-12.3, -1.6, 24.0], [-10.6, -1.2, 23.2]])
  chain([W([-11.6, -1.0, 21.3]), W((c + [-11.6, -1.0, 21.3]) / 2 + [0, 0, 0.3]), W(c)], [0.34, 0.25, 0.06], claw, $fn = 8);
for (d = [[-1.8, 0, -1.0], [-1.4, 0, -1.8]]) crystal(W([-9.0, -0.4, 15.0]), W(d), 0.65, shardB);

// ---- Wings: a fan of long crystal feather blades on a wing arm, swept back 25 degrees from the shoulders (Hyoryu: 45).
CX = W([-3.0, 0, 0])[0];                // the torso's mid-line (scad x) the wing pair mirrors about
WR = [CX + 2.5, 2.5, 20.3];             // near wing root (sheet x about 1.4)
function WL(s) = let(x = (s[0] - 1.4) / 0.966) [x, 0, s[1] - 20.3 - 0.12 * x];
module feather(b, t, w, th, c) {
  d = t - b;
  L = norm(d);
  translate(b) rotate([0, -atan2(d[2], d[0]), 0]) {
    color(c) hull() {
      scale([w * 0.25, th * 0.5, w * 0.25]) sphere(1, $fn = 10);
      translate([L * 0.45, 0, 0]) scale([L * 0.42, th * 0.5, w * 0.5]) sphere(1, $fn = 14);
      translate([L, 0, 0]) sphere(0.08, $fn = 6);
    }
    color(vein) translate([L * 0.45, 0, 0]) scale([L * 0.42, th * 0.56, w * 0.3]) sphere(1, $fn = 10);
  }
}
// [base, tip (sheet), width, colour]
FE = [[[9.5, 32], [21.1, 39.3], 4.2, wingB], [[9, 31], [20.8, 36], 4.0, wingA], [[8, 29.5], [20.2, 32.6], 4.4, wingA],
      [[7.2, 28], [19.4, 30], 4.0, wingB], [[6.5, 27], [18.4, 27.5], 4.4, wingA], [[5.5, 25.8], [16.6, 24.4], 4.0, wingA],
      [[4.5, 24.5], [14.2, 19.8], 4.6, wingB], [[3.8, 23.5], [11.5, 18.8], 3.6, wingA], [[3, 22.5], [8.5, 18.7], 3.0, wingB], [[2, 21], [5.6, 17.9], 2.4, wingA]];
module wing() {
  for (k = [0 : len(FE) - 1]) let(f = FE[k])
    translate([0, (k % 2 == 0 ? -0.35 : 0.35), 0]) feather(WL(f[0]), WL(f[1]), f[2], 0.9, f[3]);
  chain([for (s = [[1.3, 19.5], [4.9, 25.3], [7.2, 29.7], [10, 33.6], [12.6, 35], [13.6, 35.4]]) WL(s)],
        [0.75, 0.65, 0.55, 0.45, 0.3, 0.06], wingArm, $fn = 10);
  // red icicles hanging under the feathers [sheet x, z, length]
  for (ic = [[6, 21.2, 2.4], [8.4, 20.2, 2.0], [10.6, 21.0, 3.0], [13, 21.6, 2.4], [15.5, 23.8, 2.6], [17.6, 26.2, 2.0],
             [19, 29.2, 2.2], [12, 26.5, 1.8]])
    let(p = WL([ic[0], ic[1]])) color(wingC) translate(p + [0, 0.6, 0.3]) mirror([0, 0, 1]) cylinder(h = ic[2] * 1.3, r1 = 0.55, r2 = 0.04, $fn = 6);
}
translate(WR) rotate([0, 0, 25]) wing();
translate([2 * CX, 0, 0]) mirror([1, 0, 0]) translate(WR) rotate([0, 0, 25]) wing();

// ---- Mane: thick soft locks swept back from the head over the neck, two layers deep.
LOCKS = [[[-5, 33, 1.5], [-4.2, 35.6, 1.2], [-3, 37.6, 0.2]],
         [[-3.8, 32.5, 1.7], [-1.5, 35.4, 1.4], [0.8, 37.6, 0.2]],
         [[-2.5, 31.5, 1.8], [0.8, 34.2, 1.5], [3.8, 36.6, 0.2]],
         [[-1.5, 30.5, 1.8], [2.2, 32.6, 1.5], [6.8, 34.6, 0.2]],
         [[-1.0, 29, 1.7], [2.6, 30.2, 1.4], [6.4, 30.6, 0.2]],
         [[-0.8, 27, 1.6], [2.2, 27.6, 1.3], [5.2, 27.4, 0.2]],
         [[-0.6, 25, 1.4], [1.6, 24.8, 1.0], [3.2, 23.4, 0.2]]];
// a soft mass under the locks so the mane reads as one flowing body of hair
color(maneShade) hull() {
  translate(W([-2.5, 1.5, 32])) rotate([0, 0, VIEW]) scale([2.6, 2.6, 2.8]) sphere(1, $fn = 16);
  translate(W([1.5, 1.5, 33])) rotate([0, 0, VIEW]) scale([3.2, 2.4, 3.6]) sphere(1, $fn = 16);
  translate(W([0.5, 1.5, 26.5])) rotate([0, 0, VIEW]) scale([1.8, 2.2, 3.2]) sphere(1, $fn = 16);
}
for (j = [0 : len(LOCKS) - 1]) for (d = [0.3, 2.8]) let(lk = LOCKS[j]) for (i = [0 : len(lk) - 2])
  color((j + (d > 1 ? 1 : 0)) % 2 == 0 ? mane : maneShade) hull() for (q = [lk[i], lk[i + 1]])
    translate(W([q[0], d, q[1]])) rotate([0, 0, VIEW]) scale([q[2] * 1.3, 1.5, q[2] * 1.3]) sphere(1, $fn = 10);

// ---- Head: turned 45 degrees to its right, the snout pitched 33 degrees down and scaled 1.2 (H = that frame).
HC = W([-6.0, -0.5, 30.4]);
translate(HC) rotate([0, 0, -45]) {
  // horns and fins, in the yaw-only frame
  mirror_x() {
    chain([[1.0, -0.3, 1.3], [1.5, 2.4, 4.6], [1.9, 5.3, 8.1]], [0.6, 0.38, 0.06], hornB, $fn = 10);
    chain([[0.9, -2.3, 0.6], [1.2, -2.3, 5.0], [1.4, -1.0, 8.9]], [0.5, 0.32, 0.05], hornA, $fn = 10);
    color(finC) hull() {
      translate([1.2, -2.9, 0.9]) scale([0.3, 0.6, 0.5]) sphere(1, $fn = 8);
      translate([2.2, -6.3, 4.4]) sphere(0.06, $fn = 6);
    }
  }
  rotate([33, 0, 0]) scale(1.2) {
    blob([[[1.9, 1.8, 1.75], [0, 0.4, 0.15]], [[1.55, 1.4, 1.35], [0, -1.6, -0.1]], [[1.15, 1.3, 0.95], [0, -3.6, -0.3]],
          [[0.85, 0.6, 0.72], [0, -5.1, -0.25]]], body);
    // the jaw hangs wide open: a red mouth, the lower jaw dropped 32 degrees, fangs above and below
    ell([0.85, 2.0, 0.7], [0, -3.4, -1.05], mouth);
    translate([0, -1.6, -0.75]) rotate([32, 0, 0]) translate([0, 1.6, 0.75]) {
      ell([0.95, 2.4, 0.5], [0, -3.8, -1.1], belly);
      mirror_x() for (f = [[0.55, -5.3], [0.75, -4.3]]) spike([f[0], f[1], -0.75], [0, 0, 0.7], 0.16, 0.03, fang);
    }
    mirror_x() for (f = [[0.6, -5.4], [0.85, -4.4]]) spike([f[0], f[1], -0.55], [0, 0, -0.8], 0.17, 0.03, fang);
    mirror_x() {
      // hard brow ridge sloping down towards the snout
      color(body) hull() {
        translate([0.9, -3.4, 0.6]) sphere(0.32, $fn = 8);
        translate([1.55, -1.6, 1.3]) scale([0.5, 0.65, 0.38]) sphere(1, $fn = 10);
      }
      eye([1.4, -1.9, 0.4], 0.72, iris = eyeC, pupil = navy, sclera = [0.55, 0.05, 0.12], yaw = 55, flat = 0.4,
          lid = 0.4, lid_tilt = 30, lid_c = navy, slit = 0.45, squint = 0.25);
      chain([[0.85, -5.6, -0.65], [1.25, -3.6, -0.62], [1.45, -2.3, -0.45]], [0.08, 0.08, 0.06], navy, $fn = 6);   // mouth line
      ell([0.15, 0.15, 0.11], [0.5, -5.55, 0.3], navy);                                                       // nostril
    }
  }
}
