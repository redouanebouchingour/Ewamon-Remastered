// Abyssrake: Tidalfang sunk into the deep as an abyssal sea serpent rising from a pile of rocks: a thick navy body
// thrown into upright loops on either side, dotted with glowing cyan spots, a slate banded throat, an S-neck rising
// to a horned dragon head with gaping red jaws and fangs, a green eye, and a great cyan-veined fin fanning down the
// back of the neck.
include <lib.scad>

navy = [0.1, 0.2, 0.36];
navyHi = [0.16, 0.3, 0.48];
navyDark = [0.06, 0.12, 0.22];
slate = [0.45, 0.52, 0.62];
slateLine = [0.32, 0.38, 0.48];
glow = [0.35, 0.88, 1];
finCol = [0.12, 0.55, 0.82];
finDark = [0.08, 0.28, 0.46];
mouth = [0.62, 0.12, 0.16];
fang = [0.95, 0.9, 0.7];
eyeGreen = [0.5, 1, 0.3];
rock = [0.22, 0.24, 0.3];
rockHi = [0.32, 0.34, 0.4];

// Catmull-Rom spline through control points P, n samples per span: smooth body paths.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerp_r(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);

// The body, head end first: the S-neck drops to the rocks, then the body throws a tall loop up on the creature's
// left (viewer's right), passes behind, and throws a lower loop on the other side before the tail tapers off.
ctrl = [[-3, -6, 31], [-1, -4, 27], [2.5, -3, 22], [2.5, -3, 16], [0, -2.5, 10], [0, -1, 5],
        [7, 0, 3.6], [13.5, 1, 7], [15, 1.5, 14], [11.5, 1.5, 19], [6.5, 1.5, 16], [6, 3, 9],
        [1, 5, 4.6], [-7, 4, 4.4], [-13, 2.5, 7.5], [-14, 1.5, 13], [-10, 1, 15.5], [-7.5, 0, 12], [-9, -1.5, 8.5]];
ctrlR = [3, 3.4, 3.8, 4, 4.2, 4.2, 4.2, 4, 3.8, 3.6, 3.4, 3.4, 3.4, 3.2, 3, 2.6, 2, 1.4, 0.6];
S = 3;
pts = spline(ctrl, S);
rs = lerp_r(ctrlR, S);
chain(pts, rs, navy, $fn = 16);

// Slate banded throat down the front of the neck, to where it meets the rocks.
NK = 5 * S;
chain([for (i = [0 : NK]) pts[i] + [0, -rs[i] * 0.5, 0]], [for (i = [0 : NK]) rs[i] * 0.66], slate, $fn = 14);
for (i = [1 : NK - 1]) color(slateLine) translate(pts[i] + [0, -rs[i] * 0.55, 0]) scale([rs[i] * 0.66, rs[i] * 0.66, 0.28]) sphere(1, $fn = 14);

// Slate belly scales running round the inside of each loop (the side the path curves towards), banded like the
// throat, so the loops aren't plain navy tubes.
for (i = [NK + 2 : len(pts) - 4]) let(k = pts[i + 1] + pts[i - 1] - 2 * pts[i], kn = norm(k)) if (kn > 0.25) {
  n = k / kn;
  q = pts[i + 1] + pts[i] - 2 * pts[i + 1] + pts[i + 2] - pts[i + 1];
  if (norm(q) > 0.25 && (q / norm(q)) * n > 0.3)
    color((i % 2 == 0) ? slate : slateLine) hull() {
      translate(pts[i] + n * rs[i] * 0.5) sphere(rs[i] * 0.62, $fn = 12);
      translate(pts[i + 1] + (q / norm(q)) * rs[i + 1] * 0.5) sphere(rs[i + 1] * 0.62, $fn = 12);
    }
}

// Glowing cyan spots on both flat faces of the loops and up the sides of the neck: short dashes in two rows.
for (i = [2 : len(pts) - 3]) let(d = pts[i + 1] - pts[i - 1], u = d / norm(d)) for (s = [-1, 1]) for (h = [-0.45, 0.4]) if ((i + (h > 0 ? 1 : 0)) % 2 == 0) {
  // a sideways normal to the path that stays roughly horizontal (the loops' flat faces are -Y and +Y)
  side = i <= NK ? [s, 0, 0] : [0, s, 0];
  up = cross(u, side);
  n = side * 0.9 + up * h;
      color(glow) translate(pts[i] + n / norm(n) * rs[i] * 0.98) rotate(_dir_rot(u)) scale([0.6, 0.6, 0.8]) sphere(0.85, $fn = 8);
}

