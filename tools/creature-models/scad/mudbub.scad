// Mudbub: a round, squat brown mud toad with a cream throat and belly, olive-grey mud spots, bulging eyes on top,
// a wide grin and a stubby paddle tail.
include <lib.scad>

skin = [0.62, 0.43, 0.28];
skinDark = [0.47, 0.32, 0.21];
spot = [0.52, 0.54, 0.44];
cream = [0.93, 0.87, 0.72];
mouth = [0.22, 0.13, 0.09];
iris = [0.72, 0.52, 0.2];

// Body and head as one round lump.
blob([[[12, 10.5, 9], [0, 1, 10]], [[10.5, 9, 7], [0, -0.5, 18]], [[9.5, 8, 4], [0, -1, 23]]], skin);
// Cream belly and throat, set into the front.
blob([[[7.5, 4, 8], [0, -6.4, 10.5]], [[8.6, 3.4, 2.8], [0, -6.4, 18.6]]], cream);

// Eye bumps on top of the head, eyes looking forward.
mirror_x() {
  ell([3.4, 3.2, 3.2], [5, -4, 26], skin);
  eye([5.3, -6.6, 26.4], 2.5, iris = iris, pupil = [0.08, 0.06, 0.05], sclera = [0.98, 0.95, 0.85], yaw = -15, flat = 0.6);
}
// Nostrils.
mirror_x() ell([0.45, 0.3, 0.35], [1.4, -9.3, 23.3], mouth);
// Wide grin: a dark curve across the face, upturned at the corners.
function grin(x) = [x, -9.6 + x * x * 0.03, 21.3 + x * x * 0.018];
chain([for (i = [-4 : 4]) grin(i * 2)], [for (i = [-4 : 4]) 0.45], mouth);

// Mud spots over the back and sides: [azimuth, elevation, size], mirrored.
spots = [[60, 10, 2], [90, 30, 2.4], [120, 15, 1.8], [150, 35, 2.2], [30, 40, 1.5], [180, 20, 1.6], [0, 15, 1.5],
         [100, 55, 1.8], [70, -5, 1.4], [135, -10, 1.6], [45, -15, 1.4], [165, 0, 1.4], [20, 25, 1.2], [110, -25, 1.5],
         [80, 70, 1.4], [140, 55, 1.5]];
for (s = spots) {
  az = s[0]; el = s[1]; r = s[2];
  for (m = [0, 1]) mirror([m, 0, 0]) {
    p = [11.7 * cos(el) * cos(az), 1 + 10.2 * cos(el) * sin(az), 13 + 10.5 * sin(el)];
    color(spot) translate(p) rotate([0, 90 - el, az]) scale([1, 1, 0.35]) sphere(r, $fn = 12);
  }
}

// Little arms resting on the belly.
mirror_x() {
  limb([9.5, -3, 16], [8, -7.5, 10.5], 2, 1.6, skin);
  for (a = [-30, 0, 30]) limb([8, -7.8, 10.2], [8 + sin(a) * 1.6, -9.6, 9.6], 0.6, 0.5, skin);
}

// Big haunches and flat feet.
mirror_x() {
  ell([5, 6.5, 5], [9, 1, 6], skin);
  ell([3, 4, 1.2], [8, -4, 1.2], skin);
  for (a = [-35, 0, 35]) limb([8, -5, 1], [8 + sin(a) * 3, -8.5, 0.8], 0.9, 0.8, skin);
}

// Stubby paddle tail out behind, curling to the creature's left.
chain([[3, 9, 5], [8, 14, 5], [12, 16, 8]], [3.5, 3.4, 2.8], skin);
ell([2.4, 3, 1.8], [10, 15, 8.4], spot);
