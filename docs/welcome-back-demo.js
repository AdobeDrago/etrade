const response = await fetch('./welcome-back-content.html');
if (!response.ok) throw new Error('Welcome Back authoring content could not be loaded.');
const content = new DOMParser().parseFromString(await response.text(), 'text/html');
const main = document.querySelector('main');
const metadata = [...content.querySelectorAll('table')].find((table) => table.rows[0]?.textContent.trim() === 'Metadata');
[...metadata.rows].slice(1).forEach((row) => {
  const meta = document.createElement('meta');
  meta.name = row.cells[0].textContent.trim().toLowerCase().replaceAll(' ', '-');
  meta.content = row.cells[1].textContent.trim();
  document.head.append(meta);
});
metadata.remove();
const mode = new URLSearchParams(window.location.search).get('data');
if (mode === 'unavailable') {
  document.querySelector('meta[name="market-data-base"]').content = '/test/fixtures/unavailable/';
} else if (mode !== 'live') {
  const sample = document.createElement('meta');
  sample.name = 'market-data-sample';
  sample.content = '/test/fixtures/market-data.json';
  document.head.append(sample);
}
let notice = 'Local review: fabricated sample market data and existing E*TRADE sign-in. ';
if (mode === 'live') notice = 'Local review: testing live E*TRADE services. ';
else if (mode === 'unavailable') notice = 'Local review: intentional service failure. ';
document.querySelector('.review-banner').firstChild.textContent = notice;
let section = document.createElement('div');
main.append(section);
[...content.body.children].forEach((node) => {
  if (node.tagName === 'HR') {
    section = document.createElement('div');
    main.append(section);
  } else if (node.tagName === 'TABLE') {
    const name = node.rows[0].textContent.trim().toLowerCase();
    const block = document.createElement('div');
    block.className = name.replace(/[()]/g, '').split(/\s+/).slice(0, name.includes('(') ? 2 : undefined).join('-');
    if (name.includes('(welcome back)')) block.className = 'cards-icon welcome-back';
    [...node.rows].slice(1).forEach((row) => {
      const div = document.createElement('div');
      [...row.cells].forEach((cell) => {
        const value = document.createElement('div');
        value.append(...cell.childNodes);
        div.append(value);
      });
      block.append(div);
    });
    section.append(block);
  } else section.append(node);
});
await import('../scripts/scripts.js');
