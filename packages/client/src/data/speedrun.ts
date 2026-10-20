/**
 * Verified speedruns on the client: split names and the clock's format. The time itself is the server's
 * (GET /speedrun): the client only counts on from it while the clock runs.
 */
import { BADGES, storyBeat, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';

/** h:mm:ss (m:ss under an hour). */
export function formatPlayMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function humanize(id: string): string {
  const s = id.replace(/_/g, ' ');
  return s.length === 0 ? id : s[0]!.toUpperCase() + s.slice(1);
}

/** A split's name: a story beat (its id, where it happens), a badge, the Champion. */
export function splitLabel(split: string): string {
  if (split === 'champion') return 'Champion';
  if (split.startsWith('badge:')) {
    const id = split.slice('badge:'.length);
    return `${BADGES.find((b) => b.id === id)?.name ?? humanize(id)} Badge`;
  }
  if (split.startsWith('beat:')) {
    const id = split.slice('beat:'.length);
    let where = '';
    try {
      where = ` · ${zone(storyBeat(id).zoneId as ZoneId).name}`;
    } catch (_e) {
      // an unknown beat keeps its id
    }
    return `${humanize(id)}${where}`;
  }
  return humanize(split);
}
