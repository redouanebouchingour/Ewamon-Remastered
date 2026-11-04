// Pebfist: Geoboxer's pre-evolution. A bald, tan, muscled little boxer in a wide low stance, two big round slate-grey
// boxing gloves up in guard, a small round head tucked forward between them with a deep scowl.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the soles stand on z ~3.8, the dust cloud and the grey shadow are
// not modelled, the model keeps the sheet's z and the build puts its lowest point on the ground):
//   - head: x -10..2.1, z 26..40, an egg (dome on top, a jaw below), sitting low between the shoulders and pushed
//     forward, face turned towards the viewer a little (features centred at x -5.8). Bald, small ears (near one at
//     x 2.4..3.4, z 30..34)
//   - face: two small deep-set glaring eyes (near (-3.2, 31.6), far (-8.2, 31.3)): brown iris, a pale highlight, under
//     heavy brows that slant down to the nose in a V (the scowl), forehead furrows; small nose ~z 30; a flat frowning
//     mouth x -7..-4.5 at z 28.5 with its corners turned down; a heavy chin to z 26
//   - torso: broad shoulders (deltoids at sheet -8 / +7.5, z 26), muscle plates: pecs, a 2 x 3 six-pack (x -4..3,
//     z 14..19 under the near glove), traps up to the head, lats; back: shoulder blades, lats, a spine groove, two big
//     round glutes (back sheet z 13..20)
//   - near (+X) arm: deltoid, the upper arm down to a low elbow (sheet 9.3, 19.5), a thick forearm forward to the glove
//     held in front of the chest (glove x -4.3..5.5, z 17.2..26.5)
//   - far (-X) arm: out to an elbow at (-14.5, 20), the forearm up to the glove raised beside the face (x -20..-11,
//     z 22.7..33.3), its thumb towards the face
//   - legs: a wide bow stance, thick thighs out to the knees ((-11.5, 12) and (8, 10.5)), shins down to big bare feet
//     with four toes: the far foot points forward-left, the near one out to the right
// Colours (Geoboxer's): skin tan (head and muscle plates lighter, the creases darker), gloves slate grey #808486 with
// a darker cuff. Nothing glows.
include <lib.scad>

skin = [0.52, 0.38, 0.26];       // the body under the muscle plates, the creases
muscle = [0.62, 0.47, 0.32];     // muscle plates
headC = [0.64, 0.49, 0.34];
skinDk = [0.42, 0.31, 0.22];
ink = [0.24, 0.15, 0.11];        // brow line, mouth
glove = [0.41, 0.44, 0.46];
gloveDk = [0.30, 0.33, 0.35];

module e(r, p, c, fn = 22) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module cap(p1, p2, r1, r2, c, fn = 16) { color(c) hull() { translate(p1) sphere(r1, $fn = fn); translate(p2) sphere(r2, $fn = fn); } }

// ---- Torso: a core in the darker skin, lighter muscle plates on it.
C1 = [0, 0, 23.6]; R1 = [7.0, 4.9, 4.8];   // chest
C2 = [0, 0.3, 17.8]; R2 = [4.9, 4.0, 3.4]; // waist
color(skin) hull() { translate(C1) scale(R1) sphere(1, $fn = 24); translate(C2) scale(R2) sphere(1, $fn = 20); }
e([4.9, 4.0, 2.5], [0, 0.4, 15.4], skin, 20);                    // hips
mirror_x() {
  e([3.5, 1.7, 2.7], [3.2, -3.9, 24.6], muscle, 18);              // pec
  e([2.8, 2.8, 1.6], [3.6, 0.6, 28.0], muscle, 22);               // trap
  e([1.4, 2.4, 3.4], [5.3, 0.2, 21.4], muscle, 14);               // flank / serratus
  e([3.2, 0.9, 3.0], [3.3, 4.0, 24.6], muscle, 22);               // shoulder blade
  e([3.0, 2.4, 3.1], [2.5, 2.6, 15.8], muscle, 16);               // glute
  e([1.6, 1.4, 2.6], [4.0, -2.6, 18.6], muscle, 12);              // oblique
}
for (z = [20.8, 18.8, 16.9]) mirror_x() e([1.35, 0.9, 0.9], [1.45, -3.55 - (z - 16.9) * 0.08, z], muscle, 10);  // six-pack
e([0.35, 0.4, 3.8], [0, 4.25, 21.6], skinDk, 8);                // spine groove

