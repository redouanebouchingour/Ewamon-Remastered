// Glacinid: a pale-blue ice serpent in a thick W-coil: its neck rears up at the front, its tail rises at the back, and
// branching frost antlers and fronds grow from its head, spine and tail; a violet crystal crowns its head.
include <lib.scad>

ice = [0.72, 0.82, 0.95];
iceHi = [0.88, 0.94, 1];
iceDk = [0.52, 0.64, 0.85];
belly = [0.66, 0.66, 0.88];
frost = [0.62, 0.78, 0.94];
violet = [0.38, 0.22, 0.6];
violetHi = [0.6, 0.45, 0.85];
web = [0.5, 0.6, 0.84];
eyeC = [0.35, 0.85, 1, GLOW];

function nrm(v) = v / norm(v);
function perp(d) = let(c = cross(d, [0, 0, 1])) norm(c) < 0.001 * norm(d) ? [1, 0, 0] : nrm(c);

// Branching frost coral: a faceted ice rib from p along d that forks into two smaller ribs, `depth` times, nearly in
// one plane like a sea fan. Each fork is webbed with a thin, darker ice plate between the ribs, and the ribs carry
// knuckles at the forks, so the fronds read as a plated lattice rather than round twigs.
module branch(p, d, r, depth, spin = 0) {
  color(frost) hull() { translate(p) sphere(r, $fn = 6); translate(p + d) sphere(r * 0.65, $fn = 6); }
  if (depth > 0) {
    u = perp(d);
    w = nrm(cross(nrm(d), u));
    side = u * cos(spin) + w * sin(spin);
    kids = [for (s = [-1, 1]) (nrm(d) * cos(40) + side * s * sin(40)) * norm(d) * 0.7];
    color(iceHi) translate(p + d) sphere(r * 0.85, $fn = 6);
    // Web: a thin plate filling the fork almost out to the tips of the child ribs.
    color(web) hull() {
      translate(p + d * 0.35) sphere(r * 0.25, $fn = 4);
      for (k = kids) translate(p + d + k * 0.92) sphere(r * 0.25, $fn = 4);
    }
    for (k = kids) branch(p + d, k, r * 0.62, depth - 1, spin + 12);
    // A short spur straight on.
    color(frost) hull() { translate(p + d) sphere(r * 0.55, $fn = 6); translate(p + d * 1.45) sphere(0.12, $fn = 4); }
  }
}

// Serpent body: a thick, heavy W-coil. The neck rears up at the front (viewer's left), the body drops to the ground,
// arches up in the middle, dips again and climbs into the tail at the back right.
pts = [[-9, -6, 23], [-9.5, -6.5, 15], [-8, -4, 7.5], [-3, -1, 5], [2, 1.5, 7.5], [6.5, 3, 8.5], [11, 4, 6], [15.5, 5, 5.5],
       [19.5, 6, 9], [21.5, 6.5, 15], [20.5, 6.5, 21], [21.5, 7, 26], [24, 7.5, 29.5]];
rs = [5, 5.8, 6.2, 5.8, 5.4, 5.2, 5, 4.8, 4.4, 3.8, 3.2, 2.4, 1.2];
let($fn = 20) chain(pts, rs, ice);
// Lavender underbelly along the front of the neck and the bottom of the coil.
let($fn = 16) chain([[-9, -10.4, 19], [-9.4, -11.6, 13], [-7.6, -9, 5.8], [-3, -5.8, 2.6], [2, -3.4, 4], [6.5, -1.8, 5], [11, -0.4, 2.8], [15.5, 1, 2.2]],
      [3, 3.6, 3.8, 3.4, 3.2, 3, 2.8, 2.4], belly);
