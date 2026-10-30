/**
 * Team Ewamon HQ (data/devTeam.ts): Mirevale's house 5 redressed as the original team's office. The hall keeps its
 * footprint (no pocket moves), the four replace the resident, the board reads, and the achievement counts all four.
 */
import { describe, expect, it } from 'vitest';
import { DEV_TEAM, DEV_TEAM_FRONT, DEV_TEAM_HOUSE, QUESTS, SPECIES, devTeamFrontIn, devTeamIn, devTeamMember, interiorNpcs, interiorsFor, zonePlan } from '../src/index';

const EM_DASH = String.fromCharCode(0x2014);

describe('Team Ewamon HQ', () => {
  it('redresses mirevale.house5 without moving it: same size, entry and exit, the four instead of the resident', () => {
    const p = interiorsFor('mirevale').find((x) => x.def.id === DEV_TEAM_HOUSE);
    expect(p).toBeDefined();
    expect(p!.def.template).toBe('house_m');
    expect([p!.def.w, p!.def.d]).toEqual([9, 8]);
    expect(p!.def.label).toBe('Team Ewamon HQ');
    expect(p!.def.npcs.map((n) => n.id)).toEqual(DEV_TEAM.members.map((m) => m.npc.id));
    expect(p!.def.boards?.map((b) => b.id)).toEqual([DEV_TEAM.board.id]);
    // the other houses keep their residents
    expect(interiorNpcs('mirevale').some((n) => n.id.endsWith('.resident'))).toBe(true);
  });

  it('every member has a model, a persona and lines; the world NPC carries both', () => {
    for (const m of DEV_TEAM.members) {
      expect(m.npc.model.startsWith('ewa_')).toBe(true);
      expect(m.npc.persona.length).toBeGreaterThan(40);
      expect(m.npc.lines.length).toBeGreaterThanOrEqual(4);
      expect(devTeamMember(m.npc.id)).toBe(m);
      const w = interiorNpcs('mirevale').find((n) => n.id === m.npc.id);
      expect(w?.model).toBe(m.npc.model);
      expect(w?.persona).toBe(m.npc.persona);
      expect(SPECIES.some((s) => s.id === m.pet.species)).toBe(true);
    }
    expect(devTeamIn(DEV_TEAM_HOUSE)).toBe(DEV_TEAM);
    expect(devTeamIn('mirevale.house4')).toBeNull();
  });

  it('the banter is spoken by the four, and nothing has an em-dash', () => {
    const ids = new Set(DEV_TEAM.members.map((m) => m.npc.id));
    expect(DEV_TEAM.banter.length).toBeGreaterThanOrEqual(10);
    for (const l of DEV_TEAM.banter) expect(ids.has(l.by)).toBe(true);
    const text = [
      ...DEV_TEAM.banter.map((l) => l.text),
      ...DEV_TEAM.members.flatMap((m) => [m.npc.name, m.npc.persona, ...m.npc.lines]),
      DEV_TEAM.board.title,
      ...DEV_TEAM.board.text,
    ].join('\n');
    expect(text.includes(EM_DASH)).toBe(false);
  });

  it('ach_original_party asks to talk to all four', () => {
    const a = QUESTS.find((q) => q.id === 'ach_original_party');
    expect(a?.kind).toBe('achievement');
    expect(a?.objectives.map((o) => o.objective)).toEqual(DEV_TEAM.members.map((m) => ({ kind: 'talkTo', npcId: m.npc.id })));
  });

  it("the outside set stands on house 5's door, faces out of it, and its ground groups keep the door approach clear", () => {
    const plan = zonePlan('mirevale');
    const door = plan.doors.find((d) => d.building === DEV_TEAM_HOUSE)!;
    expect(Math.hypot(door.door.x - DEV_TEAM_FRONT.x, door.door.z - DEV_TEAM_FRONT.z)).toBeLessThan(0.01);
    expect(Math.sin(DEV_TEAM_FRONT.yaw)).toBeCloseTo(door.door.nx, 3);
    expect(Math.cos(DEV_TEAM_FRONT.yaw)).toBeCloseTo(door.door.nz, 3);
    expect(devTeamFrontIn('mirevale')).toBe(DEV_TEAM_FRONT);
    expect(devTeamFrontIn('mire_route')).toBeNull();
    // the approach (the walk-in rect in front of the door) is outside every solid: both are rects on the same yaw
    const a = door.approach as { x: number; z: number; hw: number; hd: number; yaw: number };
    const c = Math.cos(a.yaw); const s = Math.sin(a.yaw);
    for (const so of DEV_TEAM_FRONT.solids) {
      expect(so.yaw).toBeCloseTo(a.yaw, 4);
      const dx = so.x - a.x; const dz = so.z - a.z;
      const lx = dx * c - dz * s; const lz = dx * s + dz * c;
      expect(Math.abs(lx) >= so.hw + a.hw || Math.abs(lz) >= so.hd + a.hd).toBe(true);
    }
  });
});
