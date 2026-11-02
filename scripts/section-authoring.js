const sizes = new Set(['none', 'xs', 's', 'm', 'l', 'xl', 'xxl']);
const containers = new Set(['narrow', 'standard', 'full']);
const surfaces = new Set(['default', 'page', 'subtle', 'inverse', 'inverse-raised', 'highlight']);

function readSectionAttributes(section) {
  const values = new Map();
  [
    'container', 'grid', 'gap', 'spacing', 'align', 'color scheme', 'theme',
    'background', 'background color', 'anchor',
  ].forEach((key) => {
    const text = section.getAttribute(`data-${key.replaceAll(' ', '-')}`);
    if (text !== null) values.set(key, { text: text.trim() });
  });
  return values;
}

function readMetadata(block) {
  const values = new Map();
  [...block.children].forEach((row) => {
    const [label, ...cells] = row.children;
    const key = label?.textContent.trim().toLowerCase().replaceAll('-', ' ').replace(/\s+/g, ' ');
    if (!key || !cells.length) return;
    values.set(key, {
      text: cells.map((cell) => cell.textContent.trim()).join(' ').trim(),
      image: cells.map((cell) => cell.querySelector('picture, img')).find(Boolean),
    });
  });
  return values;
}

function styleOptions(section, text, options) {
  text.split(',').forEach((value) => {
    const name = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return;
    section.classList.add(name);
  });
  [...section.classList].forEach((name) => {
    const [, grid] = name.match(/^grid-([1-6])$/) || [];
    if (grid) options.grid = grid;
    ['gap', 'spacing', 'container'].forEach((key) => {
      if (name.startsWith(`${key}-`)) options[key] = name.slice(key.length + 1);
    });
    if (name === 'container' && !options.container) options.container = 'standard';
    if (name === 'light-scheme' || name === 'dark-scheme') options.theme = name.startsWith('dark') ? 'dark' : 'light';
    if (name === 'theme-purple' || name === 'theme-charcoal') options.family = name.slice(6);
    if (name === 'center') options.align = 'center';
  });
}

function backgroundValue(text) {
  const value = text.trim();
  const surface = value.toLowerCase().replace(/^surface-/, '');
  if (surfaces.has(surface)) {
    return {
      color: `var(--color-surface-${surface})`,
      theme: surface.startsWith('inverse') ? 'dark' : 'light',
    };
  }
  const token = value.match(/^(?:var\(\s*)?(--(?:color|palette|brand)-[a-z0-9-]+)\s*\)?$/i);
  if (token) return { color: `var(${token[1]})` };
  if (window.CSS?.supports('color', value)) return { color: value };
  if (/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value)
    && window.CSS?.supports('background-image', value)) return { gradient: value };
  return null;
}

function setBackground(section, metadata, main) {
  const background = metadata.get('background');
  const color = metadata.get('background color');
  const image = metadata.get('background image')?.image || background?.image;
  const value = backgroundValue(color?.text || (background?.image ? '' : background?.text) || '');
  if (value?.color) {
    section.style.backgroundColor = value.color;
    section.dataset.sectionBackground = 'color';
  }
  if (value?.gradient) {
    section.style.backgroundImage = value.gradient;
    section.dataset.sectionBackground = 'gradient';
  }
  if (image && (image.tagName === 'IMG' || image.querySelector('img'))) {
    const picture = image.tagName === 'PICTURE' ? image.cloneNode(true) : document.createElement('picture');
    if (image.tagName !== 'PICTURE') picture.append(image.cloneNode(true));
    picture.classList.add('section-background');
    picture.setAttribute('aria-hidden', 'true');
    picture.querySelectorAll('img').forEach((img) => {
      img.alt = '';
      img.loading = section === main.querySelector(':scope > .section') ? 'eager' : 'lazy';
      img.decoding = 'async';
    });
    section.prepend(picture);
    section.dataset.sectionBackground = 'image';
  }
  return value?.theme;
}

/** Consume authored section options before blocks load, without changing their wrappers. */
export default function decorateSectionAuthoring(main) {
  main.querySelectorAll(':scope > .section').forEach((section) => {
    const blocks = [...section.querySelectorAll(':scope > div > .section-metadata')];
    // Delivery can consume Section Metadata before the browser receives the page.
    const metadata = readSectionAttributes(section);
    blocks.forEach((block) => {
      readMetadata(block).forEach((value, key) => metadata.set(key, value));
    });
    const options = {};
    styleOptions(section, metadata.get('style')?.text || '', options);
    ['container', 'grid', 'gap', 'spacing', 'align'].forEach((key) => {
      if (metadata.has(key)) options[key] = metadata.get(key).text.toLowerCase();
    });
    const backgroundTheme = setBackground(section, metadata, main);
    const sectionTheme = metadata.get('theme')?.text.toLowerCase().replace(/^theme-/, '') || '';
    const family = sectionTheme || options.family;
    if (['purple', 'charcoal'].includes(family)) section.dataset.sectionFamily = family;
    const legacyScheme = ['light', 'dark'].includes(sectionTheme) ? sectionTheme : '';
    const theme = metadata.get('color scheme')?.text || legacyScheme
      || options.theme || backgroundTheme;
    if (containers.has(options.container)) section.dataset.sectionContainer = options.container;
    if (/^[1-6]$/.test(options.grid)) {
      section.dataset.sectionGrid = options.grid;
      section.style.setProperty('--section-grid-count', options.grid);
    }
    ['gap', 'spacing'].forEach((key) => {
      if (sizes.has(options[key])) section.dataset[`section${key === 'gap' ? 'Gap' : 'Spacing'}`] = options[key];
    });
    if (['left', 'center', 'right'].includes(options.align)) section.dataset.sectionAlign = options.align;
    if (['light', 'dark'].includes(theme?.toLowerCase())) {
      // Explicit schemes supersede legacy section classes that force descendant colors.
      section.classList.remove('light', 'dark');
      section.dataset.sectionTheme = theme.toLowerCase();
    }
    const anchor = (metadata.get('anchor')?.text || metadata.get('id')?.text || '').replace(/^#/, '');
    if (anchor && !/\s/.test(anchor)) section.id = anchor;
    if ([...section.attributes].some(({ name }) => name.startsWith('data-section-')
      && !['data-section-status', 'data-section-kind', 'data-section-family'].includes(name))) section.dataset.sectionLayout = 'authored';
    blocks.forEach((block) => {
      const wrapper = block.parentElement;
      block.remove();
      if (!wrapper.children.length && !wrapper.textContent.trim()) wrapper.remove();
    });
  });
}
