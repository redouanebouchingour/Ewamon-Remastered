// Coldplate: a squat, hugely broad golem of bronze plate set with faceted ice panels, a domed helmet with a T visor,
// enormous ice pauldrons, dark stone fists and short legs; ice shards fly off round its feet.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the feet stand on z ~5.3, the grey spray below is not modelled):
//   - helmet: round dome x -6.3..3.7, z 29.9..39.9 (centre (-1.3, 34.9)): bronze cheeks, blue-steel dome with a pale
//     ice highlight on top, a bronze rim at z 30..31, a pale cyan T visor (bar z 33.4..34.9, stem down to z 30.6)
//   - pauldrons: ice domes r~4.5 at (-10.2, 30.5) and (9.2, 31), bronze rims at their lower edge, lighter facets
//   - torso: a barrel x -9.5..9.5, z 13.4..31.4; bronze collar band z 27..31, ice panels in bronze seams over the
//     front and sides, a dark belly band z 13.5..17.8 (M2), rivets
//   - arms: ice upper arms from the pauldrons to elbows at (+-13.5, 22), a bronze band, then dark stone fists
//     (M2) r~4 at (-16, 18) and (14, 17.4) hanging beside the hips, grey knuckles (M3)
//   - legs: short; bronze knee domes at (-10.1, 13.1) / (7.4, 12.7), ice shins, flat dark feet z 5.3..8.5 with
//     bronze toe caps, x -14..-5.5 and 4.5..12.5
//   - shards: pale ice shards beside the feet and hips (x +-14..21, z 5.5..20) and two small bronze shards beside
//     each pauldron (x +-17.5..19, z 25..30.5)
//   - back: bare bronze with a riveted spine ridge of stacked plates, ice pauldrons, the fists' outer ice panels
// Colours: ice M0 [0.43, 0.68, 0.82] (light #abe1f1, dark #3b5e8c), bronze M1 [0.77, 0.66, 0.49], dark stone M2
// [0.45, 0.40, 0.39], grey M3 [0.64, 0.69, 0.72], visor dark M4 [0.10, 0.21, 0.32]. Nothing glows (NOGLOW on the cyan).
include <lib.scad>

ice = [0.43, 0.68, 0.82];
iceLight = [0.67, 0.88, 0.94, NOGLOW];
iceDark = [0.23, 0.37, 0.55];
bronze = [0.77, 0.66, 0.49];
bronzeDark = [0.62, 0.52, 0.43];
stone = [0.45, 0.40, 0.39];
stoneDark = [0.31, 0.29, 0.27];
grey = [0.64, 0.69, 0.72];
navy = [0.10, 0.21, 0.32];
cyan = [0.84, 0.98, 0.99, NOGLOW];

// Faceted ice panel lying on the ellipsoid (radii R, centre ctr) at azimuth az (0 = the front, -Y) and elevation el.
module panel(az, el, s, ctr, R, c = ice, fn = 6) {
  n = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)];
  p = ctr + [R[0] * n[0], R[1] * n[1], R[2] * n[2]];
  color(c) translate(p) rotate([0, 0, az]) rotate([90 - el, 0, 0]) rotate([0, 0, 30]) scale([s, s, s * 0.16]) sphere(1, $fn = fn);
}
// Rivet: a small dark dome on a surface point.
module rivet(p) { color(stoneDark) translate(p) sphere(0.45, $fn = 8); }
// Ice shard: a pointed hexagonal crystal of length l and radius r at p, turned by rot.
module shard(p, l, r, rot = [0, 0, 0], c = iceLight) {
  color(c) translate(p) rotate(rot) hull() {
    translate([0, 0, -l * 0.5]) sphere(0.1, $fn = 6);
    cylinder(h = l * 0.5, r = r, center = true, $fn = 6);
    translate([0, 0, l * 0.5]) sphere(0.1, $fn = 6);
  }
}

