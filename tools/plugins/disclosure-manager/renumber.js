import { disclosureSetMode } from '../../../scripts/disclosure-sets.js';
import {
  cellFor, orderedEntries, parseSetSource, validateSet,
} from './model.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const REFERENCE_FIELDS = new Set(['disclosureIds', 'disclosureReferences']);
const RICH_FIELDS = new Set(['body', 'bodyHtml', 'html', 'description']);

/** Freeze the permutation before touching any identities or references. */
export function renumberPlan(model, order) {
  if (!model.data.disclosures.length) throw new Error('An empty disclosure set cannot be numbered.');
  const errors = validateSet(model);
  if (errors.length) throw new Error(errors.map((error) => error.message).join(' '));
  const namespace = model.data.id;
  if (typeof namespace !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace)) {
    throw new Error('The set needs a valid namespace before numbered authoring.');
  }
  const sorted = orderedEntries(model, order);
  const mapping = new Map(sorted.map((entry, index) => [entry.disclosureId, String(index + 1)]));
  const after = sorted.map((entry, index) => ({ ...entry, disclosureId: String(index + 1) }));
  let setSource;
  if (model.payload) {
    const copy = structuredClone(model.payload);
    (copy.data ?? copy).disclosures = after;
    setSource = `${JSON.stringify(copy, null, 2)}\n`;
  } else {
    const copy = parseSetSource(model.source, model.path);
    copy.list.replaceChildren(...order.map((index) => copy.items[index]));
    order.forEach((oldIndex, newIndex) => {
      const cell = cellFor(copy.entryBlocks[oldIndex], 'disclosureId');
      const content = cell.querySelector('p') || cell;
      content.textContent = String(newIndex + 1);
    });
    setSource = copy.doc.body.outerHTML;
  }
  return {
    namespace,
    before: model.data.disclosures,
    after,
    mapping,
    setSource,
    mode: disclosureSetMode(model.data),
  };
}

function tokenResult(token, plan, confirmNumeric) {
  const prefix = `${plan.namespace}-`;
  const named = token.startsWith(prefix);
  const key = named ? token.slice(prefix.length) : token;
  let value = plan.mapping.get(key);
  if (value === undefined && plan.mode !== 'sequence' && /^[1-9]\d*$/.test(key)) {
    const previous = plan.before[Number(key) - 1];
    if (previous && !confirmNumeric) return { ambiguous: true };
    value = previous && plan.mapping.get(previous.disclosureId);
  }
  return value === undefined ? null : { value: named ? `${prefix}${value}` : value, number: value };
}

/** Replace token ranges while retaining marks, commas and surrounding whitespace. */
function replaceText(element, values) {
  const text = element.textContent;
  const replacements = [...text.matchAll(/[^,\s]+/g)].map((match, index) => ({
    start: match.index, end: match.index + match[0].length, value: values[index],
  }));
  const nodes = [];
  const collect = (node) => {
    if (node.nodeType === 3) nodes.push(node);
    else [...node.childNodes].forEach(collect);
  };
  collect(element);
  let offset = 0;
  nodes.forEach((node) => {
    const start = offset;
    const end = start + node.textContent.length;
    offset = end;
    let cursor = start;
    let output = '';
    replacements.filter((part) => part.start < end && part.end > start).forEach((part) => {
      output += text.slice(cursor, Math.max(start, part.start));
      if (part.start >= start) output += part.value;
      cursor = Math.min(end, part.end);
    });
    node.textContent = output + text.slice(cursor, end);
  });
}

function mappedTokens(tokens, plan, options, issues, location) {
  const results = tokens.map((token) => tokenResult(token, plan, options.confirmNumeric));
  if (results.some((result) => result?.ambiguous)) {
    issues.push({ type: 'error', message: `Confirm the positional intent of numeric superscript “${tokens.join(',')}” (${location}).` });
    return null;
  }
  if (!results.every(Boolean)) {
    if (results.some(Boolean)) issues.push({ type: 'error', message: `Unresolved grouped disclosure “${tokens.join(',')}” (${location}).` });
    return null;
  }
  return results;
}

