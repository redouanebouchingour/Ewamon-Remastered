# spec/ — section files of the binding SPEC

`.design/SPEC.md` is not hand-edited. It is assembled by the reconciler (`node .design/spec/assemble.mjs`) from the files in this directory, in filename order:

- `00-spine.md` — status, art pillars, `@ewa/core` API, `@ewa/content` schema (incl. §3.11 Heightfield, §3.12 Bodies), `@ewa/protocol` wire, `@ewa/persist` tables and repositories. Every other section codes against it.
- `10-render.md`, `20-client.md`, `30-server-netcode.md`, `40-pipelines.md`, `50-verification-budget.md` — one package or concern each.
- `CHANGELOG.md` — every edit to a section file, newest first, in the §50.7 format. CI (`scripts/check-spec-changelog.mjs`) fails a PR that touches a section without touching it.

Rules: a later file may reference an interface from `00-spine.md` but may not redefine it; on conflict the lower-numbered file wins. Every TypeScript block is verbatim and implementers copy it unchanged. A higher section may **mirror** a lower section's type only when the import graph forbids the import and the declaration text is identical (§50.7 rule 5); `assemble.mjs` refuses to build when the same exported identifier is declared differently in two files. LF line endings. No marketing language; every sentence checkable.

Reconciliation marks: `<!-- reconciled <date>: … -->` next to an edit means the CHANGELOG entry of that date explains it. The "OPEN QUESTIONS" lists at the end of `10`–`40` are kept as audit trails; every item is marked resolved and points at the section that answers it.

Package → section: `@ewa/core` §2 · `@ewa/content` §3 · `@ewa/protocol` §4 · `@ewa/persist` §5 · `@ewa/render` §10 · `@ewa/client` §20 · `@ewa/server` §30 · `tools/*` §40 · tests, budgets, cuts, definition of done §50.
