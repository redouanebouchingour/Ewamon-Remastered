// Voidraxis: an eastern void dragon reared up in a great upright loop, starry indigo body laced with a net of glowing
// violet scale lines, a long-snouted head with fangs and a glowing eye, a streaming teal-violet mane, long whiskers
// and clawed forelegs reaching forward.
include <lib.scad>

body = [0.11, 0.07, 0.27];
bodyHi = [0.24, 0.15, 0.48];
belly = [0.3, 0.18, 0.55];
line = [0.72, 0.45, 1];
star = [0.85, 0.85, 1];
maneA = [0.2, 0.42, 0.55];
maneB = [0.32, 0.2, 0.6];
maneC = [0.14, 0.14, 0.38];
glow = [0.92, 0.78, 1];
claw = [0.75, 0.68, 0.9];
mouth = [0.45, 0.12, 0.3];
fang = [0.92, 0.88, 0.98];

// Catmull-Rom spline through control points P, n samples per span: smooth body paths.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerp_r(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);

// Body, head end first: the neck arcs down the front to the chest, the body sweeps down and round the bottom,
// climbs the creature's left side (viewer's right), arches over behind the neck, and drops away into the tail.
ctrl = [[-3, -5, 30], [0, -3.5, 26], [2.2, -3, 21], [0.5, -3.4, 16], [-4, -2.6, 11], [-6, -1.5, 6], [-2, 0, 3.4],
        [5, 1, 3.6], [11, 2, 7.5], [12.5, 2.6, 13.5], [9, 3, 18], [2.5, 4, 17.5], [-4, 4, 13.5], [-9, 3, 9],
        [-12, 1, 4.6], [-15.5, -1.5, 3], [-18, -3, 4]];
ctrlR = [2.8, 3.1, 3.5, 3.9, 4.3, 4.5, 4.6, 4.5, 4.3, 4, 3.7, 3.3, 2.9, 2.4, 1.9, 1.2, 0.5];
S = 3;
pts = spline(ctrl, S);
rs = lerp_r(ctrlR, S);
chain(pts, rs, body, $fn = 16);
// Paler belly plates down the front of the neck and chest.
NK = 4 * S;
chain([for (i = [0 : NK]) pts[i] + [0, -rs[i] * 0.42, 0]], [for (i = [0 : NK]) rs[i] * 0.68], belly, $fn = 12);

// The glowing net: six lines running along the body and short cross-links between them staggered like brickwork,
// so the body reads as the sprite's panelled scale cells, not bands. The body loop lies roughly in the XZ plane, so
// its in-plane normal (tangent x Y) gives a frame that never flips.
function frame(i) = let(d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]) d / norm(d);
function nA(i) = let(c = cross(frame(i), [0, 1, 0])) c / norm(c);
function surf(i, a) = pts[i] + (nA(i) * cos(a) + cross(nA(i), frame(i)) * sin(a)) * rs[i] * 0.97;
for (k = [0 : 5]) chain([for (i = [0 : len(pts) - 1]) surf(i, 30 + k * 60)], [for (r = rs) 0.2], concat(line, GLOW), $fn = 6);
for (i = [1 : len(pts) - 3]) for (k = [0 : 5]) if ((i + k) % 2 == 0)
  chain([surf(i, 30 + k * 60), surf(i, 60 + k * 60), surf(i, 90 + k * 60)], [0.2, 0.2, 0.2], concat(line, GLOW), $fn = 6);
// Stars sprinkled over the body.
for (i = [3 : len(pts) - 2]) for (k = [0 : 2]) let(a = i * 97 + k * 131, p = pts[i])
  color(star) translate(p + rs[i] * 0.97 * [cos(a), sin(a) * 0.9, sin(a * 1.7) * 0.6]) sphere(0.24, $fn = 6);

// Tail tip: a small forked fin.
for (d = [[-2.6, -1.6, 1.6], [-2.8, -1, -1.8]]) spike(pts[len(pts) - 1], d, 0.6, 0.05, bodyHi);
// Ridge of back spikes along the top of the loop.
for (i = [7 * S : 2 : 13 * S]) let(u = frame(i), up = cross(cross(u, [0, 0, 1]), u), n = norm(up) < 0.2 ? [0, 0, 1] : up / norm(up))
  spike(pts[i] + n * rs[i] * 0.8, n * 1.8 + u * -0.8, 0.6, 0.05, bodyHi);

