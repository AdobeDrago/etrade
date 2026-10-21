import { composeLinkURL, readSelectedLink } from './model.js';
import { cleanTrackingHref, trackingCategories, trackingParameters } from '../../../scripts/tracking-attributes.js';

export default function mountLinkOptions(doc, {
  copy = (value) => navigator.clipboard.writeText(value),
} = {}) {
  const byId = (id) => doc.getElementById(id);
  let sdk;
  let dirty = false;
  let revision = 0;
  let loading = false;
  let copying = false;
  function status(text, error = false) {
    byId('status').textContent = text;
    byId('status').classList.toggle('error', error);
  }
  function toggleTracking() {
    byId('tracking-fields').hidden = !byId('track-clicks').checked;
    byId('custom-category-field').hidden = byId('category').value !== 'custom';
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
    };
  }
  function render() {
    toggleTracking();
    byId('copy').textContent = 'Copy URL';
    byId('manual-copy').hidden = true;
    doc.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    try {
      byId('output-url').value = composeLinkURL(options());
      byId('output-help').textContent = 'Paste this into the URL field in DA’s Edit link dialog, then Save.';
    } catch {
      byId('output-url').value = '';
      byId('output-help').textContent = 'Complete the destination and any enabled tracking settings to generate a URL.';
    }
  }
  function fill(settings) {
    byId('url').value = settings.href;
    byId('track-clicks').checked = settings.enabled;
    byId('tracking-key').value = settings.key;
    setCategory(settings.category);
    render();
  }
  async function loadSelection() {
    if (loading || !sdk) return;
    loading = true;
    byId('reload').disabled = true;
    status('Reading the selected link…');
    const requestedAt = revision;
    try {
      const html = await sdk.actions.getSelection();
      if (typeof html !== 'string') throw new Error('No selection found');
      const selected = readSelectedLink(html);
      if (revision !== requestedAt) {
        status('Your current values were kept. Reload the selection again to replace them.');
        return;
      }
      fill(selected);
      dirty = false;
      byId('selection-label').textContent = `Selected link: ${selected.label}`;
      status('Link loaded. Configure its options, then copy the URL.');
    } catch (error) {
      const message = error?.message || error;
      status(message === 'No selection found'
        ? 'Select a complete link and reload the selection, or paste a destination URL below.'
        : 'Could not load one selected link. Paste its URL below, or select it again in DA.');
    } finally {
      loading = false;
      byId('reload').disabled = false;
    }
  }
  byId('reload').addEventListener('click', loadSelection);
  byId('close').addEventListener('click', () => sdk?.actions.closeLibrary?.());
  byId('link-form').addEventListener('input', () => { dirty = true; revision += 1; render(); });
  byId('category').addEventListener('change', render);
  byId('track-clicks').addEventListener('change', render);
  byId('url').addEventListener('change', () => {
    const settings = trackingParameters(byId('url').value);
    if (settings.enabled) fill({ ...settings, href: cleanTrackingHref(byId('url').value) });
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
    byId('copy').disabled = true;
    byId('output-url').value = value;
    try {
      await copy(value);
      byId('copy').textContent = 'Copied';
      status('URL copied. Close this panel, open DA’s Edit link dialog, paste into URL, then Save.');
    } catch {
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
      sdk = connection;
      byId('reload').disabled = false;
      byId('close').hidden = false;
      if (!dirty) await loadSelection();
    },
    fill,
  };
}
