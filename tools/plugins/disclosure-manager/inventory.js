import { disclosureFragmentPath } from '../../../scripts/disclosure-sets.js';
import {
  pageDisclosurePath, readSource, resolveSetPath, sourceUrl,
} from './model.js';
import { previewContent } from './preview.js';
import { renumberPlan, rewriteDisclosureReferences } from './renumber.js';

const issue = (message) => ({ type: 'error', message });
const EMBEDDED_FIELDS = new Set(['fragment', 'bodyFragment', 'contentFragment']);

function localPath(value, context) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let path = value.trim();
  if (!path.startsWith('/')) {
    let url;
    try { url = new URL(path); } catch { throw new Error(`Unsupported embedded content path ${path}.`); }
    const suffix = `--${context.repo}--${context.org}.aem.`.toLowerCase();
    if (!url.hostname.toLowerCase().includes(suffix) || !/\.aem\.(page|live)$/i.test(url.hostname)
      || url.search || url.hash) throw new Error(`Embedded content must belong to this site: ${path}.`);
    path = url.pathname;
  }
  const normalized = disclosureFragmentPath(path);
  sourceUrl(context, normalized);
  return normalized;
}

function selectedSet(value, context) {
  if (!value) return null;
  try { return resolveSetPath(value, context); } catch {
    // Other pages can still use legacy legal documents; record their separate context.
    return localPath(value, context);
  }
}

/** Complete directory listings are retained so a newly added consumer invalidates review. */
export async function readSiteInventory(context, request) {
  sourceUrl(context, '/context-check');
  const site = `/${context.org}/${context.repo}`;
  const folders = [''];
  const seen = new Set();
  const documents = new Set();
  const directories = [];
  const scan = async () => {
    const folder = folders.shift();
    if (folder === undefined) return null;
    if (seen.has(folder)) return scan();
    seen.add(folder);
    if (seen.size > 2000) throw new Error('Site enumeration exceeded 2000 directories; narrow the content structure before renumbering.');
    const response = await request(`https://admin.da.live/list${site}${folder}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not enumerate ${folder || '/'} (${response.status}).`);
    const listing = await response.json();
    if (!Array.isArray(listing)) throw new Error(`Invalid directory listing for ${folder || '/'}.`);
    const signature = [];
    listing.forEach((entry) => {
      if (typeof entry?.path !== 'string' || !entry.path.startsWith(`${site}/`)) {
        throw new Error('Directory listing contains a path outside this DA site.');
      }
      const relative = entry.path.slice(site.length);
      const parent = relative.slice(0, relative.lastIndexOf('/'));
      if (parent !== folder) throw new Error(`Directory listing contains an unexpected path: ${relative}.`);
      sourceUrl(context, relative);
      if (relative.split('/').some((part) => part.startsWith('.'))) return;
      if (entry.ext !== undefined && typeof entry.ext !== 'string') throw new Error(`Invalid source type for ${relative}.`);
      signature.push({ path: relative, ext: entry.ext || '' });
      if (!entry.ext) folders.push(relative);
      else if (['html', 'json'].includes(entry.ext)) {
        if (!relative.endsWith(`.${entry.ext}`)) throw new Error(`Invalid source extension for ${relative}.`);
        documents.add(disclosureFragmentPath(relative));
      }
    });
    const entries = signature.sort((a, b) => a.path.localeCompare(b.path));
    directories.push({ path: folder, entries });
    if (documents.size > 5000) throw new Error('Site enumeration exceeded 5000 source documents.');
    return scan();
  };
  await scan();
  return { documents: [...documents].sort(), directories };
}

function dependencies(source, context) {
  const embedded = new Set();
  const sets = new Set();
  let isSet = false;
  const addEmbedded = (value) => {
    const path = localPath(value, context);
    if (path) embedded.add(path);
  };
  if (source.trimStart().startsWith('{')) {
    const payload = JSON.parse(source);
    const data = payload.data ?? payload;
    isSet = Array.isArray(data.disclosures) && data.disclosures.every((entry) => entry?.fragment);
    if (!isSet) {
      const selected = data.disclosureSet ?? data.metadata?.disclosures;
      if (selected) sets.add(selectedSet(selected, context));
      const walk = (value) => {
        if (!value || typeof value !== 'object') return;
        Object.entries(value).forEach(([key, item]) => {
          if (EMBEDDED_FIELDS.has(key) && typeof item === 'string') addEmbedded(item);
          else walk(item);
        });
      };
      walk(data);
    }
  } else {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    isSet = Boolean(doc.querySelector('.disclosure-set'));
    if (!isSet) {
      const selected = pageDisclosurePath(source);
      if (selected) sets.add(selectedSet(selected, context));
      doc.querySelectorAll('main .fragment').forEach((block) => {
        addEmbedded(block.querySelector('a[href]')?.getAttribute('href') || block.textContent.trim());
      });
      doc.querySelectorAll('main .disclosures').forEach((block) => {
        const link = block.querySelector('a[href]');
        if (block.children.length === 1 && link
          && block.textContent.trim() === link.textContent.trim()) {
          sets.add(selectedSet(link.getAttribute('href'), context));
        }
      });
      if (doc.querySelector('.da-form')) {
        doc.querySelectorAll('main > div > div:not(.da-form) > div').forEach((row) => {
          if (EMBEDDED_FIELDS.has(row.children[0]?.textContent.trim())) {
            addEmbedded(row.children[1]?.textContent.trim());
          }
        });
      }
    }
  }
  return { embedded, sets, isSet };
}

