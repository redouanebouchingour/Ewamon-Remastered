# Acier, four swords (2026-11-03)

Acier's front and back redrawn so each of its four arms holds one sword: Ichigo's Shikai Zangetsu, his true Bankai
Zangetsu, Asta's Demon-Slayer Sword and Guts' Dragon Slayer. gpt-image-2, medium, the user's key, five calls (about
$0.47).

- `front.txt`, `front-2.txt`: first tries, swords described in words (then by name). Not used.
- `front-3.txt`: image 1 the old front on magenta (`../acier-majin/acier-front-ref.png`), image 2 a sheet of the
  user's four sword pictures. Swords right, but a stray fifth arm and a floating upper arm.
- `front-4.txt` -> `front-4.png` (shipped): image 1 the front-3 draft, image 2 the old front, image 3 the sword sheet,
  with a shoulder-by-shoulder anatomy list.
- `back-1.txt` -> `back-1.png` (shipped): image 1 front-4, image 2 the old back (`../acier-majin/acier-back-ref.png`),
  image 3 the sword sheet.

The drafts and the sword sheet (third-party pictures) stay in `assets-src/imagegen/acier-swords/` (gitignored), with
the old sources under `old/`. Keyed by `scripts/key-forms.ts --src <dir>` with no override.

## Majin Acier

Redrawn the same day from the new Acier so the form keeps the four swords, two more calls (about $0.18):

- `majin-front-1.txt` -> `majin-front-1.png`: image 1 the new Acier front (`front-4.png`), image 2 the old Majin
  front (`../acier-majin/majin-front-1.png`), image 3 the sword sheet.
- `majin-back-1.txt` -> `majin-back-1.png`: image 1 the new Majin front, image 2 the new Acier back (`back-1.png`).

Both go through `assets-src/forms-pending/` and `scripts/key-forms.ts --only acier_majin`, no override. The old
Majin sources are kept in `assets-src/imagegen/acier-swords/old/`.
