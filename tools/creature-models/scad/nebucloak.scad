// Nebucloak: a small mint-skinned imp in a pointed purple hood and short cape (magenta lining), glowing magenta eyes,
// a gem clasp at the collar, clawed hands raised and wisps of pale blue wind circling it.
include <lib.scad>

skin = [0.5, 0.78, 0.7];
skinDark = [0.36, 0.62, 0.58];
cream = [0.93, 0.92, 0.72];
hood = [0.36, 0.18, 0.55];
hoodDark = [0.24, 0.1, 0.4];
cape = [0.55, 0.38, 0.75];
lining = [0.72, 0.18, 0.55];
gem = [0.85, 0.15, 0.6];
eyeGlow = [0.95, 0.3, 0.95];
wind = [0.62, 0.84, 0.95];
claw = [0.95, 0.95, 0.88];

// Legs, slightly apart.
mirror_x() {
  limb([2.6, 0, 12], [3.2, -0.5, 3], 2.8, 2, skin);
  ell([2.1, 2.8, 1.4], [3.2, -1.4, 1.4], skinDark);
}
// Torso: a slim body with a cream front.
blob([[[4.6, 3.6, 4], [0, 0, 13]], [[3.6, 3, 3.4], [0, 0, 18]]], skin);
blob([[[3, 1.6, 3.4], [0, -2.6, 13]], [[2, 1.2, 2.4], [0, -2.4, 17]]], cream);

// Cape: an open cone, purple outside, magenta inside, flared wide at the bottom and open at the front.
module capeShell(r1, r2, h) {
  difference() {
    cylinder(h = h, r1 = r1, r2 = r2, $fn = 36);
    translate([0, 0, -0.1]) cylinder(h = h + 0.2, r1 = r1 - 0.6, r2 = r2 - 0.6, $fn = 36);
    // Front opening, widening towards the hem.
    translate([0, -r1, -1]) rotate([0, 0, 0]) linear_extrude(height = h + 2, scale = 0.3) square([r1 * 1.3, r1 * 1.4], center = true);
  }
}
translate([0, 1, 10.5]) {
  color(cape) capeShell(8.4, 4.6, 10);
  color(lining) translate([0, 0, 0.1]) scale([0.94, 0.94, 0.98]) capeShell(8.4, 4.6, 10);
}
// Collar and gem clasp.
color(hood) translate([0, 0.5, 20]) scale([5.6, 4.6, 1.8]) sphere(1, $fn = 28);
color(gem) translate([0, -4.2, 20]) scale([0.9, 0.6, 1.3]) sphere(1, $fn = 12);

// Arms raised to the sides, hands with white claws.
mirror_x() {
  chain([[4.2, 0, 19], [7.5, -1, 18], [9.5, -2, 21.5]], [1.3, 1.1, 1], skin);
  ell([1.6, 1.4, 1.7], [9.7, -2.2, 22.5], skin);
  for (a = [-35, 0, 35]) spike([9.7 + sin(a) * 1, -2.4, 23.8], [sin(a) * 0.9, -0.3, 1.6], 0.45, 0.05, claw);
}

// Head: big round mint head inside the hood.
ell([5.6, 5.2, 5.4], [0, -1.6, 27], skin);
// Face: a pale cream face with a teal forehead point.
ell([4.6, 3, 3.6], [0, -4.4, 25.9], cream);
spike([0, -6, 30.6], [0, -0.6, -2.4], 1.1, 0.1, skinDark);
// Big slanted glowing magenta eyes.
mirror_x() translate([2.2, -6.9, 27.4]) rotate([0, 25, -20]) {
  color(hoodDark) scale([1.9, 0.7, 1.3]) sphere(1, $fn = 18);
  color(eyeGlow) translate([0, -0.35, 0]) scale([1.6, 0.6, 1.05]) sphere(1, $fn = 18);
  color("white") translate([-0.4, -0.75, 0.3]) sphere(0.35, $fn = 8);
}
// Little smile.
color(skinDark) translate([0.3, -7.3, 24.4]) rotate([90, 0, 10]) scale([1.1, 0.25, 0.3]) cylinder(h = 0.4, r = 1, center = true, $fn = 12);

// Hood: a thick shell around the head, open at the face, with a tip that flops back.
color(hood) difference() {
  translate([0, 0.5, 27.8]) scale([7, 6.6, 7.2]) sphere(1, $fn = 32);
  translate([0, 0.5, 27.8]) scale([6, 5.8, 6.2]) sphere(1, $fn = 32);
  translate([0, -8, 26.6]) scale([5.4, 5, 6]) sphere(1, $fn = 28);
}
chain([[0, 2.5, 32.5], [0.5, 4.5, 35.5], [2.8, 6, 36.5], [5, 6.5, 35.5]], [4, 2.8, 1.6, 0.6], hood);

// Wisps of wind circling the body: thin arcs of capsules.
module arc(r, z, a0, a1, tilt, rad) {
  rotate([tilt, 0, 0]) for (a = [a0 : 20 : a1 - 20])
    limb([r * cos(a), r * sin(a), z], [r * cos(a + 20), r * sin(a + 20), z], rad, rad * 0.85, wind);
}
arc(12, 26, 140, 220, 0, 0.45);
arc(12, 26, -40, 40, 0, 0.45);
arc(11, 6, 160, 260, 6, 0.45);
arc(11, 6, -60, 20, 6, 0.45);
