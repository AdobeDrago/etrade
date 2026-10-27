import { composeLinkURL, linkSummary, readSelectedLink } from './model.js';
import { cleanTrackingHref, trackingCategories, trackingParameters } from '../../../scripts/tracking-attributes.js';
import { cleanRouteHref, resolveRouteLink, routeSettings } from '../../../scripts/route-links.js';

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
  function status(text, error = false) {
    byId('status').textContent = text;
    byId('status').classList.toggle('error', error);
  }
  function toggleTracking() {
    byId('tracking-fields').hidden = !byId('track-clicks').checked;
    byId('custom-category-field').hidden = byId('category').value !== 'custom';
    byId('route-fields').hidden = !byId('route-enabled').checked;
  }
  function setCategory(category) {
    const normalized = trackingCategories(category)?.join(',') || category;
    byId('category').value = ['C0004', 'C0002', 'C0002,C0004'].includes(normalized)
      ? normalized : 'custom';
    byId('custom-category').value = category;
    byId('advanced').open = normalized !== 'C0004';
  }
  function options() {
    return {
      href: byId('url').value,
      enabled: byId('track-clicks').checked,
      key: byId('tracking-key').value,
      category: byId('category').value === 'custom'
        ? byId('custom-category').value : byId('category').value,
      route: {
        enabled: byId('route-enabled').checked,
        paths: byId('route-paths').value,
        label: byId('route-label').value,
        href: byId('route-url').value,
      },
    };
  }
  function render() {
    toggleTracking();
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
        ? `${preview.matched ? 'Matching pages' : 'Default'}: “${preview.label || selectedLink.label || 'Your default wording'}” → ${cleanTrackingHref(preview.href)}`
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
    try {
      const html = await sdk.actions.getSelection();
      if (typeof html !== 'string') throw new Error('No selection found');
      const selected = readSelectedLink(html);
      if (revision !== requestedAt) {
        status('Your current values were kept. Use “Load selected link” again to replace them.');
        return;
      }
      fill(selected);
      dirty = false;
      byId('selection-label').textContent = `Selected link: ${selected.label}`;
      status('Link loaded. Configure its options, then copy the URL.');
    } catch (error) {
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
  byId('close').addEventListener('click', () => sdk?.actions.closeLibrary?.());
  byId('link-form').addEventListener('input', () => { dirty = true; revision += 1; render(); });
  byId('category').addEventListener('change', render);
  byId('track-clicks').addEventListener('change', render);
  byId('route-enabled').addEventListener('change', render);
  byId('url').addEventListener('change', () => {
    const settings = trackingParameters(byId('url').value);
    const route = routeSettings(byId('url').value);
    if (settings.enabled || route.enabled) {
      fill({
        ...selectedLink,
        ...settings,
        route,
        href: cleanRouteHref(cleanTrackingHref(byId('url').value)),
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
  return {
    async connect(connection) {
      if (!connection.actions?.getSelection) return;
      revision += 1;
      sdk = connection;
      if (!dirty && connection.context?.path) byId('preview-path').value = connection.context.path;
      byId('load-selection').disabled = false;
      byId('close').hidden = false;
      if (!dirty) await loadSelection();
    },
    fill,
  };
}
