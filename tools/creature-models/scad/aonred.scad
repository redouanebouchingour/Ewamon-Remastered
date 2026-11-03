// Aonred: a blue-flame spirit knight hovering on its own flame vortex.
// Checklist (front sheet, height 40):
//   face: pale silver-blue helm z 17..31 (head turned a little to its right in the art), crown of spikes z 28..31.5
//     with a diamond crest in front; red V marks running down from the crown to a blue gem between the eyes (z 25.5);
//     two small red glaring eyes either side of it (z 24.5); under them a dark maw with pale fangs (z 21.5..24) and a
//     big pale lower jaw down to z 17.5.
//   phoenix of blue flame rising from the crown: neck z 29..34, beaked head at sheet (-4, 34.5) looking forward,
//     flame plume streaming up and back to z 40.
//   wings: dark navy-black feather fans from the shoulders spread to the sides (sheet x 5..17, z 22..35), blue flame
//     licking up along their top edge to z 40; a bright blue flame on each shoulder (sheet 5.5..10.5, z 25..30.5).
//   arms: dark, silver trimmed, a blue gem on the wrist (sheet 11.5, 18.6); clawed hands over blue fireballs
//     (centre sheet +-12.5, 13, r 2.9) with a deep blue core.
//   torso: dark armour z 15..23 with silver trim; a skirt of pointed dark plates, silver rimmed, tips at z 9.5..11.
//   below: no legs, a blue flame vortex column z 3..13 flaring into a swirling flame disc (r about 12.5), dark
//     spiral arms and a dark rim with flame tongues; it is the creature's own body and hovers.
//   back: silver banded helm, a blue gem in a silver setting between the wing roots (z 23), a dark curved tail-sash
//     sweeping to its left side (back screen x -12, z 16).
include <lib.scad>
$fa = 10;
$fs = 0.85;
// ground: 0
//   (it hovers: the flame vortex's underside is 0.8 above the ground)

shade = [0.14, 0.14, 0.17];
shadeHi = [0.24, 0.25, 0.26];
ink = [0.06, 0.08, 0.12];
silver = [0.5, 0.66, 0.8];
silverHi = [0.76, 0.87, 0.95];
flameDk = [0.05, 0.24, 0.56, NOGLOW];
flame = [0.17, 0.47, 0.82, NOGLOW];
flameHi = [0.44, 0.76, 0.97, NOGLOW];   // a glowing pale blue washes out to white in game
core = [0.07, 0.31, 0.82, GLOW];
orbMid = [0.04, 0.16, 0.48, NOGLOW];
eyeRed = [0.88, 0.14, 0.12, GLOW];
eyeDk = [0.16, 0.04, 0.06];
markRed = [0.55, 0.08, 0.08];

// ell() and blob() with fewer facets (lib.scad's are $fn 28; this model has many of them).
module oval(r, p = [0, 0, 0], c, fn = 18) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module blobf(parts, c, fn = 18) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }

// A licking flame tongue: from p up (and leaning by `lean` along d), wavy, tapering.
module fire(p, s = 1, lean = [1, 0], c = flame) {
  $fn = 6;
  l = [lean[0], lean[1], 0];
  chain([p, p + (l * 0.6 + [0, 0, 2.4]) * s, p + (-l * 0.3 + [0, 0, 4.4]) * s, p + (l * 1.1 + [0, 0, 6.6]) * s],
    [1.6, 1.2, 0.75, 0.15] * s, c);
}

// A long feather in the XZ plane: pointed at both ends, widest 40 % along, thin in y.
module feather(a, b, w, t = 0.7, c = shade) {
  color(c) hull() {
    translate(a) sphere(0.35, $fn = 8);
    translate(a + (b - a) * 0.4) scale([w, t, w]) sphere(1, $fn = 10);
    translate(b) sphere(0.1, $fn = 6);
  }
}

// A pointed armour leaf: flat ellipse at the base tapering to a tip, rimmed in silver.
module leaf(b, tip, w, t, c = shade) {
  color(c) hull() { translate(b) scale([w, t, w]) sphere(1, $fn = 9); translate(tip) sphere(0.15, $fn = 6); }
}

// ---- Vortex base: the flame column flaring into a swirling disc.
lathe([[11.6, 0.8], [12.6, 1.4], [12.8, 2.3], [11.8, 2.9], [8, 2.6], [5.6, 3.6], [4.2, 5.4], [3.8, 7.4], [4.3, 9.6],
       [4.6, 12], [4, 14.2]], flame, 32);
