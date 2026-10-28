// Kygra: a lean blue bird-knight. A crown of four tall forked plumes, an angular helm with a gold trident across the
// face, a grey throat, two long curved sword-blades growing from its forearms, and thin bird legs with white talons.
include <lib.scad>

blue = [0.2, 0.36, 0.7];
blueDk = [0.07, 0.12, 0.3];
blueHi = [0.42, 0.62, 0.95];
gold = [0.97, 0.8, 0.32];
chest = [0.68, 0.66, 0.62];
talon = [0.93, 0.93, 0.9];
edge = [0.78, 0.9, 1];
eyeY = [1, 0.82, 0.12, GLOW];

// Flat plate as a hull of small spheres (crest plumes, prongs): pts, half-thickness t.
module plate(pts, t, c) {
  color(c) hull() for (p = pts) translate(p) sphere(t, $fn = 8);
}

function unit(v) = v / norm(v);
function cross3(a, b) = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Sword blade from root p along u for length l, width w in direction v (made perpendicular to u): a flat, straight
// slab with a narrow tang at the root, a dead-straight spine and cutting edge, and a long clipped point. A dark navy
// core panel, a light blue rim round it and a pale bevel along the cutting edge.
module blade(p, u0, v0, l, w) {
  u = unit(u0);
  v = unit(v0 - u * (v0 * u));
  // Outline as [t along u, s across v as a share of w]: tang, shoulder, straight edge, the clip down to the point.
  out = [[0, -0.12], [0, 0.3], [0.13, 1], [0.66, 1], [1, -0.04], [0.9, -0.16]];
  core = [[0.06, 0], [0.17, 0.84], [0.63, 0.84], [0.88, 0.02], [0.82, -0.04]];
  function at(q) = p + u * (l * q[0]) + v * (w * q[1]);
  color(blueHi) hull() for (q = out) translate(at(q)) sphere(0.4, $fn = 6);
  color(blueDk) hull() for (q = core) translate(at(q)) sphere(0.62, $fn = 6);
  color(edge) hull() for (q = [[0.14, 1.02], [0.65, 1.02], [0.98, 0]]) translate(at(q)) sphere(0.48, $fn = 6);
  // A ridge down the spine: the blade's back, thick and dark.
  color(blue) hull() for (q = [[0, -0.1], [0.88, -0.12]]) translate(at(q)) sphere(0.75, $fn = 8);
}

// Torso: lean and hunched forward, a grey throat and chest under the helm.
blob([[[5.2, 4.8, 5.6], [0, 1, 16]], [[5, 4.2, 3.8], [0, -0.5, 21.5]]], blue);
blob([[[2.2, 1.4, 2.4], [0, -3.4, 19.6]], [[2.8, 1.8, 2], [0, -3.4, 22.4]]], chest);
// Banded belly plates under the grey chest and a dark belt at the waist.
for (k = [0 : 2]) color(k == 2 ? blueDk : chest * 0.85) translate([0, -3.3 + k * 0.3, 17.6 - k * 1.7])
  scale([2.4 - k * 0.1, 1.3, 0.6]) sphere(1, $fn = 12);
color(blueDk) translate([0, 1, 13.4]) scale([5, 4.6, 0.9]) sphere(1, $fn = 20);
// Angular shoulder guards: a round shoulder capped by a lighter plate.
mirror_x() {
  ell([2.3, 2.5, 2.1], [4.4, 0, 22], blue);
  plate([[3.4, -1.6, 24], [6.4, -1, 23.2], [6.8, 1.8, 22.6], [3.6, 2, 24.2]], 0.5, blueHi);
}
// Feather mantle over the upper back: overlapping light and dark plates hanging down, the sprite's striped back.
for (r = [0 : 1]) for (i = [-2 : 2]) let(x = i * 2.1 + r * 1.05, z = 23.5 - r * 3.8)
  if (abs(x) < 5) plate([[x - 0.9, 3 + r * 0.6, z], [x + 0.9, 3 + r * 0.6, z], [x * 1.1, 5.2 + r * 0.6, z - 5]], 0.4,
                       (i + r) % 2 ? blueHi : blue);

module helm() hull() {
  translate([0, 0.5, 31.5]) scale([4.2, 3.8, 2.6]) sphere(1, $fn = 20);
  translate([0, -1.6, 28]) scale([3.6, 3.4, 2]) sphere(1, $fn = 16);
  translate([0, -3.4, 24]) sphere(1, $fn = 10);
}
module shield(k, dy, c) color(c) hull() for (q = [[-3.8, -3.2, 33.4], [3.8, -3.2, 33.4], [-3.6, -4.4, 29], [3.6, -4.4, 29], [0, -4.9, 23.4]])
  translate([q[0] * k, q[1] + dy, 29.5 + (q[2] - 29.5) * k]) sphere(0.5, $fn = 8);
