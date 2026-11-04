// Resilithorn: Resilith's final form, a big hunched forest beast. A long domed carapace of green plates (brown rim,
// dark seams) with two rows of mint crystal leaves along the spine and a plated spiky tail sweeping back to its left,
// big pointed shoulder pauldrons, two dark slate arms with plated green forearms and red claws hanging forward, four
// chunky plated legs with red-clawed feet, a low helmet head with glaring orange eyes and a tan grilled muzzle, a brown
// leaf bib on the chest, and two branching antlers hung with leaves and blue berries, plus leafy twigs off the shell.
//
// Checklist (front sheet, scad = sheet units, creature faces -Y):
// - head: helmet dome sheet x -9..-1.5, z 15..25, turned ~15 deg to the viewer; face midline at sheet x -6
// - eyes: two, near (-5.2..-2.8, 17.6..20.3) far (-8.7..-7.6), orange with a red iris and a pale highlight, frowning
// - muzzle: tan, sheet -7.5..-3.5, z 15.8..18, dark vertical grooves (teeth)
// - antlers: bases on the helmet top (-1.5, 21) / (-8, 23), tops z 35.5, leaves to z 39.5, 5 berries each
// - pauldrons: near (3..10, 16..25) peaked; far (-10.5..-8, 18..23)
// - arms: slate upper arm, green plated forearm, 3 red claws: far claws (-15.5..-13, 9.5..11), near (8.8..10.7, 7..10)
// - legs: front feet near (5, 1) far (-10, 3.5); back feet near (13, 3) far (-3, 3); 3 red claws each
// - tail: x 10..17.4, z 9..17 with leaf spikes on top; back view: long plated carapace + tail, brown rim underneath
// - bib: brown pointed leaf on the chest (-3.2..0.8, 9..14)
// - twigs: off the shell sides with small leaves and a berry ((13.8, 18) near)
include <lib.scad>

green = [0.49, 0.56, 0.29];
greenLt = [0.6, 0.72, 0.37];
olive = [0.41, 0.47, 0.28];
leafC = [0.49, 0.7, 0.45];
leafDk = [0.41, 0.6, 0.39];
leafLt = [0.56, 0.77, 0.48];
bark = [0.42, 0.31, 0.22];
tan = [0.62, 0.47, 0.32];
bib = [0.5, 0.4, 0.27];
belly = [0.24, 0.2, 0.14];
rimC = [0.36, 0.26, 0.18];
seam = [0.2, 0.22, 0.13];
slate = [0.24, 0.25, 0.28];
red = [0.72, 0.2, 0.22];
berry = [0.31, 0.47, 0.75];
eyeOr = [0.98, 0.62, 0.22, NOGLOW];
eyeRim = [0.88, 0.42, 0.14, NOGLOW];
eyeRed = [0.86, 0.22, 0.16, NOGLOW];

// Ellipsoid with its own facet count (lib ell() is fixed at 28).
module e(r, p, c, fn = 18) color(c) translate(p) scale(r) sphere(1, $fn = fn);
// A leaf / crystal blade from p along d, `len` long and `w` wide, thin across its face.
module leafAt(p, d, len, w, c, fn = 10) color(c) translate(p) rotate(_dir_rot(d)) hull() {
  scale([w * 0.22, w * 0.1, 0.15]) sphere(1, $fn = 6);
  translate([0, 0, len * 0.45]) scale([w / 2, w * 0.14, len * 0.36]) sphere(1, $fn = fn);
  translate([0, 0, len]) sphere(0.08, $fn = 4);
}
// A ridge blade: the same shape authored along +Z, thin along X, turned with rot.
module blade(p, rot, len, w, c) color(c) translate(p) rotate(rot) hull() {
  scale([w * 0.25, w * 0.3, 0.2]) sphere(1, $fn = 6);
  translate([0, 0, len * 0.4]) scale([w * 0.34, w / 2, len * 0.34]) sphere(1, $fn = 6);
  translate([0, 0, len]) sphere(0.1, $fn = 4);
}
module dome(g = 0) hull() {
  translate([0, 0.2, 0.8]) scale([3.9 + g, 3.9 + g, 3.4 + g]) sphere(1, $fn = 28);
  translate([0, 0.8, 3.8]) scale([2.2 + g, 2.4 + g, 1.6 + g]) sphere(1, $fn = 16);
}

