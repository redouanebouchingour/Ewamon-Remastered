/**
 * Move motion styles (battle/moveStyles.ts): every damaging move in content has one, every style is one of render's
 * `style_*` VFX ids (§10.7.5), the registry draws a move in its style instead of the type default while a hand-authored
 * special effect stays, and the timeline hands the move's type to the stage with it.
 */
import { describe, expect, it } from 'vitest';
import { MOVES, createContentIndex } from '@ewa/content';
import type { BattleEvent } from '@ewa/core';
import { VFX_IDS } from '@ewa/render';
import { MOVE_STYLE, styleVfxOf } from '../src/battle/moveStyles';
import { createMoveAnimRegistry } from '../src/battle/moveAnims';
import { buildTimeline } from '../src/battle/timeline';

const content = createContentIndex();

describe('move motion styles', () => {
  it('every damaging move has a style, every style is a render style_* id, and no status or unknown move has one', () => {
    const damaging = MOVES.filter((m) => m.power > 0).map((m) => m.id).sort();
    expect(Object.keys(MOVE_STYLE).sort()).toEqual(damaging);
    const styles = VFX_IDS.filter((id) => id.startsWith('style_'));
    expect(styles).toHaveLength(14);
    for (const id of damaging) expect(styles, id).toContain(styleVfxOf(id));
    // every style is used
    expect(new Set(Object.values(MOVE_STYLE)).size).toBe(14);
  });

  it('the registry draws a move in its style; a special effect stays', () => {
    const reg = createMoveAnimRegistry();
    const vfx = (id: string): string => reg.get(id, content.move(id)).vfx;
    expect(vfx('Fire Fang')).toBe('style_bite');
    expect(vfx('Heat Wave')).toBe('style_wave');
    expect(vfx('Flame Dash')).toBe('style_tackle');
    expect(vfx('Tackle')).toBe('style_tackle');                // was impact_normal
    expect(vfx('Hollow Crescent')).toBe('form_rage');          // a battle form's special burst
    expect(vfx('Growl')).toBe('stat_down');                    // a status move keeps its effect
  });

  it('the timeline hands the move’s type with its style', () => {
    const ev: BattleEvent[] = [{ t: 'moveUsed', who: { side: 0, slot: 0 }, move: 'Fire Fang', target: { side: 1, slot: 0 }, ppLeft: 9 }];
    const tl = buildTimeline(ev, { content, registry: createMoveAnimRegistry(), reduced: false, speciesOf: () => 'bramblecub' });
    expect(tl.frames.find((f) => f.k === 'vfx')).toMatchObject({ id: 'style_bite', type: 'Fire' });
  });
});
