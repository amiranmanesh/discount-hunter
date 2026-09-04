#!/usr/bin/env node
/**
 * Prepares a release: bumps the version and checks the changelog is ready.
 *
 *   npm run release -- patch|minor|major|<version>
 *
 * It changes nothing on GitHub. Pushing the commit to `main` is what publishes:
 * the workflow builds the image, tags `vX.Y.Z` and cuts the release from this
 * version's changelog section.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const pkgPath = path.join(ROOT, 'package.json');
const changelogPath = path.join(ROOT, 'CHANGELOG.md');

const bump = process.argv[2];
if (!bump) {
  console.error('usage: npm run release -- patch|minor|major|<version>');
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

if (git('status', '--porcelain')) {
  console.error('The working tree is dirty. Commit or stash first.');
  process.exit(1);
}
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
  console.error('Releases are cut from main.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const next = nextVersion(pkg.version, bump);

if (tagExists(`v${next}`)) {
  console.error(`v${next} is already tagged.`);
  process.exit(1);
}

const changelog = readFileSync(changelogPath, 'utf8');
const unreleased = section(changelog, 'Unreleased');
if (!unreleased.trim()) {
  console.error('CHANGELOG.md has nothing under "## [Unreleased]".');
  console.error('A release with no notes is a release nobody can read.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  changelogPath,
  changelog.replace('## [Unreleased]', `## [Unreleased]\n\n## [${next}] — ${today}`),
);
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`${pkg.name} → ${next}`);
console.log('\nNext:');
console.log('  npm run verify');
console.log(`  git commit -am "chore(release): v${next}"`);
console.log('  git push origin main   # this is what publishes');

function nextVersion(current, how) {
  if (/^\d+\.\d+\.\d+$/.test(how)) return how;
  const [major, minor, patch] = current.split('.').map(Number);
  if (how === 'major') return `${major + 1}.0.0`;
  if (how === 'minor') return `${major}.${minor + 1}.0`;
  if (how === 'patch') return `${major}.${minor}.${patch + 1}`;
  console.error(`Unknown bump "${how}".`);
  process.exit(1);
}

function tagExists(tag) {
  try {
    git('rev-parse', '--verify', `refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

/** The body of one `## [heading]` block, up to the next one. */
function section(text, heading) {
  const start = text.indexOf(`## [${heading}]`);
  if (start === -1) return '';
  const after = text.indexOf('\n## [', start + 1);
  return text.slice(text.indexOf('\n', start), after === -1 ? undefined : after);
}
