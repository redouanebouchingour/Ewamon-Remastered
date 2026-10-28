// Dustcub: a chubby badger cub playing cowboy. A wide brown hat tipped back, a red bandana knotted at the left of
// the neck, a torn open vest over a cream belly, a belt with an oval buckle, a holster on the right hip, a coil of
// rope on the left hip, dark fur, a cream face with a long muzzle and a wheat stalk in the corner of the mouth, the
// right paw raised palm out, the left fist hanging at the hip, a wide stance in spurred boots.
//
// Checklist (sheet frame: height 40, feet z = 0; the art's box centre is sheet x 0, the figure's own axis sits at
// sheet x 0.8 and is modelled at scad x = 0 (fs() / ppc() take that off); sheet x ~ 0.866 x + 0.5 y at 30 deg):
//   hat        M0 brown [0.40, 0.32, 0.25]: crown sx -4.4..7.3 z 32..40 with a dent on top, band z 33.4..34.8,
//              brim sx -9.6..13.1: tipped back (front edge up at z 35, its underside shows at the left-front, the
//              back droops to z 28.5 behind the right ear), sides curled up
//   head       dark M1 [0.23, 0.17, 0.16] round head sx -6.6..8.5 z 24.3..33 under the brim; cream [0.78, 0.68, 0.53]
//              face: long muzzle to the left (nose at sx -4.8 z 26.9, black), cream cheeks, a blaze up the brow;
//              dark bands from the eyes back to the ears; near ear sx 5.6..8.5 z 29.2..32.2, tan inside
//   eyes       near eye sx 1.2 z 28.9 r 1.2 (dark brown, black pupil, white shine), far eye sx -4.6 z 29.2, small
//   mouth      smile under the muzzle z 25; wheat stalk from the mouth corner (sx -5.2, 25.2) out to (-9.2, 25.8)
//              with grains at the tip; a short stem hanging at (0, 24..22.8)
//   bandana    M2 red [0.60, 0.23, 0.23]: band round the neck z 23..25, triangle from sx -4..8.2 z 23.5 to the tip
//              (3, 16.6); knot at the left of the neck (sx 8, 25.5) with tails to (12.5, 27.5) and (12.4, 25); from
//              the back a tail hangs to z 20
//   torso      round, sx -8..10.7 z 8..24; cream belly in the vest's opening sx -1.2..7.3 z 18.5..7.5
//   vest       M0 [0.45, 0.36, 0.28] open vest over the shoulders and back, ragged hem at z 14.5, lighter patches on
//              the back; the opening faces the camera (sheet x -1..6)
//   belt       leather [0.60, 0.48, 0.37] z 9.6..13; oval tan buckle sx 1..5.8 z 9.8..12.8
//   holster    leather pouch on the right hip (viewer's left) sx -8.9..-4 z 7.8..14.5, dark strap over the top
//   lasso      rope coil on the left hip (viewer's right) sx 8.5..13.7 z 4.4..14.2 with a loose end hanging
//   arms       dark fur: right arm (viewer's left) out and up, paw raised palm to the camera: paw sx -14..-9.2
//              z 18.2..24.6, pink pad, four tan claws along its top; left arm (viewer's right) hanging bent, fist
//              sx 8.2..14 z 15.7..20.5 with its claws on the inner side
//   legs       dark fur, wide stance: far thigh to the boot at sx -11.6..-5.2, near thigh to the boot at sx 5.2..12.5;
//              boots [0.35, 0.27, 0.22] with flared cuffs z 4.5..6, toes out, steel spurs at the heels
//   back       vest over the whole back to the ragged hem (z 14.5), belt under it, dark rump, knot tails on the left,
//              the other ear shows. The back art swaps the holster and the lasso sides; the front view wins.
//   glow       nothing glows (the sheet lists no GLOWS; NOGLOW on the red)
include <lib.scad>

furDk = [0.23, 0.17, 0.16];
cream = [0.78, 0.68, 0.53];
tan = [0.67, 0.58, 0.46];
vest = [0.45, 0.36, 0.28];
vestLt = [0.56, 0.50, 0.43];
hat = [0.40, 0.32, 0.25];
hatDk = [0.33, 0.25, 0.21];
hatBand = [0.50, 0.42, 0.34];
leather = [0.60, 0.48, 0.37];
boot = [0.35, 0.27, 0.22];
red = [0.60, 0.23, 0.23, NOGLOW];
pink = [0.62, 0.36, 0.34];
steel = [0.56, 0.52, 0.48];
black = [0.08, 0.05, 0.05];
eyeBrown = [0.45, 0.30, 0.22];

