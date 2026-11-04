// Geoboxer: a hulking rock-skinned brawler in a wide, low boxing stance. A small bald head with a fierce scowl and
// gritted teeth, a massive torso of fitted stone plates (pecs, abs, shoulders, back) cracked with glowing magma,
// boulder forearms and boulder fists raised in guard beside the head, thick bowed legs of smooth clay skin.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the feet stand on z ~3.9, the grey puddle and the dust are not
// modelled, the model keeps the sheet's z and the build puts its lowest point on the ground):
//   - head: x -8.5..1.6, z 28.2..39.8, smaller than the shoulders; turned to face the viewer (nose at x -4). Bald dome,
//     heavy brows in a V, two small glaring eyes at (-5.8, 33.1) and (-2.1, 33.4), broad nose z ~32, a wide
//     gritted-teeth mouth x -6.3..-2.0, z 29.4..30.8 (two rows of grey teeth), jaw down to z 28.2, small ears
//   - torso: chest x -7.3..5.8, z 17.5..31: two big pec plates (z 23..29), shoulder and trap plates up to the head's
//     sides, a 2 x 3 six-pack of ab plates z 17.5..23, magma cracks down the sternum and across the pecs
//   - hips: smooth skin z 14..17.5, glutes behind
//   - arms: guard. Near (+X) forearm boulder x 6.3..19, z 19..29.6, fist x 6..18, z 29.6..39; far (-X) forearm
//     x -20..-9, z 18..27, fist x -21.2..-10.2, z 26.5..35.5 (lower). Elbows low, shoulders at z ~28. Forearms and fists
//     are stone plates with magma seams; the fists' curled fingers face front (-Y), knuckles on top
//   - legs: wide low bow stance, knees out at (-10.5, 13) / (8.6, 13), shins down to big flat bare feet with toes,
//     the far foot pointing forward-left, the near one at the viewer
//   - back: plated upper back (shoulder blades, lats, traps), smooth lower back with a magma crack down the spine,
//     plated backs of the arms and fists
// Colours: skin M0 #7b5a41..#957b5b (head lighter #ac8b62), stone plates grey-tan #957b5b / #80807f, dark seams
// #291c16, magma #ef7919 (the lead wants the cracks glowing: GLOW, a tiny share).
include <lib.scad>

skin = [0.53, 0.40, 0.29];
skinLt = [0.60, 0.46, 0.32];
headC = [0.62, 0.48, 0.34];
skinDk = [0.42, 0.31, 0.22];
rock = [0.58, 0.48, 0.37];
rockHi = [0.67, 0.56, 0.42];
rockDk = [0.47, 0.38, 0.30];
core = [0.24, 0.17, 0.13];
magma = [0.93, 0.30, 0.04, GLOW];
teeth = [0.84, 0.82, 0.74];
mouthC = [0.12, 0.08, 0.07];

