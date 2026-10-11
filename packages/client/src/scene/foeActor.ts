/**
 * Phase B7 — the ONE "foe actor" of a battle: the trainer who stands at the far trainer slot, beside and behind their creature,
 * facing the player. Reused by every format that has a visible opponent (trainer / league today; raids and the
 * post-game tower later):
 *
 * - `player` — a pvp foe: their remote avatar is restaged while the remote interpolator has a rig for it; in an arena
 *   (no zone room, no remotes) a temporary `battle:foe` actor stands in with the foe's own look (`playerLook`);
 * - `npc` — a route trainer, gym-hall trainer or league leader: the static actor the director spawned is restaged
 *   (the director stands it back on exit); when none stands in the zone (a story trainer fought from a beat, Sable),
 *   a temporary `battle:foe` actor is spawned with the content `look` and despawned on exit;
 * - `none` — wild / raid boss without a trainer.
 *
 * `react(outcome)` plays the result emote (winner `happy` → the `cheer` clip, loser `sad` → the bow pose; render
 * spine §4.1). `end()` restores a restaged static to the pose it stood in (from `restPose`) and despawns a temporary.
 * Allocation-free per frame (`stage`).
 */

/** The slice of render's ActorPool this needs (the director's / World3D's pool, or a test fake). */
export interface FoeActorPool {
  spawn(id: string, d: { readonly look: string; readonly name: string; readonly guildTag: string; readonly isLocal: boolean }): void;
  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void;
  setEmote(id: string, n: 0 | 1 | 2 | 3 | 4 | 5 | 6): void;
  despawn(id: string): void;
}

export interface FoeActorDeps {
  readonly actors: FoeActorPool;
  /** an actor the director spawned (zone NPC / trainer, pocket trainer / leader) */
  isStatic(id: string): boolean;
  /** the remote interpolator currently has a rig for this player */
  isRemote(id: string): boolean;
  /** where a static actor stands when no battle restages it (null: unknown — the director restores it itself) */
  restPose?(id: string): { readonly x: number; readonly z: number; readonly angle: number } | null;
  /**
   * Arena PvP: a player foe with no remote avatar to restage (the arena has no zone room) — their look and name for a
   * temporary stand-in; null = none (the in-world rule: wait for the remote rig).
   */
  playerLook?(id: string): { readonly look: string; readonly name: string } | null;
}

export type FoeSpec =
  | { readonly kind: 'player'; readonly id: string }
  | { readonly kind: 'npc'; readonly id: string; readonly name: string; readonly look: string | null }
  | null;

export type FoeMode = 'none' | 'remote' | 'static' | 'temporary';

/** The id of the temporary actor (one battle at a time per client). */
export const TEMP_FOE_ID = 'battle:foe';
/** render spine §4.1 emotes: 2 = happy (the `cheer` clip), 3 = sad (the bow pose). */
export const EMOTE_CHEER = 2;
export const EMOTE_SAD = 3;

/**
 * The foe of a battle from `BattleView.enterBattle`'s ids: a pvp foe's uuid (never ourselves), else an NPC trainer's
 * content id with its name / look, else none.
 */
export function foeSpecOf(
  foeId: string | null, foeNpc: string | null, selfId: string,
  identify: (id: string) => { readonly name: string; readonly look: string | null },
): FoeSpec {
  if (foeId !== null && foeId !== selfId) return { kind: 'player', id: foeId };
  if (foeNpc === null) return null;
  const who = identify(foeNpc);
  return { kind: 'npc', id: foeNpc, name: who.name, look: who.look };
}

export class FoeActor {
  private mode: FoeMode = 'none';
  private actorId: string | null = null;

  constructor(private readonly d: FoeActorDeps) {}

  get id(): string | null {
    return this.actorId;
  }
  get kind(): FoeMode {
    return this.mode;
  }

  /** Picks the foe actor for a new battle (ends the previous one first). */
  begin(spec: FoeSpec): void {
    this.end();
    if (spec === null) return;
    if (spec.kind === 'player') {
      const stand = this.d.isRemote(spec.id) ? null : (this.d.playerLook?.(spec.id) ?? null);
      if (stand !== null) {
        this.d.actors.spawn(TEMP_FOE_ID, { look: stand.look, name: stand.name, guildTag: '', isLocal: false });
        this.mode = 'temporary';
        this.actorId = TEMP_FOE_ID;
        return;
      }
      this.mode = 'remote';
      this.actorId = spec.id;
      return;
    }
    if (this.d.isStatic(spec.id)) {
      this.mode = 'static';
      this.actorId = spec.id;
      return;
    }
    if (spec.look === null) return;
    this.d.actors.spawn(TEMP_FOE_ID, { look: spec.look, name: spec.name, guildTag: '', isLocal: false });
    this.mode = 'temporary';
    this.actorId = TEMP_FOE_ID;
  }

  /** Every frame while the battle is dressed: the far trainer slot (SceneDirector `trainerPose(bf, 1)`), facing the arena. */
  stage(x: number, z: number, angle: number): void {
    const id = this.actorId;
    if (id === null) return;
    if (this.mode === 'remote' && !this.d.isRemote(id)) return;
    this.d.actors.setTransform(id, x, z, angle, false, false);
  }

  /** The result emote: `won` is the FOE's result (true: the foe won and cheers; false: it lost; null: no winner). */
  react(won: boolean | null): void {
    const id = this.actorId;
    if (id === null || won === null) return;
    if (this.mode === 'remote' && !this.d.isRemote(id)) return;
    this.d.actors.setEmote(id, won ? EMOTE_CHEER : EMOTE_SAD);
  }

  /** Battle over: a static stands back where it stood, a temporary is despawned. Idempotent. */
  end(): void {
    const id = this.actorId;
    if (id !== null) {
      if (this.mode === 'temporary') this.d.actors.despawn(id);
      else if (this.mode === 'static') {
        const p = this.d.restPose?.(id) ?? null;
        if (p !== null) this.d.actors.setTransform(id, p.x, p.z, p.angle, false, false);
      }
    }
    this.mode = 'none';
    this.actorId = null;
  }
}
