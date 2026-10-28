// Glaciarm: a steel-blue armoured knight with bronze trim, a tall crested helm with glowing cyan eyes behind a dark
// T visor, ice-crystal clusters bursting from its pauldrons and knees, and two huge faceted fists of solid ice held
// forward in a mist of frost.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the feet stand on z ~0.6; the grey ground spray is not modelled):
//   - helm: x -3.7..2.8, z 27.4..39.2, a tall pointed dome with a bronze crest ridge front to back, flared cheeks,
//     a bronze brim at z 29.5..30.3, a dark T visor (bar z 33.4..34.9) with two slanted cyan eyes at (-2.1, 34.2)
//     and (1.1, 34.2)
//   - pauldrons: steel domes with bronze rims, x -12.2..-4.2 and 3.8..13.8, z 22..32; ice crystal clusters on top
//     of each reaching z 39.2 (x -12.7..-7.2 and 5.3..11.8), a few more crystals out to x 13.8
//   - torso: steel chest plate x -5.7..3.8, z 22..31 with bronze collar, seam and edges; banded abdomen z 15..22;
//     bronze belt at z 15; steel fauld plates z 10.6..15.7 over the thighs
//   - fists: huge faceted ice boulders held forward: x -19.7..-8.2, z 16.4..28.4 and x 3.8..17.8, z 15.4..26.4,
//     vertical knuckle facets on top, grey frost wisps curling round their outer sides
//   - legs: steel thighs, knee cops with ice crystal clusters at (-8.5, 10) / (7.5, 10), greaves with bronze bands,
//     sabatons z 0.5..3.9 (x -11.2..-4.2 and 3.8..11.8)
//   - shards: long pale ice shards floating beside the clusters (x -18.5, z 31..36 / x 16.5, z 28..34) and beside
//     the knees (x -15, z 9..14 / x 13.5, z 9..14)
//   - back: the bronze crest and spine strap down the back, the pauldrons' domes, the fists' outer facets
// Colours: steel M0 mid [0.33, 0.45, 0.56] (light #7395ad), ice M1 [0.71, 0.90, 0.97] (light #e1fbfd, dark #98d1eb),
// bronze M2 [0.49, 0.34, 0.27] / trim #b58b65, mist M3 [0.79, 0.79, 0.77], dark M4 [0.13, 0.17, 0.22]. The sheet
// lists nothing as GLOWS: the cyan eyes get NOGLOW.
include <lib.scad>

steel = [0.33, 0.45, 0.56];
steelLight = [0.45, 0.58, 0.68];
steelDark = [0.16, 0.28, 0.41];
ice = [0.71, 0.90, 0.97, NOGLOW];
iceLight = [0.88, 0.99, 0.99, NOGLOW];
iceDark = [0.59, 0.82, 0.92, NOGLOW];
bronze = [0.49, 0.34, 0.27];
trim = [0.71, 0.55, 0.40];
mist = [0.79, 0.79, 0.77];
dark = [0.13, 0.17, 0.22];
cyan = [0.88, 0.99, 0.99, NOGLOW];

// Hexagonal ice crystal from p along d, radius r, pointed tip.
module crystal(p, d, r, c = ice) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    translate([0, 0, -r * 0.6]) cylinder(h = l * 0.68 + r * 0.6, r = r, $fn = 6);
    translate([0, 0, l * 0.68]) cylinder(h = l * 0.32, r1 = r, r2 = 0.08, $fn = 6);
  }
}
// A burst of crystals at p, scaled s, leaning outwards along ox (+1 / -1).
module cluster(p, s, ox) {
  crystal(p, [ox * 0.6, 0, 8.4] * s, 1.35 * s, iceLight);
  crystal(p + [ox * 1.4, 0.6, 0] * s, [ox * 3.2, 0.6, 6.4] * s, 1.15 * s, ice);
  crystal(p + [ox * -1.2, -0.4, 0] * s, [ox * -2.4, -1.2, 6.0] * s, 1.0 * s, ice);
  crystal(p + [ox * 0.4, -1.4, 0] * s, [ox * 1.2, -3.0, 4.6] * s, 0.95 * s, iceDark);
  crystal(p + [ox * -0.2, 1.4, 0] * s, [ox * -0.8, 2.8, 5.0] * s, 0.9 * s, ice);
  crystal(p + [ox * 2.6, -0.4, -0.4] * s, [ox * 4.4, -0.6, 3.4] * s, 0.85 * s, iceDark);
}
// Thin bronze band round an ellipsoid limb section.
module band(p, r, c = trim) { ell([r[0] + 0.25, r[1] + 0.25, r[2]], p, c); }
// Grey frost wisp through points.
module wisp(pts) chain(pts, [for (q = pts) 0.3], mist);

