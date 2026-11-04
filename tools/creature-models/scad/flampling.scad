// Flampling: a round, fluffy orange fire chick hovering over a little ground fire (the fire is NOT modelled, only the
// hover gap). Checklist (front sheet, 40 units; sheet x, z):
//   body   a round pear-egg, x -11.5..11, z 11..31.7, fluffy outline (soft lobes round the lower half), orange
//   chest  pale fluffy band x -9.5..4, z 14.5..21, zigzag edges
//   face   two slanted angry eyes (dark red, black pupil, cream highlight) at x -8..-5.2 / -1..2.8, z 23.6..27.5,
//          heavy dark brows sloping down to the nose; a small round dark beak at (-3.5, 23.3)
//   crest  a flame leaning to the viewer's right, x -5.7..5.7, z 29..40: red rim, orange, a yellow / cream V core;
//          tongue tips at (-5.5, 35.2), (-3.7, 38), (-1.8, 38.2), (2.7, 40), (5.6, 36)
//   wings  stubby wings out to the sides (near tip at (12, 21)), each holding a yellow fireball with orange tongues
//          (near x 8.6..14.3, z 21..29; far x -14.3..-10.6, z 21.5..30)
//   legs   short dark legs, three toes, x 1.6..4.1 / -4.2..-1.5, z 8.3..11.4
//   back   a flame mark low on the back (red rim, yellow core), feathered wing backs
include <lib.scad>
// ground: -1.43   (it hovers over its ground fire: the ground where its old blaze stood, so it floats as high as before)

body = [0.9, 0.43, 0.17];
fluff = [0.99, 0.62, 0.3];
feather = [0.8, 0.3, 0.14];
flameRed = [0.86, 0.2, 0.05, NOGLOW];
flameOr = [0.98, 0.42, 0.06, GLOW];
flameAmber = [0.97, 0.62, 0.06, NOGLOW];
flameYel = [1, 0.8, 0.2, GLOW];
flameCream = [1, 0.9, 0.6, GLOW];
eyeDk = [0.45, 0.1, 0.06];
eyeRed = [0.78, 0.2, 0.08];
pupilC = [0.05, 0.02, 0.02];
ink = [0.1, 0.04, 0.03];
beakC = [0.36, 0.17, 0.1];
leg = [0.2, 0.16, 0.17];

// ---- Body: hull of a wide lower egg and a rounder head top.
LO = [11.2, 10.2, 8.6]; LOC = [0, 0, 19.4];
UP = [9.6, 9.2, 8.6]; UPC = [0, 0, 23.1];
module bodyCore(g = 0) {
  hull() {
    translate(LOC) scale(LO + [g, g, g]) sphere(1, $fn = 40);
    translate(UPC) scale(UP + [g, g, g]) sphere(1, $fn = 40);
  }
}
// Front surface y of one ellipsoid at (x, z); of the body (the hull is a hair fuller than the larger of the two).
function ey(x, z, r, c) = let(q = 1 - pow(x / r[0], 2) - pow((z - c[2]) / r[2], 2)) q > 0 ? -r[1] * sqrt(q) : 0;
function bodyY(x, z) = min(ey(x, z, LO, LOC), ey(x, z, UP, UPC));
// Radius of the body at azimuth a (0 = +X) and height z.
function er(a, z, r, c) = let(q = 1 - pow((z - c[2]) / r[2], 2)) q > 0 ? sqrt(q) / sqrt(pow(cos(a) / r[0], 2) + pow(sin(a) / r[1], 2)) : 0;
function bodyR(a, z) = max(er(a, z, LO, LOC), er(a, z, UP, UPC));

color(body) bodyCore();

// Fluffy outline: soft, low, wide lobes round the lower body (not spikes); the ones on the chest are pale.
module lobeRing(z, n, phase, sz, tilt, out = 0.35) {
  for (i = [0 : n - 1]) let(a = phase + i * 360 / n, k = 0.85 + 0.3 * ((i * 7) % 5) / 4, zz = z + ((i * 3) % 4) * 0.5 - 0.7,
                            rr = bodyR(a, zz) - out)
    color(body) translate([rr * cos(a), rr * sin(a), zz]) rotate([0, 0, a]) rotate([0, tilt, 0])
      scale([sz[0], sz[1] * k, sz[2] * k]) sphere(1, $fn = 14);
}
lobeRing(14.4, 13, 9, [1.2, 3.4, 2.6], 30, 0.8);

