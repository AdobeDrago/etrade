import { ESLint } from 'eslint';

export default async function stagedChecks(files) {
  const tasks = [];
  const relative = files.map((file) => file.replace(`${process.cwd()}/`, ''));
  const configuration = new Set([
    '.eslintrc.js', '.eslintignore', '.stylelintrc.json',
    'package.json', 'package-lock.json', 'lint-staged.config.mjs',
  ]);
  if (relative.some((file) => configuration.has(file) || file.startsWith('tools/lint/'))) {
    tasks.push('npm run lint');
    return tasks;
  }
  const eslint = new ESLint();
  const js = (await Promise.all(files.filter((file) => /\.(?:js|mjs|cjs)$/.test(file))
    .map(async (file) => (await eslint.isPathIgnored(file) ? null : file)))).filter(Boolean);
  const css = files.filter((file) => file.endsWith('.css'));
  // lint-staged executes argv without a shell; quoting preserves filenames containing spaces.
  if (js.length) tasks.push(`eslint --max-warnings 0 --report-unused-disable-directives ${js.map((file) => JSON.stringify(file)).join(' ')}`);
  if (css.length) tasks.push(`stylelint --max-warnings 0 ${css.map((file) => JSON.stringify(file)).join(' ')}`);
  return tasks;
}
