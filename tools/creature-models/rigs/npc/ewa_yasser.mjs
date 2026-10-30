// Yasser, "King Smali" (scad/npc/ewa_yasser.scad), seated at the team desk (ewa_desk) across from Yasin, his screen the
// shop: types, turns right to Mohaned to talk, and in idle_coins counts the coins piled left of his keyboard, sliding
// them one by one from one stack to the other. The seated loop, talk and cheer come from _seated.mjs.
import { seated, K, osc, smooth } from './_seated.mjs';

// the two coin stacks on the desk (ewa_desk.scad), in his own frame
const FROM = [31, -4];
const TO = [31, -18];

export default await seated({
  id: 'ewa_yasser', H: 182, head: 1.06, girth: 0.94,
  phase: 0.6, talkSide: -1,
  clips: (h, S) => ({
    idle_coins: h.fidget(6.4, (t, u, base) => {
      const on = K(u, [[0.05, 0], [0.14, 1], [0.86, 1], [0.95, 0]]);
      // four coins: pick at FROM, carry, drop at TO
      const f = Math.min(1, Math.max(0, (u - 0.14) / 0.72)) * 4;
      const c = f % 1;
      const go = smooth((c - 0.15) / 0.35) * (1 - smooth((c - 0.65) / 0.3));
      const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, (c - 0.15) / 0.35))) + Math.sin(Math.PI * Math.min(1, Math.max(0, (c - 0.65) / 0.3)));
      const at = [FROM[0] + (TO[0] - FROM[0]) * go, FROM[1] + (TO[1] - FROM[1]) * go, S.DESK_Z + S.FIST_UP + 1 + 2.5 * lift];
      const hand = { at, twist: -30, pole: [0.8, 0.7, -0.8] };
      return {
        ...base,
        chest: [base.chest[0] + 3 * on, 0, 8 * on],
        neck: [base.neck[0], 0, 6 * on],
        head: [base.head[0] + 14 * on, 0, 14 * on + 3 * osc(u, 4) * on],
        jaw: 1 + 7 * on * Math.abs(Math.sin(f * Math.PI)),
        brows: { raise: 0.2 * on, angry: 0.1 },
        handL: { ...hand, at: base.handL.at.map((v, i) => v + (at[i] - v) * on) },
        handR: { ...base.handR, at: [base.handR.at[0] + 4 * on, base.handR.at[1] - 2 * on, base.handR.at[2] - 0.4 * on] },
      };
    }),
  }),
});
