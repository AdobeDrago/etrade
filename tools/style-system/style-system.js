const controls = Object.fromEntries(['family', 'scheme', 'container', 'grid', 'spacing'].map((name) => [name, document.getElementById(name)]));
const preview = document.getElementById('preview');

function update() {
  const values = Object.fromEntries(Object.entries(controls)
    .map(([name, control]) => [name, control.value]));
  document.documentElement.dataset.pageTheme = values.family;
  preview.dataset.sectionTheme = values.scheme;
  preview.dataset.sectionContainer = values.container;
  preview.dataset.sectionGrid = values.grid;
  preview.dataset.sectionSpacing = values.spacing;
  preview.style.setProperty('--section-grid-count', values.grid);
  document.getElementById('metadata').textContent = `Page Metadata\n  Theme: ${values.family}\n\nSection Metadata\n  Container: ${values.container}\n  Grid: ${values.grid}\n  Gap: l\n  Spacing: ${values.spacing}\n  Color Scheme: ${values.scheme}`;
  const style = getComputedStyle(document.documentElement);
  document.getElementById('inverse-value').textContent = style.getPropertyValue('--color-surface-inverse').trim();
  document.getElementById('action-value').textContent = style.getPropertyValue('--color-action-primary').trim();
  document.getElementById('radius-value').textContent = style.getPropertyValue('--radius-card').trim();
  document.getElementById('summary').textContent = `${values.family === 'purple' ? 'Purple' : 'Charcoal'} family · ${values.scheme} section · ${values.container} container · ${values.grid} blocks per row on wide screens`;
}

Object.values(controls).forEach((control) => control.addEventListener('change', update));
document.getElementById('reset').addEventListener('click', () => {
  Object.entries({
    family: 'charcoal', scheme: 'dark', container: 'standard', grid: '3', spacing: 'l',
  })
    .forEach(([name, value]) => { controls[name].value = value; });
  update();
});
update();
