// Serpyre: a green sea-serpent coiled on its tail, cream belly, a frosty white ruff, a spiky blue mane with an orange
// horn, red eyes and fangs, small clawed arms and a tail tip that rises behind it.
include <lib.scad>

green = [0.18, 0.5, 0.36];
greenDk = [0.1, 0.34, 0.25];
greenHi = [0.3, 0.64, 0.45];
belly = [0.82, 0.86, 0.6];
bellyDk = [0.66, 0.72, 0.45];
mane = [0.16, 0.28, 0.6];
maneHi = [0.28, 0.42, 0.78];
horn = [0.92, 0.6, 0.18];
ruff = [0.9, 0.95, 1];
ruffDk = [0.62, 0.75, 0.86];
claw = [0.9, 0.95, 0.97];

// Coil: a ring of tail lying on the ground, wound around behind the upright body.
coil = [for (a = [-100 : 30 : 230]) [7.5 * cos(a) + 1.5, 6 * sin(a) + 2.5, 3.2 + 0.01 * (a + 100)]];
chain(coil, [for (i = [0 : len(coil) - 1]) 3.8 - i * 0.12], green);
// Darker segment bands across the coil.
for (i = [1 : len(coil) - 2]) {
  a = -100 + i * 30;
  color(greenDk) translate(coil[i]) rotate([0, 0, a]) scale([1, 0.25, 1]) sphere(3.85 - i * 0.12, $fn = 16);
}
// Cream underside along the outer bottom edge of the coil, so the ring reads as a belly-down snake, not a hose.
coilBelly = [for (i = [0 : len(coil) - 1]) let(a = -100 + i * 30, r = 3.8 - i * 0.12) coil[i] + [cos(a), sin(a), 0] * r * 0.5 + [0, 0, -r * 0.42]];
chain(coilBelly, [for (i = [0 : len(coil) - 1]) (3.8 - i * 0.12) * 0.6], belly);
// A low dark ridge of fin-scutes along the top of the coil.
for (i = [1 : len(coil) - 2]) let(a = -100 + i * 30, r = 3.8 - i * 0.12)
  color(greenDk) translate(coil[i] + [0, 0, r * 0.88]) rotate([0, 0, a]) scale([0.5, 1.6, 0.9]) sphere(1, $fn = 8);
// Tail rising up behind on the viewer's right, ending in a leaf fin.
tailEnd = coil[len(coil) - 1];
chain([tailEnd, [10, 6, 6], [11.5, 7, 11], [11.8, 7, 16]], [2.4, 1.8, 1.3, 0.9], green);
petal([0.9, 0.5, 3], [11.9, 7, 18.5], [0, 0, 0], greenDk);
color(greenDk) translate([11.9, 7, 17]) for (s = [-1, 1]) rotate([0, s * 50, 0]) scale([0.4, 0.4, 1.6]) sphere(1.3, $fn = 10);

// Upright body rising out of the coil, curving up to the neck.
chain([[-2, -3, 4], [-3, -3.5, 10], [-2.5, -2.5, 15], [-1, -1, 20]], [4.6, 4, 3.3, 2.8], green);
// Cream belly plates.
blob([[[3.4, 2, 4], [-2.8, -6, 6.5]], [[2.4, 1.8, 3.5], [-2.2, -4.4, 15]]], belly);
for (z = [5, 8, 11, 14]) color(bellyDk) translate([-2.7 + (z - 5) * 0.06, -7.7 + (z - 5) * 0.27, z]) scale([2.8, 0.4, 0.2]) sphere(1, $fn = 12);

// Frost ruff around the neck: jagged white petals.
for (a = [0 : 30 : 330]) {
  color(a % 60 == 0 ? ruff : ruffDk) translate([-1, -1, 21]) rotate([0, 0, a]) translate([3.4, 0, 0]) rotate([0, 100, 0]) cylinder(h = 3.8, r1 = 1.9, r2 = 0.1, $fn = 8);
}
color(ruff) translate([-1, -1, 21]) scale([1, 1, 0.45]) sphere(4.8, $fn = 24);

