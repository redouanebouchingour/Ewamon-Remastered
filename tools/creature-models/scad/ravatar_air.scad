// Ravatar (air relic): Ravatar's body (copied from scad/ravatar.scad) in pale sky armour etched with cloud swirls,
// its arrow and eyes shining white-cyan, its tail turned into a huge streaming cloud gust, wind whirls round its feet
// and claws.
// Checklist (front sheet, 40 units; the art's feet stand on sheet z 1.5 to 2.5 over the wind, so pp() parts take art
// z - GROUND; the body's axis reads at sheet x -6, AX = 6 moves art x onto the base frame):
//   - body, mane, antlers, muzzle and smirk as the base; fur a paler, greyer tan; no cream ruff, no tattoos
//   - arrow: a wide pale cyan arrow, point between the eyes (z 27.5), wings at z 29.4 reaching the eyes, shaft up into
//     the mane and down the nape (back sheet); eyes glowing white-cyan slits
//   - armour (pale grey-blue, a cyan rim, dark blue swirls): pauldrons flaring up into curls beside the head, a gorget
//     with V straps to a mint gem on the sternum, swirl plates over the pecs, a back plate with two big swirls, swirl
//     bracers on the forearms, a belt with a gem, swirl plates on the thighs and knee bosses, blue-grey greaves
//   - blue-grey loincloth flaps front (to art z 9) and back; abs and upper arms bare tan
//   - cloud tail: from the lower back down behind the near leg to the ground, then a huge plume rising (art x 5..17,
//     z 6..27) and streaming right to a curled tip at art (24, 30); grey swirls and white highlights; two dark pebbles
//   - wind: whirls on the ground round each foot (art x -26..-14 and 3..18), wisps curling round both hands
include <lib.scad>

fur = [0.75, 0.64, 0.5];
furLight = [0.88, 0.79, 0.64];
cream = [0.9, 0.82, 0.68, NOGLOW];
mane = [0.3, 0.27, 0.26];
maneHi = [0.42, 0.39, 0.36];
antler = [0.4, 0.33, 0.28];
mark = [0.84, 1, 1, GLOW];
plate = [0.7, 0.77, 0.83];
plateRim = [0.78, 0.96, 0.97, NOGLOW];
plateLine = [0.33, 0.46, 0.56];
cloth = [0.55, 0.64, 0.71];
gemC = [0.84, 0.98, 0.92, GLOW];
tailC = [0.76, 0.79, 0.82];
tailHi = [0.95, 0.98, 0.99, NOGLOW];
tailLine = [0.6, 0.66, 0.7];
windC = [0.86, 0.93, 0.96, NOGLOW];
pebble = [0.26, 0.27, 0.29];
claw = [0.3, 0.25, 0.24];
toeClaw = [0.35, 0.3, 0.28];
paw = fur;
limbFn = 12;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
eyeGlow = [0.62, 0.94, 0.98, GLOW];
eyeWhite = [0.88, 1, 1, GLOW];

// ---- Shapes shared by several parts (the rig file copies these numbers).
HEAD = [[[4.3, 3.8, 3.8], [0, -0.6, 26.8]], [[3.4, 3.1, 2.8], [0, -0.3, 30]]];
TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
GORGET = [[5.4, 3.2, 2.3], [0, -0.4, 24]];
MANE = [[[3.6, 2.4, 2.4], [0, 2.2, 29.4]], [[4.4, 3.6, 2.6], [0, 1.4, 32]], [[4.6, 3.4, 2.6], [1.2, 1.8, 35]],
        [[3.2, 2.6, 1.8], [2, 2.2, 37.8]]];
SHOULDER = [8.3, 0, 21.8];
ELBOW = [11.5, -2.4, 17];
WRIST = [14.2, -2.3, 14.4];
HAND = [14.6, -2.4, 12.6];
HIP = [4.2, 0.3, 13.2];
KNEE = [7.6, -1.2, 8.2];
ANKLE = [9.6, -1.4, 3.2];
FOOT = [9.8, -1.6, 0];
// the cloud tail: the root from the lower back, a plume (a hull of flattened ellipsoids), a band streaming out to a
// curled tip; lobes break the plume's outline
ROOT = [[[1, 3.5, 12], 2], [[5, 6.5, 4.6], 3.2]];
PLUME = [[[3.2, 2.4, 3], [5, 6.5, 4.6]], [[4.2, 3, 3.6], [10, 8, 5]], [[5.2, 3.6, 5.2], [14, 8.5, 12]],
         [[4.5, 3.2, 4.5], [16, 8, 19]], [[3.5, 2.6, 3.5], [11.5, 7.5, 19.5]], [[3, 2.2, 3], [8, 7, 10]]];
