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
  prefix, color = '#0065e3', label, compact = false,
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
  const width = 640;
  const height = compact ? 80 : 240;
  const inset = compact ? 5 : 24;
  const coordinates = points.map((point) => [
    inset + ((point.time - first) / duration) * (width - 2 * inset),
    height - inset - ((point.value - low) / span) * (height - 2 * inset),
  ]);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}: ${points.length} observations, low ${numberText(low)}, high ${numberText(high)}. ${timeText(first)} to ${timeText(points[points.length - 1].time)}.`);
  if (!compact) {
    [inset, height / 2, height - inset].forEach((y) => {
      const grid = document.createElementNS(ns, 'path');
      grid.setAttribute('d', `M${inset},${y} H${width - inset}`);
      grid.setAttribute('stroke', '#ddd');
      svg.append(grid);
    });
  }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', compact ? '2' : '3');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(path);
  wrapper.append(svg);
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
    const update = () => {
      const index = Number(slider.value);
      const point = points[index];
      cursor.setAttribute('cx', coordinates[index][0]);
      cursor.setAttribute('cy', coordinates[index][1]);
      output.textContent = `${numberText(point.value)} · ${timeText(point.time)}`;
      slider.setAttribute('aria-valuetext', output.textContent);
    };
    slider.addEventListener('input', update);
    update();
    wrapper.append(range, output, slider);
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
    details.append(table);
    wrapper.append(details);
  }
  return wrapper;
}

export function dataNotice(sample, time, prefix) {
  return element('p', `${prefix}-notice`, sample
    ? `Sample data for review only · ${timeText(time)}`
    : `Data delayed by 15 minutes · ${timeText(time)}`);
}
