// Blizzhowl, rebuilt from the measurement sheet (front height 40, feet z = 0).
//
// Checklist (front sheet x, z; the art sits about 5.5 to the left of the scad's x = 0):
// - Body plan: a fluffy white arctic fox standing on long slim legs, crouched forward a little with the front legs
//   spread, seen nearly side-on (the face to the viewer's left), a huge peacock fan of eight soft feathery tails rising
//   up and back behind it. Fox proportions: the body is long along Y (chest y -8, rump y 7), which the 30 degree view
//   halves.
// - Head: a fox head, x -18..-4.5, z 22..34: a narrow skull, a tapered pointed muzzle angled to the viewer's left
//   (the head turned 8 degrees towards the creature's right), cheeks with a feathered white fringe (far cheek out to
//   x -21).
// - Eyes: narrow slanted sly fox eyes, blue iris, a dark lash line on top, the outer corner up, a white glint:
//   near (-11.1, 27.1), far (-16.6, 27.3), both full eyes.
// - Nose: a navy-blue dot near the muzzle tip (-15.9, 24.4).
// - Mouth: wide open, red inside with little white fangs, (-15.4..-12.1, 21..24.1): a happy howl.
// - Ears: tall pointed, white with a navy-blue inner stripe and a cyan icy tuft inside; tips at (-17.8, 40) far and
//   (-5.5, 39.7) near; cyan ice tufts flaring off each ear's outer edge.
// - Ruff: a big feathery collar of cyan and white feathers round the neck and over the chest, x -21..-2, z 13..26.
// - Body: white and fluffy, a feathered fringe under the chest, white haunches.
// - Legs: white to the elbow / hock (z 9.5), then dark navy socks with a feathery white top edge; paws: near front
//   (-10.5, 0), far front reaching forward (-21, 2), far back (-5, 3), near back stretched back (6.5, 3).
// - Tails: eight separate soft leaf / flame tails from the rump (1.5, 15.5), tips at about (1.5, 36) (6, 37) (10, 37)
//   (15, 33) (21, 26) (21, 18) (22.6, 13) (16.5, 5.5): thick pillows, blue only at the root and along the edges,
//   pale periwinkle bodies, white centres and tips, rounded feathery lobes on the edges.
// - Back: the same fan radiating from the rump, white fur, the navy legs.
// - Glow: the sprite's cyan (#45c2f6) glows: the ruff's cyan feathers and the ear tufts; nothing else.
include <lib.scad>

fur      = [0.98, 0.99, 1];
furShade = [0.80, 0.87, 0.99];
ruffPale = [0.60, 0.84, 0.99, NOGLOW];
ruffCyan = [0.33, 0.78, 0.97, GLOW];
tailMid  = [0.50, 0.62, 0.95];
tailPale = [0.86, 0.9, 1, NOGLOW];
tailTip  = [0.94, 0.97, 1, NOGLOW];
earIn    = [0.25, 0.38, 0.85];
paw      = [0.13, 0.16, 0.55];
navy     = [0.08, 0.09, 0.45];
eyeDark  = [0.10, 0.12, 0.50];
iris     = [0.18, 0.48, 0.95, NOGLOW];
irisHi   = [0.35, 0.78, 0.99, NOGLOW];
mouthC   = [0.82, 0.18, 0.28, NOGLOW];
tongue   = [0.96, 0.46, 0.52, NOGLOW];

// A soft feather tuft: a leaf from its base `p` along `d` (its length), `w` wide, a third as thick, a soft point.
module tuft(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    translate([0, 0, l * 0.45]) scale([w * 0.36, w, l * 0.45]) sphere(1, $fn = 9);
    translate([0, 0, l * 0.97]) scale([w * 0.1, w * 0.16, 0.1]) sphere(1, $fn = 6);
  }
}

