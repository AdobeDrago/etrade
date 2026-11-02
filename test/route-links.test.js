/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import decorateRouteLinks, {
  authorRouteHref, cleanRouteHref, resolveRouteLink, routePaths, routeSettings,
} from '../scripts/route-links.js';
import { decorateTrackingLinks } from '../scripts/tracking.js';

const rule = {
  enabled: true, paths: '/brokerage, /what-we-offer', label: 'Explore brokerage', href: '/accounts/brokerage?campaign=fall#start',
};
const base = 'https://demo--etrade--adobedrago.aem.page';

test('route authoring round trips and keeps ordinary query bytes, tracking and fragments intact', () => {
  const fallback = '../accounts?sig=a%20b%2f&@tracking=hero&@tracking-category=C0002#default';
  const href = authorRouteHref(fallback, rule);
  assert.equal(cleanRouteHref(href), fallback);
  assert.deepEqual(routeSettings(href), { ...rule, paths: '/brokerage,/what-we-offer' });
  assert.equal(authorRouteHref(href, { enabled: false }), fallback);
  assert.equal(cleanRouteHref('#anchor?@link-label=anchor-text'), '#anchor?@link-label=anchor-text');
  const matching = resolveRouteLink(href, `${base}/what-we-offer/pricing-and-rates?campaign=other`);
  assert.equal(matching.label, rule.label);
  assert.equal(matching.href, '/accounts/brokerage?campaign=fall&@tracking=hero&@tracking-category=C0002#start');
  assert.equal(resolveRouteLink(href, `${base}/planning`).href, fallback);
});

test('matching respects segment boundaries, .html pages, trailing slashes and the displaying page', () => {
  const href = authorRouteHref('/default', rule);
  ['/brokerage', '/brokerage/', '/brokerage.html', '/brokerage/accounts', '/what-we-offer/pricing.html']
    .forEach((path) => assert.equal(resolveRouteLink(href, `${base}${path}`).matched, true, path));
  ['/brokerage-other', '/brokerages', '/planning/brokerage', '/Brokerage']
    .forEach((path) => assert.equal(resolveRouteLink(href, `${base}${path}`).matched, false, path));
  assert.deepEqual(routePaths('/brokerage/, /brokerage.html'), ['/brokerage']);
});

test('invalid rules never execute markup or route away from the authored default', () => {
  ['', '/brokerage,', '//outside.example', '/a?x=1', '/a#hash', '/a/../b', '/%2f', '/a\\b']
    .forEach((paths) => assert.throws(() => authorRouteHref('/default', { ...rule, paths })));
  // eslint-disable-next-line no-script-url
  ['javascript:alert(1)', 'data:text/html,test', '/path\nother', ''].forEach((href) => {
    assert.throws(() => authorRouteHref('/default', { ...rule, href }));
  });
  assert.equal(resolveRouteLink('/default?@link-paths=%2Fbrokerage&@link-label=Hi&@link-url=javascript%3Aalert(1)', `${base}/brokerage`).href, '/default');
  assert.equal(resolveRouteLink('/default?@link-label=Incomplete', `${base}/brokerage`).matched, false);
});

test('runtime changes text links before tracking, preserves formatting and is idempotent', () => {
  const { document } = parseHTML('<html><body><main><p><a href="/default" target="_blank" aria-label="Default" title="Default"><strong>Default</strong></a></p></main></body></html>');
  const link = document.querySelector('a');
  link.setAttribute('href', authorRouteHref('/default?@tracking=hero', rule));
  decorateTrackingLinks(document.querySelector('main'), `${base}/brokerage/accounts`);
  assert.equal(link.getAttribute('href'), rule.href);
  assert.equal(link.textContent, rule.label);
  assert.equal(link.querySelector('strong').textContent, rule.label);
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('aria-label'), rule.label);
  assert.equal(link.getAttribute('title'), rule.label);
  assert.equal(link.dataset.trackingKey, 'hero');
  const decorated = link.outerHTML;
  decorateTrackingLinks(link, `${base}/brokerage/accounts`);
  assert.equal(link.outerHTML, decorated);
  link.setAttribute('href', authorRouteHref('/default', { ...rule, label: '<img src=x onerror=alert(1)>' }));
  decorateRouteLinks(link, `${base}/brokerage`);
  assert.equal(link.querySelector('img'), null);
  assert.equal(link.textContent, '<img src=x onerror=alert(1)>');
});

test('image and icon links keep their default content and destination', () => {
  const { document } = parseHTML('<html><body><a href="/default"><img src="/logo.svg" alt="Company"></a><a href="/default"><span class="icon icon-home"></span>Home</a></body></html>');
  document.querySelectorAll('a').forEach((link) => { link.setAttribute('href', authorRouteHref('/default', rule)); });
  decorateRouteLinks(document.body, `${base}/brokerage`);
  assert.equal(document.querySelector('img').alt, 'Company');
  document.querySelectorAll('a').forEach((link) => assert.equal(link.getAttribute('href'), '/default'));
});