BAND = [[[16, 8, 19], 4.5], [[20, 7.5, 23], 3.3], [[25, 7, 24], 2.6], [[29.5, 6.5, 26], 1.5]];
TIP = [[29.5, 6.5, 26], [30.4, 6.5, 28.6], [29.4, 6.5, 30.6], [27.6, 6.5, 30.6], [27, 6.5, 29.4]];
TIP_R = [1.5, 1.2, 0.9, 0.6, 0.3];
LOBES = [[[18, 7.6, 9.6], 2.8], [[19.2, 7.4, 14.6], 2.4], [[12.4, 7.6, 22.6], 2.6], [[17.4, 7.4, 24.2], 2.2],
         [[22.6, 7, 26], 1.9]];
EYE = [2.4, -3.45, 27.3];
WHIRL = [16.5, -1, 0];
ANTLER = [[3.6, 0, 29.6], [5.4, 0.2, 32.2], [6.6, 0.4, 35], [6.3, 0.6, 37.2]];
ANTLER_R = [1.1, 0.9, 0.6, 0.15];
// mane locks: [root, d1, d2, d3, root radius, highlight]
LOCKS = [[[0, 1.4, 38.5], [-0.6, 0.4, 1.4], [-0.6, 0.6, 1], [-0.4, 0.6, 0.6], 1.6, 0],
         [[1.4, 1.4, 38], [1, 0.6, 1.4], [1.4, 0.8, 0.8], [1.4, 0.8, 0.2], 1.5, 1],
         [[2.8, 1.4, 36], [1.8, 0.4, 0.9], [2, 0.6, 0.4], [1.6, 0.8, -0.2], 1.6, 0],
         [[3.2, 1.8, 33.6], [2, 0.4, 0.2], [1.8, 0.8, -0.4], [1.4, 1, -0.8], 1.5, 1],
         [[-1.6, 1.2, 37.8], [-0.8, 0.4, 1.4], [-1, 0.6, 0.8], [-0.8, 0.8, 0.4], 1.5, 1],
         [[-3, 1.4, 35.8], [-1.8, 0.4, 0.8], [-1.6, 0.8, 0.4], [-1.2, 0.8, 0], 1.6, 0],
         [[-3.2, 1.8, 33.4], [-1.8, 0.6, -0.2], [-1.4, 1, -0.6], [-1, 1, -0.8], 1.4, 0],
         [[0.5, 3.6, 36.4], [0.2, 1.2, 1.6], [0.3, 1, 1.4], [0.2, 0.8, 0.8], 1.6, 0],
         [[2.2, 3.6, 34.4], [1.2, 1.2, 1], [1.4, 0.8, 0.8], [1, 0.6, 0.4], 1.4, 1],
         [[-2, 3.6, 34.2], [-1.2, 1.2, 0.8], [-1.2, 0.8, 0.8], [-0.8, 0.6, 0.4], 1.4, 0],
         [[0, 3.8, 32.4], [0, 1.6, -0.8], [0, 1.2, -1.6], [0, 0.6, -1.4], 1.5, 0]];

module oval(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module leaf(r, p, rot, c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module blobN(parts, c, fn = 14) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
module grownBlob(parts, g) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 22); }
module stroke(pts, r, c) { chain(pts, [for (p = pts) r], c); }
// Swirl in the XZ plane facing yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = plateLine, w = 0.28) {
  n = 8;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 500, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) w], c, $fn = 4);
}
module shard(p, rot, w, t, h, c) {
  color(c) translate(p) rotate(rot) hull() {
    scale([w, t, 0.3]) sphere(1, $fn = 10);
    translate([0, -t * 0.7, h * 0.4]) sphere(t * 0.5, $fn = 6);
    translate([0, 0, h]) sphere(0.1, $fn = 6);
  }
}
module lock(p, d1, d2, d3, r, c) { chain([p, p + d1, p + d1 + d2, p + d1 + d2 + d3], [r, r * 0.75, r * 0.45, 0.1], c, $fn = 10); }
// An armour plate: an ellipsoid of radii r with a cyan rim showing round its edge, a swirl on its face.
module armourPlate(p, r, rot, swirl = 1) {
  translate(p) rotate(rot) {
    oval(r, [0, 0, 0], plate, 11);
    oval([r[0] + 0.25, r[1] * 0.7, r[2] + 0.25], [0, 0.25, 0], plateRim, 10);
    if (swirl > 0) tswirl([0, -r[1] + 0.05, 0], swirl);
  }
}
// A dome: the upper half of an ellipsoid of radii r.
module dome(r, c) { color(c) scale(r) difference() { sphere(1, $fn = 14); translate([0, 0, -1.25]) cube(2.5, center = true); } }