// ---- Head, in its own frame: centre HC, turned HEAD_YAW (towards the creature's right, the muzzle to the viewer's left)
HC = [0, -11.5, 28.4];
HEAD_YAW = -8;
// A sly fox eye in the head frame: a dark almond socket, a blue iris with a slit pupil, a cyan crescent low in it, a
// glint and a dark lash line along the top, the whole eye tilted `tilt` (outer corner up) and turned `yaw` outward.
EYE = [3.4, -4.5, -0.8];
EYE_SIZE = 1.9;
EYE_YAW = 22;
EYE_TILT = -14;
module foxEye(p, s, yaw, tilt) {
  translate(p) rotate([0, tilt, yaw]) {
    color(eyeDark) scale([1, 0.42, 0.68] * s) sphere(1, $fn = 20);
    color(iris) translate([0.05 * s, -0.2 * s, -0.04 * s]) scale([0.55, 0.36, 0.56] * s) sphere(1, $fn = 16);
    color(navy) translate([0.05 * s, -0.38 * s, -0.02 * s]) scale([0.2, 0.2, 0.4] * s) sphere(1, $fn = 12);
    color(irisHi) translate([0.05 * s, -0.4 * s, -0.36 * s]) scale([0.32, 0.12, 0.12] * s) sphere(1, $fn = 10);
    color("white") translate([0.28 * s, -0.48 * s, 0.2 * s]) sphere(0.13 * s, $fn = 8);
    color(navy) translate([0, -0.12 * s, 0.52 * s]) scale([1.02, 0.36, 0.13] * s) sphere(1, $fn = 16);
  }
}
module headAt() { translate(HC) rotate([0, 0, HEAD_YAW]) children(); }

headAt() {
  // a narrow skull and a lower face, the muzzle tapering to a point
  ell([6.2, 5.8, 5.4], [0, 0, 0.3], fur);
  ell([5.2, 4.2, 3.2], [0, -2.2, -3], fur);
  color(fur) hull() {
    translate([0, -4.8, -2.4]) scale([3.2, 2.6, 2.3]) sphere(1, $fn = 20);
    translate([0, -7.9, -3.1]) scale([0.9, 0.9, 0.8]) sphere(1, $fn = 12);
  }
  ell([0.7, 0.5, 0.5], [0, -8.55, -2.8], navy);
  // open mouth: the lower jaw dropped open, the red inside, a tongue, two little fangs
  color(fur) hull() {
    translate([0, -3.8, -5.9]) scale([2.2, 1.8, 1]) sphere(1, $fn = 16);
    translate([0, -7.4, -6.2]) scale([0.7, 0.6, 0.45]) sphere(1, $fn = 10);
  }
  color(mouthC) translate([0.15, -5.6, -4.9]) scale([1.4, 2.3, 1.2]) sphere(1, $fn = 18);
  color(tongue) translate([0.1, -5.8, -5.7]) scale([1, 1.6, 0.4]) sphere(1, $fn = 14);
  mirror_x() spike([0.9, -7, -3.7], [0, 0, -0.8], 0.3, 0.05, fur);
  // eyes
  foxEye(EYE, EYE_SIZE, EYE_YAW, EYE_TILT);
  foxEye([-EYE[0], EYE[1], EYE[2]], EYE_SIZE, -EYE_YAW, -EYE_TILT);
  // cheeks: a feathered white fringe flaring out and down
  mirror_x() {
    tuft([4.6, -2.6, -2.6], [2.6, 0.8, -1.6], 1.3, fur);
    tuft([5.4, -0.6, -1.2], [2.8, 1.2, -0.6], 1.3, fur);
    tuft([4.2, -3.8, -4], [1.6, 0, -2.2], 1.1, fur);
    tuft([5.2, 1.5, -2], [2.2, 1.6, -1.4], 1.2, fur);
  }
  // crown fluff
  tuft([0, -1.5, 5.2], [0, -0.6, 2], 1, fur);
  mirror_x() tuft([1.8, 0, 5.3], [0.6, 0.2, 1.8], 0.9, fur);
  // ears: tall and pointed, white with a navy-blue inner stripe, a cyan icy tuft inside and ice tufts on the outer edge
  mirror_x() {
    color(fur) hull() {
      translate([4.6, -0.3, 3.8]) scale([3.3, 1.1, 2.6]) sphere(1, $fn = 18);
      translate([7, -0.8, 11.8]) sphere(0.4, $fn = 8);
    }
    color(earIn) hull() {
      translate([4.1, -1.3, 4.6]) scale([0.9, 0.5, 1.4]) sphere(1, $fn = 14);
      translate([6.6, -1.45, 10.4]) sphere(0.25, $fn = 8);
    }
    tuft([5.2, -1.4, 4], [0.9, -0.2, 4], 0.9, ruffCyan);
    tuft([6.9, -0.5, 5], [2.4, 0.3, 3.4], 1.1, ruffCyan);
    tuft([7.4, -0.3, 3], [3, 0.6, 1.4], 1, ruffCyan);
  }
}

