// Bramblecub: a mossy green bear cub crouched to pounce, a huge round head with leaf ears and a twig crown, one paw
// raised, a curling bark-wrapped vine tail that ends in a leaf.
// Modelled straight off .cache/measure/bramblecub (front 58.3 x 40 units, feet z = 0, art centre x = 0).
//
// Checklist (sheet x, z; art colours):
//   body plan: a crouching quadruped seen side-on: the big head at the front-left, the low body behind it to the
//     right, the tail curling up at the far right. Torso faces -Y, the head is turned to the creature's right (-X)
//     and back towards the camera so the face reads; the tail swings out to +X.
//   head       x -24..5, z 14..35       green (M0 #578d28) with yellow-green moss patches on the crown (x -18..-6,
//              z 27..31), a dark moss tuft fringe; huge and round.
//   muzzle     x -20.8..-0.7, z 14..23  cream (#eee6bb) cheeks and muzzle, wide; brown nose (-13.5, 20.5), a dark
//              mouth line under it, brown freckle dots at z 16..17.
//   eyes       far (-17.7, 23.3), near (-5.8, 22.9), each ~5.6 x 6.6: black with a brown lower iris and a white
//              catchlight at the upper left; a green brow cuts the inner top corner (a determined look).
//   ears       far x -27..-17 z 28..38.5, near x -0.5..10 z 27..37.3: big flat leaves, the tip at the outer top,
//              a brown patch at the inner base.
//   twigs      x -16.6..-1.8, z 32..39   a brown crown of forked twigs on the head between the ears.
//   torso      x -5..16, z 2..22         green, lighter moss patches on the shoulder (x 0..10, z 11..17).
//   near arm   shoulder (8, 17) down-left to the paw at (-1, 9): thick green, three brown claws pointing left.
//   far arm    raised forward: green wrist with a brown bark patch (-22, 15.5), cream paw (-24..-19, 11.5..16),
//              brown claws at the far left (-29..-25, 10..16).
//   belly      x -15..-2, z 4..11       cream under the chest, between the front legs.
//   feet       far front foot cream x -20..-12.6 z 2.3..6; near hind foot cream x 3.3..12.8 z 0.9..6.
//   tail       from the rump (16, 9) up in an S: (17.6, 12) (16.2, 18) (16.5, 22.5) (19.5, 24.6) (22.8, 22) to a
//              green bud (23.5, 19); brown bark wraps at (18.4, 13.5), (16.5, 19), the top arc (19.5..23, 22..25);
//              a big leaf from (22, 25) to the tip (29, 29.5).
//   back       back of the head a big pale-green patch; a brown bark band across the back (z 10..19); a cream rump
//              (z 1..13); the leaf ears and the twig crown; the tail curling out to the creature's +X.
//   glow       none in the sprite: NOGLOW on the light colours.
include <lib.scad>

green = [0.34, 0.55, 0.16];
greenDk = [0.24, 0.45, 0.12];
greenLt = [0.60, 0.73, 0.30, NOGLOW];
moss = [0.65, 0.79, 0.11, NOGLOW];
cream = [0.95, 0.92, 0.75, NOGLOW];
bark = [0.42, 0.29, 0.17];
barkLt = [0.58, 0.42, 0.26];
mask = [0.04, 0.12, 0.05];
eyeBlk = [0.03, 0.03, 0.02];
iris = [0.36, 0.22, 0.12];

