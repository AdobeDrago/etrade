import { quoteURL } from './market-data.js';

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Named rows remain usable when authors omit cells or add extra value cells. */
export function authoredRows(block) {
  const rows = new Map();
  [...block.children].forEach((row) => {
    const [key, ...cells] = row.children;
    if (!key || !cells.length) return;
    const content = element('div');
    cells.forEach((cell) => content.append(...cell.childNodes));
    rows.set(key.textContent.trim().toLowerCase(), content);
  });
  return rows;
}

export function numberText(value, signed = false, precision = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: precision, signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
}

export function timeText(time) {
  return time ? new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(time) : 'Time unavailable';
}

export function changeNode(quote, prefix) {
  let direction = 'flat';
  if (quote.change === null) direction = 'unavailable';
  else if (quote.change < 0) direction = 'down';
  else if (quote.change > 0) direction = 'up';
  const labels = {
    down: 'Down', up: 'Up', flat: 'Unchanged', unavailable: 'Change unavailable',
  };
  const label = labels[direction];
  const text = `${numberText(quote.change, true)} (${numberText(quote.percent, true)}%)`;
  const node = element('span', `${prefix}-change ${direction}`, text);
  node.setAttribute('aria-label', `${label}: ${text}`);
  return node;
}

export function quoteLink(symbol, prefix) {
  const link = element('a', `${prefix}-symbol`, symbol);
  link.href = quoteURL(symbol);
  link.setAttribute('aria-label', `View ${symbol} quote and research`);
  return link;
}

/** A dependency-free chart. Full data remain available in a native disclosure table. */
export function lineChart(points, {
  prefix, color = 'var(--color-chart-index-1)', label, compact = false,
}) {
  const wrapper = element('div', `${prefix}-plot`);
  if (!points.length) {
    wrapper.append(element('p', `${prefix}-empty`, 'Chart unavailable'));
    return wrapper;
  }
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const first = points[0].time;
  const duration = points[points.length - 1].time - first || 1;
  let coordinates = [];
  let update;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}: ${points.length} observations, low ${numberText(low)}, high ${numberText(high)}. ${timeText(first)} to ${timeText(points[points.length - 1].time)}.`);
  const axes = document.createElementNS(ns, 'g');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(axes, path);
  const draw = () => {
    const rootFontSize = window.getComputedStyle?.(document.documentElement).fontSize;
    const unit = compact ? 1 : (Number.parseFloat(rootFontSize) || 16) / 16;
    const height = (compact ? 60 : 300) * unit;
    const width = svg.getBoundingClientRect?.().width
      || wrapper.getBoundingClientRect?.().width || 640;
    const left = compact ? 0 : 8 * unit;
    const right = width - (compact ? 0 : 60 * unit);
    const top = compact ? 2 : 12 * unit;
    const bottom = height - (compact ? 2 : 32 * unit);
    const magnitude = 10 ** Math.floor(Math.log10(span / 4));
    const step = Math.ceil((span / 4) / magnitude) * magnitude;
    const floor = compact ? low : Math.floor(low / step) * step;
    const ceiling = compact ? high : Math.ceil(high / step) * step;
    const clock = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(first);
    const minutes = Number(clock.find((p) => p.type === 'hour').value) * 60
      + Number(clock.find((p) => p.type === 'minute').value);
    const midnight = first - minutes * 60000;
    const start = compact ? first : midnight + 570 * 60000;
    const end = compact ? first + duration : midnight + 960 * 60000;
    coordinates = points.map((point) => [
      left + ((point.time - start) / (end - start)) * (right - left),
      bottom - ((point.value - floor) / (ceiling - floor || 1)) * (bottom - top),
    ]);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    axes.replaceChildren();
    const text = (value, x, y, anchor = 'start') => {
      const node = document.createElementNS(ns, 'text');
      node.textContent = value;
      node.setAttribute('x', x);
      node.setAttribute('y', y);
      node.setAttribute('text-anchor', anchor);
      node.setAttribute('fill', 'var(--color-text-secondary)');
      node.setAttribute('font-family', 'var(--font-family-body)');
      node.setAttribute('font-size', 'var(--font-size-12)');
      axes.append(node);
    };
    if (!compact) {
      for (let value = floor; value <= ceiling + step / 2; value += step) {
        const y = bottom - ((value - floor) / (ceiling - floor || 1)) * (bottom - top);
        const grid = document.createElementNS(ns, 'path');
        grid.setAttribute('d', `M${left},${y} H${right}`);
        grid.classList.add('market-chart-grid');
        grid.setAttribute('stroke', 'var(--color-border-default)');
        axes.append(grid);
        text(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value), right + 6 * unit, y + 4 * unit);
      }
      for (let hour = 10; hour <= 16; hour += 1) {
        const time = midnight + hour * 3600000;
        const x = left + ((time - start) / (end - start)) * (right - left);
        text(`${hour > 12 ? hour - 12 : hour} ${hour < 12 ? 'AM' : 'PM'}`, x, height - 5 * unit, 'middle');
      }
    }
    path.setAttribute('d', coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
    update?.();
  };
  wrapper.append(svg);
  draw();
  if (!compact) {
    const range = element('p', `${prefix}-range`, `Low ${numberText(low)} · High ${numberText(high)}`);
    const output = element('output', `${prefix}-readout`);
    const slider = element('input', `${prefix}-scrubber`);
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(points.length - 1);
    slider.value = slider.max;
    slider.setAttribute('aria-label', `Inspect ${label} chart observations`);
    const cursor = document.createElementNS(ns, 'circle');
    cursor.setAttribute('r', '5');
    cursor.setAttribute('fill', color);
    svg.append(cursor);
    update = () => {
      const index = Number(slider.value);
      const point = points[index];
      cursor.setAttribute('cx', coordinates[index][0]);
      cursor.setAttribute('cy', coordinates[index][1]);
      output.textContent = `${numberText(point.value)} · ${timeText(point.time)}`;
      slider.setAttribute('aria-valuetext', output.textContent);
    };
    slider.addEventListener('input', update);
    update();
    wrapper.append(output);
    const details = element('details', `${prefix}-data`);
    details.append(element('summary', '', 'View chart data'));
    const table = element('table');
    const caption = element('caption', '', `${label} observations (Eastern Time)`);
    const head = element('thead');
    const row = element('tr');
    ['As of', 'Value'].forEach((text) => {
      const cell = element('th', '', text);
      cell.scope = 'col';
      row.append(cell);
    });
    head.append(row);
    const body = element('tbody');
    points.forEach((point) => {
      const tr = element('tr');
      tr.append(element('td', '', timeText(point.time)), element('td', '', numberText(point.value)));
      body.append(tr);
    });
    table.append(caption, head, body);
    details.append(range, slider, table);
    wrapper.append(details);
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(wrapper);
  return wrapper;
}

export function dataNotice(sample, time, prefix) {
  return element('p', `${prefix}-notice`, sample
    ? `Sample data for review only · ${timeText(time)}`
    : `Data delayed by 15 minutes · ${timeText(time)}`);
}
