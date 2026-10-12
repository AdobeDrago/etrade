import {
  decorateSections, decorateBlocks, decorateIcons, loadBlock,
} from '../scripts/aem.js';
import decorateSectionBoundaries from '../scripts/section-layout.js';
import decorateDisclosureReferences from '../scripts/disclosure-references.js';

const pages = await (await fetch('./current-pages.json')).json();
const select = document.querySelector('#page-select');
const main = document.querySelector('main');
const panel = document.querySelector('#authoring-panel');
const status = document.querySelector('#copy-status');
const notes = [
  'Home: savings-rate hero and MP4, savings banner, brokerage feature, all ten calculator tiers, five pricing tiles, three product cards, banking, three awards and six FAQs. The live calculator headline advertises $1,500 while its upper tiers reach $10,000; all captured tiers are preserved.',
  'Welcome Back: full-width AI cybersecurity image, campaign on the left, white login panel on the right, two current campaign cards using DA-safe named icons, market ticker, overview and Top Five. Market regions currently read /data/market-data.json and show sample-data labels. The sign-in link works; embedded authentication remains a separate integration.',
  'Our Accounts: seven tabs with 6 / 3 / 6 / 2 / 4 / 4 / 1 accounts, including Cryptocurrency, and five FAQs. Bank order differs from Investment Choices. The source savings banner cites 4 and a nonexistent 18; prepared IDs bind its actual boosted-rate and bonus claims. The managed intro cites Roth disclosure 8 on the source; the pack instead binds the matching managed-portfolio text from the same footer.',
  'Brokerage: split product hero and offer, six pricing tiles, offer banner, three reasons, Power E*TRADE Pro, NerdWallet recognition, four current articles and seven FAQs. The struck-through $1,000 is preserved beside $1,500.',
  'Planning: full live structure with six life-event/offer cards, readiness calculator, four retirement tools, tax feature, three action cards and nine FAQs. The live retirement tile still says 06/30/26 while its disclosure says 10/31/26. The captured tile is retained and must be corrected to the content owner’s intended campaign before publishing. The source tax FAQ’s unmatched d1 marker binds to its existing tax-advice disclaimer.',
  'Why E*TRADE: current split hero, all seven dated story cards (1982–2025), six audience cards and three promo cards. Replace the shortened generic preview body with this full structure.',
];
let pageHtml = '';
let revision = 0;

pages.forEach((page, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = page.title;
  select.append(option);
});
const requested = new URL(window.location.href).searchParams.get('page');
const requestedIndex = pages.findIndex((p) => p.id === requested);
if (requestedIndex >= 0) select.value = String(requestedIndex);

function blockMarkup({ name, rows }) {
  const [base, options = ''] = name.replace(/\)$/, '').split(' (');
  const blockName = base.toLowerCase().replace(/\s+/g, '-');
  const classes = options.split(',').map((value) => value.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
  const node = document.createElement('div');
  node.className = `${blockName} ${classes.join(' ')}`;
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    node.append(row);
  });
  return node;
}
async function copy(html, buttonStatus = status) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([doc.body.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([doc.body.textContent], { type: 'text/plain' }),
    })]);
    buttonStatus.textContent = 'Copied. Paste into the specified DA document.';
  } catch {
    buttonStatus.textContent = 'Select and copy the rendered tables or fragment below.';
  }
}
function legalPanel(page) {
  const heading = document.createElement('h2');
  heading.textContent = 'Disclosure set and fragments';
  panel.append(heading);
  const instructions = document.createElement('p');
  instructions.textContent = `Save this structured disclosure-set JSON at /disclosures/sets/${page.disclosureSet.id}. Preview every referenced fragment. The body tables above use these semantic IDs.`;
  panel.append(instructions);
  const json = document.createElement('pre');
  json.textContent = JSON.stringify(page.disclosureSet, null, 2);
  panel.append(json);
  page.fragments.forEach((fragment) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = fragment.path;
    const content = document.createElement('div');
    content.innerHTML = fragment.html;
    const button = document.createElement('button');
    button.className = 'fragment-copy';
    button.type = 'button';
    button.textContent = 'Copy this fragment';
    const output = document.createElement('output');
    output.setAttribute('role', 'status');
    button.addEventListener('click', () => copy(fragment.html, output));
    details.append(summary, button, output, content);
    panel.append(details);
  });
}
async function show() {
  revision += 1;
  const current = revision;
  const page = pages[Number(select.value)];
  status.textContent = 'Loading current content…';
  const response = await fetch(`./${page.id}-current-authoring.html`);
  if (!response.ok) throw new Error('Prepared page content could not be loaded.');
  const html = await response.text();
  if (current !== revision) return;
  pageHtml = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  panel.innerHTML = `<h2>${page.title}: copyable page body</h2>${pageHtml}`;
  legalPanel(page);
  document.body.className = page.id === 'homepage' ? 'homepage' : page.id;
  const theme = document.querySelector('meta[name="header-theme"]') || document.head.appendChild(document.createElement('meta'));
  theme.name = 'header-theme';
  const [, headerTheme] = page.metadata.find(([key]) => key === 'Header Theme');
  theme.content = headerTheme;
  main.replaceChildren();
  page.sections.forEach((section) => {
    const node = document.createElement('div');
    node.innerHTML = section.html;
    section.blocks.forEach((b) => node.append(blockMarkup(b)));
    if (section.style) node.classList.add(section.style);
    main.append(node);
  });
  decorateIcons(main);
  decorateSections(main);
  decorateSectionBoundaries(main);
  decorateBlocks(main);
  document.body.classList.add('appear');
  document.querySelector('#page-note').textContent = notes[Number(select.value)];
  document.querySelector('#live-reference').href = page.source;
  document.querySelector('#page-file').href = `./${page.id}-current-authoring.html`;
  await Promise.all([...main.querySelectorAll('.block')].map(loadBlock));
  if (current !== revision) return;
  main.querySelectorAll('.section').forEach((s) => { s.dataset.sectionStatus = 'loaded'; s.style.display = ''; });
  document.querySelector('body > .disclosures')?.remove();
  const legal = document.createElement('div');
  legal.className = 'disclosures';
  legal.innerHTML = `<div class="disclosures-intro">${page.legal.introduction}</div><ol class="disclosures-items">${page.legal.disclosures.map((d, index) => `<li id="disclosure-${d.id}" data-disclosure-id="${d.id}" value="${index + 1}" tabindex="-1">${d.html}</li>`).join('')}</ol><div class="disclosures-closing">${page.legal.closing}</div>`;
  document.body.append(legal);
  if (!document.querySelector('link[href="/blocks/disclosures/disclosures.css"]')) {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet'; sheet.href = '/blocks/disclosures/disclosures.css'; document.head.append(sheet);
  }
  decorateDisclosureReferences(main, legal);
  const url = new URL(window.location.href);
  url.searchParams.set('page', page.id);
  window.history.replaceState(null, '', url);
  status.textContent = 'Local review ready. DA save and preview are separate.';
}
select.addEventListener('change', show);
document.querySelector('#copy-page').addEventListener('click', () => copy(pageHtml));
document.querySelector('#author-page').addEventListener('click', () => { panel.hidden = false; });
document.querySelector('#review-page').addEventListener('click', () => { panel.hidden = true; });
await show();