// ---- Torso: steel chest and waist, lighter breastplate, bronze collar, seam, edges, belt; banded abdomen.
blob([[[7.6, 5.8, 5.0], [0, -0.5, 26.6]], [[6.0, 5.0, 3.8], [0, -0.5, 19.5]]], steel);
ell([5.8, 2.2, 4.2], [0, -5.2, 26.8], steelLight);
color(trim) translate([0, -6.3, 26.4]) scale([0.55, 0.9, 4.6]) sphere(1, $fn = 10);       // centre seam
color(trim) translate([0, -3.4, 30.4]) scale([5.6, 2.6, 0.6]) sphere(1, $fn = 20);          // collar
color(trim) translate([0, -4.6, 22.2]) scale([5.6, 2.4, 0.5]) sphere(1, $fn = 20);          // breastplate edge
for (z = [20.6, 18.2]) ell([6.0, 5.0, 1.0], [0, -0.6, z], steelDark);                        // abdomen bands
for (z = [19.4, 17.0]) color(trim) translate([0, -4.6, z]) scale([4.6, 1.6, 0.3]) sphere(1, $fn = 16);
ell([6.6, 5.6, 1.1], [0, -0.5, 15.2], bronze);                                                // belt
// Fauld: steel skirt plates over the thighs, bronze lower edge.
blob([[[7.0, 5.2, 1.6], [0, -0.8, 14.4]], [[6.2, 4.8, 1.4], [0, -1.0, 11.4]]], steel);
color(trim) translate([0, -1.0, 10.8]) scale([6.3, 4.9, 0.4]) sphere(1, $fn = 24);
mirror_x() color(trim) translate([4.4, -5.0, 12.8]) scale([0.4, 1.2, 1.8]) sphere(1, $fn = 8);
// Back: a bronze strap down the spine.
color(trim) translate([0, 5.4, 24]) scale([0.9, 0.9, 6.4]) sphere(1, $fn = 10);

// ---- Helm: a tall pointed dome, flared cheeks, bronze brim and crest ridge, dark T visor with cyan eyes.
H = [0, -1.2, 33.4];
blob([[[4.0, 4.3, 4.8], H], [[4.5, 4.6, 2.0], [0, -1.2, 29.8]]], steel);
color(steel) translate(H + [0, 0.4, 3.0]) cylinder(h = 2.8, r1 = 2.4, r2 = 0.3, $fn = 16);        // point
color(trim) translate(H + [0, 0.4, 0.6]) scale([0.6, 4.6, 5.2]) sphere(1, $fn = 20);             // crest ridge
color(trim) translate([0, -1.2, 29.9]) scale([4.9, 5.0, 0.55]) sphere(1, $fn = 28);              // brim
// Visor: a dark bar with the stem down to the brim, on the dome's front.
color(dark) intersection() {
  translate(H) scale([4.25, 4.55, 5.05]) sphere(1, $fn = 28);
  union() { translate([-3.4, -8, 33.3]) cube([6.8, 6, 1.7]); translate([-0.7, -8, 30.2]) cube([1.4, 6, 3.4]); }
}
// Eyes: slanted cyan slits in the bar, the inner ends low.
mirror_x() color(cyan) translate([1.5, -5.25, 34.15]) rotate([0, 0, 8]) rotate([0, -22, 0]) scale([1.05, 0.45, 0.42]) sphere(1, $fn = 12);

// ---- Pauldrons: steel domes with bronze rims, a burst of ice crystals on top; short steel upper arms to the fists.
mirror_x() {
  P = [10.4, -0.4, 27.8];
  ell([5.0, 4.8, 4.5], P, steel);
  ell([5.2, 5.0, 1.0], P + [0, 0, -3.4], trim);
  ell([2.8, 2.4, 1.4], P + [-0.4, -3.4, 1.8], steelLight);
  cluster(P + [0.8, 0.4, 2.6], 1.15, 1);
  limb([10.4, -1.6, 25.4], [12.2, -5.0, 22.4], 2.9, 2.8, steelDark);
  band([12.2, -5.0, 22.4], [2.9, 2.9, 0.9]);
}