// ---- Ruff: a big feathery collar of cyan and white feathers round the neck and over the chest
RC = [0, -11.5, 20.8];
ell([7.8, 6.4, 4.8], RC, ruffPale);
// top ring: feathers flaring up and out round the cheeks and the nape
for (i = [0 : 11]) let(a = i * 30, d = [cos(a), sin(a), 0])
  if (sin(a) > -0.6) tuft(RC + [d[0] * 5.4, d[1] * 4.4, 2.6], [d[0] * 3.6, d[1] * 2.8, 1.2], 2.3, i % 2 == 0 ? fur : ruffCyan);
// middle ring: feathers pointing out and a little down
for (i = [0 : 11]) let(a = i * 30 + 15, d = [cos(a), sin(a), 0])
  tuft(RC + [d[0] * 6.4, d[1] * 5, 0.6], [d[0] * 4, d[1] * 3.2, -1.8], 2.5, i % 2 == 0 ? ruffCyan : ruffPale);
// lower ring: longer feathers hanging down and out
for (i = [0 : 11]) let(a = i * 30, d = [cos(a), sin(a), 0])
  tuft(RC + [d[0] * 6, d[1] * 4.8, -2.4], [d[0] * 2.8, d[1] * 2.4, -4.2], 2.5, i % 3 == 0 ? fur : i % 3 == 1 ? ruffCyan : ruffPale);
// the bib over the chest
for (x = [-4 : 2 : 4]) tuft([x, -16.5, 16.8], [x * 0.12, -0.9, -4.2], 1.8, abs(x) == 2 ? fur : ruffCyan);

// ---- Body: white, fluffy
blob([[[6.2, 6.5, 6.5], [0, -8, 14]], [[5.6, 6, 5.8], [0, 7, 14.5]]], fur);
ell([4.6, 9, 2.4], [0, 0, 9], furShade);
// feathered fringe under the chest and belly, and along the flanks
for (p = [[-3, -10], [0, -11], [3, -10], [-3.5, -4], [3.5, -4], [-3.5, 2], [3.5, 2]]) tuft([p[0], p[1], 9], [p[0] * 0.2, -0.8, -2.8], 1.5, fur);
mirror_x() for (y = [-4, 2]) tuft([5.4, y, 14], [1.2, 2, -2.6], 2, fur);
// haunches with a feather flick each
mirror_x() {
  ell([3.6, 5, 5], [3.6, 8, 12.5], fur);
  tuft([6, 10, 10.5], [0.6, 1.8, -2.6], 1.4, fur);
}

// ---- Legs: long and slim, white to the elbow / hock, then a navy sock with a feathery white top edge
module leg(hip, knee, foot) {
  limb(hip, knee, 2.4, 1.9, fur);
  limb(knee, foot + [0, 0, 0.2], 1.5, 1.4, paw);
  color(paw) translate(foot + [0, -0.6, -0.1]) scale([2.1, 2.7, 1.25]) sphere(1, $fn = 16);
  for (a = [30 : 120 : 270]) tuft(knee + [cos(a) * 1.2, sin(a) * 1.2, 1], [cos(a) * 0.6, sin(a) * 0.6 - 0.2, -2.6], 1.1, fur);
}
LEGS = [
  [[3.4, -9, 12.5], [4.4, -12.8, 8.6], [5.2, -15.8, 1.1]],    // near front (+X)
  [[-3.4, -9, 12.5], [-5, -14.4, 8.6], [-6.2, -19.2, 1.1]],    // far front, reaching forward
  [[3.6, 7, 12.5], [4.2, 11.8, 8.2], [4.6, 14.5, 1.1]],        // near back, stretched back
  [[-3.6, 7, 12.5], [-4.1, 9.1, 8.2], [-4.6, 9.5, 1.1]],       // far back
];
for (l = LEGS) leg(l[0], l[1], l[2]);

