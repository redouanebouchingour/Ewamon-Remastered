/**
 * Camp bases (SPEC §3.19, §20.4.9): the zone's travellers' camp in the world. The zone room's `campOwner` / `campName`
 * / `campTrophies` (`setState`) become the render's banner and trophies round the fire (`ZoneHandle.camps`, §10.7.10),
 * the camp store the Camp screen reads, and the campfire's `camp` interactable ("Visit the travellers' camp", or the
 * held camp's banner name); `E` there opens the Camp screen. A state for another zone than the one standing (a
 * handover in flight) waits until that zone is the one shown.
 */
import { TROPHY_KINDS, campOf, CAMP_PROMPT_M } from '@ewa/content';
import type { TrophyKind, ZoneDef } from '@ewa/content';
import type { CampsHandle } from '@ewa/render';
import { useCampStore } from '../state/camp';
import type { Interactable, InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';

export const CAMP_TARGET_ID = 'camp:fire';

export interface CampViewDeps {
  readonly targets: InteractionTargets;
  interactKey(): string;
  /** the shown zone's camps handle (null: none, or no zone built) */
  camps(): CampsHandle | null;
}

/** The trophy kinds a zone state carries ('legend,medal' → ['legend', 'medal']; unknown kinds dropped). */
export function parseTrophies(s: string): TrophyKind[] {
  if (s.length === 0) return [];
  return s.split(',').filter((k): k is TrophyKind => (TROPHY_KINDS as readonly string[]).includes(k));
}

/** The prompt's target words for the camp. */
export function campPromptTarget(owner: string, name: string): string {
  return owner === '' ? "the travellers' camp" : name;
}

export class CampViews {
  private zone: ZoneDef | null = null;
  private entry: Interactable | null = null;
  private state: { zoneId: string | null; owner: string; name: string; trophies: TrophyKind[] } = { zoneId: null, owner: '', name: '', trophies: [] };

  constructor(private readonly d: CampViewDeps) {}

  /** A zone is shown (null: none): its campfire becomes a target, and the room's camp state is drawn when it is this zone's. */
  onZone(zone: ZoneDef | null): void {
    this.zone = zone;
    this.apply();
  }

  /** The zone room's camp fields changed (or a room was joined). */
  setState(zoneId: string | null, owner: string, name: string, trophies: string): void {
    this.state = { zoneId, owner, name, trophies: parseTrophies(trophies) };
    this.apply();
  }

  private apply(): void {
    const z = this.zone;
    const camp = z === null ? null : campOf(z.id);
    if (this.entry !== null) {
      this.d.targets.removeDynamic(this.entry.id);
      this.entry = null;
    }
    if (z === null || camp === null) {
      useCampStore.getState().setCamp({ zoneId: null, owner: '', name: '', trophies: [] });
      return;
    }
    const st = this.state.zoneId === z.id ? this.state : { zoneId: z.id, owner: '', name: '', trophies: [] };
    this.entry = makeInteractable(CAMP_TARGET_ID, 'camp', camp.fire.x, camp.fire.z, 'Visit', campPromptTarget(st.owner, st.name), this.d.interactKey(), CAMP_PROMPT_M);
    this.d.targets.addDynamic(this.entry);
    this.d.camps()?.set(z.id, st.owner === '' ? null : { trophies: st.trophies });
    useCampStore.getState().setCamp({ zoneId: z.id, owner: st.owner, name: st.name, trophies: st.trophies });
  }

  dispose(): void {
    if (this.entry !== null) this.d.targets.removeDynamic(this.entry.id);
    this.entry = null;
    this.zone = null;
    useCampStore.getState().setCamp({ zoneId: null, owner: '', name: '', trophies: [] });
  }
}
