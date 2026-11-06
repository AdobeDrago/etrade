/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readSiteInventory } from '../tools/plugins/disclosure-manager/inventory.js';
import {
  applyOperation, readOperation, restoreOperation, resumeOperation,
} from '../tools/plugins/disclosure-manager/operations.js';

const context = { org: 'adobedrago', repo: 'etrade', path: '/home' };
const setPath = '/disclosures/sets/homepage.json';

async function server() {
  const state = {
    sources: new Map([['/home', 'old home'], ['/copy/shared', 'old copy'], [setPath, 'old set']]),
    writes: [],
    failAt: 0,
    timeoutAt: 0,
    manifestFailure: false,
    diverge: false,
  };
  state.request = async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://admin.da.live');
    const site = '/adobedrago/etrade';
    if (parsed.pathname.startsWith(`/list${site}`)) {
      const folder = parsed.pathname.slice(`/list${site}`.length);
      const listing = new Map();
      [...state.sources.keys()].forEach((path) => {
        if (!path.startsWith(`${folder}/`)) return;
        const relative = path.slice(folder.length + 1);
        const [name] = relative.split('/');
        const ext = path.endsWith('.json') ? 'json' : 'html';
        listing.set(name, relative.includes('/') ? { path: `${site}${folder}/${name}` }
          : { path: `${site}${path}${ext === 'html' ? '.html' : ''}`, ext });
      });
      return Response.json([...listing.values()]);
    }
    const path = parsed.pathname.slice(`/source${site}`.length).replace(/\.html$/, '');
    if (options.method === 'POST') {
      const source = await options.body.get('data').text();
      if (path.startsWith('/.da/')) {
        if (state.manifestFailure) return new Response('', { status: 403 });
      } else {
        state.writes.push(path);
        if (state.writes.length === state.failAt) {
          if (state.diverge) state.sources.set('/home', 'collaborator edit');
          return new Response('', { status: 500 });
        }
      }
      state.sources.set(path, source);
      if (!path.startsWith('/.da/') && state.writes.length === state.timeoutAt) {
        throw new Error('Response lost after successful write');
      }
      return new Response('');
    }
    return new Response(state.sources.get(path) || '', { status: state.sources.has(path) ? 200 : 404 });
  };
  state.plan = {
    namespace: 'homepage',
    setPath,
    mapping: [['1', '2'], ['2', '1']],
    issues: [],
    affectedPages: ['/home'],
    inventory: await readSiteInventory(context, state.request),
    writes: [...state.sources].map(([path, original]) => ({
      path,
      original,
      target: original.replace('old', 'new'),
      references: 1,
      kind: path === setPath ? 'set' : 'citations',
    })),
  };
  return state;
}

test('a successful operation persists recovery data and verifies every source with the set last', async () => {
  const api = await server();
  const result = await applyOperation(context, api.plan, api.request);
  assert.equal(result.ok, true);
  assert.deepEqual(api.writes, ['/home', '/copy/shared', setPath]);
  assert.equal(api.sources.get('/home'), 'new home');
  const saved = await readOperation(context, setPath, api.request);
  assert.equal(saved.status, 'complete');
  assert.equal(saved.writes[0].original, 'old home');
  assert.ok(saved.writes[0].originalHash);
  assert.equal(JSON.stringify(saved).includes('Authorization'), false);
});

test('source changes, a new consumer and an unavailable manifest prevent content writes', async () => {
  const changed = await server();
  changed.sources.set('/home', 'a later edit');
  await assert.rejects(applyOperation(context, changed.plan, changed.request), /changed|conflict/i);
  assert.deepEqual(changed.writes, []);
  const added = await server();
  added.sources.set('/new-page', 'another consumer');
  await assert.rejects(applyOperation(context, added.plan, added.request), /inventory|consumer|changed/i);
  assert.deepEqual(added.writes, []);
  const denied = await server();
  denied.manifestFailure = true;
  await assert.rejects(applyOperation(context, denied.plan, denied.request), /403|recovery|manifest/i);
  assert.deepEqual(denied.writes, []);
});

test('a failure at each content write restores only outputs owned by that operation', async () => {
  const cases = await Promise.all([1, 2, 3].map(async (failAt) => {
    const api = await server();
    api.failAt = failAt;
    const result = await applyOperation(context, api.plan, api.request);
    assert.equal(result.ok, false);
    assert.equal(result.operation.status, 'restored');
    api.plan.writes.forEach((write) => assert.equal(api.sources.get(write.path), write.original));
    return result;
  }));
  assert.equal(cases.length, 3);
});

test('a lost successful POST response is verified rather than applied twice', async () => {
  const api = await server();
  api.timeoutAt = 1;
  const result = await applyOperation(context, api.plan, api.request);
  assert.equal(result.ok, true);
  assert.deepEqual(api.writes, ['/home', '/copy/shared', setPath]);
});

test('resume after reopening writes only unfinished sources and rejects a different site', async () => {
  const api = await server();
  await applyOperation(context, api.plan, api.request);
  const operation = await readOperation(context, setPath, api.request);
  operation.status = 'writing';
  const manifestPath = [...api.sources.keys()].find((path) => path.startsWith('/.da/'));
  api.sources.set(manifestPath, JSON.stringify(operation));
  api.sources.set('/copy/shared', 'old copy');
  api.writes = [];
  const resumed = await resumeOperation(context, operation, api.request);
  assert.equal(resumed.ok, true);
  assert.deepEqual(api.writes, ['/copy/shared']);
  await assert.rejects(restoreOperation({ ...context, repo: 'other' }, operation, api.request), /site|context/i);
});

test('rollback preserves collaborator changes and leaves a recoverable conflict', async () => {
  const api = await server();
  api.failAt = 2;
  api.diverge = true;
  const result = await applyOperation(context, api.plan, api.request);
  assert.equal(result.ok, false);
  assert.equal(result.operation.status, 'recovery-required');
  assert.equal(api.sources.get('/home'), 'collaborator edit');
  assert.ok(result.unresolved.includes('/home'));
  const operation = await readOperation(context, setPath, api.request);
  assert.equal(operation.status, 'recovery-required');
});

test('listing order does not invalidate the same reviewed inventory', async () => {
  const api = await server();
  const reordered = async (url, options) => {
    const response = await api.request(url, options);
    return url.includes('/list/') ? Response.json((await response.json()).reverse()) : response;
  };
  const result = await applyOperation(context, api.plan, reordered);
  assert.equal(result.ok, true);
});

test('restoring a completed operation is repeatable and cannot be silently resumed afterward', async () => {
  const api = await server();
  await applyOperation(context, api.plan, api.request);
  const completed = await readOperation(context, setPath, api.request);
  const first = await restoreOperation(context, completed, api.request);
  assert.equal(first.ok, true);
  assert.equal(first.operation.status, 'restored');
  api.plan.writes.forEach((write) => assert.equal(api.sources.get(write.path), write.original));
  api.writes = [];
  const again = await restoreOperation(context, first.operation, api.request);
  assert.equal(again.ok, true);
  assert.deepEqual(api.writes, []);
  await assert.rejects(resumeOperation(context, again.operation, api.request), /restored|review/i);
});

test('modified recovery snapshots fail integrity checks before content is written', async () => {
  const api = await server();
  await applyOperation(context, api.plan, api.request);
  const completed = await readOperation(context, setPath, api.request);
  completed.writes[0].target = 'a different target';
  api.writes = [];
  await assert.rejects(restoreOperation(context, completed, api.request), /integrity/i);
  assert.deepEqual(api.writes, []);
});
