/* eslint-env node */
/* eslint-disable no-await-in-loop -- Captures are processed sequentially into review artifacts. */
// Rebuild the local authoring pack from freshly inspected public DOM captures.
// Usage: node docs/refresh-current-pages.mjs /path/to/captures
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Review-only generator: the project intentionally uses devDependencies only.
// eslint-disable-next-line import/no-extraneous-dependencies
import { parseHTML } from 'linkedom';

const captureDir = resolve(process.argv[2] || '/tmp/etrade-current-audit');
const paths = ['/home', '/home/welcome-back', '/what-we-offer/our-accounts', '/what-we-offer/our-accounts/brokerage-account', '/planning', '/why-etrade'];
const ids = ['homepage', 'welcome-back', 'our-accounts', 'brokerage', 'planning', 'why-etrade'];
const titles = ['Home', 'Welcome Back', 'Our Accounts', 'Brokerage Account', 'Planning', 'Why E*TRADE'];
const disclosureIds = [
  ['savingsboost', 'savingscomparison', 'savingsbonus', 'savingsaward', 'tradingfees', 'brokerageoffer', 'futuresfees', 'bondfees', 'savingsbase', 'cdrate', 'cdterms', 'platformaward', 'researchaward'],
  [],
  ['savingsaward', 'savingsboost', 'nationalaverage', 'depositcoverage', 'cdterms', 'cdrate', 'cdwithdrawals', 'rothdistribution', 'irawithdrawals', 'debiteligibility', 'advisoryfees', 'checkingrate', 'atmrefunds', 'foreigntransactions', 'lendingrisk', 'savingsbonus'],
  ['brokerageoffer', 'otherfees', 'tradingfees', 'bondfees', 'futuresfees', 'platformaward', 'nerdwalletaward'],
  ['retirementoffer', 'advisors'],
  ['tradingfees', 'platformaward', 'advisors'],
];
const escape = (s = '') => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const blocks = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th']);
const inline = new Set(['sup', 'strong', 'b', 'em', 's', 'del', 'br']);
function clean(node) {
  if (!node) return '';
  if (node.nodeType === 3) return node.textContent.trim() === '>' ? '' : escape(node.textContent.replace(/\s+/g, ' '));
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  if (['script', 'style', 'svg', 'input', 'button', 'iframe', 'noscript'].includes(tag) || node.classList.contains('material-icons')) return '';
  if (tag === 'img') return `<img src="${escape(new URL(node.getAttribute('src'), 'https://us.etrade.com').href)}" alt="${escape(node.getAttribute('alt') || '')}">`;
  const children = [...node.childNodes].map(clean).join('').trim();
  if (tag === 'br') return '<br>';
  if (!children) return '';
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (!href || /^javascript:/i.test(href)) return children;
    return `<a href="${escape(new URL(href, 'https://us.etrade.com').href)}">${children}</a>`;
  }
  if (blocks.has(tag) || inline.has(tag)) {
    const span = ['th', 'td'].includes(tag) && node.getAttribute('colspan') ? ` colspan="${escape(node.getAttribute('colspan'))}"` : '';
    const id = /^h[1-6]$/.test(tag) ? node.id || node.querySelector('a[id]')?.id : '';
    return `<${tag}${span}${id ? ` id="${escape(id)}"` : ''}>${children}</${tag}>`;
  }
  if (tag === 'div' && !node.querySelector('p,h1,h2,h3,h4,ul,ol,table,div')) return `<p>${children}</p>`;
  return children;
}
const rich = (e) => [...e.querySelectorAll('.richTextEditor')].map(clean).join('');
const links = (e, selector = 'a[href]') => [...e.querySelectorAll(selector)].map((a) => `<p>${clean(a)}</p>`).join('');
const image = (e) => clean(e.querySelector('img'));
const table = (name, rows) => `<table><thead><tr><th colspan="${Math.max(...rows.map((r) => r.length), 1)}">${escape(name)}</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const block = (name, rows) => ({ name, rows });
const section = (html = '', items = [], style = '') => ({ html, blocks: items, style });
function card(cardElement, withImage = false) {
  return [...(withImage ? [image(cardElement)] : []), clean(cardElement.querySelector('p.eyebrow-small')) + clean(cardElement.querySelector('.card-text-group') || cardElement.querySelector('.card-body')), links(cardElement, '.card-btn-group a,.card-footer a')].filter(Boolean).join('');
}
function splitHero(e, name) {
  const h1 = e.querySelector('h1');
  const h2 = e.querySelector('h2');
  const mainCopy = e.querySelector('.richTextEditor');
  const heroRows = [['Eyebrow', clean(h1)], ['Heading', clean(h2)], ['Content', clean(mainCopy.querySelector('p')) + links(mainCopy)], ['Image', image(e)]];
  const others = [...e.querySelectorAll('.richTextEditor')].slice(1);
  if (others.length) heroRows.push(['Offer', others.map(clean).join('')]);
  return block(name, heroRows);
}
function feature(e, name) {
  const copy = rich(e) || `${clean(e.querySelector('.basic-eyebrow')) + clean(e.querySelector('.basic-title'))}<p>${clean(e.querySelector('.basic-description'))}</p>${links(e, '.basic-button-container a')}`;
  return block(name, [[image(e), copy]]);
}
function faq(e) {
  const items = [...e.querySelectorAll('.accordion-item-wrapper, .faq-group .panel')];
  const rows = items.map((item) => {
    const trigger = item.querySelector('.accordion-trigger__text,.accordion-toggle,h4');
    const answer = item.querySelector('.accordion-item-content,.faq-answer,.accordion-body,.collapse,.panel-body');
    return [trigger ? `<h3>${escape(trigger.textContent.replace(/[\ue000-\uf8ff]/g, '').replace(/expand_more/g, '').trim())}</h3>` : '', clean(answer)];
  }).filter(([q, a]) => q && a);
  return block('Accordion FAQ', rows);
}
function intro(e) {
  return [...e.querySelectorAll('.richTextEditor')].filter((r) => !r.closest('.card-container') && !r.closest('.card-group')).map(clean).join('');
}
function iconRows(e) {
  return [...e.querySelectorAll('.card-container')].map((c) => {
    const glyph = [...(c.querySelector('.et-icon')?.classList || [])].find((cl) => /^et-(?!icon)/.test(cl));
    return [escape(glyph?.slice(3) || 'offer'), card(c)];
  });
}
const all = [];
for (let i = 0; i < paths.length; i += 1) {
  const { document } = parseHTML(await readFile(resolve(captureDir, `live-${i}.html`), 'utf8'));
  const sourceSections = [...document.querySelectorAll('.componentContainer')].filter((e) => !e.parentElement.closest('.componentContainer'));
  const at = (n) => sourceSections[n];
  let sections = [];
  if (i === 0) {
    const hero = at(0);
    sections.push(section('', [block('Hero Dark', [[clean(hero.querySelector('h1'))], [rich(hero).replace(clean(hero.querySelector('h1')), '')], ['Media', `<p><a href="${escape(hero.querySelector('video source').getAttribute('src'))}">Savings offer animation</a></p>`], ['Media description', '<p>Comparison of the promotional savings rate with competitor savings rates. See the authored offer terms below.</p>']]), block('Banner Offer (Light)', [[image(at(1)), rich(at(1))]])], 'dark'));
    sections.push(section('', [block('Separator', [['<p>Light</p>']])]));
    sections.push(section('', [feature(at(2), 'Columns Feature (Dark, Media First)')]));
    const promo = at(3);
    const tierRows = [...promo.querySelectorAll('.promo-dropdown-menu [role=option]')].map((e) => [escape(e.getAttribute('value') || ''), escape(e.getAttribute('data-cash-value') || '')]).filter((r) => r.every(Boolean));
    if (!tierRows.length) throw new Error('Homepage offer tiers were not captured.');
    sections.push(section(clean(promo.querySelector('h2')) + clean(promo.querySelector('h2')?.nextElementSibling), [block('Widget Calculator', [
      ['Heading', clean(promo.querySelector('.promo-headline'))], ['Description', clean(promo.querySelector('.promo-description')?.nextElementSibling)], ['Promo code', clean(promo.querySelector('.promo-code'))], ['Primary CTA', links(promo, '.first-promo-button a')], ['Secondary CTA', links(promo, '.second-promo-button a')], ['Funding label', '<p>Deposit amount*</p>'], ['Credit label', '<p>Cash credit</p>'], ['Select label', '<p>Funding amount</p>'], ['Disclaimer', clean(promo.querySelector('.promotion-note-container'))], ...tierRows,
    ])], 'light'));
    const pricing = at(4);
    sections.push(section(intro(pricing), [block('Cards Pricing', [...pricing.querySelectorAll('.pricing-card')].map((c) => [clean(c.querySelector('.numeric-stats-lg')) + card(c)])), block('Cards Product (Three Columns)', [...pricing.querySelectorAll('.super-card-one')].map((c) => [card(c)]))], 'light'));
    sections.push(section('', [feature(at(5), 'Columns Feature (Image Right, Dark, Band, Outline)')]));
    const awards = at(6);
    const awardHeadings = [...awards.querySelectorAll('h2')];
    const awardRows = awardHeadings.map((h) => { const r = h.closest('.richTextEditor'); return ['<p>:award:</p>', clean(r)]; });
    sections.push(section('<h2>Awards and recognition</h2>', [block('Cards Award', awardRows)], 'light'));
    sections.at(-1).html += links(awards);
    sections.push(section(clean(at(7).querySelector('h2')) + links(at(7), '.richTextEditor a'), [faq(at(7))], 'light'));
  } else if (i === 1) {
    const { document: seed } = parseHTML(await readFile(new URL('./welcome-back-content.html', import.meta.url), 'utf8'));
    const groups = [[]];
    [...seed.childNodes].forEach((n) => { if (n.tagName === 'HR') groups.push([]); else groups.at(-1).push(n); });
    sections = groups.map((nodes) => section(nodes.filter((n) => n.tagName !== 'TABLE').map((n) => n.outerHTML || '').join(''), nodes.filter((n) => n.tagName === 'TABLE' && n.querySelector('th')?.textContent !== 'Metadata').map((t) => block(t.querySelector('th').textContent, [...t.querySelectorAll('tr')].slice(1).map((r) => [...r.children].map((c) => c.innerHTML)))))).filter((s) => s.blocks.length);
  } else if (i === 2) {
    sections.push(section('', [block('Hero Light', [[rich(at(0))]])]));
    const tabRows = [...document.querySelectorAll('[role=tabpanel]')].map((panel, n) => {
      const labels = ['Most Popular', 'Brokerage', 'Retirement', 'Managed Portfolios', 'Small Business Retirement', 'Bank', 'Cryptocurrency'];
      const cards = [...panel.querySelectorAll('.card-group .card')];
      const text = clean(panel.querySelector('.richTextEditor'));
      const list = `<ul>${cards.map((c) => `<li>${card(c)}</li>`).join('')}</ul>`;
      const banner = [...panel.querySelectorAll('.richTextEditor')].slice(1).map(clean).join('');
      return [escape(labels[n]), text + list + banner];
    });
    sections.push(section('', [block('Tabs Accounts', tabRows)]));
    sections.push(section(intro(at(8)), [faq(at(8))]));
  } else if (i === 3) {
    sections.push(section('', [splitHero(at(0), 'Hero Product')]));
    sections.push(section(intro(at(1)), [block('Cards Pricing (Text Links)', [...at(1).querySelectorAll('.pricing-card')].map((c) => [clean(c.querySelector('.numeric-stats-lg')) + card(c)]))]));
    sections.push(section('', [block('Banner Offer', [[image(at(2)), rich(at(2))]])]));
    sections.push(section(intro(at(3)), [block('Cards Numbered', [...at(3).querySelectorAll('.pricing-card')].map((c) => [card(c)]))]));
    sections.push(section('', [feature(at(4), 'Columns Feature (Dark, Media First, Outline)')]));
    sections.push(section('', [feature(at(5), 'Columns Feature (Light, Award)')]));
    sections.push(section(intro(at(6)), [block('Cards Article', [...at(6).querySelectorAll('.super-card-two')].map((c) => [image(c), card(c)]))]));
    sections.push(section(intro(at(7)), [faq(at(7))]));
  } else if (i === 4) {
    sections.push(section('', [splitHero(at(0), 'Hero Dark (Split)')]));
    sections.push(section(clean(at(1).querySelector('h2')), [block('Cards Icon (Planning)', iconRows(at(1)))], 'light'));
    // The Read more action on the retirement offer lives outside the card's button group.
    const readMore = at(1).querySelector('.richTextEditor a');
    if (readMore && !sections.at(-1).blocks[0].rows.at(-1)[1].includes(readMore.getAttribute('href'))) sections.at(-1).blocks[0].rows.at(-1)[1] += `<p>${clean(readMore)}</p>`;
    sections.push(section('', [feature(at(2), 'Columns Feature (Dark, Media First)')], 'light'));
    const tools = at(3);
    sections.push(section(clean(tools.querySelector('h2')), [block('Cards Icon (Tools)', iconRows(tools)), block('Banner Offer (Compact)', [[image(tools), rich(tools).replace(clean(tools.querySelector('.richTextEditor')), '')]])], 'light'));
    sections.push(section(intro(at(4)), [block('Cards Article', [...at(4).querySelectorAll('.super-card-two')].map((c) => [image(c), card(c)]))], 'light'));
    sections.push(section(intro(at(5)), [faq(at(5))], 'light'));
  } else {
    sections.push(section('', [splitHero(at(0), 'Hero Dark (Split, Balanced)')]));
    sections.push(section(intro(at(1)), [block('Carousel Story', [...at(1).querySelectorAll('.super-card-two')].map((c) => [image(c), card(c)]))], 'light'));
    sections.push(section(intro(at(2)), [block('Cards Icon', iconRows(at(2)))], 'dark'));
    sections.push(section(intro(at(3)), [block('Cards Article (Promo)', [...at(3).querySelectorAll('.promo-card')].map((c) => [image(c), card(c)]))], 'light'));
  }
  const { document: legalDoc } = parseHTML(await readFile(resolve(captureDir, `legal-${i}.html`), 'utf8'));
  const legalRoot = legalDoc.querySelector('.legal-disclosures-footer');
  const numbered = [...legalRoot.querySelectorAll('ol')].find((e) => !e.parentElement.closest('ol'));
  const legalHtml = legalRoot.innerHTML;
  const splitAt = numbered ? legalHtml.indexOf(numbered.outerHTML) : -1;
  const parse = (html) => clean(parseHTML(`<div>${html}</div>`).document.firstElementChild);
  const introduction = parse(splitAt < 0 ? legalHtml : legalHtml.slice(0, splitAt));
  const closing = splitAt < 0 ? '' : parse(legalHtml.slice(splitAt + numbered.outerHTML.length));
  const disclosures = [...(numbered?.children || [])].map((e, n) => ({ id: disclosureIds[i][n], sourceNumber: n + 1, html: [...e.childNodes].map(clean).join('') }));
  if (disclosures.length !== disclosureIds[i].length) throw new Error(`${ids[i]}: incomplete legal capture`);
  if (i === 4) {
    const tax = [...legalRoot.querySelectorAll('span')].find((e) => e.textContent.trim().startsWith('Morgan Stanley and its affiliates do not provide tax advice'));
    if (!tax) throw new Error('Planning tax disclaimer was not captured.');
    disclosures.push({ id: 'taxadvice', sourceNumber: null, html: `<p>${clean(tax)}</p>` });
    sections.forEach((group) => group.blocks.forEach((b) => { b.rows = b.rows.map((r) => r.map((html) => html.replace('<sup>d1</sup>', '<sup>taxadvice</sup>'))); }));
  }
  if (i === 2) {
    const managed = [...legalRoot.querySelectorAll('span')].filter((e) => /^(Diversification and asset allocation|Prior to investing in a managed|The material provided by Morgan Stanley)/.test(e.textContent.trim()));
    disclosures.push({ id: 'managedportfolios', sourceNumber: null, html: managed.map((e) => `<p>${clean(e)}</p>`).join('') });
    sections[1].blocks[0].rows[3][1] = sections[1].blocks[0].rows[3][1].replace('<sup>8</sup>', '<sup>managedportfolios</sup>');
    sections[1].blocks[0].rows[5][1] = sections[1].blocks[0].rows[5][1].replace('months,<sup>4</sup>', 'months,<sup>2</sup>').replace('<sup>18</sup>', '<sup>16</sup>');
  }
  const migrate = (html) => html.replace(/<sup>(\d+(?:\s*,\s*\d+)*)<\/sup>/g, (match, nums) => {
    const mapped = nums.split(/\s*,\s*/).map((n) => disclosureIds[i][Number(n) - 1]);
    if (mapped.some((v) => !v)) throw new Error(`${ids[i]}: unresolved source marker ${nums}`);
    return `<sup>${mapped.join(',')}</sup>`;
  });
  sections.forEach((s) => {
    s.html = migrate(s.html);
    s.blocks.forEach((b) => { b.rows = b.rows.map((r) => r.map(migrate)); });
  });
  if (i === 2) {
    const bank = sections.flatMap((s) => s.blocks).find((b) => b.name === 'Tabs Accounts')
      .rows.find((r) => r[0] === 'Bank');
    const original = bank[1];
    bank[1] = original.replace(/up to \d+\.\d+% Annual Percentage Yield/, 'up to {{rate:checking-rate}}% Annual Percentage Yield');
    if (bank[1] === original) throw new Error('The checking APY claim needs review before adding its rate binding.');
    bank.push('<p>Rate settings</p><p>Name: checking-rate</p><p>Mode: api</p><p>Product: 4240</p><p>Field: advertisedAPY</p><p>Balance: 10000</p><p>Fallback: -.--</p>');
  }
  const metadata = [['Title', titles[i]], ['Description', `E*TRADE ${titles[i]} page.`], ['Header Theme', [0, 3, 4, 5].includes(i) ? 'dark' : 'light'], ['Nav Link Base', 'https://us.etrade.com'], ['Disclosures', `/disclosures/sets/${ids[i]}-current`]];
  if (i === 0) metadata.push(['Template', 'homepage']);
  if (i === 2) metadata.push(['Bank rates source', 'direct']);
  if (i === 1) {
    metadata.push(
      ['Market Data Base', 'https://us.etrade.com/phx/pros/apicontent/market/'],
      ['Market Data Mode', 'local'],
      ['Market Data Sample', '/data/market-data.json'],
    );
  }
  if (i === 4) metadata.push(['Template', 'planning']);
  const assetDoc = parseHTML(sections.map((s) => s.html + s.blocks.map((b) => table(b.name, b.rows)).join('')).join('')).document;
  const assets = [...assetDoc.querySelectorAll('img')].map((e) => ({ src: e.getAttribute('src'), alt: e.getAttribute('alt') }));
  const setId = `${ids[i]}-current`;
  const fragments = [{ path: `/disclosures/fragments/${setId}-introduction`, html: introduction }, ...disclosures.map((d) => ({ path: `/disclosures/fragments/${setId}-${d.id}`, html: d.html })), ...(closing ? [{ path: `/disclosures/fragments/${setId}-closing`, html: closing }] : [])];
  const disclosureSet = {
    id: setId, introduction: [{ kind: 'introduction', fragment: fragments[0].path }], disclosures: disclosures.map((d) => ({ disclosureId: d.id, fragment: `/disclosures/fragments/${setId}-${d.id}` })), closing: closing ? [{ fragment: `/disclosures/fragments/${setId}-closing` }] : [],
  };
  const page = {
    disclosureSet, fragments, id: ids[i], title: titles[i], path: paths[i], source: `https://us.etrade.com${paths[i]}`, checkedOn: '2026-10-12', sections, metadata, assets, legal: { introduction, disclosures, closing },
  };
  const pageHtml = sections.map((s) => s.html + s.blocks.map((b) => table(b.name, b.rows)).join('') + (s.style ? table('Section Metadata', [['Style', s.style]]) : '')).join('<hr>') + table('Metadata', metadata);
  await writeFile(new URL(`./${ids[i]}-current-authoring.html`, import.meta.url), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${titles[i]} — DA content captured October 12, 2026</title></head><body>${pageHtml}</body></html>\n`);
  all.push(page);
}
await writeFile(new URL('./current-pages.json', import.meta.url), `${JSON.stringify(all, null, 2)}\n`);
process.stdout.write(`${all.map((p) => `${p.path}: ${p.sections.length} groups, ${p.sections.reduce((n, s) => n + s.blocks.length, 0)} blocks, ${p.assets.length} images, ${p.legal.disclosures.length} disclosures`).join('\n')}\n`);
