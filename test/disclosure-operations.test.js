/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { readSiteInventory } from '../tools/plugins/disclosure-manager/inventory.js';
import {
  applyOperation, readOperation, restoreOperation, resumeOperation,
} from '../tools/plugins/disclosure-manager/operations.js';

globalThis.DOMParser = class {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) { return new DOMParser().parseFromString(`<html>${html}</html>`, type); }
};

const context = { org: 'adobedrago', repo: 'etrade', path: '/home' };
const setPath = '/disclosures/sets/homepage.json';

async function server() {
  const state = {
    sources: new Map([['/home', 'old home'], ['/copy/shared', 'old copy'], [setPath, 'old set'], ['/observer', 'unchanged consumer']]),
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
    guards: [...state.sources].map(([path, original]) => ({ path, original })),
    writes: [...state.sources].filter(([path]) => path !== '/observer').map(([path, original]) => ({
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

test('an unchanged consumer whose dependencies change after review invalidates the batch', async () => {
  const api = await server();
  api.sources.set('/observer', 'now embeds the shared citation under another set');
  await assert.rejects(applyOperation(context, api.plan, api.request), /changed|consumer/i);
  assert.deepEqual(api.writes, []);
});

test('a saved reorder explicitly updates the open page after its source write completes', async () => {
  const { parseHTML } = await import('linkedom');
  const { listenDisclosureSaves } = await import('../scripts/disclosure-sync.js');
  const { prepareAuthorSync, notifyAuthorSync } = await import('../tools/plugins/disclosure-manager/author-sync.js');
  const api = await server();
  const before = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] };
  const after = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] };
  api.sources.set('/home', '<body><main><p>Offer<sup>1</sup></p></main></body>');
  api.sources.set(setPath, JSON.stringify(before));
  api.plan.guards = [...api.sources].map(([path, original]) => ({ path, original }));
  api.plan.writes.forEach((write) => {
    write.original = api.sources.get(write.path);
    if (write.path === '/home') write.target = '<body><main><p>Offer<sup>2</sup></p></main></body>';
    if (write.kind === 'set') write.target = JSON.stringify(after);
  });
  const { document } = parseHTML('<html><body class="quick-edit"><main><p>Offer<sup>1</sup></p></main><div class="disclosures"><ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/two">Two</li></ol></div></body></html>');
  const win = { BroadcastChannel, location: new URL('https://qa--etrade--adobedrago.preview.da.live/home') };
  let resolveRefresh;
  const refreshed = new Promise((resolve) => { resolveRefresh = resolve; });
  const dispose = listenDisclosureSaves(document, win, () => resolveRefresh());
  let preparedSource;
  const timeout = setTimeout(() => resolveRefresh(), 1000);
  try {
    const result = await applyOperation(context, api.plan, api.request, {
      onPrepared: async (operation) => {
        preparedSource = api.sources.get('/home');
        assert.equal(document.querySelector('main sup').textContent, '1');
        await prepareAuthorSync(context, operation, win);
      },
    });
    assert.equal(result.ok, true);
    assert.match(api.sources.get('/home'), /<sup>2<\/sup>/);
    notifyAuthorSync(context, result.operation, win);
    await refreshed;
    assert.equal(document.querySelector('main sup').textContent, '2');
    assert.match(preparedSource, /<sup>1<\/sup>/);
    notifyAuthorSync(context, result.operation, win);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    assert.equal(document.querySelector('main sup').textContent, '2');
  } finally { clearTimeout(timeout); dispose(); }
});

test('restore captures the author view before writing the original sources back', async () => {
  const api = await server();
  const saved = await applyOperation(context, api.plan, api.request);
  let captured;
  const restored = await restoreOperation(context, saved.operation, api.request, {
    onPrepared: async (operation) => {
      captured = { source: api.sources.get('/home'), direction: operation.direction };
    },
  });
  assert.equal(restored.ok, true);
  assert.deepEqual(captured, { source: 'new home', direction: 'restore' });
  assert.equal(api.sources.get('/home'), 'old home');
});

async function resumeAuthorFixture(state, block = false) {
  const { parseHTML } = await import('linkedom');
  const api = await server();
  const before = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] };
  const after = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] };
  const original = `<body><main><div${block ? ' class="hero-product"' : ''}><p>Offer<sup>1</sup></p><p>Rate<sup>2</sup></p></div></main></body>`;
  const target = `<body><main><div${block ? ' class="hero-product"' : ''}><p>Offer<sup>2</sup></p><p>Rate<sup>1</sup></p></div></main></body>`;
  api.sources.set('/home', original); api.sources.set(setPath, JSON.stringify(before));
  api.plan.guards = [...api.sources].map(([path, value]) => ({ path, original: value }));
  api.plan.writes.forEach((write) => {
    write.original = api.sources.get(write.path);
    if (write.path === '/home') write.target = target;
    if (write.kind === 'set') write.target = JSON.stringify(after);
  });
  const saved = await applyOperation(context, api.plan, api.request);
  const operation = { ...saved.operation, status: 'prepared' };
  const record = [...api.sources.keys()].find((path) => path.startsWith('/.da/') && path.endsWith('.json'));
  api.sources.set(record, JSON.stringify(operation));
  if (state !== 'target') operation.writes.forEach((write) => api.sources.set(write.path, write.original));
  let numbers = state === 'target' ? ['2', '1'] : ['1', '2'];
  if (state === 'mixed') numbers = ['1', '1'];
  if (block) numbers.reverse();
  const html = `<html><body class="quick-edit"><main><p>Offer<sup class="disclosures-reference" data-disclosure-ids="${numbers[0]}"><a href="#disclosure-homepage-${numbers[0]}" aria-label="Disclosure ${numbers[0]}">${numbers[0]}</a></sup></p><p>Rate<sup class="disclosures-reference" data-disclosure-ids="${numbers[1]}"><a href="#disclosure-homepage-${numbers[1]}" aria-label="Disclosure ${numbers[1]}">${numbers[1]}</a></sup></p></main><div class="disclosures"><ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/two">Two</li></ol></div></body></html>`;
  const { document } = parseHTML(html);
  return { api, operation, document };
}

