/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser, parseHTML } from 'linkedom';
import { composeLinkURL, linkSummary, readSelectedLink } from '../tools/plugins/link-options/model.js';
import mountLinkOptions from '../tools/plugins/link-options/controller.js';
import { decorateTrackingLinks } from '../scripts/tracking.js';

class BrowserParser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, type);
  }
}
globalThis.DOMParser = BrowserParser;

const settings = (extra = {}) => ({
  href: '/home', enabled: true, key: 'home-link', category: 'C0004', ...extra,
});
const settle = () => new Promise((resolve) => { setImmediate(resolve); });

test('reads a single selected link inside DA table wrappers without changing markup', () => {
  const html = '<table><tbody><tr><td><p><strong><a href="../home?tracking=real&amp;%40tracking=hero-home&amp;%40tracking-category=C0002%2CC0004#offer">Home</a></strong></p></td></tr></tbody></table>';
  assert.deepEqual(readSelectedLink(html), {
    href: '../home?tracking=real#offer',
    label: 'Home',
    target: '_self',
    enabled: true,
    key: 'hero-home',
    category: 'C0002,C0004',
    route: {
      enabled: false, paths: '', label: '', href: '',
    },
  });
  assert.ok(html.includes('<strong><a'));
  assert.throws(() => readSelectedLink('<p>Unlinked text</p>'), /Select one complete link/);
  assert.throws(() => readSelectedLink('<a href="/a">A</a><a href="/b">B</a>'), /Select one complete link/);
});

test('link inspector describes selected opening behavior and consent without changing the link', () => {
  const selected = readSelectedLink('<a href="/home" target="_blank">Explore &amp; learn</a>');
  const summary = linkSummary({
    ...selected, enabled: true, key: 'hero', category: 'C0002,C0004',
  });
  assert.equal(summary.label, 'Explore & learn');
  assert.equal(summary.destination, '/home');
  assert.equal(summary.opening, 'Opens in a new tab or window');
  assert.equal(summary.consent, 'Analytics (C0002) + Advertising (C0004)');
  assert.match(summary.tracking, /hero/);
  assert.equal(linkSummary(settings({ enabled: false })).tracking, 'Link click tracking is off');
  assert.match(linkSummary(settings()).opening, /Keep the opening behavior/);
});

test('reads image labels and explicit data attributes, and exposes invalid settings for correction', () => {
  const image = readSelectedLink('<a href="/home" data-tracking-key="logo" data-tracking-category="C0002"><img src="/logo.svg" alt="Home logo"></a>');
  assert.equal(image.label, 'Home logo');
  assert.equal(image.key, 'logo');
  assert.equal(image.category, 'C0002');
  const invalid = readSelectedLink('<a href="/home?@tracking=&amp;@tracking-category=ads">Home</a>');
  assert.equal(invalid.enabled, true);
  assert.equal(invalid.key, '');
  assert.equal(invalid.category, 'ads');
});

test('composed URLs preserve real query bytes, relative paths and fragments through runtime decoration', () => {
  const href = composeLinkURL(settings({
    href: '../home?tracking=campaign&sig=a%20b%2f#offer', key: 'hero open/account', category: 'C0002,C0004',
  }));
  assert.equal(href, '../home?tracking=campaign&sig=a%20b%2f&@tracking=hero%20open%2Faccount&@tracking-category=C0002%2CC0004#offer');
  const { document } = parseHTML('<html><body></body></html>');
  const link = document.createElement('a');
  link.setAttribute('href', href);
  decorateTrackingLinks(link, 'https://demo-controller--etrade--adobedrago.aem.page/home');
  assert.equal(link.getAttribute('href'), '../home?tracking=campaign&sig=a%20b%2f#offer');
  assert.equal(link.dataset.trackingKey, 'hero open/account');
  assert.equal(link.dataset.trackingCategory, 'C0002,C0004');
});

test('turning tracking off removes reserved parameters and retains ordinary tracking parameters', () => {
  assert.equal(composeLinkURL(settings({
    href: '/home?tracking=campaign&%40tracking=old&@tracking-category=C0002#offer', enabled: false,
  })), '/home?tracking=campaign#offer');
  assert.equal(composeLinkURL(settings({ href: '#offer?@tracking=fragment', enabled: false })), '#offer?@tracking=fragment');
  assert.equal(composeLinkURL(settings({ href: '?@tracking=old#offer', key: 'new' })), '?@tracking=new#offer');
  assert.equal(composeLinkURL(settings({ href: 'mailto:a@example.com?subject=a%20b' })), 'mailto:a@example.com?subject=a%20b&@tracking=home-link');
  assert.equal(composeLinkURL(settings({ href: 'tel:123' })), 'tel:123?@tracking=home-link');
});

