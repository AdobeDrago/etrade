/* eslint-env es2021 */
const LIVE_BASE = 'https://us.etrade.com/phx/pros/apicontent/market/';
const requests = new Map();
export const MARKET_INDICES = [
  {
    symbol: 'DJIND', chart: 'DJIND', label: 'DOW', color: '#0065e3',
  },
  {
    symbol: 'COMP.IDX', chart: 'COMPIDX', label: 'NASDAQ', color: '#007f85',
  },
  {
    symbol: 'SPX', chart: 'SPX', label: 'S&P', color: '#857700',
  },
  {
    symbol: 'TNX', chart: 'TNX', label: '10 YR. T-NOTE', color: '#aa6000',
  },
];
export const TOP_FIVE_GROUPS = ['TopDivYieldStocks', 'MostSearchedMFs', 'TopETFs'];

export class MarketDataError extends Error {
  constructor(code) {
    super(`Market data unavailable: ${code}`);
    this.name = 'MarketDataError';
    this.code = code;
  }
}

export function marketNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function marketDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = marketNumber(value);
  const time = numeric === null ? Date.parse(value) : numeric;
  return Number.isFinite(time) && time > 0 ? time : null;
}

export function marketSettings(doc = document) {
  const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content.trim();
  return { base: meta('market-data-base') || LIVE_BASE, sample: meta('market-data-sample') || '' };
}

/** Allow the observed public service or an explicitly configured same-origin proxy. */
export function marketRequest(path, body, settings, baseURL = globalThis.location?.href) {
  const base = new URL(baseURL);
  const service = new URL(settings.base || LIVE_BASE, base);
  if ((service.href !== LIVE_BASE && service.origin !== base.origin)
    || !['https:', 'http:'].includes(service.protocol) || service.username || service.password
    || service.search || service.hash || !service.pathname.endsWith('/')) {
    throw new MarketDataError('invalid-endpoint');
  }
  if (!/^(quote|chart|lookup|top5\/(TopDivYieldStocks|MostSearchedMFs|TopETFs))$/.test(path)) {
    throw new MarketDataError('invalid-operation');
  }
  const init = { method: body ? 'POST' : 'GET', credentials: 'omit', mode: 'cors' };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return { url: new URL(path, service).href, init };
}

/** Share in-flight requests and successful responses for one minute. Failures can be retried. */
export async function marketJSON(url, init = {}, fresh = false) {
  const key = `${init.method || 'GET'} ${url} ${init.body || ''}`;
  const cached = requests.get(key);
  if (cached && (!cached.done || (!fresh && Date.now() - cached.time < 60000))) {
    return cached.promise;
  }
  const entry = { done: false, time: Date.now() };
  entry.promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new MarketDataError(`http-${response.status}`);
      const result = await response.json();
      entry.done = true;
      entry.time = Date.now();
      return result;
    } catch (error) {
      requests.delete(key);
      if (controller.signal.aborted) throw new MarketDataError('timeout');
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError('network-or-response');
    } finally {
      clearTimeout(timeout);
    }
  })();
  requests.set(key, entry);
  return entry.promise;
}

export async function loadMarket(path, body, { fresh = false, settings = marketSettings() } = {}) {
  if (settings.sample) {
    const origin = new URL(globalThis.location.href);
    const sample = new URL(settings.sample, origin);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      || sample.origin !== origin.origin || !sample.pathname.startsWith('/test/fixtures/')
      || !sample.pathname.endsWith('.json') || sample.search || sample.hash) {
      throw new MarketDataError('invalid-sample');
    }
    const data = await marketJSON(sample.href, {}, fresh);
    let payload;
    if (path === 'quote') {
      const symbols = body.symbol.split(',');
      const quoteData = data.quote.quoteData.filter((q) => symbols.includes(q.product.symbol));
      payload = { quoteData };
    } else if (path === 'chart') payload = data.charts[body.indexes];
    else if (path === 'lookup') {
      const query = body.searchString.toUpperCase();
      const matches = data.lookup.data.filter((q) => `${q.symbol} ${q.description}`
        .toUpperCase().includes(query));
      payload = { data: matches.slice(0, 8) };
    } else payload = data.topFive[path.split('/')[1]];
    if (!payload) throw new MarketDataError('missing-sample');
    return { payload, sample: true };
  }
  const request = marketRequest(path, body, settings);
  return { payload: await marketJSON(request.url, request.init, fresh), sample: false };
}

