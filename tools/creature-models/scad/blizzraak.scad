// Blizzraak: Glacifang grown into a heavy ice dragon crouched on all fours, its head low and forward with the jaw
// open on cream fangs, a crown of pale crystal spikes, the shoulders and back armoured in faceted royal-blue crystal
// plates round a pale gem orb, huge raised bat wings with pale panels and frost spray falling off their trailing
// tips, and a slim tail looped round behind on the ground that rises in a jagged crystal blade beside the head.
//
// Checklist (front sheet, z as on the sheet; the art stands on a rock: foot line z 4.4, everything is lowered by G):
//   head      x -14.7..-6, z 9..16.5: wedge snout to the viewer's left, turned 32 deg to the creature's right; jaw
//             open (gape z 10..13, slanting up to below the eye), 3 to 4 upper and 3 lower cream teeth, pink mouth
//   eye       one small slanted pale eye (x -10.2..-9.3, z 14.1..14.7) under a hard dark brow: angry, no glow
//   crown     5 pale crystal spikes rising up and back off the skull (x -13.5..-8, z 15.5..21.7)
//   neck      short and thick, pale throat; chest pale with scute bands (x -6.6..-0.5, z 10.8..14.5)
//   armour    big chunky faceted dark / royal-blue / pale ice gems over neck, shoulders, upper back (x -9..8, z 13..27), tall
//             shards on the spine (to z 27.5), a pale gem orb on each shoulder (x -2.4..0.3, z 15.8..18.5)
//   legs      thick forelegs (near x -2.6..3.5, far x -10..-6), white claws; near haunch an oval x 4.6..9.5 z 10..18
//             with a scale pattern, digitigrade hind foot x 5..10.5
//   tail      slim (r ~1.7), off the rump down behind the far hip, forward along the far side and up into a tall
//             jagged pale blade beside the head (x -19.5..-16, z 13..27; drawn a little taller). The art's near-side
//             arc and the back art's ground loop are left out (lead's call: the blade, clear of the face)
//   wings     near: wrist above the shoulder (x 1..3.5, z 33..36), top edge to the tip (19, 39.5), fingers fanning
//             down to the right, scalloped trailing edge, frost spray x 14..19 z 18..33; far: arm out to the left
//             (wrist x -14, z 32), fan up and right to z 39; pale panels, dark finger ribs, mid-blue bones
//   back      the tail sweeping to the far side, crystal gems down the spine, wing roots and the spread wings
include <lib.scad>

G = 4.4;   // the art's foot line on the rock

skin = [0.36, 0.66, 0.83];
skinDk = [0.24, 0.5, 0.71];
skinLt = [0.56, 0.81, 0.92];
pale = [0.8, 0.93, 0.97, NOGLOW];
paleMid = [0.62, 0.84, 0.93];
crystalDk = [0.15, 0.3, 0.58];
crystalMd = [0.26, 0.46, 0.78];
crystalLt = [0.64, 0.89, 0.97, NOGLOW];
orb = [0.52, 0.87, 0.97, NOGLOW];
bone = [0.27, 0.55, 0.76];
rib = [0.16, 0.38, 0.6];
memb = [0.7, 0.9, 0.97, NOGLOW];
memb2 = [0.5, 0.78, 0.91];
frost = [0.85, 0.96, 1.0, NOGLOW];
claw = [0.9, 0.97, 1.0, NOGLOW];
mouthC = [0.55, 0.22, 0.27];
tongue = [0.8, 0.5, 0.52];
fang = [0.97, 0.93, 0.8, NOGLOW];
sclera = [0.93, 0.87, 0.85, NOGLOW];
iris = [0.62, 0.42, 0.5];
pupil = [0.2, 0.07, 0.12];

// Head: placed at HC, turned HRZ towards the creature's right, nose a little down.
HC = [-2.7, -11.4, 13.2];
HRZ = -22;
HRX = -5;
HS = 1.12;

// Wings (left one; mirrored): a vertical plane through the shoulder WS, swept WA back from +X. Points in it are
// [u, z]: the near wing traced off the front sheet with u = (sheet x - WX) / 0.966 (WX = the shoulder's sheet x).
WS = [3.4, -1.5, 22];
WA = 15;
WX = 0.866 * WS[0] + 0.5 * WS[1];
function wu(q) = [(q[0] - WX) / cos(WA - 30), q[1]];
function wp(q) = [WS[0] + q[0] * cos(WA), WS[1] + q[0] * sin(WA), q[1]];
// membrane outline (sheet x, z): leading edge up from the shoulder, the long top edge to the tip, the scalloped
// trailing edge between the finger tips back down to the flank
WING = [for (q = [[0.6, 23.2], [1.2, 27.5], [2.0, 31], [2.4, 34.4], [4, 36.8], [7, 38.4], [11, 39.4], [15, 39.8], [19.1, 39.7],
                  [17.6, 37.4], [16.8, 34.8], [18.8, 30], [16.4, 30.4], [15.4, 28.4], [15.8, 25], [13.6, 26.2], [12.4, 25],
                  [10.8, 26.2], [9.5, 22.1], [7.4, 23], [6.2, 22.2], [3.4, 21.6]]) wu(q)];
