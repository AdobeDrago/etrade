import {
  loadMarket, MARKET_INDICES, normalizeChart, normalizeQuotes, quoteURL,
} from '../../scripts/market-data.js';
import {
  authoredRows, element, lineChart, dataNotice, quoteLink, changeNode,
} from '../../scripts/market-ui.js';

let sequence = 0;
const STORAGE_KEY = 'etrade-recent-symbols';

export default function decorate(block) {
  const rows = authoredRows(block);
  sequence += 1;
  const id = `market-overview-${sequence}`;
  const chart = element('div', 'market-overview-chart');
  chart.append(element('h2', 'market-overview-heading', rows.get('heading')?.textContent.trim() || 'Market overview'));
  const tabs = element('div', 'market-overview-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Market index');
  const panel = element('div', 'market-overview-panel');
  panel.id = `${id}-panel`;
  panel.setAttribute('role', 'tabpanel');
  const plot = element('div');
  const status = element('p', 'market-overview-status');
  status.setAttribute('role', 'status');
  const refresh = element('button', 'market-overview-refresh', 'Refresh');
  refresh.type = 'button';
  refresh.setAttribute('aria-label', 'Refresh market chart');
  panel.append(status, plot, refresh);
  let version = 0;
  let active = 0;
  const updateChart = async (index = active, fresh = false) => {
    active = index;
    version += 1;
    const current = version;
    const selected = MARKET_INDICES[index];
    [...tabs.children].forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `${id}-tab-${index}`);
    plot.replaceChildren();
    status.textContent = `Loading ${selected.label} chart…`;
    panel.setAttribute('aria-busy', 'true');
    block.dataset.marketState = 'loading';
    refresh.disabled = true;
    try {
      const { payload, sample } = await loadMarket('chart', { indexes: selected.chart }, { fresh });
      const points = normalizeChart(payload, selected.chart);
      if (current !== version) return;
      plot.append(lineChart(points, { prefix: 'market-overview', color: selected.color, label: selected.label }));
      status.textContent = dataNotice(sample, points[points.length - 1].time, 'market-overview').textContent;
      block.dataset.marketState = sample ? 'sample' : 'loaded';
      delete block.dataset.marketError;
    } catch (error) {
      if (current !== version) return;
      status.textContent = `${selected.label} chart is temporarily unavailable. Choose another index or try Refresh.`;
      block.dataset.marketState = 'unavailable';
      block.dataset.marketError = error.code || 'invalid-response';
    } finally {
      if (current === version) {
        panel.setAttribute('aria-busy', 'false');
        refresh.disabled = false;
      }
    }
  };
  MARKET_INDICES.forEach((index, i) => {
    const tab = element('button', 'market-overview-tab', index.label === '10 YR. T-NOTE' ? '10 YR' : index.label);
    tab.type = 'button';
    tab.id = `${id}-tab-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', String(i === 0));
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener('click', () => updateChart(i));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % MARKET_INDICES.length;
      if (event.key === 'ArrowLeft') next = (i + MARKET_INDICES.length - 1) % MARKET_INDICES.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = MARKET_INDICES.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        tabs.children[next].focus();
        updateChart(next);
      }
    });
    tabs.append(tab);
  });
  refresh.addEventListener('click', () => updateChart(active, true));
  chart.append(tabs, panel);

  const search = element('div', 'market-overview-search');
  const form = element('form', 'market-overview-form');
  form.action = 'https://us.etrade.com/e/t/invest/quotesandresearch';
  const label = element('label', '', rows.get('search label')?.textContent.trim() || 'Get quotes');
  const input = element('input');
  input.id = `${id}-search`;
  input.name = 'sym';
  input.type = 'search';
  input.autocomplete = 'off';
  input.maxLength = 80;
  input.required = true;
  input.placeholder = 'Symbol or company name';
  label.htmlFor = input.id;
  const submit = element('button', '', 'Get quote');
  submit.type = 'submit';
  form.append(label, input, submit);
  const searchStatus = element('p', 'market-overview-search-status');
  searchStatus.id = `${id}-search-status`;
  searchStatus.setAttribute('role', 'status');
  input.setAttribute('aria-describedby', searchStatus.id);
  const results = element('ul', 'market-overview-results');
  results.setAttribute('aria-label', 'Matching symbols');
  const recentHeading = element('h3', '', 'Recently searched symbols');
  const recent = element('ul', 'market-overview-recent');
  let symbols = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) symbols = saved.filter((s) => typeof s === 'string' && /^[A-Z0-9.^-]{1,24}$/.test(s)).slice(0, 5);
  } catch { /* Quote search still works when browser storage is unavailable. */ }
  const remember = (symbol) => {
    symbols = [symbol, ...symbols.filter((s) => s !== symbol)].slice(0, 5);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(symbols)); } catch { /* Optional. */ }
  };
  const navigate = (symbol) => {
    remember(symbol);
    window.location.assign(quoteURL(symbol));
  };
  let searchVersion = 0;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    searchVersion += 1;
    const current = searchVersion;
    const query = input.value.trim();
    results.replaceChildren();
    searchStatus.textContent = '';
    if (query.length < 2) return;
    debounce = setTimeout(async () => {
      searchStatus.textContent = 'Looking up symbols…';
      try {
        const { payload } = await loadMarket('lookup', { searchString: query });
        if (current !== searchVersion) return;
        if (!Array.isArray(payload?.data)) throw new Error('Invalid lookup');
        const matches = payload.data.filter((entry) => typeof entry?.symbol === 'string' && /^[A-Z0-9.^-]{1,24}$/.test(entry.symbol)).slice(0, 8);
        matches.forEach((match) => {
          const item = element('li');
          const button = element('button', '', `${match.symbol} — ${match.description || match.symbol}`);
          button.type = 'button';
          button.addEventListener('click', () => navigate(match.symbol));
          item.append(button);
          results.append(item);
        });
        searchStatus.textContent = matches.length ? `${matches.length} matching symbols. Select a result or enter a symbol.` : 'No matching symbols. Enter a symbol to get its quote.';
      } catch (error) {
        if (current === searchVersion) searchStatus.textContent = 'Symbol suggestions are unavailable. Enter a symbol to get its quote.';
      }
    }, 300);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearTimeout(debounce);
      searchVersion += 1;
      results.replaceChildren();
      searchStatus.textContent = '';
    }
    if (event.key === 'ArrowDown' && results.firstElementChild) {
      event.preventDefault();
      results.querySelector('button').focus();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const symbol = input.value.trim().toUpperCase();
    if (/^[A-Z0-9.^-]{1,24}$/.test(symbol)) navigate(symbol);
    else searchStatus.textContent = 'Select a matching company below, or enter a stock symbol.';
  });
  const updateRecent = async () => {
    if (!symbols.length) {
      recent.append(element('li', '', 'No recent quotes'));
      return;
    }
    symbols.forEach((symbol) => {
      const item = element('li');
      const link = quoteLink(symbol, 'market-overview');
      link.addEventListener('click', () => remember(symbol));
      item.append(link);
      recent.append(item);
    });
    try {
      const { payload, sample } = await loadMarket('quote', { symbol: symbols.join(','), detailFlag: 'INTRADAY' });
      const quotes = normalizeQuotes(payload);
      [...recent.children].forEach((item, i) => {
        const quote = quotes.find((q) => q.symbol === symbols[i]);
        if (quote) item.append(changeNode(quote, 'market-overview'));
      });
      search.append(element('p', 'market-overview-notice', sample ? 'Sample recent quotes for review only' : 'Recent quote data delayed by 15 minutes'));
    } catch { /* Keep usable symbol links when quote prices are unavailable. */ }
  };
  search.append(form, searchStatus, results, recentHeading, recent);
  block.replaceChildren(chart, search);
  updateChart();
  updateRecent();
}