// ---- Legs: tan thighs under swirl plates, knee bosses, blue-grey greaves, clawed paws.
module legs() mirror_x() {
  limb(HIP, KNEE, 3, 2.4, fur, $fn = limbFn);
  oval([2.1, 2, 1.8], KNEE + [0, -0.6, 0.6], fur, 14);
  limb(KNEE, ANKLE, 2.3, 1.8, fur, $fn = limbFn);
  armourPlate([6.5, -2.2, 11], [2.5, 1.1, 3.7], [-14, -33, 25], 1.3);
  armourPlate(KNEE + [0.5, -2.2, 0.6], [1.6, 0.8, 1.6], [0, 0, 20], 0.9);
  // greave
  blobN([[[2.6, 2.6, 1.2], [8.9, -1.4, 6.6]], [[3.1, 3.1, 1.3], [9.3, -1.5, 3.3]]], cloth, 12);
  oval([2.75, 2.75, 0.45], [8.9, -1.4, 7.5], plateRim, 14);
  oval([3.25, 3.25, 0.5], [9.3, -1.5, 2.4], plateRim, 14);
  tswirl([9.6, -4.55, 5], 1.1, 15, plateRim);
  // paw
  translate(FOOT) rotate([0, 0, 18]) {
    blobN([[[1.9, 1.7, 1.3], [0, 0.4, 1.4]], [[2, 1.6, 1.1], [0, -1.8, 1.1]]], paw, 11);
    for (dx = [-1.15, 0, 1.15]) {
      oval([0.65, 0.9, 0.6], [dx, -3.1, 0.75], paw, 8);
      spike([dx, -3.8, 0.7], [dx * 0.25, -1.1, -0.55], 0.42, 0.05, toeClaw);
    }
  }
}

// ---- Belt with a gem, blue-grey cloth flaps front and back.
module skirt() {
  oval([4.1, 3.3, 2], [0, 0.3, 13.4], cloth, 14);
  oval([4.3, 3.6, 0.95], [0, 0.2, 14.9], plate, 18);
  oval([4.42, 3.72, 0.35], [0, 0.2, 14.2], plateRim, 18);
  oval([0.75, 0.45, 1], [0, -3.75, 14.9], gemC, 10);
  shard([0, -3.3, 14.4], [180, 0, 0], 2.6, 0.75, 7, cloth);
  tswirl([0, -4.05, 12.2], 0.9, 0, plateRim);
  shard([0, 3.6, 14.4], [178, 0, 0], 2.4, 0.75, 7.6, cloth);
}

// ---- Torso: broad and muscled, abs bare; gorget, V straps, a sternum gem, swirl pec plates, a back plate.
module torso() {
  blobN(TORSO, fur, 22);
  mirror_x() {
    oval([2.7, 1.3, 1.9], [2.7, -3, 20.6], fur, 18);   // pecs
    for (z = [16.4, 17.8]) oval([1.05, 0.7, 0.62], [1.05, -2.95 - (z - 16.4) * 0.12, z], furLight, 10);   // abs
    armourPlate([2.8, -3.55, 21], [2.8, 1, 2], [0, 0, 16], 1.1);
    stroke([[4.9, -2.7, 23.4], [0.55, -4.3, 21.9]], 0.3, plateRim);   // V strap
  }
  blobN([GORGET], plate, 14);
  oval([0.8, 0.5, 1.15], [0, -4.4, 21.2], gemC, 10);
  // back plate over the shoulder blades, two big swirls
  color(plate) intersection() {
    grownBlob(TORSO, 0.35);
    translate([-7, 1.4, 18.6]) cube([14, 6, 6.6]);
  }
  color(plateRim) intersection() {
    grownBlob(TORSO, 0.45);
    translate([-7, 1.4, 18.4]) cube([14, 6, 0.6]);
  }
  mirror_x() tswirl([2.5, 4.55, 21.9], 1.5, 180);
}

