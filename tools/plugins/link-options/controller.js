import { composeLinkURL, linkSummary, readSelectedLink } from './model.js';
import { cleanTrackingHref, trackingCategories, trackingParameters } from '../../../scripts/tracking-attributes.js';
import { cleanRouteHref, resolveRouteLink, routeSettings } from '../../../scripts/route-links.js';
import { cleanActionHref, linkAction, PRIVACY_ACTION } from '../../../scripts/link-actions.js';
import { captureLinkEdit, updatedLinkBlock } from './editor.js';

export default function mountLinkOptions(doc, {
  copy = (value) => navigator.clipboard.writeText(value),
} = {}) {
  const byId = (id) => doc.getElementById(id);
  let sdk;
  let dirty = false;
  let revision = 0;
  let loading = false;
  let copying = false;
  let selectedLink = {};
  let live;
  let editTarget;
  let applying = false;
  let unsubscribe;
  function canApply() {
    return !applying && editTarget && live?.editable === true
      && live.html === editTarget.expected.html
      && live.selection?.blockIndex === editTarget.expected.blockIndex
      && sdk?.capabilities?.sendHTMLReplace === 1 && typeof sdk.actions.sendHTML === 'function';
  }
  function status(text, error = false) {
    byId('status').textContent = text;
    byId('status').classList.toggle('error', error);
  }
  function toggleTracking() {
    const isAction = byId('link-action').value === PRIVACY_ACTION;
    byId('destination-fields').hidden = isAction;
    byId('url').disabled = isAction;
    byId('route-options').hidden = isAction;
    byId('route-enabled').disabled = isAction;
    byId('tracking-fields').hidden = !byId('track-clicks').checked;
    byId('custom-category-field').hidden = byId('category').value !== 'custom';
    byId('route-fields').hidden = !byId('route-enabled').checked;
  }
  function setCategory(category) {
    const normalized = trackingCategories(category)?.join(',') || category;
    byId('category').value = ['none', 'C0004', 'C0002', 'C0002,C0004'].includes(normalized)
      ? normalized : 'custom';
    byId('custom-category').value = category;
    byId('advanced').open = normalized !== 'C0004';
  }
  function options() {
    return {
      href: byId('url').value,
      action: byId('link-action').value,
      enabled: byId('track-clicks').checked,
      key: byId('tracking-key').value,
      category: byId('category').value === 'custom'
        ? byId('custom-category').value : byId('category').value,
      route: {
        enabled: byId('link-action').value !== PRIVACY_ACTION && byId('route-enabled').checked,
        paths: byId('route-paths').value,
        label: byId('route-label').value,
        href: byId('route-url').value,
      },
    };
  }
  function render() {
    toggleTracking();
    byId('apply').disabled = !canApply();
    const summary = linkSummary({ ...selectedLink, ...options() });
    Object.entries(summary).forEach(([key, value]) => { byId(`summary-${key}`).textContent = value; });
    byId('copy').textContent = 'Copy URL';
    byId('manual-copy').hidden = true;
    doc.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    try {
      byId('output-url').value = composeLinkURL(options());
      const previewPath = byId('preview-path').value.trim();
      const preview = previewPath.startsWith('/') && !previewPath.startsWith('//')
        ? resolveRouteLink(byId('output-url').value, `https://preview.example${previewPath}`) : undefined;
      byId('route-preview').textContent = preview
        ? `${preview.matched ? 'Matching pages' : 'Default'}: “${preview.label || selectedLink.label || 'Your default wording'}” → ${cleanActionHref(cleanTrackingHref(preview.href))}`
        : 'Enter a page path beginning with / to preview the result.';
      byId('output-help').textContent = 'Paste this into the URL field in DA’s Edit link dialog, then Save.';
    } catch {
      byId('output-url').value = '';
      byId('output-help').textContent = 'Complete the destination and any enabled tracking settings to generate a URL.';
      byId('route-preview').textContent = 'Complete the link settings to preview both wording and destination.';
    }
  }
  function fill(settings) {
    revision += 1;
    selectedLink = { label: settings.label, target: settings.target };
    byId('url').value = settings.href;
    byId('link-action').value = settings.action || '';
    byId('track-clicks').checked = settings.enabled;
    byId('tracking-key').value = settings.key;
    byId('route-enabled').checked = Boolean(settings.route?.enabled);
    byId('route-paths').value = settings.route?.paths || '/brokerage, /what-we-offer';
    byId('route-label').value = settings.route?.label || '';
    byId('route-url').value = settings.route?.href || '';
    setCategory(settings.category);
    render();
  }
  async function loadSelection() {
    if (loading || !sdk) return;
    loading = true;
    byId('load-selection').disabled = true;
    status('Reading the selected link…');
    const requestedAt = revision;
    const snapshot = live;
    try {
      const html = await sdk.actions.getSelection();
      if (typeof html !== 'string') throw new Error('No selection found');
      const captured = snapshot === undefined || snapshot === live
        ? captureLinkEdit(live, html) : null;
      const selected = readSelectedLink(captured?.linkHTML || html);
      if (revision !== requestedAt) {
        status('Your current values were kept. Use “Load selected link” again to replace them.');
        return;
      }
      fill(selected);
      dirty = false;
      editTarget = captured;
      render();
      byId('selection-label').textContent = `Selected link: ${selected.label}`;
      status(canApply() ? 'Link loaded. Configure its options, then Apply to selected link.'
        : 'Link loaded. Copy its URL to update it in the native link dialog.');
    } catch (error) {
      editTarget = null;
      byId('apply').disabled = true;
      const message = error?.message || error;
      status(message === 'No selection found'
        ? 'Select a complete link and use “Load selected link”, or paste a destination URL below.'
        : 'Could not load one selected link. Paste its URL below, or select it again in DA.');
    } finally {
      loading = false;
      byId('load-selection').disabled = false;
    }
  }
  byId('load-selection').addEventListener('click', loadSelection);
  byId('apply').addEventListener('click', async () => {
    if (!canApply()) return;
    const connection = sdk;
    const target = editTarget;
    const requestedAt = revision;
    applying = true;
    render();
    try {
      const href = composeLinkURL(options());
      const html = await connection.actions.getSelection();
      const current = captureLinkEdit(live, html);
      if (sdk !== connection || revision !== requestedAt || !current
        || current.expected.html !== target.expected.html
        || current.expected.blockIndex !== target.expected.blockIndex
        || current.linkIndex !== target.linkIndex) {
        throw new Error('The selection or page changed. Load the selected link again before applying.');
      }
      const result = await connection.actions.sendHTML(updatedLinkBlock(target, href), {
        replace: true, expected: target.expected,
      });
      if (sdk !== connection) return;
      if (!result?.ok) throw new Error('The editor could not apply this change. Load the selected link again.');
      editTarget = null;
      if (revision !== requestedAt) {
        status('The previous settings were applied. Your latest values were kept; load the link again before another change.');
        return;
      }
      dirty = false;
      status('Link updated in the editor. Use Undo to revert, then save and preview in DA.');
    } catch (error) {
      if (sdk === connection) status(error.message || 'Could not update the selected link.', true);
    } finally {
      applying = false;
      render();
    }
  });
  byId('close').addEventListener('click', () => sdk?.actions.closeLibrary?.());
  byId('link-form').addEventListener('input', () => { dirty = true; revision += 1; render(); });
  byId('category').addEventListener('change', render);
  byId('track-clicks').addEventListener('change', render);
  byId('route-enabled').addEventListener('change', render);
  byId('link-action').addEventListener('change', () => { dirty = true; revision += 1; render(); });
  byId('url').addEventListener('change', () => {
    const settings = trackingParameters(byId('url').value);
    const route = routeSettings(byId('url').value);
    const action = linkAction(byId('url').value);
    if (settings.enabled || route.enabled || cleanActionHref(byId('url').value) !== byId('url').value) {
      fill({
        ...selectedLink,
        ...settings,
        route,
        action,
        href: action ? '' : cleanActionHref(cleanRouteHref(cleanTrackingHref(byId('url').value))),
      });
    }
  });
  byId('link-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (copying) return;
    let value;
    try {
      value = composeLinkURL(options());
    } catch (error) {
      status(error.message, true);
      const input = byId(error.field);
      if (input) {
        if (error.field === 'custom-category') {
          byId('advanced').open = true;
          byId('category').value = 'custom';
          toggleTracking();
        }
        input.setAttribute('aria-invalid', 'true');
        input.focus?.();
      }
      return;
    }
    copying = true;
    const requestedAt = revision;
    byId('copy').disabled = true;
    byId('output-url').value = value;
    try {
      await copy(value);
      if (revision !== requestedAt) {
        status('The previous URL was copied. Your values changed; copy the current URL again.');
        return;
      }
      byId('copy').textContent = 'Copied';
      status('URL copied. Close Link Options, open DA’s Edit link dialog, paste into URL, then Save.');
    } catch {
      if (revision !== requestedAt) {
        status('Your values changed while clipboard access was pending. Review the current URL and copy it again.');
        return;
      }
      byId('manual-copy').hidden = false;
      byId('output-url').focus?.();
      byId('output-url').select?.();
      status('Clipboard access is unavailable. Select the generated URL and copy it manually.');
    } finally {
      copying = false;
      byId('copy').disabled = false;
    }
  });
  render();
  doc.defaultView?.addEventListener('focus', () => {
    if (!dirty && !applying) loadSelection();
  });
  doc.defaultView?.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
  return {
    async connect(connection) {
      if (!connection.actions?.getSelection) return;
      unsubscribe?.();
      revision += 1;
      sdk = connection;
      live = undefined;
      editTarget = null;
      if (connection.capabilities?.liveDocument === 1 && connection.actions.subscribeLiveDocument) {
        let subscribing = true;
        unsubscribe = connection.actions.subscribeLiveDocument((snapshot) => {
          if (sdk !== connection) return;
          live = snapshot;
          byId('apply').disabled = !canApply();
          if (!subscribing && !dirty && !applying && !loading) loadSelection();
        });
        subscribing = false;
      }
      if (!dirty && connection.context?.path) byId('preview-path').value = connection.context.path;
      byId('load-selection').disabled = false;
      byId('close').hidden = false;
      if (!dirty) await loadSelection();
    },
    fill,
  };
}