test('replaces duplicate markers, normalizes category lists and omits the default category', () => {
  const href = composeLinkURL(settings({ href: '/home?@tracking=a&@tracking=b&@tracking-category=C0002' }));
  assert.equal(href, '/home?@tracking=home-link');
  assert.equal(composeLinkURL(settings({ category: ' C0002, C0002, C0004 ' })), '/home?@tracking=home-link&@tracking-category=C0002%2CC0004');
  assert.equal(composeLinkURL(settings({ category: 'C12345' })), '/home?@tracking=home-link&@tracking-category=C12345');
});

test('invalid URLs, keys and categories cannot produce a copyable tracking URL', () => {
  // eslint-disable-next-line no-script-url
  ['', 'javascript:alert(1)', 'data:text/html,test', '/ho\nme'].forEach((href) => {
    assert.throws(() => composeLinkURL(settings({ href })), (error) => error.field === 'url');
  });
  ['', 'x'.repeat(161), 'key\nname'].forEach((key) => {
    assert.throws(() => composeLinkURL(settings({ key })), (error) => error.field === 'tracking-key');
  });
  ['', 'ads', 'C0004x', 'C0002,'].forEach((category) => {
    assert.throws(() => composeLinkURL(settings({ category })), (error) => error.field === 'custom-category');
  });
  assert.equal(composeLinkURL(settings({ enabled: false, key: '', category: 'invalid' })), '/home');
});

