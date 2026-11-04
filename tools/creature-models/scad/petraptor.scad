// Petraptor: Shalewing grown into a standing slate-grey pterosaur, remodelled to its sprite (2026-11-04).
// Checklist (front sheet, 40 units tall):
//   head  drawn in profile, beak to the viewer's left: so the head is turned 45 deg towards the creature's right
//         (headFrame) and authored in its own frame, y = sheet x (S()). Crest: a tall blade z 27..40 leaning back to
//         its tip at (5.7, 39.9), the front half tan rimmed with a big orange gem (-4.7..0, 29..35.7), the rear half
//         slate. Beak: a broad tan wedge hooked down to (-8.5, 19.6), a darker lower bill. Slate face band (-5..0,
//         25..30) with the eye: an angry orange eye (-2.9..0, 25..27.8), white at the back, hooded by a black brow.
//         Tan cheek under the eye. A tan spike behind the skull (3.7, 29).
//   neck  slate, z 19..26, two rows of tan triangular spikes down its back (sheet x 2..6.3, z 17..27).
//   body  slate pear z 6..21; tan belly (-4.4..1.8, 6.3..19.2) with three darker chevrons; round tan studs down the
//         spine and the tail (the back art).
//   wings spread sideways to sheet x +-17.5: a slate arm out to a hand with three tan claws (near 8.3..10.3,
//         13.8..17), a tan wing finger up to the wrist knob (an "A" at 10.2, 22) and down the leading edge to
//         (15.8, 14.5), five slate blade feathers hanging down and out to tips at z 3..10.
//   legs  thick thighs, near foot under the body (4.4, 1.5), far foot stepped out (-6.8, 2.5), tan talons.
//   tail  short, sweeping back to the +X side and down, tan studs on top (front 5..10, 6..10).
include <lib.scad>

slate = [0.4, 0.4, 0.47];
slateHi = [0.45, 0.45, 0.51];
slateDark = [0.27, 0.27, 0.32];
tan = [0.8, 0.65, 0.43];
tanDark = [0.6, 0.47, 0.32];
jawTan = [0.68, 0.53, 0.35];
amber = [0.9, 0.55, 0.12, NOGLOW];
amberHi = [1, 0.86, 0.6, NOGLOW];
eyeOrange = [0.9, 0.5, 0.1, NOGLOW];
ink = [0.16, 0.15, 0.18];

// ---------- head (its own frame: x = side, y = back, z = up; sheet x = 0.966 y + 0.26 x)
function S(sx, z, x = 0) = [x, sx * 1.035 - 0.268 * x, z];
module headFrame() { rotate([0, 0, -45]) children(); }

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): high at the back, sloping down to the beak.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.2]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.2, s * (1.2 - drop)]) scale([s * 0.5, s * 0.6, s * 0.3]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.05]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}

// A crest outline (sheet [x, z]) stood in the head's mid-plane.
module crestPlate(pts, t, c) { scale([1, 1.035, 1]) rotate([0, 0, 90]) slab(pts, t, c, inset = 1.1); }

crestTan = [[-6.9, 26.6], [-6.4, 28.6], [-5.5, 30.5], [-4.4, 33.1], [-3.1, 34.3], [-1.6, 35.6], [0.2, 37], [2.2, 38.3],
            [4.5, 39.4], [5.5, 39.6], [4.6, 37.4], [3.4, 35.3], [1.5, 33.2], [0.2, 31.4], [-0.6, 29.8], [-2.7, 28.4],
            [-4.3, 27.2], [-5.5, 26]];
crestSlate = [[-1, 29.6], [0.2, 31.4], [1.5, 33.2], [3.4, 35.3], [4.6, 37.4], [5.4, 39.4], [5.9, 39.2], [6, 37.4],
              [4.8, 34.7], [3.8, 32.6], [3.4, 30.5], [2.6, 29.2], [0.8, 28.8]];