// ---- Arms: tan, big clawed hands (one arm, the creature's left numbers: shoulder S, elbow E, wrist W, hand H).
module arm(S, E, W, H) {
  oval([2.8, 2.8, 2.6], S, fur, 13);
  limb(S, E, 2.5, 2.2, fur, $fn = limbFn);
  limb(E, W, 2.2, 2.1, fur, $fn = limbFn);
  oval([2.4, 2.1, 2.5], H, fur, 13);
  for (dx = [-1.3, -0.45, 0.45, 1.3]) {
    limb(H + [dx, -0.7, -1.5], H + [dx * 1.25, -1.5, -2.8], 0.65, 0.55, fur, $fn = 8);
    spike(H + [dx * 1.25, -1.6, -3], [dx * 0.2, -0.5, -1.4], 0.5, 0.05, claw);
  }
}
// Pauldron flaring up into a curl beside the head, two layers, swirls front and back.
module pauldron(S) {
  translate(S + [0.6, 0, 1.1]) rotate([0, 20, 0]) {
    dome([4.3, 4.2, 3.4], plate);
    oval([4.55, 4.45, 0.5], [0, 0, 0.1], plateRim, 14);
  }
  translate(S + [2.1, 0, -0.7]) rotate([0, 48, 0]) {
    dome([3, 3.6, 2.2], plate);
    oval([3.2, 3.8, 0.45], [0, 0, 0.1], plateRim, 12);
  }
  chain([S + [1.6, -0.8, 4], S + [2.9, -1.2, 6], S + [2.7, -1.3, 7.8], S + [1.3, -1.3, 7.9], S + [0.8, -1.2, 7]],
        [1.3, 1, 0.7, 0.4, 0.2], plate, $fn = 8);
  chain([S + [1.4, 1.6, 3.8], S + [2.4, 2.4, 5.4], S + [2.2, 2.6, 6.8], S + [1.2, 2.6, 6.8]], [1, 0.75, 0.45, 0.2], plate, $fn = 8);
  tswirl(S + [1.6, -3.85, 1.9], 1.3, 20);
  tswirl(S + [1.6, 3.85, 1.9], 1.3, 160);
}
// Swirl bracer over the forearm, cyan rims at both ends.
module bracer(E, W) {
  d = W - E;
  limb(E + d * 0.1, W + d * 0.04, 2.45, 2.35, plate, $fn = limbFn);
  for (t = [0.08, 0.98]) limb(E + d * t, E + d * (t + 0.06), 2.6, 2.6, plateRim, $fn = limbFn);
  tswirl((E + W) / 2 + [1.3, -1.9, 1], 1, 32);
}
// Wind curling round the hand: a tilted part ring and a hook.
module handWind(H) {
  color(windC) translate(H + [0.4, -0.6, -0.6]) rotate([62, 0, 28]) rotate_extrude(angle = 260, $fn = 20) translate([4.3, 0]) circle(0.34, $fn = 6);
  color(windC) translate(H + [0.6, -0.4, -2.2]) rotate([75, 0, -20]) rotate_extrude(angle = 200, $fn = 16) translate([3.2, 0]) circle(0.28, $fn = 6);
  stroke([H + [3.6, -1.4, 2.6], H + [4.8, -1.2, 4.4], H + [4.2, -1, 6.2], H + [2.8, -1, 6.2], H + [2.6, -1, 5]], 0.3, windC);
}
module arms() mirror_x() { arm(SHOULDER, ELBOW, WRIST, HAND); pauldron(SHOULDER); bracer(ELBOW, WRIST); handWind(HAND); }

// ---- Cloud tail: the root, the plume, the band and its curled tip, lobes, grey swirls, white highlights.
module tail() {
  blobN([[[1, 0.7, 1] * ROOT[0][1], ROOT[0][0]], [[1, 0.7, 1] * ROOT[1][1], ROOT[1][0]]], tailC, 14);
  blobN(PLUME, tailC, 16);
  for (i = [0 : len(BAND) - 2])
    blobN([[[1, 0.7, 1] * BAND[i][1], BAND[i][0]], [[1, 0.7, 1] * BAND[i + 1][1], BAND[i + 1][0]]], tailC, 12);
  for (l = LOBES) oval([1.2, 0.75, 0.85] * l[1], l[0], tailC, 10);
  chain(TIP, TIP_R, tailC, $fn = 10);
  // on the side facing the camera: white streaks along the flow, grey swirls
  stroke([[9.6, 4.6, 8], [13.6, 4.4, 14], [15.4, 4.8, 20.6], [19.6, 5, 25], [24.6, 5.2, 25.6], [28.6, 5.4, 27]], 0.45, tailHi);
  stroke([[12.4, 4.4, 5.4], [17.4, 4.8, 9], [19.2, 5, 15.6], [19.2, 5.2, 20.4], [23.4, 5.4, 22.6]], 0.38, tailHi);
  stroke([[8.6, 4.8, 10.5], [11.6, 4.5, 15], [12.6, 4.6, 20.4], [14.6, 5, 24], [19, 5.2, 26.4]], 0.32, tailLine);
  stroke([[14.6, 4.6, 7.4], [17.8, 5, 12.6], [18, 5.2, 17.4]], 0.32, tailLine);
  stroke([[6, 9.6, 5], [11, 11.2, 7], [14.6, 12.2, 12], [16.2, 11.4, 18], [20, 10.4, 22.6], [25, 9.2, 24.4]], 0.42, tailHi);
  stroke([[9, 10.6, 4], [14, 11.8, 8], [16.6, 11.6, 14], [18.6, 10.8, 19.6], [23, 9.6, 21.8]], 0.34, tailLine);
  for (s = [[[16.4, 4.6, 12.6], 1.9], [[13.4, 4.6, 19.8], 1.5], [[12, 4.4, 7.8], 1.4], [[21.6, 5.2, 21.8], 1.1]])
    tswirl(s[0], s[1], 30, tailLine, 0.32);
  for (s = [[[13.4, 12.2, 12], 1.8], [[16, 11.4, 19.4], 1.5]]) tswirl(s[0], s[1], 180, tailLine, 0.32);
  // two dark pebbles caught in the wind
  for (p = [[23.7, 6, 29], [30.6, 6, 17.5]]) translate(p) rotate([20, 30, 45]) { color(pebble) cube(0.9, center = true); color(plateRim) cube([1.3, 0.4, 1.3], center = true); }
}

