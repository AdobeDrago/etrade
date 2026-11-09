import { disclosureFragmentPath } from '../../../scripts/disclosure-sets.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const NUMBER_GROUP = /^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/;
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const ordinary = (text) => text.replace(/\d/g, (digit) => SUPERSCRIPT[Number(digit)]);

export async function copyAssistantContent(
  text,
  html,
  clipboard = navigator.clipboard,
  Item = window.ClipboardItem,
) {
  if (html && Item && clipboard.write) {
    await clipboard.write([new Item({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
  } else await clipboard.writeText(text);
}

function numbered(entries, namespace) {
  return typeof namespace === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace)
    && entries.length > 0
    && entries.every((entry) => disclosureFragmentPath(entry.fragment));
}

function referenceHTML(candidate) {
  if (!candidate.linkable) return '';
  const links = candidate.numbers.map((number) => `<a href="${candidate.targets[number]}" aria-label="Disclosure ${number}">${number}</a>`);
  return `<sup>${links.join(',')}</sup>`;
}

/** Capture an exact superscript inside the host's selected, version-guarded block. */
export function superscriptCandidates(
  snapshot,
  entries,
  namespace,
  { includeLinked = false } = {},
) {
  if (typeof snapshot?.html !== 'string' || !numbered(entries, namespace)) return [];
  const targets = Object.fromEntries(entries.map((entry, index) => [String(index + 1),
    /^[1-9]\d*$/.test(entry.disclosureId)
      ? `#disclosure-${namespace}-${index + 1}` : `#disclosure-${entry.disclosureId}`]));
  const doc = parse(snapshot.html);
  const blockIndex = snapshot.selection?.blockIndex;
  const indexed = Number.isSafeInteger(blockIndex) && blockIndex >= 0
    ? [...doc.querySelectorAll(`[data-block-index="${blockIndex}"]`)] : [];
  const scope = indexed.length === 1 ? indexed[0] : doc.querySelector('main') || doc.body;
  return [...scope.querySelectorAll('sup')].flatMap((sup, position) => {
    const text = sup.textContent.trim();
    if (!NUMBER_GROUP.test(text) || sup.closest('.metadata, .disclosures, code, pre, math')) return [];
    const outer = sup.closest('a[href]');
    const links = [...sup.querySelectorAll('a[href]'), ...(outer ? [outer] : [])];
    if (links.length && (!includeLinked || links.some((link) => (
      !Object.values(targets).includes(link.getAttribute('href'))
    )))) return [];
    if (outer && (outer !== sup.parentElement || outer.children.length !== 1
      || outer.textContent.trim() !== text)) return [];
    const block = sup.closest('[data-block-index]');
    const sameBlock = indexed.length === 1 && block === scope;
    const supIndex = block ? [...block.querySelectorAll('sup')].indexOf(sup) : position;
    const numbers = text.split(/\s*,\s*/);
    return [{
      key: `${namespace}:${block?.getAttribute('data-block-index') ?? 'copy'}:${supIndex}:${sup.outerHTML}`,
      namespace,
      targets,
      numbers,
      text,
      supIndex,
      supHTML: sup.outerHTML,
      blockHTML: block?.outerHTML || '',
      expected: snapshot.editable === true && sameBlock
        ? { html: snapshot.html, blockIndex } : null,
      linkable: numbers.every((number) => Object.hasOwn(targets, number)),
    }];
  });
}

/** Only the captured citation changes; surrounding block content remains intact. */
export function updatedSuperscriptBlock(candidate, choice, replacement) {
  if (!candidate.blockHTML || !['link', 'ordinary'].includes(choice)) throw new Error('No supported superscript edit.');
  const doc = parse(candidate.blockHTML);
  const block = doc.querySelector('[data-block-index]');
  const sup = block?.querySelectorAll('sup')[candidate.supIndex];
  if (!sup || sup.outerHTML !== candidate.supHTML) throw new Error('The superscript changed. Check it again.');
  const outer = sup.closest('a[href]');
  if (outer) outer.replaceWith(sup);
  if (choice === 'link') {
    const target = replacement && Object.hasOwn(candidate.targets, replacement)
      ? { ...candidate, numbers: [replacement], linkable: true } : candidate;
    if (!target.linkable) throw new Error('No matching disclosure for this number.');
    const linked = parse(referenceHTML(target)).querySelector('sup');
    sup.replaceChildren(...linked.childNodes);
  } else {
    sup.querySelectorAll('a').forEach((link) => link.replaceWith(...link.childNodes));
    const convert = (node) => {
      if (node.nodeType === 3) node.textContent = ordinary(node.textContent);
      else [...node.childNodes].forEach(convert);
    };
    convert(sup);
    sup.replaceWith(...sup.childNodes);
  }
  return block.outerHTML;
}

export default function mountDisclosureAssistant({
  document: doc, sdk, getEntries, getNamespace, getFragments, onStatus,
  canEdit = () => true,
  copyText = copyAssistantContent,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const byId = (id) => doc.getElementById(id);
  const card = byId('assistant-suggestion');
  let latest;
  let baseline;
  let candidate;
  let timer;
  let disposed = false;
  let applying = false;
  let selectionRequest = 0;
  const dismissed = new Set();
  const listeners = [];
  const report = (message, error = false) => {
    byId('assistant-status').textContent = message;
    onStatus?.(message, error);
  };
  const editable = () => candidate?.expected && canEdit() && !applying
    && sdk.capabilities?.sendHTMLReplace === 1 && typeof sdk.actions.sendHTML === 'function';
  const controls = () => {
    byId('assistant-link').disabled = !editable() || !candidate?.linkable;
    byId('assistant-ordinary').disabled = !editable();
    byId('assistant-choose').disabled = !editable();
    byId('assistant-alternative').disabled = !editable();
    byId('assistant-copy-link').disabled = !candidate?.linkable || !canEdit();
    byId('assistant-copy-ordinary').disabled = !candidate || !canEdit();
  };
  const hide = () => { card.hidden = true; candidate = undefined; controls(); };
  const show = (item) => {
    candidate = item;
    card.hidden = false;
    byId('assistant-copy').hidden = true;
    byId('assistant-question').textContent = item.linkable
      ? `Link to disclosure ${item.numbers.join(', ')}?` : 'Is this an ordinary superscript?';
    const entries = getEntries();
    const fragments = getFragments();
    const excerpt = byId('assistant-excerpt');
    excerpt.replaceChildren();
    item.numbers.forEach((number) => {
      const entry = entries[Number(number) - 1];
      const content = entry && fragments.get(disclosureFragmentPath(entry.fragment));
      const paragraph = doc.createElement('p');
      paragraph.textContent = entry
        ? `${number} — ${content?.title || 'Disclosure'}: ${content?.excerpt || ''}`
        : `No disclosure numbered ${number} exists in the saved set.`;
      excerpt.append(paragraph);
    });
    byId('assistant-alternative').replaceChildren(...entries.map((entry, index) => {
      const option = doc.createElement('option');
      const content = fragments.get(disclosureFragmentPath(entry.fragment));
      option.value = String(index + 1);
      option.textContent = `${index + 1} — ${content?.title || content?.excerpt || 'Disclosure'}`;
      return option;
    }));
    byId('assistant-ordinary-preview').textContent = `Ordinary superscript: ${ordinary(item.text)}`;
    if (!editable()) byId('assistant-status').textContent = 'This selection supports copying. Apply controls require a supported Canvas block.';
    controls();
  };
  const candidates = (value, options) => superscriptCandidates(
    value,
    getEntries(),
    getNamespace(),
    options,
  );
  const refresh = () => {
    clearTimer(timer);
    hide();
    baseline = candidates(latest);
    const available = numbered(getEntries(), getNamespace());
    byId('assistant-check').disabled = !available || typeof sdk.actions.getSelection !== 'function';
    byId('assistant-status').textContent = available
      ? 'Finish a superscript while this panel is open, or check the selected one.'
      : 'Choose a disclosure set to use the disclosure assistant.';
  };
  const receive = (snapshot) => {
    if (disposed || typeof snapshot?.html !== 'string') return;
    const changed = latest?.html !== snapshot.html;
    const moved = latest?.selection?.blockIndex !== snapshot.selection?.blockIndex;
    latest = snapshot;
    selectionRequest += 1;
    clearTimer(timer);
    const items = candidates(snapshot);
    if (!baseline || !changed || moved) {
      baseline = items;
      if (moved) hide();
      return;
    }
    let prefix = 0;
    while (prefix < baseline.length && prefix < items.length
      && baseline[prefix].supHTML === items[prefix].supHTML) prefix += 1;
    let suffix = 0;
    while (suffix < baseline.length - prefix && suffix < items.length - prefix
      && baseline.at(-suffix - 1).supHTML === items.at(-suffix - 1).supHTML) suffix += 1;
    const fresh = items.slice(prefix, items.length - suffix)
      .filter((item) => !dismissed.has(item.key));
    baseline = items;
    const expected = snapshot.html;
    timer = setTimer(() => {
      if (!disposed && latest?.html === expected && fresh.length && !applying) {
        const item = fresh.at(-1);
        const duplicate = items.filter((entry) => entry.supHTML === item.supHTML).length > 1;
        show(duplicate ? { ...item, expected: null } : item);
      }
    }, 600);
  };
  const apply = async (choice, replacement) => {
    if (!candidate || applying) return;
    if (candidate.expected && (latest?.html !== candidate.expected.html
      || latest?.selection?.blockIndex !== candidate.expected.blockIndex)) {
      report('The page changed. Check the superscript again.', true);
      hide();
      return;
    }
    if (!editable()) return;
    const current = candidate;
    applying = true;
    controls();
    try {
      const html = updatedSuperscriptBlock(current, choice, replacement);
      const result = await sdk.actions.sendHTML(html, {
        replace: true, expected: current.expected,
      });
      if (!result?.ok) {
        if (result?.error === 'unsupported') {
          current.expected = null;
          show(current);
          report('This editor cannot apply a guarded change here. Use a copy option.');
        } else {
          hide();
          report('The page or selection changed. Check the superscript again.', true);
        }
        return;
      }
      dismissed.add(current.key);
      clearTimer(timer);
      hide();
      report(choice === 'link' ? 'Disclosure linked. Save the page in DA when ready.' : 'Kept as an ordinary superscript. Save the page in DA when ready.');
    } catch (error) { report(error.message || 'The editor could not apply the change.', true); } finally { applying = false; controls(); }
  };
  const copy = async (choice) => {
    if (!candidate || !canEdit()) return;
    const text = choice === 'link' ? candidate.numbers.join(',') : ordinary(candidate.text);
    const html = choice === 'link' ? referenceHTML(candidate) : undefined;
    if (!text) return;
    const output = byId('assistant-copy');
    output.hidden = false;
    output.value = text;
    try {
      await copyText(text, html);
      report('Copied. Paste it over the selected superscript in DA.');
    } catch {
      report('Copy the text below manually. For a disclosure, paste into the existing superscript.');
    }
  };
  const check = async () => {
    hide();
    selectionRequest += 1;
    const request = selectionRequest;
    const previousHTML = latest?.html;
    try {
      const html = await sdk.actions.getSelection();
      if (disposed) return;
      if (request !== selectionRequest || previousHTML !== latest?.html) {
        report('The page changed. Check the superscript again.', true);
        return;
      }
      const selected = parse(`<body>${html}</body>`);
      const text = selected.body.textContent.trim();
      if (!NUMBER_GROUP.test(text) || selected.querySelectorAll('sup').length > 1) {
        throw new Error('Select one superscript number or comma-separated group in the page.');
      }
      const selectedItems = candidates({ html: `<body><main>${html}</main></body>` }, {
        includeLinked: true,
      });
      const matches = selectedItems.length === 1
        ? candidates(latest, { includeLinked: true })
          .filter((item) => item.supHTML === selectedItems[0].supHTML) : [];
      if (matches.length === 1) show(matches[0]);
      else {
        const [item] = candidates({ html: `<body><main><sup>${text}</sup></main></body>`, editable: false });
        if (!item) throw new Error('Use a numbered disclosure set first.');
        show(item);
        report('The selection cannot be replaced unambiguously here. Use a copy option.');
      }
    } catch (error) { report(error.message || 'Selection access is unavailable. Select the superscript and try again.', true); }
  };
  const listen = (id, handler) => {
    byId(id).addEventListener('click', handler);
    listeners.push([byId(id), handler]);
  };
  listen('assistant-check', check);
  listen('assistant-link', () => apply('link'));
  listen('assistant-choose', () => apply('link', byId('assistant-alternative').value));
  listen('assistant-ordinary', () => apply('ordinary'));
  listen('assistant-copy-link', () => copy('link'));
  listen('assistant-copy-ordinary', () => copy('ordinary'));
  listen('assistant-dismiss', () => { if (candidate) dismissed.add(candidate.key); hide(); });
  let unsubscribe;
  try { unsubscribe = sdk.actions.subscribeLiveDocument?.(receive); } catch {
    byId('assistant-status').textContent = 'Live suggestions are unavailable. Use Check selected superscript.';
  }
  refresh();
  return {
    refresh,
    update: controls,
    dispose: () => {
      disposed = true;
      clearTimer(timer);
      unsubscribe?.();
      listeners.forEach(([element, handler]) => element.removeEventListener('click', handler));
    },
  };
}
