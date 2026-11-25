import { groupActions } from '../../scripts/actions.js';

const HEADING = /^H[2-6]$/;

/** Feature Grid: each heading and the content after it becomes one feature card. */
function groupFeatures(col) {
  if ([...col.children].filter((node) => HEADING.test(node.tagName)).length < 2) return;
  const list = document.createElement('ul');
  list.className = 'columns-features';
  let feature;
  [...col.children].forEach((node) => {
    if (HEADING.test(node.tagName)) {
      feature = document.createElement('li');
      feature.className = 'columns-feature';
      list.append(feature);
    }
    feature?.append(node);
  });
  col.append(list);
}

export default function decorate(block) {
  const cols = [...(block.firstElementChild?.children || [])];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      groupActions(col, 'columns');
      if (block.classList.contains('feature-grid')) groupFeatures(col);
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}
