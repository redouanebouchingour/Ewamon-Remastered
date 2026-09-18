/** §2.8 — status helpers. `status` is an array; major statuses are mutually exclusive here and nowhere else. */
import type { MajorStatus, StatusId } from './types';

export const MAJOR_STATUSES: readonly MajorStatus[] = ['burn', 'poison', 'paralyze', 'sleep', 'freeze'];

export function isMajorStatus(s: StatusId): s is MajorStatus {
  return s !== 'confuse';
}

export function hasStatus(status: readonly StatusId[], s: StatusId): boolean {
  return status.indexOf(s) !== -1;
}

export function majorStatus(status: readonly StatusId[]): MajorStatus | null {
  for (let i = 0; i < status.length; i++) {
    const s = status[i]!;
    if (isMajorStatus(s)) return s;
  }
  return null;
}

/** Enforces the exclusivity rule. Returns a new array; never mutates. Returns the input unchanged when blocked or already present. */
export function addStatus(status: readonly StatusId[], s: StatusId): readonly StatusId[] {
  if (hasStatus(status, s)) return status;
  if (isMajorStatus(s) && majorStatus(status) !== null) return status;
  return [...status, s];
}

export function removeStatus(status: readonly StatusId[], s: StatusId): readonly StatusId[] {
  if (!hasStatus(status, s)) return status;
  const out: StatusId[] = [];
  for (let i = 0; i < status.length; i++) if (status[i] !== s) out.push(status[i]!);
  return out;
}

/** Removes every major status, keeping confusion. */
export function clearMajorStatus(status: readonly StatusId[]): readonly StatusId[] {
  const out: StatusId[] = [];
  for (let i = 0; i < status.length; i++) if (!isMajorStatus(status[i]!)) out.push(status[i]!);
  return out.length === status.length ? status : out;
}