// ---- torso: low, a chest under the head and a rump behind, a little swung to -X at the front.
module torso(g = 0) {
  hull() {
    translate([-3, -6, 10.5]) scale([8.5 + g, 8 + g, 8.5 + g]) sphere(1, $fn = 32);
    translate([0, 3, 12.5]) scale([8.5 + g, 8 + g, 9.5 + g]) sphere(1, $fn = 32);
    translate([1.5, 12, 10]) scale([8 + g, 8 + g, 9 + g]) sphere(1, $fn = 32);
  }
}
color(green) torso();
module frontHalf(y = 0) { translate([-60, y - 120, -10]) cube([120, 120, 80]); }
// Cream belly under the chest, between the front legs.
bellyPts = [[-15, 10.7], [-12.5, 10.6], [-9.5, 10.2], [-5.7, 11], [-4.5, 8.2], [-2, 5.7], [-2, 4.9], [-3.5, 3.8], [-7, 3.8], [-9.5, 5.6], [-12, 6], [-14.2, 8.3]];
color(cream) intersection() { torso(0.3); prism(bellyPts); frontHalf(0); }
// Moss patches on the shoulder and flank.
color(greenLt) intersection() { torso(0.3); prism([[1, 16], [6, 17.5], [10.5, 15.5], [9, 12], [4, 11.5], [0.5, 13]]); frontHalf(4); }
color(moss) intersection() { torso(0.35); prism([[10.5, 10.5], [13.5, 11], [14, 8], [11.5, 6.5], [10, 8]]); frontHalf(10); }
// Back: a brown bark band over the back of the rump, the cream rump under it.
color(bark) intersection() { torso(0.3); translate([-20, 16.5, 10.5]) cube([40, 20, 9]); }
color(cream) intersection() { torso(0.3); translate([-20, 16.5, 0.5]) cube([40, 20, 10]); }
color(bark) intersection() { torso(0.3); translate([-20, 8, 18.5]) cube([40, 20, 6]); }

// ---- head: huge and round, centred on the sheet at (-10, 24.5), turned 19 degrees back towards the camera.
H = [-6.9, -8, 24.5];
HYAW = 19;
module headT() { translate(H) rotate([0, 0, HYAW]) children(); }
module headShape(g = 0) {
  scale([14 + g, 10 + g, 10.5 + g]) sphere(1, $fn = 40);
  // Fluffy cheeks and muzzle.
  hull() mirror_x() translate([5, -6.3, -5.2]) scale([6.5 + g, 4 + g, 4.5 + g]) sphere(1, $fn = 24);
}
headT() color(green) headShape();
// Cream muzzle and cheeks: the art's outline laid on the front of the head.
muzzlePts = [[-20.8, 21.5], [-15.5, 21.8], [-11, 23], [-9, 21], [-3, 20.5], [-0.5, 20.3], [-0.5, 18.4], [-2.5, 17.5], [-4, 15.5], [-7.5, 14.3], [-10, 13.8], [-12.5, 13.8], [-15.5, 15.2], [-18.5, 16.3], [-20.8, 18.3]];
color(cream) intersection() { headT() headShape(0.3); prism(muzzlePts); headT() frontHalf(-3); }
// Moss on the crown.
color(moss) intersection() { headT() headShape(0.3); prism([[-18, 29], [-14, 31], [-9, 31.2], [-6, 30], [-8, 28], [-13, 27.5], [-16.5, 27.5]]); headT() frontHalf(0); }
color(greenLt) intersection() { headT() headShape(0.3); prism([[-5, 29.5], [-1, 30.5], [2, 29.5], [0, 27.5], [-4, 27.5]]); headT() frontHalf(0); }
// Back of the head: a big pale-green patch.
color(greenLt) intersection() { headT() headShape(0.3); headT() translate([-30, 3, -2.5]) cube([60, 30, 10]); }
headT() {
  // Nose, mouth line and freckles.
  color(bark) translate([-1.2, -10.4, -3.9]) scale([1.7, 1.0, 1.1]) sphere(1, $fn = 14);
  color(eyeBlk) hull() { translate([-1.0, -10.6, -5.0]) sphere(0.35, $fn = 8); translate([-0.6, -10.5, -6.0]) sphere(0.3, $fn = 8); }
  for (f = [[-3.5, -10.0, -7.2], [-1.6, -10.4, -7.4], [1.2, -10.4, -7.6], [3.4, -10.0, -7.2]])
    color(bark) translate(f) scale([0.45, 0.3, 0.4]) sphere(1, $fn = 8);
  // Eyes: big, black with a brown lower iris and a catchlight; a dark moss socket; a green brow over the inner top.
  mirror_x() {
    color(mask) translate([6, -8.2, -1.2]) rotate([0, 0, 18]) scale([3.1, 1.6, 3.5]) sphere(1, $fn = 20);
    translate([6, -8.6, -1.4]) rotate([0, 0, 18]) {
      color(eyeBlk) scale([2.7, 1.1, 3.1]) sphere(1, $fn = 20);
      color(iris) translate([0, -0.55, -1.2]) scale([2.0, 0.7, 1.4]) sphere(1, $fn = 16);
      color("white") translate([-0.7, -1.05, 1.0]) scale([0.55, 0.3, 0.5]) sphere(1, $fn = 10);
    }
    // Brow: the green forehead drops over the inner top corner of the eye.
    color(green) translate([3.6, -8.6, 1.5]) rotate([0, 0, 18]) rotate([0, -28, 0]) scale([2.8, 1.5, 1.1]) sphere(1, $fn = 14);
  }
}

