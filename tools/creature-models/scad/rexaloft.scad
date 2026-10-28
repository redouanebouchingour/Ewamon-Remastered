// Rexaloft: Scalewisp grown into an upright emerald dragon on two legs, a banded pale belly, the head in profile to
// its right under a great frilled fan, a horn that grows from its forehead and arcs over the head into a hook, two
// clawed arms held in front, a thick tail curling up at its left, and two huge deep-blue bat wings on high elbows that
// reach the ground on either side.
//
// Checklist (sheet frame: height 40; the far foot stands on the rock at z 3.2, the near foot higher up the rock at
// z 6; the rock is not modelled, both feet go on z = 0, so the creature is dropped by FOOT = 3.2 and the near leg
// reaches down to the same ground):
//   body: upright torso sheet x -6..3, z 9..25; the pale belly panel -4.6..-0.7, z 13.4..23.2 with 6 bands.
//   neck: -2.5..1, z 23.5..27.  head: wedge in profile, snout tip (-4.2, 24.7..26.4), crown z 29.8, jaw z 23.5,
//         a tiny yellow eye at (-2.2, 26.5), mouth line at z 24.9; two crown spikes to z 33.2 at x -2.3 and 0.8.
//   frill: fan of spines behind the skull, front: the right half shows (spikes at (4.1, 33.2), (5.2, 29.2),
//         (5.5, 26.1), (4.2, 22.7)); back: a full disc -4..4, z 23..32.  Webbing light green, ribs dark.
//   horn: from the forehead (-3.7, 32) up-left to (-4.7, 36.5), over the top (0.6, 39.5) with a small spike at
//         (0.2, 39.9), down to the hook tip at (5.9, 33.7).
//   arms: near arm shoulder (-3, 21) -> elbow (-7.5, 14) -> hand (-9.2..-6, z 10..13.5), claws down-left;
//         far arm shoulder (2, 21) -> elbow (5, 18) -> hand (-1.6..0.2, z 10..12.3), claws down.
//   legs: far thigh oval 3.4..7.5, z 9..16 (light), shin 5.6..7.9 down to the foot 5.6..9, z 3.2..5, toes right;
//         near thigh -4.3..-1.6, z 9..14.6 (dark), shin to the foot -7..-1.6 (z 6..8.3 in the art), toes left.
//   tail: from the hips to the right, 3..12.6, z 9..17, curling up to the tip at (11.7, 16.5).
//   wings (both in the picture plane): elbows at (-5.8, 36.5) and (7.5, 35.5); dark leading edges to the tips
//         (-19.5, 11.8) / (20, 11.4); green F2 bones down to the bottom tips (-12.6, 5.4) / (12.6, 5.4); F3 and the
//         arms; blue outer and inner panels from the trace, the inner ones with a bright patch.
//   back: the frill disc, the horn arc mirrored, the tail at the viewer's left, the wing roots on the shoulders.
//   colours: green M1 (mid #0f6446, light #1a8652, pale #34ab69, dark #094839, deep #072b2c), belly M3 #79d899,
//            blue M0 (mid #183268, dark #191c47, bright #2b3e90), ink-dark M2 #151821, eye yellow (glows).
include <lib.scad>

FOOT = 3.2;

green = [0.06, 0.39, 0.28];
greenLt = [0.10, 0.52, 0.32];
greenPale = [0.20, 0.67, 0.41];
greenDk = [0.03, 0.28, 0.22];
greenDeep = [0.03, 0.17, 0.17];
belly = [0.48, 0.85, 0.60];
blue = [0.09, 0.20, 0.41];
blueDk = [0.10, 0.11, 0.28];
blueBright = [0.17, 0.24, 0.56];
ink = [0.08, 0.10, 0.13];
claw = [0.26, 0.24, 0.24];
eyeYellow = [1, 0.9, 0.2, GLOW];