// ---- Tails: eight soft feathered pillows radiating from the rump, each on its own direction: up and back, its
// horizontal part turned FAN_YAW (from +X) plus or minus 10 so neighbours sit at different depths.
TAIL_ROOT = [0, 13.5, 15.5];
FAN_YAW = 45;
// [sheet angle (deg, 90 = up), sheet length, width]
TAILS = [[92, 21, 8], [76, 22, 8.5], [61, 23, 9], [46, 22.5, 9], [29, 22.3, 9], [10, 20, 8.5], [-7, 21, 8], [-32, 18, 7.5]];
function tailYaw(i) = FAN_YAW + (i % 2 == 0 ? -10 : 10);
function tailProj(i) = cos(tailYaw(i)) * 0.866 + sin(tailYaw(i)) * 0.5;
function tailPitch(i) = atan2(sin(TAILS[i][0]), cos(TAILS[i][0]) / tailProj(i));
function tailLen(i) = TAILS[i][1] / norm([tailProj(i) * cos(tailPitch(i)), sin(tailPitch(i))]);
// one tail along +X, a pillow about 4 deep (Y), `w` wide (Z): blue at the root and along the edges, a pale
// periwinkle body, a white centre and tip, rounded feathery lobes on both edges
module tailShape(len, w) {
  // the blue root and rim: a little wider and thinner than the pale body, so it shows only at the root and edges
  color(tailMid) hull() {
    translate([1.5, 0, 0]) scale([2.2, 1.6, 1.8]) sphere(1, $fn = 10);
    translate([len * 0.52, 0, 0]) scale([len * 0.3, 1.1, w / 2 + 0.35]) sphere(1, $fn = 16);
    translate([len * 0.84, 0, 0]) scale([len * 0.13, 1, w * 0.3]) sphere(1, $fn = 10);
  }
  // the pale periwinkle body: a broad paddle with a soft rounded point
  color(tailPale) hull() {
    translate([len * 0.25, 0, 0]) scale([len * 0.1, 1.5, w * 0.3]) sphere(1, $fn = 10);
    translate([len * 0.54, 0, 0]) scale([len * 0.27, 1.65, w / 2]) sphere(1, $fn = 16);
    translate([len * 0.86, 0, 0]) scale([len * 0.13, 1.3, w * 0.28]) sphere(1, $fn = 10);
  }
  // the white centre and tip
  color(tailTip) hull() {
    translate([len * 0.6, 0, 0]) scale([len * 0.22, 1.8, w * 0.38]) sphere(1, $fn = 12);
    translate([len * 0.9, 0, 0]) scale([len * 0.1, 1.4, w * 0.2]) sphere(1, $fn = 10);
  }
  // rounded feathery lobes on both edges
  for (k = [[0.42, 0.47, 20], [0.68, 0.38, 30]]) for (s = [-1, 1])
    color(tailPale) translate([len * k[0], 0, s * w * k[1]]) rotate([0, -s * k[2], 0]) scale([len * 0.12, 1.1, 1.1]) sphere(1, $fn = 10);
}
for (i = [0 : len(TAILS) - 1])
  translate(TAIL_ROOT) rotate([0, -tailPitch(i), tailYaw(i)]) tailShape(tailLen(i), TAILS[i][2]);
// the fluffy root of the fan
ell([3.4, 3.4, 3.4], TAIL_ROOT, fur);
