/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const tourUrl = new URL('../tools/plugins/workspace-tour/workspace-tour.html', import.meta.url);
const scriptUrl = new URL('workspace-tour.js', tourUrl);
const guideUrl = new URL('../docs/site-handoff.html', import.meta.url);

async function openTour(storage = new Map()) {
  const html = await readFile(tourUrl, 'utf8');
  const source = await readFile(scriptUrl, 'utf8');
  const { document, window } = parseHTML(html);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  vm.runInNewContext(source, { document, window: { localStorage } });

  const find = (id) => document.getElementById(id);
  return {
    click: (id) => find(id).click(),
    escape: () => {
      const event = new window.Event('keydown', { cancelable: true });
      event.key = 'Escape';
      document.dispatchEvent(event);
    },
    find,
    visibleSteps: () => [...document.querySelectorAll('[data-tour-step]:not([hidden])')],
  };
}

test('chapters keep independent progress when navigating and reopening the panel', async () => {
  const storage = new Map();
  const tour = await openTour(storage);
  assert.equal(tour.visibleSteps().length, 0);
  tour.click('tour-start-authoring');
  assert.equal(tour.visibleSteps()[0].id, 'tour-workspace');
  assert.equal(tour.find('tour-back').disabled, true);
  tour.click('tour-next');
  assert.equal(tour.visibleSteps()[0].id, 'tour-draft');
  tour.click('tour-back');
  assert.equal(tour.visibleSteps()[0].id, 'tour-workspace');
  tour.click('tour-next');
  tour.escape();
  assert.equal(tour.visibleSteps().length, 0);
  tour.click('tour-start-site');
  assert.equal(tour.visibleSteps()[0].id, 'tour-page-patterns');
  tour.click('tour-next');
  tour.click('tour-exit');

  const reopened = await openTour(storage);
  assert.equal(reopened.find('tour-start-site').textContent, 'Continue at step 2');
  assert.equal(reopened.find('tour-start-authoring').textContent, 'Continue at step 2');
  reopened.click('tour-start-authoring');
  assert.equal(reopened.visibleSteps().length, 1);
  assert.equal(reopened.visibleSteps()[0].id, 'tour-draft');
  reopened.click('tour-exit');
  reopened.click('tour-restart-authoring');
  assert.equal(reopened.visibleSteps()[0].id, 'tour-workspace');
});

test('completion persists per chapter and a finished chapter can be replayed', async () => {
  const storage = new Map();
  const tour = await openTour(storage);
  tour.click('tour-start-authoring');
  const total = Number(tour.find('tour-progress').getAttribute('max'));
  assert.equal(total, 8);
  for (let step = 1; step <= total; step += 1) {
    assert.equal(tour.find('tour-count').textContent, `Step ${step} of ${total}`);
    tour.click('tour-next');
  }
  assert.equal(tour.visibleSteps().length, 0);

  const reopened = await openTour(storage);
  assert.equal(reopened.find('tour-start-authoring').textContent, 'Retake completed chapter');
  assert.equal(reopened.find('tour-start-site').textContent, 'Start chapter');
  reopened.click('tour-start-authoring');
  assert.equal(reopened.visibleSteps()[0].id, 'tour-workspace');
});

test('saved progress from the original tour is kept for the authoring chapter', async () => {
  const storage = new Map([['etrade-workspace-tour-v1', 'tour-preview']]);
  const tour = await openTour(storage);
  assert.equal(tour.find('tour-start-authoring').textContent, 'Continue at step 7');
  assert.equal(tour.find('tour-start-tools').textContent, 'Start chapter');
  tour.click('tour-start-authoring');
  assert.equal(tour.visibleSteps()[0].id, 'tour-preview');
});

test('the tour works when an embedded browser blocks storage', async () => {
  const storage = {
    get() { throw new Error('Storage blocked'); },
    set() { throw new Error('Storage blocked'); },
  };
  const tour = await openTour(storage);
  tour.click('tour-start-authoring');
  tour.click('tour-next');
  tour.click('tour-exit');
  tour.click('tour-start-authoring');
  assert.equal(tour.visibleSteps()[0].id, 'tour-draft');
});

test('every chapter has readable steps with examples and valid handoff references', async () => {
  const tour = parseHTML(await readFile(tourUrl, 'utf8')).document;
  const guide = parseHTML(await readFile(guideUrl, 'utf8')).document;
  const steps = [...tour.querySelectorAll('[data-tour-step]')];
  assert.deepEqual(
    [...new Set(steps.map((step) => step.dataset.tourStep))],
    ['site', 'data', 'tools', 'authoring'],
  );
  steps.forEach((step) => {
    assert.equal(step.hidden, false);
    assert.ok(step.querySelector('.tour-worked-example'), `${step.id} needs an example`);
    const references = [...step.querySelectorAll('a[href*="site-handoff.html#"]')];
    assert.ok(references.length, `${step.id} needs a handoff reference`);
    references.forEach((reference) => {
      const link = new URL(reference.getAttribute('href'), tourUrl);
      assert.ok(guide.getElementById(link.hash.slice(1)), link.hash);
      link.hash = '';
      assert.equal(link.href, guideUrl.href);
    });
  });
});
