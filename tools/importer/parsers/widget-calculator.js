/* eslint-disable */
/* global WebImporter */
/**
 * Parser for widget-calculator. Custom interactive block (base "widget" is not
 * in the block library, so structure is derived from the block's decorate()).
 * Source: https://us.etrade.com/home (section 2 funding calculator).
 * Generated: 2026-09-20
 *
 * Block decorate() expects rows of two cells:
 *   [ label / heading text,  supporting text ]   -> intro row (non-numeric 1st cell)
 *   [ fundingAmount,         bonusAmount ]        -> one row per tier (numeric 1st cell)
 *
 * Source specifics: the live widget renders its funding->bonus mapping at
 * runtime via noUiSlider — the per-tier bonus figures are NOT present in the
 * static DOM. What the source DOM does expose:
 *   - offer label "Cash credit" (#slider-offer-value default "$50")
 *   - deposit label "Deposit amount*" (#slider-default-slab-id default "$1,000")
 *   - 10 funding tiers from the promo dropdown (.dropdown-item range labels)
 *   - a promotion note paragraph
 * We capture the funding tiers (lower bound of each range) and the single known
 * default pairing ($1,000 -> $50 cash credit). Remaining tiers carry the
 * funding amount only; an author supplies the exact bonus per tier.
 */
export default function parse(element, { document }) {
  const cells = [];

  // --- Intro rows: labels + default values + promo note ---------------------
  const offerLabel = element.querySelector('.offer-description');
  const offerValue = element.querySelector('#slider-offer-value, .offer-value');
  const fundingLabel = element.querySelector('.funding-description, .promo-dropdown-label');

  // Label row (non-numeric first cell -> treated as intro by decorate()).
  const depositLabelText = (fundingLabel && fundingLabel.textContent.trim()) || 'Deposit amount';
  const creditLabelText = (offerLabel && offerLabel.textContent.trim()) || 'Cash credit';
  cells.push([depositLabelText, creditLabelText]);

  // Promotion note (starts with a non-numeric string -> intro row).
  const promoNote = element.querySelector('.promotion-note-container p, .promotion-note-container');
  if (promoNote && promoNote.textContent.trim()) {
    cells.push([promoNote.cloneNode(true), '']);
  }

  // --- Tier rows: funding amount -> bonus -----------------------------------
  const parseAmount = (text) => Number(String(text).replace(/[^0-9.]/g, '')) || 0;

  // Lower bound of each dropdown range ("$1,000 - $4,999" -> 1000, "$5,000,000+" -> 5000000).
  const rangeItems = [...element.querySelectorAll('.dropdown-item, .cfc__Dropdown__option')];
  const fundingTiers = rangeItems
    .map((li) => {
      const first = li.textContent.trim().split(/[-–—]|\+/)[0];
      return parseAmount(first);
    })
    .filter((n) => n > 0);

  // Known default pairing from the live slider: $1,000 deposit -> $50 cash credit.
  const defaultDeposit = parseAmount((element.querySelector('#slider-default-slab-id') || {}).textContent || '');
  const defaultCredit = parseAmount((offerValue || {}).textContent || '');
  const knownBonus = new Map();
  if (defaultDeposit > 0 && defaultCredit > 0) knownBonus.set(defaultDeposit, defaultCredit);

  // Ensure the default deposit tier is represented even if absent from ranges.
  const allFunding = [...new Set([...fundingTiers, ...knownBonus.keys()])].sort((a, b) => a - b);

  const fmt = (n) => `$${n.toLocaleString('en-US')}`;
  allFunding.forEach((funding) => {
    const bonus = knownBonus.has(funding) ? fmt(knownBonus.get(funding)) : '';
    cells.push([fmt(funding), bonus]);
  });

  // Bail gracefully if we found no meaningful content at all.
  if (cells.length <= 1 && !allFunding.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'widget-calculator', cells });
  element.replaceWith(block);
}
