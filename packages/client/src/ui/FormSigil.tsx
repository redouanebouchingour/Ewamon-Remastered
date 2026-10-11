/**
 * Majin / Tenjin (`.design/majin-tenjin.md` §2, §6.5): the form sigil. One shape, two answers — the Provision's assay
 * ring CRACKED (Majin, crimson) or WHOLE with its lens (Tenjin, gold). Drawn with currentColor like `Icon`; the
 * colour comes from the kind's class, never from the orange accent. Used as the party / box / Dex mark on species with
 * a form, and as the battle menu's transform toggle glyph. Decorative unless `label` is passed.
 */
import type { BandKind } from '@ewa/core';
import { species } from '../data/content';
import { cx } from './cx';
import s from './FormSigil.module.css';

/** the cracked ring: an arc broken at the top right, a jagged crack running into the break */
const MAJIN_D = 'M18.13 6.86A8 8 0 1 1 14.07 4.27M16.4 3.6l-1.5 3.2 2.3.8-2 3.4';
/** the whole ring, its lens and four ticks */
const TENJIN_D = 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 1.5v1.5M12 21v1.5M1.5 12H3M21 12h1.5';

/** "Majin" / "Tenjin" */
export const FORM_KIND_NAME: Readonly<Record<BandKind, string>> = { majin: 'Majin', tenjin: 'Tenjin' };

/** The accessible label of a species' mark: "Has a Majin Form". */
export function formMarkLabel(kind: BandKind): string {
  return `Has a ${FORM_KIND_NAME[kind]} Form`;
}

/** The form kind of a species (null: no form, or an automatic form with no kind). */
export function formKindOf(speciesId: string): BandKind | null {
  return species(speciesId)?.battleForm?.kind ?? null;
}

export interface FormSigilProps {
  readonly kind: BandKind;
  readonly size?: 'sm' | 'md' | 'lg';
  /** the accessible name; absent = decorative (aria-hidden) */
  readonly label?: string;
  readonly className?: string;
}

export function FormSigil({ kind, size = 'sm', label, className }: FormSigilProps) {
  return (
    <svg
      data-testid="formsigil"
      data-kind={kind}
      className={cx(s.sigil, s[size], s[kind], className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? undefined : 'img'}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
    >
      <path d={kind === 'majin' ? MAJIN_D : TENJIN_D} />
    </svg>
  );
}

/** A species' mark (party, box, Dex): the sigil labelled "Has a … Form", or nothing for a species without one. */
export function FormMark({ speciesId, size = 'sm', className }: { readonly speciesId: string; readonly size?: 'sm' | 'md' | 'lg'; readonly className?: string }) {
  const kind = formKindOf(speciesId);
  if (kind === null) return null;
  return (
    <span className={cx(s.mark, className)} title={formMarkLabel(kind)}>
      <FormSigil kind={kind} size={size} label={formMarkLabel(kind)} />
    </span>
  );
}
