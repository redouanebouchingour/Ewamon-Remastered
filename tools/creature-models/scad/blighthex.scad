// Blighthex: Hexroach grown into a hulking blight beetle, drawn side-on and crouched low with its head to the
// viewer's left.
// Checklist (front sheet, height 40, the art's shadow cut at ground z 1):
//  - colour: a near-black purple base, mid-purple plate tops, thin glowing magenta veins along the seams.
//  - body: a long low armoured carapace, sheet x -12..22, z 6..30, craggy purple plates, a row of blunt spikes down
//    each side, spiky frill over the head, spikes on the rear rim (x 18..24, z 18..24); a thin yellow-green sash
//    along the lower edge of the shell (x 0..8, z 18..22 and x 15..20, z 20..23).
//  - egg sacs: yellow-green glossy orbs piled on the back: big (4.5, 32.5) r 4.6, (12.5, 28.5) r 3.9, small
//    (-2.5, 31.5), (16.5, 22.5), rear flank (19.5, 19) r 3.5; a sac glowing under the belly (x 3..13, z 5..9).
//  - head: big, low wedge pointing forward-down, tip (-15, 15); hunched shoulders rise above it (x -16..-10, z 20..27).
//  - face: two slanted almond orange eyes with a pale glint under a heavy brow: near (-9.3, 18.3) 2.3 x 2.6, far one
//    (-13.4, 16.4) half hidden; yellow hooked fangs: a big pair behind the eyes (near one x -7..-5.5, z 11.5..18)
//    and a small pair under the snout.
//  - antennae: two long purple whips from the brow: far one curls out and forward (-20, 31) and back to (-12, 36.5),
//    near one rises and arcs back over the body to (2, 39).
//  - limbs: two bulky armoured forearms raised and bent in front of the head (far one's elbow (-20, 20), its hook
//    cluster down to x -28, z 3..11; the near one's hooks in front of the chest x 1..9, z 9..16), front legs (far foot
//    on the ground at x -15), rear legs spread wide (near foot at x 20..28, far foot at x -6); thick armoured legs
//    with knobbly joints, yellow-green hooked claws.
//  - back: a domed shell of plates with violet seams and side spikes, orbs on the upper rear, the two forearms out
//    sideways like crab claws.
include <lib.scad>
$fs = 0.95;

// Colours.
base = [0.12, 0.07, 0.18];
headC = [0.22, 0.10, 0.33];
plateA = [0.30, 0.13, 0.43];
plateB = [0.37, 0.17, 0.50];
spikeC = [0.18, 0.08, 0.28];
vein = [0.78, 0.22, 0.88, GLOW];
orbC = [0.70, 0.74, 0.14, NOGLOW];
orbHi = [0.90, 0.90, 0.22, NOGLOW];
shineC = [0.99, 0.99, 0.73, NOGLOW];
clawC = [0.86, 0.85, 0.2, NOGLOW];
eyeC = [1, 0.48, 0.1, NOGLOW];
eyeD = [0.9, 0.3, 0.05, NOGLOW];

// The carapace: one long ellipsoid, plates and orbs placed on its surface by (angle round from the top, row y).
BC = [0, 6, 17];
BR = [12, 22, 12.5];
function bs(y) = sqrt(max(0, 1 - pow((y - BC[1]) / BR[1], 2)));
function surf(a, y) = [BR[0] * bs(y) * sin(a), y, BC[2] + BR[2] * bs(y) * cos(a)];
function nrm(a, y) = let(n = [sin(a) / BR[0], (y - BC[1]) / (BR[1] * BR[1]) * 1.4, cos(a) / BR[2]]) n / norm(n);
ROWS = [-12, -6.5, -1, 4.5, 10, 15.5, 21, 25.5];
STEP = 26.75;   // plate columns at -107 + k STEP: the seams fall halfway, at +-13.4, 40.1, 66.9, 93.6

HEAD = [-4, -18.5, 16.5];
HROT = [12, 0, -30];
HS = 1.75;