// Ice plates shingled over the coil: flat faceted shards lying on the skin along the flanks and the back, alternating
// pale and deep blue, so the body reads plated like the sprite instead of as a smooth tube.
for (i = [0 : len(pts) - 4]) for (k = [0 : 2]) for (sd = [-1, 1]) let(t = (k + 0.5) / 3, a = pts[i], b = pts[i + 1],
                                                                    c = a + (b - a) * t, r = rs[i] + (rs[i + 1] - rs[i]) * t,
                                                                    dn = nrm(b - a), sv = perp(b - a),
                                                                    up = nrm(cross(sv, dn)),
                                                                    ang = 25 + ((i * 3 + k * 5) % 4) * 20,
                                                                    n = sv * sd * cos(ang) + up * sin(ang) * (up[2] < 0 ? -1 : 1),
                                                                    q = c + n * (r * 0.97))
  if (!(i < 3 && sd == -1 && ang < 50)) color((i + k) % 2 ? iceHi : iceDk) translate(q) rotate(_dir_rot(n))
    scale([r * 0.42, r * 0.32, 0.35]) rotate([0, 0, 30]) cylinder(h = 1, r = 1, center = true, $fn = 6);
// Ice-plate ridges: pale chevrons down the neck.
for (i = [0 : 3]) color(iceHi) translate([-9, -11.2 - (i < 2 ? 0.6 : 0.4), 21 - i * 4]) rotate([10, 0, 0]) scale([3.4, 1, 1]) sphere(1, $fn = 12);

translate([-9, -6.5, 22]) scale(1.8) translate([0, 8, -27]) {
// Head: a dragon's wedge on top of the neck, a long snout, a pale jaw.
color(ice) hull() {
  translate([0, -8.4, 29.4]) scale([4.4, 4.4, 4]) sphere(1, $fn = 22);
  translate([0, -13, 28.2]) scale([3.2, 3.2, 2.6]) sphere(1, $fn = 16);
  translate([0, -16.8, 27.6]) scale([1.8, 1.6, 1.5]) sphere(1, $fn = 12);
}
color(belly) hull() {
  translate([0, -10, 26.4]) scale([3, 3, 1.6]) sphere(1, $fn = 14);
  translate([0, -15.6, 26.6]) scale([1.4, 1.4, 0.9]) sphere(1, $fn = 10);
}
mirror_x() ell([0.35, 0.3, 0.3], [1, -18.3, 28.4], iceDk);
// Brow ridges running back from the eyes into the crown.
mirror_x() color(iceHi) hull() { translate([1.6, -14, 30.9]) sphere(0.6, $fn = 8); translate([3.6, -10.6, 31.8]) sphere(0.8, $fn = 8); translate([3.4, -7, 32.4]) sphere(0.9, $fn = 8); }
// Narrow, icy eyes.
// Narrow, icy eyes: glowing cyan in a deep blue socket, sunk under the brow ridge.
mirror_x() {
  color(iceDk) translate([2.75, -12.5, 29.7]) rotate([0, 0, -32]) scale([1.9, 0.9, 1.5]) sphere(1, $fn = 14);
  eye([2.4, -13, 29.7], 1.5, iris = eyeC, pupil = [0.08, 0.15, 0.4], sclera = [0.2, 0.32, 0.62], yaw = -32, flat = 0.4,
      lid = 0.45, lid_tilt = 28, lid_c = ice, slit = 0.35);
}
// Spiky frill: ice spikes fanning back from the cheeks and jaw.
mirror_x() for (k = [0 : 3]) spike([4, -9.6 + k * 1.3, 29 - k * 1.2], [3.4, 2, 1 - k * 0.6], 0.9, 0.05, iceHi);

// Violet crystal crown on the head.
for (c = [[0, 0, 7, 1.8], [-1.6, 0.6, 5, 1.4], [1.6, 0.6, 5, 1.4], [0, 1.8, 5.4, 1.4], [-0.8, -1.4, 4.4, 1.2], [0.9, -1.2, 4.2, 1.2]]) {
  spike([c[0], -8.2 + c[1], 32.6], [c[0] * 0.5, c[1] * 0.4, c[2]], c[3], 0.15, violet);
}
color(violetHi) translate([-0.4, -9.4, 35.4]) scale([0.3, 0.2, 1.4]) sphere(1, $fn = 8);

// Frost antlers branching out of the head.
mirror_x() let($fn = 8) branch([3, -7, 32], [2.4, 1.4, 3.6], 0.8, 2, 20);
}