// ---- Torso: a bronze barrel, ice panels set in its front and sides, a bronze collar band, a dark belly band.
T = [0, 0, 22.2];
TR = [9.8, 8.5, 9.4];
blob([[[9.4, 8.2, 4.8], [0, 0, 27.2]], [[9.8, 8.5, 5.0], [0, 0, 22.2]], [[8.8, 7.8, 3.4], [0, 0, 15.8]]], bronze);
// Collar plate across the top of the chest, under the helmet.
color(bronzeDark) intersection() { translate(T) scale(TR + [0.25, 0.25, 0.25]) sphere(1, $fn = 32); translate([-12, -12, 28.6]) cube([24, 24, 3.2]); }
for (a = [-60, -30, 0, 30, 60]) rivet([sin(a) * 9.4, -cos(a) * 8.2, 30.0]);
// Ice mosaic: big faceted panels in bronze seams over the front and round the sides; the belly and back stay bronze.
for (p = [[-32, 24, 4.0], [32, 24, 4.0], [-66, 14, 3.8], [66, 14, 3.8],
          [-44, -2, 4.8], [0, 2, 5.4], [44, -2, 4.8], [-84, -6, 4.0], [84, -6, 4.0],
          [-24, -28, 4.6], [24, -28, 4.6], [-62, -30, 3.6], [62, -30, 3.6]])
  panel(p[0], p[1], p[2] * 0.92, T, TR - [0.2, 0.2, 0.2], abs(p[0]) > 60 ? iceDark : (p[0] < 0 ? iceLight : ice));
panel(0, 2, 2.8, T, TR + [0.15, 0.15, 0.15], iceLight);
panel(-44, -2, 2.4, T, TR + [0.15, 0.15, 0.15], iceLight);
// Dark belly band under the chest, bronze belly plate with rivets over it.
color(stoneDark) translate([0, 0, 14.4]) scale([8.2, 7.4, 2.5]) sphere(1, $fn = 24);
color(bronze) translate([0, -5.4, 15.0]) scale([5.4, 2.6, 1.9]) sphere(1, $fn = 16);
for (x = [-3, 0, 3]) rivet([x, -7.4 + abs(x) * 0.22, 15.0]);
mirror_x() for (z = [19, 23, 26.5]) rivet([9.5, -1.5, z]);
// Back: a spine ridge of stacked riveted plates and two flank plates.
for (i = [0 : 5]) ell([2.5 - i * 0.12, 1.5, 1.4], [0, 7.7 - abs(i - 2.5) * 0.3, 15.5 + i * 2.5], bronzeDark);
for (i = [0 : 5]) rivet([0, 9.1 - abs(i - 2.5) * 0.3, 15.5 + i * 2.5]);
mirror_x() for (i = [0 : 2]) ell([3.6, 1.0, 1.2], [4.6, 7.1 - i * 0.2, 17 + i * 4], bronzeDark);

// ---- Helmet: a dome of bronze cheeks under a blue-steel cap, a bronze rim, the pale T visor on the front.
H = [0, -2.6, 34.9];
color(bronze) hull() { translate(H) sphere(5.1, $fn = 32); translate([0, -2.6, 30.4]) cylinder(h = 0.2, r = 4.5, $fn = 32); }
color(iceDark) intersection() { translate(H) sphere(5.25, $fn = 32); translate([-9, -12, 35.6]) cube([18, 18, 9]); }
color(ice) intersection() { translate(H) sphere(5.32, $fn = 32); translate([-9, -12, 37.3]) cube([18, 18, 9]); }
panel(-25, 62, 2.4, H, [5.3, 5.3, 5.3], iceLight);
// Rim.
color(bronzeDark) translate([0, -2.6, 30.6]) scale([5.0, 5.0, 1.0]) sphere(1, $fn = 32);
// T visor: a dark T flush on the dome's front with a pale cyan T inside it.
module tee(w, h, s, z0) {
  translate([0, -2.6, 0]) rotate([90, 0, 0]) linear_extrude(height = 12) polygon([[-w / 2, z0 + h], [w / 2, z0 + h], [w / 2, z0], [s / 2, z0], [s / 2, z0 - 3.2], [-s / 2, z0 - 3.2], [-s / 2, z0], [-w / 2, z0]]);
}
color(navy) intersection() { translate(H) sphere(5.5, $fn = 32); tee(8.6, 2.5, 3.0, 33.0); }
color(cyan) intersection() { translate(H) sphere(5.65, $fn = 32); tee(7.6, 1.8, 2.1, 33.4); }