// Forearm: shoulder (inside the hunched pauldron), elbow, wrist.
SH = [8, -10, 18];
EL = [15, -16, 23.5];
WR = [16.5, -24, 14];

// Talon: a hooked claw from p out along d (its length), curling down by `hook`.
module talon(p, d, r, hook = 0.5) {
  $fn = 5;
  l = norm(d);
  pts = [for (t = [0, 0.36, 0.7, 1]) p + d * t + [0, 0, l * 0.3 * sin(180 * t) - hook * l * t * t]];
  chain(pts, [r, r * 0.78, r * 0.48, 0.07], clawC);
}
// Armour plate: a faceted flattened lump.
module armour(p, r, c) { color(c) translate(p) scale([r, r, r * 0.72]) sphere(1, $fn = 6); }
// Leg: dark segments under mid-purple armour plates, a knobbly knee with a spur, three hooked claws.
module leg(hip, knee, foot, r) {
  $fn = 12;
  limb(hip, knee, r * 1.35, r * 1.1, base);
  limb(knee, foot, r * 1.15, r * 0.85, base);
  for (sg = [[hip, knee, r * 1.2], [knee, foot, r * 1.0]]) for (t = [0.35, 0.72])
    armour(sg[0] + (sg[1] - sg[0]) * t + [sg[2] * 0.55, 0, sg[2] * 0.45], sg[2] * 0.95, t < 0.5 ? plateA : plateB);
  color(plateB) translate(knee) sphere(r * 1.3, $fn = 7);
  spike(knee + [0, 0, r * 0.8], [0.9, 0.5, 2.6], r * 0.6, 0.06, spikeC);
  color(base) translate(foot + [0, 0, 0.3]) scale([1.15, 1.35, 0.8]) sphere(r, $fn = 8);
  for (a = [-45, 0, 45]) talon(foot + [0, -r * 0.5, 0.3], [sin(a) * 3.4, -cos(a) * 3.4, 0], 0.9, 0.5);
}
// Glowing veins painted on the shell (the shell grown 0.3, cut thin): a ring seam at row boundary y0 from angle a1
// to a2, or a column seam at angle a from y1 to y2.
module vring(y0, a1, a2) {
  color(vein) intersection() {
    translate(BC) scale(BR + [0.3, 0.3, 0.3]) sphere(1, $fn = 40);
    translate([0, y0, BC[2]]) rotate([90, 0, 0]) linear_extrude(height = 0.5, center = true)
      polygon(concat([[0, 0]], [for (a = [a1 : (a2 - a1) / 6 : a2 + 0.01]) [30 * sin(a), 30 * cos(a)]]));
  }
}
module vcol(a, y1, y2) {
  color(vein) intersection() {
    translate(BC) scale(BR + [0.3, 0.3, 0.3]) sphere(1, $fn = 40);
    translate([0, 0, BC[2]]) rotate([0, a, 0]) translate([-0.25, y1, 0]) cube([0.5, y2 - y1, 20]);
  }
}