async function readDocuments(context, paths, request) {
  const sources = new Map();
  let cursor = 0;
  const next = async () => {
    if (cursor >= paths.length) return;
    const path = paths[cursor];
    cursor += 1;
    sources.set(path, await readSource(context, path, request));
    await next();
  };
  await Promise.all(Array.from({ length: Math.min(6, paths.length) }, next));
  return sources;
}

/** A reviewed batch contains every changed consumer once and its set last. */
export async function planAffectedSources(context, model, order, request, options = {}) {
  const numbering = renumberPlan(model, order);
  const result = {
    namespace: numbering.namespace,
    setPath: model.path,
    mapping: [...numbering.mapping],
    writes: [],
    issues: [],
    scanned: 0,
    affectedPages: [],
    inventory: null,
  };
  try {
    const inventory = await readSiteInventory(context, request);
    result.inventory = inventory;
    if (!inventory.documents.includes(model.path)) throw new Error('The selected set is absent from the complete site inventory.');
    const sources = await readDocuments(context, inventory.documents, request);
    result.scanned = sources.size;
    if (sources.get(model.path) !== model.source) throw new Error('The disclosure set changed since loading. Refresh before reviewing.');
    const graph = new Map([...sources].map(([path, source]) => (
      [path, dependencies(source, context)]
    )));
    const incoming = new Set();
    graph.forEach((node, path) => node.embedded.forEach((child) => {
      if (!sources.has(child)) result.issues.push(issue(`Embedded source ${child} referenced by ${path} is missing from the site inventory.`));
      incoming.add(child);
    }));
    model.data.disclosures.forEach((entry) => {
      const path = disclosureFragmentPath(entry.fragment);
      const source = sources.get(path);
      if (source === undefined) result.issues.push(issue(`Required disclosure fragment ${path} is unavailable.`));
      else if (previewContent(source).empty) result.issues.push(issue(`Required disclosure fragment ${path} is empty.`));
    });
    const consumers = new Map();
    const affected = new Set();
    graph.forEach((root, page) => {
      if (root.isSet || (!root.sets.size && incoming.has(page))) return;
      if (root.sets.has(model.path)) {
        result.affectedPages.push(page);
        if (root.sets.size !== 1) result.issues.push(issue(`Page ${page} selects multiple disclosure sets; combined numbering needs a separate review.`));
      }
      const visited = new Set();
      const visit = (path) => {
        if (visited.has(path)) return;
        visited.add(path);
        if (!consumers.has(path)) consumers.set(path, []);
        consumers.get(path).push({ page, sets: root.sets });
        if (root.sets.has(model.path)) affected.add(path);
        graph.get(path)?.embedded.forEach(visit);
      };
      visit(page);
    });
    [...affected].sort().forEach((path) => {
      if (!sources.has(path)) return;
      const original = sources.get(path);
      const rewritten = rewriteDisclosureReferences(original, numbering, options);
      result.issues.push(...rewritten.issues.map((entry) => ({ ...entry, message: `${path}: ${entry.message}` })));
      if (rewritten.source === original) return;
      const bare = rewritten.changes.some((change) => change.before.split(/\s*,\s*/).some((token) => (
        !token.startsWith(`${numbering.namespace}-`) && !token.startsWith(`#disclosure-${numbering.namespace}-`)
      )));
      const conflicting = (consumers.get(path) || [])
        .filter((consumer) => !consumer.sets.has(model.path));
      if (bare && conflicting.length) {
        result.issues.push(issue(`Shared source ${path} also supplies another set or page without that set: ${conflicting.map((consumer) => consumer.page).join(', ')}. Separate or qualify those citations before renumbering.`));
      }
      result.writes.push({
        path, original, target: rewritten.source, references: rewritten.changes.length, kind: 'citations',
      });
    });
    result.writes.push({
      path: model.path, original: model.source, target: numbering.setSource, references: 0, kind: 'set',
    });
  } catch (error) { result.issues.push(issue(error.message)); }
  return result;
}