// ---- Pauldrons: huge ice domes with bronze rims, two lighter facets each.
mirror_x() {
  P = [11.3, -1, 31.2];
  ell([4.8, 4.8, 4.6], P, ice);
  ell([4.75, 4.75, 1.7], P + [0, 0, -3.3], bronzeDark);
  panel(60, 35, 3.0, P, [4.8, 4.8, 4.6], iceLight);
  panel(-10, 20, 2.8, P, [4.8, 4.8, 4.6], iceLight);
  panel(100, -5, 2.8, P, [4.8, 4.8, 4.6], iceDark);
  rivet(P + [0, -4.5, -3.3]);
}

// ---- Arms: ice upper arms, a bronze band at the wrist, dark stone fists with grey knuckles beside the hips.
mirror_x() {
  limb([12.4, -1, 28], [15.6, -1.5, 22], 3.4, 3.1, ice);
  panel(60, 0, 2.2, [14, -1.2, 25], [3.3, 3.3, 3.3], iceLight);
  ell([3.7, 3.7, 1.3], [15.8, -1.6, 21.2], bronze);
  rivet([15.8, -5.1, 21.2]);
  blob([[[4.4, 4.2, 3.4], [17.6, -3, 18.6]], [[4.0, 3.8, 2.6], [17.8, -3.4, 15.6]]], stone);
  for (k = [-2.2, 0, 2.2]) color(grey) translate([17.6 + k, -6.6, 17.6]) scale([1.15, 1.0, 1.3]) sphere(1, $fn = 10);
  color(grey) translate([14.2, -5.4, 16.0]) scale([1.1, 1.3, 1.6]) sphere(1, $fn = 10);
  panel(95, 10, 2.4, [17.6, -3, 18.6], [4.4, 4.2, 3.4], iceDark);
}

// ---- Legs: short and wide; bronze knee domes, ice shins, flat dark feet with bronze toe caps.
mirror_x() {
  limb([7.6, -1.2, 15.5], [9.6, -1.6, 9], 3.6, 3.5, ice);
  ell([2.8, 2.5, 2.7], [10.2, -3.6, 13], bronze);
  rivet([10.1, -5.5, 13]);
  panel(0, -10, 2.2, [9.4, -1.6, 9.5], [3.3, 3.3, 3.3], iceLight);
  blob([[[4.6, 4.2, 1.8], [10.5, -2, 6.9]], [[3.6, 2.4, 1.6], [10.5, -4.8, 6.7]]], stone);
  color(bronze) hull() for (k = [-2.6, 0, 2.6]) translate([10.5 + k, -6.2, 6.3]) scale([1.1, 1.2, 0.9]) sphere(1, $fn = 10);
}

// ---- Shards: pale ice crystals flung out beside the feet and hips, small bronze ones beside the pauldrons.
for (s = [[-22.5, -3, 14.8, 4.2, 1.1, [0, 20, 0]], [-19.5, -3, 11.9, 3.6, 0.9, [0, -25, 0]], [-16.3, -4, 8.5, 2.4, 0.7, [0, 15, 0]],
          [-12.5, -5, 6.2, 1.8, 0.6, [0, -30, 0]], [-23, -2, 19.2, 2.0, 0.6, [0, 10, 0]],
          [20.5, -2, 18.6, 2.2, 0.6, [0, -15, 0]], [21.5, -3, 12.8, 3.8, 1.0, [0, 20, 0]], [18.8, -4, 9.2, 2.8, 0.8, [0, -30, 0]],
          [15.5, -5, 7.8, 2.2, 0.7, [0, 25, 0]], [17.8, -2, 6.0, 1.6, 0.5, [0, -10, 0]],
          [4.4, -7.5, 10.0, 1.8, 0.5, [0, 20, 0]], [-3.5, -8.5, 10.4, 1.6, 0.5, [0, -20, 0]]])
  shard([s[0], s[1], s[2]], s[3], s[4], s[5]);
for (s = [[-19.6, 1, 26.6, 2.4, 0.7, [0, -25, 0]], [-21.3, 1, 29.6, 2.0, 0.6, [0, 20, 0]],
          [19.8, 1, 29.2, 2.2, 0.6, [0, 25, 0]], [21.0, 1, 26.2, 1.9, 0.6, [0, -20, 0]]])
  shard([s[0], s[1], s[2]], s[3], s[4], s[5], bronze);
