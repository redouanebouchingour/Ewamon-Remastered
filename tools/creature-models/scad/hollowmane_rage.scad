// Hollowmane Rage: Hollowmane torn open by fury. The same crouching armoured body and bone ram skull, now cracked
// with glowing red veins, its jaw gaping in a roar over long fangs; long black-and-red horn spikes rake up off the
// skull and shoulders, the heart-gem has burst into a star of red cracks, the white mane is streaked blood red, and
// the scythes have grown into wide serrated bone blades with a red vein, wreathed like the feet in crimson flames.
//
// Checklist (front sheet, 40 units tall, 40.5 wide): as Hollowmane (scad/hollowmane.scad), plus
// - Face: red cracks over the brow and through both sockets; the jaw dropped open (z 22.5..25.5) on a black mouth with
//   fangs; the red eyes glowing.
// - Horns: the ram horns grown bigger; two tall dark horns rising off the crown; long dark spikes with red edges raking
//   up and out off the shoulders (tips at sheet (20, 40) and (-15, 37.5)) and outward (sheet (19.5, 33.5), (-15, 29)).
// - Chest: the gem a red starburst of cracks (sheet -6..2, z 17..24); a red crack over the near pauldron.
// - Mane: white and grey with blood-red and crimson streaks.
// - Blades: wide bone fronds with barbs pointing up and out and a red vein, near one sheet 11..18.5 x 2..22, far one
//   -20..-12.6 x 4..21; crimson flames (#6a1b41 / #a32244) along them and round both feet.
// - Claws: three dark hooked fingers at each wrist.
include <lib.scad>
HAIR_N = 4;
HAIR_FN = 6;
$fs = 1.3;

armor = [0.15, 0.13, 0.15];
armorHi = [0.26, 0.24, 0.26];
maroon = [0.27, 0.13, 0.17];
bone = [0.9, 0.88, 0.79];
boneSh = [0.69, 0.65, 0.59];
hornC = [0.33, 0.27, 0.27];
mane = [0.95, 0.95, 0.97];
maneSh = [0.68, 0.67, 0.71];
ink = [0.03, 0.02, 0.03];
eyeRed = [0.92, 0.1, 0.22, GLOW];
gem = [0.85, 0.08, 0.2, GLOW];
gemHi = [1, 0.55, 0.62, GLOW];
fleck = [0.6, 0.08, 0.24, NOGLOW];
crack = [0.85, 0.08, 0.24, GLOW];
maneRed = [0.72, 0.09, 0.22];
maneDk = [0.42, 0.06, 0.18];
flameDk = [0.42, 0.07, 0.2, NOGLOW];
flameHi = [0.64, 0.12, 0.26, NOGLOW];
JAW = 50;