['original', 'target', 'mixed', 'block'].forEach((state) => {
  test(`resumed save keeps ${state} open references coherent with the saved footer`, async () => {
    const { listenDisclosureSaves } = await import('../scripts/disclosure-sync.js');
    const { prepareAuthorSync, notifyAuthorSync } = await import('../tools/plugins/disclosure-manager/author-sync.js');
    const { default: decorateReferences } = await import('../scripts/disclosure-references.js');
    const { api, operation, document } = await resumeAuthorFixture(state === 'block' ? 'original' : state, state === 'block');
    const previous = globalThis.document; globalThis.document = document;
    const win = { BroadcastChannel, location: new URL('https://qa--etrade--adobedrago.preview.da.live/home') };
    let wake;
    const waiting = new Promise((resolve) => { wake = resolve; });
    const timeout = setTimeout(() => wake(), 1000);
    const dispose = listenDisclosureSaves(document, win, () => {
      document.querySelector('.disclosures-items').innerHTML = '<li id="disclosure-homepage-1">Two</li><li id="disclosure-homepage-2">One</li>';
      decorateReferences(document.querySelector('main'), document.querySelector('.disclosures'));
      wake();
    });
    let direction;
    try {
      const result = await resumeOperation(context, operation, api.request, {
        onPrepared: async (value) => {
          direction = value.direction;
          await prepareAuthorSync(context, value, win);
        },
      });
      assert.equal(result.ok, true);
      assert.equal(direction, 'resume');
      notifyAuthorSync(context, result.operation, win);
      await waiting;
      if (state === 'mixed' || state === 'block') {
        assert.equal(document.querySelectorAll('main sup a').length, 0);
        assert.ok(document.querySelector('.disclosure-sync-notice'));
      } else {
        assert.deepEqual([...document.querySelectorAll('main sup')].map((sup) => sup.textContent), ['2', '1']);
        assert.equal(document.querySelector('main sup a').getAttribute('href'), '#disclosure-homepage-2');
        assert.equal(document.getElementById('disclosure-homepage-2').textContent, 'One');
      }
    } finally { clearTimeout(timeout); dispose(); globalThis.document = previous; }
  });
});

test('a fresh save remaps block-rendered order instead of mistaking it for target source order', async () => {
  const { listenDisclosureSaves } = await import('../scripts/disclosure-sync.js');
  const { prepareAuthorSync, notifyAuthorSync } = await import('../tools/plugins/disclosure-manager/author-sync.js');
  const { api, document } = await resumeAuthorFixture('original', true);
  [...api.sources.keys()].filter((path) => path.startsWith('/.da/')).forEach((path) => api.sources.delete(path));
  const win = { BroadcastChannel, location: new URL('https://qa--etrade--adobedrago.preview.da.live/home') };
  let wake;
  const waiting = new Promise((resolve) => { wake = resolve; });
  const timeout = setTimeout(() => wake(), 1000);
  const dispose = listenDisclosureSaves(document, win, () => wake());
  try {
    const result = await applyOperation(context, api.plan, api.request, {
      onPrepared: (value) => prepareAuthorSync(context, value, win),
    });
    notifyAuthorSync(context, result.operation, win);
    await waiting;
    assert.deepEqual([...document.querySelectorAll('main sup')].map((sup) => sup.textContent), ['1', '2']);
    assert.equal(document.querySelector('.disclosure-sync-notice'), null);
  } finally { clearTimeout(timeout); dispose(); }
});