// Frosty mane: a ruff of ice spikes round the top of the neck, flaring back.
for (a = [-150 : 25 : 150]) let(dx = sin(a), dy = -cos(a))
  spike([-9 + dx * 4.4, -6 + dy * 4, 22], [dx * 4.4, dy * 1.6 + 3, 1.4], 1.6, 0.08, iceHi);
for (a = [-120 : 40 : 120]) let(dx = sin(a), dy = -cos(a))
  spike([-9 + dx * 5, -6 + dy * 4.6, 17], [dx * 4, dy * 1.4 + 3, 0.4], 1.4, 0.08, iceHi);

// Coral: dense, chunky frost fronds growing up off the spine of the coil, the biggest on the two arches, and a frost
// tree fanning out of the tail tip.
module coral(p, d, r, depth, spin) let($fn = 7) branch(p, d, r, depth, spin);
// The middle arch: short fronds leaning back and out, a low ragged crest.
for (f = [[[-5, 0, 10], [-1.8, 3, 5], 1.2, 2, 0], [[-1, 2, 11.2], [-1, 3.4, 5.4], 1.3, 2, 40], [[3, 3, 12.6], [1, 3, 6], 1.3, 2, 80],
          [[7, 4, 12.6], [1, 3, 6], 1.3, 2, 10], [[10.5, 5, 10.6], [1.6, 3, 5], 1.2, 2, 60], [[14, 6, 9.6], [-1, 3, 5], 1.2, 2, 30],
          [[1, 5.5, 8], [0, 5, 2.4], 1, 1, 90], [[9, 7.5, 7], [0, 5, 2.4], 1, 1, 90]])
  coral(f[0], f[1], f[2], f[3], f[4]);
// The tail: a tall frost tree, branches fanning up and out all the way up its rising curve.
for (f = [[[18.5, 8.5, 11], [-2.4, 1.6, 5.4], 1.5, 3, 20], [[23.5, 7.5, 13], [3.6, 1, 4], 1.4, 3, 70], [[22.5, 8.5, 18], [-2.8, 1.6, 5], 1.4, 3, 10],
          [[22.5, 7, 21], [3.6, 1.2, 4.4], 1.3, 3, 50], [[20.5, 8.4, 25], [-2.8, 1.4, 4.6], 1.2, 3, 0], [[23, 7.5, 27], [3, 0.6, 4], 1.1, 2, 30],
          [[24, 7.5, 29.5], [0.6, 0.6, 5], 1.1, 3, 60], [[19.5, 4, 15], [0, -3.6, 3], 1.1, 2, 90]])
  coral(f[0], f[1], f[2], f[3], f[4]);
// Flat ice plates standing along the spine between the fronds, like a crest of shards.
for (s = [[-4.5, 0.4, 9.6], [1, 2, 11.4], [5, 3.4, 12.4], [9, 4.4, 11.4], [12.5, 5.4, 9.8], [16.5, 6.2, 10]])
  color(iceHi) hull() { translate(s) scale([0.7, 2.6, 1]) sphere(1, $fn = 8); translate(s + [0, 1.4, 4]) sphere(0.15, $fn = 4); }

// Small ice claws under the coil.
for (p = [[-11.4, -5, 1], [-5, -4, 1], [12, 0.4, 1], [17.5, 5, 1.2]]) {
  color(ice) translate(p + [0, 0, 0.8]) scale([1.6, 1.8, 1.6]) sphere(1, $fn = 12);
  for (a = [-25, 25]) spike(p + [sin(a), -1.6, 0], [sin(a) * 0.6, -1.2, -0.4], 0.45, 0.05, iceHi);
}