// ---- Carapace: a long dome, high at the shoulders, low over the hips, cut at a rim plane sloping to the back.
module shellVol(g = 0) hull() {
  translate([0, 0.5, 16.6]) scale([9.4 + g, 7 + g, 7.8 + g]) sphere(1, $fn = 30);
  translate([0, 9.5, 13.5]) scale([9.2 + g, 8.8 + g, 6.4 + g]) sphere(1, $fn = 30);
}
module aboveRim(z0 = 10.2) rotate([-6, 0, 0]) translate([-30, -40, z0]) cube([60, 80, 30]);
color(green) intersection() { shellVol(); aboveRim(); }
// Brown rim along the carapace's lower edge.
color(rimC) intersection() { shellVol(0.35); rotate([-6, 0, 0]) translate([-30, -40, 9.3]) cube([60, 80, 1.1]); }
// Plate seams: bands across the back and two seams along it.
color(seam) intersection() {
  shellVol(0.12);
  aboveRim(10.6);
  union() {
    for (y = [-3.5, 0.5, 4.5, 8.5, 12.5, 16]) translate([-15, y - 0.22, 0]) cube([30, 0.44, 40]);
    for (x = [-4.4, 4.4]) translate([x - 0.22, -20, 0]) cube([0.44, 45, 40]);
  }
}
// Dark underbelly.
e([8.4, 11.5, 4.6], [0, 3.5, 10.6], belly, 24);
// Chest under the head and the brown leaf bib hanging on its near side.
e([6.6, 5, 5], [0, -5.6, 14.6], olive, 22);
color(bib) translate([3.4, -9.3, 11.2]) rotate([8, 0, 25]) hull() {
  scale([2.1, 0.55, 1.4]) translate([0, 0, 1]) sphere(1, $fn = 14);
  translate([0, 0, -2.6]) sphere(0.3, $fn = 6);
}
color(belly) translate([3.4, -9.3, 11.2]) rotate([8, 0, 25]) translate([0, -0.45, -0.6]) scale([0.18, 0.2, 2]) sphere(1, $fn = 6);

// Mint crystal leaves along the spine: two rows leaning out and back.
ridge = [[-4.5, 22.8, 5.6], [-1.5, 24, 5.6], [1.5, 24, 5.2], [4.5, 23.2, 4.8], [7.5, 21.6, 4.4], [10.5, 19.9, 4],
         [13.5, 18, 3.6], [16.3, 15.7, 3.2]];
for (i = [0 : len(ridge) - 1]) for (sx = [-1, 1]) {
  r = ridge[i];
  blade([sx * 2.2, r[0] + (sx > 0 ? 0 : 1.2), r[1] - 0.9], [-38, sx * 22, 0], r[2], 3, (i + (sx > 0 ? 0 : 1)) % 2 == 0 ? leafC : leafLt);
}

// ---- Tail: thick and plated, sweeping back and to the creature's left, with a row of crystal leaves on top.
tailPts = [[0, 15, 12.5], [2.5, 19.5, 11], [4.8, 22, 9.6], [6.5, 23.5, 8.6]];
chain(tailPts, [5, 3.7, 2.4, 0.8], green);
color(seam) intersection() {
  chain(tailPts, [5.12, 3.82, 2.52, 0.92]);
  union() for (t = [[1.6, 18.2, 11.4, 34], [3.7, 20.9, 10.3, 45]]) translate([t[0], t[1], t[2]]) rotate([0, 0, t[3]]) cube([20, 0.4, 20], center = true);
}
for (t = [[1.3, 17.6, 15.4, 3.8], [3.4, 20.6, 13.1, 3.2], [5.4, 22.6, 10.9, 2.5]]) for (k = [-1, 1])
  blade([t[0] + k * 1.2, t[1] - k * 0.8, t[2] - 1], [-45, k * 25, 35], t[3], 2.6, k > 0 ? leafC : leafLt);

