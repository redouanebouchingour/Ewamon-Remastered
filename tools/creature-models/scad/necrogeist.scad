// Necrogeist: the last of the Malice line, a Gengar-like indigo wraith with a jagged yellow grin, slanted glowing
// eyes, a three-flame crest under a pale halo, big three-bladed bat-butterfly wings veined in pink and cyan neon, a
// blazing pink star in its chest and a ghost tail curling away instead of legs. The big pink aura burst behind it in
// the art is an effect and is NOT modelled; nor is the ground shadow under it (it hovers).
// Checklist (front sheet, 40 units; art sheet x, z; the body's axis sits at art x -2, so scad sheet x = art x + 2):
//   head   a round dome x -6.8..1.8, z 20.8..28, no neck, sitting low on the shoulders
//   crest  two tall flame horns curving outwards (tips (-6, 32) and (2.3, 32.6)), a short middle point (-2.4, 29.6),
//          a little side spike on each side of the head at z 26.3
//   eyes   two pale yellow glowing wedges, inner corners low by the nose, outer corners high: near x -2.7..-0.7,
//          far x -5.6..-4.1, z 23.3..25.3
//   grin   a wide yellow jack-o'-lantern grin x -5.4..-0.2, z 21..23.9, jagged teeth
//   halo   a pale cream ring floating just over the horns, x -6.8..2.7, z 32..34.3
//   chest  a glowing pink star at (-1.75, 17): white core, magenta ring, rays, the downward one long (to z 11.8)
//   arms   from the shoulders out and down to big clawed hands, near hand x 6..11 / far x -14.5..-9.3, z 10..15.5,
//          three or four hooked claws hanging down
//   wings  three long pointed blades each side, swept up and out from the shoulders: tips (18.7, 39.7), (18.6, 31.2),
//          (12.8, 21.1); a hook at the top root; dark membrane, a lighter leading edge, a pink-to-cyan neon loop in
//          each blade
//   hind   two small dark hindwing lobes at the hips, cyan inside, pointing down and out (near tip (6.6, 9.3))
//   tail   the ghost body narrows at the waist (z 13.5), swells to a bulb (bottom z 6.5) and curls away to the
//          viewer's right in a tapering tail, tip (12.5, 8.4)
//   back   the back of the head and its crest, the wings from behind (same veins), a long four-point pink star on the
//          back, the tail
include <lib.scad>
// ground: 1

body = [0.24, 0.13, 0.37];
bodyHi = [0.34, 0.17, 0.49];
wingDk = [0.17, 0.09, 0.28];
wingEdge = [0.38, 0.2, 0.54];
vPink = [0.88, 0.33, 0.76, GLOW];
vCyan = [0.68, 0.9, 1, NOGLOW];
eyeC = [1, 0.88, 0.35, GLOW];
grinC = [0.98, 0.84, 0.42, GLOW];
starRay = [0.95, 0.42, 0.85, GLOW];
starRing = [0.85, 0.25, 0.7, GLOW];
starCore = [1, 0.93, 1, GLOW];
backStar = [0.96, 0.5, 0.88, GLOW];
haloC = [1, 0.94, 0.76, NOGLOW];

// ---- decal helpers: a 2D shape projected along -Y (or +Y) onto a thin shell of a part
module ellShell(r, c, g = 0.05) {
  translate(c) difference() { scale(r * (1 + g)) sphere(1, $fn = 40); scale(r * 0.96) sphere(1, $fn = 40); }
}
module capShell(p1, p2, r1, r2, g = 0.15) {
  difference() {
    hull() { translate(p1) sphere(r1 + g); translate(p2) sphere(r2 + g); }
    hull() { translate(p1) sphere(r1 - 0.25); translate(p2) sphere(r2 - 0.25); }
  }
}
// children(0): the shell, children(1): the 2D shape (x, z) centred on o = [x, z]
module decal(o, back = false) {
  intersection() {
    children(0);
    translate([o[0], 0, o[1]]) rotate([back ? -90 : 90, 0, 0]) linear_extrude(30) children(1);
  }
}
module line2(pts, w = 0.5) {
  for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w / 2, $fn = 8); translate(pts[i + 1]) circle(w / 2, $fn = 8); }
}
// A star of rays: [angle, length, base half-width]
module rays(rs) {
  for (r = rs) rotate(r[0]) polygon([[0, -r[2]], [r[1], 0], [0, r[2]]]);
}

