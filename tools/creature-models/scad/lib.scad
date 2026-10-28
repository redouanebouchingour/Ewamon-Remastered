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
// Angry / intimidating eyes: `lid` (0..1) hoods that share of the eye's height under a lid of colour `lid_c` (the skin),
// its edge slanted `lid_tilt` degrees down towards the nose (x = 0), whichever side of the face the eye is on. A lidded
// eye also gets a lower lid rising towards the outer corner (`squint`, share of the height) and no highlight unless
// `shine = true` is passed: the highlight is what makes an eye read cute. Its pupil narrows to a slit (`slit`, the
// pupil's width as a share of the round one).
module eye(p, size, iris = "black", sclera = "white", yaw = 0, pupil = "black", shine = undef, flat = 0.45,
           lid = 0, lid_tilt = 20, lid_c = "black", squint = undef, slit = undef, lid_dir = undef) {
  // Lids read best a little steeper than the number suggests at game distance. `lid_dir` (+1 / -1) forces which way
  // the lid's edge slopes instead of "down towards the nose" (a sidelong glare has both lids sloping the same way).
  tilt = (lid_dir == undef ? (p[0] < 0 ? 1 : -1) : lid_dir) * lid_tilt * 1.25;
  pw = slit == undef ? (lid > 0 ? 0.45 : 1) : slit;
  sq = squint == undef ? lid * 0.4 : squint;
  translate(p) rotate([0, 0, yaw]) {
    if (lid > 0) color(lid_c) intersection() {
      scale([1.1, 0.88, 1.12]) sphere(size, $fn = 20);
      // Pitched forward so the edge overhangs the iris like a brow: the game camera looks down on it.
      rotate([12, tilt, 0]) translate([-3 * size, -3 * size, size * (1.15 - 2.3 * lid)]) cube(6 * size);
    }
    if (lid > 0 && sq > 0) color(lid_c) intersection() {
      scale([1.08, 0.88, 1.18]) sphere(size, $fn = 20);
      rotate([0, tilt * -0.5, 0]) translate([-3 * size, -3 * size, -6 * size - size * (1.15 - 2.3 * sq)]) cube(6 * size);
    }
    color(sclera) scale([1, flat, 1.15]) sphere(size, $fn = 20);
    color(iris) translate([0, -size * flat * 0.62, -size * 0.05]) scale([0.68, 0.5, 0.82]) sphere(size, $fn = 18);
    // The iris front sits at -(flat * 0.62 + 0.5) * size; the pupil's front pokes just past it.
    if (pupil != iris) color(pupil) translate([0, -size * (flat * 0.62 + 0.24), -size * 0.05]) scale([0.36 * pw, 0.3, 0.46 + 0.2 * (1 - pw)]) sphere(size, $fn = 14);
    if (shine == undef ? lid == 0 : shine) color("white") translate([size * 0.25, -size * flat * 1.05, size * 0.3]) sphere(size * 0.2, $fn = 10);
  }
}

// Mirrors children across the YZ plane and keeps the original (left/right pairs).
module mirror_x() {
  children();
  mirror([1, 0, 0]) children();
}

// Rotation that turns +Z into direction d (for cylinders/spikes).
function _dir_rot(d) = let(l = norm(d), b = acos(d[2] / l), c = atan2(d[1], d[0])) [0, b, c];

// ---- Outline-driven parts (2026-10-28). The outlines come from `node src/measure.mjs <id> --trace`: [x, z] points in
// the sheet's units (front height 40, feet on z = 0). They give a part the sprite's exact silhouette from the front.

// Flat plate from an [x, z] outline, `t` thick, standing in the XZ plane (facing -Y) with its corners rounded by `r`
// (wings, fins, leaves, flames, crests, ribbons). Place and turn it with translate() / rotate() outside.
// `grow` widens the outline (units): traced outlines run inside the sprite's ink line, about 0.45 short on every edge.
module plate(pts, t = 1, r = 0.4, c, grow = 0.45) {
  color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(r = r + grow) offset(delta = -r) polygon(pts);
}

// Pillow from an [x, z] outline: exact silhouette at the front, swelling to `depth` thick with a rounded
// cross-section (a body, a head, a tail seen flat). `inset` is how far (units) the thickest layer sits inside the
// outline; keep it under the part's narrowest half-width or the middle layer vanishes and the slab goes flat.
module slab(pts, depth, c, inset = 1.5, grow = 0.45) {
  color(c) hull() for (k = [[0, 0.1], [0.45, 0.6], [1, 1]]) {
    rotate([90, 0, 0]) linear_extrude(height = max(0.1, depth * k[1]), center = true) offset(r = grow - inset * k[0]) polygon(pts);
  }
}

// ---- The picture plane. The front art is a three-quarter view: the preview camera (and the game's front turn) looks
// at the scad from VIEW degrees round from straight ahead, so a scad point (x, y, z) lands on the measurement sheet at
//   sheet_x = cos(VIEW) * x + sin(VIEW) * y = 0.866 x + 0.5 y,   sheet_z = z (minus about 0.17 per unit of depth)
// A part at the creature's side (x = 16, y = 0) reads 13.9 on the sheet; a snout at (0, -10) reads -5.
VIEW = 30;
// Scad position for a point read off the FRONT sheet at sheet x `sx`, height `z`, at the scad depth `y` you choose.
function fromSheet(sx, z, y = 0) = [(sx - sin(VIEW) * y) / cos(VIEW), y, z];
// Children authored in sheet coordinates (x = sheet x, z = sheet z, +y = depth away from the viewer), stood in the
// picture plane `d` units behind it: plates and slabs traced from the FRONT sheet go inside pp(). Mirror-symmetric
// parts should NOT: build those in the scad frame with mirror_x() and place them with fromSheet().
module pp(d = 0) { rotate([0, 0, VIEW]) translate([0, d, 0]) children(); }
// The same for outlines traced from the BACK sheet (its x is screen x seen from behind, the creature's +X to the left).
module ppBack(d = 0) { rotate([0, 0, 180 - VIEW]) translate([0, d, 0]) children(); }
// The prism of a FRONT-sheet outline through the whole model along the view: intersect a rough volume with it to cut
// the exact silhouette (`intersection() { blob(...); prism(pts); }`), or a body grown a little to lay a marking on it
// flush (`color(mark) intersection() { ell(r + 0.3, p); prism(markPts); }` right after the body in the skin colour).
module prism(pts, len = 120) { pp(0) rotate([90, 0, 0]) linear_extrude(height = len, center = true) polygon(pts); }
// Body of revolution round the Z axis from a profile of [radius, z] pairs, bottom to top (eggs, pears, drops): the
// radius per height read straight off the sheet's half-widths. Lean it with rotate() outside.
module lathe(profile, c, fn = 36) {
  color(c) rotate_extrude($fn = fn) polygon(concat([[0, profile[0][1]]], profile, [[0, profile[len(profile) - 1][1]]]));
}