// wrist, finger tips, elbow (u, z)
WWu = wu([2.4, 34.4]);
WTu = [wu([19.1, 39.7]), wu([18.8, 30]), wu([15.8, 25]), wu([9.5, 22.1])];
WEu = wu([1.4, 28.6]);
WW = wp(WWu);
WT = [for (t = WTu) wp(t)];
WE = wp(WEu);

// Tail: off the rump, down behind the far hip to the ground, forward along the far side and up into the blade.
TP = [[0, 8, 16], [-2.5, 13, 13], [-7, 14, 9], [-11.5, 10.5, 6.6], [-14.5, 5, 6.4], [-16, 0, 8], [-16.8, -3.5, 10.5],
      [-17, -5.2, 13]];
TR = [3.6, 2.8, 2.2, 2.0, 1.9, 1.7, 1.5, 1.25];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye), slanting down towards the nose.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.2]) scale([s * 0.6, s * 0.7, s * 0.4]) sphere(1, $fn = 10);
    translate([-s * 1.0, -s * 0.25, s * (1.2 - drop)]) scale([s * 0.5, s * 0.6, s * 0.34]) sphere(1, $fn = 10);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 10);
  }
}
// Flat faceted plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th, cs, fn = 6) {
  for (i = [0 : len(list) - 1]) let(t = list[i], az = t[0], el = t[1], sz = t[2])
    color(cs[i % len(cs)]) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = fn);
}
gemC = [[0.18, 0.36, 0.72], [0.3, 0.56, 0.9], [0.5, 0.78, 0.97, NOGLOW]];
// A chunky faceted ice gem standing out of an ellipsoid e = [centre, radii] at azimuth az / elevation el: a fat
// six-sided prism with a faceted point, sunk a little into the surface.
module gem(e, az, el, r, len, c) {
  cen = e[0]; rr = e[1];
  p = [cen[0] + rr[0] * cos(el) * cos(az), cen[1] + rr[1] * cos(el) * sin(az), cen[2] + rr[2] * sin(el)];
  n0 = [(p[0] - cen[0]) / (rr[0] * rr[0]), (p[1] - cen[1]) / (rr[1] * rr[1]), (p[2] - cen[2]) / (rr[2] * rr[2])];
  n = n0 / norm(n0) + [0, 0, 0.35];
  color(c) translate(p - n / norm(n) * r * 0.6) rotate(_dir_rot(n)) rotate([0, 0, az * 0.7]) hull() {
    cylinder(h = len * 0.55, r = r, $fn = 6);
    translate([0, 0, len]) sphere(r * 0.22, $fn = 6);
  }
}
// Six-sided crystal shard from p along d.
module shard(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    cylinder(h = l * 0.5, r = r, $fn = 6);
    translate([0, 0, l]) sphere(r * 0.1, $fn = 4);
  }
}