// dark rim ring
color(ink) translate([0, 0, 2.1]) rotate_extrude($fn = 32) translate([12.4, 0]) scale([0.9, 1]) circle(0.95, $fn = 8);
// spiral arms on the disc top (dark) and bright swirl streaks between them
for (k = [0 : 2]) {
  a0 = k * 120;
  chain([for (r = [3.4, 5.5, 7.6, 9.6, 11.4]) [r * cos(a0 + r * 22), r * sin(a0 + r * 22), r < 4 ? 3.2 : 2.85]],
    [0.6, 0.65, 0.6, 0.5, 0.35], ink);
  chain([for (r = [4.2, 6.3, 8.4, 10.3]) [r * cos(a0 + 60 + r * 22), r * sin(a0 + 60 + r * 22), r < 5 ? 3 : 2.75]],
    [0.4, 0.4, 0.35, 0.2], flameHi);
}
// swirling flame stripes round the column
for (k = [0 : 1]) chain([for (i = [0 : 5]) let(a = k * 180 + i * 62, z = 4.2 + i * 1.6) [(z < 6 ? 4.6 : 4.1) * cos(a), (z < 6 ? 4.6 : 4.1) * sin(a), z]],
  [0.5, 0.55, 0.55, 0.5, 0.45, 0.3], flameHi);
// flame tongues round the rim, taller at the sides, dark ones between blue ones
for (i = [0 : 7]) {
  a = i * 45 + 22.5;
  hgt = 0.45 + 0.4 * abs(cos(a));
  fire([12 * cos(a), 12 * sin(a), 2.2], hgt, [-sin(a), cos(a)], i % 2 == 0 ? flame : ink);
}

// ---- Skirt: pointed dark armour plates round the waist, silver rimmed.
for (i = [0 : 9]) {
  a = i * 36;
  l = i % 2 == 0 ? 1 : 0.8;
  d = [sin(a), -cos(a)];
  leaf([4.2 * d[0], 4 * d[1], 14.2], [(4.5 + 4.4 * l) * d[0], (4.3 + 4.1 * l) * d[1], 14.4 - 4.4 * l], 2.2, 0.8, i % 2 == 0 ? shade : shadeHi);
  leaf([4.05 * d[0], 3.85 * d[1], 14.3], [(4.4 + 4.6 * l) * d[0], (4.2 + 4.3 * l) * d[1], 14.4 - 4.7 * l], 2.4, 0.5, silver);
}
color(silver) translate([0, 0, 15.2]) rotate_extrude($fn = 24) translate([4.4, 0]) circle(0.45, $fn = 8);

// ---- Torso: dark armoured chest and shoulders, silver trim.
blobf([[[5.4, 4, 3.8], [0, 0, 19.5]], [[4.2, 3.4, 2.6], [0, 0, 15.8]]], shade);
mirror_x() {
  oval([2.8, 2.6, 2.3], [5.2, 0.4, 22.2], shade);                       // pauldron
  color(silver) translate([5.2, 0.4, 22.2]) rotate([0, 60, 0]) rotate_extrude($fn = 20) translate([2.5, 0]) circle(0.3, $fn = 6);
  chain([[4.4, -2.9, 22], [2.6, -3.8, 18.5], [1, -4, 15.8]], [0.32, 0.32, 0.3], silver);   // chest V trim
  spike([5.6, 0.2, 24], [0.6, 0.4, 2], 0.8, 0.08, shade);              // pauldron horn
}

