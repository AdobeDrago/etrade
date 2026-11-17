# Contributing to E*TRADE Edge Delivery Services

This project (like almost all of Project Helix) is an Open Development project and welcomes contributions from everyone who finds it useful or lacking.

## Code Of Conduct

This project adheres to the Adobe [code of conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to cstaub at adobe dot com.

## Contributor License Agreement

All third-party contributions to this project must be accompanied by a signed contributor license. This gives Adobe permission to redistribute your contributions as part of the project. [Sign our CLA](http://opensource.adobe.com/cla.html)! You only need to submit an Adobe CLA one time, so if you have submitted one previously, you are good to go!

## Development workflow

Use Node.js 24 or newer and install the development tools with `npm ci`. Installation enables the shared Husky hooks. This is a browser-module project with no build step and no runtime package dependencies.

1. Start a branch from the appropriate integration branch, usually `develop`.
2. Read the owning block and served `.plain.html` before changing its behavior. The auto-block pipeline can change markup before decoration.
3. Run `npm run check` to execute all lint, repository checks and tests.
4. Review affected layouts in the browser, including narrow widths, keyboard focus and enlarged text.
5. Open a pull request using the PR template and an actual branch preview URL.

Merging `main` ships code. Content preview and publication remain separate operations.

## Checks and hooks

- `npm run lint`: JavaScript, CSS and repository guardrails.
- `npm run lint:fix`: supported JS/CSS fixes; review the resulting diff.
- `npm test`: the complete regression suite.
- `npm run check`: full lint and tests, also run by CI.
- `npm run lint:staged`: the same fast checks used by the pre-commit hook.

Pre-commit checks inspect staged files. lint-staged hides unstaged changes in partially staged files and restores them afterward. Hooks check code without automatically rewriting it. Changing lint configuration, tooling or package files runs full lint because those changes can affect every file. Full tests run in CI rather than on every commit. Vendored `scripts/aem.js` and generated importer bundles are excluded from automatic JS fixes; the repository check separately rejects any change or deletion of `scripts/aem.js`.

CI runs on pushes and pull requests. It also validates new commit messages, PR titles and the branch's `.aem.page` preview link. Branch protection must be configured in GitHub to make those status checks required for merging.

## CSS and JavaScript conventions

See [the guardrail policy](docs/lint-guardrails.md) for the exact scope and exceptions.

Use shared tokens for site colors and existing typography/spacing roles. Text and spacing use rem, scalable values or tokens; line heights are unitless. Physical strokes, artwork, existing container limits and viewport breakpoints may use pixels. Standalone authoring tools and documentation own their palettes and do not depend on the customer site's token stylesheet.

Keep block CSS scoped to the owning block, wrapper or container. Global shell and shared-reference rules belong in `styles/`. IDs stay available for labels, links and JS, while styling uses classes or attributes. Necessary `!important` exceptions require a narrow Stylelint suppression with a reason. Remove unused suppressions.

Share block helpers through `scripts/`; `fragment/fragment.js` is the only allowed cross-block import. Never edit `scripts/aem.js`. Keep tests and development tooling out of EDS delivery through `.hlxignore`.

## Commit and PR titles

Use Conventional Commits:

```text
fix(header): preserve keyboard focus
feat(cards): support an authored secondary action
style(library): use scalable spacing
chore(tooling): enforce project guardrails
```

Allowed types follow `@commitlint/config-conventional`: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. Scope is optional; the subject must describe the change and the complete header must fit within 100 characters. Link related issues in the body or PR description. Merge and generated revert messages use commitlint's standard exceptions.

Use normal `git commit`; the commit-msg hook validates the message. There is no commit wizard. PR titles follow the same convention so squash commits have useful subjects.

## Pull request validation

Describe the problem, resulting behavior, tests and remaining limitations. Include a before URL and the affected page on the branch preview, for example:

`https://codex-my-change--etrade--AdobeDrago.aem.page/home`

Replace slash-separated branch names with their AEM hostname form, such as `codex/my-change` → `codex-my-change`. A live URL, another branch's preview or a placeholder does not satisfy the PR check. Verify the actual preview after pushing; a syntactically valid URL alone does not prove that code or content has been synchronized.