// Eye sunk into the skull: turned `yaw` outward along the skin and squashed front-to-back so only its face shows, set
// in a dark socket under a hard brow ridge of the skin colour that slants down to the snout, so the face itself scowls.
module socket_eye(p, size, yaw, iris, sclera, pupil, skin, sock, lid = 0.5, tilt = 30, squash = 0.6) {
  translate(p) rotate([0, 0, yaw]) {
    color(sock) translate([0, size * 0.45, -size * 0.05]) scale([1.14, 0.55, 1.12]) sphere(size, $fn = 20);
    scale([1, squash, 1]) eye([0.01, 0, 0], size, iris = iris, sclera = sclera, pupil = pupil, lid = lid, lid_tilt = tilt,
                              lid_c = skin, slit = 0.35);
    // The ridge is a wedge rooted behind the eye, so it reads as a ledge of the skull, not a stuck-on bar.
    color(skin) hull() {
      translate([size * 0.8, size * 0.25, size * 0.78]) scale([0.32, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([-size * 0.9, -size * 0.45, size * 0.12]) scale([0.36, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([0, size * 0.9, size * 0.45]) scale([0.9, 0.5, 0.4]) sphere(size, $fn = 12);
    }
  }
}

// Head: a long dragon skull hulled from a heavy cranium into a tapering snout, the lower jaw dropped wide open.
H = [-3.5, -7.5, 33];
translate(H) scale(1.25) translate(-H) {
color(navy) hull() {
  translate(H) scale([4.2, 4.4, 3.4]) sphere(1, $fn = 20);
  translate(H + [0, -5, 0.6]) scale([3, 3, 2]) sphere(1, $fn = 16);
  translate(H + [0, -9.6, 0.2]) scale([1.8, 1.6, 1.4]) sphere(1, $fn = 12);
}
// Snout ridge and nostrils.
color(navyHi) hull() {
  translate(H + [0, -2, 3]) sphere(1.4, $fn = 10);
  translate(H + [0, -9.4, 1.4]) sphere(0.8, $fn = 8);
}
// Lower jaw, dropped open.
color(navy) translate(H + [0, -0.5, -2.2]) rotate([-30, 0, 0]) hull() {
  scale([3.4, 2.4, 1.8]) sphere(1, $fn = 14);
  translate([0, -8, -0.4]) scale([1.7, 1.2, 1.1]) sphere(1, $fn = 10);
}
// Red mouth inside, between the jaws.
color(mouth) hull() {
  translate(H + [0, -1.5, -1.4]) scale([2.3, 1.6, 1.6]) sphere(1, $fn = 12);
  translate(H + [0, -8.4, -0.6]) scale([1.1, 0.8, 0.5]) sphere(1, $fn = 8);
  translate(H + [0, -6.6, -5]) scale([0.9, 0.8, 0.5]) sphere(1, $fn = 8);
}
// Fangs: the upper row hanging from the snout, the lower row rising from the jaw tip.
for (s = [-1, 1]) {
  for (k = [[2.2, -3.6], [1.9, -5.6], [1.5, -7.8]]) spike(H + [s * k[0], k[1], -0.4], [0, 0, -2.2 + k[1] * 0.08], 0.5, 0.05, fang);
  for (k = [[1.6, -4.4, -3.6], [1.3, -6.4, -5]]) spike(H + [s * k[0], k[1], k[2]], [0, -0.2, 1.8], 0.45, 0.05, fang);
}
// Glowing green slit eyes sunk in dark sockets under a hard brow ridge, and horns swept back.
translate(H) for (m = [0, 1]) mirror([m, 0, 0])
  socket_eye([2.9, -3.8, 1.3], 1.75, 44, concat(eyeGreen, GLOW), [0.8, 0.95, 0.35], [0.02, 0.06, 0.02], navy, navyDark,
                lid = 0.4);
for (s = [-1, 1]) {
  // Extra spikes: a short horn over each brow and a jaw spine at the cheek.
  chain([H + [s * 2.6, -2.6, 2.8], H + [s * 3.4, 0, 4.6], H + [s * 3.2, 1.6, 6.6]], [0.7, 0.4, 0.08], navyHi);
  spike(H + [s * 3, -1.6, -2.2], [s * 1.6, 2.6, -1.6], 0.55, 0.05, navyHi);
  chain([H + [s * 2.2, -1, 2.6], H + [s * 3.6, 3, 4.8], H + [s * 4, 6.4, 5.6]], [1.1, 0.6, 0.1], navyHi);
  chain([H + [s * 3.6, 0, 0.6], H + [s * 5.6, 3.4, 1], H + [s * 6.6, 5.6, 0.4]], [0.8, 0.45, 0.1], navyHi);
}
}

// Fins: dark membranes with glowing cyan veins.
module fin(base, rays, col) {
  for (k = [0 : len(rays) - 2]) color(col) hull() {
    translate(base) sphere(0.35, $fn = 6);
    translate(base + rays[k]) sphere(0.3, $fn = 6);
    translate(base + rays[k + 1]) sphere(0.3, $fn = 6);
  }
  for (r = rays) limb(base, base + r * 1.08, 0.45, 0.12, glow);
  // Bright rim along the fin's ragged outer edge.
  for (k = [0 : len(rays) - 2]) limb(base + rays[k], base + rays[k + 1], 0.3, 0.3, glow);
}
// The great crest fan: a big pleated fan rising behind the skull and sweeping down the back of the neck, its rays
// alternately pleated left and right so it reads as a fin, not a board.
module fan(base, a0, a1, n, len0, len1, col) {
  rays = [for (k = [0 : n]) let(a = a0 + (a1 - a0) * k / n, l = len0 + (len1 - len0) * k / n)
    [(k % 2 == 0 ? 0.9 : -0.9), l * sin(a), l * cos(a)]];
  fin(base, rays, col);
}
translate(H) scale(1.25) translate(-H) fan(H + [0, 2.4, 1.8], -14, 150, 9, 11, 8.4, finCol);
for (j = [0 : 2]) let(i = 4 + j * 3, p = pts[i] + [0, rs[i] * 0.75, 0])
  fan(p, 30, 150, 4, 6.4 - j * 1.2, 4.6 - j * 0.8, finDark);
// Cheek frills fanning out to the sides behind the jaw.
translate(H) scale(1.25) translate(-H) for (s = [-1, 1])
  fin(H + [s * 3.4, 0.6, 0], [[s * 1.6, 0.8, 4.2], [s * 3.8, 2, 3], [s * 4.8, 2.6, 0.4], [s * 3.8, 2.4, -2.8]], finCol);
// Ridge spines along the top of the loops.
for (i = [NK + 6 : 4 : len(pts) - 6]) let(d = pts[i + 1] - pts[i - 1], u = d / norm(d), up = cross(u, [0, 1, 0]) * (pts[i][0] > 0 ? -1 : 1))
  spike(pts[i] + up * rs[i] * 0.7, up * 2.4, 0.9, 0.1, finCol);

// A pile of dark rocks it rises from, and a few chips floating around it.
for (r = [[0, -2, 0.6, 5, 0], [-5, -3, 0.4, 3.4, 30], [5, -3.6, 0.4, 3.6, 70], [3, 3, 0.4, 3.6, 110], [-3, 3, 0.4, 3.2, 10],
          [9, 0, 0.3, 2.6, 50], [-10, 1, 0.3, 2.4, 20], [0, -7, 0.2, 2.6, 80]])
  color(r[3] > 3.5 ? rock : rockHi) translate([r[0], r[1], r[2]]) rotate([0, 0, r[4]]) scale([1.2, 1, 0.5]) sphere(r[3], $fn = 6);
for (r = [[-12, -6, 22], [10, -6, 26], [-14, -3, 18], [16, -4, 20]]) color(navyHi) translate(r) rotate([30, 20, 10]) cube(1.3, center = true);