// Pale chest feathers, laid flush on the front with the art's zigzag edges.
chestPts = [[-9.8, 18.4], [-8.9, 19.8], [-8.0, 19.4], [-7.0, 20.4], [-6.0, 19.9], [-5.0, 20.8], [-4.0, 20.1], [-3.0, 20.9],
            [-2.0, 20.1], [-1.0, 20.7], [0.0, 19.9], [1.0, 20.4], [2.0, 19.6], [3.1, 20.0], [4.4, 18.6], [3.8, 17.0],
            [2.8, 16.0], [1.8, 16.4], [0.8, 15.4], [-0.4, 15.9], [-1.6, 14.9], [-2.8, 15.6], [-4.0, 14.7], [-5.2, 15.5],
            [-6.4, 14.8], [-7.6, 15.6], [-8.8, 15.4], [-9.8, 16.6]];
color(fluff) intersection() {
  bodyCore(0.28);
  pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true)
    offset(r = 0.35) offset(delta = -0.7) offset(r = 0.35) polygon(chestPts);
  translate([-30, -40, 0]) cube([60, 40, 40]);
}

// ---- Face: two slanted angry eyes under heavy dark brows, a small dark beak.
EX = 4.4; EZ = 25.4; ES = 2.0; EYAW = 15;
EY = bodyY(EX, EZ) + 0.4;
mirror_x() {
  // a round dark-red eye, big black pupil, a highlight
  eye([EX, EY, EZ], ES, iris = eyeRed, sclera = eyeDk, pupil = pupilC, yaw = EYAW, flat = 0.5, shine = true);
  // the art's big black pupil and its cream highlight, over lib's smaller ones
  translate([EX, EY, EZ]) rotate([0, 0, EYAW]) {
    color(pupilC) translate([-ES * 0.08, -ES * 0.55, ES * 0.05]) scale([ES * 0.48, ES * 0.31, ES * 0.6]) sphere(1, $fn = 16);
    color([1, 0.95, 0.82, NOGLOW]) translate([-ES * 0.3, -ES * 0.8, ES * 0.32]) sphere(ES * 0.2, $fn = 10);
  }
  // the art's ink ring round the eye
  color(ink) translate([EX, EY + 0.25, EZ]) rotate([0, 0, EYAW]) scale([ES * 1.15, ES * 0.45, ES * 1.25]) sphere(1, $fn = 20);
  // Brow: a heavy ink bar laid ACROSS the eye's top, low at the nose and rising past the outer corner, so it cuts the
  // round eye into the art's slanted glare.
  color(ink) hull() {
    translate([EX - 2.4, bodyY(EX - 2.4, 25.7) - 0.1, 25.7]) scale([0.55, 0.45, 0.55]) sphere(1, $fn = 10);
    translate([EX - 0.3, EY - ES * 0.5 * 0.85 - 0.15, 26.75]) scale([0.6, 0.45, 0.62]) sphere(1, $fn = 10);
  }
  color(ink) hull() {
    translate([EX - 0.3, EY - ES * 0.5 * 0.85 - 0.15, 26.75]) scale([0.6, 0.45, 0.62]) sphere(1, $fn = 10);
    translate([EX + 2.0, bodyY(EX + 2.0, 27.7) - 0.05, 27.7]) scale([0.5, 0.45, 0.48]) sphere(1, $fn = 10);
  }
}
// Beak: a small round dark beak with a darker hooked tip.
BY = bodyY(0, 23.2);
color(beakC) hull() {
  translate([0, BY + 0.4, 23.4]) scale([1.05, 0.8, 0.9]) sphere(1, $fn = 16);
  translate([0, BY - 0.85, 22.9]) sphere(0.4, $fn = 10);
}
color(leg) translate([0, BY - 0.55, 22.65]) scale([0.5, 0.45, 0.42]) sphere(1, $fn = 10);

// ---- Soft flame tongues: a chain of flattened balls (base fat, tip small but round), never a cone.
// pts: [[x, z, r], ...] in the flame's own plane; dk: depth / width of each ball.
module lick(pts, dk, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate([pts[i][0], 0, pts[i][1]]) scale([1, dk, 1]) sphere(pts[i][2], $fn = 14);
    translate([pts[i + 1][0], 0, pts[i + 1][1]]) scale([1, dk, 1]) sphere(pts[i + 1][2], $fn = 12);
  }
}