module head() {
  // Skull: a slate cranium behind the eye, hulled forward into the face band between beak and crest.
  color(slate) hull() {
    translate(S(0.6, 27.6)) scale([2.5, 3.6, 3]) sphere(1, $fn = 24);
    translate(S(-4.2, 26.4)) scale([1.7, 1.6, 1.6]) sphere(1, $fn = 16);
  }
  // Tan cheek under the eye, running back from the beak.
  color(tan) hull() {
    translate(S(-2.8, 24.2)) scale([1.9, 1.8, 1.2]) sphere(1, $fn = 14);
    translate(S(1.4, 25.1)) scale([2.15, 1.5, 1]) sphere(1, $fn = 14);
  }
  // Beak: a broad tan wedge hooked down to its tip; the lower bill shorter and darker.
  color(tan) hull() {
    translate(S(-1.6, 24.6)) scale([1.7, 1.6, 1.4]) sphere(1, $fn = 16);
    translate(S(-6.2, 25.3)) scale([1.2, 1.3, 1.4]) sphere(1, $fn = 14);
    translate(S(-7.6, 22.4)) scale([0.9, 0.9, 1]) sphere(1, $fn = 12);
    translate(S(-8.4, 20)) sphere(0.3, $fn = 8);
  }
  color(jawTan) hull() {
    translate(S(-1.6, 23.2)) scale([1.5, 1.6, 1]) sphere(1, $fn = 14);
    translate(S(-6.4, 20.6)) scale([0.55, 0.5, 0.45]) sphere(1, $fn = 8);
  }
  // Crest: the tan front half (rim + gem setting) and the slate rear half, a blade in the mid-plane.
  crestPlate(crestTan, 2.3, tan);
  crestPlate(crestSlate, 2, slate);
  // The orange gem set in each face of the crest, with a pale glint along its upper edge.
  mirror_x() {
    color(amber) translate([1.02, -2.45, 32.3]) rotate([-36, 0, 0]) scale([0.45, 1.65, 4.5]) sphere(1, $fn = 18);
    color(amberHi) translate([1.38, -3.4, 32.8]) rotate([-36, 0, 0]) scale([0.2, 0.32, 1.7]) sphere(1, $fn = 10);
  }
  // A tan spike behind the skull.
  mirror_x() spike([0.9, 3.3, 28.6], [0.5, 2.6, 0.6], 0.9, 0.08, tan);
  // Angry orange eyes looking forward, hooded by a black lid and a slate brow.
  mirror_x() {
    eye([1.4, -1.9, 26.4], 1.5, iris = eyeOrange, pupil = [0.12, 0.05, 0.02], sclera = [0.96, 0.94, 0.9], yaw = 62,
        flat = 0.5, lid = 0.34, lid_tilt = 26, lid_c = ink, slit = 0.6);
    brow([1.4, -1.9, 26.4], 1.5, 62, 0.7, slate);
  }
}
headFrame() head();

// ---------- neck and body
chain([[0, 0, 18.5], [0.1, 0.3, 22.5], [0.3, 0.6, 25.6]], [3.3, 2.9, 2.5], slate);
// Two rows of tan triangular spikes down the back of the neck, pointing back and out.
// Each a flat triangle: a tall thin base on the neck, hulled to a point.
module fin(p, d, h, w = 0.45) { color(tan) hull() { translate(p) scale([w, 0.9, h]) sphere(1, $fn = 10); translate(p + d) sphere(0.12, $fn = 6); } }
mirror_x() for (z = [17.6, 19.7, 21.8, 23.8]) fin([1.3, 2.2, z], [1.9, 3.4, 0.5], 1.05);

module torso(g = 0) {
  hull() {
    translate([0, 0.8, 11.8]) scale([5 + g, 4.6 + g, 5.4 + g]) sphere(1, $fn = 30);
    translate([0, 0, 17.2]) scale([4.2 + g, 3.8 + g, 4 + g]) sphere(1, $fn = 26);
  }
}
color(slate) torso();
// Tan belly, laid on the front of the torso, with three darker chevrons.
belly = [[0, 6], [2.1, 8.4], [3.2, 11], [3.4, 14], [2.8, 17], [1.6, 19.4], [-1.6, 19.4], [-2.8, 17], [-3.4, 14], [-3.2, 11], [-2.1, 8.4]];
module yPrism(pts) { rotate([90, 0, 0]) linear_extrude(height = 40, center = true) polygon(pts); }
module front() { translate([-30, -30, -1]) cube([60, 29, 50]); }
color(tan) intersection() { torso(0.3); yPrism(belly); front(); }
for (z0 = [10.6, 13.6, 16.4]) color(tanDark) intersection() {
  torso(0.42);
  yPrism([[-3, z0 + 1.7], [0, z0], [3, z0 + 1.7], [3, z0 + 2.15], [0, z0 + 0.45], [-3, z0 + 2.15]]);
  yPrism(belly);
  front();
}

