import { parseSetSource } from './model.js';
import { prepareDisclosureSave, notifyDisclosureSave } from '../../../scripts/disclosure-sync.js';
import { disclosureReferenceSignature } from '../../../scripts/disclosure-reference-sync.js';

function savedSet(source, path) {
  const { data } = parseSetSource(source, path);
  const select = (items) => (items || []).map(({ kind, fragment }) => ({
    ...(kind && { kind }), fragment,
  }));
  return {
    id: data.id,
    disclosures: data.disclosures.map(({ disclosureId, fragment }) => ({ disclosureId, fragment })),
    introduction: select(data.introduction),
    closing: select(data.closing),
  };
}

function plainSourceOrder(doc) {
  const main = doc?.querySelector('main');
  if (!main) return false;
  const tags = new Set(['DIV', 'P', 'SPAN', 'STRONG', 'EM', 'SUP', 'SUB', 'A', 'BR']);
  return [...main.querySelectorAll('*')].every((element) => {
    if (element.closest('.metadata, .da-metadata')) return true;
    if (element.closest('table')?.querySelector('tr')?.textContent.trim().toLowerCase() === 'metadata') return true;
    return tags.has(element.tagName) && !element.className
      && !(element.tagName === 'A' && element.getAttribute('href')?.includes('/fragments/'));
  });
}

/** Only verified set data and the temporary permutation cross the author channel. */
function authorChange(operation) {
  const set = operation.writes.find((write) => write.kind === 'set');
  const restoring = operation.direction === 'restore' || operation.status === 'restored';
  const change = {
    ...operation,
    before: savedSet(restoring ? set.target : set.original, set.path),
    after: savedSet(restoring ? set.original : set.target, set.path),
    mapping: restoring ? operation.mapping.map(([from, to]) => [to, from]) : operation.mapping,
  };
  change.references = operation.writes.filter((write) => write.kind === 'citations').map((write) => {
    const source = restoring ? [write.target, write.original] : [write.original, write.target];
    const documents = source.map((html) => {
      if (html.trimStart().startsWith('{')) return null;
      return new DOMParser().parseFromString(html, 'text/html');
    });
    const safe = documents.every(plainSourceOrder);
    return {
      path: write.path.replace(/\.html$/, ''),
      safe,
      before: safe ? disclosureReferenceSignature(documents[0], change) : [],
      after: safe ? disclosureReferenceSignature(documents[1], change) : [],
    };
  });
  return change;
}

export function prepareAuthorSync(context, operation, win) {
  return prepareDisclosureSave(context, authorChange(operation), win);
}

export function notifyAuthorSync(context, operation, win) {
  return notifyDisclosureSave(context, authorChange(operation), win);
}