// Ellipsoid with its own facet count (lib's ell() is 28 round: too heavy for the small parts).
module e(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// ---- Mane helpers
function nrm(v) = v / norm(v);
// A flat strand of hair: a ribbon through pts, ws half-wide, about half as thick across its normals ns (facing out).
module strand(pts, ws, ns, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() for (k = [i, i + 1])
    translate(pts[k]) rotate(_dir_rot(ns[k])) cylinder(h = max(0.2, ws[k] * 0.45), r1 = ws[k], r2 = ws[k] * 0.7, center = true, $fn = HAIR_FN);
}
// The same with one normal for every point.
module strand1(pts, ws, n, c) strand(pts, ws, [for (p = pts) n], c);
// The shell the hair hangs on, per height: half-width, half-depth and centre depth (it clears the pauldrons and the back).
function hairRx(z) = lookup(z, [[8, 12], [18, 12], [25, 12.5], [30, 12], [34, 10.5], [37.5, 7], [39.5, 3]]);
function hairRy(z) = lookup(z, [[8, 7], [18, 7.5], [25, 8.5], [30, 8.5], [34, 7.5], [37.5, 5.5], [39.5, 3]]);
function hairYc(z) = lookup(z, [[8, 10], [18, 8.5], [25, 6], [30, 3.5], [34, 1], [37.5, -1], [39.5, -1.5]]);
function hairPt(ph, z, off) = [(hairRx(z) + off) * sin(ph), hairYc(z) + (hairRy(z) + off) * cos(ph), z];
function flare(ph, t) = max(-115, min(115, ph * (1 + 0.45 * t)));
// One lock: from the crown at angle ph (0 = straight down the back, +-90 = over the shoulders) down to ztip, flaring
// out and lifting off the back as it falls, slightly wavy, widest a third of the way down, tapering to a point.
module lock(ph, ztip, off, w, seed, c, N = HAIR_N) {
  ztop = 39 - 4.5 * abs(ph) / 100;
  pts = [for (k = [0 : N]) let(t = k / N) hairPt(flare(ph, t) + 5 * sin(t * 330 + seed), ztop + (ztip - ztop) * t, off + 0.9 * t * t)];
  ns = [for (k = [0 : N]) let(t = k / N, a = flare(ph, t)) [sin(a), cos(a), 0.6 * (1 - t)]];
  ws = [for (k = [0 : N]) let(t = k / N) w * (t < 0.35 ? 0.75 + 0.7 * t : 1 - 0.88 * (t - 0.35) / 0.65)];
  strand(pts, ws, ns, c);
}

// ---- Legs: wide crouch, digitigrade.
mirror_x() {
  limb([3.4, 1.2, 13.5], [7.8, 0.5, 9.9], 2.8, 2.2, armor);            // thigh
  limb([3, 1.9, 13], [7.3, 1.3, 9.6], 2.6, 2, maroon);                 // thigh's inner maroon side
  e([2.2, 2.2, 1.9], [7.9, 0.3, 9.9], armorHi);                        // knee plate
  sp([8, -1.4, 10.3], [1.6, -3.4, 1.9], 1.05, bone);           // knee spike, forward
  limb([7.9, 0.5, 9.6], [8.8, 4, 5], 1.9, 1.45, maroon);               // shin, back to the hock
  limb([8, -0.7, 8.8], [8.9, 2.9, 5.3], 1.45, 1.1, armor);             // shin plate
  sp([8, 2.4, 8.6], [0.3, 2.4, 1.8], 0.75, bone);              // calf spike
  e([1.5, 1.5, 1.5], [8.8, 4, 5], armor);                              // hock
  sp([8.9, 5, 4.6], [0.2, 2.4, -0.4], 0.7, bone);              // heel spike
  limb([8.8, 4, 5], [10, 0.6, 1.4], 1.4, 1.3, maroon);                 // foot
  e([2, 2.1, 1.15], [10, 0.2, 1.15], maroon);                          // foot pad
  for (dx = [-1.2, 0, 1.2]) sp([10 + dx, -1.4, 1.2], [dx * 0.5, -2.5, -0.9], 0.6, bone);   // claws
}

// ---- Torso: hunched chest, ribbed maroon abdomen, pelvis.
color(armor) hull() { e([6, 4, 3.8], [0, -1.2, 21.5], armor, 18); e([6.5, 3.8, 3.2], [0, 0.5, 24], armor, 18); }
limb([0, -0.3, 19], [0, 0.6, 14.5], 3.4, 3, maroon);
for (z = [15.6, 17.1]) e([3.4 - (17.1 - z) * 0.1, 2.95 - (17.1 - z) * 0.1, 0.35], [0, 0.2 - (z - 15.6) * 0.3, z], armor, 18);
e([4.4, 3.3, 2.5], [0, 1, 13.3], armor, 20);                            // pelvis
e([1.7, 0.8, 1.7], [0, -2.1, 13], maroon);
mirror_x() e([2.8, 1.2, 1.9], [2.9, -4, 22.6], armorHi, 16);           // pectoral plates
// Heart gem in a dark socket.
e([1.8, 0.8, 1.8], [0, -4.9, 21.2], ink);
e([1.3, 0.8, 1.3], [0, -5.2, 21.2], gem);
e([0.45, 0.4, 0.45], [0.25, -5.85, 21.5], gemHi, 8);

BLADE = [[15, -1, 18.6], [17, -1.2, 15.8], [18.8, -1.4, 12.4], [19.8, -1.5, 9], [20.1, -1.5, 6], [19.6, -1.4, 3.9], [18.8, -1.3, 2.9]];
// A cheap spike (8 sides) for the many barbs.
module sp(p, d, r, c) color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = r, r2 = 0.05, $fn = 8);
// A flame tongue: a soft flattened drop at p rising h, leaning a little outwards.
module flame(p, h, c) {
  color(c) {
    hull() { translate(p) scale([1.15, 0.7, 1]) sphere(1, $fn = 8); translate(p + [h * 0.12, 0, h * 0.55]) scale([0.6, 0.4, 0.6]) sphere(1, $fn = 6); }
    hull() { translate(p + [h * 0.12, 0, h * 0.55]) scale([0.6, 0.4, 0.6]) sphere(1, $fn = 6); translate(p + [-h * 0.05, 0, h]) sphere(0.08, $fn = 4); }
  }
}

