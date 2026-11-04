// Darkyon: a tall dark wraith in a long ragged gown, sprite-matched (2026-11-04).
// Checklist (front sheet, x = sheet x, z = height; 40 units tall, hem flames on z = 0):
//   face: a dark head (x -3.4..2.4, z 27.5..30.7) under a light-blue hood swept down over its right side (an oval
//     x -4..2.7, z 28.5..35.5, its point down at x -2.2, z 28.6); ONE angry red almond eye (x -1.5..0.2, z 29.2..30.4)
//     with a white glint, peeking out on the creature's left beside the hood's point; jagged black shards under it.
//   crown: three blue flames behind the hood: up-left (x -4.6..1.1, z 33..39.7), a small one at the far left
//     (x -7.9..-4.8, z 28.4..35.3) and a big one sweeping up-right (x 2.4..12.9, z 29.2..39.9). Cyan rims, royal blue,
//     a deep blue core (the sprite's three flame shades).
//   collar: a teal ruff round the neck (x -6.6..4.9, z 24.4..30.6; wide on the back, z 23.3..29.3) with dark shards
//     rising out of it, two dark horns curving up off the shoulders (tips x -8, z 28.8 and x 8.3, z 30.2).
//   body: a lighter grey chest (z 23..27), a narrow waist (z 20), a long gown flaring to the hem (x -9..10 at z 6),
//     its edge torn into hanging dark shards, open at the front on a teal underskirt (x -5.9..0.3, z 7..16.6).
//   arms: thin and dark. Its right arm (viewer's left) reaches out to a blue fireball (centre x -10.6, z 20.8, r 2.2,
//     flames to z 25) cupped in navy claws; its left arm hangs to a claw of four hooks (x 7.6..10.4, z 11.6..14.4)
//     with a navy blade on the forearm (x 7.3..9.3, z 18.4..23.7) and a loose flame beside it (x 10..13.6, z 14.5..20).
//   hem: a ring of soft blue flame tongues all round (x -11..12.9, z 0..10).
//   back: the hood's dome, the flames, the broad teal ruff over the shoulders, the gown's torn layers.
include <lib.scad>

shade = [0.20, 0.21, 0.22];
shadeHi = [0.30, 0.30, 0.32];
ink = [0.11, 0.12, 0.15];
teal = [0.17, 0.58, 0.70];
skirt = [0.19, 0.60, 0.76];
navy = [0.15, 0.31, 0.53];
clawBlue = [0.15, 0.43, 0.69];
hood = [0.26, 0.53, 0.86, NOGLOW];
fCyan = [0.17, 0.74, 0.93, NOGLOW];
fBlue = [0.10, 0.40, 0.93, NOGLOW];
fDeep = [0.15, 0.21, 0.83, NOGLOW];
ballCore = [0.18, 0.76, 0.94, GLOW];
eyeRed = [0.92, 0.2, 0.14, GLOW];

// ---- flames: one outline, three nested plates (cyan rim, royal blue, deep core), thicker towards the middle.
// Cyan tips, a blue body, a deep heart; the heart can be kept to the lower part (below zc, a tongue's local z).
module flame3(pts, t = 1, zc = 1e3) {
  plate(pts, t, 0.2, fCyan, 0.45);
  plate(pts, t + 0.5, 0.2, fBlue, 0.12);
  color(fDeep) intersection() {
    plate(pts, t + 1.0, 0.2, fDeep, -0.7);
    translate([-60, -5, -10]) cube([120, 10, zc + 10]);
  }
}
// A flame tongue outline: base width w, height h, the tip swept `lean * h` along +x, the body flickering back the
// other way halfway up (an S, not a cone), the base bulging out round.
function tongue(h, w, lean, n = 6) = let(sx = function(t) lean * h * (t * t - 0.3 * sin(180 * t)))
  concat([for (i = [0 : n]) let(t = i / n) [sx(t) - w / 2 * pow(1 - t, 1.1) * (1 + 0.3 * sin(180 * t)), h * t]],
         [for (i = [n - 1 : -1 : 1]) let(t = i / n) [sx(t) + w / 2 * pow(1 - t, 0.9) * (1 + 0.25 * sin(180 * t)), h * t * 0.97]]);
