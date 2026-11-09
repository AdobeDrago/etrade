import mountInlineDisclosureHelper from './disclosure-inline.js';
import { listenDisclosureSaves } from './disclosure-sync.js';
import { refreshDisclosureSets } from './disclosure-refresh.js';
import decorateDisclosureReferences, { EDITOR_INDICATORS } from './disclosure-references.js';

const mounted = new WeakMap();

/** Keep authoring help outside content; edits use the guarded native transaction adapter. */
export default function mountDisclosureHints(doc, win) {
  if (!doc.body.classList.contains('quick-edit')) return null;
  if (mounted.has(doc)) return mounted.get(doc);
  const disposeInline = mountInlineDisclosureHelper(doc, win);
  const disposeSync = listenDisclosureSaves(doc, win, async (change) => {
    await refreshDisclosureSets(doc, change);
    doc.querySelectorAll('main').forEach((main) => decorateDisclosureReferences(main));
  });
  const hint = doc.createElement('aside');
  hint.className = 'disclosure-hint';
  let id = 'disclosure-hint';
  let suffix = 1;
  while (doc.getElementById(id)) { id = `disclosure-hint-${suffix}`; suffix += 1; }
  hint.id = id;
  hint.setAttribute('role', 'tooltip');
  hint.hidden = true;
  const title = doc.createElement('h3');
  const excerpt = doc.createElement('p');
  const help = doc.createElement('p');
  help.className = 'disclosure-hint-help';
  help.textContent = 'Edit a numeric superscript for inline linking choices. Use Disclosure Manager to reorder disclosures.';
  hint.append(title, excerpt, help);
  doc.body.append(hint);
  let active;
  const hide = () => {
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/)
        .filter((value) => value && value !== hint.id);
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
      else active.removeAttribute('aria-describedby');
    }
    active = undefined;
    hint.hidden = true;
  };
  const show = (event) => {
    const link = event.target.closest?.('sup.disclosures-reference a[href]');
    if (!link || link.closest(EDITOR_INDICATORS)) return;
    const href = link.getAttribute('href');
    if (!/^#disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href)) return;
    const target = doc.getElementById(href.slice(1));
    const region = target?.closest('.disclosures');
    if (!target?.matches('.disclosures-items > li') || !region || region.hidden) return;
    hide();
    active = link;
    title.textContent = link.getAttribute('aria-label') || `Disclosure ${link.textContent}`;
    const text = target.textContent.replace(/\s+/g, ' ').trim();
    excerpt.textContent = text.length > 260 ? `${text.slice(0, 259)}…` : text;
    hint.hidden = false;
    const described = (link.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    link.setAttribute('aria-describedby', [...described, hint.id].join(' '));
    const rect = link.getBoundingClientRect?.();
    if (rect) {
      const width = Math.min(384, (win.innerWidth || 1024) - 32);
      const left = Math.max(16, Math.min(rect.left, (win.innerWidth || 1024) - width - 16));
      hint.style.left = `${left}px`;
      hint.style.width = `${width}px`;
      const { height } = hint.getBoundingClientRect();
      const top = rect.bottom + 8 + height < win.innerHeight
        ? rect.bottom + 8 : rect.top - height - 8;
      hint.style.top = `${Math.max(16, top)}px`;
    }
  };
  const leave = (event) => {
    if (active?.contains(event.relatedTarget) || hint.contains(event.relatedTarget)) return;
    hide();
  };
  const key = (event) => { if (event.key === 'Escape') hide(); };
  doc.addEventListener('mouseover', show);
  doc.addEventListener('focusin', show);
  doc.addEventListener('mouseout', leave);
  doc.addEventListener('focusout', leave);
  doc.addEventListener('keydown', key);
  doc.addEventListener('scroll', hide, true);
  win.addEventListener?.('resize', hide);
  const dispose = () => {
    disposeInline?.();
    disposeSync?.();
    hide();
    doc.removeEventListener('mouseover', show);
    doc.removeEventListener('focusin', show);
    doc.removeEventListener('mouseout', leave);
    doc.removeEventListener('focusout', leave);
    doc.removeEventListener('keydown', key);
    doc.removeEventListener('scroll', hide, true);
    win.removeEventListener?.('resize', hide);
    hint.remove();
    mounted.delete(doc);
  };
  mounted.set(doc, dispose);
  return dispose;
}