// ---- Shoulders, arms and blades.
mirror_x() {
  e([3.5, 3.4, 3], [8.4, 0.2, 26.4], armor, 20);                       // pauldron
  e([3.6, 3.3, 1.1], [8.6, 0.2, 24.5], armorHi, 18);                   // its lower rim
  sp([8.2, 0.5, 28.6], [0.4, 0.6, 4.2], 1.2, hornC);           // spikes: up, out-forward, back
  sp([10.4, -0.5, 27], [2.3, -1.6, 2.3], 1, hornC);
  sp([8.6, 2.6, 27.5], [0.5, 2.5, 2.5], 0.85, hornC);
  limb([8.4, 0.2, 25.5], [13.2, -0.5, 21], 2.3, 1.9, armor);           // upper arm
  e([1.95, 1.95, 1.95], [13.2, -0.5, 21], armorHi);                    // elbow
  sp([13.7, 1, 21.6], [0.5, 2.4, 1.4], 0.65, hornC);           // elbow spike
  limb([13.2, -0.5, 21], [15.2, -1, 17.2], 1.9, 1.6, maroon);          // forearm
  for (t = [0.25, 0.6]) sp([14.4 + 2 * t, 0.2 - 0.5 * t, 21.8 - 3.8 * t], [1.3, 0.8, 1.5], 0.55, hornC);
  e([1.8, 1.8, 1.2], [15.1, -1, 17.6], armor);                         // gauntlet cuff
  // the blade: a wide curved bone frond from the wrist, out and down, barbed up and out along both edges, a red vein
  chain(BLADE, [1.2, 1.55, 1.6, 1.4, 1.05, 0.55, 0.1], bone);
  for (k = [1 : 5]) let(p = BLADE[k], q = BLADE[k - 1], d = nrm(q - p)) {
    sp(p + [0.9, 0, 0.2], d * 2 + [2.3, 0.2, 0.8], 0.8, bone);
    sp(p + [-0.8, -0.2, 0.4], d * 2 + [-1.5, -0.3, 0.5], 0.7, bone);
  }
  chain([[16.6, -2.1, 15.4], [18.3, -2.5, 12.2], [19.4, -2.6, 8.8], [19.7, -2.5, 5.8]], [0.32, 0.36, 0.3, 0.15], crack);
  // three dark hooked claws at the wrist
  for (k = [-1, 0, 1]) chain([[15.4 + 0.5 * k, -1.8, 16.8], [15.6 + 0.8 * k, -3.2, 15.6], [15.3 + 0.9 * k, -3.6, 14.4]], [0.42, 0.3, 0.06], hornC);
  // crimson flames licking up the blade
  for (k = [[19.4, 0.4, 10.5, 4.2, 1], [21.4, -1.5, 7.5, 5, 0], [20.8, -2, 13.5, 4, 1], [18.2, -3.6, 4.5, 4.4, 0], [16.8, -2, 18.5, 3.4, 1]])
    flame([k[0], k[1], k[2]], k[3], k[4] == 1 ? flameHi : flameDk);
}

