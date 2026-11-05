/* eslint-env node */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import projectIssues from '../tools/lint/project-checks.mjs';
import previewIssues from '../tools/lint/pr-checks.mjs';

test('project checks reject changed or deleted vendor code and allow the checked-in vendor', () => {
  assert.deepEqual(projectIssues(['scripts/aem.js'], () => readFileSync('scripts/aem.js')), []);
  assert.match(projectIssues(['scripts/aem.js'], () => Buffer.from('changed vendor')).join(), /vendored/);
  assert.match(projectIssues(['scripts/aem.js'], () => null).join(), /vendored/);
});

test('project checks reject conflict markers and runtime dependencies without scanning binary files', () => {
  const input = new Map([
    ['scripts/example.js', Buffer.from('<<<<<<< ours\nconst value = 1;\n=======\nconst value = 2;\n>>>>>>> theirs\n')],
    ['package.json', Buffer.from('{"dependencies":{"example":"1.0.0"}}')],
    ['example.png', Buffer.from([0, 61, 61, 61])],
    ['removed.js', null],
  ]);
  const issues = projectIssues([...input.keys()], (file) => input.get(file));
  assert.equal(issues.length, 2);
  assert.ok(issues.some((issue) => issue.includes('conflict')));
  assert.ok(issues.some((issue) => issue.includes('devDependencies')));
  assert.deepEqual(projectIssues(['package.json'], () => Buffer.from('{"devDependencies":{"example":"1.0.0"}}')), []);
});

test('PR previews must target the actual branch and repository over HTTPS, including slash branches', () => {
  const valid = 'After: https://codex-cleanup-lint-guardrails--etrade--AdobeDrago.aem.page/home';
  assert.deepEqual(previewIssues(valid, 'codex/cleanup-lint-guardrails'), []);
  [
    '', 'https://main--etrade--adobedrago.aem.page/home',
    'https://codex-cleanup-lint-guardrails--etrade--adobedrago.aem.live/home',
    'https://codex-cleanup-lint-guardrails--etrade--adobedrago.aem.page.evil.test/home',
    'http://codex-cleanup-lint-guardrails--etrade--adobedrago.aem.page/home',
    'https://<branch>--etrade--AdobeDrago.aem.page/<path>',
    'https://codex-cleanup-lint-guardrails--etrade--AdobeDrago.aem.page/<path>',
    'https://user@codex-cleanup-lint-guardrails--etrade--AdobeDrago.aem.page/home',
  ].forEach((body) => assert.equal(previewIssues(body, 'codex/cleanup-lint-guardrails').length, 1, body));
});

test('full repository checks reject an absent vendor even when Git no longer lists it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'etrade-missing-vendor-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    const result = spawnSync(process.execPath, [resolve('tools/lint/project-checks.mjs')], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /vendored/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('staged checks read the index, preserve unstaged edits and reject staged vendor deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'etrade-project-check-'));
  const script = resolve('tools/lint/project-checks.mjs');
  const git = (...args) => execFileSync('git', args, { cwd: directory });
  const run = () => spawnSync(process.execPath, [script, '--staged'], { cwd: directory, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    mkdirSync(join(directory, 'scripts'));
    writeFileSync(join(directory, 'scripts/example.js'), '<<<<<<< ours\n=======\n>>>>>>> theirs\n');
    git('add', '.');
    writeFileSync(join(directory, 'scripts/example.js'), 'const clean = true;\n');
    assert.equal(run().status, 1);
    assert.match(run().stderr, /conflict/);
    git('add', '.');
    writeFileSync(join(directory, 'scripts/example.js'), '<<<<<<< unstaged\n');
    assert.equal(run().status, 0);
    assert.equal(readFileSync(join(directory, 'scripts/example.js'), 'utf8'), '<<<<<<< unstaged\n');
    writeFileSync(join(directory, 'scripts/aem.js'), readFileSync('scripts/aem.js'));
    git('add', '.');
    git('-c', 'user.name=Guardrail Test', '-c', 'user.email=guardrail@example.test', 'commit', '--quiet', '--no-verify', '-m', 'test: seed repository');
    git('rm', '--quiet', 'scripts/aem.js');
    assert.equal(run().status, 1);
    assert.match(run().stderr, /vendored/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