// ---- Crest: the flame on the head, in the creature's frontal plane, sheet x stretched by 1/cos(30) so it reads 1:1.
translate([0, 0.6, 0]) scale([1 / cos(VIEW), 1, 1]) {
  // red rim
  lick([[-2.6, 30.6, 1.6], [-0.4, 33.6, 2.6], [1.9, 37.3, 1.3], [2.8, 39.4, 0.45]], 0.6, flameRed);
  lick([[-2.6, 31.2, 1.7], [-4.4, 33.4, 1.3], [-5.2, 35.0, 0.45]], 0.6, flameRed);
  lick([[-2.2, 33.2, 1.6], [-3.3, 36.6, 0.8], [-3.6, 37.8, 0.35]], 0.6, flameRed);
  lick([[-0.9, 33.6, 1.6], [-1.6, 37.2, 0.75], [-1.7, 38.1, 0.35]], 0.6, flameRed);
  lick([[0.6, 33.2, 1.8], [3.4, 34.6, 1.2], [5.3, 35.7, 0.4]], 0.6, flameRed);
  // red filler between the tongues' roots, so the crest reads as one flame with notched tips
  lick([[-3.6, 32.4, 1.6], [-1.2, 34.4, 2.3], [2.4, 35.0, 1.6]], 0.6, flameRed);
  // orange layer
  lick([[-2.5, 31.0, 1.3], [-0.6, 34.0, 2.0], [1.6, 37.0, 0.9]], 1.0, flameOr);
  lick([[-2.8, 31.6, 1.2], [-4.0, 33.8, 0.8]], 1.0, flameOr);
  lick([[0.4, 33.4, 1.4], [3.4, 34.6, 0.8]], 1.0, flameOr);
  // yellow V and cream core
  lick([[-2.6, 31.0, 0.95], [-1.6, 33.4, 1.7], [-0.4, 36.4, 0.75]], 1.3, flameYel);
  lick([[-1.0, 33.4, 1.2], [2.0, 34.8, 0.75]], 1.3, flameYel);
  lick([[-2.3, 31.8, 0.7], [-1.6, 33.4, 1.3], [-0.8, 35.4, 0.5]], 1.85, flameCream);
}

// ---- Wings: stubby feathered paddles held out to the sides, each holding a fireball with tongues rising off it.
// Fireball in its own plane (x out along the wing, z up), turned to face front.
module fireball() {
  lick([[0, 1.0, 2.3], [-1.4, 3.0, 1.1], [-2.1, 4.2, 0.6], [-2.0, 4.9, 0.3]], 0.75, flameAmber);
  lick([[0.2, 1.4, 2.0], [0.2, 4.0, 1.0], [0.6, 5.6, 0.5], [0.3, 6.3, 0.3]], 0.75, flameAmber);
  lick([[0.6, 1.0, 1.8], [1.6, 2.8, 0.8], [2.1, 3.5, 0.3]], 0.75, flameAmber);
  lick([[0, 1.0, 1.95], [0.1, 2.2, 1.4], [0.2, 3.3, 0.6]], 1.0, flameYel);
  lick([[0, 1.0, 1.35], [0.1, 1.8, 1.0]], 1.45, flameCream);
}
mirror_x() {
  // wing paddle
  color(body) hull() {
    translate([8.4, 0.6, 19.6]) scale([3.0, 1.9, 2.8]) sphere(1, $fn = 18);
    translate([12.0, -0.6, 20.4]) scale([2.2, 1.4, 1.8]) sphere(1, $fn = 16);
    translate([14.2, -1.6, 21.0]) scale([1.4, 1.1, 1.2]) sphere(1, $fn = 14);
  }
  // feather fingers along the wing's lower / back edge
  for (k = [0 : 2]) color(k == 1 ? feather : body)
    translate([10.6 + k * 1.5, 0.5 - k * 0.5, 18.4 + k * 0.45]) rotate([0, 28 - k * 8, -12]) scale([2.1, 1.05, 0.95]) sphere(1, $fn = 14);
  // fireball on the wing tip
  translate([14.3, -1.9, 22.0]) rotate([0, 0, 15]) fireball();
}

// ---- Flame mark low on the back (red rim, yellow core), laid flush on the body.
backRed = [[-1.0, 14.0], [1.0, 14.5], [2.2, 15.9], [2.4, 17.7], [1.7, 20.4], [0.6, 18.9], [-0.4, 19.8], [-1.4, 22.0],
           [-2.5, 19.6], [-3.5, 20.8], [-4.1, 18.3], [-3.7, 15.7], [-2.4, 14.4]];
backYel = [[-1.4, 14.9], [0.3, 15.4], [1.0, 16.8], [0.5, 18.7], [-0.6, 17.7], [-1.5, 19.5], [-2.5, 17.6], [-2.7, 15.9]];
color(flameRed) intersection() {
  bodyCore(0.22);
  translate([0, 20, 0]) rotate([90, 0, 0]) linear_extrude(20) polygon(backRed);
}
color(flameYel) intersection() {
  bodyCore(0.36);
  translate([0, 20, 0]) rotate([90, 0, 0]) linear_extrude(20) polygon(backYel);
}

// ---- Short dark legs with three toes, dangling under the body.
mirror_x() {
  limb([3.1, -0.6, 12.0], [3.2, -0.8, 9.9], 0.85, 0.65, leg);
  for (a = [-32, 0, 32]) limb([3.2, -0.8, 9.9], [3.2 + sin(a) * 1.0, -0.8 - cos(a) * 1.0, 8.2], 0.42, 0.3, leg);
}