// The hem's ring of fire: a band round the gown whose top edge is a row of flame tongues, so it reads as the art's
// flame wall from every side. T = [[centre angle (0 = front, -Y), height, width in degrees, lean -1..1]].
hemT = [[-62, 6.2, 22, -0.3], [-38, 8.2, 22, 0.25], [-16, 10.4, 26, -0.25], [8, 8.6, 22, 0.2], [33, 9.8, 26, 0.3],
        [56, 7, 20, -0.3], [76, 8.8, 22, -0.2], [98, 9.4, 24, 0.35], [122, 7.2, 24, -0.3], [146, 8.4, 24, 0.3],
        [170, 6.8, 22, -0.2], [195, 9.2, 24, 0.25], [220, 7.4, 22, -0.3], [245, 8.8, 24, 0.2], [270, 7.2, 22, -0.25],
        [292, 8.6, 22, 0.3]];
function _wrap(d) = d - 360 * round(d / 360);
// Each tongue: soft round flanks rising to a rounded, lopsided tip (mostly smoothstep).
function _prof(a, t) = let(u = _wrap(a - t[0]) / (t[2] * 0.8), u0 = t[3],
                           s = u < u0 ? (u + 1) / (u0 + 1) : (1 - u) / (1 - u0))
  abs(u) >= 1 ? 0 : t[1] * (0.65 * s * s * (3 - 2 * s) + 0.35 * s);
function hemTop(a) = max(3.6, max([for (t = hemT) _prof(a, t)]));
module fireBand(r1, r2, k, dz, N = 144) {
  // The wall bulges out round its lower middle, as the art's flame mass is wider than the gown.
  F = [[0, -1.4], [0.3, 0.9], [0.65, 0.85], [1, 0.5]];
  M = len(F);
  tops = [for (i = [0 : N - 1]) max(0.6, hemTop(i * 360 / N) * k + dz)];
  // Per sample: the outer wall bottom to top, then the inner wall top to bottom (a closed ring of 2M points).
  pts = [for (i = [0 : N - 1]) let(a = i * 360 / N, c = -cos(a), s = sin(a), z = tops[i])
    each concat([for (f = F) let(r = r2 + f[1]) [r * s, r * c, 0.1 + f[0] * (z - 0.1)]],
                [for (m = [M - 1 : -1 : 0]) let(f = F[m], r = r1 + f[1] * 0.6) [r * s, r * c, 0.1 + f[0] * (z - 0.1)]])];
  L = 2 * M;
  faces = [for (i = [0 : N - 1]) let(j = (i + 1) % N) for (m = [0 : L - 1]) let(n = (m + 1) % L)
    [L * i + n, L * j + n, L * j + m, L * i + m]];
  polyhedron(pts, faces);
}
// Lighter ell() / blob() (lib's use $fn 28; this model has many and must stay under 25k triangles).
module ellL(r, p, c, fn = 18) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module blobL(parts, c, fn = 20) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
// A flat blade: a flattened bulb at p1 tapering to a point at p2.
module blade(p1, p2, r, c) {
  color(c) hull() {
    translate(p1) scale([r, r * 0.35, r]) sphere(1, $fn = 10);
    translate(p2) sphere(0.1, $fn = 4);
  }
}

// ---- Hem: the ring of fire, a cyan rim over a royal blue body over a deep blue heart.
color(fCyan) fireBand(9.3, 10.2, 1, 0.45, 120);
color(fBlue) fireBand(9.1, 10.45, 1, -0.3, 120);
color(fDeep) fireBand(8.9, 10.7, 0.55, 0.3, 120);

// ---- Gown: a long cone flaring from the waist, a teal underskirt in the front slit, torn shards round the edge.
lathe([[2.1, 20.5], [3.0, 18], [4.6, 15], [6.4, 12], [8.0, 8.5], [8.9, 5.5], [8.6, 3.6], [6, 3]], shade);
gownCut = [[-3, 17.2], [-1.6, 13], [-0.2, 10.5], [0.6, 8.5], [0.2, 5], [-6.4, 5], [-6.4, 9], [-5.4, 13], [-4, 15.6]];
color(skirt) intersection() {
  lathe([[2.4, 20.5], [3.3, 18], [4.9, 15], [6.7, 12], [8.3, 8.5], [9.2, 5.5], [8.9, 3.6], [6, 3]], skirt);
  prism(gownCut);
  translate([-20, -30, 0]) cube([40, 30, 30]);
}
// The upper torn layer (a cape to the knees) and the lower one to the hem, skipping the front slit.
function onGown(a, r, z) = [r * sin(a), 0.2 - r * cos(a), z];
for (k = [0 : 11]) let(a = 45 + k * 25) if (a < 330)
  blade(onGown(a, 3.7, 17), onGown(a + 6, 7.8, 10.6 - (k % 2) * 1.6), 1.6, k % 3 == 1 ? shadeHi : shade);
