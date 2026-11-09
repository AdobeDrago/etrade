import { superscriptSelection, applyDisclosureChoice } from './disclosure-editor.js';

const mounted = new WeakMap();

/** The rendered footer supplies existing choices, including legacy sets awaiting conversion. */
export function disclosureChoices(doc) {
  const regions = [...doc.querySelectorAll('.disclosures')].filter((region) => !region.hidden);
  if (regions.length !== 1) return [];
  return [...regions[0].querySelectorAll('.disclosures-items > li[id]')].flatMap((item, index) => {
    const number = item.getAttribute('value') || String(index + 1);
    if (!/^[1-9]\d*$/.test(number) || !/^disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) return [];
    return [{
      number,
      href: `#${item.id}`,
      excerpt: item.textContent.replace(/\s+/g, ' ').trim().slice(0, 260),
      element: item,
    }];
  });
}

/** Isolate the feature-detected DA quick-edit seam; unsupported editors remain untouched. */
function activeEditor(doc) {
  const wrapper = doc.activeElement?.closest?.('.prosemirror-editor');
  const view = wrapper?.view;
  if (!wrapper?.isConnected || !view?.dom || !wrapper.contains(view.dom)
    || !view.dom.contains(doc.activeElement)) return null;
  return view;
}

export default function mountInlineDisclosureHelper(doc, win, {
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!doc.body?.classList.contains('quick-edit')) return null;
  if (mounted.has(doc)) return mounted.get(doc);
  const panel = doc.createElement('aside');
  panel.className = 'disclosure-inline';
  panel.setAttribute('aria-label', 'Disclosure linking suggestions');
  panel.setAttribute('role', 'region');
  panel.hidden = true;
  const question = doc.createElement('p');
  question.setAttribute('role', 'status');
  question.setAttribute('aria-live', 'polite');
  const excerpt = doc.createElement('p');
  const primary = doc.createElement('button');
  primary.type = 'button';
  primary.className = 'disclosure-inline-link';
  const heading = doc.createElement('h3');
  heading.textContent = 'Other existing disclosures';
  const alternatives = doc.createElement('div');
  alternatives.className = 'disclosure-inline-choices';
  const help = doc.createElement('p');
  help.className = 'disclosure-inline-help';
  help.textContent = 'Alt+↑/↓ chooses a disclosure. Alt+Enter links it. Escape dismisses.';
  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  panel.append(question, excerpt, primary, heading, alternatives, help, dismiss);
  doc.body.append(panel);
  let candidate;
  let view;
  let choices = [];
  let selected;
  let timer;
  let dismissed;
  const hide = () => { panel.hidden = true; candidate = undefined; };
  const choose = () => {
    if (!candidate) return;
    const current = disclosureChoices(doc);
    const unchanged = current.length === choices.length && current.every((choice, index) => (
      choice.element === choices[index].element && choice.number === choices[index].number
      && choice.href === choices[index].href && choice.excerpt === choices[index].excerpt
    ));
    if (!unchanged || activeEditor(doc) !== view
      || !applyDisclosureChoice(view, candidate, selected)) {
      hide();
      return;
    }
    dismissed = superscriptSelection(view, choices);
    hide();
  };
  const describe = () => {
    const matches = selected ? [selected] : candidate.numbers;
    const found = choices.filter((choice) => matches.includes(choice.number));
    const linkable = selected || candidate.linkable;
    question.textContent = linkable ? `Link disclosure ${matches.join(', ')}?`
      : `No disclosure ${candidate.numbers.join(', ')} exists. Choose an existing disclosure.`;
    excerpt.textContent = found.map((choice) => `${choice.number} — ${choice.excerpt}`).join('\n');
    primary.textContent = `Link disclosure ${matches.join(', ')}`;
    primary.disabled = !linkable;
    alternatives.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(matches.includes(button.dataset.number)));
    });
  };
  const render = () => {
    view = activeEditor(doc);
    choices = disclosureChoices(doc);
    const next = superscriptSelection(view, choices);
    if (!next || candidate?.doc !== next.doc || candidate?.anchor !== next.anchor
      || candidate?.head !== next.head) selected = undefined;
    candidate = next;
    if (!candidate || (dismissed?.doc === candidate.doc && dismissed.from === candidate.from
      && dismissed.anchor === candidate.anchor && dismissed.head === candidate.head)) {
      hide(); return;
    }
    alternatives.replaceChildren(...choices.map((choice) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.number = choice.number;
      button.textContent = `${choice.number} — ${choice.excerpt}`;
      button.addEventListener('click', () => { selected = choice.number; choose(); });
      return button;
    }));
    describe();
    panel.hidden = false;
    const rect = view.dom.getBoundingClientRect?.();
    if (rect) {
      const width = Math.min(400, (win.innerWidth || 1024) - 32);
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(16, Math.min(rect.left, (win.innerWidth || 1024) - width - 16))}px`;
      panel.style.top = `${Math.max(16, Math.min(rect.bottom + 8, (win.innerHeight || 768) - 320))}px`;
    }
  };
  const schedule = () => { clearTimer(timer); timer = setTimer(render, 350); };
  const keydown = (event) => {
    if (event.key === 'Escape') { dismissed = candidate; hide(); return; }
    if (panel.hidden || !event.altKey || activeEditor(doc) !== view) return;
    if (event.key === 'Enter') {
      event.preventDefault(); choose();
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const current = selected || candidate.numbers[0];
      const index = choices.findIndex((choice) => choice.number === current);
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length)
        % choices.length;
      selected = choices[next].number;
      describe();
    }
  };
  // Pointer choices retain the mini-editor focus so DA can settle normally after the edit.
  const retainFocus = (event) => { if (event.target.closest('button')) event.preventDefault(); };
  const focusout = () => {
    clearTimer(timer);
    timer = setTimer(() => { if (!activeEditor(doc)) hide(); }, 0);
  };
  primary.addEventListener('click', choose);
  dismiss.addEventListener('click', () => { dismissed = candidate; hide(); });
  panel.addEventListener('mousedown', retainFocus);
  const events = ['input', 'keyup', 'focusin', 'selectionchange'];
  events.forEach((name) => doc.addEventListener(name, schedule));
  doc.addEventListener('keydown', keydown);
  doc.addEventListener('focusout', focusout);
  const observer = win.MutationObserver ? new win.MutationObserver((records) => {
    if (records.some((record) => !record.target.closest?.('.disclosure-inline, .disclosure-hint'))) schedule();
  }) : null;
  observer?.observe(doc.body, { childList: true, subtree: true });
  schedule();
  const dispose = () => {
    clearTimer(timer);
    observer?.disconnect();
    events.forEach((name) => doc.removeEventListener(name, schedule));
    doc.removeEventListener('keydown', keydown);
    doc.removeEventListener('focusout', focusout);
    panel.remove();
    mounted.delete(doc);
  };
  mounted.set(doc, dispose);
  return dispose;
}