function htmlReferences(source, plan, options) {
  const doc = parse(source);
  const issues = [];
  const changes = [];
  const metadataTables = new Set([...doc.querySelectorAll('table')].filter((table) => (
    table.querySelector('tr')?.textContent.trim().toLowerCase() === 'metadata'
  )));
  const excluded = (element) => element.closest('.metadata, .da-metadata, .da-form, .disclosures, .disclosure-set, code, pre, math')
    || metadataTables.has(element.closest('table'));
  if (doc.querySelector('.da-form')) {
    doc.querySelectorAll('main > div > div:not(.da-form)').forEach((block) => {
      if (block.matches('.disclosure-set, .disclosures, .metadata, .da-metadata')) return;
      [...block.children].forEach((row) => {
        const key = row.children[0]?.textContent.trim();
        const cell = row.children[1];
        if (!key || !cell) return;
        if (REFERENCE_FIELDS.has(key)) {
          const list = cell.querySelector('ul,ol');
          if (!list) {
            issues.push({ type: 'error', message: `Unsupported disclosure array ${key}.` });
            return;
          }
          [...list.children].forEach((item, index) => {
            const before = item.textContent.trim();
            const mapped = mappedTokens([before], plan, options, issues, `${key} item ${index + 1}`);
            if (mapped && mapped[0].value !== before) {
              replaceText(item, [mapped[0].value]);
              changes.push({ before, after: mapped[0].value, location: key });
            }
          });
        } else if (/^disclosure/i.test(key)) {
          issues.push({ type: 'error', message: `Unsupported disclosure field ${key}; review its schema before renumbering.` });
        }
      });
    });
  }
  doc.querySelectorAll('main sup').forEach((sup, index) => {
    if (excluded(sup)) return;
    const outer = sup.closest('a[href]');
    if (outer && (outer !== sup.parentElement || outer.children.length !== 1
      || outer.textContent.trim() !== sup.textContent.trim())) return;
    const links = [...sup.querySelectorAll('a[href]'), ...(outer ? [outer] : [])];
    if (links.some((link) => {
      const href = link.getAttribute('href');
      const named = href.match(/^#disclosure-(.+)-[1-9]\d*$/);
      return !/^#disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href)
        || (named && named[1] !== plan.namespace);
    })) return;
    let tokens = sup.textContent.trim().split(/\s*,\s*/);
    if (!tokens.every((token) => /^(?:[a-z][a-z0-9-]*|[1-9]\d*)$/.test(token))) return;
    // A fully intact generated legacy link carries unambiguous source identity.
    if (plan.mode !== 'sequence' && links.length === tokens.length
      && links.every((link, position) => link.getAttribute('aria-label') === `Disclosure ${tokens[position]}`)) {
      tokens = links.map((link) => link.getAttribute('href').slice('#disclosure-'.length));
    }
    const mapped = mappedTokens(tokens, plan, options, issues, `superscript ${index + 1}`);
    if (!mapped) return;
    const before = sup.outerHTML;
    replaceText(sup, mapped.map((result) => result.value));
    links.forEach((link, position) => {
      const result = mapped[position] || mapped[0];
      link.setAttribute('href', `#disclosure-${plan.namespace}-${result.number}`);
      if (link.hasAttribute('aria-label')) link.setAttribute('aria-label', `Disclosure ${result.number}`);
    });
    if (sup.hasAttribute('data-disclosure-ids')) sup.dataset.disclosureIds = mapped.map((result) => result.value).join(',');
    if (before !== sup.outerHTML || outer) changes.push({ before: tokens.join(','), after: mapped.map((result) => result.value).join(','), location: `superscript ${index + 1}` });
  });
  doc.querySelectorAll('main a[href]').forEach((link) => {
    if (excluded(link) || link.closest('sup') || link.querySelector('sup')) return;
    const href = link.getAttribute('href');
    if (!href.startsWith('#disclosure-')) return;
    const token = href.slice('#disclosure-'.length);
    const mapped = tokenResult(token, plan, options.confirmNumeric);
    if (!mapped?.number) return;
    const after = `#disclosure-${plan.namespace}-${mapped.number}`;
    if (href !== after) {
      link.setAttribute('href', after);
      changes.push({ before: href, after, location: 'disclosure link' });
    }
  });
  return { source: changes.length ? doc.body.outerHTML : source, changes, issues };
}

/** Only named citation fields and explicit rich-text fields are adapters for JSON. */
function jsonReferences(source, plan, options) {
  const payload = JSON.parse(source);
  const changes = [];
  const issues = [];
  const walk = (value, location) => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, item]) => {
      const path = `${location}.${key}`;
      if (REFERENCE_FIELDS.has(key)) {
        if (!Array.isArray(item) || !item.every((token) => typeof token === 'string')) {
          issues.push({ type: 'error', message: `Unsupported disclosure reference field ${path}.` });
          return;
        }
        const mapped = mappedTokens(item, plan, options, issues, path);
        if (mapped) {
          const target = mapped.map((result) => result.value);
          if (JSON.stringify(target) !== JSON.stringify(item)) {
            value[key] = target;
            changes.push({ before: item.join(','), after: target.join(','), location: path });
          }
        }
      } else if (/^disclosure/i.test(key)) {
        issues.push({ type: 'error', message: `Unsupported disclosure field ${path}; review its schema before renumbering.` });
      } else if (typeof item === 'string' && /<sup[\s>]/i.test(item)) {
        if (!RICH_FIELDS.has(key)) {
          issues.push({ type: 'error', message: `Unsupported rich-text citation field ${path}.` });
          return;
        }
        const result = htmlReferences(`<body><main>${item}</main></body>`, plan, options);
        issues.push(...result.issues);
        if (result.changes.length) {
          value[key] = parse(result.source).querySelector('main').innerHTML;
          changes.push(...result.changes.map((change) => ({ ...change, location: path })));
        }
      } else walk(item, path);
    });
  };
  walk(payload.data ?? payload, 'data');
  return { source: changes.length ? `${JSON.stringify(payload, null, 2)}\n` : source, changes, issues };
}

export function rewriteDisclosureReferences(source, plan, options = {}) {
  const first = source.trimStart()[0];
  return (first === '{' || first === '[')
    ? jsonReferences(source, plan, options) : htmlReferences(source, plan, options);
}

/** Patch the reviewed live schema without discarding site-specific fragment choices. */
export function numberedDisclosureSchema(schema) {
  const copy = structuredClone(schema);
  const disclosures = copy.properties?.disclosures;
  let item = disclosures?.items;
  if (item?.$ref?.startsWith('#/$defs/')) item = copy.$defs?.[item.$ref.slice(8)];
  const identifier = item?.properties?.disclosureId;
  if (identifier?.type !== 'string') throw new Error('The schema has no supported disclosure identifier field.');
  identifier.title = 'Disclosure number';
  identifier.description = 'Use Disclosure Manager to number disclosures and update references together. Existing letter identifiers remain valid until migrated.';
  identifier.pattern = '^(?:[a-z][a-z0-9]*|[1-9][0-9]*)$';
  disclosures.description = 'The order and disclosure numbers must agree. Reorder through Disclosure Manager so page references update together.';
  return copy;
}