// The art's picture plane: the preview camera is turned 30 degrees, so a child drawn at [sx, 0, z] in sheet units
// projects onto the sheet at exactly sx; `dy` pushes the plane that far behind the body's centre line.
module inplane(dy = 0) {
  translate([0, dy, 0]) rotate([0, 0, 30]) translate([-dy / 2, 0, 0]) children();
}
// A panel from a traced region outline, grown by the ink line's width (the trace follows the colour region inside
// the outline, so a panel would otherwise come out 0.45 units short on every edge).
module mplate(pts, t = 0.5, c) {
  color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(r = 0.45) polygon(pts);
}
// A hand's three claws fanned across the picture plane (so the fan reads from the front camera): directions given.
module handclaws(p, dirs, r = 0.38, c = claw) {
  for (d = dirs) spike(p, d, r, 0.05, c);
}
// Three claws from point p along direction d, spread sideways by s.
module claws(p, d, s, l = 2.0, r = 0.38, c = claw) {
  side = cross([0, 0, 1], d) / max(0.01, norm(cross([0, 0, 1], d)));
  for (k = [-1, 0, 1]) spike(p + side * k * s * 0.5, d * l + side * k * s * 0.3, r, 0.05, c);
}

// Head in its own frame: the neck joint at the origin, the snout towards -Y, absolute z.
module head() {
  // Skull: a rounded wedge, domed at the back, a brow ridge over each eye, a rounded snout at z 24.7..26.4.
  blob([[[2.4, 2.3, 2.8], [0, 0.5, 27.3]], [[2.1, 1.9, 2.4], [0, -2.3, 27.2]], [[1.6, 1.4, 1.6], [0, -4.0, 26.3]],
        [[1.1, 1.0, 1.1], [0, -4.8, 25.7]]], greenLt);
  // Lower jaw, rounded, with the mouth line along its side.
  color(green) hull() {
    translate([0, -0.3, 24.7]) scale([2.0, 2.2, 1.0]) sphere(1, $fn = 14);
    translate([0, -4.4, 24.6]) scale([1.0, 0.9, 0.6]) sphere(1, $fn = 10);
  }
  mirror_x() {
    limb([1.05, -4.9, 25.0], [2.0, -1.0, 25.1], 0.14, 0.14, ink);
    // A small eye (the art's is a yellow glint in a dark socket under the brow).
    eye([2.0, -2.1, 26.7], 0.6, iris = eyeYellow, sclera = greenDeep, pupil = eyeYellow, yaw = 60, flat = 0.5, shine = false);
    color(greenLt) translate([1.75, -2.4, 27.7]) rotate([0, 0, 20]) rotate([0, 10, 0]) scale([1.2, 1.7, 0.55]) sphere(1, $fn = 12);
  }
  // Two crown spikes rising from the top of the skull.
  spike([0.3, -1.2, 29.4], [0.2, -0.2, 3.9], 0.5, 0.05, greenLt);
  spike([-0.2, 1.0, 29.3], [-0.1, 0.4, 3.8], 0.5, 0.05, greenLt);
}

module creature() {
  // ---- Torso: an upright stack from the hips to the shoulders, leaning a little forward.
  blob([[[3.6, 3.5, 3.6], [0, 0, 12]], [[3.6, 3.8, 4.2], [-0.6, -1, 16.5]], [[3.8, 4.0, 4.2], [-0.8, -1.5, 20.5]]], greenLt);
  // Pale banded belly plates down the front of the chest.
  color(belly) translate([-1.5, -4.6, 18]) scale([2.4, 1.6, 5.2]) sphere(1, $fn = 22);
  for (z = [13.8, 15.5, 17.2, 18.9, 20.6, 22.2]) color(greenLt) translate([-1.5, -4.9 - (1 - pow((z - 18) / 5.2, 2)) * 1.2, z]) scale([2.2, 0.5, 0.22]) sphere(1, $fn = 12);
  // Shoulders and a dorsal ridge of small spines up the back and the neck.
  mirror_x() ell([1.5, 1.8, 1.5], [2.6, 0.4, 23], greenLt);
  for (i = [0 : 5]) let(z = 17 + i * 2.2) spike([-0.2 - i * 0.05, 1.9 - i * 0.2, z], [0, 1.2, 1.2], 0.45, 0.05, greenLt);

