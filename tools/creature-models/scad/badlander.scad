// Badlander: Dustcub grown into a hulking outlaw badger. Hunched forward with the head low, turned to its right and
// in near profile under a battered hat tipped over the eyes; a red bandana knotted high at the back-left of the neck;
// a huge shaggy fur mantle over the shoulders; a blue-grey shirt; a bullet bandolier from the left shoulder down
// across the chest to the right hip; leather bracers on both forearms over grey clawed paws hanging low; a belt with
// a square buckle; a holstered gun on the left hip in front, a coil of rope behind it; baggy tan trousers over dark
// spurred boots in a wide stance; a tattered duster cape off the back, blown out to the viewer's right.
//
// Checklist (sheet frame: height 40, feet z = 0; the art's box centre is sheet x 0, the figure's own axis sits at
// sheet x -2.5 and is modelled at scad x = 0 (fs() / ppc() take that off); sheet x ~ 0.866 x + 0.5 y at 30 deg):
//   hat        dark M1 [0.19, 0.15, 0.15]: crown sx -12.4..-3.8 z 35..39.9 leaning forward, lighter band, brim
//              sx -15.9..0.9 tipped forward (front edge z 33, back edge z 36.8)
//   head       dark [0.25, 0.19, 0.18], low and forward of the shoulders, turned 15 deg to its right: sx -13.6..-2.8
//              z 26.8..34; cream [0.77, 0.68, 0.56] long muzzle to the nose (sx -12.7, 29.8, black), cream cheek
//              ruff and chin, a cream blaze up the brow; small dark ear at sx -3.8 z 34; scar on the muzzle
//   eye        one amber slit eye under a heavy brow at sx -8 z 32.1 (the other hidden behind the muzzle)
//   mouth      dark line under the muzzle, a wheat stalk out of its far corner down-left to sx -16 z 27
//   bandana    M2 red [0.47, 0.17, 0.20]: band high round the neck, triangle on the chest sx -10..-1.6 z 28 to the
//              tip (-6.5, 21.5); knot at the back-left of the neck sx 0..3.3 z 33..36 with two flaps up to the right
//   mantle     shaggy dark grey-brown fur [0.23, 0.21, 0.21] over both shoulders sx -15..12.6 z 20..33, pointed
//              tufts hanging to z 18 over the chest and the near arm; blue-grey highlights
//   shirt      blue-grey [0.25, 0.27, 0.30]: upper arms (near sx 5.2..11.6 z 21..28, far sx -16..-10.5 z 19..24)
//              and the ragged shirt tail over the belt at the lower front sx -6.5..-1.6 z 10.5..18
//   bandolier  leather [0.40, 0.33, 0.27] strap from the near shoulder (5, 31.5) across the chest to the far hip
//              (-10.5, 19) with cream cartridges; a thinner strap from the buckle up the chest; on the back the two
//              straps cross in an X
//   belt       leather z 12.5..15.5 sx -10.5..3.9, square tan buckle at sx -6.5..-3.4 z 12.6..15.1
//   arms       near (viewer's right): bracer [0.48, 0.35, 0.27] sx 4..10 z 16.3..22.8, grey paw [0.43, 0.41, 0.39]
//              sx 0.2..7 z 12.6..19.4 in front of the hip with four long cream claws down-left; far (viewer's left):
//              bracer sx -17.9..-13 z 16.3..20.6, paw sx -18.2..-13.6 z 9.8..16.6, claws straight down
//   holster    leather on the near hip sx 3.3..8.2 z 9.5..16.6 behind the paw, a bone grip sticking up at (6.7, 16)
//   lasso      olive rope loops on the near hip behind the holster sx 7.9..13.2 z 4.6..15
//   legs       tan trousers [0.53, 0.43, 0.33] sx -12.4..7 z 4..13, baggy; boots [0.17, 0.13, 0.13]: far boot
//              sx -14.5..-6.5 toe left with a steel spur at the heel, near boot sx 3.3..10.1 toe right
//   cape       tattered brown duster [0.40, 0.33, 0.27] off the back down to z 5, grey patches, its right edge
//              blown out to sx 18.2 z 12..21 (a flat tattered fin behind the near arm)
//   back       the cape fills the back, the mantle and the crossed straps over it, the knot's flaps at the left, the
//              far arm hanging at the right, the lasso at the left hip. The back art puts the holster on the other
//              hip; the front view wins.
//   glow       nothing glows (the sheet lists no GLOWS; NOGLOW on the amber eye)
include <lib.scad>

