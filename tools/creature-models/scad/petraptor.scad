// Petraptor: Shalewing grown into a standing slate-grey pterosaur. A long swept-back crest set with an amber gem,
// a tan beak, tan belly plates and back studs, and big feathered slate wings with tan wrist bones.
include <lib.scad>

slate = [0.38, 0.4, 0.48];
slateHi = [0.5, 0.52, 0.6];
slateDark = [0.3, 0.32, 0.4];
tan = [0.8, 0.66, 0.46];
tanDark = [0.62, 0.48, 0.32];
amber = [0.95, 0.55, 0.08, NOGLOW];
amberHi = [1, 0.78, 0.35];
eyeAmber = [1, 0.58, 0.05];
socket = [0.16, 0.16, 0.22];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): a hulled wedge in the skin colour, high at the
// temple and slanting down towards the nose, overhanging the eye so the face itself scowls.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.25]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.25, s * (1.25 - drop)]) scale([s * 0.5, s * 0.62, s * 0.32]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}
// Flat scales / plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th = 0.35, c) {
  for (t = list) let(az = t[0], el = t[1], sz = t[2])
    color(c) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = 8);
}

// Torso: pear-shaped, leaning slightly forward, heavy hips.
blob([[[6, 5.2, 6], [0, 1, 12.5]], [[4.6, 4.2, 4.6], [0, -0.4, 19.5]]], slate);
// Tan belly: a tapering plate with chevron bands.
blob([[[3.6, 1.6, 4.2], [0, -3.4, 18]], [[2.4, 1.6, 3], [0, -4, 11.6]]], tan);
for (i = [0 : 3]) mirror_x() color(tanDark) translate([1.1, -5.05 + i * 0.12, 20.6 - i * 2.6]) rotate([0, 58, 0]) scale([1.6 - i * 0.15, 0.3, 0.22]) sphere(1, $fn = 10);
// Neck: short and thick, curving up into the back of the skull.
chain([[0, 0, 21], [0, -1, 25], [0, -1.6, 27.6]], [3.6, 3.2, 3], slate);
// Tan bony knobs down the sides of the neck.
mirror_x() for (i = [0 : 2]) color(tan) translate([2.8 - i * 0.2, 0.6 + i * 0.4, 27 - i * 2.6]) rotate([0, 50, 0]) scale([1.4, 1, 0.8]) sphere(1, $fn = 10);

// Head: a deep wedge skull, a long tan beak hooked down at the tip, and a blade crest swept far back and up.
module head() {
  color(slate) hull() {
    translate([0, 0, 0]) scale([3.2, 3.4, 3]) sphere(1, $fn = 22);
    translate([0, -3.6, -0.6]) scale([2.4, 2, 2.2]) sphere(1, $fn = 18);
  }
  // Beak: upper bill long, flat-topped, ending in a downturned hook; lower bill shorter and darker.
  color(tan) hull() {
    translate([0, -4, 0]) scale([2.2, 1.6, 2]) sphere(1, $fn = 16);
    translate([0, -9, -0.6]) scale([1.2, 1.4, 1.1]) sphere(1, $fn = 12);
    translate([0, -11.6, -1.8]) sphere(0.45, $fn = 8);
  }
  color(tanDark) hull() {
    translate([0, -4, -2]) scale([1.8, 1.4, 0.9]) sphere(1, $fn = 12);
    translate([0, -9.4, -2.2]) sphere(0.4, $fn = 8);
  }
  mirror_x() color(slateDark) hull() { translate([1.9, -4.6, -1.3]) sphere(0.16, $fn = 6); translate([1, -9.6, -1.7]) sphere(0.14, $fn = 6); }
  // Crest: a broad slate blade from the brow sweeping back, rimmed in tan, the amber gem set in each face.
  color(slate) hull() {
    translate([0, -2.4, 2]) scale([1.8, 2.4, 1.4]) sphere(1, $fn = 14);
    translate([0, 3, 1.6]) scale([1.6, 2.4, 1.6]) sphere(1, $fn = 14);
    translate([0, 11.4, 9.6]) sphere(0.5, $fn = 8);
  }
  color(tan) hull() {
    translate([0, -3.4, 2.8]) scale([1.3, 1.4, 1]) sphere(1, $fn = 10);
    translate([0, 11.6, 9.8]) sphere(0.6, $fn = 8);
    translate([0, 7, 8.4]) sphere(0.9, $fn = 8);
  }
  mirror_x() {
    color(tan) translate([1.1, 4, 5]) rotate([-52, 0, 0]) scale([0.5, 2.3, 4.4]) sphere(1, $fn = 14);
    color(amber) translate([1.35, 4, 5]) rotate([-52, 0, 0]) scale([0.5, 1.6, 3.6]) sphere(1, $fn = 14);
    color(amberHi) translate([1.65, 3.6, 5.6]) rotate([-52, 0, 0]) scale([0.3, 0.6, 1.4]) sphere(1, $fn = 10);
  }
  // Fierce amber eyes hooded by a tan brow.
  mirror_x() {
    color(socket) translate([1.95, -2.85, 0.85]) rotate([0, 0, 40]) scale([1.5, 0.6, 1.25]) sphere(1.3, $fn = 14);
    eye([1.9, -2.8, 0.85], 1.55, iris = eyeAmber, pupil = [0.12, 0.04, 0.0], sclera = [1, 0.92, 0.7], yaw = 40, flat = 0.5,
        lid = 0.42, lid_tilt = 30, lid_c = socket);
    brow([1.9, -2.8, 0.85], 1.55, 40, 0.7, slate);
  }
}
translate([0, -3, 29]) rotate([-4, 0, 0]) scale(1.3) head();