for (k = [0 : 13]) let(a = 40 + k * 22) if (a < 335)
  blade(onGown(a, 6.6, 11.5), onGown(a - 5, 9.6, 6.2 - (k % 2) * 1.4), 1.8, k % 3 == 2 ? shadeHi : shade);
// The slit's two torn flaps: the long one on the viewer's left (x -9..-7, z 6.5..10) and the right edge.
blade(onGown(-38, 4.8, 15), onGown(-44, 9.4, 6.4), 1.5, shade);
blade(onGown(36, 4.4, 15.5), onGown(40, 8.8, 7.2), 1.4, shadeHi);

// ---- Torso: a narrow waist under a lighter chest.
blobL([[[2.0, 1.8, 1.6], [0, 0.1, 20.6]], [[3.2, 2.4, 1.8], [0, 0.3, 24.6]]], shade);
color(shadeHi) intersection() {
  blobL([[[2.2, 2.0, 1.7], [0, 0.1, 21.4]], [[3.35, 2.55, 1.9], [0, 0.3, 24.6]]], shadeHi);
  translate([-10, -10, 22.6]) cube([20, 9.6, 3.6]);
}
// Dark shards hanging over the chest from the collar (the zigzag line at z 24.5).
for (a = [-50 : 25 : 50]) blade(onGown(a, 2.9, 26.4), onGown(a, 3.0, 24.2 - (abs(a) % 50 == 0 ? 0 : 0.6)), 0.7, ink);
// Shoulders and the two dark horns curving up off them.
mirror_x() {
  ellL([2.2, 1.9, 1.6], [3.8, 0.4, 25], shade);
  chain([[4.2, 0.5, 25.4], [6.6, 0.7, 26.2], [8.6, 0.7, 27.8], [9.5, 0.6, 30.2]], [1.4, 0.95, 0.5, 0.08], shade);
}

// ---- Teal ruff round the neck, broad over the back, with dark shards rising out of it.
blobL([[[3.4, 3.0, 1.4], [0, 0.4, 27.2]], [[3.8, 2.0, 2.2], [0, 1.6, 26.4]]], teal);
for (k = [0 : 11]) let(a = k * 30 + 15, back = cos(a) < 0)
  blade(onGown(a, 2.8, 27.2), onGown(a, back ? 5.4 : 4.6, back ? 29.4 : 28.4), 1.1, teal);
for (k = [0 : 7]) let(a = k * 45 + 70)
  blade(onGown(a, 2.4, 27.6), onGown(a + 8, 3.6, a > 180 && a < 300 ? 31 : 30.2), 0.75, ink);

// ---- Head: a dark head, its face a black mask with shards under the chin.
ellL([2.4, 2.3, 2.2], [0.2, -0.2, 29.6], ink);
for (s = [[-1.6, 27.3], [-0.4, 26.9], [0.9, 27.1], [2.0, 27.6]]) let(p = fromSheet(s[0], 28.3, -1.9))
  blade(p, [p[0], p[1] - 0.4, s[1]], 0.6, ink);
// One angry red eye on the creature's left, beside the hood's point, its lid slanting down to the middle.
eye([0.85, -2.3, 29.75], 0.95, iris = [0.62, 0.06, 0.06, GLOW], pupil = [0.25, 0.02, 0.02], sclera = eyeRed, yaw = 14,
    lid = 0.3, lid_tilt = 24, lid_c = ink, squint = 0.12, shine = true);

// ---- Hood: a light blue dome over the top and back of the head, swept down over its right side to a point.
color(hood) hull() {
  translate([-0.8, 0.6, 33.2]) scale([3.0, 3.0, 2.2]) sphere(1, $fn = 30);
  translate([-2.4, -1.4, 31.0]) scale([1.6, 1.5, 1.8]) sphere(1, $fn = 16);
  translate([-1.1, -2.3, 29.1]) scale([1.1, 1.0, 1.2]) sphere(1, $fn = 14);
}
// Two darker sweeps across the hood (the art's diagonal stripes).
color([0.21, 0.45, 0.74, NOGLOW]) for (o = [[-1.6, 32.2], [0.2, 33.6]]) intersection() {
  hull() {
    translate([-0.8, 0.6, 33.2]) scale([3.08, 3.08, 2.28]) sphere(1, $fn = 30);
    translate([-2.4, -1.4, 31.0]) scale([1.68, 1.58, 1.88]) sphere(1, $fn = 16);
    translate([-1.1, -2.3, 29.1]) scale([1.18, 1.08, 1.28]) sphere(1, $fn = 14);
  }
  prism([[o[0] - 2.4, o[1] - 1.2], [o[0] - 2.4, o[1] - 0.8], [o[0] + 2.6, o[1] + 1.6], [o[0] + 2.6, o[1] + 1.2]]);
  translate([-10, -10, 25]) cube([20, 10, 15]);
}

