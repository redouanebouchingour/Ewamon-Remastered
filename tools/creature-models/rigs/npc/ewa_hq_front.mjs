// Team Ewamon HQ from outside (scad/npc/ewa_hq_front.scad): the props in front of mirevale.house5, static, one root
// joint, so it ships as a rig like the desk set (rigs/npc/ewa_desk.mjs). Origin = the door's centre on the wall plane.
export default {
  joints: [{ name: 'front', at: [0, 0, 0] }],
  assign: () => 'front',
  clips: { idle: { seconds: 2, pose: () => ({ front: { r: [0, 0, 0] } }) } },
};