// ---- Head: pale helm, crown, red V marks and gem, red eyes, a fanged maw and a big lower jaw.
blobf([[[3.7, 3.4, 3.7], [0, -4.8, 26.4]], [[2.8, 2.6, 1.8], [0, -4.2, 29.3]]], silver);
color(eyeDk) translate([0, -5.6, 22.8]) scale([2.7, 2.2, 1.5]) sphere(1, $fn = 16);                 // maw
blobf([[[3.4, 2.8, 2], [0, -5.2, 20.6]], [[2.1, 2, 1.1], [0, -5.6, 18.3]]], silver);                 // lower jaw
// fangs: down from the helm, up from the jaw
for (x = [-2, -1, 0, 1, 2]) spike([x, -7.55 + 0.17 * x * x, 23.9], [0, -0.1, -1.6], 0.42, 0.04, silverHi);
for (x = [-1.5, -0.5, 0.5, 1.5]) spike([x, -7.5 + 0.17 * x * x, 21.6], [0, -0.1, 1.4], 0.38, 0.04, silverHi);
// helm dark seams on the jaw (the art's notched plates)
mirror_x() chain([[2.7, -6.4, 21.3], [1.6, -7.2, 19.6], [0.4, -7.2, 18.4]], [0.18, 0.18, 0.15], ink);
// crown: a diamond crest in front, spikes round the brow
color(silverHi) translate([0, -7.2, 29]) rotate([-12, 0, 0]) scale([1, 0.5, 1]) rotate([0, 45, 0]) cube([2, 1, 2], center = true);
color(flameHi) translate([0, -7.62, 29.05]) rotate([-12, 0, 0]) scale([1, 0.5, 1]) rotate([0, 45, 0]) cube([1.1, 0.4, 1.1], center = true);
spike([0, -6.9, 30.2], [0, 0.4, 1.6], 0.5, 0.05, silverHi);
mirror_x() {
  spike([1.9, -6.2, 29.6], [0.6, 0, 2.4], 0.55, 0.05, silverHi);
  spike([3, -4.6, 29], [1.4, 0.3, 2.3], 0.55, 0.05, silverHi);
  spike([3.3, -2.6, 28.4], [1.4, 0.8, 1.6], 0.5, 0.05, silver);
  // red V marks from the crown down to the gem
  chain([[2.9, -6.6, 28.4], [1.6, -7.6, 26.8], [0.45, -8.05, 25.7]], [0.22, 0.22, 0.2], markRed);
  // red glaring eye, slanted, sunk in the helm under the V
  eye([1.75, -7.15, 24.55], 0.72, iris = eyeRed, sclera = eyeDk, pupil = eyeRed, yaw = 22, lid = 0.32, lid_tilt = 24,
      lid_c = silver, squint = 0.2);
}
oval([0.5, 0.35, 0.65], [0, -8.05, 25.5], core);                         // brow gem
// back of the helm: dark bands
color(ink) intersection() {
  translate([0, -4.8, 26.4]) scale([3.85, 3.55, 3.85]) sphere(1, $fn = 18);
  union() { for (z = [25, 27.4]) translate([-5, -3.6, z]) cube([10, 6, 0.45]); }
}

// ---- Phoenix of blue flame rising from the crown.
blobf([[[1.9, 2, 2.2], [0, -3.4, 31]], [[1.5, 1.8, 1.5], [0, -5.4, 33.6]]], flame);   // neck
oval([1.7, 2.3, 1.6], [0, -6.6, 34.8], flame);                              // bird head
spike([0, -8.4, 34.7], [0, -1.9, -1.2], 0.7, 0.08, flameDk);            // beak
mirror_x() color(ink) translate([1.3, -7.6, 35.3]) scale([0.32, 0.38, 0.32]) sphere(1, $fn = 10);   // bird eyes
oval([0.9, 1.3, 0.8], [0, -6.4, 35.8], flameHi);                          // crest glow
// plume streaming up and back from the bird's head, flames curling off the neck
chain([[0, -5.6, 35.6], [0, -3.6, 37.8], [0.4, -0.8, 39.2], [0, 2.6, 40]], [1.5, 1.3, 0.9, 0.2], flame);
chain([[0, -3.2, 33.6], [0, 0.8, 35.6], [0, 4.8, 37.2], [0, 8, 38.6]], [2, 1.8, 1.2, 0.2], flame);
chain([[0, -4.4, 35.4], [0, -1.6, 36.8], [-0.3, 1.6, 37.6], [0, 4.6, 38.6]], [1, 0.9, 0.6, 0.15], flameHi);
mirror_x() {
  chain([[1, -4.5, 35], [2.6, -2, 37], [3.4, 0.8, 38.5], [3, 3.6, 39.2]], [1.1, 1, 0.7, 0.15], flameDk);
  chain([[1.2, -3, 31.5], [3.2, -1.4, 33], [4.8, 0.6, 34.6], [5.4, 2.6, 36.4]], [1.3, 1.1, 0.7, 0.15], flame);
  chain([[1.2, -2.4, 30.2], [3.2, -0.6, 30.8], [5, 1.2, 32], [5.6, 2.8, 33.4]], [0.9, 0.8, 0.5, 0.12], flameDk);
}