// ---- body: chest, waist, the ghost bulb and the curling tail (one chain)
headR = [5.2, 4, 4.1];
headC = [0, -0.5, 24.6];
chestR = [4.3, 3.8, 4.1];
chestC = [0, 0.8, 18];
TAIL = [[0, 1.2, 14.5], [0.4, 2.5, 9.6], [2.8, 3.2, 6.9], [5, 3.7, 5.9], [7.6, 4.5, 5.6], [10, 5.4, 6.1], [11.6, 6, 7.3], [12.8, 6.4, 8.9]];
TAIL_R = [2.8, 3.6, 2.4, 1.6, 1.25, 0.95, 0.6, 0.15];
ell(chestR, chestC, body);
chain(TAIL, TAIL_R, body);
// Shoulder spikes rising beside the head.
mirror_x() limb([4.6, 1.5, 21.2], [5.8, 2, 26.2], 0.9, 0.08, body);

// Chest star: white core, magenta ring, rays (the downward one long, onto the waist).
starO = [0, 17.3];
color(starRay) decal(starO) { ellShell(chestR, chestC, 0.05); rays([[45, 4.2, 0.7], [135, 3.8, 0.7], [-10, 4, 0.65], [190, 2.8, 0.5], [90, 2.8, 0.5], [-55, 3.2, 0.55], [-125, 3.2, 0.55], [-90, 4, 0.75]]); }
color(starRay) decal(starO) { capShell(TAIL[0], TAIL[1], TAIL_R[0], TAIL_R[1]); rays([[-90, 5.6, 0.6]]); }
color(starRing) decal(starO) { ellShell(chestR, chestC, 0.07); circle(2.15, $fn = 28); }
color(starCore) decal(starO) { ellShell(chestR, chestC, 0.09); circle(1.5, $fn = 24); }
// The star shining through on the back: four long points.
color(backStar) decal([0, 17.5], back = true) { ellShell(chestR, chestC, 0.05); rays([[90, 5, 0.9], [0, 4, 0.8], [180, 4, 0.8], [-90, 4.5, 0.9]]); }
color(backStar) decal([0, 17.5], back = true) { capShell(TAIL[0], TAIL[1], TAIL_R[0], TAIL_R[1]); rays([[-90, 5.5, 0.9]]); }

// ---- arms: out and down from the shoulders to big clawed hands, four hooked claws hanging down
ARM = [[5.5, 0.5, 20], [9.3, 1, 18], [11.2, 0.8, 14.6], [11.5, 0.3, 13.2]];
ARM_R = [2, 1.6, 1.25, 1.55];
CLAWS = [-1.2, -0.4, 0.4, 1.2];
mirror_x() {
  chain(ARM, ARM_R, body);
  for (dx = CLAWS) chain([[11.5 + dx, -0.2 - abs(dx) * 0.3, 12.4], [11.6 + dx * 1.3, -0.9, 10.9], [11.1 + dx * 1.3, -1.2, 9.7]],
                         [0.55, 0.38, 0.08], body);
}

