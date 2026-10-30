// Yasin, "Mr Ching" (Team Ewamon HQ, mirevale.house5): the original Ewamon's team lead and battle coder, seated at the
// team desk (ewa_desk.scad). Light-medium skin, short dark hair, a full dark beard, a broader build; a black dress
// shirt with the sleeves rolled up, black trousers, the headset pushed onto one ear. Rig: rigs/npc/ewa_yasin.mjs
// (seated, _seated.mjs).
include <_ewa_team.scad>

YN_H = 177;
YN_HEAD = 1.08;
YN_GIRTH = 1.14;
HAIR = EWA_DARK_HAIR;

human(H = YN_H, head = YN_HEAD, girth = YN_GIRTH, belly = 0.4,
  skin = [0.87, 0.66, 0.51], blush = [0.83, 0.55, 0.44],
  hair = "short", hair_c = HAIR, beard = "full", brow_c = [0.06, 0.045, 0.04],
  eye_c = EWA_EYE, mouth = "grin",
  shirt_c = EWA_SHIRT, sleeve = "rolled", cuff_c = EWA_FOLD,
  pants_c = EWA_PANTS, shoe_c = [0.1, 0.1, 0.11], sole_c = [0.2, 0.2, 0.21]);

// the headset pushed off the left ear onto the temple, the right cup still on its ear (and the mic with it)
human_head(YN_H, YN_HEAD) ewa_headset(top = 13.6, lift = 16, mic = -1, accent = [0.2, 0.45, 0.9, NOGLOW], ax = 15.9);

human_body(YN_H, YN_GIRTH) ewa_collar(EWA_FOLD);
