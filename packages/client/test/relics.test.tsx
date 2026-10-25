// @vitest-environment jsdom
/**
 * The Original Master Relics in the client: held items in the item table, so the creature screen's hold picker offers
 * them and the bag shows their names; and the form a held relic puts ravatar in outside a battle (`wornForm`): its art,
 * types and atk / def / spd wherever the creature shows, the Avatar State left to the battle.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RELICS } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { HELD_ITEMS, itemInfo, species, statsOf, typesOf, wornForm } from '../src/data/content';
import { CreatureCard } from '../src/ui/CreatureCard';

const ravatar = (heldItem: string | null): CreatureInstance =>
  ({
    id: 'r1', speciesId: 'ravatar', nickname: null, level: 50, hp: 150, exp: 0, status: [], variantKey: 'normal', isAlpha: false,
    heldItem, ribbons: [], favorite: false, locked: false, moves: [], ability: 'Avatar Cycle',
  }) as unknown as CreatureInstance;

describe('relics in the client item table', () => {
  it('every relic is a held item with its name, never sold', () => {
    expect(RELICS).toHaveLength(5);
    const held = new Set(HELD_ITEMS.map((i) => i.id));
    for (const r of RELICS) {
      expect(held.has(r.id), r.id).toBe(true);
      expect(itemInfo(r.id)).toMatchObject({ name: r.name, kind: 'held', price: null, sellPrice: 0 });
    }
  });
});

describe('the form a held relic puts ravatar in outside a battle', () => {
  it('each elemental relic opens its form at once; no relic, another item or the Vial keeps the base form', () => {
    expect(wornForm(ravatar('spirit_koi_scale'))?.id).toBe('water');
    expect(wornForm(ravatar('badgermole_gem'))?.id).toBe('earth');
    expect(wornForm(ravatar('sun_dragon_ember'))?.id).toBe('fire');
    expect(wornForm(ravatar('sky_bison_whistle'))?.id).toBe('air');
    expect(wornForm(ravatar('spirit_water_vial'))).toBeNull();
    expect(wornForm(ravatar(null))).toBeNull();
    expect(wornForm({ speciesId: 'flampling', heldItem: 'sun_dragon_ember' })).toBeNull();
  });

  it('the form gives the types and the atk / def / spd; max hp keeps the species', () => {
    expect(typesOf(ravatar(null))).toEqual(['Normal']);
    expect(typesOf(ravatar('badgermole_gem'))).toEqual(['Ground', 'Rock']);
    const base = statsOf(ravatar(null));
    const earth = statsOf(ravatar('badgermole_gem'));
    const sp = species('ravatar')!;
    expect(earth.find((s) => s.key === 'hp')).toEqual(base.find((s) => s.key === 'hp'));
    expect(earth.find((s) => s.key === 'def')!.base).toBe(sp.battleForms!.find((f) => f.id === 'earth')!.baseDef);
    expect(base.find((s) => s.key === 'def')!.base).toBe(sp.baseDef);
  });

  it('the creature card shows the form: its thumb, its types', () => {
    const { container, rerender } = render(<CreatureCard creature={ravatar('sun_dragon_ember')} />);
    expect(screen.getAllByTestId('typebadge').map((b) => b.getAttribute('data-type'))).toEqual(['Fire']);
    expect(container.querySelector('[data-form="fire"]')).not.toBeNull();
    rerender(<CreatureCard creature={ravatar(null)} />);
    expect(screen.getAllByTestId('typebadge').map((b) => b.getAttribute('data-type'))).toEqual(['Normal']);
    expect(container.querySelector('[data-form]')).toBeNull();
  });
});
