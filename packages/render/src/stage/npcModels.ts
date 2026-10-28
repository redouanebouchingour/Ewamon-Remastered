/**
 * Rigged NPC set pieces (addition 2026-10-28, IMPLEMENTATION-NOTES "NPC models"): people and props built by
 * `tools/creature-models --npc` into `/npc-models/<id>.rig.glb` (the Mire Route foosball club), standing in the world
 * and playing their clips. They are not actors (no KayKit body, no gait, no nameplate): the client places them per zone
 * (`set`) and the interaction prompt / dialogue stay the client's.
 *
 * Each model is a `CreatureRigPlayer` on its own clone, so the clip contract is the creatures': `idle` loops (for the
 * club: playing the table), an `idle_*` fidget fires now and then, `play(id, name)` runs any clip once (`talk`,
 * `cheer`) and returns to the loop. The GLB is 1 m tall, its front +Z, its origin the scad's (a person's feet, the
 * table's centre); `heightM` scales it back. One vertex-colour material for all of them.
 */
import { Group, MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { LAYERS } from '../descriptors.js';
import { createCreatureModelSource, type CreatureModelSource } from '../sprites/creatureModels.js';
import { CreatureRigPlayer } from '../sprites/creatureRig.js';

/** One placed model: `id` is the client's handle (a trainer id, 'table'), `model` the `/npc-models/` id. */
export interface NpcModelSpec {
  readonly id: string;
  readonly model: string;
  readonly x: number;
  readonly z: number;
  /** radians, three's rotation.y (the model's front is +Z) */
  readonly yaw: number;
  readonly heightM: number;
}

/** What the client drives (`Renderer.npcModels`). */
export interface NpcModels {
  /** Replaces the placed models (a zone change; [] clears). Models load in the background and appear when ready. */
  set(models: readonly NpcModelSpec[]): void;
  /** Plays clip `name` once on model `id`, then back to its loop; false when the model is not loaded or has no such clip. */
  play(id: string, name: string): boolean;
  /** The clip names of a loaded model ([] while loading). */
  clips(id: string): readonly string[];
}

export const NPC_MODEL = Object.freeze({ roughness: 0.82, metalness: 0 });

interface Placed {
  readonly spec: NpcModelSpec;
  readonly root: Group;
  player: CreatureRigPlayer | null;
}

export interface NpcModelStageOptions {
  /** Where `index.json` and the GLBs are served; null = no models (node tests). */
  readonly baseUrl: string | null;
  readonly source?: CreatureModelSource;
  readonly warn?: (msg: string) => void;
}

export class NpcModelStage implements NpcModels {
  readonly root = new Group();
  readonly material: MeshStandardNodeMaterial;
  private readonly source: CreatureModelSource | null;
  private placed: Placed[] = [];
  private ground: ((x: number, z: number) => number) | null = null;
  /** bumped by `set`: a model that loads after a newer `set` is dropped */
  private generation = 0;
  private disposed = false;

  constructor(o: NpcModelStageOptions) {
    this.root.name = 'ewa:npc-models';
    this.source = o.source ?? (o.baseUrl === null ? null : createCreatureModelSource({ baseUrl: o.baseUrl, ...(o.warn !== undefined ? { warn: o.warn } : {}) }));
    const m = new MeshStandardNodeMaterial();
    m.colorNode = (attribute('color', 'vec4') as unknown as Node<'vec4'>).rgb;
    m.roughnessNode = float(NPC_MODEL.roughness);
    m.metalnessNode = float(NPC_MODEL.metalness);
    m.name = 'ewa:npc-model';
    this.material = m;
  }

  /** The ground the models stand on (the zone's surface); null = y 0. */
  setGround(g: ((x: number, z: number) => number) | null): void {
    this.ground = g;
    for (const p of this.placed) this.placeY(p);
  }

  set(models: readonly NpcModelSpec[]): void {
    if (this.disposed) return;
    this.clear();
    const gen = ++this.generation;
    for (const spec of models) {
      const root = new Group();
      root.name = `ewa:npc-model:${spec.id}`;
      root.position.set(spec.x, 0, spec.z);
      root.rotation.y = spec.yaw;
      root.scale.setScalar(spec.heightM);
      const p: Placed = { spec, root, player: null };
      this.placeY(p);
      this.root.add(root);
      this.placed.push(p);
      void this.source?.model(spec.model).then((m) => {
        if (m?.rig === undefined || gen !== this.generation || this.disposed) return;
        p.player = new CreatureRigPlayer(m.rig, this.material, {}, spec.id, LAYERS.default, LAYERS.dynamicShadow);
        // never culled: the skinned bounds (bone matrices in world space) land off the model once it sits in a moved,
        // scaled group, and a handful of set pieces cost nothing to draw
        p.player.mesh.frustumCulled = false;
        root.add(p.player.root);
      });
    }
  }

  play(id: string, name: string): boolean {
    return this.placed.find((p) => p.spec.id === id)?.player?.play(name) ?? false;
  }

  clips(id: string): readonly string[] {
    return this.placed.find((p) => p.spec.id === id)?.player?.clipNames ?? [];
  }

  /** Per frame (scaled ms): the mixers. They stand still, so the rig never switches to `walk`. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.placed) p.player?.update(dt, 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.source?.dispose();
    this.material.dispose();
    this.root.removeFromParent();
  }

  private clear(): void {
    for (const p of this.placed) { p.player?.dispose(); p.root.removeFromParent(); }
    this.placed = [];
  }

  private placeY(p: Placed): void {
    const y = this.ground?.(p.spec.x, p.spec.z) ?? 0;
    p.root.position.y = Number.isFinite(y) ? y : 0;
  }
}