// ---- Wings: dark feather fans spread to the sides, blue flame licking along their top edges.
// feather tips (wing frame x, z) fanning from the root at (5.6, 24): the top one up the crest, the rest out sideways
wingTips = [[15.8, 34.8], [17.8, 31.4], [18.6, 28.4], [18.4, 25.6], [17.4, 22.6], [13.4, 21]];
mirror_x() {
  // the fan swept 10 degrees forward about its root, cupping the body like the art's raised wings
  translate([5, 2.2, 0]) rotate([0, 0, -10]) translate([-5, 0, 0]) {
    // the fan: a dark base and long feathers over it
    color(shade) hull() { translate([6, 0, 24.2]) scale([1.6, 0.6, 1.6]) sphere(1, $fn = 12); translate([13, 0, 30.4]) sphere(0.6, $fn = 8); translate([15.4, 0, 24]) sphere(0.6, $fn = 8); }
    for (i = [0 : len(wingTips) - 1]) feather([5.6, (i % 2) * 0.35 - 0.15, 24], [wingTips[i][0], (i % 2) * 0.35 - 0.15, wingTips[i][1]], i == 0 ? 2.3 : 1.8, 0.7, i % 2 == 0 ? shade : shadeHi);
    // the flame crest: tongues licking up off the feathers' top edge, leaning outwards, dark ones behind
    for (f = [[4, 0, 24.4, 0.65, 0], [6, 0.5, 26.4, 0.85, 1], [7.9, -0.2, 28, 0.9, 0], [9.6, 0.5, 29.4, 0.95, 1],
              [11.4, -0.1, 30.8, 0.9, 0], [13.2, 0.5, 32.3, 0.95, 1], [15.2, -0.1, 33.8, 0.95, 0], [16.8, 0.3, 31.8, 0.85, 0],
              [17.9, 0.4, 29.2, 0.7, 1]])
      fire([f[0], f[1], f[2]], f[3], [1.3, 0], f[4] == 1 ? flameDk : flame);
    for (f = [[7, 27.4], [10.8, 30.4], [14.4, 33.2]]) fire([f[0], -0.75, f[1]], 0.55, [1, 0], flameHi);
  }
  // bright flame on the shoulder
  let($fn = 10) chain([[6.8, -0.8, 25.2], [8.6, -0.8, 27.6], [10.4, -0.5, 30.4]], [1.75, 1.2, 0.3], core);
  let($fn = 10) chain([[6.4, -0.2, 24.6], [8.4, 0.2, 26.6], [10, 0.6, 28.6]], [1.95, 1.4, 0.4], flameHi);
}

// ---- Arms: dark, silver banded, a blue gem on the wrist, claws closed over a blue fireball.
mirror_x() {
  let($fn = 12) chain([[5.6, 0, 22.2], [8.6, -1.8, 18.6], [14.2, -2.4, 18.2]], [1.45, 1.25, 1.15], shade);
  spike([8.6, -1.6, 19.4], [-0.6, 0.2, 2.4], 0.7, 0.06, shade);                  // elbow spike
  spike([13.4, -2.2, 19], [0.8, 0.3, 2.4], 0.6, 0.06, shade);                    // wrist spike
  color(silver) translate([12.6, -2.3, 18.3]) rotate([0, 90, 0]) rotate_extrude($fn = 16) translate([1.25, 0]) circle(0.3, $fn = 6);
  oval([0.55, 0.45, 0.55], [12.8, -3.5, 18.9], core);                             // wrist gem
  oval([1.7, 1.6, 1.3], [15.2, -2.8, 16.8], shade, 14);                               // hand
  // fireball
  oval([3.1, 3.1, 3.1], [15.6, -3.4, 13], flame, 20);
  oval([1.7, 0.9, 1.7], [15.4, -5.6, 12.8], core);
  oval([0.8, 0.4, 0.8], [15.3, -6.45, 12.7], orbMid);
  fire([18, -3.2, 12.2], 0.55, [0.6, 0], flame);
  fire([13, -3.6, 11.8], 0.5, [-0.6, 0], flameHi);
  // claws curling down over the orb
  for (dx = [-1.3, 0, 1.3]) chain([[15.2 + dx * 0.8, -3.6, 17.2], [15.5 + dx, -5.7, 15.6], [15.5 + dx * 1.1, -6.6, 13.8]], [0.6, 0.45, 0.12], shadeHi);
}

// ---- Back: blue gem in a silver setting, and a dark tail-sash curling round to its left side.
color(silver) translate([0, 3.7, 23]) rotate([-90, 0, 0]) cylinder(h = 0.9, r1 = 2.3, r2 = 1.9, $fn = 20);
oval([1.3, 0.9, 1.3], [0, 4.5, 23], core);
oval([0.5, 0.35, 0.5], [-0.3, 5.3, 23.4], flameHi);
mirror_x() chain([[1.6, 4.3, 21.4], [3, 3.6, 18.2]], [0.3, 0.25], silver);
chain([[0, 3.4, 17], [4, 6.6, 15.6], [8.6, 7.4, 15.8], [12.4, 5.4, 17.2]], [2, 1.6, 1.05, 0.25], shade);
