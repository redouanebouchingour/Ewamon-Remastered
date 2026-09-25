/**
 * §50.4.7 hud-dirty (§20.10.2 rule 3): HudWriter.flush writes only dirty fields. 600 idle frames (no input, no
 * chat, no timeOfDay tick) → exactly 0 `hud.set` calls; walking past interactables → ≤ 2 per second (prompt changes)
 * + nameplates at 2 Hz.
 */
import { describe, expect, it } from 'vitest';
import type { HudModel } from '@ewa/render';
import { MOVEMENT } from '@ewa/protocol';
import { HudWriter, TIME_QUANTUM } from '../src/scene/HudWriter';
import type { HudNameplates } from '../src/scene/HudWriter';
import { HELD } from '../src/scene/input';
import { InteractionTargets, makeInteractable } from '../src/scene/interaction';
import { LocalPlayerController } from '../src/scene/LocalPlayerController';

const STEP = MOVEMENT.stepMs;

function rig() {
  const calls: Partial<HudModel>[] = [];
  const hud = new HudWriter(null);
  hud.bind({ set: (p) => calls.push(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))) });
  hud.flush(); // a new layer gets the whole model once
  calls.length = 0;
  return { hud, calls };
}

describe('HUD dirty flag', () => {
  it('600 idle frames produce exactly 0 hud.set calls', () => {
    const { hud, calls } = rig();
    const targets = new InteractionTargets((p) => hud.setPrompt(p));
    targets.setStatics([makeInteractable('npc', 'npc', 20, 0, 'Talk to', 'Wynn', 'E')]);
    calls.length = 0;
    for (let i = 0; i < 600; i++) {
      targets.step(0, 0, false);
      hud.setTimeOfDay(0.5); // an unchanged value is not a change
      hud.flush();
    }
    expect(calls).toHaveLength(0);
  });

  it('flush sends only the changed fields; the same value twice sends nothing', () => {
    const { hud, calls } = rig();
    hud.setQuestHint('Find the Fenkeeper');
    hud.flush();
    expect(calls).toEqual([{ questHint: 'Find the Fenkeeper' }]);
    hud.setQuestHint('Find the Fenkeeper');
    hud.flush();
    expect(calls).toHaveLength(1);
    hud.setTimeOfDay(0.5 + TIME_QUANTUM / 4); // rounds to the same game minute
    hud.flush();
    expect(calls).toHaveLength(1);
    hud.pushChat('Isla', 'hi');
    hud.setPrompt({ key: 'E', verb: 'Talk to', target: 'Wynn' });
    hud.flush();
    expect(Object.keys(calls[1]!).sort()).toEqual(['chat', 'prompt']);
  });

  it('walking: ≤ 2 prompt writes per second + nameplates at 2 Hz', () => {
    const { hud, calls } = rig();
    const targets = new InteractionTargets((p) => hud.setPrompt(p));
    // interactables every 4 m along the walk
    targets.setStatics(Array.from({ length: 20 }, (_, i) => makeInteractable(`t${i}`, 'npc', 0, -4 - i * 4, 'Talk to', `T${i}`, 'E')));
    calls.length = 0;
    const held = new Uint8Array(5);
    held[HELD.forward] = 1;
    const c = new LocalPlayerController({ held, cameraYaw: () => 0, blocked: () => false, send: () => undefined });
    c.setCollider({ terrain: null, begin() {}, resolve() {}, height: () => 0 });
    c.reconcile(0, 0, 0, 0);
    let plates: HudNameplates = [];
    let nameplateLeft = 0;
    const seconds = 10;
    for (let i = 0; i < seconds * 60; i++) {
      c.sample();
      c.step(STEP);
      targets.step(c.pose.x, c.pose.z, false);
      nameplateLeft -= STEP;
      if (nameplateLeft <= 0) {
        nameplateLeft = 500;
        const nearest = Math.max(0, Math.round(-c.pose.z / 4) - 1);
        const next = [{ id: `t${nearest}`, name: `T${nearest}`, guildTag: '', inBattle: false }];
        if (plates.length === 0 || plates[0]!.id !== next[0]!.id) plates = next;
        hud.setNameplates(plates);
      }
      hud.flush();
    }
    const prompts = calls.filter((p) => 'prompt' in p).length;
    const nameplates = calls.filter((p) => 'nameplates' in p).length;
    expect(c.pose.z).toBeLessThan(-40); // really walked
    expect(prompts).toBeGreaterThan(0);
    expect(prompts).toBeLessThanOrEqual(2 * seconds);
    expect(nameplates).toBeLessThanOrEqual(2 * seconds);
    expect(calls.length).toBeLessThanOrEqual(4 * seconds);
  });
});
