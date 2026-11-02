import { disclosureFragmentPath, disclosureSetEntries } from '../../../scripts/disclosure-sets.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

function rows(block) {
  return [...block.children].flatMap((row) => (row.tagName === 'TBODY' ? [...row.children] : [row]));
}

function cellFor(block, key) {
  return rows(block).find((row) => (
    row.children[0]?.textContent.trim().toLowerCase() === key.toLowerCase()
  ))?.children[1];
}

/** Read backend markup, including an undecorated authoring table. */
export function pageDisclosurePath(html) {
  const doc = parse(html);
  const metadata = [...doc.querySelectorAll('.metadata, table')].find((block) => (
    block.classList.contains('metadata') || rows(block)[0]?.textContent.trim().toLowerCase() === 'metadata'
  ));
  const cell = metadata && cellFor(metadata, 'disclosures');
  return cell?.querySelector('a[href]')?.getAttribute('href')
    || cell?.textContent.trim() || doc.querySelector('meta[name="disclosures"]')?.getAttribute('content');
}

/** Restrict authenticated source requests to paths inside the current DA site. */
export function sourceUrl(context, path) {
  const normalized = disclosureFragmentPath(path);
  if (!normalized || /[%\s]/.test(normalized) || normalized.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Use a document path within this site.');
  }
  if (![context.org, context.repo].every((part) => /^[a-z0-9-]+$/i.test(part || ''))) {
    throw new Error('DA did not provide a valid site context.');
  }
  const extension = normalized.endsWith('.json') ? '' : '.html';
  return `https://admin.da.live/source/${context.org}/${context.repo}${normalized}${extension}`;
}

export function resolveSetPath(value, context) {
  if (!value) throw new Error('Add a Disclosures row to this page’s Metadata with its disclosure set path.');
  const host = `main--${context.repo}--${context.org}.aem.page`.toLowerCase();
  const url = new URL(value, `https://${host}`);
  let path = url.pathname;
  if (url.origin === 'https://da-sc.adobeaem.workers.dev') {
    const prefix = new RegExp(`^/(preview|live)/${context.org}/${context.repo}/`, 'i');
    if (!prefix.test(path)) throw new Error('The disclosure set must belong to this DA site.');
    path = path.replace(prefix, '/');
  } else if (url.hostname !== host && !url.hostname.toLowerCase().endsWith(`--${context.repo}--${context.org}.aem.page`.toLowerCase())
    && !url.hostname.toLowerCase().endsWith(`--${context.repo}--${context.org}.aem.live`.toLowerCase())) {
    throw new Error('The disclosure set must belong to this DA site.');
  }
  if (url.search || url.hash) throw new Error('Use a disclosure set path without a query or anchor.');
  const normalized = disclosureFragmentPath(path);
  if (!normalized?.startsWith('/disclosures/sets/') && !normalized?.endsWith('.json')) {
    throw new Error('This manager needs an ID-based disclosure set. Migrate the legacy disclosure document first.');
  }
  sourceUrl(context, path);
  return normalized;
}

/** Keep the original source intact; only the array order is edited. */
export function parseSetSource(source, path) {
  if (path.endsWith('.json')) {
    const payload = JSON.parse(source);
    const data = payload.data ?? payload;
    if (!Array.isArray(data.disclosures)) throw new Error('The JSON document has no disclosures array.');
    return {
      source, path, payload, data,
    };
  }
  const doc = parse(source);
  const blocks = [...doc.querySelectorAll('main > div > div')];
  const form = blocks.find((block) => block.classList.contains('da-form'));
  if (form && cellFor(form, 'x-schema-name')?.textContent.trim() !== 'disclosure-set') {
    throw new Error('The selected document does not use the disclosure-set schema.');
  }
  const block = blocks.find((item) => item.classList.contains('disclosure-set') && item.classList.length === 1);
  const list = block && cellFor(block, 'disclosures')?.querySelector('ul, ol');
  if (!list) throw new Error('No structured disclosures array found. Use the disclosure-set schema in DA.');
  const items = [...list.children].filter((item) => item.tagName === 'LI');
  const disclosures = items.map((item) => {
    const reference = item.textContent.trim();
    if (!reference.startsWith('self://#')) throw new Error('Unsupported disclosure entry. Use a fragment and a stable disclosureId.');
    const target = blocks.find((entry) => entry.classList.contains(reference.slice(8).replaceAll('/', '-')));
    if (!target) throw new Error('A structured disclosure entry could not be resolved.');
    return {
      disclosureId: cellFor(target, 'disclosureId')?.textContent.trim(),
      fragment: cellFor(target, 'fragment')?.textContent.trim(),
    };
  });
  const supporting = (key) => [...(cellFor(block, key)?.querySelector('ul, ol')?.children || [])]
    .filter((item) => item.tagName === 'LI').map((item) => {
      const reference = item.textContent.trim();
      const target = reference.startsWith('self://#')
        && blocks.find((entry) => entry.classList.contains(reference.slice(8).replaceAll('/', '-')));
      if (!target) throw new Error(`A disclosure ${key} entry could not be resolved.`);
      return { fragment: cellFor(target, 'fragment')?.textContent.trim(), kind: cellFor(target, 'kind')?.textContent.trim() };
    });
  return {
    source,
    path,
    doc,
    list,
    items,
    data: { disclosures, introduction: supporting('introduction'), closing: supporting('closing') },
  };
}