// Long dark spikes with red edges raking up and out off the shoulders, and a red crack over each pauldron.
mirror_x() {
  sp([9.4, 2, 28.5], [9, 2, 10.5], 1.4, hornC);
  sp([9.8, 2.4, 29], [8.4, 1.9, 9.6], 0.75, maneDk);
  sp([10.6, 1, 26.6], [7, 0.5, 4.2], 1.2, hornC);
  color(crack) translate([9, -2.8, 27.2]) rotate([-30, 40, 0]) scale([0.25, 0.3, 1.5]) sphere(1, $fn = 6);
}
// The burst heart: red cracks radiating from the gem over the chest.
for (a = [15 : 45 : 360]) color(crack) translate([0, -5.05, 21.2]) rotate([0, -a, 0]) translate([2.4, 0, 0])
  scale([1.7, 0.45, 0.26]) sphere(1, $fn = 6);

// ---- Neck and skull.
limb([0, -2, 23.5], [0, -9, 28.5], 2.5, 1.9, armor);
for (t = [0.25, 0.5, 0.75]) e([2.1 - t * 0.4, 1, 1], [0, -2 - 7 * t, 22.4 + 5 * t], maroon);   // ribbed throat
HC = [0, -10.8, 30];
HEAD_YAW = 20;
EYE = [1.55, -2.75, 0.75];
EYE_SIZE = 1;
JAW_HINGE = [0, -0.8, -2.6];
translate(HC) rotate([0, 0, HEAD_YAW]) {
  e([3, 2.9, 2.8], [0, 0.6, 1.7], bone, 18);                            // cranium
  color(bone) hull() { e([2.5, 2, 2.1], [0, -1.3, 0.6], bone, 16); e([1.5, 1.4, 1.5], [0, -2.6, -2.7], bone, 14); }   // long muzzle, pointing down
  mirror_x() eye(EYE, EYE_SIZE, iris = eyeRed, sclera = ink, pupil = eyeRed, yaw = 22, lid = 0.38, lid_tilt = 26,
                 lid_c = bone, shine = false);
  mirror_x() e([0.3, 0.25, 0.55], [0.5, -3.75, -1.1], ink, 8);          // nose holes
  e([1.85, 1.7, 0.33], [0, -2.6, -2.6], ink, 20);                        // the grin's dark line
  for (a = [195 : 15 : 345]) color(bone) translate([1.9 * cos(a), -2.6 + 1.75 * sin(a), -2.55]) scale([0.21, 0.17, 0.62]) sphere(1, $fn = 6);
  e([1.45, 1.5, 1.1], [0, -1.9, -3], ink, 16);                          // the gaping mouth's dark inside
  e([1.35, 0.9, 1.1], [0, -3.1, -3.5], ink, 14);                         // and its opening under the muzzle
  // lower jaw, dropped open about its hinge, with fangs pointing up
  translate(JAW_HINGE) rotate([JAW, 0, 0]) translate(-JAW_HINGE) {
    e([1.5, 1.65, 0.85], [0, -2.5, -3.5], bone, 18);
    for (a = [200 : 20 : 340]) color(bone) translate([1.6 * cos(a), -2.5 + 1.62 * sin(a), -2.8]) scale([0.19, 0.16, 0.55]) sphere(1, $fn = 6);
  }
  // red cracks over the brow and through the sockets
  mirror_x() for (k = [[0.7, -2.2, 3.2, 10, 1.3], [1.5, -2.7, 2.1, -20, 0.9], [2.2, -2.7, 0.2, 15, 0.9]])
    color(crack) translate([k[0], k[1], k[2]]) rotate([-20, k[3], 0]) scale([0.22, 0.3, k[4]]) sphere(1, $fn = 6);
  color(crack) translate([0.3, -2.75, 2.4]) rotate([-20, -25, 0]) scale([0.2, 0.3, 1.1]) sphere(1, $fn = 6);
  // two tall dark horns rising off the crown, curving back
  mirror_x() chain([[1.6, 0.6, 3.6], [2.4, 0.9, 6.3], [2.9, 2, 8.4], [3, 3.6, 9.6]], [0.9, 0.75, 0.5, 0.12], hornC);
  // ram horns: up off the crown, out, down and curling forward round the cheeks
  mirror_x() chain([[2, 1, 3], [3.8, 1.4, 4.4], [5.9, 1.4, 3.9], [7.2, 1, 1.8], [7.2, 0.2, -0.6], [6.3, -0.6, -2.4], [5, -1.2, -2.7], [4.3, -1.4, -1.9]],
                   [1.5, 1.6, 1.5, 1.3, 1.15, 0.9, 0.6, 0.2], hornC);
}