  // ---- Neck and head, the head turned 40 degrees to the creature's right so it reads in profile.
  chain([[-1, -2, 23.5], [-0.5, -1, 26.8]], [2.5, 2.1], greenLt);
  translate([-0.5, -1, 0]) rotate([0, 0, -40]) head();

  // ---- Horn: from the forehead, up and to the right, arcing over the head into a hook.
  H = [[-2.1, -2.9, 29.3], [-3.5, -2.5, 33], [-3.8, -1.5, 36.3], [-2.2, 0, 38.5], [0, 1, 39.1], [2.6, 1.8, 38.3], [4.3, 2.1, 36.3], [5.1, 2.4, 33.8]];
  chain(H, [1.3, 1.1, 1.0, 1.0, 1.0, 1.05, 1.1, 0.3], greenLt);
  // The hook's inner side is a straight wedge from the tip back up to the arc.
  limb([4.6, 2.2, 35], [2.0, 1.5, 37.6], 0.85, 0.85, green);
  spike([-0.3, 0.8, 39.2], [0.1, 0, 1.4], 0.45, 0.05, green);

  // ---- Frill: a fan of spines with pale webbing on the back of the skull, in the picture plane.
  inplane(2.5) {
    hub = [-0.3, 27.8];
    star = [for (i = [0 : 19]) let(a = 57 + i * 18, r = (i % 2 == 0) ? 5.6 : 4.0) [hub[0] + r * cos(a), hub[1] + r * sin(a)]];
    mplate(star, 0.5, greenPale);
    for (i = [0 : 9]) let(a = 57 + i * 36) limb([hub[0], 0, hub[1]], [hub[0] + 5.5 * cos(a), 0, hub[1] + 5.5 * sin(a)], 0.45, 0.2, greenDk);
    color(greenLt) translate([hub[0], 0, hub[1]]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.6, center = true, $fn = 16);
  }

  // ---- Arms: held in front, elbows out, clawed hands hanging.
  // Near arm (the creature's right).
  chain([[-2.6, -1.5, 23], [-3.5, -2.5, 16], [-6.2, -4.3, 11.5]], [1.5, 1.4, 1.15], greenLt);
  ell([1.2, 1.2, 1.0], [-6.4, -4.5, 11], greenLt);
  handclaws([-6.6, -4.7, 10.8], [[-1.3, -0.8, -1.7], [0.1, 0, -1.7], [1.3, 0.8, -1.3]]);
  // Far arm (the creature's left).
  chain([[2.5, -1.5, 23], [6.2, -1.2, 17.5], [3.4, -5, 13.5]], [1.5, 1.3, 1.0], green);
  ell([1.1, 1.1, 1.0], [3, -5.2, 12.8], green);
  handclaws([2.7, -5.4, 12.3], [[-1.2, -0.7, -1.8], [0, 0, -2.0], [1.0, 0.6, -1.5]]);

  // ---- Legs: digitigrade, thick thighs, thin shins, long clawed feet on the ground.
  // Far leg (the creature's left): the lit thigh, the foot turned outward.
  ell([2.3, 2.8, 3.6], [4.3, 2.2, 12.5], greenLt);
  chain([[5.2, 3.2, 9.5], [6, 3.4, 6], [6, 3.2, 4.2]], [1.7, 1.1, 1.0], greenLt);
  limb([4.8, 3.3, 4.0], [8.2, 3, 3.5], 1.1, 0.8, greenLt);
  claws([8.4, 3, 3.4], [1, 0, -0.15], 1.6, 1.3);
  // Near leg (the creature's right): in shadow, stepping forward, the foot pointing to its right.
  ell([2.2, 2.8, 3.4], [-2.8, 0.5, 12], green);
  chain([[-2.3, -0.8, 9], [-2.8, -2.2, 5.5], [-2.9, -2.4, 4.2]], [1.6, 1.1, 1.0], green);
  limb([-3, -2.5, 3.9], [-5.8, -4.2, 3.5], 1.0, 0.8, green);
  claws([-6, -4.4, 3.4], [-0.75, -0.65, -0.15], 1.6, 1.5);