furDk = [0.25, 0.19, 0.18];
hat = [0.19, 0.15, 0.15];
hatBand = [0.37, 0.33, 0.30];
mantle = [0.23, 0.21, 0.21];
mantleHi = [0.30, 0.31, 0.33];
shirt = [0.25, 0.27, 0.30];
cream = [0.77, 0.68, 0.56];
leather = [0.40, 0.33, 0.27];
bracer = [0.48, 0.35, 0.27];
belt = [0.53, 0.43, 0.33];
pants = [0.53, 0.43, 0.33];
boot = [0.17, 0.13, 0.13];
paw = [0.43, 0.41, 0.39];
claw = [0.64, 0.58, 0.50];
red = [0.47, 0.17, 0.20, NOGLOW];
rope = [0.56, 0.50, 0.38];
patch = [0.43, 0.41, 0.39];
steel = [0.52, 0.47, 0.43];
amber = [0.93, 0.58, 0.18, NOGLOW];
black = [0.08, 0.05, 0.05];
scar = [0.62, 0.27, 0.27];

SX0 = -2.5;
function fs(sx, z, y = 0) = fromSheet(sx - SX0, z, y);
module ppc(d = 0) { pp(d) translate([-SX0, 0, 0]) children(); }

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

// ---- legs: baggy trousers in a wide stance, dark boots with spurs
limb([-4.5, -1.0, 12.5], [-8.7, -4.0, 6.0], 3.9, 3.2, pants);
limb([4.5, -0.5, 12.5], [8.1, -1.0, 6.0], 3.9, 3.2, pants);
module outlawBoot(ankle, toe, heel, spurAt) {
  blob([[[2.5, 2.5, 2.5], ankle], [[2.2, 2.0, 2.0], toe], [[2.2, 2.2, 2.2], heel]], boot);
  color(boot) translate(ankle + [0, 0, 2.6]) scale([3.5, 3.3, 1]) cylinder(h = 1.8, r = 1, center = true, $fn = 20);
  color(steel) translate(ankle + [0, 0, 0.6]) scale([2.65, 2.65, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 20);
  color(steel) translate(spurAt) rotate([90, 0, 30]) cylinder(h = 0.5, r = 1.2, center = true, $fn = 6);
}
outlawBoot([-8.7, -4.0, 2.5], [-10.6, -6.4, 2.1], [-6.0, -2.4, 2.3], [-3.6, -1.2, 3.6]);
outlawBoot([8.1, -1.0, 2.5], [13.4, 0.6, 2.0], [6.5, -1.6, 2.3], [5.0, -2.2, 3.6]);

// ---- torso: hunched; pelvis to a chest leaning forward, in the blue-grey shirt
blob([[[8.0, 6.5, 3.5], [0, 0, 14.5]], [[9.6, 7.2, 5.0], [0, -2.0, 26]]], shirt);
// the ragged shirt tail hanging over the belt at the lower front
for (a = [-30 : 12 : 6]) spike([7.6 * sin(a), -6.4 * cos(a), 16.5], [0.4 * sin(a), -0.3, -5.0], 1.0, 0.15, shirt);

// ---- belt and buckle
color(belt) translate([0, -0.2, 14.2]) scale([8.5, 6.9, 1]) cylinder(h = 2.8, r = 1, center = true, $fn = 36);
color(claw) translate([1.2, -7.0, 14.2]) rotate([0, 0, 8]) difference() {
  cube([3.0, 0.9, 2.6], center = true);
  cube([2.0, 1.2, 1.6], center = true);
}
color(leather) translate([1.2, -7.1, 14.2]) rotate([0, 0, 8]) cube([0.5, 0.8, 1.6], center = true);

// ---- bandolier: a wide leather strap down across the chest with cream cartridges, and a thin strap up from the
// buckle to the near shoulder
bandPts = [[9.2, -3.4, 31.5], [6.9, -6.5, 27.5], [2.5, -8.3, 24], [-2.4, -7.8, 21], [-5.6, -5.8, 18.5], [-7.2, -3.6, 16.5]];
chain(bandPts, [1.3, 1.3, 1.3, 1.3, 1.2, 1.1], leather);
for (i = [0 : 3]) for (t = [0.2, 0.6]) {
  p = bandPts[i] + (bandPts[i + 1] - bandPts[i]) * t;
  d = bandPts[i + 1] - bandPts[i];
  n = [d[1], -d[0], 0] / norm([d[0], d[1], 0]);
  color(cream) translate(p + n * 0.9) rotate(_dir_rot([-d[2] * 0.3, 0.1, 1])) cylinder(h = 2.6, r = 0.45, center = true, $fn = 8);
}
chain([[1.2, -7.0, 15.5], [2.6, -8.4, 21.5], [5.8, -6.6, 27.5], [8.5, -3.8, 31]], [0.6, 0.6, 0.6, 0.6], leather);

// ---- mantle: a shaggy fur cape over both shoulders, pointed tufts hanging from its edge
color(mantle) intersection() {
  translate([0.5, 2.5, 28.3]) scale([15.2, 7.8, 5.6]) sphere(1, $fn = 36);
  translate([0, 0, 24.3 + 20]) cube(40, center = true);
}
for (a = [-70 : 20 : 250]) {
  k = (a + 70) / 20;
  color(k % 3 == 1 ? mantleHi : mantle)
    spike([0.5 + 14.6 * sin(a), 2.5 - 7.4 * cos(a), 24.8], [1.4 * sin(a), -0.7 * cos(a), -(3.2 + 1.6 * (k % 2))], 1.25, 0.1, mantle);
}
// crossed leather straps over the back of the mantle, a ring where they meet
for (s = [-1, 1]) color(leather) translate([0, 9.6, 27.5]) rotate([-8, 0, 0]) rotate([0, s * 38, 0]) cube([17, 1.0, 1.7], center = true);
color(claw) translate([0, 10.3, 27.5]) rotate([90, 0, 0]) difference() { cylinder(h = 0.6, r = 1.3, center = true, $fn = 12); cylinder(h = 1, r = 0.7, center = true, $fn = 12); }

// ---- near arm (+X, viewer's right): blue sleeve, leather bracer, grey paw hanging in front of the hip
limb([11.5, -1.0, 28.0], [13.5, -3.5, 21.5], 3.3, 3.0, shirt);
limb([13.5, -3.5, 21.5], [12.7, -8.5, 16.5], 3.1, 2.6, bracer);
for (z = [17.8, 20.4]) color(leather) translate([13.3 - (z - 17.8) * 0.3, -8.4 + (z - 17.8) * 1.9, z]) rotate([44, 0, 0]) scale([1.04, 1.04, 1]) cylinder(h = 0.7, r = 2.7 + (z - 17.8) * 0.12, center = true, $fn = 16);
ell([2.8, 2.5, 2.6], [12.5, -9.5, 15.5], paw);
for (k = [0 : 3]) spike([10.6 + k * 0.9, -11.0 + k * 0.3, 15.2 - k * 0.3], [-1.2, -0.5, -2.8], 0.5, 0.05, claw);
// ---- far arm (-X, viewer's left): hanging straight down, claws to the ground
limb([-12.5, 0.5, 27.0], [-10.4, -4.0, 20.0], 3.3, 3.0, shirt);
limb([-10.4, -4.0, 20.0], [-11.5, -6.5, 16.0], 3.0, 2.6, bracer);
for (z = [17.2, 19.2]) color(leather) translate([-11.0, -5.4 + (z - 17.2) * 0.4, z]) rotate([10, 0, 0]) scale([1.04, 1.04, 1]) cylinder(h = 0.7, r = 2.7 + (z - 17.2) * 0.12, center = true, $fn = 16);
ell([2.7, 2.5, 2.6], [-11.4, -7.0, 13.6], paw);
for (k = [0 : 3]) spike([-13.3 + k * 1.3, -8.4 - k * 0.2, 12.4], [-0.1 * (k - 1.5), -0.3, -3.0], 0.5, 0.05, claw);

// ---- holster with a bone grip, on the near hip behind the paw; a coil of rope behind it
blob([[[1.9, 1.4, 1.5], [12.4, -4.6, 15.8]], [[1.7, 1.3, 1.3], [12.0, -5.4, 10.5]]], leather);
limb([12.6, -4.6, 16.4], [14.2, -4.0, 18.6], 0.8, 0.95, cream);
ppc(-2) {
  for (k = [0, 1]) color(rope) translate([13.0 + 0.5 * k, 0.6 * k, 10.5 - 0.4 * k]) rotate([90, 0, 0]) scale([0.6, 1.0, 1]) rotate_extrude($fn = 20) translate([3.6, 0]) circle(0.42, $fn = 8);
  chain([[13.6, 0, 7.5], [14.6, 0.2, 5.8], [14.0, 0.4, 4.6]], [0.4, 0.4, 0.35], rope);
  chain([[12.2, 0.3, 7.2], [11.6, 0.4, 5.4]], [0.4, 0.35], rope);
}

// ---- cape: a tattered duster hanging off the back, grey patches, its right edge blown out behind the near arm
color(leather) difference() {
  hull() { translate([0, 2.5, 29]) scale([12.5, 8.0, 2.4]) sphere(1, $fn = 32); translate([0, 3.0, 7.5]) scale([13.5, 9.6, 1.2]) sphere(1, $fn = 32); }
  hull() { translate([0, 2.5, 29]) scale([11.8, 7.3, 3.0]) sphere(1, $fn = 32); translate([0, 3.0, 7.5]) scale([12.8, 8.9, 1.8]) sphere(1, $fn = 32); }
  translate([0, -17.5, 18]) cube(40, center = true);
}
function capeY(x, z) = let(f = (29 - z) / 21.5) 2.5 + 0.5 * f + (8.0 + 1.6 * f) * sqrt(max(0, 1 - pow(x / (12.5 + 1.0 * f), 2)));
for (x = [-12 : 2.4 : 12]) color(leather) translate([x, capeY(x, 7.5) - 0.2, 6.5]) scale([1.1, 0.5, 1.8 + (abs(x * 7) % 3)]) rotate([0, 0, 45]) sphere(1, $fn = 4);
for (q = [[4, 14, 3.6, 3.2, 0], [-6, 20, 3.0, 2.8, 15], [8.5, 22, 2.6, 2.4, -30], [-9, 12, 2.4, 2.2, 10]])
  color(patch) translate([q[0], capeY(q[0], q[1]) - 0.1, q[1]]) rotate([-5, 0, q[4]]) cube([q[2], 0.7, q[3]], center = true);
for (x = [-7, -1.5, 4, 9]) color(leather * 0.85) hull() {
  translate([x * 0.9, capeY(x * 0.9, 26) + 0.05, 26]) scale([1.2, 0.5, 1]) sphere(0.4, $fn = 8);
  translate([x, capeY(x, 10) + 0.25, 10]) scale([1.6, 0.5, 1]) sphere(0.6, $fn = 8);
}
ppc(7) plate([[9.5, 24], [14.5, 22.5], [20.2, 19.2], [20.7, 16.5], [17.8, 15.4], [18.6, 13.6], [14.5, 12.4], [12.0, 12.2], [11.0, 14.5], [9.5, 17]], 1.0, 0.5, leather);
ppc(6.4) color(patch) translate([16.5, 0, 17.5]) rotate([90, 0, 0]) cylinder(h = 1.2, r = 1.0, center = true, $fn = 10);

// ---- head: forward of the shoulders, turned 15 deg to its right. Everything inside is in the head's own frame.
translate([-0.6, -9.0, 30.3]) rotate([0, 0, -15]) {
  ell([5.5, 6.5, 4.8], [0, 0, 0], furDk);
  // cream muzzle, cheek ruff, chin and brow blaze
  blob([[[3.8, 3.2, 3.0], [0, -4.0, -0.6]], [[2.3, 1.8, 2.1], [0, -7.8, -0.4]]], cream);
  mirror_x() ell([3.0, 2.6, 2.6], [3.8, -3.6, -1.6], cream);
  ell([1.6, 3.5, 2.2], [0, -3.5, 2.4], cream);
  ell([1.15, 0.95, 0.95], [-0.3, -9.0, -0.3], black);
  // mouth line, scar, wheat stalk out of the far corner of the mouth
  color(black) translate([1.6, -7.6, -2.3]) rotate([0, 0, -25]) scale([2.0, 0.45, 0.3]) sphere(1, $fn = 10);
  for (k = [0, 1]) color(scar) translate([-1.6 + k * 0.5, -6.6 - k * 0.6, 0.6]) rotate([0, 55, -20]) scale([0.22, 0.3, 1.1]) sphere(1, $fn = 6);
  limb([-1.6, -8.4, -2.0], [-3.2, -8.8, -2.8], 0.28, 0.28, claw);
  for (t = [0.55, 0.78, 1.0]) ell([0.55, 0.45, 0.4], [-1.6, -8.4, -2.0] + t * [-1.6, -0.4, -0.8], claw);
  // the amber slit eyes under heavy brows (the far one hides behind the muzzle)
  mirror_x() {
    eye([2.9, -5.0, 1.0], 1.35, iris = [0.80, 0.42, 0.10, NOGLOW], sclera = amber, pupil = black, yaw = 8, lid = 0.5, lid_tilt = 30, lid_c = furDk, slit = 0.35);
    brow([2.9, -5.0, 1.0], 1.35, 0.55, furDk, 8);
    ell([1.3, 0.9, 1.3], [4.6, 0.5, 3.5], furDk);
  }
  // the bandana's band, high round the neck and tipped forward
  color(red) translate([0, 3.5, -1.0]) rotate([22, 0, 0]) scale([6.2, 5.8, 1]) cylinder(h = 2.0, r = 1, center = true, $fn = 28);
  // hat: brim tipped forward over the eyes, curled sides, a leaning creased crown with a lighter band
  translate([0, -0.8, 3.5]) rotate([12, 0, 0]) {
    color(hat) mirror_x() intersection() {
      translate([0, -14, -3]) cube([16, 28, 8]);
      rotate([0, -12, 0]) difference() {
        scale([10.5, 8.8, 1]) cylinder(h = 0.8, r = 1, center = true, $fn = 44);
        scale([4.6, 4.2, 1]) cylinder(h = 2, r = 1, center = true, $fn = 28);
      }
    }
    color(hat) translate([0, 0, 0.2]) scale([5.2, 4.8, 1]) cylinder(h = 1.2, r = 1, center = true, $fn = 28);
    color(hat) hull() {
      translate([0, 0, 0.6]) scale([5.2, 4.8, 1]) cylinder(h = 1, r = 1, $fn = 28);
      translate([0.3, -1.2, 5.4]) scale([4.4, 4.0, 1.4]) sphere(1, $fn = 24);
    }
    color(hatBand) translate([0, 0, 0.8]) scale([5.4, 5.0, 1]) cylinder(h = 1.4, r = 1, $fn = 28);
    color(hatBand * 0.6) translate([0.3, -1.2, 6.3]) rotate([0, 0, 10]) scale([0.7, 3.2, 0.4]) sphere(1, $fn = 12);
  }
}

// ---- bandana: the triangle down the chest, the knot high at the back-left of the neck with two flaps up and out
color(red) hull() {
  translate([0, -7.5, 28.0]) scale([5.0, 1.6, 0.5]) sphere(1, $fn = 16);
  translate([-3.5, -9.0, 27.0]) sphere(0.5, $fn = 8);
  translate([3.0, -10.0, 27.2]) sphere(0.5, $fn = 8);
  translate([1.7, -11.0, 21.5]) sphere(0.5, $fn = 8);
}
knot = [5.5, -2.5, 33.6];
ell([1.5, 1.3, 1.3], knot, red);
limb(knot, [3.0, -3.5, 32.2], 1.1, 1.0, red);
color(red) hull() { translate(knot) sphere(0.9, $fn = 10); translate([9.1, -1.0, 36.3]) sphere(0.3, $fn = 8); translate([9.6, 0.2, 34.8]) sphere(0.3, $fn = 8); }
color(red) hull() { translate(knot) sphere(0.9, $fn = 10); translate([8.4, 0.0, 32.8]) sphere(0.3, $fn = 8); translate([9.2, -0.6, 34.0]) sphere(0.3, $fn = 8); }
