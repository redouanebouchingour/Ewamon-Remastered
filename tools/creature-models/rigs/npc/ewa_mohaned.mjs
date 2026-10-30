// Mohaned, "Internet Friend" (scad/npc/ewa_mohaned.scad), seated at the team desk (ewa_desk) across from Red1, his
// screen full of database tables: types, turns left to Yasser to talk, and in idle_facepalm stares at a broken query,
// drops his forehead into his right hand and shakes his head. The seated loop, talk and cheer come from _seated.mjs.
import { seated, K, osc } from './_seated.mjs';

export default await seated({
  id: 'ewa_mohaned', H: 180, head: 1.08, girth: 1.0,
  phase: 0.35, talkSide: 1,
  clips: (h, S) => ({
    idle_facepalm: h.fidget(6.4, (t, u, base) => {
      const stare = K(u, [[0.04, 0], [0.12, 1], [0.24, 1], [0.3, 0]]);
      const palm = K(u, [[0.22, 0], [0.32, 1], [0.82, 1], [0.92, 0]]);
      const shake = palm * K(u, [[0.36, 0], [0.42, 1], [0.74, 1], [0.8, 0]]) * osc(u, 5);
      const spec = {
        ...base,
        spine: [base.spine[0] + 5 * palm, 0, 0],
        chest: [base.chest[0] + 6 * palm, 0, 0],
        neck: [base.neck[0] + 4 * palm, 0, 0],
        head: [base.head[0] * (1 - palm) + 4 * stare + 20 * palm, 0, 9 * shake],
        jaw: 1 + 4 * stare,
        brows: { raise: 0.3 * stare - 0.1 * palm, angry: 0.7 * stare - 0.5 * palm },
      };
      if (palm > 0) {
        const brow = S.headPoint(spec, [0, -19, 7]);
        const hand = { at: [brow[0] - 1, brow[1], brow[2] - 1], twist: 70, pole: [-0.6, 0.2, -1] };
        spec.handR = { ...hand, at: base.handR.at.map((v, i) => v + (hand.at[i] - v) * palm) };
      }
      return spec;
    }),
  }),
});
