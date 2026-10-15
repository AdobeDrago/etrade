/* eslint-env es2021 */
import { rateDecimal } from './bank-rates.js';

export const DEMO_BALANCE_KEY = 'userBalance';

/** Test balances are available only on local development and AEM preview hosts. */
export function readDemoBalance(win = globalThis.window) {
  const hostname = win?.location?.hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    && !hostname?.endsWith('.aem.page')) return null;
  try {
    return rateDecimal(win.localStorage.getItem(DEMO_BALANCE_KEY));
  } catch {
    return null;
  }
}

/** A dummy balance changes tier selection, while authored overrides keep priority. */
export default function applyDemoBalance(settings, win = globalThis.window) {
  if (!settings.valid || !['3100', '4240'].includes(settings.product)
    || !(settings.mode === 'api' || (settings.mode === 'hybrid' && settings.override === null))) {
    return settings;
  }
  const balance = readDemoBalance(win);
  return balance === null ? settings : {
    ...settings,
    balance,
    authoredBalance: settings.balance,
    balanceSource: 'demo',
  };
}