// Clawed forelegs at the chest, reaching forward; small hind legs gripping at the bottom of the loop.
module leg(a, b, c, r) {
  limb(a, b, r, r * 0.8, body);
  limb(b, c, r * 0.8, r * 0.6, body);
  for (k = [-40, 0, 40]) spike(c, [sin(k) * 1.4, -1.6, cos(k) * 0.4 - 0.6], r * 0.3, 0.05, claw);
}
mirror_x() leg([3.4, -4.6, 17.5], [7, -7.4, 15], [6.4, -11, 16.4], 1.6);
mirror_x() leg([3.4, -1.6, 4], [6.6, -4, 2.6], [6.2, -6.6, 1.4], 1.4);

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

// Head: a long snout facing -Y, jaws parted with fangs, a glowing eye under a heavy brow, horns and whiskers.
hp = [-3, -6, 32];
translate(hp) scale(1.5) {
  color(body) hull() {
    translate([0, 0.4, 0.4]) scale([2.8, 3, 2.4]) sphere(1, $fn = 18);
    translate([0, -4.4, 0.4]) scale([1.8, 2.4, 1.4]) sphere(1, $fn = 14);
    translate([0, -6.6, 0.4]) scale([1.3, 1, 1]) sphere(1, $fn = 12);
  }
  ell([1.1, 2.6, 0.6], [0, -4.4, 1.6], bodyHi);
  // Lower jaw, dropped open.
  color(body) translate([0, 0, -1.2]) rotate([-16, 0, 0]) hull() {
    scale([2.2, 2, 0.9]) sphere(1, $fn = 14);
    translate([0, -5.4, -0.2]) scale([1, 1, 0.7]) sphere(1, $fn = 10);
  }
  color(mouth) hull() {
    translate([0, -1, -0.9]) scale([1.6, 1.4, 0.8]) sphere(1, $fn = 10);
    translate([0, -5.4, -0.4]) scale([0.8, 0.6, 0.3]) sphere(1, $fn = 8);
    translate([0, -5, -2.4]) scale([0.7, 0.6, 0.3]) sphere(1, $fn = 8);
  }
  mirror_x() {
    for (y = [-3, -5.2]) spike([1.1, y, -0.4], [0, 0, -1.4], 0.32, 0.05, fang);
    spike([0.8, -4.2, -2.4], [0, 0, 1.2], 0.28, 0.05, fang);
    // Glowing slit eye sunk under a hard brow ridge: a white-violet glare out of a dark socket.
    socket_eye([1.75, -2.6, 1.35], 1.6, 44, concat([0.78, 0.45, 1], GLOW), concat([0.94, 0.86, 1], GLOW), [0.2, 0.05, 0.35],
               body, [0.03, 0.01, 0.08], lid = 0.38, tilt = 30);
    // Nostrils and long whiskers trailing back.
    ell([0.3, 0.3, 0.25], [0.7, -6.9, 1.2], [0.05, 0.03, 0.1]);
    chain([[1, -6.2, 0.4], [3.6, -7.2, -0.4], [7, -6, -2], [9.4, -2.6, -2.4], [10.4, 0.6, -1.4]], [0.25, 0.2, 0.16, 0.12, 0.06], maneB);
    // Horns sweeping back.
    chain([[1.2, 0.6, 2.2], [2.2, 3, 3.8], [2.6, 5.8, 4.4]], [0.55, 0.4, 0.12], claw);
  }
  // Mane: wavy locks streaming back and up from the crown and cheeks, teal and violet.
  for (k = [0 : 10]) let(a = -80 + k * 16, c = k % 3 == 0 ? maneA : (k % 3 == 1 ? maneB : maneC), w = (k % 2) * 2 - 1, l = 1 - abs(a) / 220)
    chain([for (j = [0 : 4]) [sin(a) * (2 + j * 1.4), 0.6 + j * 3 * l, 1.6 + cos(a) * 1.2 + j * 1.3 * cos(a) + w * sin(j * 70) * 1.1]],
          [1.2, 1.1, 0.85, 0.5, 0.12], c, $fn = 8);
  for (k = [0 : 3]) let(z = -0.6 - k * 1.6, w = k % 2 == 0 ? 1 : -1)
    chain([[0, 2, z], [w * 1.6, 4.6, z + 0.4], [w * 2.6, 7.2, z - 0.4], [w * 3, 9.6, z + 0.4]], [1.2, 0.9, 0.5, 0.1], k % 2 == 0 ? maneA : maneB, $fn = 8);
}
// Mane tufts streaming off the back of the neck.
for (i = [2 : 3 : 9]) let(p = pts[i], w = i % 2 == 0 ? 1 : -1)
  chain([p + [0, rs[i] * 0.6, 0.4], p + [w * 1.6, rs[i] + 2.6, 0.6], p + [w * 2.4, rs[i] + 5, -0.4], p + [w * 2, rs[i] + 7, 0.8]],
        [1.3, 0.9, 0.5, 0.1], i % 3 == 0 ? maneA : maneB, $fn = 8);
