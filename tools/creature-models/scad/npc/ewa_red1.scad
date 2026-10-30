// Red1 (Team Ewamon HQ, mirevale.house5): the original Ewamon's pixel artist, seated at the team desk (ewa_desk.scad).
// Dark curly hair piled high with shorter sides, a short full dark beard, light-medium skin, no glasses; a black dress
// shirt with the sleeves rolled up, black trousers, a headset on. Rig: rigs/npc/ewa_red1.mjs (seated, _seated.mjs).
include <_ewa_team.scad>

R1_H = 178;
R1_HEAD = 1.08;
R1_GIRTH = 1.04;
HAIR = EWA_DARK_HAIR;

human(H = R1_H, head = R1_HEAD, girth = R1_GIRTH, belly = 0.1,
  skin = EWA_SKIN, blush = [0.84, 0.56, 0.45],
  hair = "curly", hair_c = HAIR, beard = "short", brow_c = [0.07, 0.05, 0.05],
  eye_c = EWA_EYE, mouth = "grin",
  shirt_c = EWA_SHIRT, sleeve = "rolled", cuff_c = EWA_FOLD,
  pants_c = EWA_PANTS, shoe_c = [0.95, 0.95, 0.94], sole_c = [0.16, 0.16, 0.17]);

human_head(R1_H, R1_HEAD) {
  // the curls: a thick crown piled up and a little forward, the sides kept short
  color(HAIR) {
    for (i = [0 : 6]) let(a = -66 + 22 * i) translate([11.6 * sin(a), -11.8 * cos(a) + 1.5, 14.2 - 0.9 * abs(i - 3)])
      sphere(3.2, $fn = 12);
    for (i = [0 : 5]) let(a = -55 + 22 * i) translate([8.8 * sin(a), -8.2 * cos(a) + 1, 19.2 - 0.6 * abs(i - 2.5)])
      sphere(3.4, $fn = 12);
    for (i = [0 : 4]) let(a = i * 72 + 20) translate([4.8 * sin(a), 4.8 * cos(a) + 1, 21]) sphere(3.3, $fn = 12);
    for (i = [0 : 6]) let(a = 110 + 23 * i) translate([11.2 * sin(a), -11.6 * cos(a), 14 - 0.5 * abs(i - 3)])
      sphere(3.1, $fn = 12);
  }
  ewa_headset(top = 22.2, mic = 1, accent = [0.85, 0.15, 0.2, NOGLOW]);
}

human_body(R1_H, R1_GIRTH) ewa_collar(EWA_FOLD);