  // ---- Tail: thick from the hips, out to the creature's left and curling up at the tip.
  T = [[0.5, 2, 12], [4, 4, 12], [7, 5.5, 12], [9.5, 6, 12.3], [10.5, 5.5, 13.6], [10.3, 4.6, 15.5], [9.8, 4.0, 17.0]];
  chain(T, [3.0, 2.6, 2.2, 1.8, 1.5, 1.4, 0.6], greenLt);
  for (i = [1 : 4]) spike(T[i] + [0, 0, [2.6, 2.2, 1.8, 1.4][i - 1] * 0.75], [0, 0.3, 1.3], 0.4, 0.05, greenLt);

  // ---- Left wing (viewer's left, the creature's right, -X), in the picture plane behind the shoulders.
  inplane(2.5) {
    // Outer and inner panels (deep blue), the bright patch on the inner one, the small panel by the arm.
    mplate([[-11.4, 32.1], [-11.2, 31.4], [-12.1, 29.4], [-12.8, 29], [-14.1, 25], [-14.3, 22.7], [-15, 22.1], [-15, 13.9], [-14.5, 13.6], [-13.9, 8.7], [-12.8, 8.5], [-13.4, 8.1], [-13.2, 6.5], [-17, 13.8], [-17.9, 14.5], [-19, 14.1], [-19, 15.6], [-16.6, 24.3], [-14.5, 28.6], [-11.4, 31.9]], 0.5, blue);
    mplate([[-10.3, 30.1], [-9.4, 30.1], [-9.2, 24.3], [-8.6, 24.1], [-8.6, 22.8], [-6.3, 20.1], [-4.7, 19.6], [-4.7, 19], [-5.7, 18.7], [-5.4, 16.7], [-6.8, 17], [-7.6, 16.5], [-7.6, 15.4], [-8.3, 15.4], [-9.4, 16.7], [-10.8, 16.7], [-12.1, 15.6], [-12.5, 14.1], [-13.4, 13.6], [-13.7, 14.1], [-13.6, 22.5], [-11.7, 28.3], [-11.4, 28.8], [-9.7, 29], [-11, 29.4], [-10.3, 29.9]], 0.5, blue);
    translate([0, -0.3, 0]) mplate([[-9.8, 24], [-9.2, 21], [-9.6, 18.5], [-11.2, 17.3], [-13, 18.4], [-13.2, 22], [-11.6, 26.6]], 0.3, blueBright);
    plate([[-8.1, 27.4], [-7.6, 25.7], [-6.7, 25], [-4.3, 21.6], [-5.2, 21.6], [-7.6, 23.9]], 0.5, 0.15, blueDk, 0);
    // Dark leading edge from the elbow to the far tip; the green bones: arm up to the elbow, F2 down to the bottom
    // tip, F3 down the middle.
    mplate([[-10.5, 33.4], [-14.6, 28.6], [-16.8, 24.3], [-19, 16.7], [-18.8, 13.8], [-19.5, 13], [-19.5, 11.8], [-19.9, 15.8], [-17.2, 25], [-14.5, 29.6], [-10.6, 33.2]], 0.7, ink);
    chain([[-3.2, 0, 22], [-4.5, 0, 29], [-5.8, 0, 35.8]], [1.3, 1.2, 1.1], green);
    ell([1.0, 0.9, 1.0], [-6.0, 0, 35.8], green);
    mplate([[-14.1, 21.4], [-13.7, 21.4], [-13.9, 14.1], [-13, 13.4], [-13.4, 12.5], [-13, 8.7], [-12.4, 6.2], [-11.8, 4.9], [-12.6, 5.2], [-13.7, 8.7], [-14.3, 11.6], [-14.1, 21.2]], 0.6, ink);
    limb([-6.5, 0, 35.5], [-10.6, 0, 32.9], 0.9, 0.7, green);
    chain([[-7.8, 0, 34.3], [-11.2, 0, 30.3], [-14.3, 0, 18], [-13.4, 0, 9], [-12.6, 0, 5.4]], [0.9, 0.9, 0.75, 0.5, 0.2], green);
    chain([[-7.8, 0, 33.5], [-8.8, 0, 27], [-7.6, 0, 23.4]], [0.85, 0.7, 0.55], green);
  }