// The art's shadow is cut at ground z 1 (compare --ground 1); the build stands the lowest claw on the floor.
{
  // ---- Carapace: the near-black shell shows in the seams between the plates.
  ell(BR, BC, base);
  ell([10.6, 18.5, 10], [0, 5, 13.6], base);
  // A plate capping the tail end.
  color(plateA) translate([0, 27.2, 17]) scale([4.2, 1.6, 4.2]) sphere(1, $fn = 8);
  for (j = [0 : len(ROWS) - 1]) for (a = j >= 5 ? [-160.5 : STEP : 161] : [-107 : STEP : 108]) {
    y = ROWS[j];
    s = bs(y);
    p = surf(a, y);
    n = nrm(a, y);
    k = 0.9 + 0.15 * abs(sin(j * 71 + a * 13));
    color((j + round(a / STEP)) % 2 == 0 ? plateA : plateB)
      translate(p + n * 0.25) rotate([-asin(n[1]), 0, 0]) rotate([0, a, 0])
        scale([max(1.6, 2.35 * s * k), 2.3 * k, 1.5]) sphere(1, $fn = 6);
    // Blunt spikes in a row down each side, and down the ridge.
    if (abs(abs(a) - 53.5) < 1 && j % 2 == 1) spike(p + n * 1.0, n * 2.4 + [0, 0.8, 0], 0.85, 0.08, spikeC);
    if (abs(a) < 1 && j % 2 == 0 && j > 0) spike(p + n * 1.0, n * 1.6 + [0, 1.2, 0], 0.75, 0.08, spikeC);
  }
  // Glowing veins along the seams, stepping from seam to seam like cracks: two over each front flank, one over
  // the back, and part of the rear rim.
  mirror_x() {
    vring(-9.25, 13.4, 40.1); vcol(40.1, -9.25, -3.75); vring(-3.75, 40.1, 66.9); vcol(66.9, -3.75, 1.75);
    vring(1.75, 66.9, 93.6);
    vcol(13.4, -14, -9.25); vring(1.75, 13.4, 40.1); vcol(40.1, 1.75, 7.25); vring(7.25, 40.1, 66.9);
    vcol(66.9, 7.25, 12.75);
    vcol(13.4, 12.75, 23.25); vring(18.25, 13.4, 40.1); vring(23.25, 40.1, 120);
  }
  // Spiky frill over the head and spikes on the rear rim.
  mirror_x() {
    for (k = [[14, [1.4, -5.6, 4.6]], [42, [3.4, -5.4, 2.6]], [70, [4.6, -4.4, 0.6]]])
      spike(surf(k[0], BC[1] - BR[1] + 5), k[1], 1.9, 0.1, plateA);
    for (k = [[40, 24], [70, 22], [100, 20]])
      spike(surf(k[0], k[1]) - [0, 0.5, 0], [sin(k[0]) * 1.4, 3.4, cos(k[0]) * 1.4], 1.0, 0.08, plateA);
  }
  // Yellow-green sash along the lower edge of the shell.
  mirror_x() chain([surf(84, -10), surf(88, 0), surf(90, 10), surf(86, 20)] + [for (i = [0 : 3]) [0.5, 0, -0.2]],
                   [0.55, 0.6, 0.6, 0.45], [0.62, 0.63, 0.11, NOGLOW]);

  // ---- Egg sacs: [angle, row y, radius], sunk 30 % into the shell; glossy with a lighter cap and a glint.
  orbs = [[10, 6, 5.6], [32, 13, 4.6], [-16, -1, 2.2], [50, 21, 2.0], [76, 17, 3.8], [-40, 14, 3.6], [-70, 18, 2.2],
          [-10, 17, 3.4]];
  for (o = orbs) {
    c = surf(o[0], o[1]) + nrm(o[0], o[1]) * o[2] * 0.7;
    color(orbC) translate(c) sphere(o[2], $fn = 16);
    color(orbHi) translate(c + [-0.15, -0.2, 0.32] * o[2]) sphere(o[2] * 0.66, $fn = 10);
    color(shineC) translate(c + [-0.3, -0.45, 0.62] * o[2]) sphere(o[2] * 0.2, $fn = 6);
  }
  // The sac under the belly.
  color(orbC) translate([2, 9, 6.2]) scale([1, 1.3, 0.8]) sphere(4.8, $fn = 20);

  // ---- Hunched shoulders: armoured pauldrons rising above the head, a spike off each.
  mirror_x() {
    color(plateA) translate([9, -10, 22.5]) rotate([0, 20, 0]) scale([4.4, 4.8, 3.3]) sphere(1, $fn = 8);
    color(plateB) translate([10.5, -6, 21.5]) rotate([0, 30, 0]) scale([3.6, 3.8, 2.6]) sphere(1, $fn = 7);
    spike([10, -9.5, 24.5], [1.6, 2.2, 3.8], 1.4, 0.08, spikeC);
  }
  // ---- Neck under the frill.
  ell([5.5, 5.5, 5], [-2, -15.5, 16], base);

  // ---- Head: big, low and wedge-shaped, turned to its right and tipped nose-down; eyes under a heavy brow.
  translate(HEAD) rotate(HROT) scale(HS) {
    blob([[[3.6, 3.8, 3.2], [0, 0.5, 0.4]], [[2.7, 2.6, 2.2], [0, -3.4, -0.4]], [[1, 1.4, 1], [0, -7, -1.6]]], headC);
    mirror_x() {
      // The heavy brow over each eye and the crest spikes behind it.
      color(plateA) hull() {
        translate([1.2, -5.0, 1.3]) sphere(0.6, $fn = 6);
        translate([2.6, -3.9, 2.3]) sphere(0.75, $fn = 6);
        translate([3.4, -2.2, 2.2]) sphere(0.8, $fn = 6);
      }
      spike([2, 0, 2.6], [1.6, 3.8, 3.4], 1.0, 0.08, plateA);
      spike([3.2, 1.2, 0.8], [2.6, 3, 1.6], 0.9, 0.08, plateA);
      // Eyes: slanted almonds, orange with a pale glint, an angry lid.
      eye([2.15, -3.4, 0.8], 1.35, iris = eyeD, sclera = eyeC, pupil = eyeD, yaw = 42, flat = 0.5, lid = 0.42,
          lid_tilt = 30, lid_c = headC, squint = 0.2, shine = true);
      // Fangs: a big hooked pair behind the eyes, a small pair under the snout.
      chain([[2.3, -2, -1.8], [2.7, -2.8, -3.8], [2.1, -3.8, -5.6]], [0.75, 0.52, 0.06], clawC);
      chain([[1.1, -5.2, -1.4], [1.3, -5.9, -2.6], [0.8, -6.4, -3.6]], [0.42, 0.3, 0.05], clawC);
    }
  }
  // Antennae: long whips from the brow (far one curls out and forward, near one arcs back over the shell).
  chain([[-3.5, -20, 21], [-7.5, -21, 25], [-12, -21, 29], [-13.5, -20, 32.4], [-13, -18, 35.4], [-10.6, -15, 36.8],
         [-6.9, -12, 37]], [0.65, 0.6, 0.55, 0.48, 0.4, 0.3, 0.12], plateA);
  chain([[-1.7, -20, 22], [-1.2, -20, 26], [-0.6, -19, 30], [0, -17, 33.2], [1.2, -14, 36.8], [2.3, -10, 38.9],
         [3.5, -6, 40], [4, -2, 40.3]], [0.65, 0.6, 0.55, 0.5, 0.42, 0.34, 0.25, 0.1], plateA);

  // ---- Forearms: bulky armoured clubs raised and bent in front of the head, a cluster of four big hooks each.
  mirror_x() let($fn = 14) {
    limb(SH, EL, 3.0, 3.0, base);
    color(plateB) translate(EL) sphere(3.4, $fn = 8);
    limb(EL, WR, 3.4, 3.8, base);
    for (t = [0.2, 0.5, 0.8]) {
      q = EL + (WR - EL) * t;
      armour(q + [2.4, -0.3, 1.4], 2.7, t == 0.5 ? plateB : plateA);
      spike(q + [3.4, 0, 1.4], [2.0, 0.3, 1.8], 0.9, 0.06, spikeC);
    }
    armour((SH + EL) / 2 + [1.2, 0, 2.2], 2.6, plateA);
    ell([3.6, 3.4, 3.0], WR - [0, 0, 0.8], base);
    talon(WR + [-0.6, -2.6, -1.2], [0.4, -5.8, 0], 1.5, 1.35);
    talon(WR + [1.8, -2.2, -1.0], [2.4, -4.6, 0], 1.35, 1.2);
    talon(WR + [-2.4, -1.6, -1.4], [-1.8, -4.2, 0], 1.25, 1.15);
    talon(WR + [2.6, 0.2, -1.6], [3.6, -1.6, 0], 1.1, 1.1);
  }

  // ---- Legs: thick armoured segments, knobbly knees, three hooked claws on each foot.
  mirror_x() {
    leg([7, -6, 10], [15, -9, 13.5], [12, -13, 1.8], 2.8);
    leg([8, 12, 10], [17, 13, 15.5], [20, 16, 1.8], 3.0);
  }
}
