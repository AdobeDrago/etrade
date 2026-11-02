function reviewSource(source) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const main = doc.querySelector('main');
  if (!main) throw new Error('The saved page has no main content to compare.');
  const metadata = Object.create(null);
  const add = (key, value) => {
    const name = key.trim().toLowerCase();
    if (name) metadata[name] = [metadata[name], value.trim()].filter(Boolean).join('\n');
  };
  doc.querySelectorAll('head meta[name], head meta[property]').forEach((meta) => {
    add(meta.getAttribute('name') || meta.getAttribute('property'), meta.getAttribute('content') || '');
  });
  if (doc.querySelector('title')) add('title', doc.querySelector('title').textContent);
  const metadataBlocks = [...main.querySelectorAll('.metadata, table')].filter((block) => (
    block.classList.contains('metadata') || block.querySelector('tr')?.textContent.trim().toLowerCase() === 'metadata'
  ));
  metadataBlocks.forEach((block) => {
    const rows = [...block.children].flatMap((row) => (row.tagName === 'TBODY' ? [...row.children] : [row]));
    rows.forEach((row) => {
      if (row.children.length < 2) return;
      const cell = row.children[1];
      add(row.children[0].textContent, cell.querySelector('a[href]')?.getAttribute('href') || cell.textContent);
    });
    block.remove();
  });
  main.querySelectorAll('.da-metadata, script, style, iframe, object, embed').forEach((node) => node.remove());
  const sections = main.children.length && [...main.children].every((node) => node.tagName === 'DIV')
    ? [...main.children] : [main];
  const blocks = sections.reduce((total, section) => total + [...section.children]
    .filter((node) => node.tagName === 'TABLE' || (node.tagName === 'DIV' && node.className)).length, 0);
  main.querySelectorAll('a[href]').forEach((link) => { link.append(` (${link.getAttribute('href')})`); });
  main.querySelectorAll('img').forEach((image) => { image.replaceWith(`[Image: ${image.getAttribute('alt') || image.getAttribute('src') || ''}]`); });
  main.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, br').forEach((node) => { node.append('\n'); });
  return {
    sections: sections.length,
    blocks,
    metadata,
    text: main.textContent.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'),
  };
}

/** Plain-text review only; neither saved nor incoming source is changed. */
export default function pageComparison(beforeSource, afterSource) {
  const before = reviewSource(beforeSource);
  const after = reviewSource(afterSource);
  const metadata = [...new Set([...Object.keys(before.metadata), ...Object.keys(after.metadata)])]
    .sort().map((key) => ({
      key,
      before: before.metadata[key] ?? '',
      after: after.metadata[key] ?? '',
      changed: before.metadata[key] !== after.metadata[key],
    }));
  return { before, after, metadata };
}
