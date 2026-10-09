import { loadMarket, normalizeTopFive, TOP_FIVE_GROUPS } from '../../scripts/market-data.js';
import {
  authoredRows, element, quoteLink, numberText, changeNode, timeText, lineChart, dataNotice,
} from '../../scripts/market-ui.js';

let sequence = 0;
const labels = ['Top Dividend Yielding Stocks', 'Most Searched Mutual Funds', 'Top Performing ETFs'];

export default function decorate(block) {
  const rows = authoredRows(block);
  sequence += 1;
  const controls = element('div', 'market-top-five-controls');
  const label = element('label', '', rows.get('heading')?.textContent.trim() || 'Top five');
  const select = element('select');
  select.id = `market-top-five-select-${sequence}`;
  label.htmlFor = select.id;
  TOP_FIVE_GROUPS.forEach((group, index) => {
    const option = element('option', '', rows.get(`${group.toLowerCase()} label`)?.textContent.trim() || labels[index]);
    option.value = group;
    select.append(option);
  });
  const defaultGroup = rows.get('default')?.textContent.trim();
  if (TOP_FIVE_GROUPS.includes(defaultGroup)) select.value = defaultGroup;
  const refresh = element('button', '', 'Refresh');
  refresh.type = 'button';
  refresh.setAttribute('aria-label', 'Refresh top five');
  controls.append(label, select, refresh);
  const status = element('p', 'market-top-five-status');
  status.setAttribute('role', 'status');
  const cards = element('ul', 'market-top-five-cards');
  const disclosures = element('details', 'market-top-five-disclosures');
  disclosures.append(element('summary', '', 'Disclaimer'));
  const copy = element('div');
  disclosures.append(copy);
  block.replaceChildren(controls, status, cards, disclosures);
  let version = 0;
  const update = async (fresh = false) => {
    version += 1;
    const current = version;
    const group = select.value;
    cards.replaceChildren();
    copy.replaceChildren();
    const legal = rows.get(`${group.toLowerCase()} disclaimer`);
    if (legal) copy.append(legal.cloneNode(true));
    disclosures.hidden = !legal?.textContent.trim();
    block.dataset.disclaimerState = disclosures.hidden ? 'missing' : 'authored';
    status.textContent = 'Loading top five…';
    block.setAttribute('aria-busy', 'true');
    block.dataset.marketState = 'loading';
    refresh.disabled = true;
    try {
      const { payload, sample } = await loadMarket(`top5/${group}`, undefined, { fresh });
      const quotes = normalizeTopFive(payload, group);
      if (current !== version) return;
      quotes.forEach((quote) => {
        const card = element('li', 'market-top-five-card');
        const top = element('div', 'market-top-five-card-heading');
        top.append(quoteLink(quote.symbol, 'market-top-five'), element('span', 'market-top-five-price', numberText(quote.price, false, 3)));
        card.append(top);
        if (quote.name) card.append(element('p', 'market-top-five-name', quote.name));
        card.append(changeNode(quote, 'market-top-five'));
        card.append(element('p', 'market-top-five-asof', `As of ${timeText(quote.asOf)}`));
        let color = '#777';
        if (quote.change < 0) color = '#bf315d';
        else if (quote.change > 0) color = '#218557';
        card.append(lineChart(quote.points, {
          prefix: 'market-top-five',
          label: quote.symbol,
          compact: true,
          color,
        }));
        cards.append(card);
      });
      const dates = quotes.map((q) => q.asOf).filter(Boolean);
      status.textContent = dataNotice(sample, dates.length ? Math.min(...dates) : null, 'market-top-five').textContent;
      block.dataset.marketState = sample ? 'sample' : 'loaded';
      delete block.dataset.marketError;
    } catch (error) {
      if (current !== version) return;
      status.textContent = 'Top five data are temporarily unavailable. Choose another list or try Refresh.';
      block.dataset.marketState = 'unavailable';
      block.dataset.marketError = error.code || 'invalid-response';
    } finally {
      if (current === version) {
        refresh.disabled = false;
        block.setAttribute('aria-busy', 'false');
      }
    }
  };
  select.addEventListener('change', () => update());
  refresh.addEventListener('click', () => update(true));
  update();
}