  // ---- Right wing (viewer's right, the creature's left, +X).
  inplane(2.5) {
    mplate([[11.5, 32.1], [11.9, 31.2], [14.4, 29], [17.1, 23.7], [18.8, 17.9], [19, 14.1], [19.7, 12.7], [19.5, 11.4], [19.1, 13.8], [18, 13.9], [13.7, 7.2], [13.3, 7.2], [13.9, 9.4], [15, 12.1], [15, 23.2], [14.4, 23.4], [13.3, 28.1], [12.8, 28.3], [13, 29], [11.3, 31.9]], 0.5, blue);
    mplate([[10.1, 31], [10.6, 31], [11.5, 29.2], [13.3, 24.1], [13.9, 21.6], [14.2, 14.1], [13.5, 9.9], [12.8, 15], [11.7, 16.7], [10.2, 16.7], [8.8, 15.8], [7.3, 17], [6.1, 17], [4.1, 15.6], [3.2, 15.4], [2.4, 16.7], [3.9, 18.8], [5.3, 19.4], [6.4, 21], [8.2, 22.1], [8.8, 23.2], [8.6, 25], [9.1, 25.4], [9.1, 29.7], [10.1, 30.1]], 0.5, blue);
    translate([0, -0.3, 0]) mplate([[9.6, 24.5], [9.6, 20.5], [10.8, 17.8], [12.6, 18.4], [13.2, 22.5], [11.8, 26.8]], 0.3, blueBright);
    plate([[7.5, 27.6], [7.7, 25], [7, 23.2], [5.3, 21.7], [4.2, 21.6], [3.9, 20.8], [2.6, 20.8], [5.9, 23.9], [7.3, 27.4]], 0.5, 0.15, blueDk, 0);
    mplate([[10.4, 33.2], [11.7, 32.6], [14.8, 29.6], [17.5, 25], [18.6, 20.3], [19.3, 19.2], [19.5, 16.3], [20, 16.1], [20, 11.4], [19.1, 14.1], [18.2, 21], [16.8, 25], [14.6, 29], [12.1, 31.2], [11.7, 32.3], [11, 32.1], [10.6, 33.2]], 0.7, ink);
    chain([[3, 0, 22], [7.3, 0, 23], [8.2, 0, 30], [7.0, 0, 35]], [1.3, 1.0, 0.9, 0.9], green);
    ell([1.0, 0.9, 1.0], [7.2, 0, 35.1], green);
    limb([7.6, 0, 34.9], [10.6, 0, 32.9], 0.9, 0.7, green);
    chain([[8.0, 0, 34.2], [11, 0, 31], [14.4, 0, 20], [14.2, 0, 12], [11.5, 0, 4.3]], [0.9, 0.9, 0.8, 0.5, 0.2], green);
    mplate([[13.7, 14.1], [14.4, 13.9], [14.6, 11.9], [13.1, 7.2], [13.5, 6.5], [12.6, 5.4], [11.9, 5.4], [13, 9.8], [13.7, 9.9], [13.9, 13.9]], 0.6, ink);
  }
}

translate([0, 0, -FOOT]) creature();
