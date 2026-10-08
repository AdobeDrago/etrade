const SVG_NS = 'http://www.w3.org/2000/svg';

function color(value, fallback) {
  const tokens = { light: '#fafafa', dark: '#121213' };
  const candidate = tokens[value?.toLowerCase()] || value;
  return candidate && CSS.supports('color', candidate) ? candidate : fallback;
}

function height(value) {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i.test(value || '')) return null;
  const pixels = Number.parseFloat(value);
  return pixels > 0 && Number.isFinite(pixels) ? `${pixels}px` : null;
}

function position(value) {
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(value || '')) return 50;
  return Math.min(100, Math.max(0, Number.parseFloat(value)));
}

export default function decorate(block) {
  const settings = {};
  [...block.children].forEach((row) => {
    const [key, value] = row.children;
    if (!key || !value) return;
    const name = key.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (name) settings[name] = value.textContent.trim();
  });

  block.style.setProperty('--separator-first-color', color(settings['first-section-color'], '#121213'));
  block.style.setProperty('--separator-second-color', color(settings['second-section-color'], '#fafafa'));
  const desktopHeight = height(settings.height);
  const mobileHeight = height(settings['mobile-height']);
  if (desktopHeight) block.style.setProperty('--separator-height', desktopHeight);
  if (mobileHeight) block.style.setProperty('--separator-mobile-height', mobileHeight);
  const bend = position(settings['line-break-location'] || settings['line-break']);
  const lineColor = settings['line-color'] === 'none' ? 'none' : color(settings['line-color'], null);
  if (lineColor) block.style.setProperty('--separator-line-color', lineColor);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('separator-art');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const surface = document.createElementNS(SVG_NS, 'path');
  surface.classList.add('separator-surface');
  const line = document.createElementNS(SVG_NS, 'path');
  line.classList.add('separator-line');
  svg.append(surface, line);
  block.replaceChildren(svg);
  // This is decorative artwork, not a semantic separator or a focus target.
  block.setAttribute('aria-hidden', 'true');

  const draw = () => {
    const { width, height: blockHeight } = block.getBoundingClientRect();
    if (!width || !blockHeight) return;
    const x = (width * bend) / 100;
    const sameColor = getComputedStyle(surface).fill === getComputedStyle(block).backgroundColor;
    const outlined = lineColor ? lineColor !== 'none' : sameColor;
    const inset = outlined ? Math.min(0.5, blockHeight / 2) : 0;
    const bottom = blockHeight - inset;
    const radius = Math.max(0, Math.min(16, x, width - x, (bottom - inset) / 2));
    const curve = radius
      ? `H ${x - radius} A ${radius} ${radius} 0 0 1 ${x} ${inset + radius}
         V ${bottom - radius} A ${radius} ${radius} 0 0 0 ${x + radius} ${bottom}`
      : `H ${x} V ${bottom}`;
    const path = `M 0 ${inset} ${curve} H ${width}`;
    svg.setAttribute('viewBox', `0 0 ${width} ${blockHeight}`);
    surface.setAttribute('d', `${path} V ${blockHeight} H 0 Z`);
    line.setAttribute('d', path);
    // Equal surfaces need an outline to keep the production-style line visible.
    if (!lineColor) {
      block.style.setProperty('--separator-line-color', sameColor ? '#ccc' : 'none');
    }
  };
  draw();
  // Recalculate only when this block changes size; corners remain 16px on any viewport.
  new ResizeObserver(draw).observe(block);
}
