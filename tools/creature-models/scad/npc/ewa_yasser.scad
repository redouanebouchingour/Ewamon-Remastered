// Yasser, "King Smali" (Team Ewamon HQ, mirevale.house5): built the original Ewamon's shop, seated at the team desk
// (ewa_desk.scad). Dark brown skin, a short black curly afro, a goatee, slim and a bit taller; a black dress shirt
// with the sleeves rolled up, black trousers, a headset on. Rig: rigs/npc/ewa_yasser.mjs (seated, _seated.mjs).
include <_ewa_team.scad>

YS_H = 182;
YS_HEAD = 1.06;
YS_GIRTH = 0.94;
HAIR = [0.06, 0.05, 0.05];

human(H = YS_H, head = YS_HEAD, girth = YS_GIRTH, belly = 0,
  skin = [0.43, 0.28, 0.19], blush = [0.4, 0.24, 0.17],
  hair = "buzz", hair_c = HAIR, beard = "goatee", brow_c = [0.05, 0.04, 0.04],
  eye_c = [0.2, 0.12, 0.07], mouth = "grin",
  shirt_c = EWA_SHIRT, sleeve = "rolled", cuff_c = EWA_FOLD,
  pants_c = EWA_PANTS, shoe_c = [0.12, 0.12, 0.13], sole_c = [0.92, 0.92, 0.9]);

human_head(YS_H, YS_HEAD) {
  // the short afro: tight curls over a slightly fuller cap, a clean hairline
  color(HAIR) {
    intersection() {
      translate([0, 0.8, 1.2]) scale(SKULL + [1.6, 1.8, 2.0]) sphere(1, $fn = 36);
      multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.45, 1, 10.5 - 0.45 * 13], [0, 0, 0, 1]]) translate([-30, -30, 0]) cube([60, 60, 40]);
    }
    for (i = [0 : 41]) let(t = (i + 0.5) / 42, z = 1 - 0.62 * t, r = sqrt(1 - z * z), a = i * 137.5,
                          p = [(SKULL[0] + 1.6) * r * cos(a), (SKULL[1] + 1.8) * r * sin(a) + 0.8, (SKULL[2] + 2.0) * z + 1.2])
      if (p[2] > 4.65 - 0.45 * p[1] + 1.2) translate(p) sphere(2.1, $fn = 8);
  }
  ewa_headset(top = 20.2, mic = 1, accent = [0.98, 0.76, 0.2, NOGLOW]);
}

human_body(YS_H, YS_GIRTH) ewa_collar(EWA_FOLD);
