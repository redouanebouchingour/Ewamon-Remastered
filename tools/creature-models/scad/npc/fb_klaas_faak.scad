// Klaas Faak (Mire Route foosball club, team A midfield: holds grip R). Waited all day to play and is ecstatic: wavy
// brown hair swept up and over to his right, a full brown beard, a huge open grin, blue-green eyes. A mustard long-
// sleeved tee, dark grey jeans, white-and-black sneakers. Rig: rigs/npc/fb_klaas_faak.mjs.
include <_human.scad>

KF_H = 178;
KF_HEAD = 1.1;
KF_GIRTH = 1.02;
HAIR = [0.42, 0.24, 0.13];

human(H = KF_H, head = KF_HEAD, girth = KF_GIRTH, belly = 0.2,
  skin = [0.99, 0.82, 0.71], blush = [0.97, 0.64, 0.58],
  hair = "quiff", hair_c = HAIR, beard = "full", beard_c = [0.45, 0.27, 0.15], brow_c = [0.36, 0.2, 0.11],
  eye_c = [0.18, 0.62, 0.66], mouth = "grin",
  shirt_c = [0.93, 0.67, 0.16], sleeve = "long", cuff_c = [0.8, 0.52, 0.1],
  pants_c = [0.27, 0.28, 0.32], shoe_c = [0.97, 0.97, 0.96], sole_c = [0.15, 0.15, 0.17]);

// the wave: the quiff rolls over to his right (-X) and curls down at the temple, with a fuller back and sides
human_head(KF_H, KF_HEAD) color(HAIR) {
  hull() {
    translate([2.5, -8.8, 16.6]) rotate([-26, 0, -8]) scale([7.5, 5.2, 4.6]) sphere(1, $fn = 24);
    translate([-7.6, -9.6, 14.2]) rotate([-20, -16, 0]) scale([5.2, 4.2, 3.8]) sphere(1, $fn = 22);
  }
  // the curl over the right temple
  hull() {
    translate([-7.6, -9.6, 14.2]) rotate([-20, -16, 0]) scale([4.6, 3.8, 3.4]) sphere(1, $fn = 20);
    translate([-11.6, -7.2, 9.6]) rotate([0, 20, -30]) scale([2.6, 2.8, 3.2]) sphere(1, $fn = 18);
  }
  for (m = [0, 1]) mirror([m, 0, 0]) hull() {
    translate([11.8, -3, 9.6]) scale([2.8, 4.2, 4.8]) sphere(1, $fn = 18);
    translate([11.6, 6, 8]) scale([3, 5.2, 5.4]) sphere(1, $fn = 18);
    translate([5, 11.8, 8]) scale([5, 3, 6]) sphere(1, $fn = 18);
  }
}
