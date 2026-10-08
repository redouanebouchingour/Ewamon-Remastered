/**
 * The headless client-owned frame for perf/tick + perf/alloc (§20.10.1): the World3D tick minus the renderer —
 * input sample + one fixed step of prediction, 48 interpolated remotes, interaction targeting, a battle timeline
 * playing (a real fuzz turn), the silent audio director, and the dirty HUD flush. Every sink is a no-op recorder.
 */
import { createContentIndex } from '@ewa/content';
import type { BattleState, Ref } from '@ewa/core';
import { MOVEMENT } from '@ewa/protocol';
import { createAudioDirector } from '../../src/audio/AudioDirector';
import { createMoveAnimRegistry } from '../../src/battle/moveAnims';
import { buildTimeline } from '../../src/battle/timeline';
import type { Timeline } from '../../src/battle/timeline';
import { TimelinePlayer } from '../../src/battle/TimelinePlayer';
import type { TimelineTargets } from '../../src/battle/TimelinePlayer';
import { HudWriter } from '../../src/scene/HudWriter';
import { HELD } from '../../src/scene/input';
import { InteractionTargets, makeInteractable } from '../../src/scene/interaction';
import { LocalPlayerController } from '../../src/scene/LocalPlayerController';
import { RemoteInterpolator, TICK_MS } from '../../src/scene/RemoteInterpolator';
import { runFuzzBattle } from '../battleFuzz';

export const STEP = MOVEMENT.stepMs;

export interface Frame {
  readonly controller: LocalPlayerController;
  readonly remotes: RemoteInterpolator;
  readonly player: TimelinePlayer;
  readonly hud: HudWriter;
  readonly held: Uint8Array;
  /** one client-owned frame at simulated time `nowMs` */
  frame(nowMs: number): void;
  /** a server patch (20 Hz) for every remote */
  patch(tick: number): void;
  setCalls(): number;
  replay(): void;
}

function longestTurn(): { tl: Timeline } {
  const content = createContentIndex();
  const registry = createMoveAnimRegistry();
  let best: { tl: Timeline; n: number } | null = null;
  for (let seed = 1; seed < 40; seed++) {
    const b = runFuzzBattle(content, seed, 30);
    for (const t of b.turns) {
      if (best !== null && t.events.length <= best.n) continue;
      const st: BattleState = t.before;
      const tl = buildTimeline(t.events, {
        content, registry, reduced: false,
        speciesOf: (r: Ref) => st.sides[r.side]?.party[r.slot]?.creature.speciesId ?? 'bramblecub',
        maxHpOf: (r: Ref) => st.sides[r.side]?.party[r.slot]?.maxHp ?? 1,
      });
      best = { tl, n: t.events.length };
    }
  }
  return { tl: best!.tl };
}

export function createFrame(now: () => number): Frame {
  const held = new Uint8Array(5);
  let sets = 0;
  const hud = new HudWriter({ set: () => { sets++; } });
  const controller = new LocalPlayerController({ held, cameraYaw: () => 0.6, blocked: () => false, send: () => undefined });
  controller.setCollider({ terrain: null, begin() {}, resolve() {}, height: () => 0 });
  controller.reconcile(0, 0, 0, 0);
  const remotes = new RemoteInterpolator({ spawn() {}, despawn() {}, setTransform() {} }, now, 48);
  for (let i = 0; i < 48; i++) remotes.add(`r${i}`, { name: `R${i}`, look: 'casual_male', guildTag: '', inBattle: false });
  const targets = new InteractionTargets((p) => hud.setPrompt(p));
  const statics = [];
  for (let i = 0; i < 40; i++) statics.push(makeInteractable(`npc${i}`, 'npc', (i % 8) * 6 - 24, Math.floor(i / 8) * 6 - 12, 'Talk to', `NPC ${i}`, 'E'));
  targets.setStatics(statics);
  const noop = (): void => undefined;
  const t: TimelineTargets = {
    setPose: noop, hurt: noop, vfx: noop, setWeather: noop, cue: noop, shake: noop, setTimeScale: noop,
    hitstopEnabled: () => true, slowmoEnabled: () => true, playSfx: noop, hp: noop, status: noop, stage: noop, form: noop, orb: noop,
    enter: noop, log: noop, inputLock: noop, commit: noop, ended: noop,
  };
  const player = new TimelinePlayer(t);
  const { tl } = longestTurn();
  player.play(tl);
  const audio = createAudioDirector({ createContext: () => null });
  const frame = (nowMs: number): void => {
    controller.sample();
    controller.step(STEP);
    remotes.step(STEP, controller.pose.x, controller.pose.z);
    targets.step(controller.pose.x, controller.pose.z, false);
    player.step(STEP);
    audio.step();
    void nowMs;
    hud.flush();
  };
  const patch = (tick: number): void => {
    remotes.observeTick(tick);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + tick * 0.01;
      remotes.push(`r${i}`, tick, Math.cos(a) * 20, Math.sin(a) * 20, a, true, false);
    }
  };
  held[HELD.forward] = 1;
  held[HELD.right] = 1;
  return { controller, remotes, player, hud, held, frame, patch, setCalls: () => sets, replay: () => player.play(tl) };
}

export { TICK_MS };