// ---------- tail: sweeping back to the +X side and down, round tan studs down the spine and along the tail.
tailPts = [[0, 3.5, 10], [1.2, 7.5, 7.4], [2.6, 11.2, 5.2], [3.6, 14.2, 4]];
tailRs = [3.2, 2.2, 1.3, 0.35];
chain(tailPts, tailRs, slate);
spineStuds = [[0, 3.4, 21], [0, 4.1, 18.8], [0, 4.8, 16.4], [0, 5.3, 13.9], [0, 5.4, 11.4]];
for (i = [0 : len(spineStuds) - 1]) color(tan) translate(spineStuds[i]) scale([1.25, 0.8, 1]) sphere(1.05, $fn = 12);
for (i = [0 : len(tailPts) - 2]) for (u = [0.2, 0.7]) let(p = tailPts[i] + (tailPts[i + 1] - tailPts[i]) * u, r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(tan) translate(p + [0, 0, r * 0.82]) scale([1, 1.1, 0.7]) sphere(max(0.45, r * 0.42), $fn = 10);

// ---------- legs: thick thighs, shins, splayed feet with tan talons. The far (-X) foot steps out and forward.
module leg(hip, ankle, foot, s) {
  ell([2.9, 3.4, 3.8], hip, slate);
  limb(hip + [0.3 * s, -0.2, -2.2], ankle, 1.8, 1.3, slate);
  color(slate) hull() { translate(ankle) sphere(1.3, $fn = 12); translate(foot) scale([1.8, 2.4, 1.05]) sphere(1, $fn = 14); }
  for (k = [-1, 0, 1]) spike(foot + [k * 1.2, -1.7, 0.2], [k * 0.5, -1.7, -1.05], 0.78, 0.08, tan);
  spike(foot + [0, 1.8, 0.2], [0, 1.2, -0.7], 0.5, 0.06, tan);
}
leg([3.9, 0.2, 9.2], [4.9, -0.4, 2.8], [5.2, -1.4, 1.1], 1);
leg([-3.9, -0.4, 9], [-4.8, -3.8, 3], [-5.4, -4.6, 1.15], -1);

// ---------- wings (built for the near +X side and mirrored). W() reads a point off the sheet at depth y.
function W(sx, z, y) = [(sx - 0.5 * y) / 0.866, y, z];
SH = [4, 0.5, 17.5];
HAND = W(9, 16.2, -0.8);
KNOB = W(10.2, 22.4, 1);
module feather(top, bot, w, c) {
  color(c) hull() {
    translate(top) scale([w, 0.55, 0.7]) sphere(1, $fn = 10);
    translate(top + (bot - top) * 0.6) scale([w * 0.95, 0.5, 0.7]) sphere(1, $fn = 10);
    translate(bot) scale([w * 0.2, 0.3, 0.3]) sphere(1, $fn = 6);
  }
}
fRoots = [W(7.6, 17, 1), W(9.8, 18.6, 1.2), W(11.8, 19.6, 1.2), W(13.8, 18.4, 1.2), W(16, 15.2, 1.2)];
fTips = [W(7.6, 10, 1.8), W(10.9, 7.2, 2.2), W(14.2, 3.4, 2.4), W(17.4, 4, 2.4), W(18.3, 9, 2)];
fW = [1.8, 2.15, 2.25, 2.15, 1.5];
module wing() {
  // Arm: shoulder out to the hand, which hangs in front of the wing with three hooked tan claws.
  chain([SH, W(6.6, 17.6, 0), HAND], [2, 1.6, 1.2], slate);
  for (k = [-1, 0, 1]) chain([HAND + [k * 1.05, -0.4, -0.2], HAND + [k * 1.15, -1.3, -1.4], HAND + [k * 1.05, -0.8, -2.8]], [0.55, 0.45, 0.1], tan);
  // Tan wing finger: up from the hand to the wrist knob (the "A"), then down the leading edge.
  chain([HAND + [0.4, 1, 0.4], W(9.3, 19.2, 0.8), KNOB], [0.9, 0.85, 1.2], tan);
  chain([KNOB, W(12.8, 20.4, 1.1), W(16.2, 14.6, 1.2)], [1.2, 0.95, 0.65], tan);
  color(tan) translate(KNOB + [0.2, -0.2, 0.4]) scale([1.1, 0.9, 0.8]) sphere(1, $fn = 12);
  // Slate inner wing filling the frame between the finger and the feather roots.
  color(slate) hull() for (p = [HAND + [0.4, 1.4, 0.6], W(9.3, 19.4, 1.1), KNOB + [0, 0.2, -0.6], W(12.8, 19.8, 1.2), W(15.8, 14.6, 1.3),
                                 fRoots[0] + [0, 0, -1.2], fRoots[2] + [0, 0, -1.6], fRoots[4] + [0, 0, -1.2]])
    translate(p) scale([0.5, 0.45, 0.5]) sphere(1, $fn = 8);
  // Slate feathers hanging from the finger, alternating shades, a dark quill down each face.
  for (i = [0 : len(fRoots) - 1]) feather(fRoots[i], fTips[i], fW[i], i % 2 == 0 ? slate : slateHi);
  for (i = [0 : len(fRoots) - 1]) for (sd = [-1, 1])
    limb(fRoots[i] + [0, sd * 0.5, -1], fRoots[i] + (fTips[i] - fRoots[i]) * 0.8 + [0, sd * 0.36, 0], 0.26, 0.12, slateDark);
}
mirror_x() wing();