async function ui(copy = async () => {}) {
  const html = await readFile(new URL('../tools/plugins/link-options/link-options.html', import.meta.url), 'utf8');
  const { document, window } = parseHTML(html);
  const byId = (id) => document.getElementById(id);
  // linkedom exposes select.value as a getter; browsers also provide this setter.
  Object.defineProperty(byId('category'), 'value', {
    get() { return this.querySelector('option[selected]')?.value || this.querySelector('option').value; },
    set(value) {
      this.querySelectorAll('option').forEach((option) => {
        if (option.value === value) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      });
    },
  });
  const controller = mountLinkOptions(document, { copy });
  const edit = (id, value, type = 'input') => {
    const input = byId(id);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    input.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  const submit = async () => {
    byId('link-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  };
  return {
    document, window, byId, controller, edit, submit,
  };
}

test('URL helper can work without DA, including pasted markers, toggling off and copying', async () => {
  const copies = [];
  const context = await ui(async (value) => { copies.push(value); });
  const { byId, edit, submit } = context;
  assert.equal(byId('tracking-fields').hidden, true);
  edit('url', '/home?tracking=campaign&@tracking=home&@tracking-category=C0002', 'change');
  assert.equal(byId('url').value, '/home?tracking=campaign');
  assert.equal(byId('tracking-key').value, 'home');
  assert.equal(byId('tracking-fields').hidden, false);
  assert.equal(byId('advanced').open, true);
  await submit();
  assert.equal(copies[0], '/home?tracking=campaign&@tracking=home&@tracking-category=C0002');
  assert.equal(byId('copy').textContent, 'Copied');
  edit('track-clicks', false, 'change');
  await submit();
  assert.equal(copies[1], '/home?tracking=campaign');
  assert.equal(byId('tracking-fields').hidden, true);
});

test('route options reload from authored URLs and preview wording and destination together', async () => {
  const { byId, controller, edit } = await ui();
  controller.fill(settings({ label: 'Explore accounts', target: '_self' }));
  edit('route-enabled', true, 'change');
  edit('route-label', 'Explore brokerage');
  edit('route-url', '/accounts/brokerage');
  edit('preview-path', '/what-we-offer/pricing-and-rates');
  assert.match(byId('route-preview').textContent, /Matching pages: “Explore brokerage” → \/accounts\/brokerage/);
  const authored = byId('output-url').value;
  const selected = readSelectedLink(`<a href="${authored.replaceAll('&', '&amp;')}">Explore accounts</a>`);
  controller.fill(selected);
  assert.equal(byId('route-enabled').checked, true);
  assert.equal(byId('route-label').value, 'Explore brokerage');
  assert.equal(byId('url').value, '/home');
  edit('preview-path', '/planning');
  assert.match(byId('route-preview').textContent, /Default: “Explore accounts” → \/home/);
  edit('route-enabled', false, 'change');
  assert.doesNotMatch(byId('output-url').value, /@link-/);
  assert.match(byId('output-url').value, /@tracking=home-link/);
});

test('clipboard failure offers manual copy; invalid settings never claim a successful copy', async () => {
  const {
    byId, controller, edit, submit,
  } = await ui(async () => { throw new Error('NotAllowedError'); });
  controller.fill(settings());
  await submit();
  assert.equal(byId('manual-copy').hidden, false);
  assert.equal(byId('output-url').value, '/home?@tracking=home-link');
  assert.equal(byId('copy').textContent, 'Copy URL');
  edit('tracking-key', '');
  await submit();
  assert.equal(byId('tracking-key').getAttribute('aria-invalid'), 'true');
  assert.ok(byId('status').textContent.includes('Enter a tracking key'));
});

test('edits made while clipboard permission is pending do not claim the current URL was copied', async () => {
  let finish;
  const copies = [];
  const context = await ui((value) => {
    copies.push(value);
    return new Promise((resolve) => { finish = resolve; });
  });
  context.controller.fill(settings());
  const copying = context.submit();
  context.edit('tracking-key', 'revised-link');
  finish();
  await copying;
  assert.deepEqual(copies, ['/home?@tracking=home-link']);
  assert.equal(context.byId('output-url').value, '/home?@tracking=revised-link');
  assert.equal(context.byId('copy').textContent, 'Copy URL');
  assert.match(context.byId('status').textContent, /changed|previous/i);
});

test('a rejected stale copy never selects an edited or invalid output for manual copying', async () => {
  let fail;
  const context = await ui(() => new Promise((resolve, reject) => { fail = reject; }));
  context.controller.fill(settings());
  const copying = context.submit();
  context.edit('tracking-key', '');
  fail(new Error('Clipboard denied'));
  await copying;
  assert.equal(context.byId('output-url').value, '');
  assert.equal(context.byId('manual-copy').hidden, true);
  assert.match(context.byId('status').textContent, /changed|current/i);
});

test('DA integration reads a selection and closes only; it never writes editor or source content', async () => {
  const {
    controller, byId, document, window, submit,
  } = await ui();
  let closed = false;
  await controller.connect({
    actions: {
      getSelection: async () => '<p><strong><a href="/home?@tracking=selected">Home</a></strong></p>',
      closeLibrary: () => { closed = true; },
      sendHTML: () => assert.fail('Must not modify the editor'),
      daFetch: () => assert.fail('Must not write source content'),
    },
  });
  assert.equal(byId('tracking-key').value, 'selected');
  assert.equal(byId('selection-label').textContent, 'Selected link: Home');
  await submit();
  assert.equal(closed, false);
  document.getElementById('close').dispatchEvent(new window.Event('click'));
  assert.equal(closed, true);
});

test('late SDK connections and delayed selection responses preserve manual edits', async () => {
  const context = await ui();
  context.edit('url', '/manually-entered');
  await context.controller.connect({ actions: { getSelection: () => assert.fail('Must retain dirty fields') } });
  assert.equal(context.byId('url').value, '/manually-entered');
  const copies = [];
  const delayed = await ui(async (value) => { copies.push(value); });
  let resolve;
  const loading = delayed.controller.connect({
    actions: {
      getSelection: () => new Promise((done) => { resolve = done; }),
    },
  });
  delayed.edit('url', '/keep-this');
  await delayed.submit();
  assert.deepEqual(copies, ['/keep-this']);
  resolve('<a href="/overwrite">Other</a>');
  await loading;
  assert.equal(delayed.byId('url').value, '/keep-this');
});

test('an earlier DA connection cannot replace fields after the selected page connection changes', async () => {
  const context = await ui();
  let finish;
  const first = context.controller.connect({
    actions: { getSelection: () => new Promise((resolve) => { finish = resolve; }) },
  });
  await context.controller.connect({ actions: { getSelection: async () => '<a href="/current-page">Current</a>' } });
  finish('<a href="/previous-page">Previous</a>');
  await first;
  assert.notEqual(context.byId('url').value, '/previous-page');
  context.byId('load-selection').click();
  await settle();
  assert.equal(context.byId('url').value, '/current-page');
});
