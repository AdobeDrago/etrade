/* eslint-env node */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parseHTML } from 'linkedom';

const preview = 'https://et-scui--etrade--adobedrago.aem.page/home';

/** Exercise the real page auto-loader, fragment decorator and disclosure linker. */
async function harness(markup, routes = new Map()) {
  const { document, window } = parseHTML(`<html data-block-review><head></head><body>
    <main><div>${markup}</div></main><footer></footer><aside><div class="disclosures">
    <ol class="disclosures-items"><li id="disclosure-offer" data-disclosure-id="offer" value="1">Terms</li></ol>
    </div></aside></body></html>`);
  window.location = new URL(preview);
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  Object.defineProperty(Object.getPrototypeOf(document.documentElement.classList), '0', {
    configurable: true,
    get() { return [...this][0]; },
  });
  const requests = [];
  const errors = [];
  const context = vm.createContext({
    document,
    window,
    URL,
    URLSearchParams,
    crypto: webcrypto,
    CustomEvent: window.CustomEvent,
    console: { error: (...args) => errors.push(args) },
    fetch: async (url) => {
      requests.push(url);
      const response = await routes.get(url);
      if (response instanceof Error) throw response;
      return new Response(response || '', { status: response === undefined ? 404 : 200 });
    },
  });
  const modules = new Map();
  const base = new URL('../', import.meta.url);
  async function moduleFor(path) {
    if (modules.has(path)) return modules.get(path);
    let source = await readFile(new URL(path.slice(1), base), 'utf8');
    if (path === '/scripts/scripts.js') source += '\nexport { loadFragmentLinks };';
    const module = new vm.SourceTextModule(source, {
      context,
      identifier: `${window.origin}${path}`,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}${path}`; },
      importModuleDynamically: async (specifier, parent) => {
        const child = await moduleFor(new URL(specifier, parent.identifier).pathname);
        await child.evaluate();
        return child;
      },
    });
    modules.set(path, module);
    await module.link((specifier, parent) => (
      moduleFor(new URL(specifier, parent.identifier).pathname)
    ));
    return module;
  }
  const scripts = await moduleFor('/scripts/scripts.js');
  await scripts.evaluate();
  const main = document.querySelector('main');
  return {
    document, main, requests, errors, load: () => scripts.namespace.loadFragmentLinks(main),
  };
}

test('Adobe picker anchors load on the current branch with rich text and disclosure references', async () => {
  const url = 'https://main--etrade--adobedrago.aem.page/fragments/campaign';
  const page = await harness(`<p><a href="${url}" class="fragment">${url}</a></p>`, new Map([
    ['/fragments/campaign.plain.html', '<div><h2>Campaign</h2><p>Sample <strong>copy</strong><sup>offer</sup>.</p><ul><li>Detail</li></ul></div>'],
  ]));
  await page.load();
  assert.deepEqual(page.requests, ['/fragments/campaign.plain.html']);
  assert.equal(page.main.querySelector('a.fragment'), null);
  assert.equal(page.main.querySelector('h2').textContent, 'Campaign');
  assert.equal(page.main.querySelector('strong').textContent, 'copy');
  assert.equal(page.main.querySelector('li').textContent, 'Detail');
  assert.equal(page.main.querySelector('sup a').getAttribute('href'), '#disclosure-offer');
  assert.equal(page.main.querySelector('sup a').textContent, '1');
  assert.equal(page.errors.length, 0);
});

test('legacy and disclosure fragment links normalize HTML suffixes and preserve surrounding content', async () => {
  const page = await harness(`<h2>Before</h2>
    <p><a href="/fragments/shared.html">Shared</a></p>
    <p><a href="/disclosures/fragments/notice.plain.html" class="fragment">Notice</a></p>
    <p id="after">After</p>`, new Map([
    ['/fragments/shared.plain.html', '<div><p>Shared copy</p></div>'],
    ['/disclosures/fragments/notice.plain.html', '<div><p>Notice copy</p></div>'],
  ]));
  await page.load();
  assert.deepEqual(page.requests.sort(), [
    '/disclosures/fragments/notice.plain.html', '/fragments/shared.plain.html',
  ]);
  assert.match(page.main.textContent, /Shared copy/);
  assert.match(page.main.textContent, /Notice copy/);
  assert.equal(page.main.querySelector('h2').textContent, 'Before');
  assert.equal(page.main.querySelector('#after').textContent, 'After');
});

test('inline, foreign and explicit block links stay authored without losing adjacent copy', async () => {
  const markup = `<p>Read <a href="/fragments/shared" class="fragment">shared copy</a> for details.</p>
    <p><a href="/fragments/shared">One</a> <a href="/fragments/other">Two</a></p>
    <p><img src="/image.png"><a href="/fragments/shared">Image link</a></p>
    <div class="fragment"><div><div><a href="/fragments/shared">Explicit block</a></div></div></div>
    <p><a href="https://example.com/fragments/shared" class="fragment">External</a></p>
    <p><a href="/search?q=/fragments/shared">Search</a></p>
    <p><a href="/fragments/">Folder</a></p>`;
  const page = await harness(markup);
  const before = page.main.innerHTML;
  await page.load();
  assert.deepEqual(page.requests, []);
  assert.equal(page.main.innerHTML, before);
});

test('a failed fragment keeps its authored link and does not stop other fragments loading', async () => {
  const page = await harness(`<p><a href="/fragments/missing" class="fragment">Missing</a></p>
    <p><a href="/fragments/shared" class="fragment">Shared</a></p>`, new Map([
    ['/fragments/shared.plain.html', '<div><p>Available copy</p></div>'],
  ]));
  await page.load();
  assert.equal(page.main.querySelector('a.fragment').getAttribute('href'), '/fragments/missing');
  assert.match(page.main.textContent, /Available copy/);
  assert.equal(page.errors.length, 1);
});

test('nested fragment links still resolve after their parent moves into the page', async () => {
  let release;
  const nested = new Promise((resolve) => { release = resolve; });
  const page = await harness('<p><a href="/fragments/parent" class="fragment">Parent</a></p>', new Map([
    ['/fragments/parent.plain.html', '<div><p>Parent copy</p><p><a href="/fragments/nested" class="fragment">Nested</a></p></div>'],
    ['/fragments/nested.plain.html', nested],
  ]));
  await page.load();
  assert.match(page.main.textContent, /Parent copy/);
  await setImmediate();
  assert.ok(page.requests.includes('/fragments/nested.plain.html'));
  release('<div><p>Nested copy<sup>offer</sup>.</p></div>');
  await setImmediate();
  assert.equal(page.main.querySelector('a.fragment'), null);
  assert.match(page.main.textContent, /Nested copy/);
  assert.equal(page.main.querySelector('sup a').getAttribute('href'), '#disclosure-offer');
});