// ---- Shoulders: big peaked pauldrons over the slate arms.
mirror_x() color(greenLt) hull() {
  translate([9.2, -2.5, 19.6]) scale([3.5, 3.8, 2.9]) sphere(1, $fn = 22);
  translate([9.4, -3, 24.4]) scale([0.9, 0.5, 0.3]) sphere(1, $fn = 8);
  translate([12, -1.6, 22.6]) sphere(0.3, $fn = 8);
}
// Arms: slate upper arm, plated green forearm with an elbow guard, a fist with three red claws hanging forward.
mirror_x() {
  limb([9, -2.5, 18.5], [12.4, -3.4, 15], 1.5, 1.4, slate);
  limb([12.4, -3.4, 15], [13.8, -5, 12.2], 2.2, 2, green);
  color(greenLt) hull() {
    translate([13.3, -3.3, 14.6]) scale([1.4, 1.8, 2]) sphere(1, $fn = 12);
    translate([13.1, -2.5, 18.2]) sphere(0.3, $fn = 6);
  }
  e([2, 2.2, 1.8], [14, -5.5, 11.6], green, 14);
  for (o = [-1.1, 0, 1.1]) spike([14 + o, -6.7, 10.6], [o * 0.15, -1.1, -2.2], 0.55, 0.05, red);
}

// ---- Legs: chunky and plated, a pointed knee plate in front, three red claws on each foot.
module leg(hip, knee, ank, fwd) {
  limb(hip, knee, 3.1, 2.4, green);
  limb(knee, ank, 2.3, 2.6, green);
  e([2.9, 3.2, 1.6], [ank[0], ank[1] - 0.6, 1.6], green, 16);
  // pointed thigh plate and a shin plate in front
  color(greenLt) hull() {
    translate([knee[0] - 0.1, knee[1] - 1.9, knee[2] + 2.2]) scale([2.7, 0.9, 2.6]) sphere(1, $fn = 14);
    translate([knee[0] - 0.5, knee[1] - 1.5, knee[2] + 6.6]) sphere(0.3, $fn = 6);
  }
  color(greenLt) translate([ank[0], ank[1] - 1.9, 3.6]) scale([2.3, 0.9, 1.9]) sphere(1, $fn = 14);
  for (o = [-1.15, 0, 1.15]) spike([ank[0] + o, ank[1] - 3.1, 1.1], [o * 0.2, -1.5, -0.7], 0.5, 0.05, red);
}
mirror_x() {
  leg([7.4, -4, 11], [8.3, -4.6, 6], [8.4, -4.8, 2.2]);
  leg([7.8, 9, 10], [9, 9.6, 5.5], [9.2, 10, 2.2]);
}

// ---- Leafy twigs off the shell sides, a berry hanging under each.
mirror_x() {
  limb([8.5, 1, 20.5], [13.6, 2.5, 21.6], 0.45, 0.22, bark);
  limb([7.3, 4, 21.5], [10.4, 6.5, 26], 0.4, 0.2, bark);
  leafAt([13.6, 2.5, 21.6], [1, 0.1, 0.4], 2.2, 1.3, leafLt);
  leafAt([11.4, 1.9, 21.3], [0.2, -0.2, 1], 1.8, 1.1, leafC);
  leafAt([10.4, 6.5, 26], [0.3, 0.2, 1], 2.2, 1.3, leafLt);
  leafAt([9.2, 5.6, 24.5], [1, 0, 0.3], 1.8, 1.1, leafC);
  limb([12.6, 2.2, 21.2], [12.6, 2.2, 19.6], 0.12, 0.12, bark);
  color(berry) translate([12.6, 2.2, 19.1]) sphere(0.6, $fn = 10);
}

