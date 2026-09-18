/**
 * §2.5 — ability hooks as data. Core never special-cases an ability by name: every behaviour is one of
 * the AbilityHook kinds below, looked up from the battler's ability through the ContentIndex.
 */
import type { AbilityHook, Battler, ContentIndex, StatKey, StatusId, TypeName, WeatherKind } from './types';

type HookOf<K extends AbilityHook['kind']> = Extract<AbilityHook, { kind: K }>;

/** All hooks of the battler's ability, in the ability's hook-array order. Unknown ability id → none. */
export function abilityHooks(b: Battler, content: ContentIndex): readonly AbilityHook[] {
  try {
    return content.ability(b.creature.ability).hooks;
  } catch (_e) {
    return [];
  }
}

export function hooksOfKind<K extends AbilityHook['kind']>(
  hooks: readonly AbilityHook[],
  kind: K,
): readonly HookOf<K>[] {
  const out: HookOf<K>[] = [];
  for (let i = 0; i < hooks.length; i++) {
    const h = hooks[i]!;
    if (h.kind === kind) out.push(h as HookOf<K>);
  }
  return out;
}

export function abilityName(b: Battler): string {
  return b.creature.ability;
}

/** typeImmunity hook that matches the incoming move type, or null. */
export function typeImmunityFor(hooks: readonly AbilityHook[], moveType: TypeName): HookOf<'typeImmunity'> | null {
  const list = hooksOfKind(hooks, 'typeImmunity');
  for (let i = 0; i < list.length; i++) if (list[i]!.moveType === moveType) return list[i]!;
  return null;
}

export function hasWonderGuard(hooks: readonly AbilityHook[]): boolean {
  return hooksOfKind(hooks, 'wonderGuard').length > 0;
}

export function statusImmune(hooks: readonly AbilityHook[], status: StatusId): boolean {
  const list = hooksOfKind(hooks, 'statusImmunity');
  for (let i = 0; i < list.length; i++) if (list[i]!.statuses.indexOf(status) !== -1) return true;
  return false;
}

export function stageLowerImmune(hooks: readonly AbilityHook[], stat: StatKey): boolean {
  const list = hooksOfKind(hooks, 'stageLowerImmunity');
  for (let i = 0; i < list.length; i++) if (list[i]!.stats.indexOf(stat) !== -1) return true;
  return false;
}

/** Product-free: returns every modifySpeed multiplier that applies under `weather`, in hook order. */
export function speedMultipliers(hooks: readonly AbilityHook[], weather: WeatherKind): readonly number[] {
  const out: number[] = [];
  const list = hooksOfKind(hooks, 'modifySpeed');
  for (let i = 0; i < list.length; i++) if (list[i]!.whenWeather === weather) out.push(list[i]!.mul);
  return out;
}

/** Every modifyAttack multiplier that applies, in hook order. */
export function attackMultipliers(hooks: readonly AbilityHook[], statused: boolean): readonly number[] {
  const out: number[] = [];
  const list = hooksOfKind(hooks, 'modifyAttack');
  for (let i = 0; i < list.length; i++) {
    const h = list[i]!;
    if (h.when === 'always' || (h.when === 'statused' && statused)) out.push(h.mul);
  }
  return out;
}

/** Whether the ability carries a "Guts"-style hook (Atk boost while statused): also cancels the burn halving. */
export function hasStatusedAttackBoost(hooks: readonly AbilityHook[]): boolean {
  const list = hooksOfKind(hooks, 'modifyAttack');
  for (let i = 0; i < list.length; i++) if (list[i]!.when === 'statused') return true;
  return false;
}

export interface DamageHookQuery {
  readonly side: 'attacker' | 'defender';
  readonly moveType: TypeName;
  readonly superEffective: boolean;
  readonly flashFired: boolean;
  /** When set, only hooks whose `when` equals it (or, for null, hooks with no `when`) are returned. */
  readonly whenFilter?: 'superEffective' | 'flashFired' | null;
}

/** modifyDamage multipliers that apply, in hook order. */
export function damageMultipliers(hooks: readonly AbilityHook[], q: DamageHookQuery): readonly number[] {
  const out: number[] = [];
  const list = hooksOfKind(hooks, 'modifyDamage');
  for (let i = 0; i < list.length; i++) {
    const h = list[i]!;
    if (h.side !== q.side) continue;
    if (q.whenFilter !== undefined && (h.when ?? null) !== q.whenFilter) continue;
    if (h.moveTypes !== undefined && h.moveTypes.indexOf(q.moveType) === -1) continue;
    if (h.when === 'superEffective' && !q.superEffective) continue;
    if (h.when === 'flashFired' && !q.flashFired) continue;
    out.push(h.mul);
  }
  return out;
}

/** modifyAccuracy multipliers that apply, in hook order. */
export function accuracyMultipliers(
  hooks: readonly AbilityHook[],
  side: 'attacker' | 'defender',
  weather: WeatherKind,
  damaging: boolean,
): readonly number[] {
  const out: number[] = [];
  const list = hooksOfKind(hooks, 'modifyAccuracy');
  for (let i = 0; i < list.length; i++) {
    const h = list[i]!;
    if (h.side !== side) continue;
    if (h.whenWeather !== undefined && h.whenWeather !== weather) continue;
    if (h.onlyDamaging === true && !damaging) continue;
    out.push(h.mul);
  }
  return out;
}
