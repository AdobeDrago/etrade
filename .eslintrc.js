const { readdirSync } = require('node:fs');
const { builtinModules } = require('node:module');
const { devDependencies } = require('./package');

const blocks = readdirSync(`${__dirname}/blocks`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name);

module.exports = {
  root: true,
  extends: 'airbnb-base',
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always', mjs: 'always', cjs: 'always' }],
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
  },
  overrides: [
    {
      files: ['tools/lint/**', '*.config.cjs', '*.config.mjs', '.eslintrc.js'],
      env: { node: true, es2022: true },
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
    ...blocks.map((block) => ({
      files: [`blocks/${block}/**/*.{js,mjs,cjs}`],
      rules: {
        'import/no-restricted-paths': ['error', {
          basePath: __dirname,
          zones: [{
            target: `./blocks/${block}`,
            from: './blocks',
            except: [`./${block}`, './fragment/fragment.js'],
            message: 'Share helpers through /scripts/. Fragment is the only cross-block import.',
          }],
        }],
        'no-restricted-imports': ['error', {
          paths: [...Object.keys(devDependencies), ...builtinModules].map((name) => ({
            name,
            message: 'Site code uses browser modules, without runtime package dependencies.',
          })),
          patterns: [
            {
              group: ['node:*', ...Object.keys(devDependencies).map((name) => `${name}/**`)],
              message: 'Site code uses browser modules, without runtime package dependencies.',
            },
            {
              group: ['../fragment/**', '**/blocks/fragment/**', '!../fragment/fragment.js', '!**/blocks/fragment/fragment.js'],
              message: 'Only fragment/fragment.js may be imported across blocks.',
            },
            {
              group: blocks.filter((name) => name !== block && name !== 'fragment')
                .flatMap((name) => [`../${name}/**`, `**/blocks/${name}/**`]),
              message: 'Share helpers through /scripts/. Fragment is the only cross-block import.',
            },
          ].filter((pattern) => pattern.group.length),
        }],
      },
    })),
  ],
};