// ---------------------------------------------------------------- head (its own frame: faces -Y, origin mid-skull)
module head() {
  // Skull: a heavy cranium narrowing to a blunt wedge snout; the lower half of the snout pale.
  module skull(g = 0) {
    hull() {
      translate([0, 1.2, 1.0]) scale([3.0 + g, 3.0 + g, 2.7 + g]) sphere(1, $fn = 20);
      translate([0, -3.2, 0.8]) scale([2.3 + g, 2.2 + g, 1.9 + g]) sphere(1, $fn = 16);
      translate([0, -5.9, 0.3]) scale([1.6 + g, 1.1 + g, 1.4 + g]) sphere(1, $fn = 12);
    }
  }
  color(skinLt) skull();
  color(pale) intersection() { skull(0.12); translate([-5, -10, -3]) cube([10, 9.6, 3.6]); }
  // Snout ridge and the nostril bump, a shade darker.
  color(skinDk) hull() { translate([0, -2.2, 2.6]) scale([1.2, 1.8, 0.6]) sphere(1, $fn = 10); translate([0, -6.0, 1.4]) scale([0.8, 0.8, 0.5]) sphere(1, $fn = 8); }
  // Lower jaw, dropped open; the mouth inside and a tongue.
  color(skin) hull() {
    translate([0, 0.4, -2.3]) scale([2.6, 2.4, 1.3]) sphere(1, $fn = 14);
    translate([0, -5.0, -3.6]) scale([1.3, 1, 0.75]) sphere(1, $fn = 10);
  }
  color(pale) hull() { translate([0, -0.4, -3.2]) scale([2, 1.8, 0.7]) sphere(1, $fn = 12); translate([0, -4.6, -4.1]) scale([1, 0.8, 0.4]) sphere(1, $fn = 8); }
  color(mouthC) hull() {
    translate([0, -0.6, -1.0]) scale([2.2, 2, 0.9]) sphere(1, $fn = 12);
    translate([0, -5.3, -1.9]) scale([1.1, 0.7, 0.6]) sphere(1, $fn = 8);
  }
  color(tongue) hull() { translate([0, -1.6, -2.0]) scale([1.2, 1.2, 0.4]) sphere(1, $fn = 10); translate([0, -4.2, -2.7]) scale([0.7, 0.7, 0.3]) sphere(1, $fn = 8); }
  // Cream fangs: an upper row hanging off the lip, a lower row rising.
  mirror_x() {
    for (i = [0 : 3]) spike([1.2 + i * 0.32, -5.8 + i * 1.3, -0.7 + i * 0.05], [0, 0, -1.25 + i * 0.12], 0.34, 0.05, fang);
    for (i = [0 : 2]) spike([1.0 + i * 0.4, -4.7 + i * 1.5, -3.1 + i * 0.25], [0, 0, 1.05], 0.3, 0.05, fang);
  }
  // Small slanted pale eyes under a hard brow.
  mirror_x() {
    eye([1.95, -2.5, 1.35], 0.8, iris = iris, pupil = pupil, sclera = sclera, yaw = 42, flat = 0.5,
        lid = 0.45, lid_tilt = 28, lid_c = skinDk, slit = 0.5);
    brow([1.95, -2.5, 1.35], 0.8, 42, 0.75, skinDk);
  }
  // Crown: pale crystal spikes rising up and back off the skull.
  for (k = [[0, -3.2, 2.3, 0, 1.0, 4.4, 0], [0, 1.2, 3.3, 0, 1.8, 5.4, 1]]) shard([k[0], k[1], k[2]], [k[3], k[4], k[5]], 0.9, k[6] == 0 ? crystalLt : crystalMd);
  mirror_x() for (k = [[1.3, -2.1, 2.5, 0.6, 1.2, 5.2, 0], [2.0, 0.1, 2.6, 1.0, 1.6, 5.4, 1], [1.9, 2.4, 2.2, 1.4, 2.2, 4.4, 0]])
    shard([k[0], k[1], k[2]], [k[3], k[4], k[5]], 0.85, k[6] == 0 ? crystalLt : crystalMd);
  // Jagged cheek frill at the back of the jaw.
  mirror_x() {
    shard([2.4, 1.0, -0.8], [1.6, 2.8, -0.6], 0.55, crystalLt);
    shard([2.6, 2.2, 0.6], [1.6, 2.8, 0.6], 0.55, crystalMd);
  }
}

module body() {
  // ---------------------------------------------------------- torso: heavy shoulders, lower rump
  blob([[[7.4, 7, 7.2], [0, -5.5, 15.6]], [[7, 7, 6.4], [0, 3.5, 14.6]]], skin);
  // Pale scaled belly along the underside, banded across.
  blob([[[5.4, 4.6, 3.4], [0, -6.5, 11.4]], [[5.2, 6.4, 3.2], [0, 2.5, 10.2]]], paleMid);
  for (y = [-9.5 : 1.8 : 7.5]) color(pale) intersection() {
    hull() { translate([0, -6.5, 11.4]) scale([5.55, 4.75, 3.55]) sphere(1, $fn = 20); translate([0, 2.5, 10.2]) scale([5.35, 6.55, 3.35]) sphere(1, $fn = 20); }
    translate([-7, y, 6]) cube([14, 1.0, 5.2]);
  }
  // Pale chest with scute bands, pale throat.
  ell([5.2, 3.8, 4.4], [0, -10, 13.4], paleMid);
  for (z = [9.8 : 1.5 : 16.8]) color(pale) intersection() { translate([0, -10, 13.4]) scale([5.35, 3.95, 4.55]) sphere(1, $fn = 18); translate([-6, -15, z]) cube([12, 6, 0.9]); }
  // Neck: short and thick, dropping forward to the low head.
  blob([[[5.2, 4.8, 5.2], [0, -7.5, 17]], [[3.8, 3.6, 3.6], [-1.4, -10, 14.4]]], skin);
  color(pale) hull() { translate([-0.6, -9.6, 12.4]) scale([2.8, 2.6, 2.3]) sphere(1, $fn = 14); translate([-1.6, -12, 12]) scale([2, 1.8, 1.6]) sphere(1, $fn = 12); }