// ---- Whirls on the ground round each foot, a curl standing up at the end.
module whirls() mirror_x() translate(WHIRL) {
  color(windC) rotate([0, 0, 120]) rotate_extrude(angle = 280, $fn = 28) translate([7.2, 0.45]) scale([1, 0.55]) circle(0.5, $fn = 5);
  color(tailHi) rotate([0, 0, 200]) rotate_extrude(angle = 200, $fn = 20) translate([5.2, 0.4]) scale([1, 0.55]) circle(0.4, $fn = 5);
  tswirl(7.2 * [cos(40), sin(40), 0] + [0, 0, 1.8], 1.6, 130, windC, 0.32);
}

// ---- Head: the base face with glowing eyes and the wide pale arrow.
module head() {
  blobN(HEAD, fur, 24);
  oval([2.1, 1.9, 1.5], [0, -3.9, 24.4], furLight, 20);   // muzzle
  oval([1.6, 1.4, 0.9], [0, -3.6, 23.1], fur, 16);   // chin
  oval([0.9, 0.55, 0.52], [0, -5.65, 25.3], ink, 14);   // nose
  stroke([[0, -5.75, 24.9], [0, -5.45, 23.7]], 0.15, ink);
  stroke([[-1.35, -4.85, 23.75], [-0.5, -5.35, 23.45], [0.5, -5.35, 23.5], [1.4, -4.9, 23.95]], 0.18, ink);
  mirror_x() spike([0.75, -5.25, 23.6], [0.05, -0.1, -0.55], 0.2, 0.03, cream);   // fangs
  mirror_x() {
    leaf([3, 1, 1.7], [4.6, -1.4, 25.2], [0, 28, 25], cream);
    leaf([2.4, 0.9, 1.3], [4.2, -2.2, 23.4], [0, 42, 20], cream);
    leaf([0.85, 0.5, 1.7], [3.4, 0.2, 30.6], [0, 25, 0], fur);
    eye(EYE, 0.9, iris = eyeGlow, sclera = eyeWhite, pupil = eyeGlow, yaw = 22, lid = 0.45, lid_tilt = 28, lid_c = fur,
        slit = 0.4, squint = 0.2);
    stroke([[0.9, -4.05, 27.9], [2.4, -3.8, 28.35], [3.6, -2.95, 28.8]], 0.2, ink);
  }
  // the wide arrow on the forehead, its shaft up under the mane; and down the nape at the back
  color(mark) intersection() {
    grownBlob(HEAD, 0.12);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 27.4], [-3, 29.5], [-1.35, 29.6], [-1.4, 34], [1.4, 34], [1.35, 29.6], [3, 29.5]]);
  }
  color(mark) intersection() {
    grownBlob(HEAD, 0.12);
    mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(12) polygon([[-1.1, 26.6], [1.1, 26.6], [1.3, 33], [-1.3, 33]]);
  }
}

module maneHair() {
  blobN(MANE, mane, 16);
  for (l = LOCKS) lock(l[0], l[1], l[2], l[3], l[4], l[5] == 1 ? maneHi : mane);
}
module antlers() mirror_x() {
  chain(ANTLER, ANTLER_R, antler);
  limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15, antler);
}

module ravatar_air() {
  legs();
  skirt();
  torso();
  arms();
  tail();
  whirls();
  head();
  maneHair();
  antlers();
}

ravatar_air();