// ---- ears: big flat leaves in the picture plane, a brown patch at the inner base.
farEar = [[-26.4, 38.3], [-22, 37], [-18.5, 35.5], [-17, 33], [-17.5, 30.5], [-19.5, 29], [-22.5, 28.5], [-24.5, 29.5], [-26, 31.5], [-26.8, 34.5]];
nearEar = [[0.5, 36], [3, 37.3], [9.6, 37.5], [9.9, 33], [9.5, 30.5], [7, 28], [4, 27], [1.5, 27.5], [0, 29.5], [-0.5, 33]];
pp(-2.5) {
  plate(farEar, 1.8, 0.8, green);
  plate(nearEar, 1.8, 0.8, green);
  // Lighter vein halves.
  translate([0, -0.2, 0]) plate([[-26, 37.6], [-22, 36.4], [-19, 34.5], [-22.5, 33.5], [-25.5, 33.5]], 1.8, 0.4, greenLt, grow = 0);
  translate([0, -0.2, 0]) plate([[3.5, 36.8], [9, 36.8], [9.3, 33.5], [6.5, 33.5], [4, 34.5]], 1.8, 0.4, greenLt, grow = 0);
  translate([0, -0.3, 0]) plate([[-22.2, 32.7], [-21.1, 32.2], [-20.8, 29.8], [-21.6, 29], [-22.9, 29], [-23.2, 30.1], [-23.2, 32.2]], 1.8, 0.4, bark);
  translate([0, -0.3, 0]) plate([[2.7, 32.5], [4.6, 32.2], [4.6, 29.3], [2.7, 27.4], [2, 27.4], [2, 29], [0.9, 29.8], [1.2, 31.1]], 1.8, 0.4, bark);
}
// ---- twig crown: the art's brown twigs, standing on the head between the ears.
twigPts = [[-13.7, 39.1], [-11.8, 38.5], [-11.8, 37.7], [-12.6, 37.7], [-13.7, 36.7], [-12.6, 36.4], [-12.4, 35.4], [-11.3, 36.2], [-10, 36.2], [-9.4, 35.1], [-7.8, 35.1], [-7.3, 37], [-8.1, 37.2], [-8.1, 38.3], [-6, 37.5], [-5.7, 38.8], [-4.1, 39.1], [-4.4, 38.5], [-3.6, 38.3], [-3.6, 37.5], [-4.9, 37.2], [-5.5, 36.4], [-2.5, 35.9], [-1.8, 35.1], [-5.2, 34.8], [-6.3, 34.3], [-7.6, 32.5], [-9.7, 34.8], [-11.6, 34.8], [-13.7, 32.2], [-14.2, 34.6], [-15, 35.4], [-16.6, 37.5], [-16.3, 38.8], [-15.3, 38.8], [-14.2, 37.5]];
pp(-3.5) plate(twigPts, 2.0, 0.2, bark, grow = 0.3);

// ---- near arm: thick, from the shoulder down and forward to a paw on the ground with three brown claws.
limb([6, -2, 15], [5.5, -9, 9], 3.6, 3.0, green);
color(green) translate([5.2, -11, 7.6]) scale([3.3, 3.4, 2.6]) sphere(1, $fn = 20);
color(greenLt) translate([6.5, -8, 13]) scale([2.2, 1.6, 2.5]) sphere(1, $fn = 14);
for (k = [-1, 0, 1]) spike([3.2 + k * 0.4, -13.2, 8.3 + k * 1.3], [-1.6, -1.2, -0.3], 0.75, 0.15, barkLt);

