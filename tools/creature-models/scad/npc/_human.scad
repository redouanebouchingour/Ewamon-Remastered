// Shared parametric person for the NPC set (the Mire Route foosball club). A character file is
//   include <_human.scad>
//   human(H = 180, girth = 1.08, hair = "short", beard = "full", ...);
//   human_head() my_hat();          // props in the head's frame (head-local units, see below)
// and its rig is rigs/npc/<id>.mjs on top of rigs/npc/_human.mjs, which mirrors the landmarks below: keep the two in
// sync (the pivots in `human_pivots()` / `pivots()` of the mjs are the same formulas).
//
// Frame: 1 unit = 1 cm, Z up, feet on z = 0 (the soles are cut flat at 0), the person faces -Y, +X is their own left.
// Rest pose: standing straight, arms hanging slightly out. The rig poses everything (rigs/npc/_human.mjs).
//
// Rigid skinning, so every moving part is its own CLOSED shell: a parent piece is cut by its child grown by GAP
// (`difference() { parent(0); child(GAP); }`), which leaves a socket instead of a hole when the child turns, and keeps
// the shells apart in the union (the rig assigns whole shells to joints). Pieces of different joints that are not
// parent and child must not touch in the rest pose (they would fuse into one shell).
//
// Body landmarks are authored for H = 178, girth = 1 and scaled by [s * girth, s * girth, s] (s = H / 178). The head is
// authored in its own unit frame (origin = skull centre, skull radii SKULL) and scaled by hk = s * head.
include <../lib.scad>

GAP = 0.15;
$fa = 12;
$fs = 1.1;
SKULL = [13, 13.5, 16.5];
MOUTH_TOP = -7.2;      // head-local z of the mouth's flat top edge (upper teeth just under it)
MOUTH_W = 6.3;         // half width of the grin
MOUTH_H = 5.3;         // depth of the grin's round bottom below MOUTH_TOP

// ---- landmarks (keep in sync with rigs/npc/_human.mjs) -------------------------------------------------------------

function hs_s(H) = H / 178;
function hs_hk(H, head) = hs_s(H) * head * 1.18;   // memoji: the head is ~1/5 of the height
// head-local origin (skull centre) in world coordinates
function hs_hc(H, head) = [0, 0, 145 * hs_s(H)] + [0, -1, 15] * hs_hk(H, head);
// base body landmarks (H = 178, girth 1)
B_SHOULDER = [18.5, 0, 133];
B_ARM = [4, 0, -54];                 // shoulder -> wrist at rest
B_ELBOW = B_SHOULDER + B_ARM * (29 / 54);
B_WRIST = B_SHOULDER + B_ARM;
B_FIST = B_WRIST + [0.33, 0, -4.5];
B_HIP = [9, 0, 86];
B_KNEE = [9.5, -0.5, 47];
B_ANKLE = [9.5, 0, 9];

// head-local front surface of the skull at (x, z): its y
function ys(x, z) = -SKULL[1] * sqrt(max(0, 1 - pow(x / SKULL[0], 2) - pow(z / SKULL[2], 2)));

// ---- the person -------------------------------------------------------------------------------------------------

