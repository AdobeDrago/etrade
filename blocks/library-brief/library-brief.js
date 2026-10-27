/** An authored documentation table: Title, Description, then labelled rich-text rows. */
export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children];
  const settings = new Map();
  const sections = [];

  rows.forEach((row) => {
    const [label, ...content] = row.children;
    const name = label?.textContent.trim();
    if (!name || !content.length) return;
    const key = name.toLowerCase();
    if (['title', 'description'].includes(key)) {
      settings.set(key, content.map((cell) => cell.textContent.trim()).filter(Boolean).join(' '));
      return;
    }
    if (!content.some((cell) => cell.textContent.trim()
      || cell.querySelector('picture, img, video, audio, iframe, table'))) return;
    row.classList.add('library-brief-section');
    label.classList.add('library-brief-section-label');
    label.setAttribute('role', 'heading');
    label.setAttribute('aria-level', '3');
    content.forEach((cell) => cell.classList.add('library-brief-section-content'));
    sections.push(row);
  });

  const details = doc.createElement('details');
  details.className = 'library-brief-disclosure';
  const summary = doc.createElement('summary');
  const title = doc.createElement('span');
  title.className = 'library-brief-title';
  title.textContent = settings.get('title') || 'Authoring guide';
  summary.append(title);
  const description = settings.get('description');
  if (description) {
    const hint = doc.createElement('span');
    hint.className = 'library-brief-description';
    hint.textContent = description;
    summary.append(hint);
  }
  const content = doc.createElement('div');
  content.className = 'library-brief-content';
  content.append(...sections);
  details.append(summary, content);
  block.replaceChildren(details);
  block.hidden = !sections.length;
}
