import { formatBankRate, loadBankRates, selectBankRate } from './bank-rates.js';
import parseRateSettings from './rate-settings.js';
import applyDemoBalance from './demo-balance.js';

function cellLines(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const elements = clone.children.length ? [...clone.children] : [clone];
  return elements.flatMap((element) => element.textContent.split('\n')).map((line) => line.trim()).filter(Boolean);
}

function pageOptions(doc) {
  return {
    source: doc.querySelector('meta[name="bank-rates-source"]')?.content.trim().toLowerCase() || 'direct',
    endpoint: doc.querySelector('meta[name="bank-rates-endpoint"]')?.content.trim() || undefined,
  };
}

/** Replace only explicit text markers; keep rich text, links and superscripts. */
function rateMarkers(row) {
  const doc = row.ownerDocument;
  const walker = doc.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const markers = [];
  nodes.forEach((node) => {
    if (node.parentElement.closest('code, pre, script, style')) return;
    const pattern = /\{\{rate(?::([a-z][a-z0-9-]{0,31}))?\}\}/gi;
    const matches = [...node.textContent.matchAll(pattern)];
    if (!matches.length) return;
    const content = doc.createDocumentFragment();
    let offset = 0;
    matches.forEach((match) => {
      content.append(node.textContent.slice(offset, match.index));
      const span = doc.createElement('span');
      span.dataset.rateName = (match[1] || 'rate').toLowerCase();
      span.textContent = '—';
      content.append(span);
      markers.push(span);
      offset = match.index + match[0].length;
    });
    content.append(node.textContent.slice(offset));
    node.replaceWith(content);
  });
  return markers;
}

function updateRate(markers, settings, result) {
  const {
    value, display, source, error, fetchedAt,
  } = result;
  markers.forEach((marker) => {
    marker.textContent = value === null ? display || '—' : formatBankRate(value);
    marker.dataset.rateSource = source;
    if (settings.balance !== undefined) {
      marker.dataset.rateBalance = settings.balance;
      marker.dataset.rateBalanceSource = settings.balanceSource || 'authored';
    }
    if (error) marker.dataset.rateError = error;
    else delete marker.dataset.rateError;
    if (fetchedAt) marker.dataset.rateFetchedAt = fetchedAt;
    else delete marker.dataset.rateFetchedAt;
    if (value === null) marker.setAttribute('aria-label', 'Rate currently unavailable');
    else marker.removeAttribute('aria-label');
    marker.dispatchEvent(new CustomEvent('bank-rates:updated', {
      bubbles: true,
      detail: {
        name: settings.name,
        product: settings.product,
        field: settings.field,
        balance: settings.balance,
        authoredBalance: settings.authoredBalance ?? settings.balance,
        balanceSource: settings.balance === undefined ? undefined : settings.balanceSource || 'authored',
        term: settings.term,
        ...result,
      },
    }));
  });
}

async function resolveRate(markers, settings, options) {
  const fallback = {
    value: settings.fallback,
    display: settings.fallbackText,
    source: settings.fallback === null && !settings.fallbackText ? 'unavailable' : 'fallback',
  };
  if (!settings.valid) {
    updateRate(markers, settings, { ...fallback, error: 'invalid-settings' });
    return;
  }
  if (settings.mode === 'manual' || (settings.mode === 'hybrid' && settings.override !== null)) {
    updateRate(markers, settings, { value: settings.override, source: settings.mode === 'manual' ? 'manual' : 'override' });
    return;
  }
  updateRate(markers, settings, { ...fallback, source: 'loading' });
  try {
    const rates = await loadBankRates(options);
    updateRate(markers, settings, { value: selectBankRate(rates, settings), source: 'api', fetchedAt: rates.fetchedAt });
  } catch (error) {
    updateRate(markers, settings, { ...fallback, error: error.code || 'network' });
  }
}

/** Consume settings before card decoration moves cells; markers survive that move. */
export default function decorateCardRates(block) {
  const pending = [];
  const options = pageOptions(block.ownerDocument);
  [...block.children].forEach((row) => {
    const settings = [];
    [...row.children].forEach((cell) => {
      const lines = cellLines(cell);
      if (lines[0]?.toLowerCase() !== 'rate settings') return;
      settings.push(parseRateSettings(lines.slice(1)));
      cell.remove();
    });
    const markers = rateMarkers(row);
    const names = [...new Set(markers.map((marker) => marker.dataset.rateName))];
    names.forEach((name) => {
      const matches = settings.filter((entry) => entry.name === name);
      const selected = matches.length === 1 ? matches[0] : { name, valid: false, fallback: null };
      const selectedMarkers = markers.filter((marker) => marker.dataset.rateName === name);
      const effective = applyDemoBalance(selected, block.ownerDocument.defaultView);
      pending.push(resolveRate(selectedMarkers, effective, options));
    });
  });
  return Promise.all(pending);
}