// Head: big, scaled up about the neck as one piece.
translate([0, -1.5, 23]) scale(1.45) translate([0, 0, -23]) {
// Helm: an angular head, broad at the brow, narrowing to a pointed chin, pushed forward over the chest.
color(blue) helm();
// Gold trident shield over the face: an outline frame, a central blade and two side prongs.
shield(1, 0, gold);
shield(0.72, -0.5, blue);
plate([[0, -5.6, 33], [0, -6, 28], [0, -5.8, 24.4], [-0.8, -5.6, 30], [0.8, -5.6, 30]], 0.5, gold);
mirror_x() plate([[2.75, -5.2, 32.4], [2.75, -5.5, 29], [1.9, -5.7, 26.4]], 0.45, gold);
// Fierce glowing yellow eyes glaring out of the visor between the trident's blade and its prongs, hooded by the
// gold frame's brow.
mirror_x() {
  eye([1.75, -5.35, 30.4], 0.9, iris = [1, 0.95, 0.55, GLOW], pupil = [0.2, 0.1, 0.02], sclera = eyeY, yaw = -8,
      lid = 0.38, lid_tilt = 32, lid_c = blueDk, slit = 0.3, squint = 0.1);
}

// Crown: four tall plumes rising from the crown, fanned out, each ending in a forked tip.
for (i = [0 : 3]) let(x0 = -2.4 + i * 1.6, x1 = -4.6 + i * 3.1, h = 41 - abs(i - 1.5) * 1.4, y1 = 3.5 - abs(i - 1.5) * 0.6) {
  plate([[x0 - 0.8, 0.5, 32], [x0 + 0.8, 0.5, 32], [x1 - 0.8, y1, h - 3], [x1 + 0.8, y1, h - 3]], 0.75, blue);
  plate([[x1 - 0.7, y1, h - 3], [x1 - 1.1, y1 + 0.3, h + 0.2]], 0.6, blueHi);
  plate([[x1 + 0.7, y1, h - 3], [x1 + 1, y1 + 0.3, h - 0.8]], 0.6, blueHi);
}
}

// Arms: wiry upper arms, armoured forearms (a dark cuff and a pale band) that grow into the sword blades.
module forearm(e, w) {
  chain([e, w], [1.9, 1.7], blue);
  color(blueDk) hull() { translate(e + (w - e) * 0.55) sphere(2, $fn = 12); translate(w) sphere(1.85, $fn = 12); }
  color(blueHi) translate(e + (w - e) * 0.45) rotate(_dir_rot(w - e)) cylinder(h = 0.7, r = 2.05, center = true, $fn = 14);
}
// Viewer's left: the blade swept down and out in front, like a drawn sword.
chain([[-4.8, 0, 22], [-7.6, -1.5, 17.5]], [1.7, 1.6], blue);
forearm([-7.6, -1.5, 17.5], [-8.8, -4.4, 14.4]);
blade([-8.2, -3.2, 15.8], [-0.55, -0.45, -0.6], [-0.5, 0.3, 0.8], 25, 8.5);
// Viewer's right: raised up and out behind the shoulder.
chain([[4.8, 0, 22], [8, 1, 20]], [1.7, 1.6], blue);
forearm([8, 1, 20], [10.8, 0.2, 22.6]);
blade([9.6, 0.6, 21.4], [0.85, 0.25, 0.4], [-0.4, 0.2, 1], 22, 8);

// Thin bird legs: thigh, a long shin bent back, a tarsus down to the foot, white talons.
mirror_x() {
  ell([2.4, 2.8, 3], [3, 1, 12], blue);
  chain([[3.4, 0.5, 10.5], [5, -2, 6.5], [4.8, 0.4, 2.6], [4.8, -0.4, 1.2]], [1.4, 1, 0.8, 0.8], blue);
  ell([1.2, 1.4, 0.9], [4.8, -0.6, 1], blueDk);
  color(blueDk) translate([5, -2, 6.5]) sphere(1.25, $fn = 12);
  for (z = [3.4, 4.6]) color(blueDk) translate([4.85, 0.1 + (z - 3.4) * -0.35, z]) cylinder(h = 0.45, r = 1.05, center = true, $fn = 12);
  for (a = [-35, 0, 35]) spike([4.8 + sin(a) * 0.8, -1.4, 0.9], [sin(a) * 1.8, -2.8, -0.4], 0.55, 0.08, talon);
  spike([4.8, 0.6, 0.9], [0, 2, -0.4], 0.4, 0.08, talon);
}
// Short tail feathers behind.
for (a = [-25, 0, 25]) plate([[0, 4.5, 14], [sin(a) * 4, 8.5, 9], [sin(a) * 4.5, 8, 10.5]], 0.5, blueDk);
