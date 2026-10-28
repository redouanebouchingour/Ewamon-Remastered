// Wraithtide: a ghostly teal fish wearing a skull for a face, cyan fire in its sockets, ragged fins and a tail fin
// swept back to the viewer's right, and a trail of dark smoke wisps pouring down to the ground.
include <lib.scad>

teal = [0.3, 0.62, 0.6];
tealDk = [0.18, 0.44, 0.45];
tealHi = [0.5, 0.8, 0.76];
glow = [0.3, 1, 0.85];
glowCore = [0.8, 1, 0.95];
bone = [0.88, 0.86, 0.78];
boneDk = [0.62, 0.6, 0.54];
socket = [0.12, 0.16, 0.17];
smoke = [0.33, 0.37, 0.4];
smokeDk = [0.22, 0.25, 0.28];

// Fin: a fan of thin ragged spines between two root points; root p, along direction d with spread.
module fin(p, dirs, len_, c) {
  // Membrane: a thin hull over all the spine tips, then darker spines on top.
  color(c) hull() {
    translate(p) scale([0.35, 1, 1]) sphere(1.4, $fn = 10);
    for (d = dirs) translate(p + d * len_ * 0.9) scale([0.35, 1, 1]) sphere(0.4, $fn = 8);
  }
  for (d = dirs) color(tealDk) hull() {
    translate(p) sphere(0.5, $fn = 8);
    translate(p + d * len_) sphere(0.3, $fn = 8);
  }
}

// Fish body oriented with the head at -Y and the tail toward +X+Y (yaw 75 degrees).
translate([0, 0, 22]) rotate([0, 0, -75]) {
  // Body: a round head bulb tapering to the tail stalk.
  blob([[[8.5, 8.5, 8.5], [0, -2, 0]], [[5, 6, 5.5], [0, 6, 0.5]], [[2, 3, 2.2], [0, 13, 1]]], teal);
  ell([7, 6, 4], [0, -1, 4.5], tealHi);
  // Tail fin, two ragged lobes.
  fin([0, 14, 1], [[0, 0.6, 0.8], [0, 0.8, 0.5], [0, 0.95, 0.1], [0, 0.8, -0.4], [0, 0.6, -0.8]], 10, teal);
  // Dorsal fin: ragged spines along the top.
  fin([0, 0, 8], [[0, -0.2, 1], [0, 0.4, 0.9], [0, 0.8, 0.6], [0, 1, 0.3]], 7, teal);
  // Pectoral fins.
  mirror_x() fin([6.5, 2, -3], [[0.5, 0.6, -0.6], [0.6, 0.75, -0.2], [0.35, 0.8, -0.8]], 6.5, teal);
}

// Skull on the front of the head, slightly to the viewer's left.
translate([-1.5, -7.6, 22.5]) rotate([0, 0, -12]) scale(1.15) {
  // Cranium and jaw.
  blob([[[5.2, 4.4, 4.6], [0, 0, 1]], [[3.8, 3.4, 2.6], [0, -0.6, -2.6]]], bone);
  color(boneDk) translate([0, -2.4, -4.2]) scale([3, 1.2, 0.6]) sphere(1, $fn = 16);
  // Teeth.
  for (x = [-2.1 : 1.05 : 2.1]) color(bone) translate([x, -3.6, -3.6]) cube([0.8, 0.6, 1.4], center = true);
  for (x = [-1.6 : 1.05 : 1.6]) color(socket) translate([x + 0.52, -3.75, -3.6]) cube([0.18, 0.4, 1.4], center = true);
  // Eye sockets with cyan flame eyes.
  mirror_x() {
    color(socket) translate([2, -3.4, 1]) scale([1.7, 1, 1.5]) sphere(1, $fn = 16);
    ell([1.1, 0.5, 1.1], [2, -4.1, 1], glow);
    ell([0.5, 0.3, 0.5], [2, -4.5, 1.1], glowCore);
  }
  // Nose hole.
  color(socket) translate([0, -4, -1.2]) scale([0.6, 0.5, 0.9]) sphere(1, $fn = 10);
  // Cyan wisp rising from the eye on the viewer's left.
  chain([[-3.2, -4, 1.8], [-4.8, -4, 3.6], [-4.2, -3.6, 5.4], [-5.2, -3.2, 6.6]], [1, 0.8, 0.5, 0.2], glow);
  chain([[3.2, -4, 1.8], [4.4, -3.8, 3.4], [4, -3.4, 4.6]], [0.8, 0.5, 0.2], glow);
}

// Smoke: a draping mass under the body that narrows into one curling tail touching the ground, ragged side wisps.
blob([[[7.5, 7, 3], [0, 1, 15]], [[5, 4.5, 3], [-0.5, 0.5, 10]], [[2.6, 2.6, 2], [0.5, 0, 6]]], smoke);
chain([[0.5, 0, 6], [3, -0.5, 3.8], [2, -1, 1.6], [-1, -1.5, 0.8], [-2.5, -1.5, 1.6]], [2.6, 1.9, 1.3, 0.8, 0.4], smoke);
chain([[5, 2, 13], [8, 2, 10.5], [9.5, 1, 9.5]], [2.2, 1.2, 0.4], smokeDk);
chain([[-5, 1, 13], [-7.5, 0.5, 10], [-8.5, 0, 8]], [2.2, 1.2, 0.4], smokeDk);
chain([[2, 5, 12], [3, 7.5, 9], [2, 8.5, 7]], [2, 1.2, 0.4], smokeDk);
chain([[-2, -3, 11], [-3.5, -5, 8], [-3, -5.5, 6]], [1.8, 1, 0.4], smokeDk);
// Teal haze where the smoke meets the body.
ell([8, 7.5, 3.4], [0, 1, 16], tealDk);