export function validateSet(model) {
  const issues = [];
  const seen = new Set();
  model.data.disclosures.forEach((item, index) => {
    const id = item?.disclosureId;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9]*$/.test(id)) {
      issues.push({ type: 'error', message: `Entry ${index + 1} needs a stable ID using lowercase letters and digits, starting with a letter.` });
    } else if (seen.has(id)) {
      issues.push({ type: 'error', message: `Disclosure ID “${id}” appears more than once.` });
    }
    seen.add(id);
    const path = disclosureFragmentPath(item?.fragment);
    if (!path || /[%\s]/.test(path) || path.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) {
      issues.push({ type: 'error', message: `Entry ${index + 1} needs a valid fragment path within this site.` });
    }
  });
  ['introduction', 'closing'].forEach((key) => {
    if (model.data[key] !== undefined && !Array.isArray(model.data[key])) {
      issues.push({ type: 'error', message: `The ${key} must be a list of fragment references.` });
      return;
    }
    (model.data[key] || []).forEach((item, index) => {
      const path = disclosureFragmentPath(item?.fragment);
      if (!path || /[%\s]/.test(path) || path.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) {
        issues.push({ type: 'error', message: `${key} entry ${index + 1} needs a valid fragment path within this site.` });
      }
    });
  });
  return issues;
}

export function orderedEntries(model, order) {
  if (order.length !== model.data.disclosures.length || new Set(order).size !== order.length
    || order.some((index) => !Number.isInteger(index) || index < 0 || index >= order.length)) {
    throw new Error('The proposed disclosure order is incomplete. Refresh and try again.');
  }
  return order.map((index) => model.data.disclosures[index]);
}

export function reorderedSource(model, order) {
  if (validateSet(model).length) throw new Error('Fix the disclosure set errors before saving its order.');
  const entries = orderedEntries(model, order);
  if (model.payload) {
    const payload = structuredClone(model.payload);
    (payload.data ?? payload).disclosures = entries;
    return `${JSON.stringify(payload, null, 2)}\n`;
  }
  // Parse a fresh copy so failed saves never mutate the loaded snapshot.
  const copy = parseSetSource(model.source, model.path);
  copy.list.replaceChildren(...order.map((index) => copy.items[index]));
  return copy.doc.body.outerHTML;
}

/** Audit the same marker shapes the site's automatic linker accepts. */
export function auditReferences(html, entries) {
  const doc = parse(html);
  const targets = new Map(disclosureSetEntries({ disclosures: entries })
    .map(({ disclosureId, label }) => [disclosureId, label]));
  const used = new Set();
  const issues = [];
  let references = 0;
  doc.querySelectorAll('main sup').forEach((sup) => {
    if (sup.closest('.disclosures, .metadata')) return;
    const outer = sup.closest('a[href]');
    const links = [...sup.querySelectorAll('a[href]'), ...(outer ? [outer] : [])];
    if (links.some((link) => !/^#disclosure-[a-z0-9]+$/.test(link.getAttribute('href')))) return;
    const text = sup.dataset.disclosureIds || sup.textContent.trim();
    const ids = text.split(/\s*,\s*/);
    if (!ids.every((id) => /^[a-z][a-z0-9]*$|^\d+$/.test(id))) return;
    if (outer && (outer !== sup.parentElement || outer.children.length !== 1
      || outer.textContent.trim() !== sup.textContent.trim())) {
      issues.push({ type: 'error', message: `Marker “${text}” is inside a larger link and cannot be linked automatically.` });
      return;
    }
    const missing = ids.filter((id) => !targets.has(id));
    if (missing.length) {
      issues.push({ type: 'error', message: `Marker “${text}” has no matching ID for ${missing.join(', ')}. Use stable IDs rather than display numbers.` });
      return;
    }
    ids.forEach((id) => { used.add(id); references += 1; });
    issues.push({ type: 'ok', message: `Marker ${text} → ${ids.map((id) => `${targets.get(id)} (#disclosure-${id})`).join(', ')}.` });
  });
  entries.forEach(({ disclosureId }) => {
    if (!used.has(disclosureId)) issues.push({ type: 'warn', message: `No reference to “${disclosureId}” in the saved page. Check separately loaded content before removing it.` });
  });
  return { issues, references };
}

export function referenceMarkup(ids, entries) {
  const valid = new Set(entries.map((item) => item.disclosureId));
  if (!ids.length || ids.some((id) => !/^[a-z][a-z0-9]*$/.test(id) || !valid.has(id))) {
    throw new Error('Select a disclosure from this set.');
  }
  return `<sup>${[...new Set(ids)].join(',')}</sup>`;
}

export async function readSource(context, path, request) {
  const url = new URL(sourceUrl(context, path));
  url.searchParams.set('nocache', String(Date.now()));
  const response = await request(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.text();
}

/** Recheck the snapshot before updating only the disclosure set document. */
export async function saveOrder(context, model, order, request) {
  const source = reorderedSource(model, order);
  const latest = await readSource(context, model.path, request);
  if (latest !== model.source) throw new Error('This disclosure set changed since loading. Refresh before saving.');
  const body = new FormData();
  body.append('data', new Blob([source], { type: model.payload ? 'application/json' : 'text/html' }), model.path.endsWith('.json') ? 'set.json' : 'set.html');
  const response = await request(sourceUrl(context, model.path), { method: 'POST', body });
  if (!response.ok) throw new Error(`Could not save the disclosure set (${response.status}).`);
  return parseSetSource(source, model.path);
}