export function normalizeQuotes(payload) {
  if (!Array.isArray(payload?.quoteData)) throw new MarketDataError('invalid-quotes');
  const seen = new Set();
  return payload.quoteData.flatMap((entry) => {
    const symbol = entry?.product?.symbol;
    const price = marketNumber(entry?.intraday?.lastTrade);
    if (typeof symbol !== 'string' || !/^[A-Z0-9.^-]{1,24}$/.test(symbol)
      || seen.has(symbol) || price === null) return [];
    seen.add(symbol);
    return [{
      symbol,
      price: symbol === 'TNX' ? price / 10 : price,
      change: marketNumber(entry.intraday.changeClose),
      percent: marketNumber(entry.intraday.changeClosePercentage),
      asOf: marketDate(entry.intraday.dateTime),
    }];
  });
}

export function normalizePoints(points, { treasury = false, latestDay = true } = {}) {
  if (!Array.isArray(points)) return [];
  const unique = new Map();
  points.forEach((point) => {
    const time = marketDate(point?.stockDate);
    const value = marketNumber(point?.highValue);
    if (time !== null && value !== null) {
      unique.set(time, { time, value: treasury ? value / 10 : value });
    }
  });
  const sorted = [...unique.values()].sort((a, b) => a.time - b.time);
  if (!latestDay || !sorted.length) return sorted;
  const day = (time) => new Date(time).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const lastDay = day(sorted[sorted.length - 1].time);
  return sorted.filter((point) => day(point.time) === lastDay);
}

export function normalizeChart(payload, index) {
  const data = payload?.data;
  if (!Array.isArray(data) || data.length !== 1) throw new MarketDataError('invalid-chart');
  const points = normalizePoints(data[0].dataPoints, { treasury: index === 'TNX' });
  if (!points.length) throw new MarketDataError('empty-chart');
  return points;
}

export function normalizeTopFive(payload, group) {
  const data = payload?.top5Response?.data;
  if (!Array.isArray(data) || !data.length) throw new MarketDataError('invalid-top-five');
  const charts = payload?.chartResponse?.data;
  const seen = new Set();
  const quotes = data.flatMap((entry, index) => {
    const price = marketNumber(entry?.priceLast);
    if (typeof entry?.symbol !== 'string' || !/^[A-Z0-9.^-]{1,24}$/.test(entry.symbol)
      || price === null || seen.has(entry.symbol)) return [];
    seen.add(entry.symbol);
    // The observed PHX contract aligns charts with quotes by array position.
    const chart = Array.isArray(charts) ? charts[index] : null;
    return [{
      symbol: entry.symbol,
      name: entry.companyName || entry.fundName || '',
      price,
      change: marketNumber(entry.priceChange),
      percent: marketNumber(entry.priceChangePercent),
      asOf: marketDate(entry.asOfDate),
      points: normalizePoints(chart?.dataPoints, { latestDay: group !== 'MostSearchedMFs' }),
    }];
  }).slice(0, 5);
  if (!quotes.length) throw new MarketDataError('empty-top-five');
  return quotes;
}

export function quoteURL(symbol) {
  const url = new URL('https://us.etrade.com/e/t/invest/quotesandresearch');
  url.searchParams.set('gateway', 'prospect');
  url.searchParams.set('prospectnavyear', '2011');
  url.searchParams.set('sym', symbol);
  return url.href;
}
