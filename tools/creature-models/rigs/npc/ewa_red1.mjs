// Red1 (scad/npc/ewa_red1.scad), seated at the team desk (ewa_desk) between the monitors: types, turns right to Yasin to
// talk, and in idle_draw works the mouse on his pixel art (Kygra on the screen), then leans back, hand on his beard, to
// judge it. The seated loop, talk and cheer come from _seated.mjs.
import { seated, K, osc } from './_seated.mjs';

export default await seated({
  id: 'ewa_red1', H: 178, head: 1.08, girth: 1.04,
  phase: 0.1, talkSide: -1,
  clips: (h, S) => ({
    idle_draw: h.fidget(6.4, (t, u, base) => {
      const mouse = K(u, [[0.06, 0], [0.16, 1], [0.86, 1], [0.95, 0]]);
      const back = K(u, [[0.5, 0], [0.6, 1], [0.84, 1], [0.92, 0]]);
      const draw = K(u, [[0.16, 1], [0.48, 1], [0.56, 0]]);
      const stroke = [2.2 * osc(u, 7) * draw, 1.6 * osc(u, 11, 0.25) * draw, 0];
      const spec = {
        ...base,
        pelvisP: [S.pelvisP[0], S.pelvisP[1] + 1.5 * back, S.pelvisP[2]],
        pelvis: [base.pelvis[0] - 5 * back, 0, 0],
        spine: [base.spine[0] + 2 * draw - 7 * back, 0, -3 * back],
        chest: [base.chest[0] + 2 * draw - 6 * back, 0, -4 * mouse],
        neck: [base.neck[0] + 6 * back, 0, 0],
        head: [8 * draw + 2 * back + 2 * osc(u, 4), 9 * back, -4 * mouse + 3 * osc(u, 1.5)],
        jaw: 1 + 3 * back,
        brows: { raise: 0.25 * back, angry: 0.35 * draw + 0.5 * back },
        handR: { at: [S.MOUSE[0] + stroke[0], S.MOUSE[1] + stroke[1], S.MOUSE[2] + S.FIST_UP], twist: -25, pole: [-0.7, 0.8, -0.9] },
      };
      if (back > 0) {
        // the left hand up to his beard while he looks the sprite over
        const chin = S.headPoint(spec, [3, -17, -15]);
        const rub = [0.8 * osc(u, 6), 0, 0.8 * osc(u, 6, 0.25)];
        const beard = [chin[0] + rub[0], chin[1] + rub[1], chin[2] - 2 + rub[2]];
        spec.handL = { at: base.handL.at.map((v, i) => v + (beard[i] - v) * back), twist: -70, pole: [1, 0.4, -0.9] };
      }
      return spec;
    }),
  }),
});
