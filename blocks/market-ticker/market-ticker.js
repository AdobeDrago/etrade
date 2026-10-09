import { loadMarket, MARKET_INDICES, normalizeQuotes } from '../../scripts/market-data.js';
import {
  element, numberText, changeNode, dataNotice, authoredRows,
} from '../../scripts/market-ui.js';

export default function decorate(block) {
  const rows = authoredRows(block);
  block.setAttribute('aria-label', rows.get('label')?.textContent.trim() || 'Market indices');
  const list = element('ul', 'market-ticker-list');
  const status = element('p', 'market-ticker-status', 'Loading market indices…');
  status.setAttribute('role', 'status');
  const refresh = element('button', 'market-ticker-refresh', 'Refresh');
  refresh.type = 'button';
  refresh.setAttribute('aria-label', 'Refresh market indices');
  block.replaceChildren(list, status, refresh);
  const update = async (fresh = false) => {
    refresh.disabled = true;
    list.replaceChildren();
    status.textContent = 'Loading market indices…';
    block.setAttribute('aria-busy', 'true');
    block.dataset.marketState = 'loading';
    try {
      const { payload, sample } = await loadMarket('quote', { symbol: 'DJIND,COMP.IDX,SPX,TNX', detailFlag: 'INTRADAY' }, { fresh });
      const quotes = normalizeQuotes(payload);
      MARKET_INDICES.forEach((index) => {
        const quote = quotes.find((q) => q.symbol === index.symbol);
        const item = element('li', 'market-ticker-item');
        item.append(element('span', 'market-ticker-label', index.label));
        item.append(element('span', 'market-ticker-price', quote ? numberText(quote.price) : '—'));
        if (quote) item.append(changeNode(quote, 'market-ticker'));
        else item.append(element('span', 'market-ticker-missing', 'Unavailable'));
        list.append(item);
      });
      if (!quotes.length) throw new Error('No quotes');
      const dates = quotes.map((q) => q.asOf).filter(Boolean);
      status.textContent = dataNotice(sample, dates.length ? Math.min(...dates) : null, 'market-ticker').textContent;
      block.dataset.marketState = sample ? 'sample' : 'loaded';
      delete block.dataset.marketError;
    } catch (error) {
      list.replaceChildren();
      status.textContent = 'Market indices are temporarily unavailable. Try Refresh.';
      block.dataset.marketState = 'unavailable';
      block.dataset.marketError = error.code || 'invalid-response';
    } finally {
      refresh.disabled = false;
      block.setAttribute('aria-busy', 'false');
    }
  };
  refresh.addEventListener('click', () => update(true));
  update();
}