// ---- Fists: huge faceted ice boulders held forward, knuckle ridges along the top, a thumb inboard, frost wisps.
mirror_x() {
  F = [14.6, -5.2, 21.8];
  color(ice) hull() {
    translate(F + [0, 0, 1.4]) rotate([0, 0, 15]) scale([5.9, 5.5, 4.8]) sphere(1, $fn = 8);
    translate(F + [0.2, -0.6, -2.4]) rotate([0, 0, 15]) scale([5.5, 5.2, 3.4]) sphere(1, $fn = 8);
  }
  for (k = [-3.6, -1.2, 1.2, 3.6]) color(iceLight) translate(F + [k, -3.4, 4.6]) scale([1.05, 2.4, 1.6]) sphere(1, $fn = 8);
  for (k = [-2.4, 0, 2.4]) color(iceDark) translate(F + [k, -5.2, 3.0]) scale([0.3, 1.2, 2.2]) sphere(1, $fn = 6);
  color(iceLight) translate(F + [-5.2, -2.4, 0.6]) rotate([0, 25, 0]) scale([1.6, 2.6, 1.8]) sphere(1, $fn = 8);
  color(iceDark) translate(F + [5.2, 0.6, -0.4]) scale([1.0, 3.8, 4.0]) sphere(1, $fn = 7);
  color(iceDark) translate(F + [1.0, -1.4, -5.3]) scale([4.2, 3.4, 0.9]) sphere(1, $fn = 8);
  wisp([F + [3.6, -5.8, 6.4], F + [6.0, -4.6, 5.6], F + [7.8, -2.6, 3.6], F + [8.4, -0.2, 1.0], F + [8.2, 1.8, -1.8], F + [7.0, 2.8, -4.4], F + [5.0, 2.6, -6.4], F + [2.6, 1.6, -7.2]]);
  wisp([F + [-3.0, -6.2, -4.6], F + [-0.4, -7.2, -5.8], F + [2.6, -7.4, -6.4], F + [5.4, -6.6, -6.2]]);
}

// ---- Legs: steel thighs under the fauld, knee cops with ice clusters, banded greaves, sabatons.
mirror_x() {
  limb([6.0, -1.0, 13.0], [8.4, -1.4, 9.8], 3.4, 3.2, steel);
  ell([2.9, 2.6, 2.6], [8.8, -3.6, 10.0], steelLight);
  band([8.6, -1.4, 9.6], [3.3, 3.3, 0.7]);
  cluster([9.4, -3.8, 10.6], 0.62, 1);
  limb([8.4, -1.4, 9.6], [8.8, -1.4, 3.4], 3.2, 3.0, steel);
  band([8.6, -1.4, 6.4], [3.2, 3.2, 0.5]);
  band([8.8, -1.4, 3.6], [3.1, 3.1, 0.6]);
  blob([[[3.9, 3.4, 1.9], [8.9, -1.6, 2.0]], [[3.5, 3.0, 1.5], [9.1, -5.4, 1.6]]], steel);
  color(trim) translate([9.1, -5.8, 2.0]) scale([3.3, 1.4, 0.5]) sphere(1, $fn = 12);
}

// ---- Floating shards beside the shoulder clusters and the knees.
for (s = [[-19.2, 1, 33.6, 6.0, 1.0, [0, -18, 0]], [-16.0, 2, 29.2, 2.6, 0.6, [0, 20, 0]], [-21.5, 0, 30.4, 2.2, 0.5, [0, 10, 0]],
          [18.2, 1, 31.4, 6.0, 1.0, [0, 18, 0]], [20.6, 0, 27.2, 2.4, 0.6, [0, -15, 0]],
          [-15.8, -2, 11.6, 4.2, 0.9, [0, -15, 0]], [-13.2, -4, 14.2, 2.2, 0.55, [0, 20, 0]],
          [15.2, -2, 11.4, 4.4, 0.9, [0, 15, 0]], [17.6, -3, 14.2, 2.4, 0.55, [0, -20, 0]]])
  crystal([s[0], s[1], s[2] - s[3] / 2], [sin(s[5][1]) * s[3], 0, cos(s[5][1]) * s[3]], s[4], iceLight);
