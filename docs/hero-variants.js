import { decorateSections, decorateBlocks } from '../scripts/aem.js';
import decorateDark from '../blocks/hero-dark/hero-dark.js';
import decorateLight from '../blocks/hero-light/hero-light.js';

const select = document.querySelector('#hero-example');
const main = document.querySelector('main');
const authorTable = document.querySelector('#author-table');
const status = document.querySelector('#copy-status');
const auditStatus = document.querySelector('#audit-status');
const findings = document.querySelector('#audit-findings');
let auditEngine;

function showExample() {
  const template = document.getElementById(select.value);
  const table = template.content.querySelector('table');
  const name = table.querySelector('th').textContent;
  const classes = name.toLowerCase().replace(/[(),]/g, '').trim().split(/\s+/);
  const blockName = classes.splice(0, 2).join('-');
  const block = document.createElement('div');
  block.classList.add(blockName, ...classes);
  [...table.querySelectorAll('tbody > tr')].forEach((row) => {
    const blockRow = document.createElement('div');
    [...row.cells].forEach((cell) => {
      const value = document.createElement('div');
      value.append(...[...cell.childNodes].map((node) => node.cloneNode(true)));
      blockRow.append(value);
    });
    block.append(blockRow);
  });
  const section = document.createElement('div');
  section.append(block);
  main.replaceChildren(section);
  decorateSections(main);
  decorateBlocks(main);
  if (blockName === 'hero-dark') decorateDark(block);
  else decorateLight(block);
  block.dataset.blockStatus = 'loaded';
  main.querySelector('.section').dataset.sectionStatus = 'loaded';
  main.querySelector('.section').style.display = '';
  authorTable.replaceChildren(table.cloneNode(true));
  document.querySelector('#example-title').textContent = template.dataset.title;
  document.querySelector('#example-note').textContent = template.dataset.note;
  status.textContent = '';
  auditStatus.textContent = '';
  findings.replaceChildren();
  const url = new URL(window.location.href);
  url.searchParams.set('page', select.value);
  window.history.replaceState(null, '', url);
}

const requested = new URL(window.location.href).searchParams.get('page');
if ([...select.options].some((option) => option.value === requested)) select.value = requested;
select.addEventListener('change', showExample);
showExample();

document.querySelector('#copy-hero').addEventListener('click', async () => {
  const html = authorTable.innerHTML;
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([authorTable.textContent], { type: 'text/plain' }),
    })]);
    status.textContent = 'Copied. Paste into the DA page.';
  } catch {
    status.textContent = 'Open the authoring table below and copy it manually.';
  }
});

// Local review only: axe-core is a devDependency, never loaded by production blocks.
document.querySelector('#check-hero').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  auditStatus.textContent = 'Checking the rendered hero…';
  findings.replaceChildren();
  try {
    if (!auditEngine) {
      auditEngine = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/node_modules/axe-core/axe.min.js';
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.append(script);
      });
    }
    await auditEngine;
    await document.fonts.ready;
    const result = await window.axe.run(main, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    auditStatus.textContent = `${result.violations.length} automated violations; ${result.incomplete.length} checks need manual review. Hero only; keyboard, reflow and authored content also need review.`;
    [...result.violations, ...result.incomplete].forEach((item) => {
      const finding = document.createElement('li');
      finding.textContent = `${item.id}: ${item.help} (${item.nodes.length} elements).`;
      findings.append(finding);
    });
  } catch {
    auditStatus.textContent = 'Check unavailable. Install the local devDependencies and reload this review page.';
    auditEngine = undefined;
  } finally {
    button.disabled = false;
  }
});
