/**
 * Followers with field powers (SPEC §3.18, §20.4.8): the always-visible hint chip over the world. It says who walks
 * behind the player and what that lead can do here: one line per power, its type icon, the label and the zone's own
 * hint (dimmed when there is nothing for it to do in this zone), the power key on a paper chip when it has one (a
 * Psychic lead's sense). Broadcast look: a black slab with a hairline under the minimap, condensed uppercase labels,
 * type colour as the hero, no green.
 *
 * Fed by the world's `FieldPowerSystem` through `useFieldPowerStore` (written only when what it shows changes).
 */
import type { TypeName, VariantKey } from '@ewa/core';
import { FIELD_POWER_TEXT, FIELD_POWER_TYPE } from '@ewa/content';
import { useFieldPowerStore } from '../state/fieldPowers';
import { useSettingsStore } from '../state/settings';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TypeBadge } from '../ui/TypeBadge';
import s from './FieldPowerChip.module.css';

export function FieldPowerChip() {
  const lead = useFieldPowerStore((st) => st.lead);
  const enabled = useFieldPowerStore((st) => st.enabled);
  const hints = useFieldPowerStore((st) => st.hints);
  // LLM feature 6: the key that talks with the lead
  const talkKey = useSettingsStore((st) => (st.keybinds.buddyTalk[0] ?? 'KeyY').replace(/^Key|^Digit/, ''));
  if (lead === null) return null;
  return (
    <aside className={s.chip} aria-label="Field powers" data-testid="field-power-chip">
      <div className={s.head}>
        <CreatureSprite speciesId={lead.speciesId} variantKey={lead.variantKey as VariantKey} size="sm" className={s.sprite} />
        <span className={s.lead}>
          <span className={s.eyebrow}>Walking with you</span>
          <span className={s.name}>{lead.name}</span>
        </span>
        <span className={s.types}>
          {lead.types.map((t) => (
            <TypeBadge key={t} type={t as TypeName} size="sm" compact />
          ))}
        </span>
      </div>
      {!enabled ? (
        <p className={s.none}>Field powers rest on this server</p>
      ) : hints.length === 0 ? (
        <p className={s.none}>No field power. Lead with a Flying, Fire, Ground, Psychic or Water type.</p>
      ) : (
        <ul className={s.powers}>
          {hints.map((h) => (
            <li key={h.power} className={s.power} data-here={h.here || undefined} data-testid={`field-power-${h.power}`}>
              <TypeBadge type={FIELD_POWER_TYPE[h.power]} size="sm" compact />
              <span className={s.label}>{FIELD_POWER_TEXT[h.power].label}</span>
              <span className={s.text}>{h.text}</span>
              {h.key !== null && <kbd className={s.key}>{h.key}</kbd>}
            </li>
          ))}
        </ul>
      )}
      <p className={s.talk} data-testid="field-power-talk">
        <kbd className={s.key}>{talkKey}</kbd>
        <span>Talk with {lead.name}</span>
      </p>
    </aside>
  );
}