// The figure's axis on the sheet: positions read off the sheet go through these so the model's axis is x = 0.
SX0 = 0.8;
function fs(sx, z, y = 0) = fromSheet(sx - SX0, z, y);
module ppc(d = 0) { pp(d) translate([-SX0, 0, 0]) children(); }
module prismc(pts) { ppc(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) polygon(pts); }

// ---- legs: a wide stance, the far (right, -X) foot forward-left, the near (left, +X) foot out to the side
limb([4.6, 0.2, 10.0], [9.0, 0.8, 5.0], 3.3, 3.0, furDk);
limb([-4.6, 0.2, 10.0], [-8.1, -2.0, 5.0], 3.3, 3.0, furDk);

// ---- boots: a rounded foot, a flared cuff, a dark ankle strap and a steel spur at the heel
module cowboyBoot(ankle, toe, heel, spurAt) {
  blob([[[2.3, 2.3, 2.3], ankle], [[2.0, 1.9, 1.9], toe], [[2.0, 2.0, 2.0], heel]], boot);
  color(boot) translate(ankle + [0, 0, 2.7]) scale([3.3, 3.1, 1]) cylinder(h = 1.6, r = 1, center = true, $fn = 20);
  color(black) translate(ankle + [0, 0, 0.5]) scale([2.45, 2.45, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 20);
  color(steel) translate(spurAt) rotate([90, 0, 30]) cylinder(h = 0.5, r = 1.1, center = true, $fn = 6);
}
cowboyBoot([9.0, 0.8, 2.3], [11.2, 1.6, 1.9], [8.0, 0.3, 2.0], [6.4, -0.5, 2.6]);
cowboyBoot([-8.1, -2.0, 2.3], [-9.6, -4.6, 1.9], [-7.0, -1.0, 2.0], [-6.3, 0.0, 1.5]);

// ---- torso: a round dark-furred body, the belly cream where the vest hangs open (towards the camera, azimuth 45)
tc = [0, 0, 15.6];
tr = [8.6, 7.6, 8.4];
ell(tr, tc, furDk);
// the cream belly: the art's patch cut flush onto the torso's front (the prism through the sheet outline)
color(cream) intersection() {
  translate(tc) scale(tr + [0.35, 0.35, 0.35]) sphere(1, $fn = 36);
  translate([0, -30, 0]) cube(60, center = true);
  prismc([[-1.0, 18.8], [7.2, 18.8], [7.6, 15], [7.0, 11], [6.0, 7.3], [-0.5, 7.0], [-1.8, 10], [-1.8, 15]]);
}

// ---- vest: a shell round the torso, open at the front-left (the camera side), cut at the shoulders and the hem
color(vest) difference() {
  translate(tc) scale(tr + [0.9, 0.9, 0.6]) sphere(1, $fn = 36);
  translate(tc) scale(tr + [0.1, 0.1, 0.1]) sphere(1, $fn = 36);
  translate([0, 0, 24.2 + 30]) cube(60, center = true);
  translate([0, 0, 14.6 - 30]) cube(60, center = true);
  rotate([0, 0, 45]) translate([-4.6, -20, 0]) cube([9.2, 20, 60]);
}
// ragged hem: tatters hanging under the vest's edge, none across the opening
for (a = [0 : 24 : 336]) if (a < 15 || a > 75)
  spike([9.1 * sin(a), -8.0 * cos(a), 14.7], [0, 0, -1.7], 0.9, 0.1, vest);
// lighter patches sewn on the back
for (q = [[160, 17.0, 3.0, 2.6], [205, 18.5, 2.4, 2.2], [185, 15.6, 1.8, 1.6]])
  color(vestLt) translate([9.4 * sin(q[0]), -8.3 * cos(q[0]), q[1]]) rotate([0, 0, -q[0]]) cube([q[2], 0.7, q[3]], center = true);

// ---- belt and buckle (the buckle on the camera side, azimuth 45)
color(leather) translate([0, 0, 11.3]) scale([7.9, 7.0, 1]) cylinder(h = 2.8, r = 1, center = true, $fn = 36);
translate([5.6, -4.95, 11.3]) rotate([0, 0, 45]) rotate([90, 0, 0]) {
  color(tan) difference() {
    scale([2.3, 1.45, 1]) cylinder(h = 0.9, r = 1, center = true, $fn = 20);
    scale([1.5, 0.8, 1]) cylinder(h = 1.2, r = 1, center = true, $fn = 16);
  }
  color(boot) scale([1.5, 0.8, 1]) cylinder(h = 0.4, r = 1, center = true, $fn = 16);
  color(tan) cube([0.5, 1.7, 0.9], center = true);
}

// ---- holster on the right hip (viewer's left), a dark strap over its top
blob([[[1.9, 1.3, 1.6], [-6.3, -3.4, 13.0]], [[2.0, 1.4, 1.6], [-7.4, -4.4, 9.2]]], leather);
limb([-4.0, -5.6, 14.4], [-7.6, -2.0, 15.2], 0.6, 0.6, furDk);

// ---- lasso: a coil of rope hanging off the left hip (viewer's right), a loose end dangling
ppc(-7.5) {
  for (k = [0, 1]) color(k == 0 ? leather : tan) translate([10.4 + 0.4 * k, 0.5 * k, 9.8 - 0.3 * k])
    rotate([90, 0, 0]) scale([0.85, 1.1, 1]) rotate_extrude($fn = 24) translate([2.7, 0]) circle(0.5, $fn = 8);
  chain([[12.3, 0, 7.2], [12.6, 0.2, 5.4], [12.0, 0.4, 3.8]], [0.45, 0.45, 0.4], leather);
}

// ---- arms. Left arm (+X, viewer's right) hangs bent with the fist at the hip, claws curled on its inner side
limb([7.6, -0.4, 21.6], [11.6, 1.2, 20.3], 2.5, 2.4, furDk);
ell([2.9, 2.7, 2.8], [11.3, 1.4, 18.2], furDk);
for (k = [0 : 3]) spike([9.2 - 0.2 * k, -1.0 - 0.3 * k, 20.6 - 0.6 * k], [-1.0, -0.8, -0.5], 0.42, 0.05, tan);
// Right arm (-X, viewer's left) out and up, the paw raised with its palm (pink pad) to the camera and four claws
// along its top
limb([-7.4, -0.6, 21.0], [-10.2, -3.2, 19.8], 2.5, 2.4, furDk);
paw = [-11.7, -4.5, 21.4];
ell([2.5, 2.3, 2.7], paw, furDk);
color(pink) translate(paw + 2.1 * [0.5, -0.866, 0]) rotate([0, 0, 30]) scale([1.3, 0.5, 1.3]) sphere(1, $fn = 14);
for (th = [135, 108, 80, 52]) {
  d = cos(th) * [0.866, 0.5, 0] + sin(th) * [0, 0, 1];
  spike(paw + 2.3 * d, 1.2 * d, 0.45, 0.05, tan);
}

// ---- head: dark fur, a cream face with a long muzzle, badger bands through the eyes to the ears
hc = [0, -0.8, 28.8];
ell([7.8, 6.2, 5.0], hc, furDk);
// the cream face: one wedge from the cheeks to the snout tip
blob([[[6.6, 4.4, 3.9], [0, -2.8, 27.5]], [[2.8, 2.4, 2.1], [0.4, -8.2, 26.9]], [[1.9, 1.5, 1.7], [0.5, -10.6, 27.0]]], cream);
ell([1.0, 0.8, 0.75], [1.3, -11.6, 27.1], black);
// the near cheek's fluff of cream fur under the eye band
ell([2.4, 2.0, 2.2], [6.6, -2.6, 27.0], cream);
// smile under the muzzle, towards the near cheek
color(black) translate([2.5, -9.5, 25.1]) rotate([0, 0, -30]) scale([2.2, 0.35, 0.3]) sphere(1, $fn = 10);
// eye bands, then the eyes in them
mirror_x() chain([[4.3, -4.6, 29.7], [5.8, -3.3, 30.2], [6.9, -1.6, 30.6]], [1.35, 1.3, 1.2], furDk);
mirror_x() eye([3.35, -6.0, 28.9], 1.45, iris = [0.22, 0.12, 0.08], sclera = eyeBrown, pupil = black, yaw = 22);
// ears, tan inside
mirror_x() { ell([1.7, 1.1, 1.7], [6.6, 0.3, 31.0], furDk); ell([1.0, 0.6, 1.0], [6.9, -0.4, 31.0], tan); }
// wheat stalk out of the far corner of the mouth, grains at its tip; a short stem hanging from the near corner
limb([-1.0, -11.0, 25.6], [-4.2, -13.5, 26.2], 0.3, 0.3, tan);
for (t = [0.62, 0.8, 0.98]) ell([0.55, 0.45, 0.4], [-1.0, -11.0, 25.6] + t * [-3.2, -2.5, 0.6], tan);
limb([4.2, -10.2, 24.8], [4.4, -10.6, 23.0], 0.25, 0.22, tan);

// ---- bandana: the band round the neck, the triangle draped down the chest (camera side), the knot at the left
color(red) translate([0, -0.6, 24.0]) scale([6.0, 5.4, 1]) cylinder(h = 1.8, r = 1, center = true, $fn = 28);
color(red) hull() {
  intersection() {
    translate([0, -0.6, 24.0]) scale([6.2, 5.6, 1]) cylinder(h = 0.8, r = 1, center = true, $fn = 28);
    rotate([0, 0, 45]) translate([-10, -20, 20]) cube([20, 20, 10]);
  }
  translate([6.4, -6.2, 16.6]) sphere(0.5, $fn = 10);
}
knot = [7.2, 1.8, 25.6];
ell([1.5, 1.3, 1.3], knot, red);
limb(knot, [5.0, 1.0, 24.0], 1.2, 1.0, red);
// two flat flaps flying out to the left and one hanging down the back
color(red) hull() { translate(knot) sphere(0.9, $fn = 10); translate([11.5, 3.0, 28.2]) sphere(0.3, $fn = 8); translate([11.8, 4.2, 26.6]) sphere(0.3, $fn = 8); }
color(red) hull() { translate(knot) sphere(0.9, $fn = 10); translate([11.4, 5.0, 24.8]) sphere(0.3, $fn = 8); translate([10.6, 5.6, 23.4]) sphere(0.3, $fn = 8); }
color(red) hull() { translate(knot) sphere(0.8, $fn = 10); translate([7.4, 5.4, 20.6]) sphere(0.3, $fn = 8); translate([8.8, 5.0, 21.4]) sphere(0.3, $fn = 8); }

// ---- hat: a wide brim with curled sides, tipped back 16 degrees; a creased crown with a band
translate([0.7, 0.3, 32.6]) rotate([-18, 0, 0]) {
  // brim: two halves, each tipped up towards its edge
  color(hat) mirror_x() intersection() {
    translate([0, -14, -3]) cube([16, 28, 8]);
    rotate([0, -14, 0]) difference() {
      scale([11.6, 9.8, 1]) cylinder(h = 0.8, r = 1, center = true, $fn = 44);
      scale([5.0, 4.6, 1]) cylinder(h = 2, r = 1, center = true, $fn = 28);
    }
  }
  color(hat) translate([0, 0, 0.2]) scale([5.8, 5.4, 1]) cylinder(h = 1.2, r = 1, center = true, $fn = 28);
  // crown: a rounded truncated cone
  color(hat) hull() {
    translate([0, 0, 0.6]) scale([5.8, 5.4, 1]) cylinder(h = 1, r = 1, $fn = 28);
    translate([0, 0, 6.3]) scale([5.1, 4.6, 1.3]) sphere(1, $fn = 24);
  }
  // band and the pinch dent on top
  color(hatBand) translate([0, 0, 0.8]) scale([6.0, 5.6, 1]) cylinder(h = 1.6, r = 1, $fn = 28);
  color(hatDk) translate([2.4, -2.2, 6.9]) rotate([0, 20, 20]) scale([2.2, 1.5, 0.6]) sphere(1, $fn = 14);
  color(hatDk) translate([0, 0, 7.5]) rotate([0, 0, 10]) scale([0.7, 3.6, 0.4]) sphere(1, $fn = 12);
}
