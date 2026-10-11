// Sanity checks for the single-page site: every push to main goes live, so
// catch a broken page before it does. Run with `node scripts/check.mjs`.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const html = readFileSync('index.html', 'utf8');
const errors = [];

// Each inline script must parse.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length === 0) errors.push('no inline <script> found');
const dir = mkdtempSync(join(tmpdir(), 'myrai-check-'));
scripts.forEach((src, i) => {
  const file = join(dir, `script-${i}.js`);
  writeFileSync(file, src);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    errors.push(`inline script ${i} does not parse:\n${e.stderr}`);
  }
});

// Every element the script looks up by id must exist in the markup.
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
for (const m of html.matchAll(/getElementById\('([^']+)'\)/g)) {
  if (!ids.has(m[1])) errors.push(`script references missing #${m[1]}`);
}

// The page promises never to touch the network; keep that promise.
if (!/connect-src 'none'/.test(html)) errors.push("CSP no longer sets connect-src 'none'");

if (readFileSync('CNAME', 'utf8').trim() !== 'myrai.vip') errors.push('CNAME is not myrai.vip');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`ok: ${scripts.length} script(s) parse, ${ids.size} ids, CSP and CNAME intact`);