  translate(HC) rotate([HRX, 0, HRZ]) scale(HS) head();

  // ---------------------------------------------------------- crystal armour
  // Big chunky faceted ice gems piled on the neck, shoulders and back: each [ellipsoid, az, el, radius, length, colour].
  T1 = [[0, -5.5, 15.6], [7.4, 7, 7.2]];
  NK = [[0, -7.5, 17], [5.2, 4.8, 5.2]];
  T2 = [[0, 3.5, 14.6], [7, 7, 6.4]];
  for (g = [[NK, -90, 50, 2.2, 4.4, 1], [T1, -90, 70, 2.8, 6.6, 0], [T1, 90, 84, 2.9, 6.8, 2], [T2, 90, 62, 2.4, 5.0, 0],
            [T2, 90, 38, 1.9, 3.6, 1], [NK, -90, 20, 1.8, 3.2, 2]]) gem(g[0], g[1], g[2], g[3], g[4], gemC[g[5]]);
  mirror_x() for (g = [[NK, -45, 40, 2.1, 4.0, 2], [T1, -60, 50, 2.6, 5.6, 1], [T1, -25, 60, 2.7, 6.0, 2], [T1, 15, 62, 2.5, 5.6, 0],
                       [T1, 45, 60, 2.3, 5.0, 1], [T1, -5, 36, 2.2, 4.2, 0], [T1, -78, 30, 2.1, 3.8, 2], [T1, -40, 28, 1.9, 3.4, 0],
                       [NK, -70, 15, 1.7, 3.0, 1], [T2, 40, 48, 2.0, 3.8, 2], [T2, 10, 42, 1.9, 3.4, 1], [T2, 70, 35, 1.6, 2.8, 0]])
    gem(g[0], g[1], g[2], g[3], g[4], gemC[g[5]]);
  mirror_x() {
    // The pale gem orb on the shoulder in its dark setting.
    color(crystalDk) translate([5.8, -9.6, 17.0]) rotate([0, 0, -50]) rotate([0, 70, 0]) scale([2.6, 2.4, 1.0]) sphere(1, $fn = 7);
    color(orb) translate([6.1, -9.9, 17.1]) rotate([0, 0, -50]) rotate([0, 70, 0]) scale([1.7, 1.6, 1.2]) sphere(1, $fn = 8);
  }

  // ---------------------------------------------------------- legs
  module paw(p, toes, spread) {
    color(skin) hull() { translate(p) scale([1.9, 2.1, 1.0]) sphere(1, $fn = 12); translate(p + [0, 1.4, 0.5]) scale([1.5, 1.4, 1.0]) sphere(1, $fn = 10); }
    for (k = [0 : toes - 1]) let(a = (k - (toes - 1) / 2) * spread)
      spike(p + [sin(a) * 1.4, -1.6, -0.25], [sin(a) * 0.6, -1.9, -0.25], 0.42, 0.06, claw);
  }
  mirror_x() {
    // Foreleg: shoulder ball, a thick upper arm, the forearm down to a broad paw with white claws.
    ell([3.4, 4, 4.4], [6, -7, 14], skin);
    limb([6.6, -7.4, 12], [7.4, -8.2, 8.4], 3.1, 2.6, skin);
    limb([7.4, -8.2, 8.4], [6.6, -11.2, 5.8], 2.6, 2.1, skin);
    paw([6.6, -11.8, 5.4], 4, 26);
    // Haunch: a big oval thigh with a scale pattern, a digitigrade shin to the hind paw.
    ell([3.4, 4.4, 4.5], [7.2, 4, 13.8], skin);
    plates([7.2, 4, 13.8], [3.4, 4.4, 4.5], [for (az = [-40 : 26 : 40]) for (el = [-30 : 22 : 45]) [az + el * 0.3, el, 1.15]], 0.32, [skinLt], 6);
    limb([7.8, 3.5, 11], [8.4, 6.8, 7.2], 2.8, 2.0, skin);
    limb([8.4, 6.8, 7.2], [8.2, 4.2, 5.6], 2.0, 1.7, skin);
    paw([8.2, 3.2, 5.4], 3, 30);
  }