// Ellipsoid with a chosen facet count (lib's ell is fixed at 28).
module e(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// A faceted stone plate on an ellipsoid core (centre C, radii R) at azimuth a (0 = front -Y, +90 = +X) and elevation el:
// w across, h along the surface upwards, t thick, its centre `out` from the core's surface.
function dirOf(a, el) = [sin(a) * cos(el), -cos(a) * cos(el), sin(el)];
module plateOn(C, R, a, el, w, h, t = 1.2, spin = 0, c = rock, out = -0.35, fn = 6) {
  d = dirOf(a, el);
  color(c) translate(C + [R[0] * d[0], R[1] * d[1], R[2] * d[2]] + out * d)
    rotate([0, 0, a]) rotate([-el, 0, 0]) rotate([0, spin, 0]) scale([w, t, h]) sphere(1, $fn = fn);
}
// A plate at an explicit point facing azimuth a, elevation el.
module plateAt(p, a, el, w, h, t = 1.0, spin = 0, c = rock, fn = 6) {
  color(c) translate(p) rotate([0, 0, a]) rotate([-el, 0, 0]) rotate([0, spin, 0]) scale([w, t, h]) sphere(1, $fn = fn);
}
// A plated boulder: a dark core with rows of plates all round. rows = [[el, count, a0, w, h], ...].
module boulder(C, R, rows, t = 1.3) {
  e(R, C, core, 14);
  for (ri = [0 : len(rows) - 1]) let(r = rows[ri]) for (i = [0 : r[1] - 1])
    plateOn(C, R, r[2] + i * 360 / r[1], r[0], r[3], r[4], t, (ri * 37 + i * 53) % 50 - 25,
            [rock, rockHi, rockDk][(ri + i) % 3]);
}
// A glowing magma crack through the points.
module vein(pts, w = 0.36) chain(pts, [for (q = pts) w], magma);

// ---- Torso: a dark core under fitted stone plates; smooth skin round the waist and the lower back.
C1 = [0, -0.5, 24.8]; R1 = [7.8, 5.2, 5.0];     // chest
C2 = [0, 0, 18.8];    R2 = [5.4, 4.2, 3.6];     // waist
color(core) hull() { translate(C1) scale(R1) sphere(1, $fn = 20); translate(C2) scale(R2) sphere(1, $fn = 18); }
e([5.5, 4.4, 3.6], [0, 0.6, 18.2], skin, 20);                       // waist and lower back skin
e([4.3, 1.4, 3.4], [0, -3.4, 20.0], core, 14);                      // dark seams under the abs
// pecs, collar, flanks
mirror_x() {
  plateOn(C1, R1, 34, 14, 3.7, 2.8, 1.5, 8, rock);                 // pec
  plateOn(C1, R1, 16, 46, 2.7, 1.9, 1.1, -10, rockHi);             // collar plate
  plateOn(C1, R1, 66, -4, 2.3, 3.2, 1.1, 12, rockDk);              // flank
  plateOn(C1, R1, 42, 62, 2.8, 2.1, 1.2, 0, rock);                 // trap, front
  plateOn(C1, R1, 112, 2, 3.0, 3.8, 1.2, -8, rock);                // lat
  plateOn(C1, R1, 148, 16, 3.4, 3.1, 1.3, 14, rockHi);             // shoulder blade
  plateOn(C1, R1, 156, 56, 2.8, 2.2, 1.2, -6, rockDk);             // trap, back
  plateOn(C1, R1, 160, -22, 2.8, 2.4, 1.1, 10, rock);              // lower back plate
  plateOn(C1, R1, 90, 30, 2.4, 2.6, 1.1, 0, rockDk);               // side under the shoulder
}
plateOn(C1, R1, 180, 36, 2.6, 2.2, 1.1, 0, rock);                   // upper back, centre
// traps: a sloped mass from the shoulders up to the head's sides, plated
mirror_x() {
  e([3.4, 3.6, 2.4], [4.2, 0.4, 29.4], core, 12);
  plateOn([4.2, 0.4, 29.4], [3.4, 3.6, 2.4], 150, 40, 2.6, 2.4, 1.1, 10, rock);
  plateOn([4.2, 0.4, 29.4], [3.4, 3.6, 2.4], 75, 55, 2.4, 2.2, 1.1, -10, rockHi);
  plateOn([4.2, 0.4, 29.4], [3.4, 3.6, 2.4], 20, 50, 2.2, 2.0, 1.0, 0, rockDk);
}
// six-pack: 2 x 3 plates, and the obliques
for (r = [[22.4, -5.15, 1.35, 1.0], [20.3, -5.0, 1.3, 0.95], [18.4, -4.6, 1.2, 0.9]]) mirror_x()
  plateAt([1.45, r[1], r[0]], 8, -6, r[2], r[3], 0.75, 0, rock);
mirror_x() plateAt([4.3, -3.6, 20.2], 52, 0, 1.6, 2.6, 0.8, 6, rockDk);
// magma: down the sternum, across the pecs, between the abs, and down the spine
vein([[0, -4.9, 28.4], [0.3, -5.5, 26.4], [-0.2, -5.8, 24.4], [0.2, -5.6, 22.8], [-0.1, -5.3, 21.2], [0.1, -4.9, 19.2]]);
vein([[0.2, -5.6, 25.4], [-2.2, -5.9, 24.2], [-4.4, -5.0, 22.9]]);
vein([[-5.4, -4.6, 27.6], [-4.0, -5.6, 26.0], [-4.6, -5.4, 24.6]]);
vein([[5.6, -4.2, 26.2], [4.4, -5.4, 24.4], [5.6, -4.6, 22.6]]);
vein([[0, 4.7, 26.5], [0.4, 5.0, 23.6], [-0.3, 4.9, 21.0], [0.3, 4.9, 18.5], [-0.2, 4.6, 16.4]]);
vein([[-3.8, 4.8, 27.8], [-2.0, 5.3, 26.0], [0, 5.0, 25.0]]);
// hips and glutes: smooth skin
e([5.4, 4.3, 2.8], [0, 0.3, 16.2], skin, 20);
mirror_x() e([2.9, 2.6, 2.8], [2.6, 2.4, 15.8], skin, 14);

// ---- Neck and head: a thick neck sunk between the traps; the head turned to face the viewer, small, bald, scowling.
limb([0, -0.6, 28.0], [-0.9, -3.6, 32.4], 3.6, 3.0, skin);
translate([-1.2, -5.0, 34.6]) rotate([0, 0, 30]) {
  e([4.7, 4.5, 4.8], [0, 0.4, 0.5], headC, 24);                       // bald dome
  color(headC) hull() {                                              // heavy jaw
    translate([0, -0.4, -3.6]) scale([4.0, 3.4, 2.4]) sphere(1, $fn = 20);
    translate([0, -1.0, -4.4]) scale([3.2, 2.6, 2.0]) sphere(1, $fn = 16);
  }
  e([2.8, 1.6, 2.4], [0, -2.5, -2.6], headC, 16);                     // face front
  mirror_x() e([1.5, 1.2, 1.1], [2.3, -2.7, -2.0], headC, 12);        // cheekbones
  mirror_x() e([0.75, 0.9, 1.3], [4.55, 0.4, -0.7], skin, 10);        // ears
  // brows: thick ridges slanting down to the nose in a V, a dark crease under each
  mirror_x() color(headC) hull() {
    translate([3.3, -3.0, -0.15]) scale([1.1, 0.9, 0.75]) sphere(1, $fn = 10);
    translate([0.55, -3.9, -0.8]) scale([0.8, 0.75, 0.6]) sphere(1, $fn = 10);
  }
  mirror_x() color(core) hull() {
    translate([3.1, -3.5, -0.7]) scale([0.7, 0.3, 0.2]) sphere(1, $fn = 8);
    translate([0.75, -4.35, -1.4]) scale([0.5, 0.3, 0.2]) sphere(1, $fn = 8);
  }
  color(skinDk) translate([0, -4.55, -0.85]) scale([0.18, 0.3, 0.7]) sphere(1, $fn = 6);   // frown line
  // eyes: small, dark, glaring under the brows, a pinpoint highlight
  mirror_x() eye([1.8, -3.6, -1.95], 0.78, iris = [0.16, 0.10, 0.07], sclera = [0.86, 0.80, 0.68], pupil = [0.04, 0.03, 0.02],
                 yaw = 12, flat = 0.5, lid = 0.42, lid_tilt = 26, lid_c = skinDk, slit = 0.75, shine = true);
  // nose: a broad bridge and bulb, dark nostrils
  limb([0, -3.9, -1.3], [0, -4.4, -2.3], 0.55, 0.7, headC);
  e([1.3, 1.0, 0.95], [0, -4.35, -2.65], headC, 12);
  mirror_x() e([0.32, 0.3, 0.22], [0.6, -4.95, -3.15], mouthC, 6);
  mirror_x() color(skinDk) translate([1.85, -3.85, -3.3]) rotate([0, -22, 0]) scale([0.18, 0.3, 0.95]) sphere(1, $fn = 6);
  // mouth: a dark slot with two rows of gritted grey teeth, a snarling upper lip and a heavy lower lip
  color(mouthC) hull() for (x = [-2.0, 2.0], z = [-3.6, -4.8]) translate([x, -3.75, z]) scale([0.4, 0.4, 0.4]) sphere(1, $fn = 8);
  color(teeth) hull() for (x = [-1.85, 1.85]) translate([x, -4.05, -3.95]) scale([0.3, 0.2, 0.28]) sphere(1, $fn = 8);
  color(teeth) hull() for (x = [-1.6, 1.6]) translate([x, -4.0, -4.5]) scale([0.3, 0.2, 0.26]) sphere(1, $fn = 8);
  for (x = [-1.2, -0.4, 0.4, 1.2]) color(mouthC) translate([x, -4.22, -4.2]) cube([0.09, 0.12, 0.95], center = true);
  e([2.5, 0.7, 0.42], [0, -3.85, -3.1], headC, 12);                   // upper lip
  e([2.2, 0.7, 0.45], [0, -3.75, -5.3], headC, 12);                   // lower lip
}

// ---- Arms: shoulder plates, a plated upper arm down to a low elbow, a boulder forearm rising to a boulder fist
// beside the head; the fist's four curled fingers face front, knuckles on top, a thumb across, magma in the seams.
module arm(s, SH, EL, FA, RA, FI, RI) {
  // shoulder
  e([3.4, 3.3, 3.3], SH + [s * 0.4, 0, 0.6], core, 14);
  plateOn(SH + [s * 0.4, 0, 0.6], [3.4, 3.3, 3.3], s * 40, 20, 2.8, 2.6, 1.3, 10, rockHi);
  plateOn(SH + [s * 0.4, 0, 0.6], [3.4, 3.3, 3.3], s * 95, 30, 2.7, 2.7, 1.3, -10, rock);
  plateOn(SH + [s * 0.4, 0, 0.6], [3.4, 3.3, 3.3], s * 150, 25, 2.7, 2.6, 1.3, 15, rockDk);
  plateOn(SH + [s * 0.4, 0, 0.6], [3.4, 3.3, 3.3], s * 90, 75, 2.4, 2.4, 1.1, 0, rock);
  // upper arm
  limb(SH, EL, 3.0, 2.8, core);
  for (k = [0 : 3]) let(p = SH + (EL - SH) * (0.3 + 0.4 * (k % 2)), a = s * (k < 2 ? 70 : 160) + (k % 2) * s * 20)
    plateAt(p + 2.7 * dirOf(a, 0), a, 0, 2.2, 2.6, 0.9, (k * 31) % 30 - 15, [rock, rockDk, rockHi, rock][k]);
  // forearm boulder
  boulder(FA, RA, [[-38, 5, 20, 2.8, 2.6], [8, 6, 0, 3.0, 3.1], [46, 5, 30, 2.7, 2.5]]);
  // fist boulder (joined to the forearm by a wrist): plates on the outside, top and back
  color(core) hull() { translate(FA + [0, 0, RA[2] * 0.4]) scale(RA * 0.8) sphere(1, $fn = 10); translate(FI) scale(RI * 0.85) sphere(1, $fn = 10); }
  e(RI, FI, core, 14);
  for (i = [0 : 4]) plateOn(FI, RI, s * (55 + i * 45), 6, 2.9, 3.0, 1.3, (i * 41) % 40 - 20, [rockHi, rock, rockDk][i % 3]);
  for (i = [0 : 2]) plateOn(FI, RI, s * (80 + i * 70), 52, 2.6, 2.3, 1.2, i * 20 - 20, [rock, rockHi, rock][i]);
  plateOn(FI, RI, s * 120, -45, 2.8, 2.4, 1.2, 0, rockDk);
  // fingers: four rolls stacked down the front, a knuckle bump at the top-front, the thumb across the upper two
  for (k = [0 : 3]) let(z = FI[2] + 2.55 - k * 1.65, y = FI[1] - RI[1] + 0.55 + abs(k - 1.5) * 0.25)
    color([rockHi, rock, rockHi, rockDk][k]) hull() {
      translate([FI[0] - s * 2.7, y + 0.5, z]) scale([0.9, 1.0, 0.8]) sphere(1, $fn = 8);
      translate([FI[0] + s * 2.2, y + 0.4, z]) scale([0.9, 1.0, 0.8]) sphere(1, $fn = 8);
    }
  for (k = [0 : 3]) plateAt([FI[0] + s * (-2.4 + k * 1.55), FI[1] - RI[1] * 0.55, FI[2] + RI[2] * 0.82], 0, 55, 0.85, 0.9, 0.8, 0, rockHi, 8);
  color(rock) hull() {
    translate([FI[0] - s * 3.9, FI[1] - RI[1] * 0.45, FI[2] + 1.0]) scale([1.0, 1.1, 1.0]) sphere(1, $fn = 8);
    translate([FI[0] - s * 1.0, FI[1] - RI[1] - 0.2, FI[2] + 1.4]) scale([0.9, 0.9, 0.85]) sphere(1, $fn = 8);
  }
  // magma seams on the forearm and the back of the fist
  vein([FA + [s * RA[0] * 0.75, -RA[1] * 0.62, -3.6], FA + [s * RA[0] * 0.95, -RA[1] * 0.3, -0.8], FA + [s * RA[0] * 0.8, -RA[1] * 0.6, 1.8],
        FA + [s * RA[0] * 0.55, -RA[1] * 0.85, 3.6]]);
  vein([FA + [-s * RA[0] * 0.3, -RA[1] * 0.97, -1.6], FA + [s * RA[0] * 0.1, -RA[1] * 1.0, 0.4], FA + [-s * RA[0] * 0.2, -RA[1] * 0.92, 2.6]]);
  vein([FA + [s * RA[0] * 0.3, RA[1] * 0.97, -2.6], FA + [s * RA[0] * 0.6, RA[1] * 0.85, 0.5], FA + [s * RA[0] * 0.2, RA[1] * 0.95, 3.0]]);
  vein([FI + [s * RI[0] * 0.5, RI[1] * 0.85, 1.5], FI + [s * RI[0] * 0.85, RI[1] * 0.5, -0.5], FI + [s * RI[0] * 0.98, 0, -1.6]]);
  vein([SH + [s * 1.8, -2.6, 1.9], SH + [s * 3.0, -2.4, -0.4], SH + [s * 2.4, -2.6, -2.2]]);
}
arm(1, [9.0, -0.5, 28.2], [15.4, -2.4, 21.4], [17.6, -3.6, 25.0], [5.8, 4.6, 5.4], [18.0, -5.2, 34.4], [5.6, 4.8, 4.8]);
arm(-1, [-9.0, -0.5, 27.2], [-14.8, -2.4, 19.6], [-16.0, -3.4, 22.6], [5.4, 4.4, 5.0], [-16.6, -5.4, 30.4], [5.2, 4.6, 4.5]);

// ---- Legs: smooth clay skin, a wide bowed crouch, knees out, big flat bare feet with four toes.
mirror_x() {
  limb([4.8, 0.2, 15.6], [10.4, -2.0, 12.6], 4.4, 3.5, skin);         // thigh
  e([3.8, 3.2, 2.9], [7.8, -2.2, 14.4], skinLt, 16);                  // quad
  e([3.0, 3.0, 3.0], [10.4, -2.0, 12.6], skin, 16);                   // knee
  e([1.6, 1.0, 1.3], [10.7, -4.4, 12.6], skinLt, 10);                 // knee cap
  limb([10.4, -2.0, 12.6], [12.4, -2.6, 6.2], 3.2, 2.5, skin);        // shin
  e([2.8, 2.7, 3.2], [11.6, -0.8, 9.8], skin, 14);                    // calf
  color(skin) hull() {                                                // foot
    translate([12.7, -2.0, 5.0]) scale([2.6, 2.8, 1.3]) sphere(1, $fn = 14);
    translate([14.0, -5.6, 4.85]) scale([2.7, 1.9, 1.0]) sphere(1, $fn = 14);
  }
  for (k = [-1.55, -0.5, 0.5, 1.5]) e([0.78, 0.9, 0.65], [14.5 + 0.94 * k, -7.3 + 0.35 * k, 4.6 - abs(k) * 0.08], skinLt, 8);
}
vein([[-9.0, 2.8, 14.4], [-10.4, 1.8, 12.6], [-11.6, 1.6, 10.6]]);   // a crack down the far thigh's back