// Eye sunk into the skull: turned `yaw` outward along the skin and squashed front-to-back so only its face shows, set
// in a dark socket under a hard brow ridge of the skin colour that slants down to the snout, so the face itself scowls.
module socket_eye(p, size, yaw, iris, sclera, pupil, skin, sock, lid = 0.5, tilt = 30, squash = 0.6) {
  translate(p) rotate([0, 0, yaw]) {
    color(sock) translate([0, size * 0.45, -size * 0.05]) scale([1.14, 0.55, 1.12]) sphere(size, $fn = 20);
    scale([1, squash, 1]) eye([0.01, 0, 0], size, iris = iris, sclera = sclera, pupil = pupil, lid = lid, lid_tilt = tilt,
                              lid_c = skin, slit = 0.35);
    // The ridge is a wedge rooted behind the eye, so it reads as a ledge of the skull, not a stuck-on bar.
    color(skin) hull() {
      translate([size * 0.8, size * 0.25, size * 0.78]) scale([0.32, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([-size * 0.9, -size * 0.45, size * 0.12]) scale([0.36, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([0, size * 0.9, size * 0.45]) scale([0.9, 0.5, 0.4]) sphere(size, $fn = 12);
    }
  }
}

// Head: snouted, tilted slightly to the viewer's left.
translate([-1.5, -1.5, 26]) rotate([0, 0, -10]) scale(1.35) {
  blob([[[3.8, 4.2, 3.6], [0, 0.5, 0]], [[2.6, 3, 2.2], [0, -4.2, -1]]], green);
  // Lower jaw, paler.
  blob([[[2.6, 3, 1.2], [0, -1, -2.6]], [[1.8, 2.2, 0.9], [0, -4.2, -2.6]]], belly);
  // Fangs.
  mirror_x() spike([1.6, -5.8, -1.8], [0, 0, -1.6], 0.45, 0.05, claw);
  mirror_x() ell([0.3, 0.25, 0.3], [0.9, -7, -0.2], greenDk);
  // Red slit eyes sunk in dark sockets under a hard green brow.
  mirror_x() socket_eye([2.1, -3.7, 0.9], 1.5, 26, [1, 0.1, 0.08], [1, 0.85, 0.6], [0.15, 0, 0], green, [0.05, 0.12, 0.08],
                        lid = 0.36, tilt = 30);
  // Spiky blue mane fanning back from the crown.
  for (m = [[0, 1, 3, 0, -30, 6.5], [1.8, 1.5, 2.5, 18, -48, 6], [-1.8, 1.5, 2.5, -18, -48, 6], [2.6, 2.5, 0.5, 35, -72, 5.5],
            [-2.6, 2.5, 0.5, -35, -72, 5.5], [0, 3, 1.5, 0, -70, 7], [1.8, 3.5, -1, 22, -100, 5], [-1.8, 3.5, -1, -22, -100, 5],
            [0, 3.5, -1.5, 0, -110, 5]]) {
    color(mane) translate([m[0], m[1], m[2]]) rotate([0, 0, -m[3]]) rotate([m[4], 0, 0]) scale([1, 0.45, 1]) cylinder(h = m[5] * 1.15, r1 = 1.8, r2 = 0.1, $fn = 10);
  }
  ell([3.2, 3.2, 2], [0, 2.2, 2.6], maneHi);
  // Orange horn on the snout bridge, swept back.
  color(horn) translate([0, -1.6, 2.6]) rotate([-15, 0, 0]) scale([0.5, 1.4, 1]) cylinder(h = 5, r1 = 1.5, r2 = 0.2, $fn = 12);
}

// Small arms with white claws.
mirror_x() {
  chain([[2.5, -4.5, 16], [5.5, -6.5, 15], [7, -7.5, 17]], [1.2, 1, 0.9], green);
  for (a = [-30, 0, 30]) spike([7 + sin(a), -7.8, 17.2], [sin(a) * 0.6, -0.6, -1.4], 0.35, 0.05, claw);
}