// ---- Antlers: branching boughs off the helmet top, spreading out and back, with leaves and hanging blue berries.
module antler(sx) {
  B = [sx * 3.2, -10.2, 22.8];
  function at(v) = B + [sx * v[0], v[1], v[2]];
  t0 = at([0, 0, 0]); t1 = at([1.5, 1.5, 4.5]); t2 = at([3.5, 3.5, 8.5]); t3 = at([4.5, 5, 13]);
  a = at([8.5, 4.5, 12.5]); b = at([9.5, 2.5, 8]); c0 = at([2.6, 2.8, 7]); c = at([-0.5, 3.5, 8]);
  chain([t0, t1, t2, t3], [1.4, 1.05, 0.75, 0.42], bark);
  limb(t2, a, 0.6, 0.32, bark);
  limb(t1, b, 0.65, 0.32, bark);
  limb(c0, c, 0.5, 0.28, bark);
  leafAt(t3, [sx * -0.2, 0, 1], 3.3, 2.1, leafLt);
  leafAt(a, [sx * 0.6, 0, 1], 3.3, 2.1, leafLt);
  leafAt(b, [sx * 1, 0, 0.5], 3.3, 2.1, leafLt);
  leafAt(c, [sx * -0.7, 0, 1], 3.1, 2, leafLt);
  leafAt((t2 + a) / 2 + [0, 0, 0.3], [sx * 0.2, 0, 1], 2.4, 1.6, leafC);
  for (q = [(t2 + a) / 2 + [sx * 1, 0, -0.4], (t1 + b) / 2 + [sx * 1.2, 0, -0.4], c + [sx * 0.4, 0, -0.5],
            t3 + [sx * -0.4, 0, -1.6], b + [sx * -0.6, 0, -0.4]]) {
    color(bark) translate(q + [0, 0, -0.9]) cylinder(h = 0.9, r = 0.12, $fn = 4);
    color(berry) translate(q + [0, 0, -1.4]) sphere(0.65, $fn = 10);
  }
}
antler(1);
antler(-1);

// ---- Head: a low helmet turned a little towards the viewer, glaring orange eyes, a tan grilled muzzle.
translate([0, -11, 20.3]) rotate([0, 0, 15]) {
  color(greenLt) dome();
  e([3.1, 3.2, 2.6], [0, -1, -2.2], green, 20);  // jaw and cheeks
  // Seam along the helmet's midline, from the brow to the crown.
  color(seam) intersection() { dome(0.14); translate([-0.17, -6, 1.4]) cube([0.34, 6.5, 8]); }
  // Tan muzzle with dark vertical grooves.
  e([2.2, 1.5, 1.2], [0, -3.7, -2.7], tan, 18);
  color(belly) intersection() {
    translate([0, -3.7, -2.7]) scale([2.32, 1.62, 1.32]) sphere(1, $fn = 20);
    for (x = [-1.2, -0.4, 0.4, 1.2]) translate([x - 0.11, -8, -6]) cube([0.22, 8, 3.4]);
  }
  mirror_x() {
    eye([2, -3.05, -0.9], 1.3, iris = eyeOr, sclera = eyeRim, pupil = eyeRed, yaw = 22, flat = 0.6,
        lid = 0.22, lid_tilt = 24, lid_c = greenLt, shine = true);
    // Heavy brow slanting down to the nose.
    color(greenLt) hull() {
      translate([2.8, -3.5, 1.15]) scale([1.3, 0.9, 0.6]) sphere(1, $fn = 10);
      translate([0.6, -4, 0.45]) scale([0.8, 0.7, 0.5]) sphere(1, $fn = 10);
    }
  }
}