module human(
  H = 178, head = 1, girth = 1, belly = 0,
  skin = [0.98, 0.8, 0.68], blush = [0.95, 0.66, 0.58],
  hair = "short", hair_c = [0.36, 0.22, 0.12],
  beard = "none", beard_c = undef, mustache = undef, brow_c = undef,
  eye_c = [0.3, 0.5, 0.8], mouth = "grin",
  shirt_c = [0.3, 0.45, 0.75], sleeve = "short", cuff_c = undef,
  pants_c = [0.24, 0.32, 0.5], shoe_c = [0.95, 0.95, 0.95], sole_c = [0.55, 0.55, 0.58]
) {
  s = hs_s(H);
  hk = hs_hk(H, head);
  hc = hs_hc(H, head);
  bs = [s * girth, s * girth, s];
  bc = beard_c == undef ? hair_c : beard_c;
  wc = brow_c == undef ? hair_c * 0.85 : brow_c;
  musta = mustache == undef ? (beard == "full" || beard == "short") : mustache;
  armc = sleeve == "long" ? shirt_c : skin;
  cuff = cuff_c == undef ? shirt_c * 0.85 : cuff_c;

  // --- body pieces in base coordinates (H = 178), `gr` grows every radius ---
  module pelvis(gr) blob([[[12.8, 9.6, 6.5] + [gr, gr, gr], [0, 0.5, 94]], [[13.8, 9.8, 6] + [gr, gr, gr], [0, 0.5, 88.5]],
                          [[10, 8, 4] + [gr, gr, gr], [0, 0.3, 83]]], pants_c);
  module spine(gr) {
    blob([[[14, 10.4, 6] + [gr, gr, gr], [0, 0.3, 99.5]], [[14.8, 10.8, 8] + [gr, gr, gr], [0, -0.3, 107]],
          [[13.2, 11 + 3 * belly, 8.5] + [gr, gr, gr], [0, -1 - 2.5 * belly, 104.5]]], shirt_c);
  }
  module chest(gr) blob([[[15.6, 10.6, 8] + [gr, gr, gr], [0, -0.3, 116]], [[17.2, 10.2, 8] + [gr, gr, gr], [0, 0.2, 125]],
                         [[15.5, 8.8, 5] + [gr, gr, gr], [0, 0.8, 132]], [[9, 7, 4] + [gr, gr, gr], [0, 1, 136]]], shirt_c);
  module neck(gr) limb([0, 0.5, 134], [0, 0.5, 149], 5.6 + gr, 5.2 + gr, skin);
  module uarm(m, gr) mirror([m, 0, 0]) {
    sl = B_SHOULDER + B_ARM * (sleeve == "none" ? 0.12 : 0.33);
    if (sleeve != "none") {
      limb(B_SHOULDER, sl, 7.0 + gr, 6.6 + gr, shirt_c);
      color(shirt_c) translate(sl) rotate([0, -4.2, 0]) scale([6.85 + gr, 6.85 + gr, 1.3 + gr]) sphere(1, $fn = 28);
    } else limb(B_SHOULDER, sl, 6.2 + gr, 5.6 + gr, skin);
    limb(B_SHOULDER + B_ARM * 0.2, B_ELBOW, 5.4 + gr, 4.9 + gr, sleeve == "long" ? shirt_c : skin);
  }
  module farm(m, gr) mirror([m, 0, 0]) {
    limb(B_ELBOW, B_WRIST, 4.8 + gr, 3.9 + gr, armc);
    if (sleeve == "long") color(cuff) translate(B_WRIST + B_ARM * 0.03) rotate([0, -4.2, 0]) scale([4.35 + gr, 4.35 + gr, 1.4 + gr]) sphere(1, $fn = 24);
  }
  module hand(m, gr) mirror([m, 0, 0]) color(skin) {
    // a fist around B_FIST: knuckles forward (-Y), thumb wrapped over the front-inner side
    hull() {
      translate(B_FIST + [0, 0.2, 0.6]) scale([3.8 + gr, 4.2 + gr, 4.4 + gr]) sphere(1, $fn = 22);
      translate(B_FIST + [0, -1.0, -2.6]) scale([3.5 + gr, 3.5 + gr, 2.0 + gr]) sphere(1, $fn = 22);
    }
    translate(B_FIST + [-2.8, -2.8, 0.4]) rotate([0, 20, -20]) scale([1.6 + gr, 1.7 + gr, 2.9 + gr]) sphere(1, $fn = 14);
  }
  module thigh(m, gr) mirror([m, 0, 0]) limb(B_HIP, B_KNEE, 7.6 + gr, 6.4 + gr, pants_c);
  module shin(m, gr) mirror([m, 0, 0]) {
    limb(B_KNEE, B_ANKLE + [0, 0, 2.5], 6.0 + gr, 5.2 + gr, pants_c);
    color(pants_c) translate(B_ANKLE + [0, 0, 2.6]) scale([5.9 + gr, 6.1 + gr, 2.0 + gr]) sphere(1, $fn = 26);
  }
  module shoe(gr) let(x = B_ANKLE[0]) hull() {
      translate([x, 1.8, 6]) scale([4.5 + gr, 5 + gr, 4.6 + gr]) sphere(1, $fn = 24);
      translate([x, -5.5, 3.9]) scale([4.8 + gr, 6.2 + gr, 3.7 + gr]) sphere(1, $fn = 24);
      translate([x, -10.2, 3.2]) scale([4.1 + gr, 3.6 + gr, 3.0 + gr]) sphere(1, $fn = 24);
  }
  module foot(m) mirror([m, 0, 0]) let(x = B_ANKLE[0]) {
    intersection() {
      union() {
        color(shoe_c) shoe(0);
        color(sole_c) intersection() { shoe(0.35); translate([x - 10, -20, -1]) cube([20, 30, 2.6]); }
      }
      color(sole_c) translate([x - 10, -20, 0]) cube([20, 30, 20]);
    }
  }

  // --- head pieces in head-local units ---
  module skull(gr) color(skin) scale(SKULL + [gr, gr, gr]) sphere(1, $fn = 40);
  // the inside of the mouth: dark skin of the lower face, visible through the grin and when the jaw drops
  module mouth_dark(gr) color([0.32, 0.08, 0.1]) intersection() {
    scale(SKULL + [0.06 + gr, 0.06 + gr, 0.06 + gr]) sphere(1, $fn = 40);
    translate([-9, -20, -17.5]) cube([18, 16.5, 17.5 + MOUTH_TOP + 0.4]);
  }
  module teeth(gr) color([0.98, 0.98, 0.96]) intersection() {
    scale(SKULL + [0.55 + gr, 0.55 + gr, 0.55 + gr]) sphere(1, $fn = 40);
    translate([-5.4 - gr, -20, MOUTH_TOP - 1.9 - gr]) cube([10.8 + 2 * gr, 14, 1.75 + 2 * gr]);
  }
  module tache(gr) if (musta) color(bc) for (m = [0, 1]) mirror([m, 0, 0])
    translate([2.9, ys(2.9, -5.3) + 0.6, -5.3]) rotate([0, -12, 10]) scale([4.6 + gr, 2.3 + gr, 1.75 + gr]) sphere(1, $fn = 20);
  module head_core(gr) { skull(gr); mouth_dark(gr); if (mouth == "grin") teeth(gr); tache(gr); }
  module brow(m, gr) mirror([m, 0, 0])
    chain([for (p = [[2.3, 5.5], [5.4, 6.6], [8.7, 6.0]]) [p[0], ys(p[0], p[1]) + 0.25, p[1]]], [1.05 + gr, 1.2 + gr, 0.9 + gr], wc);
  module cap(lift, front, back, grow = [1.1, 1.1, 1.4]) intersection() {
      translate([0, 0, lift]) scale(SKULL + grow) sphere(1, $fn = 40);
      // above a plane through the hairline: z = front at y = -13, back at y = +13.5
      multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, (back - front) / 26.5, 1, front + (back - front) * 13 / 26.5], [0, 0, 0, 1]])
        translate([-30, -30, 0]) cube([60, 60, 40]);
  }
  module hairdo() color(hair_c) {
    if (hair == "short") {
      cap(0.4, 11, -14);
      hull() {
        translate([-3, -9.2, 12.4]) rotate([-25, 0, 0]) scale([6.5, 4, 3.2]) sphere(1, $fn = 20);
        translate([3.5, -5, 14.0]) scale([7, 5, 3]) sphere(1, $fn = 20);
      }
    } else if (hair == "quiff") {
      cap(0.4, 11, -14);
      hull() {
        translate([-1.5, -9.5, 15.2]) rotate([-30, 0, 0]) scale([8.5, 5.5, 4.4]) sphere(1, $fn = 24);
        translate([1.5, -2, 17]) scale([9, 7, 3.4]) sphere(1, $fn = 24);
      }
    } else if (hair == "curtains") {
      cap(0.6, 6.5, -14, [1.4, 1.4, 1.8]);
      for (m = [0, 1]) mirror([m, 0, 0]) hull() {
        translate([1.2, -11.6, 11.5]) rotate([0, 30, 0]) scale([4.5, 2.6, 4.2]) sphere(1, $fn = 20);
        translate([10.4, -7.5, 5.5]) scale([3, 3, 4.2]) sphere(1, $fn = 20);
      }
    } else if (hair == "wavy") {
      cap(0.8, 7.5, -15, [1.8, 1.8, 2.3]);
      for (i = [0 : 4]) let(a = -60 + 30 * i) translate([13 * sin(a), -9 * cos(a) - 1, 14.5 - 1.8 * abs(i - 2)])
        rotate([-30, 0, a]) scale([4.2, 3.4, 3]) sphere(1, $fn = 18);
    } else if (hair == "curly") {
      cap(0.6, 10, -14, [1.2, 1.2, 1.5]);
      for (i = [0 : 15]) let(a = i * 137.5, r = 3 + 9 * sqrt(i / 15), x = r * cos(a), y = r * sin(a) - 1)
        translate([x, y, sqrt(max(0, 1 - pow(x / 14.3, 2) - pow(y / 14.8, 2))) * 17.6 + 0.6])
          sphere(3.1, $fn = 16);
    } else if (hair == "buzz") {
      cap(0.15, 11, -14, [0.45, 0.45, 0.55]);
    }
  }
  module ears() color(skin) for (m = [0, 1]) mirror([m, 0, 0]) {
    translate([12.7, 1.2, -0.5]) rotate([0, 0, -18]) scale([2.2, 3.0, 4.0]) sphere(1, $fn = 20);
  }
  module face() {
    for (m = [-1, 1]) eye([m * 5.3, ys(5.3, 1.6) + 0.75, 1.6], 2.75, iris = eye_c, yaw = m * 16);
    color(blush) translate([0, -13.4, -3.3]) scale([2.4, 2.1, 2.6]) sphere(1, $fn = 22);
    if (beard == "full" || beard == "short") color(bc) for (m = [0, 1]) mirror([m, 0, 0])
      translate([12.35, 0.6, -2.5]) scale([1.3, 2.6, 4.6]) sphere(1, $fn = 16);
  }
  // the jaw: chin (and beard) as one shell under the head, with the grin cut into it
  module jaw_shape() {
    if (beard == "full" || beard == "short") color(bc) {
      t = beard == "full" ? 1 : 0.55;
      intersection() {
        hull() {
          translate([0, -1, -6]) scale([13 + 0.6 * t, 12.4 + 0.8 * t, 11.5]) sphere(1, $fn = 32);
          translate([0, -4.5 - t, -12.5 - 0.8 * t]) scale([9 + 2 * t, 8 + t, 5 + t]) sphere(1, $fn = 28);
        }
        // below the beard line: from the mouth corner (y -12, z -5.2) back up to the sideburn (y +2, z +2.5)
        multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0.55, 1, -5.2 + 0.55 * 12], [0, 0, 0, 1]])
          translate([-30, -30, -40]) cube([60, 34.5, 40]);
      }
    } else color(beard == "stubble" ? skin * 0.86 + bc * 0.14 : skin) intersection() {
      scale(SKULL + [0.7, 0.9, 0.7]) sphere(1, $fn = 40);
      translate([-9.4, -20, -20]) cube([18.8, 16, 20 + MOUTH_TOP + 0.6]);
    }
  }
  module grin_hole() color([0.32, 0.08, 0.1]) {
    h = mouth == "grin" ? MOUTH_H : 0.9;
    w = mouth == "grin" ? MOUTH_W : 4.6;
    translate([0, 0, MOUTH_TOP + (mouth == "grin" ? 0 : -0.6)]) intersection() {
      rotate([90, 0, 0]) scale([w, h, 1]) cylinder(h = 25, r = 1, $fn = 36);
      translate([-10, -26, -10]) cube([20, 26, 10]);
    }
  }
  module jaw() difference() {
    union() {
      difference() { jaw_shape(); grin_hole(); }
      if (mouth == "grin") color([0.88, 0.42, 0.45]) translate([0, -9.6, -12.1]) scale([3.7, 2.5, 1.6]) sphere(1, $fn = 20);
    }
    head_cut();
  }
  // everything on the head joint, pushed out from the skull centre by ~GAP: what the jaw and brows are cut by
  module head_cut() {
    head_core(GAP);
    for (d = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
      translate(d * 0.16) scale(1 + 0.16 / SKULL[0]) { face(); ears(); hairdo(); }
  }

  // --- assembly: every joint's shell (world coordinates) ---
  module B() scale(bs) children();
  module HD() translate(hc) scale(hk) children();
  for (m = [0, 1]) {
    B() difference() { thigh(m, 0); shin(m, GAP); }
    B() shin(m, 0);
    B() difference() { foot(m); shin(m, GAP); }
    B() difference() { uarm(m, 0); farm(m, GAP); }
    B() farm(m, 0);
    B() difference() { hand(m, 0); farm(m, GAP); }
  }
  B() difference() { pelvis(0); spine(GAP); thigh(0, GAP); thigh(1, GAP); }
  B() difference() { spine(0); chest(GAP); }
  B() difference() { chest(0); neck(GAP); uarm(0, GAP); uarm(1, GAP); }
  B() neck(0);
  difference() {
    HD() { head_core(0); face(); ears(); hairdo(); }
    B() neck(GAP);
  }
  difference() { HD() jaw(); B() neck(GAP); }
  for (m = [0, 1]) HD() difference() { brow(m, 0); head_cut(); }
}

// Props in the head's frame: head-local units (skull centre at the origin, skull radii SKULL, top of the skull at
// z = 16.5), scaled with the head. Pass the same H / head as the human() call.
module human_head(H = 178, head = 1) translate(hs_hc(H, head)) scale(hs_hk(H, head)) children();
// Props in the body's base frame (H = 178 landmarks), scaled like the body.
module human_body(H = 178, girth = 1) let(s = hs_s(H)) scale([s * girth, s * girth, s]) children();
