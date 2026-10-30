// Team Ewamon HQ's desk set (scad/npc/ewa_desk.scad): static, one root joint, so it ships as a rig like the people it
// is placed with (rigs/npc/foosball_table.mjs) and the game can play `idle` on it. Origin = the desk's centre.
export default {
  joints: [{ name: 'desk', at: [0, 0, 0] }],
  assign: () => 'desk',
  clips: { idle: { seconds: 2, pose: () => ({ desk: { r: [0, 0, 0] } }) } },
};
