// Yasin, "Mr Ching" (scad/npc/ewa_yasin.scad), team lead, seated at the team desk (ewa_desk) beside Red1, his screen a
// battle (Moflame vs Darkone): types, turns left to Red1 to talk, and in idle_stretch has his 5 am moment: arms up in a
// long stretch with a yawn, then rubs his eyes with both fists. The seated loop, talk and cheer come from _seated.mjs.
import { seated, K, osc } from './_seated.mjs';

export default await seated({
  id: 'ewa_yasin', H: 177, head: 1.08, girth: 1.14,
  phase: 0.8, talkSide: 1, lean: 9,
  clips: (h, S) => ({
    idle_stretch: h.fidget(6.4, (t, u, base) => {
      const up = K(u, [[0.05, 0], [0.18, 1], [0.38, 1], [0.48, 0]]);
      const rub = K(u, [[0.42, 0], [0.52, 1], [0.82, 1], [0.92, 0]]);
      const yawn = K(u, [[0.1, 0], [0.2, 1], [0.36, 1], [0.44, 0]]);
      const spec = {
        ...base,
        pelvis: [base.pelvis[0] - 5 * up, 0, 0],
        spine: [base.spine[0] - 7 * up + 2 * rub, 0, 0],
        chest: [base.chest[0] - 8 * up + 3 * rub, 0, 3 * osc(u, 3) * up],
        neck: [base.neck[0] + 4 * up, 0, 0],
        head: [base.head[0] * (1 - up - rub) - 16 * up + 10 * rub, 0, 4 * osc(u, 2) * rub],
        jaw: 1 + 26 * yawn,
        brows: { raise: 0.6 * yawn, angry: -0.4 * rub },
      };
      const eyes = rub > 0 ? [1, -1].map((m) => S.headPoint(spec, [m * 5.3, -20, 1])) : null;
      for (const [k, m, i] of [['L', 1, 0], ['R', -1, 1]]) {
        const sky = [m * 12, 8, 176 - 3 * osc(u, 3) * up];
        let at = base[`hand${k}`].at.map((v, j) => v + (sky[j] - v) * up);
        if (rub > 0) {
          const e = eyes[i];
          const circle = [1.2 * osc(u, 6, i * 0.5), 0, 1.2 * osc(u, 6, 0.25 + i * 0.5)];
          at = at.map((v, j) => v + (e[j] + circle[j] - v) * rub);
        }
        spec[`hand${k}`] = { at, twist: -20 + 80 * rub, pole: [m, 0.6 - 0.4 * up, -0.8 + 0.6 * up] };
      }
      return spec;
    }),
  }),
});
