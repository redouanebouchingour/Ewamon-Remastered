// Devourest: Malice grown into a horned indigo wraith with feathered violet wings, a glowing pink chest sigil and
// a wicked yellow grin.
include <lib.scad>

body = [0.2, 0.15, 0.32];
bodyHi = [0.3, 0.22, 0.45];
wingDk = [0.3, 0.2, 0.5];
wingMid = [0.62, 0.36, 0.8];
wingEdge = [1, 0.55, 0.92];
glow = [1, 0.92, 0.55];
sigil = [1, 0.5, 0.92];
sigilCore = [1, 0.85, 0.97];
swirl = [0.78, 0.4, 0.8];

// Shape (2D children, drawn in x/z around (0,0) at offset o) projected along -Y (or +Y with back = true) onto an
// ellipsoid of radii r at c: a thin shell of the ellipsoid cut by the extruded shape, so it hugs the surface.
module paint(r, c, o, grow = 0.05, back = false) {
  intersection() {
    translate(c) difference() { scale(r * (1 + grow)) sphere(1, $fn = 40); scale(r * 0.97) sphere(1, $fn = 40); }
    translate([o[0], c[1], o[1]]) rotate([back ? -90 : 90, 0, 0]) linear_extrude(r[1] * 2) children();
  }
}
module crescent(r, off, ri) {
  difference() { circle(r, $fn = 24); translate(off) circle(ri, $fn = 24); }
}
// Swirl mark: a thick spiral polyline.
module curl(s = 1, turns = 1.3) {
  for (i = [0 : 11]) let(a0 = i * turns * 30, a1 = (i + 1) * turns * 30, r0 = s * (2.4 - i * 0.17), r1 = s * (2.4 - (i + 1) * 0.17))
    hull() { translate([r0 * cos(a0), r0 * sin(a0)]) circle(0.32 * s, $fn = 8); translate([r1 * cos(a1), r1 * sin(a1)]) circle(0.32 * s, $fn = 8); }
}

// Wispy lower body trailing to the ground.
chain([[0, 0, 15], [0, 0.5, 10], [1.5, 1, 6], [3.5, 1.5, 3], [5, 1, 1.2], [6.5, 0.5, 1.4], [7, 0, 2.6]],
      [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5], body);
// Torso: tall egg.
torso = [8, 7, 9];
torsoC = [0, 0, 21];
ell(torso, torsoC, body);
// Pink chest sigil: a glowing diamond with swirls either side.
color(sigil) paint(torso, torsoC, [0, 22]) scale([1, 1.6]) rotate(45) square(4.4, center = true);
color(sigilCore) paint(torso, torsoC, [0, 22], grow = 0.08) scale([1, 1.5]) circle(1.6, $fn = 16);
color(sigil) paint(torso, torsoC, [0, 16]) scale([0.5, 1]) circle(2, $fn = 4);
color(swirl) mirror_x() paint(torso, torsoC, [4.4, 23]) curl(0.85);
color(swirl) mirror_x() paint(torso, torsoC, [4.6, 17.5]) mirror([0, 1]) curl(0.75);
// The same swirls on the back.
color(swirl) mirror_x() for (z = [17, 22.5, 27]) paint(torso, torsoC, [2.6, z], back = true) curl(0.7);

// Long arms hanging out and down, their tips frayed into pink claws.
mirror_x() {
  chain([[6, 0, 26], [10, 0, 22], [12, -0.5, 16], [13, -0.5, 12]], [2.6, 2.2, 2.4, 2.6], body);
  limb([13, -0.5, 12], [13.3, -0.5, 10.2], 2.6, 2.3, wingMid);
  for (i = [-1.5 : 1 : 1.5]) spike([13 + i * 1.3, -0.5, 10.5], [i * 0.6, 0, -3.4], 0.8, 0.1, wingEdge);
}

// Head: a rounded dome sitting on the torso.
head = [8, 7, 7.5];
headC = [0, 0, 35];
ell(head, headC, body);
ell([4, 3, 3], [-2.5, -1, 40.5], bodyHi);
// Curved horns sweeping up and outward.
mirror_x() chain([[4, 0.5, 40.5], [6, 0.5, 44], [6.4, 0.6, 47], [8.4, 0.7, 48.8]], [1.8, 1.3, 0.9, 0.3], body);
// Slanted, angry crescent eyes and a wide grin.
color(glow) mirror_x() paint(head, headC, [3.2, 36.4]) rotate(18) scale([1.3, 0.85]) difference() { circle(2.3, $fn = 24); translate([0, 2.3]) square(4.6, center = true); }
color(glow) paint(head, headC, [0, 31.5]) scale([1.4, 1]) crescent(3.4, [0, 1.8], 3.2);

// Feathered wings: three overlapping violet plumes per side with pink edges, fanned out behind the shoulders.
module plume(len, wid, ang) {
  rotate([0, -ang, 0]) {
    color(wingEdge) translate([len / 2 + 2, 0.15, 0]) scale([len / 2 + 1, 0.6, wid + 0.9]) sphere(1, $fn = 24);
    color(wingMid) translate([len / 2 + 2, -0.2, 0]) scale([len / 2, 0.7, wid]) sphere(1, $fn = 24);
    color(wingDk) translate([len / 2, -0.4, 0]) scale([len / 2.6, 0.7, wid * 0.8]) sphere(1, $fn = 20);
  }
}
mirror_x() translate([6, 4, 31]) rotate([0, 0, 10]) {
  plume(19, 2.8, 58);
  plume(18, 2.6, 40);
  plume(16, 2.4, 22);
  plume(13, 2.2, 5);
  plume(10, 2, -12);
  color(wingDk) scale([4, 1, 5]) sphere(1, $fn = 20);
}