// ---- The mane: long flat tapered locks growing from the crown and the back of the skull, hanging down the back to
// the knees in two layers and flaring out at the bottom; the dark body shows between and below them. No core volume.
e([5, 4.2, 2], [0, -2.5, 37.2], mane, 16);               // the scalp the locks grow from
// The top swept back off the brow: locks rising over the crown, then arching back and down.
for (x0 = [-4.5 : 2.25 : 4.5]) let(k = abs(x0) / 4.5, h = 0.8 * cos(x0 * 70))
  strand1([[x0, -6, 35.5], [x0 * 1.4, -3, 38.6 + h], [x0 * 1.9, 1.5, 38.8 + h - k], [x0 * 2.2, 5.5, 36.8 - k], [x0 * 2.4, 8.5, 33 - k]],
          [1.2, 1.5, 1.5, 1.1, 0.2], [x0 * 0.3, 0.15, 1], abs(round(x0 / 2.25)) == 1 ? maneSh : mane);
for (ph = [-104 : 16 : 104]) lock(ph, 9 + 12 * pow(abs(ph) / 104, 1.6), 0, 2, ph * 7, abs(round(ph / 16)) % 3 == 1 ? maneSh : mane);
for (ph = [-96 : 24 : 96]) lock(ph, 14 + 10 * pow(abs(ph) / 96, 1.6), 1.2, 2, ph * 11 + 90, abs(round(ph / 24)) % 4 == 2 ? maneSh : mane);
// Thin blood-red strands combed over the locks.
for (ph = [-91 : 26 : 91]) lock(ph, 12 + 10 * pow(abs(ph) / 91, 1.6), 1.75, 0.45, ph * 5 + 40, maneRed);
// Locks hanging forward beside the skull over both shoulders.
mirror_x() strand1([[5.2, -3.8, 33], [6.4, -5.6, 28.5], [6.7, -5.5, 24.5], [6.4, -5, 21.2]], [2, 1.9, 1.3, 0.3], [0.6, -1, 0], mane);
mirror_x() strand1([[6.5, -2.5, 32], [7.4, -4.4, 29], [7.6, -4.6, 26.5]], [1.5, 1.2, 0.3], [0.6, -1, 0], maneSh);
// Tips flicking up off the crown and back off the top, and long locks flaring wide off the back.
mirror_x() strand1([[2.5, -2.5, 35], [3.8, -3.2, 38], [4.3, -2.6, 39.3], [3.6, -1.4, 39.8]], [1.5, 1.2, 0.8, 0.2], [0, -1, 0.2], mane);
mirror_x() strand1([[2, -1, 37], [3.2, 2.5, 38.6], [3.6, 6, 38.2], [3.4, 9, 36.8]], [1.6, 1.3, 0.9, 0.2], [0.2, 0.3, 1], mane);
mirror_x() strand1([[5, 0, 34.5], [9.5, 5, 32.5], [12.5, 9, 30], [14, 11.5, 26.5]], [1.6, 1.4, 0.9, 0.2], [1, 0.3, 0.4], mane);
mirror_x() strand1([[9, 4, 30], [12, 8, 26.5], [14, 10.5, 22.5], [14.5, 11.5, 18.5]], [1.6, 1.4, 0.9, 0.2], [1, 0.4, 0], mane);

// ---- Crimson flames round both feet.
mirror_x() for (k = [[11.8, -0.8, 1.2, 4.4, 1], [8.2, -1.4, 1.2, 3.6, 0], [12.3, 2.4, 1.2, 3.8, 0], [7.6, 2.6, 1.6, 3, 1]])
  flame([k[0], k[1], k[2]], k[3], k[4] == 1 ? flameHi : flameDk);

// ---- Red flecks of malice round the legs and blades.
mirror_x() for (p = [[21.8, -1.5, 15.5], [13.4, -3, 7.2], [6, -3.8, 5], [12.6, 2, 3.5]])
  color(fleck) translate(p) rotate([0, 20, 0]) scale([0.22, 0.22, 0.85]) sphere(1, $fn = 6);
