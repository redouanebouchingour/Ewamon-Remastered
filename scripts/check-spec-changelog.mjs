#!/usr/bin/env node
/**
 * SPEC change control, `.design/SPEC.md` §50.7 rule 4.
 *
 *   node scripts/check-spec-changelog.mjs [baseRef]
 *
 * Fails when the diff against `baseRef` (default: origin/main, else HEAD~1) touches a
 * `.design/spec/*.md` part file or `packages/core/test/fuzz-digests.json` without touching
 * `.design/spec/CHANGELOG.md`, and when the newest CHANGELOG heading is dated neither today
 * nor yesterday (UTC). A diff that touches none of those files passes without the date check.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function resolveBase(arg) {
  const candidates = arg ? [arg] : ['origin/main', 'HEAD~1'];
  for (const ref of candidates) {
    try {
      return git('merge-base', ref, 'HEAD');
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`no usable base ref among ${candidates.join(', ')}`);
}

const base = resolveBase(process.argv[2]);
const changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
const CHANGELOG = '.design/spec/CHANGELOG.md';
const guarded = changed.filter(
  (f) => (f.startsWith('.design/spec/') && f.endsWith('.md') && f !== CHANGELOG && f !== '.design/spec/README.md') || f === 'packages/core/test/fuzz-digests.json',
);

if (guarded.length === 0) {
  console.log('spec changelog: no guarded file changed');
  process.exit(0);
}
if (!changed.includes(CHANGELOG)) {
  console.error(`spec changelog: these files changed without an entry in ${CHANGELOG}:\n  ${guarded.join('\n  ')}`);
  process.exit(1);
}

const heading = readFileSync(CHANGELOG, 'utf8')
  .split('\n')
  .find((l) => /^## \d{4}-\d{2}-\d{2} — /.test(l));
if (!heading) {
  console.error(`spec changelog: ${CHANGELOG} has no "## YYYY-MM-DD — …" heading`);
  process.exit(1);
}
const date = heading.slice(3, 13);
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const yesterday = new Date(today.getTime() - 86_400_000);
if (date !== iso(today) && date !== iso(yesterday)) {
  console.error(`spec changelog: newest entry is dated ${date}; expected ${iso(today)} or ${iso(yesterday)} (UTC)`);
  process.exit(1);
}
console.log(`spec changelog: ${guarded.length} guarded file(s) changed, newest entry ${date}`);
