import { RATE_FIELDS, rateDecimal } from './bank-rates.js';

const KEYS = ['name', 'mode', 'product', 'field', 'balance', 'term', 'override', 'fallback'];

/** Parse the paragraphs of a Rate settings cell; omitted/unknown cells are safe. */
export default function parseRateSettings(lines) {
  const settings = {};
  const errors = [];
  lines.filter((line) => line.trim()).forEach((line) => {
    const separator = line.indexOf(':');
    const key = line.slice(0, separator).trim().toLowerCase();
    if (separator < 0 || !KEYS.includes(key) || Object.hasOwn(settings, key)) {
      errors.push('Invalid or duplicate setting.');
    } else {
      settings[key] = line.slice(separator + 1).trim();
    }
  });
  const name = (settings.name || 'rate').toLowerCase();
  const mode = settings.mode?.toLowerCase();
  const field = RATE_FIELDS.find((entry) => entry.toLowerCase() === settings.field?.toLowerCase());
  const term = settings.term?.toUpperCase();
  const override = rateDecimal(settings.override);
  const fallback = rateDecimal(settings.fallback);
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) errors.push('Invalid rate name.');
  if (!['api', 'manual', 'hybrid'].includes(mode)) errors.push('Mode must be api, manual or hybrid.');
  if (mode !== 'api' && settings.override && override === null) errors.push('Invalid override value.');
  if (settings.fallback && fallback === null) errors.push('Invalid fallback value.');
  if (mode === 'manual' && override === null) errors.push('Manual mode requires an override.');
  if (mode === 'api' || mode === 'hybrid') {
    if (!['3100', '4240', '3500'].includes(settings.product) || !field) {
      errors.push('Choose a supported product and field.');
    }
    if (settings.product === '3500') {
      const calculated = field === 'minDisclosureAPY' || field === 'maxDisclosureAPY';
      if ((!calculated && !/^\d+M$/.test(term || '')) || (calculated && term)
        || settings.balance || field === 'advertisedAPY') {
        errors.push('CD rates need a term, or a calculated APY field without a term.');
      }
    } else if (rateDecimal(settings.balance) === null || term
      || ['minDisclosureAPY', 'maxDisclosureAPY'].includes(field)) {
      errors.push('Savings/checking rates need a balance and a tier field.');
    }
  }
  return {
    ...settings, name, mode, field, term, override, fallback, valid: errors.length === 0,
  };
}
