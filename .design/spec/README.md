# spec/ — section files of the binding SPEC

`.design/SPEC.md` is not hand-edited. It is assembled by the reconciler from the files in this directory, in filename order:

- `00-spine.md` — status, art pillars, `@ewa/core` API, `@ewa/content` schema, `@ewa/protocol` wire, `@ewa/persist` tables. Every other section codes against it.
- `10-render.md`, `20-client.md`, `30-server-netcode.md`, `40-pipelines.md`, `50-verification-budget.md` — one package or concern each.

Rules: a later file may reference an interface from `00-spine.md` but may not redefine it; on conflict the lower-numbered file wins. Every TypeScript block is verbatim and implementers copy it unchanged. LF line endings. No marketing language; every sentence checkable.
