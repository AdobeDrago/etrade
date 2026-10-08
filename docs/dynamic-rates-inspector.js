const inspector = document.createElement('aside');
inspector.id = 'dynamic-rate-inspector';
const title = document.createElement('h2');
title.textContent = 'Local rate test inspector';
const note = document.createElement('p');
note.textContent = 'This panel is added by the local test helper. Check the source of each displayed value.';
const list = document.createElement('div');
inspector.append(title, note, list);
document.body.append(inspector);
const style = document.createElement('style');
style.textContent = '#dynamic-rate-inspector { margin: 24px; padding: 20px; border: 2px solid #5627d8; background: #f5f2ff; color: #242424; font: 14px/1.5 system-ui, sans-serif; overflow-wrap: anywhere; } #dynamic-rate-inspector h2 { font-size: 22px; } #dynamic-rate-inspector p { margin: 8px 0; }';
document.head.append(style);

function render() {
  const markers = [...document.querySelectorAll('main [data-rate-name]')];
  list.replaceChildren();
  if (!markers.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No rate markers found. Paste the setup pack into your test page and preview it.';
    list.append(empty);
  }
  markers.forEach((marker) => {
    const line = document.createElement('p');
    const cardTitle = marker.closest('li')?.querySelector('h3')?.textContent || marker.dataset.rateName;
    line.textContent = `${cardTitle} · ${marker.dataset.rateName}: ${marker.textContent} · Source: ${marker.dataset.rateSource || 'pending'}${marker.dataset.rateError ? ` · Reason: ${marker.dataset.rateError}` : ''}`;
    list.append(line);
  });
}
render();
document.addEventListener('bank-rates:updated', render);
const main = document.querySelector('main');
if (main) new MutationObserver(render).observe(main, { childList: true, subtree: true });
