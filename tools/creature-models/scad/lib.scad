// Shared building blocks for the creature models. `include <lib.scad>` at the top of every creature file.
//
// Conventions (build.mjs relies on them):
//   - Z is up, the feet stand on z = 0.
//   - The creature faces -Y (towards the front camera); its back is +Y; +X is the viewer's right when looking at its
//     face (the creature's own left). Mirror-symmetric parts use `mirror_x()`.
//   - Model about 40 units tall; build.mjs normalises the GLB to 1 m tall, so only proportions matter.
//   - Every part has a colour(); uncoloured geometry comes out OpenSCAD yellow in the GLB.
//   - Keep it under ~25k triangles: $fn comes from $fa / $fs below; raise $fn only on large, visible curves.
//   - Glow (the emissive mask in game): bright, vivid colours glow on their own (the sprites' rule, capped at 8 % of
//     the surface). Force a colour with an alpha marker: color([r, g, b, GLOW]) always glows, NOGLOW never does.

GLOW = 0.98;
NOGLOW = 0.96;

$fa = 8;
$fs = 0.7;

// Ellipsoid with radii r = [rx, ry, rz] centred at p.
module ell(r, p = [0, 0, 0], c) {
  color(c) translate(p) scale(r) sphere(1, $fn = 28);
}

// Smooth capsule between two points with end radii r1 and r2 (limbs, tails, horns, necks).
module limb(p1, p2, r1, r2 = undef, c) {
  color(c) hull() {
    translate(p1) sphere(r1);
    translate(p2) sphere(r2 == undef ? r1 : r2);
  }
}

// Chain of capsules through points pts with radii rs (one per point): curved tails, tentacles, manes.
module chain(pts, rs, c) {
  for (i = [0 : len(pts) - 2]) limb(pts[i], pts[i + 1], rs[i], rs[i + 1], c);
}

// Hull of ellipsoids: list of [ [rx, ry, rz], [x, y, z] ] pairs, for organic bodies.
module blob(parts, c) {
  color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = 28);
}

// Cone/spike from base point p along direction d (any length), base radius r, tip radius tip.
module spike(p, d, r, tip = 0.05, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = l, r1 = r, r2 = tip, $fn = 16);
}

// Flat-ish petal / leaf / fin / ear: an ellipsoid of radii r rotated by rot (degrees) at p.
module petal(r, p, rot = [0, 0, 0], c) {
  color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = 24);
}

// Cartoon eye on a surface: white (or sclera colour), iris, pupil and a highlight, looking along -Y and tilted by
// `yaw` (degrees about Z) so eyes on a round head can look outward. size = eye radius.
module eye(p, size, iris = "black", sclera = "white", yaw = 0, pupil = "black", shine = true, flat = 0.45) {
  translate(p) rotate([0, 0, yaw]) {
    color(sclera) scale([1, flat, 1.15]) sphere(size, $fn = 20);
    color(iris) translate([0, -size * flat * 0.62, -size * 0.05]) scale([0.68, 0.5, 0.82]) sphere(size, $fn = 18);
    // The iris front sits at -(flat * 0.62 + 0.5) * size; the pupil's front pokes just past it.
    if (pupil != iris) color(pupil) translate([0, -size * (flat * 0.62 + 0.24), -size * 0.05]) scale([0.36, 0.3, 0.46]) sphere(size, $fn = 14);
    if (shine) color("white") translate([size * 0.25, -size * flat * 1.05, size * 0.3]) sphere(size * 0.2, $fn = 10);
  }
}

// Mirrors children across the YZ plane and keeps the original (left/right pairs).
module mirror_x() {
  children();
  mirror([1, 0, 0]) children();
}

// Rotation that turns +Z into direction d (for cylinders/spikes).
function _dir_rot(d) = let(l = norm(d), b = acos(d[2] / l), c = atan2(d[1], d[0])) [0, b, c];
