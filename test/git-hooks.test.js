/* eslint-env node */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('real hooks reject invalid messages and staged pixels while preserving partial staging', () => {
  const root = resolve('.');
  const directory = mkdtempSync(join(tmpdir(), 'etrade-hooks-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const commit = (message) => spawnSync('git', [
    '-c', 'user.name=Guardrail Test', '-c', 'user.email=guardrail@example.test',
    'commit', '--quiet', '-m', message,
  ], { cwd: directory, encoding: 'utf8', env: { ...process.env, HUSKY: '1' } });
  try {
    git('init', '--quiet');
    ['blocks/cards', 'styles', 'docs', 'tools/lint', 'scripts'].forEach((path) => mkdirSync(join(directory, path), { recursive: true }));
    [
      'package.json', 'commitlint.config.mjs', 'lint-staged.config.mjs',
      '.eslintrc.js', '.eslintignore', '.stylelintrc.json', '.husky', 'tools/lint', 'scripts/aem.js',
    ].forEach((file) => cpSync(join(root, file), join(directory, file), { recursive: true }));
    writeFileSync(join(directory, '.gitignore'), 'node_modules/\n');
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const css = join(directory, 'blocks/cards/cards.css');
    writeFileSync(css, '.cards { padding: 1rem; }\n');
    writeFileSync(join(directory, 'blocks/cards/cards.js'), 'export default true;\n');
    writeFileSync(join(directory, 'styles/example.css'), '.example { margin: 0; }\n');
    writeFileSync(join(directory, 'docs/example.css'), '.example { margin: 0; }\n');
    writeFileSync(join(directory, 'tools/example.css'), '.example { margin: 0; }\n');
    git('add', '.');
    git('-c', 'user.name=Guardrail Test', '-c', 'user.email=guardrail@example.test', 'commit', '--quiet', '--no-verify', '-m', 'test: seed hooks');
    execFileSync(process.execPath, [join(root, 'node_modules/husky/bin.js')], { cwd: directory, env: { ...process.env, HUSKY: '1' } });

    writeFileSync(join(directory, 'blocks/cards/card example.js'), 'export default false;\n');
    git('add', '.');
    const invalid = commit('updated stuff');
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout + invalid.stderr, /type-empty/);
    assert.equal(git('rev-list', '--count', 'HEAD').trim(), '1');
    const valid = commit('fix(cards): preserve readable spacing');
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.equal(git('rev-list', '--count', 'HEAD').trim(), '2');

    writeFileSync(css, '.cards { padding: 16px; }\n');
    git('add', '.');
    writeFileSync(css, '.cards { padding: 2rem; }\n');
    const pixels = commit('style(cards): update spacing');
    assert.notEqual(pixels.status, 0);
    assert.match(pixels.stdout + pixels.stderr, /declaration-property-unit-disallowed-list/);
    assert.equal(readFileSync(css, 'utf8'), '.cards { padding: 2rem; }\n');
    assert.equal(git('show', ':blocks/cards/cards.css'), '.cards { padding: 16px; }\n');

    // Deletions are normally omitted by lint-staged's default file filter.
    writeFileSync(css, '.cards { padding: 1rem; }\n');
    git('add', '.');
    git('rm', '--quiet', 'scripts/aem.js');
    const deletion = commit('chore: remove vendor');
    assert.notEqual(deletion.status, 0);
    assert.match(deletion.stdout + deletion.stderr, /vendored/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
