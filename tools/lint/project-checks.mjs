import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Upstream EDS runtime. Deliberate vendor updates require a separately reviewed change.
const vendorSha256 = '014479db98bd56d25c248ff45aa705752d871a9eff0484c5620f00cf58b42ae6';

export default function projectIssues(files, read) {
  const issues = [];
  files.forEach((file) => {
    const bytes = read(file);
    if (file === 'scripts/aem.js'
      && (!bytes || createHash('sha256').update(bytes).digest('hex') !== vendorSha256)) {
      issues.push(`${file}: vendored runtime must not be modified or deleted.`);
    }
    if (!bytes || bytes.includes(0)) return;
    const source = bytes.toString('utf8');
    if (/^(?:<{7} .+|={7}|>{7} .+|\|{7} .+)\r?$/m.test(source)) {
      issues.push(`${file}: unresolved merge conflict markers.`);
    }
    if (file === 'package.json') {
      try {
        const pkg = JSON.parse(source);
        if (Object.keys(pkg.dependencies || {}).length
          || Object.keys(pkg.optionalDependencies || {}).length) {
          issues.push(`${file}: this project permits devDependencies only.`);
        }
      } catch {
        issues.push(`${file}: invalid JSON.`);
      }
    }
    if (/(^|\/)(?:node_modules|coverage)\/|(^|\/)\.DS_Store$|(^|\/)\.env(?:$|\.(?!example$|sample$))/.test(file)) {
      issues.push(`${file}: local/generated files must not be committed.`);
    }
  });
  return issues;
}

function main() {
  const staged = process.argv.includes('--staged');
  const args = staged ? ['diff', '--cached', '--name-only', '-z']
    : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  const files = [...new Set(execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean))];
  if (!staged && !files.includes('scripts/aem.js')) files.push('scripts/aem.js');
  const issues = projectIssues(files, (file) => {
    if (staged) {
      try {
        return execFileSync('git', ['show', `:${file}`], { stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        return null; // Deleted paths have no entry in the index.
      }
    }
    try {
      return readFileSync(file);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  });
  if (issues.length) {
    process.stderr.write(`${issues.join('\n')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
