// King Klinker (Mire Route foosball club, team B attack: holds grip L). Ginger-brown short hair and full beard, a big
// open grin, blue eyes, a little gold crown; casual purple tee and jeans. Rig: rigs/npc/fb_king_klinker.mjs.
include <_human.scad>

KK_H = 172;
KK_HEAD = 1.08;
KK_GIRTH = 1.06;
GOLD = [0.98, 0.76, 0.2, NOGLOW];

human(H = KK_H, head = KK_HEAD, girth = KK_GIRTH, belly = 0.35,
  skin = [0.99, 0.8, 0.68], blush = [0.97, 0.68, 0.6],
  hair = "short", hair_c = [0.64, 0.34, 0.17], beard = "full", brow_c = [0.52, 0.27, 0.14],
  eye_c = [0.22, 0.52, 0.86], mouth = "grin",
  shirt_c = [0.44, 0.25, 0.62], sleeve = "short",
  pants_c = [0.22, 0.31, 0.5], shoe_c = [0.96, 0.96, 0.95], sole_c = [0.8, 0.22, 0.2]);

// the crown, a little askew on top of the hair
human_head(KK_H, KK_HEAD) translate([0.6, 0.5, 16.3]) rotate([-6, 9, 0]) {
  color(GOLD) difference() {
    cylinder(h = 4.2, r1 = 5.8, r2 = 6.2, $fn = 36);
    translate([0, 0, -0.1]) cylinder(h = 4.4, r1 = 4.9, r2 = 5.4, $fn = 36);
  }
  for (i = [0 : 4]) rotate([0, 0, 90 + i * 72]) {
    color(GOLD) translate([5.6, 0, 3.8]) rotate([0, 8, 0]) cylinder(h = 3.4, r1 = 1.5, r2 = 0.2, $fn = 10);
    color(GOLD) translate([5.95, 0, 7.4]) sphere(0.75, $fn = 10);
    color([0.85, 0.12, 0.18, NOGLOW]) translate([6.05, 0, 1.9]) scale([0.4, 0.9, 0.9]) sphere(1, $fn = 10);
  }
}
