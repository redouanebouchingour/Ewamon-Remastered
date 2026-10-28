// Gravelwisp: a floating sand-coloured hooded cloak with nothing inside but darkness and two glowing amber eyes. A
// floppy pointed hood, a wrapped scarf, a tattered hem with lilac shadows, a sandy wisp trailing below and purple
// spirit squiggles at its sides.
include <lib.scad>

sand = [0.85, 0.7, 0.45];
sandHi = [0.92, 0.8, 0.55];
lilac = [0.6, 0.48, 0.66];
lilacDark = [0.45, 0.33, 0.52];
void = [0.12, 0.1, 0.16];
amber = [1, 0.8, 0.2];
amberCore = [1, 0.95, 0.6];
wisp = [0.9, 0.62, 0.3];
squiggle = [0.5, 0.3, 0.65];

// Wisp tail under the cloak, tapering to the ground.
chain([[0, 1, 14], [0.6, 0.6, 9], [1.6, 0.4, 5], [2, 0.6, 1.4], [1.6, 0.8, 0.3]], [4, 3, 2, 1, 0.3], wisp);
// Dust motes.
for (p = [[-4, -1, 3], [5, -2, 2], [-2, -3, 0.8], [4, 1, 5], [-5, 2, 6]]) color(sandHi) translate(p) sphere(0.5, $fn = 8);

// Cloak body: a flared bell, open underneath (lilac shadow inside).
color(sand) difference() {
  hull() {
    translate([0, 0.6, 24]) scale([6.4, 6, 2]) sphere(1, $fn = 28);
    translate([0, 0.6, 14]) scale([10, 8.4, 1]) sphere(1, $fn = 32);
  }
  translate([0, 0.6, 12.6]) scale([8.8, 7.2, 4]) sphere(1, $fn = 28);
}
color(lilacDark) translate([0, 0.6, 14.2]) scale([8.6, 7, 0.6]) sphere(1, $fn = 28);
// Tattered hem: hanging triangular shreds, sand on the outside and lilac behind.
for (i = [0 : 13]) {
  a = i * 360 / 14 + 8;
  l = 4 + (i % 3) * 2.2;
  p = [10 * cos(a) * 0.96, 0.6 + 8.4 * sin(a) * 0.96, 14.6];
  color(i % 4 == 1 ? lilac : sand) hull() {
    translate(p) rotate([0, 0, a]) scale([0.5, 1.8, 0.6]) sphere(1, $fn = 10);
    translate(p + [cos(a) * 0.6, sin(a) * 0.6, -l]) sphere(0.2, $fn = 6);
  }
}
// Lilac fold shadows down the cloak.
for (a = [-60, 40, 150, 230]) color(lilac) translate([8.1 * cos(a), 0.6 + 7 * sin(a), 19]) rotate([0, 0, a]) rotate([0, -28, 0]) scale([0.5, 0.8, 5.6]) sphere(1, $fn = 10);

// Scarf: two wrapped rolls around the neck.
color(sand) translate([0, 0.4, 25]) scale([6.6, 6, 1.7]) sphere(1, $fn = 28);
color(lilac) translate([0, 0.4, 26.7]) scale([6, 5.6, 1.5]) sphere(1, $fn = 28);
color(sandHi) translate([0, 0.2, 28]) scale([5.8, 5.4, 1.4]) sphere(1, $fn = 28);
// Scarf tail hanging at the viewer's right.
color(sand) hull() {
  translate([5, -2.6, 26]) scale([1.6, 1, 1.4]) sphere(1, $fn = 10);
  translate([6.6, -2, 19]) scale([1.2, 0.6, 1]) sphere(1, $fn = 10);
}

// Hood: a big rounded cowl with a deep face opening and a floppy point bending back and to the viewer's right.
color(sand) difference() {
  hull() {
    translate([0, 0.5, 33.5]) scale([8.2, 7.8, 7.8]) sphere(1, $fn = 32);
    translate([0, 2, 40]) scale([4.4, 4.4, 3]) sphere(1, $fn = 20);
  }
  translate([0, -8.6, 32.4]) scale([6.4, 6.6, 6.2]) sphere(1, $fn = 28);
}
chain([[0, 2, 41], [0.6, 3, 44.5], [2.4, 4.4, 46.4], [5.4, 5.4, 46.2], [7, 5.4, 44.6]], [3.8, 2.8, 1.9, 1.2, 0.4], sand);
// The dark void inside.
color(void) translate([0, -1.6, 32.4]) scale([6.2, 3.4, 5.8]) sphere(1, $fn = 28);
color(lilacDark) translate([0, -1, 32.4]) scale([7.2, 3.6, 6.8]) sphere(1, $fn = 28);
// Glowing amber eyes.
mirror_x() {
  color(amber) translate([2.5, -4.6, 32.2]) scale([1.8, 0.8, 2.4]) sphere(1, $fn = 16);
  color(amberCore) translate([2.6, -5.3, 32.4]) scale([0.8, 0.3, 1.3]) sphere(1, $fn = 12);
}

// Purple spirit squiggles floating at both sides.
mirror_x() chain([[13, -1, 19], [14.4, -1, 21], [13, -1, 23], [14.4, -1, 25], [13, -1, 27], [14, -1, 28.6]], [0.45, 0.45, 0.45, 0.45, 0.45, 0.2], squiggle);