// ---- head: a round dome low on the shoulders, three flame points on top, a small spike each side
ell(headR, headC, body);
mirror_x() {
  chain([[2.4, -0.3, 27.4], [3.9, -0.1, 30.2], [5.3, 0.1, 32.5]], [1.9, 0.9, 0.1], body);
  limb([4.6, -0.5, 26.3], [6.1, -0.3, 26.8], 0.6, 0.06, body);
}
limb([0, -1.2, 27.6], [0, -1.5, 30], 1.3, 0.1, bodyHi);
// Eyes: glowing yellow wedges, inner corners low by the nose, outer corners high.
color(eyeC) mirror_x() decal([0, 24.8]) { ellShell(headR, headC, 0.05); offset(r = 0.2) polygon([[0.6, -0.95], [2.8, -1.1], [3.3, 0.95]]); }
// Grin: a wide yellow crescent with jagged teeth (notches from the top and the bottom).
color(grinC) decal([0, 22.2]) {
  ellShell(headR, headC, 0.05);
  difference() {
    polygon(concat([for (t = [-1 : 0.125 : 1]) [3.5 * t, -1.2 + 2.15 * t * t]],
                   [for (t = [1 : -0.125 : -1]) [3.2 * t, -0.15 + 1.05 * t * t]]));
    for (x = [-1.6, 0, 1.6]) translate([x, -0.15 + 1.05 * pow(x / 3.2, 2)]) polygon([[-0.4, 0.3], [0.4, 0.3], [0, -0.75]]);
    for (x = [-0.8, 0.8, -2.3, 2.3]) translate([x, -1.2 + 2.15 * pow(x / 3.5, 2)]) polygon([[-0.3, -0.3], [0.3, -0.3], [0, 0.45]]);
  }
}

// ---- halo: a pale ring floating just over the horns
color(haloC) translate([0, 0, 33.6]) rotate([6, 0, 0]) rotate_extrude($fn = 48) translate([4.7, 0]) scale([1, 0.7]) circle(0.45, $fn = 8);

// ---- wings: three pointed blades each side, in a plane just behind the shoulders (y = 3). Outlines read off the
// near wing on the sheet (art x, z) and turned into scad x for that depth.
function conv(p) = [(p[0] + 0.5) / 0.866, p[1] - 0.4];
WING = [[1.5, 21.5], [4.6, 20.8], [6.7, 22], [9.3, 22], [12.8, 21.1], [10.9, 25], [14, 26.4], [16.7, 28.5], [18.6, 31.2],
        [12.5, 29.5], [15.6, 32.7], [17.1, 37], [18.7, 39.7], [14, 38.3], [10.5, 36.3], [8, 34], [5.3, 31.5], [4.6, 31],
        [5, 29.1], [6, 30.2], [6.7, 30], [7, 28], [6.5, 26], [5, 24], [3.5, 23], [1.5, 24]];
EDGE = [[5.3, 31.5], [8, 34], [10.5, 36.3], [14, 38.3], [18.2, 39.5]];
PINK = [[[7.6, 26], [8.8, 29.5], [10, 32.7], [11.4, 34]], [[13, 31.6], [10.9, 30], [9.3, 28.2], [7.6, 26]],
        [[9.1, 27.6], [12.5, 28.3]], [[13.5, 27.3], [12, 26.4], [9.3, 25.3]], [[5.1, 21.2], [7.2, 23.4], [9, 23.4]]];
CYAN = [[[11.4, 34], [13, 35.5], [15, 36.2], [14, 33.5], [13, 31.6]], [[12.5, 28.3], [15.5, 28.9], [13.5, 27.3]],
        [[9, 23.4], [10.9, 22.1], [9.6, 24.2]]];
module wing() {
  translate([2, 3, 21]) rotate([0, 0, -4]) scale(0.94) translate([-2, 0, -21]) rotate([90, 0, 0]) {
    color(wingDk) linear_extrude(1.1, center = true) offset(r = 0.45) polygon([for (p = WING) conv(p)]);
    color(wingEdge) linear_extrude(1.4, center = true) line2([for (p = EDGE) conv(p)], 0.9);
    color(vPink) for (l = PINK) linear_extrude(1.35, center = true) line2([for (p = l) conv(p)], 0.5);
    color(vCyan) for (l = CYAN) linear_extrude(1.35, center = true) line2([for (p = l) conv(p)], 0.55);
  }
}
mirror_x() wing();

// ---- hindwings: small dark lobes at the hips, cyan inside, pointing down and out
HIND = [[3.4, 13.6], [5.6, 13.2], [7.2, 11.2], [7.9, 8.2], [6.2, 9.8], [4.2, 11.4]];
mirror_x() translate([0, 2.6, 0]) rotate([90, 0, 0]) {
  color(wingDk) linear_extrude(0.9, center = true) offset(r = 0.3) polygon(HIND);
  color(vCyan) linear_extrude(1.2, center = true) line2([[5.2, 12.3], [6.4, 10.6], [7.2, 9.3]], 0.45);
}
