import { disclosureFragmentPath } from './disclosure-sets.js';
import { pauseDisclosureReferences, REFERENCE_EXCLUSIONS } from './disclosure-references.js';

const identity = /^[a-z][a-z0-9]*$|^[1-9]\d*$/;
const citationTags = new Set('A ABBR B BDI BDO BR CITE CODE DEL EM I INS MARK Q S SMALL SPAN STRONG SUB SUP U WBR'.split(' '));
const maxCitationNodes = 256;
const maxCitationDepth = 32;
const maxCitationLength = 16 * 1024;

/** Bound cloning to small, inert inline citations; leave unusual authored content untouched. */
function cloneCitation(node) {
  if (!node?.matches?.('sup, a')) return null;
  const pending = [{ node, depth: 0 }];
  let count = 0;
  let length = 0;
  while (pending.length) {
    const { node: current, depth } = pending.pop();
    count += 1;
    if (count > maxCitationNodes || depth > maxCitationDepth) return null;
    if (current.nodeType === 3) length += current.nodeValue.length;
    else if (current.nodeType === 1) {
      if (!citationTags.has(current.tagName)) return null;
      for (let index = 0; index < current.attributes.length; index += 1) {
        const { name, value } = current.attributes[index];
        length += name.length + value.length;
        if (/^on|^srcdoc$/i.test(name)
          || (name === 'href' && !/^#disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
          || (name === 'style' && /url\s*\(|expression\s*\(|@import/i.test(value))) return null;
      }
    } else return null;
    if (length > maxCitationLength) return null;
    for (let child = current.lastChild; child; child = child.previousSibling) {
      pending.push({ node: child, depth: depth + 1 });
      if (count + pending.length > maxCitationNodes) return null;
    }
  }
  return node.cloneNode(true);
}

function excluded(sup) {
  if (sup.closest(REFERENCE_EXCLUSIONS)) return true;
  return sup.closest('table')?.querySelector('tr')?.textContent.trim().toLowerCase() === 'metadata';
}

function superscriptLink(link) {
  const sup = link.querySelector('sup');
  return link.closest('sup') || (sup && sup.parentElement === link && link.children.length === 1
    && link.textContent.trim() === sup.textContent.trim());
}

function anchorFor(id, namespace) {
  return `#disclosure-${/^\d+$/.test(id) ? `${namespace}-` : ''}${id}`;
}

/** Compare authored reference tokens even when the site is displaying generated links. */
export function disclosureReferenceSignature(doc, change) {
  const entries = [...change.before.disclosures, ...change.after.disclosures];
  const allowed = new Set([...entries.map((entry) => entry.disclosureId),
    ...change.before.disclosures.map((_, index) => String(index + 1))]);
  const anchors = new Set(entries.map(({ disclosureId }) => (
    `#disclosure-${/^\d+$/.test(disclosureId) ? `${change.namespace}-` : ''}${disclosureId}`
  )));
  const markers = [...doc.querySelectorAll('main sup')].flatMap((sup) => {
    if (excluded(sup)) return [];
    const outer = sup.closest('a[href]');
    if (outer && (outer !== sup.parentElement || outer.children.length !== 1
      || outer.textContent.trim() !== sup.textContent.trim())) return [];
    const links = [...sup.querySelectorAll('a[href]'), ...(outer ? [outer] : [])];
    if (links.some((link) => !anchors.has(link.getAttribute('href')))) return [];
    const display = sup.textContent.trim().split(/\s*,\s*/);
    const cached = sup.dataset.disclosureIds?.split(',');
    const intact = cached?.length === display.length && links.length === display.length
      && links.every((link, index) => link.getAttribute('aria-label') === `Disclosure ${display[index]}`
        && link.textContent === display[index]);
    const tokens = (intact ? cached : display).map((token) => (
      token.startsWith(`${change.namespace}-`) ? token.slice(change.namespace.length + 1) : token
    ));
    return tokens.every((token) => allowed.has(token)) ? [tokens.join(',')] : [];
  });
  const linked = [...doc.querySelectorAll('main a[href]')].flatMap((link) => {
    const href = link.getAttribute('href');
    if (excluded(link) || superscriptLink(link) || !anchors.has(href)) return [];
    const id = href.slice('#disclosure-'.length).replace(`${change.namespace}-`, '');
    return [`@${id}`];
  });
  return [...markers, ...linked];
}

/** An ambiguous recovery must not leave clickable old numbers under a new footer. */
export function unlinkDisclosureReferences(doc, change, { suspendStandalone = false } = {}) {
  const suspended = [];
  const anchors = new Set([...change.before.disclosures, ...change.after.disclosures]
    .map(({ disclosureId }) => `#disclosure-${/^\d+$/.test(disclosureId) ? `${change.namespace}-` : ''}${disclosureId}`));
  doc.querySelectorAll('main sup').forEach((sup) => {
    if (excluded(sup)) return;
    const outer = sup.closest('a[href]');
    if (outer?.children.length === 1 && outer.textContent === sup.textContent
      && anchors.has(outer.getAttribute('href'))) outer.replaceWith(sup);
    sup.querySelectorAll('a[href]').forEach((link) => {
      if (anchors.has(link.getAttribute('href'))) link.replaceWith(...link.childNodes);
    });
  });
  doc.querySelectorAll('main a[href]').forEach((link) => {
    if (excluded(link) || !anchors.has(link.getAttribute('href'))) return;
    if (suspendStandalone) {
      const href = link.getAttribute('href');
      link.removeAttribute('href');
      link.setAttribute('data-disclosure-link-pending', '');
      suspended.push({ node: link, href, html: link.outerHTML });
    } else link.replaceWith(...link.childNodes);
  });
  return suspended;
}

export function restoreDisclosureLinks(doc, suspended) {
  suspended.forEach(({ node, href, html }) => {
    const target = doc.getElementById(href.slice(1));
    if (!node.isConnected || node.ownerDocument !== doc || node.outerHTML !== html
      || !target?.matches('.disclosures-items > li') || target.closest('.disclosures')?.hidden) return;
    node.setAttribute('href', href);
    node.removeAttribute('data-disclosure-link-pending');
  });
}

export function requireDisclosureViewRefresh(doc, change) {
  pauseDisclosureReferences(doc);
  unlinkDisclosureReferences(doc, change);
  if (!doc.querySelector('.disclosure-sync-notice')) {
    const notice = doc.createElement('aside');
    notice.className = 'disclosure-sync-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'The disclosure order was saved. Reopen this page to refresh its references.';
    doc.body.append(notice);
  }
}

/** The old footer must describe exactly the saved sequence that is being reordered. */
function boundFooter(doc, change) {
  const entries = change.before?.disclosures;
  if (!Array.isArray(entries) || !entries.length) return null;
  return [...doc.querySelectorAll('.disclosures')].find((block) => {
    if (block.hidden) return false;
    const items = [...block.querySelectorAll('.disclosures-items > li[id]')];
    return items.length === entries.length && items.every((item, index) => (
      item.dataset.disclosureId === entries[index].disclosureId
      && item.dataset.disclosureFragment === disclosureFragmentPath(entries[index].fragment)
    ));
  });
}

export function hasMatchingDisclosureFooter(doc, change) {
  return Boolean(boundFooter(doc, change));
}

function replaceTokens(sup, values) {
  const ranges = [...sup.textContent.matchAll(/[^,\s]+/g)].map((match, index) => ({
    from: match.index, to: match.index + match[0].length, value: values[index],
  }));
  let offset = 0;
  const visit = (node) => {
    if (node.nodeType !== 3) { [...node.childNodes].forEach(visit); return; }
    const start = offset;
    const original = node.textContent;
    offset += original.length;
    let text = original;
    [...ranges].reverse().forEach((range) => {
      const left = Math.max(start, range.from);
      const right = Math.min(offset, range.to);
      if (left >= right) return;
      text = text.slice(0, left - start) + (left === range.from ? range.value : '')
        + text.slice(right - start);
    });
    node.textContent = text;
  };
  visit(sup);
}

function citationHTML(node) {
  const clone = cloneCitation(node);
  if (!clone) return null;
  [clone, ...clone.querySelectorAll('[aria-describedby]')].forEach((element) => {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/);
    if (!ids) return;
    const authored = ids.filter((id) => !node.ownerDocument.getElementById(id)?.matches('.disclosure-hint'));
    if (authored.length) element.setAttribute('aria-describedby', authored.join(' '));
    else element.removeAttribute('aria-describedby');
  });
  return clone.outerHTML;
}

/** Capture exact nodes before writes; later native replacements cannot be mapped twice. */
export function captureDisclosureRenumbering(doc, change, { allowUnbound = false } = {}) {
  const footer = boundFooter(doc, change);
  if ((!footer && !allowUnbound) || !Array.isArray(change.mapping)) return [];
  const mapping = new Map(change.mapping);
  const before = change.before.disclosures;
  const anchors = new Set(before.map(({ disclosureId }) => (
    `#disclosure-${/^\d+$/.test(disclosureId) ? `${change.namespace}-` : ''}${disclosureId}`
  )));
  const resolve = (token) => {
    const key = token.startsWith(`${change.namespace}-`) ? token.slice(change.namespace.length + 1) : token;
    return mapping.get(key) || mapping.get(before[Number(key) - 1]?.disclosureId);
  };
  const markers = [...doc.querySelectorAll('main sup')].flatMap((sup) => {
    if (excluded(sup)) return [];
    const outer = sup.closest('a[href]');
    const node = outer || sup;
    const beforeHTML = citationHTML(node);
    if (beforeHTML === null) return [];
    if (outer && (outer !== sup.parentElement || outer.children.length !== 1
      || outer.textContent.trim() !== sup.textContent.trim())) return [];
    const links = [...sup.querySelectorAll('a[href]'), ...(outer ? [outer] : [])];
    if (links.some((link) => !anchors.has(link.getAttribute('href')))) return [];
    const display = sup.textContent.trim().split(/\s*,\s*/);
    const cached = sup.dataset.disclosureIds?.split(',');
    const intact = cached?.length === display.length && links.length === display.length
      && links.every((link, index) => link.getAttribute('aria-label') === `Disclosure ${display[index]}`
        && link.textContent === display[index]);
    const tokens = intact ? cached : display;
    if (!tokens.every((token) => identity.test(token) || token.startsWith(`${change.namespace}-`))) return [];
    const values = tokens.map(resolve);
    if (!values.every((value) => typeof value === 'string' && identity.test(value))) return [];
    const replacement = cloneCitation(sup);
    if (!replacement) return [];
    replacement.querySelectorAll('a').forEach((link) => link.replaceWith(...link.childNodes));
    delete replacement.dataset.disclosureIds;
    replacement.classList.remove('disclosures-reference');
    replaceTokens(replacement, values);
    if (!outer && replacement.outerHTML === sup.outerHTML) return [];
    return [{
      node, before: beforeHTML, replacement, parent: node.parentElement,
    }];
  });
  const linked = [...doc.querySelectorAll('main a[href]')].flatMap((link) => {
    const href = link.getAttribute('href');
    if (excluded(link) || superscriptLink(link) || !anchors.has(href)) return [];
    const id = href.slice('#disclosure-'.length).replace(`${change.namespace}-`, '');
    const value = resolve(id);
    if (!value) return [];
    const replacement = cloneCitation(link);
    if (!replacement) return [];
    replacement.setAttribute('href', anchorFor(value, change.namespace));
    return [{
      node: link, before: citationHTML(link), replacement, parent: link.parentElement,
    }];
  });
  return [...markers, ...linked];
}

/** Apply only unchanged static references; DA retains ownership of active editor state. */
export function applyDisclosureRenumbering(doc, captured) {
  let count = 0;
  captured.forEach(({
    node, before, replacement, parent,
  }) => {
    if (!node?.isConnected || node.ownerDocument !== doc || node.parentElement !== parent
      || citationHTML(node) !== before || excluded(node)) return;
    const copy = cloneCitation(replacement);
    if (!copy) return;
    node.replaceWith(copy);
    count += 1;
  });
  return count;
}
