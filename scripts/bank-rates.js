/* eslint-env es2021 */
const ENDPOINTS = {
  direct: 'https://us.etrade.com/phx/pros/apicontent/init/bankRates',
  aggregate: 'https://us.etrade.com/phx/pros/aggregate',
};
const requests = new Map();
export const RATE_FIELDS = ['advertisedAPY', 'disclosureAPY', 'finalRate', 'minDisclosureAPY', 'maxDisclosureAPY'];

export class BankRateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BankRateError';
    this.code = code;
  }
}

/** Strict decimal validation: zero is a value, blank/NaN/percent text are not. */
export function rateDecimal(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return /^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? text : null;
}

/** Keep API precision (including finalRate); authors supply the % and APY label. */
export function formatBankRate(value) {
  const decimal = rateDecimal(value);
  if (decimal === null) throw new BankRateError('invalid-value', 'Rate must be a non-negative decimal.');
  const [whole, fraction = ''] = decimal.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

/** Resolve the requested aggregate index, never the first unrelated response. */
export function normalizeBankRates(payload) {
  let data = payload;
  if (Array.isArray(payload?.responses)) {
    const matches = payload.responses.filter((response) => response?.index === 0 || response?.index === '0');
    if (matches.length !== 1) throw new BankRateError('aggregate-response', 'Expected one bank-rate response at index 0.');
    const [response] = matches;
    if (response.status !== 200) throw new BankRateError('aggregate-status', 'The bank-rate subrequest failed.');
    if (typeof response.body !== 'string') throw new BankRateError('aggregate-body', 'Expected a JSON string body.');
    try {
      data = JSON.parse(response.body);
    } catch {
      throw new BankRateError('aggregate-body', 'Invalid bank-rate JSON string.');
    }
  }
  const products = data?.campaign?.offer?.productList;
  if (!Array.isArray(products) || !products.length
    || (data.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length))) {
    throw new BankRateError('invalid-response', 'Bank-rate product data is unavailable.');
  }
  return {
    products,
    offerCode: data.campaign.offer.offerCode,
    campaignCode: data.campaign.campaignCode,
  };
}

/** Select by stable product code, explicit balance or CD term, and exact field. */
export function selectBankRate(data, {
  product, field, balance, term,
}) {
  if (!RATE_FIELDS.includes(field)) throw new BankRateError('invalid-field', 'Unsupported bank-rate field.');
  const matches = data.products.filter((entry) => entry?.productType === product);
  if (matches.length !== 1) throw new BankRateError('missing-product', 'Product is missing or ambiguous.');
  const [selected] = matches;
  let value;
  if (field === 'minDisclosureAPY' || field === 'maxDisclosureAPY') {
    if (product !== '3500') throw new BankRateError('invalid-field', 'Calculated APY fields require a CD product.');
    value = selected.calculatedFields?.[field];
  } else {
    const rates = Array.isArray(selected.rates) ? selected.rates : [];
    const tiers = rates.filter((rate) => {
      if (!rate || typeof rate !== 'object') return false;
      if (product === '3500') return term && rate.durationCode === term;
      const low = rateDecimal(rate.balLowRange);
      const high = rateDecimal(rate.balHiRange);
      const amount = rateDecimal(balance);
      // A zero high limit denotes the open-ended highest balance tier.
      return amount !== null && low !== null && high !== null
        && Number(amount) >= Number(low) && (Number(high) === 0 || Number(amount) <= Number(high));
    });
    if (tiers.length !== 1) throw new BankRateError('missing-tier', 'No unique balance tier or CD term matches.');
    value = tiers[0][field];
  }
  const decimal = rateDecimal(value);
  if (decimal === null) throw new BankRateError('missing-value', 'The requested rate field is unavailable.');
  return decimal;
}

/** Page metadata may select the approved external endpoint or a same-origin route. */
export function createBankRateRequest({ source = 'direct', endpoint } = {}, baseURL = globalThis.location?.href) {
  if (!Object.hasOwn(ENDPOINTS, source)) throw new BankRateError('invalid-source', 'Use direct or aggregate bank rates.');
  let url;
  let base;
  try {
    url = new URL(endpoint || ENDPOINTS[source], baseURL);
    base = baseURL ? new URL(baseURL) : null;
  } catch {
    throw new BankRateError('invalid-endpoint', 'Invalid bank-rate endpoint.');
  }
  const sameOrigin = base && url.origin === base.origin;
  if ((!sameOrigin && url.href !== ENDPOINTS[source]) || url.username || url.password || url.hash
    || !['http:', 'https:'].includes(url.protocol)) {
    throw new BankRateError('invalid-endpoint', 'Use the approved endpoint or a same-origin approved route.');
  }
  const init = { method: source === 'aggregate' ? 'POST' : 'GET', credentials: 'omit', mode: 'cors' };
  if (source === 'aggregate') {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify([{
      id: '0', api_id: 'webapipros', method: 'GET', path: '/phx/apicontent/init/bankRates', body: '',
    }]);
  }
  return { url: url.href, init };
}

/** One bounded request per source/endpoint per page; failures are shared too. */
export function loadBankRates(options = {}) {
  let request;
  try {
    request = createBankRateRequest(options);
  } catch (error) {
    return Promise.reject(error);
  }
  const key = `${request.init.method} ${request.url}`;
  if (!requests.has(key)) {
    requests.set(key, (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(request.url, { ...request.init, signal: controller.signal });
        if (!response.ok) throw new BankRateError('http-status', `Bank-rate request failed (${response.status}).`);
        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new BankRateError('invalid-json', 'Bank-rate response is not JSON.');
        }
        const normalized = normalizeBankRates(payload);
        if (options.source === 'aggregate' && !Array.isArray(payload?.responses)) {
          throw new BankRateError('aggregate-response', 'Expected an aggregate envelope.');
        }
        return { ...normalized, fetchedAt: new Date().toISOString() };
      } catch (error) {
        if (controller.signal.aborted) throw new BankRateError('timeout', 'Bank-rate request timed out.');
        if (error instanceof BankRateError) throw error;
        throw new BankRateError('network', 'Bank rates could not be fetched.');
      } finally {
        clearTimeout(timeout);
      }
    })());
  }
  return requests.get(key);
}