// ---- far arm, raised forward: green wrist with a bark patch, cream paw, brown claws to the left.
chain([[-7, -8, 13], [-11, -13, 11.5], [-15, -16, 14]], [3.2, 2.8, 2.8], green);
color(bark) translate([-15.5, -17.5, 15.5]) scale([1.6, 1.2, 1.4]) sphere(1, $fn = 12);
color(cream) translate([-17, -18.5, 12.6]) scale([3.0, 2.6, 2.4]) sphere(1, $fn = 18);
for (k = [-1, 0, 1]) spike([-19.2, -19.8, 12.6 + k * 1.4], [-1.9, -1.4, k * 0.4], 0.7, 0.15, barkLt);
color(bark) translate([-16.5, -20.6, 11.5]) scale([1.6, 0.8, 0.8]) sphere(1, $fn = 10);

// ---- legs: the far front foot planted under the head, the hind legs with cream feet.
limb([-7, -10, 9], [-9, -13.5, 3], 3.2, 2.8, greenDk);
color(cream) hull() { translate([-9.5, -13.5, 2]) scale([3, 3, 2]) sphere(1, $fn = 18); translate([-10, -16.2, 1.6]) scale([2.6, 2.4, 1.6]) sphere(1, $fn = 16); }
mirror_x() ell([3.8, 4.5, 4.5], [6.5, 11, 6], green);
color(cream) hull() { translate([7.5, 9, 2]) scale([3.2, 3.5, 2]) sphere(1, $fn = 18); translate([7.5, 5.5, 1.6]) scale([2.8, 2.5, 1.6]) sphere(1, $fn = 16); }
for (k = [-0.8, 0.8]) color(greenDk) translate([7.5 + k, 3.1, 1.6]) scale([0.15, 0.4, 1.2]) sphere(1, $fn = 6);
color(greenDk) hull() { translate([-6.5, 9, 2]) scale([3, 3.3, 2]) sphere(1, $fn = 16); translate([-6.5, 6, 1.6]) scale([2.6, 2.4, 1.6]) sphere(1, $fn = 14); }

// ---- tail: an S-curling vine in the picture plane at the rump, bark wraps, a green bud and a leaf at the tip.
pp(9) {
  T = [[11, 0, 8], [16, 0, 9.5], [17.6, 0, 12], [17.8, 0, 14.5], [16.5, 0, 17], [16, 0, 19.5], [16.4, 0, 22], [17.6, 0, 23.8], [19.5, 0, 24.6], [21.5, 0, 23.8], [22.8, 0, 22], [23.4, 0, 19.8]];
  R = [2.2, 1.9, 1.7, 1.6, 1.5, 1.5, 1.5, 1.4, 1.4, 1.35, 1.3, 1.3];
  for (i = [0 : len(T) - 2]) {
    w = (i == 2 || i == 5 || i == 8 || i == 9);
    limb(T[i], T[i + 1], R[i] + (w ? 0.25 : 0), R[i + 1] + (w ? 0.25 : 0), w ? barkLt : green);
  }
  color(green) translate([23.5, 0, 19.2]) scale([1.8, 1.4, 1.8]) sphere(1, $fn = 14);
  leaf = [[27.6, 29], [29.2, 28.7], [28.2, 27.9], [28.7, 26.9], [27.4, 25.8], [27.6, 24.5], [27.1, 23.4], [24.2, 23.2], [23.7, 24.8], [22.4, 25], [22.1, 27.4], [24.5, 27.2], [25.5, 28.2], [26.1, 28.5]];
  plate(leaf, 1.0, 0.4, green);
  translate([0, -0.15, 0]) plate([[24, 26.5], [27, 28.5], [28, 28], [26.5, 25.5], [24.5, 24.5]], 1.0, 0.3, moss, grow = 0);
}