  // ---------------------------------------------------------- tail
  chain(TP, TR, skin);
  // Darker scale bands across it so it is not a plain tube.
  for (i = [0 : len(TP) - 2]) for (u = [0.5]) let(d = TP[i + 1] - TP[i], r = TR[i] + (TR[i + 1] - TR[i]) * u)
    color(skinDk) translate(TP[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.07, r * 1.07, r * 0.32]) sphere(1, $fn = 8);
  // Crystal spikes along its top near the root.
  for (i = [0 : 3]) shard(TP[i] + [0, 0, TR[i] * 0.75], [0, 0.6, 2.2 - i * 0.3], 0.6, i % 2 == 0 ? crystalDk : crystalMd);
  // The tall jagged crystal blade rising beside the head (traced off the front sheet, a little taller and wider), its
  // darker core.
  function bl(q) = [-17.5 + (q[0] + 17.5) * 1.2, 12.6 + (q[1] - 12.6) * 1.15];
  pp(4) {
    plate([for (q = [[-17.2, 12.6], [-19.4, 15.5], [-18.6, 17.5], [-19.5, 19], [-18.6, 21], [-19.2, 22.5], [-18.3, 24.5], [-16.7, 27.3],
           [-16.2, 24], [-16.6, 21], [-15.9, 18], [-16.4, 15.5], [-15.6, 12.6]]) bl(q)], 1.3, 0.3, crystalLt);
    plate([for (q = [[-17.4, 13.5], [-18.2, 17], [-17.9, 21], [-17.2, 25], [-16.9, 21], [-16.9, 17], [-16.6, 13.5]]) bl(q)], 1.7, 0.2, crystalMd, 0.2);
  }
}

// ---------------------------------------------------------------- wings
// Bat wing: the traced membrane as a plate in the wing plane with darker panels proud on both faces, the bone arm
// along the leading edge, thin finger spars from the wrist to each tip, a thumb claw, and a waterfall of frost spray
// off the trailing edge.
module wing() {
  translate([WS[0], WS[1], 0]) rotate([0, 0, WA]) {
    plate(WING, 0.9, 0.3, memb);
    // darker panels between the spars (shrunk towards the wrist so a pale rim stays)
    for (k = [0, 2]) let(a = WTu[k], b = WTu[k + 1], m = (a + b) / 2)
      plate([WWu + (a - WWu) * 0.92, WWu + (m - WWu) * 0.8, WWu + (b - WWu) * 0.92, WWu + (b - WWu) * 0.25, WWu + (a - WWu) * 0.25], 1.3, 0.3, memb2, 0);
    plate([wu([2.2, 23.5]), wu([2.2, 32]), WWu + (WTu[3] - WWu) * 0.85, wu([6.8, 23])], 1.3, 0.3, memb2, 0);
    // frost spray: pale strands and drops falling off the trailing edge
    for (k = [[[18.6, 31], [19.4, 26.5], [18.8, 21]], [[17, 30], [17.6, 25.5], [17.2, 19.6]], [[15.6, 26.5], [16.2, 22.5], [15.6, 18.4]],
              [[13.6, 25.6], [14.4, 22.4], [14, 19.6]], [[18.2, 36], [19.2, 33.4], [19.2, 31.6]]])
      for (i = [0, 1]) let(p = wu(k[i]), q = wu(k[i + 1]))
        color(frost) hull() { translate([p[0], 0, p[1]]) sphere(0.6 - i * 0.25, $fn = 8); translate([q[0], 0, q[1]]) sphere(0.35 - i * 0.2, $fn = 6); }
    for (q = [[19.6, 28], [18.4, 18.4], [16.6, 16.8], [14.8, 17.4], [19.8, 23], [16.4, 20.6], [13, 21.4]])
      let(p = wu(q)) color(frost) translate([p[0], 0, p[1]]) scale([0.6, 0.5, 0.8]) sphere(1, $fn = 6);
  }
  chain([WS, WE, WW], [1.4, 1.0, 0.75], bone);
  chain([WW, WW + [-0.4, -0.6, 1.6], WW + [-1.2, -1.0, 2.4]], [0.55, 0.35, 0.06], claw);
  for (f = WT) limb(WW, f, 0.55, 0.2, rib);
  for (f = WT) spike(f, (f - WW) * 0.08, 0.24, 0.03, claw);
}

translate([0, 0, -G]) {
  body();
  mirror_x() wing();
}