// ---- Head: tucked forward between the shoulders, turned 12 degrees towards its left (the viewer).
H = [-1.8, -4.4, 33.4]; HY = 12;
cap([0, -0.6, 27.2], [-1.0, -3.2, 30.6], 3.4, 3.0, skin);        // neck
translate(H) rotate([0, 0, HY]) {
  e([5.7, 5.4, 6.0], [0, 0.2, 0.6], headC, 24);                  // bald dome
  color(headC) hull() {                                          // jaw and chin
    translate([0, -0.5, -3.4]) scale([4.7, 4.3, 3.2]) sphere(1, $fn = 20);
    translate([0, -1.4, -5.3]) scale([3.3, 3.0, 2.1]) sphere(1, $fn = 16);
  }
  mirror_x() e([0.8, 1.1, 1.7], [5.5, 0.6, -1.2], skin, 10);    // ears
  // brows: heavy ridges slanting down to the nose in a V, a dark line under each
  mirror_x() color(headC) hull() {
    translate([4.3, -3.6, -0.3]) scale([1.3, 1.0, 0.9]) sphere(1, $fn = 10);
    translate([0.7, -5.0, -1.2]) scale([0.9, 0.8, 0.75]) sphere(1, $fn = 10);
  }
  mirror_x() color(ink) hull() {
    translate([4.2, -4.0, -0.95]) scale([0.9, 0.35, 0.3]) sphere(1, $fn = 8);
    translate([0.9, -5.45, -1.8]) scale([0.55, 0.35, 0.28]) sphere(1, $fn = 8);
  }
  // furrows: a crease between the brows and one slanting up from each brow's inner end
  e([0.2, 0.3, 0.75], [0, -5.6, -0.6], skinDk, 6);
  mirror_x() color(skinDk) translate([1.6, -5.25, 0.5]) rotate([0, -40, 0]) scale([0.18, 0.3, 0.9]) sphere(1, $fn = 6);
  // deep sockets and small glaring eyes, brown iris and a pale glint
  mirror_x() e([1.8, 0.8, 1.35], [2.45, -4.15, -2.0], skinDk, 12);
  mirror_x() eye([2.45, -4.3, -2.0], 1.2, iris = [0.42, 0.20, 0.07], sclera = [0.84, 0.70, 0.52], pupil = [0.10, 0.05, 0.03],
                 yaw = 14, flat = 0.5, lid = 0.36, lid_tilt = 26, lid_c = skinDk, slit = 0.8, shine = true);
  // nose: a short bridge and a small round tip
  cap([0, -5.0, -1.6], [0, -5.4, -2.6], 0.6, 0.75, headC, 10);
  e([1.0, 0.8, 0.8], [0, -5.35, -3.0], headC, 12);
  // mouth: a flat dark line with the corners turned down, a heavy lower lip under it
  color(ink) for (s = [-1, 1]) hull() {
    translate([0, -5.0, -4.65]) sphere(0.26, $fn = 8);
    translate([s * 1.3, -4.85, -4.65]) sphere(0.26, $fn = 8);
  }
  mirror_x() cap([1.3, -4.85, -4.65], [1.9, -4.45, -5.3], 0.25, 0.2, ink, 8);
  e([1.6, 0.6, 0.5], [0, -4.7, -5.5], skinDk, 10);
}

// ---- Arms. A boxing glove: a knuckle ball at G hulled to a smaller one towards the wrist W, a dark cuff round the
// wrist, a thumb on the inner side (T1 -> T2).
module glove_at(G, W, T1, T2) {
  u = (W - G) / norm(W - G);
  cap(G, G + 2.4 * u, 5.5, 4.5, glove, 24);
  cap(G + 4.8 * u, G + 6.2 * u, 3.0, 2.9, gloveDk, 14);
  cap(G + T1, G + T2, 1.7, 1.45, glove, 12);
}
module arm(SH, EL, W, k) {
  e([3.4, 3.3, 3.2], SH + [k * 0.3, 0, 0.6], muscle, 16);           // deltoid
  cap(SH, EL, 3.1, 2.7, skin, 14);                                 // upper arm
  e([2.2, 2.2, 2.7], (SH + EL) / 2 + [0, -1.0, 0], muscle, 12);     // biceps
  cap(EL, W, 2.8, 2.5, skin, 14);                                  // forearm
  e([2.5, 2.5, 2.5], EL + (W - EL) * 0.38, muscle, 12);           // forearm muscle
}
// near (+X): the elbow low at the side, the forearm reaching forward to the glove in front of the chest
SH_L = [7.8, 0, 25.8]; EL_L = [9.8, -1.2, 19.2]; W_L = [8.4, -3.8, 20.6]; G_L = [5.4, -8.6, 22.4];
arm(SH_L, EL_L, W_L, 1);
glove_at(G_L, W_L, [-3.9, 1.4, 1.8], [-3.8, -1.8, 2.0]);
// far (-X): the elbow out and low, the forearm up to the glove beside the face
SH_R = [-8.2, 0, 25.4]; EL_R = [-15.4, -2.0, 19.8]; W_R = [-15.8, -3.0, 23.4]; G_R = [-15.6, -5.0, 28.8];
arm(SH_R, EL_R, W_R, -1);
glove_at(G_R, W_R, [4.0, 0.2, -1.8], [3.7, -2.6, 0.6]);

// ---- Legs: a wide bow stance, thick thighs, knees out, big bare feet with four toes.
module leg(HP, KN, AN, d, L) {
  cap(HP, KN, 4.1, 3.3, skin, 20);                                 // thigh
  e([3.4, 3.2, 3.9], HP + (KN - HP) * 0.5 + [0, -1.0, 0.4], muscle, 20);   // quad
  e([3.1, 3.1, 3.0], KN, skin, 18);                                // knee
  cap(KN, AN, 2.9, 2.3, skin, 16);                                 // shin
  e([2.6, 2.6, 3.0], KN + (AN - KN) * 0.4 + [-d[0], -d[1], 0] * 0.9, muscle, 16);  // calf
  // foot: heel at the ankle, the ball L along d, four toes at the tip
  color(skin) hull() {
    translate([AN[0], AN[1], 5.3]) scale([2.5, 2.5, 1.5]) sphere(1, $fn = 16);
    translate([AN[0] + d[0] * L * 0.75, AN[1] + d[1] * L * 0.75, 5.1]) scale([2.7, 2.7, 1.3]) sphere(1, $fn = 16);
  }
  for (t = [-1.5, -0.5, 0.5, 1.5])
    e([0.85, 0.85, 0.7], [AN[0] + d[0] * L + d[1] * t * 1.1, AN[1] + d[1] * L - d[0] * t * 1.1, 4.5 - abs(t) * 0.05], muscle, 8);
}
leg([4.4, 0.2, 15.0], [10.4, -2.0, 10.6], [11.8, -1.5, 6.6], [0.92, -0.38], 6.6);
leg([-4.4, 0.2, 15.0], [-12.1, -2.0, 12.0], [-13.4, -1.5, 6.8], [-0.6, -0.8], 6.4);