// Tan studs down the back of the neck and spine to the tail.
spinePts = [[0, 2.4, 27], [0, 3, 24], [0, 4, 21], [0, 5.4, 18], [0, 6.4, 15], [0, 6.8, 12], [0, 7, 9], [0, 9.6, 6.4], [0, 12.4, 4], [0, 15, 2.4]];
for (i = [0 : len(spinePts) - 1]) color(tan) translate(spinePts[i]) scale([1.3, 1.1, 0.9]) sphere(1.3 - i * 0.07, $fn = 12);

// Short tail sweeping back to the ground, with darker scale bands across it.
tailPts = [[0, 4, 10], [0, 8, 6], [0, 12.4, 3.2], [0.6, 17, 1.4]];
tailRs = [3.4, 2.4, 1.4, 0.3];
chain(tailPts, tailRs, slate);
for (i = [0 : len(tailPts) - 2]) for (u = [0.35, 0.8]) let(d = tailPts[i + 1] - tailPts[i], r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(slateDark) translate(tailPts[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.28]) sphere(1, $fn = 10);
// Scale rows on the back and haunches, and tan spikes up the back of the neck like the sprite's.
mirror_x() plates([0, 1, 12.5], [6, 5.2, 6], [for (az = [20 : 24 : 110]) for (el = [-10 : 20 : 45]) [az, el, 1.2]], 0.35, slateDark);
for (i = [0 : 2]) spike([0, 2.4 + i * 0.6, 27.6 - i * 2.8], [0, 2.4, 0.8], 0.8, 0.08, tan);

// Legs: thick thighs, short shins, broad feet with tan claws.
mirror_x() {
  ell([3, 3.6, 4.2], [3.8, 0, 9], slate);
  plates([3.8, 0, 9], [3, 3.6, 4.2], [for (az = [-50 : 30 : 70]) for (el = [-10 : 22 : 35]) [az, el, 0.9]], 0.35, slateDark);
  color(tan) translate([4.5, -1.6, 6]) scale([1.3, 0.8, 1.1]) sphere(1, $fn = 10);
  limb([4, 0, 7], [4.4, -0.4, 2], 2, 1.6, slate);
  color(slate) hull() { translate([4.4, -1.6, 1.2]) scale([2.2, 3, 1.2]) sphere(1, $fn = 14); }
  for (a = [-32, 0, 32]) spike([4.4 + sin(a) * 1.5, -4.2, 0.9], [sin(a) * 0.6, -1.5, -0.5], 0.55, 0.05, tan);
  spike([4.4, 1, 0.9], [0, 1.4, -0.4], 0.45, 0.05, tan);
}

// Wings: an arm raised out to a tan-capped wrist with clawed fingers curled forward, and a fan of long blade feathers
// hanging from the forearm, each a flattened leaf with a pale edge, longest at the outside.
module feather(top, bot, w, c) {
  color(c) hull() {
    translate(top) scale([w, 0.5, 0.6]) sphere(1, $fn = 10);
    translate(top + (bot - top) * 0.62) scale([w * 0.95, 0.45, 0.6]) sphere(1, $fn = 10);
    translate(bot) scale([w * 0.2, 0.3, 0.3]) sphere(1, $fn = 6);
  }
}
module wing() {
  sh = [4.4, 0, 22]; el = [9, 1, 19.6]; wr = [13.6, -0.6, 25];
  chain([sh, el, wr], [2.4, 1.9, 1.5], slate);
  // Tan wrist bone along the leading edge, a hooked knob on top.
  chain([[9.6, 0.4, 20.6], wr, [17.6, 0.6, 24.6]], [1, 1.3, 0.6], tan);
  spike(wr, [0.4, 0, 2.2], 0.9, 0.1, tan);
  // Hand: three tan claws curling forward and in.
  for (a = [-35, 0, 35]) chain([wr + [-0.6, -1, -0.4], wr + [-1.4 + sin(a) * 0.8, -2.6, -1.2], wr + [-2 + sin(a) * 1, -3, -2.6]], [0.5, 0.4, 0.08], tan);
  // Feathers hang from the forearm and wing finger, overlapping, alternating shades.
  roots = [[6.6, 1, 19], [9, 1.6, 19.2], [11.4, 1.4, 21.4], [13.6, 1, 23.6], [15.6, 1.2, 24], [17.4, 1, 23.8]];
  tips = [[6.6, 2.6, 8.4], [9.6, 3.2, 6.4], [12.4, 3.4, 5.4], [15.6, 3.2, 5.6], [18.6, 2.6, 7.4], [21, 2, 10.6]];
  for (i = [0 : len(roots) - 1]) feather(roots[i], tips[i], 2.1, i % 2 == 0 ? slate : slateHi);
  // Dark quill down each blade feather, on both faces.
  for (i = [0 : len(roots) - 1]) for (sd = [-1, 1]) limb(roots[i] + [0, sd * 0.45, 0], roots[i] + (tips[i] - roots[i]) * 0.85 + [0, sd * 0.3, 0], 0.3, 0.12, slateDark);
  for (i = [0 : len(roots) - 2]) feather((roots[i] + roots[i + 1]) / 2 + [0, -0.6, 0], (tips[i] + tips[i + 1]) / 2 + [0, -0.6, 3], 1.5, slateDark);
}
mirror_x() wing();