// ---- Crown of flames behind the hood (traced off the sheet, standing in the picture plane).
pp(1.6) flame3([[-4, 32.6], [-4.6, 33.9], [-4.5, 36.4], [-3.1, 37.7], [-1.5, 38.9], [0.3, 39.6], [1.0, 39.4], [0.6, 38.8],
  [-0.4, 37.8], [0.4, 37.5], [0.5, 36.5], [-0.4, 35.6], [1.4, 35.2], [0, 33.2]], 1.4);
pp(1.2) flame3([[-6.1, 28.4], [-7.0, 29.3], [-7.8, 31], [-7.7, 32.8], [-7.0, 33.6], [-6.5, 35.0], [-6.0, 34.8], [-6.1, 33.5],
  [-5.6, 32.3], [-5.2, 32.8], [-4.9, 31.8], [-5.1, 30.2], [-5.1, 28.6]], 1.2);
pp(1.8) flame3([[2.2, 30.4], [2.6, 33], [3, 35.5], [3.4, 37.4], [4, 36.8], [4.6, 38.2], [5.5, 38.9], [6, 38], [5.6, 36.6],
  [6.5, 36.2], [7.6, 37.4], [9, 38.2], [10.5, 38.8], [12.6, 38.5], [11, 37.9], [10.5, 36.6], [9.7, 35.2], [10.7, 34.8],
  [9.9, 33.6], [9.5, 33], [8.2, 31.8], [6.5, 31.6], [5.5, 31.8], [4.9, 30.8], [4.4, 29.4], [3.2, 29.4]], 1.6);
// A flame turned side-on on the back of the hood, so the crown has body seen from the side.
translate([-0.6, 2.6, 31.5]) rotate([0, 0, 90]) flame3(tongue(7.2, 4.4, 0.4), 1.2, 3.6);

// ---- Arms. Its right arm (-X) reaches out to the fireball; its left arm hangs to a hooked claw.
armR = [[-4.2, 0.1, 23.6], [-7.4, -1.4, 19.3], [-10.3, -2.5, 17.9]];
palmR = [-10.9, -2.6, 17.6];
ball = [-10.6, -2.6, 20.3];
chain(armR, [1.1, 0.75, 0.55], shade);
ellL([1.1, 1.0, 0.7], palmR, navy);
// Four claws spread under the ball and curling up its outer side.
for (d = [[-1, 0.3], [-0.85, -0.55], [-0.2, -1], [0.7, -0.75]])
  chain([palmR + [d[0] * 0.7, d[1] * 0.7, 0], palmR + [d[0] * 2.0, d[1] * 1.9, 0.6],
         palmR + [d[0] * 2.4, d[1] * 2.2, 2.2 - d[0] * 0.8]], [0.34, 0.27, 0.07], clawBlue);
// The fireball: a glowing cyan heart in a blue shell, flames licking up from it.
ellL([2.4, 2.4, 2.4], ball, fBlue);
ellL([1.85, 1.6, 1.85], ball + [0, -1, 0.1], ballCore);
translate(ball) rotate([0, 0, 30]) translate([0, 0, 0.6]) flame3(tongue(4.6, 4.2, -0.3), 1.2, 1.8);
translate(ball) rotate([0, 0, 120]) translate([0, 0, 1.0]) flame3(tongue(3.6, 3.2, 0.3), 1, 1.6);

armL = [[4.2, 0.1, 23.8], [7.6, -0.6, 20.4], [10.4, -1.6, 15.4]];
palmL = [10.8, -1.8, 14.6];
chain(armL, [1.1, 0.8, 0.55], shade);
ellL([0.9, 0.8, 1.0], palmL, navy);
for (d = [[-0.9, -0.4], [-0.3, -0.95], [0.5, -0.85], [0.95, 0]])
  chain([palmL + [d[0] * 0.5, d[1] * 0.5, -0.5], palmL + [d[0] * 1.1, d[1] * 1.0, -1.7],
         palmL + [d[0] * 0.8, d[1] * 0.8 - 0.3, -2.9]], [0.3, 0.22, 0.06], navy);
// The navy blades on the forearm.
blade([8.8, -0.9, 18.4], [10.2, 0.2, 23.7], 0.9, navy);
blade([9.5, -1.2, 17.0], [11.2, -0.6, 20.0], 0.6, navy);
// The loose flame beside its left claw, leaning in towards it.
translate([14.6, -1.4, 14.3]) rotate([0, 0, 30]) flame3(tongue(5.6, 2.9, -0.32), 1, 2.6);
