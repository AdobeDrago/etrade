/**
 * widget-calculator — interactive funding calculator. An author supplies the
 * bonus tiers as a table; the block renders a slider that maps a funding amount
 * to the projected bonus.
 *
 * Expected authored structure (rows of two cells):
 *   [ "Heading",        "Adjust your funding..." ]   (optional intro row)
 *   [ fundingAmount,    bonusAmount ]                 (one row per tier)
 *
 * Numeric cells are parsed leniently ("$1,000" -> 1000).
 */

function parseNumber(text) {
  const n = Number(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export default function decorate(block) {
  const rows = [...block.children];

  // Collect (funding, bonus) tiers from rows whose first cell is numeric.
  const tiers = [];
  const introRows = [];
  rows.forEach((row) => {
    const cells = [...row.children];
    if (cells.length >= 2 && parseNumber(cells[0].textContent) > 0) {
      tiers.push({
        funding: parseNumber(cells[0].textContent),
        bonus: parseNumber(cells[1].textContent),
      });
    } else {
      introRows.push(row);
    }
  });

  tiers.sort((a, b) => a.funding - b.funding);

  // Preserve any intro/heading content, then clear the block for the UI.
  const intro = document.createElement('div');
  intro.className = 'widget-calculator-intro';
  introRows.forEach((row) => intro.append(...row.children));
  block.textContent = '';
  if (intro.children.length) block.append(intro);

  if (!tiers.length) return;

  const min = tiers[0].funding;
  const max = tiers[tiers.length - 1].funding;

  const control = document.createElement('div');
  control.className = 'widget-calculator-control';
  control.innerHTML = `
    <label class="widget-calculator-field">
      <span class="widget-calculator-label">Funding amount</span>
      <output class="widget-calculator-funding"></output>
    </label>
    <input class="widget-calculator-slider" type="range"
      min="${min}" max="${max}" step="${Math.max(1, Math.round((max - min) / 100))}" value="${min}" />
    <div class="widget-calculator-result">
      <span class="widget-calculator-label">Your bonus</span>
      <span class="widget-calculator-bonus"></span>
    </div>`;
  block.append(control);

  const slider = control.querySelector('.widget-calculator-slider');
  const fundingOut = control.querySelector('.widget-calculator-funding');
  const bonusOut = control.querySelector('.widget-calculator-bonus');

  const bonusFor = (amount) => {
    let result = tiers[0].bonus;
    tiers.forEach((tier) => {
      if (amount >= tier.funding) result = tier.bonus;
    });
    return result;
  };

  const update = () => {
    const amount = Number(slider.value);
    fundingOut.textContent = formatCurrency(amount);
    bonusOut.textContent = formatCurrency(bonusFor(amount));
  };

  slider.addEventListener('input', update);
  update();
}
